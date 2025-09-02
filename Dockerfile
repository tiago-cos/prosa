# setup cargo-chef
FROM clux/muslrust:stable AS chef
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

# build kepubify
FROM golang:alpine AS kepubify-builder
ARG KEPUBIFY_REPO=https://github.com/tiago-cos/kepubify.git
ARG KEPUBIFY_REF=master
RUN apk add --no-cache git
WORKDIR /build
RUN git clone --depth 1 --branch ${KEPUBIFY_REF} ${KEPUBIFY_REPO} kepubify
WORKDIR /build/kepubify
RUN go build ./cmd/kepubify

FROM alpine AS runtime

# setup a healthcheck
HEALTHCHECK --interval=300s --timeout=5s --retries=3 --start-period=10s \
  CMD wget --spider -q http://127.0.0.1:${SERVER__PORT:-5000}/health || exit 1

# copy binaries
COPY --from=builder /app/target/x86_64-unknown-linux-musl/release/prosa /usr/local/bin/
COPY --from=kepubify-builder /build/kepubify/kepubify /app/kepubify/kepubify

# setup default config file
RUN mkdir /app/config
COPY --from=builder /app/src/config/default.toml /app/config/default.toml
ENV DEFAULT_CONFIGURATION=/app/config/default.toml

# run prosa as non-root user
RUN mkdir /app/library
RUN addgroup -S prosa && adduser -S prosa -G prosa
RUN chown -R prosa:prosa /app
USER prosa
WORKDIR /app

ENTRYPOINT ["sh", "-c", "\
    unset BOOK_STORAGE__EPUB_PATH \
          BOOK_STORAGE__COVER_PATH \
          DATABASE__FILE_PATH \
          KEPUBIFY__PATH \
          AUTH__JWT_KEY_PATH; \
    exec /usr/local/bin/prosa \
"]
