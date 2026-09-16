# framer-mcp-m2 — Task

## Goal

A second MCP server, sibling to Framer-MCP (M1). M1 covers Framer CMS:
collections, items, assets, schema, publish. M2 covers **design** —
pages, nodes, components, design tokens, screenshots, exports, and
the Framer agent API (DSL edits, publish, branches, analytics).

Both servers can be installed side by side in the same LM Studio /
Claude Desktop config. M1 tools are prefixed `framer_`; M2 tools are
prefixed `fd_`.

The MCP itself never calls an LLM. The connected client model is the
generator; this server is the writer / inspector.

## Status (2026-09-16)

- Phases 1–4 shipped: 34 tools. See README for the full catalogue.
- SDK: `framer-api@5.0.0` (bumped from 0.1.29 on 2026-09-16). All
  design methods M2 uses kept identical signatures; the major bump is
  CMS arrays / automations (M1 territory).
- `fd_list_icon_sets` fixed: the Framer server validates icon lookups by
  `iconSetId` (accepts id or displayName). Name-based calls fail on
  every SDK version, so the tool now sends `iconSetId`; `setId` is the
  parameter, `setName` stays as a deprecated alias.
- Catalog tools (`fd_list_icon_sets`, `fd_component_catalog`) return
  `{ id, displayName }` entries; descriptions tell the model to use ids.
- Verified read-only on s4lab via stdio: status, icon sets (list / by id
  / by name / unknown), component catalog + controls, branches.

## Next step

- None scheduled. Candidates: `fd_add_component_instance` (needs module
  URL), high-level pattern tools, SupervisorAgent bridge.
- When bumping the SDK again, re-run the live smoke test rather than
  trusting `index.d.ts` — server validation is ahead of stable typings
  (5.0.1-alpha.x already types `iconSetId(s)`).

## Open questions

- None for the client.
- Housekeeping (designer's call): `find-dl.mjs` in the repo root is
  untracked and contains a plaintext API key — delete or gitignore.

## Phase history

- **Phase 1 (v0.1)** — read-only: projects, status, pages, inspect node,
  screenshot, SVG export, color/text styles, components, fonts.
- **Phase 2 (v0.2)** — token writes: create/update/remove color and text
  styles (hex/rgb parsing, font resolution with Did-you-mean).
- **Phase 3** — page + node CRUD: web/design pages, frames, text nodes,
  generic attributes, remove, duplicate.
- **Phase 4** — agent API: `fd_apply_changes` DSL, two-step publish,
  deployments, branches (paid plan), analytics SQL, component catalog,
  icon sets.

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
