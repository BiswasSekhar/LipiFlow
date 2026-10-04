# LipiFlow

A Manglish → Unicode Malayalam editor with offline Mozhi typing and optional
Google online suggestions. The web beta uses a shared Rust engine, React, Vite
and locally bundled Malayalam fonts. The standalone edition needs no account;
the hosted edition adds a font library and accounts. Neither includes analytics.

## Run locally

Install Node **24.14.0**, pnpm **11.19.0**, and Rust through rustup. The checked-in
`rust-toolchain.toml` selects Rust **1.94.0**, rustfmt, clippy and the browser target.
On Windows, install Visual Studio Build Tools with **Desktop development with C++**
for native Rust tests. macOS requires the Xcode command-line tools; Linux requires
a C compiler/linker. wasm-pack **0.15.0** is installed by pnpm.

```sh
pnpm install --frozen-lockfile
pnpm dev
```

Open the address printed by Vite. Mozhi mode converts locally; service-worker
offline reopening and installation are verified against the **production build**:

```sh
pnpm build
pnpm preview
```

Open `http://127.0.0.1:4173`. Wait for **Ready offline** before disconnecting.
Use the browser’s install control, or Settings → Install LipiFlow when available.
On Safari for iPhone/iPad, use Share → Add to Home Screen.

## Two open-source editions

The whole project is MIT-licensed, including the hosted library and admin app.
Fonts and imported rules retain their own licences and attribution.

| Edition    | Features                                                                                          | Local address                       |
| ---------- | ------------------------------------------------------------------------------------------------- | ----------------------------------- |
| Standalone | Offline typing, local font files, Unicode/FML/ML-TT exports                                       | `http://127.0.0.1:4173/`            |
| Hosted     | The same editor plus Firebase sign-in, profiles, roles, favourites, drafts and moderated R2 fonts | `https://your-vercel-domain/`       |
| Admin site | Font review, role control, publishing, hiding and copyright resolution                            | `https://your-vercel-domain/admin/` |

Build/run the hosted edition with `pnpm build:hosted`, `pnpm hosted:setup` and
`pnpm hosted:dev`. Run the Worker and Vite Preview in separate terminals. Vercel serves the app and admin site; Cloudflare Workers/D1
handle the catalogue; private R2 holds font binaries. Firebase Authentication
handles sign-in, custom claims control roles, and Firestore stores profiles,
favourites and drafts. See the [hosted setup guide](docs/HOSTED_EDITION.md).
The source is ready to publish, with [contribution guidelines](CONTRIBUTING.md) and
[security guidance](SECURITY.md); no remote repository has been created.

## Type and export

- Choose **Typing method → Google · online** for forgiving Manglish
  spelling, such as `ente peru` → എന്റെ പേര്. Expand **Choose another spelling**
  to select alternatives. Google sends Manglish phrases to the Input Tools service;
  the adapter uses an undocumented endpoint, not a supported Google Cloud API.
  Availability and results can change. Failed conversion offers retry or Mozhi.
  When the browser reports offline, the app labels and uses the local Mozhi fallback.
  It returns to Google on reconnection. Mozhi remains the default until selected.
- `namaskaaram` → നമസ്കാരം; `njaan` → ഞാൻ; `malayaaLam` → മലയാളം.
- Case matters: `tha` → ത, `Ta` → ട. The searchable guide explains aliases.
- `\LipiFlow` keeps an English word; `{hello world}` keeps a whole passage literal.
  Braces are a LipiFlow convenience in addition to Mozhi’s escaping rules.
- Copy exports the selected encoding; Download saves a UTF-8 `.txt` file.
  Unicode preview fonts change appearance only.
- Draft saving starts **off**. Settings can remember one draft on this device.
  Switching it off deletes the saved draft without clearing the open editor.

FML and ML-TT typing uses the checked Karthika map with the matching verified
`FMLKR0NTT.ttf` and `MLKR0NTT.TTF` faces. Other font files remain downloadable,
but the Type picker disables them until their encoding maps are checked. Copy
exports legacy character positions; downloads use UTF-8.
See `docs/MAP_FORMAT.md` for loading files and unsupported-character handling.
No user-owned legacy fonts are bundled. See the [font mapping intake requirements](docs/LEGACY_FONT_INTAKE.md).
This release is an editor, not a system keyboard or an input method.

Desktop and mobile use one editable Malayalam box. Type Manglish directly in it;
conversion preserves the caret and supports selection replacement, undo/redo and
browser composition. Choose Unicode, FML or ML-TT above the same editor. Load the
exact matching legacy font to see its appearance; copy and download use the selected
encoding even when its local font has not been loaded. The compact Fonts page
searches by name and filters by category and encoding.
It lists the hosted R2 font catalogue by family, encoding and category, with
search, font details, live previews, one-click downloads and copyright reporting.
Local-font records connect exact matches to source metadata. Downloads stay in
R2 and are not committed to the open-source repository. Unicode faces preview
the editor text directly. Legacy previews and Type choices use a conversion map
only when that exact font file is verified.
The supplied collection was [inspected locally](docs/LOCAL_FONT_INVENTORY.md).

## Checks

```sh
cargo fmt --all -- --check
cargo clippy --workspace --all-targets --locked -- -D warnings
cargo test --workspace --locked
pnpm build
pnpm check
pnpm exec playwright install chromium firefox webkit
pnpm test:e2e
```

The same conversion corpus is tested in native Rust and the actual WASM engine.
Browser tests cover editing, composition, export, fonts, private drafts, update
handoff, initialization recovery, responsive layout and offline reopening.

## Structure and release

`apps/web` contains the companion app; `core` contains the portable engine and
browser binding; `data` contains versioned rules, catalogue and independent
regression examples; `packages` contains shared design tokens, Firebase helpers and
rules. The hosted web/admin site and Cloudflare API are separately deployable.

See [architecture](docs/ARCHITECTURE.md), [product requirements](docs/PRD.md),
[map format](docs/MAP_FORMAT.md), [privacy](docs/PRIVACY.md),
[release checklist](docs/RELEASE_CHECKLIST.md) and the
[hosted deployment guide](docs/HOSTED_EDITION.md).

The Mozhi reference is MIT-licensed; the fonts use SIL OFL 1.1. Original notices
are bundled with the app. See [third-party notices](docs/THIRD_PARTY_NOTICES.md).

No remote repository or live deployment is created by a local build. Live Firebase,
Cloudflare R2/D1 and Vercel settings require the instance configuration in the
[hosted deployment guide](docs/HOSTED_EDITION.md).
