/** Menu capability mirrors CSV import's existing single-account authorization. */
export function canUploadCsvRequests(workspaces: readonly {
  type: string;
  status: string;
  role: string;
  is_contractor?: boolean;
  can_create_requests?: boolean;
}[]): boolean {
  return workspaces.filter((w) => w.status === 'active' && w.type !== 'provider' &&
    !w.is_contractor && (w.role === 'owner' || w.role === 'admin' || w.can_create_requests === true)).length === 1;
}