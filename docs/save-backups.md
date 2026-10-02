# Portable save files

Camber Reign uses manual backup files without sign-in. No authenticated cloud save backend is configured: the Firebase configuration serves Hosting, and the app does not provision authentication, a database or a synchronization service.

The version-one `camber-reign-save` envelope contains a creation timestamp and ten required sections: preferences, progression, paint, favorites, career, campaign, mastery, setups, school and records. The current driving-controls schema is validated through `normalizePlayerControls`. Record keys allow only the game's record prefix and bounded lowercase scope suffixes. Values pass the actual record loader, including optional supported replay and lap fields. Older setup saves gain an empty circuit-override map without losing per-car defaults.

Validation rejects foreign versions, missing sections, unknown keys, unsafe object properties, duplicate record keys, impossible numeric values, invalid known identifiers, malformed replay sequences and excess size/depth. It does not silently award achievements or trust an arbitrary local-storage dump. These remain editable local game records, not server-authenticated competitive results.

Analytics consent, cookies, account/authentication data, unrelated local storage and transient campaign navigation intents are not exported or replaced. Existing consent survives import unchanged. Files are downloaded locally and are not uploaded to a service.

## API

All functions are in `src/save-backup.js` and default to the current browser's local storage. Pass `{storage}` to use a different storage adapter.

- `exportSaveBackup({storage, states, now})` returns `{ok, json, filename, summary}` or `{ok:false, error}`. Optional `states` overlays current in-memory game sections, preserving earned session changes. If overriding `records`, provide the entire `{key, value}[]` collection, including retained historical scopes. Export performs no writes.
- `inspectSaveBackup(json)` validates and returns `{ok, backup, states, summary}` for the UI's replacement preview. Validation does not change any saved value.
- `importSaveBackup(json, {storage})` validates again, writes/verifies a durable recovery journal, replaces only game keys, verifies the resulting values and releases the journal. Success explicitly returns `persisted:true`. Failure returns `persisted:false`, `rolledBack`, `recoveryRequired` and a readable error.
- `recoverSaveImport({storage})` runs before any game save loader. It restores the journal's exact original entries and verifies them before releasing the journal. If a present journal cannot be read or recovered, the UI blocks loading potentially mixed saves and offers recovery. Ordinary denied-storage sessions with no known journal remain playable.
- `exportRecoveryBackup({storage})` creates a validated portable file from the original recovery snapshot without including unrelated data.

Local storage has no multi-key transaction. The implementation provides synchronous verified replacement, rollback on failure and crash recovery through a journal; it does not claim native transactional storage. The original journal is never overwritten by a second import while recovery remains pending. The recovery journal key is `camber-reign-portable-import-journal-v1`, separate from the former-domain migration tool's backup.

The interface must ask the player to approve replacement after a valid preview and reload only after successful verified import. Partial or unsuccessful persistence must never be labelled saved. Backup files are capped at 32 MB and 512 supported stored entries, with bounded nesting and replay arrays; oversized data fails visibly rather than being truncated.

## Verification

`tests/save-backup.test.js` covers complete round trips, scoped records, excluded consent/authentication data, session-state overlays, malformed imports before writes, one-write failure with exact rollback, repeated storage failure with a preserved journal, post-reload recovery, quota failure before mutation and silent-write failure. These adapters exercise the storage contract, not browser file-picker or download behavior; the integrated browser checks must cover those flows separately.
