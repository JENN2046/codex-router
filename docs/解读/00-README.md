# codex-router 解读索引

本文档组是对 `A:\codex-router` 代码库的中文解读，基于当前仓库文件、`README.md`、`routing-policy.yaml` 以及 `packages/*/src/index.ts` 静态阅读整理。

## 仓库定位

`codex-router` 是一个面向 Codex Desktop / CLI 宿主的任务治理与执行编排 SDK。它不是独立业务应用，也不是单纯模型 SDK 封装。它的核心职责是：

- 接收结构化任务输入。
- 判断任务意图、风险和歧义。
- 根据策略选择模型、工具权限和执行 profile。
- 执行预检与审批判断。
- 生成桌面 primitive 执行计划。
- 通过宿主 bridge 执行实际动作。
- 写入 checkpoint、audit event 和 telemetry event。

主链可以概括为：

```text
任务协议
-> 风险分类
-> 策略路由
-> 审批 / 预检
-> 执行计划
-> 宿主桥接
-> 证据沉淀
```

## 文档结构

- [01-architecture.md](./01-architecture.md)：整体架构、核心分层、主模块关系。
- [02-startup-data-config.md](./02-startup-data-config.md)：启动流、数据流、配置文件。
- [03-modules-cheatsheet.md](./03-modules-cheatsheet.md)：各 package 一句话速查表和定位方式。
- [04-risks-maintenance.md](./04-risks-maintenance.md)：主要风险、技术债和维护注意点。
- [05-development-review.md](./05-development-review.md)：二次开发扩展点、code review 重点、测试建议。

## 当前检查限制

当前 `A:\codex-router` 目录不是 Git 仓库根目录，因此无法确认：

- 当前分支。
- worktree 是否干净。
- Git diff 状态。

本文档只代表基于当前文件系统内容的静态代码解读，不代表 release readiness 或生产可用性验证。
