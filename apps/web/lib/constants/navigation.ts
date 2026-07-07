import type { WorkflowStep } from "@/lib/types";
import {
  Cable,
  ClipboardCheck,
  GitBranch,
  LayoutDashboard,
  Network,
  Target,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  id: string;
  label: string;
  href: (engagementId: string) => string;
  icon: LucideIcon;
  step?: WorkflowStep;
  iteration: number;
}

export const ENGAGEMENT_NAV: NavItem[] = [
  {
    id: "overview",
    label: "Overview",
    href: (id) => `/engagements/${id}`,
    icon: LayoutDashboard,
    iteration: 1,
  },
  {
    id: "streams",
    label: "Value streams",
    href: (id) => `/engagements/${id}/streams`,
    icon: GitBranch,
    step: "streams",
    iteration: 1,
  },
  {
    id: "process",
    label: "Process (BPMN)",
    href: (id) => `/engagements/${id}/streams/o2c/process`,
    icon: Network,
    step: "process",
    iteration: 2,
  },
  {
    id: "ontology",
    label: "Ontology (OWL)",
    href: (id) => `/engagements/${id}/streams/o2c/ontology`,
    icon: Network,
    step: "ontology",
    iteration: 3,
  },
  {
    id: "teleology",
    label: "Teleology",
    href: (id) => `/engagements/${id}/teleology`,
    icon: Target,
    step: "teleology",
    iteration: 4,
  },
  {
    id: "connectors",
    label: "Connectors",
    href: (id) => `/engagements/${id}/connectors`,
    icon: Cable,
    step: "connectors",
    iteration: 5,
  },
  {
    id: "review",
    label: "Review",
    href: (id) => `/engagements/${id}/review`,
    icon: ClipboardCheck,
    step: "review",
    iteration: 5,
  },
];

export const WORKFLOW_STEPS: {
  step: WorkflowStep;
  label: string;
  number: number;
}[] = [
  { step: "streams", label: "Streams", number: 1 },
  { step: "process", label: "Process", number: 2 },
  { step: "ontology", label: "Ontology", number: 3 },
  { step: "teleology", label: "Teleology", number: 4 },
  { step: "review", label: "Review", number: 5 },
];

export const CURRENT_ITERATION = 5;
