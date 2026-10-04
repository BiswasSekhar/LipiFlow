# Contributing

LipiFlow's standalone editor, Rust engine, hosted library and admin app are MIT-licensed. Font files and upstream conversion data retain the notices described in `docs/THIRD_PARTY_NOTICES.md`.

Use the pinned Node, pnpm, Rust and wasm-pack versions in the README. Run `pnpm build`, `pnpm check`, Rust checks and `pnpm test:e2e` for editor changes. For hosted changes also run `pnpm build:hosted`, `pnpm hosted:check`, `pnpm hosted:setup` and `pnpm test:hosted`.

Keep the offline edition independent of accounts, R2 and cloud APIs. Do not introduce typed-content diagnostics. Add conversion fixtures from independent sources, with expected Unicode and encoding values, rather than generating expected output from the implementation.

Do not commit font collections without verified redistribution permission. A new legacy family or variant needs an exact font identity, licensed conversion table, independent fixtures and matching-font visual review. Hosted submissions remain private until reviewed; metadata and filenames are not permission evidence by themselves.

Please include the problem, resulting behaviour and relevant verification when proposing a change. Keep credentials, `.dev.vars`, databases, R2 emulation, personal drafts and generated artifacts out of Git.
