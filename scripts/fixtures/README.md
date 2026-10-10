# Synthetic encrypted desktop database fixture

`windows-wcdb-passphrase.json` contains two generated SQLite databases with only one fake
friend and one fake text message. It contains no acquired keys or user records.
The key, salt, and IV values are public test constants.

SQLite pages have size 4096 and 80 reserved bytes (sqlite3_file_control opcode
SQLITE_FCNTL_RESERVE_BYTES=38, applied before creating tables). Page payloads
are encrypted with AES-256-CBC without padding; the first page replaces the
16-byte SQLite header with a salt. The trailer contains a 16-byte IV and a
64-byte HMAC-SHA512. The AES key uses PBKDF2-HMAC-SHA512 with the decoded 32-byte test passphrase,
the database salt, 256000 iterations, and 32 output bytes. The HMAC key uses
PBKDF2-HMAC-SHA512 with that AES key,
salt XOR 0x3a, two iterations, and 32 output bytes. Each HMAC includes the
ciphertext, IV, and a little-endian 32-bit page number. This matches the passphrase
SQLCipher 4 page layout. `windows-wcdb.json` preserves the raw-key variant
used to diagnose the difference between raw and passphrase key APIs. Full encrypted file SHA-256 values are stored with each
base64 entry.

The historical `windows-` filenames are retained; the same passphrase fixture is
used by actual Windows x64 and macOS arm64 Electron checks. They open the account
through WcdbCore, read the fake session/message, decrypt a synthetic image, and
exercise the actual exportWorker for HTML and PDF.

Additional generated messages test all 620 markers across 52 PDF pages, an exact
first/last subset excluding intermediate messages, and missing selection failure
with temporary-file cleanup. CJK extracted text is compared with NFKC compatibility
normalization. Actual React components use synthetic accounts and API responses.

Mac key-adapter tests simulate candidate capture and permission responses, then
verify candidates against this real encrypted fixture. Actual native key-library
symbols are loaded, and both shipped helpers reject invalid PID 0; no live process
is attached. The fixture key is not an acquired user key or real WeChat capture.

These checks do not validate live WeChat extraction or months/years of real records
and attachments. Commands, evidence and boundaries are in
[TESTING.md](../../docs/TESTING.md).
