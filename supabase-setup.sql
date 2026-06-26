-- ================================================================
-- 单据模板系统 — Supabase 数据库建表 SQL
-- 在 Supabase SQL Editor 中执行
-- ================================================================

-- 1. 用户表
CREATE TABLE IF NOT EXISTS users (
  id          BIGSERIAL PRIMARY KEY,
  username    TEXT UNIQUE NOT NULL,
  password    TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- 2. 模板表
CREATE TABLE IF NOT EXISTS templates (
  id          TEXT PRIMARY KEY,
  username    TEXT NOT NULL,
  name        TEXT NOT NULL,
  description TEXT DEFAULT '',
  data        JSONB DEFAULT '{}',
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_templates_username ON templates(username);

-- 3. 项目表
CREATE TABLE IF NOT EXISTS projects (
  id           TEXT PRIMARY KEY,
  username     TEXT NOT NULL,
  name         TEXT NOT NULL,
  data         JSONB DEFAULT '{}',
  total_amount NUMERIC DEFAULT 0,
  created_at   TIMESTAMPTZ DEFAULT now(),
  updated_at   TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_projects_username ON projects(username);

-- 4. 启用 RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

-- 5. RLS 策略：公开访问（用 anon key）
CREATE POLICY "anon_all_users" ON users FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "anon_all_templates" ON templates FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "anon_all_projects" ON projects FOR ALL USING (true) WITH CHECK (true);
