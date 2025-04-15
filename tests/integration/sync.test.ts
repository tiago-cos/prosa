import { FORBIDDEN, INVALID_API_KEY, UNAUTHORIZED, wait } from "../utils/common";
import { createApiKey, registerUser, USER_NOT_FOUND } from "../utils/users"
import { deleteBook, uploadBook } from "../utils/books"
import { INVALID_TIMESTAMP, sync } from "../utils/sync"
import { EXAMPLE_METADATA, patchMetadata, updateMetadata } from "../utils/metadata";
import { updateCover } from "../utils/covers";
import { ALICE_STATE, patchState, updateState } from "../utils/state";

describe("Sync JWT", () => {
    test.concurrent("Simple", async () => {
        const { response: registerResponse, username } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const uploadResponse = await uploadBook(username, "Alices_Adventures_in_Wonderland.epub", { jwt: registerResponse.text });
        expect(uploadResponse.status).toBe(200);

        // Wait for cover and metadata to be extracted
        await wait(0.5);

        let syncResponse = await sync(username, undefined, { jwt: registerResponse.text });
        expect(syncResponse.status).toBe(200);

        let expectedResponse = {
            file: [uploadResponse.text],
            metadata: [uploadResponse.text],
            cover: [uploadResponse.text],
            state: [uploadResponse.text],
            deleted: []
        }

        expect(syncResponse.body).toEqual(expectedResponse);

        let now = Date.now();

        syncResponse = await sync(username, now, { jwt: registerResponse.text });
        expect(syncResponse.status).toBe(200);

        expectedResponse = {
            file: [],
            metadata: [],
            cover: [],
            state: [],
            deleted: []
        }

        expect(syncResponse.body).toEqual(expectedResponse);

        const uploadResponse2 = await uploadBook(username, "The_Wonderful_Wizard_of_Oz.epub", { jwt: registerResponse.text });
        expect(uploadResponse2.status).toBe(200);

        // Wait for cover and metadata to be extracted
        await wait(0.5);

        syncResponse = await sync(username, now, { jwt: registerResponse.text });
        expect(syncResponse.status).toBe(200);

        expectedResponse = {
            file: [uploadResponse2.text],
            metadata: [uploadResponse2.text],
            cover: [uploadResponse2.text],
            state: [uploadResponse2.text],
            deleted: []
        }

        expect(syncResponse.body).toEqual(expectedResponse);

        syncResponse = await sync(username, undefined, { jwt: registerResponse.text });
        expect(syncResponse.status).toBe(200);

        expectedResponse = {
            file: [uploadResponse.text, uploadResponse2.text],
            metadata: [uploadResponse.text, uploadResponse2.text],
            cover: [uploadResponse.text, uploadResponse2.text],
            state: [uploadResponse.text, uploadResponse2.text],
            deleted: []
        }

        expect(syncResponse.body).toEqual(expectedResponse);

        now = Date.now();

        syncResponse = await sync(username, now, { jwt: registerResponse.text });
        expect(syncResponse.status).toBe(200);

        expectedResponse = {
            file: [],
            metadata: [],
            cover: [],
            state: [],
            deleted: []
        }

        expect(syncResponse.body).toEqual(expectedResponse);
    });

    test.concurrent("Simple implicit users", async () => {
        const { response: registerResponse, username } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const uploadResponse = await uploadBook(username, "Alices_Adventures_in_Wonderland.epub", { jwt: registerResponse.text });
        expect(uploadResponse.status).toBe(200);

        // Wait for cover and metadata to be extracted
        await wait(0.5);

        let syncResponse = await sync(undefined, undefined, { jwt: registerResponse.text });
        expect(syncResponse.status).toBe(200);

        let expectedResponse = {
            file: [uploadResponse.text],
            metadata: [uploadResponse.text],
            cover: [uploadResponse.text],
            state: [uploadResponse.text],
            deleted: []
        }

        expect(syncResponse.body).toEqual(expectedResponse);

        let now = Date.now();

        syncResponse = await sync(undefined, now, { jwt: registerResponse.text });
        expect(syncResponse.status).toBe(200);

        expectedResponse = {
            file: [],
            metadata: [],
            cover: [],
            state: [],
            deleted: []
        }

        expect(syncResponse.body).toEqual(expectedResponse);

        const uploadResponse2 = await uploadBook(username, "The_Wonderful_Wizard_of_Oz.epub", { jwt: registerResponse.text });
        expect(uploadResponse2.status).toBe(200);

        // Wait for cover and metadata to be extracted
        await wait(0.5);

        syncResponse = await sync(undefined, now, { jwt: registerResponse.text });
        expect(syncResponse.status).toBe(200);

        expectedResponse = {
            file: [uploadResponse2.text],
            metadata: [uploadResponse2.text],
            cover: [uploadResponse2.text],
            state: [uploadResponse2.text],
            deleted: []
        }

        expect(syncResponse.body).toEqual(expectedResponse);

        syncResponse = await sync(undefined, undefined, { jwt: registerResponse.text });
        expect(syncResponse.status).toBe(200);

        expectedResponse = {
            file: [uploadResponse.text, uploadResponse2.text],
            metadata: [uploadResponse.text, uploadResponse2.text],
            cover: [uploadResponse.text, uploadResponse2.text],
            state: [uploadResponse.text, uploadResponse2.text],
            deleted: []
        }

        expect(syncResponse.body).toEqual(expectedResponse);

        now = Date.now();

        syncResponse = await sync(undefined, now, { jwt: registerResponse.text });
        expect(syncResponse.status).toBe(200);

        expectedResponse = {
            file: [],
            metadata: [],
            cover: [],
            state: [],
            deleted: []
        }

        expect(syncResponse.body).toEqual(expectedResponse);
    });

    test.concurrent("Deleted files", async () => {
        const { response: registerResponse, username } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const uploadResponse = await uploadBook(username, "Alices_Adventures_in_Wonderland.epub", { jwt: registerResponse.text });
        expect(uploadResponse.status).toBe(200);

        let syncResponse = await sync(username, undefined, { jwt: registerResponse.text });
        expect(syncResponse.status).toBe(200);

        let expectedResponse = {
            file: [uploadResponse.text],
            metadata: [uploadResponse.text],
            cover: [uploadResponse.text],
            state: [uploadResponse.text],
            deleted: [] as string[]
        }

        expect(syncResponse.body).toEqual(expectedResponse);

        const deleteResponse = await deleteBook(uploadResponse.text, { jwt: registerResponse.text });
        expect(deleteResponse.status).toBe(200);

        syncResponse = await sync(username, undefined, { jwt: registerResponse.text });
        expect(syncResponse.status).toBe(200);

        expectedResponse = {
            file: [],
            metadata: [],
            cover: [],
            state: [],
            deleted: [uploadResponse.text],
        }

        expect(syncResponse.body).toEqual(expectedResponse);

        const uploadResponse2 = await uploadBook(username, "The_Great_Gatsby.epub", { jwt: registerResponse.text });
        expect(uploadResponse2.status).toBe(200);

        const uploadResponse3 = await uploadBook(username, "The_Wonderful_Wizard_of_Oz.epub", { jwt: registerResponse.text });
        expect(uploadResponse3.status).toBe(200);

        syncResponse = await sync(username, undefined, { jwt: registerResponse.text });
        expect(syncResponse.status).toBe(200);

        expectedResponse = {
            file: [uploadResponse2.text, uploadResponse3.text],
            metadata: [uploadResponse2.text, uploadResponse3.text],
            cover: [uploadResponse2.text, uploadResponse3.text],
            state: [uploadResponse2.text, uploadResponse3.text],
            deleted: [uploadResponse.text],
        }

        expect(syncResponse.body).toEqual(expectedResponse);
    });

    test.concurrent("Changed metadata", async () => {
        const { response: registerResponse, username } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const uploadResponse = await uploadBook(username, "Alices_Adventures_in_Wonderland.epub", { jwt: registerResponse.text });
        expect(uploadResponse.status).toBe(200);

        let syncResponse = await sync(username, undefined, { jwt: registerResponse.text });
        expect(syncResponse.status).toBe(200);

        let expectedResponse = {
            file: [uploadResponse.text],
            metadata: [uploadResponse.text],
            cover: [uploadResponse.text],
            state: [uploadResponse.text],
            deleted: [] as string[]
        }

        expect(syncResponse.body).toEqual(expectedResponse);

        // Wait for cover and metadata to be extracted
        await wait(0.5);

        let now = Date.now();

        let metadataResponse = await updateMetadata(uploadResponse.text, EXAMPLE_METADATA, { jwt: registerResponse.text });
        expect(metadataResponse.status).toBe(200);

        syncResponse = await sync(username, now, { jwt: registerResponse.text });
        expect(syncResponse.status).toBe(200);

        expectedResponse = {
            file: [],
            metadata: [uploadResponse.text],
            cover: [],
            state: [],
            deleted: []
        }

        expect(syncResponse.body).toEqual(expectedResponse);

        now = Date.now();

        metadataResponse = await patchMetadata(uploadResponse.text, { title: "title test" }, { jwt: registerResponse.text });
        expect(metadataResponse.status).toBe(200);

        syncResponse = await sync(username, now, { jwt: registerResponse.text });
        expect(syncResponse.status).toBe(200);

        expectedResponse = {
            file: [],
            metadata: [uploadResponse.text],
            cover: [],
            state: [],
            deleted: []
        }

        expect(syncResponse.body).toEqual(expectedResponse);
    });

    test.concurrent("Changed cover", async () => {
        const { response: registerResponse, username } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const uploadResponse = await uploadBook(username, "Alices_Adventures_in_Wonderland.epub", { jwt: registerResponse.text });
        expect(uploadResponse.status).toBe(200);

        let syncResponse = await sync(username, undefined, { jwt: registerResponse.text });
        expect(syncResponse.status).toBe(200);

        let expectedResponse = {
            file: [uploadResponse.text],
            metadata: [uploadResponse.text],
            cover: [uploadResponse.text],
            state: [uploadResponse.text],
            deleted: [] as string[]
        }

        expect(syncResponse.body).toEqual(expectedResponse);

        // Wait for cover and metadata to be extracted
        await wait(0.5);

        let now = Date.now();

        const coverResponse = await updateCover(uploadResponse.text, "Generic.jpeg", { jwt: registerResponse.text });
        expect(coverResponse.status).toBe(200);

        syncResponse = await sync(username, now, { jwt: registerResponse.text });
        expect(syncResponse.status).toBe(200);

        expectedResponse = {
            file: [],
            metadata: [],
            cover: [uploadResponse.text],
            state: [],
            deleted: []
        }

        expect(syncResponse.body).toEqual(expectedResponse);

        const deleteResponse = await deleteBook(uploadResponse.text, { jwt: registerResponse.text });
        expect(deleteResponse.status).toBe(200);

        const uploadResponse2 = await uploadBook(username, "The_Great_Gatsby.epub", { jwt: registerResponse.text });
        expect(uploadResponse2.status).toBe(200);

        syncResponse = await sync(username, now, { jwt: registerResponse.text });
        expect(syncResponse.status).toBe(200);

        expectedResponse = {
            file: [uploadResponse2.text],
            metadata: [uploadResponse2.text],
            cover: [uploadResponse2.text],
            state: [uploadResponse2.text],
            deleted: [uploadResponse.text]
        }

        expect(syncResponse.body).toEqual(expectedResponse);
    });

    test.concurrent("Changed state", async () => {
        const { response: registerResponse, username } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const uploadResponse = await uploadBook(username, "Alices_Adventures_in_Wonderland.epub", { jwt: registerResponse.text });
        expect(uploadResponse.status).toBe(200);

        let syncResponse = await sync(username, undefined, { jwt: registerResponse.text });
        expect(syncResponse.status).toBe(200);

        let expectedResponse = {
            file: [uploadResponse.text],
            metadata: [uploadResponse.text],
            cover: [uploadResponse.text],
            state: [uploadResponse.text],
            deleted: [] as string[]
        }

        expect(syncResponse.body).toEqual(expectedResponse);

        // Wait for cover and metadata to be extracted
        await wait(0.5);

        let now = Date.now();

        let stateResponse = await updateState(uploadResponse.text, ALICE_STATE, { jwt: registerResponse.text });
        expect(stateResponse.status).toBe(200);

        syncResponse = await sync(username, now, { jwt: registerResponse.text });
        expect(syncResponse.status).toBe(200);

        expectedResponse = {
            file: [],
            metadata: [],
            cover: [],
            state: [uploadResponse.text],
            deleted: []
        }

        expect(syncResponse.body).toEqual(expectedResponse);

        now = Date.now();

        stateResponse = await patchState(uploadResponse.text, {statistics: {reading_status: "Read"}}, { jwt: registerResponse.text });
        expect(stateResponse.status).toBe(200);

        syncResponse = await sync(username, now, { jwt: registerResponse.text });
        expect(syncResponse.status).toBe(200);

        expectedResponse = {
            file: [],
            metadata: [],
            cover: [],
            state: [uploadResponse.text],
            deleted: []
        }

        expect(syncResponse.body).toEqual(expectedResponse);
    });

    test.concurrent("Different users", async () => {
        const { response: registerResponse, username } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const uploadResponse = await uploadBook(username, "Alices_Adventures_in_Wonderland.epub", { jwt: registerResponse.text });
        expect(uploadResponse.status).toBe(200);

        const { response: registerResponse2, username: username2 } = await registerUser();
        expect(registerResponse2.status).toBe(200);

        const uploadResponse2 = await uploadBook(username2, "The_Wonderful_Wizard_of_Oz.epub", { jwt: registerResponse2.text });
        expect(uploadResponse2.status).toBe(200);

        let syncResponse = await sync(username, undefined, { jwt: registerResponse.text });
        expect(syncResponse.status).toBe(200);

        let expectedResponse = {
            file: [uploadResponse.text],
            metadata: [uploadResponse.text],
            cover: [uploadResponse.text],
            state: [uploadResponse.text],
            deleted: []
        }

        expect(syncResponse.body).toEqual(expectedResponse);

        syncResponse = await sync(username2, undefined, { jwt: registerResponse2.text });
        expect(syncResponse.status).toBe(200);

        expectedResponse = {
            file: [uploadResponse2.text],
            metadata: [uploadResponse2.text],
            cover: [uploadResponse2.text],
            state: [uploadResponse2.text],
            deleted: []
        }

        expect(syncResponse.body).toEqual(expectedResponse);
    });

    test.concurrent("Different implicit users", async () => {
        const { response: registerResponse, username } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const uploadResponse = await uploadBook(username, "Alices_Adventures_in_Wonderland.epub", { jwt: registerResponse.text });
        expect(uploadResponse.status).toBe(200);

        const { response: registerResponse2, username: username2 } = await registerUser();
        expect(registerResponse2.status).toBe(200);

        const uploadResponse2 = await uploadBook(username2, "The_Wonderful_Wizard_of_Oz.epub", { jwt: registerResponse2.text });
        expect(uploadResponse2.status).toBe(200);

        let syncResponse = await sync(undefined, undefined, { jwt: registerResponse.text });
        expect(syncResponse.status).toBe(200);

        let expectedResponse = {
            file: [uploadResponse.text],
            metadata: [uploadResponse.text],
            cover: [uploadResponse.text],
            state: [uploadResponse.text],
            deleted: []
        }

        expect(syncResponse.body).toEqual(expectedResponse);

        syncResponse = await sync(undefined, undefined, { jwt: registerResponse2.text });
        expect(syncResponse.status).toBe(200);

        expectedResponse = {
            file: [uploadResponse2.text],
            metadata: [uploadResponse2.text],
            cover: [uploadResponse2.text],
            state: [uploadResponse2.text],
            deleted: []
        }

        expect(syncResponse.body).toEqual(expectedResponse);
    });

    test.concurrent("Invalid timestamp", async () => {
        const { response: registerResponse, username } = await registerUser();
        expect(registerResponse.status).toBe(200);

        let syncResponse = await sync(username, "not valid", { jwt: registerResponse.text });
        expect(syncResponse.status).toBe(400);
        expect(syncResponse.text).toBe(INVALID_TIMESTAMP);
    });

    test.concurrent("Non-existent user", async () => {
        const { response: registerResponse } = await registerUser(undefined, undefined, process.env.ADMIN_KEY);
        expect(registerResponse.status).toBe(200);

        let syncResponse = await sync("non-existent", undefined, { jwt: registerResponse.text });
        expect(syncResponse.status).toBe(404);
        expect(syncResponse.text).toBe(USER_NOT_FOUND);
    });

    test.concurrent("Different user without permission", async () => {
        const { response: registerResponse, username } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const { response: registerResponse2 } = await registerUser();
        expect(registerResponse2.status).toBe(200);

        let syncResponse = await sync(username, undefined, { jwt: registerResponse2.text });
        expect(syncResponse.status).toBe(403);
        expect(syncResponse.text).toBe(FORBIDDEN);
    });

    test.concurrent("Different user with permission", async () => {
        const { response: registerResponse, username } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const { response: registerResponse2 } = await registerUser(undefined, undefined, process.env.ADMIN_KEY);
        expect(registerResponse2.status).toBe(200);

        let syncResponse = await sync(username, undefined, { jwt: registerResponse2.text });
        expect(syncResponse.status).toBe(200);
    });

    test.concurrent("No auth", async () => {
        const { response: registerResponse, username } = await registerUser();
        expect(registerResponse.status).toBe(200);

        let syncResponse = await sync(username);
        expect(syncResponse.status).toBe(401);
        expect(syncResponse.text).toBe(UNAUTHORIZED);
    });
});

describe("Sync api key", () => {
    test.concurrent("Simple", async () => {
        const { response: registerResponse, username } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const uploadResponse = await uploadBook(username, "Alices_Adventures_in_Wonderland.epub", { jwt: registerResponse.text });
        expect(uploadResponse.status).toBe(200);

        // Wait for cover and metadata to be extracted
        await wait(0.5);

        const createApiKeyResponse = await createApiKey(username, "Test Key", ["Read"], undefined, { jwt: registerResponse.text });
        expect(createApiKeyResponse.status).toBe(200);

        let syncResponse = await sync(username, undefined, { apiKey: createApiKeyResponse.body.key });
        expect(syncResponse.status).toBe(200);

        let expectedResponse = {
            file: [uploadResponse.text],
            metadata: [uploadResponse.text],
            cover: [uploadResponse.text],
            state: [uploadResponse.text],
            deleted: []
        }

        expect(syncResponse.body).toEqual(expectedResponse);

        let now = Date.now();

        syncResponse = await sync(username, now, { apiKey: createApiKeyResponse.body.key });
        expect(syncResponse.status).toBe(200);

        expectedResponse = {
            file: [],
            metadata: [],
            cover: [],
            state: [],
            deleted: []
        }

        expect(syncResponse.body).toEqual(expectedResponse);

        const uploadResponse2 = await uploadBook(username, "The_Wonderful_Wizard_of_Oz.epub", { jwt: registerResponse.text });
        expect(uploadResponse2.status).toBe(200);

        // Wait for cover and metadata to be extracted
        await wait(0.5);

        syncResponse = await sync(username, now, { apiKey: createApiKeyResponse.body.key });
        expect(syncResponse.status).toBe(200);

        expectedResponse = {
            file: [uploadResponse2.text],
            metadata: [uploadResponse2.text],
            cover: [uploadResponse2.text],
            state: [uploadResponse2.text],
            deleted: []
        }

        expect(syncResponse.body).toEqual(expectedResponse);

        syncResponse = await sync(username, undefined, { apiKey: createApiKeyResponse.body.key });
        expect(syncResponse.status).toBe(200);

        expectedResponse = {
            file: [uploadResponse.text, uploadResponse2.text],
            metadata: [uploadResponse.text, uploadResponse2.text],
            cover: [uploadResponse.text, uploadResponse2.text],
            state: [uploadResponse.text, uploadResponse2.text],
            deleted: []
        }

        expect(syncResponse.body).toEqual(expectedResponse);

        now = Date.now();

        syncResponse = await sync(username, now, { apiKey: createApiKeyResponse.body.key });
        expect(syncResponse.status).toBe(200);

        expectedResponse = {
            file: [],
            metadata: [],
            cover: [],
            state: [],
            deleted: []
        }

        expect(syncResponse.body).toEqual(expectedResponse);
    });

    test.concurrent("Simple implicit users", async () => {
        const { response: registerResponse, username } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const uploadResponse = await uploadBook(username, "Alices_Adventures_in_Wonderland.epub", { jwt: registerResponse.text });
        expect(uploadResponse.status).toBe(200);

        // Wait for cover and metadata to be extracted
        await wait(0.5);

        const createApiKeyResponse = await createApiKey(username, "Test Key", ["Read"], undefined, { jwt: registerResponse.text });
        expect(createApiKeyResponse.status).toBe(200);

        let syncResponse = await sync(undefined, undefined, { apiKey: createApiKeyResponse.body.key });
        expect(syncResponse.status).toBe(200);

        let expectedResponse = {
            file: [uploadResponse.text],
            metadata: [uploadResponse.text],
            cover: [uploadResponse.text],
            state: [uploadResponse.text],
            deleted: []
        }

        expect(syncResponse.body).toEqual(expectedResponse);

        let now = Date.now();

        syncResponse = await sync(undefined, now, { apiKey: createApiKeyResponse.body.key });
        expect(syncResponse.status).toBe(200);

        expectedResponse = {
            file: [],
            metadata: [],
            cover: [],
            state: [],
            deleted: []
        }

        expect(syncResponse.body).toEqual(expectedResponse);

        const uploadResponse2 = await uploadBook(username, "The_Wonderful_Wizard_of_Oz.epub", { jwt: registerResponse.text });
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
            deleted: []
        }

        expect(syncResponse.body).toEqual(expectedResponse);

        syncResponse = await sync(undefined, undefined, { apiKey: createApiKeyResponse.body.key });
        expect(syncResponse.status).toBe(200);

        expectedResponse = {
            file: [uploadResponse.text, uploadResponse2.text],
            metadata: [uploadResponse.text, uploadResponse2.text],
            cover: [uploadResponse.text, uploadResponse2.text],
            state: [uploadResponse.text, uploadResponse2.text],
            deleted: []
        }

        expect(syncResponse.body).toEqual(expectedResponse);

        now = Date.now();

        syncResponse = await sync(undefined, now, { apiKey: createApiKeyResponse.body.key });
        expect(syncResponse.status).toBe(200);

        expectedResponse = {
            file: [],
            metadata: [],
            cover: [],
            state: [],
            deleted: []
        }

        expect(syncResponse.body).toEqual(expectedResponse);
    });

    test.concurrent("Deleted files", async () => {
        const { response: registerResponse, username } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const uploadResponse = await uploadBook(username, "Alices_Adventures_in_Wonderland.epub", { jwt: registerResponse.text });
        expect(uploadResponse.status).toBe(200);

        const createApiKeyResponse = await createApiKey(username, "Test Key", ["Read"], undefined, { jwt: registerResponse.text });
        expect(createApiKeyResponse.status).toBe(200);

        let syncResponse = await sync(username, undefined, { apiKey: createApiKeyResponse.body.key });
        expect(syncResponse.status).toBe(200);

        let expectedResponse = {
            file: [uploadResponse.text],
            metadata: [uploadResponse.text],
            cover: [uploadResponse.text],
            state: [uploadResponse.text],
            deleted: [] as string[]
        }

        expect(syncResponse.body).toEqual(expectedResponse);

        const deleteResponse = await deleteBook(uploadResponse.text, { jwt: registerResponse.text });
        expect(deleteResponse.status).toBe(200);

        syncResponse = await sync(username, undefined, { apiKey: createApiKeyResponse.body.key });
        expect(syncResponse.status).toBe(200);

        expectedResponse = {
            file: [],
            metadata: [],
            cover: [],
            state: [],
            deleted: [uploadResponse.text],
        }

        expect(syncResponse.body).toEqual(expectedResponse);

        const uploadResponse2 = await uploadBook(username, "The_Great_Gatsby.epub", { jwt: registerResponse.text });
        expect(uploadResponse2.status).toBe(200);

        const uploadResponse3 = await uploadBook(username, "The_Wonderful_Wizard_of_Oz.epub", { jwt: registerResponse.text });
        expect(uploadResponse3.status).toBe(200);

        syncResponse = await sync(username, undefined, { apiKey: createApiKeyResponse.body.key });
        expect(syncResponse.status).toBe(200);

        expectedResponse = {
            file: [uploadResponse2.text, uploadResponse3.text],
            metadata: [uploadResponse2.text, uploadResponse3.text],
            cover: [uploadResponse2.text, uploadResponse3.text],
            state: [uploadResponse2.text, uploadResponse3.text],
            deleted: [uploadResponse.text],
        }

        expect(syncResponse.body).toEqual(expectedResponse);
    });

    test.concurrent("Changed metadata", async () => {
        const { response: registerResponse, username } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const uploadResponse = await uploadBook(username, "Alices_Adventures_in_Wonderland.epub", { jwt: registerResponse.text });
        expect(uploadResponse.status).toBe(200);

        const createApiKeyResponse = await createApiKey(username, "Test Key", ["Read"], undefined, { jwt: registerResponse.text });
        expect(createApiKeyResponse.status).toBe(200);

        let syncResponse = await sync(username, undefined, { apiKey: createApiKeyResponse.body.key });
        expect(syncResponse.status).toBe(200);

        let expectedResponse = {
            file: [uploadResponse.text],
            metadata: [uploadResponse.text],
            cover: [uploadResponse.text],
            state: [uploadResponse.text],
            deleted: [] as string[]
        }

        expect(syncResponse.body).toEqual(expectedResponse);

        // Wait for cover and metadata to be extracted
        await wait(0.5);

        let now = Date.now();

        const metadataResponse = await updateMetadata(uploadResponse.text, EXAMPLE_METADATA, { jwt: registerResponse.text });
        expect(metadataResponse.status).toBe(200);

        syncResponse = await sync(username, now, { apiKey: createApiKeyResponse.body.key });
        expect(syncResponse.status).toBe(200);

        expectedResponse = {
            file: [],
            metadata: [uploadResponse.text],
            cover: [],
            state: [],
            deleted: []
        }

        expect(syncResponse.body).toEqual(expectedResponse);

        now = Date.now();

        syncResponse = await patchMetadata(uploadResponse.text, { title: "title test" }, { jwt: registerResponse.text });
        expect(metadataResponse.status).toBe(200);

        syncResponse = await sync(username, now, { apiKey: createApiKeyResponse.body.key });
        expect(syncResponse.status).toBe(200);

        expectedResponse = {
            file: [],
            metadata: [uploadResponse.text],
            cover: [],
            state: [],
            deleted: []
        }

        expect(syncResponse.body).toEqual(expectedResponse);
    });

    test.concurrent("Changed cover", async () => {
        const { response: registerResponse, username } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const uploadResponse = await uploadBook(username, "Alices_Adventures_in_Wonderland.epub", { jwt: registerResponse.text });
        expect(uploadResponse.status).toBe(200);

        const createApiKeyResponse = await createApiKey(username, "Test Key", ["Read"], undefined, { jwt: registerResponse.text });
        expect(createApiKeyResponse.status).toBe(200);

        let syncResponse = await sync(username, undefined, { apiKey: createApiKeyResponse.body.key });
        expect(syncResponse.status).toBe(200);

        let expectedResponse = {
            file: [uploadResponse.text],
            metadata: [uploadResponse.text],
            cover: [uploadResponse.text],
            state: [uploadResponse.text],
            deleted: [] as string[]
        }

        expect(syncResponse.body).toEqual(expectedResponse);

        // Wait for cover and metadata to be extracted
        await wait(0.5);

        let now = Date.now();

        const coverResponse = await updateCover(uploadResponse.text, "Generic.jpeg", { jwt: registerResponse.text });
        expect(coverResponse.status).toBe(200);

        syncResponse = await sync(username, now, { apiKey: createApiKeyResponse.body.key });
        expect(syncResponse.status).toBe(200);

        expectedResponse = {
            file: [],
            metadata: [],
            cover: [uploadResponse.text],
            state: [],
            deleted: []
        }

        expect(syncResponse.body).toEqual(expectedResponse);

        const deleteResponse = await deleteBook(uploadResponse.text, { jwt: registerResponse.text });
        expect(deleteResponse.status).toBe(200);

        const uploadResponse2 = await uploadBook(username, "The_Great_Gatsby.epub", { jwt: registerResponse.text });
        expect(uploadResponse2.status).toBe(200);

        syncResponse = await sync(username, now, { apiKey: createApiKeyResponse.body.key });
        expect(syncResponse.status).toBe(200);

        expectedResponse = {
            file: [uploadResponse2.text],
            metadata: [uploadResponse2.text],
            cover: [uploadResponse2.text],
            state: [uploadResponse2.text],
            deleted: [uploadResponse.text]
        }

        expect(syncResponse.body).toEqual(expectedResponse);
    });

    test.concurrent("Changed state", async () => {
        const { response: registerResponse, username } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const uploadResponse = await uploadBook(username, "Alices_Adventures_in_Wonderland.epub", { jwt: registerResponse.text });
        expect(uploadResponse.status).toBe(200);

        const createApiKeyResponse = await createApiKey(username, "Test Key", ["Read"], undefined, { jwt: registerResponse.text });
        expect(createApiKeyResponse.status).toBe(200);

        let syncResponse = await sync(username, undefined, { apiKey: createApiKeyResponse.body.key });
        expect(syncResponse.status).toBe(200);

        let expectedResponse = {
            file: [uploadResponse.text],
            metadata: [uploadResponse.text],
            cover: [uploadResponse.text],
            state: [uploadResponse.text],
            deleted: [] as string[]
        }

        expect(syncResponse.body).toEqual(expectedResponse);

        // Wait for cover and metadata to be extracted
        await wait(0.5);

        let now = Date.now();

        let stateResponse = await updateState(uploadResponse.text, ALICE_STATE, { jwt: registerResponse.text });
        expect(stateResponse.status).toBe(200);

        syncResponse = await sync(username, now, { apiKey: createApiKeyResponse.body.key });
        expect(syncResponse.status).toBe(200);

        expectedResponse = {
            file: [],
            metadata: [],
            cover: [],
            state: [uploadResponse.text],
            deleted: []
        }

        expect(syncResponse.body).toEqual(expectedResponse);

        now = Date.now();

        stateResponse = await patchState(uploadResponse.text, {statistics: {reading_status: "Read"}}, { jwt: registerResponse.text });
        expect(stateResponse.status).toBe(200);

        syncResponse = await sync(username, now, { apiKey: createApiKeyResponse.body.key });
        expect(syncResponse.status).toBe(200);

        expectedResponse = {
            file: [],
            metadata: [],
            cover: [],
            state: [uploadResponse.text],
            deleted: []
        }

        expect(syncResponse.body).toEqual(expectedResponse);
    });

    test.concurrent("Different users", async () => {
        const { response: registerResponse, username } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const createApiKeyResponse = await createApiKey(username, "Test Key", ["Read"], undefined, { jwt: registerResponse.text });
        expect(createApiKeyResponse.status).toBe(200);

        const uploadResponse = await uploadBook(username, "Alices_Adventures_in_Wonderland.epub", { jwt: registerResponse.text });
        expect(uploadResponse.status).toBe(200);

        const { response: registerResponse2, username: username2 } = await registerUser();
        expect(registerResponse2.status).toBe(200);

        const createApiKeyResponse2 = await createApiKey(username2, "Test Key", ["Read"], undefined, { jwt: registerResponse2.text });
        expect(createApiKeyResponse2.status).toBe(200);

        const uploadResponse2 = await uploadBook(username2, "The_Wonderful_Wizard_of_Oz.epub", { jwt: registerResponse2.text });
        expect(uploadResponse2.status).toBe(200);

        let syncResponse = await sync(username, undefined, { apiKey: createApiKeyResponse.body.key });
        expect(syncResponse.status).toBe(200);

        let expectedResponse = {
            file: [uploadResponse.text],
            metadata: [uploadResponse.text],
            cover: [uploadResponse.text],
            state: [uploadResponse.text],
            deleted: []
        }

        expect(syncResponse.body).toEqual(expectedResponse);

        syncResponse = await sync(username2, undefined, { apiKey: createApiKeyResponse2.body.key });
        expect(syncResponse.status).toBe(200);

        expectedResponse = {
            file: [uploadResponse2.text],
            metadata: [uploadResponse2.text],
            cover: [uploadResponse2.text],
            state: [uploadResponse2.text],
            deleted: []
        }

        expect(syncResponse.body).toEqual(expectedResponse);
    });

    test.concurrent("Different implicit users", async () => {
        const { response: registerResponse, username } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const createApiKeyResponse = await createApiKey(username, "Test Key", ["Read"], undefined, { jwt: registerResponse.text });
        expect(createApiKeyResponse.status).toBe(200);

        const uploadResponse = await uploadBook(username, "Alices_Adventures_in_Wonderland.epub", { jwt: registerResponse.text });
        expect(uploadResponse.status).toBe(200);

        const { response: registerResponse2, username: username2 } = await registerUser();
        expect(registerResponse2.status).toBe(200);

        const createApiKeyResponse2 = await createApiKey(username2, "Test Key", ["Read"], undefined, { jwt: registerResponse2.text });
        expect(createApiKeyResponse2.status).toBe(200);

        const uploadResponse2 = await uploadBook(username2, "The_Wonderful_Wizard_of_Oz.epub", { jwt: registerResponse2.text });
        expect(uploadResponse2.status).toBe(200);

        let syncResponse = await sync(undefined, undefined, { apiKey: createApiKeyResponse.body.key });
        expect(syncResponse.status).toBe(200);

        let expectedResponse = {
            file: [uploadResponse.text],
            metadata: [uploadResponse.text],
            cover: [uploadResponse.text],
            state: [uploadResponse.text],
            deleted: []
        }

        expect(syncResponse.body).toEqual(expectedResponse);

        syncResponse = await sync(undefined, undefined, { apiKey: createApiKeyResponse2.body.key });
        expect(syncResponse.status).toBe(200);

        expectedResponse = {
            file: [uploadResponse2.text],
            metadata: [uploadResponse2.text],
            cover: [uploadResponse2.text],
            state: [uploadResponse2.text],
            deleted: []
        }

        expect(syncResponse.body).toEqual(expectedResponse);
    });

    test.concurrent("Invalid timestamp", async () => {
        const { response: registerResponse, username } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const createApiKeyResponse = await createApiKey(username, "Test Key", ["Read"], undefined, { jwt: registerResponse.text });
        expect(createApiKeyResponse.status).toBe(200);

        let syncResponse = await sync(username, "not valid", { apiKey: createApiKeyResponse.body.key });
        expect(syncResponse.status).toBe(400);
        expect(syncResponse.text).toBe(INVALID_TIMESTAMP);
    });

    test.concurrent("Non-existent user", async () => {
        const { response: registerResponse, username } = await registerUser(undefined, undefined, process.env.ADMIN_KEY);
        expect(registerResponse.status).toBe(200);

        const createApiKeyResponse = await createApiKey(username, "Test Key", ["Read"], undefined, { jwt: registerResponse.text });
        expect(createApiKeyResponse.status).toBe(200);

        let syncResponse = await sync("ghost", undefined, { apiKey: createApiKeyResponse.body.key });
        expect(syncResponse.status).toBe(404);
        expect(syncResponse.text).toBe(USER_NOT_FOUND);
    });

    test.concurrent("Different user without permission", async () => {
        const { response: registerResponse, username } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const { response: registerResponse2, username: username2 } = await registerUser();
        expect(registerResponse2.status).toBe(200);

        const createApiKeyResponse = await createApiKey(username2, "Test Key", ["Read"], undefined, { jwt: registerResponse2.text });
        expect(createApiKeyResponse.status).toBe(200);

        let syncResponse = await sync(username, undefined, { apiKey: createApiKeyResponse.body.key });
        expect(syncResponse.status).toBe(403);
        expect(syncResponse.text).toBe(FORBIDDEN);
    });

    test.concurrent("Different user with permission", async () => {
        const { response: registerResponse, username } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const { response: registerResponse2, username: username2 } = await registerUser(undefined, undefined, process.env.ADMIN_KEY);
        expect(registerResponse2.status).toBe(200);

        const createApiKeyResponse = await createApiKey(username2, "Test Key", ["Read"], undefined, { jwt: registerResponse2.text });
        expect(createApiKeyResponse.status).toBe(200);

        let syncResponse = await sync(username, undefined, { apiKey: createApiKeyResponse.body.key });
        expect(syncResponse.status).toBe(200);
    });

    test.concurrent("Wrong capabilities", async () => {
        const { response: registerResponse, username } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const createApiKeyResponse = await createApiKey(username, "Test Key", ["Delete", "Create", "Update"], undefined, { jwt: registerResponse.text });
        expect(createApiKeyResponse.status).toBe(200);

        let syncResponse = await sync(username, undefined, { apiKey: createApiKeyResponse.body.key });
        expect(syncResponse.status).toBe(403);
        expect(syncResponse.text).toBe(FORBIDDEN);
    });

    test.concurrent("Expired key", async () => {
        const { response: registerResponse, username } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const timestamp = Date.now() + 2000;
        const createApiKeyResponse = await createApiKey(username, "Test Key", ["Read"], timestamp, { jwt: registerResponse.text });
        expect(createApiKeyResponse.status).toBe(200);

        // Wait for the key to expire
        await wait(2.5);

        let syncResponse = await sync(username, undefined, { apiKey: createApiKeyResponse.body.key });
        expect(syncResponse.status).toBe(401);
        expect(syncResponse.text).toBe(INVALID_API_KEY);
    });
});