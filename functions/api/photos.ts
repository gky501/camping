import { error, json } from '../_lib/diary';

interface PhotoEnv {
  PHOTOS?: R2Bucket;
}

const MAX_PHOTO_BYTES = 10 * 1024 * 1024;
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']);

function extensionFor(file: File): string {
  const fromName = file.name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (fromName && fromName.length <= 5) return fromName;
  if (file.type === 'image/png') return 'png';
  if (file.type === 'image/webp') return 'webp';
  if (file.type === 'image/heic') return 'heic';
  if (file.type === 'image/heif') return 'heif';
  return 'jpg';
}

export const onRequestGet: PagesFunction<PhotoEnv> = async ({ request, env }) => {
  if (!env.PHOTOS) return error('Trip photo storage is not connected yet.', 503);
  const key = new URL(request.url).searchParams.get('key')?.trim();
  if (!key) return error('Photo key is required.');
  const object = await env.PHOTOS.get(key);
  if (!object) return error('Photo not found.', 404);
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('etag', object.httpEtag);
  headers.set('cache-control', 'private, max-age=3600');
  return new Response(object.body, { headers });
};

export const onRequestPost: PagesFunction<PhotoEnv> = async ({ request, env }) => {
  if (!env.PHOTOS) return error('Trip photo storage is not connected yet. Create and bind an R2 bucket named PHOTOS.', 503);
  try {
    const form = await request.formData();
    const stayId = String(form.get('stayId') || '').trim();
    const photo = form.get('photo');
    if (!stayId) return error('Trip ID is required.');
    if (!(photo instanceof File)) return error('Choose a photo to upload.');
    if (!photo.type.startsWith('image/') || (photo.type && !ALLOWED_TYPES.has(photo.type))) return error('Use a JPG, PNG, WebP, HEIC, or HEIF image.');
    if (photo.size <= 0) return error('The selected photo is empty.');
    if (photo.size > MAX_PHOTO_BYTES) return error('Photos must be 10 MB or smaller.', 413);

    const id = crypto.randomUUID();
    const key = `${stayId}/${id}.${extensionFor(photo)}`;
    await env.PHOTOS.put(key, photo.stream(), {
      httpMetadata: { contentType: photo.type || 'image/jpeg' },
      customMetadata: { stayId, originalName: photo.name || 'Trip photo' },
    });

    return json({
      id,
      key,
      url: `/api/photos?key=${encodeURIComponent(key)}`,
      name: photo.name || 'Trip photo',
      uploadedAt: new Date().toISOString(),
    }, 201);
  } catch (cause) {
    return error(cause instanceof Error ? cause.message : 'Unable to upload the photo.', 500);
  }
};

export const onRequestDelete: PagesFunction<PhotoEnv> = async ({ request, env }) => {
  if (!env.PHOTOS) return error('Trip photo storage is not connected yet.', 503);
  const key = new URL(request.url).searchParams.get('key')?.trim();
  if (!key) return error('Photo key is required.');
  await env.PHOTOS.delete(key);
  return json({ ok: true });
};
