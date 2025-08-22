import fs from 'fs';
import path from 'path';
import { BOOK_NOT_FOUND, uploadBook } from '../utils/books';
import { COVERS_DIR, FORBIDDEN, INVALID_API_KEY, UNAUTHORIZED, wait } from '../utils/common';
import { addCover, COVER_CONFLICT, COVER_NOT_FOUND, deleteCover, getCover, INVALID_COVER, updateCover } from '../utils/covers';
import { createApiKey, registerUser } from '../utils/users';

describe('Get cover JWT', () => {
  test('Simple', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const uploadResponse = await uploadBook(userId, 'Alices_Adventures_in_Wonderland.epub', { jwt: registerResponse.body.jwt_token });
    expect(uploadResponse.status).toBe(200);

    // Wait for cover to be extracted
    await wait(1);

    const downloadResponse = await getCover(uploadResponse.text, { jwt: registerResponse.body.jwt_token });
    expect(downloadResponse.status).toBe(200);

    let coverPath = path.join(COVERS_DIR, 'Alices_Adventures_in_Wonderland.jpeg');
    let cover = fs.readFileSync(coverPath);

    expect(cover).toEqual(downloadResponse.body);
  });

  test('Non-existent cover', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    // This epub does not contain a cover
    const uploadResponse = await uploadBook(userId, 'The_Great_Gatsby.epub', { jwt: registerResponse.body.jwt_token });
    expect(uploadResponse.status).toBe(200);

    // Give chance for any cover to be extracted
    await wait(1);

    const downloadResponse = await getCover(uploadResponse.text, { jwt: registerResponse.body.jwt_token });
    expect(downloadResponse.status).toBe(404);
    expect(downloadResponse.text).toBe(COVER_NOT_FOUND);
  });

  test('Non-existent book', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);

    const downloadResponse = await getCover('non-existent', { jwt: registerResponse.body.jwt_token });
    expect(downloadResponse.status).toBe(404);
    expect(downloadResponse.text).toBe(BOOK_NOT_FOUND);
  });

  test('Different user without permission', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const uploadResponse = await uploadBook(userId, 'Alices_Adventures_in_Wonderland.epub', { jwt: registerResponse.body.jwt_token });
    expect(uploadResponse.status).toBe(200);

    // Wait for cover to be extracted
    await wait(1);

    const { response: registerResponse2 } = await registerUser();
    expect(registerResponse2.status).toBe(200);

    const downloadResponse = await getCover(uploadResponse.text, { jwt: registerResponse2.body.jwt_token });
    expect(downloadResponse.status).toBe(404);
    expect(downloadResponse.text).toBe(BOOK_NOT_FOUND);
  });

  test('Different user with permission', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const uploadResponse = await uploadBook(userId, 'Alices_Adventures_in_Wonderland.epub', { jwt: registerResponse.body.jwt_token });
    expect(uploadResponse.status).toBe(200);

    // Wait for cover to be extracted
    await wait(1);

    const { response: registerResponse2 } = await registerUser(undefined, undefined, process.env.ADMIN_KEY);
    expect(registerResponse2.status).toBe(200);

    const downloadResponse = await getCover(uploadResponse.text, { jwt: registerResponse2.body.jwt_token });
    expect(downloadResponse.status).toBe(200);
  });

  test('No auth', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const uploadResponse = await uploadBook(userId, 'Alices_Adventures_in_Wonderland.epub', { jwt: registerResponse.body.jwt_token });
    expect(uploadResponse.status).toBe(200);

    // Wait for cover to be extracted
    await wait(1);

    const downloadResponse = await getCover(uploadResponse.text);
    expect(downloadResponse.status).toBe(401);
    expect(downloadResponse.text).toBe(UNAUTHORIZED);
  });
});

describe('Get cover api key', () => {
  test('Simple', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const uploadResponse = await uploadBook(userId, 'Alices_Adventures_in_Wonderland.epub', { jwt: registerResponse.body.jwt_token });
    expect(uploadResponse.status).toBe(200);

    // Wait for cover to be extracted
    await wait(1);

    const createApiKeyResponse = await createApiKey(userId, 'Test Key', ['Read'], undefined, { jwt: registerResponse.body.jwt_token });
    expect(createApiKeyResponse.status).toBe(200);

    const downloadResponse = await getCover(uploadResponse.text, { apiKey: createApiKeyResponse.body.key });
    expect(downloadResponse.status).toBe(200);

    let coverPath = path.join(COVERS_DIR, 'Alices_Adventures_in_Wonderland.jpeg');
    let cover = fs.readFileSync(coverPath);

    expect(cover).toEqual(downloadResponse.body);
  });

  test('Non-existent cover', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    // This epub does not contain a cover
    const uploadResponse = await uploadBook(userId, 'The_Great_Gatsby.epub', { jwt: registerResponse.body.jwt_token });
    expect(uploadResponse.status).toBe(200);

    // Give chance for any cover to be extracted
    await wait(1);

    const createApiKeyResponse = await createApiKey(userId, 'Test Key', ['Read'], undefined, { jwt: registerResponse.body.jwt_token });
    expect(createApiKeyResponse.status).toBe(200);

    const downloadResponse = await getCover(uploadResponse.text, { apiKey: createApiKeyResponse.body.key });
    expect(downloadResponse.status).toBe(404);
    expect(downloadResponse.text).toBe(COVER_NOT_FOUND);
  });

  test('Non-existent book', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const createApiKeyResponse = await createApiKey(userId, 'Test Key', ['Read'], undefined, { jwt: registerResponse.body.jwt_token });
    expect(createApiKeyResponse.status).toBe(200);

    const downloadResponse = await getCover('non-existent', { apiKey: createApiKeyResponse.body.key });
    expect(downloadResponse.status).toBe(404);
    expect(downloadResponse.text).toBe(BOOK_NOT_FOUND);
  });

  test('Different user without permission', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const uploadResponse = await uploadBook(userId, 'Alices_Adventures_in_Wonderland.epub', { jwt: registerResponse.body.jwt_token });
    expect(uploadResponse.status).toBe(200);

    // Wait for cover to be extracted
    await wait(1);

    const { response: registerResponse2 } = await registerUser();
    expect(registerResponse2.status).toBe(200);
    const userId2 = registerResponse2.body.user_id;

    const createApiKeyResponse = await createApiKey(userId2, 'Test Key', ['Read'], undefined, { jwt: registerResponse2.body.jwt_token });
    expect(createApiKeyResponse.status).toBe(200);

    const downloadResponse = await getCover(uploadResponse.text, { apiKey: createApiKeyResponse.body.key });
    expect(downloadResponse.status).toBe(404);
    expect(downloadResponse.text).toBe(BOOK_NOT_FOUND);
  });

  test('Different user with permission', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const uploadResponse = await uploadBook(userId, 'Alices_Adventures_in_Wonderland.epub', { jwt: registerResponse.body.jwt_token });
    expect(uploadResponse.status).toBe(200);

    // Wait for cover to be extracted
    await wait(1);

    const { response: registerResponse2 } = await registerUser(undefined, undefined, process.env.ADMIN_KEY);
    expect(registerResponse2.status).toBe(200);
    const userId2 = registerResponse2.body.user_id;

    const createApiKeyResponse = await createApiKey(userId2, 'Test Key', ['Read'], undefined, { jwt: registerResponse2.body.jwt_token });
    expect(createApiKeyResponse.status).toBe(200);

    const downloadResponse = await getCover(uploadResponse.text, { apiKey: createApiKeyResponse.body.key });
    expect(downloadResponse.status).toBe(200);
  });

  test('Wrong capabilities', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const uploadResponse = await uploadBook(userId, 'Alices_Adventures_in_Wonderland.epub', { jwt: registerResponse.body.jwt_token });
    expect(uploadResponse.status).toBe(200);

    // Wait for cover to be extracted
    await wait(1);

    const createApiKeyResponse = await createApiKey(userId, 'Test Key', ['Create', 'Update', 'Delete'], undefined, { jwt: registerResponse.body.jwt_token });
    expect(createApiKeyResponse.status).toBe(200);

    const downloadResponse = await getCover(uploadResponse.text, { apiKey: createApiKeyResponse.body.key });
    expect(downloadResponse.status).toBe(403);
    expect(downloadResponse.text).toBe(FORBIDDEN);
  });

  test('Expired api key', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const uploadResponse = await uploadBook(userId, 'Alices_Adventures_in_Wonderland.epub', { jwt: registerResponse.body.jwt_token });
    expect(uploadResponse.status).toBe(200);

    // Wait for cover to be extracted
    await wait(1);

    const timestamp = Date.now() + 1000;
    const createApiKeyResponse = await createApiKey(userId, 'Test Key', ['Read'], timestamp, { jwt: registerResponse.body.jwt_token });
    expect(createApiKeyResponse.status).toBe(200);

    // Wait for the key to expire
    await wait(1.5);

    const downloadResponse = await getCover(uploadResponse.text, { apiKey: createApiKeyResponse.body.key });
    expect(downloadResponse.status).toBe(401);
    expect(downloadResponse.text).toBe(INVALID_API_KEY);
  });
});

describe('Add cover JWT', () => {
  test('Simple', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const uploadResponse = await uploadBook(userId, 'The_Great_Gatsby.epub', { jwt: registerResponse.body.jwt_token });
    expect(uploadResponse.status).toBe(200);

    // Give chance for any cover to be extracted
    await wait(1);

    const addResponse = await addCover(uploadResponse.text, 'Generic.jpeg', { jwt: registerResponse.body.jwt_token });
    expect(addResponse.status).toBe(204);

    const downloadResponse = await getCover(uploadResponse.text, { jwt: registerResponse.body.jwt_token });
    expect(downloadResponse.status).toBe(200);

    let coverPath = path.join(COVERS_DIR, 'Generic.jpeg');
    let cover = fs.readFileSync(coverPath);

    expect(cover).toEqual(downloadResponse.body);
  });

  test('Invalid cover', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const uploadResponse = await uploadBook(userId, 'The_Great_Gatsby.epub', { jwt: registerResponse.body.jwt_token });
    expect(uploadResponse.status).toBe(200);

    // Give chance for any cover to be extracted
    await wait(1);

    try {
      const addResponse = await addCover(uploadResponse.text, 'This_is_not_a_cover.txt', { jwt: registerResponse.body.jwt_token });
      expect(addResponse.status).toBe(400);
      expect(addResponse.text).toBe(INVALID_COVER);
    } catch (err: any) {
      if (err.code === 'EPIPE') return;
      throw err;
    }
  });

  test('Cover conflict', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const uploadResponse = await uploadBook(userId, 'Alices_Adventures_in_Wonderland.epub', { jwt: registerResponse.body.jwt_token });
    expect(uploadResponse.status).toBe(200);

    // Wait for cover to be extracted
    await wait(1);

    try {
      const addResponse = await addCover(uploadResponse.text, 'Alices_Adventures_in_Wonderland.jpeg', { jwt: registerResponse.body.jwt_token });
      expect(addResponse.status).toBe(409);
      expect(addResponse.text).toBe(COVER_CONFLICT);
    } catch (err: any) {
      if (err.code === 'EPIPE') return;
      throw err;
    }
  });

  test('Non-existent book', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);

    try {
      const addResponse = await addCover('non-existent', 'Alices_Adventures_in_Wonderland.jpeg', { jwt: registerResponse.body.jwt_token });
      expect(addResponse.status).toBe(404);
      expect(addResponse.text).toBe(BOOK_NOT_FOUND);
    } catch (err: any) {
      if (err.code === 'EPIPE') return;
      throw err;
    }
  });

  test('Different user without permission', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const uploadResponse = await uploadBook(userId, 'The_Great_Gatsby.epub', { jwt: registerResponse.body.jwt_token });
    expect(uploadResponse.status).toBe(200);

    // Give chance for any cover to be extracted
    await wait(1);

    const { response: registerResponse2 } = await registerUser();
    expect(registerResponse2.status).toBe(200);

    try {
      const addResponse = await addCover(uploadResponse.text, 'Generic.jpeg', { jwt: registerResponse2.body.jwt_token });
      expect(addResponse.status).toBe(404);
      expect(addResponse.text).toBe(BOOK_NOT_FOUND);
    } catch (err: any) {
      if (err.code === 'EPIPE') return;
      throw err;
    }
  });

  test('Different user with permission', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const uploadResponse = await uploadBook(userId, 'The_Great_Gatsby.epub', { jwt: registerResponse.body.jwt_token });
    expect(uploadResponse.status).toBe(200);

    // Give chance for any cover to be extracted
    await wait(1);

    const { response: registerResponse2 } = await registerUser(undefined, undefined, process.env.ADMIN_KEY);
    expect(registerResponse2.status).toBe(200);

    const addResponse = await addCover(uploadResponse.text, 'Generic.jpeg', { jwt: registerResponse2.body.jwt_token });
    expect(addResponse.status).toBe(204);
  });

  test('No auth', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const uploadResponse = await uploadBook(userId, 'The_Great_Gatsby.epub', { jwt: registerResponse.body.jwt_token });
    expect(uploadResponse.status).toBe(200);

    // Give chance for any cover to be extracted
    await wait(1);

    try {
      const addResponse = await addCover(uploadResponse.text, 'Generic.jpeg');
      expect(addResponse.status).toBe(401);
      expect(addResponse.text).toBe(UNAUTHORIZED);
    } catch (err: any) {
      if (err.code === 'EPIPE') return;
      throw err;
    }
  });
});

describe('Add cover api key', () => {
  test('Simple', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const uploadResponse = await uploadBook(userId, 'The_Great_Gatsby.epub', { jwt: registerResponse.body.jwt_token });
    expect(uploadResponse.status).toBe(200);

    // Give chance for any cover to be extracted
    await wait(1);

    const createApiKeyResponse = await createApiKey(userId, 'Test Key', ['Update'], undefined, { jwt: registerResponse.body.jwt_token });
    expect(createApiKeyResponse.status).toBe(200);

    const addResponse = await addCover(uploadResponse.text, 'Generic.jpeg', { apiKey: createApiKeyResponse.body.key });
    expect(addResponse.status).toBe(204);

    const downloadResponse = await getCover(uploadResponse.text, { jwt: registerResponse.body.jwt_token });
    expect(downloadResponse.status).toBe(200);

    let coverPath = path.join(COVERS_DIR, 'Generic.jpeg');
    let cover = fs.readFileSync(coverPath);

    expect(cover).toEqual(downloadResponse.body);
  });

  test('Invalid cover', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const uploadResponse = await uploadBook(userId, 'The_Great_Gatsby.epub', { jwt: registerResponse.body.jwt_token });
    expect(uploadResponse.status).toBe(200);

    // Give chance for any cover to be extracted
    await wait(1);

    const createApiKeyResponse = await createApiKey(userId, 'Test Key', ['Update'], undefined, { jwt: registerResponse.body.jwt_token });
    expect(createApiKeyResponse.status).toBe(200);

    try {
      const addResponse = await addCover(uploadResponse.text, 'This_is_not_a_cover.txt', { apiKey: createApiKeyResponse.body.key });
      expect(addResponse.status).toBe(400);
      expect(addResponse.text).toBe(INVALID_COVER);
    } catch (err: any) {
      if (err.code === 'EPIPE') return;
      throw err;
    }
  });

  test('Cover conflict', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const uploadResponse = await uploadBook(userId, 'Alices_Adventures_in_Wonderland.epub', { jwt: registerResponse.body.jwt_token });
    expect(uploadResponse.status).toBe(200);

    // Wait for cover to be extracted
    await wait(1);

    const createApiKeyResponse = await createApiKey(userId, 'Test Key', ['Update'], undefined, { jwt: registerResponse.body.jwt_token });
    expect(createApiKeyResponse.status).toBe(200);

    try {
      const addResponse = await addCover(uploadResponse.text, 'Alices_Adventures_in_Wonderland.jpeg', { apiKey: createApiKeyResponse.body.key });
      expect(addResponse.status).toBe(409);
      expect(addResponse.text).toBe(COVER_CONFLICT);
    } catch (err: any) {
      if (err.code === 'EPIPE') return;
      throw err;
    }
  });

  test('Non-existent book', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const createApiKeyResponse = await createApiKey(userId, 'Test Key', ['Update'], undefined, { jwt: registerResponse.body.jwt_token });
    expect(createApiKeyResponse.status).toBe(200);

    try {
      const addResponse = await addCover('non-existent', 'Alices_Adventures_in_Wonderland.jpeg', { apiKey: createApiKeyResponse.body.key });
      expect(addResponse.status).toBe(404);
      expect(addResponse.text).toBe(BOOK_NOT_FOUND);
    } catch (err: any) {
      if (err.code === 'EPIPE') return;
      throw err;
    }
  });

  test('Different user without permission', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const uploadResponse = await uploadBook(userId, 'The_Great_Gatsby.epub', { jwt: registerResponse.body.jwt_token });
    expect(uploadResponse.status).toBe(200);

    // Give chance for any cover to be extracted
    await wait(1);

    const { response: registerResponse2 } = await registerUser();
    expect(registerResponse2.status).toBe(200);
    const userId2 = registerResponse2.body.user_id;

    const createApiKeyResponse = await createApiKey(userId2, 'Test Key', ['Update'], undefined, { jwt: registerResponse2.body.jwt_token });
    expect(createApiKeyResponse.status).toBe(200);

    try {
      const addResponse = await addCover(uploadResponse.text, 'Generic.jpeg', { apiKey: createApiKeyResponse.body.key });
      expect(addResponse.status).toBe(404);
      expect(addResponse.text).toBe(BOOK_NOT_FOUND);
    } catch (err: any) {
      if (err.code === 'EPIPE') return;
      throw err;
    }
  });

  test('Different user with permission', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const uploadResponse = await uploadBook(userId, 'The_Great_Gatsby.epub', { jwt: registerResponse.body.jwt_token });
    expect(uploadResponse.status).toBe(200);

    // Give chance for any cover to be extracted
    await wait(1);

    const { response: registerResponse2 } = await registerUser(undefined, undefined, process.env.ADMIN_KEY);
    expect(registerResponse2.status).toBe(200);
    const userId2 = registerResponse2.body.user_id;

    const createApiKeyResponse = await createApiKey(userId2, 'Test Key', ['Update'], undefined, { jwt: registerResponse2.body.jwt_token });
    expect(createApiKeyResponse.status).toBe(200);

    const addResponse = await addCover(uploadResponse.text, 'Generic.jpeg', { apiKey: createApiKeyResponse.body.key });
    expect(addResponse.status).toBe(204);
  });

  test('Wrong capabilities', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const uploadResponse = await uploadBook(userId, 'The_Great_Gatsby.epub', { jwt: registerResponse.body.jwt_token });
    expect(uploadResponse.status).toBe(200);

    // Give chance for any cover to be extracted
    await wait(1);

    const createApiKeyResponse = await createApiKey(userId, 'Test Key', ['Create', 'Read', 'Delete'], undefined, { jwt: registerResponse.body.jwt_token });
    expect(createApiKeyResponse.status).toBe(200);

    try {
      const addResponse = await addCover(uploadResponse.text, 'Generic.jpeg', { apiKey: createApiKeyResponse.body.key });
      expect(addResponse.status).toBe(403);
      expect(addResponse.text).toBe(FORBIDDEN);
    } catch (err: any) {
      if (err.code === 'EPIPE') return;
      throw err;
    }
  });

  test('Expired key', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const uploadResponse = await uploadBook(userId, 'The_Great_Gatsby.epub', { jwt: registerResponse.body.jwt_token });
    expect(uploadResponse.status).toBe(200);

    // Give chance for any cover to be extracted
    await wait(1);

    const timestamp = Date.now() + 1000;
    const createApiKeyResponse = await createApiKey(userId, 'Test Key', ['Update'], timestamp, { jwt: registerResponse.body.jwt_token });
    expect(createApiKeyResponse.status).toBe(200);

    // Wait for the key to expire
    await wait(1.5);

    try {
      const addResponse = await addCover(uploadResponse.text, 'Generic.jpeg', { apiKey: createApiKeyResponse.body.key });
      expect(addResponse.status).toBe(401);
      expect(addResponse.text).toBe(INVALID_API_KEY);
    } catch (err: any) {
      if (err.code === 'EPIPE') return;
      throw err;
    }
  });
});

describe('Delete cover JWT', () => {
  test('Simple', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const uploadResponse = await uploadBook(userId, 'Alices_Adventures_in_Wonderland.epub', { jwt: registerResponse.body.jwt_token });
    expect(uploadResponse.status).toBe(200);

    // Wait for cover to be extracted
    await wait(1);

    const deleteResponse = await deleteCover(uploadResponse.text, { jwt: registerResponse.body.jwt_token });
    expect(deleteResponse.status).toBe(204);

    const downloadResponse = await getCover(uploadResponse.text, { jwt: registerResponse.body.jwt_token });
    expect(downloadResponse.status).toBe(404);
    expect(downloadResponse.text).toBe(COVER_NOT_FOUND);
  });

  test('Non-existent cover', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    // This epub does not contain a cover
    const uploadResponse = await uploadBook(userId, 'The_Great_Gatsby.epub', { jwt: registerResponse.body.jwt_token });
    expect(uploadResponse.status).toBe(200);

    // Give chance for any cover to be extracted
    await wait(1);

    const deleteResponse = await deleteCover(uploadResponse.text, { jwt: registerResponse.body.jwt_token });
    expect(deleteResponse.status).toBe(404);
    expect(deleteResponse.text).toBe(COVER_NOT_FOUND);
  });

  test('Non-existent book', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);

    const deleteResponse = await deleteCover('non-existent', { jwt: registerResponse.body.jwt_token });
    expect(deleteResponse.status).toBe(404);
    expect(deleteResponse.text).toBe(BOOK_NOT_FOUND);
  });

  test('Different user without permission', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const uploadResponse = await uploadBook(userId, 'Alices_Adventures_in_Wonderland.epub', { jwt: registerResponse.body.jwt_token });
    expect(uploadResponse.status).toBe(200);

    // Wait for cover to be extracted
    await wait(1);

    const { response: registerResponse2 } = await registerUser();
    expect(registerResponse2.status).toBe(200);

    const deleteResponse = await deleteCover(uploadResponse.text, { jwt: registerResponse2.body.jwt_token });
    expect(deleteResponse.status).toBe(404);
    expect(deleteResponse.text).toBe(BOOK_NOT_FOUND);
  });

  test('Different user with permission', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const uploadResponse = await uploadBook(userId, 'Alices_Adventures_in_Wonderland.epub', { jwt: registerResponse.body.jwt_token });
    expect(uploadResponse.status).toBe(200);

    // Wait for cover to be extracted
    await wait(1);

    const { response: registerResponse2 } = await registerUser(undefined, undefined, process.env.ADMIN_KEY);
    expect(registerResponse2.status).toBe(200);

    const deleteResponse = await deleteCover(uploadResponse.text, { jwt: registerResponse2.body.jwt_token });
    expect(deleteResponse.status).toBe(204);
  });

  test('No auth', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const uploadResponse = await uploadBook(userId, 'Alices_Adventures_in_Wonderland.epub', { jwt: registerResponse.body.jwt_token });
    expect(uploadResponse.status).toBe(200);

    // Wait for cover to be extracted
    await wait(1);

    const deleteResponse = await deleteCover(uploadResponse.text);
    expect(deleteResponse.status).toBe(401);
    expect(deleteResponse.text).toBe(UNAUTHORIZED);
  });
});

describe('Delete cover api key', () => {
  test('Simple', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const uploadResponse = await uploadBook(userId, 'Alices_Adventures_in_Wonderland.epub', { jwt: registerResponse.body.jwt_token });
    expect(uploadResponse.status).toBe(200);

    // Wait for cover to be extracted
    await wait(1);

    const createApiKeyResponse = await createApiKey(userId, 'Test Key', ['Delete'], undefined, { jwt: registerResponse.body.jwt_token });
    expect(createApiKeyResponse.status).toBe(200);

    const deleteResponse = await deleteCover(uploadResponse.text, { apiKey: createApiKeyResponse.body.key });
    expect(deleteResponse.status).toBe(204);

    const downloadResponse = await getCover(uploadResponse.text, { jwt: registerResponse.body.jwt_token });
    expect(downloadResponse.status).toBe(404);
    expect(downloadResponse.text).toBe(COVER_NOT_FOUND);
  });

  test('Non-existent cover', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    // This epub does not contain a cover
    const uploadResponse = await uploadBook(userId, 'The_Great_Gatsby.epub', { jwt: registerResponse.body.jwt_token });
    expect(uploadResponse.status).toBe(200);

    // Give chance for any cover to be extracted
    await wait(1);

    const createApiKeyResponse = await createApiKey(userId, 'Test Key', ['Delete'], undefined, { jwt: registerResponse.body.jwt_token });
    expect(createApiKeyResponse.status).toBe(200);

    const deleteResponse = await deleteCover(uploadResponse.text, { apiKey: createApiKeyResponse.body.key });
    expect(deleteResponse.status).toBe(404);
    expect(deleteResponse.text).toBe(COVER_NOT_FOUND);
  });

  test('Non-existent book', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const createApiKeyResponse = await createApiKey(userId, 'Test Key', ['Delete'], undefined, { jwt: registerResponse.body.jwt_token });
    expect(createApiKeyResponse.status).toBe(200);

    const deleteResponse = await deleteCover('non-existent', { apiKey: createApiKeyResponse.body.key });
    expect(deleteResponse.status).toBe(404);
    expect(deleteResponse.text).toBe(BOOK_NOT_FOUND);
  });

  test('Different user without permission', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const uploadResponse = await uploadBook(userId, 'Alices_Adventures_in_Wonderland.epub', { jwt: registerResponse.body.jwt_token });
    expect(uploadResponse.status).toBe(200);

    // Wait for cover to be extracted
    await wait(1);

    const { response: registerResponse2 } = await registerUser();
    expect(registerResponse2.status).toBe(200);
    const userId2 = registerResponse2.body.user_id;

    const createApiKeyResponse = await createApiKey(userId2, 'Test Key', ['Delete'], undefined, { jwt: registerResponse2.body.jwt_token });
    expect(createApiKeyResponse.status).toBe(200);

    const deleteResponse = await deleteCover(uploadResponse.text, { apiKey: createApiKeyResponse.body.key });
    expect(deleteResponse.status).toBe(404);
    expect(deleteResponse.text).toBe(BOOK_NOT_FOUND);
  });

  test('Different user with permission', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const uploadResponse = await uploadBook(userId, 'Alices_Adventures_in_Wonderland.epub', { jwt: registerResponse.body.jwt_token });
    expect(uploadResponse.status).toBe(200);

    // Wait for cover to be extracted
    await wait(1);

    const { response: registerResponse2 } = await registerUser(undefined, undefined, process.env.ADMIN_KEY);
    expect(registerResponse2.status).toBe(200);
    const userId2 = registerResponse2.body.user_id;

    const createApiKeyResponse = await createApiKey(userId2, 'Test Key', ['Delete'], undefined, { jwt: registerResponse2.body.jwt_token });
    expect(createApiKeyResponse.status).toBe(200);

    const deleteResponse = await deleteCover(uploadResponse.text, { apiKey: createApiKeyResponse.body.key });
    expect(deleteResponse.status).toBe(204);
  });

  test('Wrong capabilities', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const uploadResponse = await uploadBook(userId, 'Alices_Adventures_in_Wonderland.epub', { jwt: registerResponse.body.jwt_token });
    expect(uploadResponse.status).toBe(200);

    // Wait for cover to be extracted
    await wait(1);

    const createApiKeyResponse = await createApiKey(userId, 'Test Key', ['Read', 'Create', 'Update'], undefined, { jwt: registerResponse.body.jwt_token });
    expect(createApiKeyResponse.status).toBe(200);

    const deleteResponse = await deleteCover(uploadResponse.text, { apiKey: createApiKeyResponse.body.key });
    expect(deleteResponse.status).toBe(403);
    expect(deleteResponse.text).toBe(FORBIDDEN);
  });

  test('Expired key', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const uploadResponse = await uploadBook(userId, 'Alices_Adventures_in_Wonderland.epub', { jwt: registerResponse.body.jwt_token });
    expect(uploadResponse.status).toBe(200);

    // Wait for cover to be extracted
    await wait(1);

    const timestamp = Date.now() + 1000;
    const createApiKeyResponse = await createApiKey(userId, 'Test Key', ['Delete'], timestamp, { jwt: registerResponse.body.jwt_token });
    expect(createApiKeyResponse.status).toBe(200);

    // Wait for the key to expire
    await wait(1.5);

    const deleteResponse = await deleteCover(uploadResponse.text, { apiKey: createApiKeyResponse.body.key });
    expect(deleteResponse.status).toBe(401);
    expect(deleteResponse.text).toBe(INVALID_API_KEY);
  });
});

describe('Update cover JWT', () => {
  test('Simple', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const uploadResponse = await uploadBook(userId, 'Alices_Adventures_in_Wonderland.epub', { jwt: registerResponse.body.jwt_token });
    expect(uploadResponse.status).toBe(200);

    // Wait for cover to be extracted
    await wait(1);

    const updateResponse = await updateCover(uploadResponse.text, 'Generic.jpeg', { jwt: registerResponse.body.jwt_token });
    expect(updateResponse.status).toBe(204);

    const downloadResponse = await getCover(uploadResponse.text, { jwt: registerResponse.body.jwt_token });
    expect(downloadResponse.status).toBe(200);

    let coverPath = path.join(COVERS_DIR, 'Generic.jpeg');
    let cover = fs.readFileSync(coverPath);

    expect(cover).toEqual(downloadResponse.body);
  });

  test('Non-existent cover', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    // This epub does not contain a cover
    const uploadResponse = await uploadBook(userId, 'The_Great_Gatsby.epub', { jwt: registerResponse.body.jwt_token });
    expect(uploadResponse.status).toBe(200);

    // Give chance for any cover to be extracted
    await wait(1);

    try {
      const updateResponse = await updateCover(uploadResponse.text, 'Generic.jpeg', { jwt: registerResponse.body.jwt_token });
      expect(updateResponse.status).toBe(404);
      expect(updateResponse.text).toBe(COVER_NOT_FOUND);
    } catch (err: any) {
      if (err.code === 'EPIPE') return;
      throw err;
    }
  });

  test('Non-existent book', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);

    try {
      const updateResponse = await updateCover('non-existent', 'Generic.jpeg', { jwt: registerResponse.body.jwt_token });
      expect(updateResponse.status).toBe(404);
      expect(updateResponse.text).toBe(BOOK_NOT_FOUND);
    } catch (err: any) {
      if (err.code === 'EPIPE') return;
      throw err;
    }
  });

  test('Invalid cover', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const uploadResponse = await uploadBook(userId, 'Alices_Adventures_in_Wonderland.epub', { jwt: registerResponse.body.jwt_token });
    expect(uploadResponse.status).toBe(200);

    // Wait for cover to be extracted
    await wait(1);

    try {
      const updateResponse = await updateCover(uploadResponse.text, 'This_is_not_a_cover.txt', { jwt: registerResponse.body.jwt_token });
      expect(updateResponse.status).toBe(400);
      expect(updateResponse.text).toBe(INVALID_COVER);
    } catch (err: any) {
      if (err.code === 'EPIPE') return;
      throw err;
    }
  });

  test('Different user without permission', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const uploadResponse = await uploadBook(userId, 'Alices_Adventures_in_Wonderland.epub', { jwt: registerResponse.body.jwt_token });
    expect(uploadResponse.status).toBe(200);

    // Wait for cover to be extracted
    await wait(1);

    const { response: registerResponse2 } = await registerUser();
    expect(registerResponse2.status).toBe(200);

    try {
      const updateResponse = await updateCover(uploadResponse.text, 'Generic.jpeg', { jwt: registerResponse2.body.jwt_token });
      expect(updateResponse.status).toBe(404);
      expect(updateResponse.text).toBe(BOOK_NOT_FOUND);
    } catch (err: any) {
      if (err.code === 'EPIPE') return;
      throw err;
    }
  });

  test('Different user with permission', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const uploadResponse = await uploadBook(userId, 'Alices_Adventures_in_Wonderland.epub', { jwt: registerResponse.body.jwt_token });
    expect(uploadResponse.status).toBe(200);

    // Wait for cover to be extracted
    await wait(1);

    const { response: registerResponse2 } = await registerUser(undefined, undefined, process.env.ADMIN_KEY);
    expect(registerResponse2.status).toBe(200);

    const updateResponse = await updateCover(uploadResponse.text, 'Generic.jpeg', { jwt: registerResponse2.body.jwt_token });
    expect(updateResponse.status).toBe(204);
  });

  test('No auth', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const uploadResponse = await uploadBook(userId, 'Alices_Adventures_in_Wonderland.epub', { jwt: registerResponse.body.jwt_token });
    expect(uploadResponse.status).toBe(200);

    // Wait for cover to be extracted
    await wait(1);

    try {
      const updateResponse = await updateCover(uploadResponse.text, 'Generic.jpeg');
      expect(updateResponse.status).toBe(401);
      expect(updateResponse.text).toBe(UNAUTHORIZED);
    } catch (err: any) {
      if (err.code === 'EPIPE') return;
      throw err;
    }
  });
});

describe('Update cover api key', () => {
  test('Simple', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const uploadResponse = await uploadBook(userId, 'Alices_Adventures_in_Wonderland.epub', { jwt: registerResponse.body.jwt_token });
    expect(uploadResponse.status).toBe(200);

    // Wait for cover to be extracted
    await wait(1);

    const createApiKeyResponse = await createApiKey(userId, 'Test Key', ['Update'], undefined, { jwt: registerResponse.body.jwt_token });
    expect(createApiKeyResponse.status).toBe(200);

    const updateResponse = await updateCover(uploadResponse.text, 'Generic.jpeg', { apiKey: createApiKeyResponse.body.key });
    expect(updateResponse.status).toBe(204);

    const downloadResponse = await getCover(uploadResponse.text, { jwt: registerResponse.body.jwt_token });
    expect(downloadResponse.status).toBe(200);

    let coverPath = path.join(COVERS_DIR, 'Generic.jpeg');
    let cover = fs.readFileSync(coverPath);

    expect(cover).toEqual(downloadResponse.body);
  });

  test('Non-existent cover', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    // This epub does not contain a cover
    const uploadResponse = await uploadBook(userId, 'The_Great_Gatsby.epub', { jwt: registerResponse.body.jwt_token });
    expect(uploadResponse.status).toBe(200);

    // Give chance for any cover to be extracted
    await wait(1);

    const createApiKeyResponse = await createApiKey(userId, 'Test Key', ['Update'], undefined, { jwt: registerResponse.body.jwt_token });
    expect(createApiKeyResponse.status).toBe(200);

    try {
      const updateResponse = await updateCover(uploadResponse.text, 'Generic.jpeg', { apiKey: createApiKeyResponse.body.key });
      expect(updateResponse.status).toBe(404);
      expect(updateResponse.text).toBe(COVER_NOT_FOUND);
    } catch (err: any) {
      if (err.code === 'EPIPE') return;
      throw err;
    }
  });

  test('Non-existent book', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const createApiKeyResponse = await createApiKey(userId, 'Test Key', ['Update'], undefined, { jwt: registerResponse.body.jwt_token });
    expect(createApiKeyResponse.status).toBe(200);

    try {
      const updateResponse = await updateCover('non-existent', 'Generic.jpeg', { apiKey: createApiKeyResponse.body.key });
      expect(updateResponse.status).toBe(404);
      expect(updateResponse.text).toBe(BOOK_NOT_FOUND);
    } catch (err: any) {
      if (err.code === 'EPIPE') return;
      throw err;
    }
  });

  test('Invalid cover', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const uploadResponse = await uploadBook(userId, 'Alices_Adventures_in_Wonderland.epub', { jwt: registerResponse.body.jwt_token });
    expect(uploadResponse.status).toBe(200);

    // Wait for cover to be extracted
    await wait(1);

    const createApiKeyResponse = await createApiKey(userId, 'Test Key', ['Update'], undefined, { jwt: registerResponse.body.jwt_token });
    expect(createApiKeyResponse.status).toBe(200);

    try {
      const updateResponse = await updateCover(uploadResponse.text, 'This_is_not_a_cover.txt', { apiKey: createApiKeyResponse.body.key });
      expect(updateResponse.status).toBe(400);
      expect(updateResponse.text).toBe(INVALID_COVER);
    } catch (err: any) {
      if (err.code === 'EPIPE') return;
      throw err;
    }
  });

  test('Different user without permission', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const uploadResponse = await uploadBook(userId, 'Alices_Adventures_in_Wonderland.epub', { jwt: registerResponse.body.jwt_token });
    expect(uploadResponse.status).toBe(200);

    // Wait for cover to be extracted
    await wait(1);

    const { response: registerResponse2 } = await registerUser();
    expect(registerResponse2.status).toBe(200);
    const userId2 = registerResponse2.body.user_id;

    const createApiKeyResponse = await createApiKey(userId2, 'Test Key', ['Update'], undefined, { jwt: registerResponse2.body.jwt_token });
    expect(createApiKeyResponse.status).toBe(200);

    try {
      const updateResponse = await updateCover(uploadResponse.text, 'Generic.jpeg', { apiKey: createApiKeyResponse.body.key });
      expect(updateResponse.status).toBe(404);
      expect(updateResponse.text).toBe(BOOK_NOT_FOUND);
    } catch (err: any) {
      if (err.code === 'EPIPE') return;
      throw err;
    }
  });

  test('Different user with permission', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const uploadResponse = await uploadBook(userId, 'Alices_Adventures_in_Wonderland.epub', { jwt: registerResponse.body.jwt_token });
    expect(uploadResponse.status).toBe(200);

    // Wait for cover to be extracted
    await wait(1);

    const { response: registerResponse2 } = await registerUser(undefined, undefined, process.env.ADMIN_KEY);
    expect(registerResponse2.status).toBe(200);
    const userId2 = registerResponse2.body.user_id;

    const createApiKeyResponse = await createApiKey(userId2, 'Test Key', ['Update'], undefined, { jwt: registerResponse2.body.jwt_token });
    expect(createApiKeyResponse.status).toBe(200);

    const updateResponse = await updateCover(uploadResponse.text, 'Generic.jpeg', { apiKey: createApiKeyResponse.body.key });
    expect(updateResponse.status).toBe(204);
  });

  test('Wrong capabilities', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const uploadResponse = await uploadBook(userId, 'Alices_Adventures_in_Wonderland.epub', { jwt: registerResponse.body.jwt_token });
    expect(uploadResponse.status).toBe(200);

    // Wait for cover to be extracted
    await wait(1);

    const createApiKeyResponse = await createApiKey(userId, 'Test Key', ['Create', 'Read', 'Delete'], undefined, { jwt: registerResponse.body.jwt_token });
    expect(createApiKeyResponse.status).toBe(200);

    try {
      const updateResponse = await updateCover(uploadResponse.text, 'Generic.jpeg', { apiKey: createApiKeyResponse.body.key });
      expect(updateResponse.status).toBe(403);
      expect(updateResponse.text).toBe(FORBIDDEN);
    } catch (err: any) {
      if (err.code === 'EPIPE') return;
      throw err;
    }
  });

  test('Expired key', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const uploadResponse = await uploadBook(userId, 'Alices_Adventures_in_Wonderland.epub', { jwt: registerResponse.body.jwt_token });
    expect(uploadResponse.status).toBe(200);

    // Wait for cover to be extracted
    await wait(1);

    const timestamp = Date.now() + 1000;
    const createApiKeyResponse = await createApiKey(userId, 'Test Key', ['Update'], timestamp, { jwt: registerResponse.body.jwt_token });
    expect(createApiKeyResponse.status).toBe(200);

    // Wait for the key to expire
    await wait(1.5);

    try {
      const updateResponse = await updateCover(uploadResponse.text, 'Generic.jpeg', { apiKey: createApiKeyResponse.body.key });
      expect(updateResponse.status).toBe(401);
      expect(updateResponse.text).toBe(INVALID_API_KEY);
    } catch (err: any) {
      if (err.code === 'EPIPE') return;
      throw err;
    }
  });
});
