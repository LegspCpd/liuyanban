-- ============================================================================
--  Seven戚 · 老库兼容补丁（compat）
-- 目标   : 原作者的老库（字段可能比 schema.core.sql 新或旧）直接复用
--  特性   : 幂等，可重复执行，只增列/加发布/关挡路的 RLS，不删数据
--  执行   : 由 scripts/apply-schema.mjs 在 supabase/neon/postgres 计划末尾追加
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. rooms.mute_all（前端 room-rt.js 全员禁言依赖，缺列则 500）
-- ---------------------------------------------------------------------------
alter table public.rooms
    add column if not exists mute_all boolean not null default false;

-- ---------------------------------------------------------------------------
-- 2. reports 审核字段（前端 profile.html 举报处理依赖）
--    老库若已有则跳过；若缺则补上
-- ---------------------------------------------------------------------------
alter table public.reports
    add column if not exists reviewed_by bigint references public.users (id) on delete set null,
    add column if not exists reviewed_at timestamptz,
    add column if not exists measure text,
    add column if not exists ban_days integer,
    add column if not exists admin_note text;

-- ---------------------------------------------------------------------------
-- 3. Realtime 发布补齐
--    老库建表早于 realtime 段，或后续加的表没进发布，逐表补
-- ---------------------------------------------------------------------------
do $$
declare
    t text;
    realtime_tables text[] := array[
        'users', 'posts', 'post_comments', 'poll_votes',
        'messages', 'chats', 'rooms', 'room_messages', 'gomoku_games',
        'reports', 'notifications', 'feedback'
    ];
begin
    if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
        create publication supabase_realtime;
    end if;

    foreach t in array realtime_tables loop
        if exists (select 1 from information_schema.tables
                   where table_schema = 'public' and table_name = t)
           and not exists (select 1 from pg_publication_tables
                            where pubname = 'supabase_realtime'
                              and schemaname = 'public'
                              and tablename = t) then
            execute format('alter publication supabase_realtime add table public.%I', t);
        end if;
    end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 4. 关掉挡 anon key 的 RLS（只关「开了 RLS 却没有配套策略」的表）
--    原理：前端用 anon key 直连；老库若某表开了 RLS 但策略不匹配，
--    PostgREST 会静默返回 [] 或 403，页面看起来就是「数据过不来」。
--    已有正确策略的表不受影响；rls-hardening.sql 仍可后续手动加固。
-- ---------------------------------------------------------------------------
do $$
declare
    t text;
    -- 前端 anon key 必须能直接读写的公开表
    open_tables text[] := array[
        'users', 'posts', 'post_comments', 'categories',
        'post_polls', 'poll_options', 'poll_votes',
        'messages', 'chats', 'rooms', 'room_messages', 'gomoku_games',
        'reports', 'notifications', 'user_roles', 'follows',
        'feedback', 'feedback_sites', 'device_registrations'
    ];
    pol_count int;
begin
    foreach t in array open_tables loop
        if exists (select 1 from information_schema.tables
                   where table_schema = 'public' and table_name = t) then
            -- 数一下这张表有没有策略；没有策略却开着 RLS = 全挡，必须关
            select count(*) into pol_count
            from pg_policies where schemaname = 'public' and tablename = t;
            if pol_count = 0 then
                execute format('alter table public.%I disable row level security', t);
            end if;
        end if;
    end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 5. 存储桶（avatars 头像 + posts 发帖图片，与 supabase.sql 同逻辑再守一次）
-- ---------------------------------------------------------------------------
do $$
begin
    if exists (select 1 from pg_namespace where nspname = 'storage') then
        insert into storage.buckets (id, name, public)
        values ('avatars', 'avatars', true),
               ('posts', 'posts', true)
        on conflict (id) do nothing;
    end if;
end $$;

-- ---------------------------------------------------------------------------
-- 6. 其余表缺列补齐（2026-10-06 线上体检发现）
--    体检方法：把 db/schema.core.sql 声明的 130 列逐列用 PostgREST 探测
--    （select 该列时，不存在的列会返回 400），与真实库比对，130 列中缺这 3 个。
--    之所以一直缺：CI 的 database job 没配 Supabase 凭据，一直「安全跳过」，
--    本节从未真正落过库（mute_all / reviewed_by 查得到，是作者老库本来就有）。
-- ---------------------------------------------------------------------------
-- poll_options.poll_id：schema 声明但老库无；建投票、关联选项时会缺列
alter table public.poll_options
    add column if not exists poll_id bigint;

-- user_roles.created_at：schema 声明但老库无；前端不写该列，补上仅为结构完整
alter table public.user_roles
    add column if not exists created_at timestamptz not null default now();

-- 索引加固：线上量最大的三张表是 room_messages(234)/chats(154)/messages(30)，
-- 前端大量使用 .order(created_at) 与 .eq(外键) 查询，老库大概率没建索引，
-- PostgREST 会退化成全表扫，数据继续增长后房间页/聊天页会明显变慢。
-- 全部 if not exists，可重复执行。
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

-- ===========================================================================
--  执行结果回执
-- ===========================================================================
do $$
declare
    t_count int;
    r_count int;
begin
    select count(*) into t_count
    from information_schema.tables
    where table_schema = 'public' and table_type = 'BASE TABLE';
    select count(*) into r_count
    from pg_publication_tables where pubname = 'supabase_realtime';
    raise notice 'Seven戚 compat 补丁完成，public 共 % 张表，realtime 发布中共 % 张', t_count, r_count;
end $$;
