import request from "supertest";
import { randomString } from "../utils/common";

const SERVER_URL = "http://localhost:5000";

describe("Register and login", () => {
  test("Register a new user", async () => {
    const username = randomString(16);
    const password = randomString(16);

    const registerResponse = await request(SERVER_URL).post("/users").send({
      username: username,
      password: password
    })

    expect(registerResponse.status).toBe(200);

    const loginResponse = await request(SERVER_URL).post("/users/" + username).send({
      password: password
    })

    expect(loginResponse.status).toBe(200);
  });

  test("Register a new admin user", async () => {
    const username = randomString(16);
    const password = randomString(16);
    const adminKey = "admin_key";

    const registerResponse = await request(SERVER_URL).post("/users").send({
      username: username,
      password: password,
      admin_key: adminKey
    })

    expect(registerResponse.status).toBe(200);

    const loginResponse = await request(SERVER_URL).post("/users/" + username).send({
      password: password
    })

    expect(loginResponse.status).toBe(200);
  });

  test("Register with an invalid admin key", async () => {
    const username = randomString(16);
    const password = randomString(16);
    const adminKey = "invalid_admin_key";

    const registerResponse = await request(SERVER_URL).post("/users").send({
      username: username,
      password: password,
      admin_key: adminKey
    })

    expect(registerResponse.status).toBe(403);
  });

  test("Register with an invalid username and password", async () => {
    const username = randomString(16);
    const password = randomString(16);

    const registerResponse = await request(SERVER_URL).post("/users").send({
      username: "invalid username",
      password: password
    })

    expect(registerResponse.status).toBe(400);

    const registerResponse2 = await request(SERVER_URL).post("/users").send({
      username: username,
      password: "invalid password"
    })

    expect(registerResponse2.status).toBe(400);
  });

  test("Register with an existing username", async () => {
    const username = randomString(16);
    const password = randomString(16);

    const registerResponse = await request(SERVER_URL).post("/users").send({
      username: username,
      password: password
    })

    expect(registerResponse.status).toBe(200);

    const registerResponse2 = await request(SERVER_URL).post("/users").send({
      username: username,
      password: password
    })

    expect(registerResponse2.status).toBe(409);
  });

  test("Login with a non-existing username", async () => {
    const username = randomString(16);
    const password = randomString(16);

    const loginResponse = await request(SERVER_URL).post("/users/" + username).send({
      password: password
    })

    expect(loginResponse.status).toBe(404);
  });

  test("Login with invalid credentials", async () => {
    let username = randomString(16);
    let password = randomString(16);

    const registerResponse = await request(SERVER_URL).post("/users").send({
      username: username,
      password: password
    })

    expect(registerResponse.status).toBe(200);

    const loginResponse = await request(SERVER_URL).post("/users/" + username).send({
      password: password + "1"
    })

    expect(loginResponse.status).toBe(403);
  });

  test("Register and login with invalid request body", async () => {
    const username = randomString(16);
    const password = randomString(16);

    const registerResponse = await request(SERVER_URL).post("/users").send({
      username: username,
      pass: password
    })

    expect(registerResponse.status).toBe(422);

    const loginResponse = await request(SERVER_URL).post("/users/" + username).send({
      pass: password
    })

    expect(loginResponse.status).toBe(422);
  });
});

//TODO missing auth
describe("Api key tests", () => {
  test("Create a new api key with timestamp", async () => {
    const username = randomString(16);
    const password = randomString(16);

    const registerResponse = await request(SERVER_URL).post("/users").send({
      username: username,
      password: password
    })

    expect(registerResponse.status).toBe(200);

    const createApiKeyResponse = await request(SERVER_URL).post(`/users/${username}/keys`).send({
      name: "key name",
      capabilities: ["Read", "Create"],
      expires_at: "2023-06-01T12:00:00Z"
    })

    expect(createApiKeyResponse.status).toBe(200);
  });

  test("Create a new api key without timestamp", async () => {
    const username = randomString(16);
    const password = randomString(16);

    const registerResponse = await request(SERVER_URL).post("/users").send({
      username: username,
      password: password
    })

    expect(registerResponse.status).toBe(200);

    const createApiKeyResponse = await request(SERVER_URL).post(`/users/${username}/keys`).send({
      name: "key name",
      capabilities: ["Read", "Create"]
    })

    expect(createApiKeyResponse.status).toBe(200);
  });
});