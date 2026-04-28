# codex-router DGP 动态治理实施路线图

> 创建日期：2026-04-27
> 当前版本：v2.1-dgp-rc
> 当前状态：**Phase 1-21.2 完成，Phase 21.3-21.6 待实施**
> 测试状态：379 pass / 0 fail
> 包数量：34 个
> 测试文件：38 个

---

## 总览

```
Phase 1-6   ████████████████████ 100% 治理内核包
Phase 7-9   ████████████████████ 100% 既有包增强
Phase 10-14 ████████████████████ 100% 运行时闭环 + 验证
Phase 15-16 ████████████████████ 100% 持久化 + 修复
Phase 17-18 ████████████████████ 100% CLI 工具 + TaskGraph
Phase 19-20 ████████████████████ 100% 高级特性
Phase 21    ██████░░░░░░░░░░░░░░  33% 运行时加固 (21.1-21.2 完成)
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

**小计：7 个新包，3 个增强包**

---

## 已完成阶段 (Phase 15-20)

| 阶段 | 名称 | 状态 | 测试数 | 交付物 |
|---|---|---|---|---|
| Phase 15 | 持久化存储 | ✅ 完成 | 7 | FileCheckpointLedgerStore + FileObservationStore |
| Phase 16 | 修复 Build 错误 | ✅ 完成 | - | z.input<> 参数类型修正 |
| Phase 17 | CLI 仲裁工具 | ✅ 完成 | 3 | arbitrate CLI 命令 |
| Phase 18 | TaskGraph 实现 | ✅ 完成 | 14 | TaskGraph 类型 + 回滚 + 合并 + Store |
| Phase 19 | 渐进式放权 | ✅ 完成 | 16 | delegation-policy + historicalTrust 映射 |
| Phase 20 | 真实宿主集成 | ✅ 完成 | - | Canary + Evidence + CI |

**小计：PR #1 已合并 (d345802)，356→357 测试通过**

---

## 当前阶段 (Phase 21: 运行时加固)

> Issue: https://github.com/JENN2046/codex-router/issues/2
> 分支: feature/phase-21-runtime-hardening
> PR: https://github.com/JENN2046/codex-router/pull/3

### Phase 21.1: Desktop Live Adapter 治理集成测试 ✅

| 属性 | 详情 |
|---|---|
| **目标** | 为 desktop-live-adapter 失败路径添加治理更新回归覆盖 |
| **交付物** | `tests/desktop-live-adapter-governance.test.ts` |
| **验收** | 测试失败时能捕获 handler 失败路径停止更新治理状态 |

**任务分解：**
- [x] 21.1.1 missing handler → 更新 governanceState
- [x] 21.1.2 handler 返回 ok:false → 更新 governanceState
- [x] 21.1.3 handler throw → 更新 governanceState (gap 已关闭)
- [x] 21.1.4 repeated execution_failure → strikeNumber 递增 (1→2→3)
- [x] 21.1.5 onGovernanceUpdate 回调被正确调用
- [x] 21.1.6 高风险 + 3 次 strike → step_back / arbitration_required
- [x] 21.1.7 无 governanceState 时不调用 onGovernanceUpdate
- [x] 21.1.8 成功执行不触发 governance 更新
- [x] 21.1.9 thrown string / thrown object → errorClass 归一化

**测试数：11**

---

### Phase 21.2: 治理失败 Reducer ✅

| 属性 | 详情 |
|---|---|
| **目标** | 提取共享失败处理逻辑为纯 reducer，消除 desktop-live-adapter 分支间重复 |
| **交付物** | `packages/governance-failure-reducer/src/index.ts` |
| **验收** | desktop-live-adapter 不再重复 anomaly/risk/strategy 逻辑 |

**任务分解：**
- [x] 21.2.1 设计 `applyExecutionFailureToGovernanceState()` 签名
- [x] 21.2.2 实现 reducer（anomaly + strike + risk + strategy + arbitration packet）
- [x] 21.2.3 替换 desktop-live-adapter 三条 failure path 为 reducer 调用
- [x] 21.2.4 关闭 handler throw 路径的治理更新 gap
- [x] 21.2.5 添加 normalizeThrownError() 错误归一化
- [x] 21.2.6 Reducer 单元测试 (11 个)
- [x] 21.2.7 清理 desktop-live-adapter 多余 import

**新增包：** `@codex-router/governance-failure-reducer`
**测试数：11 (reducer) + 11 (integration) = 22**

---

### Phase 21.3: TaskGraph 分支归属 v2 🔴 P1

| 属性 | 详情 |
|---|---|
| **目标** | TaskGraph 节点/边增加显式 branchId 归属元数据 |
| **交付物** | branchId / originBranchId / mergedFromBranchIds 字段 |
| **验收** | mergeBranch 能区分 source-only 和 target-owned 图元素 |

**任务分解：**
- [ ] 21.3.1 设计节点/边 branchId 字段及迁移方案
- [ ] 21.3.2 更新 TaskGraphNodeSchema / TaskGraphEdgeSchema
- [ ] 21.3.3 更新 mergeBranch 实现 keep_source / keep_target 语义
- [ ] 21.3.4 向后兼容测试
- [ ] 21.3.5 Schema 迁移文档

---

### Phase 21.4: Recovery 结果契约 🔴 P1

| 属性 | 详情 |
|---|---|
| **目标** | step-back / lockdown 向宿主暴露可操作的恢复数据 |
| **交付物** | DesktopLiveExecutionResult.governance 扩展 |
| **验收** | 宿主可展示 arbitration packet / 可用恢复动作 |

**任务分解：**
- [ ] 21.4.1 设计 governance 扩展字段
- [ ] 21.4.2 更新 DesktopLiveExecutionResult 类型
- [ ] 21.4.3 step-back / abort 路径填充 governance 数据
- [ ] 21.4.4 向后兼容测试

---

### Phase 21.5: VCPToolBox AI Image Agent 字段验证附录 🟡 P2

| 属性 | 详情 |
|---|---|
| **目标** | 记录 DGP 模式在 VCPToolBox AI Image Agent 中的应用经验 |
| **交付物** | `docs/dgp-field-validation-vcptoolbox-ai-image-agent.md` |
| **验收** | 不拷贝业务代码，仅记录治理架构映射 |

**任务分解：**
- [ ] 21.5.1 state / safety / audit / executor / adapter / route 映射
- [ ] 21.5.2 dry-run → 真实执行 gate 设计
- [ ] 21.5.3 依赖注入作为安全边界
- [ ] 21.5.4 env flags + allowlist + audit 实践
- [ ] 21.5.5 运行时 artifact 清理经验

---

### Phase 21.6: 宿主 Smoke 策略 🟡 P2

| 属性 | 详情 |
|---|---|
| **目标** | 定义可持续的 smoke 策略（CI 无 Codex CLI binary） |
| **交付物** | smoke 策略文档 + contract smoke 实现 |
| **验收** | CI 确定性，真实宿主 smoke 不阻塞普通 PR |

**任务分解：**
- [ ] 21.6.1 评估 mock Codex binary / contract smoke 方案
- [ ] 21.6.2 实现 smoke:contract CI job
- [ ] 21.6.3 文档化 CI smoke / local smoke / real host smoke 分离

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
| P0 运行时加固 | Phase 21.1-21.2 | 2026-04-28 | ✅ 已完成 (PR #3) |
| P1 结构治理正确性 | Phase 21.3-21.4 | 待定 | ⏳ 未开始 |
| P2 字段验证 + Smoke | Phase 21.5-21.6 | 待定 | ⏳ 未开始 |

---

## 进度统计

| 指标 | Phase 1-20 | Phase 21.1-21.2 | Phase 21.3-21.6 | 总计 |
|---|---|---|---|---|
| 新增包 | 10 | 1 (governance-failure-reducer) | 0 | 11 |
| 增强包 | 3 | 1 (desktop-live-adapter) | 待定 | 4+ |
| 测试数 | 357 | 22 | 待定 | 379+ |
| 测试文件 | 36 | 2 | 待定 | 38+ |

**当前包总数：34**
**当前测试文件：38**
**当前测试数：379 pass / 0 fail**

---

## 风险与缓解

| 风险 | 影响 | 概率 | 缓解措施 |
|---|---|---|---|
| 持久化性能瓶颈 | 高 | 中 | 使用 JSONL 增量写入，定期压缩 |
| CLI 仲裁 UX 复杂 | 中 | 中 | 先做 TUI，后做 GUI |
| TaskGraph 分支归属迁移 | 中 | 中 | branchId 可选字段 + 向后兼容默认值 |
| 真实宿主行为变化 | 高 | 低 | 建立 compatibility matrix + canary |
| handler throw 非 Error 类型 | 中 | 已缓解 | normalizeThrownError() 归一化 |

---

## 附录：文件索引

| 文件 | 说明 |
|---|---|
| `docs/dgp-implementation-report.md` | 实现报告 (归档) |
| `packages/governance-failure-reducer/src/index.ts` | 治理失败 reducer |
| `tests/desktop-live-adapter-governance.test.ts` | 治理集成测试 |
| `tests/governance-failure-reducer.test.ts` | Reducer 单元测试 |
| `packages/*/src/index.ts` | 34 个包源码 |
| `tests/*.test.ts` | 38 个测试文件 |

---

**下一步行动：**

1. ~~Phase 21.1-21.2 P0 运行时加固~~ ✅ 已完成 (PR #3)
2. Phase 21.3 TaskGraph 分支归属 v2 — 待实施
3. Phase 21.4 Recovery 结果契约 — 待实施
4. Phase 21.5 VCPToolBox 字段验证附录 — 待实施
5. Phase 21.6 宿主 Smoke 策略 — 待实施
