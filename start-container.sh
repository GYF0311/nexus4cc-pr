#!/bin/sh
SESSION="${TMUX_SESSION:-main}"

# 如果 session 不存在则创建
tmux new-session -d -s "$SESSION" 2>/dev/null || true

exec node server.js
