# Privacy

In the default Mozhi mode, LipiFlow converts entirely on the device, inside a
browser worker and WASM engine. It has no accounts, analytics or typing diagnostics.
Errors shown by the app do not contain source text.

Choosing **Google · online (experimental)** sends unescaped ASCII Manglish phrases
to `https://inputtools.google.com/request` for Malayalam candidates. The request
contains text in the URL query. Google receives the phrases and ordinary connection
metadata, and applies its own privacy policy. Existing Malayalam, separators,
digits, emoji and `{literal passages}` or `\\escaped` English words are not sent.
Requests omit cookies/credentials and referrers and use `cache: no-store`. No typed
text or Google responses are cached by LipiFlow's service worker. A bounded candidate
cache exists only in page memory. Conversion pauses during browser composition.
Old requests are cancelled after edits or a switch back to Mozhi. Browser-reported
offline operation uses the visibly labelled local Mozhi fallback; reconnecting
automatically resumes Google if that typing method is still selected.

The Google endpoint is undocumented and experimental; it is not a supported Cloud
Translation API. Google's old Transliterate API is deprecated. Google Cloud's
published romanization/transliteration language list omits Malayalam, although
Input Tools supports Malayalam typing. This adapter must be rechecked before
public release. See [Google privacy](https://policies.google.com/privacy),
[Input Tools](https://www.google.com/inputtools/services/features/transliteration.html)
and [Cloud language support](https://docs.cloud.google.com/translate/docs/languages).

Local storage persists typing method, theme, font, preview size and the draft preference. Editor
text remains in memory by default. Enabling “Remember draft on this device” stores
one versioned draft containing committed Unicode and the active Manglish insertion
in this browser. Undo history stays in page memory, bounded to 200 edits. Disabling the switch or choosing “Forget saved
draft” deletes the stored draft while retaining open editor text. Clear also clears
the saved draft when draft saving is enabled.

During a user-approved app update only, session storage temporarily retains the
open document and active insertion for the reload. The one-use handoff is consumed at startup and has a
five-minute validity window. It does not turn on permanent draft saving.

The service worker stores static application files, rules, fonts and licences.
It never caches editor text. A browser may evict cached assets or local storage;
the user should keep exported copies of important work. Clearing this site’s data
removes preferences, drafts and offline availability.

Fonts → Open font files reads selected font binaries into browser memory for a
local character proof. No upload, installation, font persistence or service-worker
caching occurs. Leaving the Fonts view removes these FontFace registrations.
This proof does not change editor output. In the Type editor, the FML/ML-TT
file picker hash-checks a supported Karthika binary and loads it into tab memory
for encoded preview. These editor FontFaces remain until the tab closes or
reloads. No upload, installation or persistence occurs. Legacy encoding itself
runs offline in Rust/WASM and never sends text or fonts to a server.

Static hosting receives ordinary website/resource requests. Mozhi conversion does
not issue requests; the optional Google mode does. Clipboard and downloads happen only when the user selects
those actions. Preview fonts are bundled, with no Google Fonts network requests.

## Hosted edition

The hosted edition adds opt-in GitHub login, favourites, explicit cloud draft saving
and font uploads. The server stores a GitHub ID/login name, favourites, chosen
drafts, submitted fonts and permission evidence. Session tokens are stored as
hashes and cookies are HttpOnly. Google remains separately optional. No automatic
cloud draft saving or typed-content diagnostics is added.

R2 font requests carry a font ID, never the editor’s preview text. Submitted fonts
are private until admin approval. Copyright reports send the entered contact and
evidence details to instance admins and are hidden from other users. API responses,
cloud drafts, account data, reports and R2 fonts are excluded from service-worker
caching. Built-in fonts and local typing still work offline.

Anonymous report rate limits store salted daily IP hashes, not raw IPs. The host
receives ordinary requests and manages its own logs/retention. See
[hosted operations](HOSTED_EDITION.md) for storage boundaries and configuration.
