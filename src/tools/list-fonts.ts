import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { errorResult, jsonResult, resolveProject } from "../helpers.js";

export function registerListFonts(server: McpServer): void {
  server.registerTool(
    "fd_list_fonts",
    {
      description:
        "List fonts actually referenced by this project's text styles (typography tokens) — " +
        "the set of fonts that meaningfully describe the project's design system. " +
        "By default it does NOT return the entire Google Fonts catalog (which would blow the " +
        "context window). Set `includeAll: true` if you genuinely need to see every available font.",
      inputSchema: {
        project: z.string().optional().describe("Project alias. Required in multi-project mode."),
        includeAll: z
          .boolean()
          .optional()
          .describe(
            "When true, returns every font Framer knows about. Default false — only fonts " +
              "referenced by the project's text styles are returned.",
          ),
      },
    },
    async ({ project, includeAll }) => {
      const proj = await resolveProject(project);
      if (!proj.ok) return errorResult(proj.error);
      const { framer } = proj.ctx;

      const allFonts = (await framer.getFonts()) as ReadonlyArray<{
        selector: string;
        family: string;
        weight: unknown;
        style: unknown;
      }>;

      if (includeAll) {
        return jsonResult({
          mode: "all",
          count: allFonts.length,
          fonts: allFonts.map((f) => ({
            selector: f.selector,
            family: f.family,
            weight: f.weight,
            style: f.style,
          })),
        });
      }

      const styles = (await framer.getTextStyles()) as ReadonlyArray<{
        font: { selector: string; family: string; weight: unknown; style: unknown } | null;
        boldFont: { selector: string; family: string; weight: unknown; style: unknown } | null;
        italicFont: { selector: string; family: string; weight: unknown; style: unknown } | null;
      }>;

      const seen = new Set<string>();
      const used: { selector: string; family: string; weight: unknown; style: unknown }[] = [];
      for (const s of styles) {
        for (const f of [s.font, s.boldFont, s.italicFont]) {
          if (!f || seen.has(f.selector)) continue;
          seen.add(f.selector);
          used.push({
            selector: f.selector,
            family: f.family,
            weight: f.weight,
            style: f.style,
          });
        }
      }

      return jsonResult({
        mode: "used-by-text-styles",
        availableTotal: allFonts.length,
        usedCount: used.length,
        fonts: used,
      });
    },
  );
}
