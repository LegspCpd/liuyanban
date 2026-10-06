-- ============================================================================
--  Seven戚 · Neon 专属补充
-- 目标平台 : 仅 Neon (Lakebase Postgres)
  执行方式 : 由 apply-schema.mjs 在 DB_PROVIDER=neon 时追加执行
  说明     : Neon 是标准 Postgres，core 段可直接运行；此处仅做 Neon 侧校准
-- ============================================================================


-- ---------------------------------------------------------------------------
-- 1. Neon 建议开启逻辑复制（便于将来做 CDC / 迁移），失败不影响建表
-- ---------------------------------------------------------------------------
do $$
begin
    begin
        alter database :"DB_NAME" set wal_level = 'logical';
    exception when others then
        raise notice '跳过 wal_level 设置（需在 Neon Console 中配置）：%', sqlerrm;
    end;
end $$;

-- ---------------------------------------------------------------------------
-- 2. Neon 认证表对接说明
-- ---------------------------------------------------------------------------
--  本项目登录沿用 Supabase Auth（前端 window.sb.auth.*），因此 Neon 侧不启用
--  neon_auth。若将来要把认证也迁到 Neon，需额外执行：
--      npx neon auth        # 或在 Console 中启用 Managed Better Auth
--  届时 users.auth_id 应改为引用 neon_auth schema 的用户 ID，
--  当前 core 段中该列是普通 uuid，可直接复用。
