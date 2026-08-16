-- AI 求职助手：初始化 schema
-- 用户资料、简历、岗位描述、分析记录、用量日志 + 私有存储桶 + RLS。

-- 1) profiles：用户资料（1:1 关联 Supabase Auth 用户）
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2) resumes：简历（原始 PDF 存私有桶，这里存元数据 + 解析出的文字）
create table public.resumes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  file_name text not null,
  file_size_bytes bigint,
  storage_path text,
  parsed_text text,
  parse_status text not null default 'pending' check (parse_status in ('pending', 'success', 'failed')),
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);

-- 每人最多一份默认简历
create unique index resumes_one_default_per_user_idx
  on public.resumes (user_id)
  where is_default;

-- 3) job_descriptions：岗位描述（独立成表，便于复用）
create table public.job_descriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text,
  company text,
  content text not null,
  language text not null default 'zh',
  created_at timestamptz not null default now()
);

-- 4) analyses：分析记录（含输入快照，保证历史完整）
create table public.analyses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  resume_id uuid references public.resumes (id) on delete set null,
  job_description_id uuid references public.job_descriptions (id) on delete set null,
  resume_text text,
  job_description_text text,
  status text not null default 'processing' check (status in ('pending', 'processing', 'success', 'error')),
  model text,
  result jsonb,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 5) usage_events：用量日志（配额/成本核算）
create table public.usage_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  event_type text not null default 'analysis',
  model text,
  input_tokens integer,
  output_tokens integer,
  created_at timestamptz not null default now()
);

-- 索引（外键列 + 历史列表排序 + 用量查询）
create index resumes_user_id_idx on public.resumes (user_id);
create index job_descriptions_user_id_idx on public.job_descriptions (user_id);
create index analyses_user_id_created_at_idx on public.analyses (user_id, created_at desc);
create index analyses_resume_id_idx on public.analyses (resume_id);
create index analyses_job_description_id_idx on public.analyses (job_description_id);
create index usage_events_user_id_created_at_idx on public.usage_events (user_id, created_at);

-- Data API 权限：authenticated 角色可访问（行级再由 RLS 过滤）
grant select, insert, update, delete on public.resumes, public.job_descriptions, public.analyses to authenticated;
grant select, insert on public.usage_events to authenticated;
grant select, insert, update on public.profiles to authenticated;

-- RLS：全部开启
alter table public.profiles enable row level security;
alter table public.resumes enable row level security;
alter table public.job_descriptions enable row level security;
alter table public.analyses enable row level security;
alter table public.usage_events enable row level security;

-- profiles 策略：仅本人
create policy "profiles_select_own" on public.profiles
  for select to authenticated
  using ((select auth.uid()) = id);

create policy "profiles_insert_own" on public.profiles
  for insert to authenticated
  with check ((select auth.uid()) = id);

create policy "profiles_update_own" on public.profiles
  for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- resumes 策略：仅本人
create policy "resumes_select_own" on public.resumes
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "resumes_insert_own" on public.resumes
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "resumes_update_own" on public.resumes
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "resumes_delete_own" on public.resumes
  for delete to authenticated
  using ((select auth.uid()) = user_id);

-- job_descriptions 策略：仅本人
create policy "job_descriptions_select_own" on public.job_descriptions
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "job_descriptions_insert_own" on public.job_descriptions
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "job_descriptions_update_own" on public.job_descriptions
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "job_descriptions_delete_own" on public.job_descriptions
  for delete to authenticated
  using ((select auth.uid()) = user_id);

-- analyses 策略：仅本人
create policy "analyses_select_own" on public.analyses
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "analyses_insert_own" on public.analyses
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "analyses_update_own" on public.analyses
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "analyses_delete_own" on public.analyses
  for delete to authenticated
  using ((select auth.uid()) = user_id);

-- usage_events 策略：仅本人可查、可增（不可改/删）
create policy "usage_events_select_own" on public.usage_events
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "usage_events_insert_own" on public.usage_events
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

-- 注册时自动创建 profile
create function public.handle_new_user()
returns trigger
set search_path = ''
as $$
begin
  insert into public.profiles (id)
  values (new.id);
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Storage：私有桶 resumes（路径 resumes/{user_id}/{file}）
insert into storage.buckets (id, name, public)
values ('resumes', 'resumes', false)
on conflict (id) do nothing;

create policy "resumes_storage_select_own" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'resumes'
    and (storage.foldername(name))[2] = (select auth.uid())::text
  );

create policy "resumes_storage_insert_own" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'resumes'
    and (storage.foldername(name))[2] = (select auth.uid())::text
  );

create policy "resumes_storage_update_own" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'resumes'
    and (storage.foldername(name))[2] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'resumes'
    and (storage.foldername(name))[2] = (select auth.uid())::text
  );

create policy "resumes_storage_delete_own" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'resumes'
    and (storage.foldername(name))[2] = (select auth.uid())::text
  );

-- handle_new_user 仅由 auth.users 上的触发器内部调用，
-- 不对外开放 RPC 执行权限（Supabase 默认给 anon/authenticated 授了 EXECUTE，需显式撤销）。
revoke execute on function public.handle_new_user() from public, anon, authenticated;
