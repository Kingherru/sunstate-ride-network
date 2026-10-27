import { useMemo } from "react";
import { listContacts } from "@/lib/crm.functions";
import { listMyPayers } from "@/lib/payers.functions";
import { usePortalQuery } from "@/components/portal/preview-data";
import { SegTabs } from "@/components/portal/SegTabs";
import { ContactsPanel } from "@/components/dashboard/ContactsPanel";
import { PayersPanel } from "@/components/dashboard/PayersPanel";

export type ContactOption = { id: string; name: string };

/** Merged Patient/Facility Contacts & Payers page: two tabs over the same
 *  underlying records, so a linked payer contact appears on both tabs without
 *  being duplicated. */
export function ContactsPayersPanel({ tab, onTab }: { tab: "contacts" | "payers"; onTab: (t: "contacts" | "payers") => void }) {
  const contactsQ = usePortalQuery({ queryKey: ["contacts"], queryFn: () => listContacts() });
  const payersQ = usePortalQuery({ queryKey: ["my-payers"], queryFn: () => listMyPayers() });

  const payerOptions = useMemo(
    () => (payersQ.data ?? []).map((p) => ({ id: p.id, name: p.name })),
    [payersQ.data],
  );
  const contactOptions: ContactOption[] = useMemo(
    () =>
      (contactsQ.data ?? []).map((c: any) => ({
        id: c.id,
        name: c.company_name || `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim() || "Unnamed contact",
      })),
    [contactsQ.data],
  );

  return (
    <div className="space-y-4">
      <SegTabs
        label="Contacts and payers"
        value={tab}
        onChange={onTab}
        options={[{ value: "contacts", label: "Contacts" }, { value: "payers", label: "Payers" }]}
      />
      {tab === "contacts" ? <ContactsPanel payers={payerOptions} /> : <PayersPanel contacts={contactOptions} />}
    </div>
  );
}
