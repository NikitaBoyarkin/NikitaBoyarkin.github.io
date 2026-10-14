import { chromium } from "playwright";

const BASE = process.env.BASE ?? "http://localhost:4321";
const SHOT = "/private/var/folders/pg/3tkd56hn1h56w17r97f6bfqr0000gn/T/opencode";
const browser = await chromium.launch();
let failures = 0;
const check = (ok, msg) => { console.log(`  ${ok ? "PASS" : "FAIL"}  ${msg}`); if (!ok) failures++; };

async function fullscreenProbe(url, label, viewport, theme) {
  const page = await browser.newPage({ viewport });
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto(url, { waitUntil: "networkidle" });
  if (theme !== "dark") await page.evaluate((t) => document.documentElement.setAttribute("data-theme", t), theme);
  await page.waitForTimeout(1200);

  const geo = () => page.evaluate(() => {
    const root = document.querySelector("#kg-root");
    const svg = document.querySelector("#kg-svg");
    const r = root.getBoundingClientRect();
    const s = svg.getBoundingClientRect();
    const vb = svg.getAttribute("viewBox").split(/\s+/).map(Number);
    const k = Math.min(s.width / vb[2], s.height / vb[3]);
    return {
      root: [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)],
      drawing: [Math.round(vb[2] * k), Math.round(vb[3] * k)],
      cls: root.className,
    };
  });

  console.log(`\n### ${label} @ ${viewport.width}x${viewport.height} ${theme}`);
  const closed = await geo();
  check(closed.root[2] < viewport.width || closed.root[3] < viewport.height, `closed board is smaller than the window (${closed.root[2]}x${closed.root[3]})`);

  await page.click('[data-kg-action="fullscreen"]');
  await page.waitForTimeout(800);
  const open = await geo();
  check(open.root[0] === 0 && open.root[1] === 0 && open.root[2] === viewport.width && open.root[3] === viewport.height,
    `overlay covers the viewport (${open.root.join(",")})`);
  check(open.cls.includes("kg-fullscreen"), "kg-fullscreen class is set");
  check(open.drawing[1] > closed.drawing[1], `drawing grew ${closed.drawing.join("x")} -> ${open.drawing.join("x")}`);
  // the drawing should use the whole height it is given
  const drawnHeightFrac = open.drawing[1] / viewport.height;
  check(drawnHeightFrac > 0.6, `drawing uses ${(drawnHeightFrac * 100).toFixed(0)}% of the viewport height`);

  await page.screenshot({ path: `${SHOT}/verify-${label}-${viewport.width}-${theme}.png` });

  // Escape exits and restores the embedded board
  await page.keyboard.press("Escape");
  await page.waitForTimeout(500);
  const back = await geo();
  check(!back.cls.includes("kg-fullscreen") && back.root[2] === closed.root[2], `Escape restores the board (${back.root.join(",")})`);

  check(errors.length === 0, `no page errors${errors.length ? ": " + errors.join(" | ") : ""}`);
  await page.close();
}

// The reveal animation must still animate after switching to `transform: none`.
{
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  // delay the observer so we can sample mid-transition
  await page.goto(`${BASE}/graph/`, { waitUntil: "commit" });
  const samples = [];
  for (let i = 0; i < 12; i++) {
    samples.push(await page.evaluate(() => {
      const s = document.querySelector(".graph-board.reveal");
      if (!s) return null;
      const cs = getComputedStyle(s);
      return { op: cs.opacity, tr: cs.transform };
    }).catch(() => null));
    await page.waitForTimeout(80);
  }
  const real = samples.filter(Boolean);
  const opacities = real.map((s) => Number(s.op));
  console.log("\n### reveal animation still animates");
  check(opacities.some((o) => o > 0 && o < 1), `opacity passes through intermediate values (${opacities.map((o) => o.toFixed(2)).join(" ")})`);
  const last = real.at(-1);
  check(last.tr === "none", `settled transform is none (got ${last.tr})`);
  await page.close();
}

for (const [vp, theme] of [[{ width: 1440, height: 900 }, "dark"], [{ width: 1024, height: 700 }, "light"], [{ width: 375, height: 667 }, "cyberpunk"]]) {
  await fullscreenProbe(`${BASE}/graph/`, "ru", vp, theme);
}
await fullscreenProbe(`${BASE}/en/graph/`, "en", { width: 1280, height: 800 }, "dark");

console.log(`\n=== ${failures === 0 ? "ALL CHECKS PASSED" : failures + " CHECK(S) FAILED"} ===`);
await browser.close();
process.exit(failures ? 1 : 0);
