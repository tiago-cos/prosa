import { BOOK_NOT_FOUND, INVALID_PAGINATION, uploadBook } from '../utils/books.js';
import { FORBIDDEN, randomString } from '../utils/common.js';
import {
  addBookToShelf,
  createShelf,
  deleteBookFromShelf,
  deleteShelf,
  getShelfMetadata,
  INVALID_SHELF_ID,
  INVALID_SHELF_NAME,
  listBooksFromShelf,
  searchShelves,
  SHELF_BOOK_CONFLICT,
  SHELF_BOOK_NOT_FOUND,
  SHELF_ID_CONFLICT,
  SHELF_NAME_CONFLICT,
  SHELF_NOT_FOUND,
  updateShelf
} from '../utils/shelves.js';
import { registerUser, USER_NOT_FOUND } from '../utils/users.js';
import { describeAuthContract } from '../utils/auth-contract.js';
import { randomUUID } from 'crypto';

describe('Create shelf', () => {
  test('Simple', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const createShelfResponse = await createShelf('shelf!', userId, undefined, { jwt: registerResponse.body.jwt_token });
    expect(createShelfResponse.status).toBe(200);

    const getShelfMetadataResponse = await getShelfMetadata(createShelfResponse.text, { jwt: registerResponse.body.jwt_token });
    expect(getShelfMetadataResponse.status).toBe(200);
    expect(getShelfMetadataResponse.body.name).toBe('shelf!');
    expect(getShelfMetadataResponse.body.owner_id).toBe(userId);
    expect(getShelfMetadataResponse.body.book_count).toBe(0);
  });

  test('Provided shelf id', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const shelfId = randomUUID();
    const createShelfResponse = await createShelf('shelf!', userId, shelfId, { jwt: registerResponse.body.jwt_token });
    expect(createShelfResponse.status).toBe(200);
    expect(createShelfResponse.text).toBe(shelfId);

    const getShelfMetadataResponse = await getShelfMetadata(shelfId, { jwt: registerResponse.body.jwt_token });
    expect(getShelfMetadataResponse.status).toBe(200);
    expect(getShelfMetadataResponse.body.name).toBe('shelf!');
  });

  test('Invalid shelf id', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const createShelfResponse = await createShelf('shelf!', userId, 'invalid', { jwt: registerResponse.body.jwt_token });
    expect(createShelfResponse.status).toBe(400);
    expect(createShelfResponse.text).toBe(INVALID_SHELF_ID);
  });

  test('Repeated shelf id', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const shelfId = randomUUID();
    let createShelfResponse = await createShelf('shelf!', userId, shelfId, { jwt: registerResponse.body.jwt_token });
    expect(createShelfResponse.status).toBe(200);

    createShelfResponse = await createShelf('another shelf!', userId, shelfId, { jwt: registerResponse.body.jwt_token });
    expect(createShelfResponse.status).toBe(409);
    expect(createShelfResponse.text).toBe(SHELF_ID_CONFLICT);
  });

  test('Implicit owner', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const createShelfResponse = await createShelf('shelf!', undefined, undefined, { jwt: registerResponse.body.jwt_token });
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

    const createShelfResponse = await createShelf(shelfName, userId, undefined, { jwt: registerResponse.body.jwt_token });
    expect(createShelfResponse.status).toBe(400);
    expect(createShelfResponse.text).toBe(INVALID_SHELF_NAME);
  });

  test('Repeated shelf name', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const shelfName = randomString(20);

    let createShelfResponse = await createShelf(shelfName, userId, undefined, { jwt: registerResponse.body.jwt_token });
    expect(createShelfResponse.status).toBe(200);

    createShelfResponse = await createShelf(shelfName, userId, undefined, { jwt: registerResponse.body.jwt_token });
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

    const createShelfResponse = await createShelf(shelfName, userId, undefined, { jwt: registerResponse2.body.jwt_token });
    expect(createShelfResponse.status).toBe(403);
    expect(createShelfResponse.text).toBe(FORBIDDEN);
  });

  test('Different user with permission', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const { response: registerResponse2 } = await registerUser(undefined, undefined, true, process.env.ADMIN_KEY);
    expect(registerResponse2.status).toBe(200);

    const shelfName = randomString(20);

    const createShelfResponse = await createShelf(shelfName, userId, undefined, { jwt: registerResponse2.body.jwt_token });
    expect(createShelfResponse.status).toBe(200);
  });

  test('Non-existent user', async () => {
    const { response: registerResponse } = await registerUser(undefined, undefined, true, process.env.ADMIN_KEY);
    expect(registerResponse.status).toBe(200);

    const createShelfResponse = await createShelf('shelf', 'non-existent', undefined, { jwt: registerResponse.body.jwt_token });
    expect(createShelfResponse.status).toBe(404);
    expect(createShelfResponse.text).toBe(USER_NOT_FOUND);
  });
});

describe('Get shelf metadata', () => {
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

    const createShelfResponse = await createShelf('shelf!', userId, undefined, { jwt: registerResponse.body.jwt_token });
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

    const createShelfResponse = await createShelf('shelf!', userId, undefined, { jwt: registerResponse.body.jwt_token });
    expect(createShelfResponse.status).toBe(200);

    const { response: registerResponse2 } = await registerUser(undefined, undefined, true, process.env.ADMIN_KEY);
    expect(registerResponse2.status).toBe(200);

    const getShelfMetadataResponse = await getShelfMetadata(createShelfResponse.text, { jwt: registerResponse2.body.jwt_token });
    expect(getShelfMetadataResponse.status).toBe(200);
  });
});

describe('Update shelf', () => {
  test('Simple', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const createShelfResponse = await createShelf('shelf!', userId, undefined, { jwt: registerResponse.body.jwt_token });
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

    const createShelfResponse = await createShelf('shelf!', userId, undefined, { jwt: registerResponse.body.jwt_token });
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

    let createShelfResponse = await createShelf(shelfName, userId, undefined, { jwt: registerResponse.body.jwt_token });
    expect(createShelfResponse.status).toBe(200);

    createShelfResponse = await createShelf('to-update', userId, undefined, { jwt: registerResponse.body.jwt_token });
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

    const createShelfResponse = await createShelf(shelfName, userId, undefined, { jwt: registerResponse.body.jwt_token });
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

    const createShelfResponse = await createShelf(shelfName, userId, undefined, { jwt: registerResponse.body.jwt_token });
    expect(createShelfResponse.status).toBe(200);

    const { response: registerResponse2 } = await registerUser(undefined, undefined, true, process.env.ADMIN_KEY);
    expect(registerResponse2.status).toBe(200);

    const updateShelfResponse = await updateShelf(createShelfResponse.text, 'new-name', { jwt: registerResponse2.body.jwt_token });
    expect(updateShelfResponse.status).toBe(204);

    const getShelfMetadataResponse = await getShelfMetadata(createShelfResponse.text, { jwt: registerResponse.body.jwt_token });
    expect(getShelfMetadataResponse.status).toBe(200);
    expect(getShelfMetadataResponse.body.name).toBe('new-name');
  });

  test('Non-existent shelf', async () => {
    const { response: registerResponse } = await registerUser(undefined, undefined, true, process.env.ADMIN_KEY);
    expect(registerResponse.status).toBe(200);

    const updateShelfResponse = await updateShelf('non-existent', 'new-name', { jwt: registerResponse.body.jwt_token });
    expect(updateShelfResponse.status).toBe(404);
    expect(updateShelfResponse.text).toBe(SHELF_NOT_FOUND);
  });
});

describe('Delete shelf', () => {
  test('Simple', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const createShelfResponse = await createShelf('shelf!', userId, undefined, { jwt: registerResponse.body.jwt_token });
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

    const createShelfResponse = await createShelf('shelf!', userId, undefined, { jwt: registerResponse.body.jwt_token });
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

    const createShelfResponse = await createShelf('shelf!', userId, undefined, { jwt: registerResponse.body.jwt_token });
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

    const createShelfResponse = await createShelf('shelf!', userId, undefined, { jwt: registerResponse.body.jwt_token });
    expect(createShelfResponse.status).toBe(200);

    const { response: registerResponse2 } = await registerUser(undefined, undefined, true, process.env.ADMIN_KEY);
    expect(registerResponse2.status).toBe(200);

    const deleteShelfResponse = await deleteShelf(createShelfResponse.text, { jwt: registerResponse2.body.jwt_token });
    expect(deleteShelfResponse.status).toBe(204);
  });
});

describe('Search shelves', () => {
  test('Simple', async () => {
    const { response: registerResponse, username } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const createShelfResponse = await createShelf('shelf!', userId, undefined, { jwt: registerResponse.body.jwt_token });
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

    const createShelfResponse = await createShelf('Favorite Fantasy', userId, undefined, { jwt: registerResponse.body.jwt_token });
    expect(createShelfResponse.status).toBe(200);

    const createShelfResponse2 = await createShelf('Comic Books', userId, undefined, { jwt: registerResponse.body.jwt_token });
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

    const createShelfResponse = await createShelf('Favorite Fantasy', userId, undefined, { jwt: registerResponse.body.jwt_token });
    expect(createShelfResponse.status).toBe(200);

    const createShelfResponse2 = await createShelf('Comic Books', userId, undefined, { jwt: registerResponse.body.jwt_token });
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

    const createShelfResponse = await createShelf('Favorite Fantasy', userId, undefined, { jwt: registerResponse.body.jwt_token });
    expect(createShelfResponse.status).toBe(200);

    const createShelfResponse2 = await createShelf('Favorite Fantasy', userId2, undefined, { jwt: registerResponse2.body.jwt_token });
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

    const createShelfResponse = await createShelf('Favorite Fantasy', userId, undefined, { jwt: registerResponse.body.jwt_token });
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
    const { response: registerResponse } = await registerUser(undefined, undefined, true, process.env.ADMIN_KEY);
    expect(registerResponse.status).toBe(200);

    let searchResponse = await searchShelves('non-existent', undefined, undefined, undefined, { jwt: registerResponse.body.jwt_token });
    expect(searchResponse.status).toBe(404);
    expect(searchResponse.text).toBe(USER_NOT_FOUND);

    const { response: registerResponse2 } = await registerUser();
    expect(registerResponse2.status).toBe(200);

    searchResponse = await searchShelves('non-existent', undefined, undefined, undefined, { jwt: registerResponse2.body.jwt_token });
    expect(searchResponse.status).toBe(403);
    expect(searchResponse.text).toBe(FORBIDDEN);
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
    const { response: registerResponse } = await registerUser(undefined, undefined, true, process.env.ADMIN_KEY);
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
    const { response: registerResponse } = await registerUser(undefined, undefined, true, process.env.ADMIN_KEY);
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const { response: registerResponse2 } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId2 = registerResponse2.body.user_id;

    const createShelfResponse = await createShelf('Favorite Fantasy', userId, undefined, { jwt: registerResponse.body.jwt_token });
    expect(createShelfResponse.status).toBe(200);

    const createShelfResponse2 = await createShelf('Comic Books', userId2, undefined, { jwt: registerResponse2.body.jwt_token });
    expect(createShelfResponse2.status).toBe(200);

    let searchResponse = await searchShelves(undefined, undefined, undefined, 1000, { jwt: registerResponse.body.jwt_token });
    expect(searchResponse.status).toBe(200);

    expect(searchResponse.body.shelf_ids).toContain(createShelfResponse.text);
    expect(searchResponse.body.shelf_ids).toContain(createShelfResponse2.text);
  });
});

describe('Add book to shelf', () => {
  test('Simple', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const uploadBookResponse = await uploadBook(userId, 'The_Great_Gatsby.epub', { jwt: registerResponse.body.jwt_token });
    expect(uploadBookResponse.status).toBe(200);

    const createShelfResponse = await createShelf('shelf!', userId, undefined, { jwt: registerResponse.body.jwt_token });
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

    const createShelfResponse = await createShelf('shelf!', userId, undefined, { jwt: registerResponse.body.jwt_token });
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

    const createShelfResponse = await createShelf('shelf!', userId, undefined, { jwt: registerResponse.body.jwt_token });
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

    const createShelfResponse1 = await createShelf('shelf!', userId, undefined, { jwt: registerResponse.body.jwt_token });
    expect(createShelfResponse1.status).toBe(200);

    const createShelfResponse2 = await createShelf('shelf!', userId2, undefined, { jwt: registerResponse2.body.jwt_token });
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
    const { response: registerResponse } = await registerUser(undefined, undefined, true, process.env.ADMIN_KEY);
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const { response: registerResponse2 } = await registerUser();
    expect(registerResponse2.status).toBe(200);
    const userId2 = registerResponse2.body.user_id;

    const uploadBookResponse1 = await uploadBook(userId, 'The_Great_Gatsby.epub', { jwt: registerResponse.body.jwt_token });
    expect(uploadBookResponse1.status).toBe(200);

    const uploadBookResponse2 = await uploadBook(userId2, 'The_Great_Gatsby.epub', { jwt: registerResponse2.body.jwt_token });
    expect(uploadBookResponse2.status).toBe(200);

    const createShelfResponse1 = await createShelf('shelf!', userId, undefined, { jwt: registerResponse.body.jwt_token });
    expect(createShelfResponse1.status).toBe(200);

    const createShelfResponse2 = await createShelf('shelf!', userId2, undefined, { jwt: registerResponse2.body.jwt_token });
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
});

describe('List shelf books', () => {
  test('Simple', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const uploadBookResponse = await uploadBook(userId, 'The_Great_Gatsby.epub', { jwt: registerResponse.body.jwt_token });
    expect(uploadBookResponse.status).toBe(200);

    const uploadBookResponse2 = await uploadBook(userId, 'Alices_Adventures_in_Wonderland.epub', { jwt: registerResponse.body.jwt_token });
    expect(uploadBookResponse2.status).toBe(200);

    const createShelfResponse = await createShelf('shelf!', userId, undefined, { jwt: registerResponse.body.jwt_token });
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

    const createShelfResponse = await createShelf('shelf!', userId, undefined, { jwt: registerResponse.body.jwt_token });
    expect(createShelfResponse.status).toBe(200);

    let listShelfBooksResponse = await listBooksFromShelf(createShelfResponse.text, { jwt: registerResponse2.body.jwt_token });
    expect(listShelfBooksResponse.status).toBe(404);
    expect(listShelfBooksResponse.text).toEqual(SHELF_NOT_FOUND);
  });

  test('Different user with permission', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const { response: registerResponse2 } = await registerUser(undefined, undefined, true, process.env.ADMIN_KEY);
    expect(registerResponse2.status).toBe(200);

    const createShelfResponse = await createShelf('shelf!', userId, undefined, { jwt: registerResponse.body.jwt_token });
    expect(createShelfResponse.status).toBe(200);

    let listShelfBooksResponse = await listBooksFromShelf(createShelfResponse.text, { jwt: registerResponse2.body.jwt_token });
    expect(listShelfBooksResponse.status).toBe(200);
    expect(listShelfBooksResponse.body).toEqual([]);
  });
});

describe('Delete book from shelf', () => {
  test('Simple', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const uploadBookResponse = await uploadBook(userId, 'The_Great_Gatsby.epub', { jwt: registerResponse.body.jwt_token });
    expect(uploadBookResponse.status).toBe(200);

    const createShelfResponse = await createShelf('shelf!', userId, undefined, { jwt: registerResponse.body.jwt_token });
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

    const createShelfResponse = await createShelf('shelf!', userId, undefined, { jwt: registerResponse.body.jwt_token });
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

    const createShelfResponse = await createShelf('shelf!', userId, undefined, { jwt: registerResponse.body.jwt_token });
    expect(createShelfResponse.status).toBe(200);

    const deleteBookFromShelfResponse = await deleteBookFromShelf(createShelfResponse.text, uploadBookResponse.text, { jwt: registerResponse.body.jwt_token });
    expect(deleteBookFromShelfResponse.status).toBe(404);
    expect(deleteBookFromShelfResponse.text).toBe(SHELF_BOOK_NOT_FOUND);
  });

  test('Book in another shelf', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const { response: registerResponse2 } = await registerUser(undefined, undefined, true, process.env.ADMIN_KEY);
    expect(registerResponse2.status).toBe(200);
    const userId2 = registerResponse2.body.user_id;

    const uploadBookResponse = await uploadBook(userId, 'The_Great_Gatsby.epub', { jwt: registerResponse.body.jwt_token });
    expect(uploadBookResponse.status).toBe(200);

    const uploadBookResponse2 = await uploadBook(userId2, 'The_Great_Gatsby.epub', { jwt: registerResponse2.body.jwt_token });
    expect(uploadBookResponse2.status).toBe(200);

    const createShelfResponse = await createShelf('shelf!', userId, undefined, { jwt: registerResponse.body.jwt_token });
    expect(createShelfResponse.status).toBe(200);

    const createShelfResponse2 = await createShelf('shelf!', userId2, undefined, { jwt: registerResponse2.body.jwt_token });
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

    const createShelfResponse = await createShelf('shelf!', userId, undefined, { jwt: registerResponse.body.jwt_token });
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

    const { response: registerResponse2 } = await registerUser(undefined, undefined, true, process.env.ADMIN_KEY);
    expect(registerResponse2.status).toBe(200);

    const uploadBookResponse = await uploadBook(userId, 'The_Great_Gatsby.epub', { jwt: registerResponse.body.jwt_token });
    expect(uploadBookResponse.status).toBe(200);

    const createShelfResponse = await createShelf('shelf!', userId, undefined, { jwt: registerResponse.body.jwt_token });
    expect(createShelfResponse.status).toBe(200);

    const addBookToShelfResponse = await addBookToShelf(createShelfResponse.text, uploadBookResponse.text, { jwt: registerResponse.body.jwt_token });
    expect(addBookToShelfResponse.status).toBe(204);

    const deleteBookFromShelfResponse = await deleteBookFromShelf(createShelfResponse.text, uploadBookResponse.text, { jwt: registerResponse2.body.jwt_token });
    expect(deleteBookFromShelfResponse.status).toBe(204);
  });
});

async function userFixture() {
  const { response: registerResponse, username } = await registerUser();
  expect(registerResponse.status).toBe(200);
  const userId = registerResponse.body.user_id;
  const jwt = registerResponse.body.jwt_token;

  return { userId, jwt, username };
}

async function shelfFixture() {
  const { userId, jwt, username } = await userFixture();

  const createShelfResponse = await createShelf('shelf!', userId, undefined, { jwt });
  expect(createShelfResponse.status).toBe(200);

  return { userId, jwt, context: { userId, username, shelfId: createShelfResponse.text } };
}

async function shelvedBookFixture() {
  const { userId, jwt, context } = await shelfFixture();

  const uploadBookResponse = await uploadBook(userId, 'The_Great_Gatsby.epub', { jwt });
  expect(uploadBookResponse.status).toBe(200);

  const addBookToShelfResponse = await addBookToShelf(context.shelfId, uploadBookResponse.text, { jwt });
  expect(addBookToShelfResponse.status).toBe(204);

  return { userId, jwt, context: { ...context, bookId: uploadBookResponse.text } };
}

async function shelfAndLooseBookFixture() {
  const { userId, jwt, context } = await shelfFixture();

  const uploadBookResponse = await uploadBook(userId, 'The_Great_Gatsby.epub', { jwt });
  expect(uploadBookResponse.status).toBe(200);

  return { userId, jwt, context: { ...context, bookId: uploadBookResponse.text } };
}

describeAuthContract('Create shelf auth', {
  capability: 'Create',
  success: 200,
  setup: async () => {
    const { userId, jwt } = await userFixture();
    return { userId, jwt, context: { userId } };
  },
  call: ({ userId }, auth) => createShelf('shelf!', userId, undefined, auth)
});

describeAuthContract('Get shelf metadata auth', {
  capability: 'Read',
  success: 200,
  setup: shelfFixture,
  call: ({ shelfId }, auth) => getShelfMetadata(shelfId, auth)
});

describeAuthContract('Update shelf auth', {
  capability: 'Update',
  success: 204,
  setup: shelfFixture,
  call: ({ shelfId }, auth) => updateShelf(shelfId, 'new-shelf!', auth)
});

describeAuthContract('Delete shelf auth', {
  capability: 'Delete',
  success: 204,
  setup: shelfFixture,
  call: ({ shelfId }, auth) => deleteShelf(shelfId, auth)
});

describeAuthContract('Search shelves auth', {
  capability: 'Read',
  success: 200,
  setup: shelfFixture,
  call: ({ username }, auth) => searchShelves(username, undefined, undefined, undefined, auth)
});

describeAuthContract('Add book to shelf auth', {
  capability: 'Update',
  success: 204,
  setup: shelfAndLooseBookFixture,
  call: ({ shelfId, bookId }, auth) => addBookToShelf(shelfId, bookId, auth)
});

describeAuthContract('List shelf books auth', {
  capability: 'Read',
  success: 200,
  setup: shelfFixture,
  call: ({ shelfId }, auth) => listBooksFromShelf(shelfId, auth)
});

describeAuthContract('Delete book from shelf auth', {
  capability: 'Update',
  success: 204,
  setup: shelvedBookFixture,
  call: ({ shelfId, bookId }, auth) => deleteBookFromShelf(shelfId, bookId, auth)
});
