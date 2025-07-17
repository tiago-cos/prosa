import fs from 'fs';
import path from 'path';
import { addAnnotation, ALICE_NOTE, getAnnotation } from '../utils/annotations';
import { BOOK_CONFLICT, BOOK_NOT_FOUND, deleteBook, downloadBook, getBookFileMetadata, INVALID_BOOK, INVALID_PAGINATION, searchBooks, uploadBook } from '../utils/books';
import { BOOK_DIR, FORBIDDEN, INVALID_API_KEY, UNAUTHORIZED, wait } from '../utils/common';
import { getCover } from '../utils/covers';
import { getMetadata } from '../utils/metadata';
import { createApiKey, registerUser, USER_NOT_FOUND } from '../utils/users';

describe('Upload book JWT', () => {
  test('Simple', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const uploadResponse = await uploadBook(userId, 'The_Great_Gatsby.epub', { jwt: registerResponse.body.jwt_token });
    expect(uploadResponse.status).toBe(200);

    const downloadResponse = await downloadBook(uploadResponse.text, { jwt: registerResponse.body.jwt_token });
    expect(downloadResponse.status).toBe(200);

    let epub = path.join(BOOK_DIR, 'The_Great_Gatsby.epub');
    let originalSize = fs.statSync(epub).size;
    let downloadedSize = downloadResponse.body.length;

    expect(downloadedSize).toBeGreaterThan(originalSize);
  });

  test('Repeated book', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const uploadResponse = await uploadBook(userId, 'The_Wonderful_Wizard_of_Oz.epub', { jwt: registerResponse.body.jwt_token });
    expect(uploadResponse.status).toBe(200);

    const uploadResponse2 = await uploadBook(userId, 'The_Wonderful_Wizard_of_Oz.epub', { jwt: registerResponse.body.jwt_token });
    expect(uploadResponse2.status).toBe(409);
    expect(uploadResponse2.text).toBe(BOOK_CONFLICT);

    const { response: registerResponse2 } = await registerUser();
    expect(registerResponse2.status).toBe(200);
    const userId2 = registerResponse2.body.user_id;

    // Books are only considered repeated in the same user's library
    const uploadResponse3 = await uploadBook(userId2, 'The_Wonderful_Wizard_of_Oz.epub', { jwt: registerResponse2.body.jwt_token });
    expect(uploadResponse3.status).toBe(200);
  });

  test('Invalid book', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const uploadResponse = await uploadBook(userId, 'This_is_not_an_epub.txt', { jwt: registerResponse.body.jwt_token });
    expect(uploadResponse.status).toBe(400);
    expect(uploadResponse.text).toBe(INVALID_BOOK);
  });

  test('Different user without permission', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);

    const { response: registerResponse2 } = await registerUser();
    expect(registerResponse2.status).toBe(200);
    const userId2 = registerResponse2.body.user_id;

    const uploadResponse = await uploadBook(userId2, 'The_Wonderful_Wizard_of_Oz.epub', { jwt: registerResponse.body.jwt_token });
    expect(uploadResponse.status).toBe(403);
    expect(uploadResponse.text).toBe(FORBIDDEN);
  });

  test('Different user with permission', async () => {
    const { response: registerResponse } = await registerUser(undefined, undefined, process.env.ADMIN_KEY);
    expect(registerResponse.status).toBe(200);

    const { response: registerResponse2 } = await registerUser();
    expect(registerResponse2.status).toBe(200);
    const userId2 = registerResponse2.body.user_id;

    const uploadResponse = await uploadBook(userId2, 'The_Wonderful_Wizard_of_Oz.epub', { jwt: registerResponse.body.jwt_token });
    expect(uploadResponse.status).toBe(200);
  });

  test('Non-existent user', async () => {
    const { response: registerResponse } = await registerUser(undefined, undefined, process.env.ADMIN_KEY);
    expect(registerResponse.status).toBe(200);

    const uploadResponse = await uploadBook('non-existent', 'The_Wonderful_Wizard_of_Oz.epub', { jwt: registerResponse.body.jwt_token });
    expect(uploadResponse.status).toBe(404);
    expect(uploadResponse.text).toBe(USER_NOT_FOUND);
  });

  test('No auth', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    try {
      const uploadResponse = await uploadBook(userId, 'The_Wonderful_Wizard_of_Oz.epub');
      expect(uploadResponse.status).toBe(401);
      expect(uploadResponse.text).toBe(UNAUTHORIZED);
    } catch (err: any) {
      if (err.code === 'EPIPE') return;
      throw err;
    }
  });
});

describe('Upload book api key', () => {
  test('Simple', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const createApiKeyResponse = await createApiKey(userId, 'Test Key', ['Create', 'Read'], undefined, { jwt: registerResponse.body.jwt_token });
    expect(createApiKeyResponse.status).toBe(200);

    const uploadResponse = await uploadBook(userId, 'The_Great_Gatsby.epub', { apiKey: createApiKeyResponse.body.key });
    expect(uploadResponse.status).toBe(200);

    const downloadResponse = await downloadBook(uploadResponse.text, { apiKey: createApiKeyResponse.body.key });
    expect(downloadResponse.status).toBe(200);

    let epub = path.join(BOOK_DIR, 'The_Great_Gatsby.epub');
    let originalSize = fs.statSync(epub).size;
    let downloadedSize = downloadResponse.body.length;

    expect(downloadedSize).toBeGreaterThan(originalSize);
  });

  test('Repeated book', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const createApiKeyResponse = await createApiKey(userId, 'Test Key', ['Create'], undefined, { jwt: registerResponse.body.jwt_token });
    expect(createApiKeyResponse.status).toBe(200);

    const uploadResponse = await uploadBook(userId, 'The_Wonderful_Wizard_of_Oz.epub', { apiKey: createApiKeyResponse.body.key });
    expect(uploadResponse.status).toBe(200);

    const uploadResponse2 = await uploadBook(userId, 'The_Wonderful_Wizard_of_Oz.epub', { apiKey: createApiKeyResponse.body.key });
    expect(uploadResponse2.status).toBe(409);
    expect(uploadResponse2.text).toBe(BOOK_CONFLICT);

    const { response: registerResponse2 } = await registerUser();
    expect(registerResponse2.status).toBe(200);
    const userId2 = registerResponse2.body.user_id;

    const createApiKeyResponse2 = await createApiKey(userId2, 'Test Key', ['Create'], undefined, { jwt: registerResponse2.body.jwt_token });
    expect(createApiKeyResponse2.status).toBe(200);

    // Books are only considered repeated in the same user's library
    const uploadResponse3 = await uploadBook(userId2, 'The_Wonderful_Wizard_of_Oz.epub', { apiKey: createApiKeyResponse2.body.key });
    expect(uploadResponse3.status).toBe(200);
  });

  test('Invalid book', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const createApiKeyResponse = await createApiKey(userId, 'Test Key', ['Create'], undefined, { jwt: registerResponse.body.jwt_token });
    expect(createApiKeyResponse.status).toBe(200);

    const uploadResponse = await uploadBook(userId, 'This_is_not_an_epub.txt', { apiKey: createApiKeyResponse.body.key });
    expect(uploadResponse.status).toBe(400);
    expect(uploadResponse.text).toBe(INVALID_BOOK);
  });

  test('Different user without permission', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const createApiKeyResponse = await createApiKey(userId, 'Test Key', ['Create'], undefined, { jwt: registerResponse.body.jwt_token });
    expect(createApiKeyResponse.status).toBe(200);

    const { response: registerResponse2 } = await registerUser();
    expect(registerResponse2.status).toBe(200);
    const userId2 = registerResponse2.body.user_id;

    const uploadResponse = await uploadBook(userId2, 'The_Wonderful_Wizard_of_Oz.epub', { apiKey: createApiKeyResponse.body.key });
    expect(uploadResponse.status).toBe(403);
    expect(uploadResponse.text).toBe(FORBIDDEN);
  });

  test('Different user with permission', async () => {
    const { response: registerResponse } = await registerUser(undefined, undefined, process.env.ADMIN_KEY);
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const createApiKeyResponse = await createApiKey(userId, 'Test Key', ['Create'], undefined, { jwt: registerResponse.body.jwt_token });
    expect(createApiKeyResponse.status).toBe(200);

    const { response: registerResponse2 } = await registerUser();
    expect(registerResponse2.status).toBe(200);
    const userId2 = registerResponse2.body.user_id;

    const uploadResponse = await uploadBook(userId2, 'The_Wonderful_Wizard_of_Oz.epub', { apiKey: createApiKeyResponse.body.key });
    expect(uploadResponse.status).toBe(200);
  });

  test('Non-existent user', async () => {
    const { response: registerResponse } = await registerUser(undefined, undefined, process.env.ADMIN_KEY);
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const createApiKeyResponse = await createApiKey(userId, 'Test Key', ['Create'], undefined, { jwt: registerResponse.body.jwt_token });
    expect(createApiKeyResponse.status).toBe(200);

    const uploadResponse = await uploadBook('ghost', 'The_Wonderful_Wizard_of_Oz.epub', { apiKey: createApiKeyResponse.body.key });
    expect(uploadResponse.status).toBe(404);
    expect(uploadResponse.text).toBe(USER_NOT_FOUND);
  });

  test('Wrong capabilities', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const createApiKeyResponse = await createApiKey(userId, 'Test Key', ['Create'], undefined, { jwt: registerResponse.body.jwt_token });
    expect(createApiKeyResponse.status).toBe(200);

    const createApiKeyResponse2 = await createApiKey(userId, 'Test Key', ['Read'], undefined, { jwt: registerResponse.body.jwt_token });
    expect(createApiKeyResponse2.status).toBe(200);

    const uploadResponse = await uploadBook(userId, 'The_Great_Gatsby.epub', { apiKey: createApiKeyResponse2.body.key });
    expect(uploadResponse.status).toBe(403);
    expect(uploadResponse.text).toBe(FORBIDDEN);

    const downloadResponse = await downloadBook(uploadResponse.text, { apiKey: createApiKeyResponse.body.key });
    expect(downloadResponse.status).toBe(403);
    expect(downloadResponse.text).toBe(FORBIDDEN);
  });

  test('Expired key', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const timestamp = Date.now() + 1000;
    const createApiKeyResponse = await createApiKey(userId, 'Test Key', ['Delete'], timestamp, { jwt: registerResponse.body.jwt_token });
    expect(createApiKeyResponse.status).toBe(200);

    // Wait for the key to expire
    await wait(1.5);

    const uploadResponse = await uploadBook(userId, 'The_Great_Gatsby.epub', { apiKey: createApiKeyResponse.body.key });
    expect(uploadResponse.status).toBe(401);
    expect(uploadResponse.text).toBe(INVALID_API_KEY);

    const downloadResponse = await downloadBook(uploadResponse.text, { apiKey: createApiKeyResponse.body.key });
    expect(downloadResponse.status).toBe(401);
    expect(downloadResponse.text).toBe(INVALID_API_KEY);
  });
});

describe('Download book JWT', () => {
  test('Non-existent book', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);

    const downloadResponse = await downloadBook('non-existent', { jwt: registerResponse.body.jwt_token });
    expect(downloadResponse.status).toBe(404);
    expect(downloadResponse.text).toBe(BOOK_NOT_FOUND);
  });

  test('Different user without permission', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const uploadResponse = await uploadBook(userId, 'Alices_Adventures_in_Wonderland.epub', { jwt: registerResponse.body.jwt_token });
    expect(uploadResponse.status).toBe(200);

    const { response: registerResponse2 } = await registerUser();
    expect(registerResponse2.status).toBe(200);

    const downloadResponse = await downloadBook(uploadResponse.text, { jwt: registerResponse2.body.jwt_token });
    expect(downloadResponse.status).toBe(404);
    expect(downloadResponse.text).toBe(BOOK_NOT_FOUND);
  });

  test('Different user with permission', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const uploadResponse = await uploadBook(userId, 'Alices_Adventures_in_Wonderland.epub', { jwt: registerResponse.body.jwt_token });
    expect(uploadResponse.status).toBe(200);

    const { response: registerResponse2 } = await registerUser(undefined, undefined, process.env.ADMIN_KEY);
    expect(registerResponse2.status).toBe(200);

    const downloadResponse = await downloadBook(uploadResponse.text, { jwt: registerResponse2.body.jwt_token });
    expect(downloadResponse.status).toBe(200);
  });

  test('No auth', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const uploadResponse = await uploadBook(userId, 'Alices_Adventures_in_Wonderland.epub', { jwt: registerResponse.body.jwt_token });
    expect(uploadResponse.status).toBe(200);

    const downloadResponse = await downloadBook(uploadResponse.text);
    expect(downloadResponse.status).toBe(401);
    expect(downloadResponse.text).toBe(UNAUTHORIZED);
  });
});

describe('Download book api key', () => {
  test('Non-existent book', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const createApiKeyResponse = await createApiKey(userId, 'Test Key', ['Read'], undefined, { jwt: registerResponse.body.jwt_token });
    expect(createApiKeyResponse.status).toBe(200);

    const downloadResponse = await downloadBook('non-existent', { apiKey: createApiKeyResponse.body.key });
    expect(downloadResponse.status).toBe(404);
    expect(downloadResponse.text).toBe(BOOK_NOT_FOUND);
  });

  test('Different user without permission', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const uploadResponse = await uploadBook(userId, 'Alices_Adventures_in_Wonderland.epub', { jwt: registerResponse.body.jwt_token });
    expect(uploadResponse.status).toBe(200);

    const { response: registerResponse2 } = await registerUser();
    expect(registerResponse2.status).toBe(200);
    const userId2 = registerResponse2.body.user_id;

    const createApiKeyResponse = await createApiKey(userId2, 'Test Key', ['Read'], undefined, { jwt: registerResponse2.body.jwt_token });
    expect(createApiKeyResponse.status).toBe(200);

    const downloadResponse = await downloadBook(uploadResponse.text, { apiKey: createApiKeyResponse.body.key });
    expect(downloadResponse.status).toBe(404);
    expect(downloadResponse.text).toBe(BOOK_NOT_FOUND);
  });

  test('Different user with permission', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const uploadResponse = await uploadBook(userId, 'Alices_Adventures_in_Wonderland.epub', { jwt: registerResponse.body.jwt_token });
    expect(uploadResponse.status).toBe(200);

    const { response: registerResponse2 } = await registerUser(undefined, undefined, process.env.ADMIN_KEY);
    expect(registerResponse2.status).toBe(200);
    const userId2 = registerResponse2.body.user_id;

    const createApiKeyResponse = await createApiKey(userId2, 'Test Key', ['Read'], undefined, { jwt: registerResponse2.body.jwt_token });
    expect(createApiKeyResponse.status).toBe(200);

    const downloadResponse = await downloadBook(uploadResponse.text, { apiKey: createApiKeyResponse.body.key });
    expect(downloadResponse.status).toBe(200);
  });

  test('Wrong capabilities', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const uploadResponse = await uploadBook(userId, 'Alices_Adventures_in_Wonderland.epub', { jwt: registerResponse.body.jwt_token });
    expect(uploadResponse.status).toBe(200);

    const createApiKeyResponse = await createApiKey(userId, 'Test Key', ['Create'], undefined, { jwt: registerResponse.body.jwt_token });
    expect(createApiKeyResponse.status).toBe(200);

    const downloadResponse = await downloadBook(uploadResponse.text, { apiKey: createApiKeyResponse.body.key });
    expect(downloadResponse.status).toBe(403);
    expect(downloadResponse.text).toBe(FORBIDDEN);
  });

  test('Expired key', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const uploadResponse = await uploadBook(userId, 'Alices_Adventures_in_Wonderland.epub', { jwt: registerResponse.body.jwt_token });
    expect(uploadResponse.status).toBe(200);

    const timestamp = Date.now() + 1000;
    const createApiKeyResponse = await createApiKey(userId, 'Test Key', ['Read'], timestamp, { jwt: registerResponse.body.jwt_token });
    expect(createApiKeyResponse.status).toBe(200);

    // Wait for the key to expire
    await wait(1.5);

    const downloadResponse = await downloadBook(uploadResponse.text, { apiKey: createApiKeyResponse.body.key });
    expect(downloadResponse.status).toBe(401);
    expect(downloadResponse.text).toBe(INVALID_API_KEY);
  });
});

describe('Delete book JWT', () => {
  test('Simple', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const uploadResponse = await uploadBook(userId, 'The_Great_Gatsby.epub', { jwt: registerResponse.body.jwt_token });
    expect(uploadResponse.status).toBe(200);

    const downloadResponse = await downloadBook(uploadResponse.text, { jwt: registerResponse.body.jwt_token });
    expect(downloadResponse.status).toBe(200);

    const deleteResponse = await deleteBook(uploadResponse.text, { jwt: registerResponse.body.jwt_token });
    expect(deleteResponse.status).toBe(204);

    const downloadResponse2 = await downloadBook(uploadResponse.text, { jwt: registerResponse.body.jwt_token });
    expect(downloadResponse2.status).toBe(404);
    expect(downloadResponse2.text).toBe(BOOK_NOT_FOUND);
  });

  test('Check metadata, cover and annotations', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const uploadResponse = await uploadBook(userId, 'Alices_Adventures_in_Wonderland.epub', { jwt: registerResponse.body.jwt_token });
    expect(uploadResponse.status).toBe(200);

    const downloadResponse = await downloadBook(uploadResponse.text, { jwt: registerResponse.body.jwt_token });
    expect(downloadResponse.status).toBe(200);

    const addAnnotationResponse = await addAnnotation(uploadResponse.text, ALICE_NOTE, { jwt: registerResponse.body.jwt_token });
    expect(addAnnotationResponse.status).toBe(200);

    // Wait for metadata and cover to be extracted
    await wait(0.5);

    const metadataResponse = await getMetadata(uploadResponse.text, { jwt: registerResponse.body.jwt_token });
    expect(metadataResponse.status).toBe(200);

    const coverResponse = await getCover(uploadResponse.text, { jwt: registerResponse.body.jwt_token });
    expect(coverResponse.status).toBe(200);

    const annotationResponse = await getAnnotation(uploadResponse.text, addAnnotationResponse.text, { jwt: registerResponse.body.jwt_token });
    expect(annotationResponse.status).toBe(200);

    const deleteResponse = await deleteBook(uploadResponse.text, { jwt: registerResponse.body.jwt_token });
    expect(deleteResponse.status).toBe(204);

    const downloadResponse2 = await downloadBook(uploadResponse.text, { jwt: registerResponse.body.jwt_token });
    expect(downloadResponse2.status).toBe(404);
    expect(downloadResponse2.text).toBe(BOOK_NOT_FOUND);

    const metadataResponse2 = await getMetadata(uploadResponse.text, { jwt: registerResponse.body.jwt_token });
    expect(metadataResponse2.status).toBe(404);
    expect(downloadResponse2.text).toBe(BOOK_NOT_FOUND);

    const coverResponse2 = await getCover(uploadResponse.text, { jwt: registerResponse.body.jwt_token });
    expect(coverResponse2.status).toBe(404);
    expect(downloadResponse2.text).toBe(BOOK_NOT_FOUND);

    const annotationResponse2 = await getAnnotation(uploadResponse.text, addAnnotationResponse.text, { jwt: registerResponse.body.jwt_token });
    expect(annotationResponse2.status).toBe(404);
    expect(annotationResponse2.text).toBe(BOOK_NOT_FOUND);
  });

  test('Non-existent book', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);

    const deleteResponse = await deleteBook('non-existent', { jwt: registerResponse.body.jwt_token });
    expect(deleteResponse.status).toBe(404);
    expect(deleteResponse.text).toBe(BOOK_NOT_FOUND);
  });

  test('Different user without permission', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const uploadResponse = await uploadBook(userId, 'Alices_Adventures_in_Wonderland.epub', { jwt: registerResponse.body.jwt_token });
    expect(uploadResponse.status).toBe(200);

    const { response: registerResponse2 } = await registerUser();
    expect(registerResponse2.status).toBe(200);

    const deleteResponse = await deleteBook(uploadResponse.text, { jwt: registerResponse2.body.jwt_token });
    expect(deleteResponse.status).toBe(404);
    expect(deleteResponse.text).toBe(BOOK_NOT_FOUND);
  });

  test('Different user with permission', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const uploadResponse = await uploadBook(userId, 'Alices_Adventures_in_Wonderland.epub', { jwt: registerResponse.body.jwt_token });
    expect(uploadResponse.status).toBe(200);

    const { response: registerResponse2 } = await registerUser(undefined, undefined, process.env.ADMIN_KEY);
    expect(registerResponse2.status).toBe(200);

    const deleteResponse = await deleteBook(uploadResponse.text, { jwt: registerResponse2.body.jwt_token });
    expect(deleteResponse.status).toBe(204);

    const downloadResponse = await downloadBook(uploadResponse.text, { jwt: registerResponse.body.jwt_token });
    expect(downloadResponse.status).toBe(404);
    expect(downloadResponse.text).toBe(BOOK_NOT_FOUND);
  });

  test('No auth', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const uploadResponse = await uploadBook(userId, 'Alices_Adventures_in_Wonderland.epub', { jwt: registerResponse.body.jwt_token });
    expect(uploadResponse.status).toBe(200);

    const downloadResponse = await deleteBook(uploadResponse.text);
    expect(downloadResponse.status).toBe(401);
    expect(downloadResponse.text).toBe(UNAUTHORIZED);
  });
});

describe('Delete book api key', () => {
  test('Simple', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const uploadResponse = await uploadBook(userId, 'The_Great_Gatsby.epub', { jwt: registerResponse.body.jwt_token });
    expect(uploadResponse.status).toBe(200);

    const downloadResponse = await downloadBook(uploadResponse.text, { jwt: registerResponse.body.jwt_token });
    expect(downloadResponse.status).toBe(200);

    const createApiKeyResponse = await createApiKey(userId, 'Test Key', ['Delete'], undefined, { jwt: registerResponse.body.jwt_token });
    expect(createApiKeyResponse.status).toBe(200);

    const deleteResponse = await deleteBook(uploadResponse.text, { apiKey: createApiKeyResponse.body.key });
    expect(deleteResponse.status).toBe(204);

    const downloadResponse2 = await downloadBook(uploadResponse.text, { jwt: registerResponse.body.jwt_token });
    expect(downloadResponse2.status).toBe(404);
    expect(downloadResponse2.text).toBe(BOOK_NOT_FOUND);
  });

  test('Non-existent book', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const createApiKeyResponse = await createApiKey(userId, 'Test Key', ['Delete'], undefined, { jwt: registerResponse.body.jwt_token });
    expect(createApiKeyResponse.status).toBe(200);

    const deleteResponse = await deleteBook('non-existent', { apiKey: createApiKeyResponse.body.key });
    expect(deleteResponse.status).toBe(404);
    expect(deleteResponse.text).toBe(BOOK_NOT_FOUND);
  });

  test('Different user without permission', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const uploadResponse = await uploadBook(userId, 'Alices_Adventures_in_Wonderland.epub', { jwt: registerResponse.body.jwt_token });
    expect(uploadResponse.status).toBe(200);

    const { response: registerResponse2 } = await registerUser();
    expect(registerResponse2.status).toBe(200);
    const userId2 = registerResponse2.body.user_id;

    const createApiKeyResponse = await createApiKey(userId2, 'Test Key', ['Delete'], undefined, { jwt: registerResponse2.body.jwt_token });
    expect(createApiKeyResponse.status).toBe(200);

    const deleteResponse = await deleteBook(uploadResponse.text, { apiKey: createApiKeyResponse.body.key });
    expect(deleteResponse.status).toBe(404);
    expect(deleteResponse.text).toBe(BOOK_NOT_FOUND);
  });

  test('Different user with permission', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const uploadResponse = await uploadBook(userId, 'Alices_Adventures_in_Wonderland.epub', { jwt: registerResponse.body.jwt_token });
    expect(uploadResponse.status).toBe(200);

    const { response: registerResponse2 } = await registerUser(undefined, undefined, process.env.ADMIN_KEY);
    expect(registerResponse2.status).toBe(200);
    const userId2 = registerResponse2.body.user_id;

    const createApiKeyResponse = await createApiKey(userId2, 'Test Key', ['Delete'], undefined, { jwt: registerResponse2.body.jwt_token });
    expect(createApiKeyResponse.status).toBe(200);

    const deleteResponse = await deleteBook(uploadResponse.text, { apiKey: createApiKeyResponse.body.key });
    expect(deleteResponse.status).toBe(204);

    const downloadResponse = await downloadBook(uploadResponse.text, { jwt: registerResponse.body.jwt_token });
    expect(downloadResponse.status).toBe(404);
    expect(downloadResponse.text).toBe(BOOK_NOT_FOUND);
  });

  test('Wrong capabilities', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const uploadResponse = await uploadBook(userId, 'Alices_Adventures_in_Wonderland.epub', { jwt: registerResponse.body.jwt_token });
    expect(uploadResponse.status).toBe(200);

    const createApiKeyResponse = await createApiKey(userId, 'Test Key', ['Read', 'Create', 'Update'], undefined, { jwt: registerResponse.body.jwt_token });
    expect(createApiKeyResponse.status).toBe(200);

    const downloadResponse = await deleteBook(uploadResponse.text, { apiKey: createApiKeyResponse.body.key });
    expect(downloadResponse.status).toBe(403);
    expect(downloadResponse.text).toBe(FORBIDDEN);
  });

  test('Expired key', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const uploadResponse = await uploadBook(userId, 'Alices_Adventures_in_Wonderland.epub', { jwt: registerResponse.body.jwt_token });
    expect(uploadResponse.status).toBe(200);

    const timestamp = Date.now() + 1000;
    const createApiKeyResponse = await createApiKey(userId, 'Test Key', ['Delete'], timestamp, { jwt: registerResponse.body.jwt_token });
    expect(createApiKeyResponse.status).toBe(200);

    // Wait for the key to expire
    await wait(1.5);

    const downloadResponse = await deleteBook(uploadResponse.text, { apiKey: createApiKeyResponse.body.key });
    expect(downloadResponse.status).toBe(401);
    expect(downloadResponse.text).toBe(INVALID_API_KEY);
  });
});

describe('Search books JWT', () => {
  test('Simple', async () => {
    const { response: registerResponse, username } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const uploadResponse = await uploadBook(userId, 'The_Great_Gatsby.epub', { jwt: registerResponse.body.jwt_token });
    expect(uploadResponse.status).toBe(200);

    const searchResponse = await searchBooks(username, undefined, undefined, undefined, undefined, { jwt: registerResponse.body.jwt_token });
    expect(searchResponse.status).toBe(200);

    const expectedResponse = {
      book_ids: [uploadResponse.text],
      page_size: 10,
      total_elements: 1,
      total_pages: 1,
      current_page: 1
    };

    expect(searchResponse.body).toEqual(expectedResponse);
  });

  test('Search title and author', async () => {
    const { response: registerResponse, username } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const uploadResponse = await uploadBook(userId, 'The_Wonderful_Wizard_of_Oz.epub', { jwt: registerResponse.body.jwt_token });
    expect(uploadResponse.status).toBe(200);

    const uploadResponse2 = await uploadBook(userId, 'Alices_Adventures_in_Wonderland.epub', { jwt: registerResponse.body.jwt_token });
    expect(uploadResponse2.status).toBe(200);

    // Wait for metadata to be extracted
    await wait(1);

    const searchResponse = await searchBooks(username, undefined, undefined, undefined, undefined, { jwt: registerResponse.body.jwt_token });
    expect(searchResponse.status).toBe(200);

    expect(searchResponse.body.book_ids).toContain(uploadResponse.text);
    expect(searchResponse.body.book_ids).toContain(uploadResponse2.text);

    const searchResponse2 = await searchBooks(username, 'WIZ', undefined, undefined, undefined, { jwt: registerResponse.body.jwt_token });
    expect(searchResponse2.status).toBe(200);

    expect(searchResponse2.body.book_ids).toEqual([uploadResponse.text]);

    const searchResponse3 = await searchBooks(username, undefined, 'CARR', undefined, undefined, { jwt: registerResponse.body.jwt_token });
    expect(searchResponse3.status).toBe(200);

    expect(searchResponse3.body.book_ids).toEqual([uploadResponse2.text]);
  });

  test('Pagination', async () => {
    const { response: registerResponse, username } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const uploadResponse = await uploadBook(userId, 'The_Wonderful_Wizard_of_Oz.epub', { jwt: registerResponse.body.jwt_token });
    expect(uploadResponse.status).toBe(200);

    const uploadResponse2 = await uploadBook(userId, 'Alices_Adventures_in_Wonderland.epub', { jwt: registerResponse.body.jwt_token });
    expect(uploadResponse2.status).toBe(200);

    const searchResponse = await searchBooks(username, undefined, undefined, undefined, undefined, { jwt: registerResponse.body.jwt_token });
    expect(searchResponse.status).toBe(200);

    expect(searchResponse.body.book_ids).toContain(uploadResponse.text);
    expect(searchResponse.body.book_ids).toContain(uploadResponse2.text);

    let expectedResponse = {
      book_ids: [uploadResponse.text < uploadResponse2.text ? uploadResponse.text : uploadResponse2.text],
      page_size: 1,
      total_elements: 2,
      total_pages: 2,
      current_page: 1
    };

    const searchResponse2 = await searchBooks(username, undefined, undefined, 1, 1, { jwt: registerResponse.body.jwt_token });
    expect(searchResponse2.status).toBe(200);

    expect(searchResponse2.body).toEqual(expectedResponse);

    expectedResponse = {
      book_ids: [uploadResponse.text < uploadResponse2.text ? uploadResponse2.text : uploadResponse.text],
      page_size: 1,
      total_elements: 2,
      total_pages: 2,
      current_page: 2
    };

    const searchResponse3 = await searchBooks(username, undefined, undefined, 2, 1, { jwt: registerResponse.body.jwt_token });
    expect(searchResponse3.status).toBe(200);

    expect(searchResponse3.body).toEqual(expectedResponse);
  });

  test('No metadata', async () => {
    const { response: registerResponse, username } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const uploadResponse = await uploadBook(userId, 'The_Great_Gatsby.epub', { jwt: registerResponse.body.jwt_token });
    expect(uploadResponse.status).toBe(200);

    let searchResponse = await searchBooks(username, undefined, undefined, undefined, undefined, { jwt: registerResponse.body.jwt_token });
    expect(searchResponse.status).toBe(200);
    expect(searchResponse.body.book_ids).toEqual([uploadResponse.text]);

    searchResponse = await searchBooks(username, 'the', undefined, undefined, undefined, { jwt: registerResponse.body.jwt_token });
    expect(searchResponse.status).toBe(200);
    expect(searchResponse.body.book_ids).toEqual([]);
  });

  test('Different users', async () => {
    const { response: registerResponse, username } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const { response: registerResponse2, username: username2 } = await registerUser();
    expect(registerResponse2.status).toBe(200);
    const userId2 = registerResponse2.body.user_id;

    const uploadResponse = await uploadBook(userId, 'The_Great_Gatsby.epub', { jwt: registerResponse.body.jwt_token });
    expect(uploadResponse.status).toBe(200);

    const uploadResponse2 = await uploadBook(userId2, 'The_Great_Gatsby.epub', { jwt: registerResponse2.body.jwt_token });
    expect(uploadResponse2.status).toBe(200);

    let searchResponse = await searchBooks(username, undefined, undefined, undefined, undefined, { jwt: registerResponse.body.jwt_token });
    expect(searchResponse.status).toBe(200);
    expect(searchResponse.body.book_ids).toEqual([uploadResponse.text]);

    searchResponse = await searchBooks(username2, undefined, undefined, undefined, undefined, { jwt: registerResponse2.body.jwt_token });
    expect(searchResponse.status).toBe(200);
    expect(searchResponse.body.book_ids).toEqual([uploadResponse2.text]);
  });

  test('Invalid pagination', async () => {
    const { response: registerResponse, username } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const uploadResponse = await uploadBook(userId, 'The_Great_Gatsby.epub', { jwt: registerResponse.body.jwt_token });
    expect(uploadResponse.status).toBe(200);

    let searchResponse = await searchBooks(username, undefined, undefined, -1, undefined, { jwt: registerResponse.body.jwt_token });
    expect(searchResponse.status).toBe(400);
    expect(searchResponse.text).toBe(INVALID_PAGINATION);

    searchResponse = await searchBooks(username, undefined, undefined, undefined, -1, { jwt: registerResponse.body.jwt_token });
    expect(searchResponse.status).toBe(400);
    expect(searchResponse.text).toBe(INVALID_PAGINATION);

    searchResponse = await searchBooks(username, undefined, undefined, 'invalid', undefined, { jwt: registerResponse.body.jwt_token });
    expect(searchResponse.status).toBe(400);
    expect(searchResponse.text).toBe(INVALID_PAGINATION);

    searchResponse = await searchBooks(username, undefined, undefined, undefined, 'invalid', { jwt: registerResponse.body.jwt_token });
    expect(searchResponse.status).toBe(400);
    expect(searchResponse.text).toBe(INVALID_PAGINATION);
  });

  test('Non-existent user', async () => {
    const { response: registerResponse } = await registerUser(undefined, undefined, process.env.ADMIN_KEY);
    expect(registerResponse.status).toBe(200);

    let searchResponse = await searchBooks('non-existent', undefined, undefined, undefined, undefined, { jwt: registerResponse.body.jwt_token });
    expect(searchResponse.status).toBe(404);
    expect(searchResponse.text).toBe(USER_NOT_FOUND);
  });

  test('Different user without permission', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);

    const { response: registerResponse2, username: username2 } = await registerUser();
    expect(registerResponse2.status).toBe(200);

    let searchResponse = await searchBooks(username2, undefined, undefined, undefined, undefined, { jwt: registerResponse.body.jwt_token });
    expect(searchResponse.status).toBe(403);
    expect(searchResponse.text).toBe(FORBIDDEN);
  });

  test('Different user with permission', async () => {
    const { response: registerResponse } = await registerUser(undefined, undefined, process.env.ADMIN_KEY);
    expect(registerResponse.status).toBe(200);

    const { response: registerResponse2, username: username2 } = await registerUser();
    expect(registerResponse2.status).toBe(200);

    let searchResponse = await searchBooks(username2, undefined, undefined, undefined, undefined, { jwt: registerResponse.body.jwt_token });
    expect(searchResponse.status).toBe(200);
    expect(searchResponse.body.book_ids).toEqual([]);
  });

  test('All books without permission', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);

    let searchResponse = await searchBooks(undefined, undefined, undefined, undefined, undefined, { jwt: registerResponse.body.jwt_token });
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

    const uploadResponse = await uploadBook(userId, 'The_Great_Gatsby.epub', { jwt: registerResponse.body.jwt_token });
    expect(uploadResponse.status).toBe(200);

    const uploadResponse2 = await uploadBook(userId2, 'The_Great_Gatsby.epub', { jwt: registerResponse2.body.jwt_token });
    expect(uploadResponse2.status).toBe(200);

    let searchResponse = await searchBooks(undefined, undefined, undefined, undefined, 1000, { jwt: registerResponse.body.jwt_token });
    expect(searchResponse.status).toBe(200);

    expect(searchResponse.body.book_ids).toContain(uploadResponse.text);
    expect(searchResponse.body.book_ids).toContain(uploadResponse2.text);
  });

  test('No auth', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const uploadResponse = await uploadBook(userId, 'The_Great_Gatsby.epub', { jwt: registerResponse.body.jwt_token });
    expect(uploadResponse.status).toBe(200);

    const searchResponse = await searchBooks(userId);
    expect(searchResponse.status).toBe(401);
    expect(searchResponse.text).toEqual(UNAUTHORIZED);
  });
});

describe('Search books api key', () => {
  test('Simple', async () => {
    const { response: registerResponse, username } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const uploadResponse = await uploadBook(userId, 'The_Great_Gatsby.epub', { jwt: registerResponse.body.jwt_token });
    expect(uploadResponse.status).toBe(200);

    const createApiKeyResponse = await createApiKey(userId, 'Test Key', ['Read'], undefined, { jwt: registerResponse.body.jwt_token });
    expect(createApiKeyResponse.status).toBe(200);

    const searchResponse = await searchBooks(username, undefined, undefined, undefined, undefined, { apiKey: createApiKeyResponse.body.key });
    expect(searchResponse.status).toBe(200);

    const expectedResponse = {
      book_ids: [uploadResponse.text],
      page_size: 10,
      total_elements: 1,
      total_pages: 1,
      current_page: 1
    };

    expect(searchResponse.body).toEqual(expectedResponse);
  });

  test('Search title and author', async () => {
    const { response: registerResponse, username } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const uploadResponse = await uploadBook(userId, 'The_Wonderful_Wizard_of_Oz.epub', { jwt: registerResponse.body.jwt_token });
    expect(uploadResponse.status).toBe(200);

    const uploadResponse2 = await uploadBook(userId, 'Alices_Adventures_in_Wonderland.epub', { jwt: registerResponse.body.jwt_token });
    expect(uploadResponse2.status).toBe(200);

    // Wait for metadata to be extracted
    await wait(1);

    const createApiKeyResponse = await createApiKey(userId, 'Test Key', ['Read'], undefined, { jwt: registerResponse.body.jwt_token });
    expect(createApiKeyResponse.status).toBe(200);

    const searchResponse = await searchBooks(username, undefined, undefined, undefined, undefined, { apiKey: createApiKeyResponse.body.key });
    expect(searchResponse.status).toBe(200);

    expect(searchResponse.body.book_ids).toContain(uploadResponse.text);
    expect(searchResponse.body.book_ids).toContain(uploadResponse2.text);

    const searchResponse2 = await searchBooks(username, 'WIZ', undefined, undefined, undefined, { apiKey: createApiKeyResponse.body.key });
    expect(searchResponse2.status).toBe(200);

    expect(searchResponse2.body.book_ids).toEqual([uploadResponse.text]);

    const searchResponse3 = await searchBooks(username, undefined, 'CARR', undefined, undefined, { apiKey: createApiKeyResponse.body.key });
    expect(searchResponse3.status).toBe(200);

    expect(searchResponse3.body.book_ids).toEqual([uploadResponse2.text]);
  });

  test('Pagination', async () => {
    const { response: registerResponse, username } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const uploadResponse = await uploadBook(userId, 'The_Wonderful_Wizard_of_Oz.epub', { jwt: registerResponse.body.jwt_token });
    expect(uploadResponse.status).toBe(200);

    const uploadResponse2 = await uploadBook(userId, 'Alices_Adventures_in_Wonderland.epub', { jwt: registerResponse.body.jwt_token });
    expect(uploadResponse2.status).toBe(200);

    const createApiKeyResponse = await createApiKey(userId, 'Test Key', ['Read'], undefined, { jwt: registerResponse.body.jwt_token });
    expect(createApiKeyResponse.status).toBe(200);

    const searchResponse = await searchBooks(username, undefined, undefined, undefined, undefined, { apiKey: createApiKeyResponse.body.key });
    expect(searchResponse.status).toBe(200);

    expect(searchResponse.body.book_ids).toContain(uploadResponse.text);
    expect(searchResponse.body.book_ids).toContain(uploadResponse2.text);

    let expectedResponse = {
      book_ids: [uploadResponse.text < uploadResponse2.text ? uploadResponse.text : uploadResponse2.text],
      page_size: 1,
      total_elements: 2,
      total_pages: 2,
      current_page: 1
    };

    const searchResponse2 = await searchBooks(username, undefined, undefined, 1, 1, { apiKey: createApiKeyResponse.body.key });
    expect(searchResponse2.status).toBe(200);

    expect(searchResponse2.body).toEqual(expectedResponse);

    expectedResponse = {
      book_ids: [uploadResponse.text < uploadResponse2.text ? uploadResponse2.text : uploadResponse.text],
      page_size: 1,
      total_elements: 2,
      total_pages: 2,
      current_page: 2
    };

    const searchResponse3 = await searchBooks(username, undefined, undefined, 2, 1, { apiKey: createApiKeyResponse.body.key });
    expect(searchResponse3.status).toBe(200);

    expect(searchResponse3.body).toEqual(expectedResponse);
  });

  test('No metadata', async () => {
    const { response: registerResponse, username } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const uploadResponse = await uploadBook(userId, 'The_Great_Gatsby.epub', { jwt: registerResponse.body.jwt_token });
    expect(uploadResponse.status).toBe(200);

    const createApiKeyResponse = await createApiKey(userId, 'Test Key', ['Read'], undefined, { jwt: registerResponse.body.jwt_token });
    expect(createApiKeyResponse.status).toBe(200);

    let searchResponse = await searchBooks(username, undefined, undefined, undefined, undefined, { apiKey: createApiKeyResponse.body.key });
    expect(searchResponse.status).toBe(200);
    expect(searchResponse.body.book_ids).toEqual([uploadResponse.text]);

    searchResponse = await searchBooks(username, 'the', undefined, undefined, undefined, { apiKey: createApiKeyResponse.body.key });
    expect(searchResponse.status).toBe(200);
    expect(searchResponse.body.book_ids).toEqual([]);
  });

  test('Different users', async () => {
    const { response: registerResponse, username } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const { response: registerResponse2, username: username2 } = await registerUser();
    expect(registerResponse2.status).toBe(200);
    const userId2 = registerResponse2.body.user_id;

    const uploadResponse = await uploadBook(userId, 'The_Great_Gatsby.epub', { jwt: registerResponse.body.jwt_token });
    expect(uploadResponse.status).toBe(200);

    const uploadResponse2 = await uploadBook(userId2, 'The_Great_Gatsby.epub', { jwt: registerResponse2.body.jwt_token });
    expect(uploadResponse2.status).toBe(200);

    let createApiKeyResponse = await createApiKey(userId, 'Test Key', ['Read'], undefined, { jwt: registerResponse.body.jwt_token });
    expect(createApiKeyResponse.status).toBe(200);

    let searchResponse = await searchBooks(username, undefined, undefined, undefined, undefined, { apiKey: createApiKeyResponse.body.key });
    expect(searchResponse.status).toBe(200);
    expect(searchResponse.body.book_ids).toEqual([uploadResponse.text]);

    createApiKeyResponse = await createApiKey(userId2, 'Test Key', ['Read'], undefined, { jwt: registerResponse2.body.jwt_token });
    expect(createApiKeyResponse.status).toBe(200);

    searchResponse = await searchBooks(username2, undefined, undefined, undefined, undefined, { apiKey: createApiKeyResponse.body.key });
    expect(searchResponse.status).toBe(200);
    expect(searchResponse.body.book_ids).toEqual([uploadResponse2.text]);
  });

  test('Invalid pagination', async () => {
    const { response: registerResponse, username } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const uploadResponse = await uploadBook(userId, 'The_Great_Gatsby.epub', { jwt: registerResponse.body.jwt_token });
    expect(uploadResponse.status).toBe(200);

    const createApiKeyResponse = await createApiKey(userId, 'Test Key', ['Read'], undefined, { jwt: registerResponse.body.jwt_token });
    expect(createApiKeyResponse.status).toBe(200);

    let searchResponse = await searchBooks(username, undefined, undefined, -1, undefined, { apiKey: createApiKeyResponse.body.key });
    expect(searchResponse.status).toBe(400);
    expect(searchResponse.text).toBe(INVALID_PAGINATION);

    searchResponse = await searchBooks(username, undefined, undefined, undefined, -1, { apiKey: createApiKeyResponse.body.key });
    expect(searchResponse.status).toBe(400);
    expect(searchResponse.text).toBe(INVALID_PAGINATION);

    searchResponse = await searchBooks(username, undefined, undefined, 'invalid', undefined, { apiKey: createApiKeyResponse.body.key });
    expect(searchResponse.status).toBe(400);
    expect(searchResponse.text).toBe(INVALID_PAGINATION);

    searchResponse = await searchBooks(username, undefined, undefined, undefined, 'invalid', { apiKey: createApiKeyResponse.body.key });
    expect(searchResponse.status).toBe(400);
    expect(searchResponse.text).toBe(INVALID_PAGINATION);
  });

  test('Non-existent user', async () => {
    const { response: registerResponse } = await registerUser(undefined, undefined, process.env.ADMIN_KEY);
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const createApiKeyResponse = await createApiKey(userId, 'Test Key', ['Read'], undefined, { jwt: registerResponse.body.jwt_token });
    expect(createApiKeyResponse.status).toBe(200);

    let searchResponse = await searchBooks('non-existent', undefined, undefined, undefined, undefined, { apiKey: createApiKeyResponse.body.key });
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

    let searchResponse = await searchBooks(username2, undefined, undefined, undefined, undefined, { apiKey: createApiKeyResponse.body.key });
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

    let searchResponse = await searchBooks(username2, undefined, undefined, undefined, undefined, { apiKey: createApiKeyResponse.body.key });
    expect(searchResponse.status).toBe(200);
    expect(searchResponse.body.book_ids).toEqual([]);
  });

  test('All books without permission', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const createApiKeyResponse = await createApiKey(userId, 'Test Key', ['Read'], undefined, { jwt: registerResponse.body.jwt_token });
    expect(createApiKeyResponse.status).toBe(200);

    let searchResponse = await searchBooks(undefined, undefined, undefined, undefined, undefined, { apiKey: createApiKeyResponse.body.key });
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

    const uploadResponse = await uploadBook(userId, 'The_Great_Gatsby.epub', { jwt: registerResponse.body.jwt_token });
    expect(uploadResponse.status).toBe(200);

    const uploadResponse2 = await uploadBook(userId2, 'The_Great_Gatsby.epub', { jwt: registerResponse2.body.jwt_token });
    expect(uploadResponse2.status).toBe(200);

    const createApiKeyResponse = await createApiKey(userId, 'Test Key', ['Read'], undefined, { jwt: registerResponse.body.jwt_token });
    expect(createApiKeyResponse.status).toBe(200);

    let searchResponse = await searchBooks(undefined, undefined, undefined, undefined, 1000, { apiKey: createApiKeyResponse.body.key });
    expect(searchResponse.status).toBe(200);

    expect(searchResponse.body.book_ids).toContain(uploadResponse.text);
    expect(searchResponse.body.book_ids).toContain(uploadResponse2.text);
  });

  test('Wrong capabilities', async () => {
    const { response: registerResponse, username } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const uploadResponse = await uploadBook(userId, 'The_Great_Gatsby.epub', { jwt: registerResponse.body.jwt_token });
    expect(uploadResponse.status).toBe(200);

    const createApiKeyResponse = await createApiKey(userId, 'Test Key', ['Create', 'Update', 'Delete'], undefined, { jwt: registerResponse.body.jwt_token });
    expect(createApiKeyResponse.status).toBe(200);

    const searchResponse = await searchBooks(username, undefined, undefined, undefined, undefined, { apiKey: createApiKeyResponse.body.key });
    expect(searchResponse.status).toBe(403);
    expect(searchResponse.text).toEqual(FORBIDDEN);
  });

  test('Expired key', async () => {
    const { response: registerResponse, username } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const uploadResponse = await uploadBook(userId, 'The_Great_Gatsby.epub', { jwt: registerResponse.body.jwt_token });
    expect(uploadResponse.status).toBe(200);

    const timestamp = Date.now() + 1000;
    const createApiKeyResponse = await createApiKey(userId, 'Test Key', ['Read'], timestamp, { jwt: registerResponse.body.jwt_token });
    expect(createApiKeyResponse.status).toBe(200);

    // Wait for the key to expire
    await wait(1.5);

    const searchResponse = await searchBooks(username, undefined, undefined, undefined, undefined, { apiKey: createApiKeyResponse.body.key });
    expect(searchResponse.status).toBe(401);
    expect(searchResponse.text).toEqual(INVALID_API_KEY);
  });
});

describe('Get book file metadata JWT', () => {
  test('Simple', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const uploadResponse = await uploadBook(userId, 'The_Great_Gatsby.epub', { jwt: registerResponse.body.jwt_token });
    expect(uploadResponse.status).toBe(200);

    const sizeResponse = await getBookFileMetadata(uploadResponse.text, { jwt: registerResponse.body.jwt_token });
    expect(sizeResponse.status).toBe(200);

    expect(sizeResponse.body.file_size).toBe(145298);
    expect(sizeResponse.body.owner_id).toBe(userId);
  });

  test('Non-existent book', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);

    const sizeResponse = await getBookFileMetadata('non-existent', { jwt: registerResponse.body.jwt_token });
    expect(sizeResponse.status).toBe(404);
    expect(sizeResponse.text).toBe(BOOK_NOT_FOUND);
  });

  test('Different user without permission', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const uploadResponse = await uploadBook(userId, 'Alices_Adventures_in_Wonderland.epub', { jwt: registerResponse.body.jwt_token });
    expect(uploadResponse.status).toBe(200);

    const { response: registerResponse2 } = await registerUser();
    expect(registerResponse2.status).toBe(200);

    const sizeResponse = await getBookFileMetadata(uploadResponse.text, { jwt: registerResponse2.body.jwt_token });
    expect(sizeResponse.status).toBe(404);
    expect(sizeResponse.text).toBe(BOOK_NOT_FOUND);
  });

  test('Different user with permission', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const uploadResponse = await uploadBook(userId, 'Alices_Adventures_in_Wonderland.epub', { jwt: registerResponse.body.jwt_token });
    expect(uploadResponse.status).toBe(200);

    const { response: registerResponse2 } = await registerUser(undefined, undefined, process.env.ADMIN_KEY);
    expect(registerResponse2.status).toBe(200);

    const sizeResponse = await getBookFileMetadata(uploadResponse.text, { jwt: registerResponse2.body.jwt_token });
    expect(sizeResponse.status).toBe(200);
  });

  test('No auth', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const uploadResponse = await uploadBook(userId, 'Alices_Adventures_in_Wonderland.epub', { jwt: registerResponse.body.jwt_token });
    expect(uploadResponse.status).toBe(200);

    const sizeResponse = await getBookFileMetadata(uploadResponse.text);
    expect(sizeResponse.status).toBe(401);
    expect(sizeResponse.text).toBe(UNAUTHORIZED);
  });
});

describe('Get book file metadata api key', () => {
  test('Simple', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const uploadResponse = await uploadBook(userId, 'The_Great_Gatsby.epub', { jwt: registerResponse.body.jwt_token });
    expect(uploadResponse.status).toBe(200);

    const createApiKeyResponse = await createApiKey(userId, 'Test Key', ['Read'], undefined, { jwt: registerResponse.body.jwt_token });
    expect(createApiKeyResponse.status).toBe(200);

    const sizeResponse = await getBookFileMetadata(uploadResponse.text, { apiKey: createApiKeyResponse.body.key });
    expect(sizeResponse.status).toBe(200);

    expect(sizeResponse.body.file_size).toBe(145298);
  });

  test('Non-existent book', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const createApiKeyResponse = await createApiKey(userId, 'Test Key', ['Read'], undefined, { jwt: registerResponse.body.jwt_token });
    expect(createApiKeyResponse.status).toBe(200);

    const sizeResponse = await getBookFileMetadata('non-existent', { apiKey: createApiKeyResponse.body.key });
    expect(sizeResponse.status).toBe(404);
    expect(sizeResponse.text).toBe(BOOK_NOT_FOUND);
  });

  test('Different user without permission', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const uploadResponse = await uploadBook(userId, 'Alices_Adventures_in_Wonderland.epub', { jwt: registerResponse.body.jwt_token });
    expect(uploadResponse.status).toBe(200);

    const { response: registerResponse2 } = await registerUser();
    expect(registerResponse2.status).toBe(200);
    const userId2 = registerResponse2.body.user_id;

    const createApiKeyResponse = await createApiKey(userId2, 'Test Key', ['Read'], undefined, { jwt: registerResponse2.body.jwt_token });
    expect(createApiKeyResponse.status).toBe(200);

    const sizeResponse = await getBookFileMetadata(uploadResponse.text, { apiKey: createApiKeyResponse.body.key });
    expect(sizeResponse.status).toBe(404);
    expect(sizeResponse.text).toBe(BOOK_NOT_FOUND);
  });

  test('Different user with permission', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const uploadResponse = await uploadBook(userId, 'Alices_Adventures_in_Wonderland.epub', { jwt: registerResponse.body.jwt_token });
    expect(uploadResponse.status).toBe(200);

    const { response: registerResponse2 } = await registerUser(undefined, undefined, process.env.ADMIN_KEY);
    expect(registerResponse2.status).toBe(200);
    const userId2 = registerResponse2.body.user_id;

    const createApiKeyResponse = await createApiKey(userId2, 'Test Key', ['Read'], undefined, { jwt: registerResponse2.body.jwt_token });
    expect(createApiKeyResponse.status).toBe(200);

    const sizeResponse = await getBookFileMetadata(uploadResponse.text, { apiKey: createApiKeyResponse.body.key });
    expect(sizeResponse.status).toBe(200);
  });

  test('Wrong capabilities', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const uploadResponse = await uploadBook(userId, 'Alices_Adventures_in_Wonderland.epub', { jwt: registerResponse.body.jwt_token });
    expect(uploadResponse.status).toBe(200);

    const createApiKeyResponse = await createApiKey(userId, 'Test Key', ['Create'], undefined, { jwt: registerResponse.body.jwt_token });
    expect(createApiKeyResponse.status).toBe(200);

    const sizeResponse = await getBookFileMetadata(uploadResponse.text, { apiKey: createApiKeyResponse.body.key });
    expect(sizeResponse.status).toBe(403);
    expect(sizeResponse.text).toBe(FORBIDDEN);
  });

  test('Expired key', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const uploadResponse = await uploadBook(userId, 'Alices_Adventures_in_Wonderland.epub', { jwt: registerResponse.body.jwt_token });
    expect(uploadResponse.status).toBe(200);

    const timestamp = Date.now() + 1000;
    const createApiKeyResponse = await createApiKey(userId, 'Test Key', ['Read'], timestamp, { jwt: registerResponse.body.jwt_token });
    expect(createApiKeyResponse.status).toBe(200);

    // Wait for the key to expire
    await wait(1.5);

    const downloadResponse = await getBookFileMetadata(uploadResponse.text, { apiKey: createApiKeyResponse.body.key });
    expect(downloadResponse.status).toBe(401);
    expect(downloadResponse.text).toBe(INVALID_API_KEY);
  });
});
