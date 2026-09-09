import test from "node:test";
import assert from "node:assert/strict";
process.env.AUTH_REQUIRED = "scheduled";
const { authRequired } = await import("../server.mjs");
test("midnight to 8am follows New York daylight saving time", () => {
  for (const [time, expected] of [
    ["2026-09-09T03:59:59Z", false], ["2026-09-09T04:00:00Z", true],
    ["2026-09-09T11:59:59Z", true], ["2026-09-09T12:00:00Z", false],
    ["2026-12-09T04:59:59Z", false], ["2026-12-09T05:00:00Z", true],
    ["2026-12-09T12:59:59Z", true], ["2026-12-09T13:00:00Z", false],
  ]) assert.equal(authRequired(new Date(time)), expected, time);
});
