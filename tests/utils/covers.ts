import request from 'supertest';
import path from 'path';
import { COVERS_DIR } from './common.js';
import { SERVER_URL } from './common.js';
import fs from 'fs';

export const COVER_NOT_FOUND = 'The requested cover does not exist or is not accessible.';
export const COVER_CONFLICT = 'This book already has a cover.';
export const INVALID_COVER = 'The provided cover image is invalid.';

const imageCache: Record<string, Buffer> = {};

function preloadFiles() {
  for (const filename of fs.readdirSync(COVERS_DIR)) {
    const fullPath = path.join(COVERS_DIR, filename);
    imageCache[filename] = fs.readFileSync(fullPath);
  }
}

preloadFiles();

export async function addCover(book_id: string, cover_name: string, auth?: { jwt?: string; apiKey?: string }) {
  const coverBuffer = imageCache[cover_name];
  if (!coverBuffer) throw new Error(`Cover file not preloaded: ${cover_name}`);

  let req = request(SERVER_URL).post(`/books/${book_id}/cover`).set('Content-Type', 'image/jpeg');

  if (auth?.jwt) req = req.auth(auth.jwt, { type: 'bearer' });
  if (auth?.apiKey) req = req.set('api-key', auth.apiKey);

  return req.send(coverBuffer);
}

export async function updateCover(book_id: string, cover_name: string, auth?: { jwt?: string; apiKey?: string }) {
  const coverBuffer = imageCache[cover_name];
  if (!coverBuffer) throw new Error(`Cover file not preloaded: ${cover_name}`);

  let req = request(SERVER_URL).put(`/books/${book_id}/cover`).set('Content-Type', 'image/jpeg');

  if (auth?.jwt) req = req.auth(auth.jwt, { type: 'bearer' });
  if (auth?.apiKey) req = req.set('api-key', auth.apiKey);

  return req.send(coverBuffer);
}

export async function getCover(book_id: string, auth?: { jwt?: string; apiKey?: string }) {
  let req = request(SERVER_URL).get(`/books/${book_id}/cover`);

  if (auth?.jwt) req = req.auth(auth.jwt, { type: 'bearer' });
  if (auth?.apiKey) req = req.set('api-key', auth.apiKey);

  return req.send();
}

export async function deleteCover(book_id: string, auth?: { jwt?: string; apiKey?: string }) {
  let req = request(SERVER_URL).delete(`/books/${book_id}/cover`);

  if (auth?.jwt) req = req.auth(auth.jwt, { type: 'bearer' });
  if (auth?.apiKey) req = req.set('api-key', auth.apiKey);

  return req.send();
}
