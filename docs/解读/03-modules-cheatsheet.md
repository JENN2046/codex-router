# Package 速查表

## 核心主链

- `contracts`：定义全系统协议、枚举和核心类型。
- `policy-config`：加载并校验 YAML 策略，把配置变成强类型快照。
- `intent-gate`：把任务文本粗分类，并判断歧义程度。
- `execution-profiles`：定义每类任务的阶段模板、默认角色和并行能力。
- `routing-engine`：根据任务分类和策略，选模型、权限、profile 和并行方式。
- `approval-gate`：把“需要审批”落成可执行 gate 结果。
- `preflight`：检查 auth、工具可用性、工作区状态和 memory 健康状态。
- `desktop-bridge`：把路由结果翻译成桌面 primitive 执行计划。
- `desktop-agent-strategy`：决定是否并行、最多几个 agent、每个 agent 的 ownership。
- `desktop-decision-runner`：总控编排器，连接分类、路由、预检、审批、checkpoint、audit、telemetry。
- `desktop-live-adapter`：按计划调用宿主 primitive handler，执行真正动作。
- `desktop-host-client`：宿主最常用入口，暴露 `run()` 和 `resume()`。

## 宿主接入

- `codex-desktop-bindings`：把 Codex Desktop 风格 runtime 操作映射成 SDK primitive binding。
- `codex-desktop-live-host`：把 desktop runtime、memory 和 host client 组装成可嵌入真实宿主的总成。
- `codex-cli-host`：构造 Codex CLI 的安全执行计划，并解析 JSONL 输出。
- `host-client-example`：端到端宿主示例，展示如何把主模块组起来。
- `final-host-locator`：判断哪些路径是可编辑最终宿主源，哪些只是参考宿主或打包运行时。

## Memory 与审计

- `audit-memory`：定义审计事件、memory adapter 接口，以及文件审计存储。
- `codex-memory-adapter`：把 checkpoint 写入 codex-memory，并支持 recall。
- `codex-memory-host-client`：把宿主 memory 工具适配成统一 memory client。
- `codex-memory-mcp-client`：直接对接 codex-memory 的 HTTP MCP 传输层客户端。
- `checkpoint-index`：从命名和测试看，用于本地 checkpoint 检索 / 索引辅助。

## 可观测性与运行控制

- `observability`：日志、遥测、投递指标、阈值告警、fanout、alert suppression 都在这里。
- `runtime-control`：根据运行时信号决定升级模型还是打开 circuit breaker。
- `recon-policy`：限制 reconnaissance 阶段允许的命令前缀和总结模板。

## 按问题反查模块

### 任务分错类

看：

- `packages/intent-gate/src/index.ts`
- `tests/intent-gate.test.ts`

重点检查关键词、分类优先级、歧义原因和 taskClass hint。

### 模型、权限或 profile 不对

看：

- `routing-policy.yaml`
- `packages/routing-engine/src/index.ts`
- `packages/policy-config/src/index.ts`

重点检查 `models`、`toolPolicies`、`executionProfiles` 和 schema 是否对齐。

### 明明能跑却被拦住

看：

- `packages/preflight/src/index.ts`
- `packages/approval-gate/src/index.ts`
- `packages/desktop-decision-runner/src/index.ts`

重点检查 preflight errors、approval reasons、memory policy pack。

### ready 了但实际没执行对

看：

- `packages/desktop-bridge/src/index.ts`
- `packages/desktop-live-adapter/src/index.ts`
- `packages/codex-desktop-bindings/src/index.ts`

重点检查 primitive plan、handler 是否存在、handler output 是否被正确归一化。

### 宿主接入不上

看：

- `packages/desktop-host-client/src/index.ts`
- `packages/codex-desktop-bindings/src/index.ts`
- `packages/codex-desktop-live-host/src/index.ts`

重点检查 bridge、binding、runtime 方法和 host object readiness。

### checkpoint 或 resume 异常

看：

- `packages/audit-memory/src/index.ts`
- `packages/codex-memory-adapter/src/index.ts`
- `packages/codex-memory-host-client/src/index.ts`

重点检查 checkpoint 写入、recall query、memory result 解析。

### 遥测、告警或投递问题

看：

- `packages/observability/src/index.ts`
- `routing-policy.yaml`

重点检查 fanout 策略、timeout、retry、metrics collector、threshold preset、delivery window。

### CLI 接入异常

看：

- `packages/codex-cli-host/src/index.ts`

重点检查 CLI args 构造、危险参数拦截、JSONL 解析和 warnings。

## 30 分钟阅读顺序

1. `README.md`
2. `package.json`
3. `packages/contracts/src/index.ts`
4. `routing-policy.yaml`
5. `packages/policy-config/src/index.ts`
6. `packages/intent-gate/src/index.ts`
7. `packages/routing-engine/src/index.ts`
8. `packages/preflight/src/index.ts`
9. `packages/approval-gate/src/index.ts`
10. `packages/desktop-decision-runner/src/index.ts`
11. `packages/desktop-live-adapter/src/index.ts`
12. `packages/desktop-host-client/src/index.ts`
13. `packages/codex-desktop-bindings/src/index.ts`
14. `packages/codex-desktop-live-host/src/index.ts`

读完这些文件，基本可以定位大多数行为问题。
