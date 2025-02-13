import request from "supertest";
import path from "path";
import { BOOK_DIR } from "./common";
import { SERVER_URL } from "./common";

export const BOOK_CONFLICT = "This book is already in your library.";
export const BOOK_NOT_FOUND = "The requested book does not exist or is not accessible.";
export const INVALID_BOOK = "The provided EPUB data is invalid.";

export async function uploadBook(owner_id: string, epub_name: string, auth?: { jwt?: string; apiKey?: string }) {
    let req = request(SERVER_URL)
        .post(`/books`)
        .field("owner_id", owner_id);

    if (auth?.jwt) req = req.auth(auth.jwt, { type: "bearer" });
    if (auth?.apiKey) req = req.set("api-key", auth.apiKey);

    return req.attach("epub", path.join(BOOK_DIR, epub_name));
}

export async function downloadBook(book_id: string, auth?: { jwt?: string; apiKey?: string }) {
    let req = request(SERVER_URL)
        .get(`/books/${book_id}`);

    if (auth?.jwt) req = req.auth(auth.jwt, { type: "bearer" });
    if (auth?.apiKey) req = req.set("api-key", auth.apiKey);

    return req.send();
}

export async function deleteBook(book_id: string, auth?: { jwt?: string; apiKey?: string }) {
    let req = request(SERVER_URL)
        .delete(`/books/${book_id}`);

    if (auth?.jwt) req = req.auth(auth.jwt, { type: "bearer" });
    if (auth?.apiKey) req = req.set("api-key", auth.apiKey);

    return req.send();
}