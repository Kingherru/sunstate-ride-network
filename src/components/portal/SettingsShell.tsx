import { SegTabs } from './SegTabs';
export function SettingsShell<T extends string>({ value, onChange, sections, children }: { value: T; onChange: (value: T) => void; sections: { value: T; label: string }[]; children: React.ReactNode }) {
  return <div className="grid min-w-0 gap-5 lg:grid-cols-[18rem_minmax(0,1fr)]"><SegTabs label="Settings sections" variant="rail" queryKey="section" value={value} onChange={onChange} options={sections}/><div className="portal-business-form min-w-0 space-y-5">{children}</div></div>;
}