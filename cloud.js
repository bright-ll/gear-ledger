/* =========================================================
   云同步层
   ---------------------------------------------------------
   两种后端，由 config.js 的 syncProvider 决定：
     'gist'      → GitHub Gist（免费、单人用、国内快）
     'cloudbase' → 腾讯云开发（多人、需账号体系）
     ''          → 纯本地
   ========================================================= */
(function () {
  'use strict';

  var cfg = window.APP_CONFIG || {};
  var PROVIDER = String(cfg.syncProvider || (cfg.cloudbaseEnv ? 'cloudbase' : '')).trim();
  var FILE_NAME = cfg.gistFile || 'gear-ledger.json';
  var TOKEN_KEY = 'gear.sync.token';

  var status = 'off';          // off | idle | syncing | ok | error
  var statusCb = null;
  var lastError = '';
  var timer = null;
  var syncing = false;

  function setStatus(s, err) {
    status = s;
    if (err) lastError = String((err && err.message) || err);
    if (statusCb) { try { statusCb(status, lastError); } catch (e) {} }
  }

  function onStatus(cb) { statusCb = cb; if (cb) cb(status, lastError); }

  /* ---------- 合并（两种后端共用） ---------- */
  // 示例数据不参与同步，避免污染真实账目
  function real(list) {
    return (list || []).filter(function (x) { return x && !x.demo; });
  }

  function merge(localList, remoteList) {
    var map = {};
    (localList || []).forEach(function (d) { if (d && d.id) map[d.id] = d; });
    (remoteList || []).forEach(function (r) {
      if (!r || !r.id) return;
      var l = map[r.id];
      if (!l || (r.updatedAt || 0) > (l.updatedAt || 0)) map[r.id] = r;
    });
    var out = [];
    for (var k in map) if (Object.prototype.hasOwnProperty.call(map, k)) out.push(map[k]);
    return out;
  }

  /* =========================================================
     后端一：GitHub Gist
     ========================================================= */
  var gist = {
    api: 'https://api.github.com',

    headers: function (token) {
      return {
        'Authorization': 'Bearer ' + token,
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/json'
      };
    },

    token: function () {
      try { return localStorage.getItem(TOKEN_KEY) || ''; } catch (e) { return ''; }
    },

    setToken: function (t) {
      try {
        if (t) localStorage.setItem(TOKEN_KEY, t);
        else localStorage.removeItem(TOKEN_KEY);
      } catch (e) {}
    },

    call: async function (path, opts) {
      var token = gist.token();
      if (!token) throw new Error('未连接 GitHub');
      var res = await fetch(gist.api + path, Object.assign({
        headers: gist.headers(token)
      }, opts || {}));
      if (res.status === 401) throw new Error('Token 无效或已过期');
      if (res.status === 403) throw new Error('Token 权限不足，需要 gist 权限');
      if (!res.ok) {
        var msg = '';
        try { msg = (await res.json()).message || ''; } catch (e) {}
        throw new Error('GitHub 返回 ' + res.status + (msg ? '：' + msg : ''));
      }
      return res.json();
    },

    ensureGist: async function () {
      var cached = '';
      try { cached = localStorage.getItem('gear.sync.gistId') || ''; } catch (e) {}
      if (cached) return cached;

      var list = await gist.call('/gists?per_page=100');
      var found = '';
      for (var i = 0; i < list.length; i++) {
        if (list[i].files && list[i].files[FILE_NAME]) { found = list[i].id; break; }
      }
      if (!found) {
        var created = await gist.call('/gists', {
          method: 'POST',
          body: JSON.stringify({
            description: '装备台账数据（勿删除）',
            public: false,
            files: (function () {
              var f = {}; f[FILE_NAME] = { content: '{"items":[],"gear":[]}' }; return f;
            })()
          })
        });
        found = created.id;
      }
      try { localStorage.setItem('gear.sync.gistId', found); } catch (e) {}
      return found;
    },

    read: async function (id) {
      var data = await gist.call('/gists/' + id);
      var file = data.files && data.files[FILE_NAME];
      if (!file) return { items: [], gear: [] };
      var raw = file.content;
      if (file.truncated && file.raw_url) {
        var r = await fetch(file.raw_url, { headers: gist.headers(gist.token()) });
        raw = await r.text();
      }
      try {
        var obj = JSON.parse(raw);
        return { items: obj.items || [], gear: obj.gear || [] };
      } catch (e) {
        return { items: [], gear: [] };
      }
    },

    write: async function (id, data) {
      var payload = { items: data.items, gear: data.gear, savedAt: Date.now() };
      var files = {};
      files[FILE_NAME] = { content: JSON.stringify(payload) };
      await gist.call('/gists/' + id, {
        method: 'PATCH',
        body: JSON.stringify({ files: files })
      });
    },

    boot: function () {
      return {
        enabled: true,
        loggedIn: !!gist.token(),
        tokenMode: true
      };
    },

    login: async function (token) {
      token = String(token || '').trim();
      if (!token) throw new Error('请填写 Token');
      gist.setToken(token);
      try {
        // 用 /gists 验证：正好能验证 gist 权限是否具备
        await gist.call('/gists?per_page=1');
      } catch (e) {
        gist.setToken('');
        throw new Error('Token 无效，或者没有 gist 权限');
      }
      await gist.ensureGist();
      setStatus('idle');
      return true;
    },

    logout: function () {
      gist.setToken('');
      try { localStorage.removeItem('gear.sync.gistId'); } catch (e) {}
      setStatus('idle');
    },

    sync: async function (DB) {
      var id = await gist.ensureGist();
      var remote = await gist.read(id);
      var merged = {
        items: merge(real(DB.items), remote.items),
        gear: merge(real(DB.gear), remote.gear)
      };
      await gist.write(id, merged);
      return merged;
    }
  };

  /* =========================================================
     后端二：腾讯云开发
     ========================================================= */
  var ENV = String(cfg.cloudbaseEnv || '').trim();
  var SDK_URL = cfg.sdkUrl || 'https://static.cloudbase.net/cloudbase-js-sdk/3.11.0/cloudbase.full.js';
  var COLLECTIONS = ['items', 'gear'];
  var app = null, auth = null, db = null, ready = false;

  function loadSDK() {
    return new Promise(function (resolve, reject) {
      if (window.cloudbase) return resolve();
      var s = document.createElement('script');
      s.src = SDK_URL;
      s.async = true;
      s.onload = function () { window.cloudbase ? resolve() : reject(new Error('SDK 加载异常')); };
      s.onerror = function () { reject(new Error('SDK 加载失败，检查网络')); };
      document.head.appendChild(s);
    });
  }

  var cloudbase = {
    clean: function (doc) {
      var out = {};
      for (var k in doc) {
        if (!Object.prototype.hasOwnProperty.call(doc, k)) continue;
        if (k === '_id' || k === '_openid') continue;
        out[k] = doc[k];
      }
      return out;
    },

    fetchAll: async function (name) {
      var out = [], page = 0, size = 100;
      for (;;) {
        var res = await db.collection(name).skip(page * size).limit(size).get();
        var list = (res && res.data) || [];
        out = out.concat(list);
        if (list.length < size) break;
        page++;
        if (page > 60) break;
      }
      return out;
    },

    pushAll: async function (name, merged, remote) {
      var remoteById = {};
      remote.forEach(function (r) { remoteById[r.id] = r; });
      for (var i = 0; i < merged.length; i++) {
        var local = merged[i];
        if (!local || !local.id) continue;
        var payload = cloudbase.clean(local);
        var r = remoteById[local.id];
        if (!r) {
          await db.collection(name).add(payload);
        } else if ((local.updatedAt || 0) > (r.updatedAt || 0)) {
          await db.collection(name).doc(r._id).update(payload);
        }
      }
    },

    boot: async function () {
      if (!ENV) return { enabled: false, loggedIn: false };
      try {
        await loadSDK();
        app = window.cloudbase.init({ env: ENV, persistence: 'local' });
        auth = app.auth({ persistence: 'local' });
        db = app.database();
        ready = true;
        var st = await auth.getLoginState();
        return { enabled: true, loggedIn: !!st, tokenMode: false };
      } catch (e) {
        ready = false;
        setStatus('error', e);
        return { enabled: true, loggedIn: false, tokenMode: false, error: e };
      }
    },

    login: async function (email, password) {
      if (!auth) throw new Error('尚未初始化');
      await auth.signInWithEmailAndPassword(email, password);
      setStatus('idle');
      return true;
    },

    logout: async function () {
      if (!auth) return;
      try { await auth.signOut(); } catch (e) {}
      setStatus('idle');
    },

    sync: async function (DB) {
      if (!ready) return null;
      var st = await auth.getLoginState();
      if (!st) return null;

      var remote = {};
      for (var i = 0; i < COLLECTIONS.length; i++) {
        remote[COLLECTIONS[i]] = await cloudbase.fetchAll(COLLECTIONS[i]);
      }
      var merged = {
        items: merge(real(DB.items), remote.items.map(cloudbase.clean)),
        gear: merge(real(DB.gear), remote.gear.map(cloudbase.clean))
      };
      for (var j = 0; j < COLLECTIONS.length; j++) {
        await cloudbase.pushAll(COLLECTIONS[j], merged[COLLECTIONS[j]], remote[COLLECTIONS[j]]);
      }
      return merged;
    },

    user: async function () {
      if (!auth) return null;
      try { return await auth.getLoginState(); } catch (e) { return null; }
    }
  };

  /* =========================================================
     对外统一接口
     ========================================================= */
  var impl = PROVIDER === 'gist' ? gist : (PROVIDER === 'cloudbase' ? cloudbase : null);

  async function sync(DB) {
    if (!impl) return null;
    if (PROVIDER === 'gist' && !gist.token()) { setStatus('idle'); return null; }
    if (syncing) return null;
    syncing = true;
    setStatus('syncing');
    try {
      var merged = await impl.sync(DB);
      setStatus('ok');
      return merged;
    } catch (e) {
      setStatus('error', e);
      return null;
    } finally {
      syncing = false;
    }
  }

  function scheduleSync(DB, delay) {
    if (!impl) return;
    if (PROVIDER === 'gist' && !gist.token()) return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(function () { timer = null; sync(DB); }, delay == null ? 2500 : delay);
  }

  window.Cloud = {
    provider: function () { return PROVIDER; },
    enabled: function () { return !!impl; },
    isReady: function () { return !!impl; },
    isTokenMode: function () { return PROVIDER === 'gist'; },

    boot: async function () {
      if (!impl) return { enabled: false, loggedIn: false };
      if (PROVIDER === 'cloudbase') {
        var r = await cloudbase.boot();
        setStatus('idle');
        return r;
      }
      return gist.boot();
    },

    login: function (a, b) {
      return PROVIDER === 'gist' ? gist.login(a) : cloudbase.login(a, b);
    },

    logout: function () { return impl.logout(); },
    user: function () { return impl.user ? impl.user() : null; },
    sync: sync,
    scheduleSync: scheduleSync,
    onStatus: onStatus,
    status: function () { return status; },
    lastError: function () { return lastError; },
    env: function () { return PROVIDER === 'cloudbase' ? ENV : 'gist'; }
  };
})();
