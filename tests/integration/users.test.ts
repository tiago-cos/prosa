import request from "supertest";
import { FORBIDDEN, randomString, UNAUTHORIZED } from "../utils/common";
import { SERVER_URL } from "../utils/common";
import { registerUser, loginUser, createApiKey, getApiKey, getApiKeys, deleteApiKey, getPreferences, updatePreferences, INVALID_CREDENTIALS, INVALID_USERNAME_PASSWORD, USERNAME_IN_USE, USER_NOT_FOUND, API_KEY_NOT_FOUND, INVALID_CAPABILITIES, INVALID_TIMESTAMP, INVALID_PROVIDERS, MISSING_METADATA_PREFERENCE, patchPreferences, INVALID_PREFERENCES } from "../utils/users"

describe("Register", () => {
    test("Regular user", async () => {
        const { response: registerResponse, username, password } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const { response: loginResponse } = await loginUser(username, password);
        expect(loginResponse.status).toBe(200);
    });

    test("Admin user", async () => {
        const { response: registerResponse, username, password } = await registerUser(undefined, undefined, process.env.ADMIN_KEY);
        expect(registerResponse.status).toBe(200);

        const { response: loginResponse } = await loginUser(username, password);
        expect(loginResponse.status).toBe(200);
    });

    test("Invalid username and password", async () => {
        const { response: registerResponse } = await registerUser("invalid username");
        expect(registerResponse.status).toBe(400);
        expect(registerResponse.text).toBe(INVALID_USERNAME_PASSWORD);

        const { response: registerResponse2 } = await registerUser("");
        expect(registerResponse2.status).toBe(400);
        expect(registerResponse2.text).toBe(INVALID_USERNAME_PASSWORD);

        const { response: registerResponse3 } = await registerUser(undefined, "invalid password");
        expect(registerResponse3.status).toBe(400);
        expect(registerResponse3.text).toBe(INVALID_USERNAME_PASSWORD);

        const { response: registerResponse4 } = await registerUser(undefined, "");
        expect(registerResponse4.status).toBe(400);
        expect(registerResponse4.text).toBe(INVALID_USERNAME_PASSWORD);
    });

    test("Invalid admin key", async () => {
        const adminKey = "invalid_admin_key";

        const { response: registerResponse } = await registerUser(undefined, undefined, adminKey);
        expect(registerResponse.status).toBe(403);
        expect(registerResponse.text).toBe(INVALID_CREDENTIALS);
    });

    test("User conflict", async () => {
        const { response: registerResponse, username } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const { response: registerResponse2 } = await registerUser(username);
        expect(registerResponse2.status).toBe(409);
        expect(registerResponse2.text).toBe(USERNAME_IN_USE);
    });

    test("Invalid request body", async () => {
        const username = randomString(16);
        const password = randomString(16);

        const registerResponse = await request(SERVER_URL).post("/users").send({
            username: username,
            pass: password
        });

        expect(registerResponse.status).toBe(422);
    });
});

describe("Login", () => {
    test("Non-existing user", async () => {
        const { response: loginResponse } = await loginUser("non-existent", "non-existent");
        expect(loginResponse.status).toBe(404);
        expect(loginResponse.text).toBe(USER_NOT_FOUND);
    });

    test("Invalid credentials", async () => {
        const { response: registerResponse, username } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const { response: loginResponse } = await loginUser(username, "wrong_password");
        expect(loginResponse.status).toBe(403);
        expect(loginResponse.text).toBe(INVALID_CREDENTIALS);
    });

    test("Invalid request body", async () => {
        const loginResponse = await request(SERVER_URL).post("/users/" + "non-existent").send({
            pass: "password"
        });

        expect(loginResponse.status).toBe(422);
    });
});

describe("Create api key", () => {
    test("No timestamp", async () => {
        const { response: registerResponse, username } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const createApiKeyResponse = await createApiKey(username, "Test Key", ["Read"], undefined, { jwt: registerResponse.text });
        expect(createApiKeyResponse.status).toBe(200);

        const getApiKeyResponse = await getApiKey(username, createApiKeyResponse.body.id, { jwt: registerResponse.text });
        expect(getApiKeyResponse.status).toBe(200);
        expect(getApiKeyResponse.body.name).toBe("Test Key");
        expect(getApiKeyResponse.body.capabilities).toEqual(["Read"]);
        expect(getApiKeyResponse.body.expires_at).toBeUndefined();
    });

    test("With timestamp", async () => {
        const { response: registerResponse, username } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const date = Date.now() + 300000;

        const createApiKeyResponse = await createApiKey(username, "Test Key", ["Read", "Create"], date, { jwt: registerResponse.text });
        expect(createApiKeyResponse.status).toBe(200);

        const getApiKeyResponse = await getApiKey(username, createApiKeyResponse.body.id, { jwt: registerResponse.text });
        expect(getApiKeyResponse.status).toBe(200);
        expect(getApiKeyResponse.body.name).toBe("Test Key");
        expect(getApiKeyResponse.body.capabilities).toEqual(["Create", "Read"]);
        expect(getApiKeyResponse.body.expires_at).toBe(date);
    });

    test("Non-existent user", async () => {
        const { response: registerResponse } = await registerUser(undefined, undefined, process.env.ADMIN_KEY);
        expect(registerResponse.status).toBe(200);

        const createApiKeyResponse = await createApiKey("non-existent", "Test Key", ["Read"], undefined, { jwt: registerResponse.text });
        expect(createApiKeyResponse.status).toBe(404);
        expect(createApiKeyResponse.text).toBe(USER_NOT_FOUND);
    });

    test("Invalid capabilities", async () => {
        const { response: registerResponse, username } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const createApiKeyResponse = await createApiKey(username, "Test Key", ["Read", "Read"], undefined, { jwt: registerResponse.text });
        expect(createApiKeyResponse.status).toBe(400);
        expect(createApiKeyResponse.text).toBe(INVALID_CAPABILITIES);

        const createApiKeyResponse2 = await createApiKey(username, "Test Key", ["Wrong"], undefined, { jwt: registerResponse.text });
        expect(createApiKeyResponse2.status).toBe(400);
        expect(createApiKeyResponse2.text).toBe(INVALID_CAPABILITIES);

        const createApiKeyResponse3 = await createApiKey(username, "Test Key", [], undefined, { jwt: registerResponse.text });
        expect(createApiKeyResponse3.status).toBe(400);
        expect(createApiKeyResponse3.text).toBe(INVALID_CAPABILITIES);
    });

    test("Invalid expiration", async () => {
        const { response: registerResponse, username } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const createApiKeyResponse = await createApiKey(username, "Test Key", ["Read"], Date.now() - 300000, { jwt: registerResponse.text });
        expect(createApiKeyResponse.status).toBe(400);
        expect(createApiKeyResponse.text).toBe(INVALID_TIMESTAMP);

        const createApiKeyResponse2 = await createApiKey(username, "Test Key", ["Read"], 9223372036854772, { jwt: registerResponse.text });
        expect(createApiKeyResponse2.status).toBe(400);
        expect(createApiKeyResponse2.text).toBe(INVALID_TIMESTAMP);
    });

    test("Different user without permission", async () => {
        const { response: registerResponse } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const { response: registerResponse2, username } = await registerUser();
        expect(registerResponse2.status).toBe(200);

        const createApiKeyResponse = await createApiKey(username, "Test Key", ["Read"], undefined, { jwt: registerResponse.text });
        expect(createApiKeyResponse.status).toBe(403);
        expect(createApiKeyResponse.text).toBe(FORBIDDEN);
    });

    test("Different user with permission", async () => {
        const { response: registerResponse } = await registerUser(undefined, undefined, process.env.ADMIN_KEY);
        expect(registerResponse.status).toBe(200);

        const { response: registerResponse2, username } = await registerUser();
        expect(registerResponse2.status).toBe(200);

        const createApiKeyResponse = await createApiKey(username, "Test Key", ["Read"], undefined, { jwt: registerResponse.text });
        expect(createApiKeyResponse.status).toBe(200);

        const getApiKeyResponse = await getApiKey(username, createApiKeyResponse.body.id, { jwt: registerResponse.text });
        expect(getApiKeyResponse.status).toBe(200);
    });

    test("No auth", async () => {
        const { response: registerResponse, username } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const createApiKeyResponse = await createApiKey(username, "Test Key", ["Read"], undefined);
        expect(createApiKeyResponse.status).toBe(401);
        expect(createApiKeyResponse.text).toBe(UNAUTHORIZED);
    });

    test("Invalid auth", async () => {
        const { response: registerResponse, username } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const createApiKeyResponse = await createApiKey(username, "Test Key", ["Read"], undefined, { jwt: registerResponse.text });
        expect(createApiKeyResponse.status).toBe(200);

        const createApiKeyResponse2 = await createApiKey(username, "Test Key", ["Read"], undefined, { apiKey: createApiKeyResponse.body.key });
        expect(createApiKeyResponse2.status).toBe(403);
        expect(createApiKeyResponse2.text).toBe(FORBIDDEN);
    });

    test("Invalid request", async () => {
        const { response: registerResponse, username } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const createApiKeyResponse = await request(SERVER_URL)
            .post(`/users/${username}/keys`)
            .auth(registerResponse.text, { type: "bearer" })
            .send({
                bad: username,
                field: []
            });

        expect(createApiKeyResponse.status).toBe(422);
    });
});

describe("List api keys", () => {
    test("Simple", async () => {
        const { response: registerResponse, username } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const createApiKeyResponse = await createApiKey(username, "Test Key", ["Read", "Create"], Date.now() + 300000, { jwt: registerResponse.text });
        expect(createApiKeyResponse.status).toBe(200);

        const createApiKeyResponse2 = await createApiKey(username, "Test Key", ["Read", "Create"], Date.now() + 300000, { jwt: registerResponse.text });
        expect(createApiKeyResponse2.status).toBe(200);

        const createApiKeyResponse3 = await createApiKey(username, "Test Key", ["Read", "Create"], Date.now() + 300000, { jwt: registerResponse.text });
        expect(createApiKeyResponse3.status).toBe(200);

        const getApiKeysResponse = await getApiKeys(username, { jwt: registerResponse.text });
        expect(getApiKeysResponse.status).toBe(200);
        expect(getApiKeysResponse.body).toEqual([
            createApiKeyResponse.body.id,
            createApiKeyResponse2.body.id,
            createApiKeyResponse3.body.id
        ]);

        const { response: registerResponse2, username: username2 } = await registerUser();
        expect(registerResponse2.status).toBe(200);

        const getApiKeysResponse2 = await getApiKeys(username2, { jwt: registerResponse2.text });
        expect(getApiKeysResponse2.status).toBe(200);
        expect(getApiKeysResponse2.body).toEqual([]);
    });

    test("Non-existent user", async () => {
        const { response: registerResponse } = await registerUser(undefined, undefined, process.env.ADMIN_KEY);
        expect(registerResponse.status).toBe(200);

        const getApiKeysResponse = await getApiKeys("non-existent", { jwt: registerResponse.text })
        expect(getApiKeysResponse.status).toBe(404);
        expect(getApiKeysResponse.text).toBe(USER_NOT_FOUND);
    });

    test("Different user without permission", async () => {
        const { response: registerResponse, username } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const createApiKeyResponse = await createApiKey(username, "Test Key", ["Read", "Create"], Date.now() + 300000, { jwt: registerResponse.text });
        expect(createApiKeyResponse.status).toBe(200);

        const { response: registerResponse2 } = await registerUser();
        expect(registerResponse2.status).toBe(200);

        const getApiKeysResponse = await getApiKeys(username, { jwt: registerResponse2.text })
        expect(getApiKeysResponse.status).toBe(403);
        expect(getApiKeysResponse.text).toBe(FORBIDDEN);
    });

    test("Different user with permission", async () => {
        const { response: registerResponse, username } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const createApiKeyResponse = await createApiKey(username, "Test Key", ["Read", "Create"], Date.now() + 300000, { jwt: registerResponse.text });
        expect(createApiKeyResponse.status).toBe(200);

        const { response: registerResponse2 } = await registerUser(undefined, undefined, process.env.ADMIN_KEY);
        expect(registerResponse2.status).toBe(200);

        const getApiKeysResponse = await getApiKeys(username, { jwt: registerResponse2.text });
        expect(getApiKeysResponse.status).toBe(200);
    });

    test("No auth", async () => {
        const { response: registerResponse, username } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const createApiKeyResponse = await createApiKey(username, "Test Key", ["Read", "Create"], Date.now() + 300000, { jwt: registerResponse.text });
        expect(createApiKeyResponse.status).toBe(200);

        const getApiKeysResponse = await getApiKeys(username);
        expect(getApiKeysResponse.status).toBe(401);
        expect(getApiKeysResponse.text).toBe(UNAUTHORIZED);
    });

    test("Wrong auth", async () => {
        const { response: registerResponse, username } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const createApiKeyResponse = await createApiKey(username, "Test Key", ["Read", "Create"], Date.now() + 300000, { jwt: registerResponse.text });
        expect(createApiKeyResponse.status).toBe(200);

        const getApiKeysResponse = await getApiKeys(username, { apiKey: createApiKeyResponse.body.key });
        expect(getApiKeysResponse.status).toBe(403);
        expect(getApiKeysResponse.text).toBe(FORBIDDEN);
    });
});

describe("Get api key", () => {
    test("Simple", async () => {
        const { response: registerResponse, username } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const createApiKeyResponse = await createApiKey(username, "Test Key", ["Read"], undefined, { jwt: registerResponse.text });
        expect(createApiKeyResponse.status).toBe(200);

        const expectedResponse = {
            name: "Test Key",
            capabilities: ["Read"]
        }

        const getApiKeyResponse = await getApiKey(username, createApiKeyResponse.body.id, { jwt: registerResponse.text });
        expect(getApiKeyResponse.status).toBe(200);
        expect(getApiKeyResponse.body).toEqual(expectedResponse);
    });

    test("Non-existent api key", async () => {
        const { response: registerResponse, username } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const getApiKeyResponse = await getApiKey(username, "non-existent", { jwt: registerResponse.text });
        expect(getApiKeyResponse.status).toBe(404);
        expect(getApiKeyResponse.text).toBe(API_KEY_NOT_FOUND);
    });

    test("Non-existent user", async () => {
        const { response: registerResponse, username } = await registerUser(undefined, undefined, process.env.ADMIN_KEY);
        expect(registerResponse.status).toBe(200);

        const createApiKeyResponse = await createApiKey(username, "Test Key", ["Read"], undefined, { jwt: registerResponse.text });
        expect(createApiKeyResponse.status).toBe(200);

        const getApiKeyResponse = await getApiKey("non-existent", createApiKeyResponse.body.id, { jwt: registerResponse.text });
        expect(getApiKeyResponse.status).toBe(404);
        expect(getApiKeyResponse.text).toBe(USER_NOT_FOUND);
    });

    test("Different user without permission", async () => {
        const { response: registerResponse } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const { response: registerResponse2, username } = await registerUser();
        expect(registerResponse2.status).toBe(200);

        const createApiKeyResponse = await createApiKey(username, "Test Key", ["Read"], undefined, { jwt: registerResponse2.text });
        expect(createApiKeyResponse.status).toBe(200);

        const getApiKeyResponse = await getApiKey(username, createApiKeyResponse.body.id, { jwt: registerResponse.text });
        expect(getApiKeyResponse.status).toBe(403);
        expect(getApiKeyResponse.text).toBe(FORBIDDEN);
    });

    test("Different user with permission", async () => {
        const { response: registerResponse } = await registerUser(undefined, undefined, process.env.ADMIN_KEY);
        expect(registerResponse.status).toBe(200);

        const { response: registerResponse2, username } = await registerUser();
        expect(registerResponse2.status).toBe(200);

        const createApiKeyResponse = await createApiKey(username, "Test Key", ["Read"], undefined, { jwt: registerResponse2.text });
        expect(createApiKeyResponse.status).toBe(200);

        const getApiKeyResponse = await getApiKey(username, createApiKeyResponse.body.id, { jwt: registerResponse.text });
        expect(getApiKeyResponse.status).toBe(200);
    });

    test("No auth", async () => {
        const { response: registerResponse, username } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const createApiKeyResponse = await createApiKey(username, "Test Key", ["Read"], undefined, { jwt: registerResponse.text });
        expect(createApiKeyResponse.status).toBe(200);

        const getApiKeyResponse = await getApiKey(username, createApiKeyResponse.body.id);
        expect(getApiKeyResponse.status).toBe(401);
        expect(getApiKeyResponse.text).toBe(UNAUTHORIZED);
    });

    test("Wrong auth", async () => {
        const { response: registerResponse, username } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const createApiKeyResponse = await createApiKey(username, "Test Key", ["Read"], undefined, { jwt: registerResponse.text });
        expect(createApiKeyResponse.status).toBe(200);

        const getApiKeyResponse = await getApiKey(username, createApiKeyResponse.body.id, { apiKey: createApiKeyResponse.body.key });
        expect(getApiKeyResponse.status).toBe(403);
        expect(getApiKeyResponse.text).toBe(FORBIDDEN);
    });
});

describe("Delete api key", () => {
    test("Simple", async () => {
        const { response: registerResponse, username } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const createApiKeyResponse = await createApiKey(username, "Test Key", ["Read", "Create"], undefined, { jwt: registerResponse.text });
        expect(createApiKeyResponse.status).toBe(200);

        const getApiKeyResponse = await getApiKey(username, createApiKeyResponse.body.id, { jwt: registerResponse.text });
        expect(getApiKeyResponse.status).toBe(200);

        const deleteApiKeyResponse = await deleteApiKey(username, createApiKeyResponse.body.id, { jwt: registerResponse.text });
        expect(deleteApiKeyResponse.status).toBe(204);

        const getApiKeyResponse2 = await getApiKey(username, createApiKeyResponse.body.id, { jwt: registerResponse.text });
        expect(getApiKeyResponse2.status).toBe(404);
        expect(getApiKeyResponse2.text).toBe(API_KEY_NOT_FOUND);
    });

    test("Non-existent user", async () => {
        const { response: registerResponse, username } = await registerUser(undefined, undefined, process.env.ADMIN_KEY);
        expect(registerResponse.status).toBe(200);

        const createApiKeyResponse = await createApiKey(username, "Test Key", ["Read", "Create"], undefined, { jwt: registerResponse.text });
        expect(createApiKeyResponse.status).toBe(200);

        const deleteApiKeyResponse = await deleteApiKey("non-existent", createApiKeyResponse.body.id, { jwt: registerResponse.text });
        expect(deleteApiKeyResponse.status).toBe(404);
        expect(deleteApiKeyResponse.text).toBe(USER_NOT_FOUND);

        const getApiKeyResponse2 = await getApiKey(username, createApiKeyResponse.body.id, { jwt: registerResponse.text });
        expect(getApiKeyResponse2.status).toBe(200);
    });

    test("Non-existent api key", async () => {
        const { response: registerResponse, username } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const createApiKeyResponse = await createApiKey(username, "Test Key", ["Read", "Create"], undefined, { jwt: registerResponse.text });
        expect(createApiKeyResponse.status).toBe(200);

        const deleteApiKeyResponse = await deleteApiKey(username, "non-existent", { jwt: registerResponse.text });
        expect(deleteApiKeyResponse.status).toBe(404);
        expect(deleteApiKeyResponse.text).toBe(API_KEY_NOT_FOUND);
    });

    test("Different user without permission", async () => {
        const { response: registerResponse, username } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const createApiKeyResponse = await createApiKey(username, "Test Key", ["Read", "Create"], undefined, { jwt: registerResponse.text });
        expect(createApiKeyResponse.status).toBe(200);

        const { response: registerResponse2 } = await registerUser();
        expect(registerResponse2.status).toBe(200);

        const deleteApiKeyResponse = await deleteApiKey(username, createApiKeyResponse.body.id, { jwt: registerResponse2.text });
        expect(deleteApiKeyResponse.status).toBe(403);
        expect(deleteApiKeyResponse.text).toBe(FORBIDDEN);
    });

    test("Different user with permission", async () => {
        const { response: registerResponse, username } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const createApiKeyResponse = await createApiKey(username, "Test Key", ["Read", "Create"], undefined, { jwt: registerResponse.text });
        expect(createApiKeyResponse.status).toBe(200);

        const { response: registerResponse2 } = await registerUser(undefined, undefined, process.env.ADMIN_KEY);
        expect(registerResponse2.status).toBe(200);

        const deleteApiKeyResponse = await deleteApiKey(username, createApiKeyResponse.body.id, { jwt: registerResponse2.text });
        expect(deleteApiKeyResponse.status).toBe(204);

        const getApiKeyResponse = await getApiKey(username, createApiKeyResponse.body.id, { jwt: registerResponse2.text });
        expect(getApiKeyResponse.status).toBe(404);
        expect(getApiKeyResponse.text).toBe(API_KEY_NOT_FOUND);
    });

    test("No auth", async () => {
        const { response: registerResponse, username } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const createApiKeyResponse = await createApiKey(username, "Test Key", ["Read", "Create"], undefined, { jwt: registerResponse.text });
        expect(createApiKeyResponse.status).toBe(200);

        const deleteApiKeyResponse = await deleteApiKey(username, createApiKeyResponse.body.id);
        expect(deleteApiKeyResponse.status).toBe(401);
        expect(deleteApiKeyResponse.text).toBe(UNAUTHORIZED);
    });

    test("Wrong auth", async () => {
        const { response: registerResponse, username } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const createApiKeyResponse = await createApiKey(username, "Test Key", ["Read", "Create"], undefined, { jwt: registerResponse.text });
        expect(createApiKeyResponse.status).toBe(200);

        const deleteApiKeyResponse = await deleteApiKey(username, createApiKeyResponse.body.id, { apiKey: createApiKeyResponse.body.key });
        expect(deleteApiKeyResponse.status).toBe(403);
        expect(deleteApiKeyResponse.text).toBe(FORBIDDEN);
    });
});

describe("Get preferences", () => {
    test("Simple", async () => {
        const { response: registerResponse, username } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const getPreferencesResponse = await getPreferences(username, { jwt: registerResponse.text });
        expect(getPreferencesResponse.status).toBe(200);
        expect(getPreferencesResponse.body).toHaveProperty("metadata_providers");
        expect(getPreferencesResponse.body.metadata_providers).toEqual(["epub_metadata_extractor"]);
        expect(getPreferencesResponse.body).toHaveProperty("automatic_metadata");
        expect(getPreferencesResponse.body.automatic_metadata).toEqual(true);
    });

    test("Non-existent user", async () => {
        const { response: registerResponse } = await registerUser(undefined, undefined, process.env.ADMIN_KEY);
        expect(registerResponse.status).toBe(200);

        const getPreferencesResponse = await getPreferences("non-existent", { jwt: registerResponse.text });
        expect(getPreferencesResponse.status).toBe(404);
        expect(getPreferencesResponse.text).toBe(USER_NOT_FOUND);
    });

    test("Different user without permission", async () => {
        const { response: registerResponse, username } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const { response: registerResponse2 } = await registerUser();
        expect(registerResponse2.status).toBe(200);

        const getPreferencesResponse = await getPreferences(username, { jwt: registerResponse2.text });
        expect(getPreferencesResponse.status).toBe(403);
        expect(getPreferencesResponse.text).toBe(FORBIDDEN);
    });

    test("Different user with permission", async () => {
        const { response: registerResponse, username } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const { response: registerResponse2 } = await registerUser(undefined, undefined, process.env.ADMIN_KEY);
        expect(registerResponse2.status).toBe(200);

        const getPreferencesResponse = await getPreferences(username, { jwt: registerResponse2.text });
        expect(getPreferencesResponse.status).toBe(200);
    });

    test("No auth", async () => {
        const { response: registerResponse, username } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const getPreferencesResponse = await getPreferences(username);
        expect(getPreferencesResponse.status).toBe(401);
        expect(getPreferencesResponse.text).toBe(UNAUTHORIZED);
    });
});

describe("Update preferences", () => {
    test("Simple", async () => {
        const { response: registerResponse, username } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const getPreferencesResponse = await getPreferences(username, { jwt: registerResponse.text });
        expect(getPreferencesResponse.status).toBe(200);
        expect(getPreferencesResponse.body).toHaveProperty("metadata_providers");
        expect(getPreferencesResponse.body.metadata_providers).toEqual(["epub_metadata_extractor"]);
        expect(getPreferencesResponse.body).toHaveProperty("automatic_metadata");
        expect(getPreferencesResponse.body.automatic_metadata).toEqual(true);

        const updatePreferencesResponse = await updatePreferences(
            username,
            ["goodreads_metadata_scraper", "epub_metadata_extractor"],
            false,
            { jwt: registerResponse.text }
        );
        expect(updatePreferencesResponse.status).toBe(204);

        const getPreferencesResponse2 = await getPreferences(username, { jwt: registerResponse.text });
        expect(getPreferencesResponse2.status).toBe(200);
        expect(getPreferencesResponse2.body).toHaveProperty("metadata_providers");
        expect(getPreferencesResponse2.body.metadata_providers).toEqual(["goodreads_metadata_scraper", "epub_metadata_extractor"]);
        expect(getPreferencesResponse2.body).toHaveProperty("automatic_metadata");
        expect(getPreferencesResponse2.body.automatic_metadata).toEqual(false);

        const updatePreferencesResponse2 = await updatePreferences(
            username,
            [],
            true,
            { jwt: registerResponse.text }
        );
        expect(updatePreferencesResponse2.status).toBe(204);

        const getPreferencesResponse3 = await getPreferences(username, { jwt: registerResponse.text });
        expect(getPreferencesResponse3.status).toBe(200);
        expect(getPreferencesResponse3.body).toHaveProperty("metadata_providers");
        expect(getPreferencesResponse3.body.metadata_providers).toEqual([]);
        expect(getPreferencesResponse3.body).toHaveProperty("automatic_metadata");
        expect(getPreferencesResponse3.body.automatic_metadata).toEqual(true);
    });

    test("Invalid providers", async () => {
        const { response: registerResponse, username } = await registerUser();
        expect(registerResponse.status).toBe(200);

        let updatePreferencesResponse = await updatePreferences(
            username,
            ["invalid provider"],
            true,
            { jwt: registerResponse.text }
        );
        expect(updatePreferencesResponse.status).toBe(400);
        expect(updatePreferencesResponse.text).toBe(INVALID_PROVIDERS);

        updatePreferencesResponse = await updatePreferences(
            username,
            undefined,
            true,
            { jwt: registerResponse.text }
        );
        expect(updatePreferencesResponse.status).toBe(400);
        expect(updatePreferencesResponse.text).toBe(INVALID_PROVIDERS);
    });

    test("Missing metadata preference", async () => {
        const { response: registerResponse, username } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const updatePreferencesResponse = await updatePreferences(
            username,
            ["epub_metadata_extractor"],
            undefined,
            { jwt: registerResponse.text }
        );
        expect(updatePreferencesResponse.status).toBe(400);
        expect(updatePreferencesResponse.text).toBe(MISSING_METADATA_PREFERENCE);
    });

    test("Non-existent user", async () => {
        const { response: registerResponse } = await registerUser(undefined, undefined, process.env.ADMIN_KEY);
        expect(registerResponse.status).toBe(200);

        const updatePreferencesResponse = await updatePreferences(
            "non-existent",
            ["goodreads_metadata_scraper"],
            true,
            { jwt: registerResponse.text }
        );
        expect(updatePreferencesResponse.status).toBe(404);
        expect(updatePreferencesResponse.text).toBe(USER_NOT_FOUND);
    });

    test("Different user without permission", async () => {
        const { response: registerResponse, username } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const { response: registerResponse2 } = await registerUser();
        expect(registerResponse2.status).toBe(200);

        const updatePreferencesResponse = await updatePreferences(
            username,
            ["goodreads_metadata_scraper"],
            true,
            { jwt: registerResponse2.text }
        );
        expect(updatePreferencesResponse.status).toBe(403);
        expect(updatePreferencesResponse.text).toBe(FORBIDDEN);
    });

    test("Different user with permission", async () => {
        const { response: registerResponse, username } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const { response: registerResponse2 } = await registerUser(undefined, undefined, process.env.ADMIN_KEY);
        expect(registerResponse2.status).toBe(200);

        const updatePreferencesResponse = await updatePreferences(
            username,
            ["goodreads_metadata_scraper"],
            true,
            { jwt: registerResponse2.text }
        );
        expect(updatePreferencesResponse.status).toBe(204);
    });

    test("No auth", async () => {
        const { response: registerResponse, username } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const updatePreferencesResponse = await updatePreferences(
            username,
            ["goodreads_metadata_scraper"],
            true,
        );
        expect(updatePreferencesResponse.status).toBe(401);
        expect(updatePreferencesResponse.text).toBe(UNAUTHORIZED);
    });
});

describe("Patch preferences", () => {
    test("Simple", async () => {
        const { response: registerResponse, username } = await registerUser();
        expect(registerResponse.status).toBe(200);

        let getPreferencesResponse = await getPreferences(username, { jwt: registerResponse.text });
        expect(getPreferencesResponse.status).toBe(200);
        expect(getPreferencesResponse.body).toHaveProperty("metadata_providers");
        expect(getPreferencesResponse.body.metadata_providers).toEqual(["epub_metadata_extractor"]);
        expect(getPreferencesResponse.body).toHaveProperty("automatic_metadata");
        expect(getPreferencesResponse.body.automatic_metadata).toEqual(true);

        let patchPreferencesResponse = await patchPreferences(
            username,
            ["goodreads_metadata_scraper", "epub_metadata_extractor"],
            undefined,
            { jwt: registerResponse.text }
        );
        expect(patchPreferencesResponse.status).toBe(204);

        getPreferencesResponse = await getPreferences(username, { jwt: registerResponse.text });
        expect(getPreferencesResponse.status).toBe(200);
        expect(getPreferencesResponse.body).toHaveProperty("metadata_providers");
        expect(getPreferencesResponse.body.metadata_providers).toEqual(["goodreads_metadata_scraper", "epub_metadata_extractor"]);
        expect(getPreferencesResponse.body).toHaveProperty("automatic_metadata");
        expect(getPreferencesResponse.body.automatic_metadata).toEqual(true);

        patchPreferencesResponse = await patchPreferences(
            username,
            undefined,
            false,
            { jwt: registerResponse.text }
        );
        expect(patchPreferencesResponse.status).toBe(204);

        getPreferencesResponse = await getPreferences(username, { jwt: registerResponse.text });
        expect(getPreferencesResponse.status).toBe(200);
        expect(getPreferencesResponse.body).toHaveProperty("metadata_providers");
        expect(getPreferencesResponse.body.metadata_providers).toEqual(["goodreads_metadata_scraper", "epub_metadata_extractor"]);
        expect(getPreferencesResponse.body).toHaveProperty("automatic_metadata");
        expect(getPreferencesResponse.body.automatic_metadata).toEqual(false);
    });

    test("Invalid providers", async () => {
        const { response: registerResponse, username } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const patchPreferencesResponse = await patchPreferences(
            username,
            ["invalid provider"],
            undefined,
            { jwt: registerResponse.text }
        );
        expect(patchPreferencesResponse.status).toBe(400);
        expect(patchPreferencesResponse.text).toBe(INVALID_PROVIDERS);
    });

    test("Empty body", async () => {
        const { response: registerResponse, username } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const updatePreferencesResponse = await patchPreferences(
            username,
            undefined,
            undefined,
            { jwt: registerResponse.text }
        );
        expect(updatePreferencesResponse.status).toBe(400);
        expect(updatePreferencesResponse.text).toBe(INVALID_PREFERENCES);
    });

    test("Non-existent user", async () => {
        const { response: registerResponse } = await registerUser(undefined, undefined, process.env.ADMIN_KEY);
        expect(registerResponse.status).toBe(200);

        const patchPreferencesResponse = await patchPreferences(
            "non-existent",
            ["goodreads_metadata_scraper"],
            undefined,
            { jwt: registerResponse.text }
        );
        expect(patchPreferencesResponse.status).toBe(404);
        expect(patchPreferencesResponse.text).toBe(USER_NOT_FOUND);
    });

    test("Different user without permission", async () => {
        const { response: registerResponse, username } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const { response: registerResponse2 } = await registerUser();
        expect(registerResponse2.status).toBe(200);

        const patchPreferencesResponse = await patchPreferences(
            username,
            ["goodreads_metadata_scraper"],
            undefined,
            { jwt: registerResponse2.text }
        );
        expect(patchPreferencesResponse.status).toBe(403);
        expect(patchPreferencesResponse.text).toBe(FORBIDDEN);
    });

    test("Different user with permission", async () => {
        const { response: registerResponse, username } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const { response: registerResponse2 } = await registerUser(undefined, undefined, process.env.ADMIN_KEY);
        expect(registerResponse2.status).toBe(200);

        const patchPreferencesResponse = await patchPreferences(
            username,
            ["goodreads_metadata_scraper"],
            undefined,
            { jwt: registerResponse2.text }
        );
        expect(patchPreferencesResponse.status).toBe(204);
    });

    test("No auth", async () => {
        const { response: registerResponse, username } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const patchPreferencesResponse = await patchPreferences(
            username,
            undefined,
            true,
        );
        expect(patchPreferencesResponse.status).toBe(401);
        expect(patchPreferencesResponse.text).toBe(UNAUTHORIZED);
    });
});