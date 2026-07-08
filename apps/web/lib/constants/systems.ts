import type { SystemDef } from "@/lib/types";

/**
 * System catalog for step→system mapping in workshops. Static seed for the
 * mock phase; becomes engagement-scoped (consultant-editable) with Postgres.
 */
export const SYSTEM_CATALOG: SystemDef[] = [
  { id: "sap-erp", name: "SAP S/4HANA", category: "ERP" },
  { id: "oracle-erp", name: "Oracle ERP Cloud", category: "ERP" },
  { id: "netsuite", name: "NetSuite", category: "ERP" },
  { id: "salesforce", name: "Salesforce", category: "CRM" },
  { id: "dynamics", name: "Microsoft Dynamics 365", category: "CRM" },
  { id: "hubspot", name: "HubSpot", category: "CRM" },
  { id: "workday", name: "Workday", category: "HCM" },
  { id: "successfactors", name: "SAP SuccessFactors", category: "HCM" },
  { id: "servicenow", name: "ServiceNow", category: "ITSM" },
  { id: "jira", name: "Jira", category: "Work management" },
  { id: "coupa", name: "Coupa", category: "Procurement" },
  { id: "ariba", name: "SAP Ariba", category: "Procurement" },
  { id: "zuora", name: "Zuora", category: "Billing" },
  { id: "stripe", name: "Stripe", category: "Payments" },
  { id: "amdocs", name: "Amdocs (BSS)", category: "Telecom BSS" },
  { id: "netcracker", name: "Netcracker (OSS)", category: "Telecom OSS" },
  { id: "custom", name: "Custom / in-house", category: "Other" },
  { id: "spreadsheet", name: "Spreadsheets / manual", category: "Other" },
];

export const SYSTEM_MAP = Object.fromEntries(
  SYSTEM_CATALOG.map((system) => [system.id, system]),
) as Record<string, SystemDef>;
