import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { errorResult, jsonResult, resolveProject } from "../helpers.js";

export function registerIconSets(server: McpServer): void {
  server.registerTool(
    "fd_list_icon_sets",
    {
      description:
        "List icon set names (current project, external, and additional insertable sets). " +
        "Pass setName to get the exact icon names of one set instead — those names go into " +
        "$control__icon when inserting +IconNode via fd_apply_changes.",
      inputSchema: {
        project: z.string().optional().describe("Project alias. Required in multi-project mode."),
        setName: z
          .string()
          .optional()
          .describe("Icon set name — returns the available icon names in that set."),
      },
    },
    async ({ project, setName }) => {
      const proj = await resolveProject(project);
      if (!proj.ok) return errorResult(proj.error);
      const agent = (proj.ctx.framer as unknown as {
        agent: {
          listIconSets: () => Promise<unknown>;
          readIcons: (input: { iconSetName: string }) => Promise<string[]>;
        };
      }).agent;
      try {
        if (setName) {
          return jsonResult({ set: setName, icons: await agent.readIcons({ iconSetName: setName }) });
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
