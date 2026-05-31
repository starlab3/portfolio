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
