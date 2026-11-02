import type { ConversationRow, MessageRow } from "@/lib/workspace-messages.functions";

/** Master-Admin portal preview only. Synthetic, in-memory, never written to
 *  live message tables. Set to false (or delete this file's fixtures) to
 *  remove every demo conversation in one place. */
export const PREVIEW_CONVERSATIONS_ENABLED = true;
export const PREVIEW_SELF_WORKSPACE = "preview-self";

const now = Date.now();
const at = (h: number) => new Date(now - h * 3600_000).toISOString();

const PROVIDER: { convo: ConversationRow; messages: MessageRow[] }[] = [
  { convo: { id: "demo-p1", otherWorkspaceId: "demo-ws-a", otherName: "Gulfside Rides (Demo)", otherMfnId: "MFN-A-DEMO01", lastSenderName: "Dana", lastMessage: "Thanks — we cover Pinellas weekdays.", lastMessageAt: at(2), unreadCount: 1, archived: false, isTest: true },
    messages: [
      { id: "dm1", senderWorkspaceId: PREVIEW_SELF_WORKSPACE, recipientWorkspaceId: "demo-ws-a", senderFirstName: "You (Demo)", body: "Hello! Which counties does your team cover?", createdAt: at(5), readAt: at(4) },
      { id: "dm2", senderWorkspaceId: "demo-ws-a", recipientWorkspaceId: PREVIEW_SELF_WORKSPACE, senderFirstName: "Dana", body: "Thanks — we cover Pinellas weekdays.", createdAt: at(2), readAt: null },
    ] },
  { convo: { id: "demo-p2", otherWorkspaceId: "demo-ws-b", otherName: "Sunrise Care Center (Demo)", otherMfnId: "MFN-A-DEMO02", lastSenderName: "You", lastMessage: "We can share our availability next week.", lastMessageAt: at(30), unreadCount: 0, archived: false, isTest: true },
    messages: [{ id: "dm3", senderWorkspaceId: PREVIEW_SELF_WORKSPACE, recipientWorkspaceId: "demo-ws-b", senderFirstName: "You (Demo)", body: "We can share our availability next week.", createdAt: at(30), readAt: at(29) }] },
];

const CUSTOMER: { convo: ConversationRow; messages: MessageRow[] }[] = [
  { convo: { id: "demo-c1", otherWorkspaceId: "demo-ws-c", otherName: "Coastal Transport (Demo)", otherMfnId: "MFN-A-DEMO03", lastSenderName: "Sam", lastMessage: "Our office is open 8–5 for questions.", lastMessageAt: at(3), unreadCount: 1, archived: false, isTest: true },
    messages: [
      { id: "dm4", senderWorkspaceId: PREVIEW_SELF_WORKSPACE, recipientWorkspaceId: "demo-ws-c", senderFirstName: "You (Demo)", body: "What are your office hours?", createdAt: at(6), readAt: at(5) },
      { id: "dm5", senderWorkspaceId: "demo-ws-c", recipientWorkspaceId: PREVIEW_SELF_WORKSPACE, senderFirstName: "Sam", body: "Our office is open 8–5 for questions.", createdAt: at(3), readAt: null },
    ] },
];

export function previewConversations(kind: "provider" | "customer") {
  if (!PREVIEW_CONVERSATIONS_ENABLED) return [];
  return kind === "provider" ? PROVIDER : CUSTOMER;
}
