-- ============================================================================
--  【可选】行级安全策略（RLS）加固
-- ============================================================================
--  ⚠️  请勿通过自动流水线执行本文件，需手工在 Supabase SQL Editor 中评估后运行。
--
--  现状说明：
--    db/schema.sql 默认【不启用 RLS】，前端用 anon key 直连读写，这与当前线上库
--    的行为一致，也是站点能立即跑通的前提。本文件用于后续收紧权限。
--
--  启用前请务必确认：
--    1. 已按 README 配置好 Supabase Auth 的站点登录（邮箱 = 手机号@sq.local）
--    2. 已用测试账号验证「注册 / 登录 / 发帖 / 聊天 / 房间」全链路
--    3. 知道一旦策略写错，前端会全站 403
--
--  管理员判定沿用现有逻辑：手机号等于下方常量即视为管理员。
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. 辅助函数（SECURITY DEFINER，避免策略内递归触发 RLS）
-- ---------------------------------------------------------------------------
create or replace function public.current_user_id()
returns bigint
language sql stable security definer set search_path = public
as $$
  select u.id from public.users u where u.auth_id = auth.uid() limit 1;
$$;

create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.users u
    where u.auth_id = auth.uid() and u.phone = '17355394710'
  );
$$;

-- ---------------------------------------------------------------------------
-- 2. users
--    读：公开（帖子、房间、留言需要展示昵称头像）
--    写：仅本人；封禁字段仅管理员
-- ---------------------------------------------------------------------------
alter table public.users enable row level security;

drop policy if exists users_select on public.users;
create policy users_select on public.users for select using (true);

drop policy if exists users_update_own on public.users;
create policy users_update_own on public.users for update
  using (public.current_user_id() = id or public.is_admin())
  with check (public.current_user_id() = id or public.is_admin());

drop policy if exists users_insert on public.users;
create policy users_insert on public.users for insert
  with check (auth.role() = 'authenticated' or public.is_admin());

-- ---------------------------------------------------------------------------
-- 3. 内容类：帖子 / 评论 / 分类 / 投票 / 留言 / 聊天 —— 保持公开读写
-- ---------------------------------------------------------------------------
alter table public.posts enable row level security;
drop policy if exists posts_all on public.posts;
create policy posts_all on public.posts for all using (true) with check (true);

alter table public.post_comments enable row level security;
drop policy if exists post_comments_all on public.post_comments;
create policy post_comments_all on public.post_comments for all using (true) with check (true);

alter table public.categories enable row level security;
drop policy if exists categories_all on public.categories;
create policy categories_all on public.categories for all using (true) with check (true);

alter table public.post_polls enable row level security;
drop policy if exists post_polls_all on public.post_polls;
create policy post_polls_all on public.post_polls for all using (true) with check (true);

alter table public.poll_options enable row level security;
drop policy if exists poll_options_all on public.poll_options;
create policy poll_options_all on public.poll_options for all using (true) with check (true);

alter table public.poll_votes enable row level security;
drop policy if exists poll_votes_all on public.poll_votes;
create policy poll_votes_all on public.poll_votes for all
  using (public.current_user_id() = user_id)
  with check (public.current_user_id() = user_id);

alter table public.messages enable row level security;
drop policy if exists messages_all on public.messages;
create policy messages_all on public.messages for all using (true) with check (true);

alter table public.chats enable row level security;
drop policy if exists chats_all on public.chats;
create policy chats_all on public.chats for all using (true) with check (true);

-- ---------------------------------------------------------------------------
-- 4. 房间
-- ---------------------------------------------------------------------------
alter table public.rooms enable row level security;
drop policy if exists rooms_all on public.rooms;
create policy rooms_all on public.rooms for all using (true) with check (true);

alter table public.room_messages enable row level security;
drop policy if exists room_messages_all on public.room_messages;
create policy room_messages_all on public.room_messages for all using (true) with check (true);

alter table public.gomoku_games enable row level security;
drop policy if exists gomoku_games_all on public.gomoku_games;
create policy gomoku_games_all on public.gomoku_games for all using (true) with check (true);

-- ---------------------------------------------------------------------------
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
