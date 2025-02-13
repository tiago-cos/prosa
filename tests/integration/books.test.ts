import request from "supertest";
import { BOOK_DIR, FORBIDDEN, randomString, UNAUTHORIZED } from "../utils/common";
import { SERVER_URL } from "../utils/common";
import { registerUser, loginUser, createApiKey, getApiKey, getApiKeys, deleteApiKey, getPreferences, updatePreferences, USER_NOT_FOUND } from "../utils/users"
import { BOOK_CONFLICT, BOOK_NOT_FOUND, deleteBook, downloadBook, INVALID_BOOK, uploadBook } from "../utils/books"
import path from "path";
import fs from "fs";

describe("Upload book JWT", () => {
    test.concurrent("Upload and download book", async () => {
        const { response: registerResponse, username } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const uploadResponse = await uploadBook(username, "The_Great_Gatsby.epub", { jwt: registerResponse.text });
        expect(uploadResponse.status).toBe(200);

        const downloadResponse = await downloadBook(uploadResponse.text, { jwt: registerResponse.text });
        expect(downloadResponse.status).toBe(200);

        let epub = path.join(BOOK_DIR, "The_Great_Gatsby.epub");
        let originalSize = fs.statSync(epub).size;
        let downloadedSize = downloadResponse.body.length;

        expect(downloadedSize).toBeGreaterThan(originalSize);
    });

    test.concurrent("Upload repeated book", async () => {
        const { response: registerResponse, username } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const uploadResponse = await uploadBook(username, "The_Wonderful_Wizard_of_Oz.epub", { jwt: registerResponse.text });
        expect(uploadResponse.status).toBe(200);

        const uploadResponse2 = await uploadBook(username, "The_Wonderful_Wizard_of_Oz.epub", { jwt: registerResponse.text });
        expect(uploadResponse2.status).toBe(409);
        expect(uploadResponse2.text).toBe(BOOK_CONFLICT);

        const { response: registerResponse2, username: username2 } = await registerUser();
        expect(registerResponse2.status).toBe(200);

        // Books are only considered repeated in the same user's library
        const uploadResponse3 = await uploadBook(username2, "The_Wonderful_Wizard_of_Oz.epub", { jwt: registerResponse2.text });
        expect(uploadResponse3.status).toBe(200);
    });

    test.concurrent("Upload invalid book", async () => {
        const { response: registerResponse, username } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const uploadResponse = await uploadBook(username, "This_is_not_an_epub.txt", { jwt: registerResponse.text });
        expect(uploadResponse.status).toBe(400);
        expect(uploadResponse.text).toBe(INVALID_BOOK);
    });

    test.concurrent("Upload book | Different username | !admin", async () => {
        const { response: registerResponse } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const { response: registerResponse2, username: username2 } = await registerUser();
        expect(registerResponse2.status).toBe(200);

        const uploadResponse = await uploadBook(username2, "The_Wonderful_Wizard_of_Oz.epub", { jwt: registerResponse.text });
        expect(uploadResponse.status).toBe(403);
        expect(uploadResponse.text).toBe(FORBIDDEN);
    });

    test.concurrent("Upload book | Different username | admin", async () => {
        const { response: registerResponse } = await registerUser(undefined, undefined, process.env.ADMIN_KEY);
        expect(registerResponse.status).toBe(200);

        const { response: registerResponse2, username: username2 } = await registerUser();
        expect(registerResponse2.status).toBe(200);

        const uploadResponse = await uploadBook(username2, "The_Wonderful_Wizard_of_Oz.epub", { jwt: registerResponse.text });
        expect(uploadResponse.status).toBe(200);
    });

    test.concurrent("Upload book | Non-existent username | admin", async () => {
        const { response: registerResponse } = await registerUser(undefined, undefined, process.env.ADMIN_KEY);
        expect(registerResponse.status).toBe(200);

        const uploadResponse = await uploadBook("ghost", "The_Wonderful_Wizard_of_Oz.epub", { jwt: registerResponse.text });
        expect(uploadResponse.status).toBe(404);
        expect(uploadResponse.text).toBe(USER_NOT_FOUND);
    });

    //TODO sometimes this fails with write EPIPE
    test.concurrent("Upload book | No auth", async () => {
        const { response: registerResponse, username} = await registerUser();
        expect(registerResponse.status).toBe(200);

        const uploadResponse = await uploadBook(username, "The_Wonderful_Wizard_of_Oz.epub");
        expect(uploadResponse.status).toBe(401);
        expect(uploadResponse.text).toBe(UNAUTHORIZED);
    });
});

describe("Upload book api key", () => {
    test.concurrent("Upload and download book", async () => {
        const { response: registerResponse, username } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const createApiKeyResponse = await createApiKey(username, "Test Key", ["Create", "Read"], undefined, { jwt: registerResponse.text });
        expect(createApiKeyResponse.status).toBe(200);

        const uploadResponse = await uploadBook(username, "The_Great_Gatsby.epub", { apiKey: createApiKeyResponse.body.key });
        expect(uploadResponse.status).toBe(200);

        const downloadResponse = await downloadBook(uploadResponse.text, { apiKey: createApiKeyResponse.body.key });
        expect(downloadResponse.status).toBe(200);

        let epub = path.join(BOOK_DIR, "The_Great_Gatsby.epub");
        let originalSize = fs.statSync(epub).size;
        let downloadedSize = downloadResponse.body.length;

        expect(downloadedSize).toBeGreaterThan(originalSize);
    });

    test.concurrent("Upload repeated book", async () => {
        const { response: registerResponse, username } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const createApiKeyResponse = await createApiKey(username, "Test Key", ["Create"], undefined, { jwt: registerResponse.text });
        expect(createApiKeyResponse.status).toBe(200);

        const uploadResponse = await uploadBook(username, "The_Wonderful_Wizard_of_Oz.epub", { apiKey: createApiKeyResponse.body.key });
        expect(uploadResponse.status).toBe(200);

        const uploadResponse2 = await uploadBook(username, "The_Wonderful_Wizard_of_Oz.epub", { apiKey: createApiKeyResponse.body.key });
        expect(uploadResponse2.status).toBe(409);
        expect(uploadResponse2.text).toBe(BOOK_CONFLICT);

        const { response: registerResponse2, username: username2 } = await registerUser();
        expect(registerResponse2.status).toBe(200);

        const createApiKeyResponse2 = await createApiKey(username2, "Test Key", ["Create"], undefined, { jwt: registerResponse2.text });
        expect(createApiKeyResponse2.status).toBe(200);

        // Books are only considered repeated in the same user's library
        const uploadResponse3 = await uploadBook(username2, "The_Wonderful_Wizard_of_Oz.epub", { apiKey: createApiKeyResponse2.body.key });
        expect(uploadResponse3.status).toBe(200);
    });

    test.concurrent("Upload book | Different username | !admin", async () => {
        const { response: registerResponse, username } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const createApiKeyResponse = await createApiKey(username, "Test Key", ["Create"], undefined, { jwt: registerResponse.text });
        expect(createApiKeyResponse.status).toBe(200);

        const { response: registerResponse2, username: username2 } = await registerUser();
        expect(registerResponse2.status).toBe(200);

        const uploadResponse = await uploadBook(username2, "The_Wonderful_Wizard_of_Oz.epub", { apiKey: createApiKeyResponse.body.key });
        expect(uploadResponse.status).toBe(403);
        expect(uploadResponse.text).toBe(FORBIDDEN);
    });

    test.concurrent("Upload book | Different username | admin", async () => {
        const { response: registerResponse, username } = await registerUser(undefined, undefined, process.env.ADMIN_KEY);
        expect(registerResponse.status).toBe(200);

        const createApiKeyResponse = await createApiKey(username, "Test Key", ["Create"], undefined, { jwt: registerResponse.text });
        expect(createApiKeyResponse.status).toBe(200);

        const { response: registerResponse2, username: username2 } = await registerUser();
        expect(registerResponse2.status).toBe(200);

        const uploadResponse = await uploadBook(username2, "The_Wonderful_Wizard_of_Oz.epub", { apiKey: createApiKeyResponse.body.key });
        expect(uploadResponse.status).toBe(200);
    });

    test.concurrent("Upload book | Non-existent username | admin", async () => {
        const { response: registerResponse, username } = await registerUser(undefined, undefined, process.env.ADMIN_KEY);
        expect(registerResponse.status).toBe(200);

        const createApiKeyResponse = await createApiKey(username, "Test Key", ["Create"], undefined, { jwt: registerResponse.text });
        expect(createApiKeyResponse.status).toBe(200);

        const uploadResponse = await uploadBook("ghost", "The_Wonderful_Wizard_of_Oz.epub", { apiKey: createApiKeyResponse.body.key });
        expect(uploadResponse.status).toBe(404);
        expect(uploadResponse.text).toBe(USER_NOT_FOUND);
    });

    test.concurrent("Upload invalid book", async () => {
        const { response: registerResponse, username } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const createApiKeyResponse = await createApiKey(username, "Test Key", ["Create"], undefined, { jwt: registerResponse.text });
        expect(createApiKeyResponse.status).toBe(200);

        const uploadResponse = await uploadBook(username, "This_is_not_an_epub.txt", { apiKey: createApiKeyResponse.body.key });
        expect(uploadResponse.status).toBe(400);
        expect(uploadResponse.text).toBe(INVALID_BOOK);
    });

    test.concurrent("Upload and download book wrong permissions", async () => {
        const { response: registerResponse, username } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const createApiKeyResponse = await createApiKey(username, "Test Key", ["Create"], undefined, { jwt: registerResponse.text });
        expect(createApiKeyResponse.status).toBe(200);

        const createApiKeyResponse2 = await createApiKey(username, "Test Key", ["Read"], undefined, { jwt: registerResponse.text });
        expect(createApiKeyResponse2.status).toBe(200);

        const uploadResponse = await uploadBook(username, "The_Great_Gatsby.epub", { apiKey: createApiKeyResponse2.body.key });
        expect(uploadResponse.status).toBe(403);
        expect(uploadResponse.text).toBe(FORBIDDEN);

        const downloadResponse = await downloadBook(uploadResponse.text, { apiKey: createApiKeyResponse.body.key });
        expect(downloadResponse.status).toBe(403);
        expect(downloadResponse.text).toBe(FORBIDDEN);
    });
});

describe("Download book JWT", () => {
    test.concurrent("Download non-existent book", async () => {
        const { response: registerResponse } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const downloadResponse = await downloadBook("non-existent", { jwt: registerResponse.text });
        expect(downloadResponse.status).toBe(404);
        expect(downloadResponse.text).toBe(BOOK_NOT_FOUND);
    });

    test.concurrent("Download book | Different username | !admin", async () => {
        const { response: registerResponse, username } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const uploadResponse = await uploadBook(username, "Alices_Adventures_in_Wonderland.epub", { jwt: registerResponse.text });
        expect(uploadResponse.status).toBe(200);

        const { response: registerResponse2 } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const downloadResponse = await downloadBook(uploadResponse.text, { jwt: registerResponse2.text });
        expect(downloadResponse.status).toBe(404);
        expect(downloadResponse.text).toBe(BOOK_NOT_FOUND);
    });

    test.concurrent("Download book | Different username | admin", async () => {
        const { response: registerResponse, username } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const uploadResponse = await uploadBook(username, "Alices_Adventures_in_Wonderland.epub", { jwt: registerResponse.text });
        expect(uploadResponse.status).toBe(200);

        const { response: registerResponse2 } = await registerUser(undefined, undefined, process.env.ADMIN_KEY);
        expect(registerResponse.status).toBe(200);

        const downloadResponse = await downloadBook(uploadResponse.text, { jwt: registerResponse2.text });
        expect(downloadResponse.status).toBe(200);
    });

    test.concurrent("Download book no auth", async () => {
        const { response: registerResponse, username } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const uploadResponse = await uploadBook(username, "Alices_Adventures_in_Wonderland.epub", { jwt: registerResponse.text });
        expect(uploadResponse.status).toBe(200);

        const downloadResponse = await downloadBook(uploadResponse.text);
        expect(downloadResponse.status).toBe(401);
        expect(downloadResponse.text).toBe(UNAUTHORIZED);
    });
});

describe("Download book api key", () => {
    test.concurrent("Download non-existent book", async () => {
        const { response: registerResponse, username } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const createApiKeyResponse = await createApiKey(username, "Test Key", ["Read"], undefined, { jwt: registerResponse.text });
        expect(createApiKeyResponse.status).toBe(200);

        const downloadResponse = await downloadBook("non-existent", { apiKey: createApiKeyResponse.body.key });
        expect(downloadResponse.status).toBe(404);
        expect(downloadResponse.text).toBe(BOOK_NOT_FOUND);
    });

    test.concurrent("Download book | Different username | !admin", async () => {
        const { response: registerResponse, username } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const uploadResponse = await uploadBook(username, "Alices_Adventures_in_Wonderland.epub", { jwt: registerResponse.text });
        expect(uploadResponse.status).toBe(200);

        const { response: registerResponse2, username: username2 } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const createApiKeyResponse = await createApiKey(username2, "Test Key", ["Read"], undefined, { jwt: registerResponse2.text });
        expect(createApiKeyResponse.status).toBe(200);

        const downloadResponse = await downloadBook(uploadResponse.text, { apiKey: createApiKeyResponse.body.key });
        expect(downloadResponse.status).toBe(404);
        expect(downloadResponse.text).toBe(BOOK_NOT_FOUND);
    });

    test.concurrent("Download book | Different username | admin", async () => {
        const { response: registerResponse, username } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const uploadResponse = await uploadBook(username, "Alices_Adventures_in_Wonderland.epub", { jwt: registerResponse.text });
        expect(uploadResponse.status).toBe(200);

        const { response: registerResponse2, username: username2 } = await registerUser(undefined, undefined, process.env.ADMIN_KEY);
        expect(registerResponse.status).toBe(200);

        const createApiKeyResponse = await createApiKey(username2, "Test Key", ["Read"], undefined, { jwt: registerResponse2.text });
        expect(createApiKeyResponse.status).toBe(200);

        const downloadResponse = await downloadBook(uploadResponse.text, { apiKey: createApiKeyResponse.body.key });
        expect(downloadResponse.status).toBe(200);
    });

    test.concurrent("Download book wrong permissions", async () => {
        const { response: registerResponse, username } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const uploadResponse = await uploadBook(username, "Alices_Adventures_in_Wonderland.epub", { jwt: registerResponse.text });
        expect(uploadResponse.status).toBe(200);

        const createApiKeyResponse = await createApiKey(username, "Test Key", ["Create"], undefined, { jwt: registerResponse.text });
        expect(createApiKeyResponse.status).toBe(200);

        const downloadResponse = await downloadBook(uploadResponse.text, { apiKey: createApiKeyResponse.body.key });
        expect(downloadResponse.status).toBe(403);
        expect(downloadResponse.text).toBe(FORBIDDEN);
    });
});

//TODO in the future, make more advanced tests where we try to get metadata and cover after deleting book
describe("Delete book JWT", () => {
    test.concurrent("Delete book", async () => {
        const { response: registerResponse, username } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const uploadResponse = await uploadBook(username, "The_Great_Gatsby.epub", { jwt: registerResponse.text });
        expect(uploadResponse.status).toBe(200);

        const downloadResponse = await downloadBook(uploadResponse.text, { jwt: registerResponse.text });
        expect(downloadResponse.status).toBe(200);

        const deleteResponse = await deleteBook(uploadResponse.text, { jwt: registerResponse.text });
        expect(deleteResponse.status).toBe(200);

        const downloadResponse2 = await downloadBook(uploadResponse.text, { jwt: registerResponse.text });
        expect(downloadResponse2.status).toBe(404);
        expect(downloadResponse2.text).toBe(BOOK_NOT_FOUND);
    });

    test.concurrent("Delete non-existent book", async () => {
        const { response: registerResponse } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const deleteResponse = await deleteBook("non-existent", { jwt: registerResponse.text });
        expect(deleteResponse.status).toBe(404);
        expect(deleteResponse.text).toBe(BOOK_NOT_FOUND);
    });

    test.concurrent("Delete book | Different username | !admin", async () => {
        const { response: registerResponse, username } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const uploadResponse = await uploadBook(username, "Alices_Adventures_in_Wonderland.epub", { jwt: registerResponse.text });
        expect(uploadResponse.status).toBe(200);

        const { response: registerResponse2 } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const deleteResponse = await deleteBook(uploadResponse.text, { jwt: registerResponse2.text });
        expect(deleteResponse.status).toBe(404);
        expect(deleteResponse.text).toBe(BOOK_NOT_FOUND);
    });

    test.concurrent("Download book | Different username | admin", async () => {
        const { response: registerResponse, username } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const uploadResponse = await uploadBook(username, "Alices_Adventures_in_Wonderland.epub", { jwt: registerResponse.text });
        expect(uploadResponse.status).toBe(200);

        const { response: registerResponse2 } = await registerUser(undefined, undefined, process.env.ADMIN_KEY);
        expect(registerResponse.status).toBe(200);

        const deleteResponse = await deleteBook(uploadResponse.text, { jwt: registerResponse2.text });
        expect(deleteResponse.status).toBe(200);

        const downloadResponse = await downloadBook(uploadResponse.text, { jwt: registerResponse.text });
        expect(downloadResponse.status).toBe(404);
        expect(downloadResponse.text).toBe(BOOK_NOT_FOUND);
    });

    test.concurrent("Delete book no auth", async () => {
        const { response: registerResponse, username } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const uploadResponse = await uploadBook(username, "Alices_Adventures_in_Wonderland.epub", { jwt: registerResponse.text });
        expect(uploadResponse.status).toBe(200);

        const downloadResponse = await deleteBook(uploadResponse.text);
        expect(downloadResponse.status).toBe(401);
        expect(downloadResponse.text).toBe(UNAUTHORIZED);
    });
});