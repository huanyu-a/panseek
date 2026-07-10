#!/bin/bash
# PanSeek Docker 构建脚本
# Dockerfile 为多阶段自包含构建（Nuxt build 在容器内完成），
# 无需 FavsHub 那种先 nuxt build 再 docker build 的两步流程。
set -e
cd "$(dirname "$0")"

echo "=== 构建 Docker 镜像 (Nuxt build 在容器内完成) ==="
docker build -t panseek:latest .
echo "=== 构建完成 ==="
