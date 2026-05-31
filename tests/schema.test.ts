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
