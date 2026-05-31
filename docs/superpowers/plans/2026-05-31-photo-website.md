# Trip Photo Website Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a custom, statically-generated Astro photo site that shows trip albums (homepage = hover-reveal cover grid, album pages = full-width immersive scroll), deployed on Netlify, where adding photos is "drop originals → run `npm run photos` → `git push`".

**Architecture:** Each trip is a folder `photos/<slug>/` holding web-sized JPEGs plus an `album.yaml`. An Astro content collection (`albums`) validates the YAML via Zod. Image files are enumerated with `import.meta.glob` and optimized by `astro:assets`; per-photo captions come from `album.yaml`, falling back to EXIF date + exposure read at build time. A Node script (`npm run photos`) resizes originals to ~2500px web masters and strips GPS while keeping date/exposure EXIF.

**Tech Stack:** Astro 5, `astro:assets` (Sharp), `astro/loaders` glob loader + Zod, `exifr` (build-time EXIF read), `sharp` + `exiftool-vendored` (resize script), Formspree (contact form), Vitest (unit tests), Netlify (hosting).

---

## File Structure

```
photos/<slug>/album.yaml        # per-trip metadata + caption map (hand-edited)
photos/<slug>/*.jpg             # web-sized masters (committed; produced by npm run photos)
_inbox/<slug>/*.jpg             # full-res originals to process (gitignored)

scripts/process-photos.mjs      # resize + GPS-strip; backs `npm run photos`

src/lib/album-schema.ts         # Zod schema for an album (Vitest-safe, no astro:content)
src/content.config.ts           # `albums` collection: glob(YAML) + imports albumSchema
src/lib/exif.ts                 # pure formatters: formatExposure, formatFallback
src/lib/photos.ts               # image glob, EXIF read, per-album photo assembly
src/layouts/Base.astro          # html shell, global styles, Nav + Footer
src/components/Nav.astro        # brand · Portfolio · Contact
src/components/Footer.astro     # no email, no socials
src/components/AlbumCard.astro  # homepage cover tile (hover-reveal title/date/count)
src/components/Photo.astro      # one responsive <Image> + optional caption
src/pages/index.astro           # homepage trip index (2-col cover grid)
src/pages/[album].astro         # album page (full-width scroll)
src/pages/contact.astro         # Formspree form
src/styles/global.css           # light theme tokens + shared rules

netlify.toml                    # build command + publish dir
tests/exif.test.ts              # unit tests for formatters
tests/schema.test.ts            # albums schema accept/reject
tests/process-photos.test.ts    # GPS stripped, date/exposure retained
README.md                       # add-photo workflow
```

---

## Task 1: Scaffold Astro project + tooling

**Files:**
- Create: `package.json`, `astro.config.mjs`, `tsconfig.json`, `vitest.config.ts`, `src/pages/index.astro` (temporary)

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "website-photos",
  "type": "module",
  "version": "0.1.0",
  "scripts": {
    "dev": "astro dev",
    "build": "astro build",
    "preview": "astro preview",
    "test": "vitest run",
    "photos": "node scripts/process-photos.mjs"
  },
  "dependencies": {
    "astro": "^5.0.0",
    "sharp": "^0.33.0",
    "exifr": "^7.1.3",
    "exiftool-vendored": "^28.0.0",
    "zod": "^3.23.0"
  },
  "devDependencies": {
    "vitest": "^2.1.0"
  }
}
```

- [ ] **Step 2: Create `astro.config.mjs`**

```js
import { defineConfig } from 'astro/config';

export default defineConfig({
  // Static output (default). astro:assets optimizes imported images at build.
  image: {
    // allow large source images
    service: { entrypoint: 'astro/assets/services/sharp' },
  },
});
```

- [ ] **Step 3: Create `tsconfig.json`**

```json
{
  "extends": "astro/tsconfigs/strict",
  "include": [".astro/types.d.ts", "**/*"],
  "exclude": ["dist"]
}
```

- [ ] **Step 4: Create `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: { include: ['tests/**/*.test.ts'] },
});
```

- [ ] **Step 5: Create a temporary `src/pages/index.astro`** (replaced in Task 6)

```astro
<html><body><h1>scaffold</h1></body></html>
```

- [ ] **Step 6: Install dependencies**

Run: `npm install`
Expected: completes; `node_modules/` populated (gitignored already).

- [ ] **Step 7: Verify build works**

Run: `npm run build`
Expected: "Complete!" and a `dist/index.html` is produced.

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json astro.config.mjs tsconfig.json vitest.config.ts src/pages/index.astro
git commit -m "Scaffold Astro project and tooling"
```

---

## Task 2: EXIF fallback formatters (pure, TDD)

**Files:**
- Create: `src/lib/exif.ts`
- Test: `tests/exif.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/exif.test.ts
import { describe, it, expect } from 'vitest';
import { formatExposure, formatFallback } from '../src/lib/exif';

describe('formatExposure', () => {
  it('formats fast shutter as a fraction', () => {
    expect(formatExposure(0.002)).toBe('1/500s');
  });
  it('formats slow shutter as seconds', () => {
    expect(formatExposure(2)).toBe('2s');
  });
});

describe('formatFallback', () => {
  it('combines month-year and exposure triplet', () => {
    const out = formatFallback({
      DateTimeOriginal: new Date('2024-03-14T06:30:00'),
      ExposureTime: 0.002,
      FNumber: 2.8,
      ISO: 100,
    });
    expect(out).toBe('March 2024 · 1/500s · f/2.8 · ISO 100');
  });
  it('omits missing fields gracefully', () => {
    expect(formatFallback({ DateTimeOriginal: new Date('2023-09-01T00:00:00') }))
      .toBe('September 2023');
  });
  it('returns empty string when nothing is known', () => {
    expect(formatFallback({})).toBe('');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/exif.test.ts`
Expected: FAIL — "Failed to resolve import '../src/lib/exif'".

- [ ] **Step 3: Write minimal implementation**

```ts
// src/lib/exif.ts
export interface PhotoExif {
  DateTimeOriginal?: Date;
  ExposureTime?: number;
  FNumber?: number;
  ISO?: number;
}

export function formatExposure(seconds: number): string {
  if (seconds >= 1) return `${seconds}s`;
  return `1/${Math.round(1 / seconds)}s`;
}

export function formatFallback(exif: PhotoExif): string {
  const parts: string[] = [];

  if (exif.DateTimeOriginal instanceof Date && !isNaN(+exif.DateTimeOriginal)) {
    parts.push(exif.DateTimeOriginal.toLocaleDateString('en-US', {
      month: 'long',
      year: 'numeric',
    }));
  }
  if (typeof exif.ExposureTime === 'number') parts.push(formatExposure(exif.ExposureTime));
  if (typeof exif.FNumber === 'number') parts.push(`f/${exif.FNumber}`);
  if (typeof exif.ISO === 'number') parts.push(`ISO ${exif.ISO}`);

  return parts.join(' · ');
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/exif.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/exif.ts tests/exif.test.ts
git commit -m "Add EXIF fallback formatters with tests"
```

---

## Task 3: Albums content collection + schema (TDD on the schema)

**Files:**
- Create: `src/lib/album-schema.ts`, `src/content.config.ts`
- Test: `tests/schema.test.ts`

The schema lives in its own module that imports only `zod` (no `astro:content`), so Vitest can import it directly. `content.config.ts` re-uses it for the loader.

- [ ] **Step 1: Write the failing test**

```ts
// tests/schema.test.ts
import { describe, it, expect } from 'vitest';
import { albumSchema } from '../src/lib/album-schema';

const valid = {
  title: 'Patagonia',
  description: 'Two weeks on the circuit',
  date: '2024-03',
  cover: 'DSC_4551.jpg',
  photos: { 'DSC_4551.jpg': { caption: 'Sunrise', location: 'Torres del Paine' } },
};

describe('albumSchema', () => {
  it('accepts a valid album', () => {
    expect(albumSchema.safeParse(valid).success).toBe(true);
  });
  it('defaults photos to an empty object when omitted', () => {
    const { photos, ...noPhotos } = valid;
    const parsed = albumSchema.parse(noPhotos);
    expect(parsed.photos).toEqual({});
  });
  it('rejects a missing title', () => {
    const { title, ...noTitle } = valid;
    expect(albumSchema.safeParse(noTitle).success).toBe(false);
  });
  it('rejects a malformed date', () => {
    expect(albumSchema.safeParse({ ...valid, date: 'March 2024' }).success).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/schema.test.ts`
Expected: FAIL — cannot resolve `../src/lib/album-schema` / `albumSchema` undefined.

- [ ] **Step 3a: Write the standalone schema `src/lib/album-schema.ts`**

```ts
// src/lib/album-schema.ts
import { z } from 'zod';

export const albumSchema = z.object({
  title: z.string(),
  description: z.string().optional(),
  date: z.string().regex(/^\d{4}-\d{2}$/, 'date must be YYYY-MM'),
  cover: z.string(),
  // per-photo: object value (extensible) keyed by filename
  photos: z
    .record(
      z.string(),
      z.object({
        caption: z.string().optional(),
        location: z.string().optional(),
      }),
    )
    .default({}),
});

export type AlbumData = z.infer<typeof albumSchema>;
```

- [ ] **Step 3b: Write the content config `src/content.config.ts`**

```ts
// src/content.config.ts
import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { albumSchema } from './lib/album-schema';

const albums = defineCollection({
  loader: glob({
    pattern: '*/album.yaml',
    base: './photos',
    // id = folder name (e.g. "patagonia"), not "patagonia/album"
    generateId: ({ entry }) => entry.split('/')[0],
  }),
  schema: albumSchema,
});

export const collections = { albums };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/schema.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/album-schema.ts src/content.config.ts tests/schema.test.ts
git commit -m "Add albums content collection and Zod schema"
```

---

## Task 4: Sample album fixture (web-sized images + YAML)

This gives later tasks real content to render and the build something to validate. We resize two of the existing originals in `photos/*.jpg` into a `sample-trip` album using Sharp directly (the general script comes in Task 9).

**Files:**
- Create: `photos/sample-trip/album.yaml`, `photos/sample-trip/*.jpg` (committed, small)

- [ ] **Step 1: Generate two web-sized sample images**

Run (uses the Sharp installed in Task 1; picks the first two originals, strips metadata for the fixture):

```bash
mkdir -p photos/sample-trip
node --input-type=module -e '
import sharp from "sharp";
import { readdirSync } from "node:fs";
const srcs = readdirSync("photos").filter(f => /\.jpe?g$/i.test(f)).slice(0, 2);
for (let i = 0; i < srcs.length; i++) {
  await sharp(`photos/${srcs[i]}`).rotate().resize({ width: 2500, withoutEnlargement: true })
    .jpeg({ quality: 82, progressive: true })
    .toFile(`photos/sample-trip/sample-${i + 1}.jpg`);
  console.log("wrote", `sample-${i + 1}.jpg`);
}
'
```

Expected: prints `wrote sample-1.jpg` and `wrote sample-2.jpg`; each file is well under 1 MB (`ls -lh photos/sample-trip`).

- [ ] **Step 2: Create `photos/sample-trip/album.yaml`**

```yaml
title: "Sample Trip"
description: "Placeholder album used to validate the build."
date: 2024-03
cover: sample-1.jpg
photos:
  sample-1.jpg:
    caption: "A captioned sample photo"
    location: "Somewhere"
  # sample-2.jpg intentionally omitted to exercise the EXIF fallback
```

- [ ] **Step 3: Verify the collection loads**

Run: `npm run build`
Expected: build succeeds (no schema errors). The temporary index has no album references yet, so nothing renders — we only confirm the YAML parses.

- [ ] **Step 4: Commit**

```bash
git add photos/sample-trip
git commit -m "Add sample-trip album fixture"
```

---

## Task 5: Photos library (image glob + EXIF assembly)

**Files:**
- Create: `src/lib/photos.ts`

Note: `import.meta.glob` patterns must be static string literals, so we glob all album images once at module scope and filter by slug. Images live at repo root `photos/` (not `public/`), so `astro:assets` processes them.

- [ ] **Step 1: Write the library**

```ts
// src/lib/photos.ts
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
    const exif = (await exifr.parse(buf, {
      pick: ['DateTimeOriginal', 'ExposureTime', 'FNumber', 'ISO'],
    }).catch(() => ({}))) as PhotoExif;

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
```

- [ ] **Step 2: Type-check passes**

Run: `npx astro check`
Expected: 0 errors (run after `npm run build` has generated `.astro/types.d.ts`; if `astro:content` types are missing, run `npm run build` once first).

- [ ] **Step 3: Commit**

```bash
git add src/lib/photos.ts
git commit -m "Add photos library: image glob + EXIF assembly"
```

---

## Task 6: Global styles, Base layout, Nav, Footer

**Files:**
- Create: `src/styles/global.css`, `src/layouts/Base.astro`, `src/components/Nav.astro`, `src/components/Footer.astro`

- [ ] **Step 1: Create `src/styles/global.css`** (light theme)

```css
:root {
  --bg: #fafafa;
  --fg: #1a1a1a;
  --muted: #777;
  --line: #e5e5e5;
  --maxw: 680px;
}
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; }
body {
  background: var(--bg);
  color: var(--fg);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
}
a { color: inherit; text-decoration: none; }
img { display: block; }
.container { max-width: 1100px; margin: 0 auto; padding: 0 20px; }
```

- [ ] **Step 2: Create `src/components/Nav.astro`**

```astro
---
const { pathname } = Astro.url;
---
<header class="nav">
  <a class="brand" href="/">Arthur · Travels</a>
  <nav>
    <a href="/" class={pathname === '/' ? 'active' : ''}>Portfolio</a>
    <a href="/contact" class={pathname.startsWith('/contact') ? 'active' : ''}>Contact</a>
  </nav>
</header>

<style>
  .nav {
    display: flex; align-items: center; justify-content: space-between;
    padding: 18px 20px; max-width: 1100px; margin: 0 auto;
  }
  .brand { font-size: 14px; letter-spacing: .18em; text-transform: uppercase; font-weight: 600; }
  nav a { margin-left: 22px; font-size: 13px; letter-spacing: .05em; color: var(--muted); }
  nav a:hover, nav a.active { color: var(--fg); }
</style>
```

- [ ] **Step 3: Create `src/components/Footer.astro`** (no email, no socials)

```astro
<footer class="foot">
  <span>© {new Date().getFullYear()} Arthur Caillau</span>
</footer>

<style>
  .foot {
    border-top: 1px solid var(--line);
    color: var(--muted);
    text-align: center;
    font-size: 12px;
    padding: 30px 20px;
    margin-top: 40px;
  }
</style>
```

- [ ] **Step 4: Create `src/layouts/Base.astro`**

```astro
---
import '../styles/global.css';
import Nav from '../components/Nav.astro';
import Footer from '../components/Footer.astro';

interface Props { title: string; }
const { title } = Astro.props;
---
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>{title}</title>
  </head>
  <body>
    <Nav />
    <main>
      <slot />
    </main>
    <Footer />
  </body>
</html>
```

- [ ] **Step 5: Verify build**

Run: `npm run build`
Expected: build succeeds (layout/components compile; not yet referenced by a page).

- [ ] **Step 6: Commit**

```bash
git add src/styles/global.css src/layouts/Base.astro src/components/Nav.astro src/components/Footer.astro
git commit -m "Add light theme, Base layout, Nav and Footer"
```

---

## Task 7: Homepage trip index + AlbumCard

**Files:**
- Create: `src/components/AlbumCard.astro`
- Modify (replace): `src/pages/index.astro`

- [ ] **Step 1: Create `src/components/AlbumCard.astro`** (2-col card, nevercrew hover reveal)

```astro
---
import { Image } from 'astro:assets';
import type { ImageMetadata } from 'astro';

interface Props {
  href: string;
  cover: ImageMetadata;
  title: string;
  dateLabel: string; // e.g. "March 2024"
  count: number;
}
const { href, cover, title, dateLabel, count } = Astro.props;
---
<a class="card" href={href}>
  <div class="frame">
    <Image src={cover} alt={title} widths={[400, 800, 1200]}
           sizes="(max-width: 700px) 100vw, 50vw" />
    <div class="meta">
      <h2>{title}</h2>
      <span>{dateLabel} · {count} photos</span>
    </div>
  </div>
</a>

<style>
  .frame { position: relative; overflow: hidden; aspect-ratio: 3 / 2; border-radius: 4px; }
  .frame :global(img) { width: 100%; height: 100%; object-fit: cover; transition: transform .5s ease; }
  .meta {
    position: absolute; inset: 0; display: flex; flex-direction: column;
    align-items: center; justify-content: center; text-align: center;
    color: #fff; background: rgba(0,0,0,.45); opacity: 0; transition: opacity .35s ease;
  }
  .card:hover .frame :global(img) { transform: scale(1.05); }
  .card:hover .meta { opacity: 1; }
  .meta h2 { margin: 0; font-size: 22px; letter-spacing: .06em; font-weight: 600; }
  .meta span { font-size: 12px; opacity: .85; margin-top: 6px; }
</style>
```

- [ ] **Step 2: Replace `src/pages/index.astro`**

```astro
---
import { getCollection } from 'astro:content';
import Base from '../layouts/Base.astro';
import AlbumCard from '../components/AlbumCard.astro';
import { getCover, getAlbumImageCount } from '../lib/photos';

const albums = (await getCollection('albums')).sort((a, b) =>
  b.data.date.localeCompare(a.data.date), // newest first
);

const cards = albums.map((a) => ({
  href: `/${a.id}`,
  cover: getCover(a.id, a.data.cover),
  title: a.data.title,
  dateLabel: new Date(`${a.data.date}-01T00:00:00`).toLocaleDateString('en-US', {
    month: 'long', year: 'numeric',
  }),
  count: getAlbumImageCount(a.id),
}));
---
<Base title="Arthur · Travels">
  <section class="container grid">
    {cards.map((c) => <AlbumCard {...c} />)}
  </section>
</Base>

<style>
  .grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 14px; padding-top: 10px; }
  @media (max-width: 700px) { .grid { grid-template-columns: 1fr; } }
</style>
```

- [ ] **Step 3: Verify build + visual check**

Run: `npm run build && npm run preview`
Expected: build succeeds; open the previewed URL — the homepage shows the "Sample Trip" cover card; hovering darkens it and reveals "Sample Trip / March 2024 · 2 photos".

- [ ] **Step 4: Commit**

```bash
git add src/components/AlbumCard.astro src/pages/index.astro
git commit -m "Add homepage trip index with hover-reveal album cards"
```

---

## Task 8: Album page (full-width scroll) + Photo component

**Files:**
- Create: `src/components/Photo.astro`, `src/pages/[album].astro`

- [ ] **Step 1: Create `src/components/Photo.astro`**

```astro
---
import { Image } from 'astro:assets';
import type { ImageMetadata } from 'astro';

interface Props { src: ImageMetadata; alt: string; caption: string; }
const { src, alt, caption } = Astro.props;
---
<figure>
  <Image src={src} alt={alt} widths={[640, 1024, 1600, 2500]}
         sizes="(max-width: 700px) 100vw, 680px" loading="lazy" />
  {caption && <figcaption>{caption}</figcaption>}
</figure>

<style>
  figure { margin: 0; width: 100%; max-width: var(--maxw); }
  figure :global(img) { width: 100%; height: auto; }
  figcaption { font-size: 13px; color: var(--muted); padding: 8px 4px 0; }
</style>
```

- [ ] **Step 2: Create `src/pages/[album].astro`**

```astro
---
import { getCollection } from 'astro:content';
import Base from '../layouts/Base.astro';
import Photo from '../components/Photo.astro';
import { getAlbumPhotos } from '../lib/photos';

export async function getStaticPaths() {
  const albums = await getCollection('albums');
  return albums.map((a) => ({ params: { album: a.id }, props: { album: a } }));
}

const { album } = Astro.props;
const photos = await getAlbumPhotos(album.id, album.data.photos);
const dateLabel = new Date(`${album.data.date}-01T00:00:00`).toLocaleDateString('en-US', {
  month: 'long', year: 'numeric',
});
---
<Base title={`${album.data.title} · Arthur · Travels`}>
  <header class="head">
    <h1>{album.data.title}</h1>
    <p class="sub">{dateLabel}{album.data.description ? ` · ${album.data.description}` : ''}</p>
  </header>

  <div class="scroll">
    {photos.map((p) => <Photo src={p.src} alt={p.alt} caption={p.caption} />)}
  </div>
</Base>

<style>
  .head { text-align: center; padding: 26px 16px 6px; }
  .head h1 { margin: 0; font-size: 30px; letter-spacing: .04em; font-weight: 600; }
  .sub { font-size: 13px; color: var(--muted); }
  .scroll { display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 18px 0 26px; }
</style>
```

- [ ] **Step 3: Verify build + visual check**

Run: `npm run build && npm run preview`
Expected: build succeeds; clicking the homepage card opens `/sample-trip` showing both photos full-width stacked. `sample-1.jpg` shows "A captioned sample photo · Somewhere"; `sample-2.jpg` shows its EXIF fallback (e.g. "March 2024 · …") or nothing if the fixture has no EXIF.

- [ ] **Step 4: Commit**

```bash
git add src/components/Photo.astro src/pages/[album].astro
git commit -m "Add album page with full-width photo scroll"
```

---

## Task 9: Contact page (Formspree)

**Files:**
- Create: `src/pages/contact.astro`

The endpoint is a Formspree form ID the user creates at formspree.io; it is real config, not a placeholder. Replace `xxxxxxxx` with the actual form ID.

- [ ] **Step 1: Create `src/pages/contact.astro`**

```astro
---
import Base from '../layouts/Base.astro';
const FORMSPREE_ENDPOINT = 'https://formspree.io/f/xxxxxxxx'; // replace with real form ID
---
<Base title="Contact · Arthur · Travels">
  <section class="container form-wrap">
    <h1>Contact</h1>
    <form action={FORMSPREE_ENDPOINT} method="POST">
      <label>Name<input type="text" name="name" required /></label>
      <label>Email<input type="email" name="email" required /></label>
      <label>Message<textarea name="message" rows="6" required></textarea></label>
      <button type="submit">Send</button>
    </form>
  </section>
</Base>

<style>
  .form-wrap { max-width: var(--maxw); padding-top: 10px; }
  h1 { font-size: 28px; font-weight: 600; }
  form { display: flex; flex-direction: column; gap: 14px; }
  label { display: flex; flex-direction: column; gap: 6px; font-size: 13px; color: var(--muted); }
  input, textarea {
    border: 1px solid var(--line); border-radius: 4px; padding: 10px;
    font-size: 15px; color: var(--fg); background: #fff; font-family: inherit;
  }
  button {
    align-self: flex-start; border: 0; background: var(--fg); color: #fff;
    padding: 10px 22px; border-radius: 4px; font-size: 14px; cursor: pointer;
  }
</style>
```

- [ ] **Step 2: Verify build + visual check**

Run: `npm run build && npm run preview`
Expected: `/contact` renders the form; clicking "Contact" in the nav reaches it. (No live submission test — that requires the real Formspree ID.)

- [ ] **Step 3: Commit**

```bash
git add src/pages/contact.astro
git commit -m "Add Formspree contact page"
```

---

## Task 10: `process-photos` script (resize + GPS strip) with test

**Files:**
- Create: `scripts/process-photos.mjs`, `tests/process-photos.test.ts`

The script exports a pure `processImage(inputPath, outputPath)` so it can be unit-tested, plus a CLI entry that walks `_inbox/`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/process-photos.test.ts
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
    expect(gps).toBeNull(); // GPS removed
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/process-photos.test.ts`
Expected: FAIL — cannot resolve `../scripts/process-photos.mjs` / `processImage`.

- [ ] **Step 3: Write `scripts/process-photos.mjs`**

```js
// scripts/process-photos.mjs
import { readdir, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { exiftool } from 'exiftool-vendored';

const MAX_EDGE = 2500;

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
  // Remove only GPS tags; date/exposure remain.
  await exiftool.write(outputPath, {}, ['-gps:all=', '-overwrite_original']);
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/process-photos.test.ts`
Expected: PASS (1 test). Note: first run downloads the vendored exiftool binary; allow extra time.

- [ ] **Step 5: Run the full test suite**

Run: `npm test`
Expected: all tests pass (exif, schema, process-photos).

- [ ] **Step 6: Commit**

```bash
git add scripts/process-photos.mjs tests/process-photos.test.ts
git commit -m "Add process-photos resize/GPS-strip script with test"
```

---

## Task 11: Netlify config + README + final verification

**Files:**
- Create: `netlify.toml`, `README.md`

- [ ] **Step 1: Create `netlify.toml`**

```toml
[build]
  command = "npm run build"
  publish = "dist"

[build.environment]
  NODE_VERSION = "20"
```

- [ ] **Step 2: Create `README.md`**

````markdown
# Travel photo site

Static Astro photo site. Albums = folders under `photos/<slug>/`.

## Add or update photos

1. Put full-res originals in `_inbox/<album-slug>/` (gitignored, not published).
2. Run the processor — resizes to ≤2500px web masters and strips GPS:
   ```bash
   npm run photos
   ```
   Output lands in `photos/<album-slug>/`.
3. (Optional) Caption photos in `photos/<album-slug>/album.yaml`:
   ```yaml
   title: "Patagonia"
   description: "Two weeks on the circuit"
   date: 2024-03          # YYYY-MM
   cover: DSC_4551.jpg
   photos:
     DSC_4551.jpg:
       caption: "Sunrise over the valley"
       location: "Torres del Paine"
   ```
   Photos with no entry still appear (caption falls back to EXIF date + exposure).
4. Commit and push — Netlify rebuilds and deploys.
   ```bash
   git add photos && git commit -m "Add <trip> photos" && git push
   ```

## Develop

```bash
npm install
npm run dev      # local preview
npm test         # unit tests
npm run build    # production build into dist/
```

## Contact form

`src/pages/contact.astro` posts to Formspree. Set your form ID in `FORMSPREE_ENDPOINT`.
````

- [ ] **Step 3: Final full verification**

Run: `npm test && npm run build`
Expected: all tests pass; build completes with the homepage, `/sample-trip`, and `/contact` in `dist/`.

- [ ] **Step 4: Commit**

```bash
git add netlify.toml README.md
git commit -m "Add Netlify config and README"
```

- [ ] **Step 5: Deploy (manual, one-time)**

Connect the git repo to Netlify (New site → import from Git). Netlify reads `netlify.toml`. Push to `main` deploys. Create a Formspree form and paste its ID into `src/pages/contact.astro`, then commit.

---

## Notes / Deferred

- **Custom domain**: add later in Netlify DNS settings — no code change.
- **Replacing the sample album**: once real trips are added via `npm run photos`, delete `photos/sample-trip/` (and its commit is harmless to remove).
- **If `astro:assets` does not optimize images under root `photos/`**: move albums under `src/photos/` and update the `glob` base (`./src/photos`) and the `import.meta.glob` pattern (`/src/photos/*/*...`) accordingly. The build smoke test in Task 7 will reveal this immediately.
```
