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

export type Industry = "generic" | "telecom";

export interface Engagement {
  id: string;
  name: string;
  client: string;
  status: EngagementStatus;
  description?: string;
  industry: Industry;
  participants: Participant[];
  valueStreams: ValueStream[];
  currentStep: WorkflowStep;
  createdAt: string;
  updatedAt: string;
}

export interface CreateEngagementInput {
  name: string;
  client: string;
  description?: string;
  industry?: Industry;
}

export interface BaselineTemplate {
  id: string;
  streamType: ValueStreamType;
  name: string;
  description: string;
  processCount: number;
  ontologyClasses: number;
}

export interface BpmnElementMeta {
  functionUnit?: FunctionalUnit;
  /** Enterprise systems realizing this step (system catalog ids). */
  systems?: string[];
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

export type ReviewArtefactType =
  | "value_stream"
  | "teleology_row"
  | "process_feedback";

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
