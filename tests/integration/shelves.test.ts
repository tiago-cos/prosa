import { BOOK_NOT_FOUND, INVALID_PAGINATION, uploadBook } from '../utils/books';
import { FORBIDDEN, INVALID_API_KEY, randomString, UNAUTHORIZED, wait } from '../utils/common';
import {
  addBookToShelf,
  createShelf,
  deleteBookFromShelf,
  deleteShelf,
  getShelfMetadata,
  INVALID_SHELF_NAME,
  listBooksFromShelf,
  searchShelves,
  SHELF_BOOK_CONFLICT,
  SHELF_BOOK_NOT_FOUND,
  SHELF_NAME_CONFLICT,
  SHELF_NOT_FOUND,
  updateShelf
} from '../utils/shelves';
import { createApiKey, registerUser, USER_NOT_FOUND } from '../utils/users';

describe('Create shelf JWT', () => {
  test('Simple', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const createShelfResponse = await createShelf('shelf!', userId, { jwt: registerResponse.body.jwt_token });
    expect(createShelfResponse.status).toBe(200);

    const getShelfMetadataResponse = await getShelfMetadata(createShelfResponse.text, { jwt: registerResponse.body.jwt_token });
    expect(getShelfMetadataResponse.status).toBe(200);
    expect(getShelfMetadataResponse.body.name).toBe('shelf!');
    expect(getShelfMetadataResponse.body.owner_id).toBe(userId);
    expect(getShelfMetadataResponse.body.book_count).toBe(0);
  });

  test('Implicit owner', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const createShelfResponse = await createShelf('shelf!', undefined, { jwt: registerResponse.body.jwt_token });
    expect(createShelfResponse.status).toBe(200);

    const getShelfMetadataResponse = await getShelfMetadata(createShelfResponse.text, { jwt: registerResponse.body.jwt_token });
    expect(getShelfMetadataResponse.status).toBe(200);
    expect(getShelfMetadataResponse.body.name).toBe('shelf!');
    expect(getShelfMetadataResponse.body.owner_id).toBe(userId);
    expect(getShelfMetadataResponse.body.book_count).toBe(0);
  });

  test('Invalid shelf name', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const shelfName = randomString(31);

    const createShelfResponse = await createShelf(shelfName, userId, { jwt: registerResponse.body.jwt_token });
    expect(createShelfResponse.status).toBe(400);
    expect(createShelfResponse.text).toBe(INVALID_SHELF_NAME);
  });

  test('Repeated shelf name', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const shelfName = randomString(20);

    let createShelfResponse = await createShelf(shelfName, userId, { jwt: registerResponse.body.jwt_token });
    expect(createShelfResponse.status).toBe(200);

    createShelfResponse = await createShelf(shelfName, userId, { jwt: registerResponse.body.jwt_token });
    expect(createShelfResponse.status).toBe(409);
    expect(createShelfResponse.text).toBe(SHELF_NAME_CONFLICT);
  });

  test('Different user without permission', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const { response: registerResponse2 } = await registerUser();
    expect(registerResponse2.status).toBe(200);

    const shelfName = randomString(20);

    const createShelfResponse = await createShelf(shelfName, userId, { jwt: registerResponse2.body.jwt_token });
    expect(createShelfResponse.status).toBe(403);
    expect(createShelfResponse.text).toBe(FORBIDDEN);
  });

  test('Different user with permission', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const { response: registerResponse2 } = await registerUser(undefined, undefined, process.env.ADMIN_KEY);
    expect(registerResponse2.status).toBe(200);

    const shelfName = randomString(20);

    const createShelfResponse = await createShelf(shelfName, userId, { jwt: registerResponse2.body.jwt_token });
    expect(createShelfResponse.status).toBe(200);
  });

  test('Non-existent user', async () => {
    const { response: registerResponse } = await registerUser(undefined, undefined, process.env.ADMIN_KEY);
    expect(registerResponse.status).toBe(200);

    const createShelfResponse = await createShelf('shelf', 'non-existent', { jwt: registerResponse.body.jwt_token });
    expect(createShelfResponse.status).toBe(404);
    expect(createShelfResponse.text).toBe(USER_NOT_FOUND);
  });

  test('No auth', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const shelfName = randomString(20);

    const createShelfResponse = await createShelf(shelfName, userId);
    expect(createShelfResponse.status).toBe(401);
    expect(createShelfResponse.text).toBe(UNAUTHORIZED);
  });
});

describe('Create shelf API key', () => {
  test('Simple', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const createApiKeyResponse = await createApiKey(userId, 'Test Key', ['Create'], undefined, { jwt: registerResponse.body.jwt_token });
    expect(createApiKeyResponse.status).toBe(200);

    const createShelfResponse = await createShelf('shelf!', userId, { apiKey: createApiKeyResponse.body.key });
    expect(createShelfResponse.status).toBe(200);

    const getShelfMetadataResponse = await getShelfMetadata(createShelfResponse.text, { jwt: registerResponse.body.jwt_token });
    expect(getShelfMetadataResponse.status).toBe(200);
    expect(getShelfMetadataResponse.body.name).toBe('shelf!');
    expect(getShelfMetadataResponse.body.owner_id).toBe(userId);
    expect(getShelfMetadataResponse.body.book_count).toBe(0);
  });

  test('Implicit owner', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const createApiKeyResponse = await createApiKey(userId, 'Test Key', ['Create'], undefined, { jwt: registerResponse.body.jwt_token });
    expect(createApiKeyResponse.status).toBe(200);

    const createShelfResponse = await createShelf('shelf!', undefined, { apiKey: createApiKeyResponse.body.key });
    expect(createShelfResponse.status).toBe(200);

    const getShelfMetadataResponse = await getShelfMetadata(createShelfResponse.text, { jwt: registerResponse.body.jwt_token });
    expect(getShelfMetadataResponse.status).toBe(200);
    expect(getShelfMetadataResponse.body.name).toBe('shelf!');
    expect(getShelfMetadataResponse.body.owner_id).toBe(userId);
    expect(getShelfMetadataResponse.body.book_count).toBe(0);
  });

  test('Invalid shelf name', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const createApiKeyResponse = await createApiKey(userId, 'Test Key', ['Create'], undefined, { jwt: registerResponse.body.jwt_token });
    expect(createApiKeyResponse.status).toBe(200);

    const shelfName = randomString(31);

    const createShelfResponse = await createShelf(shelfName, userId, { apiKey: createApiKeyResponse.body.key });
    expect(createShelfResponse.status).toBe(400);
    expect(createShelfResponse.text).toBe(INVALID_SHELF_NAME);
  });

  test('Repeated shelf name', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const createApiKeyResponse = await createApiKey(userId, 'Test Key', ['Create'], undefined, { jwt: registerResponse.body.jwt_token });
    expect(createApiKeyResponse.status).toBe(200);

    const shelfName = randomString(20);

    let createShelfResponse = await createShelf(shelfName, userId, { apiKey: createApiKeyResponse.body.key });
    expect(createShelfResponse.status).toBe(200);

    createShelfResponse = await createShelf(shelfName, userId, { apiKey: createApiKeyResponse.body.key });
    expect(createShelfResponse.status).toBe(409);
    expect(createShelfResponse.text).toBe(SHELF_NAME_CONFLICT);
  });

  test('Different user without permission', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const { response: registerResponse2 } = await registerUser();
    expect(registerResponse2.status).toBe(200);
    const userId2 = registerResponse2.body.user_id;

    const createApiKeyResponse = await createApiKey(userId2, 'Test Key', ['Create'], undefined, { jwt: registerResponse2.body.jwt_token });
    expect(createApiKeyResponse.status).toBe(200);

    const shelfName = randomString(20);

    const createShelfResponse = await createShelf(shelfName, userId, { apiKey: createApiKeyResponse.body.key });
    expect(createShelfResponse.status).toBe(403);
    expect(createShelfResponse.text).toBe(FORBIDDEN);
  });

  test('Different user with permission', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const { response: registerResponse2 } = await registerUser(undefined, undefined, process.env.ADMIN_KEY);
    expect(registerResponse2.status).toBe(200);
    const userId2 = registerResponse2.body.user_id;

    const createApiKeyResponse = await createApiKey(userId2, 'Test Key', ['Create'], undefined, { jwt: registerResponse2.body.jwt_token });
    expect(createApiKeyResponse.status).toBe(200);

    const shelfName = randomString(20);

    const createShelfResponse = await createShelf(shelfName, userId, { apiKey: createApiKeyResponse.body.key });
    expect(createShelfResponse.status).toBe(200);
  });

  test('Non-existent user', async () => {
    const { response: registerResponse } = await registerUser(undefined, undefined, process.env.ADMIN_KEY);
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const createApiKeyResponse = await createApiKey(userId, 'Test Key', ['Create'], undefined, { jwt: registerResponse.body.jwt_token });
    expect(createApiKeyResponse.status).toBe(200);

    const createShelfResponse = await createShelf('shelf', 'non-existent', { apiKey: createApiKeyResponse.body.key });
    expect(createShelfResponse.status).toBe(404);
    expect(createShelfResponse.text).toBe(USER_NOT_FOUND);
  });

  test('Wrong capabilities', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const createApiKeyResponse = await createApiKey(userId, 'Test Key', ['Read', 'Update', 'Delete'], undefined, { jwt: registerResponse.body.jwt_token });
    expect(createApiKeyResponse.status).toBe(200);

    const shelfName = randomString(20);

    const createShelfResponse = await createShelf(shelfName, userId, { apiKey: createApiKeyResponse.body.key });
    expect(createShelfResponse.status).toBe(403);
    expect(createShelfResponse.text).toBe(FORBIDDEN);
  });

  test('Expired key', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const timestamp = Date.now() + 1000;
    const createApiKeyResponse = await createApiKey(userId, 'Test Key', ['Create'], timestamp, { jwt: registerResponse.body.jwt_token });
    expect(createApiKeyResponse.status).toBe(200);

    // Wait for the key to expire
    await wait(1.5);

    const shelfName = randomString(20);

    const createShelfResponse = await createShelf(shelfName, userId, { apiKey: createApiKeyResponse.body.key });
    expect(createShelfResponse.status).toBe(401);
    expect(createShelfResponse.text).toBe(INVALID_API_KEY);
  });
});

describe('Get shelf metadata JWT', () => {
  test('Non-existent shelf', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);

    const getShelfMetadataResponse = await getShelfMetadata('non-existent', { jwt: registerResponse.body.jwt_token });
    expect(getShelfMetadataResponse.status).toBe(404);
    expect(getShelfMetadataResponse.text).toBe(SHELF_NOT_FOUND);
  });

  test('Different user without permission', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const createShelfResponse = await createShelf('shelf!', userId, { jwt: registerResponse.body.jwt_token });
    expect(createShelfResponse.status).toBe(200);

    const { response: registerResponse2 } = await registerUser();
    expect(registerResponse2.status).toBe(200);

    const getShelfMetadataResponse = await getShelfMetadata(createShelfResponse.text, { jwt: registerResponse2.body.jwt_token });
    expect(getShelfMetadataResponse.status).toBe(404);
    expect(getShelfMetadataResponse.text).toBe(SHELF_NOT_FOUND);
  });

  test('Different user with permission', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const createShelfResponse = await createShelf('shelf!', userId, { jwt: registerResponse.body.jwt_token });
    expect(createShelfResponse.status).toBe(200);

    const { response: registerResponse2 } = await registerUser(undefined, undefined, process.env.ADMIN_KEY);
    expect(registerResponse2.status).toBe(200);

    const getShelfMetadataResponse = await getShelfMetadata(createShelfResponse.text, { jwt: registerResponse2.body.jwt_token });
    expect(getShelfMetadataResponse.status).toBe(200);
  });

  test('No auth', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const createShelfResponse = await createShelf('shelf!', userId, { jwt: registerResponse.body.jwt_token });
    expect(createShelfResponse.status).toBe(200);

    const getShelfMetadataResponse = await getShelfMetadata(createShelfResponse.text);
    expect(getShelfMetadataResponse.status).toBe(401);
    expect(getShelfMetadataResponse.text).toBe(UNAUTHORIZED);
  });
});

describe('Get shelf metadata API key', () => {
  test('Non-existent shelf', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const createApiKeyResponse = await createApiKey(userId, 'Test Key', ['Read'], undefined, { jwt: registerResponse.body.jwt_token });
    expect(createApiKeyResponse.status).toBe(200);

    const getShelfMetadataResponse = await getShelfMetadata('non-existent', { apiKey: createApiKeyResponse.body.key });
    expect(getShelfMetadataResponse.status).toBe(404);
    expect(getShelfMetadataResponse.text).toBe(SHELF_NOT_FOUND);
  });

  test('Different user without permission', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const createShelfResponse = await createShelf('shelf!', userId, { jwt: registerResponse.body.jwt_token });
    expect(createShelfResponse.status).toBe(200);

    const { response: registerResponse2 } = await registerUser();
    expect(registerResponse2.status).toBe(200);
    const userId2 = registerResponse2.body.user_id;

    const createApiKeyResponse = await createApiKey(userId2, 'Test Key', ['Read'], undefined, { jwt: registerResponse2.body.jwt_token });
    expect(createApiKeyResponse.status).toBe(200);

    const getShelfMetadataResponse = await getShelfMetadata(createShelfResponse.text, { apiKey: createApiKeyResponse.body.key });
    expect(getShelfMetadataResponse.status).toBe(404);
    expect(getShelfMetadataResponse.text).toBe(SHELF_NOT_FOUND);
  });

  test('Different user with permission', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const createShelfResponse = await createShelf('shelf!', userId, { jwt: registerResponse.body.jwt_token });
    expect(createShelfResponse.status).toBe(200);

    const { response: registerResponse2 } = await registerUser(undefined, undefined, process.env.ADMIN_KEY);
    expect(registerResponse2.status).toBe(200);
    const userId2 = registerResponse2.body.user_id;

    const createApiKeyResponse = await createApiKey(userId2, 'Test Key', ['Read'], undefined, { jwt: registerResponse2.body.jwt_token });
    expect(createApiKeyResponse.status).toBe(200);

    const getShelfMetadataResponse = await getShelfMetadata(createShelfResponse.text, { apiKey: createApiKeyResponse.body.key });
    expect(getShelfMetadataResponse.status).toBe(200);
  });

  test('Wrong capabilities', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const createShelfResponse = await createShelf('shelf!', userId, { jwt: registerResponse.body.jwt_token });
    expect(createShelfResponse.status).toBe(200);

    const createApiKeyResponse = await createApiKey(userId, 'Test Key', ['Create', 'Update', 'Delete'], undefined, { jwt: registerResponse.body.jwt_token });
    expect(createApiKeyResponse.status).toBe(200);

    const getShelfMetadataResponse = await getShelfMetadata(createShelfResponse.text, { apiKey: createApiKeyResponse.body.key });
    expect(getShelfMetadataResponse.status).toBe(403);
    expect(getShelfMetadataResponse.text).toBe(FORBIDDEN);
  });

  test('Expired key', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const shelfName = randomString(20);

    const createShelfResponse = await createShelf(shelfName, userId, { jwt: registerResponse.body.jwt_token });
    expect(createShelfResponse.status).toBe(200);

    const timestamp = Date.now() + 1000;
    const createApiKeyResponse = await createApiKey(userId, 'Test Key', ['Read'], timestamp, { jwt: registerResponse.body.jwt_token });
    expect(createApiKeyResponse.status).toBe(200);

    // Wait for the key to expire
    await wait(1.5);

    const getShelfMetadataResponse = await getShelfMetadata(createShelfResponse.text, { apiKey: createApiKeyResponse.body.key });
    expect(getShelfMetadataResponse.status).toBe(401);
    expect(getShelfMetadataResponse.text).toBe(INVALID_API_KEY);
  });
});

describe('Update shelf JWT', () => {
  test('Simple', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const createShelfResponse = await createShelf('shelf!', userId, { jwt: registerResponse.body.jwt_token });
    expect(createShelfResponse.status).toBe(200);

    let getShelfMetadataResponse = await getShelfMetadata(createShelfResponse.text, { jwt: registerResponse.body.jwt_token });
    expect(getShelfMetadataResponse.status).toBe(200);
    expect(getShelfMetadataResponse.body.name).toBe('shelf!');

    const updateShelfResponse = await updateShelf(createShelfResponse.text, 'new-shelf!', { jwt: registerResponse.body.jwt_token });
    expect(updateShelfResponse.status).toBe(204);

    getShelfMetadataResponse = await getShelfMetadata(createShelfResponse.text, { jwt: registerResponse.body.jwt_token });
    expect(getShelfMetadataResponse.status).toBe(200);
    expect(getShelfMetadataResponse.body.name).toBe('new-shelf!');
  });

  test('Invalid shelf name', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const createShelfResponse = await createShelf('shelf!', userId, { jwt: registerResponse.body.jwt_token });
    expect(createShelfResponse.status).toBe(200);

    const invalidName = randomString(31);

    const updateShelfResponse = await updateShelf(createShelfResponse.text, invalidName, { jwt: registerResponse.body.jwt_token });
    expect(updateShelfResponse.status).toBe(400);
    expect(updateShelfResponse.text).toBe(INVALID_SHELF_NAME);
  });

  test('Repeated shelf name', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const shelfName = randomString(20);

    let createShelfResponse = await createShelf(shelfName, userId, { jwt: registerResponse.body.jwt_token });
    expect(createShelfResponse.status).toBe(200);

    createShelfResponse = await createShelf('to-update', userId, { jwt: registerResponse.body.jwt_token });
    expect(createShelfResponse.status).toBe(200);

    const updateShelfResponse = await updateShelf(createShelfResponse.text, shelfName, { jwt: registerResponse.body.jwt_token });
    expect(updateShelfResponse.status).toBe(409);
    expect(updateShelfResponse.text).toBe(SHELF_NAME_CONFLICT);
  });

  test('Different user without permission', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const shelfName = randomString(20);

    const createShelfResponse = await createShelf(shelfName, userId, { jwt: registerResponse.body.jwt_token });
    expect(createShelfResponse.status).toBe(200);

    const { response: registerResponse2 } = await registerUser();
    expect(registerResponse2.status).toBe(200);

    const updateShelfResponse = await updateShelf(createShelfResponse.text, 'new-name', { jwt: registerResponse2.body.jwt_token });
    expect(updateShelfResponse.status).toBe(404);
    expect(updateShelfResponse.text).toBe(SHELF_NOT_FOUND);
  });

  test('Different user with permission', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const shelfName = randomString(20);

    const createShelfResponse = await createShelf(shelfName, userId, { jwt: registerResponse.body.jwt_token });
    expect(createShelfResponse.status).toBe(200);

    const { response: registerResponse2 } = await registerUser(undefined, undefined, process.env.ADMIN_KEY);
    expect(registerResponse2.status).toBe(200);

    const updateShelfResponse = await updateShelf(createShelfResponse.text, 'new-name', { jwt: registerResponse2.body.jwt_token });
    expect(updateShelfResponse.status).toBe(204);

    const getShelfMetadataResponse = await getShelfMetadata(createShelfResponse.text, { jwt: registerResponse.body.jwt_token });
    expect(getShelfMetadataResponse.status).toBe(200);
    expect(getShelfMetadataResponse.body.name).toBe('new-name');
  });

  test('Non-existent shelf', async () => {
    const { response: registerResponse } = await registerUser(undefined, undefined, process.env.ADMIN_KEY);
    expect(registerResponse.status).toBe(200);

    const updateShelfResponse = await updateShelf('non-existent', 'new-name', { jwt: registerResponse.body.jwt_token });
    expect(updateShelfResponse.status).toBe(404);
    expect(updateShelfResponse.text).toBe(SHELF_NOT_FOUND);
  });

  test('No auth', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const shelfName = randomString(20);

    const createShelfResponse = await createShelf(shelfName, userId, { jwt: registerResponse.body.jwt_token });
    expect(createShelfResponse.status).toBe(200);

    const updateShelfResponse = await updateShelf(shelfName, 'new-name');
    expect(updateShelfResponse.status).toBe(401);
    expect(updateShelfResponse.text).toBe(UNAUTHORIZED);
  });
});

describe('Update shelf API key', () => {
  test('Simple', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const createShelfResponse = await createShelf('shelf!', userId, { jwt: registerResponse.body.jwt_token });
    expect(createShelfResponse.status).toBe(200);

    let getShelfMetadataResponse = await getShelfMetadata(createShelfResponse.text, { jwt: registerResponse.body.jwt_token });
    expect(getShelfMetadataResponse.status).toBe(200);
    expect(getShelfMetadataResponse.body.name).toBe('shelf!');

    const createApiKeyResponse = await createApiKey(userId, 'Test Key', ['Update'], undefined, { jwt: registerResponse.body.jwt_token });
    expect(createApiKeyResponse.status).toBe(200);

    const updateShelfResponse = await updateShelf(createShelfResponse.text, 'new-shelf!', { apiKey: createApiKeyResponse.body.key });
    expect(updateShelfResponse.status).toBe(204);

    getShelfMetadataResponse = await getShelfMetadata(createShelfResponse.text, { jwt: registerResponse.body.jwt_token });
    expect(getShelfMetadataResponse.status).toBe(200);
    expect(getShelfMetadataResponse.body.name).toBe('new-shelf!');
  });

  test('Invalid shelf name', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const createShelfResponse = await createShelf('shelf!', userId, { jwt: registerResponse.body.jwt_token });
    expect(createShelfResponse.status).toBe(200);

    const createApiKeyResponse = await createApiKey(userId, 'Test Key', ['Update'], undefined, { jwt: registerResponse.body.jwt_token });
    expect(createApiKeyResponse.status).toBe(200);

    const invalidName = randomString(31);

    const updateShelfResponse = await updateShelf(createShelfResponse.text, invalidName, { apiKey: createApiKeyResponse.body.key });
    expect(updateShelfResponse.status).toBe(400);
    expect(updateShelfResponse.text).toBe(INVALID_SHELF_NAME);
  });

  test('Repeated shelf name', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const shelfName = randomString(20);

    let createShelfResponse = await createShelf(shelfName, userId, { jwt: registerResponse.body.jwt_token });
    expect(createShelfResponse.status).toBe(200);

    createShelfResponse = await createShelf('to-update', userId, { jwt: registerResponse.body.jwt_token });
    expect(createShelfResponse.status).toBe(200);

    const createApiKeyResponse = await createApiKey(userId, 'Test Key', ['Update'], undefined, { jwt: registerResponse.body.jwt_token });
    expect(createApiKeyResponse.status).toBe(200);

    const updateShelfResponse = await updateShelf(createShelfResponse.text, shelfName, { apiKey: createApiKeyResponse.body.key });
    expect(updateShelfResponse.status).toBe(409);
    expect(updateShelfResponse.text).toBe(SHELF_NAME_CONFLICT);
  });

  test('Different user without permission', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const shelfName = randomString(20);

    const createShelfResponse = await createShelf(shelfName, userId, { jwt: registerResponse.body.jwt_token });
    expect(createShelfResponse.status).toBe(200);

    const { response: registerResponse2 } = await registerUser();
    expect(registerResponse2.status).toBe(200);
    const userId2 = registerResponse2.body.user_id;

    const createApiKeyResponse = await createApiKey(userId2, 'Test Key', ['Update'], undefined, { jwt: registerResponse2.body.jwt_token });
    expect(createApiKeyResponse.status).toBe(200);

    const updateShelfResponse = await updateShelf(createShelfResponse.text, 'new-name', { apiKey: createApiKeyResponse.body.key });
    expect(updateShelfResponse.status).toBe(404);
    expect(updateShelfResponse.text).toBe(SHELF_NOT_FOUND);
  });

  test('Different user with permission', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const shelfName = randomString(20);

    const createShelfResponse = await createShelf(shelfName, userId, { jwt: registerResponse.body.jwt_token });
    expect(createShelfResponse.status).toBe(200);

    const { response: registerResponse2 } = await registerUser(undefined, undefined, process.env.ADMIN_KEY);
    expect(registerResponse2.status).toBe(200);
    const userId2 = registerResponse2.body.user_id;

    const createApiKeyResponse = await createApiKey(userId2, 'Test Key', ['Update'], undefined, { jwt: registerResponse2.body.jwt_token });
    expect(createApiKeyResponse.status).toBe(200);

    const updateShelfResponse = await updateShelf(createShelfResponse.text, 'new-name', { apiKey: createApiKeyResponse.body.key });
    expect(updateShelfResponse.status).toBe(204);

    const getShelfMetadataResponse = await getShelfMetadata(createShelfResponse.text, { jwt: registerResponse.body.jwt_token });
    expect(getShelfMetadataResponse.status).toBe(200);
    expect(getShelfMetadataResponse.body.name).toBe('new-name');
  });

  test('Non-existent shelf', async () => {
    const { response: registerResponse } = await registerUser(undefined, undefined, process.env.ADMIN_KEY);
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const createApiKeyResponse = await createApiKey(userId, 'Test Key', ['Update'], undefined, { jwt: registerResponse.body.jwt_token });
    expect(createApiKeyResponse.status).toBe(200);

    const updateShelfResponse = await updateShelf('non-existent', 'new-name', { apiKey: createApiKeyResponse.body.key });
    expect(updateShelfResponse.status).toBe(404);
    expect(updateShelfResponse.text).toBe(SHELF_NOT_FOUND);
  });

  test('Wrong capabilities', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const createApiKeyResponse = await createApiKey(userId, 'Test Key', ['Read', 'Create', 'Delete'], undefined, { jwt: registerResponse.body.jwt_token });
    expect(createApiKeyResponse.status).toBe(200);

    const shelfName = randomString(20);

    const createShelfResponse = await createShelf(shelfName, userId, { apiKey: createApiKeyResponse.body.key });
    expect(createShelfResponse.status).toBe(200);

    const updateShelfResponse = await updateShelf(createShelfResponse.text, 'new-name', { apiKey: createApiKeyResponse.body.key });
    expect(updateShelfResponse.status).toBe(403);
    expect(updateShelfResponse.text).toBe(FORBIDDEN);
  });

  test('Expired key', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const timestamp = Date.now() + 1000;
    const createApiKeyResponse = await createApiKey(userId, 'Test Key', ['Update'], timestamp, { jwt: registerResponse.body.jwt_token });
    expect(createApiKeyResponse.status).toBe(200);

    // Wait for the key to expire
    await wait(1.5);

    const shelfName = randomString(20);

    const createShelfResponse = await createShelf(shelfName, userId, { jwt: registerResponse.body.jwt_token });
    expect(createShelfResponse.status).toBe(200);

    const updateShelfResponse = await updateShelf(createShelfResponse.text, 'new-name', { apiKey: createApiKeyResponse.body.key });
    expect(updateShelfResponse.status).toBe(401);
    expect(updateShelfResponse.text).toBe(INVALID_API_KEY);
  });
});

describe('Delete shelf JWT', () => {
  test('Simple', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const createShelfResponse = await createShelf('shelf!', userId, { jwt: registerResponse.body.jwt_token });
    expect(createShelfResponse.status).toBe(200);

    let getShelfMetadataResponse = await getShelfMetadata(createShelfResponse.text, { jwt: registerResponse.body.jwt_token });
    expect(getShelfMetadataResponse.status).toBe(200);

    const deleteShelfResponse = await deleteShelf(createShelfResponse.text, { jwt: registerResponse.body.jwt_token });
    expect(deleteShelfResponse.status).toBe(204);

    getShelfMetadataResponse = await getShelfMetadata(createShelfResponse.text, { jwt: registerResponse.body.jwt_token });
    expect(getShelfMetadataResponse.status).toBe(404);
  });

  test('Deletion of books', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const uploadBookResponse = await uploadBook(userId, 'The_Great_Gatsby.epub', { jwt: registerResponse.body.jwt_token });
    expect(uploadBookResponse.status).toBe(200);

    const createShelfResponse = await createShelf('shelf!', userId, { jwt: registerResponse.body.jwt_token });
    expect(createShelfResponse.status).toBe(200);

    const addBookToShelfResponse = await addBookToShelf(createShelfResponse.text, uploadBookResponse.text, { jwt: registerResponse.body.jwt_token });
    expect(addBookToShelfResponse.status).toBe(204);

    let listShelfBooksResponse = await listBooksFromShelf(createShelfResponse.text, { jwt: registerResponse.body.jwt_token });
    expect(listShelfBooksResponse.status).toBe(200);
    expect(listShelfBooksResponse.body).toEqual([uploadBookResponse.text]);

    const deleteShelfResponse = await deleteShelf(createShelfResponse.text, { jwt: registerResponse.body.jwt_token });
    expect(deleteShelfResponse.status).toBe(204);

    listShelfBooksResponse = await listBooksFromShelf(createShelfResponse.text, { jwt: registerResponse.body.jwt_token });
    expect(listShelfBooksResponse.status).toBe(404);
    expect(listShelfBooksResponse.text).toEqual(SHELF_NOT_FOUND);

    const deleteBookFromShelfResponse = await deleteBookFromShelf(createShelfResponse.text, uploadBookResponse.text, { jwt: registerResponse.body.jwt_token });
    expect(deleteBookFromShelfResponse.status).toBe(404);
    expect(deleteBookFromShelfResponse.text).toEqual(SHELF_NOT_FOUND);
  });

  test('Non-existent shelf', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);

    const deleteShelfResponse = await deleteShelf('non-existent', { jwt: registerResponse.body.jwt_token });
    expect(deleteShelfResponse.status).toBe(404);
    expect(deleteShelfResponse.text).toBe(SHELF_NOT_FOUND);
  });

  test('Different user without permission', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const createShelfResponse = await createShelf('shelf!', userId, { jwt: registerResponse.body.jwt_token });
    expect(createShelfResponse.status).toBe(200);

    const { response: registerResponse2 } = await registerUser();
    expect(registerResponse2.status).toBe(200);

    const deleteShelfResponse = await deleteShelf(createShelfResponse.text, { jwt: registerResponse2.body.jwt_token });
    expect(deleteShelfResponse.status).toBe(404);
    expect(deleteShelfResponse.text).toBe(SHELF_NOT_FOUND);
  });

  test('Different user with permission', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const createShelfResponse = await createShelf('shelf!', userId, { jwt: registerResponse.body.jwt_token });
    expect(createShelfResponse.status).toBe(200);

    const { response: registerResponse2 } = await registerUser(undefined, undefined, process.env.ADMIN_KEY);
    expect(registerResponse2.status).toBe(200);

    const deleteShelfResponse = await deleteShelf(createShelfResponse.text, { jwt: registerResponse2.body.jwt_token });
    expect(deleteShelfResponse.status).toBe(204);
  });

  test('No auth', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const createShelfResponse = await createShelf('shelf!', userId, { jwt: registerResponse.body.jwt_token });
    expect(createShelfResponse.status).toBe(200);

    const deleteShelfResponse = await deleteShelf(createShelfResponse.text);
    expect(deleteShelfResponse.status).toBe(401);
    expect(deleteShelfResponse.text).toBe(UNAUTHORIZED);
  });
});

describe('Delete shelf API key', () => {
  test('Simple', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const createShelfResponse = await createShelf('shelf!', userId, { jwt: registerResponse.body.jwt_token });
    expect(createShelfResponse.status).toBe(200);

    let getShelfMetadataResponse = await getShelfMetadata(createShelfResponse.text, { jwt: registerResponse.body.jwt_token });
    expect(getShelfMetadataResponse.status).toBe(200);

    const createApiKeyResponse = await createApiKey(userId, 'Test Key', ['Delete'], undefined, { jwt: registerResponse.body.jwt_token });
    expect(createApiKeyResponse.status).toBe(200);

    const deleteShelfResponse = await deleteShelf(createShelfResponse.text, { apiKey: createApiKeyResponse.body.key });
    expect(deleteShelfResponse.status).toBe(204);

    getShelfMetadataResponse = await getShelfMetadata(createShelfResponse.text, { jwt: registerResponse.body.jwt_token });
    expect(getShelfMetadataResponse.status).toBe(404);
  });

  test('Non-existent shelf', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const createApiKeyResponse = await createApiKey(userId, 'Test Key', ['Delete'], undefined, { jwt: registerResponse.body.jwt_token });
    expect(createApiKeyResponse.status).toBe(200);

    const deleteShelfResponse = await deleteShelf('non-existent', { apiKey: createApiKeyResponse.body.key });
    expect(deleteShelfResponse.status).toBe(404);
    expect(deleteShelfResponse.text).toBe(SHELF_NOT_FOUND);
  });

  test('Different user without permission', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const createShelfResponse = await createShelf('shelf!', userId, { jwt: registerResponse.body.jwt_token });
    expect(createShelfResponse.status).toBe(200);

    const { response: registerResponse2 } = await registerUser();
    expect(registerResponse2.status).toBe(200);
    const userId2 = registerResponse2.body.user_id;

    const createApiKeyResponse = await createApiKey(userId2, 'Test Key', ['Delete'], undefined, { jwt: registerResponse2.body.jwt_token });
    expect(createApiKeyResponse.status).toBe(200);

    const deleteShelfResponse = await deleteShelf(createShelfResponse.text, { apiKey: createApiKeyResponse.body.key });
    expect(deleteShelfResponse.status).toBe(404);
    expect(deleteShelfResponse.text).toBe(SHELF_NOT_FOUND);
  });

  test('Different user with permission', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const createShelfResponse = await createShelf('shelf!', userId, { jwt: registerResponse.body.jwt_token });
    expect(createShelfResponse.status).toBe(200);

    const { response: registerResponse2 } = await registerUser(undefined, undefined, process.env.ADMIN_KEY);
    expect(registerResponse2.status).toBe(200);
    const userId2 = registerResponse2.body.user_id;

    const createApiKeyResponse = await createApiKey(userId2, 'Test Key', ['Delete'], undefined, { jwt: registerResponse2.body.jwt_token });
    expect(createApiKeyResponse.status).toBe(200);

    const deleteShelfResponse = await deleteShelf(createShelfResponse.text, { apiKey: createApiKeyResponse.body.key });
    expect(deleteShelfResponse.status).toBe(204);
  });

  test('Wrong capabilities', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const createApiKeyResponse = await createApiKey(userId, 'Test Key', ['Read', 'Create', 'Update'], undefined, { jwt: registerResponse.body.jwt_token });
    expect(createApiKeyResponse.status).toBe(200);

    const shelfName = randomString(20);

    const createShelfResponse = await createShelf(shelfName, userId, { apiKey: createApiKeyResponse.body.key });
    expect(createShelfResponse.status).toBe(200);

    const deleteShelfResponse = await deleteShelf(createShelfResponse.text, { apiKey: createApiKeyResponse.body.key });
    expect(deleteShelfResponse.status).toBe(403);
    expect(deleteShelfResponse.text).toBe(FORBIDDEN);
  });

  test('Expired key', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const timestamp = Date.now() + 1000;
    const createApiKeyResponse = await createApiKey(userId, 'Test Key', ['Update'], timestamp, { jwt: registerResponse.body.jwt_token });
    expect(createApiKeyResponse.status).toBe(200);

    // Wait for the key to expire
    await wait(1.5);

    const shelfName = randomString(20);

    const createShelfResponse = await createShelf(shelfName, userId, { jwt: registerResponse.body.jwt_token });
    expect(createShelfResponse.status).toBe(200);

    const deleteShelfResponse = await deleteShelf(createShelfResponse.text, { apiKey: createApiKeyResponse.body.key });
    expect(deleteShelfResponse.status).toBe(401);
    expect(deleteShelfResponse.text).toBe(INVALID_API_KEY);
  });
});

describe('Search shelves JWT', () => {
  test('Simple', async () => {
    const { response: registerResponse, username } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const createShelfResponse = await createShelf('shelf!', userId, { jwt: registerResponse.body.jwt_token });
    expect(createShelfResponse.status).toBe(200);

    const searchResponse = await searchShelves(username, undefined, undefined, undefined, { jwt: registerResponse.body.jwt_token });
    expect(searchResponse.status).toBe(200);

    const expectedResponse = {
      shelf_ids: [createShelfResponse.text],
      page_size: 10,
      total_elements: 1,
      total_pages: 1,
      current_page: 1
    };

    expect(searchResponse.body).toEqual(expectedResponse);
  });

  test('Search shelve name', async () => {
    const { response: registerResponse, username } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const createShelfResponse = await createShelf('Favorite Fantasy', userId, { jwt: registerResponse.body.jwt_token });
    expect(createShelfResponse.status).toBe(200);

    const createShelfResponse2 = await createShelf('Comic Books', userId, { jwt: registerResponse.body.jwt_token });
    expect(createShelfResponse2.status).toBe(200);

    let searchResponse = await searchShelves(username, undefined, undefined, undefined, { jwt: registerResponse.body.jwt_token });
    expect(searchResponse.status).toBe(200);

    expect(searchResponse.body.shelf_ids).toContain(createShelfResponse.text);
    expect(searchResponse.body.shelf_ids).toContain(createShelfResponse2.text);

    searchResponse = await searchShelves(username, 'AVOR', undefined, undefined, { jwt: registerResponse.body.jwt_token });
    expect(searchResponse.status).toBe(200);

    expect(searchResponse.body.shelf_ids).toEqual([createShelfResponse.text]);

    searchResponse = await searchShelves(username, 'COM', undefined, undefined, { jwt: registerResponse.body.jwt_token });
    expect(searchResponse.status).toBe(200);

    expect(searchResponse.body.shelf_ids).toEqual([createShelfResponse2.text]);
  });

  test('Pagination', async () => {
    const { response: registerResponse, username } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const createShelfResponse = await createShelf('Favorite Fantasy', userId, { jwt: registerResponse.body.jwt_token });
    expect(createShelfResponse.status).toBe(200);

    const createShelfResponse2 = await createShelf('Comic Books', userId, { jwt: registerResponse.body.jwt_token });
    expect(createShelfResponse2.status).toBe(200);

    let searchResponse = await searchShelves(username, undefined, undefined, undefined, { jwt: registerResponse.body.jwt_token });
    expect(searchResponse.status).toBe(200);

    expect(searchResponse.body.shelf_ids).toContain(createShelfResponse.text);
    expect(searchResponse.body.shelf_ids).toContain(createShelfResponse2.text);

    let expectedResponse = {
      shelf_ids: [createShelfResponse.text < createShelfResponse2.text ? createShelfResponse.text : createShelfResponse2.text],
      page_size: 1,
      total_elements: 2,
      total_pages: 2,
      current_page: 1
    };

    searchResponse = await searchShelves(username, undefined, 1, 1, { jwt: registerResponse.body.jwt_token });
    expect(searchResponse.status).toBe(200);

    expect(searchResponse.body).toEqual(expectedResponse);

    expectedResponse = {
      shelf_ids: [createShelfResponse.text < createShelfResponse2.text ? createShelfResponse2.text : createShelfResponse.text],
      page_size: 1,
      total_elements: 2,
      total_pages: 2,
      current_page: 2
    };

    const searchResponse3 = await searchShelves(username, undefined, 2, 1, { jwt: registerResponse.body.jwt_token });
    expect(searchResponse3.status).toBe(200);

    expect(searchResponse3.body).toEqual(expectedResponse);
  });

  test('Different users', async () => {
    const { response: registerResponse, username } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const { response: registerResponse2, username: username2 } = await registerUser();
    expect(registerResponse2.status).toBe(200);
    const userId2 = registerResponse2.body.user_id;

    const createShelfResponse = await createShelf('Favorite Fantasy', userId, { jwt: registerResponse.body.jwt_token });
    expect(createShelfResponse.status).toBe(200);

    const createShelfResponse2 = await createShelf('Favorite Fantasy', userId2, { jwt: registerResponse2.body.jwt_token });
    expect(createShelfResponse2.status).toBe(200);

    let searchResponse = await searchShelves(username, undefined, undefined, undefined, { jwt: registerResponse.body.jwt_token });
    expect(searchResponse.status).toBe(200);
    expect(searchResponse.body.shelf_ids).toEqual([createShelfResponse.text]);

    searchResponse = await searchShelves(username2, undefined, undefined, undefined, { jwt: registerResponse2.body.jwt_token });
    expect(searchResponse.status).toBe(200);
    expect(searchResponse.body.shelf_ids).toEqual([createShelfResponse2.text]);
  });

  test('Invalid pagination', async () => {
    const { response: registerResponse, username } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const createShelfResponse = await createShelf('Favorite Fantasy', userId, { jwt: registerResponse.body.jwt_token });
    expect(createShelfResponse.status).toBe(200);

    let searchResponse = await searchShelves(username, undefined, -1, undefined, { jwt: registerResponse.body.jwt_token });
    expect(searchResponse.status).toBe(400);
    expect(searchResponse.text).toBe(INVALID_PAGINATION);

    searchResponse = await searchShelves(username, undefined, undefined, -1, { jwt: registerResponse.body.jwt_token });
    expect(searchResponse.status).toBe(400);
    expect(searchResponse.text).toBe(INVALID_PAGINATION);

    searchResponse = await searchShelves(username, undefined, 'invalid', undefined, { jwt: registerResponse.body.jwt_token });
    expect(searchResponse.status).toBe(400);
    expect(searchResponse.text).toBe(INVALID_PAGINATION);

    searchResponse = await searchShelves(username, undefined, undefined, 'invalid', { jwt: registerResponse.body.jwt_token });
    expect(searchResponse.status).toBe(400);
    expect(searchResponse.text).toBe(INVALID_PAGINATION);
  });

  test('Non-existent user', async () => {
    const { response: registerResponse } = await registerUser(undefined, undefined, process.env.ADMIN_KEY);
    expect(registerResponse.status).toBe(200);

    let searchResponse = await searchShelves('non-existent', undefined, undefined, undefined, { jwt: registerResponse.body.jwt_token });
    expect(searchResponse.status).toBe(404);
    expect(searchResponse.text).toBe(USER_NOT_FOUND);
  });

  test('Different user without permission', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);

    const { response: registerResponse2, username: username2 } = await registerUser();
    expect(registerResponse2.status).toBe(200);

    let searchResponse = await searchShelves(username2, undefined, undefined, undefined, { jwt: registerResponse.body.jwt_token });
    expect(searchResponse.status).toBe(403);
    expect(searchResponse.text).toBe(FORBIDDEN);
  });

  test('Different user with permission', async () => {
    const { response: registerResponse } = await registerUser(undefined, undefined, process.env.ADMIN_KEY);
    expect(registerResponse.status).toBe(200);

    const { response: registerResponse2, username: username2 } = await registerUser();
    expect(registerResponse2.status).toBe(200);

    let searchResponse = await searchShelves(username2, undefined, undefined, undefined, { jwt: registerResponse.body.jwt_token });
    expect(searchResponse.status).toBe(200);
    expect(searchResponse.body.shelf_ids).toEqual([]);
  });

  test('All shelves without permission', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);

    let searchResponse = await searchShelves(undefined, undefined, undefined, undefined, { jwt: registerResponse.body.jwt_token });
    expect(searchResponse.status).toBe(403);
    expect(searchResponse.text).toBe(FORBIDDEN);
  });

  test('All books with permission', async () => {
    const { response: registerResponse } = await registerUser(undefined, undefined, process.env.ADMIN_KEY);
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const { response: registerResponse2 } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId2 = registerResponse2.body.user_id;

    const createShelfResponse = await createShelf('Favorite Fantasy', userId, { jwt: registerResponse.body.jwt_token });
    expect(createShelfResponse.status).toBe(200);

    const createShelfResponse2 = await createShelf('Comic Books', userId2, { jwt: registerResponse2.body.jwt_token });
    expect(createShelfResponse2.status).toBe(200);

    let searchResponse = await searchShelves(undefined, undefined, undefined, 1000, { jwt: registerResponse.body.jwt_token });
    expect(searchResponse.status).toBe(200);

    expect(searchResponse.body.shelf_ids).toContain(createShelfResponse.text);
    expect(searchResponse.body.shelf_ids).toContain(createShelfResponse2.text);
  });

  test('No auth', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const createShelfResponse = await createShelf('Favorite Fantasy', userId, { jwt: registerResponse.body.jwt_token });
    expect(createShelfResponse.status).toBe(200);

    const searchResponse = await searchShelves(userId);
    expect(searchResponse.status).toBe(401);
    expect(searchResponse.text).toEqual(UNAUTHORIZED);
  });
});

describe('Search shelves API key', () => {
  test('Simple', async () => {
    const { response: registerResponse, username } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const createShelfResponse = await createShelf('shelf!', userId, { jwt: registerResponse.body.jwt_token });
    expect(createShelfResponse.status).toBe(200);

    const createApiKeyResponse = await createApiKey(userId, 'Test Key', ['Read'], undefined, { jwt: registerResponse.body.jwt_token });
    expect(createApiKeyResponse.status).toBe(200);

    const searchResponse = await searchShelves(username, undefined, undefined, undefined, { apiKey: createApiKeyResponse.body.key });
    expect(searchResponse.status).toBe(200);

    const expectedResponse = {
      shelf_ids: [createShelfResponse.text],
      page_size: 10,
      total_elements: 1,
      total_pages: 1,
      current_page: 1
    };

    expect(searchResponse.body).toEqual(expectedResponse);
  });

  test('Search shelve name', async () => {
    const { response: registerResponse, username } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const createShelfResponse = await createShelf('Favorite Fantasy', userId, { jwt: registerResponse.body.jwt_token });
    expect(createShelfResponse.status).toBe(200);

    const createShelfResponse2 = await createShelf('Comic Books', userId, { jwt: registerResponse.body.jwt_token });
    expect(createShelfResponse2.status).toBe(200);

    const createApiKeyResponse = await createApiKey(userId, 'Test Key', ['Read'], undefined, { jwt: registerResponse.body.jwt_token });
    expect(createApiKeyResponse.status).toBe(200);

    let searchResponse = await searchShelves(username, undefined, undefined, undefined, { apiKey: createApiKeyResponse.body.key });
    expect(searchResponse.status).toBe(200);

    expect(searchResponse.body.shelf_ids).toContain(createShelfResponse.text);
    expect(searchResponse.body.shelf_ids).toContain(createShelfResponse2.text);

    searchResponse = await searchShelves(username, 'AVOR', undefined, undefined, { apiKey: createApiKeyResponse.body.key });
    expect(searchResponse.status).toBe(200);

    expect(searchResponse.body.shelf_ids).toEqual([createShelfResponse.text]);

    searchResponse = await searchShelves(username, 'COM', undefined, undefined, { apiKey: createApiKeyResponse.body.key });
    expect(searchResponse.status).toBe(200);

    expect(searchResponse.body.shelf_ids).toEqual([createShelfResponse2.text]);
  });

  test('Pagination', async () => {
    const { response: registerResponse, username } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const createShelfResponse = await createShelf('Favorite Fantasy', userId, { jwt: registerResponse.body.jwt_token });
    expect(createShelfResponse.status).toBe(200);

    const createShelfResponse2 = await createShelf('Comic Books', userId, { jwt: registerResponse.body.jwt_token });
    expect(createShelfResponse2.status).toBe(200);

    const createApiKeyResponse = await createApiKey(userId, 'Test Key', ['Read'], undefined, { jwt: registerResponse.body.jwt_token });
    expect(createApiKeyResponse.status).toBe(200);

    let searchResponse = await searchShelves(username, undefined, undefined, undefined, { apiKey: createApiKeyResponse.body.key });
    expect(searchResponse.status).toBe(200);

    expect(searchResponse.body.shelf_ids).toContain(createShelfResponse.text);
    expect(searchResponse.body.shelf_ids).toContain(createShelfResponse2.text);

    let expectedResponse = {
      shelf_ids: [createShelfResponse.text < createShelfResponse2.text ? createShelfResponse.text : createShelfResponse2.text],
      page_size: 1,
      total_elements: 2,
      total_pages: 2,
      current_page: 1
    };

    searchResponse = await searchShelves(username, undefined, 1, 1, { apiKey: createApiKeyResponse.body.key });
    expect(searchResponse.status).toBe(200);

    expect(searchResponse.body).toEqual(expectedResponse);

    expectedResponse = {
      shelf_ids: [createShelfResponse.text < createShelfResponse2.text ? createShelfResponse2.text : createShelfResponse.text],
      page_size: 1,
      total_elements: 2,
      total_pages: 2,
      current_page: 2
    };

    const searchResponse3 = await searchShelves(username, undefined, 2, 1, { apiKey: createApiKeyResponse.body.key });
    expect(searchResponse3.status).toBe(200);

    expect(searchResponse3.body).toEqual(expectedResponse);
  });

  test('Different users', async () => {
    const { response: registerResponse, username } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const { response: registerResponse2, username: username2 } = await registerUser();
    expect(registerResponse2.status).toBe(200);
    const userId2 = registerResponse2.body.user_id;

    const createApiKeyResponse = await createApiKey(userId, 'Test Key', ['Read'], undefined, { jwt: registerResponse.body.jwt_token });
    expect(createApiKeyResponse.status).toBe(200);

    const createApiKeyResponse2 = await createApiKey(userId2, 'Test Key', ['Read'], undefined, { jwt: registerResponse2.body.jwt_token });
    expect(createApiKeyResponse2.status).toBe(200);

    const createShelfResponse = await createShelf('Favorite Fantasy', userId, { jwt: registerResponse.body.jwt_token });
    expect(createShelfResponse.status).toBe(200);

    const createShelfResponse2 = await createShelf('Favorite Fantasy', userId2, { jwt: registerResponse2.body.jwt_token });
    expect(createShelfResponse2.status).toBe(200);

    let searchResponse = await searchShelves(username, undefined, undefined, undefined, { apiKey: createApiKeyResponse.body.key });
    expect(searchResponse.status).toBe(200);
    expect(searchResponse.body.shelf_ids).toEqual([createShelfResponse.text]);

    searchResponse = await searchShelves(username2, undefined, undefined, undefined, { apiKey: createApiKeyResponse2.body.key });
    expect(searchResponse.status).toBe(200);
    expect(searchResponse.body.shelf_ids).toEqual([createShelfResponse2.text]);
  });

  test('Invalid pagination', async () => {
    const { response: registerResponse, username } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const createShelfResponse = await createShelf('Favorite Fantasy', userId, { jwt: registerResponse.body.jwt_token });
    expect(createShelfResponse.status).toBe(200);

    const createApiKeyResponse = await createApiKey(userId, 'Test Key', ['Read'], undefined, { jwt: registerResponse.body.jwt_token });
    expect(createApiKeyResponse.status).toBe(200);

    let searchResponse = await searchShelves(username, undefined, -1, undefined, { apiKey: createApiKeyResponse.body.key });
    expect(searchResponse.status).toBe(400);
    expect(searchResponse.text).toBe(INVALID_PAGINATION);

    searchResponse = await searchShelves(username, undefined, undefined, -1, { apiKey: createApiKeyResponse.body.key });
    expect(searchResponse.status).toBe(400);
    expect(searchResponse.text).toBe(INVALID_PAGINATION);

    searchResponse = await searchShelves(username, undefined, 'invalid', undefined, { apiKey: createApiKeyResponse.body.key });
    expect(searchResponse.status).toBe(400);
    expect(searchResponse.text).toBe(INVALID_PAGINATION);

    searchResponse = await searchShelves(username, undefined, undefined, 'invalid', { apiKey: createApiKeyResponse.body.key });
    expect(searchResponse.status).toBe(400);
    expect(searchResponse.text).toBe(INVALID_PAGINATION);
  });

  test('Non-existent user', async () => {
    const { response: registerResponse } = await registerUser(undefined, undefined, process.env.ADMIN_KEY);
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const createApiKeyResponse = await createApiKey(userId, 'Test Key', ['Read'], undefined, { jwt: registerResponse.body.jwt_token });
    expect(createApiKeyResponse.status).toBe(200);

    let searchResponse = await searchShelves('non-existent', undefined, undefined, undefined, { apiKey: createApiKeyResponse.body.key });
    expect(searchResponse.status).toBe(404);
    expect(searchResponse.text).toBe(USER_NOT_FOUND);
  });

  test('Different user without permission', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const { response: registerResponse2, username: username2 } = await registerUser();
    expect(registerResponse2.status).toBe(200);

    const createApiKeyResponse = await createApiKey(userId, 'Test Key', ['Read'], undefined, { jwt: registerResponse.body.jwt_token });
    expect(createApiKeyResponse.status).toBe(200);

    let searchResponse = await searchShelves(username2, undefined, undefined, undefined, { apiKey: createApiKeyResponse.body.key });
    expect(searchResponse.status).toBe(403);
    expect(searchResponse.text).toBe(FORBIDDEN);
  });

  test('Different user with permission', async () => {
    const { response: registerResponse } = await registerUser(undefined, undefined, process.env.ADMIN_KEY);
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const { response: registerResponse2, username: username2 } = await registerUser();
    expect(registerResponse2.status).toBe(200);

    const createApiKeyResponse = await createApiKey(userId, 'Test Key', ['Read'], undefined, { jwt: registerResponse.body.jwt_token });
    expect(createApiKeyResponse.status).toBe(200);

    let searchResponse = await searchShelves(username2, undefined, undefined, undefined, { apiKey: createApiKeyResponse.body.key });
    expect(searchResponse.status).toBe(200);
    expect(searchResponse.body.shelf_ids).toEqual([]);
  });

  test('All shelves without permission', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const createApiKeyResponse = await createApiKey(userId, 'Test Key', ['Read'], undefined, { jwt: registerResponse.body.jwt_token });
    expect(createApiKeyResponse.status).toBe(200);

    let searchResponse = await searchShelves(undefined, undefined, undefined, undefined, { apiKey: createApiKeyResponse.body.key });
    expect(searchResponse.status).toBe(403);
    expect(searchResponse.text).toBe(FORBIDDEN);
  });

  test('All books with permission', async () => {
    const { response: registerResponse } = await registerUser(undefined, undefined, process.env.ADMIN_KEY);
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const { response: registerResponse2 } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId2 = registerResponse2.body.user_id;

    const createShelfResponse = await createShelf('Favorite Fantasy', userId, { jwt: registerResponse.body.jwt_token });
    expect(createShelfResponse.status).toBe(200);

    const createShelfResponse2 = await createShelf('Comic Books', userId2, { jwt: registerResponse2.body.jwt_token });
    expect(createShelfResponse2.status).toBe(200);

    const createApiKeyResponse = await createApiKey(userId, 'Test Key', ['Read'], undefined, { jwt: registerResponse.body.jwt_token });
    expect(createApiKeyResponse.status).toBe(200);

    let searchResponse = await searchShelves(undefined, undefined, undefined, 1000, { apiKey: createApiKeyResponse.body.key });
    expect(searchResponse.status).toBe(200);

    expect(searchResponse.body.shelf_ids).toContain(createShelfResponse.text);
    expect(searchResponse.body.shelf_ids).toContain(createShelfResponse2.text);
  });

  test('Wrong capabilities', async () => {
    const { response: registerResponse, username } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const createApiKeyResponse = await createApiKey(userId, 'Test Key', ['Create', 'Update', 'Delete'], undefined, { jwt: registerResponse.body.jwt_token });
    expect(createApiKeyResponse.status).toBe(200);

    const searchResponse = await searchShelves(username, undefined, undefined, undefined, { apiKey: createApiKeyResponse.body.key });
    expect(searchResponse.status).toBe(403);
    expect(searchResponse.text).toEqual(FORBIDDEN);
  });

  test('Expired key', async () => {
    const { response: registerResponse, username } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const timestamp = Date.now() + 1000;
    const createApiKeyResponse = await createApiKey(userId, 'Test Key', ['Read'], timestamp, { jwt: registerResponse.body.jwt_token });
    expect(createApiKeyResponse.status).toBe(200);

    // Wait for the key to expire
    await wait(1.5);

    const searchResponse = await searchShelves(username, undefined, undefined, undefined, { apiKey: createApiKeyResponse.body.key });
    expect(searchResponse.status).toBe(401);
    expect(searchResponse.text).toEqual(INVALID_API_KEY);
  });
});

describe('Add book to shelf JWT', () => {
  test('Simple', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const uploadBookResponse = await uploadBook(userId, 'The_Great_Gatsby.epub', { jwt: registerResponse.body.jwt_token });
    expect(uploadBookResponse.status).toBe(200);

    const createShelfResponse = await createShelf('shelf!', userId, { jwt: registerResponse.body.jwt_token });
    expect(createShelfResponse.status).toBe(200);

    let getShelfMetadataResponse = await getShelfMetadata(createShelfResponse.text, { jwt: registerResponse.body.jwt_token });
    expect(getShelfMetadataResponse.status).toBe(200);
    expect(getShelfMetadataResponse.body.book_count).toBe(0);

    let listShelfBooksResponse = await listBooksFromShelf(createShelfResponse.text, { jwt: registerResponse.body.jwt_token });
    expect(listShelfBooksResponse.status).toBe(200);
    expect(listShelfBooksResponse.body).toEqual([]);

    const addBookToShelfResponse = await addBookToShelf(createShelfResponse.text, uploadBookResponse.text, { jwt: registerResponse.body.jwt_token });
    expect(addBookToShelfResponse.status).toBe(204);

    getShelfMetadataResponse = await getShelfMetadata(createShelfResponse.text, { jwt: registerResponse.body.jwt_token });
    expect(getShelfMetadataResponse.status).toBe(200);
    expect(getShelfMetadataResponse.body.book_count).toBe(1);

    listShelfBooksResponse = await listBooksFromShelf(createShelfResponse.text, { jwt: registerResponse.body.jwt_token });
    expect(listShelfBooksResponse.status).toBe(200);
    expect(listShelfBooksResponse.body).toEqual([uploadBookResponse.text]);
  });

  test('Shelf not found', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const uploadBookResponse = await uploadBook(userId, 'The_Great_Gatsby.epub', { jwt: registerResponse.body.jwt_token });
    expect(uploadBookResponse.status).toBe(200);

    const addBookToShelfResponse = await addBookToShelf('non-existent', uploadBookResponse.text, { jwt: registerResponse.body.jwt_token });
    expect(addBookToShelfResponse.status).toBe(404);
    expect(addBookToShelfResponse.text).toBe(SHELF_NOT_FOUND);
  });

  test('Book not found', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const createShelfResponse = await createShelf('shelf!', userId, { jwt: registerResponse.body.jwt_token });
    expect(createShelfResponse.status).toBe(200);

    const addBookToShelfResponse = await addBookToShelf(createShelfResponse.text, 'non-existent', { jwt: registerResponse.body.jwt_token });
    expect(addBookToShelfResponse.status).toBe(404);
    expect(addBookToShelfResponse.text).toBe(BOOK_NOT_FOUND);
  });

  test('Book conflict', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const uploadBookResponse = await uploadBook(userId, 'The_Great_Gatsby.epub', { jwt: registerResponse.body.jwt_token });
    expect(uploadBookResponse.status).toBe(200);

    const createShelfResponse = await createShelf('shelf!', userId, { jwt: registerResponse.body.jwt_token });
    expect(createShelfResponse.status).toBe(200);

    let addBookToShelfResponse = await addBookToShelf(createShelfResponse.text, uploadBookResponse.text, { jwt: registerResponse.body.jwt_token });
    expect(addBookToShelfResponse.status).toBe(204);

    addBookToShelfResponse = await addBookToShelf(createShelfResponse.text, uploadBookResponse.text, { jwt: registerResponse.body.jwt_token });
    expect(addBookToShelfResponse.status).toBe(409);
    expect(addBookToShelfResponse.text).toBe(SHELF_BOOK_CONFLICT);
  });

  test('Different user without permission', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const { response: registerResponse2 } = await registerUser();
    expect(registerResponse2.status).toBe(200);
    const userId2 = registerResponse2.body.user_id;

    const uploadBookResponse1 = await uploadBook(userId, 'The_Great_Gatsby.epub', { jwt: registerResponse.body.jwt_token });
    expect(uploadBookResponse1.status).toBe(200);

    const uploadBookResponse2 = await uploadBook(userId2, 'The_Great_Gatsby.epub', { jwt: registerResponse2.body.jwt_token });
    expect(uploadBookResponse2.status).toBe(200);

    const createShelfResponse1 = await createShelf('shelf!', userId, { jwt: registerResponse.body.jwt_token });
    expect(createShelfResponse1.status).toBe(200);

    const createShelfResponse2 = await createShelf('shelf!', userId2, { jwt: registerResponse2.body.jwt_token });
    expect(createShelfResponse2.status).toBe(200);

    let addBookToShelfResponse = await addBookToShelf(createShelfResponse2.text, uploadBookResponse2.text, { jwt: registerResponse.body.jwt_token });
    expect(addBookToShelfResponse.status).toBe(404);
    expect(addBookToShelfResponse.text).toBe(SHELF_NOT_FOUND);

    addBookToShelfResponse = await addBookToShelf(createShelfResponse2.text, uploadBookResponse1.text, { jwt: registerResponse.body.jwt_token });
    expect(addBookToShelfResponse.status).toBe(404);
    expect(addBookToShelfResponse.text).toBe(SHELF_NOT_FOUND);

    addBookToShelfResponse = await addBookToShelf(createShelfResponse1.text, uploadBookResponse2.text, { jwt: registerResponse.body.jwt_token });
    expect(addBookToShelfResponse.status).toBe(404);
    expect(addBookToShelfResponse.text).toBe(BOOK_NOT_FOUND);
  });

  test('Different user with permission', async () => {
    const { response: registerResponse } = await registerUser(undefined, undefined, process.env.ADMIN_KEY);
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const { response: registerResponse2 } = await registerUser();
    expect(registerResponse2.status).toBe(200);
    const userId2 = registerResponse2.body.user_id;

    const uploadBookResponse1 = await uploadBook(userId, 'The_Great_Gatsby.epub', { jwt: registerResponse.body.jwt_token });
    expect(uploadBookResponse1.status).toBe(200);

    const uploadBookResponse2 = await uploadBook(userId2, 'The_Great_Gatsby.epub', { jwt: registerResponse2.body.jwt_token });
    expect(uploadBookResponse2.status).toBe(200);

    const createShelfResponse1 = await createShelf('shelf!', userId, { jwt: registerResponse.body.jwt_token });
    expect(createShelfResponse1.status).toBe(200);

    const createShelfResponse2 = await createShelf('shelf!', userId2, { jwt: registerResponse2.body.jwt_token });
    expect(createShelfResponse2.status).toBe(200);

    let addBookToShelfResponse = await addBookToShelf(createShelfResponse2.text, uploadBookResponse2.text, { jwt: registerResponse.body.jwt_token });
    expect(addBookToShelfResponse.status).toBe(204);

    // Books can only be added to a shelf if they are owned by the same user who owns the shelf
    addBookToShelfResponse = await addBookToShelf(createShelfResponse2.text, uploadBookResponse1.text, { jwt: registerResponse.body.jwt_token });
    expect(addBookToShelfResponse.status).toBe(403);
    expect(addBookToShelfResponse.text).toBe(FORBIDDEN);

    addBookToShelfResponse = await addBookToShelf(createShelfResponse1.text, uploadBookResponse2.text, { jwt: registerResponse.body.jwt_token });
    expect(addBookToShelfResponse.status).toBe(403);
    expect(addBookToShelfResponse.text).toBe(FORBIDDEN);
  });

  test('No auth', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const uploadBookResponse = await uploadBook(userId, 'The_Great_Gatsby.epub', { jwt: registerResponse.body.jwt_token });
    expect(uploadBookResponse.status).toBe(200);

    const createShelfResponse = await createShelf('shelf!', userId, { jwt: registerResponse.body.jwt_token });
    expect(createShelfResponse.status).toBe(200);

    let addBookToShelfResponse = await addBookToShelf(createShelfResponse.text, uploadBookResponse.text);
    expect(addBookToShelfResponse.status).toBe(401);
    expect(addBookToShelfResponse.text).toBe(UNAUTHORIZED);
  });
});

describe('Add book to shelf API key', () => {
  test('Simple', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const uploadBookResponse = await uploadBook(userId, 'The_Great_Gatsby.epub', { jwt: registerResponse.body.jwt_token });
    expect(uploadBookResponse.status).toBe(200);

    const createShelfResponse = await createShelf('shelf!', userId, { jwt: registerResponse.body.jwt_token });
    expect(createShelfResponse.status).toBe(200);

    let getShelfMetadataResponse = await getShelfMetadata(createShelfResponse.text, { jwt: registerResponse.body.jwt_token });
    expect(getShelfMetadataResponse.status).toBe(200);
    expect(getShelfMetadataResponse.body.book_count).toBe(0);

    let listShelfBooksResponse = await listBooksFromShelf(createShelfResponse.text, { jwt: registerResponse.body.jwt_token });
    expect(listShelfBooksResponse.status).toBe(200);
    expect(listShelfBooksResponse.body).toEqual([]);

    const createApiKeyResponse = await createApiKey(userId, 'Test Key', ['Update'], undefined, { jwt: registerResponse.body.jwt_token });
    expect(createApiKeyResponse.status).toBe(200);

    const addBookToShelfResponse = await addBookToShelf(createShelfResponse.text, uploadBookResponse.text, { apiKey: createApiKeyResponse.body.key });
    expect(addBookToShelfResponse.status).toBe(204);

    getShelfMetadataResponse = await getShelfMetadata(createShelfResponse.text, { jwt: registerResponse.body.jwt_token });
    expect(getShelfMetadataResponse.status).toBe(200);
    expect(getShelfMetadataResponse.body.book_count).toBe(1);

    listShelfBooksResponse = await listBooksFromShelf(createShelfResponse.text, { jwt: registerResponse.body.jwt_token });
    expect(listShelfBooksResponse.status).toBe(200);
    expect(listShelfBooksResponse.body).toEqual([uploadBookResponse.text]);
  });

  test('Shelf not found', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const uploadBookResponse = await uploadBook(userId, 'The_Great_Gatsby.epub', { jwt: registerResponse.body.jwt_token });
    expect(uploadBookResponse.status).toBe(200);

    const createApiKeyResponse = await createApiKey(userId, 'Test Key', ['Update'], undefined, { jwt: registerResponse.body.jwt_token });
    expect(createApiKeyResponse.status).toBe(200);

    const addBookToShelfResponse = await addBookToShelf('non-existent', uploadBookResponse.text, { apiKey: createApiKeyResponse.body.key });
    expect(addBookToShelfResponse.status).toBe(404);
    expect(addBookToShelfResponse.text).toBe(SHELF_NOT_FOUND);
  });

  test('Book not found', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const createShelfResponse = await createShelf('shelf!', userId, { jwt: registerResponse.body.jwt_token });
    expect(createShelfResponse.status).toBe(200);

    const createApiKeyResponse = await createApiKey(userId, 'Test Key', ['Update'], undefined, { jwt: registerResponse.body.jwt_token });
    expect(createApiKeyResponse.status).toBe(200);

    const addBookToShelfResponse = await addBookToShelf(createShelfResponse.text, 'non-existent', { apiKey: createApiKeyResponse.body.key });
    expect(addBookToShelfResponse.status).toBe(404);
    expect(addBookToShelfResponse.text).toBe(BOOK_NOT_FOUND);
  });

  test('Book conflict', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const uploadBookResponse = await uploadBook(userId, 'The_Great_Gatsby.epub', { jwt: registerResponse.body.jwt_token });
    expect(uploadBookResponse.status).toBe(200);

    const createShelfResponse = await createShelf('shelf!', userId, { jwt: registerResponse.body.jwt_token });
    expect(createShelfResponse.status).toBe(200);

    const createApiKeyResponse = await createApiKey(userId, 'Test Key', ['Update'], undefined, { jwt: registerResponse.body.jwt_token });
    expect(createApiKeyResponse.status).toBe(200);

    let addBookToShelfResponse = await addBookToShelf(createShelfResponse.text, uploadBookResponse.text, { apiKey: createApiKeyResponse.body.key });
    expect(addBookToShelfResponse.status).toBe(204);

    addBookToShelfResponse = await addBookToShelf(createShelfResponse.text, uploadBookResponse.text, { apiKey: createApiKeyResponse.body.key });
    expect(addBookToShelfResponse.status).toBe(409);
    expect(addBookToShelfResponse.text).toBe(SHELF_BOOK_CONFLICT);
  });

  test('Different user without permission', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const { response: registerResponse2 } = await registerUser();
    expect(registerResponse2.status).toBe(200);
    const userId2 = registerResponse2.body.user_id;

    const uploadBookResponse1 = await uploadBook(userId, 'The_Great_Gatsby.epub', { jwt: registerResponse.body.jwt_token });
    expect(uploadBookResponse1.status).toBe(200);

    const uploadBookResponse2 = await uploadBook(userId2, 'The_Great_Gatsby.epub', { jwt: registerResponse2.body.jwt_token });
    expect(uploadBookResponse2.status).toBe(200);

    const createShelfResponse1 = await createShelf('shelf!', userId, { jwt: registerResponse.body.jwt_token });
    expect(createShelfResponse1.status).toBe(200);

    const createShelfResponse2 = await createShelf('shelf!', userId2, { jwt: registerResponse2.body.jwt_token });
    expect(createShelfResponse2.status).toBe(200);

    const createApiKeyResponse = await createApiKey(userId, 'Test Key', ['Update'], undefined, { jwt: registerResponse.body.jwt_token });
    expect(createApiKeyResponse.status).toBe(200);

    let addBookToShelfResponse = await addBookToShelf(createShelfResponse2.text, uploadBookResponse2.text, { apiKey: createApiKeyResponse.body.key });
    expect(addBookToShelfResponse.status).toBe(404);
    expect(addBookToShelfResponse.text).toBe(SHELF_NOT_FOUND);

    addBookToShelfResponse = await addBookToShelf(createShelfResponse2.text, uploadBookResponse1.text, { apiKey: createApiKeyResponse.body.key });
    expect(addBookToShelfResponse.status).toBe(404);
    expect(addBookToShelfResponse.text).toBe(SHELF_NOT_FOUND);

    addBookToShelfResponse = await addBookToShelf(createShelfResponse1.text, uploadBookResponse2.text, { apiKey: createApiKeyResponse.body.key });
    expect(addBookToShelfResponse.status).toBe(404);
    expect(addBookToShelfResponse.text).toBe(BOOK_NOT_FOUND);
  });

  test('Different user with permission', async () => {
    const { response: registerResponse } = await registerUser(undefined, undefined, process.env.ADMIN_KEY);
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const { response: registerResponse2 } = await registerUser();
    expect(registerResponse2.status).toBe(200);
    const userId2 = registerResponse2.body.user_id;

    const uploadBookResponse1 = await uploadBook(userId, 'The_Great_Gatsby.epub', { jwt: registerResponse.body.jwt_token });
    expect(uploadBookResponse1.status).toBe(200);

    const uploadBookResponse2 = await uploadBook(userId2, 'The_Great_Gatsby.epub', { jwt: registerResponse2.body.jwt_token });
    expect(uploadBookResponse2.status).toBe(200);

    const createShelfResponse1 = await createShelf('shelf!', userId, { jwt: registerResponse.body.jwt_token });
    expect(createShelfResponse1.status).toBe(200);

    const createShelfResponse2 = await createShelf('shelf!', userId2, { jwt: registerResponse2.body.jwt_token });
    expect(createShelfResponse2.status).toBe(200);

    const createApiKeyResponse = await createApiKey(userId, 'Test Key', ['Update'], undefined, { jwt: registerResponse.body.jwt_token });
    expect(createApiKeyResponse.status).toBe(200);

    let addBookToShelfResponse = await addBookToShelf(createShelfResponse2.text, uploadBookResponse2.text, { apiKey: createApiKeyResponse.body.key });
    expect(addBookToShelfResponse.status).toBe(204);

    // Books can only be added to a shelf if they are owned by the same user who owns the shelf
    addBookToShelfResponse = await addBookToShelf(createShelfResponse2.text, uploadBookResponse1.text, { apiKey: createApiKeyResponse.body.key });
    expect(addBookToShelfResponse.status).toBe(403);
    expect(addBookToShelfResponse.text).toBe(FORBIDDEN);

    addBookToShelfResponse = await addBookToShelf(createShelfResponse1.text, uploadBookResponse2.text, { apiKey: createApiKeyResponse.body.key });
    expect(addBookToShelfResponse.status).toBe(403);
    expect(addBookToShelfResponse.text).toBe(FORBIDDEN);
  });

  test('Wrong capabilities', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const uploadBookResponse = await uploadBook(userId, 'The_Great_Gatsby.epub', { jwt: registerResponse.body.jwt_token });
    expect(uploadBookResponse.status).toBe(200);

    const createShelfResponse = await createShelf('shelf!', userId, { jwt: registerResponse.body.jwt_token });
    expect(createShelfResponse.status).toBe(200);

    const createApiKeyResponse = await createApiKey(userId, 'Test Key', ['Create', 'Delete', 'Read'], undefined, { jwt: registerResponse.body.jwt_token });
    expect(createApiKeyResponse.status).toBe(200);

    const addBookToShelfResponse = await addBookToShelf(createShelfResponse.text, uploadBookResponse.text, { apiKey: createApiKeyResponse.body.key });
    expect(addBookToShelfResponse.status).toBe(403);
    expect(addBookToShelfResponse.text).toBe(FORBIDDEN);
  });

  test('Expired key', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const uploadBookResponse = await uploadBook(userId, 'The_Great_Gatsby.epub', { jwt: registerResponse.body.jwt_token });
    expect(uploadBookResponse.status).toBe(200);

    const shelfName = randomString(20);

    const createShelfResponse = await createShelf(shelfName, userId, { jwt: registerResponse.body.jwt_token });
    expect(createShelfResponse.status).toBe(200);

    const timestamp = Date.now() + 1000;
    const createApiKeyResponse = await createApiKey(userId, 'Test Key', ['Update'], timestamp, { jwt: registerResponse.body.jwt_token });
    expect(createApiKeyResponse.status).toBe(200);

    // Wait for the key to expire
    await wait(1.5);

    const addBookToShelfResponse = await addBookToShelf(createShelfResponse.text, uploadBookResponse.text, { apiKey: createApiKeyResponse.body.key });
    expect(addBookToShelfResponse.status).toBe(401);
    expect(addBookToShelfResponse.text).toBe(INVALID_API_KEY);
  });
});

describe('List shelf books JWT', () => {
  test('Simple', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const uploadBookResponse = await uploadBook(userId, 'The_Great_Gatsby.epub', { jwt: registerResponse.body.jwt_token });
    expect(uploadBookResponse.status).toBe(200);

    const uploadBookResponse2 = await uploadBook(userId, 'Alices_Adventures_in_Wonderland.epub', { jwt: registerResponse.body.jwt_token });
    expect(uploadBookResponse2.status).toBe(200);

    const createShelfResponse = await createShelf('shelf!', userId, { jwt: registerResponse.body.jwt_token });
    expect(createShelfResponse.status).toBe(200);

    let listShelfBooksResponse = await listBooksFromShelf(createShelfResponse.text, { jwt: registerResponse.body.jwt_token });
    expect(listShelfBooksResponse.status).toBe(200);
    expect(listShelfBooksResponse.body).toEqual([]);

    let addBookToShelfResponse = await addBookToShelf(createShelfResponse.text, uploadBookResponse.text, { jwt: registerResponse.body.jwt_token });
    expect(addBookToShelfResponse.status).toBe(204);

    listShelfBooksResponse = await listBooksFromShelf(createShelfResponse.text, { jwt: registerResponse.body.jwt_token });
    expect(listShelfBooksResponse.status).toBe(200);
    expect(listShelfBooksResponse.body).toContain(uploadBookResponse.text);

    addBookToShelfResponse = await addBookToShelf(createShelfResponse.text, uploadBookResponse2.text, { jwt: registerResponse.body.jwt_token });
    expect(addBookToShelfResponse.status).toBe(204);

    listShelfBooksResponse = await listBooksFromShelf(createShelfResponse.text, { jwt: registerResponse.body.jwt_token });
    expect(listShelfBooksResponse.status).toBe(200);
    expect(listShelfBooksResponse.body).toContain(uploadBookResponse.text);
    expect(listShelfBooksResponse.body).toContain(uploadBookResponse2.text);
  });

  test('Shelf not found', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);

    let listShelfBooksResponse = await listBooksFromShelf('non-existent', { jwt: registerResponse.body.jwt_token });
    expect(listShelfBooksResponse.status).toBe(404);
    expect(listShelfBooksResponse.text).toEqual(SHELF_NOT_FOUND);
  });

  test('Different user without permission', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const { response: registerResponse2 } = await registerUser();
    expect(registerResponse2.status).toBe(200);

    const createShelfResponse = await createShelf('shelf!', userId, { jwt: registerResponse.body.jwt_token });
    expect(createShelfResponse.status).toBe(200);

    let listShelfBooksResponse = await listBooksFromShelf(createShelfResponse.text, { jwt: registerResponse2.body.jwt_token });
    expect(listShelfBooksResponse.status).toBe(404);
    expect(listShelfBooksResponse.text).toEqual(SHELF_NOT_FOUND);
  });

  test('Different user with permission', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const { response: registerResponse2 } = await registerUser(undefined, undefined, process.env.ADMIN_KEY);
    expect(registerResponse2.status).toBe(200);

    const createShelfResponse = await createShelf('shelf!', userId, { jwt: registerResponse.body.jwt_token });
    expect(createShelfResponse.status).toBe(200);

    let listShelfBooksResponse = await listBooksFromShelf(createShelfResponse.text, { jwt: registerResponse2.body.jwt_token });
    expect(listShelfBooksResponse.status).toBe(200);
    expect(listShelfBooksResponse.body).toEqual([]);
  });

  test('No auth', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const createShelfResponse = await createShelf('shelf!', userId, { jwt: registerResponse.body.jwt_token });
    expect(createShelfResponse.status).toBe(200);

    let listShelfBooksResponse = await listBooksFromShelf(createShelfResponse.text);
    expect(listShelfBooksResponse.status).toBe(401);
    expect(listShelfBooksResponse.text).toEqual(UNAUTHORIZED);
  });
});

describe('List shelf books API key', () => {
  test('Simple', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const uploadBookResponse = await uploadBook(userId, 'The_Great_Gatsby.epub', { jwt: registerResponse.body.jwt_token });
    expect(uploadBookResponse.status).toBe(200);

    const uploadBookResponse2 = await uploadBook(userId, 'Alices_Adventures_in_Wonderland.epub', { jwt: registerResponse.body.jwt_token });
    expect(uploadBookResponse2.status).toBe(200);

    const createShelfResponse = await createShelf('shelf!', userId, { jwt: registerResponse.body.jwt_token });
    expect(createShelfResponse.status).toBe(200);

    const createApiKeyResponse = await createApiKey(userId, 'Test Key', ['Read'], undefined, { jwt: registerResponse.body.jwt_token });
    expect(createApiKeyResponse.status).toBe(200);

    let listShelfBooksResponse = await listBooksFromShelf(createShelfResponse.text, { apiKey: createApiKeyResponse.body.key });
    expect(listShelfBooksResponse.status).toBe(200);
    expect(listShelfBooksResponse.body).toEqual([]);

    let addBookToShelfResponse = await addBookToShelf(createShelfResponse.text, uploadBookResponse.text, { jwt: registerResponse.body.jwt_token });
    expect(addBookToShelfResponse.status).toBe(204);

    listShelfBooksResponse = await listBooksFromShelf(createShelfResponse.text, { apiKey: createApiKeyResponse.body.key });
    expect(listShelfBooksResponse.status).toBe(200);
    expect(listShelfBooksResponse.body).toContain(uploadBookResponse.text);

    addBookToShelfResponse = await addBookToShelf(createShelfResponse.text, uploadBookResponse2.text, { jwt: registerResponse.body.jwt_token });
    expect(addBookToShelfResponse.status).toBe(204);

    listShelfBooksResponse = await listBooksFromShelf(createShelfResponse.text, { apiKey: createApiKeyResponse.body.key });
    expect(listShelfBooksResponse.status).toBe(200);
    expect(listShelfBooksResponse.body).toContain(uploadBookResponse.text);
    expect(listShelfBooksResponse.body).toContain(uploadBookResponse2.text);
  });

  test('Shelf not found', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const createApiKeyResponse = await createApiKey(userId, 'Test Key', ['Read'], undefined, { jwt: registerResponse.body.jwt_token });
    expect(createApiKeyResponse.status).toBe(200);

    let listShelfBooksResponse = await listBooksFromShelf('non-existent', { apiKey: createApiKeyResponse.body.key });
    expect(listShelfBooksResponse.status).toBe(404);
    expect(listShelfBooksResponse.text).toEqual(SHELF_NOT_FOUND);
  });

  test('Different user without permission', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const { response: registerResponse2 } = await registerUser();
    expect(registerResponse2.status).toBe(200);
    const userId2 = registerResponse2.body.user_id;

    const createShelfResponse = await createShelf('shelf!', userId, { jwt: registerResponse.body.jwt_token });
    expect(createShelfResponse.status).toBe(200);

    const createApiKeyResponse = await createApiKey(userId2, 'Test Key', ['Read'], undefined, { jwt: registerResponse2.body.jwt_token });
    expect(createApiKeyResponse.status).toBe(200);

    let listShelfBooksResponse = await listBooksFromShelf(createShelfResponse.text, { apiKey: createApiKeyResponse.body.key });
    expect(listShelfBooksResponse.status).toBe(404);
    expect(listShelfBooksResponse.text).toEqual(SHELF_NOT_FOUND);
  });

  test('Different user with permission', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const { response: registerResponse2 } = await registerUser(undefined, undefined, process.env.ADMIN_KEY);
    expect(registerResponse2.status).toBe(200);
    const userId2 = registerResponse2.body.user_id;

    const createShelfResponse = await createShelf('shelf!', userId, { jwt: registerResponse.body.jwt_token });
    expect(createShelfResponse.status).toBe(200);

    const createApiKeyResponse = await createApiKey(userId2, 'Test Key', ['Read'], undefined, { jwt: registerResponse2.body.jwt_token });
    expect(createApiKeyResponse.status).toBe(200);

    let listShelfBooksResponse = await listBooksFromShelf(createShelfResponse.text, { apiKey: createApiKeyResponse.body.key });
    expect(listShelfBooksResponse.status).toBe(200);
    expect(listShelfBooksResponse.body).toEqual([]);
  });

  test('Wrong capabilities', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const createApiKeyResponse = await createApiKey(userId, 'Test Key', ['Create', 'Update', 'Delete'], undefined, { jwt: registerResponse.body.jwt_token });
    expect(createApiKeyResponse.status).toBe(200);

    const shelfName = randomString(20);

    const createShelfResponse = await createShelf(shelfName, userId, { jwt: registerResponse.body.jwt_token });
    expect(createShelfResponse.status).toBe(200);

    let listShelfBooksResponse = await listBooksFromShelf(createShelfResponse.text, { apiKey: createApiKeyResponse.body.key });
    expect(listShelfBooksResponse.status).toBe(403);
    expect(listShelfBooksResponse.text).toEqual(FORBIDDEN);
  });

  test('Expired key', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const shelfName = randomString(20);

    const createShelfResponse = await createShelf(shelfName, userId, { jwt: registerResponse.body.jwt_token });
    expect(createShelfResponse.status).toBe(200);

    const timestamp = Date.now() + 1000;
    const createApiKeyResponse = await createApiKey(userId, 'Test Key', ['Create'], timestamp, { jwt: registerResponse.body.jwt_token });
    expect(createApiKeyResponse.status).toBe(200);

    // Wait for the key to expire
    await wait(1.5);

    let listShelfBooksResponse = await listBooksFromShelf(createShelfResponse.text, { apiKey: createApiKeyResponse.body.key });
    expect(listShelfBooksResponse.status).toBe(401);
    expect(listShelfBooksResponse.text).toEqual(INVALID_API_KEY);
  });
});

describe('Delete book from shelf JWT', () => {
  test('Simple', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const uploadBookResponse = await uploadBook(userId, 'The_Great_Gatsby.epub', { jwt: registerResponse.body.jwt_token });
    expect(uploadBookResponse.status).toBe(200);

    const createShelfResponse = await createShelf('shelf!', userId, { jwt: registerResponse.body.jwt_token });
    expect(createShelfResponse.status).toBe(200);

    const addBookToShelfResponse = await addBookToShelf(createShelfResponse.text, uploadBookResponse.text, { jwt: registerResponse.body.jwt_token });
    expect(addBookToShelfResponse.status).toBe(204);

    let getShelfMetadataResponse = await getShelfMetadata(createShelfResponse.text, { jwt: registerResponse.body.jwt_token });
    expect(getShelfMetadataResponse.status).toBe(200);
    expect(getShelfMetadataResponse.body.book_count).toBe(1);

    let listShelfBooksResponse = await listBooksFromShelf(createShelfResponse.text, { jwt: registerResponse.body.jwt_token });
    expect(listShelfBooksResponse.status).toBe(200);
    expect(listShelfBooksResponse.body).toEqual([uploadBookResponse.text]);

    const deleteBookFromShelfResponse = await deleteBookFromShelf(createShelfResponse.text, uploadBookResponse.text, { jwt: registerResponse.body.jwt_token });
    expect(deleteBookFromShelfResponse.status).toBe(204);

    getShelfMetadataResponse = await getShelfMetadata(createShelfResponse.text, { jwt: registerResponse.body.jwt_token });
    expect(getShelfMetadataResponse.status).toBe(200);
    expect(getShelfMetadataResponse.body.book_count).toBe(0);

    listShelfBooksResponse = await listBooksFromShelf(createShelfResponse.text, { jwt: registerResponse.body.jwt_token });
    expect(listShelfBooksResponse.status).toBe(200);
    expect(listShelfBooksResponse.body).toEqual([]);
  });

  test('Shelf not found', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const uploadBookResponse = await uploadBook(userId, 'The_Great_Gatsby.epub', { jwt: registerResponse.body.jwt_token });
    expect(uploadBookResponse.status).toBe(200);

    const deleteBookFromShelfResponse = await deleteBookFromShelf('non-existent', uploadBookResponse.text, { jwt: registerResponse.body.jwt_token });
    expect(deleteBookFromShelfResponse.status).toBe(404);
    expect(deleteBookFromShelfResponse.text).toBe(SHELF_NOT_FOUND);
  });

  test('Book not found', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const createShelfResponse = await createShelf('shelf!', userId, { jwt: registerResponse.body.jwt_token });
    expect(createShelfResponse.status).toBe(200);

    const deleteBookFromShelfResponse = await deleteBookFromShelf(createShelfResponse.text, 'non-existent', { jwt: registerResponse.body.jwt_token });
    expect(deleteBookFromShelfResponse.status).toBe(404);
    expect(deleteBookFromShelfResponse.text).toBe(SHELF_BOOK_NOT_FOUND);
  });

  test('Book not present in shelf', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const uploadBookResponse = await uploadBook(userId, 'The_Great_Gatsby.epub', { jwt: registerResponse.body.jwt_token });
    expect(uploadBookResponse.status).toBe(200);

    const createShelfResponse = await createShelf('shelf!', userId, { jwt: registerResponse.body.jwt_token });
    expect(createShelfResponse.status).toBe(200);

    const deleteBookFromShelfResponse = await deleteBookFromShelf(createShelfResponse.text, uploadBookResponse.text, { jwt: registerResponse.body.jwt_token });
    expect(deleteBookFromShelfResponse.status).toBe(404);
    expect(deleteBookFromShelfResponse.text).toBe(SHELF_BOOK_NOT_FOUND);
  });

  test('Book in another shelf', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const { response: registerResponse2 } = await registerUser(undefined, undefined, process.env.ADMIN_KEY);
    expect(registerResponse2.status).toBe(200);
    const userId2 = registerResponse2.body.user_id;

    const uploadBookResponse = await uploadBook(userId, 'The_Great_Gatsby.epub', { jwt: registerResponse.body.jwt_token });
    expect(uploadBookResponse.status).toBe(200);

    const uploadBookResponse2 = await uploadBook(userId2, 'The_Great_Gatsby.epub', { jwt: registerResponse2.body.jwt_token });
    expect(uploadBookResponse2.status).toBe(200);

    const createShelfResponse = await createShelf('shelf!', userId, { jwt: registerResponse.body.jwt_token });
    expect(createShelfResponse.status).toBe(200);

    const createShelfResponse2 = await createShelf('shelf!', userId2, { jwt: registerResponse2.body.jwt_token });
    expect(createShelfResponse2.status).toBe(200);

    const addBookToShelfResponse = await addBookToShelf(createShelfResponse.text, uploadBookResponse.text, { jwt: registerResponse.body.jwt_token });
    expect(addBookToShelfResponse.status).toBe(204);

    const addBookToShelfResponse2 = await addBookToShelf(createShelfResponse2.text, uploadBookResponse2.text, { jwt: registerResponse2.body.jwt_token });
    expect(addBookToShelfResponse2.status).toBe(204);

    const deleteBookFromShelfResponse = await deleteBookFromShelf(createShelfResponse.text, uploadBookResponse.text, { jwt: registerResponse2.body.jwt_token });
    expect(deleteBookFromShelfResponse.status).toBe(204);

    let listShelfBooksResponse = await listBooksFromShelf(createShelfResponse.text, { jwt: registerResponse.body.jwt_token });
    expect(listShelfBooksResponse.status).toBe(200);
    expect(listShelfBooksResponse.body).toEqual([]);

    listShelfBooksResponse = await listBooksFromShelf(createShelfResponse2.text, { jwt: registerResponse2.body.jwt_token });
    expect(listShelfBooksResponse.status).toBe(200);
    expect(listShelfBooksResponse.body).toEqual([uploadBookResponse2.text]);
  });

  test('Different user without permission', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const { response: registerResponse2 } = await registerUser();
    expect(registerResponse2.status).toBe(200);

    const uploadBookResponse = await uploadBook(userId, 'The_Great_Gatsby.epub', { jwt: registerResponse.body.jwt_token });
    expect(uploadBookResponse.status).toBe(200);

    const createShelfResponse = await createShelf('shelf!', userId, { jwt: registerResponse.body.jwt_token });
    expect(createShelfResponse.status).toBe(200);

    const addBookToShelfResponse = await addBookToShelf(createShelfResponse.text, uploadBookResponse.text, { jwt: registerResponse.body.jwt_token });
    expect(addBookToShelfResponse.status).toBe(204);

    const deleteBookFromShelfResponse = await deleteBookFromShelf(createShelfResponse.text, uploadBookResponse.text, { jwt: registerResponse2.body.jwt_token });
    expect(deleteBookFromShelfResponse.status).toBe(404);
    expect(deleteBookFromShelfResponse.text).toBe(SHELF_NOT_FOUND);
  });

  test('Different user with permission', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const { response: registerResponse2 } = await registerUser(undefined, undefined, process.env.ADMIN_KEY);
    expect(registerResponse2.status).toBe(200);

    const uploadBookResponse = await uploadBook(userId, 'The_Great_Gatsby.epub', { jwt: registerResponse.body.jwt_token });
    expect(uploadBookResponse.status).toBe(200);

    const createShelfResponse = await createShelf('shelf!', userId, { jwt: registerResponse.body.jwt_token });
    expect(createShelfResponse.status).toBe(200);

    const addBookToShelfResponse = await addBookToShelf(createShelfResponse.text, uploadBookResponse.text, { jwt: registerResponse.body.jwt_token });
    expect(addBookToShelfResponse.status).toBe(204);

    const deleteBookFromShelfResponse = await deleteBookFromShelf(createShelfResponse.text, uploadBookResponse.text, { jwt: registerResponse2.body.jwt_token });
    expect(deleteBookFromShelfResponse.status).toBe(204);
  });

  test('No auth', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const uploadBookResponse = await uploadBook(userId, 'The_Great_Gatsby.epub', { jwt: registerResponse.body.jwt_token });
    expect(uploadBookResponse.status).toBe(200);

    const createShelfResponse = await createShelf('shelf!', userId, { jwt: registerResponse.body.jwt_token });
    expect(createShelfResponse.status).toBe(200);

    const addBookToShelfResponse = await addBookToShelf(createShelfResponse.text, uploadBookResponse.text, { jwt: registerResponse.body.jwt_token });
    expect(addBookToShelfResponse.status).toBe(204);

    const deleteBookFromShelfResponse = await deleteBookFromShelf(createShelfResponse.text, uploadBookResponse.text);
    expect(deleteBookFromShelfResponse.status).toBe(401);
    expect(deleteBookFromShelfResponse.text).toBe(UNAUTHORIZED);
  });
});

describe('Delete book from shelf API key', () => {
  test('Simple', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const uploadBookResponse = await uploadBook(userId, 'The_Great_Gatsby.epub', { jwt: registerResponse.body.jwt_token });
    expect(uploadBookResponse.status).toBe(200);

    const createShelfResponse = await createShelf('shelf!', userId, { jwt: registerResponse.body.jwt_token });
    expect(createShelfResponse.status).toBe(200);

    const addBookToShelfResponse = await addBookToShelf(createShelfResponse.text, uploadBookResponse.text, { jwt: registerResponse.body.jwt_token });
    expect(addBookToShelfResponse.status).toBe(204);

    let getShelfMetadataResponse = await getShelfMetadata(createShelfResponse.text, { jwt: registerResponse.body.jwt_token });
    expect(getShelfMetadataResponse.status).toBe(200);
    expect(getShelfMetadataResponse.body.book_count).toBe(1);

    let listShelfBooksResponse = await listBooksFromShelf(createShelfResponse.text, { jwt: registerResponse.body.jwt_token });
    expect(listShelfBooksResponse.status).toBe(200);
    expect(listShelfBooksResponse.body).toEqual([uploadBookResponse.text]);

    const createApiKeyResponse = await createApiKey(userId, 'Test Key', ['Update'], undefined, { jwt: registerResponse.body.jwt_token });
    expect(createApiKeyResponse.status).toBe(200);

    const deleteBookFromShelfResponse = await deleteBookFromShelf(createShelfResponse.text, uploadBookResponse.text, { apiKey: createApiKeyResponse.body.key });
    expect(deleteBookFromShelfResponse.status).toBe(204);

    getShelfMetadataResponse = await getShelfMetadata(createShelfResponse.text, { jwt: registerResponse.body.jwt_token });
    expect(getShelfMetadataResponse.status).toBe(200);
    expect(getShelfMetadataResponse.body.book_count).toBe(0);

    listShelfBooksResponse = await listBooksFromShelf(createShelfResponse.text, { jwt: registerResponse.body.jwt_token });
    expect(listShelfBooksResponse.status).toBe(200);
    expect(listShelfBooksResponse.body).toEqual([]);
  });

  test('Shelf not found', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const uploadBookResponse = await uploadBook(userId, 'The_Great_Gatsby.epub', { jwt: registerResponse.body.jwt_token });
    expect(uploadBookResponse.status).toBe(200);

    const createApiKeyResponse = await createApiKey(userId, 'Test Key', ['Update'], undefined, { jwt: registerResponse.body.jwt_token });
    expect(createApiKeyResponse.status).toBe(200);

    const deleteBookFromShelfResponse = await deleteBookFromShelf('non-existent', uploadBookResponse.text, { apiKey: createApiKeyResponse.body.key });
    expect(deleteBookFromShelfResponse.status).toBe(404);
    expect(deleteBookFromShelfResponse.text).toBe(SHELF_NOT_FOUND);
  });

  test('Book not found', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const createShelfResponse = await createShelf('shelf!', userId, { jwt: registerResponse.body.jwt_token });
    expect(createShelfResponse.status).toBe(200);

    const createApiKeyResponse = await createApiKey(userId, 'Test Key', ['Update'], undefined, { jwt: registerResponse.body.jwt_token });
    expect(createApiKeyResponse.status).toBe(200);

    const deleteBookFromShelfResponse = await deleteBookFromShelf(createShelfResponse.text, 'non-existent', { apiKey: createApiKeyResponse.body.key });
    expect(deleteBookFromShelfResponse.status).toBe(404);
    expect(deleteBookFromShelfResponse.text).toBe(SHELF_BOOK_NOT_FOUND);
  });

  test('Book not present in shelf', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const uploadBookResponse = await uploadBook(userId, 'The_Great_Gatsby.epub', { jwt: registerResponse.body.jwt_token });
    expect(uploadBookResponse.status).toBe(200);

    const createShelfResponse = await createShelf('shelf!', userId, { jwt: registerResponse.body.jwt_token });
    expect(createShelfResponse.status).toBe(200);

    const createApiKeyResponse = await createApiKey(userId, 'Test Key', ['Update'], undefined, { jwt: registerResponse.body.jwt_token });
    expect(createApiKeyResponse.status).toBe(200);

    const deleteBookFromShelfResponse = await deleteBookFromShelf(createShelfResponse.text, uploadBookResponse.text, { apiKey: createApiKeyResponse.body.key });
    expect(deleteBookFromShelfResponse.status).toBe(404);
    expect(deleteBookFromShelfResponse.text).toBe(SHELF_BOOK_NOT_FOUND);
  });

  test('Book in another shelf', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const { response: registerResponse2 } = await registerUser(undefined, undefined, process.env.ADMIN_KEY);
    expect(registerResponse2.status).toBe(200);
    const userId2 = registerResponse2.body.user_id;

    const createApiKeyResponse = await createApiKey(userId2, 'Test Key', ['Update'], undefined, { jwt: registerResponse2.body.jwt_token });
    expect(createApiKeyResponse.status).toBe(200);

    const uploadBookResponse = await uploadBook(userId, 'The_Great_Gatsby.epub', { jwt: registerResponse.body.jwt_token });
    expect(uploadBookResponse.status).toBe(200);

    const uploadBookResponse2 = await uploadBook(userId2, 'The_Great_Gatsby.epub', { jwt: registerResponse2.body.jwt_token });
    expect(uploadBookResponse2.status).toBe(200);

    const createShelfResponse = await createShelf('shelf!', userId, { jwt: registerResponse.body.jwt_token });
    expect(createShelfResponse.status).toBe(200);

    const createShelfResponse2 = await createShelf('shelf!', userId2, { jwt: registerResponse2.body.jwt_token });
    expect(createShelfResponse2.status).toBe(200);

    const addBookToShelfResponse = await addBookToShelf(createShelfResponse.text, uploadBookResponse.text, { jwt: registerResponse.body.jwt_token });
    expect(addBookToShelfResponse.status).toBe(204);

    const addBookToShelfResponse2 = await addBookToShelf(createShelfResponse2.text, uploadBookResponse2.text, { jwt: registerResponse2.body.jwt_token });
    expect(addBookToShelfResponse2.status).toBe(204);

    const deleteBookFromShelfResponse = await deleteBookFromShelf(createShelfResponse.text, uploadBookResponse.text, { apiKey: createApiKeyResponse.body.key });
    expect(deleteBookFromShelfResponse.status).toBe(204);

    let listShelfBooksResponse = await listBooksFromShelf(createShelfResponse.text, { jwt: registerResponse.body.jwt_token });
    expect(listShelfBooksResponse.status).toBe(200);
    expect(listShelfBooksResponse.body).toEqual([]);

    listShelfBooksResponse = await listBooksFromShelf(createShelfResponse2.text, { jwt: registerResponse2.body.jwt_token });
    expect(listShelfBooksResponse.status).toBe(200);
    expect(listShelfBooksResponse.body).toEqual([uploadBookResponse2.text]);
  });

  test('Different user without permission', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const { response: registerResponse2 } = await registerUser();
    expect(registerResponse2.status).toBe(200);
    const userId2 = registerResponse2.body.user_id;

    const createApiKeyResponse = await createApiKey(userId2, 'Test Key', ['Update'], undefined, { jwt: registerResponse2.body.jwt_token });
    expect(createApiKeyResponse.status).toBe(200);

    const uploadBookResponse = await uploadBook(userId, 'The_Great_Gatsby.epub', { jwt: registerResponse.body.jwt_token });
    expect(uploadBookResponse.status).toBe(200);

    const createShelfResponse = await createShelf('shelf!', userId, { jwt: registerResponse.body.jwt_token });
    expect(createShelfResponse.status).toBe(200);

    const addBookToShelfResponse = await addBookToShelf(createShelfResponse.text, uploadBookResponse.text, { jwt: registerResponse.body.jwt_token });
    expect(addBookToShelfResponse.status).toBe(204);

    const deleteBookFromShelfResponse = await deleteBookFromShelf(createShelfResponse.text, uploadBookResponse.text, { apiKey: createApiKeyResponse.body.key });
    expect(deleteBookFromShelfResponse.status).toBe(404);
    expect(deleteBookFromShelfResponse.text).toBe(SHELF_NOT_FOUND);
  });

  test('Different user with permission', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const { response: registerResponse2 } = await registerUser(undefined, undefined, process.env.ADMIN_KEY);
    expect(registerResponse2.status).toBe(200);
    const userId2 = registerResponse2.body.user_id;

    const createApiKeyResponse = await createApiKey(userId2, 'Test Key', ['Update'], undefined, { jwt: registerResponse2.body.jwt_token });
    expect(createApiKeyResponse.status).toBe(200);

    const uploadBookResponse = await uploadBook(userId, 'The_Great_Gatsby.epub', { jwt: registerResponse.body.jwt_token });
    expect(uploadBookResponse.status).toBe(200);

    const createShelfResponse = await createShelf('shelf!', userId, { jwt: registerResponse.body.jwt_token });
    expect(createShelfResponse.status).toBe(200);

    const addBookToShelfResponse = await addBookToShelf(createShelfResponse.text, uploadBookResponse.text, { jwt: registerResponse.body.jwt_token });
    expect(addBookToShelfResponse.status).toBe(204);

    const deleteBookFromShelfResponse = await deleteBookFromShelf(createShelfResponse.text, uploadBookResponse.text, { apiKey: createApiKeyResponse.body.key });
    expect(deleteBookFromShelfResponse.status).toBe(204);
  });

  test('Wrong capabilities', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const uploadBookResponse = await uploadBook(userId, 'The_Great_Gatsby.epub', { jwt: registerResponse.body.jwt_token });
    expect(uploadBookResponse.status).toBe(200);

    const createShelfResponse = await createShelf('shelf!', userId, { jwt: registerResponse.body.jwt_token });
    expect(createShelfResponse.status).toBe(200);

    const addBookToShelfResponse = await addBookToShelf(createShelfResponse.text, uploadBookResponse.text, { jwt: registerResponse.body.jwt_token });
    expect(addBookToShelfResponse.status).toBe(204);

    const createApiKeyResponse = await createApiKey(userId, 'Test Key', ['Delete', 'Create', 'Read'], undefined, { jwt: registerResponse.body.jwt_token });
    expect(createApiKeyResponse.status).toBe(200);

    const deleteBookFromShelfResponse = await deleteBookFromShelf(createShelfResponse.text, uploadBookResponse.text, { apiKey: createApiKeyResponse.body.key });
    expect(deleteBookFromShelfResponse.status).toBe(403);
    expect(deleteBookFromShelfResponse.text).toBe(FORBIDDEN);
  });

  test('Expired key', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const shelfName = randomString(20);

    const uploadBookResponse = await uploadBook(userId, 'The_Great_Gatsby.epub', { jwt: registerResponse.body.jwt_token });
    expect(uploadBookResponse.status).toBe(200);

    const createShelfResponse = await createShelf(shelfName, userId, { jwt: registerResponse.body.jwt_token });
    expect(createShelfResponse.status).toBe(200);

    const addBookToShelfResponse = await addBookToShelf(createShelfResponse.text, uploadBookResponse.text, { jwt: registerResponse.body.jwt_token });
    expect(addBookToShelfResponse.status).toBe(204);

    const timestamp = Date.now() + 1000;
    const createApiKeyResponse = await createApiKey(userId, 'Test Key', ['Create'], timestamp, { jwt: registerResponse.body.jwt_token });
    expect(createApiKeyResponse.status).toBe(200);

    // Wait for the key to expire
    await wait(1.5);

    const deleteBookFromShelfResponse = await deleteBookFromShelf(createShelfResponse.text, uploadBookResponse.text, { apiKey: createApiKeyResponse.body.key });
    expect(deleteBookFromShelfResponse.status).toBe(401);
    expect(deleteBookFromShelfResponse.text).toBe(INVALID_API_KEY);
  });
});
