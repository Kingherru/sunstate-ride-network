import { BadgeCheck } from 'lucide-react';
import { useServerFn } from '@tanstack/react-start';
import { listProviderBadges, type ProviderBadgeLevel } from '@/lib/provider-verification.functions';
import { usePortalPreview, usePortalQuery } from './preview-data';
const meanings = { semi: 'Current membership following the first successful $10 payment; not full business verification.', blue: 'Completed platform business, service, Stripe and applicable document requirements; not government endorsement or guaranteed authenticity.', gold: 'Verified with five qualifying Network trips paid in full on time and no overdue payment or active dispute.', none: 'Automatic verification requirements are not currently met.' };
export function ProviderVerificationBadge({ workspaceId, legacyVerified = false, level }: { workspaceId: string; legacyVerified?: boolean; level?: ProviderBadgeLevel }) {
  const preview = usePortalPreview(); const list = useServerFn(listProviderBadges);
  const q = usePortalQuery({ queryKey: ['provider-badges', workspaceId], queryFn: () => list({ data: { workspaceIds: [workspaceId] } }), enabled: level === undefined });
  const badge = q.data?.find(b => b.workspace_id === workspaceId);
  const value = level !== undefined ? level : badge?.level;
  const legacy = preview.active ? legacyVerified : badge?.legacy_verified ?? legacyVerified;
  if (value === undefined && !preview.active && (q.isLoading || q.error)) return null;
  if (!value && legacy) return <span className="inline-flex items-center gap-1 ds-caption text-ds-primary" title="Existing directory status; automatic business and document verification has not been established."><BadgeCheck className="size-4" />Directory verified</span>;
  if (!value || value === 'none') return <span className="ds-caption text-ds-muted">Not automatically verified</span>;
  const label = value === 'semi' ? 'Semi-Verified' : value === 'blue' ? 'Verified' : 'Super Verified';
  return <span title={meanings[value]} className={`inline-flex items-center gap-1 rounded-ds-sm px-2 py-1 ds-caption ${value === 'gold' ? 'bg-ds-warning-soft text-ds-warning' : value === 'blue' ? 'bg-ds-primary text-ds-on-primary' : 'bg-ds-sky text-ds-primary'}`}><BadgeCheck className="size-4" aria-hidden />{label}</span>;
}