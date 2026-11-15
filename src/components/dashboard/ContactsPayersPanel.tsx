import { useMemo } from "react";
import { listContacts } from "@/lib/crm.functions";
import { listMyPayers } from "@/lib/payers.functions";
import { usePortalQuery } from "@/components/portal/preview-data";
import { PortalTabbedLayout } from "@/components/portal/PortalTabbedLayout";
import { ContactsPanel } from "@/components/dashboard/ContactsPanel";
import { PayersPanel } from "@/components/dashboard/PayersPanel";
import { PatientManagement } from '@/components/portal/PatientManagement';
import {NewConnections} from '@/components/portal/NewConnections';
import {AccountConnections} from '@/components/portal/AccountConnections';

export type ContactOption = { id: string; name: string };

/** Merged Patient/Facility Contacts & Payers page: two tabs over the same
 *  underlying records, so a linked payer contact appears on both tabs without
 *  being duplicated. */
export function ContactsPayersPanel({ tab, onTab,patient=false,workspaceId }: { tab: "patients" | "contacts" | "payers" | "connections" | "accepted"; onTab: (t: "patients" | "contacts" | "payers" | "connections" | "accepted") => void;patient?:boolean;workspaceId?:string }) {
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
        options={[...(!patient?[{value:'patients' as const,label:'Patients'}]:[]),{ value: "contacts", label: "Contacts" }, { value: "payers", label: "Payers" },...(patient?[{value:'accepted' as const,label:'Connections'}]:[]),{value:'connections',label:'New Connections'}]}
      >
      {tab==='accepted'&&workspaceId?<AccountConnections workspaceId={workspaceId} showVisibility={false}/>:tab==='connections'?<NewConnections/>:tab === "patients"&&!patient ? <PatientManagement /> : tab === "contacts"||tab==='patients' ? <ContactsPanel payers={payerOptions} /> : <PayersPanel contacts={contactOptions} />}
    </PortalTabbedLayout>
    </div>
  );
}
