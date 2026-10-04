# Web beta release checklist

## Automated gates

- [ ] Frozen dependency installation works from a clean checkout.
- [ ] Mozhi source digest and generated data match; catalogue validation passes.
- [ ] Rust formatting, clippy and native regression tests pass.
- [ ] WASM matches the same independent conversion corpus.
- [ ] TypeScript and web tests pass; production build succeeds.
- [ ] Chromium, Firefox and WebKit cover editing, composition, navigation, export,
      font choice, draft opt-in/deletion, startup retry and responsive layout.
- [ ] The sole editable box preserves carets across conversion and format changes;
      native selection copy/cut, undo/redo and legacy composition map correctly.
- [ ] Offline reload retains the engine, fonts and exports; Mozhi typing makes no requests.
- [ ] Google mode is labelled online/experimental, discloses text transmission,
      handles cancellation, candidates, retry and labelled offline fallback.
- [ ] Accepting a real waiting service-worker update preserves unsaved editor text.

WebKit offline tests use origin shutdown because Playwright offline emulation
rejects cached service-worker navigations in issue #42775. A fresh browser context
is the negative control: it cannot load the stopped origin. Chromium and Firefox
use browser offline emulation. This distinction must stay visible in test reports.

## Visual and publication gates

- [ ] Review both themes and mobile/desktop screenshots.
- [ ] Check vowel marks, conjuncts, chillus and line height in both bundled fonts.
- [ ] Check visible focus, labelled controls, keyboard flow and reduced motion.
- [ ] Check Karthika FML/ML-TT output, exact-font hash validation, unsupported
      character export guards and local preview shaping.
- [ ] Ship font licences and Mozhi attribution with the artifact.
- [ ] Recheck Google endpoint availability and suitability before public release;
      this experimental adapter is not a supported Google Cloud API integration.
- [ ] On the actual HTTPS deployment, test first visit → ready offline → reconnect,
      clipboard, downloads, installation, and an update with an unsaved draft.
- [ ] Before promoting Safari/iPhone installation support, check real devices;
      Playwright WebKit coverage does not replace device installation testing.

Build the artifact locally or in GitHub Actions. Hosting setup and public promotion
are separate from these local checks; no release is automatically deployed.

## Hosted edition gates

- [ ] Shared font validation, Worker and admin type checks pass.
- [ ] Upload → admin review → published preview → report → removal passes in all three browser engines.
- [ ] Private drafts/uploads, public metadata, session revocation and origin/CSRF controls pass.
- [ ] Configure Firebase Auth providers, owner-only Firestore rules, and the Vercel Firebase Admin secret.
- [ ] Configure Cloudflare D1 migrations, private R2 bucket, Firebase project ID and exact Vercel CORS origins.
- [ ] Bootstrap the first Firebase admin, remove the bootstrap UID setting, then verify member/admin permissions.
- [ ] Verify real OAuth login/logout and both member/admin permissions on the HTTPS deployment.
- [ ] Review font redistribution permissions before approving each uploaded font.
- [ ] Verify copyright reports remain private and hidden fonts stop being served.
- [ ] Verify editor offline updates still exclude account, draft, admin and uploaded-font requests.

See [the hosted runbook](HOSTED_EDITION.md). Local verification is recorded in
[VERIFICATION.md](VERIFICATION.md); live deployment gates remain separate.
