import request from "supertest";
import { FORBIDDEN, randomString, UNAUTHORIZED } from "../utils/common";
import { SERVER_URL } from "../utils/common";
import { registerUser, loginUser, createApiKey, getApiKey, getApiKeys, deleteApiKey, getPreferences, updatePreferences, INVALID_CREDENTIALS, INVALID_USERNAME_PASSWORD, USERNAME_IN_USE, USER_NOT_FOUND, API_KEY_NOT_FOUND, INVALID_CAPABILITIES, INVALID_TIMESTAMP } from "../utils/users"

describe("Register and login tests", () => {
  test.concurrent("Register a new user", async () => {
    const { response: registerResponse, username, password } = await registerUser();
    expect(registerResponse.status).toBe(200);

    const { response: loginResponse } = await loginUser(username, password);
    expect(loginResponse.status).toBe(200);
  });

  test.concurrent("Register a new admin user", async () => {
    const { response: registerResponse, username, password } = await registerUser(undefined, undefined, process.env.ADMIN_KEY);
    expect(registerResponse.status).toBe(200);

    const { response: loginResponse } = await loginUser(username, password);
    expect(loginResponse.status).toBe(200);
  });

  test.concurrent("Register with an invalid admin key", async () => {
    const adminKey = "invalid_admin_key";

    const { response: registerResponse } = await registerUser(undefined, undefined, adminKey);
    expect(registerResponse.status).toBe(403);
    expect(registerResponse.text).toBe(INVALID_CREDENTIALS);
  });

  test.concurrent("Register with an invalid username and password", async () => {
    const { response: registerResponse } = await registerUser("invalid username");
    expect(registerResponse.status).toBe(400);
    expect(registerResponse.text).toBe(INVALID_USERNAME_PASSWORD);

    const { response: registerResponse2 } = await registerUser(undefined, "invalid password");
    expect(registerResponse2.status).toBe(400);
    expect(registerResponse2.text).toBe(INVALID_USERNAME_PASSWORD);
  });

  test.concurrent("Register with an existing username", async () => {
    const { response: registerResponse, username } = await registerUser();
    expect(registerResponse.status).toBe(200);

    const { response: registerResponse2 } = await registerUser(username);
    expect(registerResponse2.status).toBe(409);
    expect(registerResponse2.text).toBe(USERNAME_IN_USE);
  });

  test.concurrent("Login with a non-existing username", async () => {
    const { response: loginResponse } = await loginUser("doesnt_exist", "doesnt_exist");
    expect(loginResponse.status).toBe(404);
    expect(loginResponse.text).toBe(USER_NOT_FOUND);
  });

  test.concurrent("Login with invalid credentials", async () => {
    const { response: registerResponse, username } = await registerUser();
    expect(registerResponse.status).toBe(200);

    const { response: loginResponse } = await loginUser(username, "wrong_password");
    expect(loginResponse.status).toBe(403);
    expect(loginResponse.text).toBe(INVALID_CREDENTIALS);
  });

  test.concurrent("Register and login with invalid request body", async () => {
    const username = randomString(16);
    const password = randomString(16);

    const registerResponse = await request(SERVER_URL).post("/users").send({
      username: username,
      pass: password
    });

    expect(registerResponse.status).toBe(422);

    const loginResponse = await request(SERVER_URL).post("/users/" + username).send({
      pass: password
    });

    expect(loginResponse.status).toBe(422);
  });
});

describe("Api key tests", () => {
  test.concurrent("Create a new api key without timestamp", async () => {
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

  test.concurrent("Create a new api key with timestamp", async () => {
    const { response: registerResponse, username } = await registerUser();
    expect(registerResponse.status).toBe(200);

    const createApiKeyResponse = await createApiKey(username, "Test Key", ["Read", "Create"], "2025-06-01T12:00:00Z", { jwt: registerResponse.text });
    expect(createApiKeyResponse.status).toBe(200);

    const getApiKeyResponse = await getApiKey(username, createApiKeyResponse.body.id, { jwt: registerResponse.text });
    expect(getApiKeyResponse.status).toBe(200);
    expect(getApiKeyResponse.body.name).toBe("Test Key");
    expect(getApiKeyResponse.body.capabilities).toEqual(["Create", "Read"]);
    expect(getApiKeyResponse.body.expires_at).toBe("Sun, 1 Jun 2025 12:00:00 +0000");
  });

  test.concurrent("List api keys", async () => {
    const { response: registerResponse, username } = await registerUser();
    expect(registerResponse.status).toBe(200);

    const createApiKeyResponse = await createApiKey(username, "Test Key", ["Read", "Create"], "2025-06-01T12:00:00Z", { jwt: registerResponse.text });
    expect(createApiKeyResponse.status).toBe(200);

    const createApiKeyResponse2 = await createApiKey(username, "Test Key", ["Read", "Create"], "2025-06-01T12:00:00Z", { jwt: registerResponse.text });
    expect(createApiKeyResponse2.status).toBe(200);

    const createApiKeyResponse3 = await createApiKey(username, "Test Key", ["Read", "Create"], "2025-06-01T12:00:00Z", { jwt: registerResponse.text });
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

  test.concurrent("Delete api key", async () => {
    const { response: registerResponse, username } = await registerUser();
    expect(registerResponse.status).toBe(200);

    const createApiKeyResponse = await createApiKey(username, "Test Key", ["Read", "Create"], undefined, { jwt: registerResponse.text });
    expect(createApiKeyResponse.status).toBe(200);

    const getApiKeyResponse = await getApiKey(username, createApiKeyResponse.body.id, { jwt: registerResponse.text });
    expect(getApiKeyResponse.status).toBe(200);

    const deleteApiKeyResponse = await deleteApiKey(username, createApiKeyResponse.body.id, { jwt: registerResponse.text });
    expect(deleteApiKeyResponse.status).toBe(200);

    const getApiKeyResponse2 = await getApiKey(username, createApiKeyResponse.body.id, { jwt: registerResponse.text });
    expect(getApiKeyResponse2.status).toBe(404);
    expect(getApiKeyResponse2.text).toBe(API_KEY_NOT_FOUND);
  });

  test.concurrent("Create a new api key with invalid capabilities", async () => {
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

  test.concurrent("Create a new api key with an invalid expiration", async () => {
    const { response: registerResponse, username } = await registerUser();
    expect(registerResponse.status).toBe(200);

    const createApiKeyResponse = await createApiKey(username, "Test Key", ["Read"], "2003-10-28T12:00:00Z", { jwt: registerResponse.text });
    expect(createApiKeyResponse.status).toBe(400);
    expect(createApiKeyResponse.text).toBe(INVALID_TIMESTAMP);

    const createApiKeyResponse2 = await createApiKey(username, "Test Key", ["Read"], "invalid timestamp", { jwt: registerResponse.text });
    expect(createApiKeyResponse2.status).toBe(400);
    expect(createApiKeyResponse2.text).toBe(INVALID_TIMESTAMP);
  });

  test.concurrent("Create a new api key for a non-existent user", async () => {
    const { response: registerResponse } = await registerUser(undefined, undefined, process.env.ADMIN_KEY);
    expect(registerResponse.status).toBe(200);

    const createApiKeyResponse = await createApiKey("ghost", "Test Key", ["Read"], undefined, { jwt: registerResponse.text });
    expect(createApiKeyResponse.status).toBe(404);
    expect(createApiKeyResponse.text).toBe(USER_NOT_FOUND);
  });

  test.concurrent("List api keys non-existent user", async () => {
    const { response: registerResponse } = await registerUser(undefined, undefined, process.env.ADMIN_KEY);
    expect(registerResponse.status).toBe(200);

    const getApiKeysResponse = await getApiKeys("ghost", { jwt: registerResponse.text })
    expect(getApiKeysResponse.status).toBe(404);
    expect(getApiKeysResponse.text).toBe(USER_NOT_FOUND);
  });

  test.concurrent("Delete api key for non-existent user", async () => {
    const { response: registerResponse, username } = await registerUser(undefined, undefined, process.env.ADMIN_KEY);
    expect(registerResponse.status).toBe(200);

    const createApiKeyResponse = await createApiKey(username, "Test Key", ["Read", "Create"], undefined, { jwt: registerResponse.text });
    expect(createApiKeyResponse.status).toBe(200);

    const deleteApiKeyResponse = await deleteApiKey("ghost", createApiKeyResponse.body.id, { jwt: registerResponse.text });
    expect(deleteApiKeyResponse.status).toBe(404);
    expect(deleteApiKeyResponse.text).toBe(USER_NOT_FOUND);

    const getApiKeyResponse2 = await getApiKey(username, createApiKeyResponse.body.id, { jwt: registerResponse.text });
    expect(getApiKeyResponse2.status).toBe(200);
  });

  test.concurrent("Delete a non-existent api key", async () => {
    const { response: registerResponse, username } = await registerUser();
    expect(registerResponse.status).toBe(200);

    const createApiKeyResponse = await createApiKey(username, "Test Key", ["Read", "Create"], undefined, { jwt: registerResponse.text });
    expect(createApiKeyResponse.status).toBe(200);

    const deleteApiKeyResponse = await deleteApiKey(username, "not found", { jwt: registerResponse.text });
    expect(deleteApiKeyResponse.status).toBe(404);
    expect(deleteApiKeyResponse.text).toBe(API_KEY_NOT_FOUND);
  });

  test.concurrent("Get a non-existent api key", async () => {
    const { response: registerResponse, username } = await registerUser();
    expect(registerResponse.status).toBe(200);

    const getApiKeyResponse = await getApiKey(username, "not found", { jwt: registerResponse.text });
    expect(getApiKeyResponse.status).toBe(404);
    expect(getApiKeyResponse.text).toBe(API_KEY_NOT_FOUND);
  });

  test.concurrent("Get an api key from a non-existent user", async () => {
    const { response: registerResponse, username } = await registerUser(undefined, undefined, process.env.ADMIN_KEY);
    expect(registerResponse.status).toBe(200);

    const createApiKeyResponse = await createApiKey(username, "Test Key", ["Read"], undefined, { jwt: registerResponse.text });
    expect(createApiKeyResponse.status).toBe(200);

    const getApiKeyResponse = await getApiKey("not found", createApiKeyResponse.body.id, { jwt: registerResponse.text });
    expect(getApiKeyResponse.status).toBe(404);
    expect(getApiKeyResponse.text).toBe(USER_NOT_FOUND);
  });

  test.concurrent("Create api key without auth", async () => {
    const { response: registerResponse, username } = await registerUser();
    expect(registerResponse.status).toBe(200);

    const createApiKeyResponse = await createApiKey(username, "Test Key", ["Read"], undefined);
    expect(createApiKeyResponse.status).toBe(401);
    expect(createApiKeyResponse.text).toBe(UNAUTHORIZED);
  });

  test.concurrent("Delete api key without auth", async () => {
    const { response: registerResponse, username } = await registerUser();
    expect(registerResponse.status).toBe(200);

    const createApiKeyResponse = await createApiKey(username, "Test Key", ["Read", "Create"], undefined, { jwt: registerResponse.text });
    expect(createApiKeyResponse.status).toBe(200);

    const deleteApiKeyResponse = await deleteApiKey(username, createApiKeyResponse.body.id);
    expect(deleteApiKeyResponse.status).toBe(401);
    expect(deleteApiKeyResponse.text).toBe(UNAUTHORIZED);
  });

  test.concurrent("Create api key with api key auth without admin", async () => {
    const { response: registerResponse, username } = await registerUser();
    expect(registerResponse.status).toBe(200);

    const createApiKeyResponse = await createApiKey(username, "Test Key", ["Read"], undefined, { jwt: registerResponse.text });
    expect(createApiKeyResponse.status).toBe(200);

    const createApiKeyResponse2 = await createApiKey(username, "Test Key", ["Read"], undefined, { apiKey: createApiKeyResponse.body.key });
    expect(createApiKeyResponse2.status).toBe(403);
    expect(createApiKeyResponse2.text).toBe(FORBIDDEN);
  });

  test.concurrent("Delete api key with api key auth without admin", async () => {
    const { response: registerResponse, username } = await registerUser();
    expect(registerResponse.status).toBe(200);

    const createApiKeyResponse = await createApiKey(username, "Test Key", ["Read", "Create"], undefined, { jwt: registerResponse.text });
    expect(createApiKeyResponse.status).toBe(200);

    const deleteApiKeyResponse = await deleteApiKey(username, createApiKeyResponse.body.id, { apiKey: createApiKeyResponse.body.key });
    expect(deleteApiKeyResponse.status).toBe(403);
    expect(deleteApiKeyResponse.text).toBe(FORBIDDEN);
  });

  test.concurrent("Get api key with api key auth without admin", async () => {
    const { response: registerResponse, username } = await registerUser();
    expect(registerResponse.status).toBe(200);

    const createApiKeyResponse = await createApiKey(username, "Test Key", ["Read"], undefined, { jwt: registerResponse.text });
    expect(createApiKeyResponse.status).toBe(200);

    const getApiKeyResponse = await getApiKey(username, createApiKeyResponse.body.id, { apiKey: createApiKeyResponse.body.key });
    expect(getApiKeyResponse.status).toBe(403);
    expect(getApiKeyResponse.text).toBe(FORBIDDEN);
  });

  test.concurrent("Create api key with api key auth with admin", async () => {
    const { response: registerResponse, username } = await registerUser(undefined, undefined, process.env.ADMIN_KEY);
    expect(registerResponse.status).toBe(200);

    const createApiKeyResponse = await createApiKey(username, "Test Key", ["Read"], undefined, { jwt: registerResponse.text });
    expect(createApiKeyResponse.status).toBe(200);

    const createApiKeyResponse2 = await createApiKey(username, "Test Key", ["Read"], undefined, { apiKey: createApiKeyResponse.body.key });
    expect(createApiKeyResponse2.status).toBe(403);
    expect(createApiKeyResponse2.text).toBe(FORBIDDEN);
  });

  test.concurrent("Delete api key with api key auth with admin", async () => {
    const { response: registerResponse, username } = await registerUser(undefined, undefined, process.env.ADMIN_KEY);
    expect(registerResponse.status).toBe(200);

    const createApiKeyResponse = await createApiKey(username, "Test Key", ["Read", "Create"], undefined, { jwt: registerResponse.text });
    expect(createApiKeyResponse.status).toBe(200);

    const deleteApiKeyResponse = await deleteApiKey(username, createApiKeyResponse.body.id, { apiKey: createApiKeyResponse.body.key });
    expect(deleteApiKeyResponse.status).toBe(403);
    expect(deleteApiKeyResponse.text).toBe(FORBIDDEN);
  });

  test.concurrent("Get api key with api key auth with admin", async () => {
    const { response: registerResponse, username } = await registerUser(undefined, undefined, process.env.ADMIN_KEY);
    expect(registerResponse.status).toBe(200);

    const createApiKeyResponse = await createApiKey(username, "Test Key", ["Read"], undefined, { jwt: registerResponse.text });
    expect(createApiKeyResponse.status).toBe(200);

    const getApiKeyResponse = await getApiKey(username, createApiKeyResponse.body.id, { apiKey: createApiKeyResponse.body.key });
    expect(getApiKeyResponse.status).toBe(403);
    expect(getApiKeyResponse.text).toBe(FORBIDDEN);
  });

  test.concurrent("Get api key without auth", async () => {
    const { response: registerResponse, username } = await registerUser();
    expect(registerResponse.status).toBe(200);

    const createApiKeyResponse = await createApiKey(username, "Test Key", ["Read"], undefined, { jwt: registerResponse.text });
    expect(createApiKeyResponse.status).toBe(200);

    const getApiKeyResponse = await getApiKey(username, createApiKeyResponse.body.id);
    expect(getApiKeyResponse.status).toBe(401);
    expect(getApiKeyResponse.text).toBe(UNAUTHORIZED);
  });

  test.concurrent("Create api key for another user without admin", async () => {
    const { response: registerResponse } = await registerUser();
    expect(registerResponse.status).toBe(200);

    const { response: registerResponse2, username } = await registerUser();
    expect(registerResponse2.status).toBe(200);

    const createApiKeyResponse = await createApiKey(username, "Test Key", ["Read"], undefined, { jwt: registerResponse.text });
    expect(createApiKeyResponse.status).toBe(403);
    expect(createApiKeyResponse.text).toBe(FORBIDDEN);
  });

  test.concurrent("Get api key from another user without admin", async () => {
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

  test.concurrent("Delete api key from another user without admin", async () => {
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

  test.concurrent("Delete api key from another user with admin", async () => {
    const { response: registerResponse, username } = await registerUser();
    expect(registerResponse.status).toBe(200);

    const createApiKeyResponse = await createApiKey(username, "Test Key", ["Read", "Create"], undefined, { jwt: registerResponse.text });
    expect(createApiKeyResponse.status).toBe(200);

    const { response: registerResponse2 } = await registerUser(undefined, undefined, process.env.ADMIN_KEY);
    expect(registerResponse2.status).toBe(200);

    const deleteApiKeyResponse = await deleteApiKey(username, createApiKeyResponse.body.id, { jwt: registerResponse2.text });
    expect(deleteApiKeyResponse.status).toBe(200);

    const getApiKeyResponse = await getApiKey(username, createApiKeyResponse.body.id, { jwt: registerResponse2.text });
    expect(getApiKeyResponse.status).toBe(404);
    expect(getApiKeyResponse.text).toBe(API_KEY_NOT_FOUND);
  });

  test.concurrent("Create api key for another user with admin", async () => {
    const { response: registerResponse } = await registerUser(undefined, undefined, process.env.ADMIN_KEY);
    expect(registerResponse.status).toBe(200);

    const { response: registerResponse2, username } = await registerUser();
    expect(registerResponse2.status).toBe(200);

    const createApiKeyResponse = await createApiKey(username, "Test Key", ["Read"], undefined, { jwt: registerResponse.text });
    expect(createApiKeyResponse.status).toBe(200);

    const getApiKeyResponse = await getApiKey(username, createApiKeyResponse.body.id, { jwt: registerResponse.text });
    expect(getApiKeyResponse.status).toBe(200);
  });

  test.concurrent("List api keys without auth", async () => {
    const { response: registerResponse, username } = await registerUser();
    expect(registerResponse.status).toBe(200);

    const createApiKeyResponse = await createApiKey(username, "Test Key", ["Read", "Create"], "2025-06-01T12:00:00Z", { jwt: registerResponse.text });
    expect(createApiKeyResponse.status).toBe(200);

    const getApiKeysResponse = await getApiKeys(username);
    expect(getApiKeysResponse.status).toBe(401);
    expect(getApiKeysResponse.text).toBe(UNAUTHORIZED);
  });

  test.concurrent("List api keys with api key auth with admin", async () => {
    const { response: registerResponse, username } = await registerUser(undefined, undefined, process.env.ADMIN_KEY);
    expect(registerResponse.status).toBe(200);

    const createApiKeyResponse = await createApiKey(username, "Test Key", ["Read", "Create"], "2025-06-01T12:00:00Z", { jwt: registerResponse.text });
    expect(createApiKeyResponse.status).toBe(200);

    const getApiKeysResponse = await getApiKeys(username, { apiKey: createApiKeyResponse.body.key });
    expect(getApiKeysResponse.status).toBe(403);
    expect(getApiKeysResponse.text).toBe(FORBIDDEN);
  });

  test.concurrent("List api keys with api key auth without admin", async () => {
    const { response: registerResponse, username } = await registerUser();
    expect(registerResponse.status).toBe(200);

    const createApiKeyResponse = await createApiKey(username, "Test Key", ["Read", "Create"], "2025-06-01T12:00:00Z", { jwt: registerResponse.text });
    expect(createApiKeyResponse.status).toBe(200);

    const getApiKeysResponse = await getApiKeys(username, { apiKey: createApiKeyResponse.body.key });
    expect(getApiKeysResponse.status).toBe(403);
    expect(getApiKeysResponse.text).toBe(FORBIDDEN);
  });

  test.concurrent("List api keys from another user without admin", async () => {
    const { response: registerResponse, username } = await registerUser();
    expect(registerResponse.status).toBe(200);

    const createApiKeyResponse = await createApiKey(username, "Test Key", ["Read", "Create"], "2025-06-01T12:00:00Z", { jwt: registerResponse.text });
    expect(createApiKeyResponse.status).toBe(200);

    const { response: registerResponse2 } = await registerUser();
    expect(registerResponse2.status).toBe(200);

    const getApiKeysResponse = await getApiKeys(username, { jwt: registerResponse2.text })
    expect(getApiKeysResponse.status).toBe(403);
    expect(getApiKeysResponse.text).toBe(FORBIDDEN);
  });

  test.concurrent("List api keys from another user with admin", async () => {
    const { response: registerResponse, username } = await registerUser();
    expect(registerResponse.status).toBe(200);

    const createApiKeyResponse = await createApiKey(username, "Test Key", ["Read", "Create"], "2025-06-01T12:00:00Z", { jwt: registerResponse.text });
    expect(createApiKeyResponse.status).toBe(200);

    const { response: registerResponse2 } = await registerUser(undefined, undefined, process.env.ADMIN_KEY);
    expect(registerResponse2.status).toBe(200);

    const getApiKeysResponse = await getApiKeys(username, { jwt: registerResponse2.text });
    expect(getApiKeysResponse.status).toBe(200);
  });

  test.concurrent("Create api key invalid request", async () => {
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

describe("User preference tests", () => {
  test.concurrent("Get preferences", async () => {
    const { response: registerResponse, username } = await registerUser();
    expect(registerResponse.status).toBe(200);

    const getPreferencesResponse = await getPreferences(username, { jwt: registerResponse.text });
    expect(getPreferencesResponse.status).toBe(200);
    expect(getPreferencesResponse.body).toHaveProperty("metadata_providers");
    expect(getPreferencesResponse.body.metadata_providers).toEqual(["epub_metadata_extractor"]);
  });

  test.concurrent("Update preferences", async () => {
    const { response: registerResponse, username } = await registerUser();
    expect(registerResponse.status).toBe(200);

    const getPreferencesResponse = await getPreferences(username, { jwt: registerResponse.text });
    expect(getPreferencesResponse.status).toBe(200);
    expect(getPreferencesResponse.body).toHaveProperty("metadata_providers");
    expect(getPreferencesResponse.body.metadata_providers).toEqual(["epub_metadata_extractor"]);

    const updatePreferencesResponse = await updatePreferences(
      username,
      ["goodreads_metadata_scraper", "epub_metadata_extractor"],
      { jwt: registerResponse.text }
    );
    expect(updatePreferencesResponse.status).toBe(200);

    const getPreferencesResponse2 = await getPreferences(username, { jwt: registerResponse.text });
    expect(getPreferencesResponse2.status).toBe(200);
    expect(getPreferencesResponse2.body).toHaveProperty("metadata_providers");
    expect(getPreferencesResponse2.body.metadata_providers).toEqual(["goodreads_metadata_scraper", "epub_metadata_extractor"]);

    const updatePreferencesResponse2 = await updatePreferences(
      username,
      [],
      { jwt: registerResponse.text }
    );
    expect(updatePreferencesResponse2.status).toBe(200);

    const getPreferencesResponse3 = await getPreferences(username, { jwt: registerResponse.text });
    expect(getPreferencesResponse3.status).toBe(200);
    expect(getPreferencesResponse3.body).toHaveProperty("metadata_providers");
    expect(getPreferencesResponse3.body.metadata_providers).toEqual([]);
  });

  test.concurrent("Update preferences with invalid providers", async () => {
    const { response: registerResponse, username } = await registerUser();
    expect(registerResponse.status).toBe(200);

    const updatePreferencesResponse2 = await updatePreferences(
      username,
      ["invalid provider"],
      { jwt: registerResponse.text }
    );
    expect(updatePreferencesResponse2.status).toBe(400);
  });

  test.concurrent("Update preferences non-existent user", async () => {
    const { response: registerResponse } = await registerUser(undefined, undefined, process.env.ADMIN_KEY);
    expect(registerResponse.status).toBe(200);

    const updatePreferencesResponse = await updatePreferences(
      "ghost",
      ["goodreads_metadata_scraper"],
      { jwt: registerResponse.text }
    );
    expect(updatePreferencesResponse.status).toBe(404);
    expect(updatePreferencesResponse.text).toBe(USER_NOT_FOUND);
  });

  test.concurrent("Get preferences non-existent user", async () => {
    const { response: registerResponse } = await registerUser(undefined, undefined, process.env.ADMIN_KEY);
    expect(registerResponse.status).toBe(200);

    const getPreferencesResponse = await getPreferences("ghost", { jwt: registerResponse.text });
    expect(getPreferencesResponse.status).toBe(404);
    expect(getPreferencesResponse.text).toBe(USER_NOT_FOUND);
  });

  test.concurrent("Update preferences for another user admin", async () => {
    const { response: registerResponse, username } = await registerUser();
    expect(registerResponse.status).toBe(200);

    const { response: registerResponse2 } = await registerUser(undefined, undefined, process.env.ADMIN_KEY);
    expect(registerResponse2.status).toBe(200);

    const updatePreferencesResponse = await updatePreferences(
      username,
      ["goodreads_metadata_scraper"],
      { jwt: registerResponse2.text }
    );
    expect(updatePreferencesResponse.status).toBe(200);
  });

  test.concurrent("Get preferences for another user admin", async () => {
    const { response: registerResponse, username } = await registerUser();
    expect(registerResponse.status).toBe(200);

    const { response: registerResponse2 } = await registerUser(undefined, undefined, process.env.ADMIN_KEY);
    expect(registerResponse2.status).toBe(200);

    const getPreferencesResponse = await getPreferences(username, { jwt: registerResponse2.text });
    expect(getPreferencesResponse.status).toBe(200);
  });

  test.concurrent("Update preferences for another user no admin", async () => {
    const { response: registerResponse, username } = await registerUser();
    expect(registerResponse.status).toBe(200);

    const { response: registerResponse2 } = await registerUser();
    expect(registerResponse2.status).toBe(200);

    const updatePreferencesResponse = await updatePreferences(
      username,
      ["goodreads_metadata_scraper"],
      { jwt: registerResponse2.text }
    );
    expect(updatePreferencesResponse.status).toBe(403);
    expect(updatePreferencesResponse.text).toBe(FORBIDDEN);
  });

  test.concurrent("Get preferences for another user no admin", async () => {
    const { response: registerResponse, username } = await registerUser();
    expect(registerResponse.status).toBe(200);

    const { response: registerResponse2 } = await registerUser();
    expect(registerResponse2.status).toBe(200);

    const getPreferencesResponse = await getPreferences(username, { jwt: registerResponse2.text });
    expect(getPreferencesResponse.status).toBe(403);
    expect(getPreferencesResponse.text).toBe(FORBIDDEN);
  });

  test.concurrent("Get preferences no auth", async () => {
    const { response: registerResponse, username } = await registerUser();
    expect(registerResponse.status).toBe(200);

    const getPreferencesResponse = await getPreferences(username);
    expect(getPreferencesResponse.status).toBe(401);
    expect(getPreferencesResponse.text).toBe(UNAUTHORIZED);
  });

  test.concurrent("Update preferences no auth", async () => {
    const { response: registerResponse, username } = await registerUser();
    expect(registerResponse.status).toBe(200);

    const updatePreferencesResponse = await updatePreferences(
      username,
      ["goodreads_metadata_scraper"]
    );
    expect(updatePreferencesResponse.status).toBe(401);
    expect(updatePreferencesResponse.text).toBe(UNAUTHORIZED);
  });

  test.concurrent("Update preferences invalid request", async () => {
    const { response: registerResponse, username } = await registerUser();
    expect(registerResponse.status).toBe(200);

    const updatePreferencesResponse = await request(SERVER_URL)
      .put(`/users/${username}/preferences`)
      .auth(registerResponse.text, { type: "bearer" })
      .send({
        bad: "field"
      });

    expect(updatePreferencesResponse.status).toBe(422);
  });
});