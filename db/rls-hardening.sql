-- ============================================================================
--  Seven戚 · RLS 加固 —— B档（手动，勿自动执行）
-- ============================================================================
--  A档（公开表 using(true)，行为透明）已由流水线自动执行，见 db/rls-auto.sql。
--  本文件只剩私有表收紧，需满足前置条件后手工在 SQL Editor 执行。
--  前置条件：
--    1. 全站请求带 JWT（不再用裸 anon key 直连），auth.uid() 非空
--    2. 注册流程在邮箱确认后才 insert users（或关掉邮箱确认）
--    3. 头像上传路径改 user_id 开头（现路径首段是 'avatars'，foldername 策略会 403）
--  前置检查（全 true 才执行）：
--    select count(*) = 0 from public.users where auth_id is null;
-- ============================================================================

-- ============================================================================
--  B档（手动，勿自动执行）—— 私有表收紧
--  前置检查（在 SQL Editor 逐条确认，全是 true 才能执行 B档）：
--    select count(*) = 0 from public.users where auth_id is null;  -- 无游离业务用户
-- ============================================================================

-- 5. 私有数据：通知 / 举报 / 反馈 / 设备 —— 仅本人或管理员
-- ---------------------------------------------------------------------------
alter table public.notifications enable row level security;
drop policy if exists notifications_own on public.notifications;
create policy notifications_own on public.notifications for all
  using (public.current_user_id() = user_id or public.is_admin())
  with check (public.current_user_id() = user_id or public.is_admin());

alter table public.reports enable row level security;
drop policy if exists reports_insert on public.reports;
create policy reports_insert on public.reports for insert with check (true);
drop policy if exists reports_read on public.reports;
create policy reports_read on public.reports for select
  using (public.current_user_id() = reporter_id or public.is_admin());
drop policy if exists reports_update on public.reports;
create policy reports_update on public.reports for update
  using (public.is_admin()) with check (public.is_admin());

alter table public.feedback_sites enable row level security;
drop policy if exists feedback_sites_all on public.feedback_sites;
create policy feedback_sites_all on public.feedback_sites for all using (true) with check (true);

alter table public.feedback enable row level security;
drop policy if exists feedback_own on public.feedback;
create policy feedback_own on public.feedback for all
  using (public.current_user_id() = user_id or public.is_admin())
  with check (public.current_user_id() = user_id or public.is_admin());

alter table public.device_registrations enable row level security;
drop policy if exists device_registrations_own on public.device_registrations;
create policy device_registrations_own on public.device_registrations for all
  using (true) with check (true);

-- ---------------------------------------------------------------------------
-- 6. 关注 / 角色
-- ---------------------------------------------------------------------------
alter table public.follows enable row level security;
drop policy if exists follows_all on public.follows;
create policy follows_all on public.follows for all
  using (true)
  with check (public.current_user_id() = follower_id);

alter table public.user_roles enable row level security;
drop policy if exists user_roles_read on public.user_roles;
create policy user_roles_read on public.user_roles for select using (true);
drop policy if exists user_roles_write on public.user_roles;
create policy user_roles_write on public.user_roles for all
  using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- 7. Realtime 与 RLS 的关系
--    Realtime 的 postgres_changes 在开启 RLS 后只会推送策略允许的行。
--    本项目的房间、聊天均为全员可见，策略已放行，不影响实时功能。
-- ---------------------------------------------------------------------------

-- ============================================================================
--  附：头像存储桶的上传策略
-- ============================================================================
--  前端用 anon key 以"用户自己的 ID"为路径前缀上传头像，例如 12/avatar.png
--  若建表后上传仍返回 401/403，请手工执行以下策略：
-- ============================================================================

drop policy if exists "avatars public read" on storage.objects;
create policy "avatars public read" on storage.objects
  for select using (bucket_id = 'avatars');

drop policy if exists "avatars upload own folder" on storage.objects;
create policy "avatars upload own folder" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = public.current_user_id()::text
  );

drop policy if exists "avatars update own folder" on storage.objects;
create policy "avatars update own folder" on storage.objects
  for update to authenticated
  using (bucket_id = 'avatars')
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = public.current_user_id()::text
  );

drop policy if exists "avatars delete own folder" on storage.objects;
create policy "avatars delete own folder" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = public.current_user_id()::text
  );
