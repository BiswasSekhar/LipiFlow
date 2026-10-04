# Web beta requirements

LipiFlow helps Malayalam speakers turn familiar Roman spellings into selectable,
portable Unicode Malayalam. The intended workflow is typing or pasting Manglish,
editing converted Malayalam in one box, choosing an encoding/font, and copying or
downloading output.

## Delivered behavior

- Type: one editable textbox with inline conversion, caret preservation, selection
  replacement, undo/redo, composition pause and a searchable guide. Unicode and
  checked Karthika FML/ML-TT modes share this editor. Copy/download use the selected
  encoding; the matching local font renders the legacy projection.
- Typing method: local Mozhi by default, with explicitly selected experimental
  Google online suggestions and alternative spelling selection. Offline uses a
  labelled Mozhi fallback; failed online requests preserve source and offer retry.
- Fonts: two real, licensed Unicode font previews and source notices; local font
  file proofs without upload or bundling.
- Layout: the same single editor on desktop and mobile, with bottom mobile
  navigation and reachable export controls.
- Settings: device/light/dark themes, three preview sizes, explicit draft opt-in,
  draft deletion, installation guidance and privacy information.
- Offline: app, worker, WASM, rules, catalogue, fonts and licences are precached.
  Readiness is shown only after cache verification and service-worker control.
- Errors: initialization failure keeps the source and offers retry; clipboard
  failure selects editor text; storage failures are visible and do not prevent typing.

The local engine follows the bundled Mozhi 2 reference 3.2.6 deterministically. It does
not guess intended words or autocorrect spelling. It preserves non-ASCII source
characters, and literal spans prevent unwanted conversion of English passages.
Ordinary ASCII letters are Manglish; use escaping for English or accented words
containing ASCII letters. Unclosed `{` spans are preserved including the brace.

## Later milestones

Additional FML/ML-TT variants and receiving-app compatibility; offline word candidates; Android companion/IME;
iOS companion/keyboard; Tauri companion; Windows TSF and macOS InputMethodKit.
Each adapter must keep output mode visible and use the same rules and corpus.
Native composition APIs and host-app compatibility tests belong to those phases.

The hosted edition adds Firebase Authentication, roles, Firestore profiles and
private favourites/drafts. Vercel hosts the app; a Cloudflare Worker checks Firebase
ID tokens and gates D1 catalogue records and R2 font binaries. Font uploads need
admin approval; copyright reports stay private. The standalone edition keeps its offline/account-free behaviour. AI, voice,
community mapping uploads and system font installation remain outside the beta. Publishing and store releases are separate
from building the local artifact.
