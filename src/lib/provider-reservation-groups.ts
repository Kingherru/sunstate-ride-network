export type ReservationCategory='owned'|'sent'|'received';
export type ReservationSource={id:string;network_distribution_id?:string|null;network_provider_workspace_id?:string|null;source_workspace_id?:string|null;referral_target_id?:string|null;referral_status?:string|null;requester_user_id?:string|null;created_by?:string|null};
export function reservationCategory(row:ReservationSource,workspaceId:string,userId:string):ReservationCategory {
  if(row.source_workspace_id===workspaceId && (row.network_distribution_id||row.referral_target_id))return 'sent';
  if(row.network_provider_workspace_id===workspaceId || row.referral_target_id===userId)return 'received';
  if((row.requester_user_id??row.created_by)===userId && (row.network_distribution_id||row.referral_target_id))return 'sent';
  return 'owned';
}
export function groupReservations<T extends ReservationSource>(rows:readonly T[],workspaceId:string,userId:string) {
  const groups:{owned:T[];sent:T[];received:T[]}={owned:[],sent:[],received:[]};
  const seen=new Set<string>();
  for(const row of rows){if(seen.has(row.id))continue;seen.add(row.id);groups[reservationCategory(row,workspaceId,userId)].push(row);}
  return groups;
}