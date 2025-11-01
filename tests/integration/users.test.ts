import request from 'supertest';
import { FORBIDDEN, randomString, SERVER_URL, UNAUTHORIZED } from '../utils/common';
import {
  API_KEY_NOT_FOUND,
  createApiKey,
  deleteApiKey,
  getApiKey,
  getApiKeys,
  getPreferences,
  getUserProfile,
  INVALID_CAPABILITIES,
  INVALID_CREDENTIALS,
  INVALID_PREFERENCES,
  INVALID_PROVIDERS,
  INVALID_TIMESTAMP,
  INVALID_TOKEN,
  INVALID_USERNAME_PASSWORD,
  loginUser,
  logoutUser,
  MISSING_METADATA_PREFERENCE,
  PASSWORD_TOO_BIG,
  patchPreferences,
  refreshToken,
  registerUser,
  TOKEN_NOT_FOUND,
  updatePreferences,
  updateUserProfile,
  USER_NOT_FOUND,
  USERNAME_IN_USE,
  USERNAME_TOO_BIG
} from '../utils/users';

describe('Register', () => {
  test('Regular user', async () => {
    const { response: registerResponse, username, password } = await registerUser();
    expect(registerResponse.status).toBe(200);

    const loginResponse = await loginUser(username, password);
    expect(loginResponse.status).toBe(200);
  });

  test('Admin user', async () => {
    const { response: registerResponse, username, password } = await registerUser(undefined, undefined, true, process.env.ADMIN_KEY);
    expect(registerResponse.status).toBe(200);

    const loginResponse = await loginUser(username, password);
    expect(loginResponse.status).toBe(200);
  });

  test('Invalid username and password', async () => {
    const { response: registerResponse } = await registerUser('invalid username');
    expect(registerResponse.status).toBe(400);
    expect(registerResponse.text).toBe(INVALID_USERNAME_PASSWORD);

    const { response: registerResponse2 } = await registerUser('');
    expect(registerResponse2.status).toBe(400);
    expect(registerResponse2.text).toBe(INVALID_USERNAME_PASSWORD);

    const { response: registerResponse3 } = await registerUser(undefined, 'invalid password');
    expect(registerResponse3.status).toBe(400);
    expect(registerResponse3.text).toBe(INVALID_USERNAME_PASSWORD);

    const { response: registerResponse4 } = await registerUser(undefined, '');
    expect(registerResponse4.status).toBe(400);
    expect(registerResponse4.text).toBe(INVALID_USERNAME_PASSWORD);

    const { response: registerResponse5 } = await registerUser('thishasmorethantwentycharacters');
    expect(registerResponse5.status).toBe(400);
    expect(registerResponse5.text).toBe(USERNAME_TOO_BIG);

    const { response: registerResponse6 } = await registerUser('username', randomString(257));
    expect(registerResponse6.status).toBe(400);
    expect(registerResponse6.text).toBe(PASSWORD_TOO_BIG);
  });

  test('Invalid admin key', async () => {
    const adminKey = 'invalid_admin_key';

    const { response: registerResponse } = await registerUser(undefined, undefined, true, adminKey);
    expect(registerResponse.status).toBe(403);
    expect(registerResponse.text).toBe(INVALID_CREDENTIALS);

    const { response: registerResponse2 } = await registerUser(undefined, undefined, false, adminKey);
    expect(registerResponse2.status).toBe(403);
    expect(registerResponse2.text).toBe(INVALID_CREDENTIALS);

    const { response: registerResponse3 } = await registerUser(undefined, undefined, true);
    expect(registerResponse3.status).toBe(403);
    expect(registerResponse3.text).toBe(INVALID_CREDENTIALS);
  });

  test('User conflict', async () => {
    const { response: registerResponse, username } = await registerUser();
    expect(registerResponse.status).toBe(200);

    const { response: registerResponse2 } = await registerUser(username);
    expect(registerResponse2.status).toBe(409);
    expect(registerResponse2.text).toBe(USERNAME_IN_USE);
  });

  test('Invalid request body', async () => {
    const username = randomString(16);
    const password = randomString(16);

    const registerResponse = await request(SERVER_URL).post('/auth/register').send({
      username: username,
      pass: password
    });

    expect(registerResponse.status).toBe(422);
  });
});

describe('Login', () => {
  test('Non-existing user', async () => {
    const loginResponse = await loginUser('non-existent', 'non-existent');
    expect(loginResponse.status).toBe(404);
    expect(loginResponse.text).toBe(USER_NOT_FOUND);
  });

  test('Invalid credentials', async () => {
    const { response: registerResponse, username } = await registerUser();
    expect(registerResponse.status).toBe(200);

    const loginResponse = await loginUser(username, 'wrong_password');
    expect(loginResponse.status).toBe(403);
    expect(loginResponse.text).toBe(INVALID_CREDENTIALS);
  });

  test('Invalid request body', async () => {
    const loginResponse = await request(SERVER_URL).post('/auth/login').send({
      username: 'username',
      pass: 'password'
    });

    expect(loginResponse.status).toBe(422);
  });
});

describe('Logout', () => {
  test('Simple', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);

    const logoutResponse = await logoutUser(registerResponse.body.refresh_token);
    expect(logoutResponse.status).toBe(204);

    const refreshResponse = await refreshToken(registerResponse.body.refresh_token);
    expect(refreshResponse.status).toBe(401);
    expect(refreshResponse.text).toBe(INVALID_TOKEN);
  });

  test('Invalid token', async () => {
    const logoutResponse = await logoutUser('invalid token');
    expect(logoutResponse.status).toBe(401);
    expect(logoutResponse.text).toBe(INVALID_TOKEN);
  });

  test('Token not found', async () => {
    const logoutResponse = await logoutUser('missingtoken');
    expect(logoutResponse.status).toBe(404);
    expect(logoutResponse.text).toBe(TOKEN_NOT_FOUND);
  });
});

describe('Refresh token', () => {
  test('Simple', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    // Just testing auth
    let getPreferencesResponse = await getPreferences(userId, { jwt: registerResponse.body.jwt_token });
    expect(getPreferencesResponse.status).toBe(200);

    let refreshResponse = await refreshToken(registerResponse.body.refresh_token);
    expect(refreshResponse.status).toBe(200);

    // Just testing auth
    getPreferencesResponse = await getPreferences(userId, { jwt: refreshResponse.body.jwt_token });
    expect(getPreferencesResponse.status).toBe(200);

    refreshResponse = await refreshToken(registerResponse.body.refresh_token);
    expect(refreshResponse.status).toBe(401);
    expect(refreshResponse.text).toBe(INVALID_TOKEN);
  });

  test('Invalid Token', async () => {
    const refreshResponse = await refreshToken('invalid');
    expect(refreshResponse.status).toBe(401);
    expect(refreshResponse.text).toBe(INVALID_TOKEN);
  });
});

describe('Create api key', () => {
  test('No timestamp', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const createApiKeyResponse = await createApiKey(userId, 'Test Key', ['Read'], undefined, { jwt: registerResponse.body.jwt_token });
    expect(createApiKeyResponse.status).toBe(200);

    const getApiKeyResponse = await getApiKey(userId, createApiKeyResponse.body.id, { jwt: registerResponse.body.jwt_token });
    expect(getApiKeyResponse.status).toBe(200);
    expect(getApiKeyResponse.body.name).toBe('Test Key');
    expect(getApiKeyResponse.body.capabilities).toEqual(['Read']);
    expect(getApiKeyResponse.body.expires_at).toBeUndefined();
  });

  test('With timestamp', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const date = Date.now() + 300000;

    const createApiKeyResponse = await createApiKey(userId, 'Test Key', ['Read', 'Create'], date, { jwt: registerResponse.body.jwt_token });
    expect(createApiKeyResponse.status).toBe(200);

    const getApiKeyResponse = await getApiKey(userId, createApiKeyResponse.body.id, { jwt: registerResponse.body.jwt_token });
    expect(getApiKeyResponse.status).toBe(200);
    expect(getApiKeyResponse.body.name).toBe('Test Key');
    expect(getApiKeyResponse.body.capabilities).toEqual(['Create', 'Read']);
    expect(getApiKeyResponse.body.expires_at).toBe(date);
  });

  test('Non-existent user', async () => {
    const { response: registerResponse } = await registerUser(undefined, undefined, true, process.env.ADMIN_KEY);
    expect(registerResponse.status).toBe(200);

    const createApiKeyResponse = await createApiKey('non-existent', 'Test Key', ['Read'], undefined, { jwt: registerResponse.body.jwt_token });
    expect(createApiKeyResponse.status).toBe(404);
    expect(createApiKeyResponse.text).toBe(USER_NOT_FOUND);
  });

  test('Invalid capabilities', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const createApiKeyResponse = await createApiKey(userId, 'Test Key', ['Read', 'Read'], undefined, { jwt: registerResponse.body.jwt_token });
    expect(createApiKeyResponse.status).toBe(400);
    expect(createApiKeyResponse.text).toBe(INVALID_CAPABILITIES);

    const createApiKeyResponse2 = await createApiKey(userId, 'Test Key', ['Wrong'], undefined, { jwt: registerResponse.body.jwt_token });
    expect(createApiKeyResponse2.status).toBe(400);
    expect(createApiKeyResponse2.text).toBe(INVALID_CAPABILITIES);

    const createApiKeyResponse3 = await createApiKey(userId, 'Test Key', [], undefined, { jwt: registerResponse.body.jwt_token });
    expect(createApiKeyResponse3.status).toBe(400);
    expect(createApiKeyResponse3.text).toBe(INVALID_CAPABILITIES);
  });

  test('Invalid expiration', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const createApiKeyResponse = await createApiKey(userId, 'Test Key', ['Read'], Date.now() - 300000, { jwt: registerResponse.body.jwt_token });
    expect(createApiKeyResponse.status).toBe(400);
    expect(createApiKeyResponse.text).toBe(INVALID_TIMESTAMP);

    const createApiKeyResponse2 = await createApiKey(userId, 'Test Key', ['Read'], 9223372036854772, { jwt: registerResponse.body.jwt_token });
    expect(createApiKeyResponse2.status).toBe(400);
    expect(createApiKeyResponse2.text).toBe(INVALID_TIMESTAMP);
  });

  test('Different user without permission', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);

    const { response: registerResponse2 } = await registerUser();
    expect(registerResponse2.status).toBe(200);
    const userId = registerResponse2.body.user_id;

    const createApiKeyResponse = await createApiKey(userId, 'Test Key', ['Read'], undefined, { jwt: registerResponse.body.jwt_token });
    expect(createApiKeyResponse.status).toBe(403);
    expect(createApiKeyResponse.text).toBe(FORBIDDEN);
  });

  test('Different user with permission', async () => {
    const { response: registerResponse } = await registerUser(undefined, undefined, true, process.env.ADMIN_KEY);
    expect(registerResponse.status).toBe(200);

    const { response: registerResponse2 } = await registerUser();
    expect(registerResponse2.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const createApiKeyResponse = await createApiKey(userId, 'Test Key', ['Read'], undefined, { jwt: registerResponse.body.jwt_token });
    expect(createApiKeyResponse.status).toBe(200);

    const getApiKeyResponse = await getApiKey(userId, createApiKeyResponse.body.id, { jwt: registerResponse.body.jwt_token });
    expect(getApiKeyResponse.status).toBe(200);
  });

  test('No auth', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const createApiKeyResponse = await createApiKey(userId, 'Test Key', ['Read'], undefined);
    expect(createApiKeyResponse.status).toBe(401);
    expect(createApiKeyResponse.text).toBe(UNAUTHORIZED);
  });

  test('Invalid auth', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const createApiKeyResponse = await createApiKey(userId, 'Test Key', ['Read'], undefined, { jwt: registerResponse.body.jwt_token });
    expect(createApiKeyResponse.status).toBe(200);

    const createApiKeyResponse2 = await createApiKey(userId, 'Test Key', ['Read'], undefined, { apiKey: createApiKeyResponse.body.key });
    expect(createApiKeyResponse2.status).toBe(403);
    expect(createApiKeyResponse2.text).toBe(FORBIDDEN);
  });

  test('Invalid request', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const createApiKeyResponse = await request(SERVER_URL).post(`/users/${userId}/keys`).auth(registerResponse.body.jwt_token, { type: 'bearer' }).send({
      bad: userId,
      field: []
    });

    expect(createApiKeyResponse.status).toBe(422);
  });
});

describe('List api keys', () => {
  test('Simple', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const createApiKeyResponse = await createApiKey(userId, 'Test Key', ['Read', 'Create'], Date.now() + 300000, { jwt: registerResponse.body.jwt_token });
    expect(createApiKeyResponse.status).toBe(200);

    const createApiKeyResponse2 = await createApiKey(userId, 'Test Key', ['Read', 'Create'], Date.now() + 300000, { jwt: registerResponse.body.jwt_token });
    expect(createApiKeyResponse2.status).toBe(200);

    const createApiKeyResponse3 = await createApiKey(userId, 'Test Key', ['Read', 'Create'], Date.now() + 300000, { jwt: registerResponse.body.jwt_token });
    expect(createApiKeyResponse3.status).toBe(200);

    const getApiKeysResponse = await getApiKeys(userId, { jwt: registerResponse.body.jwt_token });
    expect(getApiKeysResponse.status).toBe(200);
    expect(getApiKeysResponse.body).toEqual([createApiKeyResponse.body.id, createApiKeyResponse2.body.id, createApiKeyResponse3.body.id]);

    const { response: registerResponse2 } = await registerUser();
    expect(registerResponse2.status).toBe(200);
    const userId2 = registerResponse2.body.user_id;

    const getApiKeysResponse2 = await getApiKeys(userId2, { jwt: registerResponse2.body.jwt_token });
    expect(getApiKeysResponse2.status).toBe(200);
    expect(getApiKeysResponse2.body).toEqual([]);
  });

  test('Non-existent user', async () => {
    const { response: registerResponse } = await registerUser(undefined, undefined, true, process.env.ADMIN_KEY);
    expect(registerResponse.status).toBe(200);

    const getApiKeysResponse = await getApiKeys('non-existent', { jwt: registerResponse.body.jwt_token });
    expect(getApiKeysResponse.status).toBe(404);
    expect(getApiKeysResponse.text).toBe(USER_NOT_FOUND);
  });

  test('Different user without permission', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const createApiKeyResponse = await createApiKey(userId, 'Test Key', ['Read', 'Create'], Date.now() + 300000, { jwt: registerResponse.body.jwt_token });
    expect(createApiKeyResponse.status).toBe(200);

    const { response: registerResponse2 } = await registerUser();
    expect(registerResponse2.status).toBe(200);

    const getApiKeysResponse = await getApiKeys(userId, { jwt: registerResponse2.body.jwt_token });
    expect(getApiKeysResponse.status).toBe(403);
    expect(getApiKeysResponse.text).toBe(FORBIDDEN);
  });

  test('Different user with permission', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const createApiKeyResponse = await createApiKey(userId, 'Test Key', ['Read', 'Create'], Date.now() + 300000, { jwt: registerResponse.body.jwt_token });
    expect(createApiKeyResponse.status).toBe(200);

    const { response: registerResponse2 } = await registerUser(undefined, undefined, true, process.env.ADMIN_KEY);
    expect(registerResponse2.status).toBe(200);

    const getApiKeysResponse = await getApiKeys(userId, { jwt: registerResponse2.body.jwt_token });
    expect(getApiKeysResponse.status).toBe(200);
  });

  test('No auth', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const createApiKeyResponse = await createApiKey(userId, 'Test Key', ['Read', 'Create'], Date.now() + 300000, { jwt: registerResponse.body.jwt_token });
    expect(createApiKeyResponse.status).toBe(200);

    const getApiKeysResponse = await getApiKeys(userId);
    expect(getApiKeysResponse.status).toBe(401);
    expect(getApiKeysResponse.text).toBe(UNAUTHORIZED);
  });

  test('Wrong auth', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const createApiKeyResponse = await createApiKey(userId, 'Test Key', ['Read', 'Create'], Date.now() + 300000, { jwt: registerResponse.body.jwt_token });
    expect(createApiKeyResponse.status).toBe(200);

    const getApiKeysResponse = await getApiKeys(userId, { apiKey: createApiKeyResponse.body.key });
    expect(getApiKeysResponse.status).toBe(403);
    expect(getApiKeysResponse.text).toBe(FORBIDDEN);
  });
});

describe('Get api key information', () => {
  test('Simple', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const createApiKeyResponse = await createApiKey(userId, 'Test Key', ['Read'], undefined, { jwt: registerResponse.body.jwt_token });
    expect(createApiKeyResponse.status).toBe(200);

    const expectedResponse = {
      name: 'Test Key',
      capabilities: ['Read']
    };

    const getApiKeyResponse = await getApiKey(userId, createApiKeyResponse.body.id, { jwt: registerResponse.body.jwt_token });
    expect(getApiKeyResponse.status).toBe(200);
    expect(getApiKeyResponse.body).toEqual(expectedResponse);
  });

  test('Non-existent api key', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const getApiKeyResponse = await getApiKey(userId, 'non-existent', { jwt: registerResponse.body.jwt_token });
    expect(getApiKeyResponse.status).toBe(404);
    expect(getApiKeyResponse.text).toBe(API_KEY_NOT_FOUND);
  });

  test('Non-existent user', async () => {
    const { response: registerResponse } = await registerUser(undefined, undefined, true, process.env.ADMIN_KEY);
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const createApiKeyResponse = await createApiKey(userId, 'Test Key', ['Read'], undefined, { jwt: registerResponse.body.jwt_token });
    expect(createApiKeyResponse.status).toBe(200);

    const getApiKeyResponse = await getApiKey('non-existent', createApiKeyResponse.body.id, { jwt: registerResponse.body.jwt_token });
    expect(getApiKeyResponse.status).toBe(404);
    expect(getApiKeyResponse.text).toBe(USER_NOT_FOUND);
  });

  test('Different user without permission', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);

    const { response: registerResponse2 } = await registerUser();
    expect(registerResponse2.status).toBe(200);
    const userId = registerResponse2.body.user_id;

    const createApiKeyResponse = await createApiKey(userId, 'Test Key', ['Read'], undefined, { jwt: registerResponse2.body.jwt_token });
    expect(createApiKeyResponse.status).toBe(200);

    const getApiKeyResponse = await getApiKey(userId, createApiKeyResponse.body.id, { jwt: registerResponse.body.jwt_token });
    expect(getApiKeyResponse.status).toBe(403);
    expect(getApiKeyResponse.text).toBe(FORBIDDEN);
  });

  test('Different user with permission', async () => {
    const { response: registerResponse } = await registerUser(undefined, undefined, true, process.env.ADMIN_KEY);
    expect(registerResponse.status).toBe(200);

    const { response: registerResponse2 } = await registerUser();
    expect(registerResponse2.status).toBe(200);
    const userId = registerResponse2.body.user_id;

    const createApiKeyResponse = await createApiKey(userId, 'Test Key', ['Read'], undefined, { jwt: registerResponse2.body.jwt_token });
    expect(createApiKeyResponse.status).toBe(200);

    const getApiKeyResponse = await getApiKey(userId, createApiKeyResponse.body.id, { jwt: registerResponse.body.jwt_token });
    expect(getApiKeyResponse.status).toBe(200);
  });

  test('No auth', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const createApiKeyResponse = await createApiKey(userId, 'Test Key', ['Read'], undefined, { jwt: registerResponse.body.jwt_token });
    expect(createApiKeyResponse.status).toBe(200);

    const getApiKeyResponse = await getApiKey(userId, createApiKeyResponse.body.id);
    expect(getApiKeyResponse.status).toBe(401);
    expect(getApiKeyResponse.text).toBe(UNAUTHORIZED);
  });

  test('Wrong auth', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const createApiKeyResponse = await createApiKey(userId, 'Test Key', ['Read'], undefined, { jwt: registerResponse.body.jwt_token });
    expect(createApiKeyResponse.status).toBe(200);

    const getApiKeyResponse = await getApiKey(userId, createApiKeyResponse.body.id, { apiKey: createApiKeyResponse.body.key });
    expect(getApiKeyResponse.status).toBe(403);
    expect(getApiKeyResponse.text).toBe(FORBIDDEN);
  });
});

describe('Delete api key', () => {
  test('Simple', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const createApiKeyResponse = await createApiKey(userId, 'Test Key', ['Read', 'Create'], undefined, { jwt: registerResponse.body.jwt_token });
    expect(createApiKeyResponse.status).toBe(200);

    const getApiKeyResponse = await getApiKey(userId, createApiKeyResponse.body.id, { jwt: registerResponse.body.jwt_token });
    expect(getApiKeyResponse.status).toBe(200);

    const deleteApiKeyResponse = await deleteApiKey(userId, createApiKeyResponse.body.id, { jwt: registerResponse.body.jwt_token });
    expect(deleteApiKeyResponse.status).toBe(204);

    const getApiKeyResponse2 = await getApiKey(userId, createApiKeyResponse.body.id, { jwt: registerResponse.body.jwt_token });
    expect(getApiKeyResponse2.status).toBe(404);
    expect(getApiKeyResponse2.text).toBe(API_KEY_NOT_FOUND);
  });

  test('Non-existent user', async () => {
    const { response: registerResponse } = await registerUser(undefined, undefined, true, process.env.ADMIN_KEY);
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const createApiKeyResponse = await createApiKey(userId, 'Test Key', ['Read', 'Create'], undefined, { jwt: registerResponse.body.jwt_token });
    expect(createApiKeyResponse.status).toBe(200);

    const deleteApiKeyResponse = await deleteApiKey('non-existent', createApiKeyResponse.body.id, { jwt: registerResponse.body.jwt_token });
    expect(deleteApiKeyResponse.status).toBe(404);
    expect(deleteApiKeyResponse.text).toBe(API_KEY_NOT_FOUND);

    const getApiKeyResponse2 = await getApiKey(userId, createApiKeyResponse.body.id, { jwt: registerResponse.body.jwt_token });
    expect(getApiKeyResponse2.status).toBe(200);
  });

  test('Non-existent api key', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const createApiKeyResponse = await createApiKey(userId, 'Test Key', ['Read', 'Create'], undefined, { jwt: registerResponse.body.jwt_token });
    expect(createApiKeyResponse.status).toBe(200);

    const deleteApiKeyResponse = await deleteApiKey(userId, 'non-existent', { jwt: registerResponse.body.jwt_token });
    expect(deleteApiKeyResponse.status).toBe(404);
    expect(deleteApiKeyResponse.text).toBe(API_KEY_NOT_FOUND);
  });

  test('Different user without permission', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const createApiKeyResponse = await createApiKey(userId, 'Test Key', ['Read', 'Create'], undefined, { jwt: registerResponse.body.jwt_token });
    expect(createApiKeyResponse.status).toBe(200);

    const { response: registerResponse2 } = await registerUser();
    expect(registerResponse2.status).toBe(200);

    const deleteApiKeyResponse = await deleteApiKey(userId, createApiKeyResponse.body.id, { jwt: registerResponse2.body.jwt_token });
    expect(deleteApiKeyResponse.status).toBe(403);
    expect(deleteApiKeyResponse.text).toBe(FORBIDDEN);
  });

  test('Different user with permission', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const createApiKeyResponse = await createApiKey(userId, 'Test Key', ['Read', 'Create'], undefined, { jwt: registerResponse.body.jwt_token });
    expect(createApiKeyResponse.status).toBe(200);

    const { response: registerResponse2 } = await registerUser(undefined, undefined, true, process.env.ADMIN_KEY);
    expect(registerResponse2.status).toBe(200);

    const deleteApiKeyResponse = await deleteApiKey(userId, createApiKeyResponse.body.id, { jwt: registerResponse2.body.jwt_token });
    expect(deleteApiKeyResponse.status).toBe(204);

    const getApiKeyResponse = await getApiKey(userId, createApiKeyResponse.body.id, { jwt: registerResponse2.body.jwt_token });
    expect(getApiKeyResponse.status).toBe(404);
    expect(getApiKeyResponse.text).toBe(API_KEY_NOT_FOUND);
  });

  test('No auth', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const createApiKeyResponse = await createApiKey(userId, 'Test Key', ['Read', 'Create'], undefined, { jwt: registerResponse.body.jwt_token });
    expect(createApiKeyResponse.status).toBe(200);

    const deleteApiKeyResponse = await deleteApiKey(userId, createApiKeyResponse.body.id);
    expect(deleteApiKeyResponse.status).toBe(401);
    expect(deleteApiKeyResponse.text).toBe(UNAUTHORIZED);
  });

  test('Wrong auth', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const createApiKeyResponse = await createApiKey(userId, 'Test Key', ['Read', 'Create'], undefined, { jwt: registerResponse.body.jwt_token });
    expect(createApiKeyResponse.status).toBe(200);

    const deleteApiKeyResponse = await deleteApiKey(userId, createApiKeyResponse.body.id, { apiKey: createApiKeyResponse.body.key });
    expect(deleteApiKeyResponse.status).toBe(403);
    expect(deleteApiKeyResponse.text).toBe(FORBIDDEN);
  });
});

describe('Get preferences', () => {
  test('Simple', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const getPreferencesResponse = await getPreferences(userId, { jwt: registerResponse.body.jwt_token });
    expect(getPreferencesResponse.status).toBe(200);
    expect(getPreferencesResponse.body).toHaveProperty('metadata_providers');
    expect(getPreferencesResponse.body.metadata_providers).toEqual(['epub_metadata_extractor']);
    expect(getPreferencesResponse.body).toHaveProperty('automatic_metadata');
    expect(getPreferencesResponse.body.automatic_metadata).toEqual(true);
  });

  test('Non-existent user', async () => {
    const { response: registerResponse } = await registerUser(undefined, undefined, true, process.env.ADMIN_KEY);
    expect(registerResponse.status).toBe(200);

    const getPreferencesResponse = await getPreferences('non-existent', { jwt: registerResponse.body.jwt_token });
    expect(getPreferencesResponse.status).toBe(404);
    expect(getPreferencesResponse.text).toBe(USER_NOT_FOUND);
  });

  test('Different user without permission', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const { response: registerResponse2 } = await registerUser();
    expect(registerResponse2.status).toBe(200);

    const getPreferencesResponse = await getPreferences(userId, { jwt: registerResponse2.body.jwt_token });
    expect(getPreferencesResponse.status).toBe(403);
    expect(getPreferencesResponse.text).toBe(FORBIDDEN);
  });

  test('Different user with permission', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const { response: registerResponse2 } = await registerUser(undefined, undefined, true, process.env.ADMIN_KEY);
    expect(registerResponse2.status).toBe(200);

    const getPreferencesResponse = await getPreferences(userId, { jwt: registerResponse2.body.jwt_token });
    expect(getPreferencesResponse.status).toBe(200);
  });

  test('No auth', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const getPreferencesResponse = await getPreferences(userId);
    expect(getPreferencesResponse.status).toBe(401);
    expect(getPreferencesResponse.text).toBe(UNAUTHORIZED);
  });
});

describe('Update preferences', () => {
  test('Simple', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const getPreferencesResponse = await getPreferences(userId, { jwt: registerResponse.body.jwt_token });
    expect(getPreferencesResponse.status).toBe(200);
    expect(getPreferencesResponse.body).toHaveProperty('metadata_providers');
    expect(getPreferencesResponse.body.metadata_providers).toEqual(['epub_metadata_extractor']);
    expect(getPreferencesResponse.body).toHaveProperty('automatic_metadata');
    expect(getPreferencesResponse.body.automatic_metadata).toEqual(true);

    const updatePreferencesResponse = await updatePreferences(userId, ['goodreads_metadata_scraper', 'epub_metadata_extractor'], false, { jwt: registerResponse.body.jwt_token });
    expect(updatePreferencesResponse.status).toBe(204);

    const getPreferencesResponse2 = await getPreferences(userId, { jwt: registerResponse.body.jwt_token });
    expect(getPreferencesResponse2.status).toBe(200);
    expect(getPreferencesResponse2.body).toHaveProperty('metadata_providers');
    expect(getPreferencesResponse2.body.metadata_providers).toEqual(['goodreads_metadata_scraper', 'epub_metadata_extractor']);
    expect(getPreferencesResponse2.body).toHaveProperty('automatic_metadata');
    expect(getPreferencesResponse2.body.automatic_metadata).toEqual(false);

    const updatePreferencesResponse2 = await updatePreferences(userId, [], true, { jwt: registerResponse.body.jwt_token });
    expect(updatePreferencesResponse2.status).toBe(204);

    const getPreferencesResponse3 = await getPreferences(userId, { jwt: registerResponse.body.jwt_token });
    expect(getPreferencesResponse3.status).toBe(200);
    expect(getPreferencesResponse3.body).toHaveProperty('metadata_providers');
    expect(getPreferencesResponse3.body.metadata_providers).toEqual([]);
    expect(getPreferencesResponse3.body).toHaveProperty('automatic_metadata');
    expect(getPreferencesResponse3.body.automatic_metadata).toEqual(true);
  });

  test('Invalid providers', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    let updatePreferencesResponse = await updatePreferences(userId, ['invalid provider'], true, { jwt: registerResponse.body.jwt_token });
    expect(updatePreferencesResponse.status).toBe(400);
    expect(updatePreferencesResponse.text).toBe(INVALID_PROVIDERS);

    updatePreferencesResponse = await updatePreferences(userId, undefined, true, { jwt: registerResponse.body.jwt_token });
    expect(updatePreferencesResponse.status).toBe(400);
    expect(updatePreferencesResponse.text).toBe(INVALID_PROVIDERS);
  });

  test('Missing metadata preference', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const updatePreferencesResponse = await updatePreferences(userId, ['epub_metadata_extractor'], undefined, { jwt: registerResponse.body.jwt_token });
    expect(updatePreferencesResponse.status).toBe(400);
    expect(updatePreferencesResponse.text).toBe(MISSING_METADATA_PREFERENCE);
  });

  test('Non-existent user', async () => {
    const { response: registerResponse } = await registerUser(undefined, undefined, true, process.env.ADMIN_KEY);
    expect(registerResponse.status).toBe(200);

    const updatePreferencesResponse = await updatePreferences('non-existent', ['goodreads_metadata_scraper'], true, { jwt: registerResponse.body.jwt_token });
    expect(updatePreferencesResponse.status).toBe(404);
    expect(updatePreferencesResponse.text).toBe(USER_NOT_FOUND);
  });

  test('Different user without permission', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const { response: registerResponse2 } = await registerUser();
    expect(registerResponse2.status).toBe(200);

    const updatePreferencesResponse = await updatePreferences(userId, ['goodreads_metadata_scraper'], true, { jwt: registerResponse2.body.jwt_token });
    expect(updatePreferencesResponse.status).toBe(403);
    expect(updatePreferencesResponse.text).toBe(FORBIDDEN);
  });

  test('Different user with permission', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const { response: registerResponse2 } = await registerUser(undefined, undefined, true, process.env.ADMIN_KEY);
    expect(registerResponse2.status).toBe(200);

    const updatePreferencesResponse = await updatePreferences(userId, ['goodreads_metadata_scraper'], true, { jwt: registerResponse2.body.jwt_token });
    expect(updatePreferencesResponse.status).toBe(204);
  });

  test('No auth', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const updatePreferencesResponse = await updatePreferences(userId, ['goodreads_metadata_scraper'], true);
    expect(updatePreferencesResponse.status).toBe(401);
    expect(updatePreferencesResponse.text).toBe(UNAUTHORIZED);
  });
});

describe('Patch preferences', () => {
  test('Simple', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    let getPreferencesResponse = await getPreferences(userId, { jwt: registerResponse.body.jwt_token });
    expect(getPreferencesResponse.status).toBe(200);
    expect(getPreferencesResponse.body).toHaveProperty('metadata_providers');
    expect(getPreferencesResponse.body.metadata_providers).toEqual(['epub_metadata_extractor']);
    expect(getPreferencesResponse.body).toHaveProperty('automatic_metadata');
    expect(getPreferencesResponse.body.automatic_metadata).toEqual(true);

    let patchPreferencesResponse = await patchPreferences(userId, ['goodreads_metadata_scraper', 'epub_metadata_extractor'], undefined, { jwt: registerResponse.body.jwt_token });
    expect(patchPreferencesResponse.status).toBe(204);

    getPreferencesResponse = await getPreferences(userId, { jwt: registerResponse.body.jwt_token });
    expect(getPreferencesResponse.status).toBe(200);
    expect(getPreferencesResponse.body).toHaveProperty('metadata_providers');
    expect(getPreferencesResponse.body.metadata_providers).toEqual(['goodreads_metadata_scraper', 'epub_metadata_extractor']);
    expect(getPreferencesResponse.body).toHaveProperty('automatic_metadata');
    expect(getPreferencesResponse.body.automatic_metadata).toEqual(true);

    patchPreferencesResponse = await patchPreferences(userId, undefined, false, { jwt: registerResponse.body.jwt_token });
    expect(patchPreferencesResponse.status).toBe(204);

    getPreferencesResponse = await getPreferences(userId, { jwt: registerResponse.body.jwt_token });
    expect(getPreferencesResponse.status).toBe(200);
    expect(getPreferencesResponse.body).toHaveProperty('metadata_providers');
    expect(getPreferencesResponse.body.metadata_providers).toEqual(['goodreads_metadata_scraper', 'epub_metadata_extractor']);
    expect(getPreferencesResponse.body).toHaveProperty('automatic_metadata');
    expect(getPreferencesResponse.body.automatic_metadata).toEqual(false);
  });

  test('Invalid providers', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const patchPreferencesResponse = await patchPreferences(userId, ['invalid provider'], undefined, { jwt: registerResponse.body.jwt_token });
    expect(patchPreferencesResponse.status).toBe(400);
    expect(patchPreferencesResponse.text).toBe(INVALID_PROVIDERS);
  });

  test('Empty body', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const updatePreferencesResponse = await patchPreferences(userId, undefined, undefined, { jwt: registerResponse.body.jwt_token });
    expect(updatePreferencesResponse.status).toBe(400);
    expect(updatePreferencesResponse.text).toBe(INVALID_PREFERENCES);
  });

  test('Non-existent user', async () => {
    const { response: registerResponse } = await registerUser(undefined, undefined, true, process.env.ADMIN_KEY);
    expect(registerResponse.status).toBe(200);

    const patchPreferencesResponse = await patchPreferences('non-existent', ['goodreads_metadata_scraper'], undefined, { jwt: registerResponse.body.jwt_token });
    expect(patchPreferencesResponse.status).toBe(404);
    expect(patchPreferencesResponse.text).toBe(USER_NOT_FOUND);
  });

  test('Different user without permission', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const { response: registerResponse2 } = await registerUser();
    expect(registerResponse2.status).toBe(200);

    const patchPreferencesResponse = await patchPreferences(userId, ['goodreads_metadata_scraper'], undefined, { jwt: registerResponse2.body.jwt_token });
    expect(patchPreferencesResponse.status).toBe(403);
    expect(patchPreferencesResponse.text).toBe(FORBIDDEN);
  });

  test('Different user with permission', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const { response: registerResponse2 } = await registerUser(undefined, undefined, true, process.env.ADMIN_KEY);
    expect(registerResponse2.status).toBe(200);

    const patchPreferencesResponse = await patchPreferences(userId, ['goodreads_metadata_scraper'], undefined, { jwt: registerResponse2.body.jwt_token });
    expect(patchPreferencesResponse.status).toBe(204);
  });

  test('No auth', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const patchPreferencesResponse = await patchPreferences(userId, undefined, true);
    expect(patchPreferencesResponse.status).toBe(401);
    expect(patchPreferencesResponse.text).toBe(UNAUTHORIZED);
  });
});

describe('Get user profile', () => {
  test('Simple', async () => {
    const { response: registerResponse, username } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const getProfileResponse = await getUserProfile(userId, { jwt: registerResponse.body.jwt_token });
    expect(getProfileResponse.status).toBe(200);
    expect(getProfileResponse.body.username).toBe(username);
  });

  test('Non-existent user', async () => {
    const { response: registerResponse } = await registerUser(undefined, undefined, true, process.env.ADMIN_KEY);
    expect(registerResponse.status).toBe(200);

    const getProfileResponse = await getUserProfile('non-existent', { jwt: registerResponse.body.jwt_token });
    expect(getProfileResponse.status).toBe(404);
    expect(getProfileResponse.text).toBe(USER_NOT_FOUND);
  });

  test('Different user without permission', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const { response: registerResponse2 } = await registerUser();
    expect(registerResponse2.status).toBe(200);

    const getProfileResponse = await getUserProfile(userId, { jwt: registerResponse2.body.jwt_token });
    expect(getProfileResponse.status).toBe(403);
    expect(getProfileResponse.text).toBe(FORBIDDEN);
  });

  test('Different user with permission', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const { response: registerResponse2 } = await registerUser(undefined, undefined, true, process.env.ADMIN_KEY);
    expect(registerResponse2.status).toBe(200);

    const getProfileResponse = await getUserProfile(userId, { jwt: registerResponse2.body.jwt_token });
    expect(getProfileResponse.status).toBe(200);
  });

  test('No auth', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const getProfileResponse = await getUserProfile(userId);
    expect(getProfileResponse.status).toBe(401);
    expect(getProfileResponse.text).toBe(UNAUTHORIZED);
  });
});

describe('Update user profile', () => {
  test('Simple', async () => {
    const { response: registerResponse, username } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    let getProfileResponse = await getUserProfile(userId, { jwt: registerResponse.body.jwt_token });
    expect(getProfileResponse.status).toBe(200);
    expect(getProfileResponse.body.username).toBe(username);

    const newUsername = randomString(16);

    const updateProfileResponse = await updateUserProfile(userId, newUsername, { jwt: registerResponse.body.jwt_token });
    expect(updateProfileResponse.status).toBe(204);

    getProfileResponse = await getUserProfile(userId, { jwt: registerResponse.body.jwt_token });
    expect(getProfileResponse.status).toBe(200);
    expect(getProfileResponse.body.username).toBe(newUsername);
  });

  test('Invalid username', async () => {
    const { response: registerResponse, username } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    let getProfileResponse = await getUserProfile(userId, { jwt: registerResponse.body.jwt_token });
    expect(getProfileResponse.status).toBe(200);
    expect(getProfileResponse.body.username).toBe(username);

    const newUsername = randomString(30);

    const updateProfileResponse = await updateUserProfile(userId, newUsername, { jwt: registerResponse.body.jwt_token });
    expect(updateProfileResponse.status).toBe(400);
    expect(updateProfileResponse.text).toBe(USERNAME_TOO_BIG);
  });

  test('Non-existent user', async () => {
    const { response: registerResponse } = await registerUser(undefined, undefined, true, process.env.ADMIN_KEY);
    expect(registerResponse.status).toBe(200);

    const updateProfileResponse = await updateUserProfile('non-existent', 'username', { jwt: registerResponse.body.jwt_token });
    expect(updateProfileResponse.status).toBe(404);
    expect(updateProfileResponse.text).toBe(USER_NOT_FOUND);
  });

  test('Different user without permission', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const { response: registerResponse2 } = await registerUser();
    expect(registerResponse2.status).toBe(200);

    const newUsername = randomString(16);

    const updateProfileResponse = await updateUserProfile(userId, newUsername, { jwt: registerResponse2.body.jwt_token });
    expect(updateProfileResponse.status).toBe(403);
    expect(updateProfileResponse.text).toBe(FORBIDDEN);
  });

  test('Different user with permission', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const { response: registerResponse2 } = await registerUser(undefined, undefined, true, process.env.ADMIN_KEY);
    expect(registerResponse2.status).toBe(200);

    const newUsername = randomString(16);

    const updateProfileResponse = await updateUserProfile(userId, newUsername, { jwt: registerResponse2.body.jwt_token });
    expect(updateProfileResponse.status).toBe(204);
  });

  test('No auth', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const updateProfileResponse = await updateUserProfile(userId, 'username');
    expect(updateProfileResponse.status).toBe(401);
    expect(updateProfileResponse.text).toBe(UNAUTHORIZED);
  });
});
