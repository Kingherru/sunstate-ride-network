import { defineTool } from "@lovable.dev/mcp-js";

export default defineTool({
  name: "get_contact_info",
  title: "Get MyFloridaNemt.com contact info",
  description: "Return public contact details (phone, email, service region) for MyFloridaNemt.com.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: () => ({
    content: [
      {
        type: "text",
        text: "MyFloridaNemt.com — Statewide non-emergency medical transportation across Florida. Phone: +1-800-555-0199. Email: myfloridanemt@gmail.com.",
      },
    ],
    structuredContent: {
      name: "MyFloridaNemt.com",
      phone: "+1-800-555-0199",
      email: "myfloridanemt@gmail.com",
      areaServed: "Florida, US",
    },
  }),
});
