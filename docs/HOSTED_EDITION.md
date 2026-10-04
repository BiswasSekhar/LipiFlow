# Hosted edition deployment

LipiFlow stays open source under MIT. The production stack is split by responsibility:

- **Vercel** serves the React/Vite editor and the separate `/admin/` application. A small Node function uses Firebase Admin SDK to grant or remove a user's role.
- **Cloudflare Workers** runs the font catalogue and moderation API. **D1** stores font metadata, copyright reports and moderation audit rows; a private **R2** bucket stores uploaded font files.
- **Firebase Authentication** handles Google and email/password sign-in. Firebase custom claims carry the `user` or `admin` role. **Firestore** holds profile details, private favourites and cloud drafts under owner-only rules.
- The Rust/WASM transliteration engine remains in the browser. User text is not sent to Vercel, Cloudflare or Firebase unless the user explicitly saves a cloud draft. No analytics are included.

The source and deployment configuration are public. Runtime credentials and user content are not. Do not publish font files from a maintainer's Downloads folder; only app-bundled licensed fonts or user uploads that an admin has approved may be distributed.

## Local development

Install the pinned versions listed in the repository root and run:

```sh
pnpm install --frozen-lockfile
pnpm build:hosted
pnpm hosted:setup
pnpm hosted:dev
```

The Worker runs at `http://127.0.0.1:8787`. In another terminal, serve the hosted web build at `http://127.0.0.1:4173` with Vite Preview, using `VITE_LIPIFLOW_EDITION=hosted`; when building for local use, set `VITE_LIPIFLOW_API_URL=http://127.0.0.1:8787`. The Worker `local` environment uses local D1/R2 emulators and loopback-only development accounts. It never uploads local font files to Cloudflare. For live Firebase sign-in, configure the Firebase web app and use the Firebase emulators or a real project.

## Create the Firebase project

1. Create a Firebase project and register a web app. Enable Google and email/password under **Authentication → Sign-in method**. Add the eventual Vercel production hostname to **Authentication → Settings → Authorized domains**.
2. Create the Firestore database and deploy this repository's `firestore.rules`. Client profile, favourites and draft paths are owner-scoped; users cannot set roles or read the role-change audit collection.
3. Copy the web app's public API key, auth domain, project ID and app ID into Vercel's `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID` and `VITE_FIREBASE_APP_ID` environment variables. These identify a web app; they are not the Admin SDK credential.
4. Create a Firebase service account for the Vercel Node function. Store its complete JSON only in Vercel as `FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON`, marked sensitive. Never commit it, paste it into source or put it in a `VITE_*` variable.

To appoint the first admin, first deploy the app and sign in once. Copy that account's Firebase UID from Firebase Authentication, set `FIREBASE_BOOTSTRAP_ADMIN_UID` in Vercel, and redeploy. On `/admin/`, that same signed-in account can use **Set up first administrator**. The endpoint only permits that UID to grant the role to itself. Remove `FIREBASE_BOOTSTRAP_ADMIN_UID` after setup. Thereafter, an admin uses **User roles** to grant or remove admin claims by Firebase UID. The function checks the actor token and revocation state, revokes the target's refresh tokens, and writes a private audit entry. Already-issued Firebase ID tokens can continue carrying an old claim until they expire (up to one hour); signing in again refreshes the claim.

## Create the Cloudflare Worker project

Use Wrangler while authenticated to the intended Cloudflare account:

```sh
pnpm --filter @lipiflow/server exec wrangler login
pnpm --filter @lipiflow/server exec wrangler d1 create lipiflow-font-catalogue
pnpm --filter @lipiflow/server exec wrangler r2 bucket create lipiflow-user-fonts
```

Put the generated D1 database ID into `apps/server/wrangler.jsonc`. Keep the configured bucket private; the Worker binding mediates every font read. Set the Cloudflare Worker variables `FIREBASE_PROJECT_ID`, `APP_ORIGINS` and `APP_ORIGIN` to the Firebase project ID and exact HTTPS origin(s) of the Vercel app. Set a random `RATE_SALT` as a Worker secret:

```sh
pnpm --filter @lipiflow/server exec wrangler secret put RATE_SALT
pnpm --filter @lipiflow/server exec wrangler d1 migrations apply DB --remote
pnpm deploy:cloudflare
```

The deployment uses the default production environment, not the loopback-only `local` environment. The API rejects browser origins absent from `APP_ORIGINS`. Allow only the Vercel production origin and any deliberate preview origins; do not use `*`.

## Create the Vercel project

Import this repository as a Vercel project. The checked-in `vercel.json` builds both Vite apps, publishes `apps/server/dist`, and deploys `api/admin-role.ts` as a Node function. Set these project environment variables for the environments you will use:

| Variable                              | Value                                                                                                      |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `VITE_FIREBASE_API_KEY`               | Firebase web app API key                                                                                   |
| `VITE_FIREBASE_AUTH_DOMAIN`           | Firebase web app auth domain                                                                               |
| `VITE_FIREBASE_PROJECT_ID`            | Firebase project ID                                                                                        |
| `VITE_FIREBASE_APP_ID`                | Firebase web app ID                                                                                        |
| `VITE_LIPIFLOW_API_URL`               | Deployed Cloudflare Worker URL, such as `https://<worker>.<subdomain>.workers.dev`                         |
| `LIPIFLOW_APP_ORIGIN`                 | Exact Vercel origin allowed to call the role function (optional when the generated production URL is used) |
| `FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON` | Sensitive Firebase Admin service account JSON                                                              |

For an initial production release, deploy Vercel, add its final origin to Cloudflare `APP_ORIGINS`, and redeploy the Worker. Add the production Vercel domain to Firebase Authentication's authorized domains. Then sign in, bootstrap the first admin, remove the bootstrap UID variable, and verify roles, Firestore owner rules, font reports and moderation.

## Font uploads and rights

Signed-in members can submit a font file with its family, style, encoding, short description, author credit, optional author/foundry link, licence, and redistribution evidence. The browser previews the selected file before submission. Uploads stay private in R2 while pending. Admin approval requires a rights review and explicit confirmation that hosting and redistribution are permitted. Approved fonts appear in the public Fonts catalogue grouped by family, with FML, Unicode and ML-TT filters, adjustable previews, per-style downloads, and author attribution. Copyright reports stay private in D1; an admin can hide a reported font so subsequent downloads fail. Existing downloads cannot be recalled. The software does not determine ownership or legal permission.

Font family/encoding metadata and hosted files come from these moderated member uploads. The external malayalamfont.com index remains metadata-only while source files and redistribution rights are unverified. Storing a legacy FML or ML-TT font does not claim a verified conversion map; legacy conversion is only offered where a map is independently verified.

## Checks before launch

```sh
pnpm hosted:check
pnpm vercel:check
pnpm build:hosted
```

Before calling a live deployment a beta, also run the full browser suite, inspect Malayalam shaping on desktop and mobile, test Firebase sign-in and rules, and exercise R2 upload → pending review → approval → report → hide using the configured production domains. Local builds do not create Cloudflare resources or publish to Vercel.

Platform references: [Vercel Vite deployments](https://vercel.com/docs/frameworks/frontend/vite), [Vercel Node functions](https://vercel.com/docs/functions/runtimes/node-js), [Firebase Authentication](https://firebase.google.com/docs/auth/web/start), [Firebase custom claims](https://firebase.google.com/docs/auth/admin/custom-claims), [Firestore rules](https://firebase.google.com/docs/firestore/security/get-started), [Cloudflare D1 migrations](https://developers.cloudflare.com/d1/reference/migrations/), and [private R2 access](https://developers.cloudflare.com/r2/api/workers/workers-api-reference/).
