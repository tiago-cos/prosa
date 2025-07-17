import { BOOK_NOT_FOUND, uploadBook } from '../utils/books';
import { FORBIDDEN, INVALID_API_KEY, UNAUTHORIZED, wait } from '../utils/common';
import { addMetadata, addMetadataRequest, ALICE_METADATA, deleteMetadata, EXAMPLE_METADATA, getMetadata, INVALID_METADATA, listMetadataRequests, METADATA_CONFLICT, METADATA_NOT_FOUND, patchMetadata, updateMetadata } from '../utils/metadata';
import { createApiKey, INVALID_PROVIDERS, patchPreferences, registerUser } from '../utils/users';

describe('Get metadata JWT', () => {
  test('Simple', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const uploadResponse = await uploadBook(userId, 'Alices_Adventures_in_Wonderland.epub', { jwt: registerResponse.body.jwt_token });
    expect(uploadResponse.status).toBe(200);

    // Wait for metadata to be extracted
    await wait(0.5);

    const downloadResponse = await getMetadata(uploadResponse.text, { jwt: registerResponse.body.jwt_token });
    expect(downloadResponse.status).toBe(200);

    expect(downloadResponse.body).toEqual(ALICE_METADATA);
  });

  test('Disabled auto-fetch', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const patchPreferencesResponse = await patchPreferences(userId, undefined, false, { jwt: registerResponse.body.jwt_token });
    expect(patchPreferencesResponse.status).toBe(204);

    const uploadResponse = await uploadBook(userId, 'Alices_Adventures_in_Wonderland.epub', { jwt: registerResponse.body.jwt_token });
    expect(uploadResponse.status).toBe(200);

    // Wait for metadata to be extracted
    await wait(0.5);

    const downloadResponse = await getMetadata(uploadResponse.text, { jwt: registerResponse.body.jwt_token });
    expect(downloadResponse.status).toBe(404);
    expect(downloadResponse.text).toEqual(METADATA_NOT_FOUND);
  });

  test('Non-existent metadata', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    // This epub does not contain metadata
    const uploadResponse = await uploadBook(userId, 'The_Great_Gatsby.epub', { jwt: registerResponse.body.jwt_token });
    expect(uploadResponse.status).toBe(200);

    // Give chance for any metadata to be extracted
    await wait(0.5);

    const downloadResponse = await getMetadata(uploadResponse.text, { jwt: registerResponse.body.jwt_token });
    expect(downloadResponse.status).toBe(404);
    expect(downloadResponse.text).toBe(METADATA_NOT_FOUND);
  });

  test('Non-existent book', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);

    const downloadResponse = await getMetadata('non-existent', { jwt: registerResponse.body.jwt_token });
    expect(downloadResponse.status).toBe(404);
    expect(downloadResponse.text).toBe(BOOK_NOT_FOUND);
  });

  test('Different user without permission', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const uploadResponse = await uploadBook(userId, 'Alices_Adventures_in_Wonderland.epub', { jwt: registerResponse.body.jwt_token });
    expect(uploadResponse.status).toBe(200);

    // Wait for metadata to be extracted
    await wait(0.5);

    const { response: registerResponse2 } = await registerUser();
    expect(registerResponse2.status).toBe(200);

    const downloadResponse = await getMetadata(uploadResponse.text, { jwt: registerResponse2.body.jwt_token });
    expect(downloadResponse.status).toBe(404);
    expect(downloadResponse.text).toBe(BOOK_NOT_FOUND);
  });

  test('Different user with permission', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const uploadResponse = await uploadBook(userId, 'Alices_Adventures_in_Wonderland.epub', { jwt: registerResponse.body.jwt_token });
    expect(uploadResponse.status).toBe(200);

    // Wait for metadata to be extracted
    await wait(0.5);

    const { response: registerResponse2 } = await registerUser(undefined, undefined, process.env.ADMIN_KEY);
    expect(registerResponse2.status).toBe(200);

    const downloadResponse = await getMetadata(uploadResponse.text, { jwt: registerResponse2.body.jwt_token });
    expect(downloadResponse.status).toBe(200);
  });

  test('No auth', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const uploadResponse = await uploadBook(userId, 'Alices_Adventures_in_Wonderland.epub', { jwt: registerResponse.body.jwt_token });
    expect(uploadResponse.status).toBe(200);

    // Wait for metadata to be extracted
    await wait(0.5);

    const downloadResponse = await getMetadata(uploadResponse.text);
    expect(downloadResponse.status).toBe(401);
    expect(downloadResponse.text).toBe(UNAUTHORIZED);
  });
});

describe('Get metadata api key', () => {
  test('Simple', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const uploadResponse = await uploadBook(userId, 'Alices_Adventures_in_Wonderland.epub', { jwt: registerResponse.body.jwt_token });
    expect(uploadResponse.status).toBe(200);

    // Wait for metadata to be extracted
    await wait(0.5);

    const createApiKeyResponse = await createApiKey(userId, 'Test Key', ['Read'], undefined, { jwt: registerResponse.body.jwt_token });
    expect(createApiKeyResponse.status).toBe(200);

    const downloadResponse = await getMetadata(uploadResponse.text, { apiKey: createApiKeyResponse.body.key });
    expect(downloadResponse.status).toBe(200);

    expect(downloadResponse.body).toEqual(ALICE_METADATA);
  });

  test('Non-existent metadata', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    // This epub does not contain a metadata
    const uploadResponse = await uploadBook(userId, 'The_Great_Gatsby.epub', { jwt: registerResponse.body.jwt_token });
    expect(uploadResponse.status).toBe(200);

    // Give chance for any metadata to be extracted
    await wait(0.5);

    const createApiKeyResponse = await createApiKey(userId, 'Test Key', ['Read'], undefined, { jwt: registerResponse.body.jwt_token });
    expect(createApiKeyResponse.status).toBe(200);

    const downloadResponse = await getMetadata(uploadResponse.text, { apiKey: createApiKeyResponse.body.key });
    expect(downloadResponse.status).toBe(404);
    expect(downloadResponse.text).toBe(METADATA_NOT_FOUND);
  });

  test('Non-existent book', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const createApiKeyResponse = await createApiKey(userId, 'Test Key', ['Read'], undefined, { jwt: registerResponse.body.jwt_token });
    expect(createApiKeyResponse.status).toBe(200);

    const downloadResponse = await getMetadata('non-existent', { apiKey: createApiKeyResponse.body.key });
    expect(downloadResponse.status).toBe(404);
    expect(downloadResponse.text).toBe(BOOK_NOT_FOUND);
  });

  test('Different user without permission', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const uploadResponse = await uploadBook(userId, 'Alices_Adventures_in_Wonderland.epub', { jwt: registerResponse.body.jwt_token });
    expect(uploadResponse.status).toBe(200);

    // Wait for metadata to be extracted
    await wait(0.5);

    const { response: registerResponse2 } = await registerUser();
    expect(registerResponse2.status).toBe(200);
    const userId2 = registerResponse2.body.user_id;

    const createApiKeyResponse = await createApiKey(userId2, 'Test Key', ['Read'], undefined, { jwt: registerResponse2.body.jwt_token });
    expect(createApiKeyResponse.status).toBe(200);

    const downloadResponse = await getMetadata(uploadResponse.text, { apiKey: createApiKeyResponse.body.key });
    expect(downloadResponse.status).toBe(404);
    expect(downloadResponse.text).toBe(BOOK_NOT_FOUND);
  });

  test('Different user with permission', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const uploadResponse = await uploadBook(userId, 'Alices_Adventures_in_Wonderland.epub', { jwt: registerResponse.body.jwt_token });
    expect(uploadResponse.status).toBe(200);

    // Wait for metadata to be extracted
    await wait(0.5);

    const { response: registerResponse2 } = await registerUser(undefined, undefined, process.env.ADMIN_KEY);
    expect(registerResponse2.status).toBe(200);
    const userId2 = registerResponse2.body.user_id;

    const createApiKeyResponse = await createApiKey(userId2, 'Test Key', ['Read'], undefined, { jwt: registerResponse2.body.jwt_token });
    expect(createApiKeyResponse.status).toBe(200);

    const downloadResponse = await getMetadata(uploadResponse.text, { apiKey: createApiKeyResponse.body.key });
    expect(downloadResponse.status).toBe(200);
  });

  test('Wrong capabilities', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const uploadResponse = await uploadBook(userId, 'Alices_Adventures_in_Wonderland.epub', { jwt: registerResponse.body.jwt_token });
    expect(uploadResponse.status).toBe(200);

    // Wait for metadata to be extracted
    await wait(0.5);

    const createApiKeyResponse = await createApiKey(userId, 'Test Key', ['Create', 'Update', 'Delete'], undefined, { jwt: registerResponse.body.jwt_token });
    expect(createApiKeyResponse.status).toBe(200);

    const downloadResponse = await getMetadata(uploadResponse.text, { apiKey: createApiKeyResponse.body.key });
    expect(downloadResponse.status).toBe(403);
    expect(downloadResponse.text).toBe(FORBIDDEN);
  });

  test('Expired api key', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const uploadResponse = await uploadBook(userId, 'Alices_Adventures_in_Wonderland.epub', { jwt: registerResponse.body.jwt_token });
    expect(uploadResponse.status).toBe(200);

    // Wait for metadata to be extracted
    await wait(0.5);

    const timestamp = Date.now() + 1000;
    const createApiKeyResponse = await createApiKey(userId, 'Test Key', ['Read'], timestamp, { jwt: registerResponse.body.jwt_token });
    expect(createApiKeyResponse.status).toBe(200);

    // Wait for the key to expire
    await wait(1.5);

    const downloadResponse = await getMetadata(uploadResponse.text, { apiKey: createApiKeyResponse.body.key });
    expect(downloadResponse.status).toBe(401);
    expect(downloadResponse.text).toBe(INVALID_API_KEY);
  });
});

describe('Add metadata JWT', () => {
  test('Simple', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const uploadResponse = await uploadBook(userId, 'The_Great_Gatsby.epub', { jwt: registerResponse.body.jwt_token });
    expect(uploadResponse.status).toBe(200);

    // Give chance for any metadata to be extracted
    await wait(0.5);

    const addResponse = await addMetadata(uploadResponse.text, EXAMPLE_METADATA, { jwt: registerResponse.body.jwt_token });
    expect(addResponse.status).toBe(204);

    const downloadResponse = await getMetadata(uploadResponse.text, { jwt: registerResponse.body.jwt_token });
    expect(downloadResponse.status).toBe(200);

    expect(downloadResponse.body).toEqual(EXAMPLE_METADATA);
  });

  test('Only authors', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const uploadResponse = await uploadBook(userId, 'The_Great_Gatsby.epub', { jwt: registerResponse.body.jwt_token });
    expect(uploadResponse.status).toBe(200);

    // Give chance for any metadata to be extracted
    await wait(0.5);

    const metadata = {
      contributors: [
        {
          name: 'Lewis Carroll',
          role: 'Author'
        }
      ]
    };

    const addResponse = await addMetadata(uploadResponse.text, metadata, { jwt: registerResponse.body.jwt_token });
    expect(addResponse.status).toBe(204);

    const downloadResponse = await getMetadata(uploadResponse.text, { jwt: registerResponse.body.jwt_token });
    expect(downloadResponse.status).toBe(200);

    expect(downloadResponse.body).toEqual(metadata);
  });

  test('Invalid metadata', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const uploadResponse = await uploadBook(userId, 'The_Great_Gatsby.epub', { jwt: registerResponse.body.jwt_token });
    expect(uploadResponse.status).toBe(200);

    // Give chance for any metadata to be extracted
    await wait(0.5);

    const addResponse = await addMetadata(uploadResponse.text, {}, { jwt: registerResponse.body.jwt_token });
    expect(addResponse.status).toBe(400);
    expect(addResponse.text).toBe(INVALID_METADATA);
  });

  test('Metadata conflict', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const uploadResponse = await uploadBook(userId, 'Alices_Adventures_in_Wonderland.epub', { jwt: registerResponse.body.jwt_token });
    expect(uploadResponse.status).toBe(200);

    // Wait for metadata to be extracted
    await wait(0.5);

    const addResponse = await addMetadata(uploadResponse.text, EXAMPLE_METADATA, { jwt: registerResponse.body.jwt_token });
    expect(addResponse.status).toBe(409);
    expect(addResponse.text).toBe(METADATA_CONFLICT);
  });

  test('Non-existent book', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);

    const addResponse = await addMetadata('non-existent', EXAMPLE_METADATA, { jwt: registerResponse.body.jwt_token });
    expect(addResponse.status).toBe(404);
    expect(addResponse.text).toBe(BOOK_NOT_FOUND);
  });

  test('Different user without permission', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const uploadResponse = await uploadBook(userId, 'The_Great_Gatsby.epub', { jwt: registerResponse.body.jwt_token });
    expect(uploadResponse.status).toBe(200);

    // Give chance for any metadata to be extracted
    await wait(0.5);

    const { response: registerResponse2 } = await registerUser();
    expect(registerResponse2.status).toBe(200);

    const addResponse = await addMetadata(uploadResponse.text, EXAMPLE_METADATA, { jwt: registerResponse2.body.jwt_token });
    expect(addResponse.status).toBe(404);
    expect(addResponse.text).toBe(BOOK_NOT_FOUND);
  });

  test('Different user with permission', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const uploadResponse = await uploadBook(userId, 'The_Great_Gatsby.epub', { jwt: registerResponse.body.jwt_token });
    expect(uploadResponse.status).toBe(200);

    // Give chance for any metadata to be extracted
    await wait(0.5);

    const { response: registerResponse2 } = await registerUser(undefined, undefined, process.env.ADMIN_KEY);
    expect(registerResponse2.status).toBe(200);

    const addResponse = await addMetadata(uploadResponse.text, EXAMPLE_METADATA, { jwt: registerResponse2.body.jwt_token });
    expect(addResponse.status).toBe(204);
  });

  test('No auth', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const uploadResponse = await uploadBook(userId, 'The_Great_Gatsby.epub', { jwt: registerResponse.body.jwt_token });
    expect(uploadResponse.status).toBe(200);

    // Give chance for any metadata to be extracted
    await wait(0.5);

    const addResponse = await addMetadata(uploadResponse.text, EXAMPLE_METADATA);
    expect(addResponse.status).toBe(401);
    expect(addResponse.text).toBe(UNAUTHORIZED);
  });
});

describe('Add metadata api key', () => {
  test('Simple', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const uploadResponse = await uploadBook(userId, 'The_Great_Gatsby.epub', { jwt: registerResponse.body.jwt_token });
    expect(uploadResponse.status).toBe(200);

    // Give chance for any metadata to be extracted
    await wait(0.5);

    const createApiKeyResponse = await createApiKey(userId, 'Test Key', ['Update'], undefined, { jwt: registerResponse.body.jwt_token });
    expect(createApiKeyResponse.status).toBe(200);

    const addResponse = await addMetadata(uploadResponse.text, EXAMPLE_METADATA, { apiKey: createApiKeyResponse.body.key });
    expect(addResponse.status).toBe(204);

    const downloadResponse = await getMetadata(uploadResponse.text, { jwt: registerResponse.body.jwt_token });
    expect(downloadResponse.status).toBe(200);

    expect(downloadResponse.body).toEqual(EXAMPLE_METADATA);
  });

  test('Only authors', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const uploadResponse = await uploadBook(userId, 'The_Great_Gatsby.epub', { jwt: registerResponse.body.jwt_token });
    expect(uploadResponse.status).toBe(200);

    // Give chance for any metadata to be extracted
    await wait(0.5);

    const createApiKeyResponse = await createApiKey(userId, 'Test Key', ['Update'], undefined, { jwt: registerResponse.body.jwt_token });
    expect(createApiKeyResponse.status).toBe(200);

    const metadata = {
      contributors: [
        {
          name: 'Lewis Carroll',
          role: 'Author'
        }
      ]
    };

    const addResponse = await addMetadata(uploadResponse.text, metadata, { apiKey: createApiKeyResponse.body.key });
    expect(addResponse.status).toBe(204);

    const downloadResponse = await getMetadata(uploadResponse.text, { jwt: registerResponse.body.jwt_token });
    expect(downloadResponse.status).toBe(200);

    expect(downloadResponse.body).toEqual(metadata);
  });

  test('Invalid metadata', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const uploadResponse = await uploadBook(userId, 'The_Great_Gatsby.epub', { jwt: registerResponse.body.jwt_token });
    expect(uploadResponse.status).toBe(200);

    // Give chance for any metadata to be extracted
    await wait(0.5);

    const createApiKeyResponse = await createApiKey(userId, 'Test Key', ['Update'], undefined, { jwt: registerResponse.body.jwt_token });
    expect(createApiKeyResponse.status).toBe(200);

    const addResponse = await addMetadata(uploadResponse.text, {}, { apiKey: createApiKeyResponse.body.key });
    expect(addResponse.status).toBe(400);
    expect(addResponse.text).toBe(INVALID_METADATA);
  });

  test('Metadata conflict', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const uploadResponse = await uploadBook(userId, 'Alices_Adventures_in_Wonderland.epub', { jwt: registerResponse.body.jwt_token });
    expect(uploadResponse.status).toBe(200);

    // Wait for metadata to be extracted
    await wait(0.5);

    const createApiKeyResponse = await createApiKey(userId, 'Test Key', ['Update'], undefined, { jwt: registerResponse.body.jwt_token });
    expect(createApiKeyResponse.status).toBe(200);

    const addResponse = await addMetadata(uploadResponse.text, EXAMPLE_METADATA, { apiKey: createApiKeyResponse.body.key });
    expect(addResponse.status).toBe(409);
    expect(addResponse.text).toBe(METADATA_CONFLICT);
  });

  test('Non-existent book', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const createApiKeyResponse = await createApiKey(userId, 'Test Key', ['Update'], undefined, { jwt: registerResponse.body.jwt_token });
    expect(createApiKeyResponse.status).toBe(200);

    const addResponse = await addMetadata('non-existent', EXAMPLE_METADATA, { apiKey: createApiKeyResponse.body.key });
    expect(addResponse.status).toBe(404);
    expect(addResponse.text).toBe(BOOK_NOT_FOUND);
  });

  test('Different user without permission', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const uploadResponse = await uploadBook(userId, 'The_Great_Gatsby.epub', { jwt: registerResponse.body.jwt_token });
    expect(uploadResponse.status).toBe(200);

    // Give chance for any metadata to be extracted
    await wait(0.5);

    const { response: registerResponse2 } = await registerUser();
    expect(registerResponse2.status).toBe(200);
    const userId2 = registerResponse2.body.user_id;

    const createApiKeyResponse = await createApiKey(userId2, 'Test Key', ['Update'], undefined, { jwt: registerResponse2.body.jwt_token });
    expect(createApiKeyResponse.status).toBe(200);

    const addResponse = await addMetadata(uploadResponse.text, EXAMPLE_METADATA, { apiKey: createApiKeyResponse.body.key });
    expect(addResponse.status).toBe(404);
    expect(addResponse.text).toBe(BOOK_NOT_FOUND);
  });

  test('Different user with permission', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const uploadResponse = await uploadBook(userId, 'The_Great_Gatsby.epub', { jwt: registerResponse.body.jwt_token });
    expect(uploadResponse.status).toBe(200);

    // Give chance for any metadata to be extracted
    await wait(0.5);

    const { response: registerResponse2 } = await registerUser(undefined, undefined, process.env.ADMIN_KEY);
    expect(registerResponse2.status).toBe(200);
    const userId2 = registerResponse2.body.user_id;

    const createApiKeyResponse = await createApiKey(userId2, 'Test Key', ['Update'], undefined, { jwt: registerResponse2.body.jwt_token });
    expect(createApiKeyResponse.status).toBe(200);

    const addResponse = await addMetadata(uploadResponse.text, EXAMPLE_METADATA, { apiKey: createApiKeyResponse.body.key });
    expect(addResponse.status).toBe(204);
  });

  test('Wrong capabilities', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const uploadResponse = await uploadBook(userId, 'The_Great_Gatsby.epub', { jwt: registerResponse.body.jwt_token });
    expect(uploadResponse.status).toBe(200);

    // Give chance for any metadata to be extracted
    await wait(0.5);

    const createApiKeyResponse = await createApiKey(userId, 'Test Key', ['Create', 'Read', 'Delete'], undefined, { jwt: registerResponse.body.jwt_token });
    expect(createApiKeyResponse.status).toBe(200);

    const addResponse = await addMetadata(uploadResponse.text, EXAMPLE_METADATA, { apiKey: createApiKeyResponse.body.key });
    expect(addResponse.status).toBe(403);
    expect(addResponse.text).toBe(FORBIDDEN);
  });

  test('Expired key', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const uploadResponse = await uploadBook(userId, 'The_Great_Gatsby.epub', { jwt: registerResponse.body.jwt_token });
    expect(uploadResponse.status).toBe(200);

    // Give chance for any metadata to be extracted
    await wait(0.5);

    const timestamp = Date.now() + 1000;
    const createApiKeyResponse = await createApiKey(userId, 'Test Key', ['Update'], timestamp, { jwt: registerResponse.body.jwt_token });
    expect(createApiKeyResponse.status).toBe(200);

    // Wait for the key to expire
    await wait(1.5);

    const addResponse = await addMetadata(uploadResponse.text, EXAMPLE_METADATA, { apiKey: createApiKeyResponse.body.key });
    expect(addResponse.status).toBe(401);
    expect(addResponse.text).toBe(INVALID_API_KEY);
  });
});

describe('Delete metadata JWT', () => {
  test('Simple', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const uploadResponse = await uploadBook(userId, 'Alices_Adventures_in_Wonderland.epub', { jwt: registerResponse.body.jwt_token });
    expect(uploadResponse.status).toBe(200);

    // Wait for metadata to be extracted
    await wait(0.5);

    const deleteResponse = await deleteMetadata(uploadResponse.text, { jwt: registerResponse.body.jwt_token });
    expect(deleteResponse.status).toBe(204);

    const downloadResponse = await getMetadata(uploadResponse.text, { jwt: registerResponse.body.jwt_token });
    expect(downloadResponse.status).toBe(404);
    expect(downloadResponse.text).toBe(METADATA_NOT_FOUND);
  });

  test('Non-existent metadata', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    // This epub does not contain a metadata
    const uploadResponse = await uploadBook(userId, 'The_Great_Gatsby.epub', { jwt: registerResponse.body.jwt_token });
    expect(uploadResponse.status).toBe(200);

    // Give chance for any metadata to be extracted
    await wait(0.5);

    const deleteResponse = await deleteMetadata(uploadResponse.text, { jwt: registerResponse.body.jwt_token });
    expect(deleteResponse.status).toBe(404);
    expect(deleteResponse.text).toBe(METADATA_NOT_FOUND);
  });

  test('Non-existent book', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);

    const deleteResponse = await deleteMetadata('non-existent', { jwt: registerResponse.body.jwt_token });
    expect(deleteResponse.status).toBe(404);
    expect(deleteResponse.text).toBe(BOOK_NOT_FOUND);
  });

  test('Different user without permission', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const uploadResponse = await uploadBook(userId, 'Alices_Adventures_in_Wonderland.epub', { jwt: registerResponse.body.jwt_token });
    expect(uploadResponse.status).toBe(200);

    // Wait for metadata to be extracted
    await wait(0.5);

    const { response: registerResponse2 } = await registerUser();
    expect(registerResponse2.status).toBe(200);

    const deleteResponse = await deleteMetadata(uploadResponse.text, { jwt: registerResponse2.body.jwt_token });
    expect(deleteResponse.status).toBe(404);
    expect(deleteResponse.text).toBe(BOOK_NOT_FOUND);
  });

  test('Different user with permission', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const uploadResponse = await uploadBook(userId, 'Alices_Adventures_in_Wonderland.epub', { jwt: registerResponse.body.jwt_token });
    expect(uploadResponse.status).toBe(200);

    // Wait for metadata to be extracted
    await wait(0.5);

    const { response: registerResponse2 } = await registerUser(undefined, undefined, process.env.ADMIN_KEY);
    expect(registerResponse2.status).toBe(200);

    const deleteResponse = await deleteMetadata(uploadResponse.text, { jwt: registerResponse2.body.jwt_token });
    expect(deleteResponse.status).toBe(204);
  });

  test('No auth', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const uploadResponse = await uploadBook(userId, 'Alices_Adventures_in_Wonderland.epub', { jwt: registerResponse.body.jwt_token });
    expect(uploadResponse.status).toBe(200);

    // Wait for metadata to be extracted
    await wait(0.5);

    const deleteResponse = await deleteMetadata(uploadResponse.text);
    expect(deleteResponse.status).toBe(401);
    expect(deleteResponse.text).toBe(UNAUTHORIZED);
  });
});

describe('Delete metadata api key', () => {
  test('Simple', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const uploadResponse = await uploadBook(userId, 'Alices_Adventures_in_Wonderland.epub', { jwt: registerResponse.body.jwt_token });
    expect(uploadResponse.status).toBe(200);

    // Wait for metadata to be extracted
    await wait(0.5);

    const createApiKeyResponse = await createApiKey(userId, 'Test Key', ['Delete'], undefined, { jwt: registerResponse.body.jwt_token });
    expect(createApiKeyResponse.status).toBe(200);

    const deleteResponse = await deleteMetadata(uploadResponse.text, { apiKey: createApiKeyResponse.body.key });
    expect(deleteResponse.status).toBe(204);

    const downloadResponse = await getMetadata(uploadResponse.text, { jwt: registerResponse.body.jwt_token });
    expect(downloadResponse.status).toBe(404);
    expect(downloadResponse.text).toBe(METADATA_NOT_FOUND);
  });

  test('Non-existent metadata', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    // This epub does not contain a metadata
    const uploadResponse = await uploadBook(userId, 'The_Great_Gatsby.epub', { jwt: registerResponse.body.jwt_token });
    expect(uploadResponse.status).toBe(200);

    // Give chance for any metadata to be extracted
    await wait(0.5);

    const createApiKeyResponse = await createApiKey(userId, 'Test Key', ['Delete'], undefined, { jwt: registerResponse.body.jwt_token });
    expect(createApiKeyResponse.status).toBe(200);

    const deleteResponse = await deleteMetadata(uploadResponse.text, { apiKey: createApiKeyResponse.body.key });
    expect(deleteResponse.status).toBe(404);
    expect(deleteResponse.text).toBe(METADATA_NOT_FOUND);
  });

  test('Non-existent book', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const createApiKeyResponse = await createApiKey(userId, 'Test Key', ['Delete'], undefined, { jwt: registerResponse.body.jwt_token });
    expect(createApiKeyResponse.status).toBe(200);

    const deleteResponse = await deleteMetadata('non-existent', { apiKey: createApiKeyResponse.body.key });
    expect(deleteResponse.status).toBe(404);
    expect(deleteResponse.text).toBe(BOOK_NOT_FOUND);
  });

  test('Different user without permission', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const uploadResponse = await uploadBook(userId, 'Alices_Adventures_in_Wonderland.epub', { jwt: registerResponse.body.jwt_token });
    expect(uploadResponse.status).toBe(200);

    // Wait for metadata to be extracted
    await wait(0.5);

    const { response: registerResponse2 } = await registerUser();
    expect(registerResponse2.status).toBe(200);
    const userId2 = registerResponse2.body.user_id;

    const createApiKeyResponse = await createApiKey(userId2, 'Test Key', ['Delete'], undefined, { jwt: registerResponse2.body.jwt_token });
    expect(createApiKeyResponse.status).toBe(200);

    const deleteResponse = await deleteMetadata(uploadResponse.text, { apiKey: createApiKeyResponse.body.key });
    expect(deleteResponse.status).toBe(404);
    expect(deleteResponse.text).toBe(BOOK_NOT_FOUND);
  });

  test('Different user with permission', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const uploadResponse = await uploadBook(userId, 'Alices_Adventures_in_Wonderland.epub', { jwt: registerResponse.body.jwt_token });
    expect(uploadResponse.status).toBe(200);

    // Wait for metadata to be extracted
    await wait(0.5);

    const { response: registerResponse2 } = await registerUser(undefined, undefined, process.env.ADMIN_KEY);
    expect(registerResponse2.status).toBe(200);
    const userId2 = registerResponse2.body.user_id;

    const createApiKeyResponse = await createApiKey(userId2, 'Test Key', ['Delete'], undefined, { jwt: registerResponse2.body.jwt_token });
    expect(createApiKeyResponse.status).toBe(200);

    const deleteResponse = await deleteMetadata(uploadResponse.text, { apiKey: createApiKeyResponse.body.key });
    expect(deleteResponse.status).toBe(204);
  });

  test('Wrong capabilities', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const uploadResponse = await uploadBook(userId, 'Alices_Adventures_in_Wonderland.epub', { jwt: registerResponse.body.jwt_token });
    expect(uploadResponse.status).toBe(200);

    // Wait for metadata to be extracted
    await wait(0.5);

    const createApiKeyResponse = await createApiKey(userId, 'Test Key', ['Read', 'Create', 'Update'], undefined, { jwt: registerResponse.body.jwt_token });
    expect(createApiKeyResponse.status).toBe(200);

    const deleteResponse = await deleteMetadata(uploadResponse.text, { apiKey: createApiKeyResponse.body.key });
    expect(deleteResponse.status).toBe(403);
    expect(deleteResponse.text).toBe(FORBIDDEN);
  });

  test('Expired key', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const uploadResponse = await uploadBook(userId, 'Alices_Adventures_in_Wonderland.epub', { jwt: registerResponse.body.jwt_token });
    expect(uploadResponse.status).toBe(200);

    // Wait for metadata to be extracted
    await wait(0.5);

    const timestamp = Date.now() + 1000;
    const createApiKeyResponse = await createApiKey(userId, 'Test Key', ['Delete'], timestamp, { jwt: registerResponse.body.jwt_token });
    expect(createApiKeyResponse.status).toBe(200);

    // Wait for the key to expire
    await wait(1.5);

    const deleteResponse = await deleteMetadata(uploadResponse.text, { apiKey: createApiKeyResponse.body.key });
    expect(deleteResponse.status).toBe(401);
    expect(deleteResponse.text).toBe(INVALID_API_KEY);
  });
});

describe('Update metadata JWT', () => {
  test('Simple', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const uploadResponse = await uploadBook(userId, 'Alices_Adventures_in_Wonderland.epub', { jwt: registerResponse.body.jwt_token });
    expect(uploadResponse.status).toBe(200);

    // Wait for metadata to be extracted
    await wait(0.5);

    const updateResponse = await updateMetadata(uploadResponse.text, EXAMPLE_METADATA, { jwt: registerResponse.body.jwt_token });
    expect(updateResponse.status).toBe(204);

    const downloadResponse = await getMetadata(uploadResponse.text, { jwt: registerResponse.body.jwt_token });
    expect(downloadResponse.status).toBe(200);

    expect(downloadResponse.body).toEqual(EXAMPLE_METADATA);
  });

  test('Non-existent metadata', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    // This epub does not contain metadata
    const uploadResponse = await uploadBook(userId, 'The_Great_Gatsby.epub', { jwt: registerResponse.body.jwt_token });
    expect(uploadResponse.status).toBe(200);

    // Give chance for any metadata to be extracted
    await wait(0.5);

    const updateResponse = await updateMetadata(uploadResponse.text, EXAMPLE_METADATA, { jwt: registerResponse.body.jwt_token });
    expect(updateResponse.status).toBe(404);
    expect(updateResponse.text).toBe(METADATA_NOT_FOUND);
  });

  test('Non-existent book', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);

    const updateResponse = await updateMetadata('non-existent', EXAMPLE_METADATA, { jwt: registerResponse.body.jwt_token });
    expect(updateResponse.status).toBe(404);
    expect(updateResponse.text).toBe(BOOK_NOT_FOUND);
  });

  test('Invalid metadata', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const uploadResponse = await uploadBook(userId, 'Alices_Adventures_in_Wonderland.epub', { jwt: registerResponse.body.jwt_token });
    expect(uploadResponse.status).toBe(200);

    // Wait for metadata to be extracted
    await wait(0.5);

    const updateResponse = await updateMetadata(uploadResponse.text, {}, { jwt: registerResponse.body.jwt_token });
    expect(updateResponse.status).toBe(400);
    expect(updateResponse.text).toBe(INVALID_METADATA);
  });

  test('Different user without permission', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const uploadResponse = await uploadBook(userId, 'Alices_Adventures_in_Wonderland.epub', { jwt: registerResponse.body.jwt_token });
    expect(uploadResponse.status).toBe(200);

    // Wait for metadata to be extracted
    await wait(0.5);

    const { response: registerResponse2 } = await registerUser();
    expect(registerResponse2.status).toBe(200);

    const updateResponse = await updateMetadata(uploadResponse.text, EXAMPLE_METADATA, { jwt: registerResponse2.body.jwt_token });
    expect(updateResponse.status).toBe(404);
    expect(updateResponse.text).toBe(BOOK_NOT_FOUND);
  });

  test('Different user with permission', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const uploadResponse = await uploadBook(userId, 'Alices_Adventures_in_Wonderland.epub', { jwt: registerResponse.body.jwt_token });
    expect(uploadResponse.status).toBe(200);

    // Wait for metadata to be extracted
    await wait(0.5);

    const { response: registerResponse2 } = await registerUser(undefined, undefined, process.env.ADMIN_KEY);
    expect(registerResponse2.status).toBe(200);

    const updateResponse = await updateMetadata(uploadResponse.text, EXAMPLE_METADATA, { jwt: registerResponse2.body.jwt_token });
    expect(updateResponse.status).toBe(204);
  });

  test('No auth', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const uploadResponse = await uploadBook(userId, 'Alices_Adventures_in_Wonderland.epub', { jwt: registerResponse.body.jwt_token });
    expect(uploadResponse.status).toBe(200);

    // Wait for metadata to be extracted
    await wait(0.5);

    const updateResponse = await updateMetadata(uploadResponse.text, EXAMPLE_METADATA);
    expect(updateResponse.status).toBe(401);
    expect(updateResponse.text).toBe(UNAUTHORIZED);
  });
});

describe('Update metadata api key', () => {
  test('Simple', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const uploadResponse = await uploadBook(userId, 'Alices_Adventures_in_Wonderland.epub', { jwt: registerResponse.body.jwt_token });
    expect(uploadResponse.status).toBe(200);

    // Wait for metadata to be extracted
    await wait(0.5);

    const createApiKeyResponse = await createApiKey(userId, 'Test Key', ['Update'], undefined, { jwt: registerResponse.body.jwt_token });
    expect(createApiKeyResponse.status).toBe(200);

    const updateResponse = await updateMetadata(uploadResponse.text, EXAMPLE_METADATA, { apiKey: createApiKeyResponse.body.key });
    expect(updateResponse.status).toBe(204);

    const downloadResponse = await getMetadata(uploadResponse.text, { jwt: registerResponse.body.jwt_token });
    expect(downloadResponse.status).toBe(200);

    expect(downloadResponse.body).toEqual(EXAMPLE_METADATA);
  });

  test('Non-existent metadata', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    // This epub does not contain metadata
    const uploadResponse = await uploadBook(userId, 'The_Great_Gatsby.epub', { jwt: registerResponse.body.jwt_token });
    expect(uploadResponse.status).toBe(200);

    // Give chance for any metadata to be extracted
    await wait(0.5);

    const createApiKeyResponse = await createApiKey(userId, 'Test Key', ['Update'], undefined, { jwt: registerResponse.body.jwt_token });
    expect(createApiKeyResponse.status).toBe(200);

    const updateResponse = await updateMetadata(uploadResponse.text, EXAMPLE_METADATA, { apiKey: createApiKeyResponse.body.key });
    expect(updateResponse.status).toBe(404);
    expect(updateResponse.text).toBe(METADATA_NOT_FOUND);
  });

  test('Non-existent book', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const createApiKeyResponse = await createApiKey(userId, 'Test Key', ['Update'], undefined, { jwt: registerResponse.body.jwt_token });
    expect(createApiKeyResponse.status).toBe(200);

    const updateResponse = await updateMetadata('non-existent', EXAMPLE_METADATA, { apiKey: createApiKeyResponse.body.key });
    expect(updateResponse.status).toBe(404);
    expect(updateResponse.text).toBe(BOOK_NOT_FOUND);
  });

  test('Invalid metadata', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const uploadResponse = await uploadBook(userId, 'Alices_Adventures_in_Wonderland.epub', { jwt: registerResponse.body.jwt_token });
    expect(uploadResponse.status).toBe(200);

    // Wait for metadata to be extracted
    await wait(0.5);

    const createApiKeyResponse = await createApiKey(userId, 'Test Key', ['Update'], undefined, { jwt: registerResponse.body.jwt_token });
    expect(createApiKeyResponse.status).toBe(200);

    const updateResponse = await updateMetadata(uploadResponse.text, {}, { apiKey: createApiKeyResponse.body.key });
    expect(updateResponse.status).toBe(400);
    expect(updateResponse.text).toBe(INVALID_METADATA);
  });

  test('Different user without permission', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const uploadResponse = await uploadBook(userId, 'Alices_Adventures_in_Wonderland.epub', { jwt: registerResponse.body.jwt_token });
    expect(uploadResponse.status).toBe(200);

    // Wait for metadata to be extracted
    await wait(0.5);

    const { response: registerResponse2 } = await registerUser();
    expect(registerResponse2.status).toBe(200);
    const userId2 = registerResponse2.body.user_id;

    const createApiKeyResponse = await createApiKey(userId2, 'Test Key', ['Update'], undefined, { jwt: registerResponse2.body.jwt_token });
    expect(createApiKeyResponse.status).toBe(200);

    const updateResponse = await updateMetadata(uploadResponse.text, EXAMPLE_METADATA, { apiKey: createApiKeyResponse.body.key });
    expect(updateResponse.status).toBe(404);
    expect(updateResponse.text).toBe(BOOK_NOT_FOUND);
  });

  test('Different user with permission', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const uploadResponse = await uploadBook(userId, 'Alices_Adventures_in_Wonderland.epub', { jwt: registerResponse.body.jwt_token });
    expect(uploadResponse.status).toBe(200);

    // Wait for metadata to be extracted
    await wait(0.5);

    const { response: registerResponse2 } = await registerUser(undefined, undefined, process.env.ADMIN_KEY);
    expect(registerResponse2.status).toBe(200);
    const userId2 = registerResponse2.body.user_id;

    const createApiKeyResponse = await createApiKey(userId2, 'Test Key', ['Update'], undefined, { jwt: registerResponse2.body.jwt_token });
    expect(createApiKeyResponse.status).toBe(200);

    const updateResponse = await updateMetadata(uploadResponse.text, EXAMPLE_METADATA, { apiKey: createApiKeyResponse.body.key });
    expect(updateResponse.status).toBe(204);
  });

  test('Wrong capabilities', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const uploadResponse = await uploadBook(userId, 'Alices_Adventures_in_Wonderland.epub', { jwt: registerResponse.body.jwt_token });
    expect(uploadResponse.status).toBe(200);

    // Wait for metadata to be extracted
    await wait(0.5);

    const createApiKeyResponse = await createApiKey(userId, 'Test Key', ['Create', 'Read', 'Delete'], undefined, { jwt: registerResponse.body.jwt_token });
    expect(createApiKeyResponse.status).toBe(200);

    const updateResponse = await updateMetadata(uploadResponse.text, EXAMPLE_METADATA, { apiKey: createApiKeyResponse.body.key });
    expect(updateResponse.status).toBe(403);
    expect(updateResponse.text).toBe(FORBIDDEN);
  });

  test('Expired key', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const uploadResponse = await uploadBook(userId, 'Alices_Adventures_in_Wonderland.epub', { jwt: registerResponse.body.jwt_token });
    expect(uploadResponse.status).toBe(200);

    // Wait for metadata to be extracted
    await wait(0.5);

    const timestamp = Date.now() + 1000;
    const createApiKeyResponse = await createApiKey(userId, 'Test Key', ['Update'], timestamp, { jwt: registerResponse.body.jwt_token });
    expect(createApiKeyResponse.status).toBe(200);

    // Wait for the key to expire
    await wait(1.5);

    const updateResponse = await updateMetadata(uploadResponse.text, EXAMPLE_METADATA, { apiKey: createApiKeyResponse.body.key });
    expect(updateResponse.status).toBe(401);
    expect(updateResponse.text).toBe(INVALID_API_KEY);
  });
});

describe('Patch metadata JWT', () => {
  test('Simple', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const uploadResponse = await uploadBook(userId, 'Alices_Adventures_in_Wonderland.epub', { jwt: registerResponse.body.jwt_token });
    expect(uploadResponse.status).toBe(200);

    // Wait for metadata to be extracted
    await wait(0.5);

    const patchResponse = await patchMetadata(uploadResponse.text, { title: 'title test' }, { jwt: registerResponse.body.jwt_token });
    expect(patchResponse.status).toBe(204);

    let expectedMetadata = structuredClone(ALICE_METADATA);
    expectedMetadata.title = 'title test';

    const downloadResponse = await getMetadata(uploadResponse.text, { jwt: registerResponse.body.jwt_token });
    expect(downloadResponse.status).toBe(200);

    expect(downloadResponse.body).toEqual(expectedMetadata);
  });

  test('Non-existent metadata', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    // This epub does not contain metadata
    const uploadResponse = await uploadBook(userId, 'The_Great_Gatsby.epub', { jwt: registerResponse.body.jwt_token });
    expect(uploadResponse.status).toBe(200);

    // Give chance for any metadata to be extracted
    await wait(0.5);

    const patchResponse = await patchMetadata(uploadResponse.text, { title: 'title test' }, { jwt: registerResponse.body.jwt_token });
    expect(patchResponse.status).toBe(404);
    expect(patchResponse.text).toBe(METADATA_NOT_FOUND);
  });

  test('Non-existent book', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);

    const patchResponse = await patchMetadata('non-existent', { title: 'title test' }, { jwt: registerResponse.body.jwt_token });
    expect(patchResponse.status).toBe(404);
    expect(patchResponse.text).toBe(BOOK_NOT_FOUND);
  });

  test('Invalid metadata', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const uploadResponse = await uploadBook(userId, 'Alices_Adventures_in_Wonderland.epub', { jwt: registerResponse.body.jwt_token });
    expect(uploadResponse.status).toBe(200);

    // Wait for metadata to be extracted
    await wait(0.5);

    const patchResponse = await patchMetadata(uploadResponse.text, {}, { jwt: registerResponse.body.jwt_token });
    expect(patchResponse.status).toBe(400);
    expect(patchResponse.text).toBe(INVALID_METADATA);
  });

  test('Different user without permission', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const uploadResponse = await uploadBook(userId, 'Alices_Adventures_in_Wonderland.epub', { jwt: registerResponse.body.jwt_token });
    expect(uploadResponse.status).toBe(200);

    // Wait for metadata to be extracted
    await wait(0.5);

    const { response: registerResponse2 } = await registerUser();
    expect(registerResponse2.status).toBe(200);

    const patchResponse = await patchMetadata(uploadResponse.text, { title: 'title test' }, { jwt: registerResponse2.body.jwt_token });
    expect(patchResponse.status).toBe(404);
    expect(patchResponse.text).toBe(BOOK_NOT_FOUND);
  });

  test('Different user with permission', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const uploadResponse = await uploadBook(userId, 'Alices_Adventures_in_Wonderland.epub', { jwt: registerResponse.body.jwt_token });
    expect(uploadResponse.status).toBe(200);

    // Wait for metadata to be extracted
    await wait(0.5);

    const { response: registerResponse2 } = await registerUser(undefined, undefined, process.env.ADMIN_KEY);
    expect(registerResponse2.status).toBe(200);

    const patchResponse = await patchMetadata(uploadResponse.text, { title: 'title test' }, { jwt: registerResponse2.body.jwt_token });
    expect(patchResponse.status).toBe(204);
  });

  test('No auth', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const uploadResponse = await uploadBook(userId, 'Alices_Adventures_in_Wonderland.epub', { jwt: registerResponse.body.jwt_token });
    expect(uploadResponse.status).toBe(200);

    // Wait for metadata to be extracted
    await wait(0.5);

    const patchResponse = await patchMetadata(uploadResponse.text, { title: 'title test' });
    expect(patchResponse.status).toBe(401);
    expect(patchResponse.text).toBe(UNAUTHORIZED);
  });
});

describe('Patch metadata api key', () => {
  test('Simple', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const uploadResponse = await uploadBook(userId, 'Alices_Adventures_in_Wonderland.epub', { jwt: registerResponse.body.jwt_token });
    expect(uploadResponse.status).toBe(200);

    // Wait for metadata to be extracted
    await wait(0.5);

    const createApiKeyResponse = await createApiKey(userId, 'Test Key', ['Update'], undefined, { jwt: registerResponse.body.jwt_token });
    expect(createApiKeyResponse.status).toBe(200);

    const patchResponse = await patchMetadata(uploadResponse.text, { title: 'title test' }, { apiKey: createApiKeyResponse.body.key });
    expect(patchResponse.status).toBe(204);

    let expectedMetadata = structuredClone(ALICE_METADATA);
    expectedMetadata.title = 'title test';

    const downloadResponse = await getMetadata(uploadResponse.text, { jwt: registerResponse.body.jwt_token });
    expect(downloadResponse.status).toBe(200);

    expect(downloadResponse.body).toEqual(expectedMetadata);
  });

  test('Non-existent metadata', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    // This epub does not contain metadata
    const uploadResponse = await uploadBook(userId, 'The_Great_Gatsby.epub', { jwt: registerResponse.body.jwt_token });
    expect(uploadResponse.status).toBe(200);

    // Give chance for any metadata to be extracted
    await wait(0.5);

    const createApiKeyResponse = await createApiKey(userId, 'Test Key', ['Update'], undefined, { jwt: registerResponse.body.jwt_token });
    expect(createApiKeyResponse.status).toBe(200);

    const patchResponse = await patchMetadata(uploadResponse.text, { title: 'title test' }, { apiKey: createApiKeyResponse.body.key });
    expect(patchResponse.status).toBe(404);
    expect(patchResponse.text).toBe(METADATA_NOT_FOUND);
  });

  test('Non-existent book', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const createApiKeyResponse = await createApiKey(userId, 'Test Key', ['Update'], undefined, { jwt: registerResponse.body.jwt_token });
    expect(createApiKeyResponse.status).toBe(200);

    const patchResponse = await patchMetadata('non-existent', { title: 'title test' }, { apiKey: createApiKeyResponse.body.key });
    expect(patchResponse.status).toBe(404);
    expect(patchResponse.text).toBe(BOOK_NOT_FOUND);
  });

  test('Invalid metadata', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const uploadResponse = await uploadBook(userId, 'Alices_Adventures_in_Wonderland.epub', { jwt: registerResponse.body.jwt_token });
    expect(uploadResponse.status).toBe(200);

    // Wait for metadata to be extracted
    await wait(0.5);

    const createApiKeyResponse = await createApiKey(userId, 'Test Key', ['Update'], undefined, { jwt: registerResponse.body.jwt_token });
    expect(createApiKeyResponse.status).toBe(200);

    const patchResponse = await patchMetadata(uploadResponse.text, {}, { apiKey: createApiKeyResponse.body.key });
    expect(patchResponse.status).toBe(400);
    expect(patchResponse.text).toBe(INVALID_METADATA);
  });

  test('Different user without permission', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const uploadResponse = await uploadBook(userId, 'Alices_Adventures_in_Wonderland.epub', { jwt: registerResponse.body.jwt_token });
    expect(uploadResponse.status).toBe(200);

    // Wait for metadata to be extracted
    await wait(0.5);

    const { response: registerResponse2 } = await registerUser();
    expect(registerResponse2.status).toBe(200);
    const userId2 = registerResponse2.body.user_id;

    const createApiKeyResponse = await createApiKey(userId2, 'Test Key', ['Update'], undefined, { jwt: registerResponse2.body.jwt_token });
    expect(createApiKeyResponse.status).toBe(200);

    const patchResponse = await patchMetadata(uploadResponse.text, { title: 'title test' }, { apiKey: createApiKeyResponse.body.key });
    expect(patchResponse.status).toBe(404);
    expect(patchResponse.text).toBe(BOOK_NOT_FOUND);
  });

  test('Different user with permission', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const uploadResponse = await uploadBook(userId, 'Alices_Adventures_in_Wonderland.epub', { jwt: registerResponse.body.jwt_token });
    expect(uploadResponse.status).toBe(200);

    // Wait for metadata to be extracted
    await wait(0.5);

    const { response: registerResponse2 } = await registerUser(undefined, undefined, process.env.ADMIN_KEY);
    expect(registerResponse2.status).toBe(200);
    const userId2 = registerResponse2.body.user_id;

    const createApiKeyResponse = await createApiKey(userId2, 'Test Key', ['Update'], undefined, { jwt: registerResponse2.body.jwt_token });
    expect(createApiKeyResponse.status).toBe(200);

    const patchResponse = await patchMetadata(uploadResponse.text, { title: 'title test' }, { apiKey: createApiKeyResponse.body.key });
    expect(patchResponse.status).toBe(204);
  });

  test('Wrong capabilities', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const uploadResponse = await uploadBook(userId, 'Alices_Adventures_in_Wonderland.epub', { jwt: registerResponse.body.jwt_token });
    expect(uploadResponse.status).toBe(200);

    // Wait for metadata to be extracted
    await wait(0.5);

    const createApiKeyResponse = await createApiKey(userId, 'Test Key', ['Create', 'Read', 'Delete'], undefined, { jwt: registerResponse.body.jwt_token });
    expect(createApiKeyResponse.status).toBe(200);

    const patchResponse = await patchMetadata(uploadResponse.text, { title: 'title test' }, { apiKey: createApiKeyResponse.body.key });
    expect(patchResponse.status).toBe(403);
    expect(patchResponse.text).toBe(FORBIDDEN);
  });

  test('Expired key', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const uploadResponse = await uploadBook(userId, 'Alices_Adventures_in_Wonderland.epub', { jwt: registerResponse.body.jwt_token });
    expect(uploadResponse.status).toBe(200);

    // Wait for metadata to be extracted
    await wait(0.5);

    const timestamp = Date.now() + 1000;
    const createApiKeyResponse = await createApiKey(userId, 'Test Key', ['Update'], timestamp, { jwt: registerResponse.body.jwt_token });
    expect(createApiKeyResponse.status).toBe(200);

    // Wait for the key to expire
    await wait(1.5);

    const patchResponse = await patchMetadata(uploadResponse.text, { title: 'title test' }, { apiKey: createApiKeyResponse.body.key });
    expect(patchResponse.status).toBe(401);
    expect(patchResponse.text).toBe(INVALID_API_KEY);
  });
});

describe('Add metadata request JWT', () => {
  test('Simple', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const patchPreferencesResponse = await patchPreferences(userId, undefined, false, { jwt: registerResponse.body.jwt_token });
    expect(patchPreferencesResponse.status).toBe(204);

    const uploadResponse = await uploadBook(userId, 'Alices_Adventures_in_Wonderland.epub', { jwt: registerResponse.body.jwt_token });
    expect(uploadResponse.status).toBe(200);

    let getResponse = await getMetadata(uploadResponse.text, { jwt: registerResponse.body.jwt_token });
    expect(getResponse.status).toBe(404);

    const addResponse = await addMetadataRequest(uploadResponse.text, undefined, { jwt: registerResponse.body.jwt_token });
    expect(addResponse.status).toBe(204);

    // Wait for metadata to be extracted
    await wait(0.5);

    getResponse = await getMetadata(uploadResponse.text, { jwt: registerResponse.body.jwt_token });
    expect(getResponse.status).toBe(200);
  });

  test('Invalid providers', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const patchPreferencesResponse = await patchPreferences(userId, undefined, false, { jwt: registerResponse.body.jwt_token });
    expect(patchPreferencesResponse.status).toBe(204);

    const uploadResponse = await uploadBook(userId, 'Alices_Adventures_in_Wonderland.epub', { jwt: registerResponse.body.jwt_token });
    expect(uploadResponse.status).toBe(200);

    const getResponse = await getMetadata(uploadResponse.text, { jwt: registerResponse.body.jwt_token });
    expect(getResponse.status).toBe(404);

    const addResponse = await addMetadataRequest(uploadResponse.text, ['invalid'], { jwt: registerResponse.body.jwt_token });
    expect(addResponse.status).toBe(400);
    expect(addResponse.text).toBe(INVALID_PROVIDERS);
  });

  test('Non-existent book', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);

    const addResponse = await addMetadataRequest('non-existent', undefined, { jwt: registerResponse.body.jwt_token });
    expect(addResponse.status).toBe(404);
    expect(addResponse.text).toBe(BOOK_NOT_FOUND);
  });

  test('Request conflict', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const patchPreferencesResponse = await patchPreferences(userId, undefined, false, { jwt: registerResponse.body.jwt_token });
    expect(patchPreferencesResponse.status).toBe(204);

    const uploadResponse = await uploadBook(userId, 'Alices_Adventures_in_Wonderland.epub', { jwt: registerResponse.body.jwt_token });
    expect(uploadResponse.status).toBe(200);

    // Send 3 identical requests in parallel
    const [res1, res2, res3] = await Promise.all([
      addMetadataRequest(uploadResponse.text, undefined, { jwt: registerResponse.body.jwt_token }),
      addMetadataRequest(uploadResponse.text, undefined, { jwt: registerResponse.body.jwt_token }),
      addMetadataRequest(uploadResponse.text, undefined, { jwt: registerResponse.body.jwt_token })
    ]);

    const statuses = [res1.status, res2.status, res3.status];

    // At least one should be 204, at least one should be 409
    const successCount = statuses.filter((s) => s === 204).length;
    const conflictCount = statuses.filter((s) => s === 409).length;

    expect(successCount).toBeGreaterThanOrEqual(1);
    expect(conflictCount).toBeGreaterThanOrEqual(1);

    // Wait for metadata to be extracted
    await wait(1.5);

    const getResponse = await getMetadata(uploadResponse.text, { jwt: registerResponse.body.jwt_token });
    expect(getResponse.status).toBe(200);
  });

  test('Different user without permission', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const patchPreferencesResponse = await patchPreferences(userId, undefined, false, { jwt: registerResponse.body.jwt_token });
    expect(patchPreferencesResponse.status).toBe(204);

    const uploadResponse = await uploadBook(userId, 'Alices_Adventures_in_Wonderland.epub', { jwt: registerResponse.body.jwt_token });
    expect(uploadResponse.status).toBe(200);

    const { response: registerResponse2 } = await registerUser();
    expect(registerResponse2.status).toBe(200);

    const addResponse = await addMetadataRequest(uploadResponse.text, undefined, { jwt: registerResponse2.body.jwt_token });
    expect(addResponse.status).toBe(404);
    expect(addResponse.text).toBe(BOOK_NOT_FOUND);

    // Wait for metadata to be extracted
    await wait(0.5);

    const getResponse = await getMetadata(uploadResponse.text, { jwt: registerResponse.body.jwt_token });
    expect(getResponse.status).toBe(404);
    expect(getResponse.text).toBe(METADATA_NOT_FOUND);
  });

  test('Different user with permission', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const patchPreferencesResponse = await patchPreferences(userId, undefined, false, { jwt: registerResponse.body.jwt_token });
    expect(patchPreferencesResponse.status).toBe(204);

    const uploadResponse = await uploadBook(userId, 'Alices_Adventures_in_Wonderland.epub', { jwt: registerResponse.body.jwt_token });
    expect(uploadResponse.status).toBe(200);

    const { response: registerResponse2 } = await registerUser(undefined, undefined, process.env.ADMIN_KEY);
    expect(registerResponse2.status).toBe(200);

    const addResponse = await addMetadataRequest(uploadResponse.text, undefined, { jwt: registerResponse2.body.jwt_token });
    expect(addResponse.status).toBe(204);

    // Wait for metadata to be extracted
    await wait(0.5);

    const getResponse = await getMetadata(uploadResponse.text, { jwt: registerResponse.body.jwt_token });
    expect(getResponse.status).toBe(200);
  });

  test('No auth', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const patchPreferencesResponse = await patchPreferences(userId, undefined, false, { jwt: registerResponse.body.jwt_token });
    expect(patchPreferencesResponse.status).toBe(204);

    const uploadResponse = await uploadBook(userId, 'Alices_Adventures_in_Wonderland.epub', { jwt: registerResponse.body.jwt_token });
    expect(uploadResponse.status).toBe(200);

    const addResponse = await addMetadataRequest(uploadResponse.text);
    expect(addResponse.status).toBe(401);
    expect(addResponse.text).toBe(UNAUTHORIZED);
  });
});

describe('Add metadata request api key', () => {
  test('Simple', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const patchPreferencesResponse = await patchPreferences(userId, undefined, false, { jwt: registerResponse.body.jwt_token });
    expect(patchPreferencesResponse.status).toBe(204);

    const uploadResponse = await uploadBook(userId, 'Alices_Adventures_in_Wonderland.epub', { jwt: registerResponse.body.jwt_token });
    expect(uploadResponse.status).toBe(200);

    let getResponse = await getMetadata(uploadResponse.text, { jwt: registerResponse.body.jwt_token });
    expect(getResponse.status).toBe(404);

    const createApiKeyResponse = await createApiKey(userId, 'Test Key', ['Update'], undefined, { jwt: registerResponse.body.jwt_token });
    expect(createApiKeyResponse.status).toBe(200);

    const addResponse = await addMetadataRequest(uploadResponse.text, undefined, { apiKey: createApiKeyResponse.body.key });
    expect(addResponse.status).toBe(204);

    // Wait for metadata to be extracted
    await wait(0.5);

    getResponse = await getMetadata(uploadResponse.text, { jwt: registerResponse.body.jwt_token });
    expect(getResponse.status).toBe(200);
  });

  test('Invalid providers', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const patchPreferencesResponse = await patchPreferences(userId, undefined, false, { jwt: registerResponse.body.jwt_token });
    expect(patchPreferencesResponse.status).toBe(204);

    const uploadResponse = await uploadBook(userId, 'Alices_Adventures_in_Wonderland.epub', { jwt: registerResponse.body.jwt_token });
    expect(uploadResponse.status).toBe(200);

    const getResponse = await getMetadata(uploadResponse.text, { jwt: registerResponse.body.jwt_token });
    expect(getResponse.status).toBe(404);

    const createApiKeyResponse = await createApiKey(userId, 'Test Key', ['Update'], undefined, { jwt: registerResponse.body.jwt_token });
    expect(createApiKeyResponse.status).toBe(200);

    const addResponse = await addMetadataRequest(uploadResponse.text, ['invalid'], { apiKey: createApiKeyResponse.body.key });
    expect(addResponse.status).toBe(400);
    expect(addResponse.text).toBe(INVALID_PROVIDERS);
  });

  test('Non-existent book', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const createApiKeyResponse = await createApiKey(userId, 'Test Key', ['Update'], undefined, { jwt: registerResponse.body.jwt_token });
    expect(createApiKeyResponse.status).toBe(200);

    const addResponse = await addMetadataRequest('non-existent', undefined, { apiKey: createApiKeyResponse.body.key });
    expect(addResponse.status).toBe(404);
    expect(addResponse.text).toBe(BOOK_NOT_FOUND);
  });

  test('Request conflict', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const patchPreferencesResponse = await patchPreferences(userId, undefined, false, { jwt: registerResponse.body.jwt_token });
    expect(patchPreferencesResponse.status).toBe(204);

    const uploadResponse = await uploadBook(userId, 'Alices_Adventures_in_Wonderland.epub', { jwt: registerResponse.body.jwt_token });
    expect(uploadResponse.status).toBe(200);

    const createApiKeyResponse = await createApiKey(userId, 'Test Key', ['Update'], undefined, { jwt: registerResponse.body.jwt_token });
    expect(createApiKeyResponse.status).toBe(200);

    // Send 3 identical requests in parallel
    const [res1, res2, res3] = await Promise.all([
      addMetadataRequest(uploadResponse.text, undefined, { apiKey: createApiKeyResponse.body.key }),
      addMetadataRequest(uploadResponse.text, undefined, { apiKey: createApiKeyResponse.body.key }),
      addMetadataRequest(uploadResponse.text, undefined, { apiKey: createApiKeyResponse.body.key })
    ]);

    const statuses = [res1.status, res2.status, res3.status];

    // At least one should be 204, at least one should be 409
    const successCount = statuses.filter((s) => s === 204).length;
    const conflictCount = statuses.filter((s) => s === 409).length;

    expect(successCount).toBeGreaterThanOrEqual(1);
    expect(conflictCount).toBeGreaterThanOrEqual(1);

    // Wait for metadata to be extracted
    await wait(1.5);

    const getResponse = await getMetadata(uploadResponse.text, { jwt: registerResponse.body.jwt_token });
    expect(getResponse.status).toBe(200);
  });

  test('Different user without permission', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const patchPreferencesResponse = await patchPreferences(userId, undefined, false, { jwt: registerResponse.body.jwt_token });
    expect(patchPreferencesResponse.status).toBe(204);

    const uploadResponse = await uploadBook(userId, 'Alices_Adventures_in_Wonderland.epub', { jwt: registerResponse.body.jwt_token });
    expect(uploadResponse.status).toBe(200);

    const { response: registerResponse2 } = await registerUser();
    expect(registerResponse2.status).toBe(200);
    const userId2 = registerResponse2.body.user_id;

    const createApiKeyResponse = await createApiKey(userId2, 'Test Key', ['Update'], undefined, { jwt: registerResponse2.body.jwt_token });
    expect(createApiKeyResponse.status).toBe(200);

    const addResponse = await addMetadataRequest(uploadResponse.text, undefined, { apiKey: createApiKeyResponse.body.key });
    expect(addResponse.status).toBe(404);
    expect(addResponse.text).toBe(BOOK_NOT_FOUND);

    // Wait for metadata to be extracted
    await wait(0.5);

    const getResponse = await getMetadata(uploadResponse.text, { jwt: registerResponse.body.jwt_token });
    expect(getResponse.status).toBe(404);
    expect(getResponse.text).toBe(METADATA_NOT_FOUND);
  });

  test('Different user with permission', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const patchPreferencesResponse = await patchPreferences(userId, undefined, false, { jwt: registerResponse.body.jwt_token });
    expect(patchPreferencesResponse.status).toBe(204);

    const uploadResponse = await uploadBook(userId, 'Alices_Adventures_in_Wonderland.epub', { jwt: registerResponse.body.jwt_token });
    expect(uploadResponse.status).toBe(200);

    const { response: registerResponse2 } = await registerUser(undefined, undefined, process.env.ADMIN_KEY);
    expect(registerResponse2.status).toBe(200);
    const userId2 = registerResponse2.body.user_id;

    const createApiKeyResponse = await createApiKey(userId2, 'Test Key', ['Update'], undefined, { jwt: registerResponse2.body.jwt_token });
    expect(createApiKeyResponse.status).toBe(200);

    const addResponse = await addMetadataRequest(uploadResponse.text, undefined, { apiKey: createApiKeyResponse.body.key });
    expect(addResponse.status).toBe(204);

    // Wait for metadata to be extracted
    await wait(0.5);

    const getResponse = await getMetadata(uploadResponse.text, { jwt: registerResponse.body.jwt_token });
    expect(getResponse.status).toBe(200);
  });

  test('Wrong capabilities', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const patchPreferencesResponse = await patchPreferences(userId, undefined, false, { jwt: registerResponse.body.jwt_token });
    expect(patchPreferencesResponse.status).toBe(204);

    const uploadResponse = await uploadBook(userId, 'Alices_Adventures_in_Wonderland.epub', { jwt: registerResponse.body.jwt_token });
    expect(uploadResponse.status).toBe(200);

    const createApiKeyResponse = await createApiKey(userId, 'Test Key', ['Create'], undefined, { jwt: registerResponse.body.jwt_token });
    expect(createApiKeyResponse.status).toBe(200);

    const addResponse = await addMetadataRequest(uploadResponse.text, undefined, { apiKey: createApiKeyResponse.body.key });
    expect(addResponse.status).toBe(403);
    expect(addResponse.text).toBe(FORBIDDEN);
  });

  test('Expired api key', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const patchPreferencesResponse = await patchPreferences(userId, undefined, false, { jwt: registerResponse.body.jwt_token });
    expect(patchPreferencesResponse.status).toBe(204);

    const uploadResponse = await uploadBook(userId, 'Alices_Adventures_in_Wonderland.epub', { jwt: registerResponse.body.jwt_token });
    expect(uploadResponse.status).toBe(200);

    const timestamp = Date.now() + 1000;
    const createApiKeyResponse = await createApiKey(userId, 'Test Key', ['Update'], timestamp, { jwt: registerResponse.body.jwt_token });
    expect(createApiKeyResponse.status).toBe(200);

    // Wait for the key to expire
    await wait(1.5);

    const addResponse = await addMetadataRequest(uploadResponse.text, undefined, { apiKey: createApiKeyResponse.body.key });
    expect(addResponse.status).toBe(401);
    expect(addResponse.text).toBe(INVALID_API_KEY);
  });
});

describe('List metadata requests JWT', () => {
  test('Simple', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const patchPreferencesResponse = await patchPreferences(userId, undefined, false, { jwt: registerResponse.body.jwt_token });
    expect(patchPreferencesResponse.status).toBe(204);

    const uploadResponse = await uploadBook(userId, 'Alices_Adventures_in_Wonderland.epub', { jwt: registerResponse.body.jwt_token });
    expect(uploadResponse.status).toBe(200);

    const getResponse = await listMetadataRequests(userId, { jwt: registerResponse.body.jwt_token });
    expect(getResponse.status).toBe(200);
    expect(getResponse.body).toEqual([]);
  });

  test('Different user without permission', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const { response: registerResponse2 } = await registerUser();
    expect(registerResponse2.status).toBe(200);

    let getResponse = await listMetadataRequests(userId, { jwt: registerResponse2.body.jwt_token });
    expect(getResponse.status).toBe(403);
    expect(getResponse.text).toEqual(FORBIDDEN);

    getResponse = await listMetadataRequests(undefined, { jwt: registerResponse2.body.jwt_token });
    expect(getResponse.status).toBe(403);
    expect(getResponse.text).toEqual(FORBIDDEN);
  });

  test('Different user with permission', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const { response: registerResponse2 } = await registerUser(undefined, undefined, process.env.ADMIN_KEY);
    expect(registerResponse2.status).toBe(200);

    let getResponse = await listMetadataRequests(userId, { jwt: registerResponse2.body.jwt_token });
    expect(getResponse.status).toBe(200);
    expect(getResponse.body).toEqual([]);

    getResponse = await listMetadataRequests(undefined, { jwt: registerResponse2.body.jwt_token });
    expect(getResponse.status).toBe(200);
    expect(getResponse.body).toEqual([]);
  });

  test('No auth', async () => {
    const getResponse = await listMetadataRequests(undefined);
    expect(getResponse.status).toBe(401);
    expect(getResponse.text).toEqual(UNAUTHORIZED);
  });
});

describe('List metadata requests api key', () => {
  test('Simple', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const patchPreferencesResponse = await patchPreferences(userId, undefined, false, { jwt: registerResponse.body.jwt_token });
    expect(patchPreferencesResponse.status).toBe(204);

    const uploadResponse = await uploadBook(userId, 'Alices_Adventures_in_Wonderland.epub', { jwt: registerResponse.body.jwt_token });
    expect(uploadResponse.status).toBe(200);

    const createApiKeyResponse = await createApiKey(userId, 'Test Key', ['Read'], undefined, { jwt: registerResponse.body.jwt_token });
    expect(createApiKeyResponse.status).toBe(200);

    const getResponse = await listMetadataRequests(userId, { apiKey: createApiKeyResponse.body.key });
    expect(getResponse.status).toBe(200);
    expect(getResponse.body).toEqual([]);
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

    let getResponse = await listMetadataRequests(userId, { apiKey: createApiKeyResponse.body.key });
    expect(getResponse.status).toBe(403);
    expect(getResponse.text).toEqual(FORBIDDEN);

    getResponse = await listMetadataRequests(undefined, { apiKey: createApiKeyResponse.body.key });
    expect(getResponse.status).toBe(403);
    expect(getResponse.text).toEqual(FORBIDDEN);
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

    let getResponse = await listMetadataRequests(userId, { apiKey: createApiKeyResponse.body.key });
    expect(getResponse.status).toBe(200);
    expect(getResponse.body).toEqual([]);

    getResponse = await listMetadataRequests(undefined, { apiKey: createApiKeyResponse.body.key });
    expect(getResponse.status).toBe(200);
    expect(getResponse.body).toEqual([]);
  });

  test('Wrong capabilities', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const patchPreferencesResponse = await patchPreferences(userId, undefined, false, { jwt: registerResponse.body.jwt_token });
    expect(patchPreferencesResponse.status).toBe(204);

    const uploadResponse = await uploadBook(userId, 'Alices_Adventures_in_Wonderland.epub', { jwt: registerResponse.body.jwt_token });
    expect(uploadResponse.status).toBe(200);

    const createApiKeyResponse = await createApiKey(userId, 'Test Key', ['Delete'], undefined, { jwt: registerResponse.body.jwt_token });
    expect(createApiKeyResponse.status).toBe(200);

    const getResponse = await listMetadataRequests(userId, { apiKey: createApiKeyResponse.body.key });
    expect(getResponse.status).toBe(403);
    expect(getResponse.text).toEqual(FORBIDDEN);
  });

  test('Expired api key', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const patchPreferencesResponse = await patchPreferences(userId, undefined, false, { jwt: registerResponse.body.jwt_token });
    expect(patchPreferencesResponse.status).toBe(204);

    const uploadResponse = await uploadBook(userId, 'Alices_Adventures_in_Wonderland.epub', { jwt: registerResponse.body.jwt_token });
    expect(uploadResponse.status).toBe(200);

    const timestamp = Date.now() + 1000;
    const createApiKeyResponse = await createApiKey(userId, 'Test Key', ['Read'], timestamp, { jwt: registerResponse.body.jwt_token });
    expect(createApiKeyResponse.status).toBe(200);

    // Wait for the key to expire
    await wait(1.5);

    const getResponse = await listMetadataRequests(userId, { apiKey: createApiKeyResponse.body.key });
    expect(getResponse.status).toBe(401);
    expect(getResponse.text).toEqual(INVALID_API_KEY);
  });
});
