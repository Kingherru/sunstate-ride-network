import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listServiceAreasTool from "./tools/list-service-areas";
import getContactInfoTool from "./tools/get-contact-info";

// Issuer must be the direct auth host (not the proxy). Vite inlines the ref at build time.
const projectRef = import.meta.env["VITE_SUPABASE_PROJECT_ID"] ?? "project-ref-unset";

export default defineMcp({
  name: "my-florida-nemt",
  title: "MY Florida NEMT",
  version: "0.2.0",
  instructions:
    "Tools for MY FLORIDA NEMT, a Florida non-emergency medical transportation network. Use `list_service_areas` for supported cities and `get_contact_info` for public contact details.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
    requireOAuthClientClaim: true,
  }),
  tools: [listServiceAreasTool, getContactInfoTool],
});
