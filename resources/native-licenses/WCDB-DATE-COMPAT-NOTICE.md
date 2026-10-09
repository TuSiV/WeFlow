# WCDB date compatibility adaptation

Reference analysis: https://github.com/Dinnerb0ne2/WeFlow-WCDB-Patch/blob/cbcfcf4d344d4e9c477ba9c12063594af68a5025/DETAILS.md
Author: Dinnerb0ne2. License: CC BY-NC-SA 4.0.

This fork independently checked the two instruction sites in the exact pinned
Windows x64 DLL. The Node implementation accepts only the known original or
known patched SHA-256 and validates the complete output. It does not run the
reference PowerShell script, change system time, or edit account databases.
Changes: deterministic build-time transformation, separate original/runtime
Git blob checks, and tests for branch targets and rejection of other files.

The derived DLL and adaptation retain CC BY-NC-SA 4.0. See LICENSE for
the license text distributed with the original bundle.

Additional independently developed WeLive adaptation in this fork: remove only
the six-byte conditional branch to the fixed-date expired-build exit in the
pinned Windows x64 executable. The original clock-validity check is preserved.
The source and complete transformed output are verified by pinned hashes.
The original Weport license continues to apply to the derived executable.
