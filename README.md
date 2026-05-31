# Travel photo site

A custom static photo site built with [Astro](https://astro.build). Each trip is
an album: a folder under `photos/<slug>/` holding web-sized images and an
`album.yaml`. The homepage is a grid of trip covers; each album is a full-width,
immersive photo scroll.

## Prerequisites

- **Node.js 20+** and npm.
- No system tools to install — image resizing (Sharp) and the EXIF/GPS tooling
  (a vendored ExifTool) come bundled as npm dependencies.

## Quick start

```bash
npm install        # install dependencies (first time only)
npm run dev        # start the dev server → http://localhost:4321
```

Open the printed URL in your browser. The dev server hot-reloads as you edit.

## All commands

| Command           | What it does                                                       |
| ----------------- | ------------------------------------------------------------------ |
| `npm run dev`     | Local dev server with hot reload (http://localhost:4321).          |
| `npm run build`   | Production build into `dist/`.                                     |
| `npm run preview` | Serve the built `dist/` locally to check the production output.    |
| `npm test`        | Run the unit tests (EXIF formatters, album schema, photo pipeline).|
| `npm run photos`  | Resize originals in `_inbox/` into web-sized albums (see below).   |

## Add or update a trip

1. Put full-res originals in `_inbox/<album-slug>/` (gitignored, never published).
2. Process them — resizes to ≤2500px web masters and **strips GPS** (keeps date /
   exposure EXIF):
   ```bash
   npm run photos
   ```
   Output lands in `photos/<album-slug>/`.
3. Create `photos/<album-slug>/album.yaml`:
   ```yaml
   title: "British Columbia"
   date: 2025-09            # YYYY-MM
   cover: DSC_4695.jpg      # filename used for the homepage cover

   # Optional captions. Photos left unlisted show their EXIF date + exposure.
   photos:
     DSC_4695.jpg:
       caption: "Morning light on the coast"
       location: "Vancouver Island"
   ```
4. Preview locally (`npm run dev`), then commit and push:
   ```bash
   git add photos && git commit -m "Add <trip> photos" && git push
   ```
   Netlify rebuilds and deploys automatically on push.

## Deployment

Hosted on Netlify (config in `netlify.toml`: `npm run build` → publish `dist/`).
Connect the repo once in Netlify; every push to the default branch deploys.

## Contact form

`src/pages/contact.astro` posts to [Formspree](https://formspree.io). Set your
form ID in the `FORMSPREE_ENDPOINT` constant in that file.

## How it works

- **Albums** are validated by an Astro content collection (`src/content.config.ts`
  + `src/lib/album-schema.ts`). A malformed `album.yaml` fails the build.
- **Images** are imported via `import.meta.glob` and optimized by `astro:assets`
  (responsive `srcset`, AVIF/WebP) at build time.
- **Captions** come from `album.yaml`, falling back to EXIF date + exposure read
  at build time (`src/lib/photos.ts`, `src/lib/exif.ts`).
- **`npm run photos`** is `scripts/process-photos.mjs`.
