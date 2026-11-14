import { useMemo } from "react";
import { listContacts } from "@/lib/crm.functions";
import { listMyPayers } from "@/lib/payers.functions";
import { usePortalQuery } from "@/components/portal/preview-data";
import { PortalTabbedLayout } from "@/components/portal/PortalTabbedLayout";
import { ContactsPanel } from "@/components/dashboard/ContactsPanel";
import { PayersPanel } from "@/components/dashboard/PayersPanel";
import { PatientManagement } from '@/components/portal/PatientManagement';
import {NewConnections} from '@/components/portal/NewConnections';

export type ContactOption = { id: string; name: string };

/** Merged Patient/Facility Contacts & Payers page: two tabs over the same
 *  underlying records, so a linked payer contact appears on both tabs without
 *  being duplicated. */
export function ContactsPayersPanel({ tab, onTab }: { tab: "patients" | "contacts" | "payers" | "connections"; onTab: (t: "patients" | "contacts" | "payers" | "connections") => void }) {
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
      <PortalTabbedLayout
        label="People sections"
        value={tab}
        onChange={onTab}
        options={[{ value: "patients", label: "Patients" }, { value: "contacts", label: "Contacts" }, { value: "payers", label: "Payers" },{value:'connections',label:'New Connections'}]}
      >
      {tab==='connections'?<NewConnections/>:tab === "patients" ? <PatientManagement /> : tab === "contacts" ? <ContactsPanel payers={payerOptions} /> : <PayersPanel contacts={contactOptions} />}
    </PortalTabbedLayout>
    </div>
  );
}
