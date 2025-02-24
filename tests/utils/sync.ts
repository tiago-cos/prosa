import request from "supertest";
import { SERVER_URL } from "./common";

export const INVALID_TIMESTAMP = "The provided timestamp is invalid.";

export async function sync(user_id: string, timestamp?: any, auth?: { jwt?: string; apiKey?: string }) {
    let req = request(SERVER_URL)
        .get(`/users/${user_id}/sync`);

    if (timestamp) req = req.query({ since: timestamp });
    if (auth?.jwt) req = req.auth(auth.jwt, { type: "bearer" });
    if (auth?.apiKey) req = req.set("api-key", auth.apiKey);

    return req.send();
}