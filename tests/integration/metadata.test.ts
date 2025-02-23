import { FORBIDDEN, INVALID_API_KEY, UNAUTHORIZED, wait } from "../utils/common";
import { registerUser, createApiKey } from "../utils/users"
import { BOOK_NOT_FOUND, uploadBook } from "../utils/books"
import { addMetadata, METADATA_CONFLICT, METADATA_NOT_FOUND, deleteMetadata, getMetadata, INVALID_METADATA, updateMetadata, patchMetadata, ALICE_METADATA, EXAMPLE_METADATA } from "../utils/metadata"

describe("Get metadata JWT", () => {
    test.concurrent("Get metadata", async () => {
        const { response: registerResponse, username } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const uploadResponse = await uploadBook(username, "Alices_Adventures_in_Wonderland.epub", { jwt: registerResponse.text });
        expect(uploadResponse.status).toBe(200);

        // Wait for metadata to be extracted
        await wait(0.5);

        const downloadResponse = await getMetadata(uploadResponse.text, { jwt: registerResponse.text });
        expect(downloadResponse.status).toBe(200);

        expect(downloadResponse.body).toEqual(ALICE_METADATA);
    });

    test.concurrent("Get non-existent metadata", async () => {
        const { response: registerResponse, username } = await registerUser();
        expect(registerResponse.status).toBe(200);

        // This epub does not contain metadata
        const uploadResponse = await uploadBook(username, "The_Great_Gatsby.epub", { jwt: registerResponse.text });
        expect(uploadResponse.status).toBe(200);

        // Give chance for any metadata to be extracted
        await wait(0.5);

        const downloadResponse = await getMetadata(uploadResponse.text, { jwt: registerResponse.text });
        expect(downloadResponse.status).toBe(404);
        expect(downloadResponse.text).toBe(METADATA_NOT_FOUND);
    });

    test.concurrent("Get metadata from non-existent book", async () => {
        const { response: registerResponse } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const downloadResponse = await getMetadata("non-existent", { jwt: registerResponse.text });
        expect(downloadResponse.status).toBe(404);
        expect(downloadResponse.text).toBe(BOOK_NOT_FOUND);
    });

    test.concurrent("Get metadata | Different user | !admin", async () => {
        const { response: registerResponse, username } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const uploadResponse = await uploadBook(username, "Alices_Adventures_in_Wonderland.epub", { jwt: registerResponse.text });
        expect(uploadResponse.status).toBe(200);

        // Wait for metadata to be extracted
        await wait(0.5);

        const { response: registerResponse2 } = await registerUser();
        expect(registerResponse2.status).toBe(200);

        const downloadResponse = await getMetadata(uploadResponse.text, { jwt: registerResponse2.text });
        expect(downloadResponse.status).toBe(404);
        expect(downloadResponse.text).toBe(BOOK_NOT_FOUND);
    });

    test.concurrent("Get metadata | Different user | admin", async () => {
        const { response: registerResponse, username } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const uploadResponse = await uploadBook(username, "Alices_Adventures_in_Wonderland.epub", { jwt: registerResponse.text });
        expect(uploadResponse.status).toBe(200);

        // Wait for metadata to be extracted
        await wait(0.5);

        const { response: registerResponse2 } = await registerUser(undefined, undefined, process.env.ADMIN_KEY);
        expect(registerResponse2.status).toBe(200);

        const downloadResponse = await getMetadata(uploadResponse.text, { jwt: registerResponse2.text });
        expect(downloadResponse.status).toBe(200);
    });

    test.concurrent("Get metadata no auth", async () => {
        const { response: registerResponse, username } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const uploadResponse = await uploadBook(username, "Alices_Adventures_in_Wonderland.epub", { jwt: registerResponse.text });
        expect(uploadResponse.status).toBe(200);

        // Wait for metadata to be extracted
        await wait(0.5);

        const downloadResponse = await getMetadata(uploadResponse.text);
        expect(downloadResponse.status).toBe(401);
        expect(downloadResponse.text).toBe(UNAUTHORIZED);
    });
});

describe("Get metadata api key", () => {
    test.concurrent("Get metadata", async () => {
        const { response: registerResponse, username } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const uploadResponse = await uploadBook(username, "Alices_Adventures_in_Wonderland.epub", { jwt: registerResponse.text });
        expect(uploadResponse.status).toBe(200);

        // Wait for metadata to be extracted
        await wait(0.5);

        const createApiKeyResponse = await createApiKey(username, "Test Key", ["Read"], undefined, { jwt: registerResponse.text });
        expect(createApiKeyResponse.status).toBe(200);

        const downloadResponse = await getMetadata(uploadResponse.text, { apiKey: createApiKeyResponse.body.key });
        expect(downloadResponse.status).toBe(200);

        expect(downloadResponse.body).toEqual(ALICE_METADATA);
    });

    test.concurrent("Get non-existent metadata", async () => {
        const { response: registerResponse, username } = await registerUser();
        expect(registerResponse.status).toBe(200);

        // This epub does not contain a metadata
        const uploadResponse = await uploadBook(username, "The_Great_Gatsby.epub", { jwt: registerResponse.text });
        expect(uploadResponse.status).toBe(200);

        // Give chance for any metadata to be extracted
        await wait(0.5);

        const createApiKeyResponse = await createApiKey(username, "Test Key", ["Read"], undefined, { jwt: registerResponse.text });
        expect(createApiKeyResponse.status).toBe(200);

        const downloadResponse = await getMetadata(uploadResponse.text, { apiKey: createApiKeyResponse.body.key });
        expect(downloadResponse.status).toBe(404);
        expect(downloadResponse.text).toBe(METADATA_NOT_FOUND);
    });

    test.concurrent("Get metadata from non-existent book", async () => {
        const { response: registerResponse, username } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const createApiKeyResponse = await createApiKey(username, "Test Key", ["Read"], undefined, { jwt: registerResponse.text });
        expect(createApiKeyResponse.status).toBe(200);

        const downloadResponse = await getMetadata("non-existent", { apiKey: createApiKeyResponse.body.key });
        expect(downloadResponse.status).toBe(404);
        expect(downloadResponse.text).toBe(BOOK_NOT_FOUND);
    });

    test.concurrent("Get metadata | Different user | !admin", async () => {
        const { response: registerResponse, username } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const uploadResponse = await uploadBook(username, "Alices_Adventures_in_Wonderland.epub", { jwt: registerResponse.text });
        expect(uploadResponse.status).toBe(200);

        // Wait for metadata to be extracted
        await wait(0.5);

        const { response: registerResponse2, username: username2 } = await registerUser();
        expect(registerResponse2.status).toBe(200);

        const createApiKeyResponse = await createApiKey(username2, "Test Key", ["Read"], undefined, { jwt: registerResponse2.text });
        expect(createApiKeyResponse.status).toBe(200);

        const downloadResponse = await getMetadata(uploadResponse.text, { apiKey: createApiKeyResponse.body.key });
        expect(downloadResponse.status).toBe(404);
        expect(downloadResponse.text).toBe(BOOK_NOT_FOUND);
    });

    test.concurrent("Get metadata | Different user | admin", async () => {
        const { response: registerResponse, username } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const uploadResponse = await uploadBook(username, "Alices_Adventures_in_Wonderland.epub", { jwt: registerResponse.text });
        expect(uploadResponse.status).toBe(200);

        // Wait for metadata to be extracted
        await wait(0.5);

        const { response: registerResponse2, username: username2 } = await registerUser(undefined, undefined, process.env.ADMIN_KEY);
        expect(registerResponse2.status).toBe(200);

        const createApiKeyResponse = await createApiKey(username2, "Test Key", ["Read"], undefined, { jwt: registerResponse2.text });
        expect(createApiKeyResponse.status).toBe(200);

        const downloadResponse = await getMetadata(uploadResponse.text, { apiKey: createApiKeyResponse.body.key });
        expect(downloadResponse.status).toBe(200);
    });

    test.concurrent("Get metadata wrong capabilities", async () => {
        const { response: registerResponse, username } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const uploadResponse = await uploadBook(username, "Alices_Adventures_in_Wonderland.epub", { jwt: registerResponse.text });
        expect(uploadResponse.status).toBe(200);

        // Wait for metadata to be extracted
        await wait(0.5);

        const createApiKeyResponse = await createApiKey(username, "Test Key", ["Create", "Update", "Delete"], undefined, { jwt: registerResponse.text });
        expect(createApiKeyResponse.status).toBe(200);

        const downloadResponse = await getMetadata(uploadResponse.text, { apiKey: createApiKeyResponse.body.key });
        expect(downloadResponse.status).toBe(403);
        expect(downloadResponse.text).toBe(FORBIDDEN);
    });

    test.concurrent("Get metadata expired api key", async () => {
        const { response: registerResponse, username } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const uploadResponse = await uploadBook(username, "Alices_Adventures_in_Wonderland.epub", { jwt: registerResponse.text });
        expect(uploadResponse.status).toBe(200);

        // Wait for metadata to be extracted
        await wait(0.5);

        const timestamp = new Date(Date.now() + 2000).toISOString();
        const createApiKeyResponse = await createApiKey(username, "Test Key", ["Read"], timestamp, { jwt: registerResponse.text });
        expect(createApiKeyResponse.status).toBe(200);

        // Wait for the key to expire
        await wait(2.5);

        const downloadResponse = await getMetadata(uploadResponse.text, { apiKey: createApiKeyResponse.body.key });
        expect(downloadResponse.status).toBe(401);
        expect(downloadResponse.text).toBe(INVALID_API_KEY);
    });
});

describe("Add metadata JWT", () => {
    test("Add metadata", async () => {
        const { response: registerResponse, username } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const uploadResponse = await uploadBook(username, "The_Great_Gatsby.epub", { jwt: registerResponse.text });
        expect(uploadResponse.status).toBe(200);

        // Give chance for any metadata to be extracted
        await wait(0.5);

        const addResponse = await addMetadata(uploadResponse.text, EXAMPLE_METADATA, { jwt: registerResponse.text });
        expect(addResponse.status).toBe(200);

        const downloadResponse = await getMetadata(uploadResponse.text, { jwt: registerResponse.text });
        expect(downloadResponse.status).toBe(200);

        expect(downloadResponse.body).toEqual(EXAMPLE_METADATA);
    });

    test("Add invalid metadata", async () => {
        const { response: registerResponse, username } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const uploadResponse = await uploadBook(username, "The_Great_Gatsby.epub", { jwt: registerResponse.text });
        expect(uploadResponse.status).toBe(200);

        // Give chance for any metadata to be extracted
        await wait(0.5);

        const addResponse = await addMetadata(uploadResponse.text, {}, { jwt: registerResponse.text });
        expect(addResponse.status).toBe(400);
        expect(addResponse.text).toBe(INVALID_METADATA);
    });

    test("Add metadata conflict", async () => {
        const { response: registerResponse, username } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const uploadResponse = await uploadBook(username, "Alices_Adventures_in_Wonderland.epub", { jwt: registerResponse.text });
        expect(uploadResponse.status).toBe(200);

        // Wait for metadata to be extracted
        await wait(0.5);

        const addResponse = await addMetadata(uploadResponse.text, EXAMPLE_METADATA, { jwt: registerResponse.text });
        expect(addResponse.status).toBe(409);
        expect(addResponse.text).toBe(METADATA_CONFLICT);
    });

    test("Add metadata non-existent book", async () => {
        const { response: registerResponse } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const addResponse = await addMetadata("non-existent", EXAMPLE_METADATA, { jwt: registerResponse.text });
        expect(addResponse.status).toBe(404);
        expect(addResponse.text).toBe(BOOK_NOT_FOUND);
    });

    test("Add metadata | different user | !admin", async () => {
        const { response: registerResponse, username } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const uploadResponse = await uploadBook(username, "The_Great_Gatsby.epub", { jwt: registerResponse.text });
        expect(uploadResponse.status).toBe(200);

        // Give chance for any metadata to be extracted
        await wait(0.5);

        const { response: registerResponse2, } = await registerUser();
        expect(registerResponse2.status).toBe(200);

        const addResponse = await addMetadata(uploadResponse.text, EXAMPLE_METADATA, { jwt: registerResponse2.text });
        expect(addResponse.status).toBe(404);
        expect(addResponse.text).toBe(BOOK_NOT_FOUND);
    });

    test("Add metadata | different user | admin", async () => {
        const { response: registerResponse, username } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const uploadResponse = await uploadBook(username, "The_Great_Gatsby.epub", { jwt: registerResponse.text });
        expect(uploadResponse.status).toBe(200);

        // Give chance for any metadata to be extracted
        await wait(0.5);

        const { response: registerResponse2, } = await registerUser(undefined, undefined, process.env.ADMIN_KEY);
        expect(registerResponse2.status).toBe(200);

        const addResponse = await addMetadata(uploadResponse.text, EXAMPLE_METADATA, { jwt: registerResponse2.text });
        expect(addResponse.status).toBe(200);
    });

    test("Add metadata no auth", async () => {
        const { response: registerResponse, username } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const uploadResponse = await uploadBook(username, "The_Great_Gatsby.epub", { jwt: registerResponse.text });
        expect(uploadResponse.status).toBe(200);

        // Give chance for any metadata to be extracted
        await wait(0.5);

        const addResponse = await addMetadata(uploadResponse.text, EXAMPLE_METADATA);
        expect(addResponse.status).toBe(401);
        expect(addResponse.text).toBe(UNAUTHORIZED);
    });
});

describe("Add metadata api key", () => {
    test("Add metadata", async () => {
        const { response: registerResponse, username } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const uploadResponse = await uploadBook(username, "The_Great_Gatsby.epub", { jwt: registerResponse.text });
        expect(uploadResponse.status).toBe(200);

        // Give chance for any metadata to be extracted
        await wait(0.5);

        const createApiKeyResponse = await createApiKey(username, "Test Key", ["Update"], undefined, { jwt: registerResponse.text });
        expect(createApiKeyResponse.status).toBe(200);

        const addResponse = await addMetadata(uploadResponse.text, EXAMPLE_METADATA, { apiKey: createApiKeyResponse.body.key });
        expect(addResponse.status).toBe(200);

        const downloadResponse = await getMetadata(uploadResponse.text, { jwt: registerResponse.text });
        expect(downloadResponse.status).toBe(200);

        expect(downloadResponse.body).toEqual(EXAMPLE_METADATA);
    });

    test("Add invalid metadata", async () => {
        const { response: registerResponse, username } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const uploadResponse = await uploadBook(username, "The_Great_Gatsby.epub", { jwt: registerResponse.text });
        expect(uploadResponse.status).toBe(200);

        // Give chance for any metadata to be extracted
        await wait(0.5);

        const createApiKeyResponse = await createApiKey(username, "Test Key", ["Update"], undefined, { jwt: registerResponse.text });
        expect(createApiKeyResponse.status).toBe(200);

        const addResponse = await addMetadata(uploadResponse.text, {}, { apiKey: createApiKeyResponse.body.key });
        expect(addResponse.status).toBe(400);
        expect(addResponse.text).toBe(INVALID_METADATA);
    });

    test("Add metadata conflict", async () => {
        const { response: registerResponse, username } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const uploadResponse = await uploadBook(username, "Alices_Adventures_in_Wonderland.epub", { jwt: registerResponse.text });
        expect(uploadResponse.status).toBe(200);

        // Wait for metadata to be extracted
        await wait(0.5);

        const createApiKeyResponse = await createApiKey(username, "Test Key", ["Update"], undefined, { jwt: registerResponse.text });
        expect(createApiKeyResponse.status).toBe(200);

        const addResponse = await addMetadata(uploadResponse.text, EXAMPLE_METADATA, { apiKey: createApiKeyResponse.body.key });
        expect(addResponse.status).toBe(409);
        expect(addResponse.text).toBe(METADATA_CONFLICT);
    });

    test("Add metadata non-existent book", async () => {
        const { response: registerResponse, username } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const createApiKeyResponse = await createApiKey(username, "Test Key", ["Update"], undefined, { jwt: registerResponse.text });
        expect(createApiKeyResponse.status).toBe(200);

        const addResponse = await addMetadata("non-existent", EXAMPLE_METADATA, { apiKey: createApiKeyResponse.body.key });
        expect(addResponse.status).toBe(404);
        expect(addResponse.text).toBe(BOOK_NOT_FOUND);
    });

    test("Add metadata | different user | !admin", async () => {
        const { response: registerResponse, username } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const uploadResponse = await uploadBook(username, "The_Great_Gatsby.epub", { jwt: registerResponse.text });
        expect(uploadResponse.status).toBe(200);

        // Give chance for any metadata to be extracted
        await wait(0.5);

        const { response: registerResponse2, username: username2 } = await registerUser();
        expect(registerResponse2.status).toBe(200);

        const createApiKeyResponse = await createApiKey(username2, "Test Key", ["Update"], undefined, { jwt: registerResponse2.text });
        expect(createApiKeyResponse.status).toBe(200);

        const addResponse = await addMetadata(uploadResponse.text, EXAMPLE_METADATA, { apiKey: createApiKeyResponse.body.key });
        expect(addResponse.status).toBe(404);
        expect(addResponse.text).toBe(BOOK_NOT_FOUND);
    });

    test("Add metadata | different user | admin", async () => {
        const { response: registerResponse, username } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const uploadResponse = await uploadBook(username, "The_Great_Gatsby.epub", { jwt: registerResponse.text });
        expect(uploadResponse.status).toBe(200);

        // Give chance for any metadata to be extracted
        await wait(0.5);

        const { response: registerResponse2, username: username2 } = await registerUser(undefined, undefined, process.env.ADMIN_KEY);
        expect(registerResponse2.status).toBe(200);

        const createApiKeyResponse = await createApiKey(username2, "Test Key", ["Update"], undefined, { jwt: registerResponse2.text });
        expect(createApiKeyResponse.status).toBe(200);

        const addResponse = await addMetadata(uploadResponse.text, EXAMPLE_METADATA, { apiKey: createApiKeyResponse.body.key });
        expect(addResponse.status).toBe(200);
    });

    test("Add metadata wrong capabilities", async () => {
        const { response: registerResponse, username } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const uploadResponse = await uploadBook(username, "The_Great_Gatsby.epub", { jwt: registerResponse.text });
        expect(uploadResponse.status).toBe(200);

        // Give chance for any metadata to be extracted
        await wait(0.5);

        const createApiKeyResponse = await createApiKey(username, "Test Key", ["Create", "Read", "Delete"], undefined, { jwt: registerResponse.text });
        expect(createApiKeyResponse.status).toBe(200);

        const addResponse = await addMetadata(uploadResponse.text, EXAMPLE_METADATA, { apiKey: createApiKeyResponse.body.key });
        expect(addResponse.status).toBe(403);
        expect(addResponse.text).toBe(FORBIDDEN);
    });

    test("Add metadata expired key", async () => {
        const { response: registerResponse, username } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const uploadResponse = await uploadBook(username, "The_Great_Gatsby.epub", { jwt: registerResponse.text });
        expect(uploadResponse.status).toBe(200);

        // Give chance for any metadata to be extracted
        await wait(0.5);

        const timestamp = new Date(Date.now() + 2000).toISOString();
        const createApiKeyResponse = await createApiKey(username, "Test Key", ["Update"], timestamp, { jwt: registerResponse.text });
        expect(createApiKeyResponse.status).toBe(200);

        // Wait for the key to expire
        await wait(2.5);

        const addResponse = await addMetadata(uploadResponse.text, EXAMPLE_METADATA, { apiKey: createApiKeyResponse.body.key });
        expect(addResponse.status).toBe(401);
        expect(addResponse.text).toBe(INVALID_API_KEY);
    });
});

describe("Delete metadata JWT", () => {
    test.concurrent("Delete metadata", async () => {
        const { response: registerResponse, username } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const uploadResponse = await uploadBook(username, "Alices_Adventures_in_Wonderland.epub", { jwt: registerResponse.text });
        expect(uploadResponse.status).toBe(200);

        // Wait for metadata to be extracted
        await wait(0.5);

        const deleteResponse = await deleteMetadata(uploadResponse.text, { jwt: registerResponse.text });
        expect(deleteResponse.status).toBe(200);

        const downloadResponse = await getMetadata(uploadResponse.text, { jwt: registerResponse.text });
        expect(downloadResponse.status).toBe(404);
        expect(downloadResponse.text).toBe(METADATA_NOT_FOUND);
    });

    test.concurrent("Delete non-existent metadata", async () => {
        const { response: registerResponse, username } = await registerUser();
        expect(registerResponse.status).toBe(200);

        // This epub does not contain a metadata
        const uploadResponse = await uploadBook(username, "The_Great_Gatsby.epub", { jwt: registerResponse.text });
        expect(uploadResponse.status).toBe(200);

        // Give chance for any metadata to be extracted
        await wait(0.5);

        const deleteResponse = await deleteMetadata(uploadResponse.text, { jwt: registerResponse.text });
        expect(deleteResponse.status).toBe(404);
        expect(deleteResponse.text).toBe(METADATA_NOT_FOUND);
    });

    test.concurrent("Delete metadata from non-existent book", async () => {
        const { response: registerResponse } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const deleteResponse = await deleteMetadata("non-existent", { jwt: registerResponse.text });
        expect(deleteResponse.status).toBe(404);
        expect(deleteResponse.text).toBe(BOOK_NOT_FOUND);
    });

    test.concurrent("Delete metadata | Different user | !admin", async () => {
        const { response: registerResponse, username } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const uploadResponse = await uploadBook(username, "Alices_Adventures_in_Wonderland.epub", { jwt: registerResponse.text });
        expect(uploadResponse.status).toBe(200);

        // Wait for metadata to be extracted
        await wait(0.5);

        const { response: registerResponse2 } = await registerUser();
        expect(registerResponse2.status).toBe(200);

        const deleteResponse = await deleteMetadata(uploadResponse.text, { jwt: registerResponse2.text });
        expect(deleteResponse.status).toBe(404);
        expect(deleteResponse.text).toBe(BOOK_NOT_FOUND);
    });

    test.concurrent("Delete metadata | Different user | admin", async () => {
        const { response: registerResponse, username } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const uploadResponse = await uploadBook(username, "Alices_Adventures_in_Wonderland.epub", { jwt: registerResponse.text });
        expect(uploadResponse.status).toBe(200);

        // Wait for metadata to be extracted
        await wait(0.5);

        const { response: registerResponse2 } = await registerUser(undefined, undefined, process.env.ADMIN_KEY);
        expect(registerResponse2.status).toBe(200);

        const deleteResponse = await deleteMetadata(uploadResponse.text, { jwt: registerResponse2.text });
        expect(deleteResponse.status).toBe(200);
    });

    test.concurrent("Delete metadata no auth", async () => {
        const { response: registerResponse, username } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const uploadResponse = await uploadBook(username, "Alices_Adventures_in_Wonderland.epub", { jwt: registerResponse.text });
        expect(uploadResponse.status).toBe(200);

        // Wait for metadata to be extracted
        await wait(0.5);

        const deleteResponse = await deleteMetadata(uploadResponse.text);
        expect(deleteResponse.status).toBe(401);
        expect(deleteResponse.text).toBe(UNAUTHORIZED);
    });
});

describe("Delete metadata api key", () => {
    test.concurrent("Delete metadata", async () => {
        const { response: registerResponse, username } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const uploadResponse = await uploadBook(username, "Alices_Adventures_in_Wonderland.epub", { jwt: registerResponse.text });
        expect(uploadResponse.status).toBe(200);

        // Wait for metadata to be extracted
        await wait(0.5);

        const createApiKeyResponse = await createApiKey(username, "Test Key", ["Delete"], undefined, { jwt: registerResponse.text });
        expect(createApiKeyResponse.status).toBe(200);

        const deleteResponse = await deleteMetadata(uploadResponse.text, { apiKey: createApiKeyResponse.body.key });
        expect(deleteResponse.status).toBe(200);

        const downloadResponse = await getMetadata(uploadResponse.text, { jwt: registerResponse.text });
        expect(downloadResponse.status).toBe(404);
        expect(downloadResponse.text).toBe(METADATA_NOT_FOUND);
    });

    test.concurrent("Delete non-existent metadata", async () => {
        const { response: registerResponse, username } = await registerUser();
        expect(registerResponse.status).toBe(200);

        // This epub does not contain a metadata
        const uploadResponse = await uploadBook(username, "The_Great_Gatsby.epub", { jwt: registerResponse.text });
        expect(uploadResponse.status).toBe(200);

        // Give chance for any metadata to be extracted
        await wait(0.5);

        const createApiKeyResponse = await createApiKey(username, "Test Key", ["Delete"], undefined, { jwt: registerResponse.text });
        expect(createApiKeyResponse.status).toBe(200);

        const deleteResponse = await deleteMetadata(uploadResponse.text, { apiKey: createApiKeyResponse.body.key });
        expect(deleteResponse.status).toBe(404);
        expect(deleteResponse.text).toBe(METADATA_NOT_FOUND);
    });

    test.concurrent("Delete metadata from non-existent book", async () => {
        const { response: registerResponse, username } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const createApiKeyResponse = await createApiKey(username, "Test Key", ["Delete"], undefined, { jwt: registerResponse.text });
        expect(createApiKeyResponse.status).toBe(200);

        const deleteResponse = await deleteMetadata("non-existent", { apiKey: createApiKeyResponse.body.key });
        expect(deleteResponse.status).toBe(404);
        expect(deleteResponse.text).toBe(BOOK_NOT_FOUND);
    });

    test.concurrent("Delete metadata | Different user | !admin", async () => {
        const { response: registerResponse, username } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const uploadResponse = await uploadBook(username, "Alices_Adventures_in_Wonderland.epub", { jwt: registerResponse.text });
        expect(uploadResponse.status).toBe(200);

        // Wait for metadata to be extracted
        await wait(0.5);

        const { response: registerResponse2, username: username2 } = await registerUser();
        expect(registerResponse2.status).toBe(200);

        const createApiKeyResponse = await createApiKey(username2, "Test Key", ["Delete"], undefined, { jwt: registerResponse2.text });
        expect(createApiKeyResponse.status).toBe(200);

        const deleteResponse = await deleteMetadata(uploadResponse.text, { apiKey: createApiKeyResponse.body.key });
        expect(deleteResponse.status).toBe(404);
        expect(deleteResponse.text).toBe(BOOK_NOT_FOUND);
    });

    test.concurrent("Delete metadata | Different user | admin", async () => {
        const { response: registerResponse, username } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const uploadResponse = await uploadBook(username, "Alices_Adventures_in_Wonderland.epub", { jwt: registerResponse.text });
        expect(uploadResponse.status).toBe(200);

        // Wait for metadata to be extracted
        await wait(0.5);

        const { response: registerResponse2, username: username2 } = await registerUser(undefined, undefined, process.env.ADMIN_KEY);
        expect(registerResponse2.status).toBe(200);

        const createApiKeyResponse = await createApiKey(username2, "Test Key", ["Delete"], undefined, { jwt: registerResponse2.text });
        expect(createApiKeyResponse.status).toBe(200);

        const deleteResponse = await deleteMetadata(uploadResponse.text, { apiKey: createApiKeyResponse.body.key });
        expect(deleteResponse.status).toBe(200);
    });

    test.concurrent("Delete metadata wrong capabilities", async () => {
        const { response: registerResponse, username } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const uploadResponse = await uploadBook(username, "Alices_Adventures_in_Wonderland.epub", { jwt: registerResponse.text });
        expect(uploadResponse.status).toBe(200);

        // Wait for metadata to be extracted
        await wait(0.5);

        const createApiKeyResponse = await createApiKey(username, "Test Key", ["Read", "Create", "Update"], undefined, { jwt: registerResponse.text });
        expect(createApiKeyResponse.status).toBe(200);

        const deleteResponse = await deleteMetadata(uploadResponse.text, { apiKey: createApiKeyResponse.body.key });
        expect(deleteResponse.status).toBe(403);
        expect(deleteResponse.text).toBe(FORBIDDEN);
    });

    test.concurrent("Delete metadata expired key", async () => {
        const { response: registerResponse, username } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const uploadResponse = await uploadBook(username, "Alices_Adventures_in_Wonderland.epub", { jwt: registerResponse.text });
        expect(uploadResponse.status).toBe(200);

        // Wait for metadata to be extracted
        await wait(0.5);

        const timestamp = new Date(Date.now() + 2000).toISOString();
        const createApiKeyResponse = await createApiKey(username, "Test Key", ["Delete"], timestamp, { jwt: registerResponse.text });
        expect(createApiKeyResponse.status).toBe(200);

        // Wait for the key to expire
        await wait(2.5);

        const deleteResponse = await deleteMetadata(uploadResponse.text, { apiKey: createApiKeyResponse.body.key });
        expect(deleteResponse.status).toBe(401);
        expect(deleteResponse.text).toBe(INVALID_API_KEY);
    });
});

describe("Update metadata JWT", () => {
    test("Update metadata", async () => {
        const { response: registerResponse, username } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const uploadResponse = await uploadBook(username, "Alices_Adventures_in_Wonderland.epub", { jwt: registerResponse.text });
        expect(uploadResponse.status).toBe(200);

        // Wait for metadata to be extracted
        await wait(0.5);

        const updateResponse = await updateMetadata(uploadResponse.text, EXAMPLE_METADATA, { jwt: registerResponse.text });
        expect(updateResponse.status).toBe(200);

        const downloadResponse = await getMetadata(uploadResponse.text, { jwt: registerResponse.text });
        expect(downloadResponse.status).toBe(200);

        expect(downloadResponse.body).toEqual(EXAMPLE_METADATA);
    });

    test("Update non-existent metadata", async () => {
        const { response: registerResponse, username } = await registerUser();
        expect(registerResponse.status).toBe(200);

        // This epub does not contain metadata
        const uploadResponse = await uploadBook(username, "The_Great_Gatsby.epub", { jwt: registerResponse.text });
        expect(uploadResponse.status).toBe(200);

        // Give chance for any metadata to be extracted
        await wait(0.5);

        const updateResponse = await updateMetadata(uploadResponse.text, EXAMPLE_METADATA, { jwt: registerResponse.text });
        expect(updateResponse.status).toBe(404);
        expect(updateResponse.text).toBe(METADATA_NOT_FOUND);
    });

    test("Update metadata from non-existent book", async () => {
        const { response: registerResponse } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const updateResponse = await updateMetadata("non-existent", EXAMPLE_METADATA, { jwt: registerResponse.text });
        expect(updateResponse.status).toBe(404);
        expect(updateResponse.text).toBe(BOOK_NOT_FOUND);
    });

    test("Update invalid metadata", async () => {
        const { response: registerResponse, username } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const uploadResponse = await uploadBook(username, "Alices_Adventures_in_Wonderland.epub", { jwt: registerResponse.text });
        expect(uploadResponse.status).toBe(200);

        // Wait for metadata to be extracted
        await wait(0.5);

        const updateResponse = await updateMetadata(uploadResponse.text, {}, { jwt: registerResponse.text });
        expect(updateResponse.status).toBe(400);
        expect(updateResponse.text).toBe(INVALID_METADATA);
    });

    test("Update metadata | Different user | !admin", async () => {
        const { response: registerResponse, username } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const uploadResponse = await uploadBook(username, "Alices_Adventures_in_Wonderland.epub", { jwt: registerResponse.text });
        expect(uploadResponse.status).toBe(200);

        // Wait for metadata to be extracted
        await wait(0.5);

        const { response: registerResponse2 } = await registerUser();
        expect(registerResponse2.status).toBe(200);

        const updateResponse = await updateMetadata(uploadResponse.text, EXAMPLE_METADATA, { jwt: registerResponse2.text });
        expect(updateResponse.status).toBe(404);
        expect(updateResponse.text).toBe(BOOK_NOT_FOUND);
    });

    test("Update metadata | Different user | admin", async () => {
        const { response: registerResponse, username } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const uploadResponse = await uploadBook(username, "Alices_Adventures_in_Wonderland.epub", { jwt: registerResponse.text });
        expect(uploadResponse.status).toBe(200);

        // Wait for metadata to be extracted
        await wait(0.5);

        const { response: registerResponse2 } = await registerUser(undefined, undefined, process.env.ADMIN_KEY);
        expect(registerResponse2.status).toBe(200);

        const updateResponse = await updateMetadata(uploadResponse.text, EXAMPLE_METADATA, { jwt: registerResponse2.text });
        expect(updateResponse.status).toBe(200);
    });

    test("Update metadata no auth", async () => {
        const { response: registerResponse, username } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const uploadResponse = await uploadBook(username, "Alices_Adventures_in_Wonderland.epub", { jwt: registerResponse.text });
        expect(uploadResponse.status).toBe(200);

        // Wait for metadata to be extracted
        await wait(0.5);

        const updateResponse = await updateMetadata(uploadResponse.text, EXAMPLE_METADATA);
        expect(updateResponse.status).toBe(401);
        expect(updateResponse.text).toBe(UNAUTHORIZED);
    });
});

describe("Update metadata api key", () => {
    test("Update metadata", async () => {
        const { response: registerResponse, username } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const uploadResponse = await uploadBook(username, "Alices_Adventures_in_Wonderland.epub", { jwt: registerResponse.text });
        expect(uploadResponse.status).toBe(200);

        // Wait for metadata to be extracted
        await wait(0.5);

        const createApiKeyResponse = await createApiKey(username, "Test Key", ["Update"], undefined, { jwt: registerResponse.text });
        expect(createApiKeyResponse.status).toBe(200);

        const updateResponse = await updateMetadata(uploadResponse.text, EXAMPLE_METADATA, { apiKey: createApiKeyResponse.body.key });
        expect(updateResponse.status).toBe(200);

        const downloadResponse = await getMetadata(uploadResponse.text, { jwt: registerResponse.text });
        expect(downloadResponse.status).toBe(200);

        expect(downloadResponse.body).toEqual(EXAMPLE_METADATA);
    });

    test("Update non-existent metadata", async () => {
        const { response: registerResponse, username } = await registerUser();
        expect(registerResponse.status).toBe(200);

        // This epub does not contain metadata
        const uploadResponse = await uploadBook(username, "The_Great_Gatsby.epub", { jwt: registerResponse.text });
        expect(uploadResponse.status).toBe(200);

        // Give chance for any metadata to be extracted
        await wait(0.5);

        const createApiKeyResponse = await createApiKey(username, "Test Key", ["Update"], undefined, { jwt: registerResponse.text });
        expect(createApiKeyResponse.status).toBe(200);

        const updateResponse = await updateMetadata(uploadResponse.text, EXAMPLE_METADATA, { apiKey: createApiKeyResponse.body.key });
        expect(updateResponse.status).toBe(404);
        expect(updateResponse.text).toBe(METADATA_NOT_FOUND);
    });

    test("Update metadata from non-existent book", async () => {
        const { response: registerResponse, username } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const createApiKeyResponse = await createApiKey(username, "Test Key", ["Update"], undefined, { jwt: registerResponse.text });
        expect(createApiKeyResponse.status).toBe(200);

        const updateResponse = await updateMetadata("non-existent", EXAMPLE_METADATA, { apiKey: createApiKeyResponse.body.key });
        expect(updateResponse.status).toBe(404);
        expect(updateResponse.text).toBe(BOOK_NOT_FOUND);
    });

    test("Update invalid metadata", async () => {
        const { response: registerResponse, username } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const uploadResponse = await uploadBook(username, "Alices_Adventures_in_Wonderland.epub", { jwt: registerResponse.text });
        expect(uploadResponse.status).toBe(200);

        // Wait for metadata to be extracted
        await wait(0.5);

        const createApiKeyResponse = await createApiKey(username, "Test Key", ["Update"], undefined, { jwt: registerResponse.text });
        expect(createApiKeyResponse.status).toBe(200);

        const updateResponse = await updateMetadata(uploadResponse.text, {}, { apiKey: createApiKeyResponse.body.key });
        expect(updateResponse.status).toBe(400);
        expect(updateResponse.text).toBe(INVALID_METADATA);
    });

    test("Update metadata | Different user | !admin", async () => {
        const { response: registerResponse, username } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const uploadResponse = await uploadBook(username, "Alices_Adventures_in_Wonderland.epub", { jwt: registerResponse.text });
        expect(uploadResponse.status).toBe(200);

        // Wait for metadata to be extracted
        await wait(0.5);

        const { response: registerResponse2, username: username2 } = await registerUser();
        expect(registerResponse2.status).toBe(200);

        const createApiKeyResponse = await createApiKey(username2, "Test Key", ["Update"], undefined, { jwt: registerResponse2.text });
        expect(createApiKeyResponse.status).toBe(200);

        const updateResponse = await updateMetadata(uploadResponse.text, EXAMPLE_METADATA, { apiKey: createApiKeyResponse.body.key });
        expect(updateResponse.status).toBe(404);
        expect(updateResponse.text).toBe(BOOK_NOT_FOUND);
    });

    test("Update metadata | Different user | admin", async () => {
        const { response: registerResponse, username } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const uploadResponse = await uploadBook(username, "Alices_Adventures_in_Wonderland.epub", { jwt: registerResponse.text });
        expect(uploadResponse.status).toBe(200);

        // Wait for metadata to be extracted
        await wait(0.5);

        const { response: registerResponse2, username: username2 } = await registerUser(undefined, undefined, process.env.ADMIN_KEY);
        expect(registerResponse2.status).toBe(200);

        const createApiKeyResponse = await createApiKey(username2, "Test Key", ["Update"], undefined, { jwt: registerResponse2.text });
        expect(createApiKeyResponse.status).toBe(200);

        const updateResponse = await updateMetadata(uploadResponse.text, EXAMPLE_METADATA, { apiKey: createApiKeyResponse.body.key });
        expect(updateResponse.status).toBe(200);
    });

    test("Update metadata wrong capabilities", async () => {
        const { response: registerResponse, username } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const uploadResponse = await uploadBook(username, "Alices_Adventures_in_Wonderland.epub", { jwt: registerResponse.text });
        expect(uploadResponse.status).toBe(200);

        // Wait for metadata to be extracted
        await wait(0.5);

        const createApiKeyResponse = await createApiKey(username, "Test Key", ["Create", "Read", "Delete"], undefined, { jwt: registerResponse.text });
        expect(createApiKeyResponse.status).toBe(200);

        const updateResponse = await updateMetadata(uploadResponse.text, EXAMPLE_METADATA, { apiKey: createApiKeyResponse.body.key });
        expect(updateResponse.status).toBe(403);
        expect(updateResponse.text).toBe(FORBIDDEN);
    });

    test("Update metadata expired key", async () => {
        const { response: registerResponse, username } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const uploadResponse = await uploadBook(username, "Alices_Adventures_in_Wonderland.epub", { jwt: registerResponse.text });
        expect(uploadResponse.status).toBe(200);

        // Wait for metadata to be extracted
        await wait(0.5);

        const timestamp = new Date(Date.now() + 2000).toISOString();
        const createApiKeyResponse = await createApiKey(username, "Test Key", ["Update"], timestamp, { jwt: registerResponse.text });
        expect(createApiKeyResponse.status).toBe(200);

        // Wait for the key to expire
        await wait(2.5);

        const updateResponse = await updateMetadata(uploadResponse.text, EXAMPLE_METADATA, { apiKey: createApiKeyResponse.body.key });
        expect(updateResponse.status).toBe(401);
        expect(updateResponse.text).toBe(INVALID_API_KEY);
    });
});

describe("Patch metadata JWT", () => {
    test("Patch metadata", async () => {
        const { response: registerResponse, username } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const uploadResponse = await uploadBook(username, "Alices_Adventures_in_Wonderland.epub", { jwt: registerResponse.text });
        expect(uploadResponse.status).toBe(200);

        // Wait for metadata to be extracted
        await wait(0.5);

        const patchResponse = await patchMetadata(uploadResponse.text, { title: "title test" }, { jwt: registerResponse.text });
        expect(patchResponse.status).toBe(200);

        let expectedMetadata = structuredClone(ALICE_METADATA);
        expectedMetadata.title = "title test";

        const downloadResponse = await getMetadata(uploadResponse.text, { jwt: registerResponse.text });
        expect(downloadResponse.status).toBe(200);

        expect(downloadResponse.body).toEqual(expectedMetadata);
    });

    test("Patch non-existent metadata", async () => {
        const { response: registerResponse, username } = await registerUser();
        expect(registerResponse.status).toBe(200);

        // This epub does not contain metadata
        const uploadResponse = await uploadBook(username, "The_Great_Gatsby.epub", { jwt: registerResponse.text });
        expect(uploadResponse.status).toBe(200);

        // Give chance for any metadata to be extracted
        await wait(0.5);

        const patchResponse = await patchMetadata(uploadResponse.text, { title: "title test" }, { jwt: registerResponse.text });
        expect(patchResponse.status).toBe(404);
        expect(patchResponse.text).toBe(METADATA_NOT_FOUND);
    });

    test("Patch metadata from non-existent book", async () => {
        const { response: registerResponse } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const patchResponse = await patchMetadata("non-existent", { title: "title test" }, { jwt: registerResponse.text });
        expect(patchResponse.status).toBe(404);
        expect(patchResponse.text).toBe(BOOK_NOT_FOUND);
    });

    test("Patch invalid metadata", async () => {
        const { response: registerResponse, username } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const uploadResponse = await uploadBook(username, "Alices_Adventures_in_Wonderland.epub", { jwt: registerResponse.text });
        expect(uploadResponse.status).toBe(200);

        // Wait for metadata to be extracted
        await wait(0.5);

        const patchResponse = await patchMetadata(uploadResponse.text, {}, { jwt: registerResponse.text });
        expect(patchResponse.status).toBe(400);
        expect(patchResponse.text).toBe(INVALID_METADATA);
    });

    test("Patch metadata | Different user | !admin", async () => {
        const { response: registerResponse, username } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const uploadResponse = await uploadBook(username, "Alices_Adventures_in_Wonderland.epub", { jwt: registerResponse.text });
        expect(uploadResponse.status).toBe(200);

        // Wait for metadata to be extracted
        await wait(0.5);

        const { response: registerResponse2 } = await registerUser();
        expect(registerResponse2.status).toBe(200);

        const patchResponse = await patchMetadata(uploadResponse.text, { title: "title test" }, { jwt: registerResponse2.text });
        expect(patchResponse.status).toBe(404);
        expect(patchResponse.text).toBe(BOOK_NOT_FOUND);
    });

    test("Patch metadata | Different user | admin", async () => {
        const { response: registerResponse, username } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const uploadResponse = await uploadBook(username, "Alices_Adventures_in_Wonderland.epub", { jwt: registerResponse.text });
        expect(uploadResponse.status).toBe(200);

        // Wait for metadata to be extracted
        await wait(0.5);

        const { response: registerResponse2 } = await registerUser(undefined, undefined, process.env.ADMIN_KEY);
        expect(registerResponse2.status).toBe(200);

        const patchResponse = await patchMetadata(uploadResponse.text, { title: "title test" }, { jwt: registerResponse2.text });
        expect(patchResponse.status).toBe(200);
    });

    test("Patch metadata no auth", async () => {
        const { response: registerResponse, username } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const uploadResponse = await uploadBook(username, "Alices_Adventures_in_Wonderland.epub", { jwt: registerResponse.text });
        expect(uploadResponse.status).toBe(200);

        // Wait for metadata to be extracted
        await wait(0.5);

        const patchResponse = await patchMetadata(uploadResponse.text, { title: "title test" });
        expect(patchResponse.status).toBe(401);
        expect(patchResponse.text).toBe(UNAUTHORIZED);
    });
});

describe("Patch metadata api key", () => {
    test("Patch metadata", async () => {
        const { response: registerResponse, username } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const uploadResponse = await uploadBook(username, "Alices_Adventures_in_Wonderland.epub", { jwt: registerResponse.text });
        expect(uploadResponse.status).toBe(200);

        // Wait for metadata to be extracted
        await wait(0.5);

        const createApiKeyResponse = await createApiKey(username, "Test Key", ["Update"], undefined, { jwt: registerResponse.text });
        expect(createApiKeyResponse.status).toBe(200);

        const patchResponse = await patchMetadata(uploadResponse.text, { title: "title test" }, { apiKey: createApiKeyResponse.body.key });
        expect(patchResponse.status).toBe(200);

        let expectedMetadata = structuredClone(ALICE_METADATA);
        expectedMetadata.title = "title test";

        const downloadResponse = await getMetadata(uploadResponse.text, { jwt: registerResponse.text });
        expect(downloadResponse.status).toBe(200);

        expect(downloadResponse.body).toEqual(expectedMetadata);
    });

    test("Patch non-existent metadata", async () => {
        const { response: registerResponse, username } = await registerUser();
        expect(registerResponse.status).toBe(200);

        // This epub does not contain metadata
        const uploadResponse = await uploadBook(username, "The_Great_Gatsby.epub", { jwt: registerResponse.text });
        expect(uploadResponse.status).toBe(200);

        // Give chance for any metadata to be extracted
        await wait(0.5);

        const createApiKeyResponse = await createApiKey(username, "Test Key", ["Update"], undefined, { jwt: registerResponse.text });
        expect(createApiKeyResponse.status).toBe(200);

        const patchResponse = await patchMetadata(uploadResponse.text, { title: "title test" }, { apiKey: createApiKeyResponse.body.key });
        expect(patchResponse.status).toBe(404);
        expect(patchResponse.text).toBe(METADATA_NOT_FOUND);
    });

    test("Patch metadata from non-existent book", async () => {
        const { response: registerResponse, username } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const createApiKeyResponse = await createApiKey(username, "Test Key", ["Update"], undefined, { jwt: registerResponse.text });
        expect(createApiKeyResponse.status).toBe(200);

        const patchResponse = await patchMetadata("non-existent", { title: "title test" }, { apiKey: createApiKeyResponse.body.key });
        expect(patchResponse.status).toBe(404);
        expect(patchResponse.text).toBe(BOOK_NOT_FOUND);
    });

    test("Patch invalid metadata", async () => {
        const { response: registerResponse, username } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const uploadResponse = await uploadBook(username, "Alices_Adventures_in_Wonderland.epub", { jwt: registerResponse.text });
        expect(uploadResponse.status).toBe(200);

        // Wait for metadata to be extracted
        await wait(0.5);

        const createApiKeyResponse = await createApiKey(username, "Test Key", ["Update"], undefined, { jwt: registerResponse.text });
        expect(createApiKeyResponse.status).toBe(200);

        const patchResponse = await patchMetadata(uploadResponse.text, {}, { apiKey: createApiKeyResponse.body.key });
        expect(patchResponse.status).toBe(400);
        expect(patchResponse.text).toBe(INVALID_METADATA);
    });

    test("Patch metadata | Different user | !admin", async () => {
        const { response: registerResponse, username } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const uploadResponse = await uploadBook(username, "Alices_Adventures_in_Wonderland.epub", { jwt: registerResponse.text });
        expect(uploadResponse.status).toBe(200);

        // Wait for metadata to be extracted
        await wait(0.5);

        const { response: registerResponse2, username: username2 } = await registerUser();
        expect(registerResponse2.status).toBe(200);

        const createApiKeyResponse = await createApiKey(username2, "Test Key", ["Update"], undefined, { jwt: registerResponse2.text });
        expect(createApiKeyResponse.status).toBe(200);

        const patchResponse = await patchMetadata(uploadResponse.text, { title: "title test" }, { apiKey: createApiKeyResponse.body.key });
        expect(patchResponse.status).toBe(404);
        expect(patchResponse.text).toBe(BOOK_NOT_FOUND);
    });

    test("Patch metadata | Different user | admin", async () => {
        const { response: registerResponse, username } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const uploadResponse = await uploadBook(username, "Alices_Adventures_in_Wonderland.epub", { jwt: registerResponse.text });
        expect(uploadResponse.status).toBe(200);

        // Wait for metadata to be extracted
        await wait(0.5);

        const { response: registerResponse2, username: username2 } = await registerUser(undefined, undefined, process.env.ADMIN_KEY);
        expect(registerResponse2.status).toBe(200);

        const createApiKeyResponse = await createApiKey(username2, "Test Key", ["Update"], undefined, { jwt: registerResponse2.text });
        expect(createApiKeyResponse.status).toBe(200);

        const patchResponse = await patchMetadata(uploadResponse.text, { title: "title test" }, { apiKey: createApiKeyResponse.body.key });
        expect(patchResponse.status).toBe(200);
    });

    test("Patch metadata wrong capabilities", async () => {
        const { response: registerResponse, username } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const uploadResponse = await uploadBook(username, "Alices_Adventures_in_Wonderland.epub", { jwt: registerResponse.text });
        expect(uploadResponse.status).toBe(200);

        // Wait for metadata to be extracted
        await wait(0.5);

        const createApiKeyResponse = await createApiKey(username, "Test Key", ["Create", "Read", "Delete"], undefined, { jwt: registerResponse.text });
        expect(createApiKeyResponse.status).toBe(200);

        const patchResponse = await patchMetadata(uploadResponse.text, { title: "title test" }, { apiKey: createApiKeyResponse.body.key });
        expect(patchResponse.status).toBe(403);
        expect(patchResponse.text).toBe(FORBIDDEN);
    });

    test("Patch metadata expired key", async () => {
        const { response: registerResponse, username } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const uploadResponse = await uploadBook(username, "Alices_Adventures_in_Wonderland.epub", { jwt: registerResponse.text });
        expect(uploadResponse.status).toBe(200);

        // Wait for metadata to be extracted
        await wait(0.5);

        const timestamp = new Date(Date.now() + 2000).toISOString();
        const createApiKeyResponse = await createApiKey(username, "Test Key", ["Update"], timestamp, { jwt: registerResponse.text });
        expect(createApiKeyResponse.status).toBe(200);

        // Wait for the key to expire
        await wait(2.5);

        const patchResponse = await patchMetadata(uploadResponse.text, { title: "title test" }, { apiKey: createApiKeyResponse.body.key });
        expect(patchResponse.status).toBe(401);
        expect(patchResponse.text).toBe(INVALID_API_KEY);
    });
});