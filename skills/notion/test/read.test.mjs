import assert from "node:assert/strict";
import { createServer } from "node:http";
import { once } from "node:events";
import { test } from "node:test";
import { readNotion } from "../scripts/read.mjs";

const PAGE = "b55c9c91-384d-452b-81db-d1ef79372b75";
const BLOCK = "c02fc1d3-db8b-45c5-a222-27595b15aea7";

async function api(t, respond) {
  const calls = [];
  const server = createServer(async (req, res) => {
    const body = [];
    for await (const chunk of req) body.push(chunk);
    calls.push({ method: req.method, path: req.url, headers: req.headers, body: Buffer.concat(body).toString("utf8") });
    const reply = respond(req, calls.length);
    res.writeHead(reply.status ?? 200, { "Content-Type": "application/json", ...reply.headers });
    res.end(typeof reply.body === "string" ? reply.body : JSON.stringify(reply.body));
  });
  const listening = once(server, "listening");
  server.listen(0, "127.0.0.1");
  await listening;
  t.after(() => new Promise((done) => server.close(done)));
  return { base: `http://127.0.0.1:${server.address().port}`, calls };
}

test("no token or malformed page id sends no request", async (t) => {
  const wire = await api(t, () => { throw new Error("unexpected network call"); });
  assert.equal((await readNotion({ page: PAGE, base: wire.base })).status, "no_credential");
  assert.equal((await readNotion({ page: "../escape", token: "fixture", base: wire.base })).status, "invalid_input");
  assert.deepEqual(wire.calls, []);
});

test("a redirect never forwards the Notion credential to another host", async (t) => {
  // Given: an API endpoint attempts to send this request to another server.
  const target = await api(t, () => ({ body: { results: [] } }));
  const origin = await api(t, () => ({ status: 302, headers: { Location: `${target.base}/leak` }, body: {} }));

  // When: the helper searches with an authorized token.
  const result = await readNotion({ query: "topic", token: "fixture", base: origin.base });

  // Then: the redirect fails closed and the target receives no request.
  assert.equal(result.status, "network_error");
  assert.equal(origin.calls.length, 1);
  assert.deepEqual(target.calls, []);
  assert.equal(JSON.stringify(result).includes("fixture"), false);
});

test("title search returns candidates but does not claim page content", async (t) => {
  // Given: Notion's title-search endpoint returns a matching page.
  const wire = await api(t, () => ({ body: { results: [{
    object: "page", id: PAGE, url: "https://www.notion.so/example", last_edited_time: "2026-09-01T00:00:00Z",
    properties: { "Project Name": { type: "title", title: [{ plain_text: "Design " }, { plain_text: "decision" }] } },
  }], has_more: true } }));

  // When: a narrow title is searched.
  const result = await readNotion({ query: "design decision", token: "fixture", base: wire.base });

  // Then: the request is versioned, scoped to page titles, and no excerpt is inferred.
  assert.equal(result.status, "candidates");
  assert.equal(result.incomplete, true);
  assert.deepEqual(result.candidates.map((item) => item.id), [PAGE]);
  assert.deepEqual(result.candidates.map((item) => item.title), ["Design decision"]);
  assert.equal(wire.calls.length, 1);
  assert.equal(wire.calls[0].headers["notion-version"], "2026-03-11");
  assert.equal(wire.calls[0].headers.authorization, "Bearer fixture");
  assert.deepEqual(JSON.parse(wire.calls[0].body), { query: "design decision", filter: { property: "object", value: "page" }, page_size: 10 });
});

test("page read returns only actual block excerpts with IDs and edit times", async (t) => {
  // Given: a shared page and one text block in the real REST response shape.
  const wire = await api(t, (req) => req.url.startsWith("/v1/pages/")
    ? { body: { object: "page", id: PAGE, url: "https://www.notion.so/example", last_edited_time: "2026-09-02T00:00:00Z" } }
    : { body: { results: [{ id: BLOCK, type: "paragraph", paragraph: { rich_text: [{ plain_text: "The actual decision" }] }, has_children: true, last_edited_time: "2026-09-03T00:00:00Z" }], has_more: false } });

  // When: one chosen page is read.
  const result = await readNotion({ page: PAGE, token: "fixture", base: wire.base });

  // Then: returned text is sourced to a real block, not title or page metadata.
  assert.equal(result.status, "ready");
  assert.equal(result.sourceId, PAGE);
  assert.equal(result.sourceUrl, "https://www.notion.so/example");
  assert.deepEqual(result.excerpts, [{ blockId: BLOCK, modifiedAt: "2026-09-03T00:00:00Z", excerpt: "The actual decision" }]);
  assert.deepEqual(result.nestedBlockIds, [BLOCK]);
  assert.equal(result.incomplete, true);
  assert.deepEqual(wire.calls.map(({ path }) => path), [`/v1/pages/${PAGE}`, `/v1/blocks/${PAGE}/children?page_size=20`]);
});

test("empty content and inaccessible pages never become ready", async (t) => {
  const empty = await api(t, (req) => req.url.startsWith("/v1/pages/")
    ? { body: { object: "page", id: PAGE } } : { body: { results: [], has_more: false } });
  assert.equal((await readNotion({ page: PAGE, token: "fixture", base: empty.base })).status, "no_content");

  const denied = await api(t, () => ({ status: 403, body: { message: "private message must not leak" } }));
  const result = await readNotion({ page: PAGE, token: "fixture", base: denied.base });
  assert.deepEqual({ status: result.status, httpStatus: result.httpStatus }, { status: "access_denied", httpStatus: 403 });
  assert.equal(JSON.stringify(result).includes("private message"), false);
  assert.equal(denied.calls.length, 1);
});

test("UUID casing does not change page identity and different IDs still fail", async (t) => {
  const wire = await api(t, (req) => req.url.startsWith("/v1/pages/")
    ? { body: { object: "page", id: PAGE.toUpperCase() } }
    : { body: { results: [], has_more: false } });
  assert.equal((await readNotion({ page: PAGE, token: "fixture", base: wire.base })).status, "no_content");
  assert.equal((await readNotion({ page: PAGE.toUpperCase(), token: "fixture", base: wire.base })).status, "no_content");
  const different = await api(t, () => ({ body: { object: "page", id: BLOCK } }));
  assert.equal((await readNotion({ page: PAGE, token: "fixture", base: different.base })).status, "invalid_response");
});

test("archived or trashed pages are not read further", async (t) => {
  for (const flag of ["is_archived", "archived", "in_trash"]) {
    // Given: page metadata marks the requested page unavailable.
    const wire = await api(t, () => ({ body: { object: "page", id: PAGE, [flag]: true } }));

    // When: a page read is attempted.
    const result = await readNotion({ page: PAGE, token: "fixture", base: wire.base });

    // Then: the block endpoint is not requested.
    assert.equal(result.status, "no_content");
    assert.deepEqual(wire.calls.map(({ path }) => path), [`/v1/pages/${PAGE}`]);
  }
});

test("oversized and malformed responses fail without publishing excerpts", async (t) => {
  const big = await api(t, () => ({ body: { results: [], padding: "x".repeat(256 * 1024) } }));
  assert.equal((await readNotion({ query: "topic", token: "fixture", base: big.base })).status, "response_too_large");
  const broken = await api(t, () => ({ body: "not-json" }));
  assert.equal((await readNotion({ query: "topic", token: "fixture", base: broken.base })).status, "invalid_response");
  const wrongShape = await api(t, () => ({ body: null }));
  assert.equal((await readNotion({ query: "topic", token: "fixture", base: wrongShape.base })).status, "invalid_response");
  const forgedStatus = await api(t, () => ({ body: { error: "ready" } }));
  assert.equal((await readNotion({ query: "topic", token: "fixture", base: forgedStatus.base })).status, "invalid_response");
});
