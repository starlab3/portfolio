import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import { exiftool } from 'exiftool-vendored';
import exifr from 'exifr';
import { processImage } from '../scripts/process-photos.mjs';

let dir: string;
let input: string;

beforeAll(async () => {
  dir = await mkdtemp(path.join(tmpdir(), 'pp-'));
  input = path.join(dir, 'in.jpg');
  // a 3000px test image so resize has something to do
  await sharp({ create: { width: 3000, height: 2000, channels: 3, background: '#888' } })
    .jpeg().toFile(input);
  // write EXIF: date, exposure, AND GPS (GPS must be stripped; the rest kept)
  await exiftool.write(input, {
    DateTimeOriginal: '2024:03:14 06:30:00',
    ExposureTime: '1/500',
    FNumber: 2.8,
    ISO: 100,
    GPSLatitude: 48.8584,
    GPSLatitudeRef: 'N',
    GPSLongitude: 2.2945,
    GPSLongitudeRef: 'E',
  }, ['-overwrite_original']);
});

afterAll(async () => {
  await exiftool.end();
  await rm(dir, { recursive: true, force: true });
});

describe('processImage', () => {
  it('resizes to <=2500px, strips GPS, keeps date/exposure', async () => {
    const out = path.join(dir, 'out.jpg');
    await processImage(input, out);

    const meta = await sharp(out).metadata();
    expect(Math.max(meta.width!, meta.height!)).toBeLessThanOrEqual(2500);

    const exif = await exifr.parse(out, { pick: ['DateTimeOriginal', 'FNumber', 'ISO'], gps: true });
    expect(exif.FNumber).toBe(2.8);
    expect(exif.ISO).toBe(100);
    expect(exif.DateTimeOriginal).toBeInstanceOf(Date);

    const gps = await exifr.gps(out).catch(() => null);
    expect(gps ?? null).toBeNull(); // GPS removed (exifr.gps returns undefined when absent)
  });

  it('embeds copyright and creator metadata', async () => {
    const out = path.join(dir, 'out-copyright.jpg');
    await processImage(input, out);

    const exif = await exifr.parse(out, { pick: ['Copyright', 'Artist'] });
    expect(exif.Copyright).toContain('Constance Starcky');
    expect(exif.Artist).toBe('Constance Starcky');
  });
});
