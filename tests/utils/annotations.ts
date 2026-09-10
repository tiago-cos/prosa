import request from 'supertest';
import { SERVER_URL } from './common.js';

export const INVALID_ANNOTATION = 'The provided annotation is invalid.';
export const ANNOTATION_NOT_FOUND = 'The requested annotation does not exist or is not accessible.';
export const ANNOTATION_CONFLICT = 'An annotation in this position already exists.';

// EPUB locations: content document, element path from <body>, text run and
// character offset. Verified against the test book with the same validator the
// server uses.
export const ALICE_NOTE = {
  start_location: 'OEBPS/229714655232534212_11-h-10.htm.xhtml#0/1/t0:7',
  end_location: 'OEBPS/229714655232534212_11-h-10.htm.xhtml#0/2/t0:42',
  note: 'I loved this part!'
};

export async function addAnnotation(book_id: string, annotation: any, auth?: { jwt?: string; apiKey?: string }) {
  let req = request(SERVER_URL).post(`/books/${book_id}/annotations`);

  if (auth?.jwt) req = req.auth(auth.jwt, { type: 'bearer' });
  if (auth?.apiKey) req = req.set('api-key', auth.apiKey);

  return req.send(annotation);
}

export async function getAnnotation(book_id: string, annotation_id: string, auth?: { jwt?: string; apiKey?: string }) {
  let req = request(SERVER_URL).get(`/books/${book_id}/annotations/${annotation_id}`);

  if (auth?.jwt) req = req.auth(auth.jwt, { type: 'bearer' });
  if (auth?.apiKey) req = req.set('api-key', auth.apiKey);

  return req.send();
}

export async function listAnnotations(book_id: string, auth?: { jwt?: string; apiKey?: string }) {
  let req = request(SERVER_URL).get(`/books/${book_id}/annotations`);

  if (auth?.jwt) req = req.auth(auth.jwt, { type: 'bearer' });
  if (auth?.apiKey) req = req.set('api-key', auth.apiKey);

  return req.send();
}

export async function patchAnnotation(book_id: string, annotation_id: string, note: string, auth?: { jwt?: string; apiKey?: string }) {
  let req = request(SERVER_URL).patch(`/books/${book_id}/annotations/${annotation_id}`);

  if (auth?.jwt) req = req.auth(auth.jwt, { type: 'bearer' });
  if (auth?.apiKey) req = req.set('api-key', auth.apiKey);

  return req.send({ note: note });
}

export async function deleteAnnotation(book_id: string, annotation_id: string, auth?: { jwt?: string; apiKey?: string }) {
  let req = request(SERVER_URL).delete(`/books/${book_id}/annotations/${annotation_id}`);

  if (auth?.jwt) req = req.auth(auth.jwt, { type: 'bearer' });
  if (auth?.apiKey) req = req.set('api-key', auth.apiKey);

  return req.send();
}
