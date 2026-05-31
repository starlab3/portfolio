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
