import { createFileRoute, redirect } from "@tanstack/react-router";
import { LegalPage } from "@/components/public/LegalPage";
import { pageHead } from "@/components/public/page-kit";
import { PUBLIC_EMAIL } from "@/lib/site-config";

const DESC = "How My Florida NEMT collects, uses and shares information when you request trips, join the provider network, buy training or use the website.";

export const Route = createFileRoute("/privacy")({
  head: () => pageHead("/privacy", "Privacy Policy | My Florida NEMT", DESC, "Privacy Policy"),
  beforeLoad:()=>{throw redirect({to:'/policies',hash:'privacy',statusCode:301});},
});
