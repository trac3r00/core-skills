import assert from "node:assert/strict";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { cases, gradeCase, runCase } from "./fixtures.mjs";

const script = fileURLToPath(new URL("../scripts/sys_health.py", import.meta.url));

for (const fixture of cases) {
  test(`reports ${fixture.id} through the CLI reporting path`, () => {
    // Given: native command and /proc boundaries return the specified fixture.
    // When: the actual sys-health parser and main() render JSON.
    const observed = runCase(script, fixture);
    // Then: the machine-readable report and exit status meet the independent expectation.
    assert.ok(gradeCase(fixture, observed), `${fixture.id}: ${JSON.stringify(observed)}`);
  });
}

test("the fixture grader rejects an empty or incorrect report", () => {
  const healthy = cases.find(({ id }) => id === "healthy-metrics");
  assert.equal(gradeCase(healthy, { exitCode: 0, report: null }), false);
  assert.equal(gradeCase(healthy, { exitCode: 0, report: { memory: { used_pct: 0 }, alerts: [] } }), false);
});
