# Local beta verification — 3 October 2026

Verified on Windows using the pinned Node 24.14.0, pnpm 11.19.0, Rust 1.94.0
and wasm-pack 0.15.0 toolchain.

| Gate                                                       | Result                                                            |
| ---------------------------------------------------------- | ----------------------------------------------------------------- |
| Frozen dependency installation                             | Passed                                                            |
| Rust formatting and clippy with warnings denied            | Passed                                                            |
| Native Rust regression groups                              | 6 passed                                                          |
| Shared conversion fixtures                                 | 67 published examples and boundary cases matched in Rust and WASM |
| Web/WASM unit tests                                        | 111 passed                                                        |
| Formatting, TypeScript and catalogue/rule integrity checks | Passed                                                            |
| Production PWA build                                       | Passed; 33 precache entries, approximately 874 KiB                |
| Chromium browser scenarios                                 | 21 passed                                                         |
| Firefox browser scenarios                                  | 21 passed                                                         |
| WebKit browser scenarios                                   | 21 passed                                                         |

Browser coverage includes rapid editing, selection replacement, undo, composition
pause, real font selection, UTF-8 downloads, manual clipboard fallback, private
draft persistence/deletion, storage denial, startup recovery, responsive keyboard
flow, offline reopening, single-tab update handoff and updates accepted in another
tab. Google scenarios additionally cover alternative candidates, protected text,
provider persistence, cancelled/stale responses, composition, failed requests,
retry and the labelled offline fallback. Native tests also exercise incomplete
words and a thousand-line document; Rust includes the Karthika encoder and the shared legacy corpus.

The live Google endpoint returned `ente peru` → `എന്റെ പേര്` plus alternatives,
both in an HTTP sample check and through the production Chromium UI. Google mode
is an experimental adapter to an undocumented Input Tools endpoint, not a
supported Google Cloud API. Automated tests use fixed endpoint replies and block
service workers only in the Google-specific fixture tests, preventing WebKit's
service worker from bypassing Playwright request interception. Existing PWA tests
retain real service workers. CI does not rely on live Google availability.

Chromium and Firefox used offline network emulation. WebKit used a stopped private
origin and a fresh-context negative control, avoiding the documented Playwright
[offline-emulation bug](https://github.com/microsoft/playwright/issues/42775).
The reopened page was served by its service worker; conversion and fonts remained
available, and Mozhi typing issued no requests. Google is intentionally online;
its requests are not precached and offline uses the local Mozhi fallback.

Visual review covered light and dark desktop layouts, mobile layouts, and both
loaded Noto Malayalam font faces. Local screenshots and the complete static ZIP
are in `artifacts/`; browser reports are in `playwright-report/`. These generated
files are ignored by Git.

The desktop and mobile workspace now use one editable box. Browser tests verify
inline conversion, middle-document typing, caret retention, rapid replacements,
selection copy/cut, undo/redo, mobile history events and composition with a loaded
legacy projection. A delayed encoder regression checks that background responses
do not override native selection when the editor is rendering Unicode. The WebKit
offline scenario also passed eight repeated runs after this correction. Format switching preserves canonical Unicode, and local font
load/unload makes no external requests. The supplied
FML-Mohini OTF and FML-TTAathira TTF were additionally loaded through the actual
Fonts screen and rendered successfully in a local Chromium character proof.
All 782 supplied fonts (224 FML) were inspected read-only; no font from the supplied
collection was included in the distributable artifact. The regular FML-TTKarthika and ML-TTKarthika files were also verified against
the Karthika map: all 164 shared glyph outlines are identical. Their mapped
Malayalam previews were visually reviewed in Chromium, Firefox and WebKit.
One absent source-map glyph (മ്ല / U+0178) is reported and blocks legacy export.
Sixteen published Karthika fixtures and ten boundary cases run in Rust and WASM.
Browser tests cover both modes, copy and downloads, font hash rejection, delayed
worker responses, composition, Google candidates and real offline exports.
Font-dependent checks are skipped in CI when user-owned files are unavailable.

The production artifact is `apps/web/dist`. GitHub Actions is configured but has
not run against a remote repository. Public hosting, custom domains and real-device
Safari/PWA installation checks remain publication gates. Native keyboards and
additional legacy font variants remain deferred.

The monochrome redesign adds a compact searchable catalogue with encoding and
category filters, live editor-text samples, local font previews and responsive
rows. Both light and dark themes use a single background colour. Desktop and
320/390-pixel mobile screenshots were reviewed in the three browser engines.

The separate MIT-licensed hosted edition builds the web app and admin site with
an actual Cloudflare Worker, local D1 database and private R2 emulator. Four server
unit checks and six end-to-end hosted scenarios passed (two each in Chromium,
Firefox and WebKit). These exercise private upload, permission review, public
publication, real font rendering, favourites, private drafts, copyright reporting,
admin removal, revoked sessions, ownership isolation, exact-origin and CSRF
checks. Public listings exclude ownership, permission statements and private
review notes. Pending fonts and reporter contact details are unavailable publicly.
Only the licensed Noto test fixture was uploaded to the local emulator.

The hosted production assets are in `apps/server/dist`. The local member/admin
sign-in is restricted to HTTP loopback and an explicit local flag. The Firebase
Auth integration, Firestore rules, and Vercel role function now pass TypeScript
checks. The hosted build and Vercel production build pass, and Wrangler's Worker
dry run resolves the D1 and R2 bindings. A dedicated Cloudflare D1 database has
been created and migrated, and a separate R2 bucket has been created. The Worker
has not been deployed; the Firebase project and its Vercel environment values are
still being configured. The Vercel project exists and is linked, but no deployment
or public font collection has been published.
