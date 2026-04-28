# 项目阶段评估（experiments/codex-oauth-gateway）

> 评估日期：2026-04-28

## 1) 当前阶段结论

该项目目前处于 **可运行 PoC（Proof of Concept）/ 预产品化** 阶段，不是主仓库主插件那种“成熟维护期”。

判断依据：

- 项目定位在 README 中明确写为 `Standalone experiment`（独立实验），并强调“personal experimentation”。
- 版本仍是 `0.1.0` 且 `private: true`，说明还未进入可公开发布与稳定 API 承诺阶段。
- 已实现核心闭环：OAuth 登录 + token 刷新 + 本地网关 `/responses` 转发 + `stream:false` 时 SSE→JSON 转换。
- 但缺少测试体系、CI、发布流程、配置校验、可观测性与安全加固等产品化要素。

## 2) 已完成能力（你们已经做对了什么）

- OAuth 核心流程完成：PKCE、state、授权码交换、refresh token 刷新、JWT 解析 account id。
- API 网关基本能力完成：`GET /health`、`POST /responses`、请求体大小保护（20MB）。
- 与 Codex 后端的关键约束对齐：强制 `store:false`、默认 `include: ["reasoning.encrypted_content"]`、统一 headers。
- 支持请求意图分流：客户端要求流式时透传 SSE，非流式时转换为 JSON 返回。

## 3) 后续工作（按优先级）

### P0（应尽快完成）

1. **补单元测试（最小门槛）**
   - 覆盖 `normalizeModel`、`parseFinalResponse`、`parseAuthorizationInput`、`transformBody`。
   - 目标：先做到核心纯函数 80%+ 覆盖，避免后续重构回归。

2. **错误处理标准化**
   - 当前 500 错误统一返回 message，但上游错误映射较粗。
   - 建议把 token 失效、account-id 缺失、上游 401/429/5xx 分级返回，便于调用方重试策略。

3. **安全与配置硬化**
   - 增加 `.tokens/openai.json` 的存在性/权限检查提示（当前写入是 0600，但缺读取时友好诊断）。
   - 增加环境变量文档：`CODEX_GATEWAY_PORT`、`CODEX_GATEWAY_TOKEN_FILE`。

4. **README 补“已知限制”**
   - 明确“仅本地单用户开发用途”“无并发/多租户设计”“无速率限制与审计”。

### P1（中期推进）

5. **开发体验改进**
   - 增加 `dev` 真正 watch 模式（目前是 build+start，一次性）。
   - 增加 `lint` / `format`（至少统一 import 顺序、空格、行宽规则）。

6. **轻量可观测性**
   - 结构化日志（请求 id、上游耗时、状态码、模式 stream/non-stream）。
   - /health 增加 token 剩余有效期秒数，便于巡检。

7. **Python 示例可维护化**
   - 给 `python/main.py` 增加参数化模型、stream 开关与异常提示，避免示例过于固定。

### P2（产品化前）

8. **CI 与质量门禁**
   - GitHub Actions：build + typecheck + test。
   - 覆盖率门槛（如 70% 起步）。

9. **接口契约化**
   - 为 `/responses` 增加 JSON Schema 或类型导出，减少前后端对接歧义。

10. **发布策略决策**
   - 明确是否从 `experiments/` 孵化为独立仓库/包；若是，补版本策略与迁移说明。

## 4) 一句话总结

这个子项目已经完成“能跑通”的关键路径；下一步重点不是继续堆功能，而是补齐测试、错误语义、安全与工程化基线，让它从实验代码进入“可持续迭代”的小型产品阶段。
