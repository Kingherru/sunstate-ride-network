import { createFileRoute, redirect } from "@tanstack/react-router";

/** Payers merged into Contacts & payers; keep the old URL working. */
export const Route = createFileRoute("/_authenticated/portal/payers")({
  beforeLoad: () => {
    throw redirect({ to: "/portal/contacts", search: { tab: "payers" } });
  },
});
