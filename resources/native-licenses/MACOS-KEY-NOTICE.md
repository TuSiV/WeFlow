Mac key acquisition components and protocol

Source: Panther114/Weport commit 3b9e2afd341f0eef56d4be9dafca25c8fe8be533.
Original native files: resources/key/macos/universal/{xkey_helper,image_scan_helper,libwx_key.dylib}.
Original TypeScript reference: electron/services/keyServiceMac.ts.
License: CC BY-NC-SA 4.0, retained with the other pinned Weport component notices.

Native files are downloaded unchanged and verified against their source Git blob SHA and size before execution. The database helper receives exactly one selected WeChat PID and a bounded wait time. Mac adapter code implements the documented JSON protocol, handles cancellation/timeouts, and validates every candidate database key against the selected account before returning success. Image cache directory rules and code derivation follow the same pinned source; only verified selected-account templates can establish a successful image key.

No system-protection changes, application re-signing, broad process termination or key logging are performed. A system authorization prompt is optional after a permission failure; access can still be rejected by macOS or the target application. Real WeChat version compatibility must not be inferred from synthetic tests or from bundling the helper.
