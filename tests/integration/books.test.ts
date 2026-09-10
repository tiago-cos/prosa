import fs from 'fs';
import path from 'path';
import { addAnnotation, ALICE_NOTE, getAnnotation } from '../utils/annotations.js';
import { BOOK_CONFLICT, BOOK_ID_CONFLICT, BOOK_NOT_FOUND, deleteBook, downloadBook, getBookFileMetadata, INVALID_BOOK, INVALID_BOOK_ID, INVALID_PAGINATION, searchBooks, uploadBook } from '../utils/books.js';
import { BOOK_DIR, FORBIDDEN, wait } from '../utils/common.js';
import { getCover } from '../utils/covers.js';
import { getMetadata } from '../utils/metadata.js';
import { registerUser, USER_NOT_FOUND } from '../utils/users.js';
import { randomUUID } from 'crypto';
import { describeAuthContract } from '../utils/auth-contract.js';

describe('Upload book', () => {
  test('Simple', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const uploadResponse = await uploadBook(userId, 'The_Great_Gatsby.epub', { jwt: registerResponse.body.jwt_token });
    expect(uploadResponse.status).toBe(200);

    const downloadResponse = await downloadBook(uploadResponse.text, { jwt: registerResponse.body.jwt_token });
    expect(downloadResponse.status).toBe(200);

    let epub = path.join(BOOK_DIR, 'The_Great_Gatsby.epub');

    // Books are stored unprocessed, so a download is the uploaded file itself.
    expect(downloadResponse.body.equals(fs.readFileSync(epub))).toBe(true);
  });

  test('Provided book id', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const bookId = randomUUID();
    const uploadResponse = await uploadBook(userId, 'The_Great_Gatsby.epub', { jwt: registerResponse.body.jwt_token }, bookId);
    expect(uploadResponse.status).toBe(200);
    expect(uploadResponse.text).toBe(bookId);

    const downloadResponse = await downloadBook(uploadResponse.text, { jwt: registerResponse.body.jwt_token });
    expect(downloadResponse.status).toBe(200);

    let epub = path.join(BOOK_DIR, 'The_Great_Gatsby.epub');

    // Books are stored unprocessed, so a download is the uploaded file itself.
    expect(downloadResponse.body.equals(fs.readFileSync(epub))).toBe(true);
  });

  test('Invalid book id', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const bookId = 'invalid';
    const uploadResponse = await uploadBook(userId, 'The_Great_Gatsby.epub', { jwt: registerResponse.body.jwt_token }, bookId);
    expect(uploadResponse.status).toBe(400);
    expect(uploadResponse.text).toBe(INVALID_BOOK_ID);
  });

  test('Repeated book id', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const bookId = randomUUID();
    let uploadResponse = await uploadBook(userId, 'The_Great_Gatsby.epub', { jwt: registerResponse.body.jwt_token }, bookId);
    expect(uploadResponse.status).toBe(200);
    expect(uploadResponse.text).toBe(bookId);

    uploadResponse = await uploadBook(userId, 'The_Wonderful_Wizard_of_Oz.epub', { jwt: registerResponse.body.jwt_token }, bookId);
    expect(uploadResponse.status).toBe(409);
    expect(uploadResponse.text).toBe(BOOK_ID_CONFLICT);
  });

  test('Implicit owner', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);

    const uploadResponse = await uploadBook(undefined, 'The_Great_Gatsby.epub', { jwt: registerResponse.body.jwt_token });
    expect(uploadResponse.status).toBe(200);

    const downloadResponse = await downloadBook(uploadResponse.text, { jwt: registerResponse.body.jwt_token });
    expect(downloadResponse.status).toBe(200);

    let epub = path.join(BOOK_DIR, 'The_Great_Gatsby.epub');

    // Books are stored unprocessed, so a download is the uploaded file itself.
    expect(downloadResponse.body.equals(fs.readFileSync(epub))).toBe(true);
  });

  test('Repeated book', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const uploadResponse = await uploadBook(userId, 'The_Wonderful_Wizard_of_Oz.epub', { jwt: registerResponse.body.jwt_token });
    expect(uploadResponse.status).toBe(200);

    try {
      const uploadResponse2 = await uploadBook(userId, 'The_Wonderful_Wizard_of_Oz.epub', { jwt: registerResponse.body.jwt_token });
      expect(uploadResponse2.status).toBe(409);
      expect(uploadResponse2.text).toBe(BOOK_CONFLICT);
    } catch (err: any) {
      if (err.code !== 'EPIPE') throw err;
    }

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

    try {
      const uploadResponse = await uploadBook(userId, 'This_is_not_an_epub.txt', { jwt: registerResponse.body.jwt_token });
      expect(uploadResponse.status).toBe(400);
      expect(uploadResponse.text).toBe(INVALID_BOOK);
    } catch (err: any) {
      if (err.code === 'EPIPE') return;
      throw err;
    }
  });

  test('Different user without permission', async () => {
    const { response: registerResponse } = await registerUser(undefined, undefined, false, process.env.ADMIN_KEY);
    expect(registerResponse.status).toBe(200);

    const { response: registerResponse2 } = await registerUser();
    expect(registerResponse2.status).toBe(200);
    const userId2 = registerResponse2.body.user_id;

    try {
      const uploadResponse = await uploadBook(userId2, 'The_Wonderful_Wizard_of_Oz.epub', { jwt: registerResponse.body.jwt_token });
      expect(uploadResponse.status).toBe(403);
      expect(uploadResponse.text).toBe(FORBIDDEN);
    } catch (err: any) {
      if (err.code === 'EPIPE') return;
      throw err;
    }
  });

  test('Different user with permission', async () => {
    const { response: registerResponse } = await registerUser(undefined, undefined, true, process.env.ADMIN_KEY);
    expect(registerResponse.status).toBe(200);

    const { response: registerResponse2 } = await registerUser();
    expect(registerResponse2.status).toBe(200);
    const userId2 = registerResponse2.body.user_id;

    const uploadResponse = await uploadBook(userId2, 'The_Wonderful_Wizard_of_Oz.epub', { jwt: registerResponse.body.jwt_token });
    expect(uploadResponse.status).toBe(200);
  });

  test('Non-existent user', async () => {
    const { response: registerResponse } = await registerUser(undefined, undefined, true, process.env.ADMIN_KEY);
    expect(registerResponse.status).toBe(200);

    try {
      const uploadResponse = await uploadBook('non-existent', 'The_Wonderful_Wizard_of_Oz.epub', { jwt: registerResponse.body.jwt_token });
      expect(uploadResponse.status).toBe(404);
      expect(uploadResponse.text).toBe(USER_NOT_FOUND);
    } catch (err: any) {
      if (err.code === 'EPIPE') return;
      throw err;
    }
  });
});

describe('Download book', () => {
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

    const { response: registerResponse2 } = await registerUser(undefined, undefined, true, process.env.ADMIN_KEY);
    expect(registerResponse2.status).toBe(200);

    const downloadResponse = await downloadBook(uploadResponse.text, { jwt: registerResponse2.body.jwt_token });
    expect(downloadResponse.status).toBe(200);
  });
});

describe('Delete book', () => {
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
    await wait(1);

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

    const { response: registerResponse2 } = await registerUser(undefined, undefined, true, process.env.ADMIN_KEY);
    expect(registerResponse2.status).toBe(200);

    const deleteResponse = await deleteBook(uploadResponse.text, { jwt: registerResponse2.body.jwt_token });
    expect(deleteResponse.status).toBe(204);

    const downloadResponse = await downloadBook(uploadResponse.text, { jwt: registerResponse.body.jwt_token });
    expect(downloadResponse.status).toBe(404);
    expect(downloadResponse.text).toBe(BOOK_NOT_FOUND);
  });
});

describe('Search books', () => {
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
    const { response: registerResponse } = await registerUser(undefined, undefined, true, process.env.ADMIN_KEY);
    expect(registerResponse.status).toBe(200);

    let searchResponse = await searchBooks('non-existent', undefined, undefined, undefined, undefined, { jwt: registerResponse.body.jwt_token });
    expect(searchResponse.status).toBe(404);
    expect(searchResponse.text).toBe(USER_NOT_FOUND);

    const { response: registerResponse2 } = await registerUser();
    expect(registerResponse2.status).toBe(200);

    searchResponse = await searchBooks('non-existent', undefined, undefined, undefined, undefined, { jwt: registerResponse2.body.jwt_token });
    expect(searchResponse.status).toBe(403);
    expect(searchResponse.text).toBe(FORBIDDEN);
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
    const { response: registerResponse } = await registerUser(undefined, undefined, true, process.env.ADMIN_KEY);
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
    const { response: registerResponse } = await registerUser(undefined, undefined, true, process.env.ADMIN_KEY);
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
});

describe('Get book file metadata', () => {
  test('Simple', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const uploadResponse = await uploadBook(userId, 'The_Great_Gatsby.epub', { jwt: registerResponse.body.jwt_token });
    expect(uploadResponse.status).toBe(200);

    const sizeResponse = await getBookFileMetadata(uploadResponse.text, { jwt: registerResponse.body.jwt_token });
    expect(sizeResponse.status).toBe(200);

    expect(sizeResponse.body.file_size).toBe(fs.statSync(path.join(BOOK_DIR, 'The_Great_Gatsby.epub')).size);
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

    const { response: registerResponse2 } = await registerUser(undefined, undefined, true, process.env.ADMIN_KEY);
    expect(registerResponse2.status).toBe(200);

    const sizeResponse = await getBookFileMetadata(uploadResponse.text, { jwt: registerResponse2.body.jwt_token });
    expect(sizeResponse.status).toBe(200);
  });
});

async function userFixture() {
  const { response: registerResponse, username } = await registerUser();
  expect(registerResponse.status).toBe(200);
  const userId = registerResponse.body.user_id;
  const jwt = registerResponse.body.jwt_token;

  return { userId, jwt, context: { userId, username } };
}

async function bookFixture() {
  const { userId, jwt, context } = await userFixture();

  const uploadResponse = await uploadBook(userId, 'The_Great_Gatsby.epub', { jwt });
  expect(uploadResponse.status).toBe(200);

  return { userId, jwt, context: { ...context, bookId: uploadResponse.text } };
}

describeAuthContract('Upload book auth', {
  capability: 'Create',
  success: 200,
  setup: userFixture,
  call: ({ userId }, auth) => uploadBook(userId, 'The_Great_Gatsby.epub', auth)
});

describeAuthContract('Download book auth', {
  capability: 'Read',
  success: 200,
  setup: bookFixture,
  call: ({ bookId }, auth) => downloadBook(bookId, auth)
});

describeAuthContract('Delete book auth', {
  capability: 'Delete',
  success: 204,
  setup: bookFixture,
  call: ({ bookId }, auth) => deleteBook(bookId, auth)
});

describeAuthContract('Search books auth', {
  capability: 'Read',
  success: 200,
  setup: bookFixture,
  call: ({ username }, auth) => searchBooks(username, undefined, undefined, undefined, undefined, auth)
});

describeAuthContract('Get book file metadata auth', {
  capability: 'Read',
  success: 200,
  setup: bookFixture,
  call: ({ bookId }, auth) => getBookFileMetadata(bookId, auth)
});
