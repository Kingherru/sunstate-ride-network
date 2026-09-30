# Architecture decisions

- MCP server is disabled (no /mcp, /.mcp/*, /.well-known/oauth-protected-resource, /.lovable/oauth/consent routes; no @lovable.dev/mcp-js). Why: not needed now; rebuild later from the archived copy (Files → mcp-archive), reusing `src/lib/cities.ts` and `src/lib/contact-info.ts`.
