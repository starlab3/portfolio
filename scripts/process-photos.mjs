// scripts/process-photos.mjs
import { readdir, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { exiftool } from 'exiftool-vendored';

const MAX_EDGE = 2500;
const CREATOR = 'Constance Starcky';
const COPYRIGHT = '© Constance Starcky. All rights reserved.';

/**
 * Resize one image to a web master and strip GPS while keeping other EXIF.
 * Exported for testing.
 */
export async function processImage(inputPath, outputPath) {
  await mkdir(path.dirname(outputPath), { recursive: true });
  // Sharp: auto-orient, downscale, keep EXIF (incl. GPS, removed next).
  await sharp(inputPath)
    .rotate()
    .resize({ width: MAX_EDGE, height: MAX_EDGE, fit: 'inside', withoutEnlargement: true })
    .withMetadata()
    .jpeg({ quality: 82, progressive: true })
    .toFile(outputPath);
  // Remove GPS, embed copyright/creator; date/exposure remain.
  await exiftool.write(outputPath, {
    Artist: CREATOR,
    Copyright: COPYRIGHT,
    'IPTC:By-line': CREATOR,
    'IPTC:CopyrightNotice': COPYRIGHT,
    'XMP-dc:Creator': CREATOR,
    'XMP-dc:Rights': COPYRIGHT,
  }, ['-gps:all=', '-overwrite_original']);
}

const IMG_RE = /\.(jpe?g)$/i;

async function main() {
  const inbox = '_inbox';
  if (!existsSync(inbox)) {
    console.error(`No "${inbox}/" folder. Create _inbox/<album-slug>/ and add originals.`);
    process.exit(1);
  }
  const albums = (await readdir(inbox, { withFileTypes: true }))
    .filter((d) => d.isDirectory())
    .map((d) => d.name);

  let total = 0;
  for (const album of albums) {
    const files = (await readdir(path.join(inbox, album))).filter((f) => IMG_RE.test(f));
    for (const file of files) {
      const out = path.join('photos', album, file.replace(IMG_RE, '.jpg'));
      await processImage(path.join(inbox, album, file), out);
      console.log(`✓ ${album}/${file} → ${out}`);
      total++;
    }
  }
  await exiftool.end();
  console.log(`Done. Processed ${total} photo(s). Add captions to photos/<album>/album.yaml, then git push.`);
}

// Run main only when invoked as a CLI (not when imported by tests).
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
