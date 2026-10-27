import { defineTool } from "@lovable.dev/mcp-js";
import { CONTACT_INFO } from "@/lib/contact-info";

export default defineTool({
  name: "get_contact_info",
  title: "Get MY FLORIDA NEMT contact info",
  description: "Return public contact details (phone, email, service region) for MY FLORIDA NEMT.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: () => ({
    content: [{ type: "text", text: `${CONTACT_INFO.name} — non-emergency medical transportation across Florida. Phone: ${CONTACT_INFO.phone || "not listed"}. Email: ${CONTACT_INFO.email}.` }],
    structuredContent: { ...CONTACT_INFO },
  }),
});
