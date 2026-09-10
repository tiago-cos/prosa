import { BOOK_NOT_FOUND, uploadBook } from '../utils/books.js';
import { FORBIDDEN, wait } from '../utils/common.js';
import { addMetadata, addMetadataRequest, ALICE_METADATA, deleteMetadata, EXAMPLE_METADATA, getMetadata, INVALID_METADATA, listMetadataRequests, METADATA_CONFLICT, METADATA_NOT_FOUND, patchMetadata, updateMetadata } from '../utils/metadata.js';
import { INVALID_PROVIDERS, patchPreferences, registerUser } from '../utils/users.js';
import { describeAuthContract } from '../utils/auth-contract.js';

describe('Get metadata', () => {
  test('Simple', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const uploadResponse = await uploadBook(userId, 'Alices_Adventures_in_Wonderland.epub', { jwt: registerResponse.body.jwt_token });
    expect(uploadResponse.status).toBe(200);

    // Wait for metadata to be extracted
    await wait(1);

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
    await wait(1);

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
    await wait(1);

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
    await wait(1);

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
    await wait(1);

    const { response: registerResponse2 } = await registerUser(undefined, undefined, true, process.env.ADMIN_KEY);
    expect(registerResponse2.status).toBe(200);

    const downloadResponse = await getMetadata(uploadResponse.text, { jwt: registerResponse2.body.jwt_token });
    expect(downloadResponse.status).toBe(200);
  });
});

describe('Extracted metadata', () => {
  test('Unparsable fields are skipped, not fatal', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const uploadResponse = await uploadBook(userId, 'Malformed_Metadata.epub', { jwt: registerResponse.body.jwt_token });
    expect(uploadResponse.status).toBe(200);

    // Wait for metadata to be extracted
    await wait(1);

    const getResponse = await getMetadata(uploadResponse.text, { jwt: registerResponse.body.jwt_token });
    expect(getResponse.status).toBe(200);

    expect(getResponse.body.title).toBe('Hostile Book');
    expect(getResponse.body.subtitle).toBe('A Subtitle Via Refines');

    expect(getResponse.body.isbn).toBe('9780441013593');

    expect(getResponse.body.contributors).toEqual([
      { name: 'Ada Writer', role: 'Author' },
      { name: 'Bob Editor', role: 'Editor' },
      { name: 'Cy Translator', role: 'Translator' }
    ]);

    expect(getResponse.body.publication_date).toBeUndefined();
    expect(getResponse.body.series).toBeUndefined();
  });

  test('A book with unparsable fields does not stop later extractions', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const malformedResponse = await uploadBook(userId, 'Malformed_Metadata.epub', { jwt: registerResponse.body.jwt_token });
    expect(malformedResponse.status).toBe(200);

    const uploadResponse = await uploadBook(userId, 'Alices_Adventures_in_Wonderland.epub', { jwt: registerResponse.body.jwt_token });
    expect(uploadResponse.status).toBe(200);

    // Wait for metadata to be extracted
    await wait(1);

    const getResponse = await getMetadata(uploadResponse.text, { jwt: registerResponse.body.jwt_token });
    expect(getResponse.status).toBe(200);
    expect(getResponse.body).toEqual(ALICE_METADATA);
  });

  test('An identifier that is not an ISBN is not stored as one', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const uploadResponse = await uploadBook(userId, 'Alices_Adventures_in_Wonderland.epub', { jwt: registerResponse.body.jwt_token });
    expect(uploadResponse.status).toBe(200);

    // Wait for metadata to be extracted
    await wait(1);

    const getResponse = await getMetadata(uploadResponse.text, { jwt: registerResponse.body.jwt_token });
    expect(getResponse.status).toBe(200);
    expect(getResponse.body.isbn).toBeUndefined();
  });
});

describe('Add metadata', () => {
  test('Simple', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const uploadResponse = await uploadBook(userId, 'The_Great_Gatsby.epub', { jwt: registerResponse.body.jwt_token });
    expect(uploadResponse.status).toBe(200);

    // Give chance for any metadata to be extracted
    await wait(1);

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
    await wait(1);

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
    await wait(1);

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
    await wait(1);

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
    await wait(1);

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
    await wait(1);

    const { response: registerResponse2 } = await registerUser(undefined, undefined, true, process.env.ADMIN_KEY);
    expect(registerResponse2.status).toBe(200);

    const addResponse = await addMetadata(uploadResponse.text, EXAMPLE_METADATA, { jwt: registerResponse2.body.jwt_token });
    expect(addResponse.status).toBe(204);
  });
});

describe('Delete metadata', () => {
  test('Simple', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const uploadResponse = await uploadBook(userId, 'Alices_Adventures_in_Wonderland.epub', { jwt: registerResponse.body.jwt_token });
    expect(uploadResponse.status).toBe(200);

    // Wait for metadata to be extracted
    await wait(1);

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
    await wait(1);

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
    await wait(1);

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
    await wait(1);

    const { response: registerResponse2 } = await registerUser(undefined, undefined, true, process.env.ADMIN_KEY);
    expect(registerResponse2.status).toBe(200);

    const deleteResponse = await deleteMetadata(uploadResponse.text, { jwt: registerResponse2.body.jwt_token });
    expect(deleteResponse.status).toBe(204);
  });
});

describe('Update metadata', () => {
  test('Simple', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const uploadResponse = await uploadBook(userId, 'Alices_Adventures_in_Wonderland.epub', { jwt: registerResponse.body.jwt_token });
    expect(uploadResponse.status).toBe(200);

    // Wait for metadata to be extracted
    await wait(1);

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
    await wait(1);

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
    await wait(1);

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
    await wait(1);

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
    await wait(1);

    const { response: registerResponse2 } = await registerUser(undefined, undefined, true, process.env.ADMIN_KEY);
    expect(registerResponse2.status).toBe(200);

    const updateResponse = await updateMetadata(uploadResponse.text, EXAMPLE_METADATA, { jwt: registerResponse2.body.jwt_token });
    expect(updateResponse.status).toBe(204);
  });
});

describe('Patch metadata', () => {
  test('Simple', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const uploadResponse = await uploadBook(userId, 'Alices_Adventures_in_Wonderland.epub', { jwt: registerResponse.body.jwt_token });
    expect(uploadResponse.status).toBe(200);

    // Wait for metadata to be extracted
    await wait(1);

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
    await wait(1);

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
    await wait(1);

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
    await wait(1);

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
    await wait(1);

    const { response: registerResponse2 } = await registerUser(undefined, undefined, true, process.env.ADMIN_KEY);
    expect(registerResponse2.status).toBe(200);

    const patchResponse = await patchMetadata(uploadResponse.text, { title: 'title test' }, { jwt: registerResponse2.body.jwt_token });
    expect(patchResponse.status).toBe(204);
  });
});

describe('Add metadata request', () => {
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
    await wait(1);

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
    await wait(1);

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

    const { response: registerResponse2 } = await registerUser(undefined, undefined, true, process.env.ADMIN_KEY);
    expect(registerResponse2.status).toBe(200);

    const addResponse = await addMetadataRequest(uploadResponse.text, undefined, { jwt: registerResponse2.body.jwt_token });
    expect(addResponse.status).toBe(204);

    // Wait for metadata to be extracted
    await wait(1);

    const getResponse = await getMetadata(uploadResponse.text, { jwt: registerResponse.body.jwt_token });
    expect(getResponse.status).toBe(200);
  });
});

describe('List metadata requests', () => {
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

    const { response: registerResponse2 } = await registerUser(undefined, undefined, true, process.env.ADMIN_KEY);
    expect(registerResponse2.status).toBe(200);

    let getResponse = await listMetadataRequests(userId, { jwt: registerResponse2.body.jwt_token });
    expect(getResponse.status).toBe(200);
    expect(getResponse.body).toEqual([]);

    getResponse = await listMetadataRequests(undefined, { jwt: registerResponse2.body.jwt_token });
    expect(getResponse.status).toBe(200);
    expect(getResponse.body).toEqual([]);
  });
});

async function bookWithMetadataFixture() {
  const { response: registerResponse } = await registerUser();
  expect(registerResponse.status).toBe(200);
  const userId = registerResponse.body.user_id;
  const jwt = registerResponse.body.jwt_token;

  const uploadResponse = await uploadBook(userId, 'Alices_Adventures_in_Wonderland.epub', { jwt });
  expect(uploadResponse.status).toBe(200);

  // Wait for metadata to be extracted
  await wait(1);

  return { userId, jwt, context: { bookId: uploadResponse.text } };
}

async function bookWithoutMetadataFixture() {
  const { response: registerResponse } = await registerUser();
  expect(registerResponse.status).toBe(200);
  const userId = registerResponse.body.user_id;
  const jwt = registerResponse.body.jwt_token;

  const uploadResponse = await uploadBook(userId, 'The_Great_Gatsby.epub', { jwt });
  expect(uploadResponse.status).toBe(200);

  // Give chance for any metadata to be extracted
  await wait(1);

  return { userId, jwt, context: { bookId: uploadResponse.text } };
}

async function metadataRequestFixture() {
  const { response: registerResponse } = await registerUser();
  expect(registerResponse.status).toBe(200);
  const userId = registerResponse.body.user_id;
  const jwt = registerResponse.body.jwt_token;

  const patchPreferencesResponse = await patchPreferences(userId, undefined, false, { jwt });
  expect(patchPreferencesResponse.status).toBe(204);

  const uploadResponse = await uploadBook(userId, 'Alices_Adventures_in_Wonderland.epub', { jwt });
  expect(uploadResponse.status).toBe(200);

  return { userId, jwt, context: { userId, bookId: uploadResponse.text } };
}

describeAuthContract('Get metadata auth', {
  capability: 'Read',
  success: 200,
  setup: bookWithMetadataFixture,
  call: ({ bookId }, auth) => getMetadata(bookId, auth)
});

describeAuthContract('Add metadata auth', {
  capability: 'Update',
  success: 204,
  setup: bookWithoutMetadataFixture,
  call: ({ bookId }, auth) => addMetadata(bookId, EXAMPLE_METADATA, auth)
});

describeAuthContract('Delete metadata auth', {
  capability: 'Delete',
  success: 204,
  setup: bookWithMetadataFixture,
  call: ({ bookId }, auth) => deleteMetadata(bookId, auth)
});

describeAuthContract('Update metadata auth', {
  capability: 'Update',
  success: 204,
  setup: bookWithMetadataFixture,
  call: ({ bookId }, auth) => updateMetadata(bookId, EXAMPLE_METADATA, auth)
});

describeAuthContract('Patch metadata auth', {
  capability: 'Update',
  success: 204,
  setup: bookWithMetadataFixture,
  call: ({ bookId }, auth) => patchMetadata(bookId, { title: 'title test' }, auth)
});

describeAuthContract('Add metadata request auth', {
  capability: 'Update',
  success: 204,
  setup: metadataRequestFixture,
  call: ({ bookId }, auth) => addMetadataRequest(bookId, undefined, auth)
});

describeAuthContract('List metadata requests auth', {
  capability: 'Read',
  success: 200,
  setup: metadataRequestFixture,
  call: ({ userId }, auth) => listMetadataRequests(userId, auth)
});
