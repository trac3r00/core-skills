#!/usr/bin/env node
// Minimal read-only Notion REST fallback. Node >=24; no packages or disk writes.
import { realpath } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const API = "https://api.notion.com";
const VERSION = "2026-03-11";
const MAX_RESPONSE = 256 * 1024;
const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function result(status, extra = {}) {
  return { status, checkedAt: new Date().toISOString(), ...extra };
}

async function request(base, token, path, body) {
  const response = await fetch(`${base}${path}`, {
    method: body ? "POST" : "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "Notion-Version": VERSION,
      "Content-Type": "application/json",
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(8000),
    redirect: "error",
  });
  if (!response.ok) {
    const status = ({ 401: "auth_failed", 403: "access_denied", 404: "not_found", 429: "rate_limited" })[response.status] ?? "api_error";
    await response.body?.cancel();
    return { error: status, httpStatus: response.status };
  }
  const chunks = [];
  let length = 0;
  if (!response.body) return { error: "invalid_response" };
  for await (const chunk of response.body) {
    length += chunk.byteLength;
    if (length > MAX_RESPONSE) return { error: "response_too_large" };
    chunks.push(chunk);
  }
  try {
    const data = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    return data && typeof data === "object" && !Array.isArray(data) && !Object.hasOwn(data, "error")
      ? data : { error: "invalid_response" };
  } catch {
    return { error: "invalid_response" };
  }
}

// base is injectable for isolated wire-level tests; the CLI always uses Notion's official API.
export async function readNotion({ query, page, block, token, base = API } = {}) {
  if (!token) return result("no_credential");
  if ([query, page, block].filter(Boolean).length !== 1
    || (query && (query.length > 120 || !query.trim()))
    || ((page || block) && !ID.test(page ?? block))) return result("invalid_input");

  try {
    if (query) {
      const data = await request(base, token, "/v1/search", {
        query: query.trim(), filter: { property: "object", value: "page" }, page_size: 10,
      });
      if (data.error) return result(data.error, { ...(data.httpStatus ? { httpStatus: data.httpStatus } : {}) });
      if (!Array.isArray(data.results)) return result("invalid_response");
      const candidates = data.results.filter((item) => item.object === "page" && ID.test(item.id)).slice(0, 10)
        .map((item) => {
          const title = Object.values(item.properties ?? {}).find((property) => property?.type === "title")?.title;
          return {
            id: item.id,
            title: Array.isArray(title) ? title.map((part) => part.plain_text).filter((part) => typeof part === "string").join("").slice(0, 120) : "",
            url: item.url ?? null,
            modifiedAt: item.last_edited_time ?? null,
          };
        });
      return result(candidates.length ? "candidates" : "empty_search", { candidates, incomplete: Boolean(data.has_more) });
    }

    const id = (page ?? block).toLowerCase();
    let sourceUrl = null;
    let modifiedAt = null;
    if (page) {
      const metadata = await request(base, token, `/v1/pages/${id}`);
      if (metadata.error) return result(metadata.error, { ...(metadata.httpStatus ? { httpStatus: metadata.httpStatus } : {}) });
      if (metadata.object !== "page" || typeof metadata.id !== "string"
        || !ID.test(metadata.id) || metadata.id.toLowerCase() !== id) return result("invalid_response");
      if (metadata.in_trash || metadata.is_archived || metadata.archived) return result("no_content");
      sourceUrl = metadata.url ?? null;
      modifiedAt = metadata.last_edited_time ?? null;
    }
    const data = await request(base, token, `/v1/blocks/${id}/children?page_size=20`);
    if (data.error) return result(data.error, { ...(data.httpStatus ? { httpStatus: data.httpStatus } : {}) });
    if (!Array.isArray(data.results)) return result("invalid_response");
    const excerpts = data.results.flatMap((item) => {
      const richText = item[item.type]?.rich_text;
      if (!ID.test(item.id) || !Array.isArray(richText)) return [];
      const text = richText.map((fragment) => fragment.plain_text).filter((part) => typeof part === "string").join("");
      return text.trim() ? [{ blockId: item.id, modifiedAt: item.last_edited_time ?? null, excerpt: text.slice(0, 300) }] : [];
    }).slice(0, 5);
    const nestedBlockIds = data.results.filter((item) => item.has_children && ID.test(item.id)).map((item) => item.id).slice(0, 10);
    return result(excerpts.length ? "ready" : "no_content", {
      sourceId: id, sourceUrl, modifiedAt, excerpts, nestedBlockIds, incomplete: Boolean(data.has_more || nestedBlockIds.length),
    });
  } catch {
    return result("network_error");
  }
}

const invokedPath = process.argv[1] ? await realpath(process.argv[1]).catch(() => null) : null;
if (invokedPath === await realpath(fileURLToPath(import.meta.url))) {
  const [flag, value, ...extra] = process.argv.slice(2);
  const option = ({ "--query": "query", "--page": "page", "--block": "block" })[flag];
  const response = extra.length || !option || !value
    ? result("invalid_input")
    : await readNotion({ [option]: value, token: process.env.NOTION_API_KEY });
  console.log(JSON.stringify(response));
  process.exitCode = response.status === "invalid_input" ? 2
    : ["ready", "candidates", "empty_search", "no_content"].includes(response.status) ? 0 : 1;
}
