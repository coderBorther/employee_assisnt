-- 修复：storage 路径为 resumes/{user_id}/{file}，
-- user_id 是 storage.foldername(name) 的第 2 个元素（第 1 个是桶前缀 resumes）。
drop policy if exists "resumes_storage_select_own" on storage.objects;
drop policy if exists "resumes_storage_insert_own" on storage.objects;
drop policy if exists "resumes_storage_update_own" on storage.objects;
drop policy if exists "resumes_storage_delete_own" on storage.objects;

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
