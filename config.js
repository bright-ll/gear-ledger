/* =========================================================
   本地配置
   ---------------------------------------------------------
   syncProvider:
     'gist'      → GitHub Gist 同步（免费，单人用）
     'cloudbase' → 腾讯云开发（多人用）
     ''          → 纯本地，不联网
   ========================================================= */
window.APP_CONFIG = {
  syncProvider: 'gist',

  // Gist 里存数据的文件名，不要改（改了会当成新文件）
  gistFile: 'gear-ledger.json',

  // 仅 syncProvider 为 'cloudbase' 时使用
  cloudbaseEnv: '',
  sdkUrl: 'https://static.cloudbase.net/cloudbase-js-sdk/3.11.0/cloudbase.full.js'
};
