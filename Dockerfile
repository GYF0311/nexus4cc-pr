FROM node:20-alpine

# 安装 tmux 和 node-pty 构建依赖
RUN apk add --no-cache \
    tmux \
    python3 \
    make \
    g++ \
    linux-headers

WORKDIR /app

# 安装后端依赖
COPY package.json ./
RUN npm install

# 复制前端构建产物（构建时已完成）
COPY frontend/dist ./frontend/dist

# 复制服务器代码
COPY server.js ./
COPY public ./public

ENV NODE_ENV=production
EXPOSE 3000

COPY start-container.sh ./
RUN chmod +x start-container.sh
CMD ["./start-container.sh"]
