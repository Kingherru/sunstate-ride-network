import { defineTool } from "@lovable.dev/mcp-js";

export default defineTool({
  name: "get_contact_info",
  title: "Get My Florida NEMT contact info",
  description: "Return public contact details (phone, email, service region) for My Florida NEMT.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: () => ({
    content: [
      {
        type: "text",
        text: "My Florida NEMT — Statewide non-emergency medical transportation across Florida. Phone: +1-800-555-0199. Email: myfloridanemt@gmail.com.",
      },
    ],
    structuredContent: {
      name: "My Florida NEMT",
      phone: "+1-800-555-0199",
      email: "myfloridanemt@gmail.com",
      areaServed: "Florida, US",
    },
  }),
});
