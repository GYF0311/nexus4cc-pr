# PRD — Nexus AI 终端面板

**版本**: v1.2.0  **状态**: Active  **锚点**: `docs/NORTH-STAR.md`

---

## Problem Statement

开发者需要一个统一入口，让 AI Agent 能在任意项目目录中持续运行，并能在 PC、手机、IM 等任意渠道随时介入——现有工具（ttyd、SSH）在移动端控制字符输入残缺，且缺乏针对 AI Agent 生命周期的管理界面和异步交互能力。

---

## Target Users

**用户即开发者本人**（单用户/个人服务器）
- 同时跑多个 Claude Code Agent，需要随时从任意设备查看进度、发送指令
- 外出时通过手机/Telegram 给 AI 下任务，回家后在 PC 上接续
- 不想保持 SSH 连接，关掉浏览器后 Agent 继续运行

---

## Core Features

### Must（v1 已实现）

| ID | Feature | 验收标准 |
|---|---|---|
| F-01 | WebSocket tmux 桥接 | 浏览器关闭后 tmux 和 Agent 继续运行；重新打开可接续 |
| F-02 | JWT 单密码认证 | 密码 bcrypt hash 存 env，Token 30天有效 |
| F-03 | xterm.js 终端渲染 | 256色/TrueColor/Unicode；scrollback 10000行 |
| F-04 | 移动端控制字符工具栏 | 可发送 Esc/Tab/Ctrl+C/方向键等；触摸不弹软键盘 |
| F-05 | 移动端滚动与缩放 | 单指滑动浏览历史；双指捏合调字号（8–32px） |
| F-06 | Session 管理 API | `POST/GET/DELETE /api/sessions`；tmux 新建/切换/关闭 window |
| F-07 | 工具栏服务端持久化 | 配置存 `data/toolbar-config.json`（volume），跨设备共享 |
| F-08 | PWA 支持 | manifest.json + Service Worker，可添加主屏幕 |
| F-12 | claude -c 会话续接 | 自动检测 `.claude-data/.claude`，`claude -c` 续接历史会话 |

### Should（v2：极致 Agent 管理体验）

> 对应北极星「轴三：极致 Agent 管理体验」

| ID | Feature | 验收标准 |
|---|---|---|
| F-09 | Tab Bar UI | 顶部实时显示所有 tmux window，点击切换，活跃 tab 高亮 |
| F-10 | 移动端底导航 | 底部 Tab 快速切换 window，支持新建；覆盖顶部 Tab Bar |
| F-11 | 独立 window PTY | `ensurePty(windowId)` Map；`/ws?window=N` 多设备不互扰 |
| F-15 | Agent 状态卡片 | 每个 window 显示最后输出摘要（是否在跑/是否等待输入） |

### Could（v3：零摩擦上下文同步）

> 对应北极星「轴二：零摩擦上下文同步」——不限于浏览器终端的交互渠道

| ID | Feature | 场景 |
|---|---|---|
| F-13 | `claude -p` 非交互派发 | 发一条 prompt，AI 在后台处理，前端显示结果卡片；不占用交互 PTY |
| F-14 | 上下文附件同步 | 在移动端将图片/文件/文本片段发送给指定 Agent session |
| F-16 | Telegram Bot 频道 | 外出时在 Telegram 给 AI 下任务，结果回传聊天；调用 `/api/tasks` |
| F-17 | 多输入渠道统一路由 | 任意渠道（Web/IM/CLI）的 prompt 统一进入 task 队列，结果同步回发起方 |

---

## Feature Detail: v3 非交互派发（F-13/F-16/F-17）

```
POST /api/tasks
  body: { session_name, prompt, attachments? }
  → spawn claude -p "<prompt>" --cwd <session.cwd>
  → 流式 SSE 返回结果
  → 前端结果卡片（不占用交互 PTY）
  → 同步回发起方渠道（Web / Telegram / ...）

POST /api/webhooks/telegram
  → 解析消息 + 附件（图片/文件）
  → 调用 POST /api/tasks
  → 结果回传 Telegram 对话
```

**设计原则**：任务派发与交互终端解耦——交互 PTY 继续用于实时 claude 对话，tasks API 用于异步一次性任务，两者共存，各司其职。

---

## Success Metrics

| Metric | Target |
|---|---|
| 移动端 Esc/Ctrl+C 发送成功率 | 100% |
| 浏览器重连后终端恢复时间 | < 2s |
| 工具栏配置跨设备同步 | 重连后自动加载 |
| 从 Telegram 发出 prompt 到收到首个 token | < 5s |
| PWA 添加主屏并可用 | iOS Safari / Android Chrome |

---

## Out of Scope

- 多用户/团队功能、注册系统、权限管理
- 替换 tmux（持久化/scrollback 继续由 tmux 负责）
- 通用 Web SSH 工具（不针对 claude CLI 工作流的功能不做）
- Session 数据库（JSON 文件 + tmux 实时读取）
- Docker socket 暴露给前端

---

## Known Limitations（v1）

| 问题 | 影响 | v2 解法 |
|---|---|---|
| 多客户端 resize 冲突 | 多设备同时连接时 PTY 尺寸以最后收到的为准 | 取最小尺寸策略 |
| 单 PTY 全局切换 | window 切换所有设备同步跳转 | 独立 window PTY Map（F-11） |
| claude 配置未挂载 | 容器内 claude 使用镜像内配置，非宿主机配置 | docker-compose volumes 增加挂载 |
| 文件权限 | 容器 claude UID ≠ 宿主机 UID 时写文件失败 | Dockerfile usermod -u 1000 |
