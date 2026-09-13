# Installation and Setup

Prosa runs either as a Docker container, which is the recommended way, or as a
standalone binary.

## Docker

Add this to your `docker-compose.yml`:

```yaml
services:
  prosa:
    image: tsousa28/prosa
    container_name: prosa
    ports:
      - "5000:5000"
    environment:
      - AUTH__ADMIN_KEY=very_secret_key
    volumes:
      - prosa_library:/app/library
    restart: unless-stopped

volumes:
  prosa_library:
```

Then `docker compose up -d`. Prosa is available on port `5000`.

Three things to know about this image:

- **Set `AUTH__ADMIN_KEY` to something secret before you use it.** It is the
  credential that creates admin accounts, and Prosa refuses to start without one
  at least 8 characters long.
- **Persistence needs a named volume mounted at `/app/library`.** Bind mounts do
  not work — the container runs rootless and cannot take ownership of a
  host directory.
- **The environment variables that change storage paths are ignored here.** The
  container unsets them on startup so everything stays inside the volume.
  Every other setting works normally; see [Configuration](Configuration).

## Binary

Build it, or take a release binary, then:

1. Write a configuration file. Start from
   [`src/config/example.toml`](https://github.com/tiago-cos/prosa/blob/master/src/config/example.toml)
   and set at least `admin_key`. Prosa looks for `src/config/configuration.toml`
   unless the `CONFIGURATION` environment variable says otherwise.
2. Run `prosa`.

Everything Prosa stores — the database, the book files, the covers and the key
files — lands under the paths in that file, which default to `library/`.
Directories are created on first run.

## Checking it came up

```bash
curl http://localhost:5000/health
```

```json
{ "status": "ok", "software": "prosa", "version": "0.2.0" }
```

`GET /config` is the other endpoint that needs no credentials. It reports
whether registration is open and which metadata providers this server knows
about:

```bash
curl http://localhost:5000/config
```

Once it answers, carry on to [Getting Started](Getting-Started).

## Upgrading

Prosa's schema is managed with versioned, reversible migrations embedded in the
binary itself. There is nothing to deploy alongside the executable and no manual
setup step: on startup it applies whatever the database has not seen yet, so
replacing the binary or pulling a newer image is the whole of an upgrade.

A snapshot of the database is written next to it before anything is applied,
unless you have turned `backup_before_migration` off. Snapshots are never
cleaned up automatically.

To see where a database stands:

```bash
prosa --migrate-status
```

This lists every migration, whether it has been applied, and whether this binary
could revert it.

## Downgrading

```bash
prosa --migrate-down <version>
```

This reverts every migration newer than `<version>`.

**A binary can only revert migrations whose down scripts it carries.** So to
move from a newer Prosa to an older one, run `--migrate-down` with the *newer*
binary first, then swap in the older one. The other order leaves the schema
ahead of the code, and the older binary has no idea how to get back.

Prosa refuses to start a revert it cannot finish, rather than leaving the schema
half-migrated.
