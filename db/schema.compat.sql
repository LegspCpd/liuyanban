-- ============================================================================
--  Seven戚 · 老库兼容补丁（compat）
-- 目标   : 原作者的老库（字段可能比 schema.core.sql 新或旧）直接复用
--  特性   : 幂等，可重复执行，只增列/加发布/关挡路的 RLS，不删数据
--  执行   : 由 scripts/apply-schema.mjs 在 supabase/neon/postgres 计划末尾追加
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. rooms.mute_all（前端 room-rt.js 全员禁言依赖，缺列则 500）
--    加表存在性判断：本文件是整段一次性执行的，任意一条裸 DDL 报错，
--    Postgres 会回滚整个文件，前面已成功的补列也一起消失
--    （这正是 admin_note 长期补不上的第二个原因）。
-- ---------------------------------------------------------------------------
do $blk$
begin
    if exists (select 1 from information_schema.tables
                where table_schema = 'public' and table_name = 'rooms') then
        alter table public.rooms
            add column if not exists mute_all boolean not null default false;
    else
        raise notice '跳过 rooms.mute_all：public.rooms 不存在';
    end if;
end
$blk$;

-- ---------------------------------------------------------------------------
-- 2. reports 审核字段（前端 profile-report.js 举报审核依赖）
--
--    两个必须处理的坑（2026-10-06 线上排查发现）：
--
--    坑1 · 外键类型不可写死
--      新库（本项目 core 建表）users.id 是 bigint；
--      作者老库（Supabase ulvhuqtpdafspbdvkogs）users.id 是 uuid。
--      写死 bigint 时，在 uuid 库上会直接报
--      「foreign key constraint cannot be implemented / key columns are of incompatible types」，
--      整条 ALTER 回滚 —— admin_note 永远补不上。
--      故改为运行时探测 users.id 的真实类型再拼 DDL。
--
--    坑2 · 一条 ALTER 里多列，失败即全灭
--      ADD COLUMN 是逐个动作，但同一条语句内任一失败则整条回滚。
--      原写法把 reviewed_by 与 admin_note 放在同一条 ALTER：
--      reviewed_by 类型报错 → admin_note 一并回滚 → 缺口永远存在。
--      故拆成逐列独立执行，单列失败不影响其它列。
-- ---------------------------------------------------------------------------
do $blk$
declare
    uid_type text;
begin
    select format_type(a.atttypid, a.atttypmod)
      into uid_type
      from pg_attribute a
      join pg_class     c on c.oid = a.attrelid
      join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relname = 'users' and a.attname = 'id'
       and a.attnum > 0 and not a.attisdropped;

    if uid_type is null then
        raise exception 'public.users 不存在，无法为 reports.reviewed_by 推断类型';
    end if;
    raise notice 'users.id 实际类型 = %，据此创建 reports.reviewed_by', uid_type;

    -- 每列独立 try，任一失败不影响其余列
    begin
        -- %s 而非 %I：这里插入的是类型名（uuid / bigint），用 %I 会加双引号
        -- 变成 "uuid"，Postgres 会当成自定义类型而报 type does not exist。
        execute format(
            'alter table public.reports add column if not exists reviewed_by %s references public.users (id) on delete set null',
            uid_type);
    exception when others then
        raise warning '跳过 reports.reviewed_by（外键创建失败，不影响其余列）: %', sqlerrm;
    end;

    begin
        execute 'alter table public.reports add column if not exists reviewed_at timestamptz';
    exception when others then raise warning '跳过 reviewed_at: %', sqlerrm; end;

    begin
        execute 'alter table public.reports add column if not exists measure text';
    exception when others then raise warning '跳过 measure: %', sqlerrm; end;

    begin
        execute 'alter table public.reports add column if not exists ban_days integer';
    exception when others then raise warning '跳过 ban_days: %', sqlerrm; end;

    begin
        execute 'alter table public.reports add column if not exists admin_note text';
    exception when others then raise warning '跳过 admin_note: %', sqlerrm; end;
end
$blk$;

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
do $blk$
begin
    if exists (select 1 from information_schema.tables
                where table_schema = 'public' and table_name = 'poll_options') then
        alter table public.poll_options add column if not exists poll_id bigint;
    else
        raise notice '跳过 poll_options.poll_id：表不存在';
    end if;
end
$blk$;

-- user_roles.created_at：schema 声明但老库无；前端不写该列，补上仅为结构完整
do $blk$
begin
    if exists (select 1 from information_schema.tables
                where table_schema = 'public' and table_name = 'user_roles') then
        alter table public.user_roles
            add column if not exists created_at timestamptz not null default now();
    else
        raise notice '跳过 user_roles.created_at：表不存在';
    end if;
end
$blk$;

-- 索引加固：线上量最大的三张表是 room_messages(234)/chats(154)/messages(30)，
-- 前端大量使用 .order(created_at) 与 .eq(外键) 查询，老库大概率没建索引，
-- PostgREST 会退化成全表扫，数据继续增长后房间页/聊天页会明显变慢。
-- 全部 if not exists，可重复执行。

-- 逐条判断目标表是否存在再建索引：表不在就跳过。
-- 本文件是一次性连续执行的，任意一条裸 DDL 报错都会让整个文件回滚，
-- 前面已成功的补列一并消失。建索引最容易被这种机制误伤（表可能还没建）。
do $blk$
begin
    if exists (select 1 from information_schema.tables
                where table_schema = 'public' and table_name = 'posts') then
        execute 'create index if not exists idx_posts_created_at on public.posts (created_at desc)';
    end if;
    if exists (select 1 from information_schema.tables
                where table_schema = 'public' and table_name = 'posts') then
        execute 'create index if not exists idx_posts_category_id on public.posts (category_id)';
    end if;
    if exists (select 1 from information_schema.tables
                where table_schema = 'public' and table_name = 'posts') then
        execute 'create index if not exists idx_posts_user_id on public.posts (user_id)';
    end if;
    if exists (select 1 from information_schema.tables
                where table_schema = 'public' and table_name = 'post_comments') then
        execute 'create index if not exists idx_post_comments_post_id on public.post_comments (post_id)';
    end if;
    if exists (select 1 from information_schema.tables
                where table_schema = 'public' and table_name = 'room_messages') then
        execute 'create index if not exists idx_room_messages_room_id on public.room_messages (room_id)';
    end if;
    if exists (select 1 from information_schema.tables
                where table_schema = 'public' and table_name = 'room_messages') then
        execute 'create index if not exists idx_room_messages_created_at on public.room_messages (created_at)';
    end if;
    if exists (select 1 from information_schema.tables
                where table_schema = 'public' and table_name = 'chats') then
        execute 'create index if not exists idx_chats_user_id on public.chats (user_id)';
    end if;
    if exists (select 1 from information_schema.tables
                where table_schema = 'public' and table_name = 'chats') then
        execute 'create index if not exists idx_chats_created_at on public.chats (created_at)';
    end if;
    if exists (select 1 from information_schema.tables
                where table_schema = 'public' and table_name = 'messages') then
        execute 'create index if not exists idx_messages_created_at on public.messages (created_at)';
    end if;
    if exists (select 1 from information_schema.tables
                where table_schema = 'public' and table_name = 'notifications') then
        execute 'create index if not exists idx_notifications_user_id on public.notifications (user_id)';
    end if;
    if exists (select 1 from information_schema.tables
                where table_schema = 'public' and table_name = 'users') then
        execute 'create index if not exists idx_users_phone on public.users (phone)';
    end if;
    if exists (select 1 from information_schema.tables
                where table_schema = 'public' and table_name = 'follows') then
        execute 'create index if not exists idx_follows_follower on public.follows (follower_id)';
    end if;
    if exists (select 1 from information_schema.tables
                where table_schema = 'public' and table_name = 'feedback') then
        execute 'create index if not exists idx_feedback_site_id on public.feedback (site_id)';
    end if;
end
$blk$;

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
