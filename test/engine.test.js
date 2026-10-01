// Tests for the financial engine inside app.html (the part above "state").
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const html = fs.readFileSync(new URL("../app.html", import.meta.url), "utf8");
const script = html.split("<script>")[1].split("</script>")[0];
const engineSrc = script.split("/* ================= state")[0];
const ctx = vm.createContext({});
vm.runInContext(engineSrc + ";globalThis.api={runEngine,engineWarnings,detScores,makeProfile,TEMPLATES,BASE,clone,COLS,EXAMPLE_BIZ};", ctx);
const { runEngine, engineWarnings, detScores, makeProfile, TEMPLATES, COLS, EXAMPLE_BIZ } = ctx.api;

test("page script parses", () => {
  assert.doesNotThrow(() => new Function(script));
});

for (const key of Object.keys(TEMPLATES)) {
  test(`template ${key}: balance sheet balances and months sum to years`, () => {
    const E = runEngine(makeProfile(key));
    assert.equal(E.rows.length, 36);
    assert.ok(E.maxGap < 1, `balance gap ${E.maxGap}`);
    assert.ok(E.sumCheck);
  });
}

test("break-even = fixed costs / contribution per unit", () => {
  const p = makeProfile("other");
  Object.assign(p, { price: 100000, varPerUnit: 40000, feePct: 10, currentUnits: 10, targetUnits: 20,
    staff: [{ role: "x", payType: "fixed", amount: 1000000 }], fixedCosts: [{ name: "rent", amount: 3000000, mkt: false }] });
  const E = runEngine(p);
  // contribution = 100000*(1-0.10) - 40000 = 50000; fixed = 4,000,000
  assert.equal(E.cpu, 50000);
  assert.equal(E.fixedMonthly, 4000000);
  assert.equal(E.bep, 80);
});

test("units never exceed capacity", () => {
  const p = makeProfile("school");
  p.targetUnits = 1000;
  const E = runEngine(p);
  assert.ok(E.rows.every((r) => r.units <= p.capacity + 1e-9));
  assert.ok(engineWarnings(p, E).some((w) => w.text.includes("ظرفیت")));
});

test("no payback is reported without an investment", () => {
  const p = makeProfile("other");
  Object.assign(p, { price: 100000, currentUnits: 10, targetUnits: 10, initialInvest: 0 });
  assert.equal(runEngine(p).payback, null);
});

test("negative cash raises a critical warning and a zero cash score", () => {
  const p = makeProfile("cafe");
  p.startCash = 0; p.currentUnits = 100; p.targetUnits = 200;
  const E = runEngine(p);
  assert.ok(E.minCash.cash < 0);
  assert.ok(engineWarnings(p, E).some((w) => w.sev === "critical" && w.text.includes("نقدینگی")));
  assert.equal(detScores(p, E).parts.cash, 0);
});

test("a missing mandatory permit is a blocker", () => {
  const p = makeProfile("salon");
  const D = detScores(p, runEngine(p));
  assert.ok(D.blockers.length > 0);
  p.reqs.forEach((r) => (r.status = "yes"));
  assert.equal(detScores(p, runEngine(p)).blockers.length, 0);
});

test("public/index.html is built from the current app.html", () => {
  const built = fs.readFileSync(new URL("../public/index.html", import.meta.url), "utf8");
  assert.ok(built.includes(html), "run: npm run build:page");
});

test("every text section has a professional example about the imaginary business only", () => {
  for (const c of COLS) for (const s of c.sections) {
    if (s.k === "engine") continue;
    assert.ok(s.eg && s.eg.length > 80, `pillar ${c.id} section ${s.no} has no example`);
  }
  // the example business must not collide with any template name
  for (const k of Object.keys(TEMPLATES)) assert.ok(!makeProfile(k).name.includes(EXAMPLE_BIZ));
});
