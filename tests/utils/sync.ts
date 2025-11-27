import request from 'supertest';
import { SERVER_URL } from './common';

export const INVALID_SYNC_TOKEN = 'The provided sync token is invalid.';

export async function sync(user_id?: string, sync_token?: any, auth?: { jwt?: string; apiKey?: string }) {
  let req = request(SERVER_URL).get(`/sync`);

  if (sync_token) req = req.query({ sync_token });
  if (user_id) req = req.query({ user_id: user_id });
  if (auth?.jwt) req = req.auth(auth.jwt, { type: 'bearer' });
  if (auth?.apiKey) req = req.set('api-key', auth.apiKey);

  return req.send();
}
