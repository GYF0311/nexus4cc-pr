# ROADMAP — Nexus

**锚点**: `docs/NORTH-STAR.md` | **PRD**: `docs/PRD.md`

---

## Current Sprint（进行中）

### Tab Bar + 移动端底导航（F-09/F-10）
**北极星轴**：轴三 — 极致 Agent 管理体验
**状态**: TabBar.tsx / BottomNav.tsx 已建立，待完善

验收标准：
- [ ] Tab Bar 实时反映 tmux window 列表（轮询或 SSE）
- [ ] 点击 Tab 切换 window，当前活跃 tab 高亮
- [ ] BottomNav 在移动端替代顶部 Tab Bar，支持滑动切换
- [ ] 新建 session 按钮触发 SessionManager 面板

前置依赖：F-01~F-08（已完成）

---

## Next Sprint（轴三：Agent 管理深化）

### 独立 window PTY（F-11）
**北极星轴**：轴三
验收标准：
- [ ] `ensurePty(windowId)` 返回 Map 中独立 PTY 实例
- [ ] WebSocket 路由：`/ws?window=<index>` 连接特定 window
- [ ] 多设备连接不同 window 互不干扰
- [ ] resize 只影响当前 window 的 PTY

前置依赖：Tab Bar 稳定（需要 window index 路由）

### 文件权限修复
验收标准：
- [ ] Dockerfile 中 claude 用户 UID 与宿主机一致
- [ ] claude 在挂载目录可读写（`docker exec nexus id` 验证）

### Agent 状态卡片（F-15）
**北极星轴**：轴三
验收标准：
- [ ] 每个 Tab/window 显示最后输出摘要（截断至 80 字符）
- [ ] 视觉区分「运行中」「等待输入」「已退出」三种状态

前置依赖：F-11（需要独立 PTY 才能读取各 window 输出）

---

## Backlog（轴二：零摩擦上下文同步）

> 以下功能共同构成「任意时间地点与 AI 交互」的愿景。
> 设计原则：异步 tasks 与交互 PTY 解耦，共存互不干扰。

### claude -p 非交互派发（F-13）
**北极星轴**：轴二
验收标准：
- [ ] `POST /api/tasks { session_name, prompt }` → `claude -p` 后台执行
- [ ] SSE 流式返回结果
- [ ] 前端展示结果卡片，不占用交互 PTY
- [ ] 任务历史存 `data/tasks.json`

前置依赖：F-11（避免与交互 PTY 冲突）

### Telegram Bot 频道（F-16）
**北极星轴**：轴二
验收标准：
- [ ] `POST /api/webhooks/telegram` 接收消息和附件
- [ ] 调用 `/api/tasks`，结果回传 Telegram 对话
- [ ] Bot Token 存环境变量 `TELEGRAM_BOT_TOKEN`
- [ ] 支持发图片/文件附件给指定 session

前置依赖：F-13（tasks API 稳定）

### 上下文附件同步（F-14）
**北极星轴**：轴二
验收标准：
- [ ] 移动端 Web UI 支持上传图片/文件到指定 session
- [ ] 文件写入 session 对应的 cwd，并自动在终端输入文件路径
- [ ] 支持剪贴板图片直接粘贴（paste from clipboard）

前置依赖：F-13

### 多输入渠道统一路由（F-17）
**北极星轴**：轴二
说明：Web / Telegram / 未来其他渠道的 prompt 统一进入 task 队列，结果同步回发起方。
前置依赖：F-16 稳定后提炼通用抽象

### 多 tmux session 支持（F-18）
**北极星轴**：轴三
验收标准：
- [ ] `GET /api/tmux-sessions` 列出所有 tmux session
- [ ] `/ws?session=<name>&window=<index>` 连接指定 session 和 window
- [ ] 前端 session 选择器

前置依赖：F-11

---

## 已完成（v1.2）

| Feature | Commit |
|---|---|
| WebSocket tmux 桥 + JWT 认证 | `48c13ca` |
| xterm.js + 移动端滚动/缩放 | `48c13ca` |
| 可配置工具栏（服务端持久化） | `3bf29f9` |
| Session 管理 UI + API | `9eb36fc` |
| DELETE /api/sessions/:id | `48e3725` |
| claude 配置路径修复 | `dcb4836` |
| 窗口切换/会话创建修复 | `622096a` |
| 关闭后保持窗口 | `9b9dacf` |
| claude -c 会话历史自动检测 | `e676766` |
| 移动端底导航（BottomNav.tsx） | `fb21eee` |
