"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AlertCircle, ArrowRight, RefreshCw } from "lucide-react";
import {
  OntologyApiError,
  ontologyService,
} from "@/lib/api/ontology-service";
import {
  agentService,
  type ConceptProposal,
  type LinkProposal,
} from "@/lib/api/agent-service";
import { agentTriggerService } from "@/lib/api/agent-trigger-service";
import { processService } from "@/lib/mock/services/process-service";
import { teleologyService } from "@/lib/mock/services/teleology-service";
import { StreamTabs } from "@/components/streams/stream-tabs";
import { OwlGraphViewer } from "@/components/ontology/owl-graph-viewer";
import { OwlClassTree } from "@/components/ontology/owl-class-tree";
import { OwlClassPanel } from "@/components/ontology/owl-class-panel";
import { BpmnLinkPanel } from "@/components/ontology/bpmn-link-panel";
import { GoalLinkPanel } from "@/components/ontology/goal-link-panel";
import { ThesaurusPanel } from "@/components/ontology/thesaurus-panel";
import { AiLinkSuggestionsPanel } from "@/components/ontology/ai-link-suggestions-panel";
import { FunctionUnitLegend } from "@/components/functions/function-unit-legend";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useRole } from "@/lib/context/role-context";
import type {
  FunctionalUnit,
  Industry,
  OntologyGraph,
  OwlClass,
  TeleologyRow,
  ValueStreamType,
} from "@/lib/types";

interface OntologyWorkspaceProps {
  engagementId: string;
  streamType: ValueStreamType;
  loadedStreams: ValueStreamType[];
  industry?: Industry;
}

export function OntologyWorkspace({
  engagementId,
  streamType,
  loadedStreams,
  industry = "generic",
}: OntologyWorkspaceProps): React.ReactNode {
  const { canEdit } = useRole();
  const [graph, setGraph] = useState<OntologyGraph | null>(null);
  const [tasks, setTasks] = useState<
    Array<{ id: string; name: string; functionUnit?: FunctionalUnit }>
  >([]);
  const [teleologyRows, setTeleologyRows] = useState<TeleologyRow[]>([]);
  const [selectedClass, setSelectedClass] = useState<OwlClass | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [apiOnline, setApiOnline] = useState(true);
  const [savingClass, setSavingClass] = useState(false);
  const [linking, setLinking] = useState(false);
  const [draftingLinks, setDraftingLinks] = useState(false);
  const [bpmnLinkSuggestions, setBpmnLinkSuggestions] = useState<LinkProposal[]>(
    [],
  );
  const [conceptMappingSuggestions, setConceptMappingSuggestions] = useState<
    ConceptProposal[]
  >([]);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const autoLinksTriggered = useRef(false);

  const loadData = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);

    try {
      const health = await ontologyService.health();
      setApiOnline(health.fuseki);

      await ontologyService.initialize(engagementId, streamType, industry);
      const [graphData, taskData, teleologyData] = await Promise.all([
        ontologyService.getGraph(engagementId, streamType),
        processService.listTasks(engagementId, streamType),
        teleologyService.getMatrix(engagementId).catch(() => null),
      ]);

      setGraph(graphData);
      setTasks(taskData);
      setTeleologyRows(
        teleologyData
          ? teleologyData.rows.filter((row) => row.streamType === streamType)
          : [],
      );
      setSelectedClass((current) => {
        if (!current) {
          return graphData.classes[0] ?? null;
        }
        return (
          graphData.classes.find((item) => item.uri === current.uri) ??
          graphData.classes[0] ??
          null
        );
      });

      if (canEdit && !autoLinksTriggered.current) {
        autoLinksTriggered.current = true;
        const trigger = await agentTriggerService.onOntologyGraphReady(
          engagementId,
          streamType,
          graphData.classes.length,
        );
        if (trigger) {
          setBpmnLinkSuggestions(trigger.bpmnLinks);
          setConceptMappingSuggestions(trigger.conceptMappings);
          setStatusMessage(trigger.message);
        }
      }
    } catch (err) {
      setApiOnline(false);
      setError(
        err instanceof OntologyApiError
          ? err.message
          : "Ontology API unavailable. Run docker compose up fuseki api.",
      );
    } finally {
      setLoading(false);
    }
  }, [engagementId, streamType, industry, canEdit]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const refreshGraph = async (): Promise<void> => {
    const graphData = await ontologyService.getGraph(engagementId, streamType);
    setGraph(graphData);
    setSelectedClass((current) => {
      if (!current) {
        return graphData.classes[0] ?? null;
      }
      return (
        graphData.classes.find((item) => item.uri === current.uri) ??
        graphData.classes[0] ??
        null
      );
    });
  };

  const handleDraftLinksWithAi = async (): Promise<void> => {
    if (!canEdit) {
      return;
    }
    setDraftingLinks(true);
    setStatusMessage(null);
    try {
      const result = await agentService.draftOntologyLinks(
        engagementId,
        streamType,
      );
      setBpmnLinkSuggestions(result.bpmnLinks);
      setConceptMappingSuggestions(result.conceptMappings);
      setStatusMessage(
        `AI proposed ${result.bpmnLinks.length} step link(s) and ${result.conceptMappings.length} concept mapping(s) (source: ${result.source}).`,
      );
    } catch (error) {
      setStatusMessage(
        error instanceof Error
          ? `Link drafting failed: ${error.message}`
          : "Link drafting failed.",
      );
    }
    setDraftingLinks(false);
  };

  const handleApplyBpmnLink = async (proposal: LinkProposal): Promise<void> => {
    if (!canEdit) {
      return;
    }
    setLinking(true);
    try {
      await ontologyService.linkBpmnElement(
        engagementId,
        streamType,
        proposal.classUri,
        proposal.taskId,
      );
      await refreshGraph();
      setBpmnLinkSuggestions((current) =>
        current.filter(
          (item) =>
            !(
              item.classUri === proposal.classUri &&
              item.taskId === proposal.taskId
            ),
        ),
      );
      setSelectedTaskId(proposal.taskId);
      setStatusMessage(
        `Linked ${proposal.taskName} to ${proposal.classLabel}.`,
      );
    } catch (err) {
      setError(
        err instanceof OntologyApiError ? err.message : "Link apply failed.",
      );
    } finally {
      setLinking(false);
    }
  };

  const handleApplyConceptMapping = async (
    proposal: ConceptProposal,
  ): Promise<void> => {
    if (!canEdit) {
      return;
    }
    setLinking(true);
    try {
      await ontologyService.mapConcept(
        engagementId,
        streamType,
        proposal.classUri,
        proposal.conceptUri,
      );
      await refreshGraph();
      setConceptMappingSuggestions((current) =>
        current.filter(
          (item) =>
            !(
              item.classUri === proposal.classUri &&
              item.conceptUri === proposal.conceptUri
            ),
        ),
      );
      setStatusMessage(
        `Mapped ${proposal.classLabel} to ${proposal.conceptLabel}.`,
      );
    } catch (err) {
      setError(
        err instanceof OntologyApiError ? err.message : "Concept apply failed.",
      );
    } finally {
      setLinking(false);
    }
  };

  const applyClassUpdate = (updated: OwlClass): void => {
    setGraph((current) =>
      current
        ? {
            ...current,
            classes: current.classes.map((item) =>
              item.uri === updated.uri ? updated : item,
            ),
          }
        : current,
    );
    setSelectedClass(updated);
  };

  const handleMapConcept = async (conceptUri: string): Promise<void> => {
    if (!selectedClass || !canEdit) {
      return;
    }
    setLinking(true);
    try {
      const updated = await ontologyService.mapConcept(
        engagementId,
        streamType,
        selectedClass.uri,
        conceptUri,
      );
      applyClassUpdate(updated);
      setStatusMessage(`Mapped ${updated.label} to thesaurus concept.`);
    } catch (err) {
      setError(
        err instanceof OntologyApiError ? err.message : "Concept map failed.",
      );
    } finally {
      setLinking(false);
    }
  };

  const handleUnmapConcept = async (conceptUri: string): Promise<void> => {
    if (!selectedClass || !canEdit) {
      return;
    }
    setLinking(true);
    try {
      const updated = await ontologyService.unmapConcept(
        engagementId,
        streamType,
        selectedClass.uri,
        conceptUri,
      );
      applyClassUpdate(updated);
      setStatusMessage("Concept mapping removed.");
    } catch (err) {
      setError(
        err instanceof OntologyApiError ? err.message : "Unmap failed.",
      );
    } finally {
      setLinking(false);
    }
  };

  const handleSaveClass = async (updates: {
    label: string;
    functionUnit?: FunctionalUnit;
  }): Promise<void> => {
    if (!selectedClass || !canEdit) {
      return;
    }

    setSavingClass(true);
    setStatusMessage(null);
    try {
      const updated = await ontologyService.updateClass(
        engagementId,
        streamType,
        selectedClass.uri,
        updates,
      );
      setGraph((current) =>
        current
          ? {
              ...current,
              classes: current.classes.map((item) =>
                item.uri === updated.uri ? updated : item,
              ),
            }
          : current,
      );
      setSelectedClass(updated);
      setStatusMessage("Class saved to Fuseki.");
    } catch (err) {
      setError(
        err instanceof OntologyApiError ? err.message : "Failed to save class.",
      );
    } finally {
      setSavingClass(false);
    }
  };

  const handleGoalLink = async (
    teleologyRowId: string,
    action: "link" | "unlink",
  ): Promise<void> => {
    if (!selectedClass || !canEdit) {
      return;
    }
    setLinking(true);
    try {
      const updated =
        action === "link"
          ? await ontologyService.linkGoal(
              engagementId,
              streamType,
              selectedClass.uri,
              teleologyRowId,
            )
          : await ontologyService.unlinkGoal(
              engagementId,
              streamType,
              selectedClass.uri,
              teleologyRowId,
            );
      applyClassUpdate(updated);
      setStatusMessage(
        action === "link"
          ? `${updated.label} now supports the selected goal.`
          : "Goal link removed.",
      );
    } catch (err) {
      setError(
        err instanceof OntologyApiError ? err.message : "Goal link failed.",
      );
    } finally {
      setLinking(false);
    }
  };

  const handleLink = async (taskId: string): Promise<void> => {
    if (!selectedClass || !canEdit) {
      return;
    }

    setLinking(true);
    try {
      const updated = await ontologyService.linkBpmnElement(
        engagementId,
        streamType,
        selectedClass.uri,
        taskId,
      );
      setGraph((current) =>
        current
          ? {
              ...current,
              classes: current.classes.map((item) =>
                item.uri === updated.uri ? updated : item,
              ),
            }
          : current,
      );
      setSelectedClass(updated);
      setSelectedTaskId(taskId);
      setStatusMessage(`Linked ${taskId} to ${updated.label}.`);
    } catch (err) {
      setError(err instanceof OntologyApiError ? err.message : "Link failed.");
    } finally {
      setLinking(false);
    }
  };

  const handleUnlink = async (
    taskId: string,
    classUri: string,
  ): Promise<void> => {
    if (!canEdit) {
      return;
    }

    setLinking(true);
    try {
      const updated = await ontologyService.unlinkBpmnElement(
        engagementId,
        streamType,
        classUri,
        taskId,
      );
      setGraph((current) =>
        current
          ? {
              ...current,
              classes: current.classes.map((item) =>
                item.uri === updated.uri ? updated : item,
              ),
            }
          : current,
      );
      if (selectedClass?.uri === classUri) {
        setSelectedClass(updated);
      }
      setStatusMessage(`Unlinked ${taskId}.`);
    } catch (err) {
      setError(err instanceof OntologyApiError ? err.message : "Unlink failed.");
    } finally {
      setLinking(false);
    }
  };

  if (loading) {
    return (
      <div className="rounded-lg border border-border bg-card p-8 text-sm text-muted-foreground">
        Loading ontology from Fuseki…
      </div>
    );
  }

  if (error || !graph) {
    return (
      <div className="mx-auto max-w-2xl space-y-4 rounded-xl border border-amber-500/30 bg-amber-500/5 p-6">
        <div className="flex items-start gap-3">
          <AlertCircle className="mt-0.5 size-5 text-amber-500" />
          <div>
            <p className="font-medium">Ontology service unavailable</p>
            <p className="mt-1 text-sm text-muted-foreground">{error}</p>
            <pre className="mt-3 rounded-md bg-muted/40 p-3 font-mono text-xs">
              docker compose up fuseki api
            </pre>
          </div>
        </div>
        <Button size="sm" className="gap-2" onClick={() => void loadData()}>
          <RefreshCw className="size-4" />
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-[1600px] flex-col gap-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <StreamTabs
          engagementId={engagementId}
          loadedStreams={loadedStreams}
          activeStream={streamType}
        />
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span
              className={
                apiOnline ? "text-emerald-500" : "text-amber-500"
              }
            >
              Fuseki {apiOnline ? "online" : "degraded"}
            </span>
            <span className="hidden font-mono lg:inline">{graph.graphUri}</span>
          </div>
          <Link
            href={`/engagements/${engagementId}/teleology`}
            className={cn(buttonVariants({ size: "sm" }), "gap-2")}
          >
            Continue to teleology
            <ArrowRight className="size-4" />
          </Link>
        </div>
      </div>

      {statusMessage ? (
        <p className="text-sm text-muted-foreground">{statusMessage}</p>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-4">
          <OwlGraphViewer
            classes={graph.classes}
            edges={graph.edges}
            selectedUri={selectedClass?.uri ?? null}
            highlightBpmnId={selectedTaskId}
            onSelect={(owlClass) => {
              setSelectedClass(owlClass);
              if (owlClass.linkedBpmnElements[0]) {
                setSelectedTaskId(owlClass.linkedBpmnElements[0]);
              }
            }}
          />
          <OwlClassTree
            classes={graph.classes}
            selectedUri={selectedClass?.uri ?? null}
            highlightBpmnId={selectedTaskId}
            onSelect={(owlClass) => {
              setSelectedClass(owlClass);
              if (owlClass.linkedBpmnElements[0]) {
                setSelectedTaskId(owlClass.linkedBpmnElements[0]);
              }
            }}
          />
          <OwlClassPanel
            owlClass={selectedClass}
            canEdit={canEdit}
            saving={savingClass}
            onSave={(updates) => void handleSaveClass(updates)}
          />
          <FunctionUnitLegend compact />
        </div>

        <div className="min-h-[640px] space-y-4">
          <AiLinkSuggestionsPanel
            bpmnLinks={bpmnLinkSuggestions}
            conceptMappings={conceptMappingSuggestions}
            canEdit={canEdit}
            drafting={draftingLinks}
            applying={linking}
            onDraft={() => void handleDraftLinksWithAi()}
            onApplyBpmnLink={(proposal) => void handleApplyBpmnLink(proposal)}
            onApplyConceptMapping={(proposal) =>
              void handleApplyConceptMapping(proposal)
            }
            onDismissBpmnLink={(proposal) =>
              setBpmnLinkSuggestions((current) =>
                current.filter(
                  (item) =>
                    !(
                      item.classUri === proposal.classUri &&
                      item.taskId === proposal.taskId
                    ),
                ),
              )
            }
            onDismissConceptMapping={(proposal) =>
              setConceptMappingSuggestions((current) =>
                current.filter(
                  (item) =>
                    !(
                      item.classUri === proposal.classUri &&
                      item.conceptUri === proposal.conceptUri
                    ),
                ),
              )
            }
          />
          <ThesaurusPanel
            selectedClass={selectedClass}
            canEdit={canEdit}
            mapping={linking}
            onMap={(conceptUri) => void handleMapConcept(conceptUri)}
            onUnmap={(conceptUri) => void handleUnmapConcept(conceptUri)}
          />
          <BpmnLinkPanel
            tasks={tasks}
            classes={graph.classes}
            selectedClassUri={selectedClass?.uri ?? null}
            selectedTaskId={selectedTaskId}
            canEdit={canEdit}
            linking={linking}
            onSelectTask={(taskId) => {
              setSelectedTaskId(taskId);
              const linked = graph.classes.find((item) =>
                item.linkedBpmnElements.includes(taskId),
              );
              if (linked) {
                setSelectedClass(linked);
              }
            }}
            onLink={(taskId) => void handleLink(taskId)}
            onUnlink={(taskId, classUri) => void handleUnlink(taskId, classUri)}
          />
          <GoalLinkPanel
            teleologyRows={teleologyRows}
            selectedClass={selectedClass}
            canEdit={canEdit}
            linking={linking}
            onLink={(rowId) => void handleGoalLink(rowId, "link")}
            onUnlink={(rowId) => void handleGoalLink(rowId, "unlink")}
          />
        </div>
      </div>
    </div>
  );
}
