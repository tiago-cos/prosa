import { FORBIDDEN, INVALID_API_KEY, UNAUTHORIZED, wait } from "../utils/common";
import { registerUser, createApiKey } from "../utils/users"
import { BOOK_NOT_FOUND, uploadBook } from "../utils/books"
import { addAnnotation, ALICE_NOTE, ANNOTATION_CONFLICT, ANNOTATION_NOT_FOUND, deleteAnnotation, getAnnotation, INVALID_ANNOTATION, listAnnotations, patchAnnotation } from "../utils/annotations"

describe("Add annotation JWT", () => {
    test("Simple", async () => {
        const { response: registerResponse, username } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const uploadResponse = await uploadBook(username, "Alices_Adventures_in_Wonderland.epub", { jwt: registerResponse.text });
        expect(uploadResponse.status).toBe(200);

        const addAnnotationResponse = await addAnnotation(uploadResponse.text, ALICE_NOTE, { jwt: registerResponse.text });
        expect(addAnnotationResponse.status).toBe(200);
    });

    test("Non-existent book", async () => {
        const { response: registerResponse } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const addAnnotationResponse = await addAnnotation("non-existent", ALICE_NOTE, { jwt: registerResponse.text });
        expect(addAnnotationResponse.status).toBe(404);
        expect(addAnnotationResponse.text).toBe(BOOK_NOT_FOUND);
    });

    test("Annotation conflict", async () => {
        const { response: registerResponse, username } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const uploadResponse = await uploadBook(username, "Alices_Adventures_in_Wonderland.epub", { jwt: registerResponse.text });
        expect(uploadResponse.status).toBe(200);

        let addAnnotationResponse = await addAnnotation(uploadResponse.text, ALICE_NOTE, { jwt: registerResponse.text });
        expect(addAnnotationResponse.status).toBe(200);

        addAnnotationResponse = await addAnnotation(uploadResponse.text, ALICE_NOTE, { jwt: registerResponse.text });
        expect(addAnnotationResponse.status).toBe(409);
        expect(addAnnotationResponse.text).toBe(ANNOTATION_CONFLICT);
    });

    test("Invalid annotation", async () => {
        const { response: registerResponse, username } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const uploadResponse = await uploadBook(username, "Alices_Adventures_in_Wonderland.epub", { jwt: registerResponse.text });
        expect(uploadResponse.status).toBe(200);

        const invalidSource = {
            source: "invalid",
            start_tag: "kobo.74.1",
            end_tag: "kobo.74.2",
            start_char: 7,
            end_char: 4,
            note: "I loved this part!"
        };

        let addAnnotationResponse = await addAnnotation(uploadResponse.text, invalidSource, { jwt: registerResponse.text });
        expect(addAnnotationResponse.status).toBe(400);
        expect(addAnnotationResponse.text).toBe(INVALID_ANNOTATION);

        let invalidTags = {
            source: "OEBPS/229714655232534212_11-h-10.htm.xhtml",
            start_tag: "kobo.999.999",
            end_tag: "kobo.999.999",
            start_char: 7,
            end_char: 4,
            note: "I loved this part!"
        };

        addAnnotationResponse = await addAnnotation(uploadResponse.text, invalidTags, { jwt: registerResponse.text });
        expect(addAnnotationResponse.status).toBe(400);
        expect(addAnnotationResponse.text).toBe(INVALID_ANNOTATION);

        invalidTags = {
            source: "OEBPS/229714655232534212_11-h-10.htm.xhtml",
            start_tag: "kobo.74.2",
            end_tag: "kobo.74.1",
            start_char: 7,
            end_char: 4,
            note: "I loved this part!"
        };

        addAnnotationResponse = await addAnnotation(uploadResponse.text, invalidTags, { jwt: registerResponse.text });
        expect(addAnnotationResponse.status).toBe(400);
        expect(addAnnotationResponse.text).toBe(INVALID_ANNOTATION);

        const invalidCharPosition = {
            source: "OEBPS/229714655232534212_11-h-10.htm.xhtml",
            start_tag: "kobo.74.1",
            end_tag: "kobo.74.2",
            start_char: 999,
            end_char: 4,
            note: "I loved this part!"
        };

        addAnnotationResponse = await addAnnotation(uploadResponse.text, invalidCharPosition, { jwt: registerResponse.text });
        expect(addAnnotationResponse.status).toBe(400);
        expect(addAnnotationResponse.text).toBe(INVALID_ANNOTATION);
    });

    test("Different user without permission", async () => {
        const { response: registerResponse, username } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const uploadResponse = await uploadBook(username, "Alices_Adventures_in_Wonderland.epub", { jwt: registerResponse.text });
        expect(uploadResponse.status).toBe(200);

        const { response: registerResponse2 } = await registerUser();
        expect(registerResponse2.status).toBe(200);

        const addAnnotationResponse = await addAnnotation(uploadResponse.text, ALICE_NOTE, { jwt: registerResponse2.text });
        expect(addAnnotationResponse.status).toBe(404);
        expect(addAnnotationResponse.text).toBe(BOOK_NOT_FOUND);
    });

    test("Different user with permission", async () => {
        const { response: registerResponse, username } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const uploadResponse = await uploadBook(username, "Alices_Adventures_in_Wonderland.epub", { jwt: registerResponse.text });
        expect(uploadResponse.status).toBe(200);

        const { response: registerResponse2 } = await registerUser(undefined, undefined, process.env.ADMIN_KEY);
        expect(registerResponse2.status).toBe(200);

        const addAnnotationResponse = await addAnnotation(uploadResponse.text, ALICE_NOTE, { jwt: registerResponse2.text });
        expect(addAnnotationResponse.status).toBe(200);
    });

    test("No auth", async () => {
        const { response: registerResponse, username } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const uploadResponse = await uploadBook(username, "Alices_Adventures_in_Wonderland.epub", { jwt: registerResponse.text });
        expect(uploadResponse.status).toBe(200);

        const addAnnotationResponse = await addAnnotation(uploadResponse.text, ALICE_NOTE);
        expect(addAnnotationResponse.status).toBe(401);
        expect(addAnnotationResponse.text).toBe(UNAUTHORIZED);
    });
});

describe("Add annotation api key", () => {
    test("Simple", async () => {
        const { response: registerResponse, username } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const uploadResponse = await uploadBook(username, "Alices_Adventures_in_Wonderland.epub", { jwt: registerResponse.text });
        expect(uploadResponse.status).toBe(200);

        const createApiKeyResponse = await createApiKey(username, "Test Key", ["Update"], undefined, { jwt: registerResponse.text });
        expect(createApiKeyResponse.status).toBe(200);

        const addAnnotationResponse = await addAnnotation(uploadResponse.text, ALICE_NOTE, { apiKey: createApiKeyResponse.body.key });
        expect(addAnnotationResponse.status).toBe(200);
    });

    test("Non-existent book", async () => {
        const { response: registerResponse, username } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const createApiKeyResponse = await createApiKey(username, "Test Key", ["Update"], undefined, { jwt: registerResponse.text });
        expect(createApiKeyResponse.status).toBe(200);

        const addAnnotationResponse = await addAnnotation("non-existent", ALICE_NOTE, { apiKey: createApiKeyResponse.body.key });
        expect(addAnnotationResponse.status).toBe(404);
        expect(addAnnotationResponse.text).toBe(BOOK_NOT_FOUND);
    });

    test("Annotation conflict", async () => {
        const { response: registerResponse, username } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const uploadResponse = await uploadBook(username, "Alices_Adventures_in_Wonderland.epub", { jwt: registerResponse.text });
        expect(uploadResponse.status).toBe(200);

        const createApiKeyResponse = await createApiKey(username, "Test Key", ["Update"], undefined, { jwt: registerResponse.text });
        expect(createApiKeyResponse.status).toBe(200);

        let addAnnotationResponse = await addAnnotation(uploadResponse.text, ALICE_NOTE, { apiKey: createApiKeyResponse.body.key });
        expect(addAnnotationResponse.status).toBe(200);

        addAnnotationResponse = await addAnnotation(uploadResponse.text, ALICE_NOTE, { apiKey: createApiKeyResponse.body.key });
        expect(addAnnotationResponse.status).toBe(409);
        expect(addAnnotationResponse.text).toBe(ANNOTATION_CONFLICT);
    });

    test("Invalid annotation", async () => {
        const { response: registerResponse, username } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const uploadResponse = await uploadBook(username, "Alices_Adventures_in_Wonderland.epub", { jwt: registerResponse.text });
        expect(uploadResponse.status).toBe(200);

        const createApiKeyResponse = await createApiKey(username, "Test Key", ["Update"], undefined, { jwt: registerResponse.text });
        expect(createApiKeyResponse.status).toBe(200);

        const invalidSource = {
            source: "invalid",
            start_tag: "kobo.74.1",
            end_tag: "kobo.74.2",
            start_char: 7,
            end_char: 4,
            note: "I loved this part!"
        };

        let addAnnotationResponse = await addAnnotation(uploadResponse.text, invalidSource, { apiKey: createApiKeyResponse.body.key });
        expect(addAnnotationResponse.status).toBe(400);
        expect(addAnnotationResponse.text).toBe(INVALID_ANNOTATION);

        let invalidTags = {
            source: "OEBPS/229714655232534212_11-h-10.htm.xhtml",
            start_tag: "kobo.999.999",
            end_tag: "kobo.999.999",
            start_char: 7,
            end_char: 4,
            note: "I loved this part!"
        };

        addAnnotationResponse = await addAnnotation(uploadResponse.text, invalidTags, { apiKey: createApiKeyResponse.body.key });
        expect(addAnnotationResponse.status).toBe(400);
        expect(addAnnotationResponse.text).toBe(INVALID_ANNOTATION);

        invalidTags = {
            source: "OEBPS/229714655232534212_11-h-10.htm.xhtml",
            start_tag: "kobo.74.2",
            end_tag: "kobo.74.1",
            start_char: 7,
            end_char: 4,
            note: "I loved this part!"
        };

        addAnnotationResponse = await addAnnotation(uploadResponse.text, invalidTags, { apiKey: createApiKeyResponse.body.key });
        expect(addAnnotationResponse.status).toBe(400);
        expect(addAnnotationResponse.text).toBe(INVALID_ANNOTATION);

        const invalidCharPosition = {
            source: "OEBPS/229714655232534212_11-h-10.htm.xhtml",
            start_tag: "kobo.74.1",
            end_tag: "kobo.74.2",
            start_char: 999,
            end_char: 4,
            note: "I loved this part!"
        };

        addAnnotationResponse = await addAnnotation(uploadResponse.text, invalidCharPosition, { apiKey: createApiKeyResponse.body.key });
        expect(addAnnotationResponse.status).toBe(400);
        expect(addAnnotationResponse.text).toBe(INVALID_ANNOTATION);
    });

    test("Different user without permission", async () => {
        const { response: registerResponse, username } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const uploadResponse = await uploadBook(username, "Alices_Adventures_in_Wonderland.epub", { jwt: registerResponse.text });
        expect(uploadResponse.status).toBe(200);

        const { response: registerResponse2, username: username2 } = await registerUser();
        expect(registerResponse2.status).toBe(200);

        const createApiKeyResponse = await createApiKey(username2, "Test Key", ["Update"], undefined, { jwt: registerResponse2.text });
        expect(createApiKeyResponse.status).toBe(200);

        const addAnnotationResponse = await addAnnotation(uploadResponse.text, ALICE_NOTE, { apiKey: createApiKeyResponse.body.key });
        expect(addAnnotationResponse.status).toBe(404);
        expect(addAnnotationResponse.text).toBe(BOOK_NOT_FOUND);
    });

    test("Different user with permission", async () => {
        const { response: registerResponse, username } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const uploadResponse = await uploadBook(username, "Alices_Adventures_in_Wonderland.epub", { jwt: registerResponse.text });
        expect(uploadResponse.status).toBe(200);

        const { response: registerResponse2, username: username2 } = await registerUser(undefined, undefined, process.env.ADMIN_KEY);
        expect(registerResponse2.status).toBe(200);

        const createApiKeyResponse = await createApiKey(username2, "Test Key", ["Update"], undefined, { jwt: registerResponse2.text });
        expect(createApiKeyResponse.status).toBe(200);

        const addAnnotationResponse = await addAnnotation(uploadResponse.text, ALICE_NOTE, { apiKey: createApiKeyResponse.body.key });
        expect(addAnnotationResponse.status).toBe(200);
    });

    test("Wrong capabilities", async () => {
        const { response: registerResponse, username } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const uploadResponse = await uploadBook(username, "Alices_Adventures_in_Wonderland.epub", { jwt: registerResponse.text });
        expect(uploadResponse.status).toBe(200);

        const createApiKeyResponse = await createApiKey(username, "Test Key", ["Create", "Read", "Delete"], undefined, { jwt: registerResponse.text });
        expect(createApiKeyResponse.status).toBe(200);

        const addAnnotationResponse = await addAnnotation(uploadResponse.text, ALICE_NOTE, { apiKey: createApiKeyResponse.body.key });
        expect(addAnnotationResponse.status).toBe(403);
        expect(addAnnotationResponse.text).toBe(FORBIDDEN);
    });

    test("Expired api key", async () => {
        const { response: registerResponse, username } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const uploadResponse = await uploadBook(username, "Alices_Adventures_in_Wonderland.epub", { jwt: registerResponse.text });
        expect(uploadResponse.status).toBe(200);

        const timestamp = Date.now() + 2000;
        const createApiKeyResponse = await createApiKey(username, "Test Key", ["Update"], timestamp, { jwt: registerResponse.text });
        expect(createApiKeyResponse.status).toBe(200);

        // Wait for the key to expire
        await wait(2.5);

        const addAnnotationResponse = await addAnnotation(uploadResponse.text, ALICE_NOTE, { apiKey: createApiKeyResponse.body.key });
        expect(addAnnotationResponse.status).toBe(401);
        expect(addAnnotationResponse.text).toBe(INVALID_API_KEY);
    });
});

describe("Get annotation JWT", () => {
    test("Simple", async () => {
        const { response: registerResponse, username } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const uploadResponse = await uploadBook(username, "Alices_Adventures_in_Wonderland.epub", { jwt: registerResponse.text });
        expect(uploadResponse.status).toBe(200);

        const addAnnotationResponse = await addAnnotation(uploadResponse.text, ALICE_NOTE, { jwt: registerResponse.text });
        expect(addAnnotationResponse.status).toBe(200);

        let expectedResponse: any = structuredClone(ALICE_NOTE);
        expectedResponse["annotation_id"] = addAnnotationResponse.text;

        const getAnnotationResponse = await getAnnotation(uploadResponse.text, addAnnotationResponse.text, { jwt: registerResponse.text });
        expect(getAnnotationResponse.status).toBe(200);
        expect(getAnnotationResponse.body).toEqual(expectedResponse);
    });

    test("Non-existent annotation", async () => {
        const { response: registerResponse, username } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const uploadResponse = await uploadBook(username, "Alices_Adventures_in_Wonderland.epub", { jwt: registerResponse.text });
        expect(uploadResponse.status).toBe(200);

        const getAnnotationResponse = await getAnnotation(uploadResponse.text, "non-existent", { jwt: registerResponse.text });
        expect(getAnnotationResponse.status).toBe(404);
        expect(getAnnotationResponse.text).toEqual(ANNOTATION_NOT_FOUND);
    });

    test("Non-existent book", async () => {
        const { response: registerResponse } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const getAnnotationResponse = await getAnnotation("non-existent", "non-existent", { jwt: registerResponse.text });
        expect(getAnnotationResponse.status).toBe(404);
        expect(getAnnotationResponse.text).toEqual(BOOK_NOT_FOUND);
    });

    test("Different user without permission", async () => {
        const { response: registerResponse, username } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const uploadResponse = await uploadBook(username, "Alices_Adventures_in_Wonderland.epub", { jwt: registerResponse.text });
        expect(uploadResponse.status).toBe(200);

        const addAnnotationResponse = await addAnnotation(uploadResponse.text, ALICE_NOTE, { jwt: registerResponse.text });
        expect(addAnnotationResponse.status).toBe(200);

        const { response: registerResponse2 } = await registerUser();
        expect(registerResponse2.status).toBe(200);

        const getAnnotationResponse = await getAnnotation(uploadResponse.text, addAnnotationResponse.text, { jwt: registerResponse2.text });
        expect(getAnnotationResponse.status).toBe(404);
        expect(getAnnotationResponse.text).toBe(BOOK_NOT_FOUND);
    });

    test("Different user with permission", async () => {
        const { response: registerResponse, username } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const uploadResponse = await uploadBook(username, "Alices_Adventures_in_Wonderland.epub", { jwt: registerResponse.text });
        expect(uploadResponse.status).toBe(200);

        const addAnnotationResponse = await addAnnotation(uploadResponse.text, ALICE_NOTE, { jwt: registerResponse.text });
        expect(addAnnotationResponse.status).toBe(200);

        const { response: registerResponse2 } = await registerUser(undefined, undefined, process.env.ADMIN_KEY);
        expect(registerResponse2.status).toBe(200);

        const getAnnotationResponse = await getAnnotation(uploadResponse.text, addAnnotationResponse.text, { jwt: registerResponse2.text });
        expect(getAnnotationResponse.status).toBe(200);
    });

    test("No auth", async () => {
        const { response: registerResponse, username } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const uploadResponse = await uploadBook(username, "Alices_Adventures_in_Wonderland.epub", { jwt: registerResponse.text });
        expect(uploadResponse.status).toBe(200);

        const addAnnotationResponse = await addAnnotation(uploadResponse.text, ALICE_NOTE, { jwt: registerResponse.text });
        expect(addAnnotationResponse.status).toBe(200);

        let getAnnotationResponse = await getAnnotation(uploadResponse.text, addAnnotationResponse.text);
        expect(getAnnotationResponse.status).toBe(401);
        expect(getAnnotationResponse.text).toBe(UNAUTHORIZED);
    });
});

describe("Get annotation api key", () => {
    test("Simple", async () => {
        const { response: registerResponse, username } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const uploadResponse = await uploadBook(username, "Alices_Adventures_in_Wonderland.epub", { jwt: registerResponse.text });
        expect(uploadResponse.status).toBe(200);

        const addAnnotationResponse = await addAnnotation(uploadResponse.text, ALICE_NOTE, { jwt: registerResponse.text });
        expect(addAnnotationResponse.status).toBe(200);

        let expectedResponse: any = structuredClone(ALICE_NOTE);
        expectedResponse["annotation_id"] = addAnnotationResponse.text;

        const createApiKeyResponse = await createApiKey(username, "Test Key", ["Read"], undefined, { jwt: registerResponse.text });
        expect(createApiKeyResponse.status).toBe(200);

        const getAnnotationResponse = await getAnnotation(uploadResponse.text, addAnnotationResponse.text, { apiKey: createApiKeyResponse.body.key });
        expect(getAnnotationResponse.status).toBe(200);
        expect(getAnnotationResponse.body).toEqual(expectedResponse);
    });

    test("Non-existent annotation", async () => {
        const { response: registerResponse, username } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const uploadResponse = await uploadBook(username, "Alices_Adventures_in_Wonderland.epub", { jwt: registerResponse.text });
        expect(uploadResponse.status).toBe(200);

        const createApiKeyResponse = await createApiKey(username, "Test Key", ["Read"], undefined, { jwt: registerResponse.text });
        expect(createApiKeyResponse.status).toBe(200);

        const getAnnotationResponse = await getAnnotation(uploadResponse.text, "non-existent", { apiKey: createApiKeyResponse.body.key });
        expect(getAnnotationResponse.status).toBe(404);
        expect(getAnnotationResponse.text).toEqual(ANNOTATION_NOT_FOUND);
    });

    test("Non-existent book", async () => {
        const { response: registerResponse, username } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const createApiKeyResponse = await createApiKey(username, "Test Key", ["Read"], undefined, { jwt: registerResponse.text });
        expect(createApiKeyResponse.status).toBe(200);

        const getAnnotationResponse = await getAnnotation("non-existent", "non-existent", { apiKey: createApiKeyResponse.body.key });
        expect(getAnnotationResponse.status).toBe(404);
        expect(getAnnotationResponse.text).toEqual(BOOK_NOT_FOUND);
    });

    test("Different user without permission", async () => {
        const { response: registerResponse, username } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const uploadResponse = await uploadBook(username, "Alices_Adventures_in_Wonderland.epub", { jwt: registerResponse.text });
        expect(uploadResponse.status).toBe(200);

        const addAnnotationResponse = await addAnnotation(uploadResponse.text, ALICE_NOTE, { jwt: registerResponse.text });
        expect(addAnnotationResponse.status).toBe(200);

        const { response: registerResponse2, username: username2 } = await registerUser();
        expect(registerResponse2.status).toBe(200);

        const createApiKeyResponse = await createApiKey(username2, "Test Key", ["Read"], undefined, { jwt: registerResponse2.text });
        expect(createApiKeyResponse.status).toBe(200);

        const getAnnotationResponse = await getAnnotation(uploadResponse.text, addAnnotationResponse.text, { apiKey: createApiKeyResponse.body.key });
        expect(getAnnotationResponse.status).toBe(404);
        expect(getAnnotationResponse.text).toBe(BOOK_NOT_FOUND);
    });

    test("Different user with permission", async () => {
        const { response: registerResponse, username } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const uploadResponse = await uploadBook(username, "Alices_Adventures_in_Wonderland.epub", { jwt: registerResponse.text });
        expect(uploadResponse.status).toBe(200);

        const addAnnotationResponse = await addAnnotation(uploadResponse.text, ALICE_NOTE, { jwt: registerResponse.text });
        expect(addAnnotationResponse.status).toBe(200);

        const { response: registerResponse2, username: username2 } = await registerUser(undefined, undefined, process.env.ADMIN_KEY);
        expect(registerResponse2.status).toBe(200);

        const createApiKeyResponse = await createApiKey(username2, "Test Key", ["Read"], undefined, { jwt: registerResponse2.text });
        expect(createApiKeyResponse.status).toBe(200);

        const getAnnotationResponse = await getAnnotation(uploadResponse.text, addAnnotationResponse.text, { apiKey: createApiKeyResponse.body.key });
        expect(getAnnotationResponse.status).toBe(200);
    });

    test("Wrong capabilities", async () => {
        const { response: registerResponse, username } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const uploadResponse = await uploadBook(username, "Alices_Adventures_in_Wonderland.epub", { jwt: registerResponse.text });
        expect(uploadResponse.status).toBe(200);

        const addAnnotationResponse = await addAnnotation(uploadResponse.text, ALICE_NOTE, { jwt: registerResponse.text });
        expect(addAnnotationResponse.status).toBe(200);

        const createApiKeyResponse = await createApiKey(username, "Test Key", ["Create", "Update", "Delete"], undefined, { jwt: registerResponse.text });
        expect(createApiKeyResponse.status).toBe(200);

        let getAnnotationResponse = await getAnnotation(uploadResponse.text, addAnnotationResponse.text, { apiKey: createApiKeyResponse.body.key });
        expect(getAnnotationResponse.status).toBe(403);
        expect(getAnnotationResponse.text).toBe(FORBIDDEN);
    });

    test("Expired api key", async () => {
        const { response: registerResponse, username } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const uploadResponse = await uploadBook(username, "Alices_Adventures_in_Wonderland.epub", { jwt: registerResponse.text });
        expect(uploadResponse.status).toBe(200);

        const addAnnotationResponse = await addAnnotation(uploadResponse.text, ALICE_NOTE, { jwt: registerResponse.text });
        expect(addAnnotationResponse.status).toBe(200);

        const timestamp = Date.now() + 2000;
        const createApiKeyResponse = await createApiKey(username, "Test Key", ["Read"], timestamp, { jwt: registerResponse.text });
        expect(createApiKeyResponse.status).toBe(200);

        // Wait for the key to expire
        await wait(2.5);

        let getAnnotationResponse = await getAnnotation(uploadResponse.text, addAnnotationResponse.text, { apiKey: createApiKeyResponse.body.key });
        expect(getAnnotationResponse.status).toBe(401);
        expect(getAnnotationResponse.text).toBe(INVALID_API_KEY);
    });
});

describe("List annotations JWT", () => {
    test("Simple", async () => {
        const { response: registerResponse, username } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const uploadResponse = await uploadBook(username, "Alices_Adventures_in_Wonderland.epub", { jwt: registerResponse.text });
        expect(uploadResponse.status).toBe(200);

        let listAnnotationsResponse = await listAnnotations(uploadResponse.text, { jwt: registerResponse.text });
        expect(listAnnotationsResponse.status).toBe(200);
        expect(listAnnotationsResponse.body).toEqual([]);

        const addAnnotationResponse = await addAnnotation(uploadResponse.text, ALICE_NOTE, { jwt: registerResponse.text });
        expect(addAnnotationResponse.status).toBe(200);

        listAnnotationsResponse = await listAnnotations(uploadResponse.text, { jwt: registerResponse.text });
        expect(listAnnotationsResponse.status).toBe(200);
        expect(listAnnotationsResponse.body).toEqual([addAnnotationResponse.text]);
    });

    test("Non-existent book", async () => {
        const { response: registerResponse } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const listAnnotationsResponse = await listAnnotations("non-existent", { jwt: registerResponse.text });
        expect(listAnnotationsResponse.status).toBe(404);
        expect(listAnnotationsResponse.text).toBe(BOOK_NOT_FOUND);
    });

    test("Different user without permission", async () => {
        const { response: registerResponse, username } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const uploadResponse = await uploadBook(username, "Alices_Adventures_in_Wonderland.epub", { jwt: registerResponse.text });
        expect(uploadResponse.status).toBe(200);

        const { response: registerResponse2 } = await registerUser();
        expect(registerResponse2.status).toBe(200);

        const listAnnotationsResponse = await listAnnotations(uploadResponse.text, { jwt: registerResponse2.text });
        expect(listAnnotationsResponse.status).toBe(404);
        expect(listAnnotationsResponse.text).toBe(BOOK_NOT_FOUND);
    });

    test("Different user with permission", async () => {
        const { response: registerResponse, username } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const uploadResponse = await uploadBook(username, "Alices_Adventures_in_Wonderland.epub", { jwt: registerResponse.text });
        expect(uploadResponse.status).toBe(200);

        const { response: registerResponse2 } = await registerUser(undefined, undefined, process.env.ADMIN_KEY);
        expect(registerResponse2.status).toBe(200);

        const listAnnotationsResponse = await listAnnotations(uploadResponse.text, { jwt: registerResponse2.text });
        expect(listAnnotationsResponse.status).toBe(200);
    });

    test("No auth", async () => {
        const { response: registerResponse, username } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const uploadResponse = await uploadBook(username, "Alices_Adventures_in_Wonderland.epub", { jwt: registerResponse.text });
        expect(uploadResponse.status).toBe(200);

        let listAnnotationsResponse = await listAnnotations(uploadResponse.text);
        expect(listAnnotationsResponse.status).toBe(401);
        expect(listAnnotationsResponse.text).toBe(UNAUTHORIZED);
    });
});

describe("List annotations api key", () => {
    test("Simple", async () => {
        const { response: registerResponse, username } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const uploadResponse = await uploadBook(username, "Alices_Adventures_in_Wonderland.epub", { jwt: registerResponse.text });
        expect(uploadResponse.status).toBe(200);

        const createApiKeyResponse = await createApiKey(username, "Test Key", ["Read"], undefined, { jwt: registerResponse.text });
        expect(createApiKeyResponse.status).toBe(200);

        let listAnnotationsResponse = await listAnnotations(uploadResponse.text, { apiKey: createApiKeyResponse.body.key });
        expect(listAnnotationsResponse.status).toBe(200);
        expect(listAnnotationsResponse.body).toEqual([]);

        const addAnnotationResponse = await addAnnotation(uploadResponse.text, ALICE_NOTE, { jwt: registerResponse.text });
        expect(addAnnotationResponse.status).toBe(200);

        listAnnotationsResponse = await listAnnotations(uploadResponse.text, { apiKey: createApiKeyResponse.body.key });
        expect(listAnnotationsResponse.status).toBe(200);
        expect(listAnnotationsResponse.body).toEqual([addAnnotationResponse.text]);
    });

    test("Non-existent book", async () => {
        const { response: registerResponse, username } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const createApiKeyResponse = await createApiKey(username, "Test Key", ["Read"], undefined, { jwt: registerResponse.text });
        expect(createApiKeyResponse.status).toBe(200);

        const listAnnotationsResponse = await listAnnotations("non-existent", { apiKey: createApiKeyResponse.body.key });
        expect(listAnnotationsResponse.status).toBe(404);
        expect(listAnnotationsResponse.text).toBe(BOOK_NOT_FOUND);
    });

    test("Different user without permission", async () => {
        const { response: registerResponse, username } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const uploadResponse = await uploadBook(username, "Alices_Adventures_in_Wonderland.epub", { jwt: registerResponse.text });
        expect(uploadResponse.status).toBe(200);

        const { response: registerResponse2, username: username2 } = await registerUser();
        expect(registerResponse2.status).toBe(200);

        const createApiKeyResponse = await createApiKey(username2, "Test Key", ["Read"], undefined, { jwt: registerResponse2.text });
        expect(createApiKeyResponse.status).toBe(200);

        const listAnnotationsResponse = await listAnnotations(uploadResponse.text, { apiKey: createApiKeyResponse.body.key });
        expect(listAnnotationsResponse.status).toBe(404);
        expect(listAnnotationsResponse.text).toBe(BOOK_NOT_FOUND);
    });

    test("Different user with permission", async () => {
        const { response: registerResponse, username } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const uploadResponse = await uploadBook(username, "Alices_Adventures_in_Wonderland.epub", { jwt: registerResponse.text });
        expect(uploadResponse.status).toBe(200);

        const { response: registerResponse2, username: username2 } = await registerUser(undefined, undefined, process.env.ADMIN_KEY);
        expect(registerResponse2.status).toBe(200);

        const createApiKeyResponse = await createApiKey(username2, "Test Key", ["Read"], undefined, { jwt: registerResponse2.text });
        expect(createApiKeyResponse.status).toBe(200);

        const listAnnotationsResponse = await listAnnotations(uploadResponse.text, { apiKey: createApiKeyResponse.body.key });
        expect(listAnnotationsResponse.status).toBe(200);
    });

    test("Wrong capabilities", async () => {
        const { response: registerResponse, username } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const uploadResponse = await uploadBook(username, "Alices_Adventures_in_Wonderland.epub", { jwt: registerResponse.text });
        expect(uploadResponse.status).toBe(200);

        const createApiKeyResponse = await createApiKey(username, "Test Key", ["Create", "Update", "Delete"], undefined, { jwt: registerResponse.text });
        expect(createApiKeyResponse.status).toBe(200);

        let listAnnotationsResponse = await listAnnotations(uploadResponse.text, { apiKey: createApiKeyResponse.body.key });
        expect(listAnnotationsResponse.status).toBe(403);
        expect(listAnnotationsResponse.text).toBe(FORBIDDEN);
    });

    test("Expired api key", async () => {
        const { response: registerResponse, username } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const uploadResponse = await uploadBook(username, "Alices_Adventures_in_Wonderland.epub", { jwt: registerResponse.text });
        expect(uploadResponse.status).toBe(200);

        const timestamp = Date.now() + 2000;
        const createApiKeyResponse = await createApiKey(username, "Test Key", ["Read"], timestamp, { jwt: registerResponse.text });
        expect(createApiKeyResponse.status).toBe(200);

        // Wait for the key to expire
        await wait(2.5);

        let listAnnotationsResponse = await listAnnotations(uploadResponse.text, { apiKey: createApiKeyResponse.body.key });
        expect(listAnnotationsResponse.status).toBe(401);
        expect(listAnnotationsResponse.text).toBe(INVALID_API_KEY);
    });
});

describe("Delete annotation JWT", () => {
    test("Simple", async () => {
        const { response: registerResponse, username } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const uploadResponse = await uploadBook(username, "Alices_Adventures_in_Wonderland.epub", { jwt: registerResponse.text });
        expect(uploadResponse.status).toBe(200);

        const addAnnotationResponse = await addAnnotation(uploadResponse.text, ALICE_NOTE, { jwt: registerResponse.text });
        expect(addAnnotationResponse.status).toBe(200);

        let getAnnotationResponse = await getAnnotation(uploadResponse.text, addAnnotationResponse.text, { jwt: registerResponse.text });
        expect(getAnnotationResponse.status).toBe(200);

        const deleteAnnotationResponse = await deleteAnnotation(uploadResponse.text, addAnnotationResponse.text, { jwt: registerResponse.text });
        expect(deleteAnnotationResponse.status).toBe(204);

        getAnnotationResponse = await getAnnotation(uploadResponse.text, addAnnotationResponse.text, { jwt: registerResponse.text });
        expect(getAnnotationResponse.status).toBe(404);
        expect(getAnnotationResponse.text).toBe(ANNOTATION_NOT_FOUND);
    });

    test("Non-existent annotation", async () => {
        const { response: registerResponse, username } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const uploadResponse = await uploadBook(username, "Alices_Adventures_in_Wonderland.epub", { jwt: registerResponse.text });
        expect(uploadResponse.status).toBe(200);

        const deleteAnnotationResponse = await deleteAnnotation(uploadResponse.text, "non-existent", { jwt: registerResponse.text });
        expect(deleteAnnotationResponse.status).toBe(404);
        expect(deleteAnnotationResponse.text).toEqual(ANNOTATION_NOT_FOUND);
    });

    test("Non-existent book", async () => {
        const { response: registerResponse } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const deleteAnnotationResponse = await deleteAnnotation("non-existent", "non-existent", { jwt: registerResponse.text });
        expect(deleteAnnotationResponse.status).toBe(404);
        expect(deleteAnnotationResponse.text).toEqual(BOOK_NOT_FOUND);
    });

    test("Different user without permission", async () => {
        const { response: registerResponse, username } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const uploadResponse = await uploadBook(username, "Alices_Adventures_in_Wonderland.epub", { jwt: registerResponse.text });
        expect(uploadResponse.status).toBe(200);

        const addAnnotationResponse = await addAnnotation(uploadResponse.text, ALICE_NOTE, { jwt: registerResponse.text });
        expect(addAnnotationResponse.status).toBe(200);

        const { response: registerResponse2 } = await registerUser();
        expect(registerResponse2.status).toBe(200);

        const deleteAnnotationResponse = await deleteAnnotation(uploadResponse.text, addAnnotationResponse.text, { jwt: registerResponse2.text });
        expect(deleteAnnotationResponse.status).toBe(404);
        expect(deleteAnnotationResponse.text).toBe(BOOK_NOT_FOUND);
    });

    test("Different user with permission", async () => {
        const { response: registerResponse, username } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const uploadResponse = await uploadBook(username, "Alices_Adventures_in_Wonderland.epub", { jwt: registerResponse.text });
        expect(uploadResponse.status).toBe(200);

        const addAnnotationResponse = await addAnnotation(uploadResponse.text, ALICE_NOTE, { jwt: registerResponse.text });
        expect(addAnnotationResponse.status).toBe(200);

        const { response: registerResponse2 } = await registerUser(undefined, undefined, process.env.ADMIN_KEY);
        expect(registerResponse2.status).toBe(200);

        const deleteAnnotationResponse = await deleteAnnotation(uploadResponse.text, addAnnotationResponse.text, { jwt: registerResponse2.text });
        expect(deleteAnnotationResponse.status).toBe(204);
    });

    test("No auth", async () => {
        const { response: registerResponse, username } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const uploadResponse = await uploadBook(username, "Alices_Adventures_in_Wonderland.epub", { jwt: registerResponse.text });
        expect(uploadResponse.status).toBe(200);

        const addAnnotationResponse = await addAnnotation(uploadResponse.text, ALICE_NOTE, { jwt: registerResponse.text });
        expect(addAnnotationResponse.status).toBe(200);

        let deleteAnnotationResponse = await deleteAnnotation(uploadResponse.text, addAnnotationResponse.text);
        expect(deleteAnnotationResponse.status).toBe(401);
        expect(deleteAnnotationResponse.text).toBe(UNAUTHORIZED);
    });
});

describe("Delete annotation api key", () => {
    test("Simple", async () => {
        const { response: registerResponse, username } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const uploadResponse = await uploadBook(username, "Alices_Adventures_in_Wonderland.epub", { jwt: registerResponse.text });
        expect(uploadResponse.status).toBe(200);

        const addAnnotationResponse = await addAnnotation(uploadResponse.text, ALICE_NOTE, { jwt: registerResponse.text });
        expect(addAnnotationResponse.status).toBe(200);

        let expectedResponse: any = structuredClone(ALICE_NOTE);
        expectedResponse["annotation_id"] = addAnnotationResponse.text;

        const createApiKeyResponse = await createApiKey(username, "Test Key", ["Update"], undefined, { jwt: registerResponse.text });
        expect(createApiKeyResponse.status).toBe(200);

        let getAnnotationResponse = await getAnnotation(uploadResponse.text, addAnnotationResponse.text, { jwt: registerResponse.text });
        expect(getAnnotationResponse.status).toBe(200);
        expect(getAnnotationResponse.body).toEqual(expectedResponse);

        const deleteAnnotationResponse = await deleteAnnotation(uploadResponse.text, addAnnotationResponse.text, { apiKey: createApiKeyResponse.body.key });
        expect(deleteAnnotationResponse.status).toBe(204);

        getAnnotationResponse = await getAnnotation(uploadResponse.text, addAnnotationResponse.text, { jwt: registerResponse.text });
        expect(getAnnotationResponse.status).toBe(404);
        expect(getAnnotationResponse.text).toBe(ANNOTATION_NOT_FOUND);
    });

    test("Non-existent annotation", async () => {
        const { response: registerResponse, username } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const uploadResponse = await uploadBook(username, "Alices_Adventures_in_Wonderland.epub", { jwt: registerResponse.text });
        expect(uploadResponse.status).toBe(200);

        const createApiKeyResponse = await createApiKey(username, "Test Key", ["Update"], undefined, { jwt: registerResponse.text });
        expect(createApiKeyResponse.status).toBe(200);

        const deleteAnnotationResponse = await deleteAnnotation(uploadResponse.text, "non-existent", { apiKey: createApiKeyResponse.body.key });
        expect(deleteAnnotationResponse.status).toBe(404);
        expect(deleteAnnotationResponse.text).toEqual(ANNOTATION_NOT_FOUND);
    });

    test("Non-existent book", async () => {
        const { response: registerResponse, username } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const createApiKeyResponse = await createApiKey(username, "Test Key", ["Update"], undefined, { jwt: registerResponse.text });
        expect(createApiKeyResponse.status).toBe(200);

        const deleteAnnotationResponse = await deleteAnnotation("non-existent", "non-existent", { apiKey: createApiKeyResponse.body.key });
        expect(deleteAnnotationResponse.status).toBe(404);
        expect(deleteAnnotationResponse.text).toEqual(BOOK_NOT_FOUND);
    });

    test("Different user without permission", async () => {
        const { response: registerResponse, username } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const uploadResponse = await uploadBook(username, "Alices_Adventures_in_Wonderland.epub", { jwt: registerResponse.text });
        expect(uploadResponse.status).toBe(200);

        const addAnnotationResponse = await addAnnotation(uploadResponse.text, ALICE_NOTE, { jwt: registerResponse.text });
        expect(addAnnotationResponse.status).toBe(200);

        const { response: registerResponse2, username: username2 } = await registerUser();
        expect(registerResponse2.status).toBe(200);

        const createApiKeyResponse = await createApiKey(username2, "Test Key", ["Update"], undefined, { jwt: registerResponse2.text });
        expect(createApiKeyResponse.status).toBe(200);

        const deleteAnnotationResponse = await deleteAnnotation(uploadResponse.text, addAnnotationResponse.text, { apiKey: createApiKeyResponse.body.key });
        expect(deleteAnnotationResponse.status).toBe(404);
        expect(deleteAnnotationResponse.text).toBe(BOOK_NOT_FOUND);
    });

    test("Different user with permission", async () => {
        const { response: registerResponse, username } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const uploadResponse = await uploadBook(username, "Alices_Adventures_in_Wonderland.epub", { jwt: registerResponse.text });
        expect(uploadResponse.status).toBe(200);

        const addAnnotationResponse = await addAnnotation(uploadResponse.text, ALICE_NOTE, { jwt: registerResponse.text });
        expect(addAnnotationResponse.status).toBe(200);

        const { response: registerResponse2, username: username2 } = await registerUser(undefined, undefined, process.env.ADMIN_KEY);
        expect(registerResponse2.status).toBe(200);

        const createApiKeyResponse = await createApiKey(username2, "Test Key", ["Update"], undefined, { jwt: registerResponse2.text });
        expect(createApiKeyResponse.status).toBe(200);

        const deleteAnnotationResponse = await deleteAnnotation(uploadResponse.text, addAnnotationResponse.text, { apiKey: createApiKeyResponse.body.key });
        expect(deleteAnnotationResponse.status).toBe(204);
    });

    test("Wrong capabilities", async () => {
        const { response: registerResponse, username } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const uploadResponse = await uploadBook(username, "Alices_Adventures_in_Wonderland.epub", { jwt: registerResponse.text });
        expect(uploadResponse.status).toBe(200);

        const addAnnotationResponse = await addAnnotation(uploadResponse.text, ALICE_NOTE, { jwt: registerResponse.text });
        expect(addAnnotationResponse.status).toBe(200);

        const createApiKeyResponse = await createApiKey(username, "Test Key", ["Create", "Read", "Delete"], undefined, { jwt: registerResponse.text });
        expect(createApiKeyResponse.status).toBe(200);

        let deleteAnnotationResponse = await deleteAnnotation(uploadResponse.text, addAnnotationResponse.text, { apiKey: createApiKeyResponse.body.key });
        expect(deleteAnnotationResponse.status).toBe(403);
        expect(deleteAnnotationResponse.text).toBe(FORBIDDEN);
    });

    test("Expired api key", async () => {
        const { response: registerResponse, username } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const uploadResponse = await uploadBook(username, "Alices_Adventures_in_Wonderland.epub", { jwt: registerResponse.text });
        expect(uploadResponse.status).toBe(200);

        const addAnnotationResponse = await addAnnotation(uploadResponse.text, ALICE_NOTE, { jwt: registerResponse.text });
        expect(addAnnotationResponse.status).toBe(200);

        const timestamp = Date.now() + 2000;
        const createApiKeyResponse = await createApiKey(username, "Test Key", ["Update"], timestamp, { jwt: registerResponse.text });
        expect(createApiKeyResponse.status).toBe(200);

        // Wait for the key to expire
        await wait(2.5);

        let deleteAnnotationResponse = await deleteAnnotation(uploadResponse.text, addAnnotationResponse.text, { apiKey: createApiKeyResponse.body.key });
        expect(deleteAnnotationResponse.status).toBe(401);
        expect(deleteAnnotationResponse.text).toBe(INVALID_API_KEY);
    });
});

describe("Patch annotation JWT", () => {
    test("Simple", async () => {
        const { response: registerResponse, username } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const uploadResponse = await uploadBook(username, "Alices_Adventures_in_Wonderland.epub", { jwt: registerResponse.text });
        expect(uploadResponse.status).toBe(200);

        const addAnnotationResponse = await addAnnotation(uploadResponse.text, ALICE_NOTE, { jwt: registerResponse.text });
        expect(addAnnotationResponse.status).toBe(200);

        let expectedResponse: any = structuredClone(ALICE_NOTE);
        expectedResponse["annotation_id"] = addAnnotationResponse.text;

        let getAnnotationResponse = await getAnnotation(uploadResponse.text, addAnnotationResponse.text, { jwt: registerResponse.text });
        expect(getAnnotationResponse.status).toBe(200);
        expect(getAnnotationResponse.body).toEqual(expectedResponse);

        expectedResponse["note"] = "New note";

        let patchAnnotationResponse = await patchAnnotation(uploadResponse.text, addAnnotationResponse.text, "New note", { jwt: registerResponse.text });
        expect(patchAnnotationResponse.status).toBe(204);

        getAnnotationResponse = await getAnnotation(uploadResponse.text, addAnnotationResponse.text, { jwt: registerResponse.text });
        expect(getAnnotationResponse.status).toBe(200);
        expect(getAnnotationResponse.body).toEqual(expectedResponse);

        delete expectedResponse.note;

        patchAnnotationResponse = await patchAnnotation(uploadResponse.text, addAnnotationResponse.text, "", { jwt: registerResponse.text });
        expect(patchAnnotationResponse.status).toBe(204);

        getAnnotationResponse = await getAnnotation(uploadResponse.text, addAnnotationResponse.text, { jwt: registerResponse.text });
        expect(getAnnotationResponse.status).toBe(200);
        expect(getAnnotationResponse.body).toEqual(expectedResponse);
    });

    test("Non-existent annotation", async () => {
        const { response: registerResponse, username } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const uploadResponse = await uploadBook(username, "Alices_Adventures_in_Wonderland.epub", { jwt: registerResponse.text });
        expect(uploadResponse.status).toBe(200);

        const patchAnnotationResponse = await patchAnnotation(uploadResponse.text, "non-existent", "note", { jwt: registerResponse.text });
        expect(patchAnnotationResponse.status).toBe(404);
        expect(patchAnnotationResponse.text).toEqual(ANNOTATION_NOT_FOUND);
    });

    test("Non-existent book", async () => {
        const { response: registerResponse } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const patchAnnotationResponse = await patchAnnotation("non-existent", "non-existent", "note", { jwt: registerResponse.text });
        expect(patchAnnotationResponse.status).toBe(404);
        expect(patchAnnotationResponse.text).toEqual(BOOK_NOT_FOUND);
    });

    test("Different user without permission", async () => {
        const { response: registerResponse, username } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const uploadResponse = await uploadBook(username, "Alices_Adventures_in_Wonderland.epub", { jwt: registerResponse.text });
        expect(uploadResponse.status).toBe(200);

        const addAnnotationResponse = await addAnnotation(uploadResponse.text, ALICE_NOTE, { jwt: registerResponse.text });
        expect(addAnnotationResponse.status).toBe(200);

        const { response: registerResponse2 } = await registerUser();
        expect(registerResponse2.status).toBe(200);

        const patchAnnotationResponse = await patchAnnotation(uploadResponse.text, addAnnotationResponse.text, "note", { jwt: registerResponse2.text });
        expect(patchAnnotationResponse.status).toBe(404);
        expect(patchAnnotationResponse.text).toBe(BOOK_NOT_FOUND);
    });

    test("Different user with permission", async () => {
        const { response: registerResponse, username } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const uploadResponse = await uploadBook(username, "Alices_Adventures_in_Wonderland.epub", { jwt: registerResponse.text });
        expect(uploadResponse.status).toBe(200);

        const addAnnotationResponse = await addAnnotation(uploadResponse.text, ALICE_NOTE, { jwt: registerResponse.text });
        expect(addAnnotationResponse.status).toBe(200);

        const { response: registerResponse2 } = await registerUser(undefined, undefined, process.env.ADMIN_KEY);
        expect(registerResponse2.status).toBe(200);

        const patchAnnotationResponse = await patchAnnotation(uploadResponse.text, addAnnotationResponse.text, "note", { jwt: registerResponse2.text });
        expect(patchAnnotationResponse.status).toBe(204);
    });

    test("No auth", async () => {
        const { response: registerResponse, username } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const uploadResponse = await uploadBook(username, "Alices_Adventures_in_Wonderland.epub", { jwt: registerResponse.text });
        expect(uploadResponse.status).toBe(200);

        const addAnnotationResponse = await addAnnotation(uploadResponse.text, ALICE_NOTE, { jwt: registerResponse.text });
        expect(addAnnotationResponse.status).toBe(200);

        let patchAnnotationResponse = await patchAnnotation(uploadResponse.text, addAnnotationResponse.text, "note");
        expect(patchAnnotationResponse.status).toBe(401);
        expect(patchAnnotationResponse.text).toBe(UNAUTHORIZED);
    });
});

describe("Delete annotation api key", () => {
    test("Simple", async () => {
        const { response: registerResponse, username } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const uploadResponse = await uploadBook(username, "Alices_Adventures_in_Wonderland.epub", { jwt: registerResponse.text });
        expect(uploadResponse.status).toBe(200);

        const addAnnotationResponse = await addAnnotation(uploadResponse.text, ALICE_NOTE, { jwt: registerResponse.text });
        expect(addAnnotationResponse.status).toBe(200);

        let expectedResponse: any = structuredClone(ALICE_NOTE);
        expectedResponse["annotation_id"] = addAnnotationResponse.text;

        let getAnnotationResponse = await getAnnotation(uploadResponse.text, addAnnotationResponse.text, { jwt: registerResponse.text });
        expect(getAnnotationResponse.status).toBe(200);
        expect(getAnnotationResponse.body).toEqual(expectedResponse);

        const createApiKeyResponse = await createApiKey(username, "Test Key", ["Update"], undefined, { jwt: registerResponse.text });
        expect(createApiKeyResponse.status).toBe(200);

        expectedResponse["note"] = "New note";

        let patchAnnotationResponse = await patchAnnotation(uploadResponse.text, addAnnotationResponse.text, "New note", { apiKey: createApiKeyResponse.body.key });
        expect(patchAnnotationResponse.status).toBe(204);

        getAnnotationResponse = await getAnnotation(uploadResponse.text, addAnnotationResponse.text, { jwt: registerResponse.text });
        expect(getAnnotationResponse.status).toBe(200);
        expect(getAnnotationResponse.body).toEqual(expectedResponse);

        delete expectedResponse.note;

        patchAnnotationResponse = await patchAnnotation(uploadResponse.text, addAnnotationResponse.text, "", { apiKey: createApiKeyResponse.body.key });
        expect(patchAnnotationResponse.status).toBe(204);

        getAnnotationResponse = await getAnnotation(uploadResponse.text, addAnnotationResponse.text, { jwt: registerResponse.text });
        expect(getAnnotationResponse.status).toBe(200);
        expect(getAnnotationResponse.body).toEqual(expectedResponse);
    });

    test("Non-existent annotation", async () => {
        const { response: registerResponse, username } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const uploadResponse = await uploadBook(username, "Alices_Adventures_in_Wonderland.epub", { jwt: registerResponse.text });
        expect(uploadResponse.status).toBe(200);

        const createApiKeyResponse = await createApiKey(username, "Test Key", ["Update"], undefined, { jwt: registerResponse.text });
        expect(createApiKeyResponse.status).toBe(200);

        const patchAnnotationResponse = await patchAnnotation(uploadResponse.text, "non-existent", "note", { apiKey: createApiKeyResponse.body.key });
        expect(patchAnnotationResponse.status).toBe(404);
        expect(patchAnnotationResponse.text).toEqual(ANNOTATION_NOT_FOUND);
    });

    test("Non-existent book", async () => {
        const { response: registerResponse, username } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const createApiKeyResponse = await createApiKey(username, "Test Key", ["Update"], undefined, { jwt: registerResponse.text });
        expect(createApiKeyResponse.status).toBe(200);

        const patchAnnotationResponse = await patchAnnotation("non-existent", "non-existent", "note", { apiKey: createApiKeyResponse.body.key });
        expect(patchAnnotationResponse.status).toBe(404);
        expect(patchAnnotationResponse.text).toEqual(BOOK_NOT_FOUND);
    });

    test("Different user without permission", async () => {
        const { response: registerResponse, username } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const uploadResponse = await uploadBook(username, "Alices_Adventures_in_Wonderland.epub", { jwt: registerResponse.text });
        expect(uploadResponse.status).toBe(200);

        const addAnnotationResponse = await addAnnotation(uploadResponse.text, ALICE_NOTE, { jwt: registerResponse.text });
        expect(addAnnotationResponse.status).toBe(200);

        const { response: registerResponse2, username: username2 } = await registerUser();
        expect(registerResponse2.status).toBe(200);

        const createApiKeyResponse = await createApiKey(username2, "Test Key", ["Update"], undefined, { jwt: registerResponse2.text });
        expect(createApiKeyResponse.status).toBe(200);

        const patchAnnotationResponse = await patchAnnotation(uploadResponse.text, addAnnotationResponse.text, "note", { apiKey: createApiKeyResponse.body.key });
        expect(patchAnnotationResponse.status).toBe(404);
        expect(patchAnnotationResponse.text).toBe(BOOK_NOT_FOUND);
    });

    test("Different user with permission", async () => {
        const { response: registerResponse, username } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const uploadResponse = await uploadBook(username, "Alices_Adventures_in_Wonderland.epub", { jwt: registerResponse.text });
        expect(uploadResponse.status).toBe(200);

        const addAnnotationResponse = await addAnnotation(uploadResponse.text, ALICE_NOTE, { jwt: registerResponse.text });
        expect(addAnnotationResponse.status).toBe(200);

        const { response: registerResponse2, username: username2 } = await registerUser(undefined, undefined, process.env.ADMIN_KEY);
        expect(registerResponse2.status).toBe(200);

        const createApiKeyResponse = await createApiKey(username2, "Test Key", ["Update"], undefined, { jwt: registerResponse2.text });
        expect(createApiKeyResponse.status).toBe(200);

        const patchAnnotationResponse = await patchAnnotation(uploadResponse.text, addAnnotationResponse.text, "note", { apiKey: createApiKeyResponse.body.key });
        expect(patchAnnotationResponse.status).toBe(204);
    });

    test("Wrong capabilities", async () => {
        const { response: registerResponse, username } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const uploadResponse = await uploadBook(username, "Alices_Adventures_in_Wonderland.epub", { jwt: registerResponse.text });
        expect(uploadResponse.status).toBe(200);

        const addAnnotationResponse = await addAnnotation(uploadResponse.text, ALICE_NOTE, { jwt: registerResponse.text });
        expect(addAnnotationResponse.status).toBe(200);

        const createApiKeyResponse = await createApiKey(username, "Test Key", ["Create", "Read", "Delete"], undefined, { jwt: registerResponse.text });
        expect(createApiKeyResponse.status).toBe(200);

        let patchAnnotationResponse = await patchAnnotation(uploadResponse.text, addAnnotationResponse.text, "note", { apiKey: createApiKeyResponse.body.key });
        expect(patchAnnotationResponse.status).toBe(403);
        expect(patchAnnotationResponse.text).toBe(FORBIDDEN);
    });

    test("Expired api key", async () => {
        const { response: registerResponse, username } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const uploadResponse = await uploadBook(username, "Alices_Adventures_in_Wonderland.epub", { jwt: registerResponse.text });
        expect(uploadResponse.status).toBe(200);

        const addAnnotationResponse = await addAnnotation(uploadResponse.text, ALICE_NOTE, { jwt: registerResponse.text });
        expect(addAnnotationResponse.status).toBe(200);

        const timestamp = Date.now() + 2000;
        const createApiKeyResponse = await createApiKey(username, "Test Key", ["Update"], timestamp, { jwt: registerResponse.text });
        expect(createApiKeyResponse.status).toBe(200);

        // Wait for the key to expire
        await wait(2.5);

        let patchAnnotationResponse = await patchAnnotation(uploadResponse.text, addAnnotationResponse.text, "note", { apiKey: createApiKeyResponse.body.key });
        expect(patchAnnotationResponse.status).toBe(401);
        expect(patchAnnotationResponse.text).toBe(INVALID_API_KEY);
    });
});