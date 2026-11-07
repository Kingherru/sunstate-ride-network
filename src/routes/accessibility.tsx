import { createFileRoute, redirect } from "@tanstack/react-router";
import { LegalPage } from "@/components/public/LegalPage";
import { pageHead } from "@/components/public/page-kit";
import { PUBLIC_EMAIL } from "@/lib/site-config";

const DESC = "My Florida NEMT’s commitment to an accessible website, the WCAG 2.2 AA target we design toward and how to report an accessibility problem.";

export const Route = createFileRoute("/accessibility")({
  head: () => pageHead("/accessibility", "Accessibility Statement | My Florida NEMT", DESC, "Accessibility Statement"),
  beforeLoad:()=>{throw redirect({to:'/policies',hash:'accessibility',statusCode:301});},
});
