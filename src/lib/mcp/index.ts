import { defineMcp } from "@lovable.dev/mcp-js";
import listServiceAreasTool from "./tools/list-service-areas";
import getContactInfoTool from "./tools/get-contact-info";

export default defineMcp({
  name: "floridanemt-mcp",
  title: "My Florida NEMT MCP",
  version: "0.1.0",
  instructions:
    "Tools for My Florida NEMT — a Florida-wide non-emergency medical transportation network. Use `list_service_areas` to see supported cities and `get_contact_info` for booking contact details.",
  tools: [listServiceAreasTool, getContactInfoTool],
});
