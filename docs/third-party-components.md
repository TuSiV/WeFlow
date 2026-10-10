# 第三方可插拔组件接口说明

本分支 Windows x64 与 Mac arm64 的随包配置见 [组件状态](native-components-status.md)：构建时下载固定来源组件，路径留空使用校验后的数据库、媒体及密钥适配器。Mac 要求 macOS 15+、Apple Silicon；其他平台未验证随包运行。

以下四类能力可在「设置 -> 数据库 -> 第三方组件路径」中显式配置可执行文件、动态库或插件。显式路径优先，用户负责其来源及可信性；固定随包文件的完整性验证不适用于用户自备实现。

路径留空不再等于“未配置”：支持的平台使用随包实现；WeLive 留空时使用源码消息游标及格式化导出流程。显式配置错误或文件不存在时应修正／清除该配置，不期待静默替换。密钥工具配置非空但不存在时返回外部工具未配置错误；Mac 随包工具缺失或校验失败不视为取钥成功。

## 1. WCDB 实现（`wcdbLibPath`）

一个动态库（Windows `*.dll` / macOS `*.dylib` / Linux `*.so`），通过 [koffi](https://koffi.dev/)
以 C ABI 方式加载，用于读取本地 SQLCipher 数据库并提供会话/消息/联系人/朋友圈等查询。

加载流程（见 `electron/services/wcdbCore.ts` 的 `initialize()`）：
1. `koffi.load(wcdbLibPath)`。
2. 按 `wcdbCore.ts` 绑定核心及扩展函数；Mac 随包路径先预加载同目录 WCDB 依赖。`wcdb_init`、`wcdb_shutdown`、`wcdb_open_account`、`wcdb_close_account` 等核心绑定并非可选；只有调用点中明确使用容错绑定的扩展函数可以缺失。

完整函数签名列表（`int32` 返回值均为状态码，`0` 表示成功；`_Out_ void** outJson` 类参数
通过 `wcdb_free_string` 释放调用方分配的字符串内存）：

```
int32 wcdb_open_account(const char* path, const char* key, _Out_ int64* handle)
int32 wcdb_close_account(int64 handle)
int32 wcdb_init()
int32 wcdb_shutdown()
int32 wcdb_purge_memory()
void  wcdb_free_string(void* ptr)
int32 wcdb_set_my_account_id(int64 handle, const char* accountId)
int32 wcdb_get_sessions(int64 handle, _Out_ void** outJson)
int32 wcdb_mark_all_sessions_read(int64 handle, _Out_ void** outError)
int32 wcdb_reorder_sessions_by_time(int64 handle, _Out_ void** outJson)
int32 wcdb_get_messages(int64 handle, const char* username, int32 limit, int32 offset, _Out_ void** outJson)
int32 wcdb_get_messages_by_type(int64 handle, const char* sessionId, int64 localType, int32 ascending, int32 limit, int32 offset, _Out_ void** outJson)
int32 wcdb_get_message_count(int64 handle, const char* username, _Out_ int32* outCount)
int32 wcdb_get_message_by_id(int64 handle, const char* sessionId, int32 localId, _Out_ void** outJson)
int32 wcdb_get_message_by_svrid(int64 handle, const char* sessionId, const char* svrid, _Out_ void** outJson)
int32 wcdb_get_session_message_counts(int64 handle, const char* sessionIdsJson, _Out_ void** outJson)
int32 wcdb_get_session_message_type_stats(int64 handle, const char* sessionId, int32 beginTimestamp, int32 endTimestamp, _Out_ void** outJson)
int32 wcdb_get_session_message_type_stats_batch(int64 handle, const char* sessionIdsJson, const char* optionsJson, _Out_ void** outJson)
int32 wcdb_get_session_message_date_counts(int64 handle, const char* sessionId, _Out_ void** outJson)
int32 wcdb_get_session_message_date_counts_batch(int64 handle, const char* sessionIdsJson, _Out_ void** outJson)
int32 wcdb_open_message_cursor(int64 handle, const char* sessionId, int32 batchSize, int32 ascending, int32 beginTimestamp, int32 endTimestamp, _Out_ int64* outCursor)
int32 wcdb_fetch_message_batch(int64 handle, int64 cursor, _Out_ void** outJson, _Out_ int32* outHasMore)
int32 wcdb_close_message_cursor(int64 handle, int64 cursor)
int32 wcdb_set_message_cursor_projection(int64 handle, int64 cursor, int32 projection)
int32 wcdb_search_messages(int64 handle, const char* sessionId, const char* keyword, int32 limit, int32 offset, int32 beginTimestamp, int32 endTimestamp, _Out_ void** outJson)
int32 wcdb_ai_query_session_candidates(int64 handle, const char* optionsJson, _Out_ void** outJson)
int32 wcdb_update_message(int64 handle, const char* sessionId, int64 localId, int32 createTime, const char* newContent, _Out_ void** outError)
int32 wcdb_insert_text_message(int64 handle, const char* sessionId, const char* content, int64 status, int64 createTime, _Out_ void** outJson)
int32 wcdb_delete_message(int64 handle, const char* sessionId, int64 localId, int32 createTime, const char* dbPathHint, _Out_ void** outError)
int32 wcdb_check_message_anti_revoke_trigger(int64 handle, const char* sessionId, _Out_ int32* outInstalled)
int32 wcdb_install_message_anti_revoke_trigger(int64 handle, const char* sessionId, _Out_ void** outError)
int32 wcdb_uninstall_message_anti_revoke_trigger(int64 handle, const char* sessionId, _Out_ void** outError)
int32 wcdb_get_contact(int64 handle, const char* username, _Out_ void** outJson)
int32 wcdb_get_contact_status(int64 handle, const char* usernamesJson, _Out_ void** outJson)
int32 wcdb_get_contact_type_counts(int64 handle, _Out_ void** outJson)
int32 wcdb_get_contacts_compact(int64 handle, const char* usernamesJson, _Out_ void** outJson)
int32 wcdb_get_contact_alias_map(int64 handle, const char* usernamesJson, _Out_ void** outJson)
int32 wcdb_get_contact_friend_flags(int64 handle, const char* usernamesJson, _Out_ void** outJson)
int32 wcdb_get_chat_room_ext_buffer(int64 handle, const char* chatroomId, _Out_ void** outJson)
int32 wcdb_get_display_names(int64 handle, const char* usernamesJson, _Out_ void** outJson)
int32 wcdb_get_avatar_urls(int64 handle, const char* usernamesJson, _Out_ void** outJson)
int32 wcdb_get_head_image_buffers(int64 handle, const char* usernamesJson, _Out_ void** outJson)
int32 wcdb_get_group_member_count(int64 handle, const char* chatroomId, _Out_ int32* outCount)
int32 wcdb_get_group_member_counts(int64 handle, const char* chatroomIdsJson, _Out_ void** outJson)
int32 wcdb_get_group_members(int64 handle, const char* chatroomId, _Out_ void** outJson)
int32 wcdb_get_group_nicknames(int64 handle, const char* chatroomId, _Out_ void** outJson)
int32 wcdb_get_group_stats(int64 handle, const char* chatroomId, int32 begin, int32 end, _Out_ void** outJson)
int32 wcdb_get_aggregate_stats(int64 handle, const char* sessionIdsJson, int32 begin, int32 end, _Out_ void** outJson)
int32 wcdb_get_available_years(int64 handle, const char* sessionIdsJson, _Out_ void** outJson)
int32 wcdb_get_annual_report_stats(int64 handle, const char* sessionIdsJson, int32 begin, int32 end, _Out_ void** outJson)
int32 wcdb_get_annual_report_extras(int64 handle, const char* sessionIdsJson, int32 begin, int32 end, int32 peakBegin, int32 peakEnd, _Out_ void** outJson)
int32 wcdb_get_dual_report_stats(int64 handle, const char* sessionId, int32 begin, int32 end, _Out_ void** outJson)
int32 wcdb_get_my_footprint_stats(int64 handle, const char* optionsJson, _Out_ void** outJson)
int32 wcdb_get_message_tables(int64 handle, const char* sessionId, _Out_ void** outJson)
int32 wcdb_get_message_table_stats(int64 handle, const char* sessionId, _Out_ void** outJson)
int32 wcdb_get_message_dates(int64 handle, const char* sessionId, _Out_ void** outJson)
int32 wcdb_get_message_meta(int64 handle, const char* dbPath, const char* tableName, int32 limit, int32 offset, _Out_ void** outJson)
int32 wcdb_get_message_table_columns(int64 handle, const char* dbPath, const char* tableName, _Out_ void** outJson)
int32 wcdb_get_message_table_time_range(int64 handle, const char* dbPath, const char* tableName, _Out_ void** outJson)
int32 wcdb_list_tables(int64 handle, const char* kind, const char* dbPath, _Out_ void** outJson)
int32 wcdb_get_table_schema(int64 handle, const char* kind, const char* dbPath, const char* tableName, _Out_ void** outJson)
int32 wcdb_export_table_snapshot(int64 handle, const char* kind, const char* dbPath, const char* tableName, const char* outputPath, _Out_ void** outJson)
int32 wcdb_import_table_snapshot(int64 handle, const char* kind, const char* dbPath, const char* tableName, const char* inputPath, _Out_ void** outJson)
int32 wcdb_import_table_snapshot_with_schema(int64 handle, const char* kind, const char* dbPath, const char* tableName, const char* inputPath, const char* createTableSql, _Out_ void** outJson)
int32 wcdb_list_message_dbs(int64 handle, _Out_ void** outJson)
int32 wcdb_list_media_dbs(int64 handle, _Out_ void** outJson)
int32 wcdb_get_media_schema_summary(int64 handle, const char* dbPath, _Out_ void** outJson)
int32 wcdb_exec_query(int64 handle, const char* kind, const char* path, const char* sql, _Out_ void** outJson)
int32 wcdb_get_emoticon_cdn_url(int64 handle, const char* dbPath, const char* md5, _Out_ void** outUrl)
int32 wcdb_get_emoticon_caption(int64 handle, const char* dbPath, const char* md5, _Out_ void** outCaption)
int32 wcdb_get_emoticon_caption_strict(int64 handle, const char* md5, _Out_ void** outCaption)
int32 wcdb_get_voice_data(int64 handle, const char* sessionId, int32 createTime, int32 localId, int64 svrId, const char* candidatesJson, _Out_ void** outHex)
int32 wcdb_get_voice_data_batch(int64 handle, const char* requestsJson, _Out_ void** outJson)
int32 wcdb_resolve_image_hardlink(int64 handle, const char* md5, const char* accountDir, _Out_ void** outJson)
int32 wcdb_resolve_image_hardlink_batch(int64 handle, const char* requestsJson, _Out_ void** outJson)
int32 wcdb_resolve_video_hardlink_md5(int64 handle, const char* md5, const char* dbPath, _Out_ void** outJson)
int32 wcdb_resolve_video_hardlink_md5_batch(int64 handle, const char* requestsJson, _Out_ void** outJson)
int32 wcdb_scan_media_stream(int64 handle, const char* sessionIdsJson, int32 mediaType, int32 beginTimestamp, int32 endTimestamp, int32 limit, int32 offset, _Out_ void** outJson, _Out_ int32* outHasMore)
int32 wcdb_get_sns_timeline(int64 handle, int32 limit, int32 offset, const char* username, const char* keyword, int32 startTime, int32 endTime, _Out_ void** outJson)
int32 wcdb_get_sns_annual_stats(int64 handle, int32 begin, int32 end, _Out_ void** outJson)
int32 wcdb_get_sns_usernames(int64 handle, _Out_ void** outJson)
int32 wcdb_get_sns_export_stats(int64 handle, const char* myAccountId, _Out_ void** outJson)
int32 wcdb_check_sns_block_delete_trigger(int64 handle, _Out_ int32* outInstalled)
int32 wcdb_install_sns_block_delete_trigger(int64 handle, _Out_ void** outError)
int32 wcdb_uninstall_sns_block_delete_trigger(int64 handle, _Out_ void** outError)
int32 wcdb_delete_sns_post(int64 handle, const char* postId, _Out_ void** outError)
int32 wcdb_start_monitor_pipe()
void  wcdb_stop_monitor_pipe()
int32 wcdb_get_monitor_pipe_name(_Out_ void** outName)
int32 wcdb_get_db_status(int64 handle, _Out_ void** outJson)
int32 wcdb_get_logs(_Out_ void** outJson)
int32 wcdb_cloud_init(int32 intervalSeconds)
int32 wcdb_cloud_report(const char* statsJson)
void  wcdb_cloud_stop()
void  VerifyUser(int64 hwnd, const char* message, _Out_ char* outResult, int maxLen)
```

上表是接口参考，不是“只实现 `wcdb_open_account` 即可运行”的最小合同。必须／可选绑定、JSON 字段和出参所有权以 [当前适配器源码](../electron/services/wcdbCore.ts) 的调用点为准。

## 2. 媒体解密插件（`imageNativeAddonPath`）

一个 Node 原生插件（`.node`，通过 `require()` 加载），对应 `electron/services/nativeImageDecrypt.ts`
里的 `NativeAddon` 接口：

```ts
{
  decryptDatNative(inputPath: string, xorKey: number, aesKey?: string): {
    data: Buffer
    ext: string          // 如 'jpg'/'png'/'mp4'，不含点号也可
    isWxgf?: boolean      // 是否为 WXGF 容器格式，是则会再走一层 unwrap
    version?: number
    aesSize?: number
    xorSize?: number
    rawSize?: number
    flag?: number
  }
  // 可选：编辑/重新加密场景使用
  encryptDatNative?(inputPath: string, xorKey: number, aesKey?: string, meta?: object): Buffer
}
```

参照原始 `Wedecrypt/` Rust 工程（`napi`/`napi-derive` + `cdylib`）实现即可复用其思路。

## 3. WeLive 批量导出引擎（`welivePath`）

仅用于用户显式配置的外部实现；本分支不分发已报告到期的 WeLive 通信二进制，默认导出不需要它。

一个可执行文件，由 `electron/services/weliveBridge.ts` 的 `runWeliveExport()` 拉起，
用于会话的批量原始导出（文本 + 媒体）。协议：

- 请求：完整的 `WeliveExportRequest`（见 `weliveBridge.ts` 内类型定义，包含账号信息、
  `sessionIds`、输出目录、媒体类型等）序列化为 JSON，写入子进程 stdin 后关闭。
- 响应：子进程通过 stdout 按行输出 `WeliveExportEvent` 的 NDJSON（`ready`/`progress`/
  `created_file`/`created_dir`/`session_error`/`result` 等类型），最终以一条 `result` 事件
  （含 `success`/`success_count`/`fail_count`/`session_output_paths`/`raw_export_manifests`
  等字段）结束。进程以退出码 `0` 且最后一条事件为 `result` 且 `success !== false` 视为成功。
- 支持通过关闭 stdin/发送信号来响应取消（`AbortSignal`），进程应能在收到终止信号后尽快退出。

## 4. 外部密钥工具（`keyProviderPath`）

配置后优先于 Windows/Mac 随包密钥工具。适配器启动可执行文件，不附加命令行参数；向 stdin 写入一行 JSON 后关闭 stdin。stdout 输出按行分隔的 JSON（NDJSON），可先输出进度，再输出结果。stderr 不是结果协议。

| `action` | 请求可包含的字段 | 成功结果字段 |
| --- | --- | --- |
| `get_db_key` | `dbPath`、`accountId`、`internalDbKeyHex` | `success: true`、`key`；可含 `accountId`、`logs` |
| `get_image_key` | `accountDir`、`accountId` | `success: true`、`xorKey`、`aesKey`、`verified` |
| `scan_image_key_memory` | `accountDir` | `success: true`、`xorKey`、`aesKey`、`verified` |

字段可能省略，工具必须检查必需条件，不猜测另一账号。示意请求：

```json
{"action":"get_db_key","dbPath":"/所选数据根目录","accountId":"所选完整账号目录标识"}
```

stdout 示例（占位密钥不能连接数据库）：

```json
{"type":"progress","message":"正在验证所选账号","level":0}
{"type":"result","success":true,"key":"<64位十六进制数据库密钥>"}
```

失败使用 `{"type":"result","success":false,"error":"具体失败原因"}`。不要将密钥写入进度、`logs` 或 stderr。结果必须换行结束；进程退出但无有效结果时报告失败。数据库请求使用调用方等待时间（默认 60 秒），图片请求默认 120 秒；超时会终止该子进程。当前适配器接收到结果事件后结算请求，退出码不是唯一成功判据。

引导页验证候选数据库密钥能否打开所选账号，不接受外部返回其他账号 ID 来替换选择。外部图片接口的 `verified` 是工具声明，不等同于已运行随包 Mac 的模板校验。

Mac 随包 `xkey_helper <pid> <timeout_ms>` 和 `image_scan_helper <pid> <ciphertext_hex>` 使用自己的原生 CLI 协议，不能直接填成外部 NDJSON 工具。其适配由 [Mac 服务](../electron/services/bundledMacKeyService.ts) 完成。
