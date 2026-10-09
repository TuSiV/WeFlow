# Synthetic encrypted Windows database fixture

`windows-wcdb.json` contains two generated SQLite databases with only one fake
friend and one fake text message. It contains no acquired keys or user records.
The key, salt, and IV values are public test constants.

SQLite pages have size 4096 and 80 reserved bytes (sqlite3_file_control opcode
SQLITE_FCNTL_RESERVE_BYTES=38, applied before creating tables). Page payloads
are encrypted with AES-256-CBC without padding; the first page replaces the
16-byte SQLite header with a salt. The trailer contains a 16-byte IV and a
64-byte HMAC-SHA512. The HMAC key uses PBKDF2-HMAC-SHA512 with the raw test key,
salt XOR 0x3a, two iterations, and 32 output bytes. Each HMAC includes the
ciphertext, IV, and a little-endian 32-bit page number. This matches the raw-key
SQLCipher 4 page layout. Full encrypted file SHA-256 values are stored with each
base64 entry.

Windows checks use the actual WcdbCore application adapter to open the account
and read the fake session/message, then exercise WeLive's JSONL export. These
checks cannot validate extraction from a live WeChat process or the coverage of
months/years of records and attachments.
