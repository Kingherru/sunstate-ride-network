/**
 * Translate a raw server/database/Zod error into a user-friendly message and,
 * when possible, a per-field map for inline highlighting.
 *
 * Full technical detail is preserved via console.error so admins/devs can
 * still trace the root cause.
 */

export type FriendlyError = {
  message: string;
  fields?: Record<string, string>;
};

const FIELD_LABELS: Record<string, string> = {
  patient_first_name: "Patient first name",
  patient_last_name: "Patient last name",
  patient_phone: "Patient phone",
  patient_email: "Patient email",
  patient_date_of_birth: "Patient date of birth",
  pickup_address: "Pickup address",
  pickup_city: "Pickup city",
  pickup_zip: "Pickup ZIP",
  pickup_date: "Pickup date",
  pickup_time: "Pickup time",
  appointment_time: "Appointment time",
  dropoff_address: "Dropoff address",
  dropoff_city: "Dropoff city",
  dropoff_zip: "Dropoff ZIP",
  return_date: "Return date",
  return_pickup_time: "Return pickup time",
  return_dropoff_time: "Return dropoff time",
  transport_type: "Transportation type",
  service_level: "Service level",
  delivery_item_type: "Delivery item type",
  delivery_recipient_name: "Recipient name",
  delivery_recipient_phone: "Recipient phone",
  payer_id: "Payer",
};

function labelFor(path: string): string {
  return FIELD_LABELS[path] ?? path.replace(/_/g, " ");
}

function friendlyIssueMessage(path: string, code: string, raw: string): string {
  const label = labelFor(path);
  if (code === "invalid_format" || code === "invalid_string") {
    if (/date/i.test(path)) return `Please enter ${label.toLowerCase()} as a valid date.`;
    if (/time/i.test(path)) return `Please enter ${label.toLowerCase()} as a valid time.`;
    if (path === "patient_email") return "Please enter a valid email address.";
    return `${label} is not in the expected format.`;
  }
  if (code === "too_small" || code === "invalid_type") {
    return `${label} is required.`;
  }
  return raw && raw.length < 140 ? `${label}: ${raw}` : `${label} is invalid.`;
}

export function humanizeError(err: unknown): FriendlyError {
  // Always log the raw error for admins/devs.
  if (err !== undefined) {
    // eslint-disable-next-line no-console
    console.error("[trip submission]", err);
  }

  const rawMsg =
    err instanceof Error ? err.message :
    typeof err === "string" ? err :
    "";

  // 1) Zod issues serialized as JSON (server-side inputValidator throws this shape)
  const trimmed = rawMsg.trim();
  if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
    try {
      const parsed = JSON.parse(trimmed);
      const issues = Array.isArray(parsed) ? parsed : parsed.issues;
      if (Array.isArray(issues) && issues.length > 0) {
        const fields: Record<string, string> = {};
        for (const iss of issues) {
          const path = Array.isArray(iss.path) ? iss.path.filter(Boolean).join(".") : String(iss.path ?? "");
          if (!path) continue;
          fields[path] = friendlyIssueMessage(path, String(iss.code ?? ""), String(iss.message ?? ""));
        }
        const first = Object.values(fields)[0];
        return {
          message: first ?? "Please fix the highlighted fields.",
          fields,
        };
      }
    } catch { /* not JSON — fall through */ }
  }

  const msg = rawMsg.toLowerCase();

  // 2) RLS / permissions
  if (msg.includes("row-level security") || msg.includes("violates row-level security")) {
    return { message: "You don't have permission to save this trip. Please sign in again or contact support." };
  }
  if (msg.includes("permission denied")) {
    return { message: "Your account isn't allowed to perform this action. Please contact support." };
  }
  if (msg.includes("jwt") || msg.includes("not authenticated") || msg.includes("unauthorized")) {
    return { message: "Your session has expired. Please sign in again to continue." };
  }

  // 3) Common Postgres error patterns
  const nullCol = rawMsg.match(/null value in column "([^"]+)"/i);
  if (nullCol) {
    const col = nullCol[1];
    return {
      message: `${labelFor(col)} is required.`,
      fields: { [col]: `${labelFor(col)} is required.` },
    };
  }
  const dup = rawMsg.match(/duplicate key value violates unique constraint/i);
  if (dup) {
    return { message: "This trip looks like a duplicate of one you've already submitted." };
  }
  const check = rawMsg.match(/violates check constraint/i);
  if (check) {
    return { message: "Some of the information entered isn't allowed. Please review the highlighted fields." };
  }
  const fk = rawMsg.match(/violates foreign key constraint/i);
  if (fk) {
    return { message: "A referenced record couldn't be found. Please refresh and try again." };
  }

  // 4) Known application errors we already throw with friendly text
  if (rawMsg && rawMsg.length < 200 && !rawMsg.includes("Error:")) {
    return { message: rawMsg };
  }

  // 5) Fallback
  return {
    message: "We couldn't submit this trip. Please review your information and try again — if this keeps happening, contact support.",
  };
}
