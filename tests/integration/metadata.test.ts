import { FORBIDDEN, INVALID_API_KEY, UNAUTHORIZED, wait } from "../utils/common";
import { registerUser, createApiKey, patchPreferences } from "../utils/users"
import { BOOK_NOT_FOUND, uploadBook } from "../utils/books"
import { addMetadata, METADATA_CONFLICT, METADATA_NOT_FOUND, deleteMetadata, getMetadata, INVALID_METADATA, updateMetadata, patchMetadata, ALICE_METADATA, EXAMPLE_METADATA } from "../utils/metadata"

describe("Get metadata JWT", () => {
    test("Simple", async () => {
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

    test("Disabled auto-fetch", async () => {
        const { response: registerResponse, username } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const patchPreferencesResponse = await patchPreferences(username, undefined, false, { jwt: registerResponse.text });
        expect(patchPreferencesResponse.status).toBe(204);

        const uploadResponse = await uploadBook(username, "Alices_Adventures_in_Wonderland.epub", { jwt: registerResponse.text });
        expect(uploadResponse.status).toBe(200);

        // Wait for metadata to be extracted
        await wait(0.5);

        const downloadResponse = await getMetadata(uploadResponse.text, { jwt: registerResponse.text });
        expect(downloadResponse.status).toBe(404);
        expect(downloadResponse.text).toEqual(METADATA_NOT_FOUND);
    });

    test("Non-existent metadata", async () => {
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

    test("Non-existent book", async () => {
        const { response: registerResponse } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const downloadResponse = await getMetadata("non-existent", { jwt: registerResponse.text });
        expect(downloadResponse.status).toBe(404);
        expect(downloadResponse.text).toBe(BOOK_NOT_FOUND);
    });

    test("Different user without permission", async () => {
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

    test("Different user with permission", async () => {
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

    test("No auth", async () => {
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
    test("Simple", async () => {
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

    test("Non-existent metadata", async () => {
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

    test("Non-existent book", async () => {
        const { response: registerResponse, username } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const createApiKeyResponse = await createApiKey(username, "Test Key", ["Read"], undefined, { jwt: registerResponse.text });
        expect(createApiKeyResponse.status).toBe(200);

        const downloadResponse = await getMetadata("non-existent", { apiKey: createApiKeyResponse.body.key });
        expect(downloadResponse.status).toBe(404);
        expect(downloadResponse.text).toBe(BOOK_NOT_FOUND);
    });

    test("Different user without permission", async () => {
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

    test("Different user with permission", async () => {
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

    test("Wrong capabilities", async () => {
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

    test("Expired api key", async () => {
        const { response: registerResponse, username } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const uploadResponse = await uploadBook(username, "Alices_Adventures_in_Wonderland.epub", { jwt: registerResponse.text });
        expect(uploadResponse.status).toBe(200);

        // Wait for metadata to be extracted
        await wait(0.5);

        const timestamp = Date.now() + 2000;
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
    test("Simple", async () => {
        const { response: registerResponse, username } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const uploadResponse = await uploadBook(username, "The_Great_Gatsby.epub", { jwt: registerResponse.text });
        expect(uploadResponse.status).toBe(200);

        // Give chance for any metadata to be extracted
        await wait(0.5);

        const addResponse = await addMetadata(uploadResponse.text, EXAMPLE_METADATA, { jwt: registerResponse.text });
        expect(addResponse.status).toBe(204);

        const downloadResponse = await getMetadata(uploadResponse.text, { jwt: registerResponse.text });
        expect(downloadResponse.status).toBe(200);

        expect(downloadResponse.body).toEqual(EXAMPLE_METADATA);
    });

    test("Only authors", async () => {
        const { response: registerResponse, username } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const uploadResponse = await uploadBook(username, "The_Great_Gatsby.epub", { jwt: registerResponse.text });
        expect(uploadResponse.status).toBe(200);

        // Give chance for any metadata to be extracted
        await wait(0.5);

        const metadata = {
            contributors: [
                {
                    name: "Lewis Carroll",
                    role: "Author"
                }
            ]
        };

        const addResponse = await addMetadata(uploadResponse.text, metadata, { jwt: registerResponse.text });
        expect(addResponse.status).toBe(204);

        const downloadResponse = await getMetadata(uploadResponse.text, { jwt: registerResponse.text });
        expect(downloadResponse.status).toBe(200);

        expect(downloadResponse.body).toEqual(metadata);
    });

    test("Invalid metadata", async () => {
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

    test("Metadata conflict", async () => {
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

    test("Non-existent book", async () => {
        const { response: registerResponse } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const addResponse = await addMetadata("non-existent", EXAMPLE_METADATA, { jwt: registerResponse.text });
        expect(addResponse.status).toBe(404);
        expect(addResponse.text).toBe(BOOK_NOT_FOUND);
    });

    test("Different user without permission", async () => {
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

    test("Different user with permission", async () => {
        const { response: registerResponse, username } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const uploadResponse = await uploadBook(username, "The_Great_Gatsby.epub", { jwt: registerResponse.text });
        expect(uploadResponse.status).toBe(200);

        // Give chance for any metadata to be extracted
        await wait(0.5);

        const { response: registerResponse2, } = await registerUser(undefined, undefined, process.env.ADMIN_KEY);
        expect(registerResponse2.status).toBe(200);

        const addResponse = await addMetadata(uploadResponse.text, EXAMPLE_METADATA, { jwt: registerResponse2.text });
        expect(addResponse.status).toBe(204);
    });

    test("No auth", async () => {
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
    test("Simple", async () => {
        const { response: registerResponse, username } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const uploadResponse = await uploadBook(username, "The_Great_Gatsby.epub", { jwt: registerResponse.text });
        expect(uploadResponse.status).toBe(200);

        // Give chance for any metadata to be extracted
        await wait(0.5);

        const createApiKeyResponse = await createApiKey(username, "Test Key", ["Update"], undefined, { jwt: registerResponse.text });
        expect(createApiKeyResponse.status).toBe(200);

        const addResponse = await addMetadata(uploadResponse.text, EXAMPLE_METADATA, { apiKey: createApiKeyResponse.body.key });
        expect(addResponse.status).toBe(204);

        const downloadResponse = await getMetadata(uploadResponse.text, { jwt: registerResponse.text });
        expect(downloadResponse.status).toBe(200);

        expect(downloadResponse.body).toEqual(EXAMPLE_METADATA);
    });

    test("Only authors", async () => {
        const { response: registerResponse, username } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const uploadResponse = await uploadBook(username, "The_Great_Gatsby.epub", { jwt: registerResponse.text });
        expect(uploadResponse.status).toBe(200);

        // Give chance for any metadata to be extracted
        await wait(0.5);

        const createApiKeyResponse = await createApiKey(username, "Test Key", ["Update"], undefined, { jwt: registerResponse.text });
        expect(createApiKeyResponse.status).toBe(200);


        const metadata = {
            contributors: [
                {
                    name: "Lewis Carroll",
                    role: "Author"
                }
            ]
        };

        const addResponse = await addMetadata(uploadResponse.text, metadata, { apiKey: createApiKeyResponse.body.key });
        expect(addResponse.status).toBe(204);

        const downloadResponse = await getMetadata(uploadResponse.text, { jwt: registerResponse.text });
        expect(downloadResponse.status).toBe(200);

        expect(downloadResponse.body).toEqual(metadata);
    });

    test("Invalid metadata", async () => {
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

    test("Metadata conflict", async () => {
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

    test("Non-existent book", async () => {
        const { response: registerResponse, username } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const createApiKeyResponse = await createApiKey(username, "Test Key", ["Update"], undefined, { jwt: registerResponse.text });
        expect(createApiKeyResponse.status).toBe(200);

        const addResponse = await addMetadata("non-existent", EXAMPLE_METADATA, { apiKey: createApiKeyResponse.body.key });
        expect(addResponse.status).toBe(404);
        expect(addResponse.text).toBe(BOOK_NOT_FOUND);
    });

    test("Different user without permission", async () => {
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

    test("Different user with permission", async () => {
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
        expect(addResponse.status).toBe(204);
    });

    test("Wrong capabilities", async () => {
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

    test("Expired key", async () => {
        const { response: registerResponse, username } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const uploadResponse = await uploadBook(username, "The_Great_Gatsby.epub", { jwt: registerResponse.text });
        expect(uploadResponse.status).toBe(200);

        // Give chance for any metadata to be extracted
        await wait(0.5);

        const timestamp = Date.now() + 2000;
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
    test("Simple", async () => {
        const { response: registerResponse, username } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const uploadResponse = await uploadBook(username, "Alices_Adventures_in_Wonderland.epub", { jwt: registerResponse.text });
        expect(uploadResponse.status).toBe(200);

        // Wait for metadata to be extracted
        await wait(0.5);

        const deleteResponse = await deleteMetadata(uploadResponse.text, { jwt: registerResponse.text });
        expect(deleteResponse.status).toBe(204);

        const downloadResponse = await getMetadata(uploadResponse.text, { jwt: registerResponse.text });
        expect(downloadResponse.status).toBe(404);
        expect(downloadResponse.text).toBe(METADATA_NOT_FOUND);
    });

    test("Non-existent metadata", async () => {
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

    test("Non-existent book", async () => {
        const { response: registerResponse } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const deleteResponse = await deleteMetadata("non-existent", { jwt: registerResponse.text });
        expect(deleteResponse.status).toBe(404);
        expect(deleteResponse.text).toBe(BOOK_NOT_FOUND);
    });

    test("Different user without permission", async () => {
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

    test("Different user with permission", async () => {
        const { response: registerResponse, username } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const uploadResponse = await uploadBook(username, "Alices_Adventures_in_Wonderland.epub", { jwt: registerResponse.text });
        expect(uploadResponse.status).toBe(200);

        // Wait for metadata to be extracted
        await wait(0.5);

        const { response: registerResponse2 } = await registerUser(undefined, undefined, process.env.ADMIN_KEY);
        expect(registerResponse2.status).toBe(200);

        const deleteResponse = await deleteMetadata(uploadResponse.text, { jwt: registerResponse2.text });
        expect(deleteResponse.status).toBe(204);
    });

    test("No auth", async () => {
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
    test("Simple", async () => {
        const { response: registerResponse, username } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const uploadResponse = await uploadBook(username, "Alices_Adventures_in_Wonderland.epub", { jwt: registerResponse.text });
        expect(uploadResponse.status).toBe(200);

        // Wait for metadata to be extracted
        await wait(0.5);

        const createApiKeyResponse = await createApiKey(username, "Test Key", ["Delete"], undefined, { jwt: registerResponse.text });
        expect(createApiKeyResponse.status).toBe(200);

        const deleteResponse = await deleteMetadata(uploadResponse.text, { apiKey: createApiKeyResponse.body.key });
        expect(deleteResponse.status).toBe(204);

        const downloadResponse = await getMetadata(uploadResponse.text, { jwt: registerResponse.text });
        expect(downloadResponse.status).toBe(404);
        expect(downloadResponse.text).toBe(METADATA_NOT_FOUND);
    });

    test("Non-existent metadata", async () => {
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

    test("Non-existent book", async () => {
        const { response: registerResponse, username } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const createApiKeyResponse = await createApiKey(username, "Test Key", ["Delete"], undefined, { jwt: registerResponse.text });
        expect(createApiKeyResponse.status).toBe(200);

        const deleteResponse = await deleteMetadata("non-existent", { apiKey: createApiKeyResponse.body.key });
        expect(deleteResponse.status).toBe(404);
        expect(deleteResponse.text).toBe(BOOK_NOT_FOUND);
    });

    test("Different user without permission", async () => {
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

    test("Different user with permission", async () => {
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
        expect(deleteResponse.status).toBe(204);
    });

    test("Wrong capabilities", async () => {
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

    test("Expired key", async () => {
        const { response: registerResponse, username } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const uploadResponse = await uploadBook(username, "Alices_Adventures_in_Wonderland.epub", { jwt: registerResponse.text });
        expect(uploadResponse.status).toBe(200);

        // Wait for metadata to be extracted
        await wait(0.5);

        const timestamp = Date.now() + 2000;
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
    test("Simple", async () => {
        const { response: registerResponse, username } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const uploadResponse = await uploadBook(username, "Alices_Adventures_in_Wonderland.epub", { jwt: registerResponse.text });
        expect(uploadResponse.status).toBe(200);

        // Wait for metadata to be extracted
        await wait(0.5);

        const updateResponse = await updateMetadata(uploadResponse.text, EXAMPLE_METADATA, { jwt: registerResponse.text });
        expect(updateResponse.status).toBe(204);

        const downloadResponse = await getMetadata(uploadResponse.text, { jwt: registerResponse.text });
        expect(downloadResponse.status).toBe(200);

        expect(downloadResponse.body).toEqual(EXAMPLE_METADATA);
    });

    test("Non-existent metadata", async () => {
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

    test("Non-existent book", async () => {
        const { response: registerResponse } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const updateResponse = await updateMetadata("non-existent", EXAMPLE_METADATA, { jwt: registerResponse.text });
        expect(updateResponse.status).toBe(404);
        expect(updateResponse.text).toBe(BOOK_NOT_FOUND);
    });

    test("Invalid metadata", async () => {
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

    test("Different user without permission", async () => {
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

    test("Different user with permission", async () => {
        const { response: registerResponse, username } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const uploadResponse = await uploadBook(username, "Alices_Adventures_in_Wonderland.epub", { jwt: registerResponse.text });
        expect(uploadResponse.status).toBe(200);

        // Wait for metadata to be extracted
        await wait(0.5);

        const { response: registerResponse2 } = await registerUser(undefined, undefined, process.env.ADMIN_KEY);
        expect(registerResponse2.status).toBe(200);

        const updateResponse = await updateMetadata(uploadResponse.text, EXAMPLE_METADATA, { jwt: registerResponse2.text });
        expect(updateResponse.status).toBe(204);
    });

    test("No auth", async () => {
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
    test("Simple", async () => {
        const { response: registerResponse, username } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const uploadResponse = await uploadBook(username, "Alices_Adventures_in_Wonderland.epub", { jwt: registerResponse.text });
        expect(uploadResponse.status).toBe(200);

        // Wait for metadata to be extracted
        await wait(0.5);

        const createApiKeyResponse = await createApiKey(username, "Test Key", ["Update"], undefined, { jwt: registerResponse.text });
        expect(createApiKeyResponse.status).toBe(200);

        const updateResponse = await updateMetadata(uploadResponse.text, EXAMPLE_METADATA, { apiKey: createApiKeyResponse.body.key });
        expect(updateResponse.status).toBe(204);

        const downloadResponse = await getMetadata(uploadResponse.text, { jwt: registerResponse.text });
        expect(downloadResponse.status).toBe(200);

        expect(downloadResponse.body).toEqual(EXAMPLE_METADATA);
    });

    test("Non-existent metadata", async () => {
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

    test("Non-existent book", async () => {
        const { response: registerResponse, username } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const createApiKeyResponse = await createApiKey(username, "Test Key", ["Update"], undefined, { jwt: registerResponse.text });
        expect(createApiKeyResponse.status).toBe(200);

        const updateResponse = await updateMetadata("non-existent", EXAMPLE_METADATA, { apiKey: createApiKeyResponse.body.key });
        expect(updateResponse.status).toBe(404);
        expect(updateResponse.text).toBe(BOOK_NOT_FOUND);
    });

    test("Invalid metadata", async () => {
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

    test("Different user without permission", async () => {
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

    test("Different user with permission", async () => {
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
        expect(updateResponse.status).toBe(204);
    });

    test("Wrong capabilities", async () => {
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

    test("Expired key", async () => {
        const { response: registerResponse, username } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const uploadResponse = await uploadBook(username, "Alices_Adventures_in_Wonderland.epub", { jwt: registerResponse.text });
        expect(uploadResponse.status).toBe(200);

        // Wait for metadata to be extracted
        await wait(0.5);

        const timestamp = Date.now() + 2000;
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
    test("Simple", async () => {
        const { response: registerResponse, username } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const uploadResponse = await uploadBook(username, "Alices_Adventures_in_Wonderland.epub", { jwt: registerResponse.text });
        expect(uploadResponse.status).toBe(200);

        // Wait for metadata to be extracted
        await wait(0.5);

        const patchResponse = await patchMetadata(uploadResponse.text, { title: "title test" }, { jwt: registerResponse.text });
        expect(patchResponse.status).toBe(204);

        let expectedMetadata = structuredClone(ALICE_METADATA);
        expectedMetadata.title = "title test";

        const downloadResponse = await getMetadata(uploadResponse.text, { jwt: registerResponse.text });
        expect(downloadResponse.status).toBe(200);

        expect(downloadResponse.body).toEqual(expectedMetadata);
    });

    test("Non-existent metadata", async () => {
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

    test("Non-existent book", async () => {
        const { response: registerResponse } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const patchResponse = await patchMetadata("non-existent", { title: "title test" }, { jwt: registerResponse.text });
        expect(patchResponse.status).toBe(404);
        expect(patchResponse.text).toBe(BOOK_NOT_FOUND);
    });

    test("Invalid metadata", async () => {
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

    test("Different user without permission", async () => {
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

    test("Different user with permission", async () => {
        const { response: registerResponse, username } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const uploadResponse = await uploadBook(username, "Alices_Adventures_in_Wonderland.epub", { jwt: registerResponse.text });
        expect(uploadResponse.status).toBe(200);

        // Wait for metadata to be extracted
        await wait(0.5);

        const { response: registerResponse2 } = await registerUser(undefined, undefined, process.env.ADMIN_KEY);
        expect(registerResponse2.status).toBe(200);

        const patchResponse = await patchMetadata(uploadResponse.text, { title: "title test" }, { jwt: registerResponse2.text });
        expect(patchResponse.status).toBe(204);
    });

    test("No auth", async () => {
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
    test("Simple", async () => {
        const { response: registerResponse, username } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const uploadResponse = await uploadBook(username, "Alices_Adventures_in_Wonderland.epub", { jwt: registerResponse.text });
        expect(uploadResponse.status).toBe(200);

        // Wait for metadata to be extracted
        await wait(0.5);

        const createApiKeyResponse = await createApiKey(username, "Test Key", ["Update"], undefined, { jwt: registerResponse.text });
        expect(createApiKeyResponse.status).toBe(200);

        const patchResponse = await patchMetadata(uploadResponse.text, { title: "title test" }, { apiKey: createApiKeyResponse.body.key });
        expect(patchResponse.status).toBe(204);

        let expectedMetadata = structuredClone(ALICE_METADATA);
        expectedMetadata.title = "title test";

        const downloadResponse = await getMetadata(uploadResponse.text, { jwt: registerResponse.text });
        expect(downloadResponse.status).toBe(200);

        expect(downloadResponse.body).toEqual(expectedMetadata);
    });

    test("Non-existent metadata", async () => {
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

    test("Non-existent book", async () => {
        const { response: registerResponse, username } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const createApiKeyResponse = await createApiKey(username, "Test Key", ["Update"], undefined, { jwt: registerResponse.text });
        expect(createApiKeyResponse.status).toBe(200);

        const patchResponse = await patchMetadata("non-existent", { title: "title test" }, { apiKey: createApiKeyResponse.body.key });
        expect(patchResponse.status).toBe(404);
        expect(patchResponse.text).toBe(BOOK_NOT_FOUND);
    });

    test("Invalid metadata", async () => {
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

    test("Different user without permission", async () => {
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

    test("Different user with permission", async () => {
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
        expect(patchResponse.status).toBe(204);
    });

    test("Wrong capabilities", async () => {
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

    test("Expired key", async () => {
        const { response: registerResponse, username } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const uploadResponse = await uploadBook(username, "Alices_Adventures_in_Wonderland.epub", { jwt: registerResponse.text });
        expect(uploadResponse.status).toBe(200);

        // Wait for metadata to be extracted
        await wait(0.5);

        const timestamp = Date.now() + 2000;
        const createApiKeyResponse = await createApiKey(username, "Test Key", ["Update"], timestamp, { jwt: registerResponse.text });
        expect(createApiKeyResponse.status).toBe(200);

        // Wait for the key to expire
        await wait(2.5);

        const patchResponse = await patchMetadata(uploadResponse.text, { title: "title test" }, { apiKey: createApiKeyResponse.body.key });
        expect(patchResponse.status).toBe(401);
        expect(patchResponse.text).toBe(INVALID_API_KEY);
    });
});