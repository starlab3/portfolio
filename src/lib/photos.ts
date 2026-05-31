import type { ImageMetadata } from 'astro';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import exifr from 'exifr';
import { formatFallback, type PhotoExif } from './exif';

// Eagerly import every album image as optimizable ImageMetadata.
const imageModules = import.meta.glob<{ default: ImageMetadata }>(
  '/photos/*/*.{jpg,jpeg,JPG,JPEG}',
  { eager: true },
);

function keysForAlbum(slug: string): string[] {
  const prefix = `/photos/${slug}/`;
  return Object.keys(imageModules)
    .filter((k) => k.startsWith(prefix))
    .sort(); // stable; chronological re-sort happens in getAlbumPhotos
}

export function getAlbumImageCount(slug: string): number {
  return keysForAlbum(slug).length;
}

export function getCover(slug: string, coverFilename: string): ImageMetadata {
  const key = `/photos/${slug}/${coverFilename}`;
  const mod = imageModules[key];
  if (!mod) throw new Error(`Cover "${coverFilename}" not found for album "${slug}"`);
  return mod.default;
}

export interface AssembledPhoto {
  filename: string;
  src: ImageMetadata;
  caption: string; // manual caption OR EXIF fallback OR ''
  alt: string;
  date: number; // epoch ms for sorting (0 if unknown)
}

type CaptionMeta = Record<string, { caption?: string; location?: string }>;

export async function getAlbumPhotos(
  slug: string,
  photosMeta: CaptionMeta,
): Promise<AssembledPhoto[]> {
  const out: AssembledPhoto[] = [];

  for (const key of keysForAlbum(slug)) {
    const filename = key.split('/').pop()!;
    const src = imageModules[key].default;

    const abs = path.join(process.cwd(), key.replace(/^\//, ''));
    const buf = await readFile(abs);
    const exif = (await exifr
      .parse(buf, { pick: ['DateTimeOriginal', 'ExposureTime', 'FNumber', 'ISO'] })
      .catch(() => ({}))) as PhotoExif;

    const meta = photosMeta[filename] ?? {};
    const manual = meta.caption
      ? meta.location
        ? `${meta.caption} · ${meta.location}`
        : meta.caption
      : '';
    const caption = manual || formatFallback(exif);

    out.push({
      filename,
      src,
      caption,
      alt: meta.caption ?? `Photo from ${slug}`,
      date: exif.DateTimeOriginal instanceof Date ? +exif.DateTimeOriginal : 0,
    });
  }

  // chronological; unknown dates (0) fall back to filename order at the front
  out.sort((a, b) => a.date - b.date || a.filename.localeCompare(b.filename));
  return out;
}
