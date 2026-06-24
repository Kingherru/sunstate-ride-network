import type { ProviderDoc } from "@/lib/forms.functions";

export type DocKind = ProviderDoc["kind"];

export const DOC_FIELDS: {
  kind: DocKind;
  label: string;
  category: "Identity & Tax" | "Insurance & Vehicle" | "Agreements" | "Photos";
  required: boolean;
  hint?: string;
}[] = [
  // Identity & Tax
  { kind: "drivers_license", label: "Driver's License", category: "Identity & Tax", required: true, hint: "Front of card" },
  { kind: "w9", label: "W-9", category: "Identity & Tax", required: true },
  { kind: "ein_letter", label: "EIN Letter (IRS CP-575)", category: "Identity & Tax", required: true },
  { kind: "business_license", label: "Business / Occupational License", category: "Identity & Tax", required: false },
  { kind: "npi", label: "NPI Confirmation", category: "Identity & Tax", required: false, hint: "If applicable" },

  // Insurance & Vehicle
  { kind: "insurance", label: "Auto / Liability Insurance", category: "Insurance & Vehicle", required: true, hint: "Declarations page" },
  { kind: "vehicle_registration", label: "Vehicle Registration", category: "Insurance & Vehicle", required: true },
  { kind: "vehicle_vin", label: "Vehicle VIN", category: "Insurance & Vehicle", required: false, hint: "VIN plate photo" },

  // Agreements
  { kind: "non_compete", label: "Non-Compete Agreement", category: "Agreements", required: true },
  { kind: "nda", label: "Non-Disclosure Agreement (NDA)", category: "Agreements", required: true },
  { kind: "hipaa", label: "HIPAA Confidentiality Agreement", category: "Agreements", required: true },

  // Photos
  { kind: "driver_photo", label: "Driver Headshot", category: "Photos", required: true },
  { kind: "vehicle_photo_front", label: "Vehicle Photo — Front", category: "Photos", required: true },
  { kind: "vehicle_photo_rear", label: "Vehicle Photo — Rear", category: "Photos", required: true },
  { kind: "vehicle_photo_left", label: "Vehicle Photo — Left Side", category: "Photos", required: false },
];

export const DOC_LABEL: Record<DocKind, string> = Object.fromEntries(
  DOC_FIELDS.map((d) => [d.kind, d.label]),
) as Record<DocKind, string>;
DOC_LABEL.other = "Other";
