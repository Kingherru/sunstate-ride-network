import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { CITY_LIST } from "@/lib/cities";

export default defineTool({
  name: "list_service_areas",
  title: "List Florida service areas",
  description: "Return the list of Florida cities/regions where MyFloridaNemt.com provides non-emergency medical transportation.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: () => ({
    content: [{ type: "text", text: JSON.stringify(CITY_LIST) }],
    structuredContent: { cities: CITY_LIST },
  }),
});
