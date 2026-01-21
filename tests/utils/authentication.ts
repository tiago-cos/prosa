import request from 'supertest';
import { SERVER_URL } from './common.js';

export async function fetchJwks() {
  const response = await request(SERVER_URL).get('/.well-known/jwks.json').expect(200);

  return response.body;
}
