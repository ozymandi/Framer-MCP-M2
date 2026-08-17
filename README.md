# Framer MCP — M2 (design)

Sibling MCP server to [Framer-MCP (M1)](https://github.com/ozymandi/Framer-MCP).

- **M1** = Framer **CMS**: collections, items, assets, schema, publish.
- **M2** = Framer **design**: pages, nodes, components, design tokens,
  screenshots, exports.

Both servers run in parallel — install M1 as the `framer_*` tool set and
M2 as the `fd_*` tool set in the same LM Studio / Claude Desktop config.

M2 itself never calls an LLM. The connected client model is the
generator; this server is the inspector and (since Phase 2) the
design-token writer.

---

## What it does

**Phase 1 — read-only (10 tools).** Visual eyes for the model: list
projects and pages, inspect any node's tree, render a page or node as
a PNG (multimodal-friendly), export an SVG, enumerate color and text
styles, components, and the fonts actually used by the project.

**Phase 2 — token writes (6 tools).** Create, update, and remove
color tokens and text styles — the project's design system tokens.
Hex / rgb / rgba inputs are normalized; friendly `{ fontFamily,
fontWeight, fontStyle }` triples are resolved to Framer's `Font`
objects.

**Phase 3 — page + node CRUD (7 tools).** Create web and design
pages, add frames and text nodes under any parent, set arbitrary
node attributes, remove nodes, duplicate nodes. Frame attributes
are tiered: the typed surface (name, size, padding, gap, layout,
border radius, background, opacity, rotation, visible) is friendly
and forgiving; everything else reaches the node through a generic
`fd_set_node_attributes` for capable models.

**Phase 4 — agent API (11 tools, framer-api 0.1.29).** Low-level DSL
editing of any page (open or not) via `fd_apply_changes`, a two-step
publish flow (`fd_publish` preview → confirm → deploy-to-production),
deployment history, project branches (list/create/switch/merge/delete —
needs a paid Framer plan), read-only ClickHouse analytics queries, the
full component catalog (canvas + code + external), and icon sets.

Not yet (planned):

- High-level patterns (`fd_add_hero`, `fd_add_pricing_table`).
- Framer SupervisorAgent bridge.
- Component instance creation (needs a Framer module URL rather than
  a friendly component name).

---

## Quick start

```cmd
git clone https://github.com/ozymandi/Framer-MCP-M2.git
cd Framer-MCP-M2
setup.bat
```

`setup.bat` runs `npm install` + `npm run build`. Requires Node 22+.

Configuration mirrors M1. Single-project via `.env`:

```env
FRAMER_API_KEY=fr_...
FRAMER_PROJECT_URL=https://framer.com/projects/My-Project--xxxxx
MCP_AUTH_TOKEN=any-random-string   # HTTP transport only
```

Multi-project via `projects.json` (gitignored):

```json
[
  { "alias": "portfolio", "url": "https://framer.com/projects/...", "apiKey": "fr_..." },
  { "alias": "blog",      "url": "https://framer.com/projects/...", "apiKey": "fr_..." }
]
```

and in `.env`: `FRAMER_PROJECTS_FILE=./projects.json`.

Default HTTP port is **3001** (so M2 can run alongside M1 on 3000).

---

## LM Studio (or any MCP client)

Add a `framer-design` entry next to your existing servers in `mcp.json`:

```json
{
  "mcpServers": {
    "framer": {
      "command": "node",
      "args": ["E:/Projects/framer mcp/dist/server.js"],
      "env": {
        "MCP_TRANSPORT": "stdio",
        "FRAMER_PROJECTS_FILE": "E:/Projects/framer mcp/projects.json"
      }
    },
    "framer-design": {
      "command": "node",
      "args": ["E:/Projects/framer mcp m2/dist/server.js"],
      "env": {
        "MCP_TRANSPORT": "stdio",
        "FRAMER_PROJECTS_FILE": "E:/Projects/framer mcp m2/projects.json"
      }
    }
  }
}
```

Restart the host. The model sees both tool sets in parallel — `framer_*`
(15–22) for CMS and `fd_*` (23) for design.

> For `fd_screenshot` to be useful, the connected model must be
> multimodal. Claude (Desktop) is. Gemma 4 is. Older non-vision local
> models will receive the image content but won't be able to interpret it.

---

## Tools

### Phase 1 — read (10)

| Tool | Purpose |
|------|---------|
| `fd_list_projects` | Configured aliases + project mode. |
| `fd_status` | Project name, web + design page count, component count. |
| `fd_list_pages` | Web pages by `path`, design pages by `name`, child counts. |
| `fd_inspect_node` | Depth-limited tree walk; reveals types, names, text. |
| `fd_screenshot` | PNG / JPEG render of a page or node (MCP image content). |
| `fd_export_svg` | Vector export of a node. |
| `fd_list_color_styles` | Color tokens with light / dark, RGBA values. |
| `fd_list_text_styles` | Typography tokens with tag and font family / weight. |
| `fd_list_components` | Components and their variant counts. |
| `fd_list_fonts` | Fonts referenced by text styles (or the full catalog with `includeAll:true`). |

### Phase 2 — token writes (6)

| Tool | Purpose |
|------|---------|
| `fd_create_color_style` | `{ name, light, dark? }` — hex / rgb / rgba accepted. |
| `fd_update_color_style` | Patch light / dark on an existing token. |
| `fd_remove_color_style` | Delete a color token. |
| `fd_create_text_style` | `{ name, tag?, fontFamily?, fontWeight?, fontStyle?, fontSize?, lineHeight?, letterSpacing? }`. |
| `fd_update_text_style` | Partial update of any of the above. |
| `fd_remove_text_style` | Delete a text style token. |

Color inputs accepted: `#rgb`, `#rrggbb`, `#rrggbbaa`, `rgb(...)`,
`rgba(...)` — server normalises to Framer's `rgba(R, G, B, A)`.

Style lookups in update / remove are tolerant of case and separators:
`"H1"`, `"h1"`, `"h 1"`, `"Headers/H1"` all resolve to the same style.

### Phase 3 — page + node CRUD (7)

| Tool | Purpose |
|------|---------|
| `fd_create_web_page` | New web page at the given path (e.g. `/about`). |
| `fd_create_design_page` | New design page (free-form canvas). |
| `fd_add_frame` | Container under a parent, with tiered typed attributes. |
| `fd_add_text` | Text node under a parent, with optional textStyle binding. |
| `fd_set_node_attributes` | Generic raw `setAttributes` for any node — covers Tier 2/3. |
| `fd_remove_node` | Destructive delete (cascades to children). |
| `fd_duplicate_node` | Clone a node next to it in the tree. |

Frame attribute inputs are friendly:

- `width` / `height`: number → `"Npx"`; strings (`"100%"`, `"1fr"`,
  `"fit-content"`) pass through.
- `padding`: single value, or `{ top, right, bottom, left }`, or
  `{ vertical, horizontal }`.
- `borderRadius`: single value, or per-corner object.
- `gap`: single value, or `{ row, column }`.
- `layout`: `"none" | "stack" | "grid"`, or wrapped `{ type }`.
- `backgroundColor`: `#hex` / `rgb(...)` / `rgba(...)` OR the name of an
  existing color style (server resolves and binds it).

`parent` accepts a node id, a web page path, or a design page name —
same resolution as Phase 1 inspect / screenshot tools.

Raw node ids of nodes nested inside web pages resolve everywhere
(`framer.getNode` misses those; the server falls back to typed
project-wide queries plus a tree walk). When a node's page is not open
in any editor, `fd_set_node_attributes` transparently writes through
the agent DSL instead of SDK `setAttributes`.

### Phase 4 — agent API (11)

| Tool | Purpose |
|------|---------|
| `fd_apply_changes` | Agent DSL (`SET`/`DEL`/`MOVE`/`DUPE`/`+Node`) against any page. CMS detail pages use `:CollectionName` (e.g. `/news/:News`). |
| `fd_publish` | `preview` (diagnostics + confirmationHash, no publish) → `confirm_publish` → `deploy_to_production`. |
| `fd_list_deployments` | Recent deployments, newest first. |
| `fd_query_analytics` | Read-only ClickHouse SQL over `events_v2` etc.; `guide=true` returns the schema doc. |
| `fd_component_catalog` | Full component catalog (canvas/code/external/insertable); with `componentIds` returns control definitions. |
| `fd_list_icon_sets` | Icon set names; with `setName` returns that set's icon names for `+IconNode` inserts. |
| `fd_list_branches` | Branches + the active one. |
| `fd_create_branch` | Create from the active branch and switch to it. *(paid plan)* |
| `fd_switch_branch` | Switch the active branch (`main` for main). *(paid plan)* |
| `fd_merge_branch` | Merge active branch into its base/target. *(paid plan)* |
| `fd_delete_branch` | Delete a branch. *(paid plan)* |

---

## Configuration reference

| Env var                | Required        | Description                                              |
|------------------------|-----------------|----------------------------------------------------------|
| `FRAMER_API_KEY`       | single mode     | Framer API key, bound to one project.                    |
| `FRAMER_PROJECT_URL`   | single mode     | Full project URL.                                        |
| `FRAMER_PROJECTS_FILE` | multi mode      | Path to a JSON array of `{ alias, url, apiKey }`.        |
| `MCP_TRANSPORT`        | no (`http`)     | `http` or `stdio`.                                       |
| `MCP_AUTH_TOKEN`       | HTTP transport  | Bearer token clients must pass.                          |
| `MCP_PORT`             | no (`3001`)     | HTTP listen port.                                        |

---

## Architecture

```
LLM client (LM Studio, Claude Desktop, ...)
        │  JSON-RPC over stdio or HTTP
        ▼
  Framer-MCP-M2 server
        │  framer-api SDK
        ▼
   Framer Server API
        │
        ▼
   Framer project (canvas, tokens, fonts)
```

Modules under `src/`:

- `server.ts` — HTTP (Fastify) and stdio entry points.
- `config.ts` — env + `projects.json` loader (same shape as M1).
- `framer-client.ts` — pool of `alias → Framer` SDK connections.
- `helpers.ts` — `resolveProject`, `resolveNodeTarget`, tolerant
  `suggestName` (Levenshtein), `ProjectContext`.
- `color-parser.ts` — hex / rgb / rgba → Framer's RGBA.
- `font-resolver.ts` — `{ family, weight?, style? }` → SDK `Font`.
- `style-lookup.ts` — find a color or text style by name with
  normalize-tolerance.
- `attr-builder.ts` — friendly frame / text attribute inputs to SDK
  shapes (length / padding / radius normalization, color style binding,
  layout discriminator).
- `tools/` — one file per MCP tool; `index.ts` registers them.

---

## Known limitations

- Framer Server API is in open beta; the `framer-api` SDK can change.
- One API key = one project. Multi-project mode just holds more keys.
- `fd_screenshot` is only useful with multimodal clients.
- Text styles created here intentionally have no color binding (Phase 2
  scope). Bind in the canvas or wait for a later phase.
- Renaming styles is not exposed — it can silently break references.
- Custom (uploaded) fonts are not visible to the SDK; only Framer's
  built-in catalog (`getFonts()`) is.
- Component instance creation requires a Framer component module URL
  rather than a friendly component name — deferred to a later phase.
- Reparenting a node (moving it under a different parent) is not yet
  surfaced; for now duplicate + remove + recreate at the new parent.

---

## License

No license file yet. If you fork, add one. The author intends this to
be permissive — MIT or Apache 2.0 are fine.

---

## Links

- Sibling repo (CMS): <https://github.com/ozymandi/Framer-MCP>
- Framer Server API: <https://www.framer.com/developers/server-api-introduction>
- Model Context Protocol: <https://modelcontextprotocol.io/docs/getting-started/intro>
- This repo: <https://github.com/ozymandi/Framer-MCP-M2>
