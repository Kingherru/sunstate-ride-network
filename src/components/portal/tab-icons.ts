import { Bell, Building2, CalendarDays, Car, CheckCheck, CircleDollarSign, ClipboardList, FileClock, FileText, History, Inbox, KeyRound, MapPin, MessageSquare, Monitor, Network, Search, Settings, ShieldCheck, Star, Truck, UserRound, Users, Wallet } from 'lucide-react';
export function tabIcon(label: string) {
  if (/security|credential|verification|administrator/i.test(label)) return ShieldCheck;
  if (/password|sign.in/i.test(label)) return KeyRound;
  if (/session|interface/i.test(label)) return Monitor;
  if (/notification|unread/i.test(label)) return Bell;
  if (/saved|favorite/i.test(label)) return Star;
  if (/director|find|area|pricing/i.test(label)) return MapPin;
  if (/message|conversation|communication/i.test(label)) return MessageSquare;
  if (/business|account/i.test(label)) return Building2;
  if (/patient|people|contact|team|driver/i.test(label)) return Users;
  if (/profile/i.test(label)) return UserRound;
  if (/draft/i.test(label)) return FileClock;
  if (/history|paid/i.test(label)) return History;
  if (/reservation|schedule|day|week|month/i.test(label)) return CalendarDays;
  if (/vehicle|fleet/i.test(label)) return Truck;
  if (/trip/i.test(label)) return Car;
  if (/settlement|payout|balance|payer|billing/i.test(label)) return Wallet;
  if (/refund|earning|payment/i.test(label)) return CircleDollarSign;
  if (/network|connection|negotiation|active/i.test(label)) return Network;
  if (/offer|held|pending/i.test(label)) return Inbox;
  if (/read|approved|available/i.test(label)) return CheckCheck;
  if (/request/i.test(label)) return ClipboardList;
  if (/search/i.test(label)) return Search;
  if (/overview|all/i.test(label)) return FileText;
  return Settings;
}