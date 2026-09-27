/**
 * Temporary readability probe. Measures, per prose selector on a page:
 *   - computed font-size / line-height / color
 *   - contrast of that color against its nearest opaque ancestor background
 *   - characters per line (widest line box / average advance of the same face)
 *   - the declared measure (max-width) resolved to px
 * Prints a table, then screenshots. Run: bun _tmp-readability-audit.mjs [label]
 */
import { chromium } from "playwright";

const PORT = process.env.PORT ?? "4399";
const LABEL = process.argv[2] ?? "before";
const BASE = `http://localhost:${PORT}`;

/** selector -> human role, per page */
const TARGETS = {
  "/projects/posthog/": [
    ["#project-content > p", "project prose"],
    ["#project-content > ul", "project list"],
    ["#project-content > h2", "project h2"],
    ["#project-content > table", "project table"],
  ],
  "/posts/dashboards-that-dont-lie/": [
    [".post-content p", "post prose"],
    [".post-content li", "post list"],
    [".post-content h2", "post h2"],
  ],
  "/": [
    [".hero-body", "hero prose"],
    [".featured-card-description", "featured prose"],
    [".bento-cell-text", "bento prose"],
  ],
};

// The site reads `localStorage.theme`, else prefers-color-scheme. Dark is the
// SSR default and the identity, so it leads; the other two are checked too.
const THEMES = ["dark", "light", "cyberpunk"];

const SIZES = [
  { name: "desktop", width: 1440, height: 1000 },
  { name: "mobile", width: 390, height: 844 },
];

const browser = await chromium.launch();
const rows = [];

for (const [path, targets] of Object.entries(TARGETS)) {
  for (const theme of THEMES) {
    for (const size of SIZES) {
      const page = await browser.newPage({
        viewport: { width: size.width, height: size.height },
        deviceScaleFactor: 2,
      });
      await page.addInitScript((t) => {
        try {
          localStorage.setItem("theme", t);
        } catch {
          /* storage unavailable */
        }
      }, theme);
      await page.goto(BASE + path, { waitUntil: "networkidle" });
      await page.evaluate(() => document.fonts.ready);

    const measured = await page.evaluate((targets) => {
      const parseRgb = (s) => {
        const m = s.match(/rgba?\(([^)]+)\)/);
        if (!m) return null;
        const p = m[1].split(/[,/]/).map((v) => parseFloat(v));
        return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
      };
      const lin = (c) => {
        c /= 255;
        return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
      };
      const lum = ({ r, g, b }) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
      const ratio = (a, b) => {
        const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
        return (hi + 0.05) / (lo + 0.05);
      };
      // Walk up for the first background that is not transparent.
      const bgOf = (el) => {
        let n = el;
        while (n && n !== document.documentElement) {
          const c = parseRgb(getComputedStyle(n).backgroundColor);
          if (c && c.a > 0.9) return c;
          n = n.parentElement;
        }
        return parseRgb(getComputedStyle(document.documentElement).backgroundColor);
      };
      // Average advance of the element's own face, measured on a hidden probe.
      const advanceOf = (el) => {
        const cs = getComputedStyle(el);
        const probe = document.createElement("span");
        probe.textContent = "x".repeat(200);
        Object.assign(probe.style, {
          position: "absolute",
          visibility: "hidden",
          whiteSpace: "pre",
          fontFamily: cs.fontFamily,
          fontSize: cs.fontSize,
          fontWeight: cs.fontWeight,
          letterSpacing: cs.letterSpacing,
        });
        document.body.appendChild(probe);
        const w = probe.getBoundingClientRect().width / 200;
        probe.remove();
        return w;
      };

      return targets.map(([sel, role]) => {
        const el = document.querySelector(sel);
        if (!el) return { role, sel, missing: true };
        const cs = getComputedStyle(el);
        const color = parseRgb(cs.color);
        const bg = bgOf(el);
        // Widest rendered line box, over the first 6 wraps of the node.
        const range = document.createRange();
        range.selectNodeContents(el);
        const lineWidths = [...range.getClientRects()].map((r) => r.width);
        const widest = lineWidths.length ? Math.max(...lineWidths) : 0;
        const adv = advanceOf(el);
        const block = el.closest("article, section, div");
        return {
          role,
          sel,
          fontPx: parseFloat(cs.fontSize),
          lineHeight: cs.lineHeight,
          color: cs.color,
          contrast: color && bg ? +ratio(color, bg).toFixed(2) : null,
          lines: lineWidths.length,
          widestLinePx: Math.round(widest),
          charPerLine: adv ? Math.round(widest / adv) : null,
          declaredMeasurePx: Math.round(el.getBoundingClientRect().width),
          containerPx: block ? Math.round(block.getBoundingClientRect().width) : null,
          justify: cs.textAlign,
        };
      });
    }, targets);

    rows.push({ path, theme, size: size.name, measured });
    await page.close();
    }
  }
}

for (const r of rows) {
  console.log(`\n### ${r.path} @ ${r.theme} / ${r.size}`);
  console.log(
    "role".padEnd(20) +
      "px".padStart(6) +
      "contrast".padStart(10) +
      "ch/line".padStart(9) +
      "width".padStart(8) +
      "align".padStart(10)
  );
  for (const m of r.measured) {
    if (m.missing) {
      console.log(`${m.role.padEnd(20)}  (not found: ${m.sel})`);
      continue;
    }
    console.log(
      m.role.padEnd(20) +
        String(m.fontPx).padStart(6) +
        String(m.contrast ?? "-").padStart(10) +
        String(m.charPerLine ?? "-").padStart(9) +
        String(m.declaredMeasurePx).padStart(8) +
        String(m.justify).padStart(10)
    );
  }
}

// Screenshots for the eye.
for (const [path, name] of [
  ["/projects/posthog/", "project"],
  ["/posts/dashboards-that-dont-lie/", "post"],
]) {
  for (const size of SIZES) {
    const page = await browser.newPage({
      viewport: { width: size.width, height: size.height },
      deviceScaleFactor: 2,
    });
    await page.addInitScript(() => {
      try {
        localStorage.setItem("theme", "dark");
      } catch {
        /* storage unavailable */
      }
    });
    await page.goto(BASE + path, { waitUntil: "networkidle" });
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({
      path: `reports/readability/${LABEL}-${name}-${size.name}.png`,
      fullPage: size.name === "mobile",
    });
    await page.close();
  }
}

await browser.close();
console.log(`\nScreenshots -> reports/readability/${LABEL}-*.png`);
