/* 七戚 · index页模块，由 app/index.html 内联脚本拆分，DOM区未动 */
        // ============================================================
        // Supabase 配置
        // ============================================================
        // Supabase 客户端已由 core/data.js 统一创建（凭据来源：core/config.js）

        // ============================================================
        // 设备 ID 相关
        // ============================================================
        var MAX_ACCOUNTS_PER_DEVICE = 2;

        function getDeviceId() {
            var id = localStorage.getItem('sq_device_id');
            if (!id) {
                if (window.crypto && crypto.randomUUID) {
                    id = 'dev_' + crypto.randomUUID();
                } else {
                    id = 'dev_' + Date.now() + '_' + Math.random().toString(36).slice(2);
                }
                localStorage.setItem('sq_device_id', id);
            }
            return id;
        }

        async function getDeviceRegisterCount(deviceId) {
            try {
                var res = await window.sb.from('device_registrations')
                    .select('id', { count: 'exact', head: true })
                    .eq('device_id', deviceId);
                if (res.error) throw res.error;
                return res.count || 0;
            } catch (e) {
                console.warn('设备检测失败:', e);
                return 0; // 检测失败不阻止注册
            }
        }

        async function recordDeviceRegistration(deviceId, userId, phone) {
            try {
                await window.sb.from('device_registrations').insert([{
                    device_id: deviceId,
                    user_id: userId,
                    phone: phone
                }]);
            } catch (e) {
                console.warn('设备记录写入失败:', e);
            }
        }

        async function refreshDeviceHint() {
            var hintEl = document.getElementById('deviceHint');
            var textEl = document.getElementById('deviceHintText');
            var t = T();
            var deviceId = getDeviceId();
            var count = await getDeviceRegisterCount(deviceId);
            var remain = MAX_ACCOUNTS_PER_DEVICE - count;

            if (remain <= 0) {
                hintEl.classList.add('warn');
                textEl.textContent = t.deviceLimitReached.replace('{n}', MAX_ACCOUNTS_PER_DEVICE);
                document.getElementById('registerBtn').disabled = true;
            } else {
                hintEl.classList.remove('warn');
                textEl.textContent = t.deviceHintLeft.replace('{n}', remain).replace('{total}', MAX_ACCOUNTS_PER_DEVICE);
            }
        }

        // ============================================================
        // 多语言
        // ============================================================
        var LANGS = {
            zh: {
                loginMainTitle: '欢迎回来',
                loginSubTitle: '登录以继续',
                registerMainTitle: '创建账户',
                registerSubTitle: '加入 Seven戚 社区',
                phoneLabel: '手机号',
                phonePh: '请输入手机号',
                passwordLabel: '密码',
                passwordPh: '请输入密码',
                regNickLabel: '昵称',
                regNickPh: '请输入昵称',
                regPhoneLabel: '手机号',
                regPhonePh: '请输入手机号',
                regPassLabel: '密码',
                regPassPh: '请设置密码（至少6位）',
                regPass2Label: '确认密码',
                regPass2Ph: '请再次输入密码',
                loginBtnText: '登录',
                registerBtnText: '注册',
                orText: '或',
                noAccountText: '没有账号？',
                toRegisterBtn: '去注册',
                hasAccountText: '已有账号？',
                toLoginBtn: '去登录',
                googleText: 'Google',
                githubText: 'Github',
                modalTitle: '无法登录',
                modalDescGoogle: '哪来的乐乐？你有谷歌账号吗就用',
                modalDescGithub: '哪来的乐乐？你有 Github 账号吗就用',
                fillAll: '请填写完整信息',
                badPhone: '手机号格式不正确（11位数字）',
                shortPwd: '密码至少6位',
                pwdMismatch: '两次密码不一致',
                nicknameTaken: '该昵称不可用，请使用其他名称',
                phoneExists: '手机号已注册',
                loginSuccess: '登录成功！',
                registerSuccess: '注册成功，请登录',
                logging: '登录中...',
                registering: '注册中...',
                loginFail: '手机号未注册或密码错误',
                deviceHintLeft: '本设备还可注册 {n} 个账号（上限 {total} 个）',
                deviceLimitReached: '本设备已注册 {n} 个账号，无法继续注册',
                deviceLimitTitle: '设备已达上限',
                deviceLimitBody: '本设备已注册 {n} 个账号，无法继续注册新账号。\n\n如有特殊情况，请联系管理员。'
            },
            en: {
                loginMainTitle: 'Welcome back',
                loginSubTitle: 'Sign in to continue',
                registerMainTitle: 'Create account',
                registerSubTitle: 'Join Seven Qi Community',
                phoneLabel: 'Phone',
                phonePh: 'Enter phone number',
                passwordLabel: 'Password',
                passwordPh: 'Enter password',
                regNickLabel: 'Nickname',
                regNickPh: 'Enter nickname',
                regPhoneLabel: 'Phone',
                regPhonePh: 'Enter phone number',
                regPassLabel: 'Password',
                regPassPh: 'At least 6 characters',
                regPass2Label: 'Confirm password',
                regPass2Ph: 'Re-enter password',
                loginBtnText: 'Login',
                registerBtnText: 'Register',
                orText: 'OR',
                noAccountText: "Don't have an account?",
                toRegisterBtn: 'Sign up',
                hasAccountText: 'Already have an account?',
                toLoginBtn: 'Log in',
                googleText: 'Google',
                githubText: 'Github',
                modalTitle: 'Login Unavailable',
                modalDescGoogle: "Where'd you come from? You got a Google account?",
                modalDescGithub: "Where'd you come from? You got a Github account?",
                fillAll: 'Please fill in all fields',
                badPhone: 'Invalid phone number (11 digits)',
                shortPwd: 'Password must be at least 6 characters',
                pwdMismatch: 'Passwords do not match',
                nicknameTaken: 'This nickname is unavailable',
                phoneExists: 'Phone number already registered',
                loginSuccess: 'Login successful!',
                registerSuccess: 'Registered, please log in',
                logging: 'Logging in...',
                registering: 'Registering...',
                loginFail: 'Phone not registered or wrong password',
                deviceHintLeft: 'This device can register {n} more account(s) (max {total})',
                deviceLimitReached: 'This device has registered {n} accounts. Registration disabled.',
                deviceLimitTitle: 'Device Limit Reached',
                deviceLimitBody: 'This device has registered {n} accounts. You cannot register more.\n\nContact admin if needed.'
            }
        };
        var currentLang = 'zh';
        function T() { return LANGS[currentLang]; }

        function applyLang(lang) {
            currentLang = lang;
            var t = T();
            document.documentElement.lang = lang;

            document.querySelectorAll('.lang-btn').forEach(function(b) {
                b.classList.toggle('active', b.dataset.lang === lang);
            });

            document.getElementById('loginMainTitle').textContent = t.loginMainTitle;
            document.getElementById('loginSubTitle').textContent = t.loginSubTitle;
            document.getElementById('phoneLabel').textContent = t.phoneLabel;
            document.getElementById('passwordLabel').textContent = t.passwordLabel;
            document.getElementById('loginPhone').placeholder = t.phonePh;
            document.getElementById('loginPassword').placeholder = t.passwordPh;
            document.getElementById('loginBtnText').textContent = t.loginBtnText;
            document.getElementById('orText').textContent = t.orText;
            document.getElementById('noAccountText').textContent = t.noAccountText;
            document.getElementById('toRegisterBtn').textContent = t.toRegisterBtn;
            document.getElementById('googleText').textContent = t.googleText;
            document.getElementById('githubText').textContent = t.githubText;

            document.getElementById('registerMainTitle').textContent = t.registerMainTitle;
            document.getElementById('registerSubTitle').textContent = t.registerSubTitle;
            document.getElementById('regNickLabel').textContent = t.regNickLabel;
            document.getElementById('regPhoneLabel').textContent = t.regPhoneLabel;
            document.getElementById('regPassLabel').textContent = t.regPassLabel;
            document.getElementById('regPass2Label').textContent = t.regPass2Label;
            document.getElementById('regNick').placeholder = t.regNickPh;
            document.getElementById('regPhone').placeholder = t.regPhonePh;
            document.getElementById('regPassword').placeholder = t.regPassPh;
            document.getElementById('regPassword2').placeholder = t.regPass2Ph;
            document.getElementById('registerBtnText').textContent = t.registerBtnText;
            document.getElementById('hasAccountText').textContent = t.hasAccountText;
            document.getElementById('toLoginBtn').textContent = t.toLoginBtn;

            // 刷新设备提示（会用到语言包）
            if (document.getElementById('registerCard').classList.contains('active')) {
                refreshDeviceHint();
            }
        }

        // ============================================================
        // 工具
        // ============================================================
        function showToast(msg) {
            var toast = document.getElementById('toast');
            toast.textContent = msg;
            toast.classList.add('show');
            clearTimeout(window.toastTimer);
            window.toastTimer = setTimeout(function() { toast.classList.remove('show'); }, 2500);
        }

        function showModal(title, body, isWarn) {
            document.getElementById('uiModalTitle').textContent = title;
            document.getElementById('uiModalBody').textContent = body;
            var iconWrap = document.getElementById('uiModalIconWrap');
            if (isWarn) iconWrap.classList.add('warn');
            else iconWrap.classList.remove('warn');
            document.getElementById('uiModal').classList.add('active');
        }
        document.getElementById('uiModalBtn').onclick = function() {
            document.getElementById('uiModal').classList.remove('active');
        };
        document.getElementById('uiModal').addEventListener('click', function(e) {
            if (e.target === this) this.classList.remove('active');
        });

        // 手机号/哈希/头像/编号工具已收敛到 core（SQ_CONFIG.phoneToEmail / SQSession），此处不再重复定义。

        // ============================================================
        // 卡片切换
        // ============================================================
        function showLoginCard() {
            document.getElementById('loginCard').classList.add('active');
            document.getElementById('registerCard').classList.remove('active');
            document.getElementById('loginError').textContent = '';
            document.getElementById('registerError').textContent = '';
        }
        function showRegisterCard() {
            document.getElementById('registerCard').classList.add('active');
            document.getElementById('loginCard').classList.remove('active');
            document.getElementById('loginError').textContent = '';
            document.getElementById('registerError').textContent = '';
            // 进入注册卡片时刷新设备提示
            refreshDeviceHint();
        }
        document.getElementById('toRegisterBtn').onclick = showRegisterCard;
        document.getElementById('toLoginBtn').onclick = showLoginCard;

        // ============================================================
        // 登录/注册
        // ============================================================
        // 注册/登录数据层已收敛到 SQSession（core/session.js），此处只做错误文案适配。
        async function registerUser(phone, password, nickname) {
            var r = await window.SQSession.registerUser(phone, password, nickname);
            if (r.error) {
                if (r.error === 'phoneExists') throw new Error(T().phoneExists);
                throw r.error;
            }
            return r.user;
        }

        async function loginUser(phone, password) {
            var r = await window.SQSession.loginUser(phone, password);
            if (r.error) {
                if (r.error === 'loginFail') throw new Error(T().loginFail);
                throw r.error;
            }
            return r.user;
        }

        function handleLogin() {
            var t = T();
            var phone = document.getElementById('loginPhone').value.trim();
            var password = document.getElementById('loginPassword').value.trim();
            var errEl = document.getElementById('loginError');
            var btn = document.getElementById('loginBtn');

            if (!phone || !password) { errEl.textContent = t.fillAll; return; }
            if (!/^\d{11}$/.test(phone)) { errEl.textContent = t.badPhone; return; }
            if (password.length < 6) { errEl.textContent = t.shortPwd; return; }

            errEl.textContent = t.logging;
            btn.disabled = true;

            loginUser(phone, password)
                .then(function(user) {
                    errEl.textContent = '';
                    localStorage.setItem('sq_user_session', JSON.stringify(user));
                    showToast(t.loginSuccess);
                    var now = new Date();
                    var bannedUntil = user.banned_until ? new Date(user.banned_until) : null;
                    if (bannedUntil && bannedUntil > now) {
                        console.warn('用户已被封禁，仍可浏览');
                    }
                    setTimeout(function() {
                        window.location.href = '/liuyanban/posts.html';
                    }, 400);
                })
                .catch(function(err) {
                    errEl.textContent = err.message || t.loginFail;
                    btn.disabled = false;
                });
        }

        async function handleRegister() {
            var t = T();
            var nickname = document.getElementById('regNick').value.trim();
            var phone = document.getElementById('regPhone').value.trim();
            var password = document.getElementById('regPassword').value.trim();
            var password2 = document.getElementById('regPassword2').value.trim();
            var errEl = document.getElementById('registerError');
            var btn = document.getElementById('registerBtn');

            if (!nickname || !phone || !password || !password2) { errEl.textContent = t.fillAll; return; }
            if (nickname.toLowerCase() === 'seven戚') { errEl.textContent = t.nicknameTaken; return; }
            if (!/^\d{11}$/.test(phone)) { errEl.textContent = t.badPhone; return; }
            if (password.length < 6) { errEl.textContent = t.shortPwd; return; }
            if (password !== password2) { errEl.textContent = t.pwdMismatch; return; }

            // ============ 设备检测 ============
            var deviceId = getDeviceId();
            btn.disabled = true;
            errEl.textContent = t.registering;

            var count = await getDeviceRegisterCount(deviceId);
            if (count >= MAX_ACCOUNTS_PER_DEVICE) {
                errEl.textContent = '';
                btn.disabled = false;
                showModal(
                    t.deviceLimitTitle,
                    t.deviceLimitBody.replace('{n}', MAX_ACCOUNTS_PER_DEVICE),
                    true
                );
                return;
            }

            // ============ 注册 ============
            registerUser(phone, password, nickname)
                .then(async function(newUser) {
                    errEl.textContent = '';
                    // 记录设备注册历史
                    if (newUser && newUser.id) {
                        await recordDeviceRegistration(deviceId, newUser.id, phone);
                    }
                    showToast(t.registerSuccess);
                    showLoginCard();
                    document.getElementById('loginPhone').value = phone;
                    document.getElementById('loginPassword').value = '';
                    document.getElementById('loginPassword').focus();
                    document.getElementById('regNick').value = '';
                    document.getElementById('regPhone').value = '';
                    document.getElementById('regPassword').value = '';
                    document.getElementById('regPassword2').value = '';
                    btn.disabled = false;
                })
                .catch(function(err) {
                    errEl.textContent = err.message || '注册失败';
                    btn.disabled = false;
                    console.error('注册失败:', err);
                });
        }

        document.getElementById('loginBtn').onclick = handleLogin;
        document.getElementById('registerBtn').onclick = handleRegister;

        // ============================================================
        // 第三方登录
        // ============================================================
        document.getElementById('googleBtn').onclick = function(e) {
            e.preventDefault();
            showModal(T().modalTitle, T().modalDescGoogle);
        };
        document.getElementById('githubBtn').onclick = function(e) {
            e.preventDefault();
            showModal(T().modalTitle, T().modalDescGithub);
        };

        // ============================================================
        // 语言切换
        // ============================================================
        document.querySelectorAll('.lang-btn').forEach(function(btn) {
            btn.onclick = function() {
                applyLang(this.dataset.lang);
            };
        });

        // ============================================================
        // 回车提交
        // ============================================================
        document.querySelectorAll('input').forEach(function(inp) {
            inp.addEventListener('keydown', function(e) {
                if (e.key === 'Enter') {
                    if (document.getElementById('loginCard').classList.contains('active')) {
                        handleLogin();
                    } else {
                        handleRegister();
                    }
                }
            });
        });

        // ============================================================
        // 已登录自动跳转
        // ============================================================
        (async function checkSession() {
            // 优先用 Supabase Auth 会话判断是否已登录
            try {
                if (window.sb) {
                    var r = await window.sb.auth.getSession();
                    var authSession = r.data && r.data.session;
                    if (authSession && authSession.user) {
                        // Auth 已登录：补全本地缓存后跳转
                        var q = await window.sb.from('users').select('*').eq('auth_id', authSession.user.id).limit(1);
                        var u = q.data && q.data[0];
                        if (u) {
                            localStorage.setItem('sq_user_session', JSON.stringify(u));
                            window.location.href = '/liuyanban/posts.html';
                            return;
                        }
                    }
                }
            } catch (e) {}
            // 兜底：本地缓存
            var session = localStorage.getItem('sq_user_session');
            if (session) {
                try {
                    var user = JSON.parse(session);
                    if (user && user.id) {
                        window.location.href = '/liuyanban/posts.html';
                        return;
                    }
                } catch (e) {}
            }
            applyLang('zh');
            showLoginCard();
        })();

        document.addEventListener('gesturestart', function(e) { e.preventDefault(); });