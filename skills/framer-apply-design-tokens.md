---
name: framer-apply-design-tokens
description: Translate a design token system into Framer — either by pulling variables from a Figma file (via the Figma MCP) or by inferring tokens from a reference screenshot. Produces a clean palette and typographic scale in the target Framer project, bound to consistent naming conventions, ready for `inlineTextStyle` / `backgroundColor` references.
---

# Framer: Apply Design Tokens

Use this skill when the user asks to:

- Bring a Figma file's variables (colors / typography) into a Framer project.
- Set up the design token foundation for a new Framer template based on a reference image.
- Reconcile a Framer project's existing tokens with a source of truth (Figma, brand guide).
- Refactor a Framer site that uses literal colors and font sizes into a token-driven one.

## Two intake paths

### Path A — Figma → Framer

Use when the user has a Figma file with structured variables (the modern Figma "Variables" panel, not just paint styles).

1. **Acquire the source.**
   - `mcp__Figma__get_variable_defs` — returns the variable collections, modes (light / dark), and per-variable values for the currently selected node or file.
   - `mcp__Figma__get_metadata` — useful when the user does not have a selection and you need to discover what is in the file.
2. **Normalise the variable tree.**
   - Figma typically nests variables as `colors/brand/primary`, `colors/semantic/success`, `typography/heading/lg`, etc.
   - Keep the same folder structure when you re-create the tokens in Framer — `/` separates folders in both Framer's `name` field on `fd_create_color_style` / `fd_create_text_style` and the resulting `path` attribute.
3. **Handle modes correctly.**
   - Each Figma color variable usually has a `Light` and `Dark` mode. Map them onto the `light` and `dark` arguments of `fd_create_color_style` (one Framer token = both modes in one call).
   - Typography variables in Figma often hold `fontFamily`, `fontWeight`, `fontSize`, `lineHeight`, `letterSpacing` per type level. Map them onto `fd_create_text_style` arguments.

### Path B — Screenshot → Framer

Use when there is no machine-readable source — only an image, a brand book PDF, or the user pointing at a website.

1. **Inspect the reference visually.** Identify:
   - Base surfaces (light / dark sections), the dominant neutral, and the accent color(s).
   - The contrast ratios — usually one strong accent, supporting muted variants of black / white at 50%–10% opacity.
   - The type scale — count distinct sizes (often 5–7: hero display, big numeral, section heading, body quote, body, body muted, label).
   - The visual rhythm — whether headings use the same typeface as body or a paired display face.
2. **Derive token values.**
   - Convert observed RGB / hex to exact `#rrggbb` literals. Where transparency is obvious (muted text, subtle borders), use `rgba(...)`.
   - For typography, round font sizes to the nearest sensible multiple (12, 14, 16, 24, 36, 56, 96, 180...). Do not invent sub-pixel sizes from a screenshot.
3. **Document assumptions.** Because this path is interpretive, surface back to the user what you inferred (e.g. "I'm calling the accent `Accent/Highlight` and reading it as `#FF4E2C`, please confirm") before bulk-creating.

## Audit before you create

Always start with:

- `fd_list_color_styles` and `fd_list_text_styles` against the target project.

For each source token, decide:

- **Reuse** — an existing Framer token already covers it. Note the existing name and skip creation.
- **Update** — the name matches but values drifted. Use `fd_update_color_style` / `fd_update_text_style`.
- **Create** — no equivalent exists. Use `fd_create_color_style` / `fd_create_text_style`.
- **Park** — the source token isn't actually used anywhere on the canvas. Defer until needed.

Do not silently shadow existing tokens by creating a near-duplicate. That fragments the system.

## Naming conventions

Apply consistently across both intake paths:

- **Folder-nested paths.** Use `/` to group: `Brand/Primary`, `Brand/Surface`, `Text/Light`, `Text/Muted`, `Border/Subtle`, `Display/Hero`, `Display/Number`, `Body/Quote`, `Label/Marker`.
- **Tier first, role second.** `Brand/Primary` not `Primary/Brand`. Tiers: `Brand`, `Surface`, `Text`, `Border`, `Accent`, `Semantic` (Success / Warning / Error), `Display`, `Heading`, `Body`, `Label`.
- **Light / Dark pairs in one token.** Pass both `light` and `dark` to `fd_create_color_style`. Do not split into `Brand/Primary/Light` and `Brand/Primary/Dark`.
- **Type scale.** Use intent names (`Display/Hero`, `Heading/Section`, `Body/Quote`, `Body/Light`, `Body/Muted`, `Label/Marker`) not size names (`H1`, `XL`, `XXL`). Intent survives a redesign; size names do not.
- **Tabular numerics belong on `Label`** styles intended for indexes, prices, anything that aligns vertically.

## Batch creation loop

Once the plan is locked, create in this order:

1. **Color tokens first.** Text styles can reference them by name (`color: "Text/Light"`), so colors need to exist first.
2. **Text styles second.** Each `fd_create_text_style` call accepts `color` as either a `#hex` / `rgba(...)` literal or the name of an existing color token. Prefer the token name — it preserves the link.
3. **Verify after each batch** with `fd_list_color_styles` / `fd_list_text_styles`. Confirm the count matches what you intended to create.

For 5–20 tokens, a sequential script is fine. For larger imports (50+), batch into smaller scripts and verify between batches; a single failure in the middle is easier to investigate without unwinding the whole batch.

## Apply the tokens after creating them

Tokens have no value until things are bound to them. Right after creation, walk the relevant pages with `fd_inspect_node` and bind:

- Text nodes → `fd_set_node_attributes { inlineTextStyle: "Display/Hero" }`.
- Frame backgrounds → `fd_set_node_attributes { backgroundColor: "Brand/Surface" }`.

If you skip this step the user sees no visual change after a "successful" token import and assumes the import failed.

## Pitfalls and recovery

| Symptom | Cause | Recovery |
|---|---|---|
| Tokens created with values like `rgba(NaN, NaN, NaN, 1)` | Malformed hex (e.g. `#xyz` slipped past validation) | `fd_remove_color_style` to delete, re-run with a valid value. |
| Did-you-mean on a token lookup right after creating it | Leading-slash mismatch between user input and stored path | The lookup normalizer strips leading slashes; if it still misses, run `fd_status` to refresh the cache. |
| Two Framer tokens with the same name | A previous run already imported them; subsequent runs created near-duplicates | Pick the canonical one, `fd_remove_color_style` the duplicate, and re-bind any nodes that pointed at the dropped name. |
| Text bound to a token still looks wrong after update | Cascade did happen but the canvas browser is showing a cached preview | Hard-refresh the Framer browser tab. The API state is correct. |
| Figma variable values come back as objects, not strings | Some Figma variables resolve to references to other variables | Resolve recursively via `mcp__Figma__get_variable_defs` until you reach a literal value before passing to Framer. |

## Verification checklist

Before declaring a tokens pass complete:

- [ ] `fd_list_color_styles` returns every color token from the source.
- [ ] `fd_list_text_styles` returns every text style from the source.
- [ ] Every color token with a dark variant in the source also has a `dark` value in Framer (not just `light`).
- [ ] Every text style binds to a color token name (not a literal), unless the source was a screenshot and the user explicitly approved the literal.
- [ ] At least one visible element on a representative page is bound to each newly created token. Tokens with zero references are flagged.
- [ ] `fd_screenshot` of the representative page at `scale: 0.5` shows the expected color and typographic hierarchy.

## Worth noting

- The Framer Server API does not currently expose token renaming. If a token's name was wrong, the safest fix is `fd_remove_*_style` + `fd_create_*_style` + rebind every node that pointed at the old name. Renaming is "deferred" for a reason.
- The Figma MCP returns variables relative to the **current selection** when nothing is selected — verify the source scope with `mcp__Figma__get_metadata` first, especially in large multi-page files.
- Custom (uploaded) fonts are not visible to `framer.getFonts()`. If the source uses a custom face, you can still create a text style without binding `fontFamily`, and bind it manually in Framer Studio later.
