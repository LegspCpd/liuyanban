-- ============================================================================
--  Seven戚 · 线上体检修复（2026-10-06）
-- ============================================================================
-- 用法（二选一）：
--   A. Supabase 控制台 → SQL Editor → 整段粘贴 → Run
--   B. 配置 CI Secret DATABASE_URL 后，让 database job 自动执行
-- 特性：全部幂等，可重复执行，不删任何数据，不改任何现有值
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. 补齐缺失的列（体检发现：schema 声明 130 列，实际库缺这 3 个）
-- ---------------------------------------------------------------------------
-- reports.admin_note：管理员审核备注。前端 profile-report.js 一直在写它，
--   但真实库里没这列，导致举报审核每次都走降级分支（备注写不进去）。
alter table public.reports
    add column if not exists admin_note text;

-- poll_options.poll_id：投票选项与投票的关联字段。
alter table public.poll_options
    add column if not exists poll_id bigint;

-- user_roles.created_at：角色表时间戳（前端不写该列，仅补齐结构）。
alter table public.user_roles
    add column if not exists created_at timestamptz not null default now();

-- ---------------------------------------------------------------------------
-- 2. 索引加固（防止数据增长后房间页/聊天页变慢）
--    体检时 room_messages 已有 234 行、chats 154 行，
--    而前端大量使用 .order(created_at) 与 .eq(外键) 查询。
-- ---------------------------------------------------------------------------
create index if not exists idx_posts_created_at on public.posts (created_at desc);
create index if not exists idx_posts_category_id on public.posts (category_id);
create index if not exists idx_posts_user_id on public.posts (user_id);
create index if not exists idx_post_comments_post_id on public.post_comments (post_id);
create index if not exists idx_room_messages_room_id on public.room_messages (room_id);
create index if not exists idx_room_messages_created_at on public.room_messages (created_at);
create index if not exists idx_chats_user_id on public.chats (user_id);
create index if not exists idx_chats_created_at on public.chats (created_at);
create index if not exists idx_messages_created_at on public.messages (created_at);
create index if not exists idx_notifications_user_id on public.notifications (user_id);
create index if not exists idx_users_phone on public.users (phone);
create index if not exists idx_follows_follower on public.follows (follower_id);
create index if not exists idx_feedback_site_id on public.feedback (site_id);

-- ---------------------------------------------------------------------------
-- 3. 回执：确认 3 列已就位
-- ---------------------------------------------------------------------------
do $$
declare
    missing text;
begin
    select string_agg(c, ', ') into missing
    from unnest(array['admin_note']) as t(c)
    where not exists (
        select 1 from information_schema.columns
        where table_schema = 'public' and table_name = 'reports' and column_name = t.c
    );
    if missing is null then
        raise notice 'OK：reports.admin_note 已就位';
    else
        raise warning '仍缺失：%', missing;
    end if;
end $$;
