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
// Phase 2 — token writes.
import { registerCreateColorStyle } from "./create-color-style.js";
import { registerUpdateColorStyle } from "./update-color-style.js";
import { registerRemoveColorStyle } from "./remove-color-style.js";
import { registerCreateTextStyle } from "./create-text-style.js";
import { registerUpdateTextStyle } from "./update-text-style.js";
import { registerRemoveTextStyle } from "./remove-text-style.js";

export function registerAllTools(server: McpServer): void {
  // Phase 1 — read-only.
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
  // Phase 2 — token writes.
  registerCreateColorStyle(server);
  registerUpdateColorStyle(server);
  registerRemoveColorStyle(server);
  registerCreateTextStyle(server);
  registerUpdateTextStyle(server);
  registerRemoveTextStyle(server);
}
