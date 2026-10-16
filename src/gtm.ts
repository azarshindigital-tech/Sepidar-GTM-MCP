/**
 * Google Tag Manager API v2 (REST) helpers.
 *
 * Base: https://tagmanager.googleapis.com/tagmanager/v2
 *   Accounts:        GET /accounts
 *   Containers:      GET /accounts/{accountId}/containers
 *   Workspaces:      GET /accounts/{accountId}/containers/{containerId}/workspaces
 *   Tags:            GET /{workspacePath}/tags
 *   Triggers:        GET /{workspacePath}/triggers
 *   Variables:       GET /{workspacePath}/variables
 *   Version headers: GET /{containerPath}/version_headers
 *   Live version:    GET /{containerPath}/versions:live   (published tags+triggers+variables)
 *
 * All read-only; the refresh token carries the
 * https://www.googleapis.com/auth/tagmanager.readonly scope.
 * Docs: https://developers.google.com/tag-platform/tag-manager/api/v2
 */

import type { Env } from "./index";
import { getAccessToken } from "./google-auth";

const BASE = "https://tagmanager.googleapis.com/tagmanager/v2";

/** Authenticated GET against a path relative to the Tag Manager v2 base. */
async function gtmGet(env: Env, pathAndQuery: string): Promise<unknown> {
  const token = await getAccessToken(env);
  const path = pathAndQuery.replace(/^\/+/, "");
  const res = await fetch(`${BASE}/${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Tag Manager API failed (HTTP ${res.status}) on /${path}: ${text}`);
  }
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

const containerPath = (accountId: string, containerId: string) =>
  `accounts/${accountId}/containers/${containerId}`;
const workspacePath = (accountId: string, containerId: string, workspaceId: string) =>
  `${containerPath(accountId, containerId)}/workspaces/${workspaceId}`;

/** GTM accounts this login can access. */
export const listAccounts = (env: Env) => gtmGet(env, "accounts");

/** Containers inside an account. */
export const listContainers = (env: Env, accountId: string) =>
  gtmGet(env, `accounts/${accountId}/containers`);

/** Workspaces inside a container (the Default Workspace is usually id "1"). */
export const listWorkspaces = (env: Env, accountId: string, containerId: string) =>
  gtmGet(env, `${containerPath(accountId, containerId)}/workspaces`);

/** Tags configured in a workspace. */
export const listTags = (env: Env, accountId: string, containerId: string, workspaceId: string) =>
  gtmGet(env, `${workspacePath(accountId, containerId, workspaceId)}/tags`);

/** Triggers configured in a workspace. */
export const listTriggers = (env: Env, accountId: string, containerId: string, workspaceId: string) =>
  gtmGet(env, `${workspacePath(accountId, containerId, workspaceId)}/triggers`);

/** Variables configured in a workspace. */
export const listVariables = (env: Env, accountId: string, containerId: string, workspaceId: string) =>
  gtmGet(env, `${workspacePath(accountId, containerId, workspaceId)}/variables`);

/** Published version history (headers only). */
export const listVersionHeaders = (env: Env, accountId: string, containerId: string) =>
  gtmGet(env, `${containerPath(accountId, containerId)}/version_headers`);

/** The live (currently published) container version, with all tags/triggers/variables. */
export const liveVersion = (env: Env, accountId: string, containerId: string) =>
  gtmGet(env, `${containerPath(accountId, containerId)}/versions:live`);

/** Raw read-only GET escape hatch for any Tag Manager v2 path. */
export const rawGet = (env: Env, path: string) => gtmGet(env, path);
