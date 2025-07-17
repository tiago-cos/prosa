import { addAnnotation, ALICE_NOTE, deleteAnnotation, patchAnnotation } from '../utils/annotations';
import { deleteBook, uploadBook } from '../utils/books';
import { FORBIDDEN, INVALID_API_KEY, UNAUTHORIZED, wait } from '../utils/common';
import { updateCover } from '../utils/covers';
import { EXAMPLE_METADATA, patchMetadata, updateMetadata } from '../utils/metadata';
import { ALICE_STATE, patchState, updateState } from '../utils/state';
import { INVALID_TIMESTAMP, sync } from '../utils/sync';
import { createApiKey, registerUser, USER_NOT_FOUND } from '../utils/users';

describe('Sync JWT', () => {
  test('Simple', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const uploadResponse = await uploadBook(userId, 'Alices_Adventures_in_Wonderland.epub', { jwt: registerResponse.body.jwt_token });
    expect(uploadResponse.status).toBe(200);

    // Wait for cover and metadata to be extracted
    await wait(0.5);

    let syncResponse = await sync(userId, undefined, { jwt: registerResponse.body.jwt_token });
    expect(syncResponse.status).toBe(200);

    let expectedResponse = {
      file: [uploadResponse.text],
      metadata: [uploadResponse.text],
      cover: [uploadResponse.text],
      state: [uploadResponse.text],
      annotations: [uploadResponse.text],
      deleted: []
    };

    expect(syncResponse.body).toEqual(expectedResponse);

    let now = Date.now();

    syncResponse = await sync(userId, now, { jwt: registerResponse.body.jwt_token });
    expect(syncResponse.status).toBe(200);

    expectedResponse = {
      file: [],
      metadata: [],
      cover: [],
      state: [],
      annotations: [],
      deleted: []
    };

    expect(syncResponse.body).toEqual(expectedResponse);

    const uploadResponse2 = await uploadBook(userId, 'The_Wonderful_Wizard_of_Oz.epub', { jwt: registerResponse.body.jwt_token });
    expect(uploadResponse2.status).toBe(200);

    // Wait for cover and metadata to be extracted
    await wait(0.5);

    syncResponse = await sync(userId, now, { jwt: registerResponse.body.jwt_token });
    expect(syncResponse.status).toBe(200);

    expectedResponse = {
      file: [uploadResponse2.text],
      metadata: [uploadResponse2.text],
      cover: [uploadResponse2.text],
      state: [uploadResponse2.text],
      annotations: [uploadResponse2.text],
      deleted: []
    };

    expect(syncResponse.body).toEqual(expectedResponse);

    syncResponse = await sync(userId, undefined, { jwt: registerResponse.body.jwt_token });
    expect(syncResponse.status).toBe(200);

    expectedResponse = {
      file: [uploadResponse.text, uploadResponse2.text],
      metadata: [uploadResponse.text, uploadResponse2.text],
      cover: [uploadResponse.text, uploadResponse2.text],
      state: [uploadResponse.text, uploadResponse2.text],
      annotations: [uploadResponse.text, uploadResponse2.text],
      deleted: []
    };

    expect(syncResponse.body).toEqual(expectedResponse);

    now = Date.now();

    syncResponse = await sync(userId, now, { jwt: registerResponse.body.jwt_token });
    expect(syncResponse.status).toBe(200);

    expectedResponse = {
      file: [],
      metadata: [],
      cover: [],
      state: [],
      annotations: [],
      deleted: []
    };

    expect(syncResponse.body).toEqual(expectedResponse);
  });

  test('Implicit users', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const uploadResponse = await uploadBook(userId, 'Alices_Adventures_in_Wonderland.epub', { jwt: registerResponse.body.jwt_token });
    expect(uploadResponse.status).toBe(200);

    // Wait for cover and metadata to be extracted
    await wait(0.5);

    let syncResponse = await sync(undefined, undefined, { jwt: registerResponse.body.jwt_token });
    expect(syncResponse.status).toBe(200);

    let expectedResponse = {
      file: [uploadResponse.text],
      metadata: [uploadResponse.text],
      cover: [uploadResponse.text],
      state: [uploadResponse.text],
      annotations: [uploadResponse.text],
      deleted: []
    };

    expect(syncResponse.body).toEqual(expectedResponse);

    let now = Date.now();

    syncResponse = await sync(undefined, now, { jwt: registerResponse.body.jwt_token });
    expect(syncResponse.status).toBe(200);

    expectedResponse = {
      file: [],
      metadata: [],
      cover: [],
      state: [],
      annotations: [],
      deleted: []
    };

    expect(syncResponse.body).toEqual(expectedResponse);

    const uploadResponse2 = await uploadBook(userId, 'The_Wonderful_Wizard_of_Oz.epub', { jwt: registerResponse.body.jwt_token });
    expect(uploadResponse2.status).toBe(200);

    // Wait for cover and metadata to be extracted
    await wait(0.5);

    syncResponse = await sync(undefined, now, { jwt: registerResponse.body.jwt_token });
    expect(syncResponse.status).toBe(200);

    expectedResponse = {
      file: [uploadResponse2.text],
      metadata: [uploadResponse2.text],
      cover: [uploadResponse2.text],
      state: [uploadResponse2.text],
      annotations: [uploadResponse2.text],
      deleted: []
    };

    expect(syncResponse.body).toEqual(expectedResponse);

    syncResponse = await sync(undefined, undefined, { jwt: registerResponse.body.jwt_token });
    expect(syncResponse.status).toBe(200);

    expectedResponse = {
      file: [uploadResponse.text, uploadResponse2.text],
      metadata: [uploadResponse.text, uploadResponse2.text],
      cover: [uploadResponse.text, uploadResponse2.text],
      state: [uploadResponse.text, uploadResponse2.text],
      annotations: [uploadResponse.text, uploadResponse2.text],
      deleted: []
    };

    expect(syncResponse.body).toEqual(expectedResponse);

    now = Date.now();

    syncResponse = await sync(undefined, now, { jwt: registerResponse.body.jwt_token });
    expect(syncResponse.status).toBe(200);

    expectedResponse = {
      file: [],
      metadata: [],
      cover: [],
      state: [],
      annotations: [],
      deleted: []
    };

    expect(syncResponse.body).toEqual(expectedResponse);
  });

  test('Deleted files', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const uploadResponse = await uploadBook(userId, 'Alices_Adventures_in_Wonderland.epub', { jwt: registerResponse.body.jwt_token });
    expect(uploadResponse.status).toBe(200);

    let syncResponse = await sync(userId, undefined, { jwt: registerResponse.body.jwt_token });
    expect(syncResponse.status).toBe(200);

    let expectedResponse = {
      file: [uploadResponse.text],
      metadata: [uploadResponse.text],
      cover: [uploadResponse.text],
      state: [uploadResponse.text],
      annotations: [uploadResponse.text],
      deleted: [] as string[]
    };

    expect(syncResponse.body).toEqual(expectedResponse);

    const deleteResponse = await deleteBook(uploadResponse.text, { jwt: registerResponse.body.jwt_token });
    expect(deleteResponse.status).toBe(204);

    syncResponse = await sync(userId, undefined, { jwt: registerResponse.body.jwt_token });
    expect(syncResponse.status).toBe(200);

    expectedResponse = {
      file: [],
      metadata: [],
      cover: [],
      state: [],
      annotations: [],
      deleted: [uploadResponse.text]
    };

    expect(syncResponse.body).toEqual(expectedResponse);

    const uploadResponse2 = await uploadBook(userId, 'The_Great_Gatsby.epub', { jwt: registerResponse.body.jwt_token });
    expect(uploadResponse2.status).toBe(200);

    const uploadResponse3 = await uploadBook(userId, 'The_Wonderful_Wizard_of_Oz.epub', { jwt: registerResponse.body.jwt_token });
    expect(uploadResponse3.status).toBe(200);

    syncResponse = await sync(userId, undefined, { jwt: registerResponse.body.jwt_token });
    expect(syncResponse.status).toBe(200);

    expectedResponse = {
      file: [uploadResponse2.text, uploadResponse3.text],
      metadata: [uploadResponse2.text, uploadResponse3.text],
      cover: [uploadResponse2.text, uploadResponse3.text],
      state: [uploadResponse2.text, uploadResponse3.text],
      annotations: [uploadResponse2.text, uploadResponse3.text],
      deleted: [uploadResponse.text]
    };

    expect(syncResponse.body).toEqual(expectedResponse);
  });

  test('Changed metadata', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const uploadResponse = await uploadBook(userId, 'Alices_Adventures_in_Wonderland.epub', { jwt: registerResponse.body.jwt_token });
    expect(uploadResponse.status).toBe(200);

    let syncResponse = await sync(userId, undefined, { jwt: registerResponse.body.jwt_token });
    expect(syncResponse.status).toBe(200);

    let expectedResponse = {
      file: [uploadResponse.text],
      metadata: [uploadResponse.text],
      cover: [uploadResponse.text],
      state: [uploadResponse.text],
      annotations: [uploadResponse.text],
      deleted: [] as string[]
    };

    expect(syncResponse.body).toEqual(expectedResponse);

    // Wait for cover and metadata to be extracted
    await wait(0.5);

    let now = Date.now();

    let metadataResponse = await updateMetadata(uploadResponse.text, EXAMPLE_METADATA, { jwt: registerResponse.body.jwt_token });
    expect(metadataResponse.status).toBe(204);

    syncResponse = await sync(userId, now, { jwt: registerResponse.body.jwt_token });
    expect(syncResponse.status).toBe(200);

    expectedResponse = {
      file: [],
      metadata: [uploadResponse.text],
      cover: [],
      state: [],
      annotations: [],
      deleted: []
    };

    expect(syncResponse.body).toEqual(expectedResponse);

    now = Date.now();

    metadataResponse = await patchMetadata(uploadResponse.text, { title: 'title test' }, { jwt: registerResponse.body.jwt_token });
    expect(metadataResponse.status).toBe(204);

    syncResponse = await sync(userId, now, { jwt: registerResponse.body.jwt_token });
    expect(syncResponse.status).toBe(200);

    expectedResponse = {
      file: [],
      metadata: [uploadResponse.text],
      cover: [],
      state: [],
      annotations: [],
      deleted: []
    };

    expect(syncResponse.body).toEqual(expectedResponse);
  });

  test('Changed cover', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const uploadResponse = await uploadBook(userId, 'Alices_Adventures_in_Wonderland.epub', { jwt: registerResponse.body.jwt_token });
    expect(uploadResponse.status).toBe(200);

    let syncResponse = await sync(userId, undefined, { jwt: registerResponse.body.jwt_token });
    expect(syncResponse.status).toBe(200);

    let expectedResponse = {
      file: [uploadResponse.text],
      metadata: [uploadResponse.text],
      cover: [uploadResponse.text],
      state: [uploadResponse.text],
      annotations: [uploadResponse.text],
      deleted: [] as string[]
    };

    expect(syncResponse.body).toEqual(expectedResponse);

    // Wait for cover and metadata to be extracted
    await wait(0.5);

    let now = Date.now();

    const coverResponse = await updateCover(uploadResponse.text, 'Generic.jpeg', { jwt: registerResponse.body.jwt_token });
    expect(coverResponse.status).toBe(204);

    syncResponse = await sync(userId, now, { jwt: registerResponse.body.jwt_token });
    expect(syncResponse.status).toBe(200);

    expectedResponse = {
      file: [],
      metadata: [],
      cover: [uploadResponse.text],
      state: [],
      annotations: [],
      deleted: []
    };

    expect(syncResponse.body).toEqual(expectedResponse);

    const deleteResponse = await deleteBook(uploadResponse.text, { jwt: registerResponse.body.jwt_token });
    expect(deleteResponse.status).toBe(204);

    const uploadResponse2 = await uploadBook(userId, 'The_Great_Gatsby.epub', { jwt: registerResponse.body.jwt_token });
    expect(uploadResponse2.status).toBe(200);

    syncResponse = await sync(userId, now, { jwt: registerResponse.body.jwt_token });
    expect(syncResponse.status).toBe(200);

    expectedResponse = {
      file: [uploadResponse2.text],
      metadata: [uploadResponse2.text],
      cover: [uploadResponse2.text],
      state: [uploadResponse2.text],
      annotations: [uploadResponse2.text],
      deleted: [uploadResponse.text]
    };

    expect(syncResponse.body).toEqual(expectedResponse);
  });

  test('Changed state', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const uploadResponse = await uploadBook(userId, 'Alices_Adventures_in_Wonderland.epub', { jwt: registerResponse.body.jwt_token });
    expect(uploadResponse.status).toBe(200);

    let syncResponse = await sync(userId, undefined, { jwt: registerResponse.body.jwt_token });
    expect(syncResponse.status).toBe(200);

    let expectedResponse = {
      file: [uploadResponse.text],
      metadata: [uploadResponse.text],
      cover: [uploadResponse.text],
      state: [uploadResponse.text],
      annotations: [uploadResponse.text],
      deleted: [] as string[]
    };

    expect(syncResponse.body).toEqual(expectedResponse);

    // Wait for cover and metadata to be extracted
    await wait(0.5);

    let now = Date.now();

    let stateResponse = await updateState(uploadResponse.text, ALICE_STATE, { jwt: registerResponse.body.jwt_token });
    expect(stateResponse.status).toBe(204);

    syncResponse = await sync(userId, now, { jwt: registerResponse.body.jwt_token });
    expect(syncResponse.status).toBe(200);

    expectedResponse = {
      file: [],
      metadata: [],
      cover: [],
      state: [uploadResponse.text],
      annotations: [],
      deleted: []
    };

    expect(syncResponse.body).toEqual(expectedResponse);

    now = Date.now();

    stateResponse = await patchState(uploadResponse.text, { statistics: { reading_status: 'Read' } }, { jwt: registerResponse.body.jwt_token });
    expect(stateResponse.status).toBe(204);

    syncResponse = await sync(userId, now, { jwt: registerResponse.body.jwt_token });
    expect(syncResponse.status).toBe(200);

    expectedResponse = {
      file: [],
      metadata: [],
      cover: [],
      state: [uploadResponse.text],
      annotations: [],
      deleted: []
    };

    expect(syncResponse.body).toEqual(expectedResponse);
  });

  test('Changed annotations', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const uploadResponse = await uploadBook(userId, 'Alices_Adventures_in_Wonderland.epub', { jwt: registerResponse.body.jwt_token });
    expect(uploadResponse.status).toBe(200);

    let syncResponse = await sync(userId, undefined, { jwt: registerResponse.body.jwt_token });
    expect(syncResponse.status).toBe(200);

    let expectedResponse = {
      file: [uploadResponse.text],
      metadata: [uploadResponse.text],
      cover: [uploadResponse.text],
      state: [uploadResponse.text],
      annotations: [uploadResponse.text],
      deleted: [] as string[]
    };

    expect(syncResponse.body).toEqual(expectedResponse);

    // Wait for cover and metadata to be extracted
    await wait(0.5);

    let now = Date.now();

    const addAnnotationResponse = await addAnnotation(uploadResponse.text, ALICE_NOTE, { jwt: registerResponse.body.jwt_token });
    expect(addAnnotationResponse.status).toBe(200);

    syncResponse = await sync(userId, now, { jwt: registerResponse.body.jwt_token });
    expect(syncResponse.status).toBe(200);

    expectedResponse = {
      file: [],
      metadata: [],
      cover: [],
      state: [],
      annotations: [uploadResponse.text],
      deleted: []
    };

    expect(syncResponse.body).toEqual(expectedResponse);

    now = Date.now();

    let annotationResponse = await patchAnnotation(uploadResponse.text, addAnnotationResponse.text, 'note', { jwt: registerResponse.body.jwt_token });
    expect(annotationResponse.status).toBe(204);

    syncResponse = await sync(userId, now, { jwt: registerResponse.body.jwt_token });
    expect(syncResponse.status).toBe(200);

    expectedResponse = {
      file: [],
      metadata: [],
      cover: [],
      state: [],
      annotations: [uploadResponse.text],
      deleted: []
    };

    expect(syncResponse.body).toEqual(expectedResponse);

    now = Date.now();

    annotationResponse = await deleteAnnotation(uploadResponse.text, addAnnotationResponse.text, { jwt: registerResponse.body.jwt_token });
    expect(annotationResponse.status).toBe(204);

    syncResponse = await sync(userId, now, { jwt: registerResponse.body.jwt_token });
    expect(syncResponse.status).toBe(200);

    expectedResponse = {
      file: [],
      metadata: [],
      cover: [],
      state: [],
      annotations: [uploadResponse.text],
      deleted: []
    };

    expect(syncResponse.body).toEqual(expectedResponse);
  });

  test('Different users', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const uploadResponse = await uploadBook(userId, 'Alices_Adventures_in_Wonderland.epub', { jwt: registerResponse.body.jwt_token });
    expect(uploadResponse.status).toBe(200);

    const { response: registerResponse2 } = await registerUser();
    expect(registerResponse2.status).toBe(200);
    const userId2 = registerResponse2.body.user_id;

    const uploadResponse2 = await uploadBook(userId2, 'The_Wonderful_Wizard_of_Oz.epub', { jwt: registerResponse2.body.jwt_token });
    expect(uploadResponse2.status).toBe(200);

    let syncResponse = await sync(userId, undefined, { jwt: registerResponse.body.jwt_token });
    expect(syncResponse.status).toBe(200);

    let expectedResponse = {
      file: [uploadResponse.text],
      metadata: [uploadResponse.text],
      cover: [uploadResponse.text],
      state: [uploadResponse.text],
      annotations: [uploadResponse.text],
      deleted: []
    };

    expect(syncResponse.body).toEqual(expectedResponse);

    syncResponse = await sync(userId2, undefined, { jwt: registerResponse2.body.jwt_token });
    expect(syncResponse.status).toBe(200);

    expectedResponse = {
      file: [uploadResponse2.text],
      metadata: [uploadResponse2.text],
      cover: [uploadResponse2.text],
      state: [uploadResponse2.text],
      annotations: [uploadResponse2.text],
      deleted: []
    };

    expect(syncResponse.body).toEqual(expectedResponse);
  });

  test('Different implicit users', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const uploadResponse = await uploadBook(userId, 'Alices_Adventures_in_Wonderland.epub', { jwt: registerResponse.body.jwt_token });
    expect(uploadResponse.status).toBe(200);

    const { response: registerResponse2 } = await registerUser();
    expect(registerResponse2.status).toBe(200);
    const userId2 = registerResponse2.body.user_id;

    const uploadResponse2 = await uploadBook(userId2, 'The_Wonderful_Wizard_of_Oz.epub', { jwt: registerResponse2.body.jwt_token });
    expect(uploadResponse2.status).toBe(200);

    let syncResponse = await sync(undefined, undefined, { jwt: registerResponse.body.jwt_token });
    expect(syncResponse.status).toBe(200);

    let expectedResponse = {
      file: [uploadResponse.text],
      metadata: [uploadResponse.text],
      cover: [uploadResponse.text],
      state: [uploadResponse.text],
      annotations: [uploadResponse.text],
      deleted: []
    };

    expect(syncResponse.body).toEqual(expectedResponse);

    syncResponse = await sync(undefined, undefined, { jwt: registerResponse2.body.jwt_token });
    expect(syncResponse.status).toBe(200);

    expectedResponse = {
      file: [uploadResponse2.text],
      metadata: [uploadResponse2.text],
      cover: [uploadResponse2.text],
      state: [uploadResponse2.text],
      annotations: [uploadResponse2.text],
      deleted: []
    };

    expect(syncResponse.body).toEqual(expectedResponse);
  });

  test('Invalid timestamp', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    let syncResponse = await sync(userId, 'not valid', { jwt: registerResponse.body.jwt_token });
    expect(syncResponse.status).toBe(400);
    expect(syncResponse.text).toBe(INVALID_TIMESTAMP);
  });

  test('Non-existent user', async () => {
    const { response: registerResponse } = await registerUser(undefined, undefined, process.env.ADMIN_KEY);
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

    const { response: registerResponse2 } = await registerUser(undefined, undefined, process.env.ADMIN_KEY);
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
  test('Simple', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const uploadResponse = await uploadBook(userId, 'Alices_Adventures_in_Wonderland.epub', { jwt: registerResponse.body.jwt_token });
    expect(uploadResponse.status).toBe(200);

    // Wait for cover and metadata to be extracted
    await wait(0.5);

    const createApiKeyResponse = await createApiKey(userId, 'Test Key', ['Read'], undefined, { jwt: registerResponse.body.jwt_token });
    expect(createApiKeyResponse.status).toBe(200);

    let syncResponse = await sync(userId, undefined, { apiKey: createApiKeyResponse.body.key });
    expect(syncResponse.status).toBe(200);

    let expectedResponse = {
      file: [uploadResponse.text],
      metadata: [uploadResponse.text],
      cover: [uploadResponse.text],
      state: [uploadResponse.text],
      annotations: [uploadResponse.text],
      deleted: []
    };

    expect(syncResponse.body).toEqual(expectedResponse);

    let now = Date.now();

    syncResponse = await sync(userId, now, { apiKey: createApiKeyResponse.body.key });
    expect(syncResponse.status).toBe(200);

    expectedResponse = {
      file: [],
      metadata: [],
      cover: [],
      state: [],
      annotations: [],
      deleted: []
    };

    expect(syncResponse.body).toEqual(expectedResponse);

    const uploadResponse2 = await uploadBook(userId, 'The_Wonderful_Wizard_of_Oz.epub', { jwt: registerResponse.body.jwt_token });
    expect(uploadResponse2.status).toBe(200);

    // Wait for cover and metadata to be extracted
    await wait(0.5);

    syncResponse = await sync(userId, now, { apiKey: createApiKeyResponse.body.key });
    expect(syncResponse.status).toBe(200);

    expectedResponse = {
      file: [uploadResponse2.text],
      metadata: [uploadResponse2.text],
      cover: [uploadResponse2.text],
      state: [uploadResponse2.text],
      annotations: [uploadResponse2.text],
      deleted: []
    };

    expect(syncResponse.body).toEqual(expectedResponse);

    syncResponse = await sync(userId, undefined, { apiKey: createApiKeyResponse.body.key });
    expect(syncResponse.status).toBe(200);

    expectedResponse = {
      file: [uploadResponse.text, uploadResponse2.text],
      metadata: [uploadResponse.text, uploadResponse2.text],
      cover: [uploadResponse.text, uploadResponse2.text],
      state: [uploadResponse.text, uploadResponse2.text],
      annotations: [uploadResponse.text, uploadResponse2.text],
      deleted: []
    };

    expect(syncResponse.body).toEqual(expectedResponse);

    now = Date.now();

    syncResponse = await sync(userId, now, { apiKey: createApiKeyResponse.body.key });
    expect(syncResponse.status).toBe(200);

    expectedResponse = {
      file: [],
      metadata: [],
      cover: [],
      state: [],
      annotations: [],
      deleted: []
    };

    expect(syncResponse.body).toEqual(expectedResponse);
  });

  test('Implicit users', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const uploadResponse = await uploadBook(userId, 'Alices_Adventures_in_Wonderland.epub', { jwt: registerResponse.body.jwt_token });
    expect(uploadResponse.status).toBe(200);

    // Wait for cover and metadata to be extracted
    await wait(0.5);

    const createApiKeyResponse = await createApiKey(userId, 'Test Key', ['Read'], undefined, { jwt: registerResponse.body.jwt_token });
    expect(createApiKeyResponse.status).toBe(200);

    let syncResponse = await sync(undefined, undefined, { apiKey: createApiKeyResponse.body.key });
    expect(syncResponse.status).toBe(200);

    let expectedResponse = {
      file: [uploadResponse.text],
      metadata: [uploadResponse.text],
      cover: [uploadResponse.text],
      state: [uploadResponse.text],
      annotations: [uploadResponse.text],
      deleted: []
    };

    expect(syncResponse.body).toEqual(expectedResponse);

    let now = Date.now();

    syncResponse = await sync(undefined, now, { apiKey: createApiKeyResponse.body.key });
    expect(syncResponse.status).toBe(200);

    expectedResponse = {
      file: [],
      metadata: [],
      cover: [],
      state: [],
      annotations: [],
      deleted: []
    };

    expect(syncResponse.body).toEqual(expectedResponse);

    const uploadResponse2 = await uploadBook(userId, 'The_Wonderful_Wizard_of_Oz.epub', { jwt: registerResponse.body.jwt_token });
    expect(uploadResponse2.status).toBe(200);

    // Wait for cover and metadata to be extracted
    await wait(0.5);

    syncResponse = await sync(undefined, now, { apiKey: createApiKeyResponse.body.key });
    expect(syncResponse.status).toBe(200);

    expectedResponse = {
      file: [uploadResponse2.text],
      metadata: [uploadResponse2.text],
      cover: [uploadResponse2.text],
      state: [uploadResponse2.text],
      annotations: [uploadResponse2.text],
      deleted: []
    };

    expect(syncResponse.body).toEqual(expectedResponse);

    syncResponse = await sync(undefined, undefined, { apiKey: createApiKeyResponse.body.key });
    expect(syncResponse.status).toBe(200);

    expectedResponse = {
      file: [uploadResponse.text, uploadResponse2.text],
      metadata: [uploadResponse.text, uploadResponse2.text],
      cover: [uploadResponse.text, uploadResponse2.text],
      state: [uploadResponse.text, uploadResponse2.text],
      annotations: [uploadResponse.text, uploadResponse2.text],
      deleted: []
    };

    expect(syncResponse.body).toEqual(expectedResponse);

    now = Date.now();

    syncResponse = await sync(undefined, now, { apiKey: createApiKeyResponse.body.key });
    expect(syncResponse.status).toBe(200);

    expectedResponse = {
      file: [],
      metadata: [],
      cover: [],
      state: [],
      annotations: [],
      deleted: []
    };

    expect(syncResponse.body).toEqual(expectedResponse);
  });

  test('Deleted files', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const uploadResponse = await uploadBook(userId, 'Alices_Adventures_in_Wonderland.epub', { jwt: registerResponse.body.jwt_token });
    expect(uploadResponse.status).toBe(200);

    const createApiKeyResponse = await createApiKey(userId, 'Test Key', ['Read'], undefined, { jwt: registerResponse.body.jwt_token });
    expect(createApiKeyResponse.status).toBe(200);

    let syncResponse = await sync(userId, undefined, { apiKey: createApiKeyResponse.body.key });
    expect(syncResponse.status).toBe(200);

    let expectedResponse = {
      file: [uploadResponse.text],
      metadata: [uploadResponse.text],
      cover: [uploadResponse.text],
      state: [uploadResponse.text],
      annotations: [uploadResponse.text],
      deleted: [] as string[]
    };

    expect(syncResponse.body).toEqual(expectedResponse);

    const deleteResponse = await deleteBook(uploadResponse.text, { jwt: registerResponse.body.jwt_token });
    expect(deleteResponse.status).toBe(204);

    syncResponse = await sync(userId, undefined, { apiKey: createApiKeyResponse.body.key });
    expect(syncResponse.status).toBe(200);

    expectedResponse = {
      file: [],
      metadata: [],
      cover: [],
      state: [],
      annotations: [],
      deleted: [uploadResponse.text]
    };

    expect(syncResponse.body).toEqual(expectedResponse);

    const uploadResponse2 = await uploadBook(userId, 'The_Great_Gatsby.epub', { jwt: registerResponse.body.jwt_token });
    expect(uploadResponse2.status).toBe(200);

    const uploadResponse3 = await uploadBook(userId, 'The_Wonderful_Wizard_of_Oz.epub', { jwt: registerResponse.body.jwt_token });
    expect(uploadResponse3.status).toBe(200);

    syncResponse = await sync(userId, undefined, { apiKey: createApiKeyResponse.body.key });
    expect(syncResponse.status).toBe(200);

    expectedResponse = {
      file: [uploadResponse2.text, uploadResponse3.text],
      metadata: [uploadResponse2.text, uploadResponse3.text],
      cover: [uploadResponse2.text, uploadResponse3.text],
      state: [uploadResponse2.text, uploadResponse3.text],
      annotations: [uploadResponse2.text, uploadResponse3.text],
      deleted: [uploadResponse.text]
    };

    expect(syncResponse.body).toEqual(expectedResponse);
  });

  test('Changed metadata', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const uploadResponse = await uploadBook(userId, 'Alices_Adventures_in_Wonderland.epub', { jwt: registerResponse.body.jwt_token });
    expect(uploadResponse.status).toBe(200);

    const createApiKeyResponse = await createApiKey(userId, 'Test Key', ['Read'], undefined, { jwt: registerResponse.body.jwt_token });
    expect(createApiKeyResponse.status).toBe(200);

    let syncResponse = await sync(userId, undefined, { apiKey: createApiKeyResponse.body.key });
    expect(syncResponse.status).toBe(200);

    let expectedResponse = {
      file: [uploadResponse.text],
      metadata: [uploadResponse.text],
      cover: [uploadResponse.text],
      state: [uploadResponse.text],
      annotations: [uploadResponse.text],
      deleted: [] as string[]
    };

    expect(syncResponse.body).toEqual(expectedResponse);

    // Wait for cover and metadata to be extracted
    await wait(0.5);

    let now = Date.now();

    const metadataResponse = await updateMetadata(uploadResponse.text, EXAMPLE_METADATA, { jwt: registerResponse.body.jwt_token });
    expect(metadataResponse.status).toBe(204);

    syncResponse = await sync(userId, now, { apiKey: createApiKeyResponse.body.key });
    expect(syncResponse.status).toBe(200);

    expectedResponse = {
      file: [],
      metadata: [uploadResponse.text],
      cover: [],
      state: [],
      annotations: [],
      deleted: []
    };

    expect(syncResponse.body).toEqual(expectedResponse);

    now = Date.now();

    syncResponse = await patchMetadata(uploadResponse.text, { title: 'title test' }, { jwt: registerResponse.body.jwt_token });
    expect(metadataResponse.status).toBe(204);

    syncResponse = await sync(userId, now, { apiKey: createApiKeyResponse.body.key });
    expect(syncResponse.status).toBe(200);

    expectedResponse = {
      file: [],
      metadata: [uploadResponse.text],
      cover: [],
      state: [],
      annotations: [],
      deleted: []
    };

    expect(syncResponse.body).toEqual(expectedResponse);
  });

  test('Changed cover', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const uploadResponse = await uploadBook(userId, 'Alices_Adventures_in_Wonderland.epub', { jwt: registerResponse.body.jwt_token });
    expect(uploadResponse.status).toBe(200);

    const createApiKeyResponse = await createApiKey(userId, 'Test Key', ['Read'], undefined, { jwt: registerResponse.body.jwt_token });
    expect(createApiKeyResponse.status).toBe(200);

    let syncResponse = await sync(userId, undefined, { apiKey: createApiKeyResponse.body.key });
    expect(syncResponse.status).toBe(200);

    let expectedResponse = {
      file: [uploadResponse.text],
      metadata: [uploadResponse.text],
      cover: [uploadResponse.text],
      state: [uploadResponse.text],
      annotations: [uploadResponse.text],
      deleted: [] as string[]
    };

    expect(syncResponse.body).toEqual(expectedResponse);

    // Wait for cover and metadata to be extracted
    await wait(0.5);

    let now = Date.now();

    const coverResponse = await updateCover(uploadResponse.text, 'Generic.jpeg', { jwt: registerResponse.body.jwt_token });
    expect(coverResponse.status).toBe(204);

    syncResponse = await sync(userId, now, { apiKey: createApiKeyResponse.body.key });
    expect(syncResponse.status).toBe(200);

    expectedResponse = {
      file: [],
      metadata: [],
      cover: [uploadResponse.text],
      state: [],
      annotations: [],
      deleted: []
    };

    expect(syncResponse.body).toEqual(expectedResponse);

    const deleteResponse = await deleteBook(uploadResponse.text, { jwt: registerResponse.body.jwt_token });
    expect(deleteResponse.status).toBe(204);

    const uploadResponse2 = await uploadBook(userId, 'The_Great_Gatsby.epub', { jwt: registerResponse.body.jwt_token });
    expect(uploadResponse2.status).toBe(200);

    syncResponse = await sync(userId, now, { apiKey: createApiKeyResponse.body.key });
    expect(syncResponse.status).toBe(200);

    expectedResponse = {
      file: [uploadResponse2.text],
      metadata: [uploadResponse2.text],
      cover: [uploadResponse2.text],
      state: [uploadResponse2.text],
      annotations: [uploadResponse2.text],
      deleted: [uploadResponse.text]
    };

    expect(syncResponse.body).toEqual(expectedResponse);
  });

  test('Changed state', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const uploadResponse = await uploadBook(userId, 'Alices_Adventures_in_Wonderland.epub', { jwt: registerResponse.body.jwt_token });
    expect(uploadResponse.status).toBe(200);

    const createApiKeyResponse = await createApiKey(userId, 'Test Key', ['Read'], undefined, { jwt: registerResponse.body.jwt_token });
    expect(createApiKeyResponse.status).toBe(200);

    let syncResponse = await sync(userId, undefined, { apiKey: createApiKeyResponse.body.key });
    expect(syncResponse.status).toBe(200);

    let expectedResponse = {
      file: [uploadResponse.text],
      metadata: [uploadResponse.text],
      cover: [uploadResponse.text],
      state: [uploadResponse.text],
      annotations: [uploadResponse.text],
      deleted: [] as string[]
    };

    expect(syncResponse.body).toEqual(expectedResponse);

    // Wait for cover and metadata to be extracted
    await wait(0.5);

    let now = Date.now();

    let stateResponse = await updateState(uploadResponse.text, ALICE_STATE, { jwt: registerResponse.body.jwt_token });
    expect(stateResponse.status).toBe(204);

    syncResponse = await sync(userId, now, { apiKey: createApiKeyResponse.body.key });
    expect(syncResponse.status).toBe(200);

    expectedResponse = {
      file: [],
      metadata: [],
      cover: [],
      state: [uploadResponse.text],
      annotations: [],
      deleted: []
    };

    expect(syncResponse.body).toEqual(expectedResponse);

    now = Date.now();

    stateResponse = await patchState(uploadResponse.text, { statistics: { reading_status: 'Read' } }, { jwt: registerResponse.body.jwt_token });
    expect(stateResponse.status).toBe(204);

    syncResponse = await sync(userId, now, { apiKey: createApiKeyResponse.body.key });
    expect(syncResponse.status).toBe(200);

    expectedResponse = {
      file: [],
      metadata: [],
      cover: [],
      state: [uploadResponse.text],
      annotations: [],
      deleted: []
    };

    expect(syncResponse.body).toEqual(expectedResponse);
  });

  test('Changed annotations', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const uploadResponse = await uploadBook(userId, 'Alices_Adventures_in_Wonderland.epub', { jwt: registerResponse.body.jwt_token });
    expect(uploadResponse.status).toBe(200);

    const createApiKeyResponse = await createApiKey(userId, 'Test Key', ['Read'], undefined, { jwt: registerResponse.body.jwt_token });
    expect(createApiKeyResponse.status).toBe(200);

    let syncResponse = await sync(userId, undefined, { apiKey: createApiKeyResponse.body.key });
    expect(syncResponse.status).toBe(200);

    let expectedResponse = {
      file: [uploadResponse.text],
      metadata: [uploadResponse.text],
      cover: [uploadResponse.text],
      state: [uploadResponse.text],
      annotations: [uploadResponse.text],
      deleted: [] as string[]
    };

    expect(syncResponse.body).toEqual(expectedResponse);

    // Wait for cover and metadata to be extracted
    await wait(0.5);

    let now = Date.now();

    const addAnnotationResponse = await addAnnotation(uploadResponse.text, ALICE_NOTE, { jwt: registerResponse.body.jwt_token });
    expect(addAnnotationResponse.status).toBe(200);

    syncResponse = await sync(userId, now, { apiKey: createApiKeyResponse.body.key });
    expect(syncResponse.status).toBe(200);

    expectedResponse = {
      file: [],
      metadata: [],
      cover: [],
      state: [],
      annotations: [uploadResponse.text],
      deleted: []
    };

    expect(syncResponse.body).toEqual(expectedResponse);

    now = Date.now();

    let annotationResponse = await patchAnnotation(uploadResponse.text, addAnnotationResponse.text, 'note', { jwt: registerResponse.body.jwt_token });
    expect(annotationResponse.status).toBe(204);

    syncResponse = await sync(userId, now, { apiKey: createApiKeyResponse.body.key });
    expect(syncResponse.status).toBe(200);

    expectedResponse = {
      file: [],
      metadata: [],
      cover: [],
      state: [],
      annotations: [uploadResponse.text],
      deleted: []
    };

    expect(syncResponse.body).toEqual(expectedResponse);

    now = Date.now();

    annotationResponse = await deleteAnnotation(uploadResponse.text, addAnnotationResponse.text, { jwt: registerResponse.body.jwt_token });
    expect(annotationResponse.status).toBe(204);

    syncResponse = await sync(userId, now, { apiKey: createApiKeyResponse.body.key });
    expect(syncResponse.status).toBe(200);

    expectedResponse = {
      file: [],
      metadata: [],
      cover: [],
      state: [],
      annotations: [uploadResponse.text],
      deleted: []
    };

    expect(syncResponse.body).toEqual(expectedResponse);
  });

  test('Different users', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const createApiKeyResponse = await createApiKey(userId, 'Test Key', ['Read'], undefined, { jwt: registerResponse.body.jwt_token });
    expect(createApiKeyResponse.status).toBe(200);

    const uploadResponse = await uploadBook(userId, 'Alices_Adventures_in_Wonderland.epub', { jwt: registerResponse.body.jwt_token });
    expect(uploadResponse.status).toBe(200);

    const { response: registerResponse2 } = await registerUser();
    expect(registerResponse2.status).toBe(200);
    const userId2 = registerResponse2.body.user_id;

    const createApiKeyResponse2 = await createApiKey(userId2, 'Test Key', ['Read'], undefined, { jwt: registerResponse2.body.jwt_token });
    expect(createApiKeyResponse2.status).toBe(200);

    const uploadResponse2 = await uploadBook(userId2, 'The_Wonderful_Wizard_of_Oz.epub', { jwt: registerResponse2.body.jwt_token });
    expect(uploadResponse2.status).toBe(200);

    let syncResponse = await sync(userId, undefined, { apiKey: createApiKeyResponse.body.key });
    expect(syncResponse.status).toBe(200);

    let expectedResponse = {
      file: [uploadResponse.text],
      metadata: [uploadResponse.text],
      cover: [uploadResponse.text],
      state: [uploadResponse.text],
      annotations: [uploadResponse.text],
      deleted: []
    };

    expect(syncResponse.body).toEqual(expectedResponse);

    syncResponse = await sync(userId2, undefined, { apiKey: createApiKeyResponse2.body.key });
    expect(syncResponse.status).toBe(200);

    expectedResponse = {
      file: [uploadResponse2.text],
      metadata: [uploadResponse2.text],
      cover: [uploadResponse2.text],
      state: [uploadResponse2.text],
      annotations: [uploadResponse2.text],
      deleted: []
    };

    expect(syncResponse.body).toEqual(expectedResponse);
  });

  test('Different implicit users', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const createApiKeyResponse = await createApiKey(userId, 'Test Key', ['Read'], undefined, { jwt: registerResponse.body.jwt_token });
    expect(createApiKeyResponse.status).toBe(200);

    const uploadResponse = await uploadBook(userId, 'Alices_Adventures_in_Wonderland.epub', { jwt: registerResponse.body.jwt_token });
    expect(uploadResponse.status).toBe(200);

    const { response: registerResponse2 } = await registerUser();
    expect(registerResponse2.status).toBe(200);
    const userId2 = registerResponse2.body.user_id;

    const createApiKeyResponse2 = await createApiKey(userId2, 'Test Key', ['Read'], undefined, { jwt: registerResponse2.body.jwt_token });
    expect(createApiKeyResponse2.status).toBe(200);

    const uploadResponse2 = await uploadBook(userId2, 'The_Wonderful_Wizard_of_Oz.epub', { jwt: registerResponse2.body.jwt_token });
    expect(uploadResponse2.status).toBe(200);

    let syncResponse = await sync(undefined, undefined, { apiKey: createApiKeyResponse.body.key });
    expect(syncResponse.status).toBe(200);

    let expectedResponse = {
      file: [uploadResponse.text],
      metadata: [uploadResponse.text],
      cover: [uploadResponse.text],
      state: [uploadResponse.text],
      annotations: [uploadResponse.text],
      deleted: []
    };

    expect(syncResponse.body).toEqual(expectedResponse);

    syncResponse = await sync(undefined, undefined, { apiKey: createApiKeyResponse2.body.key });
    expect(syncResponse.status).toBe(200);

    expectedResponse = {
      file: [uploadResponse2.text],
      metadata: [uploadResponse2.text],
      cover: [uploadResponse2.text],
      state: [uploadResponse2.text],
      annotations: [uploadResponse2.text],
      deleted: []
    };

    expect(syncResponse.body).toEqual(expectedResponse);
  });

  test('Invalid timestamp', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const createApiKeyResponse = await createApiKey(userId, 'Test Key', ['Read'], undefined, { jwt: registerResponse.body.jwt_token });
    expect(createApiKeyResponse.status).toBe(200);

    let syncResponse = await sync(userId, 'not valid', { apiKey: createApiKeyResponse.body.key });
    expect(syncResponse.status).toBe(400);
    expect(syncResponse.text).toBe(INVALID_TIMESTAMP);
  });

  test('Non-existent user', async () => {
    const { response: registerResponse } = await registerUser(undefined, undefined, process.env.ADMIN_KEY);
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

    const { response: registerResponse2 } = await registerUser(undefined, undefined, process.env.ADMIN_KEY);
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
