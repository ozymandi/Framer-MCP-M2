import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { errorResult, jsonResult, resolveProject } from "../helpers.js";

// The Framer server validates icon lookups by `iconSetId` (typia assert) and
// accepts either the catalog `id` or the `displayName` as the value. SDK 5.0.0
// typings still say `iconSetName`, so the shape is declared locally.
interface IconAgent {
  listIconSets: () => Promise<unknown>;
  readIcons: (input: { iconSetId: string }) => Promise<string[]>;
}

export function registerIconSets(server: McpServer): void {
  server.registerTool(
    "fd_list_icon_sets",
    {
      description:
        "List icon sets as { id, displayName } entries grouped by current project, external, " +
        "and additional insertable sets. Pass setId (the id or displayName of one set) to get " +
        "the exact icon names of that set instead — those names go into $control__icon when " +
        "inserting +IconNode via fd_apply_changes.",
      inputSchema: {
        project: z.string().optional().describe("Project alias. Required in multi-project mode."),
        setId: z
          .string()
          .optional()
          .describe("Icon set id or displayName from the catalog — returns that set's icon names."),
        setName: z
          .string()
          .optional()
          .describe("Deprecated alias of setId (kept for older prompts and skills)."),
      },
    },
    async ({ project, setId, setName }) => {
      const proj = await resolveProject(project);
      if (!proj.ok) return errorResult(proj.error);
      const agent = (proj.ctx.framer as unknown as { agent: IconAgent }).agent;
      const set = setId ?? setName;
      try {
        if (set) {
          return jsonResult({ set, icons: await agent.readIcons({ iconSetId: set }) });
        }
        return jsonResult(await agent.listIconSets());
      } catch (err) {
        return errorResult(
          `icon sets failed: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    },
  );
}
