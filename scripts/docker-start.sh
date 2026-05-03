#!/bin/bash
set -e

# 项目根目录
PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_ROOT"

echo "🐳 启动项目基础设施服务..."
echo ""

# 1. 启动 postgres + postgrest
docker-compose up -d

echo ""
echo "⏳ 等待 PostgreSQL 就绪..."

# 2. 等待 postgres 健康检查
for i in {1..30}; do
  if docker-compose ps postgres | grep -q "healthy"; then
    echo "✅ PostgreSQL 已就绪"
    break
  fi
  if [ "$i" -eq 30 ]; then
    echo "❌ PostgreSQL 启动超时"
    exit 1
  fi
  sleep 1
done

# 3. 等待 postgrest 就绪
echo "⏳ 等待 PostgREST 就绪..."
for i in {1..30}; do
  if curl -s http://localhost:3000/ > /dev/null 2>&1; then
    echo "✅ PostgREST 已就绪 (http://localhost:3000)"
    break
  fi
  if [ "$i" -eq 30 ]; then
    echo "❌ PostgREST 启动超时"
    exit 1
  fi
  sleep 1
done

echo ""
echo "📊 服务状态:"
docker-compose ps

echo ""
echo "🎉 基础设施启动完成！"
echo ""
echo "  PostgreSQL : localhost:5432 (db: agent_db)"
echo "  PostgREST  : http://localhost:3000"
echo ""
echo "如需初始化知识库表结构，执行:"
echo "  docker-compose exec -T postgres psql -U postgres -d agent_db < apps/backend/agent-server/src/knowledge/repositories/knowledge-schema.sql"
