-- ============================================================================
--  Seven戚 · 行级安全策略（RLS）加固 —— A档（可自动执行）
-- ============================================================================
--  执行方式：由 scripts/apply-schema.mjs 在各计划末尾自动执行（幂等）。
--  原则：只上「与现状行为完全一致」的策略——公开表 using(true)。
--  效果：防删库/防爆破（删表、改 publication 等 DDL 仍需 service_role），
--  不改变前端任何读写行为，上了和没上对业务透明。
--
--  B档（私有表收紧：notifications/reports/feedback 仅本人或管理员）仍需手动，
--  见本文件后半部分。原因：
--    1. 前端用 anon key 直连（无 JWT），auth.uid() 全是 NULL，上了直接全站 403
--    2. 注册流程先 signUp 后 insert，若项目开了邮箱确认，users_insert 的
--       authenticated 要求会炸新用户注册
--    3. 头像上传路径首段是 'avatars' 而非 user_id，storage 的 foldername 策略会 403
--  B档前置条件：全站切到「登录后所有请求带 JWT」+ 上传路径改 user_id 开头，
--  属独立改造项，做完后手工执行 B档段即可。
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. 辅助函数（SECURITY DEFINER，避免策略内递归触发 RLS）
--    A档暂不需要 auth.uid()，但预建函数供 B档直接使用。
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
-- 2. A档：公开表 —— RLS enable + using(true)（行为与现状一致）
--    覆盖：users(读)/posts/post_comments/categories/post_polls/poll_options/
--    poll_votes/messages/chats/rooms/room_messages/gomoku_games/
--    feedback_sites/follows(读)/user_roles(读)/device_registrations
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
  open_tables text[] := array[
    'users', 'posts', 'post_comments', 'categories',
    'post_polls', 'poll_options', 'poll_votes',
    'messages', 'chats', 'rooms', 'room_messages', 'gomoku_games',
    'feedback_sites', 'follows', 'user_roles', 'device_registrations'
  ];
begin
  foreach t in array open_tables loop
    if exists (select 1 from information_schema.tables
               where table_schema='public' and table_name=t) then
      execute format('alter table public.%I enable row level security', t);
      execute format('drop policy if exists %I_open on public.%I', t, t);
      execute format('create policy %I_open on public.%I for all using (true) with check (true)', t, t);
    end if;
  end loop;
end $$;

