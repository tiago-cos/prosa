import { addAnnotation, ALICE_NOTE, deleteAnnotation, patchAnnotation } from '../utils/annotations.js';
import { deleteBook, uploadBook } from '../utils/books.js';
import { FORBIDDEN, INVALID_API_KEY, UNAUTHORIZED, wait } from '../utils/common.js';
import { deleteCover, updateCover } from '../utils/covers.js';
import { deleteMetadata, EXAMPLE_METADATA, patchMetadata, updateMetadata } from '../utils/metadata.js';
import { addBookToShelf, createShelf, deleteBookFromShelf, deleteShelf } from '../utils/shelves.js';
import { ALICE_STATE, patchState, updateState } from '../utils/state.js';
import { INVALID_SYNC_TOKEN, sync } from '../utils/sync.js';
import { createApiKey, loginUser, registerUser, USER_NOT_FOUND } from '../utils/users.js';

describe('Sync JWT', () => {
  test('Same session', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;
    const jwtToken = registerResponse.body.jwt_token;

    let syncResponse = await sync(userId, undefined, { jwt: jwtToken });
    expect(syncResponse.status).toBe(200);
    let currentSyncToken = syncResponse.body.new_sync_token;
    expect(typeof currentSyncToken).toBe('number');

    expect(syncResponse.body).toEqual({
      new_sync_token: currentSyncToken,
      unsynced_books: {
        file: [],
        metadata: [],
        cover: [],
        state: [],
        annotations: [],
        deleted: []
      },
      unsynced_shelves: {
        metadata: [],
        contents: [],
        deleted: []
      }
    });

    const uploadResponse = await uploadBook(userId, 'Alices_Adventures_in_Wonderland.epub', { jwt: jwtToken });
    expect(uploadResponse.status).toBe(200);
    const bookId = uploadResponse.text;
    await wait(1);

    syncResponse = await sync(userId, currentSyncToken, { jwt: jwtToken });
    expect(syncResponse.status).toBe(200);
    currentSyncToken = syncResponse.body.new_sync_token;

    expect(syncResponse.body).toEqual({
      new_sync_token: currentSyncToken,
      unsynced_books: {
        file: [],
        // metadata and cover are asynchronous
        metadata: [bookId],
        cover: [bookId],
        state: [],
        annotations: [],
        deleted: []
      },
      unsynced_shelves: {
        metadata: [],
        contents: [],
        deleted: []
      }
    });

    const addShelfResponse = await createShelf('shelf', userId, { jwt: jwtToken });
    expect(addShelfResponse.status).toBe(200);

    syncResponse = await sync(userId, currentSyncToken, { jwt: jwtToken });
    expect(syncResponse.status).toBe(200);
    const oldSyncToken = currentSyncToken;

    expect(syncResponse.body).toEqual({
      new_sync_token: syncResponse.body.new_sync_token,
      unsynced_books: {
        file: [],
        metadata: [],
        cover: [],
        state: [],
        annotations: [],
        deleted: []
      },
      unsynced_shelves: {
        metadata: [],
        contents: [],
        deleted: []
      }
    });

    const uploadResponse2 = await uploadBook(userId, 'The_Wonderful_Wizard_of_Oz.epub', { jwt: jwtToken });
    expect(uploadResponse2.status).toBe(200);
    const bookId2 = uploadResponse2.text;
    await wait(1);

    syncResponse = await sync(userId, oldSyncToken, { jwt: jwtToken });
    expect(syncResponse.status).toBe(200);

    expect(syncResponse.body).toEqual({
      new_sync_token: syncResponse.body.new_sync_token,
      unsynced_books: {
        file: [],
        metadata: [bookId2],
        cover: [bookId2],
        state: [],
        annotations: [],
        deleted: []
      },
      unsynced_shelves: {
        metadata: [],
        contents: [],
        deleted: []
      }
    });

    syncResponse = await sync(userId, undefined, { jwt: jwtToken });
    expect(syncResponse.status).toBe(200);
    currentSyncToken = syncResponse.body.new_sync_token;

    expect(syncResponse.body).toEqual({
      new_sync_token: currentSyncToken,
      unsynced_books: {
        file: [],
        metadata: [bookId, bookId2],
        cover: [bookId, bookId2],
        state: [],
        annotations: [],
        deleted: []
      },
      unsynced_shelves: {
        metadata: [],
        contents: [],
        deleted: []
      }
    });

    const addBookToShelfResponse = await addBookToShelf(addShelfResponse.text, uploadResponse.text, { jwt: jwtToken });
    expect(addBookToShelfResponse.status).toBe(204);

    syncResponse = await sync(userId, currentSyncToken, { jwt: jwtToken });
    expect(syncResponse.status).toBe(200);

    expect(syncResponse.body).toEqual({
      new_sync_token: syncResponse.body.new_sync_token,
      unsynced_books: {
        file: [],
        metadata: [],
        cover: [],
        state: [],
        annotations: [],
        deleted: []
      },
      unsynced_shelves: {
        metadata: [],
        contents: [],
        deleted: []
      }
    });
  });

  test('Different session', async () => {
    const { response: registerResponse, username, password } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;
    const jwtToken = registerResponse.body.jwt_token;

    const loginResponse = await loginUser(username, password);
    expect(loginResponse.status).toBe(200);
    const jwtToken2 = loginResponse.body.jwt_token;

    let syncResponse = await sync(userId, undefined, { jwt: jwtToken2 });
    expect(syncResponse.status).toBe(200);
    let currentSyncToken = syncResponse.body.new_sync_token;
    expect(typeof currentSyncToken).toBe('number');

    expect(syncResponse.body).toEqual({
      new_sync_token: currentSyncToken,
      unsynced_books: {
        file: [],
        metadata: [],
        cover: [],
        state: [],
        annotations: [],
        deleted: []
      },
      unsynced_shelves: {
        metadata: [],
        contents: [],
        deleted: []
      }
    });

    const uploadResponse = await uploadBook(userId, 'Alices_Adventures_in_Wonderland.epub', { jwt: jwtToken });
    expect(uploadResponse.status).toBe(200);
    const bookId = uploadResponse.text;
    await wait(1);

    syncResponse = await sync(userId, currentSyncToken, { jwt: jwtToken2 });
    expect(syncResponse.status).toBe(200);
    currentSyncToken = syncResponse.body.new_sync_token;

    expect(syncResponse.body).toEqual({
      new_sync_token: currentSyncToken,
      unsynced_books: {
        file: [bookId],
        metadata: [bookId],
        cover: [bookId],
        state: [],
        annotations: [],
        deleted: []
      },
      unsynced_shelves: {
        metadata: [],
        contents: [],
        deleted: []
      }
    });

    let addShelfResponse = await createShelf('shelf', userId, { jwt: jwtToken });
    expect(addShelfResponse.status).toBe(200);
    const shelfId = addShelfResponse.text;

    syncResponse = await sync(userId, currentSyncToken, { jwt: jwtToken2 });
    expect(syncResponse.status).toBe(200);
    const oldSyncToken = currentSyncToken;

    expect(syncResponse.body).toEqual({
      new_sync_token: syncResponse.body.new_sync_token,
      unsynced_books: {
        file: [],
        metadata: [],
        cover: [],
        state: [],
        annotations: [],
        deleted: []
      },
      unsynced_shelves: {
        metadata: [shelfId],
        contents: [],
        deleted: []
      }
    });

    const uploadResponse2 = await uploadBook(userId, 'The_Wonderful_Wizard_of_Oz.epub', { jwt: jwtToken });
    expect(uploadResponse2.status).toBe(200);
    const bookId2 = uploadResponse2.text;
    await wait(1);

    syncResponse = await sync(userId, oldSyncToken, { jwt: jwtToken2 });
    expect(syncResponse.status).toBe(200);

    expect(syncResponse.body).toEqual({
      new_sync_token: syncResponse.body.new_sync_token,
      unsynced_books: {
        file: [bookId2],
        metadata: [bookId2],
        cover: [bookId2],
        state: [],
        annotations: [],
        deleted: []
      },
      unsynced_shelves: {
        metadata: [shelfId],
        contents: [],
        deleted: []
      }
    });

    syncResponse = await sync(userId, undefined, { jwt: jwtToken2 });
    expect(syncResponse.status).toBe(200);
    currentSyncToken = syncResponse.body.new_sync_token;

    expect(syncResponse.body).toEqual({
      new_sync_token: currentSyncToken,
      unsynced_books: {
        file: [bookId, bookId2],
        metadata: [bookId, bookId2],
        cover: [bookId, bookId2],
        state: [],
        annotations: [],
        deleted: []
      },
      unsynced_shelves: {
        metadata: [shelfId],
        contents: [],
        deleted: []
      }
    });

    const addBookToShelfResponse = await addBookToShelf(addShelfResponse.text, uploadResponse.text, { jwt: jwtToken });
    expect(addBookToShelfResponse.status).toBe(204);

    syncResponse = await sync(userId, currentSyncToken, { jwt: jwtToken2 });
    expect(syncResponse.status).toBe(200);

    expect(syncResponse.body).toEqual({
      new_sync_token: syncResponse.body.new_sync_token,
      unsynced_books: {
        file: [],
        metadata: [],
        cover: [],
        state: [],
        annotations: [],
        deleted: []
      },
      unsynced_shelves: {
        metadata: [],
        contents: [shelfId],
        deleted: []
      }
    });
  });

  test('Implicit users', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;
    const jwtToken = registerResponse.body.jwt_token;

    const uploadResponse = await uploadBook(userId, 'Alices_Adventures_in_Wonderland.epub', { jwt: jwtToken });
    expect(uploadResponse.status).toBe(200);
    const bookId = uploadResponse.text;
    await wait(1);

    const syncResponse = await sync(undefined, undefined, { jwt: jwtToken });
    expect(syncResponse.status).toBe(200);
    const currentSyncToken = syncResponse.body.new_sync_token;

    const expectedResponse = {
      new_sync_token: currentSyncToken,
      unsynced_books: {
        file: [],
        metadata: [bookId],
        cover: [bookId],
        state: [],
        annotations: [],
        deleted: []
      },
      unsynced_shelves: {
        metadata: [],
        contents: [],
        deleted: []
      }
    };

    expect(syncResponse.body).toEqual(expectedResponse);
  });

  test('Deleted book files', async () => {
    const { response: registerResponse, username, password } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;
    const jwtToken = registerResponse.body.jwt_token;

    const loginResponse = await loginUser(username, password);
    expect(loginResponse.status).toBe(200);
    const jwtToken2 = loginResponse.body.jwt_token;

    const uploadResponse = await uploadBook(userId, 'Alices_Adventures_in_Wonderland.epub', { jwt: jwtToken });
    expect(uploadResponse.status).toBe(200);
    const bookId = uploadResponse.text;
    await wait(1);

    let syncResponse = await sync(userId, undefined, { jwt: jwtToken2 });
    expect(syncResponse.status).toBe(200);
    let currentSyncToken = syncResponse.body.new_sync_token;

    let expectedResponse = {
      new_sync_token: currentSyncToken,
      unsynced_books: {
        file: [bookId],
        metadata: [bookId],
        cover: [bookId],
        state: [],
        annotations: [],
        deleted: [] as string[]
      },
      unsynced_shelves: {
        metadata: [],
        contents: [],
        deleted: []
      }
    };

    expect(syncResponse.body).toEqual(expectedResponse);

    const deleteResponse = await deleteBook(uploadResponse.text, { jwt: jwtToken });
    expect(deleteResponse.status).toBe(204);

    syncResponse = await sync(userId, undefined, { jwt: jwtToken2 });
    expect(syncResponse.status).toBe(200);
    currentSyncToken = syncResponse.body.new_sync_token;

    expectedResponse = {
      new_sync_token: currentSyncToken,
      unsynced_books: {
        file: [],
        metadata: [],
        cover: [],
        state: [],
        annotations: [],
        deleted: [bookId]
      },
      unsynced_shelves: {
        metadata: [],
        contents: [],
        deleted: []
      }
    };

    expect(syncResponse.body).toEqual(expectedResponse);

    // This book has no metadata nor cover
    const uploadResponse2 = await uploadBook(userId, 'The_Great_Gatsby.epub', { jwt: jwtToken });
    expect(uploadResponse2.status).toBe(200);
    const bookId2 = uploadResponse2.text;
    await wait(1);

    const uploadResponse3 = await uploadBook(userId, 'The_Wonderful_Wizard_of_Oz.epub', { jwt: jwtToken });
    expect(uploadResponse3.status).toBe(200);
    const bookId3 = uploadResponse3.text;
    await wait(1);

    syncResponse = await sync(userId, undefined, { jwt: jwtToken2 });
    expect(syncResponse.status).toBe(200);
    currentSyncToken = syncResponse.body.new_sync_token;

    expectedResponse = {
      new_sync_token: currentSyncToken,
      unsynced_books: {
        file: [bookId2, bookId3],
        metadata: [bookId3],
        cover: [bookId3],
        state: [],
        annotations: [],
        deleted: [bookId]
      },
      unsynced_shelves: {
        metadata: [],
        contents: [],
        deleted: []
      }
    };

    expect(syncResponse.body).toEqual(expectedResponse);
  });

  test('Deleted shelves', async () => {
    const { response: registerResponse, username, password } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;
    const jwtToken = registerResponse.body.jwt_token;

    const loginResponse = await loginUser(username, password);
    expect(loginResponse.status).toBe(200);
    const jwtToken2 = loginResponse.body.jwt_token;

    const uploadResponse = await uploadBook(userId, 'Alices_Adventures_in_Wonderland.epub', { jwt: jwtToken });
    expect(uploadResponse.status).toBe(200);
    const bookId = uploadResponse.text;
    await wait(1);

    const addShelfResponse = await createShelf('shelf', userId, { jwt: jwtToken });
    expect(addShelfResponse.status).toBe(200);
    const shelfId = addShelfResponse.text;

    const addBookToShelfResponse = await addBookToShelf(shelfId, bookId, { jwt: jwtToken });
    expect(addBookToShelfResponse.status).toBe(204);

    let syncResponse = await sync(userId, undefined, { jwt: jwtToken2 });
    expect(syncResponse.status).toBe(200);
    let currentSyncToken = syncResponse.body.new_sync_token;

    let expectedResponse = {
      new_sync_token: currentSyncToken,
      unsynced_books: {
        file: [bookId],
        metadata: [bookId],
        cover: [bookId],
        state: [],
        annotations: [],
        deleted: [] as string[]
      },
      unsynced_shelves: {
        metadata: [shelfId],
        contents: [shelfId],
        deleted: [] as string[]
      }
    };

    expect(syncResponse.body).toEqual(expectedResponse);

    const deleteShelfResponse = await deleteShelf(shelfId, { jwt: jwtToken });
    expect(deleteShelfResponse.status).toBe(204);

    syncResponse = await sync(userId, undefined, { jwt: jwtToken2 });
    expect(syncResponse.status).toBe(200);
    currentSyncToken = syncResponse.body.new_sync_token;

    expectedResponse = {
      new_sync_token: currentSyncToken,
      unsynced_books: {
        file: [bookId],
        metadata: [bookId],
        cover: [bookId],
        state: [],
        annotations: [],
        deleted: []
      },
      unsynced_shelves: {
        metadata: [],
        contents: [],
        deleted: [shelfId]
      }
    };

    expect(syncResponse.body).toEqual(expectedResponse);

    const addShelfResponse2 = await createShelf('shelf 2', userId, { jwt: jwtToken });
    expect(addShelfResponse2.status).toBe(200);
    const shelfId2 = addShelfResponse2.text;

    syncResponse = await sync(userId, undefined, { jwt: jwtToken2 });
    expect(syncResponse.status).toBe(200);
    currentSyncToken = syncResponse.body.new_sync_token;

    expectedResponse = {
      new_sync_token: currentSyncToken,
      unsynced_books: {
        file: [bookId],
        metadata: [bookId],
        cover: [bookId],
        state: [],
        annotations: [],
        deleted: []
      },
      unsynced_shelves: {
        metadata: [shelfId2],
        contents: [],
        deleted: [shelfId]
      }
    };

    expect(syncResponse.body).toEqual(expectedResponse);
  });

  test('Changed metadata', async () => {
    const { response: registerResponse, username, password } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;
    const jwtToken = registerResponse.body.jwt_token;

    const loginResponse = await loginUser(username, password);
    expect(loginResponse.status).toBe(200);
    const jwtToken2 = loginResponse.body.jwt_token;

    const uploadResponse = await uploadBook(userId, 'Alices_Adventures_in_Wonderland.epub', { jwt: jwtToken });
    expect(uploadResponse.status).toBe(200);
    const bookId = uploadResponse.text;

    // Wait for cover and metadata to be extracted
    await wait(1);

    let syncResponse = await sync(userId, undefined, { jwt: jwtToken2 });
    expect(syncResponse.status).toBe(200);
    let currentSyncToken = syncResponse.body.new_sync_token;

    let expectedResponse = {
      new_sync_token: currentSyncToken,
      unsynced_books: {
        file: [bookId],
        metadata: [bookId],
        cover: [bookId],
        state: [],
        annotations: [],
        deleted: [] as string[]
      },
      unsynced_shelves: {
        metadata: [],
        contents: [],
        deleted: []
      }
    };

    expect(syncResponse.body).toEqual(expectedResponse);

    let metadataResponse = await updateMetadata(bookId, EXAMPLE_METADATA, { jwt: jwtToken });
    expect(metadataResponse.status).toBe(204);

    syncResponse = await sync(userId, currentSyncToken, { jwt: jwtToken2 });
    expect(syncResponse.status).toBe(200);
    currentSyncToken = syncResponse.body.new_sync_token;

    expectedResponse = {
      new_sync_token: currentSyncToken,
      unsynced_books: {
        file: [],
        metadata: [bookId],
        cover: [],
        state: [],
        annotations: [],
        deleted: []
      },
      unsynced_shelves: {
        metadata: [],
        contents: [],
        deleted: []
      }
    };

    expect(syncResponse.body).toEqual(expectedResponse);

    metadataResponse = await patchMetadata(bookId, { title: 'title test' }, { jwt: jwtToken });
    expect(metadataResponse.status).toBe(204);

    syncResponse = await sync(userId, currentSyncToken, { jwt: jwtToken2 });
    expect(syncResponse.status).toBe(200);
    currentSyncToken = syncResponse.body.new_sync_token;

    expectedResponse = {
      new_sync_token: currentSyncToken,
      unsynced_books: {
        file: [],
        metadata: [bookId],
        cover: [],
        state: [],
        annotations: [],
        deleted: []
      },
      unsynced_shelves: {
        metadata: [],
        contents: [],
        deleted: []
      }
    };

    expect(syncResponse.body).toEqual(expectedResponse);

    metadataResponse = await deleteMetadata(bookId, { jwt: jwtToken });
    expect(metadataResponse.status).toBe(204);

    syncResponse = await sync(userId, currentSyncToken, { jwt: jwtToken2 });
    expect(syncResponse.status).toBe(200);
    currentSyncToken = syncResponse.body.new_sync_token;

    expectedResponse = {
      new_sync_token: currentSyncToken,
      unsynced_books: {
        file: [],
        metadata: [bookId],
        cover: [],
        state: [],
        annotations: [],
        deleted: []
      },
      unsynced_shelves: {
        metadata: [],
        contents: [],
        deleted: []
      }
    };

    expect(syncResponse.body).toEqual(expectedResponse);
  });

  test('Changed cover', async () => {
    const { response: registerResponse, username, password } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;
    const jwtToken = registerResponse.body.jwt_token;

    const loginResponse = await loginUser(username, password);
    expect(loginResponse.status).toBe(200);
    const jwtToken2 = loginResponse.body.jwt_token;

    const uploadResponse = await uploadBook(userId, 'Alices_Adventures_in_Wonderland.epub', { jwt: jwtToken });
    expect(uploadResponse.status).toBe(200);
    const bookId = uploadResponse.text;

    // Wait for cover and metadata to be extracted
    await wait(1);

    let syncResponse = await sync(userId, undefined, { jwt: jwtToken2 });
    expect(syncResponse.status).toBe(200);
    let currentSyncToken = syncResponse.body.new_sync_token;

    let expectedResponse = {
      new_sync_token: currentSyncToken,
      unsynced_books: {
        file: [bookId],
        metadata: [bookId],
        cover: [bookId],
        state: [],
        annotations: [],
        deleted: [] as string[]
      },
      unsynced_shelves: {
        metadata: [],
        contents: [],
        deleted: []
      }
    };

    expect(syncResponse.body).toEqual(expectedResponse);

    let coverResponse = await updateCover(bookId, 'Generic.jpeg', { jwt: jwtToken });
    expect(coverResponse.status).toBe(204);

    syncResponse = await sync(userId, currentSyncToken, { jwt: jwtToken2 });
    expect(syncResponse.status).toBe(200);
    currentSyncToken = syncResponse.body.new_sync_token;

    expectedResponse = {
      new_sync_token: currentSyncToken,
      unsynced_books: {
        file: [],
        metadata: [],
        cover: [bookId],
        state: [],
        annotations: [],
        deleted: []
      },
      unsynced_shelves: {
        metadata: [],
        contents: [],
        deleted: []
      }
    };

    expect(syncResponse.body).toEqual(expectedResponse);

    coverResponse = await deleteCover(bookId, { jwt: jwtToken });
    expect(coverResponse.status).toBe(204);

    syncResponse = await sync(userId, currentSyncToken, { jwt: jwtToken2 });
    expect(syncResponse.status).toBe(200);
    currentSyncToken = syncResponse.body.new_sync_token;

    expectedResponse = {
      new_sync_token: currentSyncToken,
      unsynced_books: {
        file: [],
        metadata: [],
        cover: [bookId],
        state: [],
        annotations: [],
        deleted: []
      },
      unsynced_shelves: {
        metadata: [],
        contents: [],
        deleted: []
      }
    };

    expect(syncResponse.body).toEqual(expectedResponse);
  });

  test('Changed state', async () => {
    const { response: registerResponse, username, password } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;
    const jwtToken = registerResponse.body.jwt_token;

    const loginResponse = await loginUser(username, password);
    expect(loginResponse.status).toBe(200);
    const jwtToken2 = loginResponse.body.jwt_token;

    const uploadResponse = await uploadBook(userId, 'Alices_Adventures_in_Wonderland.epub', { jwt: jwtToken });
    expect(uploadResponse.status).toBe(200);
    const bookId = uploadResponse.text;

    // Wait for cover and metadata to be extracted
    await wait(1);

    let syncResponse = await sync(userId, undefined, { jwt: jwtToken2 });
    expect(syncResponse.status).toBe(200);
    let currentSyncToken = syncResponse.body.new_sync_token;

    let expectedResponse = {
      new_sync_token: currentSyncToken,
      unsynced_books: {
        file: [bookId],
        metadata: [bookId],
        cover: [bookId],
        state: [] as string[],
        annotations: [],
        deleted: [] as string[]
      },
      unsynced_shelves: {
        metadata: [],
        contents: [],
        deleted: []
      }
    };

    expect(syncResponse.body).toEqual(expectedResponse);

    let stateResponse = await updateState(bookId, ALICE_STATE, { jwt: jwtToken });
    expect(stateResponse.status).toBe(204);

    syncResponse = await sync(userId, currentSyncToken, { jwt: jwtToken2 });
    expect(syncResponse.status).toBe(200);
    currentSyncToken = syncResponse.body.new_sync_token;

    expectedResponse = {
      new_sync_token: currentSyncToken,
      unsynced_books: {
        file: [],
        metadata: [],
        cover: [],
        state: [bookId],
        annotations: [],
        deleted: []
      },
      unsynced_shelves: {
        metadata: [],
        contents: [],
        deleted: []
      }
    };

    expect(syncResponse.body).toEqual(expectedResponse);

    stateResponse = await patchState(bookId, { statistics: { reading_status: 'Read' } }, { jwt: jwtToken });
    expect(stateResponse.status).toBe(204);

    syncResponse = await sync(userId, currentSyncToken, { jwt: jwtToken2 });
    expect(syncResponse.status).toBe(200);
    currentSyncToken = syncResponse.body.new_sync_token;

    expectedResponse = {
      new_sync_token: currentSyncToken,
      unsynced_books: {
        file: [],
        metadata: [],
        cover: [],
        state: [bookId],
        annotations: [],
        deleted: []
      },
      unsynced_shelves: {
        metadata: [],
        contents: [],
        deleted: []
      }
    };

    expect(syncResponse.body).toEqual(expectedResponse);
  });

  test('Changed annotations', async () => {
    const { response: registerResponse, username, password } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;
    const jwtToken = registerResponse.body.jwt_token;

    const loginResponse = await loginUser(username, password);
    expect(loginResponse.status).toBe(200);
    const jwtToken2 = loginResponse.body.jwt_token;

    const uploadResponse = await uploadBook(userId, 'Alices_Adventures_in_Wonderland.epub', { jwt: jwtToken });
    expect(uploadResponse.status).toBe(200);
    const bookId = uploadResponse.text;

    // Wait for cover and metadata to be extracted
    await wait(1);

    let syncResponse = await sync(userId, undefined, { jwt: jwtToken2 });
    expect(syncResponse.status).toBe(200);
    let currentSyncToken = syncResponse.body.new_sync_token;

    let expectedResponse = {
      new_sync_token: currentSyncToken,
      unsynced_books: {
        file: [bookId],
        metadata: [bookId],
        cover: [bookId],
        state: [],
        annotations: [] as string[],
        deleted: [] as string[]
      },
      unsynced_shelves: {
        metadata: [],
        contents: [],
        deleted: []
      }
    };

    expect(syncResponse.body).toEqual(expectedResponse);

    const addAnnotationResponse = await addAnnotation(bookId, ALICE_NOTE, { jwt: jwtToken });
    expect(addAnnotationResponse.status).toBe(200);
    const annotationId = addAnnotationResponse.text;

    syncResponse = await sync(userId, currentSyncToken, { jwt: jwtToken2 });
    expect(syncResponse.status).toBe(200);
    currentSyncToken = syncResponse.body.new_sync_token;

    expectedResponse = {
      new_sync_token: currentSyncToken,
      unsynced_books: {
        file: [],
        metadata: [],
        cover: [],
        state: [],
        annotations: [bookId],
        deleted: []
      },
      unsynced_shelves: {
        metadata: [],
        contents: [],
        deleted: []
      }
    };

    expect(syncResponse.body).toEqual(expectedResponse);

    let annotationResponse = await patchAnnotation(bookId, annotationId, 'note', { jwt: jwtToken });
    expect(annotationResponse.status).toBe(204);

    syncResponse = await sync(userId, currentSyncToken, { jwt: jwtToken2 });
    expect(syncResponse.status).toBe(200);
    currentSyncToken = syncResponse.body.new_sync_token;

    expectedResponse = {
      new_sync_token: currentSyncToken,
      unsynced_books: {
        file: [],
        metadata: [],
        cover: [],
        state: [],
        annotations: [bookId],
        deleted: []
      },
      unsynced_shelves: {
        metadata: [],
        contents: [],
        deleted: []
      }
    };

    expect(syncResponse.body).toEqual(expectedResponse);

    annotationResponse = await deleteAnnotation(bookId, annotationId, { jwt: jwtToken });
    expect(annotationResponse.status).toBe(204);

    syncResponse = await sync(userId, currentSyncToken, { jwt: jwtToken2 });
    expect(syncResponse.status).toBe(200);
    currentSyncToken = syncResponse.body.new_sync_token;

    expectedResponse = {
      new_sync_token: currentSyncToken,
      unsynced_books: {
        file: [],
        metadata: [],
        cover: [],
        state: [],
        annotations: [bookId],
        deleted: []
      },
      unsynced_shelves: {
        metadata: [],
        contents: [],
        deleted: []
      }
    };

    expect(syncResponse.body).toEqual(expectedResponse);
  });

  test('Changed shelf books', async () => {
    const { response: registerResponse, username, password } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;
    const jwtToken = registerResponse.body.jwt_token;

    const loginResponse = await loginUser(username, password);
    expect(loginResponse.status).toBe(200);
    const jwtToken2 = loginResponse.body.jwt_token;

    const uploadResponse = await uploadBook(userId, 'Alices_Adventures_in_Wonderland.epub', { jwt: jwtToken });
    expect(uploadResponse.status).toBe(200);
    const bookId = uploadResponse.text;

    // Wait for cover and metadata to be extracted
    await wait(1);

    const addShelfResponse = await createShelf('shelf', userId, { jwt: jwtToken });
    expect(addShelfResponse.status).toBe(200);
    const shelfId = addShelfResponse.text;

    let syncResponse = await sync(userId, undefined, { jwt: jwtToken2 });
    expect(syncResponse.status).toBe(200);
    let currentSyncToken = syncResponse.body.new_sync_token;

    let expectedResponse = {
      new_sync_token: currentSyncToken,
      unsynced_books: {
        file: [bookId],
        metadata: [bookId],
        cover: [bookId],
        state: [],
        annotations: [] as string[],
        deleted: [] as string[]
      },
      unsynced_shelves: {
        metadata: [shelfId],
        contents: [] as string[],
        deleted: []
      }
    };

    expect(syncResponse.body).toEqual(expectedResponse);

    const addBookToShelfResponse = await addBookToShelf(shelfId, bookId, { jwt: jwtToken });
    expect(addBookToShelfResponse.status).toBe(204);

    syncResponse = await sync(userId, currentSyncToken, { jwt: jwtToken2 });
    expect(syncResponse.status).toBe(200);
    currentSyncToken = syncResponse.body.new_sync_token;

    expectedResponse = {
      new_sync_token: currentSyncToken,
      unsynced_books: {
        file: [],
        metadata: [],
        cover: [],
        state: [],
        annotations: [],
        deleted: []
      },
      unsynced_shelves: {
        metadata: [],
        contents: [shelfId],
        deleted: []
      }
    };

    expect(syncResponse.body).toEqual(expectedResponse);

    const removeBookFromShelfResponse = await deleteBookFromShelf(shelfId, bookId, { jwt: jwtToken });
    expect(removeBookFromShelfResponse.status).toBe(204);

    syncResponse = await sync(userId, currentSyncToken, { jwt: jwtToken2 });
    expect(syncResponse.status).toBe(200);
    currentSyncToken = syncResponse.body.new_sync_token;

    expectedResponse = {
      new_sync_token: currentSyncToken,
      unsynced_books: {
        file: [],
        metadata: [],
        cover: [],
        state: [],
        annotations: [],
        deleted: []
      },
      unsynced_shelves: {
        metadata: [],
        contents: [shelfId],
        deleted: []
      }
    };

    expect(syncResponse.body).toEqual(expectedResponse);
  });

  test('Different users', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;
    const jwtToken = registerResponse.body.jwt_token;

    const uploadResponse = await uploadBook(userId, 'Alices_Adventures_in_Wonderland.epub', { jwt: jwtToken });
    expect(uploadResponse.status).toBe(200);

    // Wait for cover and metadata to be extracted
    await wait(1);

    const addShelfResponse = await createShelf('shelf', userId, { jwt: jwtToken });
    expect(addShelfResponse.status).toBe(200);

    const addBookToShelfResponse = await addBookToShelf(addShelfResponse.text, uploadResponse.text, { jwt: jwtToken });
    expect(addBookToShelfResponse.status).toBe(204);

    const { response: registerResponse2 } = await registerUser();
    expect(registerResponse2.status).toBe(200);
    const userId2 = registerResponse2.body.user_id;
    const jwtToken2 = registerResponse2.body.jwt_token;

    const uploadResponse2 = await uploadBook(userId2, 'The_Wonderful_Wizard_of_Oz.epub', { jwt: jwtToken2 });
    expect(uploadResponse2.status).toBe(200);

    // Wait for cover and metadata to be extracted
    await wait(1);

    const addShelfResponse2 = await createShelf('shelf', userId2, { jwt: jwtToken2 });
    expect(addShelfResponse2.status).toBe(200);

    const addBookToShelfResponse2 = await addBookToShelf(addShelfResponse2.text, uploadResponse2.text, { jwt: jwtToken2 });
    expect(addBookToShelfResponse2.status).toBe(204);

    let syncResponse = await sync(userId, undefined, { jwt: jwtToken });
    expect(syncResponse.status).toBe(200);
    let currentSyncToken = syncResponse.body.new_sync_token;

    let expectedResponse = {
      new_sync_token: currentSyncToken,
      unsynced_books: {
        file: [],
        metadata: [uploadResponse.text],
        cover: [uploadResponse.text],
        state: [],
        annotations: [],
        deleted: [] as string[]
      },
      unsynced_shelves: {
        metadata: [],
        contents: [],
        deleted: [] as string[]
      }
    };

    expect(syncResponse.body).toEqual(expectedResponse);

    syncResponse = await sync(userId2, undefined, { jwt: jwtToken2 });
    expect(syncResponse.status).toBe(200);
    currentSyncToken = syncResponse.body.new_sync_token;

    expectedResponse = {
      new_sync_token: currentSyncToken,
      unsynced_books: {
        file: [],
        metadata: [uploadResponse2.text],
        cover: [uploadResponse2.text],
        state: [],
        annotations: [],
        deleted: []
      },
      unsynced_shelves: {
        metadata: [],
        contents: [],
        deleted: []
      }
    };

    expect(syncResponse.body).toEqual(expectedResponse);
  });

  test('Invalid sync token', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    let syncResponse = await sync(userId, 'not valid', { jwt: registerResponse.body.jwt_token });
    expect(syncResponse.status).toBe(400);
    expect(syncResponse.text).toBe(INVALID_SYNC_TOKEN);
  });

  test('Non-existent user', async () => {
    const { response: registerResponse } = await registerUser(undefined, undefined, true, process.env.ADMIN_KEY);
    expect(registerResponse.status).toBe(200);

    let syncResponse = await sync('non-existent', undefined, { jwt: registerResponse.body.jwt_token });
    expect(syncResponse.status).toBe(404);
    expect(syncResponse.text).toBe(USER_NOT_FOUND);
  });

  test('Different user without permission', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const { response: registerResponse2 } = await registerUser();
    expect(registerResponse2.status).toBe(200);

    let syncResponse = await sync(userId, undefined, { jwt: registerResponse2.body.jwt_token });
    expect(syncResponse.status).toBe(403);
    expect(syncResponse.text).toBe(FORBIDDEN);
  });

  test('Different user with permission', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const { response: registerResponse2 } = await registerUser(undefined, undefined, true, process.env.ADMIN_KEY);
    expect(registerResponse2.status).toBe(200);

    let syncResponse = await sync(userId, undefined, { jwt: registerResponse2.body.jwt_token });
    expect(syncResponse.status).toBe(200);
  });

  test('No auth', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    let syncResponse = await sync(userId);
    expect(syncResponse.status).toBe(401);
    expect(syncResponse.text).toBe(UNAUTHORIZED);
  });
});

describe('Sync api key', () => {
  test('Same session', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;
    const jwtToken = registerResponse.body.jwt_token;

    const createApiKeyResponse = await createApiKey(userId, 'Test Key', ['Create', 'Read', 'Update', 'Delete'], undefined, { jwt: jwtToken });
    expect(createApiKeyResponse.status).toBe(200);
    const apiKey = createApiKeyResponse.body.key;

    let syncResponse = await sync(userId, undefined, { apiKey });
    expect(syncResponse.status).toBe(200);
    let currentSyncToken = syncResponse.body.new_sync_token;
    expect(typeof currentSyncToken).toBe('number');

    expect(syncResponse.body).toEqual({
      new_sync_token: currentSyncToken,
      unsynced_books: {
        file: [],
        metadata: [],
        cover: [],
        state: [],
        annotations: [],
        deleted: []
      },
      unsynced_shelves: {
        metadata: [],
        contents: [],
        deleted: []
      }
    });

    const uploadResponse = await uploadBook(userId, 'Alices_Adventures_in_Wonderland.epub', { apiKey });
    expect(uploadResponse.status).toBe(200);
    const bookId = uploadResponse.text;
    await wait(1);

    syncResponse = await sync(userId, currentSyncToken, { apiKey });
    expect(syncResponse.status).toBe(200);
    currentSyncToken = syncResponse.body.new_sync_token;

    expect(syncResponse.body).toEqual({
      new_sync_token: currentSyncToken,
      unsynced_books: {
        file: [],
        // metadata and cover are asynchronous
        metadata: [bookId],
        cover: [bookId],
        state: [],
        annotations: [],
        deleted: []
      },
      unsynced_shelves: {
        metadata: [],
        contents: [],
        deleted: []
      }
    });

    const addShelfResponse = await createShelf('shelf', userId, { apiKey });
    expect(addShelfResponse.status).toBe(200);

    syncResponse = await sync(userId, currentSyncToken, { apiKey });
    expect(syncResponse.status).toBe(200);
    const oldSyncToken = currentSyncToken;

    expect(syncResponse.body).toEqual({
      new_sync_token: syncResponse.body.new_sync_token,
      unsynced_books: {
        file: [],
        metadata: [],
        cover: [],
        state: [],
        annotations: [],
        deleted: []
      },
      unsynced_shelves: {
        metadata: [],
        contents: [],
        deleted: []
      }
    });

    const uploadResponse2 = await uploadBook(userId, 'The_Wonderful_Wizard_of_Oz.epub', { apiKey });
    expect(uploadResponse2.status).toBe(200);
    const bookId2 = uploadResponse2.text;
    await wait(1);

    syncResponse = await sync(userId, oldSyncToken, { apiKey });
    expect(syncResponse.status).toBe(200);

    expect(syncResponse.body).toEqual({
      new_sync_token: syncResponse.body.new_sync_token,
      unsynced_books: {
        file: [],
        metadata: [bookId2],
        cover: [bookId2],
        state: [],
        annotations: [],
        deleted: []
      },
      unsynced_shelves: {
        metadata: [],
        contents: [],
        deleted: []
      }
    });

    syncResponse = await sync(userId, undefined, { apiKey });
    expect(syncResponse.status).toBe(200);
    currentSyncToken = syncResponse.body.new_sync_token;

    expect(syncResponse.body).toEqual({
      new_sync_token: currentSyncToken,
      unsynced_books: {
        file: [],
        metadata: [bookId, bookId2],
        cover: [bookId, bookId2],
        state: [],
        annotations: [],
        deleted: []
      },
      unsynced_shelves: {
        metadata: [],
        contents: [],
        deleted: []
      }
    });

    const addBookToShelfResponse = await addBookToShelf(addShelfResponse.text, uploadResponse.text, { apiKey });
    expect(addBookToShelfResponse.status).toBe(204);

    syncResponse = await sync(userId, currentSyncToken, { apiKey });
    expect(syncResponse.status).toBe(200);

    expect(syncResponse.body).toEqual({
      new_sync_token: syncResponse.body.new_sync_token,
      unsynced_books: {
        file: [],
        metadata: [],
        cover: [],
        state: [],
        annotations: [],
        deleted: []
      },
      unsynced_shelves: {
        metadata: [],
        contents: [],
        deleted: []
      }
    });
  });

  test('Different session', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;
    const jwtToken = registerResponse.body.jwt_token;

    const createApiKeyResponse = await createApiKey(userId, 'Test Key', ['Create', 'Read', 'Update', 'Delete'], undefined, { jwt: jwtToken });
    expect(createApiKeyResponse.status).toBe(200);
    const apiKey = createApiKeyResponse.body.key;

    const createApiKeyResponse2 = await createApiKey(userId, 'Test Key 2', ['Create', 'Read', 'Update', 'Delete'], undefined, { jwt: jwtToken });
    expect(createApiKeyResponse2.status).toBe(200);
    const apiKey2 = createApiKeyResponse2.body.key;

    let syncResponse = await sync(userId, undefined, { apiKey });
    expect(syncResponse.status).toBe(200);
    let currentSyncToken = syncResponse.body.new_sync_token;
    expect(typeof currentSyncToken).toBe('number');

    expect(syncResponse.body).toEqual({
      new_sync_token: currentSyncToken,
      unsynced_books: {
        file: [],
        metadata: [],
        cover: [],
        state: [],
        annotations: [],
        deleted: []
      },
      unsynced_shelves: {
        metadata: [],
        contents: [],
        deleted: []
      }
    });

    const uploadResponse = await uploadBook(userId, 'Alices_Adventures_in_Wonderland.epub', { apiKey: apiKey2 });
    expect(uploadResponse.status).toBe(200);
    const bookId = uploadResponse.text;
    await wait(1);

    syncResponse = await sync(userId, currentSyncToken, { apiKey });
    expect(syncResponse.status).toBe(200);
    currentSyncToken = syncResponse.body.new_sync_token;

    expect(syncResponse.body).toEqual({
      new_sync_token: currentSyncToken,
      unsynced_books: {
        file: [bookId],
        metadata: [bookId],
        cover: [bookId],
        state: [],
        annotations: [],
        deleted: []
      },
      unsynced_shelves: {
        metadata: [],
        contents: [],
        deleted: []
      }
    });

    let addShelfResponse = await createShelf('shelf', userId, { apiKey: apiKey2 });
    expect(addShelfResponse.status).toBe(200);
    const shelfId = addShelfResponse.text;

    syncResponse = await sync(userId, currentSyncToken, { apiKey });
    expect(syncResponse.status).toBe(200);
    const oldSyncToken = currentSyncToken;

    expect(syncResponse.body).toEqual({
      new_sync_token: syncResponse.body.new_sync_token,
      unsynced_books: {
        file: [],
        metadata: [],
        cover: [],
        state: [],
        annotations: [],
        deleted: []
      },
      unsynced_shelves: {
        metadata: [shelfId],
        contents: [],
        deleted: []
      }
    });

    const uploadResponse2 = await uploadBook(userId, 'The_Wonderful_Wizard_of_Oz.epub', { apiKey: apiKey2 });
    expect(uploadResponse2.status).toBe(200);
    const bookId2 = uploadResponse2.text;
    await wait(1);

    syncResponse = await sync(userId, oldSyncToken, { apiKey });
    expect(syncResponse.status).toBe(200);

    expect(syncResponse.body).toEqual({
      new_sync_token: syncResponse.body.new_sync_token,
      unsynced_books: {
        file: [bookId2],
        metadata: [bookId2],
        cover: [bookId2],
        state: [],
        annotations: [],
        deleted: []
      },
      unsynced_shelves: {
        metadata: [shelfId],
        contents: [],
        deleted: []
      }
    });

    syncResponse = await sync(userId, undefined, { apiKey });
    expect(syncResponse.status).toBe(200);
    currentSyncToken = syncResponse.body.new_sync_token;

    expect(syncResponse.body).toEqual({
      new_sync_token: currentSyncToken,
      unsynced_books: {
        file: [bookId, bookId2],
        metadata: [bookId, bookId2],
        cover: [bookId, bookId2],
        state: [],
        annotations: [],
        deleted: []
      },
      unsynced_shelves: {
        metadata: [shelfId],
        contents: [],
        deleted: []
      }
    });

    const addBookToShelfResponse = await addBookToShelf(addShelfResponse.text, uploadResponse.text, { apiKey: apiKey2 });
    expect(addBookToShelfResponse.status).toBe(204);

    syncResponse = await sync(userId, currentSyncToken, { apiKey });
    expect(syncResponse.status).toBe(200);

    expect(syncResponse.body).toEqual({
      new_sync_token: syncResponse.body.new_sync_token,
      unsynced_books: {
        file: [],
        metadata: [],
        cover: [],
        state: [],
        annotations: [],
        deleted: []
      },
      unsynced_shelves: {
        metadata: [],
        contents: [shelfId],
        deleted: []
      }
    });
  });

  test('Implicit users', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;
    const jwtToken = registerResponse.body.jwt_token;

    const createApiKeyResponse = await createApiKey(userId, 'Test Key', ['Create', 'Read', 'Update', 'Delete'], undefined, { jwt: jwtToken });
    expect(createApiKeyResponse.status).toBe(200);
    const apiKey = createApiKeyResponse.body.key;

    const uploadResponse = await uploadBook(userId, 'Alices_Adventures_in_Wonderland.epub', { apiKey });
    expect(uploadResponse.status).toBe(200);
    const bookId = uploadResponse.text;
    await wait(1);

    const syncResponse = await sync(undefined, undefined, { apiKey });
    expect(syncResponse.status).toBe(200);
    const currentSyncToken = syncResponse.body.new_sync_token;

    const expectedResponse = {
      new_sync_token: currentSyncToken,
      unsynced_books: {
        file: [],
        metadata: [bookId],
        cover: [bookId],
        state: [],
        annotations: [],
        deleted: []
      },
      unsynced_shelves: {
        metadata: [],
        contents: [],
        deleted: []
      }
    };

    expect(syncResponse.body).toEqual(expectedResponse);
  });

  test('Deleted book files', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;
    const jwtToken = registerResponse.body.jwt_token;

    const createApiKeyResponse = await createApiKey(userId, 'Test Key', ['Create', 'Read', 'Update', 'Delete'], undefined, { jwt: jwtToken });
    expect(createApiKeyResponse.status).toBe(200);
    const apiKey = createApiKeyResponse.body.key;

    const uploadResponse = await uploadBook(userId, 'Alices_Adventures_in_Wonderland.epub', { jwt: jwtToken });
    expect(uploadResponse.status).toBe(200);
    const bookId = uploadResponse.text;
    await wait(1);

    let syncResponse = await sync(userId, undefined, { apiKey });
    expect(syncResponse.status).toBe(200);
    let currentSyncToken = syncResponse.body.new_sync_token;

    let expectedResponse = {
      new_sync_token: currentSyncToken,
      unsynced_books: {
        file: [bookId],
        metadata: [bookId],
        cover: [bookId],
        state: [],
        annotations: [],
        deleted: [] as string[]
      },
      unsynced_shelves: {
        metadata: [],
        contents: [],
        deleted: []
      }
    };

    expect(syncResponse.body).toEqual(expectedResponse);

    const deleteResponse = await deleteBook(uploadResponse.text, { jwt: jwtToken });
    expect(deleteResponse.status).toBe(204);

    syncResponse = await sync(userId, undefined, { apiKey });
    expect(syncResponse.status).toBe(200);
    currentSyncToken = syncResponse.body.new_sync_token;

    expectedResponse = {
      new_sync_token: currentSyncToken,
      unsynced_books: {
        file: [],
        metadata: [],
        cover: [],
        state: [],
        annotations: [],
        deleted: [bookId]
      },
      unsynced_shelves: {
        metadata: [],
        contents: [],
        deleted: []
      }
    };

    expect(syncResponse.body).toEqual(expectedResponse);

    // This book has no metadata nor cover
    const uploadResponse2 = await uploadBook(userId, 'The_Great_Gatsby.epub', { jwt: jwtToken });
    expect(uploadResponse2.status).toBe(200);
    const bookId2 = uploadResponse2.text;
    await wait(1);

    const uploadResponse3 = await uploadBook(userId, 'The_Wonderful_Wizard_of_Oz.epub', { jwt: jwtToken });
    expect(uploadResponse3.status).toBe(200);
    const bookId3 = uploadResponse3.text;
    await wait(1);

    syncResponse = await sync(userId, undefined, { apiKey });
    expect(syncResponse.status).toBe(200);
    currentSyncToken = syncResponse.body.new_sync_token;

    expectedResponse = {
      new_sync_token: currentSyncToken,
      unsynced_books: {
        file: [bookId2, bookId3],
        metadata: [bookId3],
        cover: [bookId3],
        state: [],
        annotations: [],
        deleted: [bookId]
      },
      unsynced_shelves: {
        metadata: [],
        contents: [],
        deleted: []
      }
    };

    expect(syncResponse.body).toEqual(expectedResponse);
  });

  test('Deleted shelves', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;
    const jwtToken = registerResponse.body.jwt_token;

    const createApiKeyResponse = await createApiKey(userId, 'Test Key', ['Create', 'Read', 'Update', 'Delete'], undefined, { jwt: jwtToken });
    expect(createApiKeyResponse.status).toBe(200);
    const apiKey = createApiKeyResponse.body.key;

    const uploadResponse = await uploadBook(userId, 'Alices_Adventures_in_Wonderland.epub', { jwt: jwtToken });
    expect(uploadResponse.status).toBe(200);
    const bookId = uploadResponse.text;
    await wait(1);

    const addShelfResponse = await createShelf('shelf', userId, { jwt: jwtToken });
    expect(addShelfResponse.status).toBe(200);
    const shelfId = addShelfResponse.text;

    const addBookToShelfResponse = await addBookToShelf(shelfId, bookId, { jwt: jwtToken });
    expect(addBookToShelfResponse.status).toBe(204);

    let syncResponse = await sync(userId, undefined, { apiKey });
    expect(syncResponse.status).toBe(200);
    let currentSyncToken = syncResponse.body.new_sync_token;

    let expectedResponse = {
      new_sync_token: currentSyncToken,
      unsynced_books: {
        file: [bookId],
        metadata: [bookId],
        cover: [bookId],
        state: [],
        annotations: [],
        deleted: [] as string[]
      },
      unsynced_shelves: {
        metadata: [shelfId],
        contents: [shelfId],
        deleted: [] as string[]
      }
    };

    expect(syncResponse.body).toEqual(expectedResponse);

    const deleteShelfResponse = await deleteShelf(shelfId, { jwt: jwtToken });
    expect(deleteShelfResponse.status).toBe(204);

    syncResponse = await sync(userId, undefined, { apiKey });
    expect(syncResponse.status).toBe(200);
    currentSyncToken = syncResponse.body.new_sync_token;

    expectedResponse = {
      new_sync_token: currentSyncToken,
      unsynced_books: {
        file: [bookId],
        metadata: [bookId],
        cover: [bookId],
        state: [],
        annotations: [],
        deleted: []
      },
      unsynced_shelves: {
        metadata: [],
        contents: [],
        deleted: [shelfId]
      }
    };

    expect(syncResponse.body).toEqual(expectedResponse);

    const addShelfResponse2 = await createShelf('shelf 2', userId, { jwt: jwtToken });
    expect(addShelfResponse2.status).toBe(200);
    const shelfId2 = addShelfResponse2.text;

    syncResponse = await sync(userId, undefined, { apiKey });
    expect(syncResponse.status).toBe(200);
    currentSyncToken = syncResponse.body.new_sync_token;

    expectedResponse = {
      new_sync_token: currentSyncToken,
      unsynced_books: {
        file: [bookId],
        metadata: [bookId],
        cover: [bookId],
        state: [],
        annotations: [],
        deleted: []
      },
      unsynced_shelves: {
        metadata: [shelfId2],
        contents: [],
        deleted: [shelfId]
      }
    };

    expect(syncResponse.body).toEqual(expectedResponse);
  });

  test('Changed metadata', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;
    const jwtToken = registerResponse.body.jwt_token;

    const createApiKeyResponse = await createApiKey(userId, 'Test Key', ['Create', 'Read', 'Update', 'Delete'], undefined, { jwt: jwtToken });
    expect(createApiKeyResponse.status).toBe(200);
    const apiKey = createApiKeyResponse.body.key;

    const uploadResponse = await uploadBook(userId, 'Alices_Adventures_in_Wonderland.epub', { jwt: jwtToken });
    expect(uploadResponse.status).toBe(200);
    const bookId = uploadResponse.text;

    // Wait for cover and metadata to be extracted
    await wait(1);

    let syncResponse = await sync(userId, undefined, { apiKey });
    expect(syncResponse.status).toBe(200);
    let currentSyncToken = syncResponse.body.new_sync_token;

    let expectedResponse = {
      new_sync_token: currentSyncToken,
      unsynced_books: {
        file: [bookId],
        metadata: [bookId],
        cover: [bookId],
        state: [],
        annotations: [],
        deleted: [] as string[]
      },
      unsynced_shelves: {
        metadata: [],
        contents: [],
        deleted: []
      }
    };

    expect(syncResponse.body).toEqual(expectedResponse);

    let metadataResponse = await updateMetadata(bookId, EXAMPLE_METADATA, { jwt: jwtToken });
    expect(metadataResponse.status).toBe(204);

    syncResponse = await sync(userId, currentSyncToken, { apiKey });
    expect(syncResponse.status).toBe(200);
    currentSyncToken = syncResponse.body.new_sync_token;

    expectedResponse = {
      new_sync_token: currentSyncToken,
      unsynced_books: {
        file: [],
        metadata: [bookId],
        cover: [],
        state: [],
        annotations: [],
        deleted: []
      },
      unsynced_shelves: {
        metadata: [],
        contents: [],
        deleted: []
      }
    };

    expect(syncResponse.body).toEqual(expectedResponse);

    metadataResponse = await patchMetadata(bookId, { title: 'title test' }, { jwt: jwtToken });
    expect(metadataResponse.status).toBe(204);

    syncResponse = await sync(userId, currentSyncToken, { apiKey });
    expect(syncResponse.status).toBe(200);
    currentSyncToken = syncResponse.body.new_sync_token;

    expectedResponse = {
      new_sync_token: currentSyncToken,
      unsynced_books: {
        file: [],
        metadata: [bookId],
        cover: [],
        state: [],
        annotations: [],
        deleted: []
      },
      unsynced_shelves: {
        metadata: [],
        contents: [],
        deleted: []
      }
    };

    expect(syncResponse.body).toEqual(expectedResponse);

    metadataResponse = await deleteMetadata(bookId, { jwt: jwtToken });
    expect(metadataResponse.status).toBe(204);

    syncResponse = await sync(userId, currentSyncToken, { apiKey });
    expect(syncResponse.status).toBe(200);
    currentSyncToken = syncResponse.body.new_sync_token;

    expectedResponse = {
      new_sync_token: currentSyncToken,
      unsynced_books: {
        file: [],
        metadata: [bookId],
        cover: [],
        state: [],
        annotations: [],
        deleted: []
      },
      unsynced_shelves: {
        metadata: [],
        contents: [],
        deleted: []
      }
    };

    expect(syncResponse.body).toEqual(expectedResponse);
  });

  test('Changed cover', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;
    const jwtToken = registerResponse.body.jwt_token;

    const createApiKeyResponse = await createApiKey(userId, 'Test Key', ['Create', 'Read', 'Update', 'Delete'], undefined, { jwt: jwtToken });
    expect(createApiKeyResponse.status).toBe(200);
    const apiKey = createApiKeyResponse.body.key;

    const uploadResponse = await uploadBook(userId, 'Alices_Adventures_in_Wonderland.epub', { jwt: jwtToken });
    expect(uploadResponse.status).toBe(200);
    const bookId = uploadResponse.text;

    // Wait for cover and metadata to be extracted
    await wait(1);

    let syncResponse = await sync(userId, undefined, { apiKey });
    expect(syncResponse.status).toBe(200);
    let currentSyncToken = syncResponse.body.new_sync_token;

    let expectedResponse = {
      new_sync_token: currentSyncToken,
      unsynced_books: {
        file: [bookId],
        metadata: [bookId],
        cover: [bookId],
        state: [],
        annotations: [],
        deleted: [] as string[]
      },
      unsynced_shelves: {
        metadata: [],
        contents: [],
        deleted: []
      }
    };

    expect(syncResponse.body).toEqual(expectedResponse);

    let coverResponse = await updateCover(bookId, 'Generic.jpeg', { jwt: jwtToken });
    expect(coverResponse.status).toBe(204);

    syncResponse = await sync(userId, currentSyncToken, { apiKey });
    expect(syncResponse.status).toBe(200);
    currentSyncToken = syncResponse.body.new_sync_token;

    expectedResponse = {
      new_sync_token: currentSyncToken,
      unsynced_books: {
        file: [],
        metadata: [],
        cover: [bookId],
        state: [],
        annotations: [],
        deleted: []
      },
      unsynced_shelves: {
        metadata: [],
        contents: [],
        deleted: []
      }
    };

    expect(syncResponse.body).toEqual(expectedResponse);

    coverResponse = await deleteCover(bookId, { jwt: jwtToken });
    expect(coverResponse.status).toBe(204);

    syncResponse = await sync(userId, currentSyncToken, { apiKey });
    expect(syncResponse.status).toBe(200);
    currentSyncToken = syncResponse.body.new_sync_token;

    expectedResponse = {
      new_sync_token: currentSyncToken,
      unsynced_books: {
        file: [],
        metadata: [],
        cover: [bookId],
        state: [],
        annotations: [],
        deleted: []
      },
      unsynced_shelves: {
        metadata: [],
        contents: [],
        deleted: []
      }
    };

    expect(syncResponse.body).toEqual(expectedResponse);
  });

  test('Changed state', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;
    const jwtToken = registerResponse.body.jwt_token;

    const createApiKeyResponse = await createApiKey(userId, 'Test Key', ['Create', 'Read', 'Update', 'Delete'], undefined, { jwt: jwtToken });
    expect(createApiKeyResponse.status).toBe(200);
    const apiKey = createApiKeyResponse.body.key;

    const uploadResponse = await uploadBook(userId, 'Alices_Adventures_in_Wonderland.epub', { jwt: jwtToken });
    expect(uploadResponse.status).toBe(200);
    const bookId = uploadResponse.text;

    // Wait for cover and metadata to be extracted
    await wait(1);

    let syncResponse = await sync(userId, undefined, { apiKey });
    expect(syncResponse.status).toBe(200);
    let currentSyncToken = syncResponse.body.new_sync_token;

    let expectedResponse = {
      new_sync_token: currentSyncToken,
      unsynced_books: {
        file: [bookId],
        metadata: [bookId],
        cover: [bookId],
        state: [] as string[],
        annotations: [],
        deleted: [] as string[]
      },
      unsynced_shelves: {
        metadata: [],
        contents: [],
        deleted: []
      }
    };

    expect(syncResponse.body).toEqual(expectedResponse);

    let stateResponse = await updateState(bookId, ALICE_STATE, { jwt: jwtToken });
    expect(stateResponse.status).toBe(204);

    syncResponse = await sync(userId, currentSyncToken, { apiKey });
    expect(syncResponse.status).toBe(200);
    currentSyncToken = syncResponse.body.new_sync_token;

    expectedResponse = {
      new_sync_token: currentSyncToken,
      unsynced_books: {
        file: [],
        metadata: [],
        cover: [],
        state: [bookId],
        annotations: [],
        deleted: []
      },
      unsynced_shelves: {
        metadata: [],
        contents: [],
        deleted: []
      }
    };

    expect(syncResponse.body).toEqual(expectedResponse);

    stateResponse = await patchState(bookId, { statistics: { reading_status: 'Read' } }, { jwt: jwtToken });
    expect(stateResponse.status).toBe(204);

    syncResponse = await sync(userId, currentSyncToken, { apiKey });
    expect(syncResponse.status).toBe(200);
    currentSyncToken = syncResponse.body.new_sync_token;

    expectedResponse = {
      new_sync_token: currentSyncToken,
      unsynced_books: {
        file: [],
        metadata: [],
        cover: [],
        state: [bookId],
        annotations: [],
        deleted: []
      },
      unsynced_shelves: {
        metadata: [],
        contents: [],
        deleted: []
      }
    };

    expect(syncResponse.body).toEqual(expectedResponse);
  });

  test('Changed annotations', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;
    const jwtToken = registerResponse.body.jwt_token;

    const createApiKeyResponse = await createApiKey(userId, 'Test Key', ['Create', 'Read', 'Update', 'Delete'], undefined, { jwt: jwtToken });
    expect(createApiKeyResponse.status).toBe(200);
    const apiKey = createApiKeyResponse.body.key;

    const uploadResponse = await uploadBook(userId, 'Alices_Adventures_in_Wonderland.epub', { jwt: jwtToken });
    expect(uploadResponse.status).toBe(200);
    const bookId = uploadResponse.text;

    // Wait for cover and metadata to be extracted
    await wait(1);

    let syncResponse = await sync(userId, undefined, { apiKey });
    expect(syncResponse.status).toBe(200);
    let currentSyncToken = syncResponse.body.new_sync_token;

    let expectedResponse = {
      new_sync_token: currentSyncToken,
      unsynced_books: {
        file: [bookId],
        metadata: [bookId],
        cover: [bookId],
        state: [],
        annotations: [] as string[],
        deleted: [] as string[]
      },
      unsynced_shelves: {
        metadata: [],
        contents: [],
        deleted: []
      }
    };

    expect(syncResponse.body).toEqual(expectedResponse);

    const addAnnotationResponse = await addAnnotation(bookId, ALICE_NOTE, { jwt: jwtToken });
    expect(addAnnotationResponse.status).toBe(200);
    const annotationId = addAnnotationResponse.text;

    syncResponse = await sync(userId, currentSyncToken, { apiKey });
    expect(syncResponse.status).toBe(200);
    currentSyncToken = syncResponse.body.new_sync_token;

    expectedResponse = {
      new_sync_token: currentSyncToken,
      unsynced_books: {
        file: [],
        metadata: [],
        cover: [],
        state: [],
        annotations: [bookId],
        deleted: []
      },
      unsynced_shelves: {
        metadata: [],
        contents: [],
        deleted: []
      }
    };

    expect(syncResponse.body).toEqual(expectedResponse);

    let annotationResponse = await patchAnnotation(bookId, annotationId, 'note', { jwt: jwtToken });
    expect(annotationResponse.status).toBe(204);

    syncResponse = await sync(userId, currentSyncToken, { apiKey });
    expect(syncResponse.status).toBe(200);
    currentSyncToken = syncResponse.body.new_sync_token;

    expectedResponse = {
      new_sync_token: currentSyncToken,
      unsynced_books: {
        file: [],
        metadata: [],
        cover: [],
        state: [],
        annotations: [bookId],
        deleted: []
      },
      unsynced_shelves: {
        metadata: [],
        contents: [],
        deleted: []
      }
    };

    expect(syncResponse.body).toEqual(expectedResponse);

    annotationResponse = await deleteAnnotation(bookId, annotationId, { jwt: jwtToken });
    expect(annotationResponse.status).toBe(204);

    syncResponse = await sync(userId, currentSyncToken, { apiKey });
    expect(syncResponse.status).toBe(200);
    currentSyncToken = syncResponse.body.new_sync_token;

    expectedResponse = {
      new_sync_token: currentSyncToken,
      unsynced_books: {
        file: [],
        metadata: [],
        cover: [],
        state: [],
        annotations: [bookId],
        deleted: []
      },
      unsynced_shelves: {
        metadata: [],
        contents: [],
        deleted: []
      }
    };

    expect(syncResponse.body).toEqual(expectedResponse);
  });

  test('Changed shelf books', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;
    const jwtToken = registerResponse.body.jwt_token;

    const createApiKeyResponse = await createApiKey(userId, 'Test Key', ['Create', 'Read', 'Update', 'Delete'], undefined, { jwt: jwtToken });
    expect(createApiKeyResponse.status).toBe(200);
    const apiKey = createApiKeyResponse.body.key;

    const uploadResponse = await uploadBook(userId, 'Alices_Adventures_in_Wonderland.epub', { jwt: jwtToken });
    expect(uploadResponse.status).toBe(200);
    const bookId = uploadResponse.text;

    // Wait for cover and metadata to be extracted
    await wait(1);

    const addShelfResponse = await createShelf('shelf', userId, { jwt: jwtToken });
    expect(addShelfResponse.status).toBe(200);
    const shelfId = addShelfResponse.text;

    let syncResponse = await sync(userId, undefined, { apiKey });
    expect(syncResponse.status).toBe(200);
    let currentSyncToken = syncResponse.body.new_sync_token;

    let expectedResponse = {
      new_sync_token: currentSyncToken,
      unsynced_books: {
        file: [bookId],
        metadata: [bookId],
        cover: [bookId],
        state: [],
        annotations: [] as string[],
        deleted: [] as string[]
      },
      unsynced_shelves: {
        metadata: [shelfId],
        contents: [] as string[],
        deleted: []
      }
    };

    expect(syncResponse.body).toEqual(expectedResponse);

    const addBookToShelfResponse = await addBookToShelf(shelfId, bookId, { jwt: jwtToken });
    expect(addBookToShelfResponse.status).toBe(204);

    syncResponse = await sync(userId, currentSyncToken, { apiKey });
    expect(syncResponse.status).toBe(200);
    currentSyncToken = syncResponse.body.new_sync_token;

    expectedResponse = {
      new_sync_token: currentSyncToken,
      unsynced_books: {
        file: [],
        metadata: [],
        cover: [],
        state: [],
        annotations: [],
        deleted: []
      },
      unsynced_shelves: {
        metadata: [],
        contents: [shelfId],
        deleted: []
      }
    };

    expect(syncResponse.body).toEqual(expectedResponse);

    const removeBookFromShelfResponse = await deleteBookFromShelf(shelfId, bookId, { jwt: jwtToken });
    expect(removeBookFromShelfResponse.status).toBe(204);

    syncResponse = await sync(userId, currentSyncToken, { apiKey });
    expect(syncResponse.status).toBe(200);
    currentSyncToken = syncResponse.body.new_sync_token;

    expectedResponse = {
      new_sync_token: currentSyncToken,
      unsynced_books: {
        file: [],
        metadata: [],
        cover: [],
        state: [],
        annotations: [],
        deleted: []
      },
      unsynced_shelves: {
        metadata: [],
        contents: [shelfId],
        deleted: []
      }
    };

    expect(syncResponse.body).toEqual(expectedResponse);
  });

  test('Different users', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;
    const jwtToken = registerResponse.body.jwt_token;

    const createApiKeyResponse = await createApiKey(userId, 'Test Key', ['Create', 'Read', 'Update', 'Delete'], undefined, { jwt: jwtToken });
    expect(createApiKeyResponse.status).toBe(200);
    const apiKey = createApiKeyResponse.body.key;

    const uploadResponse = await uploadBook(userId, 'Alices_Adventures_in_Wonderland.epub', { apiKey });
    expect(uploadResponse.status).toBe(200);

    // Wait for cover and metadata to be extracted
    await wait(1);

    const addShelfResponse = await createShelf('shelf', userId, { apiKey });
    expect(addShelfResponse.status).toBe(200);

    const addBookToShelfResponse = await addBookToShelf(addShelfResponse.text, uploadResponse.text, { apiKey });
    expect(addBookToShelfResponse.status).toBe(204);

    const { response: registerResponse2 } = await registerUser();
    expect(registerResponse2.status).toBe(200);
    const userId2 = registerResponse2.body.user_id;
    const jwtToken2 = registerResponse2.body.jwt_token;

    const createApiKeyResponse2 = await createApiKey(userId2, 'Test Key', ['Create', 'Read', 'Update', 'Delete'], undefined, { jwt: jwtToken2 });
    expect(createApiKeyResponse2.status).toBe(200);
    const apiKey2 = createApiKeyResponse2.body.key;

    const uploadResponse2 = await uploadBook(userId2, 'The_Wonderful_Wizard_of_Oz.epub', { apiKey: apiKey2 });
    expect(uploadResponse2.status).toBe(200);

    // Wait for cover and metadata to be extracted
    await wait(1);

    const addShelfResponse2 = await createShelf('shelf', userId2, { apiKey: apiKey2 });
    expect(addShelfResponse2.status).toBe(200);

    const addBookToShelfResponse2 = await addBookToShelf(addShelfResponse2.text, uploadResponse2.text, { apiKey: apiKey2 });
    expect(addBookToShelfResponse2.status).toBe(204);

    let syncResponse = await sync(userId, undefined, { apiKey });
    expect(syncResponse.status).toBe(200);
    let currentSyncToken = syncResponse.body.new_sync_token;

    let expectedResponse = {
      new_sync_token: currentSyncToken,
      unsynced_books: {
        file: [],
        metadata: [uploadResponse.text],
        cover: [uploadResponse.text],
        state: [],
        annotations: [],
        deleted: [] as string[]
      },
      unsynced_shelves: {
        metadata: [],
        contents: [],
        deleted: [] as string[]
      }
    };

    expect(syncResponse.body).toEqual(expectedResponse);

    syncResponse = await sync(userId2, undefined, { apiKey: apiKey2 });
    expect(syncResponse.status).toBe(200);
    currentSyncToken = syncResponse.body.new_sync_token;

    expectedResponse = {
      new_sync_token: currentSyncToken,
      unsynced_books: {
        file: [],
        metadata: [uploadResponse2.text],
        cover: [uploadResponse2.text],
        state: [],
        annotations: [],
        deleted: []
      },
      unsynced_shelves: {
        metadata: [],
        contents: [],
        deleted: []
      }
    };

    expect(syncResponse.body).toEqual(expectedResponse);
  });

  test('Invalid sync token', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const createApiKeyResponse = await createApiKey(userId, 'Test Key', ['Read'], undefined, { jwt: registerResponse.body.jwt_token });
    expect(createApiKeyResponse.status).toBe(200);

    let syncResponse = await sync(userId, 'not valid', { apiKey: createApiKeyResponse.body.key });
    expect(syncResponse.status).toBe(400);
    expect(syncResponse.text).toBe(INVALID_SYNC_TOKEN);
  });

  test('Non-existent user', async () => {
    const { response: registerResponse } = await registerUser(undefined, undefined, true, process.env.ADMIN_KEY);
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const createApiKeyResponse = await createApiKey(userId, 'Test Key', ['Read'], undefined, { jwt: registerResponse.body.jwt_token });
    expect(createApiKeyResponse.status).toBe(200);

    let syncResponse = await sync('ghost', undefined, { apiKey: createApiKeyResponse.body.key });
    expect(syncResponse.status).toBe(404);
    expect(syncResponse.text).toBe(USER_NOT_FOUND);
  });

  test('Different user without permission', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const { response: registerResponse2 } = await registerUser();
    expect(registerResponse2.status).toBe(200);
    const userId2 = registerResponse2.body.user_id;

    const createApiKeyResponse = await createApiKey(userId2, 'Test Key', ['Read'], undefined, { jwt: registerResponse2.body.jwt_token });
    expect(createApiKeyResponse.status).toBe(200);

    let syncResponse = await sync(userId, undefined, { apiKey: createApiKeyResponse.body.key });
    expect(syncResponse.status).toBe(403);
    expect(syncResponse.text).toBe(FORBIDDEN);
  });

  test('Different user with permission', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const { response: registerResponse2 } = await registerUser(undefined, undefined, true, process.env.ADMIN_KEY);
    expect(registerResponse2.status).toBe(200);
    const userId2 = registerResponse2.body.user_id;

    const createApiKeyResponse = await createApiKey(userId2, 'Test Key', ['Read'], undefined, { jwt: registerResponse2.body.jwt_token });
    expect(createApiKeyResponse.status).toBe(200);

    let syncResponse = await sync(userId, undefined, { apiKey: createApiKeyResponse.body.key });
    expect(syncResponse.status).toBe(200);
  });

  test('Wrong capabilities', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const createApiKeyResponse = await createApiKey(userId, 'Test Key', ['Delete', 'Create', 'Update'], undefined, { jwt: registerResponse.body.jwt_token });
    expect(createApiKeyResponse.status).toBe(200);

    let syncResponse = await sync(userId, undefined, { apiKey: createApiKeyResponse.body.key });
    expect(syncResponse.status).toBe(403);
    expect(syncResponse.text).toBe(FORBIDDEN);
  });

  test('Expired key', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const timestamp = Date.now() + 1000;
    const createApiKeyResponse = await createApiKey(userId, 'Test Key', ['Read'], timestamp, { jwt: registerResponse.body.jwt_token });
    expect(createApiKeyResponse.status).toBe(200);

    // Wait for the key to expire
    await wait(1.5);

    let syncResponse = await sync(userId, undefined, { apiKey: createApiKeyResponse.body.key });
    expect(syncResponse.status).toBe(401);
    expect(syncResponse.text).toBe(INVALID_API_KEY);
  });
});
