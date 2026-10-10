# macOS WCDB fixed-date compatibility modification

Derived from the arm64 WCDB API library distributed by Panther114/Weport at commit 3b9e2afd341f0eef56d4be9dafca25c8fe8be533. Original licensing and attribution remain in this directory (CC BY-NC-SA 4.0 and the applicable third-party licenses).

The original library refuses initialization after a fixed September 2026 deadline. On 2026-10-10 macOS CI reported wcdb_init=-1000 and "expired: self-destruct triggered". Independent arm64 disassembly identifies two date branches: InitProtection at file offset 0x6d5c and wcdb_init at 0x6ec8. The first compares time() against 0x6abda27f; the second compares time() against the locally constructed deadline via mktime().

Only these two four-byte conditional branch instructions are changed to unconditional branches with identical targets (0x6d6c and 0x6f98). The existing linker-generated ad-hoc SHA-256 signature hash for their code page is refreshed; no Apple certificate or notarization is added. Process identity checks and encrypted database key authentication remain unchanged. The application does not modify the system clock.

Original SHA-256: 9917b74e6723efea63ac64927c9f6be1ed53133a62ff2c694c68d647690cead1
Derived SHA-256: 5085c303134bd4b56220fe641d7785df5b3c4eeed705b1cec2e4ebeaee4469e7

The installer only accepts the exact original hash. Runtime loading verifies the entire derived Git blob and sibling dependency, and rejects unexpected contents. Native code must pass macOS encrypted database and PDF export tests before publication. This limited change is not a comprehensive audit of the native component.
