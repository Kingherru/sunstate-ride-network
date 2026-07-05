export const PATIENT_TYPE_OPTIONS = [
  "Self",
  "Father",
  "Mother",
  "Brother",
  "Sister",
  "Grandparent",
  "Cousin",
  "Friend",
  "Guardian",
  "Caregiver",
  "Case Worker",
  "Social Worker",
  "Nursing Home Staff",
  "Hospital Staff",
  "Other",
] as const;

export const PATIENT_RELATIONSHIP_OPTIONS = [
  "Parent",
  "Mother",
  "Father",
  "Brother",
  "Sister",
  "Guardian",
  "Caregiver",
  "Spouse",
  "Child",
  "Grandparent",
  "Cousin",
  "Friend",
  "Legal Representative",
  "Power of Attorney",
  "Case Manager",
  "Social Worker",
  "Nursing Home Representative",
  "Hospital Representative",
  "Other",
] as const;

export type PatientType = (typeof PATIENT_TYPE_OPTIONS)[number];
export type PatientRelationship = (typeof PATIENT_RELATIONSHIP_OPTIONS)[number];

export function formatPatientType(type?: string | null, other?: string | null): string {
  if (!type) return "—";
  if (type === "Other") return other ? `Other — ${other}` : "Other";
  return type;
}

export function formatPatientRelationship(rel?: string | null, other?: string | null): string {
  if (!rel) return "—";
  if (rel === "Other") return other ? `Other — ${other}` : "Other";
  return rel;
}
