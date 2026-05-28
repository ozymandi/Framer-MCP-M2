# framer-mcp-m2 — Task

## Goal

A second MCP server, sibling to Framer-MCP (M1). M1 covers Framer CMS:
collections, items, assets, schema, publish. M2 covers **design** —
pages, nodes, components, design tokens, screenshots, exports.

Both servers can be installed side by side in the same LM Studio /
Claude Desktop config. M1 tools are prefixed `framer_`; M2 tools are
prefixed `fd_`.

The MCP itself never calls an LLM. The connected client model is the
generator; this server is the writer / inspector.

## Scope — v0.2 (Phase 2 adds token writes)

On top of Phase 1's read tools, six write tools for design-token
maintenance:

- `fd_create_color_style` — `{ name, light, dark? }`. Accepts hex
  (#rgb, #rrggbb, #rrggbbaa), rgb(...), rgba(...). Server normalises
  to Framer's rgba(R, G, B, A).
- `fd_update_color_style` — partial update by name.
- `fd_remove_color_style` — delete by name.
- `fd_create_text_style` — `{ name, tag?, fontFamily?, fontWeight?,
  fontStyle?, fontSize?, lineHeight?, letterSpacing? }`. The
  fontFamily / weight / style trio is resolved to a Framer Font via
  the SDK; unknown families error with a Did-you-mean.
- `fd_update_text_style` — partial update by name.
- `fd_remove_text_style` — delete by name.

Out of scope for Phase 2:
- Binding a color to a text style.
- Text style responsive breakpoints.
- Renaming styles via setAttributes (risk: breaks references).

## Scope — v0.1 (Phase 1, read-only)

Visual eyes for the model. Zero risk of breaking the design, easy to
verify, immediately useful for chat-as-design-reviewer flows.

- `fd_list_projects` — configured aliases + mode.
- `fd_status` — project name, page count, last deploy.
- `fd_list_pages` — all Web + Design pages with type and
  child counts.
- `fd_inspect_node` — tree of a page or node, truncated for
  size; reveals types, names, text content, ids.
- `fd_screenshot` — render a page or node to PNG image
  content; useful for multimodal clients.
- `fd_export_svg` — vector export of a node.
- `fd_list_color_styles` — color tokens.
- `fd_list_text_styles` — typography tokens.
- `fd_list_components` — components + variants.
- `fd_list_fonts` — fonts in use.

## Out of scope — v0.1

- Creating or editing pages, nodes, components.
- Editing color / text styles.
- High-level pattern tools (`add_hero`, etc.).
- The Framer SupervisorAgent bridge.

These are slated for later phases once read tooling is proven.

## Foundation reused from M1

- Same HTTP + stdio transport pattern.
- Same single + multi-project config (FRAMER_API_KEY / FRAMER_PROJECTS_FILE).
- Same Bearer auth on HTTP.
- Same conventions: hide ids where slugs/names suffice, tolerate spacing
  in keys (normalize), Did-you-mean suggestions in errors.

## Key references

- Framer Server API intro: <https://www.framer.com/developers/server-api-introduction>
- Reference: <https://www.framer.com/developers/server-api-reference>
- Sibling repo (CMS): <https://github.com/ozymandi/Framer-MCP>
