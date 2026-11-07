export const STARTUP_GUIDE = {
 slug:'nemt-startup-guide', title:'How to Start an NEMT Business in 30 Days or Less', priceCents:5000,
 priceKey:'nemt_startup_guide_50', bucket:'paid-resources', path:'guides/MY-FLORIDA-NEMT-30-Day-Startup-Guide.pdf',
 summary:'A simplified, 10-page educational guide to business setup, insurance, vehicles, drivers, pricing and a practical 30-day foundation plan.',
 disclaimer:'Educational information only—not a certification or legal, insurance, tax, licensing, Medicaid-enrollment or broker approval. Required approvals may take longer than 30 days. Confirm requirements before operating.',
} as const;
export function verifiedGuidePurchase(p:{ownerId:string;userId:string;complete:boolean;paid:boolean;environment:string;priceMatches:boolean;refunded:boolean}){
 return p.ownerId===p.userId&&p.complete&&p.paid&&p.environment==='live'&&p.priceMatches&&!p.refunded;
}