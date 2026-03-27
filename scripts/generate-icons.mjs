import sharp from 'sharp';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const svgBuffer = readFileSync(resolve(root, 'public/favicon.svg'));

const sizes = [
  { name: 'icon-192.png', size: 192 },
  { name: 'icon-512.png', size: 512 },
  { name: 'icon-512-maskable.png', size: 512, maskable: true },
];

for (const { name, size, maskable } of sizes) {
  let pipeline = sharp(svgBuffer).resize(size, size);

  if (maskable) {
    // maskable 아이콘은 안전 영역(80%)에 맞춰 패딩 추가
    const padding = Math.round(size * 0.1);
    const innerSize = size - padding * 2;
    const inner = await sharp(svgBuffer).resize(innerSize, innerSize).png().toBuffer();

    await sharp({
      create: {
        width: size,
        height: size,
        channels: 4,
        background: { r: 37, g: 99, b: 235, alpha: 1 },
      },
    })
      .composite([{ input: inner, left: padding, top: padding }])
      .png()
      .toFile(resolve(root, 'public/icons', name));
  } else {
    await pipeline.png().toFile(resolve(root, 'public/icons', name));
  }

  console.log(`Generated: public/icons/${name} (${size}x${size})`);
}
