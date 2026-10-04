# Cloudflare Pages release runbook

LipiFlow is a static site. Build Rust/WASM and the frontend locally or in GitHub
Actions; upload the completed artifact to Pages. This avoids depending on a
hosting build image to supply the pinned Rust and wasm-pack toolchain.

## Prepare

1. Run the gates in `docs/RELEASE_CHECKLIST.md`.
2. Run `pnpm build`. The complete publish directory is `apps/web/dist`.
3. Preview with `pnpm preview` and test offline behavior locally.
4. In GitHub Actions, download the `lipiflow-web-<commit>` artifact from a passing
   run. It contains the same publish directory and does not deploy itself.

## Publish when authorized

In Cloudflare’s Workers & Pages dashboard, create a Pages project using **Direct
Upload**. Select the contents of the publish directory (or the downloaded artifact
ZIP), with `index.html` at its root. Upload all files together, including `sw.js`,
the Workbox runtime, hashed JS/WASM assets, fonts, manifest, icons, `_headers` and
licence notices. Do not upload the source tree or `node_modules`.

Use the assigned HTTPS `pages.dev` address first. Add a custom domain in Pages
only when domain ownership and the release have been approved. This app assumes
it is hosted at the domain root, not a subdirectory. No R2 bucket is needed yet.

## Verify and maintain

Check that WASM has `application/wasm` content type and that `sw.js` is revalidated
rather than cached indefinitely. The included `_headers` applies immutable caching
only to hashed `/assets/*` and disables permanent caching for the service worker.

Visit in a clean browser. Wait for Ready offline, type/copy/download, disconnect,
reload and switch fonts. Then publish a new complete artifact and verify the update
prompt with unsaved text. Retain the previous complete artifact for rollback; use
Pages’ deployment rollback and confirm the update flow again.

Static host logs may contain normal resource requests. Do not introduce text
logging, conversion endpoints or analytics as part of deployment.

Official reference: https://vite.dev/guide/static-deploy.html#cloudflare-pages
