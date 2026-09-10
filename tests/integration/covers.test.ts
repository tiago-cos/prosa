import fs from 'fs';
import path from 'path';
import { BOOK_NOT_FOUND, uploadBook } from '../utils/books.js';
import { COVERS_DIR, wait } from '../utils/common.js';
import { addCover, COVER_CONFLICT, COVER_NOT_FOUND, deleteCover, getCover, INVALID_COVER, updateCover } from '../utils/covers.js';
import { registerUser } from '../utils/users.js';
import { describeAuthContract } from '../utils/auth-contract.js';

describe('Get cover', () => {
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

    const { response: registerResponse2 } = await registerUser(undefined, undefined, true, process.env.ADMIN_KEY);
    expect(registerResponse2.status).toBe(200);

    const downloadResponse = await getCover(uploadResponse.text, { jwt: registerResponse2.body.jwt_token });
    expect(downloadResponse.status).toBe(200);
  });
});

describe('Add cover', () => {
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

    const { response: registerResponse2 } = await registerUser(undefined, undefined, true, process.env.ADMIN_KEY);
    expect(registerResponse2.status).toBe(200);

    const addResponse = await addCover(uploadResponse.text, 'Generic.jpeg', { jwt: registerResponse2.body.jwt_token });
    expect(addResponse.status).toBe(204);
  });
});

describe('Delete cover', () => {
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

    const { response: registerResponse2 } = await registerUser(undefined, undefined, true, process.env.ADMIN_KEY);
    expect(registerResponse2.status).toBe(200);

    const deleteResponse = await deleteCover(uploadResponse.text, { jwt: registerResponse2.body.jwt_token });
    expect(deleteResponse.status).toBe(204);
  });
});

describe('Update cover', () => {
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

    const { response: registerResponse2 } = await registerUser(undefined, undefined, true, process.env.ADMIN_KEY);
    expect(registerResponse2.status).toBe(200);

    const updateResponse = await updateCover(uploadResponse.text, 'Generic.jpeg', { jwt: registerResponse2.body.jwt_token });
    expect(updateResponse.status).toBe(204);
  });
});

async function coveredBookFixture() {
  const { response: registerResponse } = await registerUser();
  expect(registerResponse.status).toBe(200);
  const userId = registerResponse.body.user_id;
  const jwt = registerResponse.body.jwt_token;

  const uploadResponse = await uploadBook(userId, 'Alices_Adventures_in_Wonderland.epub', { jwt });
  expect(uploadResponse.status).toBe(200);

  // Wait for cover to be extracted
  await wait(1);

  return { userId, jwt, context: { bookId: uploadResponse.text } };
}

async function uncoveredBookFixture() {
  const { response: registerResponse } = await registerUser();
  expect(registerResponse.status).toBe(200);
  const userId = registerResponse.body.user_id;
  const jwt = registerResponse.body.jwt_token;

  const uploadResponse = await uploadBook(userId, 'The_Great_Gatsby.epub', { jwt });
  expect(uploadResponse.status).toBe(200);

  // Give chance for any cover to be extracted
  await wait(1);

  return { userId, jwt, context: { bookId: uploadResponse.text } };
}

describeAuthContract('Get cover auth', {
  capability: 'Read',
  success: 200,
  setup: coveredBookFixture,
  call: ({ bookId }, auth) => getCover(bookId, auth)
});

describeAuthContract('Add cover auth', {
  capability: 'Update',
  success: 204,
  setup: uncoveredBookFixture,
  call: ({ bookId }, auth) => addCover(bookId, 'Generic.jpeg', auth)
});

describeAuthContract('Delete cover auth', {
  capability: 'Delete',
  success: 204,
  setup: coveredBookFixture,
  call: ({ bookId }, auth) => deleteCover(bookId, auth)
});

describeAuthContract('Update cover auth', {
  capability: 'Update',
  success: 204,
  setup: coveredBookFixture,
  call: ({ bookId }, auth) => updateCover(bookId, 'Generic.jpeg', auth)
});
