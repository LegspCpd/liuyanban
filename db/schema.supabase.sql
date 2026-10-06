-- ============================================================================
--  Seven戚 · Supabase 专属补充
-- 目标平台 : 仅 Supabase
  内容     : Realtime 发布表 + 头像存储桶
  执行方式 : 由 apply-schema.mjs 在 DB_PROVIDER=supabase 时追加执行
-- ============================================================================


-- 幂等守卫：本段仅在目标库确实没有该 schema 时才执行，
-- 因此在不认识该对象的平台上（如 Neon 没有 storage schema）会安全跳过。
do $$
begin
    if not exists (select 1 from pg_namespace where nspname = 'storage') then
        return;
    end if;

    -- -----------------------------------------------------------------------
    -- 存储桶（前端依赖，缺则上传失败）：
    --   avatars  头像（profile/user 页）
    --   posts    发帖图片（new-post 页 uploadImage，缺桶则发帖插图 400）
    -- -----------------------------------------------------------------------
    insert into storage.buckets (id, name, public)
    values ('avatars', 'avatars', true),
           ('posts', 'posts', true)
    on conflict (id) do nothing;
end $$;

-- ---------------------------------------------------------------------------
-- Realtime 发布（前端 postgres_changes 订阅所依赖）
-- 幂等：逐表判断后再加入 publication
-- ---------------------------------------------------------------------------
do $$
declare
    t text;
    realtime_tables text[] := array[
        'users', 'posts', 'post_comments', 'poll_votes',
        'messages', 'chats', 'rooms', 'room_messages', 'gomoku_games'
    ];
begin
    if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
        create publication supabase_realtime;
    end if;

    foreach t in array realtime_tables loop
        if not exists (
            select 1 from pg_publication_tables
            where pubname = 'supabase_realtime'
              and schemaname = 'public'
              and tablename = t
        ) then
            execute format('alter publication supabase_realtime add table public.%I', t);
        end if;
    end loop;
end $$;
