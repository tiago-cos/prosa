import { BOOK_DIR, COVERS_DIR, FORBIDDEN, UNAUTHORIZED, wait } from "../utils/common";
import { registerUser, createApiKey, USER_NOT_FOUND } from "../utils/users"
import { BOOK_CONFLICT, BOOK_NOT_FOUND, deleteBook, downloadBook, INVALID_BOOK, uploadBook } from "../utils/books"
import { addCover, COVER_CONFLICT, COVER_NOT_FOUND, getCover, INVALID_COVER } from "../utils/covers"
import path from "path";
import fs from "fs";

describe("Get cover JWT", () => {
    test.concurrent("Get cover", async () => {
        const { response: registerResponse, username } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const uploadResponse = await uploadBook(username, "Alices_Adventures_in_Wonderland.epub", { jwt: registerResponse.text });
        expect(uploadResponse.status).toBe(200);
        
        // Wait for cover to be extracted
        await wait(0.5);

        const downloadResponse = await getCover(uploadResponse.text, { jwt: registerResponse.text });
        expect(downloadResponse.status).toBe(200);

        let coverPath = path.join(COVERS_DIR, "Alices_Adventures_in_Wonderland.jpeg");
        let cover = fs.readFileSync(coverPath);

        expect(cover).toEqual(downloadResponse.body);
    });

    test.concurrent("Get non-existent cover", async () => {
        const { response: registerResponse, username } = await registerUser();
        expect(registerResponse.status).toBe(200);

        // This epub does not contain a cover
        const uploadResponse = await uploadBook(username, "The_Great_Gatsby.epub", { jwt: registerResponse.text });
        expect(uploadResponse.status).toBe(200);

        // Give chance for any cover to be extracted
        await wait(0.5);

        const downloadResponse = await getCover(uploadResponse.text, { jwt: registerResponse.text });
        expect(downloadResponse.status).toBe(404);
        expect(downloadResponse.text).toBe(COVER_NOT_FOUND);
    });

    test.concurrent("Get cover from non-existent book", async () => {
        const { response: registerResponse } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const downloadResponse = await getCover("non-existent", { jwt: registerResponse.text });
        expect(downloadResponse.status).toBe(404);
        expect(downloadResponse.text).toBe(BOOK_NOT_FOUND);
    });

    test.concurrent("Get cover | Different user | !admin", async () => {
        const { response: registerResponse, username } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const uploadResponse = await uploadBook(username, "Alices_Adventures_in_Wonderland.epub", { jwt: registerResponse.text });
        expect(uploadResponse.status).toBe(200);
        
        // Wait for cover to be extracted
        await wait(0.5);

        const { response: registerResponse2 } = await registerUser();
        expect(registerResponse2.status).toBe(200);

        const downloadResponse = await getCover(uploadResponse.text, { jwt: registerResponse2.text });
        expect(downloadResponse.status).toBe(404);
        expect(downloadResponse.text).toBe(BOOK_NOT_FOUND);
    });

    test.concurrent("Get cover | Different user | admin", async () => {
        const { response: registerResponse, username } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const uploadResponse = await uploadBook(username, "Alices_Adventures_in_Wonderland.epub", { jwt: registerResponse.text });
        expect(uploadResponse.status).toBe(200);
        
        // Wait for cover to be extracted
        await wait(0.5);

        const { response: registerResponse2 } = await registerUser(undefined, undefined, process.env.ADMIN_KEY);
        expect(registerResponse2.status).toBe(200);

        const downloadResponse = await getCover(uploadResponse.text, { jwt: registerResponse2.text });
        expect(downloadResponse.status).toBe(200);
    });

    test.concurrent("Get cover no auth", async () => {
        const { response: registerResponse, username } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const uploadResponse = await uploadBook(username, "Alices_Adventures_in_Wonderland.epub", { jwt: registerResponse.text });
        expect(uploadResponse.status).toBe(200);
        
        // Wait for cover to be extracted
        await wait(0.5);

        const downloadResponse = await getCover(uploadResponse.text);
        expect(downloadResponse.status).toBe(401);
        expect(downloadResponse.text).toBe(UNAUTHORIZED);
    });
});

describe("Get cover api key", () => {
    test.concurrent("Get cover", async () => {
        const { response: registerResponse, username } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const uploadResponse = await uploadBook(username, "Alices_Adventures_in_Wonderland.epub", { jwt: registerResponse.text });
        expect(uploadResponse.status).toBe(200);
        
        // Wait for cover to be extracted
        await wait(0.5);

        const createApiKeyResponse = await createApiKey(username, "Test Key", ["Read"], undefined, { jwt: registerResponse.text });
        expect(createApiKeyResponse.status).toBe(200);

        const downloadResponse = await getCover(uploadResponse.text, { apiKey: createApiKeyResponse.body.key });
        expect(downloadResponse.status).toBe(200);

        let coverPath = path.join(COVERS_DIR, "Alices_Adventures_in_Wonderland.jpeg");
        let cover = fs.readFileSync(coverPath);

        expect(cover).toEqual(downloadResponse.body);
    });

    test.concurrent("Get non-existent cover", async () => {
        const { response: registerResponse, username } = await registerUser();
        expect(registerResponse.status).toBe(200);

        // This epub does not contain a cover
        const uploadResponse = await uploadBook(username, "The_Great_Gatsby.epub", { jwt: registerResponse.text });
        expect(uploadResponse.status).toBe(200);

        // Give chance for any cover to be extracted
        await wait(0.5);

        const createApiKeyResponse = await createApiKey(username, "Test Key", ["Read"], undefined, { jwt: registerResponse.text });
        expect(createApiKeyResponse.status).toBe(200);

        const downloadResponse = await getCover(uploadResponse.text, { apiKey: createApiKeyResponse.body.key });
        expect(downloadResponse.status).toBe(404);
        expect(downloadResponse.text).toBe(COVER_NOT_FOUND);
    });

    test.concurrent("Get cover from non-existent book", async () => {
        const { response: registerResponse, username } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const createApiKeyResponse = await createApiKey(username, "Test Key", ["Read"], undefined, { jwt: registerResponse.text });
        expect(createApiKeyResponse.status).toBe(200);

        const downloadResponse = await getCover("non-existent", { apiKey: createApiKeyResponse.body.key });
        expect(downloadResponse.status).toBe(404);
        expect(downloadResponse.text).toBe(BOOK_NOT_FOUND);
    });

    test.concurrent("Get cover | Different user | !admin", async () => {
        const { response: registerResponse, username } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const uploadResponse = await uploadBook(username, "Alices_Adventures_in_Wonderland.epub", { jwt: registerResponse.text });
        expect(uploadResponse.status).toBe(200);
        
        // Wait for cover to be extracted
        await wait(0.5);

        const { response: registerResponse2, username: username2 } = await registerUser();
        expect(registerResponse2.status).toBe(200);

        const createApiKeyResponse = await createApiKey(username2, "Test Key", ["Read"], undefined, { jwt: registerResponse2.text });
        expect(createApiKeyResponse.status).toBe(200);

        const downloadResponse = await getCover(uploadResponse.text, { apiKey: createApiKeyResponse.body.key });
        expect(downloadResponse.status).toBe(404);
        expect(downloadResponse.text).toBe(BOOK_NOT_FOUND);
    });

    test.concurrent("Get cover | Different user | admin", async () => {
        const { response: registerResponse, username } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const uploadResponse = await uploadBook(username, "Alices_Adventures_in_Wonderland.epub", { jwt: registerResponse.text });
        expect(uploadResponse.status).toBe(200);
        
        // Wait for cover to be extracted
        await wait(0.5);

        const { response: registerResponse2, username: username2 } = await registerUser(undefined, undefined, process.env.ADMIN_KEY);
        expect(registerResponse2.status).toBe(200);

        const createApiKeyResponse = await createApiKey(username2, "Test Key", ["Read"], undefined, { jwt: registerResponse2.text });
        expect(createApiKeyResponse.status).toBe(200);

        const downloadResponse = await getCover(uploadResponse.text, { apiKey: createApiKeyResponse.body.key });
        expect(downloadResponse.status).toBe(200);
    });

    test.concurrent("Get cover wrong capabilities", async () => {
        const { response: registerResponse, username } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const uploadResponse = await uploadBook(username, "Alices_Adventures_in_Wonderland.epub", { jwt: registerResponse.text });
        expect(uploadResponse.status).toBe(200);
        
        // Wait for cover to be extracted
        await wait(0.5);

        const createApiKeyResponse = await createApiKey(username, "Test Key", ["Create", "Update", "Delete"], undefined, { jwt: registerResponse.text });
        expect(createApiKeyResponse.status).toBe(200);

        const downloadResponse = await getCover(uploadResponse.text, { apiKey: createApiKeyResponse.body.key });
        expect(downloadResponse.status).toBe(403);
        expect(downloadResponse.text).toBe(FORBIDDEN);
    });
});

describe("Add cover JWT", () => {
    test("Add cover", async () => {
        const { response: registerResponse, username } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const uploadResponse = await uploadBook(username, "The_Great_Gatsby.epub", { jwt: registerResponse.text });
        expect(uploadResponse.status).toBe(200);
        
        // Give chance for any cover to be extracted
        await wait(0.5);

        const addResponse = await addCover(uploadResponse.text, "Generic.jpeg", { jwt: registerResponse.text });
        expect(addResponse.status).toBe(200);

        const downloadResponse = await getCover(uploadResponse.text, { jwt: registerResponse.text });
        expect(downloadResponse.status).toBe(200);

        let coverPath = path.join(COVERS_DIR, "Generic.jpeg");
        let cover = fs.readFileSync(coverPath);

        expect(cover).toEqual(downloadResponse.body);
    });

    test("Add invalid cover", async () => {
        const { response: registerResponse, username } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const uploadResponse = await uploadBook(username, "The_Great_Gatsby.epub", { jwt: registerResponse.text });
        expect(uploadResponse.status).toBe(200);
        
        // Give chance for any cover to be extracted
        await wait(0.5);

        const addResponse = await addCover(uploadResponse.text, "This_is_not_a_cover.txt", { jwt: registerResponse.text });
        expect(addResponse.status).toBe(400);
        expect(addResponse.text).toBe(INVALID_COVER);
    });

    test("Add cover conflict", async () => {
        const { response: registerResponse, username } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const uploadResponse = await uploadBook(username, "Alices_Adventures_in_Wonderland.epub", { jwt: registerResponse.text });
        expect(uploadResponse.status).toBe(200);
        
        // Wait for cover to be extracted
        await wait(0.5);

        const addResponse = await addCover(uploadResponse.text, "Alices_Adventures_in_Wonderland.jpeg", { jwt: registerResponse.text });
        expect(addResponse.status).toBe(409);
        expect(addResponse.text).toBe(COVER_CONFLICT);
    });

    test("Add cover non-existent book", async () => {
        const { response: registerResponse } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const addResponse = await addCover("non-existent", "Alices_Adventures_in_Wonderland.jpeg", { jwt: registerResponse.text });
        expect(addResponse.status).toBe(404);
        expect(addResponse.text).toBe(BOOK_NOT_FOUND);
    });

    test("Add cover | different user | !admin", async () => {
        const { response: registerResponse, username } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const uploadResponse = await uploadBook(username, "The_Great_Gatsby.epub", { jwt: registerResponse.text });
        expect(uploadResponse.status).toBe(200);
        
        // Give chance for any cover to be extracted
        await wait(0.5);

        const { response: registerResponse2, } = await registerUser();
        expect(registerResponse2.status).toBe(200);

        const addResponse = await addCover(uploadResponse.text, "Generic.jpeg", { jwt: registerResponse2.text });
        expect(addResponse.status).toBe(404);
        expect(addResponse.text).toBe(BOOK_NOT_FOUND);
    });

    test("Add cover | different user | admin", async () => {
        const { response: registerResponse, username } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const uploadResponse = await uploadBook(username, "The_Great_Gatsby.epub", { jwt: registerResponse.text });
        expect(uploadResponse.status).toBe(200);
        
        // Give chance for any cover to be extracted
        await wait(0.5);

        const { response: registerResponse2, } = await registerUser(undefined, undefined, process.env.ADMIN_KEY);
        expect(registerResponse2.status).toBe(200);

        const addResponse = await addCover(uploadResponse.text, "Generic.jpeg", { jwt: registerResponse2.text });
        expect(addResponse.status).toBe(200);
    });

    test("Add cover no auth", async () => {
        const { response: registerResponse, username } = await registerUser();
        expect(registerResponse.status).toBe(200);

        const uploadResponse = await uploadBook(username, "The_Great_Gatsby.epub", { jwt: registerResponse.text });
        expect(uploadResponse.status).toBe(200);
        
        // Give chance for any cover to be extracted
        await wait(0.5);

        const addResponse = await addCover(uploadResponse.text, "Generic.jpeg");
        expect(addResponse.status).toBe(401);
        expect(addResponse.text).toBe(UNAUTHORIZED);
    });
});

//TODO check if PUT should be idempotent, and if so, change cover PUT to allow to create a cover image if not previously present.