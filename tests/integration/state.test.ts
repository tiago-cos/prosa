import { FORBIDDEN, INVALID_API_KEY, UNAUTHORIZED, wait } from "../utils/common";
import { registerUser, createApiKey } from "../utils/users"
import { BOOK_NOT_FOUND, uploadBook } from "../utils/books"
import { ALICE_STATE, EMPTY_STATE, getState, INVALID_LOCATION, INVALID_RATING, patchState, updateState } from "../utils/state"

describe("Get state JWT", () => {
    test.concurrent("Get state", async () => {
        const { response: registerResponse, username } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const uploadResponse = await uploadBook(username, "Alices_Adventures_in_Wonderland.epub", { jwt: registerResponse.text });
        expect(uploadResponse.status).toBe(200);

        const downloadResponse = await getState(uploadResponse.text, { jwt: registerResponse.text });
        expect(downloadResponse.status).toBe(200);

        expect(downloadResponse.body).toEqual(EMPTY_STATE);
    });

    test.concurrent("Get state from non-existent book", async () => {
        const { response: registerResponse } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const downloadResponse = await getState("non-existent", { jwt: registerResponse.text });
        expect(downloadResponse.status).toBe(404);
        expect(downloadResponse.text).toBe(BOOK_NOT_FOUND);
    });

    test.concurrent("Get state | Different user | !admin", async () => {
        const { response: registerResponse, username } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const uploadResponse = await uploadBook(username, "Alices_Adventures_in_Wonderland.epub", { jwt: registerResponse.text });
        expect(uploadResponse.status).toBe(200);

        const { response: registerResponse2 } = await registerUser();
        expect(registerResponse2.status).toBe(200);

        const downloadResponse = await getState(uploadResponse.text, { jwt: registerResponse2.text });
        expect(downloadResponse.status).toBe(404);
        expect(downloadResponse.text).toBe(BOOK_NOT_FOUND);
    });

    test.concurrent("Get state | Different user | admin", async () => {
        const { response: registerResponse, username } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const uploadResponse = await uploadBook(username, "Alices_Adventures_in_Wonderland.epub", { jwt: registerResponse.text });
        expect(uploadResponse.status).toBe(200);

        const { response: registerResponse2 } = await registerUser(undefined, undefined, process.env.ADMIN_KEY);
        expect(registerResponse2.status).toBe(200);

        const downloadResponse = await getState(uploadResponse.text, { jwt: registerResponse2.text });
        expect(downloadResponse.status).toBe(200);
    });

    test.concurrent("Get state no auth", async () => {
        const { response: registerResponse, username } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const uploadResponse = await uploadBook(username, "Alices_Adventures_in_Wonderland.epub", { jwt: registerResponse.text });
        expect(uploadResponse.status).toBe(200);

        const downloadResponse = await getState(uploadResponse.text);
        expect(downloadResponse.status).toBe(401);
        expect(downloadResponse.text).toBe(UNAUTHORIZED);
    });
});

describe("Get state api key", () => {
    test.concurrent("Get state", async () => {
        const { response: registerResponse, username } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const uploadResponse = await uploadBook(username, "Alices_Adventures_in_Wonderland.epub", { jwt: registerResponse.text });
        expect(uploadResponse.status).toBe(200);

        const createApiKeyResponse = await createApiKey(username, "Test Key", ["Read"], undefined, { jwt: registerResponse.text });
        expect(createApiKeyResponse.status).toBe(200);

        const downloadResponse = await getState(uploadResponse.text, { apiKey: createApiKeyResponse.body.key });
        expect(downloadResponse.status).toBe(200);

        expect(downloadResponse.body).toEqual(EMPTY_STATE);
    });

    test.concurrent("Get state from non-existent book", async () => {
        const { response: registerResponse, username } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const createApiKeyResponse = await createApiKey(username, "Test Key", ["Read"], undefined, { jwt: registerResponse.text });
        expect(createApiKeyResponse.status).toBe(200);

        const downloadResponse = await getState("non-existent", { apiKey: createApiKeyResponse.body.key });
        expect(downloadResponse.status).toBe(404);
        expect(downloadResponse.text).toBe(BOOK_NOT_FOUND);
    });

    test.concurrent("Get state | Different user | !admin", async () => {
        const { response: registerResponse, username } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const uploadResponse = await uploadBook(username, "Alices_Adventures_in_Wonderland.epub", { jwt: registerResponse.text });
        expect(uploadResponse.status).toBe(200);

        const { response: registerResponse2, username: username2 } = await registerUser();
        expect(registerResponse2.status).toBe(200);

        const createApiKeyResponse = await createApiKey(username2, "Test Key", ["Read"], undefined, { jwt: registerResponse2.text });
        expect(createApiKeyResponse.status).toBe(200);

        const downloadResponse = await getState(uploadResponse.text, { apiKey: createApiKeyResponse.body.key });
        expect(downloadResponse.status).toBe(404);
        expect(downloadResponse.text).toBe(BOOK_NOT_FOUND);
    });

    test.concurrent("Get state | Different user | admin", async () => {
        const { response: registerResponse, username } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const uploadResponse = await uploadBook(username, "Alices_Adventures_in_Wonderland.epub", { jwt: registerResponse.text });
        expect(uploadResponse.status).toBe(200);

        const { response: registerResponse2, username: username2 } = await registerUser(undefined, undefined, process.env.ADMIN_KEY);
        expect(registerResponse2.status).toBe(200);

        const createApiKeyResponse = await createApiKey(username2, "Test Key", ["Read"], undefined, { jwt: registerResponse2.text });
        expect(createApiKeyResponse.status).toBe(200);

        const downloadResponse = await getState(uploadResponse.text, { apiKey: createApiKeyResponse.body.key });
        expect(downloadResponse.status).toBe(200);
    });

    test.concurrent("Get state wrong capabilities", async () => {
        const { response: registerResponse, username } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const uploadResponse = await uploadBook(username, "Alices_Adventures_in_Wonderland.epub", { jwt: registerResponse.text });
        expect(uploadResponse.status).toBe(200);

        const createApiKeyResponse = await createApiKey(username, "Test Key", ["Create", "Update", "Delete"], undefined, { jwt: registerResponse.text });
        expect(createApiKeyResponse.status).toBe(200);

        const downloadResponse = await getState(uploadResponse.text, { apiKey: createApiKeyResponse.body.key });
        expect(downloadResponse.status).toBe(403);
        expect(downloadResponse.text).toBe(FORBIDDEN);
    });

    test.concurrent("Get state expired api key", async () => {
        const { response: registerResponse, username } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const uploadResponse = await uploadBook(username, "Alices_Adventures_in_Wonderland.epub", { jwt: registerResponse.text });
        expect(uploadResponse.status).toBe(200);

        const timestamp = new Date(Date.now() + 2000).toISOString();
        const createApiKeyResponse = await createApiKey(username, "Test Key", ["Read"], timestamp, { jwt: registerResponse.text });
        expect(createApiKeyResponse.status).toBe(200);

        // Wait for the key to expire
        await wait(2.5);

        const downloadResponse = await getState(uploadResponse.text, { apiKey: createApiKeyResponse.body.key });
        expect(downloadResponse.status).toBe(401);
        expect(downloadResponse.text).toBe(INVALID_API_KEY);
    });
});

describe("Update state JWT", () => {
    test.concurrent("Update state", async () => {
        const { response: registerResponse, username } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const uploadResponse = await uploadBook(username, "Alices_Adventures_in_Wonderland.epub", { jwt: registerResponse.text });
        expect(uploadResponse.status).toBe(200);

        const downloadResponse = await getState(uploadResponse.text, { jwt: registerResponse.text });
        expect(downloadResponse.status).toBe(200);

        expect(downloadResponse.body).toEqual(EMPTY_STATE);

        const updateResponse = await updateState(uploadResponse.text, ALICE_STATE, { jwt: registerResponse.text });
        expect(updateResponse.status).toBe(200);

        const downloadResponse2 = await getState(uploadResponse.text, { jwt: registerResponse.text });
        expect(downloadResponse2.status).toBe(200);

        expect(downloadResponse2.body).toEqual(ALICE_STATE);

        const updateResponse2 = await updateState(uploadResponse.text, { statistics: { rating: 2.1 } }, { jwt: registerResponse.text });
        expect(updateResponse2.status).toBe(200);

        const downloadResponse3 = await getState(uploadResponse.text, { jwt: registerResponse.text });
        expect(downloadResponse3.status).toBe(200);

        expect(downloadResponse3.body).toEqual({ statistics: { rating: 2.1 } });

        const updateResponse3 = await updateState(uploadResponse.text, {}, { jwt: registerResponse.text });
        expect(updateResponse3.status).toBe(200);

        const downloadResponse4 = await getState(uploadResponse.text, { jwt: registerResponse.text });
        expect(downloadResponse4.status).toBe(200);

        expect(downloadResponse4.body).toEqual({});
    });

    test.concurrent("Update state from non-existent book", async () => {
        const { response: registerResponse } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const updateResponse = await updateState("non-existent", ALICE_STATE, { jwt: registerResponse.text });
        expect(updateResponse.status).toBe(404);
        expect(updateResponse.text).toBe(BOOK_NOT_FOUND);
    });

    test.concurrent("Update invalid state", async () => {
        const { response: registerResponse, username } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const uploadResponse = await uploadBook(username, "Alices_Adventures_in_Wonderland.epub", { jwt: registerResponse.text });
        expect(uploadResponse.status).toBe(200);

        let invalid = structuredClone(ALICE_STATE);
        invalid.statistics.rating = 9;

        const updateResponse = await updateState(uploadResponse.text, invalid, { jwt: registerResponse.text });
        expect(updateResponse.status).toBe(400);
        expect(updateResponse.text).toBe(INVALID_RATING);

        invalid.statistics.rating = 4.5;
        invalid.location.tag = "invalid";

        const updateResponse2 = await updateState(uploadResponse.text, invalid, { jwt: registerResponse.text });
        expect(updateResponse2.status).toBe(400);
        expect(updateResponse2.text).toBe(INVALID_LOCATION);

        invalid.location.tag = "kobo.1.1";
        invalid.location.source = "invalid";

        const updateResponse3 = await updateState(uploadResponse.text, invalid, { jwt: registerResponse.text });
        expect(updateResponse3.status).toBe(400);
        expect(updateResponse3.text).toBe(INVALID_LOCATION);

        const updateResponse4 = await updateState(uploadResponse.text, { statistics: {} }, { jwt: registerResponse.text });
        expect(updateResponse4.status).toBe(400);
        expect(updateResponse4.text).toBe(INVALID_RATING);

        const updateResponse5 = await updateState(uploadResponse.text, { location: { tag: "kobo.1.1" } }, { jwt: registerResponse.text });
        expect(updateResponse5.status).toBe(400);
        expect(updateResponse5.text).toBe(INVALID_LOCATION);

        const updateResponse6 = await updateState(uploadResponse.text, { location: {}, statistics: {} }, { jwt: registerResponse.text });
        expect(updateResponse6.status).toBe(400);
        expect(updateResponse6.text).toBe(INVALID_RATING);
    });

    test.concurrent("Update state | Different user | !admin", async () => {
        const { response: registerResponse, username } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const uploadResponse = await uploadBook(username, "Alices_Adventures_in_Wonderland.epub", { jwt: registerResponse.text });
        expect(uploadResponse.status).toBe(200);

        const { response: registerResponse2 } = await registerUser();
        expect(registerResponse2.status).toBe(200);

        const updateResponse = await updateState(uploadResponse.text, ALICE_STATE, { jwt: registerResponse2.text });
        expect(updateResponse.status).toBe(404);
        expect(updateResponse.text).toBe(BOOK_NOT_FOUND);
    });

    test.concurrent("Update state | Different user | admin", async () => {
        const { response: registerResponse, username } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const uploadResponse = await uploadBook(username, "Alices_Adventures_in_Wonderland.epub", { jwt: registerResponse.text });
        expect(uploadResponse.status).toBe(200);

        const { response: registerResponse2 } = await registerUser(undefined, undefined, process.env.ADMIN_KEY);
        expect(registerResponse2.status).toBe(200);

        const updateResponse = await updateState(uploadResponse.text, ALICE_STATE, { jwt: registerResponse2.text });
        expect(updateResponse.status).toBe(200);
    });

    test.concurrent("Update state no auth", async () => {
        const { response: registerResponse, username } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const uploadResponse = await uploadBook(username, "Alices_Adventures_in_Wonderland.epub", { jwt: registerResponse.text });
        expect(uploadResponse.status).toBe(200);

        const downloadResponse = await updateState(uploadResponse.text, ALICE_STATE);
        expect(downloadResponse.status).toBe(401);
        expect(downloadResponse.text).toBe(UNAUTHORIZED);
    });
});

describe("Update state api key", () => {
    test.concurrent("Update state", async () => {
        const { response: registerResponse, username } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const uploadResponse = await uploadBook(username, "Alices_Adventures_in_Wonderland.epub", { jwt: registerResponse.text });
        expect(uploadResponse.status).toBe(200);

        const downloadResponse = await getState(uploadResponse.text, { jwt: registerResponse.text });
        expect(downloadResponse.status).toBe(200);

        expect(downloadResponse.body).toEqual(EMPTY_STATE);

        const createApiKeyResponse = await createApiKey(username, "Test Key", ["Update"], undefined, { jwt: registerResponse.text });
        expect(createApiKeyResponse.status).toBe(200);

        const updateResponse = await updateState(uploadResponse.text, ALICE_STATE, { apiKey: createApiKeyResponse.body.key });
        expect(updateResponse.status).toBe(200);

        const downloadResponse2 = await getState(uploadResponse.text, { jwt: registerResponse.text });
        expect(downloadResponse2.status).toBe(200);

        expect(downloadResponse2.body).toEqual(ALICE_STATE);

        const updateResponse2 = await updateState(uploadResponse.text, { statistics: { rating: 2.1 } }, { apiKey: createApiKeyResponse.body.key });
        expect(updateResponse2.status).toBe(200);

        const downloadResponse3 = await getState(uploadResponse.text, { jwt: registerResponse.text });
        expect(downloadResponse3.status).toBe(200);

        expect(downloadResponse3.body).toEqual({ statistics: { rating: 2.1 } });

        const updateResponse3 = await updateState(uploadResponse.text, {}, { apiKey: createApiKeyResponse.body.key });
        expect(updateResponse3.status).toBe(200);

        const downloadResponse4 = await getState(uploadResponse.text, { jwt: registerResponse.text });
        expect(downloadResponse4.status).toBe(200);

        expect(downloadResponse4.body).toEqual({});
    });

    test.concurrent("Update state from non-existent book", async () => {
        const { response: registerResponse, username } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const createApiKeyResponse = await createApiKey(username, "Test Key", ["Update"], undefined, { jwt: registerResponse.text });
        expect(createApiKeyResponse.status).toBe(200);

        const updateResponse = await updateState("non-existent", ALICE_STATE, { apiKey: createApiKeyResponse.body.key });
        expect(updateResponse.status).toBe(404);
        expect(updateResponse.text).toBe(BOOK_NOT_FOUND);
    });

    test.concurrent("Update invalid state", async () => {
        const { response: registerResponse, username } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const uploadResponse = await uploadBook(username, "Alices_Adventures_in_Wonderland.epub", { jwt: registerResponse.text });
        expect(uploadResponse.status).toBe(200);

        const createApiKeyResponse = await createApiKey(username, "Test Key", ["Update"], undefined, { jwt: registerResponse.text });
        expect(createApiKeyResponse.status).toBe(200);

        let invalid = structuredClone(ALICE_STATE);
        invalid.statistics.rating = 9;

        const updateResponse = await updateState(uploadResponse.text, invalid, { apiKey: createApiKeyResponse.body.key });
        expect(updateResponse.status).toBe(400);
        expect(updateResponse.text).toBe(INVALID_RATING);

        invalid.statistics.rating = 4.5;
        invalid.location.tag = "invalid";

        const updateResponse2 = await updateState(uploadResponse.text, invalid, { apiKey: createApiKeyResponse.body.key });
        expect(updateResponse2.status).toBe(400);
        expect(updateResponse2.text).toBe(INVALID_LOCATION);

        invalid.location.tag = "kobo.1.1";
        invalid.location.source = "invalid";

        const updateResponse3 = await updateState(uploadResponse.text, invalid, { apiKey: createApiKeyResponse.body.key });
        expect(updateResponse3.status).toBe(400);
        expect(updateResponse3.text).toBe(INVALID_LOCATION);

        const updateResponse4 = await updateState(uploadResponse.text, { statistics: {} }, { apiKey: createApiKeyResponse.body.key });
        expect(updateResponse4.status).toBe(400);
        expect(updateResponse4.text).toBe(INVALID_RATING);

        const updateResponse5 = await updateState(uploadResponse.text, { location: { tag: "kobo.1.1" } }, { apiKey: createApiKeyResponse.body.key });
        expect(updateResponse5.status).toBe(400);
        expect(updateResponse5.text).toBe(INVALID_LOCATION);

        const updateResponse6 = await updateState(uploadResponse.text, { location: {}, statistics: {} }, { apiKey: createApiKeyResponse.body.key });
        expect(updateResponse6.status).toBe(400);
        expect(updateResponse6.text).toBe(INVALID_RATING);
    });

    test.concurrent("Update state | Different user | !admin", async () => {
        const { response: registerResponse, username } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const uploadResponse = await uploadBook(username, "Alices_Adventures_in_Wonderland.epub", { jwt: registerResponse.text });
        expect(uploadResponse.status).toBe(200);

        const { response: registerResponse2, username: username2 } = await registerUser();
        expect(registerResponse2.status).toBe(200);

        const createApiKeyResponse = await createApiKey(username2, "Test Key", ["Update"], undefined, { jwt: registerResponse2.text });
        expect(createApiKeyResponse.status).toBe(200);

        const updateResponse = await updateState(uploadResponse.text, ALICE_STATE, { apiKey: createApiKeyResponse.body.key });
        expect(updateResponse.status).toBe(404);
        expect(updateResponse.text).toBe(BOOK_NOT_FOUND);
    });

    test.concurrent("Update state | Different user | admin", async () => {
        const { response: registerResponse, username } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const uploadResponse = await uploadBook(username, "Alices_Adventures_in_Wonderland.epub", { jwt: registerResponse.text });
        expect(uploadResponse.status).toBe(200);

        const { response: registerResponse2, username: username2 } = await registerUser(undefined, undefined, process.env.ADMIN_KEY);
        expect(registerResponse2.status).toBe(200);

        const createApiKeyResponse = await createApiKey(username2, "Test Key", ["Update"], undefined, { jwt: registerResponse2.text });
        expect(createApiKeyResponse.status).toBe(200);

        const updateResponse = await updateState(uploadResponse.text, ALICE_STATE, { apiKey: createApiKeyResponse.body.key });
        expect(updateResponse.status).toBe(200);
    });

    test.concurrent("Update state wrong capabilities", async () => {
        const { response: registerResponse, username } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const uploadResponse = await uploadBook(username, "Alices_Adventures_in_Wonderland.epub", { jwt: registerResponse.text });
        expect(uploadResponse.status).toBe(200);

        const createApiKeyResponse = await createApiKey(username, "Test Key", ["Create", "Read", "Delete"], undefined, { jwt: registerResponse.text });
        expect(createApiKeyResponse.status).toBe(200);

        const updateResponse = await updateState(uploadResponse.text, ALICE_STATE, { apiKey: createApiKeyResponse.body.key });
        expect(updateResponse.status).toBe(403);
        expect(updateResponse.text).toBe(FORBIDDEN);
    });

    test.concurrent("Update state expired api key", async () => {
        const { response: registerResponse, username } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const uploadResponse = await uploadBook(username, "Alices_Adventures_in_Wonderland.epub", { jwt: registerResponse.text });
        expect(uploadResponse.status).toBe(200);

        const timestamp = new Date(Date.now() + 2000).toISOString();
        const createApiKeyResponse = await createApiKey(username, "Test Key", ["Read"], timestamp, { jwt: registerResponse.text });
        expect(createApiKeyResponse.status).toBe(200);

        // Wait for the key to expire
        await wait(2.5);

        const updateResponse = await updateState(uploadResponse.text, ALICE_STATE, { apiKey: createApiKeyResponse.body.key });
        expect(updateResponse.status).toBe(401);
        expect(updateResponse.text).toBe(INVALID_API_KEY);
    });
});

describe("Patch state JWT", () => {
    test.concurrent("Patch state", async () => {
        const { response: registerResponse, username } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const uploadResponse = await uploadBook(username, "Alices_Adventures_in_Wonderland.epub", { jwt: registerResponse.text });
        expect(uploadResponse.status).toBe(200);

        const downloadResponse = await getState(uploadResponse.text, { jwt: registerResponse.text });
        expect(downloadResponse.status).toBe(200);

        expect(downloadResponse.body).toEqual(EMPTY_STATE);

        const patchResponse = await patchState(uploadResponse.text, { statistics: { rating: 2.3 } }, { jwt: registerResponse.text });
        expect(patchResponse.status).toBe(200);

        const downloadResponse2 = await getState(uploadResponse.text, { jwt: registerResponse.text });
        expect(downloadResponse2.status).toBe(200);

        expect(downloadResponse2.body).toEqual({ statistics: { rating: 2.3 } });

        const updateResponse = await updateState(uploadResponse.text, ALICE_STATE, { jwt: registerResponse.text });
        expect(updateResponse.status).toBe(200);

        let expectedState = structuredClone(ALICE_STATE);
        expectedState.statistics.rating = 2.3;

        const patchResponse2 = await patchState(uploadResponse.text, { statistics: { rating: 2.3 } }, { jwt: registerResponse.text });
        expect(patchResponse2.status).toBe(200);

        const downloadResponse3 = await getState(uploadResponse.text, { jwt: registerResponse.text });
        expect(downloadResponse3.status).toBe(200);

        expect(downloadResponse3.body).toEqual(expectedState);
    });

    test.concurrent("Patch state from non-existent book", async () => {
        const { response: registerResponse } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const patchResponse = await patchState("non-existent", ALICE_STATE, { jwt: registerResponse.text });
        expect(patchResponse.status).toBe(404);
        expect(patchResponse.text).toBe(BOOK_NOT_FOUND);
    });

    test.concurrent("Patch invalid state", async () => {
        const { response: registerResponse, username } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const uploadResponse = await uploadBook(username, "Alices_Adventures_in_Wonderland.epub", { jwt: registerResponse.text });
        expect(uploadResponse.status).toBe(200);

        let invalid = structuredClone(ALICE_STATE);
        invalid.statistics.rating = 9;

        const patchResponse = await patchState(uploadResponse.text, invalid, { jwt: registerResponse.text });
        expect(patchResponse.status).toBe(400);
        expect(patchResponse.text).toBe(INVALID_RATING);

        invalid.statistics.rating = 4.5;
        invalid.location.tag = "invalid";

        const patchResponse2 = await patchState(uploadResponse.text, invalid, { jwt: registerResponse.text });
        expect(patchResponse2.status).toBe(400);
        expect(patchResponse2.text).toBe(INVALID_LOCATION);

        invalid.location.tag = "kobo.1.1";
        invalid.location.source = "invalid";

        const patchResponse3 = await patchState(uploadResponse.text, invalid, { jwt: registerResponse.text });
        expect(patchResponse3.status).toBe(400);
        expect(patchResponse3.text).toBe(INVALID_LOCATION);
    });

    test.concurrent("Patch state | Different user | !admin", async () => {
        const { response: registerResponse, username } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const uploadResponse = await uploadBook(username, "Alices_Adventures_in_Wonderland.epub", { jwt: registerResponse.text });
        expect(uploadResponse.status).toBe(200);

        const { response: registerResponse2 } = await registerUser();
        expect(registerResponse2.status).toBe(200);

        const patchResponse = await patchState(uploadResponse.text, ALICE_STATE, { jwt: registerResponse2.text });
        expect(patchResponse.status).toBe(404);
        expect(patchResponse.text).toBe(BOOK_NOT_FOUND);
    });

    test.concurrent("Patch state | Different user | admin", async () => {
        const { response: registerResponse, username } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const uploadResponse = await uploadBook(username, "Alices_Adventures_in_Wonderland.epub", { jwt: registerResponse.text });
        expect(uploadResponse.status).toBe(200);

        const { response: registerResponse2 } = await registerUser(undefined, undefined, process.env.ADMIN_KEY);
        expect(registerResponse2.status).toBe(200);

        const patchResponse = await patchState(uploadResponse.text, ALICE_STATE, { jwt: registerResponse2.text });
        expect(patchResponse.status).toBe(200);
    });

    test.concurrent("Patch state no auth", async () => {
        const { response: registerResponse, username } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const uploadResponse = await uploadBook(username, "Alices_Adventures_in_Wonderland.epub", { jwt: registerResponse.text });
        expect(uploadResponse.status).toBe(200);

        const patchResponse = await patchState(uploadResponse.text, ALICE_STATE);
        expect(patchResponse.status).toBe(401);
        expect(patchResponse.text).toBe(UNAUTHORIZED);
    });
});

describe("Patch state api key", () => {
    test.concurrent("Patch state", async () => {
        const { response: registerResponse, username } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const uploadResponse = await uploadBook(username, "Alices_Adventures_in_Wonderland.epub", { jwt: registerResponse.text });
        expect(uploadResponse.status).toBe(200);

        const downloadResponse = await getState(uploadResponse.text, { jwt: registerResponse.text });
        expect(downloadResponse.status).toBe(200);

        expect(downloadResponse.body).toEqual(EMPTY_STATE);

        const createApiKeyResponse = await createApiKey(username, "Test Key", ["Update"], undefined, { jwt: registerResponse.text });
        expect(createApiKeyResponse.status).toBe(200);

        const patchResponse = await patchState(uploadResponse.text, { statistics: { rating: 2.3 } }, { apiKey: createApiKeyResponse.body.key });
        expect(patchResponse.status).toBe(200);

        const downloadResponse2 = await getState(uploadResponse.text, { jwt: registerResponse.text });
        expect(downloadResponse2.status).toBe(200);

        expect(downloadResponse2.body).toEqual({ statistics: { rating: 2.3 } });

        const updateResponse = await updateState(uploadResponse.text, ALICE_STATE, { jwt: registerResponse.text });
        expect(updateResponse.status).toBe(200);

        let expectedState = structuredClone(ALICE_STATE);
        expectedState.statistics.rating = 2.3;

        const patchResponse2 = await patchState(uploadResponse.text, { statistics: { rating: 2.3 } }, { apiKey: createApiKeyResponse.body.key });
        expect(patchResponse2.status).toBe(200);

        const downloadResponse3 = await getState(uploadResponse.text, { jwt: registerResponse.text });
        expect(downloadResponse3.status).toBe(200);

        expect(downloadResponse3.body).toEqual(expectedState);
    });

    test.concurrent("Patch state from non-existent book", async () => {
        const { response: registerResponse, username } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const createApiKeyResponse = await createApiKey(username, "Test Key", ["Update"], undefined, { jwt: registerResponse.text });
        expect(createApiKeyResponse.status).toBe(200);

        const patchResponse = await patchState("non-existent", ALICE_STATE, { apiKey: createApiKeyResponse.body.key });
        expect(patchResponse.status).toBe(404);
        expect(patchResponse.text).toBe(BOOK_NOT_FOUND);
    });

    test.concurrent("Patch invalid state", async () => {
        const { response: registerResponse, username } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const uploadResponse = await uploadBook(username, "Alices_Adventures_in_Wonderland.epub", { jwt: registerResponse.text });
        expect(uploadResponse.status).toBe(200);

        let invalid = structuredClone(ALICE_STATE);
        invalid.statistics.rating = 9;

        const createApiKeyResponse = await createApiKey(username, "Test Key", ["Update"], undefined, { jwt: registerResponse.text });
        expect(createApiKeyResponse.status).toBe(200);

        const patchResponse = await patchState(uploadResponse.text, invalid, { apiKey: createApiKeyResponse.body.key });
        expect(patchResponse.status).toBe(400);
        expect(patchResponse.text).toBe(INVALID_RATING);

        invalid.statistics.rating = 4.5;
        invalid.location.tag = "invalid";

        const patchResponse2 = await patchState(uploadResponse.text, invalid, { apiKey: createApiKeyResponse.body.key });
        expect(patchResponse2.status).toBe(400);
        expect(patchResponse2.text).toBe(INVALID_LOCATION);

        invalid.location.tag = "kobo.1.1";
        invalid.location.source = "invalid";

        const patchResponse3 = await patchState(uploadResponse.text, invalid, { apiKey: createApiKeyResponse.body.key });
        expect(patchResponse3.status).toBe(400);
        expect(patchResponse3.text).toBe(INVALID_LOCATION);
    });

    test.concurrent("Patch state | Different user | !admin", async () => {
        const { response: registerResponse, username } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const uploadResponse = await uploadBook(username, "Alices_Adventures_in_Wonderland.epub", { jwt: registerResponse.text });
        expect(uploadResponse.status).toBe(200);

        const { response: registerResponse2, username: username2 } = await registerUser();
        expect(registerResponse2.status).toBe(200);

        const createApiKeyResponse = await createApiKey(username2, "Test Key", ["Update"], undefined, { jwt: registerResponse2.text });
        expect(createApiKeyResponse.status).toBe(200);

        const patchResponse = await patchState(uploadResponse.text, ALICE_STATE, { apiKey: createApiKeyResponse.body.key });
        expect(patchResponse.status).toBe(404);
        expect(patchResponse.text).toBe(BOOK_NOT_FOUND);
    });

    test.concurrent("Patch state | Different user | admin", async () => {
        const { response: registerResponse, username } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const uploadResponse = await uploadBook(username, "Alices_Adventures_in_Wonderland.epub", { jwt: registerResponse.text });
        expect(uploadResponse.status).toBe(200);

        const { response: registerResponse2, username: username2 } = await registerUser(undefined, undefined, process.env.ADMIN_KEY);
        expect(registerResponse2.status).toBe(200);

        const createApiKeyResponse = await createApiKey(username2, "Test Key", ["Update"], undefined, { jwt: registerResponse2.text });
        expect(createApiKeyResponse.status).toBe(200);

        const patchResponse = await patchState(uploadResponse.text, ALICE_STATE, { apiKey: createApiKeyResponse.body.key });
        expect(patchResponse.status).toBe(200);
    });

    test.concurrent("Patch state wrong capabilities", async () => {
        const { response: registerResponse, username } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const uploadResponse = await uploadBook(username, "Alices_Adventures_in_Wonderland.epub", { jwt: registerResponse.text });
        expect(uploadResponse.status).toBe(200);

        const createApiKeyResponse = await createApiKey(username, "Test Key", ["Create", "Read", "Delete"], undefined, { jwt: registerResponse.text });
        expect(createApiKeyResponse.status).toBe(200);

        const patchResponse = await patchState(uploadResponse.text, ALICE_STATE, { apiKey: createApiKeyResponse.body.key });
        expect(patchResponse.status).toBe(403);
        expect(patchResponse.text).toBe(FORBIDDEN);
    });

    test.concurrent("Patch state expired api key", async () => {
        const { response: registerResponse, username } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const uploadResponse = await uploadBook(username, "Alices_Adventures_in_Wonderland.epub", { jwt: registerResponse.text });
        expect(uploadResponse.status).toBe(200);

        const timestamp = new Date(Date.now() + 2000).toISOString();
        const createApiKeyResponse = await createApiKey(username, "Test Key", ["Update"], timestamp, { jwt: registerResponse.text });
        expect(createApiKeyResponse.status).toBe(200);

        // Wait for the key to expire
        await wait(2.5);

        const patchResponse = await patchState(uploadResponse.text, ALICE_STATE, { apiKey: createApiKeyResponse.body.key });
        expect(patchResponse.status).toBe(401);
        expect(patchResponse.text).toBe(INVALID_API_KEY);
    });
});