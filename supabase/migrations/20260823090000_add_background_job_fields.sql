-- AI 求职助手：后台任务队列字段（修复 Netlify 免费套餐同步函数 10s 超时）
-- 方案：AI 调用迁到 Supabase Edge Function（150s wall-clock）+ Supabase Cron 秒级扫描。
-- analyses 与 resume_optimizations 复用为任务队列：
--   - status: pending（待处理，入队即返回）→ processing（worker 已领取）→ success/error
--   - locked_at: worker 领取时间，用于崩溃后的 lease 回收（超过 5 分钟视为失联可重领）
--   - attempts: 已尝试次数，超过 3 次转 error
-- 幂等写法：可重复执行（ADD COLUMN IF NOT EXISTS / CREATE INDEX IF NOT EXISTS）。

alter table public.analyses
  add column if not exists locked_at timestamptz,
  add column if not exists attempts integer not null default 0;

alter table public.resume_optimizations
  add column if not exists locked_at timestamptz,
  add column if not exists attempts integer not null default 0;

create index if not exists analyses_status_created_at_idx
  on public.analyses (status, created_at);
create index if not exists resume_optimizations_status_created_at_idx
  on public.resume_optimizations (status, created_at);

-- worker 原子领取任务（security definer，仅 service_role 可调用）：
-- 领取 pending，或「processing 且 locked_at 超过 5 分钟（疑似 worker 崩溃）且 attempts<3」的过期任务。
-- 外层 WHERE 在 UPDATE 时重新校验领取条件，避免并发 cron 重复领取同一行。
create or replace function public.claim_analysis_jobs(p_limit integer)
returns setof public.analyses
language sql
security definer
set search_path = public
as $$
  update public.analyses a
  set status = 'processing',
      locked_at = now(),
      attempts = a.attempts + 1,
      updated_at = now()
  where a.id in (
    select id
    from public.analyses
    where status = 'pending'
       or (status = 'processing' and locked_at < now() - interval '5 minutes' and attempts < 3)
    order by created_at
    limit p_limit
  )
  and (
    a.status = 'pending'
    or (a.status = 'processing' and a.locked_at < now() - interval '5 minutes' and a.attempts < 3)
  )
  returning a.*;
$$;

create or replace function public.claim_resume_optimization_jobs(p_limit integer)
returns setof public.resume_optimizations
language sql
security definer
set search_path = public
as $$
  update public.resume_optimizations r
  set status = 'processing',
      locked_at = now(),
      attempts = r.attempts + 1,
      updated_at = now()
  where r.id in (
    select id
    from public.resume_optimizations
    where status = 'pending'
       or (status = 'processing' and locked_at < now() - interval '5 minutes' and attempts < 3)
    order by created_at
    limit p_limit
  )
  and (
    r.status = 'pending'
    or (r.status = 'processing' and r.locked_at < now() - interval '5 minutes' and r.attempts < 3)
  )
  returning r.*;
$$;

-- 领取函数仅供 worker（service_role）使用，禁止 anon/authenticated 通过 Data API 调用。
revoke execute on function public.claim_analysis_jobs(integer) from public, anon, authenticated;
revoke execute on function public.claim_resume_optimization_jobs(integer) from public, anon, authenticated;
grant execute on function public.claim_analysis_jobs(integer) to service_role;
grant execute on function public.claim_resume_optimization_jobs(integer) to service_role;
