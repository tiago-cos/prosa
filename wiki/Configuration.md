# Configuration

Prosa reads its settings from three places, each overriding the one before:

1. **Built-in defaults**, compiled into the binary.
2. **A TOML file**, `src/config/configuration.toml` by default.
3. **Environment variables.**

So you only have to write down what you want to change. The one setting with no
usable default is `admin_key` — Prosa will not start without it.

## The configuration file

Prosa looks for `src/config/configuration.toml`. Point `CONFIGURATION` at
another path to move it:

```bash
export CONFIGURATION=/etc/prosa/config.toml
```

The file need only contain what you are overriding. Here is every setting, at
its default value:

```toml
[server]
host = "0.0.0.0"
port = 5000

[auth]
# admin_key has no default — you must set it
jwt_token_duration = 900
refresh_token_duration = 604800
allow_user_registration = true
public_key_path = "library/public_key.bin"
private_key_path = "library/private_key.bin"
symmetric_key_path = "library/symmetric_key.bin"

[book_storage]
epub_path = "library/epubs"
cover_path = "library/covers"

[metadata_cooldown]
openlibrary = 1000
hardcover = 1000
google_books = 1000

[database]
file_path = "library/database.db"
max_connections = 16
busy_timeout_seconds = 10
backup_before_migration = true
```

## Environment variables

Every setting can also be given as an environment variable, named
`<SECTION>__<KEY>` — **two** underscores between the section and the key:

```bash
export SERVER__PORT=8080
export AUTH__ADMIN_KEY=super_secret_key
```

Underscores *inside* a name are not separators and stay as they are, which is
why `[auth].admin_key` is `AUTH__ADMIN_KEY` — two underscores after `AUTH`, one
inside `ADMIN_KEY`.

## Reference

### `[server]`

| Setting | Meaning |
|---|---|
| `host` | Network interface to listen on. |
| `port` | Port to listen on. |

### `[auth]`

| Setting | Meaning |
|---|---|
| `admin_key` | Secret that authorises creating admin accounts, and any account at all when registration is closed. **Required, minimum 8 characters** — the server will not start otherwise. |
| `jwt_token_duration` | How long a JWT stays valid, in seconds. |
| `refresh_token_duration` | How long a refresh token stays valid, in seconds. |
| `allow_user_registration` | `true` lets anyone register an account; `false` requires the admin key for every registration. |
| `public_key_path`, `private_key_path` | Where the JWT signing key pair is stored. Generated on first run. |
| `symmetric_key_path` | Where the key that encrypts stored provider API keys is kept. Generated on first run — **lose it and every stored provider key has to be entered again.** |

### `[book_storage]`

| Setting | Meaning |
|---|---|
| `epub_path` | Directory holding the EPUB files. |
| `cover_path` | Directory holding the cover images. |

### `[metadata_cooldown]`

Minimum delay in **milliseconds** between requests to each online catalogue, so
Prosa does not hammer them. The delay is per catalogue and shared by everyone on
the server, since catalogues rate limit by origin rather than by key.

| Setting | Meaning |
|---|---|
| `openlibrary` | Minimum delay between Open Library requests. |
| `hardcover` | Minimum delay between Hardcover requests. |
| `google_books` | Minimum delay between Google Books requests. |

The EPUB metadata extractor reads the book file itself, so it has no cooldown.

### `[database]`

| Setting | Meaning |
|---|---|
| `file_path` | Path to the SQLite database file. |
| `max_connections` | Size of the connection pool. |
| `busy_timeout_seconds` | How long a statement waits for a contended write before giving up. |
| `backup_before_migration` | Snapshot the database before applying or reverting migrations. Leave this on. |

## Logging

Log level comes from the standard `RUST_LOG` variable, and defaults to `info`.
Accepted values are `error`, `warn`, `info`, `debug` and `trace`:

```bash
export RUST_LOG=warn
```

It takes per-module directives too, which is how you get SQL statements without
drowning in everything else:

```bash
export RUST_LOG=info,sqlx::query=debug
```
