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
