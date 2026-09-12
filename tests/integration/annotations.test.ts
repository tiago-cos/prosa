import { addAnnotation, ALICE_NOTE, ANNOTATION_CONFLICT, ANNOTATION_ID_CONFLICT, ANNOTATION_NOT_FOUND, deleteAnnotation, getAnnotation, INVALID_ANNOTATION, INVALID_ANNOTATION_ID, listAnnotations, patchAnnotation } from '../utils/annotations.js';
import { BOOK_NOT_FOUND, uploadBook } from '../utils/books.js';
import { registerUser } from '../utils/users.js';
import { describeAuthContract } from '../utils/auth-contract.js';
import { randomUUID } from 'crypto';
import { raceCreations } from '../utils/common.js';

describe('Add annotation', () => {
  test('Simple', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const uploadResponse = await uploadBook(userId, 'Alices_Adventures_in_Wonderland.epub', { jwt: registerResponse.body.jwt_token });
    expect(uploadResponse.status).toBe(200);

    const addAnnotationResponse = await addAnnotation(uploadResponse.text, ALICE_NOTE, { jwt: registerResponse.body.jwt_token });
    expect(addAnnotationResponse.status).toBe(200);
  });

  test('Provided annotation id', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const uploadResponse = await uploadBook(userId, 'Alices_Adventures_in_Wonderland.epub', { jwt: registerResponse.body.jwt_token });
    expect(uploadResponse.status).toBe(200);

    const annotationId = randomUUID();
    const addAnnotationResponse = await addAnnotation(uploadResponse.text, { ...ALICE_NOTE, annotation_id: annotationId }, { jwt: registerResponse.body.jwt_token });
    expect(addAnnotationResponse.status).toBe(200);
    expect(addAnnotationResponse.text).toBe(annotationId);

    const getAnnotationResponse = await getAnnotation(uploadResponse.text, annotationId, { jwt: registerResponse.body.jwt_token });
    expect(getAnnotationResponse.status).toBe(200);
  });

  test('Invalid annotation id', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const uploadResponse = await uploadBook(userId, 'Alices_Adventures_in_Wonderland.epub', { jwt: registerResponse.body.jwt_token });
    expect(uploadResponse.status).toBe(200);

    const addAnnotationResponse = await addAnnotation(uploadResponse.text, { ...ALICE_NOTE, annotation_id: 'invalid' }, { jwt: registerResponse.body.jwt_token });
    expect(addAnnotationResponse.status).toBe(400);
    expect(addAnnotationResponse.text).toBe(INVALID_ANNOTATION_ID);
  });

  test('Repeated annotation id', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const uploadResponse = await uploadBook(userId, 'Alices_Adventures_in_Wonderland.epub', { jwt: registerResponse.body.jwt_token });
    expect(uploadResponse.status).toBe(200);

    const annotationId = randomUUID();
    let addAnnotationResponse = await addAnnotation(uploadResponse.text, { ...ALICE_NOTE, annotation_id: annotationId }, { jwt: registerResponse.body.jwt_token });
    expect(addAnnotationResponse.status).toBe(200);

    const otherNote = { ...ALICE_NOTE, end_location: 'OEBPS/229714655232534212_11-h-10.htm.xhtml#0/2/t0:41', annotation_id: annotationId };
    addAnnotationResponse = await addAnnotation(uploadResponse.text, otherNote, { jwt: registerResponse.body.jwt_token });
    expect(addAnnotationResponse.status).toBe(409);
    expect(addAnnotationResponse.text).toBe(ANNOTATION_ID_CONFLICT);
  });

  test('Simultaneous creations with the same annotation id', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const uploadResponse = await uploadBook(userId, 'Alices_Adventures_in_Wonderland.epub', { jwt: registerResponse.body.jwt_token });
    expect(uploadResponse.status).toBe(200);

    const annotationId = randomUUID();

    const { succeeded, rejected } = await raceCreations(12, (index) => {
      const annotation = {
        ...ALICE_NOTE,
        end_location: `OEBPS/229714655232534212_11-h-10.htm.xhtml#0/2/t0:${30 + index}`,
        annotation_id: annotationId
      };
      return addAnnotation(uploadResponse.text, annotation, { jwt: registerResponse.body.jwt_token });
    });

    expect(succeeded).toHaveLength(1);
    expect(succeeded[0].text).toBe(annotationId);

    for (const response of rejected) {
      expect(response.status).toBe(409);
      expect(response.text).toBe(ANNOTATION_ID_CONFLICT);
    }
  }, 30000);

  test('Non-existent book', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);

    const addAnnotationResponse = await addAnnotation('non-existent', ALICE_NOTE, { jwt: registerResponse.body.jwt_token });
    expect(addAnnotationResponse.status).toBe(404);
    expect(addAnnotationResponse.text).toBe(BOOK_NOT_FOUND);
  });

  test('Annotation conflict', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const uploadResponse = await uploadBook(userId, 'Alices_Adventures_in_Wonderland.epub', { jwt: registerResponse.body.jwt_token });
    expect(uploadResponse.status).toBe(200);

    let addAnnotationResponse = await addAnnotation(uploadResponse.text, ALICE_NOTE, { jwt: registerResponse.body.jwt_token });
    expect(addAnnotationResponse.status).toBe(200);

    addAnnotationResponse = await addAnnotation(uploadResponse.text, ALICE_NOTE, { jwt: registerResponse.body.jwt_token });
    expect(addAnnotationResponse.status).toBe(409);
    expect(addAnnotationResponse.text).toBe(ANNOTATION_CONFLICT);
  });

  test('Invalid annotation', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const uploadResponse = await uploadBook(userId, 'Alices_Adventures_in_Wonderland.epub', { jwt: registerResponse.body.jwt_token });
    expect(uploadResponse.status).toBe(200);

    const missingContentDocument = {
      start_location: 'invalid#0/1/t0:7',
      end_location: 'invalid#0/2/t0:42',
      note: 'I loved this part!'
    };

    let addAnnotationResponse = await addAnnotation(uploadResponse.text, missingContentDocument, { jwt: registerResponse.body.jwt_token });
    expect(addAnnotationResponse.status).toBe(400);
    expect(addAnnotationResponse.text).toBe(INVALID_ANNOTATION);

    let unresolvableLocation = {
      start_location: 'OEBPS/229714655232534212_11-h-10.htm.xhtml#99/99/t0:0',
      end_location: 'OEBPS/229714655232534212_11-h-10.htm.xhtml#99/99/t0:0',
      note: 'I loved this part!'
    };

    addAnnotationResponse = await addAnnotation(uploadResponse.text, unresolvableLocation, { jwt: registerResponse.body.jwt_token });
    expect(addAnnotationResponse.status).toBe(400);
    expect(addAnnotationResponse.text).toBe(INVALID_ANNOTATION);

    unresolvableLocation = {
      start_location: 'not-a-location',
      end_location: 'OEBPS/229714655232534212_11-h-10.htm.xhtml#0/2/t0:42',
      note: 'I loved this part!'
    };

    addAnnotationResponse = await addAnnotation(uploadResponse.text, unresolvableLocation, { jwt: registerResponse.body.jwt_token });
    expect(addAnnotationResponse.status).toBe(400);
    expect(addAnnotationResponse.text).toBe(INVALID_ANNOTATION);

    const offsetPastEndOfText = {
      start_location: 'OEBPS/229714655232534212_11-h-10.htm.xhtml#0/1/t0:999999',
      end_location: 'OEBPS/229714655232534212_11-h-10.htm.xhtml#0/2/t0:42',
      note: 'I loved this part!'
    };

    addAnnotationResponse = await addAnnotation(uploadResponse.text, offsetPastEndOfText, { jwt: registerResponse.body.jwt_token });
    expect(addAnnotationResponse.status).toBe(400);
    expect(addAnnotationResponse.text).toBe(INVALID_ANNOTATION);
  });

  test('Different user without permission', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const uploadResponse = await uploadBook(userId, 'Alices_Adventures_in_Wonderland.epub', { jwt: registerResponse.body.jwt_token });
    expect(uploadResponse.status).toBe(200);

    const { response: registerResponse2 } = await registerUser();
    expect(registerResponse2.status).toBe(200);

    const addAnnotationResponse = await addAnnotation(uploadResponse.text, ALICE_NOTE, { jwt: registerResponse2.body.jwt_token });
    expect(addAnnotationResponse.status).toBe(404);
    expect(addAnnotationResponse.text).toBe(BOOK_NOT_FOUND);
  });

  test('Different user with permission', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const uploadResponse = await uploadBook(userId, 'Alices_Adventures_in_Wonderland.epub', { jwt: registerResponse.body.jwt_token });
    expect(uploadResponse.status).toBe(200);

    const { response: registerResponse2 } = await registerUser(undefined, undefined, true, process.env.ADMIN_KEY);
    expect(registerResponse2.status).toBe(200);

    const addAnnotationResponse = await addAnnotation(uploadResponse.text, ALICE_NOTE, { jwt: registerResponse2.body.jwt_token });
    expect(addAnnotationResponse.status).toBe(200);
  });
});

describe('Get annotation', () => {
  test('Simple', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const uploadResponse = await uploadBook(userId, 'Alices_Adventures_in_Wonderland.epub', { jwt: registerResponse.body.jwt_token });
    expect(uploadResponse.status).toBe(200);

    const addAnnotationResponse = await addAnnotation(uploadResponse.text, ALICE_NOTE, { jwt: registerResponse.body.jwt_token });
    expect(addAnnotationResponse.status).toBe(200);

    let expectedResponse: any = structuredClone(ALICE_NOTE);
    expectedResponse['annotation_id'] = addAnnotationResponse.text;

    const getAnnotationResponse = await getAnnotation(uploadResponse.text, addAnnotationResponse.text, { jwt: registerResponse.body.jwt_token });
    expect(getAnnotationResponse.status).toBe(200);
    expect(getAnnotationResponse.body).toEqual(expectedResponse);
  });

  test('Non-existent annotation', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const uploadResponse = await uploadBook(userId, 'Alices_Adventures_in_Wonderland.epub', { jwt: registerResponse.body.jwt_token });
    expect(uploadResponse.status).toBe(200);

    const getAnnotationResponse = await getAnnotation(uploadResponse.text, 'non-existent', { jwt: registerResponse.body.jwt_token });
    expect(getAnnotationResponse.status).toBe(404);
    expect(getAnnotationResponse.text).toEqual(ANNOTATION_NOT_FOUND);
  });

  test('Non-existent book', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);

    const getAnnotationResponse = await getAnnotation('non-existent', 'non-existent', { jwt: registerResponse.body.jwt_token });
    expect(getAnnotationResponse.status).toBe(404);
    expect(getAnnotationResponse.text).toEqual(BOOK_NOT_FOUND);
  });

  test('Different user without permission', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const uploadResponse = await uploadBook(userId, 'Alices_Adventures_in_Wonderland.epub', { jwt: registerResponse.body.jwt_token });
    expect(uploadResponse.status).toBe(200);

    const addAnnotationResponse = await addAnnotation(uploadResponse.text, ALICE_NOTE, { jwt: registerResponse.body.jwt_token });
    expect(addAnnotationResponse.status).toBe(200);

    const { response: registerResponse2 } = await registerUser();
    expect(registerResponse2.status).toBe(200);

    const getAnnotationResponse = await getAnnotation(uploadResponse.text, addAnnotationResponse.text, { jwt: registerResponse2.body.jwt_token });
    expect(getAnnotationResponse.status).toBe(404);
    expect(getAnnotationResponse.text).toBe(BOOK_NOT_FOUND);
  });

  test('Different user with permission', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const uploadResponse = await uploadBook(userId, 'Alices_Adventures_in_Wonderland.epub', { jwt: registerResponse.body.jwt_token });
    expect(uploadResponse.status).toBe(200);

    const addAnnotationResponse = await addAnnotation(uploadResponse.text, ALICE_NOTE, { jwt: registerResponse.body.jwt_token });
    expect(addAnnotationResponse.status).toBe(200);

    const { response: registerResponse2 } = await registerUser(undefined, undefined, true, process.env.ADMIN_KEY);
    expect(registerResponse2.status).toBe(200);

    const getAnnotationResponse = await getAnnotation(uploadResponse.text, addAnnotationResponse.text, { jwt: registerResponse2.body.jwt_token });
    expect(getAnnotationResponse.status).toBe(200);
  });
});

describe('List annotations', () => {
  test('Simple', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const uploadResponse = await uploadBook(userId, 'Alices_Adventures_in_Wonderland.epub', { jwt: registerResponse.body.jwt_token });
    expect(uploadResponse.status).toBe(200);

    let listAnnotationsResponse = await listAnnotations(uploadResponse.text, { jwt: registerResponse.body.jwt_token });
    expect(listAnnotationsResponse.status).toBe(200);
    expect(listAnnotationsResponse.body).toEqual([]);

    const addAnnotationResponse = await addAnnotation(uploadResponse.text, ALICE_NOTE, { jwt: registerResponse.body.jwt_token });
    expect(addAnnotationResponse.status).toBe(200);

    listAnnotationsResponse = await listAnnotations(uploadResponse.text, { jwt: registerResponse.body.jwt_token });
    expect(listAnnotationsResponse.status).toBe(200);
    expect(listAnnotationsResponse.body).toEqual([addAnnotationResponse.text]);
  });

  test('Non-existent book', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);

    const listAnnotationsResponse = await listAnnotations('non-existent', { jwt: registerResponse.body.jwt_token });
    expect(listAnnotationsResponse.status).toBe(404);
    expect(listAnnotationsResponse.text).toBe(BOOK_NOT_FOUND);
  });

  test('Different user without permission', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const uploadResponse = await uploadBook(userId, 'Alices_Adventures_in_Wonderland.epub', { jwt: registerResponse.body.jwt_token });
    expect(uploadResponse.status).toBe(200);

    const { response: registerResponse2 } = await registerUser();
    expect(registerResponse2.status).toBe(200);

    const listAnnotationsResponse = await listAnnotations(uploadResponse.text, { jwt: registerResponse2.body.jwt_token });
    expect(listAnnotationsResponse.status).toBe(404);
    expect(listAnnotationsResponse.text).toBe(BOOK_NOT_FOUND);
  });

  test('Different user with permission', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const uploadResponse = await uploadBook(userId, 'Alices_Adventures_in_Wonderland.epub', { jwt: registerResponse.body.jwt_token });
    expect(uploadResponse.status).toBe(200);

    const { response: registerResponse2 } = await registerUser(undefined, undefined, true, process.env.ADMIN_KEY);
    expect(registerResponse2.status).toBe(200);

    const listAnnotationsResponse = await listAnnotations(uploadResponse.text, { jwt: registerResponse2.body.jwt_token });
    expect(listAnnotationsResponse.status).toBe(200);
  });
});

describe('Delete annotation', () => {
  test('Simple', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const uploadResponse = await uploadBook(userId, 'Alices_Adventures_in_Wonderland.epub', { jwt: registerResponse.body.jwt_token });
    expect(uploadResponse.status).toBe(200);

    const addAnnotationResponse = await addAnnotation(uploadResponse.text, ALICE_NOTE, { jwt: registerResponse.body.jwt_token });
    expect(addAnnotationResponse.status).toBe(200);

    const expectedResponse: any = structuredClone(ALICE_NOTE);
    expectedResponse['annotation_id'] = addAnnotationResponse.text;

    let getAnnotationResponse = await getAnnotation(uploadResponse.text, addAnnotationResponse.text, { jwt: registerResponse.body.jwt_token });
    expect(getAnnotationResponse.status).toBe(200);
    expect(getAnnotationResponse.body).toEqual(expectedResponse);

    const deleteAnnotationResponse = await deleteAnnotation(uploadResponse.text, addAnnotationResponse.text, { jwt: registerResponse.body.jwt_token });
    expect(deleteAnnotationResponse.status).toBe(204);

    getAnnotationResponse = await getAnnotation(uploadResponse.text, addAnnotationResponse.text, { jwt: registerResponse.body.jwt_token });
    expect(getAnnotationResponse.status).toBe(404);
    expect(getAnnotationResponse.text).toBe(ANNOTATION_NOT_FOUND);
  });

  test('Non-existent annotation', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const uploadResponse = await uploadBook(userId, 'Alices_Adventures_in_Wonderland.epub', { jwt: registerResponse.body.jwt_token });
    expect(uploadResponse.status).toBe(200);

    const deleteAnnotationResponse = await deleteAnnotation(uploadResponse.text, 'non-existent', { jwt: registerResponse.body.jwt_token });
    expect(deleteAnnotationResponse.status).toBe(404);
    expect(deleteAnnotationResponse.text).toEqual(ANNOTATION_NOT_FOUND);
  });

  test('Non-existent book', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);

    const deleteAnnotationResponse = await deleteAnnotation('non-existent', 'non-existent', { jwt: registerResponse.body.jwt_token });
    expect(deleteAnnotationResponse.status).toBe(404);
    expect(deleteAnnotationResponse.text).toEqual(BOOK_NOT_FOUND);
  });

  test('Different user without permission', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const uploadResponse = await uploadBook(userId, 'Alices_Adventures_in_Wonderland.epub', { jwt: registerResponse.body.jwt_token });
    expect(uploadResponse.status).toBe(200);

    const addAnnotationResponse = await addAnnotation(uploadResponse.text, ALICE_NOTE, { jwt: registerResponse.body.jwt_token });
    expect(addAnnotationResponse.status).toBe(200);

    const { response: registerResponse2 } = await registerUser();
    expect(registerResponse2.status).toBe(200);

    const deleteAnnotationResponse = await deleteAnnotation(uploadResponse.text, addAnnotationResponse.text, { jwt: registerResponse2.body.jwt_token });
    expect(deleteAnnotationResponse.status).toBe(404);
    expect(deleteAnnotationResponse.text).toBe(BOOK_NOT_FOUND);
  });

  test('Different user with permission', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const uploadResponse = await uploadBook(userId, 'Alices_Adventures_in_Wonderland.epub', { jwt: registerResponse.body.jwt_token });
    expect(uploadResponse.status).toBe(200);

    const addAnnotationResponse = await addAnnotation(uploadResponse.text, ALICE_NOTE, { jwt: registerResponse.body.jwt_token });
    expect(addAnnotationResponse.status).toBe(200);

    const { response: registerResponse2 } = await registerUser(undefined, undefined, true, process.env.ADMIN_KEY);
    expect(registerResponse2.status).toBe(200);

    const deleteAnnotationResponse = await deleteAnnotation(uploadResponse.text, addAnnotationResponse.text, { jwt: registerResponse2.body.jwt_token });
    expect(deleteAnnotationResponse.status).toBe(204);
  });
});

describe('Patch annotation', () => {
  test('Simple', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const uploadResponse = await uploadBook(userId, 'Alices_Adventures_in_Wonderland.epub', { jwt: registerResponse.body.jwt_token });
    expect(uploadResponse.status).toBe(200);

    const addAnnotationResponse = await addAnnotation(uploadResponse.text, ALICE_NOTE, { jwt: registerResponse.body.jwt_token });
    expect(addAnnotationResponse.status).toBe(200);

    let expectedResponse: any = structuredClone(ALICE_NOTE);
    expectedResponse['annotation_id'] = addAnnotationResponse.text;

    let getAnnotationResponse = await getAnnotation(uploadResponse.text, addAnnotationResponse.text, { jwt: registerResponse.body.jwt_token });
    expect(getAnnotationResponse.status).toBe(200);
    expect(getAnnotationResponse.body).toEqual(expectedResponse);

    expectedResponse['note'] = 'New note';

    let patchAnnotationResponse = await patchAnnotation(uploadResponse.text, addAnnotationResponse.text, 'New note', { jwt: registerResponse.body.jwt_token });
    expect(patchAnnotationResponse.status).toBe(204);

    getAnnotationResponse = await getAnnotation(uploadResponse.text, addAnnotationResponse.text, { jwt: registerResponse.body.jwt_token });
    expect(getAnnotationResponse.status).toBe(200);
    expect(getAnnotationResponse.body).toEqual(expectedResponse);

    delete expectedResponse.note;

    patchAnnotationResponse = await patchAnnotation(uploadResponse.text, addAnnotationResponse.text, '', { jwt: registerResponse.body.jwt_token });
    expect(patchAnnotationResponse.status).toBe(204);

    getAnnotationResponse = await getAnnotation(uploadResponse.text, addAnnotationResponse.text, { jwt: registerResponse.body.jwt_token });
    expect(getAnnotationResponse.status).toBe(200);
    expect(getAnnotationResponse.body).toEqual(expectedResponse);
  });

  test('Non-existent annotation', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const uploadResponse = await uploadBook(userId, 'Alices_Adventures_in_Wonderland.epub', { jwt: registerResponse.body.jwt_token });
    expect(uploadResponse.status).toBe(200);

    const patchAnnotationResponse = await patchAnnotation(uploadResponse.text, 'non-existent', 'note', { jwt: registerResponse.body.jwt_token });
    expect(patchAnnotationResponse.status).toBe(404);
    expect(patchAnnotationResponse.text).toEqual(ANNOTATION_NOT_FOUND);
  });

  test('Non-existent book', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);

    const patchAnnotationResponse = await patchAnnotation('non-existent', 'non-existent', 'note', { jwt: registerResponse.body.jwt_token });
    expect(patchAnnotationResponse.status).toBe(404);
    expect(patchAnnotationResponse.text).toEqual(BOOK_NOT_FOUND);
  });

  test('Different user without permission', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const uploadResponse = await uploadBook(userId, 'Alices_Adventures_in_Wonderland.epub', { jwt: registerResponse.body.jwt_token });
    expect(uploadResponse.status).toBe(200);

    const addAnnotationResponse = await addAnnotation(uploadResponse.text, ALICE_NOTE, { jwt: registerResponse.body.jwt_token });
    expect(addAnnotationResponse.status).toBe(200);

    const { response: registerResponse2 } = await registerUser();
    expect(registerResponse2.status).toBe(200);

    const patchAnnotationResponse = await patchAnnotation(uploadResponse.text, addAnnotationResponse.text, 'note', { jwt: registerResponse2.body.jwt_token });
    expect(patchAnnotationResponse.status).toBe(404);
    expect(patchAnnotationResponse.text).toBe(BOOK_NOT_FOUND);
  });

  test('Different user with permission', async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);
    const userId = registerResponse.body.user_id;

    const uploadResponse = await uploadBook(userId, 'Alices_Adventures_in_Wonderland.epub', { jwt: registerResponse.body.jwt_token });
    expect(uploadResponse.status).toBe(200);

    const addAnnotationResponse = await addAnnotation(uploadResponse.text, ALICE_NOTE, { jwt: registerResponse.body.jwt_token });
    expect(addAnnotationResponse.status).toBe(200);

    const { response: registerResponse2 } = await registerUser(undefined, undefined, true, process.env.ADMIN_KEY);
    expect(registerResponse2.status).toBe(200);

    const patchAnnotationResponse = await patchAnnotation(uploadResponse.text, addAnnotationResponse.text, 'note', { jwt: registerResponse2.body.jwt_token });
    expect(patchAnnotationResponse.status).toBe(204);
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

async function annotationFixture() {
  const { userId, jwt, context } = await bookFixture();

  const addAnnotationResponse = await addAnnotation(context.bookId, ALICE_NOTE, { jwt });
  expect(addAnnotationResponse.status).toBe(200);

  return { userId, jwt, context: { ...context, annotationId: addAnnotationResponse.text } };
}

describeAuthContract('Add annotation auth', {
  capability: 'Update',
  success: 200,
  setup: bookFixture,
  call: ({ bookId }, auth) => addAnnotation(bookId, ALICE_NOTE, auth)
});

describeAuthContract('Get annotation auth', {
  capability: 'Read',
  success: 200,
  setup: annotationFixture,
  call: ({ bookId, annotationId }, auth) => getAnnotation(bookId, annotationId, auth)
});

describeAuthContract('List annotations auth', {
  capability: 'Read',
  success: 200,
  setup: bookFixture,
  call: ({ bookId }, auth) => listAnnotations(bookId, auth)
});

describeAuthContract('Delete annotation auth', {
  capability: 'Update',
  success: 204,
  setup: annotationFixture,
  call: ({ bookId, annotationId }, auth) => deleteAnnotation(bookId, annotationId, auth)
});

describeAuthContract('Patch annotation auth', {
  capability: 'Update',
  success: 204,
  setup: annotationFixture,
  call: ({ bookId, annotationId }, auth) => patchAnnotation(bookId, annotationId, 'New note', auth)
});
