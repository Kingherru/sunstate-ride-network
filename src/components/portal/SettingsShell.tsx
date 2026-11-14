import { PortalTabbedLayout } from './PortalTabbedLayout';
export function SettingsShell<T extends string>({ value, onChange, sections, children }: { value: T; onChange: (value: T) => void; sections: { value: T; label: string }[]; children: React.ReactNode }) {
  return <PortalTabbedLayout label="Settings sections" queryKey="section" value={value} onChange={onChange} options={sections}>{children}</PortalTabbedLayout>;
}