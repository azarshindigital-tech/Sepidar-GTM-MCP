/**
 * Separate remote MCP server (Cloudflare Workers) for Google Tag Manager.
 * Independent from the GA4 / Google Ads / Search Console / Clarity MCPs.
 *
 *   MCP client (Claude)  ->  this Worker (/mcp)  ->  Tag Manager API v2
 *
 * Read-only: inspect/audit container configuration (tags, triggers, variables,
 * workspaces, published versions). GTM has no traffic/conversion data — that
 * lives in GA4 / Google Ads.
 */

import { McpAgent } from "agents/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import {
  listAccounts,
  listContainers,
  listWorkspaces,
  listTags,
  listTriggers,
  listVariables,
  listVersionHeaders,
  liveVersion,
  rawGet,
} from "./gtm";
import { handleSetupStart, handleOAuthCallback } from "./oauth-setup";

export interface Env {
  MCP_OBJECT: DurableObjectNamespace;

  MCP_AUTH_TOKEN: string;

  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  GOOGLE_REFRESH_TOKEN: string;

  GTM_DEFAULT_ACCOUNT_ID?: string;
  GTM_DEFAULT_CONTAINER_ID?: string;
}

function jsonResult(value: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }] };
}
function errorResult(err: unknown) {
  const message = err instanceof Error ? err.message : String(err);
  return { content: [{ type: "text" as const, text: `Error: ${message}` }], isError: true };
}

export class TagManagerMCP extends McpAgent<Env> {
  server = new McpServer({ name: "sepidar-gtm-mcp", version: "1.0.0" });

  async init() {
    const env = this.env;

    const acc = (given?: string) => given ?? env.GTM_DEFAULT_ACCOUNT_ID;
    const cont = (given?: string) => given ?? env.GTM_DEFAULT_CONTAINER_ID;

    this.server.tool(
      "ping",
      "Check that the Tag Manager MCP server is alive and configured.",
      {},
      async () =>
        jsonResult({
          ok: true,
          service: "tag-manager",
          defaultAccountId: env.GTM_DEFAULT_ACCOUNT_ID ?? null,
          defaultContainerId: env.GTM_DEFAULT_CONTAINER_ID ?? null,
        }),
    );

    this.server.tool(
      "list_gtm_accounts",
      "List the Google Tag Manager accounts this login can access (accountId, name, path).",
      {},
      async () => {
        try {
          return jsonResult(await listAccounts(env));
        } catch (err) {
          return errorResult(err);
        }
      },
    );

    this.server.tool(
      "list_containers",
      "List the containers inside a GTM account (containerId, name, publicId like GTM-XXXX, usageContext).",
      {
        account_id: z
          .string()
          .optional()
          .describe("GTM account ID. Defaults to GTM_DEFAULT_ACCOUNT_ID."),
      },
      async ({ account_id }) => {
        const a = acc(account_id);
        if (!a) return errorResult("No account_id given and GTM_DEFAULT_ACCOUNT_ID is not configured.");
        try {
          return jsonResult(await listContainers(env, a));
        } catch (err) {
          return errorResult(err);
        }
      },
    );

    this.server.tool(
      "list_workspaces",
      "List the workspaces inside a container. The Default Workspace is usually id '1'.",
      {
        account_id: z.string().optional().describe("Defaults to GTM_DEFAULT_ACCOUNT_ID."),
        container_id: z.string().optional().describe("Defaults to GTM_DEFAULT_CONTAINER_ID."),
      },
      async ({ account_id, container_id }) => {
        const a = acc(account_id);
        const c = cont(container_id);
        if (!a || !c) return errorResult("account_id/container_id missing and no defaults configured.");
        try {
          return jsonResult(await listWorkspaces(env, a, c));
        } catch (err) {
          return errorResult(err);
        }
      },
    );

    this.server.tool(
      "gtm_live_version",
      "Get the LIVE (currently published) container version with ALL its tags, triggers and variables in one call. Best tool for auditing what is actually live on the site.",
      {
        account_id: z.string().optional().describe("Defaults to GTM_DEFAULT_ACCOUNT_ID."),
        container_id: z.string().optional().describe("Defaults to GTM_DEFAULT_CONTAINER_ID."),
      },
      async ({ account_id, container_id }) => {
        const a = acc(account_id);
        const c = cont(container_id);
        if (!a || !c) return errorResult("account_id/container_id missing and no defaults configured.");
        try {
          return jsonResult(await liveVersion(env, a, c));
        } catch (err) {
          return errorResult(err);
        }
      },
    );

    this.server.tool(
      "list_version_headers",
      "List the container's published version history (version id, name, numbers of tags/triggers/variables).",
      {
        account_id: z.string().optional().describe("Defaults to GTM_DEFAULT_ACCOUNT_ID."),
        container_id: z.string().optional().describe("Defaults to GTM_DEFAULT_CONTAINER_ID."),
      },
      async ({ account_id, container_id }) => {
        const a = acc(account_id);
        const c = cont(container_id);
        if (!a || !c) return errorResult("account_id/container_id missing and no defaults configured.");
        try {
          return jsonResult(await listVersionHeaders(env, a, c));
        } catch (err) {
          return errorResult(err);
        }
      },
    );

    this.server.tool(
      "list_tags",
      "List the tags in a workspace (the current editable draft). Use gtm_live_version for the published state.",
      {
        account_id: z.string().optional().describe("Defaults to GTM_DEFAULT_ACCOUNT_ID."),
        container_id: z.string().optional().describe("Defaults to GTM_DEFAULT_CONTAINER_ID."),
        workspace_id: z.string().default("1").describe("Workspace id; Default Workspace is usually '1'."),
      },
      async ({ account_id, container_id, workspace_id }) => {
        const a = acc(account_id);
        const c = cont(container_id);
        if (!a || !c) return errorResult("account_id/container_id missing and no defaults configured.");
        try {
          return jsonResult(await listTags(env, a, c, workspace_id));
        } catch (err) {
          return errorResult(err);
        }
      },
    );

    this.server.tool(
      "list_triggers",
      "List the triggers in a workspace (the current editable draft).",
      {
        account_id: z.string().optional().describe("Defaults to GTM_DEFAULT_ACCOUNT_ID."),
        container_id: z.string().optional().describe("Defaults to GTM_DEFAULT_CONTAINER_ID."),
        workspace_id: z.string().default("1").describe("Workspace id; Default Workspace is usually '1'."),
      },
      async ({ account_id, container_id, workspace_id }) => {
        const a = acc(account_id);
        const c = cont(container_id);
        if (!a || !c) return errorResult("account_id/container_id missing and no defaults configured.");
        try {
          return jsonResult(await listTriggers(env, a, c, workspace_id));
        } catch (err) {
          return errorResult(err);
        }
      },
    );

    this.server.tool(
      "list_variables",
      "List the variables in a workspace (the current editable draft).",
      {
        account_id: z.string().optional().describe("Defaults to GTM_DEFAULT_ACCOUNT_ID."),
        container_id: z.string().optional().describe("Defaults to GTM_DEFAULT_CONTAINER_ID."),
        workspace_id: z.string().default("1").describe("Workspace id; Default Workspace is usually '1'."),
      },
      async ({ account_id, container_id, workspace_id }) => {
        const a = acc(account_id);
        const c = cont(container_id);
        if (!a || !c) return errorResult("account_id/container_id missing and no defaults configured.");
        try {
          return jsonResult(await listVariables(env, a, c, workspace_id));
        } catch (err) {
          return errorResult(err);
        }
      },
    );

    this.server.tool(
      "gtm_api_get",
      "Read-only escape hatch: GET any Tag Manager API v2 path (relative to the v2 base, no leading host). " +
        "Example: 'accounts/12345/containers/67890/versions:live'. Only GET is possible (readonly scope).",
      {
        path: z
          .string()
          .describe("Path under https://tagmanager.googleapis.com/tagmanager/v2/ , e.g. 'accounts'."),
      },
      async ({ path }) => {
        try {
          return jsonResult(await rawGet(env, path));
        } catch (err) {
          return errorResult(err);
        }
      },
    );
  }
}

/** Shared-secret check (Authorization: Bearer <token> or ?key=/?token= in URL). */
function isAuthorized(request: Request, env: Env): boolean {
  const configured = (env.MCP_AUTH_TOKEN ?? "").trim();
  if (!configured) return false;
  const header = request.headers.get("Authorization") ?? "";
  let token = header.replace(/^Bearer\s+/i, "").trim();
  if (!token) {
    const url = new URL(request.url);
    token = (url.searchParams.get("key") ?? url.searchParams.get("token") ?? "").trim();
  }
  return token.length > 0 && token === configured;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/" || url.pathname === "/health") {
      return new Response("Tag Manager MCP server is running. Connect an MCP client to /mcp .", {
        headers: { "Content-Type": "text/plain" },
      });
    }

    if (url.pathname === "/setup") return handleSetupStart(request, env);
    if (url.pathname === "/auth/callback") return handleOAuthCallback(request, env);

    if (url.pathname === "/mcp" || url.pathname === "/sse" || url.pathname === "/sse/message") {
      if (!isAuthorized(request, env)) return new Response("Unauthorized", { status: 401 });
      if (url.pathname === "/mcp") return TagManagerMCP.serve("/mcp").fetch(request, env, ctx);
      return TagManagerMCP.serveSSE("/sse").fetch(request, env, ctx);
    }

    return new Response("Not found", { status: 404 });
  },
};
