import {
  getBaselineBpmnXml,
  getBaselineTasks,
  getDefaultElementMeta,
} from "@/lib/mock/fixtures/bpmn-baselines";
import type {
  AiGapSuggestion,
  BpmnElementMeta,
  FunctionalUnit,
  ProcessComment,
  ProcessState,
  ValueStreamType,
} from "@/lib/types";

function stateKey(engagementId: string, streamType: ValueStreamType): string {
  return `${engagementId}:${streamType}`;
}

const processStates = new Map<string, ProcessState>();
const comments = new Map<string, ProcessComment[]>();

const seedComments: ProcessComment[] = [
  {
    id: "comment-1",
    engagementId: "eng-acme-001",
    streamType: "o2c",
    authorId: "user-stakeholder-1",
    authorName: "Jordan Lee",
    role: "stakeholder",
    targetType: "bpmn_element",
    targetId: "Task_credit",
    targetLabel: "Credit check",
    functionUnit: "finance",
    body: "Credit check still manual — finance team uses spreadsheet today.",
    createdAt: "2026-06-07T10:15:00.000Z",
    resolved: false,
  },
];

for (const comment of seedComments) {
  const key = stateKey(comment.engagementId, comment.streamType);
  const existing = comments.get(key) ?? [];
  comments.set(key, [...existing, comment]);
}

export function ensureProcessState(
  engagementId: string,
  streamType: ValueStreamType,
): ProcessState {
  const key = stateKey(engagementId, streamType);
  const existing = processStates.get(key);

  if (existing) {
    return structuredClone(existing);
  }

  const state: ProcessState = {
    engagementId,
    streamType,
    bpmnXml: getBaselineBpmnXml(streamType),
    elementMeta: getDefaultElementMeta(streamType),
  };

  processStates.set(key, state);
  return structuredClone(state);
}

export function getProcessState(
  engagementId: string,
  streamType: ValueStreamType,
): ProcessState | undefined {
  const state = processStates.get(stateKey(engagementId, streamType));
  return state ? structuredClone(state) : undefined;
}

export function saveProcessState(state: ProcessState): ProcessState {
  processStates.set(stateKey(state.engagementId, state.streamType), state);
  return structuredClone(state);
}

export function saveBpmnXml(
  engagementId: string,
  streamType: ValueStreamType,
  bpmnXml: string,
): ProcessState {
  const state = ensureProcessState(engagementId, streamType);
  return saveProcessState({ ...state, bpmnXml });
}

export function setElementFunctionUnit(
  engagementId: string,
  streamType: ValueStreamType,
  elementId: string,
  functionUnit: FunctionalUnit | undefined,
): ProcessState {
  const state = ensureProcessState(engagementId, streamType);
  state.elementMeta[elementId] = { functionUnit };
  return saveProcessState(state);
}

export function listProcessComments(
  engagementId: string,
  streamType: ValueStreamType,
  targetId?: string,
): ProcessComment[] {
  const key = stateKey(engagementId, streamType);
  const all = comments.get(key) ?? [];
  const filtered = targetId
    ? all.filter((comment) => comment.targetId === targetId)
    : all;

  return structuredClone(
    filtered.sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    ),
  );
}

export function addProcessComment(
  input: Omit<ProcessComment, "id" | "createdAt" | "resolved"> & {
    resolved?: boolean;
  },
): ProcessComment {
  const comment: ProcessComment = {
    ...input,
    resolved: input.resolved ?? false,
    id: `comment-${crypto.randomUUID().slice(0, 8)}`,
    createdAt: new Date().toISOString(),
  };

  const key = stateKey(input.engagementId, input.streamType);
  const existing = comments.get(key) ?? [];
  comments.set(key, [...existing, comment]);

  return structuredClone(comment);
}

export function listOpenProcessComments(
  engagementId: string,
): ProcessComment[] {
  const open: ProcessComment[] = [];

  for (const [key, streamComments] of comments.entries()) {
    if (!key.startsWith(`${engagementId}:`)) {
      continue;
    }
    open.push(...streamComments.filter((comment) => !comment.resolved));
  }

  return structuredClone(
    open.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    ),
  );
}

export function resolveProcessComment(commentId: string): ProcessComment | undefined {
  for (const [key, streamComments] of comments.entries()) {
    const index = streamComments.findIndex((comment) => comment.id === commentId);
    if (index === -1) {
      continue;
    }

    streamComments[index] = {
      ...streamComments[index],
      resolved: true,
    };
    comments.set(key, streamComments);
    return structuredClone(streamComments[index]);
  }

  return undefined;
}

export function analyzeProcessGaps(
  engagementId: string,
  streamType: ValueStreamType,
): AiGapSuggestion[] {
  const state = ensureProcessState(engagementId, streamType);
  const tasks = getBaselineTasks(streamType);
  const suggestions: AiGapSuggestion[] = [];

  for (const task of tasks) {
    const meta = state.elementMeta[task.id];
    const taskComments = listProcessComments(engagementId, streamType, task.id);

    if (!meta?.functionUnit) {
      suggestions.push({
        id: `gap-missing-fn-${task.id}`,
        severity: "warning",
        elementId: task.id,
        elementLabel: task.name,
        message: `"${task.name}" is missing a function unit tag.`,
      });

      if (taskComments.length > 0) {
        suggestions.unshift({
          id: `gap-comment-${task.id}`,
          severity: "warning",
          elementId: task.id,
          elementLabel: task.name,
          message: `Stakeholder commented on "${task.name}" — assign a function unit.`,
        });
      }
    }
  }

  const untaggedCount = suggestions.filter((item) =>
    item.id.startsWith("gap-missing-fn-"),
  ).length;
  if (untaggedCount > 0) {
    suggestions.push({
      id: "gap-summary",
      severity: "info",
      message: `${untaggedCount} step(s) need function unit tags before stakeholder review.`,
    });
  } else {
    suggestions.push({
      id: "gap-clear",
      severity: "info",
      message: "All process steps are tagged. Ready for ontology linking.",
    });
  }

  return suggestions;
}

export function getTaskSummaries(
  engagementId: string,
  streamType: ValueStreamType,
): Array<{
  id: string;
  name: string;
  functionUnit?: FunctionalUnit;
}> {
  const state = ensureProcessState(engagementId, streamType);

  return getBaselineTasks(streamType).map((task) => ({
    id: task.id,
    name: task.name,
    functionUnit: state.elementMeta[task.id]?.functionUnit,
  }));
}
