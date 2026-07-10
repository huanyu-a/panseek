# PanSeek 部署文档

## 服务器信息

| 项目 | 值 |
|------|-----|
| 服务器 IP | `152.136.49.237` |
| SSH 端口 | `22` |
| SSH 用户 | `root` |
| 登录方式 | **仅密钥登录**（已禁用密码，`PasswordAuthentication no`） |
| 部署路径 | `/www/dk_project/dk_app/panseek` |
| 公网地址 | `http://152.136.49.237:4000` |
| 健康检查 | `http://152.136.49.237:4000/api/health` |

## 架构概览

```
本地开发机 (Windows)                   生产服务器 (Linux)
┌─────────────────────┐               ┌─────────────────────┐
│ Nuxt 源码            │  tar+SSH     │ docker load         │
│ bash build.sh       │  ──────────→  │ docker compose up   │
│ docker save → tar   │               │                     │
└─────────────────────┘               └─────────────────────┘
```

- **数据库持久化**: 数据卷挂载 `${APP_PATH}/data:/app/data`，容器重启/重建不影响热搜数据
- **镜像命名**: `panseek:latest`（本地构建），GHCR 仅作版本备份
- **配置文件**: `deploy/.env`（gitignored，含服务器真实变量）
- **百度统计**: 运行时通过 `NUXT_PUBLIC_BAIDU_TONGJI_ID` 注入，公共镜像不含 ID

---

## 前置条件

- Docker Desktop（本地构建）
- Windows 原生 OpenSSH `C:\Windows\System32\OpenSSH\ssh.exe`
  > ⚠️ Git Bash 自带的 SSH 客户端与服务器不兼容，**必须**用 Windows 原生版
- SSH 密钥已配置（见下方"SSH 密钥配置"）

---

## SSH 密钥配置

服务器已禁用密码登录（`PasswordAuthentication no`），必须使用密钥登录。

### 首次配置（一次性）

```bash
# 1. 私钥复制到 .ssh 目录
cp /path/to/152.136.49.237_id_ed25519 ~/.ssh/id_ed25519_panseek

# 2. 收紧权限（仅当前用户可读，否则 SSH 拒绝使用）
icacls "%USERPROFILE%\.ssh\id_ed25519_panseek" /inheritance:r /grant:r "%USERNAME%:R"

# 3. 验证公钥能派生（确认权限已OK）
"C:/Windows/System32/OpenSSH/ssh-keygen.exe" -y -f ~/.ssh/id_ed25519_panseek
```

> 公钥注释应含 `root@VM-8-13-opencloudos`，对应目标服务器主机名。

---

## 一键部署（tar + SSH）

```bash
# ===== 配置变量 =====
HOST="root@152.136.49.237"
PORT="22"
DEPLOY_PATH="/www/dk_project/dk_app/panseek"
SSH_BIN="C:/Windows/System32/OpenSSH/ssh.exe"
SSHKEY="$HOME/.ssh/id_ed25519_panseek"
SSH_ARGS="-i $SSHKEY -o StrictHostKeyChecking=no -p $PORT"
SSH="$SSH_BIN $SSH_ARGS"

# ===== 步骤 =====
cd /c/project/wwwroot/panseek

# 1. 构建 Docker 镜像（Nuxt build 在容器内完成）
bash build.sh

# 2. 打包（gzip 压缩减少传输量：~700MB → ~140MB）
docker save panseek:latest | gzip > panseek-latest.tar.gz

# 3. 上传到服务器
scp $SSH_ARGS panseek-latest.tar.gz "$HOST:$DEPLOY_PATH/panseek-latest.tar.gz"

# 4. 加载 + 重启
# ⚠️ 不要 docker rmi！load 后直接 compose up，否则会重新拉取全部层（极慢）
$SSH "$HOST" "cd $DEPLOY_PATH && \
  gunzip -f panseek-latest.tar.gz && \
  docker load -i panseek-latest.tar && \
  docker compose --env-file .env up -d --remove-orphans && \
  rm -f panseek-latest.tar.gz panseek-latest.tar"

# 5. 健康检查
sleep 15
curl -s http://152.136.49.237:4000/api/health
# → {"status":"ok","plugins_enabled":true,"plugin_count":68,...}

# 6. 本地清理
rm -f panseek-latest.tar.gz
```

---

## 百度统计

百度统计在容器启动时通过 `deploy/.env` 注入，**公共镜像不含 ID**（分层防爬设计）：

- `deploy/.env` 中必须含 `NUXT_PUBLIC_BAIDU_TONGJI_ID=<你的ID>`
- `docker-compose.yml` 已配置变量引用 `NUXT_PUBLIC_BAIDU_TONGJI_ID=${NUXT_PUBLIC_BAIDU_TONGJI_ID:-}`
- 详细防爬设计见根目录 `CLAUDE.md` 的 Analytics 章节

### 验证统计生效

```bash
curl -s http://152.136.49.237:4000/ | grep -c '你的统计ID'
# 返回 1 = 注入成功
curl -s http://152.136.49.237:4000/_nuxt/entry-bundle.js | grep 'hm.baidu.com/hm.js?'
# 返回匹配 = 脚本引用存在
```

---

## Docker 镜像仓库镜像

Docker Hub 在国内访问不稳定，首次构建前需要 Pull base 镜像：

```bash
docker pull docker.1ms.run/library/node:20-alpine
docker tag docker.1ms.run/library/node:20-alpine node:20-alpine
```

已配置 registry mirrors（`.docker/daemon.json`）：
- `https://docker.1ms.run`
- `https://docker.xuanyuan.me`
- `https://docker.m.daocloud.io`

---

## 验证

```bash
curl -s http://152.136.49.237:4000/api/health
# → {"status":"ok","plugins_enabled":true,...}

$SSH "$HOST" "cd $DEPLOY_PATH && docker compose --env-file .env ps"
```

---

## 常见问题

**部署后没变化？**
```bash
$SSH "$HOST" "cd $DEPLOY_PATH && docker compose --env-file .env down && docker rmi panseek:latest"
# 然后重新 load + up
```

**数据库/热搜会重置吗？**
不会。数据在挂载卷 `${APP_PATH}/data` 中持久化（SQLite 热搜存储）。

**回滚？**
```bash
scp $SSH_ARGS old_version.tar.gz "$HOST:$DEPLOY_PATH/panseek-latest.tar.gz"
$SSH "$HOST" "cd $DEPLOY_PATH && docker compose --env-file .env down && \
  docker rmi panseek:latest && docker load -i panseek-latest.tar.gz && \
  docker compose --env-file .env up -d"
```

**SSH 密钥权限被拒绝？**
OpenSSH 要求私钥不能对其他用户可见：
```bash
icacls "%USERPROFILE%\.ssh\id_ed25519_panseek" /inheritance:r /grant:r "%USERNAME%:R"
```

**密码登录报错"Permission denied"？**
服务器已禁用密码登录，必须使用密钥。如确需紧急恢复：
通过云厂商控制台 VNC 登录后：
```bash
sed -i "s/^PasswordAuthentication.*/PasswordAuthentication yes/" /etc/ssh/sshd_config
systemctl restart sshd
```
恢复后重新推送密钥，再禁用密码。

**百度统计没有数据？**
1. 确认 `deploy/.env` 中 `NUXT_PUBLIC_BAIDU_TONGJI_ID` 已填写
2. 登录 https://tongji.baidu.com → 站点管理 → 域名白名单 → 确保 `panseek.bx9y.com.cn` 已加入
3. 验证 ID 是否注入：`curl -s http://152.136.49.237:4000/ | grep -c '你的ID'`
