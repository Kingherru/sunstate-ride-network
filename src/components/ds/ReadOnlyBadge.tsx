import { DsBadge } from "@/components/ds/feedback";

/** Shown on admin section pages/panels when the signed-in admin has read-only
 *  access: create/edit/delete/send/approve controls are hidden or disabled. */
export function ReadOnlyBadge() {
  return <DsBadge status="neutral">READ-ONLY</DsBadge>;
}
