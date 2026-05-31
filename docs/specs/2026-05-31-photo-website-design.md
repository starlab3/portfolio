# Trip Photo Website — Design

**Date:** 2026-05-31
**Status:** Approved for planning

## Goal

A custom-designed static website to host photos from personal trips, organized
by trip. Adding/modifying photos must stay simple: drop files, run one command,
`git push` to deploy. No CMS, no admin panel.

## Stack & Hosting

- **Astro** — static site generator. Chosen for its built-in image pipeline
  (`astro:assets`, Sharp) which generates responsive `srcset` + AVIF/WebP from
  source images at build time, and for its component model (easier custom design
  than Hugo templating).
- **Netlify** — git-connected auto-deploy. `git push` triggers a cloud build and
  publishes to Netlify's CDN (~1–2 min). Free Netlify subdomain to start; custom
  domain deferred (can be added later without rework).
- **Formspree** — contact form handling. Keeps the site fully static, requires no
  backend, and never exposes the email address.

## Content Model

Each trip is a **folder** under `photos/<album-slug>/` containing the web-sized
images and one **`album.yaml`** file.

`album.yaml` shape:

```yaml
# album-level metadata
title: "Patagonia"
description: "Two weeks hiking the Torres del Paine circuit"
date: 2024-03
cover: DSC_4551.jpg          # which photo is the album cover thumbnail

# per-photo — each value is an OBJECT (extensible), keyed by filename
photos:
  DSC_4551.jpg:
    caption: "Sunrise over the valley"
    location: "Torres del Paine"   # manual only; GPS is stripped from files
  DSC_4610.jpg:
    caption: "On the trail"
  # photos NOT listed here still appear in the gallery (see Fallback below)
```

Design points:
- **Photo entries are objects**, not bare strings — adding a future property
  (`tags`, `featured`, `alt`, `order`, …) is a one-line change with no migration.
- **Unlisted photos still render.** You only add a YAML entry when you want to
  caption/annotate a photo. Zero typing for the common case.
- **Validated by an Astro content-collection schema (Zod):** typos and malformed
  entries fail the build; available properties are documented in one place.
- **Format: YAML** (easiest to hand-edit).

### Per-photo caption fallback

When a photo has no manual `caption`, display **EXIF date taken + camera settings**
(e.g. `March 2024 · 1/500s · f/2.8 · ISO 100`). EXIF is read at build time from
the web-sized files (which retain non-GPS EXIF — see Privacy).

## Adding Photos (workflow)

1. Drop full-resolution originals into an **ignored** `_inbox/` folder (or point
   the resize script at a source directory).
2. Run **`npm run photos`**:
   - Resizes each image to a ~2500px web master into the target album folder.
   - **Strips GPS** metadata only (`exiftool -gps:all=`), **keeps** date/exposure
     EXIF for the fallback.
   - Optimizes/encodes the web master.
3. Optionally add captions/locations to the album's `album.yaml`.
4. `git push` → Netlify rebuilds and deploys.

Originals are **never committed** — they stay on the user's drive/backup. The git
repo holds code, `album.yaml` files, and the ~500KB web masters (not Git LFS, not
an external host). Astro generates smaller responsive variants from the masters at
build time.

## Pages & Design

### Homepage — trip index (layout "C")
- Two-column grid of **large cover cards**.
- **Nevercrew-style hover:** tile darkens + slight image zoom, **title fades in**
  centered, with date and **photo count** (e.g. "March 2024 · 24 photos").
- Top **navigation**: `brand · Portfolio · Contact`.
- No bio/about page — visitor lands straight on the trip index.

### Album page — immersive scroll (layout "D")
- **Single-column, full-width** images stacked vertically; scroll like a slow
  slideshow. Maximum impact per photo.
- **Captions sit beneath each photo**; nothing shown when a photo has no
  caption/fallback content.
- Album header: title + date + short description.

### Global
- **Theme: light** ("prints on a wall" feel).
- **Contact** nav links to a dedicated **`/contact`** page containing the
  **Formspree** form.
- **Footer**: no email address, no social links.
- Images **lazy-load**; responsive `srcset` + AVIF/WebP emitted by Astro.

## Privacy

- GPS coordinates are stripped from every published image at resize time.
- Location is **manual-only** text in `album.yaml` — never derived from GPS.

## Copyright

- **Embedded metadata.** `process-photos` writes EXIF/IPTC/XMP copyright +
  creator tags ("Constance Starcky") into every web master in the same
  `exiftool` step that strips GPS. Establishes authorship for DMCA/disputes.
- **On-page notice.** Footer carries a `© <year> Constance Starcky` line; the
  `/contact` page states photos may not be used without permission.
- **Resolution cap.** Only ~2500px web masters are published; full-resolution
  originals are never committed — stolen copies are unusable for large prints.

## Components / Boundaries

- **`scripts/process-photos`** — the `npm run photos` resize + GPS-strip step.
  Input: originals. Output: web masters in album folders. Independent of the site.
- **Content collection (`albums`)** — Zod schema + loader over `photos/*/album.yaml`.
  Defines the album/photo data shape; the single source of truth for validation.
- **`AlbumCard`** — homepage cover tile with hover-reveal title/date/count.
- **`AlbumIndex` page** — two-column grid of `AlbumCard`s + nav.
- **`AlbumPage`** — full-width photo scroll; merges YAML entries with EXIF fallback.
- **`Photo`** — single responsive image (lazy-load, srcset/AVIF/WebP) + caption.
- **`ContactForm`** — Formspree-backed form.
- **`Nav` / `Footer`** — shared layout chrome.

## Verification / Testing

- `astro build` succeeds on a sample with multiple albums.
- Schema **rejects** a malformed `album.yaml` (missing title / wrong type).
- Resized output asserts **no GPS tags** present (`exiftool` check) and **date +
  exposure tags retained**.
- Unlisted photos render with the EXIF fallback; listed photos show their caption.
- Lighthouse pass on a sample album page (performance/image sizing, lazy-load).

## Deferred / Out of Scope

- Custom domain (add via Netlify later).
- Video support.
- Search, tags, maps, multi-language.
