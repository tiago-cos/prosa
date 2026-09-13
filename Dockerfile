# setup cargo-chef
FROM docker.io/clux/muslrust:stable AS chef
USER root
RUN cargo install cargo-chef
WORKDIR /app

# generate recipe for caching
FROM chef AS planner
COPY . .
RUN cargo chef prepare --recipe-path recipe.json

# build prosa with cached dependencies
FROM chef AS builder
COPY --from=planner /app/recipe.json recipe.json
RUN cargo chef cook --release --target x86_64-unknown-linux-musl --recipe-path recipe.json
COPY . .
RUN cargo build --release --target x86_64-unknown-linux-musl --bin prosa

FROM alpine AS runtime

# setup a healthcheck
HEALTHCHECK --interval=300s --timeout=5s --retries=3 --start-period=10s \
  CMD wget --spider -q http://127.0.0.1:${SERVER__PORT:-5000}/health || exit 1

# copy binaries
COPY --from=builder /app/target/x86_64-unknown-linux-musl/release/prosa /usr/local/bin/

# run prosa as non-root user
RUN addgroup -S prosa \
    && adduser -S prosa -G prosa \
    && mkdir -p /app/library \
    && chown -R prosa:prosa /app

USER prosa
WORKDIR /app

ENTRYPOINT ["sh", "-c", "\
    unset BOOK_STORAGE__EPUB_PATH \
          BOOK_STORAGE__COVER_PATH \
          DATABASE__FILE_PATH \
          AUTH__PUBLIC_KEY_PATH \
          AUTH__PRIVATE_KEY_PATH \
          AUTH__SYMMETRIC_KEY_PATH; \
    exec /usr/local/bin/prosa \
"]
