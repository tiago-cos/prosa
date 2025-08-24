# Prosa

**A Rust backend and API for managing eBook collections.**

## Overview

Prosa is a lightweight book server written in Rust for managing eBook collections.

Full documentation (including API docs): [tiago-cos.github.io/prosa](https://tiago-cos.github.io/prosa)

## Why Prosa?

I built Prosa because I wanted a modular alternative to Calibre-Web that supported all types of devices, including Kobo eReaders. I also wanted it to be easy to extend with extra features and functionality. Prosa serves as a base for middlewares and extensions, giving flexibility to adapt it to different needs.

## Features

- Multiple users

- Synchronization across devices

- Manage eBook metadata, covers, and annotations

- Create and manage shelves (collections of books)

- Full compatibility with Kobo eReaders (via [Prosa-Kobo](https://github.com/tiago-cos/prosa-kobo))

## Build Instructions

```bash
git clone https://github.com/tiago-cos/prosa.git
cd prosa
cargo build --release
```

## Test Instructions

1. Clone the repository:

    ```bash
    git clone https://github.com/tiago-cos/prosa.git
    cd prosa/tests
    ```

2. Create a `.env.local` file in the `config` subfolder and configure the `ADMIN_KEY` (see `.env` in the same folder).

3. Make sure the server is running.

4. Run the tests:

    ```bash
    npm run test
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
  - [x] **Shelves** (collections of books)
  - [x] **Users**
    - [x] Profiles
    - [x] Preferences
    - [x] API keys
  - [x] Automatic metadata retrieval
  - [x] Synchronization across devices

- [x] **Kobo Support ([Prosa-Kobo](https://github.com/tiago-cos/prosa-kobo))**
  - [x] **Books**
    - [x] File management
    - [x] Covers
    - [x] Metadata
    - [x] Annotations
    - [x] Reading progress
    - [x] Ratings
  - [x] **Shelves**
  - [x] Synchronization

- [ ] **Mobile App**

  - TODO

## Related Projects

- [Prosa-Kobo](https://github.com/tiago-cos/prosa-kobo) – a companion service that translates requests and responses between Kobo eReader devices and the Prosa API.

## Contributing

Contributions, feedback, and suggestions are welcome! Feel free to open issues or pull requests.

## License

This project is licensed under the GNU General Public License (GPL). See the [LICENSE](./LICENSE) file for more details.
