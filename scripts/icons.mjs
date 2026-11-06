// Renders the app icons in public/icons/ from the brand mark (public/favicon.svg). Run once after changing the mark:
//   node scripts/icons.mjs
import sharp from 'sharp';
import { readFileSync } from 'node:fs';

const mark = readFileSync(new URL('../public/favicon.svg', import.meta.url));
const out = (f) => new URL(`../public/icons/${f}`, import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');

// the mark on its own (rounded square, transparent corners)
for (const size of [192, 512]) {
  await sharp(mark, { density: (size / 28) * 72 }).resize(size, size).png().toFile(out(`icon-${size}.png`));
}

// the mark centred on the dark paper colour, for launchers that crop icons (maskable) and for iOS
async function onPaper(size, share, file) {
  const inner = Math.round(size * share);
  const glyph = await sharp(mark, { density: (inner / 28) * 72 }).resize(inner, inner).png().toBuffer();
  await sharp({ create: { width: size, height: size, channels: 4, background: '#0d161e' } })
    .composite([{ input: glyph, gravity: 'center' }]).png().toFile(out(file));
}
await onPaper(512, 0.6, 'maskable-512.png');
await onPaper(180, 0.72, 'apple-touch-icon.png');
console.log('icons written');
