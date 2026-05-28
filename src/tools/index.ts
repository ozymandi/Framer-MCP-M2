import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerListProjects } from "./list-projects.js";
import { registerStatus } from "./status.js";
import { registerListPages } from "./list-pages.js";
import { registerInspectNode } from "./inspect-node.js";
import { registerScreenshot } from "./screenshot.js";
import { registerExportSvg } from "./export-svg.js";
import { registerListColorStyles } from "./list-color-styles.js";
import { registerListTextStyles } from "./list-text-styles.js";
import { registerListComponents } from "./list-components.js";
import { registerListFonts } from "./list-fonts.js";

export function registerAllTools(server: McpServer): void {
  registerListProjects(server);
  registerStatus(server);
  registerListPages(server);
  registerInspectNode(server);
  registerScreenshot(server);
  registerExportSvg(server);
  registerListColorStyles(server);
  registerListTextStyles(server);
  registerListComponents(server);
  registerListFonts(server);
}
