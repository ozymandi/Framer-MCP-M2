---
name: framer-build-page
description: Build or modify a page in a Framer project via the framer_* (CMS) and fd_* (design) MCP tool sets. Encodes the structural rules of Framer Studio and the verification habits that prevent the typical "looks correct in the API, broken on the canvas" failure mode.
---

# Framer: Build a Page

Use this skill whenever the user asks to:

- Create a new page (web or design) in their Framer project.
- Lay out a section, hero, footer, or any frame composition on an existing page.
- Apply design tokens (colors, text styles) to an existing layout.
- Replicate the structure of a reference design into Framer.

## Core principles

### 1. Desktop is the top level — write INSIDE it, never beside it

A Framer web page has a built-in breakpoint frame named `Desktop` (and possibly `Tablet`, `Phone`). That frame **is** the canvas at that viewport. Sections, hero, content — all of it lives as children of `Desktop`, not as siblings.

> **Wrong:** `fd_add_frame` with `parent: "/my-page"`.
> **Right:** find the `Desktop` child of `/my-page`, then `fd_add_frame` with `parent: <Desktop id>`.

### 2. Inner pages do not get their own nav or footer

The project template already supplies a header and footer. Adding another nav on an inner page produces two stacked navs on the live site. Only add nav / footer when explicitly scaffolding a brand-new template.

### 3. Stack defaults are not what you expect

Framer's raw default `stackDirection` is `horizontal`. For page sections you nearly always want **vertical**. The `fd_add_frame` helper now defaults to vertical, but always pass `direction` explicitly to make intent obvious in the code:

```js
layout: { type: "stack", direction: "vertical", distribute: "start", align: "start" }
```

For navs / pricing rows / button content, use `direction: "horizontal"` with `distribute: "space-between"` or `"center"`.

### 4. Verify after every meaningful change

After each batch of `fd_add_frame` / `fd_set_node_attributes`, call `fd_inspect_node` on the affected subtree at `depth: 2` or `3`. Confirm:

- The new node is where you intended (right parent).
- Names match what you wrote.
- Critical attributes (size, layout, padding) made the round trip.

It is faster to catch a wrong `stackDirection` immediately than to discover it after building 20 child nodes.

### 5. Bind to tokens; never hardcode visible values

Colors, font sizes, weights → existing `ColorStyle` and `TextStyle` tokens. Use:

- `backgroundColor: "Brand/Primary"` — the server resolves to the token.
- `inlineTextStyle: "Headers/H1"` — binds the text node to a typography token.

If the needed token does not exist, **create the token first** via `fd_create_color_style` / `fd_create_text_style`. Hardcoded literals scatter across the canvas and become impossible to update later.

### 6. Choose realistic sizes

Numeric width / height inputs are interpreted as pixels. For section widths use `"100%"` so they fill the breakpoint. For heights of hero or full-screen sections, prefer `"100vh"` or a numeric value (e.g. `600`). For inner content that should size to its children, use `"fit-content"`.

## Workflow

1. **List pages** (`fd_list_pages`) to confirm the target exists. If creating, `fd_create_web_page` or `fd_create_design_page`.
2. **Inspect the page** (`fd_inspect_node`, depth 1) and capture the `Desktop` breakpoint id. That id is the parent for every top-level section you add.
3. **List tokens** (`fd_list_color_styles`, `fd_list_text_styles`) to know what is available to bind to. If the design requires tokens that do not exist, create them now.
4. **Plan the sections** as a flat list: nav (if scaffolding a template), hero, content blocks, footer (if scaffolding). For an inner page, just the content blocks.
5. **Build top-down.** For each section, `fd_add_frame` under `Desktop` with the right layout / size / background. Capture the new id.
6. **Build children of each section.** Reuse the same pattern — explicit `direction`, explicit `width: "100%"` for full-bleed children, gap and padding from the token scale.
7. **Verify** the subtree with `fd_inspect_node` after each section is complete.
8. **Bind tokens.** Walk the tree, find named text nodes, and `fd_set_node_attributes` to set `inlineTextStyle` to the matching token. Same for `backgroundColor` on frames.
9. **Screenshot** (`fd_screenshot` at a small `scale` like `0.5`) for a final visual sanity check.

## Common pitfalls and recovery

| Symptom | Cause | Recovery |
|---|---|---|
| All text on one row, sections overlap | Sections added beside `Desktop` instead of inside it | Delete the misplaced `Desktop` frame (`fd_remove_node`), rebuild inside the real breakpoint. |
| Children of a stack are horizontal when they should be vertical | `direction` not specified or set to `horizontal` | `fd_set_node_attributes { stackDirection: "vertical" }` on the offending parent. |
| Text invisible on dark section | Default text color is black; section background is dark | Either bind to a token whose `color` is light, or set `color` directly via `fd_set_node_attributes`. |
| Two navs on the live site | An inner page got its own nav frame; the template already supplies one | Remove the duplicated nav frame. |
| Layout collapses to zero width | Child has no `width`, parent has no `layout` to size it | Set explicit `width: "100%"` on the child OR enable a `layout` on the parent. |
| `Did you mean '/Display/Hero'?` on a token lookup | Leading slash mismatch | Lookup tolerance fix is in place; if you still see this, refresh the cache (`fd_status` triggers a refresh). |

## Verification checklist

Before declaring a page done:

- [ ] All section frames are direct children of `Desktop` (the breakpoint), not of the page.
- [ ] Every visible text node is bound to a `TextStyle` token (`inlineTextStyle` set).
- [ ] Every styled background is bound to a `ColorStyle` token or uses a documented literal.
- [ ] No duplicate nav / footer if the project template provides them.
- [ ] `fd_screenshot` at `scale: 0.5` shows the expected hierarchy.
- [ ] `fd_inspect_node` at the page root reads cleanly — section names match the plan, no orphan frames.

## Worth noting

- The Framer Server API is in open beta. Any tool can change shape between SDK releases.
- The `framer-api` SDK and the `framer-plugin` SDK share a large overlap but are not identical. This skill targets the MCP wrappers around the Server API specifically.
- For schema-style writes (CMS collections, items, publish), switch to the `framer_*` tool set (M1).
