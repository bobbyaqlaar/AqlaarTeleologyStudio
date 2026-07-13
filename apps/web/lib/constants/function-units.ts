import type { FunctionalUnit } from "@/lib/types";

export interface FunctionUnitMeta {
  id: FunctionalUnit;
  label: string;
  token: string;
  colorClass: string;
  dotClass: string;
}

export const FUNCTION_UNITS: FunctionUnitMeta[] = [
  {
    id: "sales",
    label: "Sales",
    token: "fn-sales",
    colorClass: "text-fn-sales",
    dotClass: "bg-fn-sales",
  },
  {
    id: "marketing",
    label: "Marketing",
    token: "fn-marketing",
    colorClass: "text-fn-marketing",
    dotClass: "bg-fn-marketing",
  },
  {
    id: "customer_care",
    label: "Customer care",
    token: "fn-customer-care",
    colorClass: "text-fn-customer-care",
    dotClass: "bg-fn-customer-care",
  },
  {
    id: "finance",
    label: "Finance",
    token: "fn-finance",
    colorClass: "text-fn-finance",
    dotClass: "bg-fn-finance",
  },
  {
    id: "procurement_scm",
    label: "Procurement / SCM",
    token: "fn-procurement",
    colorClass: "text-fn-procurement",
    dotClass: "bg-fn-procurement",
  },
  {
    id: "production",
    label: "Production",
    token: "fn-production",
    colorClass: "text-fn-production",
    dotClass: "bg-fn-production",
  },
  {
    id: "operations",
    label: "Operations",
    token: "fn-operations",
    colorClass: "text-fn-operations",
    dotClass: "bg-fn-operations",
  },
  {
    id: "hr",
    label: "Human Resources",
    token: "fn-hr",
    colorClass: "text-fn-hr",
    dotClass: "bg-fn-hr",
  },
  {
    id: "products",
    label: "Products",
    token: "fn-products",
    colorClass: "text-fn-products",
    dotClass: "bg-fn-products",
  },
  {
    id: "it",
    label: "IT",
    token: "fn-it",
    colorClass: "text-fn-it",
    dotClass: "bg-fn-it",
  },
  {
    id: "networks",
    label: "Networks",
    token: "fn-networks",
    colorClass: "text-fn-networks",
    dotClass: "bg-fn-networks",
  },
];

export const FUNCTION_UNIT_MAP = Object.fromEntries(
  FUNCTION_UNITS.map((unit) => [unit.id, unit]),
) as Record<FunctionalUnit, FunctionUnitMeta>;

/**
 * The function units active for an engagement — the industry-appropriate subset
 * of the library declared by the engagement's profile. Falls back to the full
 * library when no config is present (mock/UI-only mode, or legacy engagements).
 * Order follows the engagement config when given, else the library order.
 */
export function functionUnitsFor(
  units?: FunctionalUnit[] | null,
): FunctionUnitMeta[] {
  if (!units || units.length === 0) {
    return FUNCTION_UNITS;
  }
  return units
    .map((id) => FUNCTION_UNIT_MAP[id])
    .filter((meta): meta is FunctionUnitMeta => Boolean(meta));
}
