# Prosa

Prosa is a self-hosted book server for managing and reading a personal EPUB
collection. It stores your books, their covers, metadata and annotations,
tracks where you left off in each one, and keeps all of it in sync across every
device you read on.

It is a backend and an API — there is no web interface. Clients talk to it over
HTTP; [Prosa-Kobo](https://github.com/tiago-cos/prosa-kobo) is one, translating
between Kobo eReaders and this API.

## Documentation

**For running a server**

- **[Installation and Setup](Installation-and-Setup)** — getting Prosa running
  with Docker or as a binary, and upgrading it afterwards
- **[Configuration](Configuration)** — every setting, where to put it, and how
  the layers override each other
- **[Getting Started](Getting-Started)** — your first user, turning on metadata
  providers, and uploading your first book

**For working on Prosa**

- **[Contributing and Architecture](Contributing-and-Architecture)** — how the
  code is laid out, how to build and test it, and what a pull request needs

**API reference**

The full API reference — every endpoint, its parameters, and everything it can
return — is generated from the OpenAPI spec and published at
[tiago-cos.github.io/prosa](https://tiago-cos.github.io/prosa).

## What it does

- **Books.** Upload, download and delete EPUB files. Each book carries a cover
  and a metadata record you can edit.
- **Metadata.** Fetched automatically from the book itself and, if you ask, from
  online catalogues.
- **Shelves.** Collections of books, shared across your devices.
- **Reading.** Reading position, reading status and a rating per book.
- **Annotations.** Highlights and notes, anchored to a position in the text.
- **Users.** Regular and admin accounts, each with their own library,
  preferences and API keys.
- **Sync.** Every change is logged, so a device that has been offline can ask
  what it missed rather than re-downloading everything.
