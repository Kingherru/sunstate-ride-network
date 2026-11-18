import { useServerFn } from '@tanstack/react-start';
import { getRecordEditAccess } from '@/lib/record-edit.functions';
import { usePortalPreview, usePortalQuery } from './preview-data';

export function useRecordEditAccess(kind: 'contacts' | 'payers' | 'drivers' | 'vehicles') {
  const preview = usePortalPreview();
  const get = useServerFn(getRecordEditAccess);
  const query = usePortalQuery({ queryKey: ['record-edit-access', kind], queryFn: () => get({ data: { kind } }), enabled: !preview.active, staleTime: 0 });
  return (id: string) => preview.active || !!query.data?.ids?.includes(id);
}