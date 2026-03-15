// server.js — Nexus WebSocket tmux 桥接服务
import express from 'express';
import { WebSocketServer } from 'ws';
import * as pty from 'node-pty';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { createServer } from 'http';
import { exec } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync } from 'fs';

// 加载 .env 文件（如果存在）
try {
  const envPath = join(dirname(fileURLToPath(import.meta.url)), '.env');
  const lines = readFileSync(envPath, 'utf8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    const val = trimmed.slice(idx + 1).trim();
    if (key && !(key in process.env)) process.env[key] = val;
  }
} catch { /* .env 不存在时忽略 */ }

const __dirname = dirname(fileURLToPath(import.meta.url));

const app = express();
app.use(express.json());

const {
  JWT_SECRET,
  ACC_PASSWORD_HASH,
  TMUX_SESSION = 'main',
  WORKSPACE_ROOT = '/workspace',
  PORT = '3000',
} = process.env;

if (!JWT_SECRET || !ACC_PASSWORD_HASH) {
  console.error('ERROR: JWT_SECRET and ACC_PASSWORD_HASH must be set in environment');
  process.exit(1);
}

// 静态文件：frontend/dist 和 public
app.use(express.static(join(__dirname, 'public')));
app.use(express.static(join(__dirname, 'frontend', 'dist')));

// Auth middleware
function authMiddleware(req, res, next) {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'unauthorized' });
  try {
    jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'unauthorized' });
  }
}

// POST /api/auth/login
app.post('/api/auth/login', async (req, res) => {
  const { password } = req.body || {};
  if (!password) return res.status(400).json({ error: 'password required' });
  try {
    const ok = await bcrypt.compare(password, ACC_PASSWORD_HASH);
    if (!ok) return res.status(401).json({ error: 'unauthorized' });
    const token = jwt.sign({}, JWT_SECRET, { expiresIn: '30d' });
    res.json({ token });
  } catch (err) {
    res.status(500).json({ error: 'internal error' });
  }
});

// POST /api/sessions — 在 tmux 中创建新 window
app.post('/api/sessions', authMiddleware, (req, res) => {
  const { rel_path, command = 'bash' } = req.body || {};
  if (!rel_path) return res.status(400).json({ error: 'rel_path required' });
  const name = rel_path.replace(/^\/+|\/+$/g, '').replace(/\//g, '-') || 'default';
  const cwd = `${WORKSPACE_ROOT}/${rel_path}`;
  const cmd = `tmux new-window -t ${TMUX_SESSION} -c "${cwd}" -n "${name}" "${command}"`;
  exec(cmd, (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ name, cwd, command });
  });
});

// SPA fallback — 所有非 API 路由返回 index.html
app.get('*', (req, res) => {
  const indexPath = join(__dirname, 'frontend', 'dist', 'index.html');
  res.sendFile(indexPath, (err) => {
    if (err) res.status(404).send('Not found — run: cd frontend && npm run build');
  });
});

// PTY 单实例，attach 到 tmux session
let ptyProc = null;
const clients = new Set();

function ensurePty() {
  if (ptyProc) return;
  ptyProc = pty.spawn('tmux', ['attach-session', '-t', TMUX_SESSION], {
    name: 'xterm-256color',
    cols: 220,
    rows: 50,
    env: { ...process.env, LANG: 'C.UTF-8', TERM: 'xterm-256color' },
  });

  ptyProc.onData((data) => {
    for (const ws of clients) {
      if (ws.readyState === 1) ws.send(data);
    }
  });

  ptyProc.onExit(({ exitCode }) => {
    console.log(`PTY exited with code ${exitCode}`);
    ptyProc = null;
    // 重建 tmux session，供下次连接使用
    exec(`tmux new-session -d -s ${TMUX_SESSION}`);
    for (const ws of clients) {
      if (ws.readyState === 1) {
        ws.send('\r\n[Nexus: tmux session ended — refresh to reconnect]\r\n');
      }
    }
  });
}

// WebSocket 服务
const server = createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

wss.on('connection', (ws, req) => {
  const url = new URL(req.url, 'http://x');
  const token = url.searchParams.get('token');

  try {
    jwt.verify(token, JWT_SECRET);
  } catch {
    ws.close(4001, 'unauthorized');
    return;
  }

  ensurePty();
  clients.add(ws);
  console.log(`Client connected (total: ${clients.size})`);

  ws.on('message', (msg) => {
    if (!ptyProc) return;
    const str = typeof msg === 'string' ? msg : msg.toString();
    try {
      const data = JSON.parse(str);
      if (data.type === 'resize' && data.cols && data.rows) {
        ptyProc.resize(Number(data.cols), Number(data.rows));
      }
    } catch {
      // 非 JSON 消息视为原始键盘输入
      ptyProc.write(str);
    }
  });

  ws.on('close', () => {
    clients.delete(ws);
    console.log(`Client disconnected (total: ${clients.size})`);
  });

  ws.on('error', (err) => {
    console.error('WebSocket error:', err.message);
    clients.delete(ws);
  });
});

server.listen(Number(PORT), '0.0.0.0', () => {
  console.log(`Nexus listening on :${PORT}`);
  console.log(`tmux session: ${TMUX_SESSION}`);
  console.log(`workspace: ${WORKSPACE_ROOT}`);
});
