总评

codex-router 现在不是一个成熟的通用 LLM Router，也不是 LiteLLM / OpenRouter 那类 AI Gateway。它真正有价值的地方，是更窄、更锋利：

它像 Codex Desktop / Codex CLI 之上的“治理内核”：负责分类、路由、审批、预检、记忆健康、审计、checkpoint、live adapter。

这个方向是对的，而且比普通“模型转发器”更有战略味道。
但现在它还停在 V1 集成型 SDK / 架构样机，距离生产级平台还差一层：真实执行环境验证、动态路由数据、模型健康感知、成本/延迟优化、发布与生态包装。

我的综合评分：

维度	分数	评价
架构方向	8.2 / 10	方向清晰，治理层定位有差异化
TypeScript / schema 严谨度	8.0 / 10	严格 TS、Zod、协议边界不错
代码可维护性	6.8 / 10	模块多，职责清楚，但已有膨胀迹象
测试与 CI	7.2 / 10	覆盖面比早期项目好，但缺真实端到端
安全治理	6.5 / 10	意识很好，执行强度还不够
模型路由智能度	4.5 / 10	目前主要是规则路由，不是智能路由
开源成熟度	3.5 / 10	无 release、无明显 license、生态入口弱
综合	6.8 / 10	好胚子，不是成品；刀形已现，刃还没开

仓库目前是公开仓库，GitHub 页面显示 9 个 commits、0 stars、0 forks、无 releases，语言占比主要是 TypeScript 96.6% 和 JavaScript 3.4%。这说明它更像刚冻结的 V1 快照，而不是已经被外部生态验证过的库。

我看到的核心架构

README 对项目的定义很明确：codex-router 是一个 Desktop-first policy SDK for Codex，它假设 Codex Desktop 已经提供执行运行时，而它补上治理层：任务分类、模型路由、执行 profile、审批 gate、升级/熔断、desktop bridge planning、checkpoint 与 audit helper。

仓库拆了很多包：contracts、intent-gate、routing-engine、approval-gate、desktop-decision-runner、desktop-live-adapter、preflight、observability、codex-memory-*、checkpoint-*、validation-arbiter 等。这种拆法说明作者想做的是“可组合治理系统”，不是单文件玩具 router。

主流程大致是：

TaskEnvelope
  ↓
classifyIntent
  ↓
routeTask
  ↓
runPreflight
  ↓
evaluateApprovalRequirement
  ↓
createDesktopExecutionPlan
  ↓
planAgentStrategy
  ↓
checkpoint / audit / observability
  ↓
desktop-live-adapter 执行

README 也明确写了 runner 会连接 classifyIntent、routeTask、runPreflight、evaluateApprovalRequirement、createDesktopExecutionPlan、planAgentStrategy，并返回 blocked_preflight、blocked_approval、ready 三种状态。

亮点
1. 不是“聊天代理”，而是治理层

这是它最珍贵的地方。很多项目一上来就想做 Agent，但 codex-router 更像是在做 Agent 之前的“交通灯、闸门、黑匣子和调度台”。这比盲目堆 agent 更稳。

它的 V1 协议表面包括 TaskEnvelope 和 RoutingDecision，并要求通过 parseTaskEnvelope()、parseRoutingDecision() 规范化输入输出。这个设计让后续审计、回放、测试、host 接入都更容易。

2. 类型系统和依赖控制不错

package.json 里依赖非常少，主要是 yaml 和 zod，dev 依赖是 TypeScript、tsx、Node 类型。tsconfig 开了 strict、noUncheckedIndexedAccess、exactOptionalPropertyTypes，这说明项目没有靠动态魔法硬撑，而是在尽量把边界写清楚。

3. 测试数量不像空壳

tests/ 里覆盖了 approval gate、audit memory、checkpoint、codex memory、desktop decision runner、desktop live adapter、entropy risk、observability、policy config、preflight、routing engine、state manager、strategy router、task graph、validation arbiter 等。不是只有两个 smoke test 装样子。

CI 也跑了 Node 20 / 22 的 typecheck、build、test、canary、smoke-contract 和 evidence collection。这个基础比很多早期个人仓库要好。

4. 安全治理意识强

routing-policy.yaml 已经把 task class 映射到模型、tool policy、execution profile、host route、approval rule、memory health pack、telemetry alert preset。它不是只问“用哪个模型”，而是把“这个任务能不能做、怎么做、谁批准、需要什么记忆健康、需要多少 telemetry”一起考虑。

这点很重要。真正的 Agent 系统，死的往往不是模型能力，而是边界失控。

主要问题
1. “Router”目前还不够智能，更多是静态策略表

intent-gate 的分类逻辑现在主要靠关键词：比如 auth、permission、secret、production、migration、delete 判高风险，release、merge、push、main 判 release，explain、review、summarize、read 判 read-only。它简单、可测试，但也脆：英文依赖强、容易 substring 误判，对中文任务基本没有天然稳健性。

routing-engine 里真正的模型选择也是从 policy 里按 task class 取模型：getTaskValue(policy.models, taskClass, "model")。风险评分同样主要扫描 summary / requestedAction 里的关键词，比如 production、migration。这不是坏事，但它现在是规则路由，还不是性能/成本/延迟/成功率驱动的智能路由。

一句狠话：
如果这个项目继续停在关键词 + 静态 YAML，它会是一个漂亮的 policy demo，不会成为真正的 router。

2. Preflight 还像 checklist，不像强制安全边界

runPreflight 会检查 authAvailable、required tools 是否存在，并把 dirty workspace、protected branch 对非 read-only 任务标为 warning。它也会把 memory blocking issues 推到 errors。这个结构很好，但对写操作而言，“脏工作区”和“受保护分支”只 warning，实际风险还需要 host 强执行。

也就是说：
SDK 现在能提醒危险，但真正拦刀的人还是 host。
这需要在文档和接口里写得更冷酷：哪些由 SDK 判定，哪些必须由 host sandbox / permission system 强制执行。

3. 模型名硬编码会快速老化

当前 routing-policy.yaml 里写了 gpt-5.4-mini、gpt-5.3-codex-spark、gpt-5.3-codex、gpt-5.1-codex-max 等模型映射。官方 Codex 文档现在建议多数 Codex 任务优先用 gpt-5.5，不可用时用 gpt-5.4，轻任务可用 gpt-5.4-mini；同时 Codex 模型页列出 gpt-5.3-codex 和 research preview 的 gpt-5.3-codex-spark。

官方模型列表还显示 GPT-5.1-Codex-Max 已处于 deprecated 相关标记路径；单独模型页也显示它是 Responses API-only，并在 snapshot 区域标注 deprecated。你的策略文件如果继续把这类模型写死，就会被模型生命周期拖着走。

建议：把 model id 从 policy 常量升级成 ModelRegistry + capability query + deprecation resolver。
model:check 脚本已经在 package.json 里出现了，但它必须进入 CI 的硬门槛，而不是可选动作。

4. Telemetry 设计丰富，但 runner 持久化链路不够闭合

DesktopDecisionRunnerInput 的 persistence 里有 telemetryStore?: TelemetrySink，runner result 也返回 observabilityEvents。但是 persistRunnerArtifacts() 只记录 checkpoint、memory checkpoint 和 audit events，没有把 observability events 发到 telemetryStore。

README 说 host 可以把这些 events forward 到 telemetry sink，这也许是刻意设计；但从生产工程角度看，这里容易造成“以为接了 telemetry，其实 runner 没发”的误会。live adapter 里倒是会把 telemetryStore 带入 adapter input，并做 telemetry gate。

建议二选一：
要么 runner 明确自动 emit telemetry；要么把字段改名/文档写死：runner only returns events, host must forward。

5. Live adapter 有用，但开始变重

desktop-live-adapter 负责把 ready 的 execution plan 交给 host-provided primitive handlers 或 bridge 执行；没有 handler 或 bridge 会抛 desktop_live_adapter_requires_handlers_or_bridge。这条边界很好：SDK 决定“该做什么”，host 决定“怎么真实执行”。

但执行逻辑是按 for ... entries() 顺序跑 primitives，默认 stopOnFailure = true，失败后 checkpoint / audit / governance 都在同一个大模块里流动。安全上稳，扩展上容易重。

建议拆成三个层：

execution-core       // primitive execution only
execution-recovery   // failure / retry / governance
execution-telemetry  // audit / checkpoint / observation

否则后面并发、取消、超时、retry、rollback 一加，这个模块会变成雾。

横向对比：它站在哪
LiteLLM

LiteLLM 是成熟 AI Gateway：支持 100+ LLM providers，用 OpenAI 格式统一调用，还包含 cost tracking、guardrails、load balancing、logging、admin/dashboard 等。GitHub 页面显示它有 45k+ stars、7k+ forks、上千 release，成熟度和生态不是 codex-router 当前能比的。

LiteLLM 的 router 文档列出 weighted pick、rate-limit aware、latency-based、least-busy、custom、lowest-cost 等策略。相比之下，codex-router 当前没有真正的部署健康、成本、延迟、TPM/RPM、provider fallback 路由。

结论：
不要和 LiteLLM 正面打 AI Gateway。你应该把 LiteLLM 当下游 provider layer，自己做上游 policy brain。

OpenRouter

OpenRouter 的 provider routing 直接支持按 price、throughput、latency 排序，也能设 preferred throughput / latency threshold，用更便宜的模型/供应商满足性能下限。它的核心是生产调用层：便宜、快、可 fallback。

codex-router 的优势不在 provider routing，而在 Codex Desktop / agent execution governance。
也就是说：OpenRouter 管“请求去哪”，codex-router 应该管“这个任务能不能动手、该以什么治理等级动手”。

RouteLLM

RouteLLM 是更正宗的“智能 LLM 路由”项目：它提供 serving / evaluating LLM routers，并声称可把简单 query 路由到便宜模型，在 benchmarks 上保持质量同时降低成本。GitHub README 写到它有 trained routers、benchmarking，并展示降低成本的结果；项目也有几千 stars。

RouteLLM 论文在 ICLR 2025 发表，核心是用 human preference data 训练 router，在强/弱模型之间动态选择，目标是成本与质量平衡；论文摘要写到可在不牺牲质量的情况下把成本降低超过 2 倍，并且 router 对未训练模型组合也有泛化。

结论：
如果 codex-router 想名副其实地成为 router，RouteLLM 是必须学习的路线。

FrugalGPT

FrugalGPT 是另一条重要路：不是一次性选择一个模型，而是做 cascade。先调用便宜模型，再用 judge/threshold 判断是否需要升级到更强模型。TMLR 版论文描述了顺序调用 LLM、超过阈值即停止的机制，并报告在匹配最佳单模型性能时可节省最高 98% 推理成本，或在相同成本下提升性能。

结论：
codex-router 现在只有“选择模型”，还没有“低成本试探 → 不够再升级 → 审计升级原因”的 cascade。
这正是下一代该补的骨头。

LangGraph / AutoGen

LangGraph 是 stateful agent orchestration 框架，强调构建、管理、部署长期运行的有状态 agents。AutoGen 是多 agent 应用框架，但它的 README 当前标注 maintenance mode，并建议新用户转向 Microsoft Agent Framework。

这说明 agent 编排层已经很拥挤。
codex-router 最好不要变成另一个 LangGraph，而是成为：

Agent / Codex / LangGraph / AutoGen 上方或旁边的治理层

更具体地说：别人负责编排智能，你负责允许、约束、记录、回滚、审计。

OpenAI Codex 本身

OpenAI 对 Codex 的描述是跨平台本地软件 agent，核心是 agent loop：模型推理、工具调用、观察结果、继续迭代。Codex CLI 通过 Responses API 做模型推理，并且 sandbox/approval 只覆盖 Codex 自带 shell 工具；其他 MCP 工具要自己负责 guardrails。

这正好给了 codex-router 一个位置：
它可以成为 Codex 外围的 policy sidecar，专门弥补 MCP、host bridge、memory、approval、telemetry 之间的治理空隙。

最应该优化的方向
第一优先级：把“规则 router”升级为“可评估 router”

现在 routeTask() 是静态 policy lookup。下一步应该引入 RoutingCandidate 和 RoutingOutcome：

type RoutingCandidate = {
  model: string;
  provider?: string;
  expectedCost?: number;
  expectedLatencyMs?: number;
  capabilityTags: string[];
  riskAllowed: boolean;
};

type RoutingOutcome = {
  taskId: string;
  selectedModel: string;
  tokensIn: number;
  tokensOut: number;
  latencyMs: number;
  costUsd?: number;
  success: boolean;
  userAccepted?: boolean;
  testsPassed?: boolean;
  approvalRequired: boolean;
  rollbackRequired?: boolean;
};

然后建立离线 replay：

历史任务 → 多个 routing policy → 比较成功率 / 成本 / 延迟 / 审批次数 / rollback 次数

没有 eval 的 router，最后都会变成玄学。

第二优先级：做 Intent Classifier V2

当前 keyword classifier 可以保留为 deterministic fallback，但主分类器应升级为：

rules + multilingual tokenizer + structured feature extraction + calibrated classifier

必须支持中文任务。否则你自己日常用中文描述项目时，它会把大量任务归类得很粗糙。

建议新增测试集：

read_only.zh
small_edit.zh
engineering.zh
release.zh
ambiguous.zh
adversarial.zh

每类至少 50 条。
目标不是追求花哨，而是让系统知道自己什么时候不确定。

第三优先级：ModelRegistry，不要让 YAML 追着模型跑

加一个模型注册表：

interface ModelRegistry {
  resolve(alias: string): Promise<ModelResolution>;
  listCapabilities(model: string): Promise<ModelCapabilities>;
  isDeprecated(model: string): Promise<boolean>;
}

然后 policy 不写死模型，而写：

models:
  read_only:
    capability: fast_low_cost_coding
    fallback: gpt-5.4-mini
  engineering:
    capability: complex_agentic_coding
    fallback: gpt-5.5

这样模型变化时，policy 不会像落叶一样被风吹散。

第四优先级：把 safety 从 warning 推到 enforcement

建议把 preflight 的风险分级改成：

info
warn
block
requires_approval
requires_sandbox
requires_clean_workspace
requires_checkpoint

对 protected branch + write access，不应该默认只是 warning。至少应该可以由 policy 指定：

workspace:
  dirtyOnWrite: block
branch:
  protectedOnWrite: requires_approval
  protectedRemote: block_without_explicit_release

安全系统如果只会温柔提醒，就会被第一次真实事故教育。

第五优先级：产品化开源入口

现在仓库没有 release，package.json 还是 private: true，GitHub 也显示 no releases published。

要把它变成别人能用的项目，至少需要：

LICENSE
CHANGELOG
public npm package or clear install path
API reference
minimal host integration example
one-page architecture diagram
versioned protocol docs

还有一句很实在：
README 现在像工程记录，不像外部开发者入口。

进化规划
0–2 周：先把地基打直

目标：从“我能看懂”变成“别人能接入”。

做这些：

1. 增加 LICENSE
2. 取消 private 或解释为什么 private
3. 发布 v0.1.0 release
4. 把 model:check 纳入 CI
5. 增加 eslint / prettier / coverage / CodeQL 或 Semgrep
6. 给 README 加 5 分钟 quickstart
7. 明确 telemetryStore 到底是 runner 自动发送，还是 host 手动 forward

CI 现在已经有 typecheck/build/test/canary/smoke/evidence，但 Codex CLI smoke 在 GitHub Actions 里被注释掉，因为 runner 没有 Codex CLI binary。这可以理解，但需要补一个 mock Codex CLI 或 containerized smoke，否则“真实执行链”没有被 CI 锁住。

2–6 周：把治理规则变硬

目标：让它从“会提醒”变成“敢拦截”。

做这些：

1. Intent Classifier V2
2. 中文/英文/模糊任务测试集
3. protected branch 写操作 policy 化
4. host capability attestation
5. workspace safety policy
6. approval decision explainability
7. audit event schema freeze

这一步做完，它才像一个真正的 gate。

6–12 周：引入真实 RouterEval

目标：从“我觉得该用这个模型”变成“数据证明该用这个模型”。

做这些：

1. 收集任务 outcome telemetry
2. 建立 replay benchmark
3. 比较 static policy / cost policy / latency policy / learned policy
4. 引入 cascade：cheap model → judge → strong model
5. 加 cost / latency / success SLO
6. 生成 policy diff 建议，但必须人工批准

这里可以借鉴 RouteLLM 的 preference-data routing，也可以借鉴 FrugalGPT 的 cascade 思路。RouteLLM 强在“训练 router 选择强弱模型”，FrugalGPT 强在“用阈值级联节省成本”。

3–6 个月：成为 Codex Governance Sidecar

目标：不要做“又一个 router”，而是做 Codex 旁边的控制塔。

架构应变成：

User Task
  ↓
codex-router policy kernel
  ↓
ModelRegistry / LiteLLM / OpenRouter
  ↓
Codex CLI / Desktop Host / MCP Host
  ↓
Execution telemetry
  ↓
Outcome learning
  ↓
Policy suggestion
  ↓
Human approval

这时你可以接 LiteLLM 做多 provider gateway，接 OpenRouter 做 provider fallback / price / latency routing，自己保留 task governance、approval、audit、checkpoint、recovery 这条护城河。LiteLLM 和 OpenRouter 已经覆盖了 provider routing 的很多成熟能力，没有必要重复造那层铁轨。

6–12 个月：进化成 Agent Governance OS

最终形态应该不是“router”，而是：

Agent Governance OS

它应该能回答：

这个任务是什么风险？
应该用哪个模型？
能不能写文件？
能不能碰远端？
需要谁批准？
失败后如何恢复？
是否需要 checkpoint？
是否需要 telemetry？
上次类似任务成功了吗？
这次 policy 是否应该调整？

到那一步，它才真正从“路由器”长成“神经中枢”。

最后一句实话

这个仓库的最大优点，是方向不俗。
它没有沉迷在“让 agent 更会说话”，而是在做更难、更脏、更接近真实系统的东西：治理、边界、审批、记忆、审计、恢复。

但最大弱点也清楚：
现在的 router 还没有学习能力，没有 outcome 数据，没有真实成本/延迟/成功率闭环。

所以我给它的定位是：

一个有战略潜力的 Codex 治理 SDK 雏形；
还不是成熟的智能路由平台。

下一刀应该砍向这里：
把静态 policy 变成可评估、可学习、可回放、可审计的 policy engine。
