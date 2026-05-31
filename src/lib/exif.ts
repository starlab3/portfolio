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
