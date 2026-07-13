export type FunctionalUnit =
  | "sales"
  | "marketing"
  | "customer_care"
  | "finance"
  | "procurement_scm"
  | "production"
  | "operations"
  | "hr"
  | "products"
  | "it"
  | "networks";

export type ValueStreamType = "o2c" | "p2p" | "c2m" | "h2r" | "t2r";

export type UserRole = "consultant" | "stakeholder";

export type ApprovalStatus = "draft" | "in_review" | "approved" | "rejected";

export type EngagementStatus = "draft" | "active" | "completed";

export type WorkflowStep =
  | "streams"
  | "process"
  | "ontology"
  | "teleology"
  | "connectors"
  | "review";

export interface Participant {
  userId: string;
  displayName: string;
  role: UserRole;
  functionUnits?: FunctionalUnit[];
}

export interface ValueStream {
  id: string;
  type: ValueStreamType;
  baselineId: string;
  baselineLoaded: boolean;
  approvalStatus: ApprovalStatus;
}

// Per-engagement value-stream config from the industry profile: the stream
// `type` (open string, extensible) plus its industry-appropriate label.
export interface ValueStreamConfig {
  type: string;
  label: string;
}

// Industry baseline slug. Open-ended: the set of available industries is
// discovered at runtime from GET /api/v1/ontology/baselines (any folder under
// data/baselines/ with stream TTLs). "generic" and "telecom" are always present.
export type Industry = string;

export interface Engagement {
  id: string;
  name: string;
  client: string;
  status: EngagementStatus;
  description?: string;
  industry: Industry;
  participants: Participant[];
  valueStreams: ValueStream[];
  // Per-engagement config resolved from the industry profile (API-backed). Optional
  // so mock/UI-only construction still typechecks; consumers fall back to the full
  // function-unit library / default value-stream order when absent.
  functionUnits?: FunctionalUnit[];
  valueStreamConfig?: ValueStreamConfig[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateEngagementInput {
  name: string;
  client: string;
  description?: string;
  industry?: Industry;
}

/** Real per-step completion, derived from artefact state by the API. */
export interface EngagementProgress {
  streams: boolean;
  process: boolean;
  ontology: boolean;
  teleology: boolean;
  connectors: boolean;
  review: boolean;
  firstLoadedStream: ValueStreamType | null;
}

export interface BaselineTemplate {
  id: string;
  streamType: ValueStreamType;
  name: string;
  description: string;
  processCount: number;
  ontologyClasses: number;
}

export interface AiTagSuggestion {
  functionUnit: FunctionalUnit;
  systems: string[];
  rationale: string;
  source?: string;
}

export interface BpmnElementMeta {
  functionUnit?: FunctionalUnit;
  /** Enterprise systems realizing this step (system catalog ids). */
  systems?: string[];
  /** AI-proposed tags — cleared on accept or dismiss. */
  aiSuggestion?: AiTagSuggestion | null;
}

export interface SystemDef {
  id: string;
  name: string;
  category: string;
}

export interface ProcessComment {
  id: string;
  engagementId: string;
  streamType: ValueStreamType;
  authorId: string;
  authorName: string;
  role: UserRole;
  targetType: "bpmn_element";
  targetId: string;
  targetLabel: string;
  functionUnit?: FunctionalUnit;
  body: string;
  createdAt: string;
  resolved: boolean;
}

export interface ProcessState {
  engagementId: string;
  streamType: ValueStreamType;
  bpmnXml: string;
  elementMeta: Record<string, BpmnElementMeta>;
}

export interface AiGapSuggestion {
  id: string;
  severity: "warning" | "info";
  elementId?: string;
  elementLabel?: string;
  message: string;
}

export interface OwlClass {
  uri: string;
  label: string;
  functionUnit?: FunctionalUnit;
  linkedBpmnElements: string[];
  mappedConcepts: string[];
  /** Teleology row ids this class supports (ots:supportsGoal). */
  supportsGoals: string[];
}

export type ThesaurusFramework = "apqc" | "etom" | "sid";

export interface ThesaurusConcept {
  uri: string;
  label: string;
  notation?: string;
  definition?: string;
  broaderUri?: string;
}

export interface OntologyEdge {
  id: string;
  source: string;
  target: string;
  label: string;
  edgeType: "subClassOf" | "precedes" | "relation";
}

export interface OntologyGraph {
  graphUri: string;
  classes: OwlClass[];
  edges: OntologyEdge[];
}

export interface InitializeGraphResult {
  graphUri: string;
  initialized: boolean;
  tripleCount: number;
}

export type OrgTheme = "revenue" | "cost" | "cx" | "ttm";

export interface OrgAmbitions {
  revenue: string[];
  cost: string[];
  cx: string[];
  ttm: string[];
}

export interface TeleologyRow {
  id: string;
  engagementId: string;
  streamType: ValueStreamType;
  functionUnit?: FunctionalUnit;
  goals: string[];
  gaps: string[];
  ambitions: string[];
  orgAmbitions: OrgAmbitions;
  approvalStatus: ApprovalStatus;
  updatedAt: string;
}

export interface TeleologyMatrix {
  engagementId: string;
  rows: TeleologyRow[];
}

export interface UpdateTeleologyRowInput {
  goals?: string[];
  gaps?: string[];
  ambitions?: string[];
  orgAmbitions?: Partial<OrgAmbitions>;
}

export type ConnectorType = "salesforce" | "jira";

export type ConnectorTargetType = "bpmn_task" | "owl_class" | "process_meta";

export type ImportPreviewStatus = "ready" | "conflict" | "unmapped";

export interface ConnectorConnection {
  engagementId: string;
  connectorType: ConnectorType;
  connected: boolean;
  instanceUrl: string;
  lastSyncAt: string | null;
  lastPreviewAt: string | null;
  lastAppliedAt: string | null;
}

export interface FieldMapping {
  id: string;
  engagementId: string;
  connectorType: ConnectorType;
  sourceField: string;
  targetField: string;
  targetType: ConnectorTargetType;
  targetLabel: string;
  streamType: ValueStreamType;
}

export interface ImportPreviewItem {
  id: string;
  sourceField: string;
  sourceValue: string;
  targetField: string;
  targetLabel: string;
  targetType: ConnectorTargetType;
  streamType: ValueStreamType;
  status: ImportPreviewStatus;
  note?: string;
}

export interface ImportPreviewResult {
  connectorType: ConnectorType;
  streamType: ValueStreamType;
  items: ImportPreviewItem[];
  summary: {
    ready: number;
    conflict: number;
    unmapped: number;
  };
  error?: string;
}

export interface ApplyImportResult {
  applied: number;
  skipped: number;
  message: string;
}

export interface UpdateFieldMappingInput {
  sourceField?: string;
  targetField?: string;
  targetLabel?: string;
  targetType?: ConnectorTargetType;
}

// --- Alignment (current state vs teleology) --------------------------------

export interface AlignmentScoreBreakdown {
  goalsDefined: number; // /20
  processEvidence: number; // /20
  systemCoverage: number; // /20
  ontologyCoverage: number; // /20
  goalTraceability: number; // /10
  feedbackClear: number; // /10
}

export interface AlignmentUnitEvidence {
  stepCount: number;
  stepsWithSystems: number;
  systems: string[];
  ontologyClasses: number;
  bpmnLinkedClasses: number;
  goalLinkedClasses: number;
  openComments: number;
  stepNames: string[];
}

export interface AlignmentUnit {
  functionUnit: FunctionalUnit | null;
  teleologyRowId: string | null;
  approvalStatus: ApprovalStatus;
  goals: string[];
  gaps: string[];
  ambitions: string[];
  orgAmbitions: OrgAmbitions;
  evidence: AlignmentUnitEvidence;
  score: number;
  scoreBreakdown: AlignmentScoreBreakdown;
}

export interface AlignmentStream {
  streamType: ValueStreamType;
  approvalStatus: ApprovalStatus;
  units: AlignmentUnit[];
}

export interface AlignmentReport {
  engagementId: string;
  generatedAt: string;
  streams: AlignmentStream[];
}

// --- Solution options + initiatives (gap-bridge agents) --------------------

export type SolutionOptionType =
  | "quick_win"
  | "strategic"
  | "transformational";

export type SolutionStatus = "draft" | "accepted" | "dismissed";

export type ProposedChangeKind =
  | "add_step"
  | "modify_step"
  | "tag_system"
  | "add_class"
  | "link_class_goal"
  | "update_teleology"
  | "other";

export interface ProposedChange {
  kind: ProposedChangeKind;
  description: string;
  targetId?: string | null;
  targetLabel?: string | null;
}

export interface SolutionOption {
  id: string;
  engagementId: string;
  streamType: ValueStreamType;
  functionUnit: FunctionalUnit | null;
  teleologyRowId: string | null;
  title: string;
  optionType: SolutionOptionType;
  rationale: string;
  proposedChanges: ProposedChange[];
  impactedSteps: Array<{ name: string }>;
  impactedClasses: Array<{ label: string; uri?: string | null }>;
  effort: "low" | "medium" | "high";
  impact: "low" | "medium" | "high";
  status: SolutionStatus;
  source: string;
  createdAt: string;
  updatedAt: string;
}

export type InitiativeHorizon = "now" | "next" | "later";

export interface InitiativeStreamLink {
  streamType: ValueStreamType;
  role: string;
  stepNames: string[];
  classLabels: string[];
}

export interface Initiative {
  id: string;
  engagementId: string;
  name: string;
  narrative: string;
  streams: ValueStreamType[];
  functionUnits: FunctionalUnit[];
  streamLinks: InitiativeStreamLink[];
  consolidates: string[];
  orgImpact: Partial<Record<OrgTheme, string>>;
  horizon: InitiativeHorizon;
  status: SolutionStatus;
  source: string;
  createdAt: string;
  updatedAt: string;
}

export type ReviewArtefactType =
  | "value_stream"
  | "teleology_row"
  | "process_feedback"
  | "solution_option"
  | "initiative";

export interface ReviewQueueItem {
  id: string;
  engagementId: string;
  artefactType: ReviewArtefactType;
  streamType: ValueStreamType;
  functionUnit?: FunctionalUnit;
  title: string;
  subtitle: string;
  approvalStatus: ApprovalStatus | "open";
  updatedAt: string;
  commentBody?: string;
  targetId?: string;
  teleologyRowId?: string;
  href: string;
}

export interface ReviewSummary {
  inReview: number;
  approved: number;
  rejected: number;
  openFeedback: number;
}

export interface ReviewQueue {
  engagementId: string;
  items: ReviewQueueItem[];
  summary: ReviewSummary;
}

export interface AuditEvent {
  id: number;
  actorId: string;
  actorName: string;
  actorRole: UserRole | string;
  action: string;
  artefactType: string;
  artefactId: string;
  engagementId: string | null;
  detail: Record<string, unknown>;
  createdAt: string;
}
