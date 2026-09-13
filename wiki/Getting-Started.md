# Getting Started

This walks through a fresh server: creating a user, deciding where metadata
comes from, and uploading a book. It assumes Prosa is running and answering on
`http://localhost:5000` — see [Installation and Setup](Installation-and-Setup)
if it is not.

Every endpoint and every response is described in full in the
[API reference](https://tiago-cos.github.io/prosa). What follows is just the
path through it.

## 1. Create a user

```bash
curl -X POST http://localhost:5000/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"username": "me", "password": "a-good-password"}'
```

```json
{
  "jwt_token": "...",
  "refresh_token": "...",
  "user_id": "3ac123d4-..."
}
```

If `allow_user_registration` is `false`, this needs the admin key in an
`admin-key` header. Creating an **admin** account always does, whatever that
setting says:

```bash
curl -X POST http://localhost:5000/auth/register \
  -H 'Content-Type: application/json' \
  -H 'admin-key: very_secret_key' \
  -d '{"username": "admin", "password": "a-good-password", "admin": true}'
```

An admin can act on any user's books; a regular user only on their own.

### Authenticating afterwards

Two ways, and every endpoint except `/health`, `/config`,
`/.well-known/jwks.json` and the `/auth/*` endpoints needs one of them:

- **The JWT**, in `Authorization: Bearer <jwt_token>`. Short-lived — trade the
  refresh token at `POST /auth/refresh` for a new pair when it expires.
- **An API key**, in `api-key: <key>`. Created at
  `POST /users/{user_id}/keys`, with an expiry you choose and a set of
  capabilities (`Read`, `Create`, `Update`, `Delete`) limiting what it can do.
  Suited to a device or a script that should not hold your password.

An API key cannot manage credentials — the `/users/{user_id}/…` endpoints take a
JWT only, so a key can never mint another key.

## 2. Decide where metadata comes from

A new account has only `epub_metadata_extractor` enabled, which reads what the
book file says about itself. Nothing is sent anywhere until you ask for it.

To see what this server offers:

```bash
curl http://localhost:5000/config
```

```json
{
  "allow_user_registration": true,
  "metadata_providers": [
    { "provider_id": "epub_metadata_extractor", "requires_api_key": false },
    { "provider_id": "openlibrary", "requires_api_key": false },
    { "provider_id": "hardcover", "requires_api_key": true },
    { "provider_id": "google_books", "requires_api_key": true }
  ]
}
```

To turn some on, patch your preferences:

```bash
curl -X PATCH http://localhost:5000/users/$USER_ID/preferences \
  -H "Authorization: Bearer $JWT" \
  -H 'Content-Type: application/json' \
  -d '{
        "metadata_providers": ["hardcover", "epub_metadata_extractor", "openlibrary"],
        "provider_keys": { "hardcover": "your-hardcover-key" }
      }'
```

Worth knowing:

- **`metadata_providers` is an order of preference.** Fields are filled by the
  first provider that supplies them and never overwritten, so put the source you
  trust most first. A provider may appear only once.
- **A provider that needs a key is refused unless it has one**, either supplied
  in the same request or already stored. That is deliberate: enabling one
  without a key would silently do nothing at fetch time rather than fail.
- **Stored keys are encrypted and never returned.** `provider_keys` is
  write-only; reading your preferences gives you `configured_providers`, the
  list of providers that have a key, and nothing more. Mapping a provider to
  `null` clears its key; leaving it out keeps whatever is stored.
- **Turning a provider off keeps its key**, so switching it back on later does
  not mean entering the credential again.
- `automatic_metadata` controls whether an upload triggers a fetch at all.

## 3. Upload a book

```bash
curl -X POST http://localhost:5000/books \
  -H "Authorization: Bearer $JWT" \
  -F "epub=@Alices_Adventures_in_Wonderland.epub"
```

The response is the new book's id.

Metadata and the cover arrive **shortly afterwards, not with the response** —
the fetch runs in the background so a slow catalogue cannot hold up your upload.
Give it a moment before asking for either.

From here, `GET /books/{book_id}/metadata`, `/cover`, `/state` and
`/annotations` are the rest of what a book has, and `/shelves` groups books
together. The [API reference](https://tiago-cos.github.io/prosa) has them all.

## 4. Keeping devices in sync

Prosa records every change to your library. A client calls `GET /sync` with the
token it got last time and learns what has changed since — which books, covers,
metadata, reading states and annotations to re-fetch, and which have been
deleted — instead of walking the whole library.

Changes a session makes itself are left out of that session's own answer, so a
device is never told about something it just did. Background metadata fetches
are logged under the server's own name, which is why they do show up.
