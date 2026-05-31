import { defineConfig } from 'astro/config';

export default defineConfig({
  // Static output (default). astro:assets optimizes imported images at build.
  image: {
    service: { entrypoint: 'astro/assets/services/sharp' },
  },
});
