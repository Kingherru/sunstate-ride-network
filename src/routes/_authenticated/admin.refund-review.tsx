import { createFileRoute, redirect } from '@tanstack/react-router';
export const Route = createFileRoute('/_authenticated/admin/refund-review')({
 beforeLoad:()=>{throw redirect({to:'/admin/payouts',replace:true});},
 head:()=>({meta:[{title:'Refunds — MY FLORIDA NEMT'},{name:'description',content:'Refund evidence is reviewed within Payouts.'},{property:'og:title',content:'Refunds — MY FLORIDA NEMT'},{property:'og:description',content:'Restricted refund review within Payouts.'},{property:'og:type',content:'website'},{name:'twitter:card',content:'summary'},{name:'robots',content:'noindex,nofollow'}]})
});
