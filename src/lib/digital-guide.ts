export const STARTUP_GUIDE = {
 slug:'nemt-startup-guide', title:'HOW TO START AN NEMT BUSINESS: A 30-DAY PLANNING GUIDE', priceCents:5000,
 priceKey:'nemt_startup_guide_50', bucket:'paid-resources', path:'guides/MY-FLORIDA-NEMT-30-Day-Planning-Guide.pdf',
 summary:'Educational business planning guidance with a sample 30-day organizational schedule—not an operating deadline or guarantee.',
 disclaimer:'Educational information only—not certification or legal, insurance, tax, licensing, Medicaid-enrollment or broker approval. The sample schedule does not guarantee completion, approval, launch, customers or revenue within 30 days. Confirm applicable requirements before operating.',
} as const;
export function verifiedGuidePurchase(p:{ownerId:string;userId:string;complete:boolean;paid:boolean;environment:string;priceMatches:boolean;refunded:boolean}){
 return p.ownerId===p.userId&&p.complete&&p.paid&&p.environment==='live'&&p.priceMatches&&!p.refunded;
}