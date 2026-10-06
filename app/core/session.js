/* ============================================================================
 *  L3 · 会话与认证层
 *  ---------------------------------------------------------------------------
 *  本地缓存（localStorage）与 Supabase Auth 的双轨会话。
 *  登录/注册的数据层逻辑从 index.html 迁出，index.html 只保留界面与交互。
 * ============================================================================ */
(function (global) {
    'use strict';

    var cfg = global.SQ_CONFIG;

    // ---------------------------------------------------------------- 本地会话
    function getSessionUser() {
        var stored = localStorage.getItem(cfg.sessionKey);
        if (stored) return global.SQUtil.safeParse(stored, null);
        return null;
    }

    function setSessionUser(user) {
        localStorage.setItem(cfg.sessionKey, JSON.stringify(user));
    }

    function clearSession() {
        localStorage.removeItem(cfg.sessionKey);
        try { if (global.sb) global.sb.auth.signOut(); } catch (e) {}
    }

    /**
     * 用 Supabase Auth 的真实会话校验并刷新本地缓存，
     * 防止用户篡改 localStorage 里的 user 冒充他人/管理员。
     */
    async function syncSessionFromAuth() {
        if (!global.sb) return null;
        try {
            var r = await global.sb.auth.getSession();
            var session = r.data && r.data.session;
            if (!session || !session.user) {
                if (localStorage.getItem(cfg.sessionKey)) localStorage.removeItem(cfg.sessionKey);
                return null;
            }
            var q = await global.sb.from('users').select('*').eq('auth_id', session.user.id).limit(1);
            var user = q.data && q.data[0];
            if (user) {
                localStorage.setItem(cfg.sessionKey, JSON.stringify(user));
                return user;
            }
            return null;
        } catch (e) {
            return null;
        }
    }

    // ---------------------------------------------------------------- 工具
    /** 口令哈希（仅用于遗留老用户的密码校验兜底） */
    async function hashPassword(password) {
        var buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(password));
        return Array.from(new Uint8Array(buf))
            .map(function (b) { return b.toString(16).padStart(2, '0'); }).join('');
    }

    // ---------------------------------------------------------------- 注册
    function generateDefaultAvatar(nickname) {
        return global.SQUtil.avatarDataUri(nickname);
    }

    function genUserNo() {
        var d = new Date();
        var p = function (n) { return (n < 10 ? '0' : '') + n; };
        var ts = '' + d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) +
                     p(d.getHours()) + p(d.getMinutes()) + p(d.getSeconds());
        var letters = 'abcdefghijklmnopqrstuvwxyz';
        var r = '';
        for (var i = 0; i < 3; i++) r += letters.charAt(Math.floor(Math.random() * 26));
        return ts + r;
    }

    /**
     * 注册：Supabase Auth 建号 + 业务资料表落库
     * @returns {Promise<{user:object}|{error:string}>}
     */
    async function registerUser(phone, password, nickname) {
        var email = global.phoneToEmail(phone);
        var signRes = await global.sb.auth.signUp({ email: email, password: password });
        if (signRes.error) {
            if ((signRes.error.message || '').toLowerCase().indexOf('already') >= 0)
                return { error: 'phoneExists' };
            return { error: signRes.error };
        }
        var authId = signRes.data && signRes.data.user ? signRes.data.user.id : null;
        var avatar = generateDefaultAvatar(nickname);
        var res = await global.sb.from('users').insert([{
            phone: phone, nickname: nickname, avatar_url: avatar,
            user_no: genUserNo(), auth_id: authId
        }]).select();
        if (res.error) {
            if (res.error.code === '23505') return { error: 'phoneExists' };
            return { error: res.error };
        }
        return { user: res.data && res.data[0] };
    }

    /**
     * 登录。含老用户兼容：Auth 无号时用旧哈希校验并补建 Auth 账号。
     * @returns {Promise<{user:object}|{error:*}>}
     */
    async function loginUser(phone, password) {
        var email = global.phoneToEmail(phone);
        var signRes = await global.sb.auth.signInWithPassword({ email: email, password: password });

        if (signRes.error) {
            var hashed = await hashPassword(password);
            var oldRes = await global.sb.from('users').select('*').eq('phone', phone).eq('password', hashed);
            var oldUser = oldRes.data && oldRes.data[0];
            if (!oldUser) return { error: 'loginFail' };

            var su = await global.sb.auth.signUp({ email: email, password: password });
            if (su.error && (su.error.message || '').toLowerCase().indexOf('already') < 0)
                return { error: su.error };

            var newAuthId = su.data && su.data.user ? su.data.user.id : null;
            if (newAuthId) {
                await global.sb.from('users').update({ auth_id: newAuthId }).eq('id', oldUser.id);
                oldUser.auth_id = newAuthId;
            }
            await global.sb.auth.signInWithPassword({ email: email, password: password });
            return { user: oldUser };
        }

        var authUser = signRes.data.user;
        var q = await global.sb.from('users').select('*').eq('auth_id', authUser.id).limit(1);
        var user = q.data && q.data[0];
        if (!user) {
            var q2 = await global.sb.from('users').select('*').eq('phone', phone).limit(1);
            user = q2.data && q2.data[0];
            if (user) {
                await global.sb.from('users').update({ auth_id: authUser.id }).eq('id', user.id);
                user.auth_id = authUser.id;
            }
        }
        if (!user) return { error: 'loginFail' };
        return { user: user };
    }

    global.SQSession = {
        getSessionUser: getSessionUser,
        setSessionUser: setSessionUser,
        clearSession: clearSession,
        syncSessionFromAuth: syncSessionFromAuth,
        hashPassword: hashPassword,
        registerUser: registerUser,
        loginUser: loginUser,
        genUserNo: genUserNo,
        generateDefaultAvatar: generateDefaultAvatar
    };

    // 兼容既有全局调用
    global.getSessionUser = getSessionUser;
    global.setSessionUser = setSessionUser;
    global.clearSession = clearSession;
    global.syncSessionFromAuth = syncSessionFromAuth;
})(window);
