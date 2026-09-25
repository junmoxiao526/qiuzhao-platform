-- ============================================================
-- 秋招管理平台 · 共享岗位池
-- 在 Supabase SQL Editor 中整段执行一次即可（可重复执行，幂等）
-- 项目：dppxnheifyqenroqtusw
-- ============================================================
--
-- 设计说明
--   · job_pool 是「岗位池」的唯一存储，全站所有人共用一份。
--     匿名可读可写 —— 因为岗位信息来自公开招聘接口，是公开数据；
--     允许匿名写入是为了让访客无需注册就能贡献新岗位。
--
--   · 个人数据（投递记录 / 复盘 / 简历 / 总结）**不进这个库**，
--     只保存在使用者自己的浏览器 localStorage 里。
--     因此这里不存在任何需要按用户隔离的隐私数据。
--
--   · 客户端已对池中数据做消毒（safeHref 拦协议、escapeHtml 转义、
--     sanitizeJobList 规范化），所以匿名写入不会造成 XSS。
--     代价是可能被人灌入无关岗位数据，需要时可手动清理。
-- ============================================================

-- ---------- 1. 建表 ----------
create table if not exists public.job_pool (
  qiuzhi_id      text primary key,              -- 招聘方舟的岗位 id，天然去重
  company        text not null,
  position_raw   text,
  position_types jsonb default '[]'::jsonb,
  industry_raw   text,
  type_tags      jsonb default '[]'::jsonb,
  company_types  jsonb default '[]'::jsonb,
  cities         jsonb default '[]'::jsonb,
  batch          text,
  deadline       text,
  opening_date   text,
  url            text,
  notice_url     text,
  referral_code  text,
  popular        int default 0,
  source         text default 'qiuzhifangzhou', -- 预留：将来接入更多来源
  first_seen_at  timestamptz default now(),
  updated_at     timestamptz default now()
);

comment on table public.job_pool is '共享岗位池：全站共用，匿名可读可写；不含任何个人隐私数据';

-- ---------- 2. 索引 ----------
create index if not exists job_pool_updated_idx on public.job_pool (updated_at desc);
create index if not exists job_pool_company_idx on public.job_pool (company);
create index if not exists job_pool_opening_idx on public.job_pool (opening_date desc);

-- ---------- 3. 开启 RLS 并放行匿名读写 ----------
alter table public.job_pool enable row level security;

-- 幂等：先删同名策略，避免重复执行报错
drop policy if exists "job_pool_public_read"   on public.job_pool;
drop policy if exists "job_pool_public_insert" on public.job_pool;
drop policy if exists "job_pool_public_update" on public.job_pool;

create policy "job_pool_public_read"
  on public.job_pool for select
  to anon, authenticated
  using (true);

create policy "job_pool_public_insert"
  on public.job_pool for insert
  to anon, authenticated
  with check (true);

create policy "job_pool_public_update"
  on public.job_pool for update
  to anon, authenticated
  using (true)
  with check (true);

-- ---------- 4. 验证本表状态 ----------
select relname                as "表名",
       relrowsecurity         as "RLS已开启",
       (select count(*) from pg_policies
         where schemaname = 'public' and tablename = 'job_pool') as "策略数"
from pg_class
where relname = 'job_pool';

-- 期望：RLS已开启 = true，策略数 = 3
