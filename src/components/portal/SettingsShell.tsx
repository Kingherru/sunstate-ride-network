import { PortalTabbedLayout } from './PortalTabbedLayout';
export function SettingsShell<T extends string>({ value, onChange, sections, aliases, children }: { value: T; onChange: (value: T) => void; sections: { value: T; label: string }[]; aliases?: Record<string, T>; children: React.ReactNode }) {
  return <PortalTabbedLayout label="Settings sections" queryKey="section" aliases={aliases} value={value} onChange={onChange} options={sections}>{children}</PortalTabbedLayout>;
}