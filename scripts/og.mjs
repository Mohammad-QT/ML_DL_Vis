// Regenerates the social preview in public/og.png. Run with:
//   node scripts/og.mjs
import sharp from 'sharp';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const theme = readFileSync(new URL('../src/styles/theme.css', import.meta.url), 'utf8');
const dark = theme.match(/:root\[data-theme="dark"\]\s*\{([^}]+)\}/)?.[1];
if (!dark) throw new Error('Missing dark theme in src/styles/theme.css');

function color(name) {
  const value = dark.match(new RegExp(`^\\s*--${name}\\s*:\\s*([^;]+);`, 'm'))?.[1].trim();
  if (!value || !/^(?:#[\da-f]{3,8}|rgba\([\d.,\s]+\))$/i.test(value)) {
    throw new Error(`Missing or unsupported dark theme colour --${name}`);
  }
  return value;
}

const ink = color('ink');
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <pattern id="grid" width="30" height="30" patternUnits="userSpaceOnUse">
      <path d="M0.5 30V0.5H30" fill="none" stroke="${color('grid')}"/>
    </pattern>
  </defs>
  <rect width="1200" height="630" fill="${color('paper')}"/>
  <rect width="1200" height="630" fill="url(#grid)"/>
  <text x="80" y="223" fill="${ink}" font-family="Georgia, DejaVu Serif, Times New Roman, serif" font-size="88" font-weight="bold">AI Visual</text>
  <text fill="${color('muted')}" font-family="Arial, Liberation Sans, sans-serif" font-size="34">
    <tspan x="80" y="404">Watch machine learning and</tspan>
    <tspan x="80" dy="46">deep learning models draw their</tspan>
    <tspan x="80" dy="46">decisions, live in your browser.</tspan>
  </text>
  <path d="M640 470 C712 470 757 365 825 296 S1010 163 1140 150" fill="none"
    stroke="${ink}" stroke-opacity=".8" stroke-width="7" stroke-linecap="round"/>
  <g fill="${color('a')}">
    <circle cx="700" cy="400" r="14"/>
    <circle cx="780" cy="330" r="14"/>
    <circle cx="860" cy="250" r="14"/>
    <circle cx="960" cy="330" r="14"/>
  </g>
  <g fill="${color('b')}">
    <circle cx="760" cy="500" r="14"/>
    <circle cx="900" cy="440" r="14"/>
    <circle cx="1010" cy="260" r="14"/>
    <circle cx="1090" cy="360" r="14"/>
  </g>
</svg>`;

const out = fileURLToPath(new URL('../public/og.png', import.meta.url));
await sharp(Buffer.from(svg)).png().toFile(out);
console.log('social preview written');
