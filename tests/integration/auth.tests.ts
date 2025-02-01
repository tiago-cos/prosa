import request from "supertest";
import { randomString } from "../utils/common";
import { SERVER_URL } from "../utils/common";
import { loginUser, registerUser } from "../utils/users";

describe("Register and login", () => {
  test.concurrent("Register a new user", async () => {
    const { response: registerResponse, username, password } = await registerUser();
    expect(registerResponse.status).toBe(200);

    const { response: loginResponse } = await loginUser(username, password);
    expect(loginResponse.status).toBe(200);
  });
});