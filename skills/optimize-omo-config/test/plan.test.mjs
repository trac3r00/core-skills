import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtempSync, writeFileSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { canonical, plan } from "../scripts/plan.mjs";

const time = "2026-09-27T00:00:00Z";
function snapshot() {
  return {
    schemaVersion: 1, capturedAt: time,
    host: { omoVersion: "fixture", engineVersion: "fixture" },
    policy: { version: "quality-cost-access/1", maxAccessAgeMs: 86400000, maxEvidenceAgeMs: 86400000,
      minimumTrials: 3, minimumQualityScore: 80, qualityTolerance: 2, modelsPerTarget: 1,
      allowedBillingModes: ["subscription", "paid_api"], maxCostUsdPerRun: 0.1 },
    nativeContract: { version: "fixture/1", block: "[native]", modelArrayField: "models",
      legacyModelFields: ["model", "fallback_models"], targetInventoryComplete: true,
      targets: [{ id: "category:quick", kind: "category", name: "quick", comparisonSet: "fixture-taskset/1",
        requires: ["tool_calling"], minContextWindowTokens: 1000 }] },
    existingConfig: { unrelated: { keep: true }, "[native]": { categories: {
      quick: { models: ["demo/z"], description: "preserve this" }, custom: { model: "leave/me" } } } },
    candidates: ["demo/a", "demo/z"].map((ref) => ({
      ref, provider: "demo", modelId: ref.slice(5),
      access: { providerStatus: "ready", modelStatus: "ready", authMethod: "oauth", billingMode: "subscription",
        balanceStatus: "not_applicable", providerCheckedAt: time, modelCheckedAt: time, sourceRef: "local:fixture-access" },
      modelFactsSourceRef: "local:fixture-facts", contextWindowTokens: 2000, maxOutputTokens: 1000,
      capabilities: [{ name: "tool_calling", status: "supported", sourceRef: "local:fixture-capabilities" }],
      evaluations: [{ targetId: "category:quick", comparisonSet: "fixture-taskset/1", score: 90, trials: 3,
        observedAt: time, evidenceKind: "local-evaluation", sourceRef: "local:fixture-evaluation",
        strengths: [], weaknesses: [], usdPerRun: 0, costObservedAt: time, costSourceRef: "local:fixture-cost" }],
    })),
  };
}

test("identical snapshots and reordered inventories produce byte-identical plans", () => {
  // Given: equivalent inventories with different enumeration order.
  const a = snapshot();
  const b = structuredClone(a);
  b.candidates.reverse();
  b.policy.allowedBillingModes.reverse();
  b.nativeContract.legacyModelFields.reverse();
  // When / Then: normalization is stable and never uses a live clock.
  assert.equal(canonical(plan(a)), canonical(plan(b)));
  assert.equal(canonical(plan(a)), canonical(plan(a)));
});

test("ties preserve the incumbent and unrelated configuration without mutating input", () => {
  const s = snapshot();
  const before = canonical(s);
  const p = plan(s);
  assert.deepEqual(p.recommendations[0].selected, ["demo/z"]);
  assert.deepEqual(p.proposedConfig.unrelated, { keep: true });
  assert.deepEqual(p.proposedConfig["[native]"].categories.custom, { model: "leave/me" });
  assert.equal(p.proposedConfig["[native]"].categories.quick.description, "preserve this");
  assert.equal(canonical(s), before);
});

test("quality outside the tolerance beats price; price wins within the band", () => {
  const s = snapshot();
  s.candidates[0].evaluations[0].score = 95;
  s.candidates[0].evaluations[0].usdPerRun = 0.05;
  assert.deepEqual(plan(s).recommendations[0].selected, ["demo/a"]);
  s.candidates[1].evaluations[0].score = 94;
  assert.deepEqual(plan(s).recommendations[0].selected, ["demo/z"]);
});

test("unknown model entitlement never inherits provider readiness", () => {
  const s = snapshot();
  s.candidates.forEach((c) => { c.access.modelStatus = "unknown"; });
  const p = plan(s);
  assert.equal(p.status, "incomplete");
  assert.deepEqual(p.proposedConfig, s.existingConfig);
  assert.ok(p.recommendations[0].excluded.every((v) => v.reasons.includes("access-unverified")));
});

test("stale, future, incompatible, and incomparable evidence cannot become recommendations", () => {
  for (const mutate of [
    (c) => { c.access.modelCheckedAt = "2026-01-01T00:00:00Z"; },
    (c) => { c.access.providerCheckedAt = "2027-01-01T00:00:00Z"; },
    (c) => { c.capabilities[0].status = "unknown"; },
    (c) => { c.contextWindowTokens = null; },
    (c) => { c.evaluations[0].comparisonSet = "different-taskset"; },
    (c) => { c.evaluations[0].trials = 1; },
    (c) => { delete c.evaluations[0].costSourceRef; },
  ]) {
    const s = snapshot();
    s.candidates.forEach(mutate);
    assert.equal(plan(s).status, "incomplete");
  }
});

test("API access needs fresh sufficient balance independently of OAuth versus API key", () => {
  const s = snapshot();
  for (const c of s.candidates) {
    c.access.billingMode = "paid_api";
    c.access.authMethod = "api_key";
    c.access.balanceStatus = "unknown";
  }
  assert.equal(plan(s).status, "incomplete");
  for (const c of s.candidates) {
    c.access.balanceStatus = "sufficient";
    c.access.balanceCheckedAt = time;
  }
  assert.equal(plan(s).status, "proposal");
  s.policy.allowedBillingModes = ["subscription"];
  assert.equal(plan(s).status, "incomplete");
});

test("legacy routes and model-specific settings remain explicit review blockers", () => {
  for (const fields of [{ model: "demo/a" }, { models: [{ model: "demo/a", reasoning: "high" }] },
    { reasoning: "high" }, { disable: true }]) {
    const s = snapshot();
    Object.assign(s.existingConfig["[native]"].categories.quick, fields);
    const p = plan(s);
    assert.equal(p.recommendations[0].status, "needs-review");
    assert.deepEqual(p.proposedConfig, s.existingConfig);
    assert.equal(p.recommendations[0].ranking.length, 2);
  }
});

test("schema, target identity, duplicate models, and incomplete inventory fail closed", () => {
  for (const mutate of [
    (s) => { s.nativeContract.targetInventoryComplete = false; },
    (s) => { s.policy.minimumTrials = 0; },
    (s) => { s.policy.unrecognized = true; },
    (s) => { s.candidates.push(s.candidates[0]); },
    (s) => { s.nativeContract.targets[0].name = "mismatch"; },
    (s) => { s.candidates[0].ref = "other/model"; },
  ]) {
    const s = snapshot();
    mutate(s);
    assert.throws(() => plan(s));
  }
});

test("agent proposals use the native agents record and bounded fallback lists", () => {
  const s = snapshot();
  s.nativeContract.targets[0] = { ...s.nativeContract.targets[0], id: "agent:reviewer", kind: "agent", name: "reviewer" };
  s.candidates.forEach((c) => { c.evaluations[0].targetId = "agent:reviewer"; });
  s.policy.modelsPerTarget = 2;
  const p = plan(s);
  assert.deepEqual(p.proposedConfig["[native]"].agents.reviewer.models, ["demo/a", "demo/z"]);
  assert.deepEqual(p.proposedConfig["[native]"].categories, s.existingConfig["[native]"].categories);
});

test("the actual CLI emits a deterministic proposal and writes no configuration", (t) => {
  const root = mkdtempSync(join(tmpdir(), "omo-plan-test-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const path = join(root, "snapshot.json");
  const original = canonical(snapshot());
  writeFileSync(path, original);
  const script = fileURLToPath(new URL("../scripts/plan.mjs", import.meta.url));
  const run = () => spawnSync(process.execPath, [script, path], { cwd: root, encoding: "utf8", timeout: 5000 });
  const first = run();
  assert.equal(first.status, 0, first.stderr);
  assert.equal(first.stdout, run().stdout);
  assert.equal(JSON.parse(first.stdout).status, "proposal");
  assert.equal(readFileSync(path, "utf8"), original);
  assert.deepEqual(readdirSync(root), ["snapshot.json"]);
});

test("the CLI rejects oversized snapshots before reading content and rejects devices", (t) => {
  const root = mkdtempSync(join(tmpdir(), "omo-plan-limit-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const path = join(root, "oversized.json");
  writeFileSync(path, Buffer.alloc(2 * 1024 * 1024 + 1));
  const script = fileURLToPath(new URL("../scripts/plan.mjs", import.meta.url));
  // Observe an attempted unbounded read without actually allocating a huge input.
  const preload = `import fs from 'node:fs'; import {syncBuiltinESMExports} from 'node:module';
    const original=fs.readFileSync; fs.readFileSync=(file,...args)=>{
      if(file===process.argv[2]) throw new Error('unbounded snapshot read attempted');
      return original(file,...args); }; syncBuiltinESMExports();`;
  const run = spawnSync(process.execPath, ["--import", `data:text/javascript,${encodeURIComponent(preload)}`, script, path],
    { encoding: "utf8", timeout: 5000 });
  assert.equal(run.status, 2);
  assert.equal(JSON.parse(run.stderr).message, "snapshot exceeds 2 MiB");
  if (process.platform !== "win32") {
    const device = spawnSync(process.execPath, [script, "/dev/null"], { encoding: "utf8", timeout: 5000 });
    assert.equal(device.status, 2);
    assert.equal(JSON.parse(device.stderr).message, "snapshot must be a regular file");
  }
});
