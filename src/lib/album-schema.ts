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
