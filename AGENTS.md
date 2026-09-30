# Architecture decisions

- MCP server is disabled (no /mcp, /.mcp/*, /.well-known/oauth-protected-resource, /.lovable/oauth/consent routes; no @lovable.dev/mcp-js). Why: not needed now; rebuild later from the archived copy (Files → mcp-archive), reusing `src/lib/cities.ts` and `src/lib/contact-info.ts`.
- Design tokens are scoped under `.theme-public` / `.theme-portal` in `src/styles.css`; new UI uses `src/components/ds/*` + `src/components/brand/*`. Why: keeps the preserved training screens on neutral tokens and lets a future admin theme editor override one central token set.
