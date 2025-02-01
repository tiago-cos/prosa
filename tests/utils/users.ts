import request from "supertest";
import { randomString } from "./common";
import { SERVER_URL } from "./common";

export async function registerUser(username?: string, password?: string, adminKey?: string) {
  username = username || randomString(16);
  password = password || randomString(16);

  const payload: Record<string, string> = { username, password };
  if (adminKey) {
    payload.admin_key = adminKey;
  }

  const response = await request(SERVER_URL).post("/users").send(payload);

  return { response, username, password };
}

export async function loginUser(username: string, password: string) {
  const response = await request(SERVER_URL).post(`/users/${username}`).send({
    password
  });

  return { response };
}

export async function createApiKey(
  username: string,
  keyName: string,
  capabilities: string[],
  expiresAt?: string,
  auth?: { jwt?: string; apiKey?: string }
) {
  let req = request(SERVER_URL).post(`/users/${username}/keys`);

  if (auth?.jwt) req = req.auth(auth.jwt, { type: "bearer" });
  if (auth?.apiKey) req = req.set("api-key", auth.apiKey);

  const body: any = {
    name: keyName,
    capabilities
  };

  if (expiresAt)
    body.expires_at = expiresAt;

  return req.send(body);
}

export async function getApiKey(
  username: string,
  keyId: string,
  auth?: { jwt?: string; apiKey?: string }
) {
  let req = request(SERVER_URL).get(`/users/${username}/keys/${keyId}`);

  if (auth?.jwt) req = req.auth(auth.jwt, { type: "bearer" });
  if (auth?.apiKey) req = req.set("api-key", auth.apiKey);

  return req.send();
}

export async function getApiKeys(
  username: string,
  auth?: { jwt?: string; apiKey?: string }
) {
  let req = request(SERVER_URL).get(`/users/${username}/keys`);

  if (auth?.jwt) req = req.auth(auth.jwt, { type: "bearer" });
  if (auth?.apiKey) req = req.set("api-key", auth.apiKey);

  return req.send();
}

export async function deleteApiKey(
  username: string,
  keyId: string,
  auth?: { jwt?: string; apiKey?: string }
) {
  let req = request(SERVER_URL).delete(`/users/${username}/keys/${keyId}`);

  if (auth?.jwt) req = req.auth(auth.jwt, { type: "bearer" });
  if (auth?.apiKey) req = req.set("api-key", auth.apiKey);

  return req.send();
}