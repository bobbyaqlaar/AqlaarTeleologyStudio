"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Filter, Save } from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import type { BpmnEditorHandle } from "@/components/bpmn/bpmn-editor";
import { FunctionTagPanel } from "@/components/bpmn/function-tag-panel";
import { BpmnTaskList } from "@/components/bpmn/bpmn-task-list";
import { CommentThread } from "@/components/comments/comment-thread";
import { GapSuggestionsDrawer } from "@/components/ai/gap-suggestions-drawer";
import { FunctionUnitLegend } from "@/components/functions/function-unit-legend";
import { StreamTabs } from "@/components/streams/stream-tabs";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FUNCTION_UNITS } from "@/lib/constants/function-units";
import { VALUE_STREAM_META } from "@/lib/constants/value-streams";
import { useRole } from "@/lib/context/role-context";
import {
  aiGapService,
  processService,
} from "@/lib/mock/services/process-service";
import type {
  AiGapSuggestion,
  FunctionalUnit,
  ProcessState,
  ValueStreamType,
} from "@/lib/types";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

const BpmnEditor = dynamic(
  () =>
    import("@/components/bpmn/bpmn-editor").then((module) => module.BpmnEditor),
  {
    ssr: false,
    loading: () => (
      <div className="flex min-h-[420px] items-center justify-center rounded-lg border border-border bg-card text-sm text-muted-foreground">
        Loading BPMN editor…
      </div>
    ),
  },
);

interface ProcessWorkspaceProps {
  engagementId: string;
  streamType: ValueStreamType;
  loadedStreams: ValueStreamType[];
}

export function ProcessWorkspace({
  engagementId,
  streamType,
  loadedStreams,
}: ProcessWorkspaceProps): React.ReactNode {
  const { canEdit } = useRole();
  const editorRef = useRef<BpmnEditorHandle>(null);
  const [processState, setProcessState] = useState<ProcessState | null>(null);
  const [tasks, setTasks] = useState<
    Array<{ id: string; name: string; functionUnit?: FunctionalUnit }>
  >([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedName, setSelectedName] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [filterFunction, setFilterFunction] = useState<FunctionalUnit | "all">(
    "all",
  );
  const [suggestions, setSuggestions] = useState<AiGapSuggestion[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const refreshTasks = useCallback(async (): Promise<void> => {
    const nextTasks = await processService.listTasks(engagementId, streamType);
    setTasks(nextTasks);
  }, [engagementId, streamType]);

  const runGapAnalysis = useCallback(async (): Promise<void> => {
    setAnalyzing(true);
    try {
      const result = await aiGapService.analyzeDebounced(
        engagementId,
        streamType,
      );
      setSuggestions(result);
    } finally {
      setAnalyzing(false);
    }
  }, [engagementId, streamType]);

  useEffect(() => {
    void processService.load(engagementId, streamType).then((state) => {
      setProcessState(state);
      setSelectedId(null);
      setSelectedName(null);
      setSelectedType(null);
      void refreshTasks();
      void aiGapService.analyze(engagementId, streamType).then(setSuggestions);
    });
  }, [engagementId, streamType, refreshTasks]);

  const selectedFunctionUnit = selectedId
    ? processState?.elementMeta[selectedId]?.functionUnit
    : undefined;

  const handleAssignFunction = async (
    functionUnit: FunctionalUnit | undefined,
  ): Promise<void> => {
    if (!selectedId || !canEdit) {
      return;
    }

    const next = await processService.setFunctionUnit(
      engagementId,
      streamType,
      selectedId,
      functionUnit,
    );
    setProcessState(next);
    await refreshTasks();
    await runGapAnalysis();
  };

  const handleXmlChange = async (xml: string): Promise<void> => {
    if (!canEdit) {
      return;
    }

    setProcessState((current) =>
      current ? { ...current, bpmnXml: xml } : current,
    );
    await processService.saveXml(engagementId, streamType, xml);
    await runGapAnalysis();
  };

  const handleSave = async (): Promise<void> => {
    if (!processState || !canEdit) {
      return;
    }

    const untagged = tasks.filter((task) => !task.functionUnit);
    if (untagged.length > 0) {
      setSaveMessage(`${untagged.length} step(s) still missing function tags.`);
      return;
    }

    setSaving(true);
    setSaveMessage(null);
    try {
      await processService.saveXml(
        engagementId,
        streamType,
        processState.bpmnXml,
      );
      setSaveMessage("Process map saved.");
    } finally {
      setSaving(false);
    }
  };

  const handleSelectTask = (taskId: string): void => {
    editorRef.current?.selectElement(taskId);
  };

  if (!processState) {
    return (
      <div className="rounded-lg border border-border bg-card p-8 text-sm text-muted-foreground">
        Loading process workspace…
      </div>
    );
  }

  const meta = VALUE_STREAM_META[streamType];

  return (
    <div className="mx-auto flex max-w-[1600px] flex-col gap-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <StreamTabs
          engagementId={engagementId}
          loadedStreams={loadedStreams}
          activeStream={streamType}
        />
        {canEdit ? (
          <div className="flex gap-2">
            <Button
              size="sm"
              className="gap-2"
              disabled={saving}
              onClick={() => void handleSave()}
            >
              <Save className="size-4" />
              Save process
            </Button>
            <Link
              href={`/engagements/${engagementId}/streams/${streamType}/ontology`}
              className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
            >
              Ontology
            </Link>
          </div>
        ) : null}
      </div>

      {saveMessage ? (
        <p className="text-sm text-muted-foreground">{saveMessage}</p>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-4">
          <div className="rounded-lg border border-border bg-card p-3">
            <p className="text-sm font-medium">
              {meta.shortLabel} · {meta.label}
            </p>
            <p className="text-xs text-muted-foreground">
              Customize the BPMN map. Tag every task with an enterprise function
              unit.
            </p>
          </div>

          <div className="h-[520px]">
            <BpmnEditor
              ref={editorRef}
              key={`${engagementId}-${streamType}-${canEdit ? "edit" : "view"}`}
              xml={processState.bpmnXml}
              readOnly={!canEdit}
              onSelectionChange={(selection) => {
                setSelectedId(selection?.id ?? null);
                setSelectedName(selection?.name ?? null);
                setSelectedType(selection?.type ?? null);
              }}
              onXmlChange={(xml) => void handleXmlChange(xml)}
            />
          </div>

          <GapSuggestionsDrawer
            suggestions={suggestions}
            loading={analyzing}
            onSelectElement={handleSelectTask}
          />
        </div>

        <div className="flex flex-col gap-4">
          <FunctionTagPanel
            elementId={selectedId}
            elementName={selectedName}
            elementType={selectedType}
            functionUnit={selectedFunctionUnit}
            canEdit={canEdit}
            onAssign={(unit) => void handleAssignFunction(unit)}
          />

          <div className="space-y-2 rounded-lg border border-border bg-card p-4">
            <div className="flex items-center gap-2">
              <Filter className="size-4 text-muted-foreground" />
              <Label htmlFor="task-filter">Filter steps</Label>
            </div>
            <Select
              value={filterFunction}
              onValueChange={(value) =>
                setFilterFunction(value as FunctionalUnit | "all")
              }
            >
              <SelectTrigger id="task-filter">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All functions</SelectItem>
                {FUNCTION_UNITS.map((unit) => (
                  <SelectItem key={unit.id} value={unit.id}>
                    {unit.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <BpmnTaskList
              tasks={tasks}
              selectedId={selectedId}
              filterFunction={filterFunction}
              onSelect={handleSelectTask}
            />
          </div>

          <div className="min-h-[280px]">
            <CommentThread
              engagementId={engagementId}
              streamType={streamType}
              targetId={selectedId}
              targetLabel={selectedName}
              targetFunctionUnit={selectedFunctionUnit}
            />
          </div>

          <FunctionUnitLegend compact />
        </div>
      </div>
    </div>
  );
}
