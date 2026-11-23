#!/usr/bin/env node
import { createHash } from "node:crypto";
import { closeSync, constants, fstatSync, openSync, readFileSync, readSync } from "node:fs";
import { realpath } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const schema = JSON.parse(readFileSync(new URL("../references/snapshot.schema.json", import.meta.url), "utf8"));
const record = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const lexical = (a, b) => a < b ? -1 : a > b ? 1 : 0;
export const canonical = (v) => JSON.stringify(normalize(v));
function normalize(v) {
  if (Array.isArray(v)) return v.map(normalize);
  return record(v) ? Object.fromEntries(Object.keys(v).sort(lexical).map((k) => [k, normalize(v[k])])) : v;
}

// Validator for the keywords used by this bundled schema, not a general JSON Schema engine.
function validate(v, rule = schema, path = "$") {
  if (rule.$ref) return validate(v, schema.$defs[rule.$ref.split("/").at(-1)], path);
  const fail = (why) => { throw new Error(`${path}: ${why}`); };
  const types = Array.isArray(rule.type) ? rule.type : [rule.type];
  if (rule.type && !types.some((t) => t === "null" ? v === null : t === "object" ? record(v)
    : t === "array" ? Array.isArray(v) : t === "integer" ? Number.isSafeInteger(v)
      : t === "number" ? typeof v === "number" && Number.isFinite(v) : typeof v === t)) fail("invalid type");
  if (Object.hasOwn(rule, "const") && v !== rule.const) fail("unsupported value");
  if (rule.enum && !rule.enum.includes(v)) fail("unsupported enum");
  if (typeof v === "number" && (v < (rule.minimum ?? -Infinity) || v > (rule.maximum ?? Infinity))) fail("out of range");
  if (typeof v === "string") {
    if (v.length < (rule.minLength ?? 0) || (rule.pattern && !new RegExp(rule.pattern).test(v))) fail("invalid string");
    if (rule.format === "date-time" && (!/^\d{4}-\d\d-\d\dT.+(?:Z|[+-]\d\d:\d\d)$/.test(v) || !Number.isFinite(Date.parse(v)))) fail("invalid timestamp");
  }
  if (Array.isArray(v)) {
    if (v.length < (rule.minItems ?? 0) || v.length > (rule.maxItems ?? Infinity)) fail("invalid array length");
    if (rule.uniqueItems && new Set(v.map(canonical)).size !== v.length) fail("duplicate items");
    if (rule.items) v.forEach((item, i) => validate(item, rule.items, `${path}[${i}]`));
  }
  if (record(v)) {
    for (const k of rule.required ?? []) if (!Object.hasOwn(v, k)) fail(`missing ${k}`);
    for (const [k, item] of Object.entries(v)) {
      if (Object.hasOwn(rule.properties ?? {}, k)) validate(item, rule.properties[k], `${path}.${k}`);
      else if (rule.additionalProperties === false) fail(`unknown field ${k}`);
    }
  }
}

export function plan(input) {
  validate(input);
  const s = structuredClone(input);
  const unique = (values, label) => {
    if (new Set(values).size !== values.length) throw new Error(`duplicate ${label}`);
  };
  unique(s.candidates.map((c) => c.ref), "model references");
  unique(s.nativeContract.targets.map((t) => t.id), "targets");
  if (!s.nativeContract.targets.length) throw new Error("target inventory is empty");
  for (const t of s.nativeContract.targets) {
    if (t.id !== `${t.kind}:${t.name}`) throw new Error("target identity mismatch");
    t.requires.sort(lexical);
  }
  for (const c of s.candidates) {
    if (c.ref !== `${c.provider}/${c.modelId}`) throw new Error("model identity mismatch");
    unique(c.capabilities.map((v) => v.name), "capability evidence");
    unique(c.evaluations.map((v) => v.targetId), "target evaluations");
    c.capabilities.sort((a, b) => lexical(a.name, b.name));
    c.evaluations.sort((a, b) => lexical(a.targetId, b.targetId));
  }
  s.candidates.sort((a, b) => lexical(a.ref, b.ref));
  s.nativeContract.targets.sort((a, b) => lexical(a.id, b.id));
  s.nativeContract.legacyModelFields.sort(lexical);
  s.policy.allowedBillingModes.sort(lexical);
  const digest = createHash("sha256").update(canonical(s)).digest("hex");
  const proposal = structuredClone(s.existingConfig);
  const blockName = s.nativeContract.block;
  const current = Object.hasOwn(proposal, blockName) ? proposal[blockName] : {};
  if (!record(current)) throw new Error("native block must be an object");
  const now = Date.parse(s.capturedAt);
  const fresh = (date, age) => date !== undefined && now - Date.parse(date) >= 0 && now - Date.parse(date) <= age;
  const p = s.policy;
  const recommendations = [];
  for (const target of s.nativeContract.targets) {
    const group = target.kind === "category" ? "categories" : "agents";
    const entries = Object.hasOwn(current, group) ? current[group] : {};
    if (!record(entries)) throw new Error(`${group} must be an object`);
    const old = Object.hasOwn(entries, target.name) ? entries[target.name] : {};
    if (!record(old)) throw new Error(`${target.id}: assignment must be an object`);
    const blocked = old.disable === true ? "disabled-target"
      : s.nativeContract.legacyModelFields.some((k) => Object.hasOwn(old, k)) ? "legacy-selection-fields-present"
        : Object.hasOwn(old, "models") && (!Array.isArray(old.models) || old.models.some((v) => typeof v !== "string")) ? "per-model-settings-require-review"
          : Object.keys(old).some((k) => !["models", "description", "prompt", "prompt_append", "disable", "warn_unavailable", "execution_mode", "background", "max_depth", "allowed_subagents", "disallowed_tools", "max_turns"].includes(k)) ? "target-overrides-require-review" : null;
    const excluded = [];
    const eligible = [];
    for (const c of s.candidates) {
      const a = c.access;
      const e = c.evaluations.find((v) => v.targetId === target.id);
      const reasons = [];
      if (a.providerStatus !== "ready" || a.modelStatus !== "ready") reasons.push("access-unverified");
      if (a.authMethod === "unknown" || !p.allowedBillingModes.includes(a.billingMode)) reasons.push("auth-or-billing-excluded");
      if (!fresh(a.providerCheckedAt, p.maxAccessAgeMs) || !fresh(a.modelCheckedAt, p.maxAccessAgeMs)) reasons.push("access-stale");
      if (a.billingMode === "paid_api" && (a.balanceStatus !== "sufficient" || !fresh(a.balanceCheckedAt, p.maxAccessAgeMs))) reasons.push("balance-unverified");
      if (target.requires.some((name) => !c.capabilities.some((v) => v.name === name && v.status === "supported"))) reasons.push("capability-unverified");
      if ((target.minContextWindowTokens && (c.contextWindowTokens ?? 0) < target.minContextWindowTokens)
        || (target.minOutputTokens && (c.maxOutputTokens ?? 0) < target.minOutputTokens)) reasons.push("token-capacity-insufficient");
      if (!e || e.comparisonSet !== target.comparisonSet || e.trials < p.minimumTrials
        || e.score < p.minimumQualityScore || !fresh(e.observedAt, p.maxEvidenceAgeMs)) reasons.push("evaluation-insufficient");
      if (!e || typeof e.usdPerRun !== "number" || !e.costSourceRef || !fresh(e.costObservedAt, p.maxEvidenceAgeMs)) reasons.push("cost-unverified");
      else if (p.maxCostUsdPerRun !== undefined && e.usdPerRun > p.maxCostUsdPerRun) reasons.push("cost-over-budget");
      if (reasons.length) excluded.push({ ref: c.ref, reasons });
      else eligible.push({ ref: c.ref, score: e.score, usdPerRun: e.usdPerRun, authMethod: a.authMethod,
        billingMode: a.billingMode, evidence: e, accessSourceRef: a.sourceRef, modelFactsSourceRef: c.modelFactsSourceRef });
    }
    const ranked = [];
    const remaining = [...eligible];
    while (remaining.length) {
      const best = Math.max(...remaining.map((v) => v.score));
      const incumbent = old.models?.[ranked.length];
      const band = remaining.filter((v) => v.score >= best - p.qualityTolerance);
      band.sort((a, b) => a.usdPerRun - b.usdPerRun
        || Number(b.ref === incumbent) - Number(a.ref === incumbent)
        || b.score - a.score || lexical(a.ref, b.ref));
      const chosen = band[0];
      ranked.push(chosen);
      remaining.splice(remaining.indexOf(chosen), 1);
    }
    const selected = ranked.slice(0, p.modelsPerTarget).map((v) => v.ref);
    if (!blocked && selected.length) {
      if (!Object.hasOwn(proposal, blockName)) proposal[blockName] = current;
      if (!Object.hasOwn(current, group)) current[group] = entries;
      entries[target.name] = { ...old, models: selected };
    }
    recommendations.push({ targetId: target.id, status: blocked ? "needs-review" : selected.length ? "proposed" : "needs-evidence",
      reason: blocked, selected, ranking: ranked, excluded,
      before: old, after: Object.hasOwn(entries, target.name) ? entries[target.name] : old });
  }
  return { schemaVersion: 1, policyVersion: p.version, snapshotSha256: digest,
    status: recommendations.every((r) => r.status === "proposed") ? "proposal" : "incomplete",
    validation: "snapshot-and-routing-only; native-full-config-validation-and-Pro-review-required",
    recommendations, proposedConfig: proposal };
}

const invokedPath = process.argv[1] ? await realpath(process.argv[1]).catch(() => null) : null;
if (invokedPath === await realpath(fileURLToPath(import.meta.url))) {
  const [file, ...extra] = process.argv.slice(2);
  try {
    if (!file || extra.length) throw new Error("usage: node plan.mjs SNAPSHOT.json");
    const limit = 2 * 1024 * 1024;
    const fd = openSync(file, constants.O_RDONLY | constants.O_NONBLOCK);
    let bytes;
    try {
      const info = fstatSync(fd);
      if (!info.isFile()) throw new Error("snapshot must be a regular file");
      if (info.size > limit) throw new Error("snapshot exceeds 2 MiB");
      const buffer = Buffer.alloc(limit + 1);
      let count = 0;
      while (count < buffer.length) {
        const received = readSync(fd, buffer, count, buffer.length - count, count);
        if (!received) break;
        count += received;
      }
      if (count > limit) throw new Error("snapshot exceeds 2 MiB");
      bytes = buffer.subarray(0, count);
    } finally {
      closeSync(fd);
    }
    const result = plan(JSON.parse(bytes.toString("utf8")));
    console.log(canonical(result));
    process.exitCode = result.status === "proposal" ? 0 : 1;
  } catch (error) {
    console.error(JSON.stringify({ status: "invalid-input", message: error.message }));
    process.exitCode = 2;
  }
}
