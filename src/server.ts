import { randomUUID } from "node:crypto";
import Fastify from "fastify";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import { config } from "./config.js";
import { disconnectAll } from "./framer-client.js";
import { registerAllTools } from "./tools/index.js";

const SESSION_HEADER = "mcp-session-id";

interface Session {
  transport: StreamableHTTPServerTransport;
  server: McpServer;
}

const sessions = new Map<string, Session>();

function createMcpServer(): McpServer {
  const server = new McpServer(
    { name: "framer-mcp-m2", version: "0.1.0" },
    {
      capabilities: { tools: {} },
      instructions:
        "Framer design inspection server. Read-only view of Framer projects' visual " +
        "structure: pages, nodes, components, design tokens (color and text styles), and " +
        "fonts. Use fd_list_pages to discover pages, fd_inspect_node " +
        "to walk a tree, and fd_screenshot to get a PNG render. Pair with " +
        "framer-mcp (M1) for CMS content writes; this server does not modify designs.",
    },
  );
  registerAllTools(server);
  return server;
}

async function bootstrapStdio(): Promise<void> {
  const log = (...args: unknown[]) => {
    console.error("[framer-mcp-m2]", ...args);
  };

  const server = createMcpServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  log("connected via stdio");

  const shutdown = async () => {
    log("shutting down");
    try {
      await server.close();
    } catch {
      // ignore
    }
    await disconnectAll();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
  process.stdin.on("close", () => {
    void shutdown();
  });
}

async function bootstrapHttp(): Promise<void> {
  const fastify = Fastify({ logger: true });

  fastify.addHook("onRequest", async (request, reply) => {
    if (request.url !== "/mcp") return;
    const auth = request.headers["authorization"];
    if (auth !== `Bearer ${config.mcpAuthToken}`) {
      await reply.code(401).send({ error: "Unauthorized" });
    }
  });

  fastify.get("/health", async () => ({ ok: true }));

  fastify.all("/mcp", async (request, reply) => {
    const sessionId = request.headers[SESSION_HEADER];
    const sessionIdValue = Array.isArray(sessionId) ? sessionId[0] : sessionId;

    let session: Session | undefined;

    if (sessionIdValue && sessions.has(sessionIdValue)) {
      session = sessions.get(sessionIdValue);
    } else if (request.method === "POST" && isInitializeRequest(request.body)) {
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        onsessioninitialized: (id) => {
          sessions.set(id, { transport, server });
        },
      });
      transport.onclose = () => {
        if (transport.sessionId) sessions.delete(transport.sessionId);
      };
      const server = createMcpServer();
      await server.connect(transport);
      session = { transport, server };
    } else {
      await reply
        .code(400)
        .send({ jsonrpc: "2.0", error: { code: -32000, message: "No valid session" }, id: null });
      return;
    }

    if (!session) {
      await reply
        .code(500)
        .send({ jsonrpc: "2.0", error: { code: -32000, message: "Session unavailable" }, id: null });
      return;
    }

    await session.transport.handleRequest(request.raw, reply.raw, request.body);
  });

  fastify.addHook("onClose", async () => {
    await disconnectAll();
    for (const { transport } of sessions.values()) {
      await transport.close();
    }
    sessions.clear();
  });

  const shutdown = async () => {
    await fastify.close();
    await disconnectAll();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  await fastify.listen({ port: config.port, host: "0.0.0.0" });
  fastify.log.info(`framer-mcp-m2 listening on http://0.0.0.0:${config.port}/mcp`);
}

const bootstrap = config.transport === "stdio" ? bootstrapStdio : bootstrapHttp;
bootstrap().catch((err) => {
  console.error("Fatal startup error:", err);
  process.exit(1);
});
