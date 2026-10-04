# Security

Never put OAuth secrets, session cookies, private drafts or reporter contact details in a public issue. For a hosted instance, contact its operator privately; operators should add a security contact before public deployment.

The hosted API enforces session ownership, exact-origin writes, CSRF tokens, an admin allowlist and private R2 access. Local development sign-in requires an explicit flag plus a loopback HTTP hostname; it is not a production authentication option. Fonts are bounded and inspected before storage, then reviewed before publishing.

If a vulnerability affects a live instance, rotate its secrets and revoke affected sessions as appropriate. Submit a minimal reproduction without private data. Font copyright complaints belong in the instance's Report copyright form, which keeps contact details private from other users.
