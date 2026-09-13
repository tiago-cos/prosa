# Prosa

**A Rust backend and API for managing eBook collections.**

## Overview

Prosa is a self-hosted book server for managing and reading a personal EPUB
collection. It stores your books, their covers, metadata and annotations, tracks
where you left off in each one, and keeps all of it in sync across every device
you read on.

It is a backend and an API — there is no web interface. Clients talk to it over
HTTP, and [Prosa-Kobo](https://github.com/tiago-cos/prosa-kobo) is one of them.

## Documentation

- **[Wiki](https://github.com/tiago-cos/prosa/wiki)** — installing, configuring
  and operating a server, and working on Prosa itself
- **[API reference](https://tiago-cos.github.io/prosa)** — every endpoint, its
  parameters and its responses

## Why Prosa?

I built Prosa because I wanted a modular alternative to Calibre-Web that
supported all types of devices, including Kobo eReaders. I also wanted it to be
easy to extend with extra features and functionality. Prosa serves as a base for
middlewares and extensions, giving flexibility to adapt it to different needs.

## Features

- Multiple users

- Synchronization across devices

- Manage eBook metadata, covers, and annotations

- Automatic metadata retrieval, from the book itself or from online catalogues

- Create and manage shelves (collections of books)

- Full compatibility with Kobo eReaders (via [Prosa-Kobo](https://github.com/tiago-cos/prosa-kobo))

## Quick Start

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

`docker compose up -d`, then `curl http://localhost:5000/health`. Set
`AUTH__ADMIN_KEY` to something secret first — Prosa will not start without one
at least 8 characters long.

Persistence needs a **named volume** at `/app/library`; bind mounts do not work,
because the container runs rootless. The full story, including running Prosa as
a binary, is in
[Installation and Setup](https://github.com/tiago-cos/prosa/wiki/Installation-and-Setup).

## Build Instructions

```bash
git clone https://github.com/tiago-cos/prosa.git
cd prosa
cargo build --release
```

To run it from source, copy `src/config/example.toml` to
`src/config/configuration.toml`, set `admin_key`, and `cargo run`. See
[Configuration](https://github.com/tiago-cos/prosa/wiki/Configuration) for
every setting.

## Test Instructions

1. Clone the repository:

    ```bash
    git clone https://github.com/tiago-cos/prosa.git
    cd prosa/tests
    ```

2. Install the dependencies with [Bun](https://bun.sh):

    ```bash
    bun install
    ```

3. Create a `.env.local` file in the `config` subfolder and configure the `ADMIN_KEY` (see `.env` in the same folder).

4. Make sure the server is running.

5. Run the tests:

    ```bash
    bun run test
    ```

## Roadmap

- [x] **Backend**
  - [x] **Books**
    - [x] File management
    - [x] Covers
    - [x] Metadata
    - [x] Annotations
    - [x] Reading progress
    - [x] Ratings
    - [ ] Reading time statistics
  - [x] **Shelves** (collections of books)
  - [x] **Users**
    - [x] Profiles
    - [x] Preferences
    - [x] API keys
  - [x] Automatic metadata retrieval
  - [x] Synchronization across devices
  - [ ] Audiobook support

- [x] **Kobo Support ([Prosa-Kobo](https://github.com/tiago-cos/prosa-kobo))**
  - [x] **Books**
    - [x] File management
    - [x] Covers
    - [x] Metadata
    - [x] Annotations
    - [x] Reading progress
    - [x] Ratings
    - [ ] Reading time statistics
  - [x] **Shelves**
  - [x] Prosa synchronization
  - [ ] Audiobooks

- [ ] **Mobile App**

  - TODO

## Contributing

Issues and pull requests are both welcome — see
[CONTRIBUTING.md](.github/CONTRIBUTING.md), and
[Contributing and Architecture](https://github.com/tiago-cos/prosa/wiki/Contributing-and-Architecture)
for how the code is laid out.

## Related Projects

- [Prosa-Kobo](https://github.com/tiago-cos/prosa-kobo) – a companion service that translates requests and responses between Kobo eReader devices and the Prosa API.

## License

[MIT](LICENSE)
