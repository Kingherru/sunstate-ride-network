/** Business classification of an account. A label only — it never grants any permission. */
export const ORGANIZATION_TYPES = [
  { value: "private_pay_patient", label: "Private Pay / Patient" },
  { value: "general_facility", label: "General Facility" },
  { value: "medical_facility", label: "Medical Facility" },
  { value: "hospital", label: "Hospital" },
  { value: "broker", label: "Broker" },
  { value: "insurance_company", label: "Insurance Company" },
  { value: "group_home", label: "Group Home" },
  { value: "nursing_home", label: "Nursing Home" },
  { value: "medical_courier", label: "Medical Delivery or Medical Courier Company" },
  { value: "other_organization", label: "Other Organization" },
] as const;

export type OrganizationType = (typeof ORGANIZATION_TYPES)[number]["value"];
export const ORGANIZATION_VALUES = ORGANIZATION_TYPES.map((o) => o.value) as [OrganizationType, ...OrganizationType[]];

export function organizationLabel(v: string | null | undefined): string {
  if (!v || v === "needs_review") return "Needs classification";
  if (v === "transportation_provider") return "Transportation Provider";
  return ORGANIZATION_TYPES.find((o) => o.value === v)?.label ?? "Needs classification";
}
