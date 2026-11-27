# 简历创建与优化交互调整方案（实施记录）

## Context

当前“我的简历”将 AI 生成、JSON 导入、新建简历分为三个入口，而文件导入又藏在新建弹窗内；编辑器另有会覆盖当前内容的导入功能。用户不容易判断应该从哪里开始，也不容易理解“JD 匹配优化”等术语。

本次目标：将四种方式明确为“创建一份新简历”的不同途径，把 AI 表单生成改为聊天收集信息后由用户主动制作，并统一易懂的文案。按阶段逐步调整、实施；阶段 1、2 已实施，阶段 3 已按用户指示接入聊天采集和手动制作，真实模型与真实资料仍需人工联调。

## 一、推荐交互

### 1. 一个总入口，四种创建方式

“我的简历”顶部保留一个带文字的主按钮：**新建简历**。点击后选择创建方式，而不是先让用户理解 AI、JSON 等技术概念。

| 用户看到的方式 | 辅助说明 | 是否需要 AI |
| --- | --- | --- |
| 和 AI 聊天制作 | 说说你的经历，AI 帮你整理成简历 | 是 |
| 选模板创建 | 选一个样式，从空白内容开始填写 | 否 |
| 导入已有简历 | 上传 PDF 或图片，识别内容后重新排版 | 是 |
| 导入平台备份 | 导入从本平台导出的 JSON，保留内容和样式 | 否 |

桌面端按“从头开始 / 已有资料”分为两组、每组两张卡片；手机端纵向排列，图标旁始终保留方式名称。下一步提供“返回选择方式”，不叠加多个弹窗。

```text
新建简历
  从头开始
    [ 和 AI 聊天制作 ]  [ 选模板创建 ]
  已有资料
    [ 导入已有简历 ]    [ 导入平台备份 ]
```

四条路径最终均为：**确认创建 → 新建独立简历 → 进入同一个编辑器继续修改**，均不覆盖已有简历。模板创建保持空白内容，不把预览示例写入真实简历。

沿用现有品牌色、字体、按钮与卡片组件，不做整站视觉改版；用分组标题和具体说明区分用途。首次无简历时也提供同一个“新建简历”入口，不再单独引导旧 AI 表单。

### 2. 聊天制作

- 替换现有 AI 生成表单，先聊天，不预先创建空简历。默认使用经典模板和当前界面语言，制作后可在编辑器修改，不增加必须先选模板的步骤。
- 一次询问 1～2 个问题；允许用户一次粘贴整段经历，已提供的信息不重复询问。
- 聊天区显示已收集的信息和待补充内容；“制作简历”位于聊天消息区上方，滚动聊天时仍可见。
- 信息不足时按钮置灰，并说明还缺什么；信息达到门槛后启用，用户可以继续聊，也可以立即点击制作。
- 点击后才把已确认的信息转换为简历 JSON、校验、创建新简历并进入编辑器，不要求用户查看或复制 JSON。
- 不编造姓名、学校、任职公司、时间、业绩数字等事实；缺少内容留空，用户可以进入编辑器补充。
- 生成失败保留聊天和已收集信息，允许重试；生成中禁用重复点击。
- **已确认最低门槛**：获得称呼和求职目标即可启用“制作简历”；联系方式、教育、工作、项目、技能等均可后补，不作为强制门槛。称呼可用用户自选名称，不要求真实姓名或敏感个人信息；求职目标可以是岗位或求职方向。AI 可以继续询问，但不能因此阻止制作。
- **已确认关闭策略**：用户已发送消息或输入未发送文字时，关闭需提示“关闭后聊天内容将清空”；确认关闭即清空，不做本机草稿或会话持久化。未开始对话可直接关闭。返回方式选择也按离开聊天处理；打开 AI 设置不算用户主动退出，配置后返回原步骤。

```text
← 返回选择方式              和 AI 聊天制作         关闭
已了解：称呼 ✓  求职目标 ✓          [ 制作简历 ]
信息已够制作，你也可以继续补充经历；其他内容可在编辑器填写。
------------------------------------------------------
AI：你希望怎么称呼？准备找什么岗位？
我：……
AI：……
------------------------------------------------------
[ 输入你的经历或回答问题……                 ] [发送]
```

按钮状态：缺少称呼/求职目标 → 置灰并列出缺项；两项都有且 AI 已回复完成 → 可用；AI 回复中 → 暂不可用；点击后 → “正在制作…”；失败 → 恢复可用并保留对话；成功 → 进入编辑器。普通 AI 回复中可确认离开并取消请求，迟到响应不得恢复已清空状态；点击制作后，从结构化生成、校验到写入完成期间统一禁用关闭/返回/重复操作，避免退出后仍意外创建。未发送的输入先发送或清空后才允许制作，避免遗漏用户最后一次补充。

### 3. 普通人能理解的岗位优化文案

建议入口用 **按岗位优化**，完整弹窗标题用 **根据岗位优化简历**，说明用“粘贴招聘要求，帮你突出相关经历，调整简历表达”。

仅调整面向用户的名称与说明，不改动现有岗位分析和生成优化版的业务能力；按钮、结果、来源提示和中英文文案保持一致。建议具体替换：

| 现有文案 | 调整后 |
| --- | --- |
| JD 匹配优化（工具栏） | 按岗位优化 |
| JD 匹配优化（弹窗） | 根据岗位优化简历 |
| 分析其他 JD | 分析其他岗位 |
| 生成 JD 优化简历 | 生成岗位优化版 |
| JD 优化（标签） | 岗位优化版 |
| JD 摘要 | 岗位要求摘要 |
| ATS 评分 | 招聘系统友好度（ATS） |
| 当前为派生简历，不会修改主简历 | 这是按岗位生成的优化版，原简历保持不变 |

### 4. 编辑器移除导入

同时移除桌面工具栏与手机“更多”菜单的导入入口，解除编辑页导入弹窗挂载。保留导出、头像上传及正常编辑功能。需要导入时回到“我的简历 → 新建简历”。

### 5. 平台备份导入

**已确认采用与模板创建相同的交互**：选择 JSON → 读取内容 → 显示名称输入与模板选择 → 默认选中 JSON 内的模板 → 点击“创建简历” → 新建并进入编辑器。名称默认取 JSON 标题，可修改；不要求用户重新填写内容。

未更换模板时保留原有主题配置；更换模板时沿用编辑器现有切换模板规则，不另创一套样式处理。使用新的简历及模块 ID，保留内容、排序、显隐和语言；不沿用原用户、分享关系或数据库 ID，不覆盖其他简历。

文件导入与平台备份导入分开说明：前者只识别内容并重新排版，后者还原本平台已有数据和样式。平台备份不消耗 AI，界面保留“本平台 JSON”格式提示，避免被误认为任意 JSON 都能导入；导出的 JSON 格式说明同步写明“平台备份，可再次导入”。

现有文件导入仅支持 PDF、PNG、JPG/JPEG、WebP，最大 10 MB，本轮不增加 Word 支持。

## 二、代码现状与复用点

- `src/app/[locale]/dashboard/page.tsx`：目前三个创建相关入口及弹窗挂载，需要统一入口和引导。
- `src/components/dashboard/create-resume-dialog.tsx`：已有模板选择、文件上传、AI 配置后返回，可复用，不重写模板库。
- `src/components/dashboard/import-json-dialog.tsx`：已调用 `POST /api/resume` 创建新简历，但未传递 `language`，成功后固定等待 1 秒再跳转，需统一完成体验。
- `src/app/api/resume/route.ts`：模板新建与 JSON 导入已经共享创建接口；服务端重新生成简历与模块 ID。
- `src/hooks/use-resume.ts`：已有创建及列表更新能力，可用于统一创建后的状态处理。
- `src/components/editor/editor-toolbar.tsx`、`src/app/[locale]/editor/[id]/page.tsx`：桌面、移动导入入口及弹窗挂载位置。
- `src/hooks/use-ai-chat.ts:28`、`src/app/api/ai/chat/route.ts:61`：现有聊天为已存在简历的编辑服务，附带保存、回载、编辑工具和最近 10 轮截断；创建前聊天只复用供应商调用方式，不直接套用编辑 hook 或会话表。
- `src/lib/ai/provider.ts`、`src/stores/settings-store.ts`：复用 `extractAIConfig/getModel/getJsonProviderOptions`、`getAIHeaders/hasCompleteAIConfig`；沿用现有多供应商和用户选择的模型，不做 Claude SDK/模型迁移。
- `src/app/api/ai/generate-resume/route.ts:27`：已有生成后落库链路，但旧提示词主动虚构姓名、公司和学校，且输出校验局部使用 `z.any()`，不能直接用于真实聊天资料。
- `src/lib/ai/generate-resume-schema.ts`：已有六类模块输出 schema；配合 `src/lib/ai/extract-json.ts` 的 `extractJson` 与 `src/lib/resume/normalize-content.ts` 的 `normalizeSectionContent` 复用结构化处理。
- `src/stores/resume-store.ts:136`：现有 `setTemplate` 只改模板、不重置主题；JSON 模板选择遵循同样规则。
- `src/app/api/resume/[id]/export/route.ts:39`：本平台 JSON 为完整简历对象；导入仅提取创建所需字段，不直接回写完整对象。

## 三、实施阶段

每阶段可单独实施；阶段 1 与阶段 2 互不依赖，阶段 3 接入阶段 2 的统一入口。同意方案不代表必须一次执行全部阶段。

### 阶段 1：文案调整与编辑器移除导入

**目标**：先完成低耦合改动，让名称和功能边界清楚。

- [x] 岗位优化入口、弹窗标题、输入提示、操作按钮、结果及来源提示统一用普通人懂的词；内部变量、i18n key 与 API 路径不因文案修改而改名。
- [x] 移除编辑器桌面“导入”按钮、移动“更多 → 导入”和 `ImportDialog` 挂载；全仓确认没有其他引用后再删除闲置组件，不误删首页 JSON 导入或头像上传。
- [x] 不改变岗位优化生成独立版本、保留原简历的既有规则。

**涉及文件**：`src/components/editor/editor-toolbar.tsx`、`src/app/[locale]/editor/[id]/page.tsx`、`src/components/editor/import-dialog.tsx`、`src/components/editor/jd-analysis-dialog.tsx` 与 `src/components/resume/jd-derived-resume-notice.tsx`（核对使用文案，必要时改）；`messages/zh.json`、`messages/en.json` 的 `editor.toolbar.jdAnalysis`、`jdAnalysis.*`、`jdDerivedResume.*`、`landing.features.jdMatch.*`。首页功能介绍也同步更名，不扩大到招聘/模拟面试等其他模块。

**前置条件**：无。**交付**：文案与编辑器入口调整。

**状态**：已完成阶段 1 的代码调整与针对性自动化检查，未进行浏览器人工验收。另同步修改 `src/app/api/ai/jd-analysis/optimize/route.ts` 的新生成标题为“岗位优化版 / Job-Tailored Resume”；已有简历名称不迁移。

**验证**：`pnpm exec tsx scripts/test-resume-stage-one.ts` 静态回归通过；`pnpm exec vitest run src/app/api/ai/jd-analysis/optimize/route.test.ts src/lib/ai/jd-optimize.test.ts` 共 8 项通过。新增测试不需要 AI Key 或真实数据库。未运行构建。

**验收**：桌面和手机编辑器均无导入入口；现有优化流程仍正常，原简历不被改写；用户界面不再以 JD/ATS 作为主要名称。

### 阶段 2：统一四种创建方式，完善平台备份导入

**目标**：用户能按自己的资料情况选择路径，模板、文件、JSON 的创建结果一致。

- [x] 首页仅保留“新建简历”主入口；创建界面先显示四种方式，再进入所选步骤。使用一个流程容器切换内容，避免弹窗叠弹窗。
- [x] 模板方式复用已有模板缩略图和空白新建能力；名称输入明确标为“简历名称”，不再用“姓名”作占位提示。
- [x] JSON 方式先读取并校验平台数据，再显示与模板方式共用的名称输入和模板选择；默认标题、模板来自 JSON。结构错误不创建，模板已不存在时明确提示并让用户选一个现有模板，不静默丢失内容。
- [x] JSON 创建提交 `title/template/language/themeConfig/sections`，保持内容、原有排列与显隐；不导入数据库归属或分享信息。更换模板只改变模板，不主动重置主题，与 `useResumeStore.setTemplate` 一致。
- [x] 文件方式复用现有上传、10 MB 限制及解析 API；显示“识别后重新排版，不保证还原原文件样式”，支持类型写清楚，不宣称支持 Word。
- [x] 三种已存在路径创建成功均直接进入编辑器，去掉 JSON 固定等待 1 秒；返回列表可看到新简历，失败保留本步骤输入且不给成功提示。
- [x] 更新首页新手引导，替换指向旧 AI 按钮的目标；空列表与手机端均可看到有文字的创建入口。独立模板库继续保持现有快捷创建，不强制绕回选择方式。
- [x] 阶段 3 尚未实施时，“和 AI 聊天制作”位置暂时以“AI 制作（表单）”接入现有生成，不把未交付能力标成聊天；阶段 3 再替换成正式聊天入口和文案。

**涉及文件**：`src/app/[locale]/dashboard/page.tsx`、`src/components/dashboard/create-resume-dialog.tsx`、`src/components/dashboard/import-json-dialog.tsx`、`src/components/dashboard/template-thumbnail.tsx`（复用）、`src/components/resume/resume-file-upload.tsx`（复用）、`src/hooks/use-resume.ts`、`src/stores/ui-store.ts`、语言文件；仅在请求契约/校验需要时调整 `src/app/api/resume/route.ts`，不重写文件解析器。

**前置条件**：四种创建方式的推荐交互无新增调整。**交付**：统一入口、模板式 JSON 创建、保留原文件导入能力。

**验收**：模板只创建空白简历；导出一份英文 JSON 再导入后名称/语言/内容/模板/主题正确；JSON 原模板默认选中且可更换；旧简历与原 ID 不受影响；PDF/图片仍可创建；没有 AI 配置时，模板和 JSON 仍可使用，AI 路径可去配置后返回。

**状态（2026-11-27）**：阶段 2 代码与针对性验证完成。创建入口点击时结束新手引导，并取消尚未启动的引导计时，避免引导遮罩挡住创建与 AI 设置步骤。阶段 3 未实施，AI 仍为原表单和原接口。补充审查修复旧 AI 表单语言选项与接口不一致的问题：仅在此表单提供中文、英文，不影响通用语言选择器或扩展生成接口能力。

**自动化验证**：

- `pnpm exec vitest run src/lib/resume/create-schema.test.ts src/app/api/resume/route.test.ts src/components/dashboard/create-resume-flow.test.ts`：63 项通过。覆盖 11 类模块、英文/主题/排序/显隐保真、失效模板、错误结构不落库、创建字段白名单、空白模板、空模块备份、失败响应及创建流程静态契约；鉴权、数据库和上报均隔离。
- 联合运行上述测试与 `src/app/api/ai/jd-analysis/optimize/route.test.ts`、`src/lib/ai/jd-optimize.test.ts`、`src/lib/resume/normalize-content.test.ts`：共 86 项通过。
- `pnpm exec tsx scripts/test-resume-stage-one.ts`：通过；脚本改为检查统一创建流程中的备份步骤，不再要求旧独立 JSON 弹窗。
- `pnpm exec tsc --noEmit --incremental false`：通过。创建组件、schema、route、hook、store 与测试文件的定向 ESLint 通过；列表页仍有两处原有问题（视图偏好 effect 内同步 setState、数据加载 effect 缺少 authEnabled 依赖），本轮不扩改。
- 本机 Chrome / Python Playwright 已在 1440px 桌面、390px 手机及英文界面执行浏览器冒烟检查。拦截全部 API 请求，不写真实简历，不调用真实 AI；验证入口、无横向溢出、备份默认模板与失效模板提示、英文备份请求、失败保留输入、重复点击、文件格式拒绝、超过 10 MB 图片拒绝、AI 设置返回保留步骤输入、关闭重开清空表单、创建中禁止关闭/返回/Escape 且失败后恢复、手机底部操作可见、创建后直接导航。首次创建取消延迟引导也通过虚拟时钟检查；补充浏览器确认 AI 表单只展示中文、英文且可切换。
- 未进行本地构建或 Git 提交、推送、合并。

**接口对接**：继续使用 `POST /api/resume`（JSON、201 返回完整新简历）。模板方式不传 `sections`，生成空白模块；备份传 `title/template/language/themeConfig/sections`。服务端只提取这五类字段，重新生成简历和模块数据库 ID；无效请求返回 400。文件方式继续使用 `POST /api/resume/parse`（FormData），AI 表单继续使用 `POST /api/ai/generate-resume`，两者鉴权和 AI 请求头保持不变。模板与备份无需 AI 请求头。

```bash
# 指纹模式示例；OAuth 模式使用登录 Cookie，不需要 x-fingerprint。
curl -X POST http://localhost:3000/api/resume \
  -H 'Content-Type: application/json' \
  -H 'x-fingerprint: <当前用户指纹>' \
  --data '{"title":"English Backup","template":"modern","language":"en","themeConfig":{"primaryColor":"#123456"},"sections":[{"type":"summary","title":"Profile","sortOrder":2,"visible":false,"content":{"text":"Existing experience"}}]}'
```

**待人工联调**：使用真实英文导出备份执行导出→导入→编辑器→返回列表，核对实际新 ID 与样式；使用真实 PDF/图片及用户自己的模型检查解析结果。这些真实服务和数据库场景不计入上述 mock 测试通过范围。

### 阶段 3：聊天收集信息，手动制作简历

**目标**：替换旧表单，达到最低信息要求后由用户控制制作时机。

- [x] 在统一创建流程中提供聊天步骤与固定顶部“制作简历”按钮，最低要求仅为称呼和求职目标。
- [x] 对话中维护明确的基本信息与缺项，不依赖回答文本包含“信息齐全”等词来判断；没有新建简历前，不调用绑定已有简历的编辑工具。采集阶段只返回自然语言回复与少量状态字段，不提前生成完整简历 JSON。
- [x] 只有点击“制作简历”才执行结构化生成、格式校验和落库；完整对话作为已提供信息的来源，后续更正优先，不直接套用编辑器仅保留最近 10 轮的上下文截断。没有内容的模块留空，不编造用户未提供的事实。
- [x] 正确处理 AI 配置、回复中、制作中、制作失败、确认关闭清空、返回上一步等状态，不保存聊天草稿。
- [x] 最终生成先完整校验再写入，复用仓库已有 `insertResumeWithSections` 事务模式，使新简历与模块一次成功或一起失败；只调整本次生成落库，不全仓重构创建服务。
- [x] 补齐聊天/最终生成接口的输入输出、错误与针对性测试；交付时提供实际请求示例，敏感 Key 仅用占位符。

**接口与复用边界**：

- 新增轻量 `POST /api/ai/resume-intake`（第三阶段新增）：请求传本次对话的用户/助手消息与语言；回复返回 `reply` 与最新 `basicInfo: { fullName, jobTitle }`。前端显示 `reply`，用基本信息非空判断能否制作，其他资料以完整对话为来源。不接入数据库聊天会话或修改简历工具。
- 第一版用一次模型调用返回“回复＋基本状态”，显示等待状态，不要求模型支持工具调用，也不另加一次 AI 请求判断是否可制作；流式逐字显示不作为首版验收条件。
- 改造现有 `POST /api/ai/generate-resume`：由旧表单输入改为完整对话、最新基本信息、模板与语言；服务端独立校验最低门槛，不能只信前端按钮或 `ready` 布尔值。沿用当前 `{ resumeId, title, sections }` 成功返回并立即打开编辑器。
- 替换主动虚构履历的旧提示词；复用现有六类模块结构、JSON 提取与内容归一化，使用明确 schema 校验，不沿用 `z.any()` 作为最终校验。缺失标量使用空字符串、缺失列表使用空数组，供编辑器正常打开和补填。
- 沿用既有鉴权及 AI 配置请求头；消息角色、长度和生成输入在服务端入口校验。对话仅存在页面状态与当次模型请求中，不新建会话存储。

**涉及文件**：`src/components/dashboard/generate-resume-dialog.tsx`（改为创建流程内的聊天内容）、`src/app/api/ai/generate-resume/route.ts`、`src/lib/ai/generate-resume-schema.ts`、`src/lib/db/repositories/resume.repository.ts`（局部复用现有事务插入）、新增 `src/app/api/ai/resume-intake/route.ts` 及其轻量 schema、相关语言文件和测试。复用 `src/lib/ai/provider.ts`、`src/lib/ai/extract-json.ts`、`src/lib/resume/normalize-content.ts`，不改编辑器聊天链路。

**前置条件**：阶段 2 已完成；已有 AI 配置机制可用。**交付**：聊天创建完整链路及独立可运行测试。

**验收**：仅有称呼和求职目标也能制作；经历不足不被强制拦截；聊天前及聊天中没有空简历落库；创建出的内容与对话一致；失败后可重试；确认关闭后再次打开为空；桌面和手机均能看到制作按钮与未满足条件。

**实施说明（2026-11-27）**：旧 AI 表单已替换为聊天。对话及未发送输入由创建容器持有，配置弹窗返回不丢失；聊天底部可随时进入 AI 设置修正 Key/模型（制作中禁用），返回后可重试。确认离开时 abort 当前采集请求并使其失效，不写本机草稿。生成期间使用同步 ref 防止重复请求，并禁用关闭、返回、输入及 Escape/遮罩关闭。制作默认经典模板和当前界面语言。生成结果六类模块全部校验后才调用 `resumeRepository.createWithSections`，局部复用已有 SQLite/PostgreSQL 事务，不改变模板、文件、备份或编辑器聊天服务。

**接口对接**：

- `POST /api/ai/resume-intake`：JSON `{ messages, language }`；200 返回 `{ reply, basicInfo: { fullName, jobTitle } }`。messages 仅允许 user/assistant、从 user 开始交替，本次请求最后为 user；不调用简历创建或聊天会话存储。
- `POST /api/ai/generate-resume`：JSON `{ messages, basicInfo, template, language }`，不再接受旧表单契约；messages 最后为已完成的 assistant 回复，basicInfo 两项必须非空且出自用户原话。默认 template=classic、language=zh；当前界面传 zh/en。200 继续返回 `{ resumeId, title, sections }`，成功直接进入编辑器。
- 两个接口均要求既有鉴权及 `x-provider/x-api-key/x-base-url/x-model`；无用户或 AI 配置不全返回 401，无效输入/损坏 JSON 返回 400，模型/输出校验/数据库错误返回 500，取消返回 499。JSON mode 不兼容时沿用一次降级重试，不要求工具调用或流式响应。
- 单条消息最多 12,000 字符，最多 200 条消息、总计 120,000 字符；采集输入额外为下一条助手回复预留 12,000 字符（本次输入总量最多 108,000），避免追加回复后无法制作。超限显式拒绝，不静默截断历史。称呼最多 120 字符，求职目标最多 200 字符。采集模型必须保留两项原话，不能从助手示例推断；其他履历真实性依赖仅使用用户事实的提示词，schema 只能校验结构，不能替代真实模型人工验收。

```bash
# 1. 采集信息；OAuth 模式改用登录 Cookie，不需要 x-fingerprint。
curl -X POST http://localhost:3000/api/ai/resume-intake \
  -H 'Content-Type: application/json' \
  -H 'x-fingerprint: <当前用户指纹>' \
  -H 'x-provider: openai' \
  -H 'x-api-key: <你的 Key>' \
  -H 'x-base-url: <你配置的供应商地址>' \
  -H 'x-model: <你选择的模型>' \
  --data '{"messages":[{"role":"user","content":"叫我小鹿，我想找前端工程师岗位，其他资料以后再补。"}],"language":"zh"}'

# 2. 用户点击制作；示例 assistant 内容应替换为上一步实际 reply。
curl -X POST http://localhost:3000/api/ai/generate-resume \
  -H 'Content-Type: application/json' \
  -H 'x-fingerprint: <当前用户指纹>' \
  -H 'x-provider: openai' \
  -H 'x-api-key: <你的 Key>' \
  -H 'x-base-url: <你配置的供应商地址>' \
  -H 'x-model: <你选择的模型>' \
  --data '{"messages":[{"role":"user","content":"叫我小鹿，我想找前端工程师岗位，其他资料以后再补。"},{"role":"assistant","content":"已了解称呼和求职目标，可以点击制作，也可以继续补充。"}],"basicInfo":{"fullName":"小鹿","jobTitle":"前端工程师"},"template":"classic","language":"zh"}'
```

**自动化验证（第三阶段）**：

- `pnpm exec vitest run src/lib/db/repositories/resume.repository.create-with-sections.test.ts src/components/dashboard/create-resume-flow.test.ts`：12 项通过；事务测试使用独立内存 SQLite，模块写入失败后两表均无新增，不访问应用数据库。
- `pnpm exec vitest run src/lib/ai/generate-resume-schema.test.ts src/app/api/ai/resume-intake/route.test.ts src/app/api/ai/generate-resume/route.test.ts`：65 项通过；覆盖输入角色/长度/最低门槛、回复预算、原话来源、完整历史及更正传递、空模块、严格输出类型、401/400/500/取消、JSON mode 降级、归一化 ID、事务调用及失败不上报。
- `pnpm exec vitest run src/components/preview/templates/classic.test.ts`：16 项通过；经典模板只显示已提供的教育/项目日期，不再把缺失结束日期推断为“至今”。这是聊天稀疏资料的局部展示修复，不扩改其他模板。
- 与前两阶段创建 schema/API、岗位优化、内容归一化、事务及经典模板联合回归：11 个测试文件、169 项通过。
- `python scripts/test-resume-stage-three.py`：桌面 1440px、手机 390px/320px、英文手机冒烟通过；覆盖两项门槛分别缺失、无经历可制作、超过 10 轮不截断、更正信息、未发送输入、回复失败重试、制作期间防重/禁退出、制作失败保留、离开取消/确认清空、普通回复取消及迟到响应不恢复、AI 设置返回保留输入、成功后导航。浏览器全部 API 均拦截，无真实 AI 和真实简历写入；需先运行 `pnpm dev`，并已有 Python Playwright/Chrome。
- `pnpm exec tsc --noEmit --incremental false`、阶段三组件/hook/schema/route/新增测试定向 ESLint、阶段一静态回归均通过；未运行本地构建或 Git 提交、推送、合并。

**待人工联调**：用本人选择的模型验证仅称呼与目标生成时其余模块为空；粘贴真实经历并多轮更正/撤回后，确认输出不把助手建议当作事实、不杜撰学校/公司/日期/业绩。真实数据库及 PostgreSQL 事务运行另行验证；上述 API mock 与 SQLite 回滚测试不代表已完成这些真实服务验收。

## 四、已确认的产品决定

1. 聊天仅需称呼和求职目标即可制作，不要求经历或联系方式齐全。
2. 平台 JSON 导入采用模板创建式交互，默认选中 JSON 内的模板，用户可以修改选择后创建。
3. 聊天关闭即清空；有对话内容时先提示，由用户确认关闭。

其他推荐项以本稿为讨论基础，后续可以逐条调整，不自动实施。

## 五、验证与范围

实际实施时按现有 `vitest.config.ts` 约定提供 `src/**/*.test.ts` 针对性测试文件，测试数据和可调整常量放在顶部；每个文件有明确的一键运行命令，例如 `pnpm exec vitest run src/lib/ai/generate-resume-schema.test.ts`，不依赖手工执行前置脚本。聊天门槛/状态、生成 schema 和 JSON 映射用固定响应测试，不要求真实 AI Key；真实模型的表达与真实性另做人工验收。

1. `pnpm dev` 启动，桌面与手机尺寸检查四个入口和返回路径、模板选择、顶部制作按钮、编辑器无导入入口。
2. 导出含英文内容、不同模板、自定义主题、隐藏/排序模块的本平台 JSON，再导入，检查默认选择、修改名称、切换模板以及旧简历不被覆盖；错误 JSON 不创建简历。
3. PDF/图片导入成功后进入编辑器，核对仍遵循现有格式与 10 MB 限制；未配置 AI 时能打开设置并回到原创建步骤。
4. 聊天依次验收：缺少称呼 → 不可制作；缺少目标 → 不可制作；两项齐全且无任何经历 → 可制作；继续补充或更正信息 → 使用最新确认值；失败 → 保留对话可重试；重复点击 → 制作中只发一次请求；取消关闭 → 内容不变；确认关闭 → 内容清空。
5. 岗位优化仍生成独立优化版，中英文入口、提示、结果以及来源说明一致。

**本轮不做**：本地构建、Git 提交/推送/合并、聊天历史持久化、Word 导入、新的简历文件格式、大范围数据库或编辑器重构。现有接口用于创建与文件解析；仅聊天阶段确有必要时新增轻量采集逻辑，不新建一套平行的简历导入接口。
