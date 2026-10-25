// Rasterise public/favicon.svg into the PNG icons the layout ships.
//
// iOS ignores `rel="icon"` SVGs and falls back to a screenshot of the page, so
// `public/apple-touch-icon.png` (180×180, declared in Base.astro) has to be a
// real raster. It is flattened onto the mark's own fill: the hexagon then reads
// as a full square, which is the shape iOS rounds off itself.
//
// Run after editing the SVG: `bun run icons`. The layout versions both files by
// content hash, so a regenerated icon reaches the browser without a manual bump.

import path from 'node:path';
import sharp from 'sharp';

const ROOT = process.cwd();
const SVG = path.join(ROOT, 'public/favicon.svg');
const OUT = path.join(ROOT, 'public/apple-touch-icon.png');
const FILL = '#1400c3';

await sharp(SVG, { density: 720 })
  .resize(180, 180)
  .flatten({ background: FILL })
  .png()
  .toFile(OUT);

console.log('wrote public/apple-touch-icon.png (180x180)');
