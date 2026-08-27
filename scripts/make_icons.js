/* Render the home-screen / PWA icons from assets/logo-light.svg.

   iOS will not accept an SVG for `apple-touch-icon`, and it does not
   composite transparency — a PNG with an alpha channel gets a black
   background on the home screen. So every icon here is a flat PNG on the
   dashboard's taupe ground, which is also what the brief asked for.

   iOS applies its own rounded-corner mask, so these are drawn square with
   no radius of their own. The maskable variant carries extra padding
   because Android may crop it to a circle: everything important has to sit
   inside the middle ~80% "safe zone".

   Usage:  node scripts/make_icons.js
   Needs Playwright's chromium (dev-only; not a runtime dependency of the
   site, which ships as static files).
*/
"use strict";

const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const ROOT = path.join(__dirname, "..");
const SVG = fs.readFileSync(path.join(ROOT, "assets", "logo-light.svg"), "utf8");
const OUT = path.join(ROOT, "assets", "icons");

// --m-ground from assets/theme.css, i.e. the light theme's page background.
const TAUPE = "#e3dbcb";

/* size, filename, and how much of the square the mark fills. Standard icons
   sit at 62%; the maskable one drops to 52% so a circular crop can't clip it. */
const TARGETS = [
  { file: "apple-touch-icon.png", size: 180, scale: 62 },
  { file: "icon-192.png",         size: 192, scale: 62 },
  { file: "icon-512.png",         size: 512, scale: 62 },
  { file: "icon-maskable-512.png", size: 512, scale: 52 },
];

function page(size, scale) {
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    html,body{margin:0;padding:0;}
    body{width:${size}px;height:${size}px;background:${TAUPE};
         display:flex;align-items:center;justify-content:center;overflow:hidden;}
    svg{height:${scale}%;width:auto;display:block;}
  </style></head><body>${SVG}</body></html>`;
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });

  for (const t of TARGETS) {
    const p = await browser.newPage({ viewport: { width: t.size, height: t.size } });
    await p.setContent(page(t.size, t.scale), { waitUntil: "load" });
    await p.screenshot({ path: path.join(OUT, t.file), omitBackground: false });
    await p.close();
    console.log(`wrote assets/icons/${t.file}  ${t.size}x${t.size}`);
  }

  await browser.close();
})().catch(e => { console.error(e.message); process.exit(1); });
