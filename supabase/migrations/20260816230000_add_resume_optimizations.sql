-- AI 求职助手：简历优化（resume_optimizations）
-- 按 JD 改写简历的结果记录，独立于 analyses（智能分析），用于缓存与一致性。
-- 白名单/配额不走数据库：UNLIMITED_USER_EMAILS 与 FREE_DAILY_* 均为环境变量配置。
-- 幂等写法：可重复执行（表/索引 IF NOT EXISTS，策略先删后建）。

create table if not exists public.resume_optimizations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  analysis_id uuid references public.analyses (id) on delete cascade,
  resume_id uuid references public.resumes (id) on delete set null,
  job_description_id uuid references public.job_descriptions (id) on delete set null,
  resume_text text,
  job_description_text text,
  input_hash text,
  status text not null default 'processing' check (status in ('pending', 'processing', 'success', 'error')),
  model text,
  result jsonb,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists resume_optimizations_user_id_created_at_idx
  on public.resume_optimizations (user_id, created_at desc);
create index if not exists resume_optimizations_input_hash_idx
  on public.resume_optimizations (input_hash);
create index if not exists resume_optimizations_analysis_id_idx
  on public.resume_optimizations (analysis_id);

grant select, insert, update, delete on public.resume_optimizations to authenticated;

alter table public.resume_optimizations enable row level security;

drop policy if exists "resume_optimizations_select_own" on public.resume_optimizations;
create policy "resume_optimizations_select_own" on public.resume_optimizations
  for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "resume_optimizations_insert_own" on public.resume_optimizations;
create policy "resume_optimizations_insert_own" on public.resume_optimizations
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "resume_optimizations_update_own" on public.resume_optimizations;
create policy "resume_optimizations_update_own" on public.resume_optimizations
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "resume_optimizations_delete_own" on public.resume_optimizations;
create policy "resume_optimizations_delete_own" on public.resume_optimizations
  for delete to authenticated
  using ((select auth.uid()) = user_id);
