---
name: framer-scaffold-from-blank
description: Scaffold a complete Framer site starting from a blank project — no template, no nav, no footer, no design tokens. Establishes the foundation in the right order (tokens → home page → inner pages) and works around the current SDK gap that prevents creating component instances by name.
---

# Framer: Scaffold from a Blank Document

Use this skill when:

- The user has just created a new Framer project and the only thing on the canvas is a default empty `/` page.
- The user wants to build a multi-page site from scratch (portfolio, SaaS landing, marketing site, internal product page).
- Other Framer skills like `framer-build-page` assume a template-supplied header / footer; this one does the template-establishing work first.

## The right order matters

Order of operations is opinionated and not negotiable:

1. **Decide the design language** before touching the canvas. A blank doc has no defaults to push back; whatever you build first sets the visual tone.
2. **Apply design tokens** (`framer-apply-design-tokens` skill). Colors and text styles are the alphabet — the home page is the first sentence written in that alphabet, not the other way around.
3. **Build the home page** with the navigation and footer baked into it. This is where the template structure is *defined*, not yet shared.
4. **Build each inner page** by duplicating the nav and footer from the home page and replacing only the middle.
5. **Plan a future migration** to component-instance-based shared chrome the moment `fd_add_component_instance` ships in M2.

Do not start by creating five empty pages and then trying to populate them. The shape of the nav and footer is decided on the home page; the inner pages copy it.

## Step 1 — Decide the design language

Before any tool call, surface to the user:

- Reference imagery or a Figma file they want the look to come from.
- Two-tone vs single-tone palette.
- Display typeface preference (typically one serif or one geometric sans for headings; one neutral sans for body — but always ask).
- Approximate type scale levels (usually 5–7).
- Section rhythm: padded editorial (≈ 80–120 px section padding) vs tight modern (≈ 40–64 px).
- Accent color count (one is plenty for most sites).

If the user does not have answers, ask. Scaffolding under wrong assumptions is more expensive than waiting.

## Step 2 — Tokens first

Follow `framer-apply-design-tokens.md` end-to-end before touching pages. At minimum, after this step the project should have:

- **Surfaces:** `Surface/Light`, `Surface/Dark` (or whatever the two-tone choice is).
- **Text:** `Text/Dark` (for light surfaces), `Text/Light` (for dark), `Text/Muted`.
- **Border:** `Border/Subtle` (light variant), `Border/Strong` if there are emphasised dividers.
- **Accent:** at least `Accent/Highlight`.
- **Display / typography scale:** `Display/Hero`, `Display/Number` (optional), `Heading/Section`, `Body/Quote` (optional), `Body/Light` and `Body/Muted`, `Label/Marker` (for `// Intro`-style section labels), `Label/Tabular` (for numeric indexes).

Verify with `fd_list_color_styles` and `fd_list_text_styles` before continuing.

## Step 3 — Build the home page

The home page does double duty: it is both the actual `/` route and the *template* the inner pages will copy from.

1. **Inspect `/`** with `fd_inspect_node` to capture the `Desktop` breakpoint frame's id. Framer creates this automatically when a web page is created.
2. **Add the navigation as a frame, as the first child of `Desktop`.** Horizontal stack, `distribute: "space-between"`, `align: "center"`, padding `{ vertical: 20, horizontal: 32 }`, `width: "100%"`, background bound to `Surface/Light` or transparent. Inside the nav frame:
   - Left: brand text bound to a heading-weight text style (or a placeholder for an SVG mark).
   - Right: a horizontal stack of nav links, each a text node bound to `Body/Light` (or `Body/Dark`, depending on contrast).
3. **Add the hero.** Vertical stack, full-width, opinionated height (e.g. `600` or `"100vh"`). Inside: the display title bound to `Display/Hero`, an optional tagline bound to `Label/Marker`.
4. **Add each content section** following the rhythm picked in Step 1. Always `width: "100%"`, `direction: "vertical"`, generous padding from the token scale.
5. **Add the footer.** Same kind of structure as the nav — horizontal stack, brand on one side, sitemap / socials on the other, padding, background bound to a token.

Verify after each section. See `framer-build-page.md` for the per-section discipline.

The home page now contains the canonical nav frame and footer frame. Capture both of their ids for Step 4.

## Step 4 — Duplicate the chrome onto every other page

This is the workaround until `fd_add_component_instance` is implemented. The shape is:

1. `fd_create_web_page` for the new path (e.g. `/about`).
2. `fd_inspect_node` on the new page to capture its `Desktop` breakpoint id.
3. `fd_duplicate_node` on the home page's nav frame. Then `fd_set_node_attributes` to reparent it under the new `Desktop` (note: reparenting is also not yet exposed — until it is, the cleaner path is to read the nav frame's attributes from the home page and reconstruct it on the new page with the same attribute calls, since the layout is short).
4. Repeat for the footer.
5. Build the page-specific content as middle sections between nav and footer.

**Honest caveat:** there is no way to "edit nav once, propagate everywhere" in the current M2 surface. Every inner page carries its own copy of the nav. When the user updates the home page's nav copy, the inner pages will drift. Flag this risk explicitly and offer to do a project-wide nav refresh on request.

## Step 5 — Plan for component instances

The moment `fd_add_component_instance` lands in M2:

- Convert the home page's nav frame into a Framer component (`createComponentNode`).
- Replace the duplicated nav on every other page with a component instance pointing at that component.
- Same for the footer.

Until then, do not promise the user "central updates" for nav and footer.

## Common patterns the user will ask for

| Site shape | Home page sections | Inner pages |
|---|---|---|
| Solo portfolio | Hero, About / Intro, Work grid, Services list, Contact | Single work detail per `/works/[slug]`, optional About |
| SaaS landing | Hero with product shot, Logo strip, Feature triad, Pricing, FAQ, Footer CTA | Pricing detail, About, Privacy, Terms |
| Agency | Hero, Selected work, Services list, Testimonials, Contact form | Case studies, About, Careers |
| Marketing content site | Hero, Latest articles strip, Featured author, Newsletter | Article template `/blog/[slug]`, Category pages |

These are starting points, not prescriptions. Always confirm shape with the user.

## Pitfalls and recovery

| Symptom | Cause | Recovery |
|---|---|---|
| Inner page renders without nav or footer | Forgot to duplicate the chrome after creating the page | Run the Step 4 procedure for that page. |
| Nav drifts between pages after edits | Each inner page has its own copy; updates only hit the home page | Do a project-wide nav refresh on demand. Long term, migrate to component instances. |
| Default `/` page already has placeholder content from Framer | Framer can seed a blank project with sample content | Remove the auto-created content from `/` (children of its `Desktop`) before starting Step 3. |
| The brand text in the nav looks wrong size everywhere | Brand was bound to a `Heading/*` text style instead of its own `Brand/Wordmark` style | Create a dedicated `Brand/Wordmark` text style and rebind. |
| The footer expands the page beyond what looks good on `0`-height | Footer height left to `fit-content` with content that wraps | Set an explicit `height` on the footer or limit the inner content widths. |

## Verification checklist

Before declaring the scaffold complete:

- [ ] Every token from the design language brief exists in `fd_list_color_styles` / `fd_list_text_styles`.
- [ ] The home page renders end-to-end: nav → hero → sections → footer.
- [ ] Every other page renders end-to-end: nav → page-specific content → footer.
- [ ] The nav and footer on every page bind to the same tokens (no per-page literal colors).
- [ ] `fd_screenshot` of `/` and one inner page show consistent typography and surfaces.
- [ ] The user is informed that nav / footer drift is a known limitation until component instances are supported.

## Worth noting

- Framer creates a default `Desktop` breakpoint frame on `fd_create_web_page`. Use it; do not add a sibling.
- Some templates auto-seed pages with placeholder content. Always inspect a freshly-created page before adding to it — there may be a `Congratulations on your new template` block or similar that needs to be removed.
- The blank-doc scaffold is the hardest case for a small LLM (no template defaults, no inherited structure). It works best when the user provides one strong reference image or Figma file and the tokens skill is run first.
