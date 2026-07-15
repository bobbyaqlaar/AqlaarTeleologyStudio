"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronUp, ListOrdered, Loader2, Plus, Sparkles, Trash2, Workflow, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BpmnEditor } from "@/components/bpmn/bpmn-editor";
import { ConceptPicker } from "@/components/process-model/concept-picker";
import { processModelService } from "@/lib/api/process-model-service";
import { FUNCTION_UNIT_MAP, functionUnitsFor } from "@/lib/constants/function-units";
import { useRole } from "@/lib/context/role-context";
import { cn } from "@/lib/utils";
import type {
  FunctionalUnit,
  ProcessActor,
  ProcessMethod,
  ProcessMethodParam,
  ProcessModel,
  ProcessStep,
} from "@/lib/types";

interface ProcessModelWorkspaceProps {
  engagementId: string;
  streamType: string;
  functionUnits?: FunctionalUnit[];
}

export function ProcessModelWorkspace({
  engagementId,
  streamType,
  functionUnits,
}: ProcessModelWorkspaceProps): React.ReactNode {
  const { canEdit } = useRole();
  const [model, setModel] = useState<ProcessModel | null>(null);
  const [methods, setMethods] = useState<ProcessMethod[]>([]);
  const [actors, setActors] = useState<ProcessActor[]>([]);
  const [bpmnXml, setBpmnXml] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<"steps" | "bpmn">("steps");
  const [checkResult, setCheckResult] = useState<{
    valid: boolean;
    errors: number;
    warnings: number;
  } | null>(null);

  const refreshBpmn = useCallback(() => {
    void processModelService
      .fetchGeneratedBpmn(engagementId, streamType)
      .then(setBpmnXml)
      .catch(() => setBpmnXml(""));
  }, [engagementId, streamType]);

  const apply = useCallback(
    (next: ProcessModel) => {
      setModel(next);
      refreshBpmn();
    },
    [refreshBpmn],
  );

  const loadLibrary = useCallback(async () => {
    const [meths, acts] = await Promise.all([
      processModelService.listMethods(engagementId),
      processModelService.listActors(engagementId),
    ]);
    setMethods(meths);
    setActors(acts);
  }, [engagementId]);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const m = await processModelService.get(engagementId, streamType);
      setModel(m);
      refreshBpmn();
      await loadLibrary();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [engagementId, streamType, refreshBpmn, loadLibrary]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const run = useCallback(
    async (op: () => Promise<ProcessModel | void>) => {
      setBusy(true);
      setError(null);
      try {
        const result = await op();
        if (result) apply(result);
        await loadLibrary();
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setBusy(false);
      }
    },
    [apply, loadLibrary],
  );

  const problemsByStep = useMemo(() => {
    const map = new Map<string, ProcessModel["problems"]>();
    for (const problem of model?.problems ?? []) {
      const list = map.get(problem.stepId) ?? [];
      list.push(problem);
      map.set(problem.stepId, list);
    }
    return map;
  }, [model]);

  // All variable names currently in the process space (globals + produced
  // outputs) — used to suggest a free name when correcting an output problem.
  const usedVarNames = useMemo(() => {
    const names = new Set<string>();
    for (const g of model?.globals ?? []) names.add(g.name);
    for (const s of model?.steps ?? []) {
      for (const p of s.method?.params ?? []) {
        if (p.direction === "output") names.add(s.outputBindings[p.name] ?? p.name);
      }
    }
    return names;
  }, [model]);

  const suggestName = useCallback(
    (base: string) => {
      if (!usedVarNames.has(base)) return base;
      let i = 2;
      while (usedVarNames.has(`${base}_${i}`)) i += 1;
      return `${base}_${i}`;
    },
    [usedVarNames],
  );

  const seed = () =>
    run(() => processModelService.seedFromBaseline(engagementId, streamType));

  // Explicit on-demand check — re-runs the full input + output variable
  // validation server-side and surfaces a clear pass/fail result.
  const applyCheck = () =>
    run(async () => {
      const result = await processModelService.validate(engagementId, streamType);
      setCheckResult({
        valid: result.valid,
        errors: result.errors,
        warnings: result.warnings,
      });
      const model = await processModelService.get(engagementId, streamType);
      return model;
    });

  const moveStep = (step: ProcessStep, dir: -1 | 1) => {
    const steps = model?.steps ?? [];
    const index = steps.findIndex((s) => s.id === step.id);
    const swapWith = steps[index + dir];
    if (!swapWith) return;
    void run(async () => {
      await processModelService.updateStep(engagementId, streamType, step.id, {
        seq: swapWith.seq,
      });
      return processModelService.updateStep(engagementId, streamType, swapWith.id, {
        seq: step.seq,
      });
    });
  };

  const setBinding = (step: ProcessStep, param: string, value: string) =>
    run(() =>
      processModelService.updateStep(engagementId, streamType, step.id, {
        inputBindings: { ...step.inputBindings, [param]: value },
      }),
    );

  const setOutputBinding = (step: ProcessStep, param: string, value: string) =>
    run(() =>
      processModelService.updateStep(engagementId, streamType, step.id, {
        outputBindings: { ...step.outputBindings, [param]: value },
      }),
    );

  // Correction: bind an input to an existing compatible variable.
  const fixByBind = (step: ProcessStep, inputName: string, varName: string) =>
    setBinding(step, inputName, varName);

  // Correction: initialise a global of the input's expected type, then bind to it.
  const fixByGlobal = (step: ProcessStep, problem: ProcessModel["problems"][number]) =>
    run(async () => {
      const name = suggestName(problem.input ?? "var");
      await processModelService.addGlobal(engagementId, streamType, {
        name,
        conceptUri: problem.expected as string,
        conceptLabel: problem.expectedLabel ?? undefined,
      });
      return processModelService.updateStep(engagementId, streamType, step.id, {
        inputBindings: { ...step.inputBindings, [problem.input as string]: name },
      });
    });

  const errorCount = model?.problems.filter((p) => p.severity !== "warning").length ?? 0;
  const warnCount = model?.problems.filter((p) => p.severity === "warning").length ?? 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold">Process model — {streamType.toUpperCase()}</h2>
          {model ? (
            errorCount > 0 ? (
              <Badge variant="destructive" className="gap-1">
                <AlertTriangle className="size-3" />
                {errorCount} issue{errorCount === 1 ? "" : "s"}
              </Badge>
            ) : warnCount > 0 ? (
              <Badge className="gap-1 bg-amber-500 text-amber-950">
                <AlertTriangle className="size-3" />
                {warnCount} warning{warnCount === 1 ? "" : "s"}
              </Badge>
            ) : (
              <Badge variant="default" className="bg-emerald-600">Consistent</Badge>
            )
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex overflow-hidden rounded-md border border-border">
            <button
              type="button"
              onClick={() => setView("steps")}
              className={cn(
                "flex items-center gap-1 px-3 py-1.5 text-sm",
                view === "steps" ? "bg-accent text-accent-foreground" : "text-muted-foreground",
              )}
            >
              <ListOrdered className="size-4" /> Steps
            </button>
            <button
              type="button"
              onClick={() => setView("bpmn")}
              className={cn(
                "flex items-center gap-1 border-l border-border px-3 py-1.5 text-sm",
                view === "bpmn" ? "bg-accent text-accent-foreground" : "text-muted-foreground",
              )}
            >
              <Workflow className="size-4" /> BPMN
            </button>
          </div>
          <Button size="sm" disabled={busy} onClick={applyCheck} className="gap-2">
            {busy ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
            Apply &amp; check
          </Button>
          {canEdit ? (
            <Button size="sm" variant="outline" disabled={busy} onClick={seed} className="gap-2">
              <Sparkles className="size-4" />
              Seed from baseline
            </Button>
          ) : null}
        </div>
      </div>

      {checkResult ? (
        <p
          className={cn(
            "flex items-center gap-2 rounded-md border p-3 text-sm",
            checkResult.errors > 0
              ? "border-red-500/40 bg-red-500/5 text-red-500"
              : checkResult.warnings > 0
                ? "border-amber-500/40 bg-amber-500/5 text-amber-600 dark:text-amber-400"
                : "border-emerald-500/40 bg-emerald-500/5 text-emerald-600 dark:text-emerald-400",
          )}
        >
          {checkResult.errors > 0 || checkResult.warnings > 0 ? (
            <AlertTriangle className="size-4" />
          ) : (
            <CheckCircle2 className="size-4" />
          )}
          {checkResult.errors > 0
            ? `${checkResult.errors} issue${checkResult.errors === 1 ? "" : "s"} found`
              + (checkResult.warnings > 0 ? ` and ${checkResult.warnings} warning${checkResult.warnings === 1 ? "" : "s"}` : "")
              + " — see the flagged steps below."
            : checkResult.warnings > 0
              ? `Input and output variables check out, with ${checkResult.warnings} warning${checkResult.warnings === 1 ? "" : "s"} — see the flagged steps below.`
              : "All input and output variables check out — the process is consistent."}
        </p>
      ) : null}

      {error ? (
        <p className="rounded-md border border-red-500/40 bg-red-500/5 p-3 text-sm text-red-500">
          {error}
        </p>
      ) : null}

      <div className={cn("grid gap-4 lg:grid-cols-[1fr_20rem]", view === "bpmn" && "hidden")}>
        {/* Steps */}
        <div className="space-y-3">
          {(model?.steps ?? []).map((step, index) => {
            const method = step.method;
            const unit = actorUnit(actors, method);
            const meta = unit ? FUNCTION_UNIT_MAP[unit] : undefined;
            const stepProblems = problemsByStep.get(step.id) ?? [];
            const inputs = method?.params.filter((p) => p.direction === "input") ?? [];
            const outputs = method?.params.filter((p) => p.direction === "output") ?? [];
            return (
              <div
                key={step.id}
                className={cn(
                  "rounded-lg border bg-card p-3",
                  stepProblems.some((p) => p.severity !== "warning")
                    ? "border-red-500/40"
                    : stepProblems.length
                      ? "border-amber-500/40"
                      : "border-border",
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-muted-foreground">{index + 1}</span>
                    <div>
                      <p className="font-medium">{step.label ?? method?.name ?? step.methodId}</p>
                      {meta ? (
                        <span className="inline-flex items-center gap-1 text-xs">
                          <span className={cn("size-2 rounded-full", meta.dotClass)} aria-hidden />
                          <span className={meta.colorClass}>{meta.label}</span>
                        </span>
                      ) : null}
                    </div>
                  </div>
                  {canEdit ? (
                    <div className="flex items-center gap-1">
                      <Button size="icon" variant="ghost" disabled={busy || index === 0}
                        onClick={() => moveStep(step, -1)} aria-label="Move up">
                        <ChevronUp className="size-4" />
                      </Button>
                      <Button size="icon" variant="ghost"
                        disabled={busy || index === (model?.steps.length ?? 0) - 1}
                        onClick={() => moveStep(step, 1)} aria-label="Move down">
                        <ChevronDown className="size-4" />
                      </Button>
                      <Button size="icon" variant="ghost" disabled={busy}
                        onClick={() => run(() => processModelService.deleteStep(engagementId, streamType, step.id))}
                        aria-label="Remove step">
                        <Trash2 className="size-4 text-red-500" />
                      </Button>
                    </div>
                  ) : null}
                </div>

                {inputs.length > 0 || outputs.length > 0 ? (
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    <div className="space-y-1">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Inputs</p>
                      {inputs.map((p) => (
                        <div key={p.name} className="flex items-center gap-2 text-sm">
                          <span className="text-muted-foreground">{p.name}</span>
                          <span className="text-xs text-muted-foreground">({p.conceptLabel ?? "typed"})</span>
                          <span aria-hidden>←</span>
                          {canEdit ? (
                            <Input
                              key={`in-${step.id}-${p.name}-${step.inputBindings[p.name] ?? ""}`}
                              className="h-7 w-32"
                              defaultValue={step.inputBindings[p.name] ?? ""}
                              placeholder="variable"
                              onBlur={(e) => {
                                const v = e.target.value.trim();
                                if (v !== (step.inputBindings[p.name] ?? "")) setBinding(step, p.name, v);
                              }}
                            />
                          ) : (
                            <code className="text-xs">{step.inputBindings[p.name] ?? "—"}</code>
                          )}
                        </div>
                      ))}
                      {inputs.length === 0 ? <p className="text-xs text-muted-foreground">none</p> : null}
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Outputs</p>
                      {outputs.map((p) => {
                        const current = step.outputBindings[p.name] ?? p.name;
                        return (
                          <div key={p.name} className="flex items-center gap-2 text-sm">
                            {canEdit ? (
                              <Input
                                key={`out-${step.id}-${p.name}-${current}`}
                                className="h-7 w-32"
                                defaultValue={current}
                                placeholder={p.name}
                                onBlur={(e) => {
                                  const v = e.target.value.trim() || p.name;
                                  if (v !== current) setOutputBinding(step, p.name, v);
                                }}
                              />
                            ) : (
                              <code className="text-xs">{current}</code>
                            )}
                            <span className="text-xs text-muted-foreground">({p.conceptLabel ?? "typed"})</span>
                          </div>
                        );
                      })}
                      {outputs.length === 0 ? <p className="text-xs text-muted-foreground">none</p> : null}
                    </div>
                  </div>
                ) : (
                  <p className="mt-2 text-xs text-muted-foreground">
                    No typed parameters yet — add I/O to this method to validate its data flow.
                  </p>
                )}

                {stepProblems.map((p, i) => {
                  const warn = p.severity === "warning";
                  return (
                    <div
                      key={i}
                      className={cn(
                        "mt-2 rounded-md border p-2 text-xs",
                        warn ? "border-amber-500/40 bg-amber-500/5" : "border-red-500/40 bg-red-500/5",
                      )}
                    >
                      <p className={cn("font-medium", warn ? "text-amber-600 dark:text-amber-400" : "text-red-500")}>
                        {warn ? "warning: " : ""}{p.kind.replace(/_/g, " ")}
                      </p>
                      <p>{p.message}</p>
                      {p.suggestions.length ? (
                        <ul className="mt-1 list-disc pl-4 text-muted-foreground">
                          {p.suggestions.map((s, j) => <li key={j}>{s}</li>)}
                        </ul>
                      ) : null}
                      {canEdit && p.output ? (
                        <Button
                          size="sm"
                          variant="outline"
                          className="mt-2 h-7"
                          disabled={busy}
                          onClick={() =>
                            setOutputBinding(
                              step,
                              p.output as string,
                              suggestName(p.input ?? p.output ?? "var"),
                            )
                          }
                        >
                          Apply fix: rename output to “{suggestName(p.input ?? p.output ?? "var")}”
                        </Button>
                      ) : null}
                      {canEdit && !p.output && p.input && p.expected ? (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {(p.compatible ?? []).map((v) => (
                            <Button
                              key={v}
                              size="sm"
                              variant="outline"
                              className="h-7"
                              disabled={busy}
                              onClick={() => fixByBind(step, p.input as string, v)}
                            >
                              Bind to “{v}”
                            </Button>
                          ))}
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7"
                            disabled={busy}
                            onClick={() => fixByGlobal(step, p)}
                          >
                            Initialise global{p.expectedLabel ? ` (${p.expectedLabel})` : ""}
                          </Button>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            );
          })}

          {model && model.steps.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              No steps yet. {canEdit ? "Seed from the baseline or add a step below." : "Awaiting consultant setup."}
            </div>
          ) : null}

          {canEdit ? (
            <AddStepForm
              methods={methods}
              actors={actors}
              busy={busy}
              onAddStep={(methodId, label) =>
                run(() => processModelService.addStep(engagementId, streamType, { methodId, label }))
              }
              onCreateMethod={async (input) => {
                await run(async () => {
                  let actorId = input.actorId;
                  if (!actorId && input.newActor) {
                    const actor = await processModelService.createActor({
                      name: input.newActor.name,
                      functionUnit: input.newActor.functionUnit,
                      engagementId,
                    });
                    actorId = actor.id;
                  }
                  if (!actorId) return;
                  await processModelService.createMethod({
                    actorId, name: input.name, engagementId, params: input.params,
                  });
                });
              }}
              functionUnits={functionUnits}
            />
          ) : null}
        </div>

        {/* Sidebar: globals + validation */}
        <div className="space-y-4">
          <GlobalsPanel
            model={model}
            canEdit={canEdit}
            busy={busy}
            onAdd={(input) => run(() => processModelService.addGlobal(engagementId, streamType, input))}
            onRemove={(id) => run(() => processModelService.deleteGlobal(engagementId, streamType, id))}
          />
        </div>
      </div>

      {/* BPMN view — the diagram generated from the current steps. */}
      {view === "bpmn" ? (
        bpmnXml ? (
          <div className="rounded-lg border border-border">
            <p className="border-b border-border px-3 py-2 text-xs uppercase tracking-wide text-muted-foreground">
              BPMN — generated from steps (lanes = actor function units)
            </p>
            <div className="h-[600px]">
              <BpmnEditor
                key={bpmnXml.length}
                xml={bpmnXml}
                readOnly
                onSelectionChange={() => {}}
                onXmlChange={() => {}}
              />
            </div>
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            No diagram yet — add or seed steps to generate the BPMN.
          </div>
        )
      ) : null}
    </div>
  );
}

function actorUnit(
  actors: ProcessActor[],
  method?: ProcessMethod | null,
): FunctionalUnit | undefined {
  if (!method) return undefined;
  return actors.find((a) => a.id === method.actorId)?.functionUnit;
}

// --- Add step / create method --------------------------------------------

interface NewMethodInput {
  actorId?: string;
  newActor?: { name: string; functionUnit: string };
  name: string;
  params: ProcessMethodParam[];
}

function AddStepForm({
  methods,
  actors,
  busy,
  onAddStep,
  onCreateMethod,
  functionUnits,
}: {
  methods: ProcessMethod[];
  actors: ProcessActor[];
  busy: boolean;
  onAddStep: (methodId: string, label?: string) => void;
  onCreateMethod: (input: NewMethodInput) => Promise<void>;
  functionUnits?: FunctionalUnit[];
}): React.ReactNode {
  const [methodId, setMethodId] = useState("");
  const [label, setLabel] = useState("");
  const [creating, setCreating] = useState(false);

  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="flex flex-wrap items-end gap-2">
        <div className="flex-1 space-y-1">
          <Label className="text-xs">Add step — method</Label>
          <Select value={methodId} onValueChange={(v) => setMethodId(v ?? "")}>
            <SelectTrigger><SelectValue placeholder="Select a method" /></SelectTrigger>
            <SelectContent>
              {methods.map((m) => (
                <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex-1 space-y-1">
          <Label className="text-xs">Label (optional)</Label>
          <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Step label" />
        </div>
        <Button size="sm" disabled={busy || !methodId}
          onClick={() => { onAddStep(methodId, label || undefined); setMethodId(""); setLabel(""); }}
          className="gap-1">
          <Plus className="size-4" /> Add
        </Button>
      </div>
      <button type="button" className="mt-2 text-xs text-muted-foreground underline"
        onClick={() => setCreating((v) => !v)}>
        {creating ? "Cancel new method" : "+ Create a new method / function"}
      </button>
      {creating ? (
        <CreateMethodForm
          actors={actors}
          busy={busy}
          functionUnits={functionUnits}
          onCreate={async (input) => { await onCreateMethod(input); setCreating(false); }}
        />
      ) : null}
    </div>
  );
}

function CreateMethodForm({
  actors,
  busy,
  functionUnits,
  onCreate,
}: {
  actors: ProcessActor[];
  busy: boolean;
  functionUnits?: FunctionalUnit[];
  onCreate: (input: NewMethodInput) => Promise<void>;
}): React.ReactNode {
  const [name, setName] = useState("");
  const [actorId, setActorId] = useState("");
  const [newActorName, setNewActorName] = useState("");
  const [newActorUnit, setNewActorUnit] = useState<string>("");
  const [params, setParams] = useState<ProcessMethodParam[]>([]);
  const units = functionUnitsFor(functionUnits);

  const addParam = (direction: "input" | "output") =>
    setParams((p) => [...p, { direction, name: "", conceptUri: "", conceptLabel: "", required: true, seq: p.length }]);

  const canCreate = name.trim() && (actorId || (newActorName.trim() && newActorUnit)) &&
    params.every((p) => p.name.trim() && p.conceptUri);

  return (
    <div className="mt-3 space-y-3 rounded-md border border-dashed border-border p-3">
      <div className="grid gap-2 sm:grid-cols-2">
        <div className="space-y-1">
          <Label className="text-xs">Method name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Run credit check" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Actor</Label>
          <Select value={actorId} onValueChange={(v) => setActorId(v ?? "")}>
            <SelectTrigger><SelectValue placeholder="Existing actor or new below" /></SelectTrigger>
            <SelectContent>
              {actors.map((a) => (
                <SelectItem key={a.id} value={a.id}>{a.name} ({a.functionUnit})</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      {!actorId ? (
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="space-y-1">
            <Label className="text-xs">…or new actor name</Label>
            <Input value={newActorName} onChange={(e) => setNewActorName(e.target.value)} placeholder="e.g. Credit Analyst" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Function unit</Label>
            <Select value={newActorUnit} onValueChange={(v) => setNewActorUnit(v ?? "")}>
              <SelectTrigger><SelectValue placeholder="Tag to a function unit" /></SelectTrigger>
              <SelectContent>
                {units.map((u) => <SelectItem key={u.id} value={u.id}>{u.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
      ) : null}

      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Label className="text-xs">Parameters (typed by ontology)</Label>
          <Button size="sm" variant="ghost" onClick={() => addParam("input")}>+ input</Button>
          <Button size="sm" variant="ghost" onClick={() => addParam("output")}>+ output</Button>
        </div>
        {params.map((p, i) => (
          <div key={i} className="flex items-center gap-2">
            <Badge variant="secondary" className="shrink-0">{p.direction}</Badge>
            <Input className="h-8 w-28" value={p.name} placeholder="var name"
              onChange={(e) => setParams((arr) => arr.map((x, j) => j === i ? { ...x, name: e.target.value } : x))} />
            <div className="flex-1">
              <ConceptPicker value={p.conceptLabel ?? ""} placeholder="type (ontology concept)"
                onPick={(c) => setParams((arr) => arr.map((x, j) => j === i ? { ...x, conceptUri: c.uri, conceptLabel: c.label } : x))} />
            </div>
            <Button size="icon" variant="ghost" onClick={() => setParams((arr) => arr.filter((_, j) => j !== i))}>
              <X className="size-4" />
            </Button>
          </div>
        ))}
      </div>

      <Button size="sm" disabled={busy || !canCreate}
        onClick={() => void onCreate({
          name: name.trim(),
          actorId: actorId || undefined,
          newActor: actorId ? undefined : { name: newActorName.trim(), functionUnit: newActorUnit },
          params,
        })}>
        Create method
      </Button>
    </div>
  );
}

// --- Globals -------------------------------------------------------------

function GlobalsPanel({
  model,
  canEdit,
  busy,
  onAdd,
  onRemove,
}: {
  model: ProcessModel | null;
  canEdit: boolean;
  busy: boolean;
  onAdd: (input: { name: string; conceptUri: string; conceptLabel?: string; initialValue?: string }) => void;
  onRemove: (id: string) => void;
}): React.ReactNode {
  const [name, setName] = useState("");
  const [concept, setConcept] = useState<{ uri: string; label: string } | null>(null);
  const [initial, setInitial] = useState("");

  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Process globals (initialised variables)
      </p>
      <div className="space-y-1">
        {(model?.globals ?? []).map((g) => (
          <div key={g.id} className="flex items-center justify-between gap-2 text-sm">
            <span>
              <code className="text-xs">{g.name}</code>
              <span className="ml-1 text-xs text-muted-foreground">({g.conceptLabel ?? "typed"})</span>
            </span>
            {canEdit ? (
              <Button size="icon" variant="ghost" disabled={busy} onClick={() => onRemove(g.id)} aria-label="Remove global">
                <Trash2 className="size-4 text-red-500" />
              </Button>
            ) : null}
          </div>
        ))}
        {model && model.globals.length === 0 ? (
          <p className="text-xs text-muted-foreground">None. Initialise variables the first steps consume.</p>
        ) : null}
      </div>
      {canEdit ? (
        <div className="mt-3 space-y-2 border-t border-border pt-3">
          <Input className="h-8" value={name} onChange={(e) => setName(e.target.value)} placeholder="variable name" />
          <ConceptPicker placeholder="concept type" onPick={setConcept} />
          <Input className="h-8" value={initial} onChange={(e) => setInitial(e.target.value)} placeholder="initial value (optional)" />
          <Button size="sm" className="w-full gap-1" disabled={busy || !name.trim() || !concept}
            onClick={() => {
              if (!concept) return;
              onAdd({ name: name.trim(), conceptUri: concept.uri, conceptLabel: concept.label, initialValue: initial || undefined });
              setName(""); setConcept(null); setInitial("");
            }}>
            <Plus className="size-4" /> Add global
          </Button>
        </div>
      ) : null}
    </div>
  );
}
