import type { ConnectorType, FieldMapping, ValueStreamType } from "@/lib/types";

export interface ConnectorFixture {
  connectorType: ConnectorType;
  label: string;
  description: string;
  defaultInstanceUrl: string;
  supportedStreams: ValueStreamType[];
  defaultMappings: Omit<FieldMapping, "id" | "engagementId">[];
}

export const CONNECTOR_FIXTURES: ConnectorFixture[] = [
  {
    connectorType: "salesforce",
    label: "Salesforce",
    description:
      "Pull opportunities, accounts, and orders to pre-fill O2C process steps.",
    defaultInstanceUrl: "https://acme.my.salesforce.com",
    supportedStreams: ["o2c", "c2m"],
    defaultMappings: [
      {
        connectorType: "salesforce",
        sourceField: "Opportunity.StageName",
        targetField: "Task_validate",
        targetType: "bpmn_task",
        targetLabel: "Validate order",
        streamType: "o2c",
      },
      {
        connectorType: "salesforce",
        sourceField: "Account.CreditScore",
        targetField: "Task_credit",
        targetType: "bpmn_task",
        targetLabel: "Credit assessment",
        streamType: "o2c",
      },
      {
        connectorType: "salesforce",
        sourceField: "Order.FulfillmentStatus",
        targetField: "Task_fulfil",
        targetType: "bpmn_task",
        targetLabel: "Fulfillment",
        streamType: "o2c",
      },
      {
        connectorType: "salesforce",
        sourceField: "Invoice.Status",
        targetField: "Task_invoice",
        targetType: "bpmn_task",
        targetLabel: "Invoice",
        streamType: "o2c",
      },
      {
        connectorType: "salesforce",
        sourceField: "Payment.AmountReceived",
        targetField: "Task_collect",
        targetType: "bpmn_task",
        targetLabel: "Payment collection",
        streamType: "o2c",
      },
      {
        connectorType: "salesforce",
        sourceField: "Product2.Name",
        targetField: "ots:ProductConcept",
        targetType: "owl_class",
        targetLabel: "Product concept",
        streamType: "c2m",
      },
    ],
  },
  {
    connectorType: "jira",
    label: "Jira",
    description:
      "Import issue workflows to pre-fill T2R incident and resolution steps.",
    defaultInstanceUrl: "https://acme.atlassian.net",
    supportedStreams: ["t2r", "h2r"],
    defaultMappings: [
      {
        connectorType: "jira",
        sourceField: "IssueType.name",
        targetField: "Task_intake",
        targetType: "bpmn_task",
        targetLabel: "Incident intake",
        streamType: "t2r",
      },
      {
        connectorType: "jira",
        sourceField: "Priority.name",
        targetField: "Task_triage",
        targetType: "bpmn_task",
        targetLabel: "Triage",
        streamType: "t2r",
      },
      {
        connectorType: "jira",
        sourceField: "Status.name",
        targetField: "Task_diagnose",
        targetType: "bpmn_task",
        targetLabel: "Diagnose",
        streamType: "t2r",
      },
      {
        connectorType: "jira",
        sourceField: "Resolution.name",
        targetField: "Task_resolve",
        targetType: "bpmn_task",
        targetLabel: "Resolve",
        streamType: "t2r",
      },
      {
        connectorType: "jira",
        sourceField: "CustomField.slaBreached",
        targetField: "Task_close",
        targetType: "bpmn_task",
        targetLabel: "Close incident",
        streamType: "t2r",
      },
      {
        connectorType: "jira",
        sourceField: "IssueType.name",
        targetField: "Task_onboard",
        targetType: "bpmn_task",
        targetLabel: "Onboard employee",
        streamType: "h2r",
      },
    ],
  },
];

export const CONNECTOR_FIXTURE_MAP = Object.fromEntries(
  CONNECTOR_FIXTURES.map((fixture) => [fixture.connectorType, fixture]),
) as Record<ConnectorType, ConnectorFixture>;
