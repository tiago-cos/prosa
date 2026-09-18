import request from 'supertest';
import { SERVER_URL } from './common.js';

export async function fetchJwks() {
  const response = await request(SERVER_URL).get('/.well-known/jwks.json').expect(200);

  return response.body;
}

export async function fetchIdentity(auth?: { jwt?: string; apiKey?: string }) {
  let req = request(SERVER_URL).get('/auth/me');

  if (auth?.jwt) req = req.auth(auth.jwt, { type: 'bearer' });
  if (auth?.apiKey) req = req.set('api-key', auth.apiKey);

  return req.send();
}
