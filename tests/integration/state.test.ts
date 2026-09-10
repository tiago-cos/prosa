import { BOOK_NOT_FOUND, uploadBook } from '../utils/books.js';
import { ALICE_STATE, EMPTY_STATE, getState, INVALID_LOCATION, INVALID_RATING, INVALID_READING_STATUS, INVALID_STATE, patchState, updateState } from '../utils/state.js';
import { registerUser } from '../utils/users.js';
import { describeAuthContract } from '../utils/auth-contract.js';

describe('Get state', () => {
  test('Simple', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const uploadResponse = await uploadBook(userId, 'Alices_Adventures_in_Wonderland.epub', { jwt: registerResponse.body.jwt_token });
    expect(uploadResponse.status).toBe(200);

    const downloadResponse = await getState(uploadResponse.text, { jwt: registerResponse.body.jwt_token });
    expect(downloadResponse.status).toBe(200);

    expect(downloadResponse.body).toEqual(EMPTY_STATE);
  });

  test('Non-existent book', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);

    const downloadResponse = await getState('non-existent', { jwt: registerResponse.body.jwt_token });
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

    const downloadResponse = await getState(uploadResponse.text, { jwt: registerResponse2.body.jwt_token });
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

    const downloadResponse = await getState(uploadResponse.text, { jwt: registerResponse2.body.jwt_token });
    expect(downloadResponse.status).toBe(200);
  });
});

describe('Update state', () => {
  test('Simple', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const uploadResponse = await uploadBook(userId, 'Alices_Adventures_in_Wonderland.epub', { jwt: registerResponse.body.jwt_token });
    expect(uploadResponse.status).toBe(200);

    const downloadResponse = await getState(uploadResponse.text, { jwt: registerResponse.body.jwt_token });
    expect(downloadResponse.status).toBe(200);

    expect(downloadResponse.body).toEqual(EMPTY_STATE);

    const updateResponse = await updateState(uploadResponse.text, ALICE_STATE, { jwt: registerResponse.body.jwt_token });
    expect(updateResponse.status).toBe(204);

    const downloadResponse2 = await getState(uploadResponse.text, { jwt: registerResponse.body.jwt_token });
    expect(downloadResponse2.status).toBe(200);

    expect(downloadResponse2.body).toEqual(ALICE_STATE);

    const updateResponse2 = await updateState(uploadResponse.text, { statistics: { rating: 2.1, reading_status: 'Read' } }, { jwt: registerResponse.body.jwt_token });
    expect(updateResponse2.status).toBe(204);

    const downloadResponse3 = await getState(uploadResponse.text, { jwt: registerResponse.body.jwt_token });
    expect(downloadResponse3.status).toBe(200);

    expect(downloadResponse3.body).toEqual({ statistics: { rating: 2.1, reading_status: 'Read' } });

    const updateResponse3 = await updateState(uploadResponse.text, EMPTY_STATE, { jwt: registerResponse.body.jwt_token });
    expect(updateResponse3.status).toBe(204);

    const downloadResponse4 = await getState(uploadResponse.text, { jwt: registerResponse.body.jwt_token });
    expect(downloadResponse4.status).toBe(200);

    expect(downloadResponse4.body).toEqual(EMPTY_STATE);
  });

  test('Non-existent book', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);

    const updateResponse = await updateState('non-existent', ALICE_STATE, { jwt: registerResponse.body.jwt_token });
    expect(updateResponse.status).toBe(404);
    expect(updateResponse.text).toBe(BOOK_NOT_FOUND);
  });

  test('Invalid state', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const uploadResponse = await uploadBook(userId, 'Alices_Adventures_in_Wonderland.epub', { jwt: registerResponse.body.jwt_token });
    expect(uploadResponse.status).toBe(200);

    let invalid = structuredClone(ALICE_STATE);
    invalid.statistics.rating = 9;

    const updateResponse = await updateState(uploadResponse.text, invalid, { jwt: registerResponse.body.jwt_token });
    expect(updateResponse.status).toBe(400);
    expect(updateResponse.text).toBe(INVALID_RATING);

    invalid.statistics.rating = 4.5;
    invalid.location = 'not-a-location';

    const updateResponse2 = await updateState(uploadResponse.text, invalid, { jwt: registerResponse.body.jwt_token });
    expect(updateResponse2.status).toBe(400);
    expect(updateResponse2.text).toBe(INVALID_LOCATION);

    invalid.location = 'invalid#0/1/t0:12';

    const updateResponse3 = await updateState(uploadResponse.text, invalid, { jwt: registerResponse.body.jwt_token });
    expect(updateResponse3.status).toBe(400);
    expect(updateResponse3.text).toBe(INVALID_LOCATION);

    const updateResponse4 = await updateState(uploadResponse.text, { statistics: { reading_status: 'invalid' } }, { jwt: registerResponse.body.jwt_token });
    expect(updateResponse4.status).toBe(400);
    expect(updateResponse4.text).toBe(INVALID_READING_STATUS);

    const updateResponse5 = await updateState(uploadResponse.text, { statistics: {} }, { jwt: registerResponse.body.jwt_token });
    expect(updateResponse5.status).toBe(400);
    expect(updateResponse5.text).toBe(INVALID_READING_STATUS);

    const updateResponse6 = await updateState(uploadResponse.text, { location: 'OEBPS/229714655232534212_11-h-4.htm.xhtml#99/99/t0:0', statistics: { reading_status: 'Read' } }, { jwt: registerResponse.body.jwt_token });
    expect(updateResponse6.status).toBe(400);
    expect(updateResponse6.text).toBe(INVALID_LOCATION);

    const updateResponse7 = await updateState(uploadResponse.text, {}, { jwt: registerResponse.body.jwt_token });
    expect(updateResponse7.status).toBe(400);
    expect(updateResponse7.text).toBe(INVALID_STATE);
  });

  test('Different user without permission', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const uploadResponse = await uploadBook(userId, 'Alices_Adventures_in_Wonderland.epub', { jwt: registerResponse.body.jwt_token });
    expect(uploadResponse.status).toBe(200);

    const { response: registerResponse2 } = await registerUser();
    expect(registerResponse2.status).toBe(200);

    const updateResponse = await updateState(uploadResponse.text, ALICE_STATE, { jwt: registerResponse2.body.jwt_token });
    expect(updateResponse.status).toBe(404);
    expect(updateResponse.text).toBe(BOOK_NOT_FOUND);
  });

  test('Different user with permission', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const uploadResponse = await uploadBook(userId, 'Alices_Adventures_in_Wonderland.epub', { jwt: registerResponse.body.jwt_token });
    expect(uploadResponse.status).toBe(200);

    const { response: registerResponse2 } = await registerUser(undefined, undefined, true, process.env.ADMIN_KEY);
    expect(registerResponse2.status).toBe(200);

    const updateResponse = await updateState(uploadResponse.text, ALICE_STATE, { jwt: registerResponse2.body.jwt_token });
    expect(updateResponse.status).toBe(204);
  });
});

describe('Patch state', () => {
  test('Simple', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const uploadResponse = await uploadBook(userId, 'Alices_Adventures_in_Wonderland.epub', { jwt: registerResponse.body.jwt_token });
    expect(uploadResponse.status).toBe(200);

    const downloadResponse = await getState(uploadResponse.text, { jwt: registerResponse.body.jwt_token });
    expect(downloadResponse.status).toBe(200);

    expect(downloadResponse.body).toEqual(EMPTY_STATE);

    const patchResponse = await patchState(uploadResponse.text, { statistics: { rating: 2.3 } }, { jwt: registerResponse.body.jwt_token });
    expect(patchResponse.status).toBe(204);

    const downloadResponse2 = await getState(uploadResponse.text, { jwt: registerResponse.body.jwt_token });
    expect(downloadResponse2.status).toBe(200);

    expect(downloadResponse2.body).toEqual({
      statistics: { rating: 2.3, reading_status: 'Unread' }
    });

    const updateResponse = await updateState(uploadResponse.text, ALICE_STATE, { jwt: registerResponse.body.jwt_token });
    expect(updateResponse.status).toBe(204);

    let expectedState = structuredClone(ALICE_STATE);
    expectedState.statistics.rating = 2.3;

    const patchResponse2 = await patchState(uploadResponse.text, { statistics: { rating: 2.3 } }, { jwt: registerResponse.body.jwt_token });
    expect(patchResponse2.status).toBe(204);

    const downloadResponse3 = await getState(uploadResponse.text, { jwt: registerResponse.body.jwt_token });
    expect(downloadResponse3.status).toBe(200);

    expect(downloadResponse3.body).toEqual(expectedState);

    expectedState.statistics.reading_status = 'Reading';

    const patchResponse3 = await patchState(uploadResponse.text, { statistics: { reading_status: 'Reading' } }, { jwt: registerResponse.body.jwt_token });
    expect(patchResponse3.status).toBe(204);

    const downloadResponse4 = await getState(uploadResponse.text, { jwt: registerResponse.body.jwt_token });
    expect(downloadResponse4.status).toBe(200);

    expect(downloadResponse4.body).toEqual(expectedState);
  });

  test('Non-existent book', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);

    const patchResponse = await patchState('non-existent', ALICE_STATE, { jwt: registerResponse.body.jwt_token });
    expect(patchResponse.status).toBe(404);
    expect(patchResponse.text).toBe(BOOK_NOT_FOUND);
  });

  test('Invalid state', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const uploadResponse = await uploadBook(userId, 'Alices_Adventures_in_Wonderland.epub', { jwt: registerResponse.body.jwt_token });
    expect(uploadResponse.status).toBe(200);

    let invalid = structuredClone(ALICE_STATE);
    invalid.statistics.rating = 9;

    const patchResponse = await patchState(uploadResponse.text, invalid, { jwt: registerResponse.body.jwt_token });
    expect(patchResponse.status).toBe(400);
    expect(patchResponse.text).toBe(INVALID_RATING);

    invalid.statistics.rating = 4.5;
    invalid.location = 'not-a-location';

    const patchResponse2 = await patchState(uploadResponse.text, invalid, { jwt: registerResponse.body.jwt_token });
    expect(patchResponse2.status).toBe(400);
    expect(patchResponse2.text).toBe(INVALID_LOCATION);

    invalid.location = 'invalid#0/1/t0:12';

    const patchResponse3 = await patchState(uploadResponse.text, invalid, { jwt: registerResponse.body.jwt_token });
    expect(patchResponse3.status).toBe(400);
    expect(patchResponse3.text).toBe(INVALID_LOCATION);

    invalid = structuredClone(ALICE_STATE);
    invalid.statistics.reading_status = 'invalid';

    const patchResponse4 = await patchState(uploadResponse.text, invalid, { jwt: registerResponse.body.jwt_token });
    expect(patchResponse4.status).toBe(400);
    expect(patchResponse4.text).toBe(INVALID_READING_STATUS);

    const patchResponse5 = await patchState(uploadResponse.text, {}, { jwt: registerResponse.body.jwt_token });
    expect(patchResponse5.status).toBe(400);
    expect(patchResponse5.text).toBe(INVALID_STATE);
  });

  test('Different user without permission', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const uploadResponse = await uploadBook(userId, 'Alices_Adventures_in_Wonderland.epub', { jwt: registerResponse.body.jwt_token });
    expect(uploadResponse.status).toBe(200);

    const { response: registerResponse2 } = await registerUser();
    expect(registerResponse2.status).toBe(200);

    const patchResponse = await patchState(uploadResponse.text, ALICE_STATE, { jwt: registerResponse2.body.jwt_token });
    expect(patchResponse.status).toBe(404);
    expect(patchResponse.text).toBe(BOOK_NOT_FOUND);
  });

  test('Different user with permission', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const uploadResponse = await uploadBook(userId, 'Alices_Adventures_in_Wonderland.epub', { jwt: registerResponse.body.jwt_token });
    expect(uploadResponse.status).toBe(200);

    const { response: registerResponse2 } = await registerUser(undefined, undefined, true, process.env.ADMIN_KEY);
    expect(registerResponse2.status).toBe(200);

    const patchResponse = await patchState(uploadResponse.text, ALICE_STATE, { jwt: registerResponse2.body.jwt_token });
    expect(patchResponse.status).toBe(204);
  });
});

async function bookFixture() {
  const { response: registerResponse } = await registerUser();
  expect(registerResponse.status).toBe(200);
  const userId = registerResponse.body.user_id;
  const jwt = registerResponse.body.jwt_token;

  const uploadResponse = await uploadBook(userId, 'Alices_Adventures_in_Wonderland.epub', { jwt });
  expect(uploadResponse.status).toBe(200);

  return { userId, jwt, context: { bookId: uploadResponse.text } };
}

describeAuthContract('Get state auth', {
  capability: 'Read',
  success: 200,
  setup: bookFixture,
  call: ({ bookId }, auth) => getState(bookId, auth)
});

describeAuthContract('Update state auth', {
  capability: 'Update',
  success: 204,
  setup: bookFixture,
  call: ({ bookId }, auth) => updateState(bookId, ALICE_STATE, auth)
});

describeAuthContract('Patch state auth', {
  capability: 'Update',
  success: 204,
  setup: bookFixture,
  call: ({ bookId }, auth) => patchState(bookId, { statistics: { rating: 2.3 } }, auth)
});
