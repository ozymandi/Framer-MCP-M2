---
name: framer-onboard-project
description: Add a new Framer project to the MCP server pool — gather the project URL and a per-project API key from the user, register it in projects.json under a friendly alias, surface the changes the user has to apply on their host (LM Studio / Claude Desktop) for the new alias to become available.
---

# Framer: Onboard a New Project

Use this skill whenever:

- The user shares a `framer.com/projects/...` URL and expects to work with it.
- The user mentions "I just created a new project" or "duplicate this one".
- A tool call returns `Project '<alias>' is not configured` and the user wants to add the missing project rather than rename their call.
- The user is migrating from single-project mode to multi-project mode (first time setting up `projects.json`).

This is short and procedural. Run it before any other Framer skill on a project that is not yet registered.

## Inputs to gather, in order

Always ask explicitly. Do not guess from prior context.

1. **Project URL.** Form: `https://framer.com/projects/<Slug>--<id>`. Anything after `?` (e.g. `?duplicate=...`) is irrelevant and should be stripped before saving.
2. **Project API key.** Form: `fr_<27 lowercase alphanumerics>`. Framer API keys are bound to one specific project — a key for project A will not authenticate against project B. The user can generate one in Framer Studio: Cmd+K → "open settings" → API Keys → create.
3. **Alias.** A short token-safe name the user will type in tool calls (`framer_status project=<alias>`). If the user does not propose one, derive a sensible default from the project slug, lowercase, stripped of `-copy`, `-template`, and so on. Examples: `portfolio`, `saas`, `coriolan`, `client-acme`.

If the user gives only the URL, ask for the key. Do not proceed without the key — the MCP server cannot connect.

## Add to projects.json

The file lives at the path pointed to by `FRAMER_PROJECTS_FILE` (typically `<repo>/projects.json`).

Schema is a JSON array of entries:

```json
[
  {
    "alias": "<alias>",
    "url": "<clean project URL>",
    "apiKey": "fr_..."
  }
]
```

When adding a new entry:

- Read the existing file. Preserve every existing entry verbatim — never rewrite the whole file from memory.
- Reject duplicate aliases (post-normalization: lowercase, strip whitespace / dashes / underscores). Two entries with the same normalized alias will fail at server startup.
- Reject duplicate `url`s — almost certainly a mistake, surface it back to the user before saving.
- Save with stable formatting (2-space indent, trailing newline). Saves are diffed by git; noisy formatting churn is friction.

After saving, list the resulting set of aliases back to the user so they can confirm.

## What the user has to do on their host

This is the bit that is easy to forget.

The MCP server **reads `projects.json` once at startup**. Adding a new entry while the server is running has no effect until the server restarts. Tell the user explicitly:

- If they run the server through LM Studio: restart LM Studio (or re-run the chat). The server process is owned by LM Studio.
- If they run it through Claude Desktop: restart Claude Desktop, same reason.
- If they run it manually with `npm run dev`: the `tsx watch` will not reload the JSON since it watches `src/**`. Stop and restart `npm run dev`.

If the user expects the new alias to appear immediately and does not restart, every tool call against it will return `Project '<alias>' is not configured`.

## Sanity check after restart

Once the user has restarted, run a single read-only call to confirm:

```js
framer_list_projects()  // should now include the new alias
framer_status({ project: "<new alias>" })  // should print the project name + counts
```

If `framer_status` fails with a Framer-side authentication error, the API key was probably copied wrong (extra whitespace, trailing newline). Ask for it again rather than guessing.

## Pitfalls and recovery

| Symptom | Cause | Recovery |
|---|---|---|
| `Project '<alias>' is not configured` after adding | Server not restarted | Restart the host process (LM Studio / Claude Desktop / `npm run dev`). |
| `Failed to read FRAMER_PROJECTS_FILE` at startup | `projects.json` malformed (trailing comma, missing brace) | Re-read the file, fix the JSON, restart. |
| `Could not connect` to a project that authenticates fine in browser | API key has trailing whitespace from copy-paste | Re-acquire the key, trim, save. |
| Tool calls go to the wrong project | Two aliases normalize to the same key (e.g. `client-acme` and `client_acme`) | One of them wins; rename the loser to something distinct. |
| The user's `mcp.json` (LM Studio config) needs editing too | First time switching from single-project mode | Walk them through replacing `FRAMER_API_KEY` + `FRAMER_PROJECT_URL` with `FRAMER_PROJECTS_FILE` pointing at the file. |

## Worth noting

- `projects.json` should be in `.gitignore`. The file holds live API keys.
- For users still in single-project mode, `projects.json` does not exist and `FRAMER_PROJECTS_FILE` is unset. Their setup uses `FRAMER_API_KEY` + `FRAMER_PROJECT_URL` in `.env`. Adding a second project is the moment to switch them to multi-project mode; do that switch explicitly and document the host config change.
- A Framer API key cannot be reused across projects. If the user offers an existing key for a new project URL, push back — that key will not work.
- Project URLs sometimes include query strings like `?duplicate=...` or `?view=...`. Strip them. Save the canonical form `https://framer.com/projects/<Slug>--<id>`.
