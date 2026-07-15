import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listServiceAreasTool from "./tools/list-service-areas";
import getContactInfoTool from "./tools/get-contact-info";

// OAuth issuer MUST be the direct Supabase host, not the .lovable.cloud proxy
// (mcp-js rejects RFC 8414 issuer mismatches). VITE_SUPABASE_PROJECT_ID is
// inlined by Vite at build time; the fallback only keeps the URL well-formed
// during the throwaway manifest-extract eval.
const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "floridanemt-mcp",
  title: "My Florida NEMT MCP",
  version: "0.1.0",
  instructions:
    "Tools for My Florida NEMT — a Florida-wide non-emergency medical transportation network. Use `list_service_areas` to see supported cities and `get_contact_info` for booking contact details.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [listServiceAreasTool, getContactInfoTool],
});

