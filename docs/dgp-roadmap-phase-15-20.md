# codex-router DGP 动态治理实施路线图

> 创建日期：2026-04-27  
> 当前版本：v2.0-dgp-beta  
> 当前状态：**Phase 1-20 全部完成** ✅  
> 测试状态：356 pass / 0 fail

---

## 总览

```
Phase 1-6   ████████████████████ 100%  治理内核包
Phase 7-9   ████████████████████ 100%  既有包增强
Phase 10-14 ████████████████████ 100%  运行时闭环 + 验证
Phase 15-16 ████████████████████ 100%  持久化 + 修复
Phase 17-18 ████████████████████ 100%  CLI 工具 + TaskGraph
Phase 19-20 ████████████████████ 100%  高级特性
```

---

## 已完成阶段 (Phase 1-14)

| 阶段 | 名称 | 状态 | 测试数 | 交付物 |
|---|---|---|---|---|
| Phase 1 | state-manager | ✅ 完成 | 14 | 治理状态类型 + 状态机 |
| Phase 2 | execution-observation | ✅ 完成 | 8 | 执行观察总线 |
| Phase 3 | entropy-risk | ✅ 完成 | 10 | 确定性风险评分器 |
| Phase 4 | strategy-router | ✅ 完成 | 9 | 策略路由 V2 |
| Phase 5 | recovery-control | ✅ 完成 | 8 | Step-back 仲裁包 |
| Phase 6 | checkpoint-ledger-v2 | ✅ 完成 | 7 | Checkpoint 账本 |
| Phase 7 | 轻接 live-adapter | ✅ 完成 | - | observationBus 注入 |
| Phase 8 | Runner 包装函数 | ✅ 完成 | 3 | runDesktopDecisionWithGovernance |
| Phase 9 | 桥接 governance-v2 | ✅ 完成 | - | CLI 桥接函数 |
| Phase 10 | 运行时闭环 | ✅ 完成 | - | 执行→观察→评分→路由 |
| Phase 11 | 三振出局仲裁 | ✅ 完成 | 1 | anomaly 计数触发 |
| Phase 12 | 对偶 Agent 验证 | ✅ 完成 | 12 | validation-arbiter 包 |
| Phase 13 | 真实宿主接入 | ✅ 完成 | - | 集成测试脚本 |
| Phase 14 | 集成报告 | ✅ 完成 | - | dgp-implementation-report.md |

**小计：7 个新包，3 个增强包，278 个测试通过**

---

## 待实施阶段 (Phase 15-20)

### Phase 15: 持久化存储 🔴 高优先级
| 属性 | 详情 |
|---|---|
| **目标** | 将内存 store 替换为文件/数据库持久化 |
| **估时** | 16 小时 |
| **依赖** | Phase 6 (checkpoint-ledger-v2) |
| **交付物** | `FileCheckpointLedgerStore`, `FileObservationStore` |
| **验收** | 重启后数据不丢失，支持增量追加 |

**任务分解：**
- [x] 15.1 设计持久化格式 (JSONL / SQLite)
- [x] 15.2 实现 `FileCheckpointLedgerStore`
- [x] 15.3 实现 `FileExecutionObservationStore`
- [x] 15.4 原子写入测试
- [x] 15.5 恢复测试

---

### Phase 16: 修复 Build 错误 🔴 高优先级
| 属性 | 详情 |
|---|---|
| **目标** | 修复 `tsc build` 报错 |
| **估时** | 2 小时 |
| **依赖** | 无 |
| **交付物** | 修复的测试文件 |
| **验收** | `npm run build` 无错误 |

**任务分解：**
- [x] 16.1 修复 `codex-desktop-bindings.test.ts` 缺少 `hostRoute`
- [x] 16.2 修复 `desktop-agent-strategy.test.ts` 缺少 `hostRoute`
- [x] 16.3 验证 `npm run build` 通过

---

### Phase 17: CLI 仲裁工具 🟠 中优先级
| 属性 | 详情 |
|---|---|
| **目标** | 实现人工仲裁 CLI 接口 |
| **估时** | 8 小时 |
| **依赖** | Phase 5 (recovery-control) |
| **交付物** | `codex-router arbitrate <taskId>` 命令 |
| **验收** | 可显示仲裁包，支持 resume/rollback/abort/fork 决策 |

**任务分解：**
- [x] 17.1 设计 CLI 命令格式
- [x] 17.2 实现仲裁包读取
- [x] 17.3 实现决策写入
- [x] 17.4 实现状态展示
- [x] 17.5 集成测试

---

### Phase 18: TaskGraph 实现 🟠 中优先级
| 属性 | 详情 |
|---|---|
| **目标** | 完整任务图模型，支持分支/回滚 |
| **估时** | 20 小时 |
| **依赖** | Phase 1 (state-manager), Phase 6 (checkpoint-ledger-v2) |
| **交付物** | `TaskGraph` 类型 + 操作 API |
| **验收** | 可创建分支、回滚到 checkpoint、合并分支 |

**任务分解：**
- [x] 18.1 设计 TaskGraph 类型定义
- [x] 18.2 实现节点管理
- [x] 18.3 实现边管理（依赖/冲突）
- [x] 18.4 实现分支创建
- [x] 18.5 实现回滚操作
- [x] 18.6 实现合并操作
- [x] 18.7 测试验证

---

### Phase 19: 渐进式放权 🟡 低优先级
| 属性 | 详情 |
|---|---|
| **目标** | 基于历史 resume 计数自动下调风险权重 |
| **估时** | 12 小时 |
| **依赖** | Phase 15 (持久化) |
| **交付物** | 风险权重调整策略 + 建议书生成 |
| **验收** | 可生成 `RiskWeightAdjustmentProposal` |

**任务分解：**
- [x] 19.1 设计 resume 计数追踪
- [x] 19.2 实现权重调整算法
- [x] 19.3 实现建议书生成
- [x] 19.4 实现审批链
- [x] 19.5 测试验证

---

### Phase 20: 真实宿主集成 🟡 低优先级
| 属性 | 详情 |
|---|---|
| **目标** | Codex Desktop / CLI 真实环境验证 |
| **估时** | 16 小时 |
| **依赖** | Phase 17 (CLI 仲裁) |
| **交付物** | Canary 测试 + Smoke 测试 |
| **验收** | 真实宿主通过治理闭环测试 |

**任务分解：**
- [x] 20.1 设计真实宿主测试场景
- [x] 20.2 实现 Canary 测试
- [x] 20.3 实现 Smoke 测试
- [x] 20.4 实现证据收集
- [x] 20.5 CI 集成

---

## 里程碑

| 里程碑 | 阶段 | 目标日期 | 状态 |
|---|---|---|---|
| MVP 内核 | Phase 1-6 | 2026-04-27 | ✅ 已完成 |
| 运行时闭环 | Phase 7-14 | 2026-04-27 | ✅ 已完成 |
| 持久化 + 修复 | Phase 15-16 | 2026-04-28 | ✅ 已完成 |
| CLI 仲裁 | Phase 17 | 2026-04-28 | ✅ 已完成 |
| TaskGraph | Phase 18 | 2026-04-28 | ✅ 已完成 |
| 高级特性 | Phase 19-20 | 2026-04-28 | ✅ 已完成 |

---

## 资源需求

| 角色 | Phase 15-16 | Phase 17-18 | Phase 19-20 |
|---|---|---|---|
| TypeScript 工程师 | 2 人周 | 3 人周 | 2 人周 |
| QA / 自动化 | 0.5 人周 | 1 人周 | 1 人周 |
| 产品 / 设计 | 0.25 人周 | 0.5 人周 | 0.5 人周 |

---

## 风险与缓解

| 风险 | 影响 | 概率 | 缓解措施 |
|---|---|---|---|
| 持久化性能瓶颈 | 高 | 中 | 使用 JSONL 增量写入，定期压缩 |
| CLI 仲裁 UX 复杂 | 中 | 中 | 先做 TUI，后做 GUI |
| TaskGraph 模型过重 | 中 | 中 | 先做 metadata graph，后做 full context |
| 真实宿主行为变化 | 高 | 低 | 建立 compatibility matrix + canary |

---

## 附录：文件索引

| 文件 | 说明 |
|---|---|
| `docs/dgp-implementation-report.md` | 实现报告 |
| `docs/codex_router_dynamic_governance_evolution_plan.md` | 演进计划（已更新） |
| `docs/codex_router_dynamic_governance_tutor_guide.md` | 补习手册 |
| `packages/*/src/index.ts` | 7 个新包源码 |
| `tests/*.test.ts` | 7 个新测试文件 |

---

**下一步行动：**
1. ~~执行 Phase 16 (2h) - 修复 build 错误~~ ✅ 已完成
2. ~~执行 Phase 15 (16h) - 持久化存储~~ ✅ 已完成
3. ~~执行 Phase 17 (8h) - CLI 仲裁工具~~ ✅ 已完成
4. ~~执行 Phase 20 (16h) - 真实宿主集成~~ ✅ 已完成
5. ~~执行 Phase 18 (20h) - TaskGraph 实现~~ ✅ 已完成
6. ~~执行 Phase 19 (12h) - 渐进式放权~~ ✅ 已完成
