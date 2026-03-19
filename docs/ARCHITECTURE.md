# ARCHITECTURE — Nexus 架构现状

**扫描日期**: 2026-03-19  **版本**: v1.2  **锚点**: `docs/NORTH-STAR.md`

---

## 系统概览

```
Browser (任意设备)
    ↕  WSS /ws?token=<jwt>          ← WebSocket（原始 VT100 流）
    ↕  HTTPS /api/*                ← REST（认证后端 JSON API）
Nexus Server（Node.js，server.js）
    ↕  node-pty                    ← PTY 桥（单实例）
tmux attach-session -t main       ← 连接宿主机 tmux session
    ├── window 0: vault
    ├── window 1: projects-blog
    └── window N: ...
```

---

## 后端（server.js 316行，单文件）

### 启动流程

1. 加载 `.env`（手动解析，无 dotenv 依赖）
2. 验证 `JWT_SECRET` 和 `ACC_PASSWORD_HASH`（缺失则 exit(1)）
3. 确保 `data/` 和 `data/configs/` 存在
4. 注册 Express 路由 + 静态文件
5. 创建 HTTP server + WebSocketServer（共享端口 3000）

### API Endpoints

| Method | Path | Auth | 描述 |
|---|---|---|---|
| POST | `/api/auth/login` | 无 | 密码 bcrypt 比对，返回 JWT |
| GET | `/api/sessions` | Bearer | tmux list-windows |
| POST | `/api/sessions` | Bearer | tmux new-window（claude/bash/profile） |
| DELETE | `/api/sessions/:id` | Bearer | tmux kill-window |
| POST | `/api/sessions/:id/attach` | Bearer | tmux select-window |
| GET | `/api/workspaces` | Bearer | 扫描 WORKSPACE_ROOT 子目录 |
| GET | `/api/configs` | Bearer | 列出 claude 配置 profiles |
| POST | `/api/configs/:id` | Bearer | 创建/更新 profile |
| DELETE | `/api/configs/:id` | Bearer | 删除 profile |
| GET | `/api/toolbar-config` | Bearer | 读取工具栏配置 |
| POST | `/api/toolbar-config` | Bearer | 保存工具栏配置 |
| GET | `*` | 无 | SPA fallback → index.html |

### PTY 层

```javascript
// 全局单实例
let ptyProc = null;
const clients = new Set();

function ensurePty() {
  // spawn tmux attach-session -t main
  // ptyProc.onData → broadcast to all clients
  // ptyProc.onExit → auto recreate tmux session
}
```

**技术债位置**:
- `ptyProc` 是全局变量，不支持 window 级别独立 PTY（v2 需要重构为 Map）
- `resize` 消息只影响全局 PTY，多客户端 resize 冲突
- `exec()` 拼接 tmux 命令时 `cwd` 和 `name` 参数未做完整转义（路径含空格/特殊字符可能出错）

---

## 前端（frontend/src/）

### 组件树

```
App.tsx（路由）
├── LoginPage（内联于 App.tsx）
│    └── POST /api/auth/login
└── TerminalPage
     ├── TabBar.tsx           ← 桌面端顶部 window 标签
     ├── Terminal.tsx         ← xterm.js + WebSocket + 触摸处理
     │    ├── FitAddon
     │    ├── WebLinksAddon
     │    └── mobile touch handlers（单指滚动、双指缩放）
     ├── Toolbar.tsx          ← 可配置按键栏
     │    └── toolbarDefaults.ts
     ├── SessionManager.tsx   ← 新建/切换 session 面板
     ├── WorkspaceSelector.tsx← 路径选择器
     └── BottomNav.tsx        ← 移动端底部导航
```

### 状态管理

- 无全局状态库（React useState/useEffect）
- `token` 存 localStorage
- `toolbar config` 缓存 localStorage，权威源为服务端 `/api/toolbar-config`
- `font size` 持久化 localStorage

### 技术债位置

- `Terminal.tsx`：tmux window 切换通过发送 `\x02{index}` 键序列，依赖 tmux 快捷键，不够健壮
- `TabBar.tsx` / `BottomNav.tsx`：轮询间隔和切换逻辑待确认（最新实现状态需验证）
- `toolbarDefaults.ts`：按键序列硬编码，无运行时验证

---

## 数据层

```
data/
├── toolbar-config.json    # 工具栏布局（所有设备共享）
└── configs/
    ├── profile-a.json     # claude 启动配置 profile
    └── profile-b.json
```

**特点**: 无数据库，JSON 文件 + Docker volume 持久化。tmux 会话状态从 tmux 实时读取。

---

## 部署结构

```
nexus/
├── server.js              # 唯一后端（ESM，Node 20）
├── package.json           # 4个依赖：express ws node-pty bcrypt
├── frontend/
│   ├── src/               # React 源码
│   └── dist/              # Vite 构建产物（server.js 静态伺服）
├── public/
│   └── manifest.json      # PWA manifest
├── Dockerfile             # 基于 cc:latest
├── docker-compose.yml
├── ecosystem.config.cjs   # PM2 配置（非 Docker 部署备选）
└── data/                  # Docker volume 挂载点
```

### 环境变量

| 变量 | 必须 | 默认 | 说明 |
|---|---|---|---|
| `JWT_SECRET` | ✓ | — | JWT 签名密钥（openssl rand -hex 32） |
| `ACC_PASSWORD_HASH` | ✓ | — | bcrypt hash 的登录密码 |
| `TMUX_SESSION` | | `main` | 要 attach 的 tmux session 名 |
| `WORKSPACE_ROOT` | | `/home/librae` | 工作区根目录（容器内路径） |
| `PORT` | | `3000` | 监听端口 |

---

## 已知技术债汇总

| 位置 | 问题 | 优先级 |
|---|---|---|
| `server.js:240` | 全局单 PTY，不支持独立 window | v2（高） |
| `server.js:110` | tmux 命令 cwd/name 特殊字符转义不完整 | 中 |
| `server.js:293` | resize 多客户端冲突，取最后值 | 低 |
| `Terminal.tsx` | window 切换通过 `\x02{index}` 键序列，脆弱 | v2（高） |
| Dockerfile/compose | claude 用户 UID 可能与宿主机不匹配 | 高（文件权限） |
| docker-compose.yml | claude 配置目录未挂载（API key 未共享） | 按需 |
