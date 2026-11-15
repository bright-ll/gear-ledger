/* =========================================================
   我的物品 · 日均成本台账
   纯前端，数据存 localStorage
   ========================================================= */
(function () {
  'use strict';

  /* ---------- 常量 ---------- */
  var LS = 'gearLedger.v2';
  var DEMO_TIP_KEY = 'gearLedger.v2.demoTipClosed';
  var LS_CATS = 'gearLedger.cats';
  var LS_CUR = 'gearLedger.cur';
  var LS_THEME = 'gearLedger.theme';
  var DEFAULT_CATS = ['户外', '数码', '家电', '生活用品', '家具', '其他'];
  var CATS = loadCats();
  var CURS = ['¥', '$', '€', '£', '₩'];
  var CUR = (function () {
    try {
      var v = localStorage.getItem(LS_CUR);
      return CURS.indexOf(v) >= 0 ? v : '¥';
    } catch (e) { return '¥'; }
  })();
  var STATES = ['全部', '服役中', '已超期', '已退役', '预备役'];
  var PRICE_RANGES = [
    { k: '全部', label: '全部' },
    { k: 'lt500', label: '500 以下' },
    { k: '500to1500', label: '500–1500' },
    { k: '1500to3000', label: '1500–3000' },
    { k: 'gt3000', label: '3000 以上' }
  ];
  var GEAR_CATS = ['户外', '睡眠', '背负', '鞋靴', '照明', '炊具', '其他'];
  var ICONS = ['🎒','🧥','👟','🥾','⛺','🛌','🔦','🧭','🍳','💧','🧦','🧤','🧢','🕶','⌚',
               '🔋','📱','💻','🎧','📷','🔌','💡','🖥','⌨️','🖱',
               '🪑','🛋','🛏','🗄','🚪','🏠','🧺','🧽','🧴','🪥',
               '📦','🏺','🎁','📚','✏️','🪣','🔧','🪛','🚲','🎿'];

  /* ---------- 工具 ---------- */
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  function loadCats() {
    try {
      var raw = localStorage.getItem('gearLedger.cats');
      if (!raw) return DEFAULT_CATS.slice();
      var a = JSON.parse(raw);
      if (!Array.isArray(a)) return DEFAULT_CATS.slice();
      a = a.filter(function (c) { return typeof c === 'string' && c.trim(); });
      return a.length ? a : DEFAULT_CATS.slice();
    } catch (e) { return DEFAULT_CATS.slice(); }
  }
  function saveCats() {
    try { localStorage.setItem(LS_CATS, JSON.stringify(CATS)); } catch (e) {}
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
    });
  }
  function group(n, dropZero) {
    var s = (Number(n) || 0).toFixed(2);
    if (dropZero) s = s.replace(/\.00$/, '');
    var p = s.split('.');
    p[0] = p[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return p.join('.');
  }
  function money(n) { return group(n, false); }
  function money2(n) { return group(n, true); }
  function todayStr() {
    var d = new Date();
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function parseDate(s) {
    if (!s) return null;
    var p = String(s).split('-');
    if (p.length !== 3) return null;
    var d = new Date(+p[0], +p[1] - 1, +p[2]);
    return isNaN(d) ? null : d;
  }
  function diffDays(from, to) {
    var a = parseDate(from), b = parseDate(to || todayStr());
    if (!a || !b) return 0;
    return Math.max(0, Math.round((b - a) / 86400000));
  }
  function addDays(s, n) {
    var d = parseDate(s);
    if (!d) return '';
    d.setDate(d.getDate() + n);
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }
  function fmtDate(s) {
    var d = parseDate(s);
    if (!d) return '—';
    return d.getFullYear() + '年' + (d.getMonth() + 1) + '月' + d.getDate() + '日';
  }
  function uid() { return 'i' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

  var toastTimer;
  function toast(msg) {
    var t = $('#toast');
    t.textContent = msg;
    t.classList.add('on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove('on'); }, 1900);
  }

  /* ---------- 存储 ---------- */
  function load(key, fallback) {
    try {
      var raw = localStorage.getItem(LS);
      if (!raw) return fallback;
      var obj = JSON.parse(raw);
      return obj[key] == null ? fallback : obj[key];
    } catch (e) { return fallback; }
  }
  function saveAll() {
    try {
      localStorage.setItem(LS, JSON.stringify({ items: DB.items, gear: DB.gear }));
    } catch (e) {
      toast('本地存储不可用，刷新后会丢失');
    }
    if (window.Cloud && Cloud.enabled() && Cloud.isReady()) {
      Cloud.scheduleSync(DB);
    }
  }

  /* ---------- 示例数据 ---------- */
  function seedItems() {
    return [
      { id: 's1', name: '充电宝', cat: '数码', icon: '🔋', purchaseDate: '2026-11-10',
        price: 178, qty: 1, extra: 0, lifeValue: 0, lifeUnit: '年', hasExpiry: false,
        status: '服役中', subtractResale: false, resale: 0, trackPerUse: false, baseCount: 0, useLog: [], notes: '' },
      { id: 's2', name: '排骨鹅绒服', cat: '户外', icon: '🧥', purchaseDate: '2026-11-01',
        price: 400, qty: 1, extra: 0, lifeValue: 5, lifeUnit: '年', hasExpiry: true,
        status: '服役中', subtractResale: false, resale: 0, trackPerUse: true, baseCount: 3, useLog: [], notes: '700蓬，约 380g' },
      { id: 's3', name: '鞋垫', cat: '户外', icon: '👟', purchaseDate: '2026-10-26',
        price: 84, qty: 1, extra: 0, lifeValue: 2, lifeUnit: '年', hasExpiry: true,
        status: '服役中', subtractResale: false, resale: 0, trackPerUse: false, baseCount: 0, useLog: [], notes: '' },
      { id: 's4', name: '存钱罐', cat: '生活用品', icon: '🏺', purchaseDate: '2026-10-12',
        price: 28, qty: 1, extra: 0, lifeValue: 0, lifeUnit: '年', hasExpiry: false,
        status: '服役中', subtractResale: false, resale: 0, trackPerUse: false, baseCount: 0, useLog: [], notes: '' },
      { id: 's5', name: '美利羊毛袜子', cat: '户外', icon: '🧦', purchaseDate: '2026-10-18',
        price: 148, qty: 2, extra: 0, lifeValue: 3, lifeUnit: '年', hasExpiry: true,
        status: '服役中', subtractResale: false, resale: 0, trackPerUse: true, baseCount: 8, useLog: [], notes: '两双轮换' },
      { id: 's6', name: '三层压胶冲锋衣', cat: '户外', icon: '🧥', catalogId: 'g1', purchaseDate: '2025-03-15',
        price: 2899, qty: 1, extra: 0, lifeValue: 5, lifeUnit: '年', hasExpiry: true,
        status: '服役中', subtractResale: true, resale: 800, trackPerUse: true, baseCount: 21, useLog: [], notes: 'GORE-TEX 3L' },
      { id: 's7', name: '65L 重装背包', cat: '户外', icon: '🎒', catalogId: 'g8', purchaseDate: '2024-09-20',
        price: 1699, qty: 1, extra: 0, lifeValue: 8, lifeUnit: '年', hasExpiry: true,
        status: '服役中', subtractResale: false, resale: 0, trackPerUse: true, baseCount: 12, useLog: [], notes: '' },
      { id: 's8', name: '旧款头灯', cat: '户外', icon: '🔦', purchaseDate: '2021-06-01',
        price: 259, qty: 1, extra: 0, lifeValue: 3, lifeUnit: '年', hasExpiry: true,
        status: '服役中', subtractResale: false, resale: 0, trackPerUse: false, baseCount: 0, useLog: [], notes: '已超期，考虑换新' }
    ];
  }

  function seedGear() {
    return [
      { id: 'g1', name: '三层压胶冲锋衣', brand: '山野', cat: '户外', type: '硬壳冲锋衣',
        refPrice: 2899, icon: '🧥', fav: false,
        tags: ['GORE-TEX 3L', '20000mm', '420g'],
        specs: [{ k: '面料', v: 'GORE-TEX 3L' }, { k: '压胶工艺', v: '全压胶' },
                { k: '整衣重量', v: '420 g' }, { k: '版型', v: '常规' }],
        perf: [
          { k: '防水指数', v: '20000 mmH2O', grade: '专业暴雨防护', level: 'excellent', desc: '可应对持续暴雨、高海拔降雪等极端恶劣天气，性能顶尖。' },
          { k: '防风指数', v: '1 CFM', grade: '优秀', level: 'good', desc: '几乎完全阻断风寒，适合大风山脊线。' },
          { k: '透气性', v: 'RET < 6', grade: '良好', level: 'good', desc: '高强度爬升时湿气排出较快，不至于闷汗。' }
        ] },
      { id: 'g2', name: '超轻双人帐', brand: '云居', cat: '户外', type: '三季帐',
        refPrice: 3299, icon: '⛺', fav: false,
        tags: ['1.2kg', '15D', '双人'],
        specs: [{ k: '面料', v: '15D 硅涂层尼龙' }, { k: '整帐重量', v: '1.2 kg' },
                { k: '人数', v: '2 人' }, { k: '季节', v: '三季' }],
        perf: [
          { k: '防水指数', v: '3000 mm', grade: '良好', level: 'good', desc: '常规中雨无压力，长时间暴雨需注意底部积水。' },
          { k: '抗风性', v: '8 级', grade: '优秀', level: 'good', desc: '交叉杆结构，山脊线过夜表现稳定。' },
          { k: '打包体积', v: '4.5 L', grade: '优秀', level: 'excellent', desc: '可轻松塞进 50L 背包底部。' }
        ] },
      { id: 'g3', name: '鹅绒睡袋 -10℃', brand: '暖山', cat: '睡眠', type: '羽绒睡袋',
        refPrice: 1299, icon: '🛌', fav: false,
        tags: ['700FP', '1050g', '-10℃'],
        specs: [{ k: '填充物', v: '90/10 白鹅绒' }, { k: '蓬松度', v: '700 FP' },
                { k: '总重', v: '1050 g' }, { k: '舒适温标', v: '-10 ℃' }],
        perf: [
          { k: '保暖性', v: '舒适 -10℃', grade: '优秀', level: 'good', desc: '四姑娘山大本营、冬季露营够用。' },
          { k: '收纳体积', v: '6.8 L', grade: '良好', level: 'mid', desc: '压缩后偏大，重装背负更合适。' }
        ] },
      { id: 'g4', name: '碳纤维登山杖', brand: '岩行', cat: '户外', type: '登山杖',
        refPrice: 399, icon: '🥾', fav: false,
        tags: ['420g/对', '三节', '快扣'],
        specs: [{ k: '材质', v: '3K 碳纤维' }, { k: '单支重量', v: '210 g' },
                { k: '收缩长度', v: '62 cm' }, { k: '锁扣', v: '外锁快扣' }],
        perf: [
          { k: '减震', v: '无', grade: '一般', level: 'mid', desc: '硬杖设计，下坡冲击直接传导，习惯软杖的需适应。' },
          { k: '承重', v: '≤120 kg', grade: '优秀', level: 'good', desc: '重装下坡大量依赖时依然稳定。' }
        ] },
      { id: 'g5', name: '中帮徒步鞋', brand: '野径', cat: '鞋靴', type: '徒步鞋',
        refPrice: 1099, icon: '👟', fav: false,
        tags: ['GTX', '620g', '中帮'],
        specs: [{ k: '鞋面', v: '翻毛皮 + GTX 内衬' }, { k: '单只重量', v: '620 g' },
                { k: '大底', v: 'Vibram Megagrip' }, { k: '鞋帮', v: '中帮' }],
        perf: [
          { k: '防滑性', v: '湿滑岩石良好', grade: '优秀', level: 'good', desc: 'Megagrip 配方在湿石上表现稳定。' },
          { k: '防水性', v: '短时间涉水', grade: '良好', level: 'good', desc: '小雨无压力，连续涉水会从鞋口进水。' }
        ] },
      { id: 'g6', name: '400 流明头灯', brand: '星野', cat: '照明', type: '头灯',
        refPrice: 259, icon: '🔦', fav: false,
        tags: ['400lm', '78g', 'IPX6'],
        specs: [{ k: '最大亮度', v: '400 lm' }, { k: '重量', v: '78 g' },
                { k: '防水等级', v: 'IPX6' }, { k: '续航', v: '高亮 4h' }],
        perf: [
          { k: '亮度', v: '400 lm', grade: '优秀', level: 'good', desc: '夜爬找路足够，营地使用需调低档。' },
          { k: '续航', v: '高亮 4 h', grade: '一般', level: 'mid', desc: '长线建议带备用电池。' }
        ] },
      { id: 'g7', name: '气罐炉头', brand: '火石', cat: '炊具', type: '炉头',
        refPrice: 189, icon: '🍳', fav: false,
        tags: ['96g', '2800W', '一体式'],
        specs: [{ k: '重量', v: '96 g' }, { k: '功率', v: '2800 W' },
                { k: '点火', v: '压电点火' }, { k: '燃料', v: '扁气罐' }],
        perf: [
          { k: '抗风', v: '一般', grade: '一般', level: 'mid', desc: '大风天需配挡风板。' },
          { k: '烧水速度', v: '1L / 3.5min', grade: '优秀', level: 'good', desc: '海拔 4000m 以内表现稳定。' }
        ] },
      { id: 'g8', name: '65L 重装背包', brand: '山野', cat: '背负', type: '重装包',
        refPrice: 1699, icon: '🎒', fav: false,
        tags: ['1.45kg', '65L', '210D'],
        specs: [{ k: '面料', v: '210D 尼龙' }, { k: '容量', v: '65 L' },
                { k: '自重', v: '1.45 kg' }, { k: '背负系统', v: '铝条 + 腰封' }],
        perf: [
          { k: '承重舒适区', v: '15-20 kg', grade: '优秀', level: 'excellent', desc: '重装长线主力包，腰封传力充分。' },
          { k: '耐磨性', v: '210D', grade: '良好', level: 'good', desc: '常规使用足够，岩壁蹭挂仍需注意。' }
        ] }
    ];
  }

  /* ---------- 状态 ---------- */
  function markDemo(list) {
    (list || []).forEach(function (x) { x.demo = true; });
    return list;
  }

  var hasLocal = !!load('items', null);
  var DB = {
    items: hasLocal ? load('items', null) : markDemo(seedItems()),
    gear: load('gear', null) || markDemo(seedGear())
  };
  if (!hasLocal) {
    // 示例数据打上标记：永远不会被同步到云端
    saveAll();
  }

  // 老数据里的「设置有效期」之前没生效，一次性给有年限的记录打开，
  // 避免升级后这些物品突然不再提示超期
  (function migrateExpiry() {
    var FLAG = 'gearLedger.v2.expiryFixed';
    try {
      if (localStorage.getItem(FLAG)) return;
    } catch (e) { return; }
    var changed = false;
    DB.items.forEach(function (x) {
      if (!x.hasExpiry && Number(x.lifeValue) > 0) { x.hasExpiry = true; changed = true; }
    });
    try { localStorage.setItem(FLAG, '1'); } catch (e) {}
    if (changed) saveAll();
  })();

  var state = {
    tab: 'assets',
    status: '全部',
    cat: '全部分类',
    sort: 'date',
    q: '',
    assetView: (function () {
      try {
        var v = localStorage.getItem('gear-ledger-asset-view');
        return (v === 'text' || v === 'grid') ? v : 'list';
      } catch (e) { return 'list'; }
    })(),
    gearCat: '全部',
    gearQ: '',
    gearBrand: '全部',
    gearType: '全部',
    gearPrice: '全部',
    gearFav: false,
    gearView: (function () {
      try {
        var v = localStorage.getItem('gear-ledger-view');
        return (v === 'text' || v === 'list') ? v : 'grid';
      } catch (e) { return 'grid'; }
    })(),
    gearCollapsed: {},
    detailId: null,
    gearId: null,
    editingId: null,
    editingGearId: null,
    formIcon: '📦',
    gearFormIcon: '📦'
  };

  /* ---------- 计算 ---------- */
  function lifeDays(it) {
    var v = Number(it.lifeValue) || 0;
    if (!v) return 0;
    if (it.lifeUnit === '年') return Math.round(v * 365);
    if (it.lifeUnit === '月') return Math.round(v * 30);
    return Math.round(v);
  }

  function calc(it) {
    var price = Number(it.price) || 0;
    var qty = Number(it.qty) || 1;
    var total = price * qty + (Number(it.extra) || 0);
    var days = diffDays(it.purchaseDate);
    var life = lifeDays(it);
    var expireAt = life ? addDays(it.purchaseDate, life) : '';
    // 「设置有效期」关闭时只算持有天数和日均，不再提示超期
    var overdue = !!(it.hasExpiry && expireAt && todayStr() > expireAt);
    var net = it.subtractResale ? Math.max(total - (Number(it.resale) || 0), 0) : total;
    var daily = net / Math.max(days, 1);
    var used = (Number(it.baseCount) || 0) + (it.useLog ? it.useLog.length : 0);
    var perUse = it.trackPerUse && used > 0 ? net / used : null;
    return {
      total: total, net: net, days: days, life: life, expireAt: expireAt, overdue: overdue,
      daily: daily, used: used, perUse: perUse
    };
  }

  function statusOf(it, c) {
    if (it.status === '已退役') return '已退役';
    if (it.status === '预备役') return '预备役';
    return c.overdue ? '已超期' : '服役中';
  }

  function iconBg(cat) {
    var map = {
      '户外': 'linear-gradient(150deg,#eef4ff,#e0e9ff)',
      '数码': 'linear-gradient(150deg,#f3efff,#e9e2ff)',
      '家电': 'linear-gradient(150deg,#eefaf4,#ddf3e8)',
      '生活用品': 'linear-gradient(150deg,#fff6ec,#ffe9d6)',
      '家具': 'linear-gradient(150deg,#f7f2ea,#efe3d3)',
      '其他': 'linear-gradient(150deg,#f7f8fc,#eceef8)'
    };
    return map[cat] || map['其他'];
  }

  function filteredItems() {
    var q = state.q.trim().toLowerCase();
    return DB.items.filter(function (it) {
      if (it.deleted) return false;
      var c = calc(it);
      if (state.status !== '全部' && statusOf(it, c) !== state.status) return false;
      if (state.cat !== '全部分类' && it.cat !== state.cat) return false;
      if (q) {
        var hay = (it.name + ' ' + (it.notes || '') + ' ' + it.cat).toLowerCase();
        if (hay.indexOf(q) < 0) return false;
      }
      return true;
    }).sort(function (a, b) {
      var ca = calc(a), cb = calc(b);
      if (state.sort === 'daily') return cb.daily - ca.daily;
      if (state.sort === 'price') return cb.net - ca.net;
      if (state.sort === 'days') return cb.days - ca.days;
      return (b.purchaseDate || '').localeCompare(a.purchaseDate || '');
    });
  }

  /* =========================================================
     渲染：资产列表
     ========================================================= */
  function renderTopbar() {
    $('#state-tabs').innerHTML = STATES.map(function (s) {
      return '<button data-state="' + s + '" class="' + (state.status === s ? 'on' : '') + '">' + s + '</button>';
    }).join('');
  }

  /* ---------- 横滑筛选条：保持选中项可见 + 右缘提示 ---------- */
  function updateChipsEdge(box) {
    if (!box || !box.clientWidth) return;
    box.classList.toggle('at-end', box.scrollLeft + box.clientWidth >= box.scrollWidth - 2);
  }

  function syncChips(box) {
    if (!box || !box.clientWidth) return;
    var on = box.querySelector('.chip.on');
    if (on) {
      var b = box.getBoundingClientRect();
      var r = on.getBoundingClientRect();
      var padL = 2, padR = 10; /* 右侧留出渐隐宽度，避免选中项糊在边上 */
      if (r.left < b.left + padL) {
        box.scrollLeft = Math.max(0, box.scrollLeft - (b.left + padL - r.left));
      } else if (r.right > b.right - padR) {
        box.scrollLeft = box.scrollLeft + (r.right - b.right + padR);
      }
    }
    updateChipsEdge(box);
  }

  function renderChips(box, html) {
    if (!box) return;
    var keep = box.scrollLeft;   /* 重绘后回到原位置，不要跳回开头 */
    box.innerHTML = html;
    box.scrollLeft = keep;
    syncChips(box);
  }

  /* 桌面端：鼠标按住拖动也能横滑（触屏继续走系统原生滑动） */
  function bindChipsDrag(box) {
    if (!box) return;
    var down = false, moved = false, startX = 0, startLeft = 0;

    box.addEventListener('pointerdown', function (e) {
      if (e.pointerType !== 'mouse' || e.button !== 0) return;
      down = true; moved = false;
      startX = e.clientX; startLeft = box.scrollLeft;
      /* 注意：这里不能 setPointerCapture，否则 click 的目标会变成整个筛选条，
         里面的分类按钮就点不动了。只有真正拖起来才捕获。 */
    });

    box.addEventListener('pointermove', function (e) {
      if (!down) return;
      var dx = e.clientX - startX;
      if (!moved && Math.abs(dx) < 8) return;
      if (!moved) {
        moved = true;
        try { box.setPointerCapture(e.pointerId); } catch (err) {}
        box.classList.add('dragging');
      }
      box.scrollLeft = startLeft - dx;
    });

    function endDrag(e) {
      if (!down) return;
      down = false;
      box.classList.remove('dragging');
      try { box.releasePointerCapture(e.pointerId); } catch (err) {}
    }
    box.addEventListener('pointerup', endDrag);
    box.addEventListener('pointercancel', endDrag);

    /* 鼠标滚轮：在筛选条上直接横向滚（滑到头再把滚动交还页面） */
    box.addEventListener('wheel', function (e) {
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;      /* 触控板横向交给系统 */
      if (box.scrollWidth <= box.clientWidth + 1) return;       /* 没溢出就不拦 */
      var atStart = box.scrollLeft <= 0 && e.deltaY < 0;
      var atEnd = box.scrollLeft + box.clientWidth >= box.scrollWidth - 1 && e.deltaY > 0;
      if (atStart || atEnd) return;
      box.scrollLeft += e.deltaY;
      e.preventDefault();
    }, { passive: false });

    /* 拖动结束后吞掉这一次误触的 click，避免选错分类 */
    box.addEventListener('click', function (e) {
      if (moved) {
        e.preventDefault();
        e.stopPropagation();
        moved = false;
      }
    }, true);
  }

  function renderCatChips() {
    var all = ['全部分类'].concat(CATS);
    /* 历史数据 / 导入备份里可能有不在列表中的分类，也一并给入口 */
    DB.items.forEach(function (it) {
      if (!it.deleted && it.cat && all.indexOf(it.cat) < 0) all.push(it.cat);
    });
    renderChips($('#cat-chips'), all.map(function (c) {
      return '<button class="chip ' + (state.cat === c ? 'on' : '') + '" data-cat="' + esc(c) + '">' + esc(c) + '</button>';
    }).join(''));
  }

  function renderDemoTip() {
    var el = $('#demo-tip');
    if (!el) return;
    var closed = false;
    try { closed = localStorage.getItem(DEMO_TIP_KEY) === '1'; } catch (e) {}
    var hasDemo = DB.items.some(function (x) { return x.demo && !x.deleted; });
    el.classList.toggle('hidden', closed || !hasDemo);
  }

  /* ---------- 资产的三种视图 ---------- */
  function assetRowHtml(it, c, badge, sub) {
    return '<article class="asset" data-id="' + it.id + '">' +
      '<div class="a-icon" style="background:' + iconBg(it.cat) + '">' + esc(it.icon || '📦') + '</div>' +
      '<div class="a-body">' +
        '<div class="a-line1">' +
          '<div class="a-name">' + esc(it.name) + badge + '</div>' +
          '<div class="a-days' + (c.overdue ? ' over' : '') + '">' + c.days + '<small>天</small></div>' +
        '</div>' +
        '<div class="a-line2">' +
          ((Number(it.qty) || 1) > 1 ? '<span class="a-qty">×' + it.qty + '</span>' : '') +
          '<span class="a-price">' + CUR +  money(c.net) + '</span>' +
          '<span class="a-daily">' + CUR +  money(c.daily) + '<small>/天</small></span>' +
        '</div>' + sub +
      '</div>' +
    '</article>';
  }

  function assetCardHtml(it, c, badge) {
    var q = Number(it.qty) || 1;
    return '<article class="acard" data-id="' + it.id + '">' +
      '<div class="acard-top" style="background:' + iconBg(it.cat) + '">' + esc(it.icon || '📦') + '</div>' +
      '<div class="acard-body">' +
        '<div class="acard-name">' + esc(it.name) + badge + '</div>' +
        '<div class="acard-money"><b>' + CUR +  money(c.net) + '</b>' +
          (q > 1 ? '<span>×' + q + '</span>' : '') +
          '<span>' + CUR +  money(c.daily) + '/天</span></div>' +
        '<div class="acard-days' + (c.overdue ? ' over' : '') + '">' + c.days + ' 天</div>' +
      '</div>' +
    '</article>';
  }

  function assetTextHtml(it, c, badge) {
    var q = Number(it.qty) || 1;
    return '<div class="aitem" data-id="' + it.id + '">' +
      '<span class="at-name">' + esc(it.name) + badge + '</span>' +
      '<span class="at-days' + (c.overdue ? ' over' : '') + '">' + c.days + '天</span>' +
      '<span class="at-price">' + (q > 1 ? '×' + q + ' · ' : '') +  CUR +  money(c.net) + '</span>' +
      '<span class="at-daily">' + CUR +  money(c.daily) + '/天</span>' +
    '</div>';
  }

  function renderAssets() {
    renderTopbar();
    renderCatChips();
    renderDemoTip();

    var list = filteredItems();
    var sumTotal = 0, sumDaily = 0, sumCount = 0;
    var view = state.assetView;
    var box = $('#asset-list');
    box.className = 'asset-box view-' + view;

    box.innerHTML = list.map(function (it) {
      var c = calc(it);
      sumTotal += c.net;
      sumDaily += c.daily;
      sumCount += (Number(it.qty) || 1);

      var st = statusOf(it, c);
      var badge = '';
      if (st === '已超期') badge = '<span class="a-badge">已超期</span>';
      else if (st === '已退役') badge = '<span class="a-badge" style="background:#f2f4f9;color:#8b90a0">已退役</span>';
      else if (st === '预备役') badge = '<span class="a-badge" style="background:#eef7ff;color:#3b82f6">预备役</span>';

      var sub = '';
      if (it.trackPerUse) {
        sub = '<div class="a-sub">次均 ' + (c.perUse == null ? '无' : '' + CUR +  money(c.perUse)) +
              ' · 已用 ' + c.used + ' 次</div>';
      }

      if (view === 'grid') return assetCardHtml(it, c, badge);
      if (view === 'text') return assetTextHtml(it, c, badge);
      return assetRowHtml(it, c, badge, sub);
    }).join('');

    var vbtns = document.querySelectorAll('#asset-viewswitch [data-aview]');
    for (var i = 0; i < vbtns.length; i++) {
      vbtns[i].classList.toggle('on', vbtns[i].getAttribute('data-aview') === view);
    }

    var isFiltered = state.cat !== '全部分类' || state.status !== '全部' || !!state.q.trim();
    $('#asset-empty-title').textContent = isFiltered ? '这个筛选下没有物品' : '还没有记录';
    $('#asset-empty-sub').textContent = isFiltered
      ? '换个分类或状态，也可以点下面回到全部'
      : '点下面的「新增」，把第一件东西记下来';
    $('#asset-empty-reset').classList.toggle('hidden', !isFiltered);
    $('#asset-empty').classList.toggle('hidden', list.length > 0);
    $('#sum-total').textContent = money(sumTotal);
    $('#sum-daily').textContent = money(sumDaily);
    $('#sum-count').textContent = sumCount;
    $('#hero-title').textContent = state.status === '全部' ? '全部物品' : state.status;
  }

  /* =========================================================
     详情
     ========================================================= */
  function openDetail(id) {
    var it = DB.items.find(function (x) { return x.id === id; });
    if (!it) return;
    state.detailId = id;
    var c = calc(it);
    var st = statusOf(it, c);

    var cells = [
      ['物品名称', esc(it.name), ''],
      ['购买时间', fmtDate(it.purchaseDate), ''],
      ['价格', '' + CUR +  money2(it.price), 'mono'],
      ['数量', String(it.qty || 1), 'mono'],
      ['总价(价格×数量+附加)', '' + CUR +  money(c.total), 'mono'],
      ['预计用多久', it.lifeValue ? it.lifeValue + ' ' + it.lifeUnit : '无', ''],
      ['日均费用', '' + CUR +  money(c.daily) + '/天', 'mono blue'],
      ['次均费用', c.perUse == null ? '无' : '' + CUR +  money(c.perUse), 'mono'],
      ['持有天数', c.days + ' 天', 'mono'],
      ['退役时间', c.expireAt ? fmtDate(c.expireAt) : '无', ''],
      ['使用状态', st, c.overdue ? 'red' : ''],
      ['到期提醒', it.hasExpiry ? '开启' : '关闭', ''],
      ['分类', it.cat, '']
    ];

    var grid = cells.map(function (x) {
      var cls = 'dg';
      return '<div class="' + cls + '"><div class="k">' + x[0] + '</div><div class="v ' + x[2] + '">' + x[1] + '</div></div>';
    }).join('');

    var cells2 = [
      ['是否减去二手价值', it.subtractResale ? '是' : '否'],
      ['二手价值', it.resale ? '' + CUR +  money2(it.resale) : '未填写'],
      ['是否计算单次使用金额', it.trackPerUse ? '是' : '否'],
      ['使用频率', c.used ? c.used + ' 次' : '无']
    ];
    var grid2 = cells2.map(function (x) {
      return '<div class="dg"><div class="k">' + x[0] + '</div><div class="v">' + x[1] + '</div></div>';
    }).join('');

    var useBlock = it.trackPerUse
      ? '<div class="detail-note"><div style="display:flex;align-items:center;justify-content:space-between;gap:12px">' +
          '<div><div style="font-weight:800;font-size:14px">使用记录</div>' +
          '<div style="font-size:12px;color:#9aa0ae;margin-top:2px">累计 ' + c.used + ' 次' +
          (it.useLog && it.useLog.length ? ' · 上次 ' + fmtDate(it.useLog[it.useLog.length - 1]) : '') +
          '</div></div>' +
          '<button class="btn-main" style="width:auto;padding:10px 18px;font-size:14px;border-radius:12px" data-use="' + it.id + '">用了一次</button>' +
        '</div></div>'
      : '';

    var noteBlock = it.notes
      ? '<div class="detail-note"><div style="font-size:12px;color:#9aa0ae;margin-bottom:4px">备注</div>' + esc(it.notes) + '</div>'
      : '';

    // 从装备库带过来的，直接展示参数
    var gearBlock = '';
    if (it.catalogId) {
      var lg = DB.gear.find(function (g) { return g.id === it.catalogId && !g.deleted; });
      if (lg) {
        var gspecs = (lg.specs || []).map(function (s) {
          return '<div class="spec"><div class="k">' + esc(s.k) + '</div><div class="v">' + esc(s.v) + '</div></div>';
        }).join('');
        var gperf = (lg.perf || []).map(function (p) {
          return '<div class="perf"><div class="perf-top"><div>' +
            '<div class="k">' + esc(p.k) + '</div><div class="v">' + esc(p.v) + '</div></div>' +
            '<span class="grade ' + (p.level || '') + '">' + esc(p.grade) + '</span></div>' +
            '<div class="desc">' + esc(p.desc) + '</div></div>';
        }).join('');
        if (gspecs || gperf) {
          gearBlock = '<div class="g-block" style="margin:14px 14px 0">' +
            '<h3>装备参数' + (lg.brand ? ' · ' + esc(lg.brand) : '') + '</h3>' +
            (gspecs ? '<div class="spec-grid">' + gspecs + '</div>' : '') +
            (gperf ? '<div style="height:12px"></div>' + gperf : '') +
          '</div>';
        }
      }
    }

    $('#detail-body').innerHTML =
      '<div class="detail-icon" style="background:' + iconBg(it.cat) + '">' + esc(it.icon || '📦') + '</div>' +
      '<div class="detail-card"><div class="detail-grid">' + grid + '</div></div>' +
      '<div class="detail-card"><div class="detail-grid">' + grid2 + '</div></div>' +
      useBlock + gearBlock + noteBlock + '<div style="height:8px"></div>';

    openSheet('#detail-sheet');
  }

  /* =========================================================
     编辑器
     ========================================================= */
  function openEditor(item, preset) {
    var f = $('#editor-form');
    state.editingId = item ? item.id : null;
    state.formIcon = (item && item.icon) || (preset && preset.icon) || '📦';

    $('#editor-title').textContent = item ? '编辑' : '新增';
    $('#icon-preview').innerHTML = state.formIcon + ' <small>选择</small>';
    $('#icon-picker').classList.add('hidden');

    var d = item || preset || {};
    f.elements.name.value = d.name || '';
    f.elements.purchaseDate.value = d.purchaseDate || todayStr();
    f.elements.price.value = d.price != null ? d.price : '';
    f.elements.qty.value = d.qty != null ? d.qty : 1;
    f.elements.extra.value = d.extra != null ? d.extra : 0;
    f.elements.lifeValue.value = d.lifeValue || '';
    f.elements.lifeUnit.value = d.lifeUnit || '年';
    f.elements.hasExpiry.checked = !!d.hasExpiry;
    var cats = CATS.slice();
    if (d.cat && cats.indexOf(d.cat) < 0) cats.push(d.cat);
    f.elements.cat.innerHTML = cats.map(function (c) {
      return '<option>' + esc(c) + '</option>';
    }).join('');
    f.elements.cat.value = d.cat || cats[0];
    f.elements.status.value = d.status || '服役中';
    f.elements.subtractResale.checked = !!d.subtractResale;
    f.elements.resale.value = d.resale || '';
    f.elements.trackPerUse.checked = !!d.trackPerUse;
    f.elements.baseCount.value = d.baseCount || 0;
    f.elements.notes.value = d.notes || '';

    // 关联装备：只在编辑时选择，设备详情页会带出参数
    var catSel = f.elements.catalogId;
    if (catSel) {
      catSel.innerHTML = '<option value="">不关联</option>' + DB.gear.filter(function (g) {
        return !g.deleted;
      }).map(function (g) {
        return '<option value="' + esc(g.id) + '">' + esc(g.name) + (g.brand ? ' · ' + esc(g.brand) : '') + '</option>';
      }).join('');
      catSel.value = d.catalogId || '';
    }

    openSheet('#editor-sheet');
  }

  function saveEditor(e) {
    e.preventDefault();
    var f = $('#editor-form');
    var el = f.elements;

    var item = {
      id: state.editingId || uid(),
      name: el.name.value.trim(),
      cat: el.cat.value,
      icon: state.formIcon,
      purchaseDate: el.purchaseDate.value,
      price: Number(el.price.value) || 0,
      qty: Number(el.qty.value) || 1,
      extra: Number(el.extra.value) || 0,
      lifeValue: Number(el.lifeValue.value) || 0,
      lifeUnit: el.lifeUnit.value,
      hasExpiry: el.hasExpiry.checked,
      status: el.status.value,
      subtractResale: el.subtractResale.checked,
      resale: Number(el.resale.value) || 0,
      trackPerUse: el.trackPerUse.checked,
      baseCount: Number(el.baseCount.value) || 0,
      catalogId: el.catalogId && el.catalogId.value ? el.catalogId.value : null,
      useLog: [],
      notes: el.notes.value.trim(),
      updatedAt: Date.now(),
      deleted: false
    };

    var idx = DB.items.findIndex(function (x) { return x.id === item.id; });
    if (idx >= 0) {
      item.useLog = DB.items[idx].useLog || [];
      DB.items[idx] = item;
    } else {
      DB.items.unshift(item);
    }
    saveAll();
    closeSheet('#editor-sheet');
    renderAssets();
    toast(idx >= 0 ? '已更新' : '已添加');
  }

  /* =========================================================
     装备库
     ========================================================= */
  function filteredGear() {
    var q = state.gearQ.trim().toLowerCase();
    return DB.gear.filter(function (g) {
      if (g.deleted) return false;
      if (state.gearCat !== '全部' && g.cat !== state.gearCat) return false;
      if (state.gearBrand !== '全部' && g.brand !== state.gearBrand) return false;
      if (state.gearType !== '全部' && g.type !== state.gearType) return false;
      if (state.gearFav && !g.fav) return false;
      var p = Number(g.refPrice) || 0;
      if (state.gearPrice === 'lt500' && p >= 500) return false;
      if (state.gearPrice === '500to1500' && (p < 500 || p >= 1500)) return false;
      if (state.gearPrice === '1500to3000' && (p < 1500 || p >= 3000)) return false;
      if (state.gearPrice === 'gt3000' && p < 3000) return false;
      if (!q) return true;
      var hay = [g.name, g.brand, g.type, (g.tags || []).join(' ')].join(' ').toLowerCase();
      return hay.indexOf(q) >= 0;
    });
  }

  var CAT_ICON = {
    '户外': '🏕', '睡眠': '🌙', '背负': '🎒', '鞋靴': '🥾',
    '照明': '🔦', '炊具': '🔥', '其他': '📦'
  };
  function catIcon(c) { return CAT_ICON[c] || '📦'; }

  /* 从标签/参数里识别重量，取第一个能认的 g / kg */
  function gearWeight(g) {
    var hay = (g.tags || []).slice();
    (g.specs || []).forEach(function (s) { hay.push((s.k || '') + ' ' + (s.v || '')); });
    for (var i = 0; i < hay.length; i++) {
      var m = String(hay[i]).match(/(\d+(?:\.\d+)?)\s*(kg|g)\b/i);
      if (m) return Math.round(parseFloat(m[1]) * (m[2].toLowerCase() === 'kg' ? 1000 : 1));
    }
    return 0;
  }

  function fmtWeight(w) {
    if (!w) return '';
    if (w >= 1000) return (Math.round(w / 10) / 100) + 'kg';
    return w + 'g';
  }

  function gearMeta(g) {
    var bits = [];
    if (g.brand) bits.push(g.brand);
    if (g.type) bits.push(g.type);
    return bits.join(' · ') || g.cat || '';
  }

  /* ---------- 三种视图的单条渲染 ---------- */
  function gearCardHtml(g) {
    var own = ownedItem(g.id);
    var oc = own ? calc(own) : null;
    var w = fmtWeight(gearWeight(g));
    return '<article class="card" data-gid="' + g.id + '">' +
      '<div class="card-media" style="background:' + iconBg(g.cat) + '" data-open="' + g.id + '">' +
        '<span class="card-emoji">' + esc(g.icon || '📦') + '</span>' +
        '<button class="heart ' + (g.fav ? 'on' : '') + '" data-fav="' + g.id + '">' + (g.fav ? '♥' : '♡') + '</button>' +
        (own ? '<span class="own-badge">已在资产</span>' : '') +
      '</div>' +
      '<div class="card-body">' +
        (g.brand ? '<div class="card-brand">' + esc(g.brand) + '</div>' : '') +
        '<h3 class="card-name" data-open="' + g.id + '">' + esc(g.name) + '</h3>' +
        '<div class="card-badges">' + (g.tags || []).slice(0, 3).map(function (t) { return '<span>' + esc(t) + '</span>'; }).join('') + '</div>' +
        '<div class="card-foot"><span class="price">' + CUR +  money2(g.refPrice) + '</span>' +
          (own ? '<span class="own-tag">' + (oc.perUse == null ? oc.days + '天' : '' + CUR +  money(oc.perUse) + '/次') + '</span>'
               : (w ? '<span class="card-w">' + w + '</span>' : '')) +
        '</div>' +
        '<button class="card-add' + (own ? ' done' : '') + '" data-gadd="' + g.id + '">' +
          (own ? '已在资产中' : '加入我的资产') + '</button>' +
      '</div>' +
    '</article>';
  }

  function gearTextHtml(g) {
    var w = fmtWeight(gearWeight(g));
    return '<div class="g-text" data-open="' + g.id + '">' +
      '<span class="gt-name">' + esc(g.name) + '</span>' +
      '<span class="gt-w">' + w + '</span>' +
      '<span class="gt-sub">' + esc(gearMeta(g)) + '</span>' +
      '<span class="gt-p">' + CUR +  money2(g.refPrice) + '</span>' +
    '</div>';
  }

  function gearListHtml(g) {
    var w = fmtWeight(gearWeight(g));
    return '<div class="g-list" data-open="' + g.id + '">' +
      '<span class="gl-ico" style="background:' + iconBg(g.cat) + '">' + esc(g.icon || '📦') + '</span>' +
      '<span class="gl-main"><b>' + esc(g.name) + '</b><small>' + esc(gearMeta(g)) + '</small></span>' +
      '<span class="gl-side"><b>' + CUR +  money2(g.refPrice) + '</b>' + (w ? '<small>' + w + '</small>' : '') + '</span>' +
    '</div>';
  }

  function renderGear() {
    var cats = ['全部'].concat(GEAR_CATS);
    DB.gear.forEach(function (g) {
      if (!g.deleted && g.cat && cats.indexOf(g.cat) < 0) cats.push(g.cat);
    });
    renderChips($('#gear-chips'), cats.map(function (c) {
      return '<button class="chip ' + (state.gearCat === c ? 'on' : '') + '" data-gcat="' + c + '">' + c + '</button>';
    }).join(''));

    var list = filteredGear();
    var view = state.gearView;

    /* 按分类分组，组顺序与 chips 一致 */
    var groups = {}, order = [];
    list.forEach(function (g) {
      var k = g.cat || '其他';
      if (!groups[k]) { groups[k] = []; order.push(k); }
      groups[k].push(g);
    });
    order.sort(function (a, b) {
      var ia = cats.indexOf(a), ib = cats.indexOf(b);
      if (ia < 0) ia = 999;
      if (ib < 0) ib = 999;
      return ia - ib;
    });

    var rowHtml = view === 'text' ? gearTextHtml : (view === 'list' ? gearListHtml : gearCardHtml);

    var box = $('#gear-grid');
    box.className = 'gear-groups view-' + view;
    box.innerHTML = order.map(function (k) {
      var items = groups[k], sum = 0, wsum = 0, hasW = false;
      items.forEach(function (g) {
        sum += Number(g.refPrice) || 0;
        var w = gearWeight(g);
        if (w) { wsum += w; hasW = true; }
      });
      var sumTxt = items.length + '件' + (hasW ? ' · ' + fmtWeight(wsum) : '') + ' · ' + CUR +  money2(sum);
      return '<section class="gear-group' + (state.gearCollapsed[k] ? ' col' : '') + '">' +
        '<button class="gg-head" data-gcol="' + esc(k) + '">' +
          '<span class="gg-ico">' + catIcon(k) + '</span>' +
          '<span class="gg-name">' + esc(k) + '</span>' +
          '<svg class="gg-chev" viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"/></svg>' +
          '<span class="gg-sum">' + sumTxt + '</span>' +
        '</button>' +
        '<div class="gg-body">' + items.map(rowHtml).join('') + '</div>' +
      '</section>';
    }).join('');

    var btns = document.querySelectorAll('#gear-viewswitch [data-gview]');
    for (var i = 0; i < btns.length; i++) {
      btns[i].classList.toggle('on', btns[i].getAttribute('data-gview') === view);
    }

    $('#gear-empty').classList.toggle('hidden', list.length > 0);
    updateGearFilterBtn();
  }

  /* ---------- 装备筛选 ---------- */
  function updateGearFilterBtn() {
    var btn = $('#btn-gfilter');
    if (!btn) return;
    var n = 0;
    if (state.gearBrand !== '全部') n++;
    if (state.gearType !== '全部') n++;
    if (state.gearPrice !== '全部') n++;
    if (state.gearFav) n++;
    btn.classList.toggle('on', n > 0);
    var badge = $('#gfilter-count');
    if (badge) badge.textContent = n ? String(n) : '';
  }

  function resetGearFilters() {
    state.gearBrand = '全部';
    state.gearType = '全部';
    state.gearPrice = '全部';
    state.gearFav = false;
  }

  function renderGearFilter() {
    var brands = [], types = [];
    DB.gear.forEach(function (g) {
      if (g.deleted) return;
      if (g.brand && brands.indexOf(g.brand) < 0) brands.push(g.brand);
      if (g.type && types.indexOf(g.type) < 0) types.push(g.type);
    });
    brands.sort(function (a, b) { return a.localeCompare(b, 'zh-Hans-CN'); });
    types.sort(function (a, b) { return a.localeCompare(b, 'zh-Hans-CN'); });
    var resetFilter = false;
    if (state.gearBrand !== '全部' && brands.indexOf(state.gearBrand) < 0) {
      state.gearBrand = '全部'; resetFilter = true;
    }
    if (state.gearType !== '全部' && types.indexOf(state.gearType) < 0) {
      state.gearType = '全部'; resetFilter = true;
    }
    // 选中的品牌/类型可能已经随装备删除而消失，顺手把列表也刷新一下
    if (resetFilter) renderGear();

    function chips(attr, cur, list) {
      return '<button class="chip ' + (cur === '全部' ? 'on' : '') + '" ' + attr + '="全部">全部</button>' +
        list.map(function (v) {
          return '<button class="chip ' + (cur === v ? 'on' : '') + '" ' + attr + '="' + esc(v) + '">' + esc(v) + '</button>';
        }).join('');
    }

    var html =
      '<div class="fgroup"><h4>品牌</h4><div class="fchips">' + chips('data-gfbrand', state.gearBrand, brands) + '</div></div>' +
      '<div class="fgroup"><h4>装备类型</h4><div class="fchips">' + chips('data-gftype', state.gearType, types) + '</div></div>' +
      '<div class="fgroup"><h4>参考价（' + CUR + '）</h4><div class="fchips">' +
        PRICE_RANGES.map(function (p) {
          return '<button class="chip ' + (state.gearPrice === p.k ? 'on' : '') + '" data-gfprice="' + p.k + '">' + p.label + '</button>';
        }).join('') +
      '</div></div>' +
      '<div class="fgroup"><h4>收藏</h4><div class="fchips">' +
        '<button class="chip ' + (state.gearFav ? 'on' : '') + '" data-gffav="1">只看收藏</button>' +
      '</div></div>';

    $('#gfilter-body').innerHTML = html;
    $('#btn-gfilter-apply').textContent = '查看 ' + filteredGear().length + ' 件';
    updateGearFilterBtn();
  }

  function openGearFilter() {
    renderGearFilter();
    openSheet('#gfilter-sheet');
  }

  function openGear(id) {
    var g = DB.gear.find(function (x) { return x.id === id; });
    if (!g) return;
    state.gearId = id;

    var specs = (g.specs || []).map(function (s) {
      return '<div class="spec"><div class="k">' + esc(s.k) + '</div><div class="v">' + esc(s.v) + '</div></div>';
    }).join('');

    var perf = (g.perf || []).map(function (p) {
      return '<div class="perf"><div class="perf-top"><div>' +
        '<div class="k">' + esc(p.k) + '</div><div class="v">' + esc(p.v) + '</div></div>' +
        '<span class="grade ' + (p.level || '') + '">' + esc(p.grade) + '</span></div>' +
        '<div class="desc">' + esc(p.desc) + '</div></div>';
    }).join('');

    var own = ownedItem(g.id);
    var oc = own ? calc(own) : null;
    var ownBlock = '';
    if (own && oc) {
      ownBlock = '<div class="g-block"><h3>我的使用情况</h3>' +
        '<div class="kv"><span>持有天数</span><b>' + oc.days + ' 天</b></div>' +
        '<div class="kv"><span>计入成本</span><b>' + CUR +  money(oc.net) + '</b></div>' +
        '<div class="kv"><span>日均</span><b>' + CUR +  money(oc.daily) + ' / 天</b></div>' +
        '<div class="kv"><span>次均</span><b>' + (oc.perUse == null ? '开启后可算' : '' + CUR +  money(oc.perUse)) + '</b></div>' +
      '</div>';
    }

    var gcat = [g.type, g.cat].filter(function (x) { return !!x; }).join(' · ');
    var tagBlock = (g.tags || []).length
      ? '<div class="g-chips">' + g.tags.map(function (t) { return '<span>' + esc(t) + '</span>'; }).join('') + '</div>'
      : '';
    var specBlock = specs ? '<div class="g-block"><h3>核心信息</h3><div class="spec-grid">' + specs + '</div></div>' : '';
    var perfBlock = perf ? '<div class="g-block"><h3>核心性能</h3>' + perf + '</div>' : '';

    $('#gdetail-body').innerHTML =
      '<div class="g-hero">' +
        (gcat ? '<div class="g-cat">' + esc(gcat) + '</div>' : '') +
        '<h2 class="g-name">' + esc(g.name) + '</h2>' +
        '<div class="g-price">' + CUR +  money2(g.refPrice) + '<small>参考价</small></div>' +
        tagBlock +
      '</div>' +
      specBlock + perfBlock +
      ownBlock +
      '<div style="height:8px"></div>';

    $('#gdetail-actions').innerHTML =
      '<div style="display:flex;flex-direction:column;gap:8px">' +
        '<button class="btn-main ghost" data-gedit="' + g.id + '">编辑装备</button>' +
        (own
          ? '<button class="btn-main on" data-goto="' + own.id + '">已在资产中 · 查看成本</button>'
          : '<button class="btn-main" data-gadd="' + g.id + '">加入我的资产</button>') +
      '</div>';

    openSheet('#gsheet');
  }

  /* ---------- 装备新增 / 编辑 ---------- */
  function newGearId() {
    return 'g' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
  }

  function parseTags(text) {
    return String(text || '').split(/[,，]/).map(function (s) { return s.trim(); })
      .filter(function (s) { return !!s; });
  }

  function parseSpecs(text) {
    var out = [];
    String(text || '').split(/\r?\n/).forEach(function (line) {
      var i = line.indexOf(':');
      var j = line.indexOf('：');
      if (i < 0 || (j >= 0 && j < i)) i = j;
      if (i < 0) return;
      var k = line.slice(0, i).trim();
      var v = line.slice(i + 1).trim();
      if (k) out.push({ k: k, v: v });
    });
    return out;
  }

  function openGearEditor(gear) {
    var f = $('#geditor-form');
    state.editingGearId = gear ? gear.id : null;
    state.gearFormIcon = (gear && gear.icon) || '📦';

    $('#geditor-title').textContent = gear ? '编辑装备' : '新增装备';
    $('#gicon-preview').innerHTML = state.gearFormIcon + ' <small>选择</small>';
    $('#gicon-picker').classList.add('hidden');
    $('#btn-gdel').classList.toggle('hidden', !gear);

    var d = gear || {};
    f.elements.name.value = d.name || '';
    f.elements.brand.value = d.brand || '';
    f.elements.type.value = d.type || '';
    f.elements.refPrice.value = d.refPrice != null ? d.refPrice : '';

    var catSel = f.elements.cat;
    var cats = GEAR_CATS.slice();
    if (d.cat && cats.indexOf(d.cat) < 0) cats.push(d.cat);
    catSel.innerHTML = cats.map(function (c) { return '<option>' + c + '</option>'; }).join('');
    catSel.value = d.cat || '户外';

    f.elements.fav.checked = !!d.fav;
    f.elements.tags.value = (d.tags || []).join(', ');
    f.elements.specs.value = (d.specs || []).map(function (s) { return s.k + ': ' + s.v; }).join('\n');

    openSheet('#geditor-sheet');
  }

  function saveGearEditor(e) {
    e.preventDefault();
    var el = $('#geditor-form').elements;
    var name = el.name.value.trim();
    if (!name) { toast('请填写装备名称'); return; }

    var gear = {
      id: state.editingGearId || newGearId(),
      name: name,
      brand: el.brand.value.trim(),
      cat: el.cat.value,
      type: el.type.value.trim(),
      refPrice: Number(el.refPrice.value) || 0,
      icon: state.gearFormIcon,
      fav: el.fav.checked,
      tags: parseTags(el.tags.value),
      specs: parseSpecs(el.specs.value),
      perf: [],
      updatedAt: Date.now(),
      deleted: false
    };

    var idx = DB.gear.findIndex(function (x) { return x.id === gear.id; });
    if (idx >= 0) {
      gear.perf = DB.gear[idx].perf || [];
      DB.gear[idx] = gear;
    } else {
      DB.gear.unshift(gear);
    }
    saveAll();
    closeSheet('#geditor-sheet');
    renderGear();
    toast(idx >= 0 ? '装备已更新' : '装备已添加');
  }

  function deleteGear() {
    var g = DB.gear.find(function (x) { return x.id === state.editingGearId; });
    if (!g) return;
    if (!confirm('删除「' + g.name + '」？已加入资产的记录会保留，只是不再显示它的参数。')) return;
    g.deleted = true;
    g.updatedAt = Date.now();
    saveAll();
    closeSheet('#geditor-sheet');
    renderGear();
    toast('已删除装备');
  }

  /* =========================================================
     分析
     ========================================================= */
  function renderStats() {
    var items = DB.items.filter(function (x) { return !x.deleted; })
      .map(function (it) { return { it: it, c: calc(it) }; });
    var total = 0, daily = 0, count = 0, usedTotal = 0, costForUse = 0;
    var byCat = {};
    var overdue = [];

    items.forEach(function (x) {
      var qty = Number(x.it.qty) || 1;
      total += x.c.net;
      daily += x.c.daily;
      count += qty;
      if (x.c.perUse != null) { usedTotal += x.c.used; costForUse += x.c.net; }
      byCat[x.it.cat] = (byCat[x.it.cat] || 0) + x.c.net;
      if (x.c.overdue) overdue.push(x);
    });

    var avgPerUse = usedTotal ? costForUse / usedTotal : null;

    var catRows = Object.keys(byCat).sort(function (a, b) { return byCat[b] - byCat[a]; });
    var maxCat = catRows.length ? byCat[catRows[0]] : 1;
    var bars = catRows.map(function (c) {
      var pct = Math.round(byCat[c] / maxCat * 100);
      return '<div><div class="bar-top"><b>' + esc(c) + '</b><span>' + CUR +  money(byCat[c]) + '</span></div>' +
             '<div class="bar-track"><div class="bar-fill" style="width:' + pct + '%"></div></div></div>';
    }).join('');

    var top = items.filter(function (x) { return x.c.perUse != null; })
      .sort(function (a, b) { return b.c.perUse - a.c.perUse; }).slice(0, 5);
    var maxPU = top.length ? top[0].c.perUse : 1;
    var topBars = top.map(function (x) {
      var pct = Math.round(x.c.perUse / maxPU * 100);
      return '<div><div class="bar-top"><b>' + esc(x.it.name) + '</b><span>' + CUR +  money(x.c.perUse) + '/次</span></div>' +
             '<div class="bar-track"><div class="bar-fill warn" style="width:' + pct + '%"></div></div></div>';
    }).join('') || '<div style="font-size:13px;color:#a0a5b3">还没有开启「计算单次使用」的物品</div>';

    var overdueList = overdue.map(function (x) {
      return '<div class="kv"><span>' + esc(x.it.name) + '</span><b style="color:#f04438">超 ' + (x.c.days - x.c.life) + ' 天</b></div>';
    }).join('') || '<div style="font-size:13px;color:#a0a5b3">没有超期物品，保养得不错</div>';

    $('#stats-body').innerHTML =
      '<div class="panel"><h3>总览</h3><p class="sub">按当前全部物品计算</p>' +
        '<div class="kv"><span>资产总计</span><b>' + CUR +  money(total) + '</b></div>' +
        '<div class="kv"><span>总日均</span><b>' + CUR +  money(daily) + '/天</b></div>' +
        '<div class="kv"><span>物品数量</span><b>' + count + ' 件</b></div>' +
        '<div class="kv"><span>整体次均成本</span><b>' + (avgPerUse == null ? '无' : '' + CUR +  money(avgPerUse)) + '</b></div>' +
      '</div>' +
      '<div class="panel"><h3>分类占比</h3><p class="sub">按金额（已扣二手价值）</p><div class="bars">' + bars + '</div></div>' +
      '<div class="panel"><h3>单次成本 TOP 5</h3><p class="sub">越高说明越贵、用得越少</p><div class="bars">' + topBars + '</div></div>' +
      '<div class="panel"><h3>超期提醒</h3><p class="sub">超过计划使用年限</p>' + overdueList + '</div>' +
      '<div style="height:8px"></div>';
  }

  /* =========================================================
     我的：外观 / 货币 / 分类 / 备份 / 分享图
     ========================================================= */
  function getTheme() {
    try { return localStorage.getItem(LS_THEME) || 'auto'; } catch (e) { return 'auto'; }
  }
  function applyTheme() {
    var t = getTheme();
    var dark = t === 'dark' || (t === 'auto' && window.matchMedia &&
      window.matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', dark ? '#101218' : '#f5f6fa');
  }
  function setTheme(v) {
    try { localStorage.setItem(LS_THEME, v); } catch (e) {}
    applyTheme();
    renderMine();
  }
  function applyCur() {
    $$('[data-cur]').forEach(function (n) { n.textContent = CUR; });
  }
  function setCur(v) {
    if (CURS.indexOf(v) < 0) return;
    CUR = v;
    try { localStorage.setItem(LS_CUR, v); } catch (e) {}
    applyCur();
    renderAssets(); renderGear(); renderStats(); renderMine();
  }

  function mineRow(icon, title, sub, attrs, tail) {
    return '<button class="mine-row" ' + (attrs || '') + '>' +
      '<span class="mine-ico">' + icon + '</span>' +
      '<span class="mine-main"><b>' + title + '</b><small>' + sub + '</small></span>' +
      (tail || '<span class="mine-chev">›</span>') +
    '</button>';
  }

  function renderMine() {
    var body = $('#mine-body');
    if (!body) return;

    var curOpts = [
      { v: '¥', t: '¥ 人民币' }, { v: '$', t: '$ 美元' }, { v: '€', t: '€ 欧元' },
      { v: '£', t: '£ 英镑' }, { v: '₩', t: '₩ 韩元' }
    ].map(function (o) {
      return '<option value="' + o.v + '"' + (o.v === CUR ? ' selected' : '') + '>' + o.t + '</option>';
    }).join('');

    var th = getTheme();
    var thOpts = [
      { v: 'auto', t: '跟随系统' }, { v: 'light', t: '浅色' }, { v: 'dark', t: '深色' }
    ].map(function (o) {
      return '<option value="' + o.v + '"' + (o.v === th ? ' selected' : '') + '>' + o.t + '</option>';
    }).join('');

    body.innerHTML =
      '<div class="mine-card">' +
        mineRow('📁', '分类管理', '自定义物品分类，可以增删改', 'id="mine-cats"',
          '<span class="mine-val">' + CATS.length + ' 个</span><span class="mine-chev">›</span>') +
      '</div>' +
      '<div class="mine-title">数据导出</div>' +
      '<div class="mine-card">' +
        mineRow('📄', '导出 CSV', 'Excel / WPS 可以直接打开', 'data-mine="csv"') +
        mineRow('🗂', '导出备份', '完整数据，换设备能恢复', 'data-mine="backup"') +
      '</div>' +
      '<div class="mine-title">通用设置</div>' +
      '<div class="mine-card">' +
        '<div class="mine-row"><span class="mine-ico">💱</span>' +
          '<span class="mine-main"><b>货币单位</b><small>所有金额按这个符号显示</small></span>' +
          '<select class="mine-select" id="mine-cur">' + curOpts + '</select></div>' +
        '<div class="mine-row"><span class="mine-ico">🌙</span>' +
          '<span class="mine-main"><b>深色模式</b><small>夜里看屏幕不刺眼</small></span>' +
          '<select class="mine-select" id="mine-theme">' + thOpts + '</select></div>' +
        mineRow('↩️', '恢复备份', '从 JSON 备份合并回来', 'data-mine="restore"') +
        mineRow('📥', '导入 CSV', '从表格文件补充记录', 'data-mine="importCsv"') +
      '</div>' +
      '<div class="mine-title">分享</div>' +
      '<div class="mine-card">' +
        mineRow('🎨', '生成装备图片', '做一张可以发出去的装备海报', 'data-mine="poster"') +
      '</div>' +
      '<div class="mine-foot">装备台账 · 数据只存在你的设备里</div>';
  }

  /* ---------- 分类管理 ---------- */
  function catCounts() {
    var counts = {};
    DB.items.forEach(function (it) {
      if (it.deleted) return;
      var c = it.cat || '其他';
      counts[c] = (counts[c] || 0) + 1;
    });
    return counts;
  }

  function openCats() {
    renderCatsList();
    openSheet('#cats-sheet');
  }

  function renderCatsList() {
    var counts = catCounts();
    var extra = Object.keys(counts).filter(function (c) { return CATS.indexOf(c) < 0; });
    var all = CATS.concat(extra);
    $('#cats-list').innerHTML = all.map(function (c) {
      return '<div class="cat-row">' +
        '<span class="cat-name">' + esc(c) + '</span>' +
        '<span class="cat-count">' + (counts[c] || 0) + ' 件</span>' +
        '<button class="cat-act" data-cat-rename="' + esc(c) + '">改名</button>' +
        '<button class="cat-act danger" data-cat-del="' + esc(c) + '">删除</button>' +
      '</div>';
    }).join('');
  }

  function updateEditorCats() {
    var sel = $('#editor-cat');
    if (!sel) return;
    var cur = sel.value;
    sel.innerHTML = CATS.map(function (c) { return '<option>' + esc(c) + '</option>'; }).join('');
    if (CATS.indexOf(cur) >= 0) sel.value = cur;
  }

  function refreshAfterCats() {
    saveCats();
    renderCatsList();
    renderCatChips();
    renderAssets();
    renderStats();
    renderMine();
    updateEditorCats();
  }

  function addCat() {
    var input = $('#cat-new');
    var name = input.value.trim();
    if (!name) { toast('先输入分类名称'); input.focus(); return; }
    if (name.length > 8) { toast('分类名最多 8 个字'); return; }
    if (CATS.indexOf(name) >= 0) { toast('已经有这个分类了'); return; }
    CATS.push(name);
    input.value = '';
    refreshAfterCats();
    toast('已添加「' + name + '」');
  }

  function renameCat(name) {
    var next = window.prompt('把「' + name + '」改成：', name);
    if (next == null) return;
    next = String(next).trim();
    if (!next || next === name) return;
    if (next.length > 8) { toast('分类名最多 8 个字'); return; }
    if (CATS.indexOf(next) >= 0) { toast('已经有同名分类了'); return; }

    var i = CATS.indexOf(name);
    if (i >= 0) CATS[i] = next;
    else CATS.push(next); /* 历史遗留分类，补进列表 */
    DB.items.forEach(function (it) { if (it.cat === name) it.cat = next; });
    if (state.cat === name) state.cat = next;
    saveAll();
    refreshAfterCats();
    toast('已改名');
  }

  function deleteCat(name) {
    if (CATS.length <= 1) { toast('至少保留一个分类'); return; }
    var n = 0;
    DB.items.forEach(function (it) { if (!it.deleted && it.cat === name) n++; });
    var rest = CATS.filter(function (c) { return c !== name; });
    var fallback = rest.indexOf('其他') >= 0 ? '其他' : rest[0];
    var msg = n
      ? '「' + name + '」下还有 ' + n + ' 件物品，删除后会移到「' + fallback + '」。继续吗？'
      : '删除分类「' + name + '」？';
    if (!window.confirm(msg)) return;

    CATS = rest;
    DB.items.forEach(function (it) { if (it.cat === name) it.cat = fallback; });
    if (state.cat === name) state.cat = '全部分类';
    saveAll();
    refreshAfterCats();
    toast('已删除「' + name + '」');
  }

  /* ---------- 生成装备图片 ---------- */
  var POSTER_STYLES = [
    { id: 'list', name: '装备清单版', desc: '经典装备图片' },
    { id: 'wild', name: '山野氛围版', desc: '山野背景图片' },
    { id: 'birch', name: '装备白桦版', desc: '白底大图，系统分类' }
  ];
  var POSTER_CONTENTS = [
    { id: 'both', name: '重量+价格' },
    { id: 'weight', name: '仅重量' },
    { id: 'price', name: '仅价格' }
  ];
  var CAT_COLORS = {
    '户外': '#4354f0', '睡眠': '#7c5cf0', '背负': '#0e9f6e', '鞋靴': '#e8602f',
    '照明': '#f5a524', '炊具': '#0ea5e9', '其他': '#8b90a0'
  };
  var POSTER_SANS = '"PingFang SC","Microsoft YaHei",-apple-system,"Segoe UI",sans-serif';

  var poster = {
    plan: 'all',
    style: 'list',
    content: 'both',
    title: '个人装备清单',
    bgImage: null,
    bgCustom: false,
    result: ''
  };

  function posterData() {
    var list = DB.gear.filter(function (g) { return !g.deleted; });
    var groups = {}, order = [];
    list.forEach(function (g) {
      var k = g.cat || '其他';
      if (!groups[k]) { groups[k] = []; order.push(k); }
      groups[k].push(g);
    });
    order.sort(function (a, b) {
      var ia = GEAR_CATS.indexOf(a), ib = GEAR_CATS.indexOf(b);
      if (ia < 0) ia = 99;
      if (ib < 0) ib = 99;
      return ia - ib;
    });
    var totalW = 0, totalP = 0;
    list.forEach(function (g) {
      totalW += gearWeight(g);
      totalP += Number(g.refPrice) || 0;
    });
    return { groups: groups, order: order, totalW: totalW, totalP: totalP, count: list.length };
  }

  function openPoster() {
    var d = posterData();
    if (!d.count) { toast('装备库还是空的，先加几件装备'); return; }

    try {
      var saved = localStorage.getItem('gearLedger.posterTitle');
      if (saved) poster.title = saved;
    } catch (e) {}

    renderPosterPlans(d);
    renderPosterStyles();
    renderPosterContent();
    $('#poster-title').value = poster.title;
    renderPosterBg();
    openSheet('#poster-sheet');
  }

  function renderPosterPlans(d) {
    $('#poster-plans').innerHTML =
      '<button class="ps-plan' + (poster.plan === 'all' ? ' on' : '') + '" data-plan="all">' +
        '<span class="ps-check">✓</span>' +
        '全部个人装备<small>' + d.count + ' 件</small>' +
      '</button>';
  }

  function renderPosterStyles() {
    $('#poster-styles').innerHTML = POSTER_STYLES.map(function (s) {
      return '<button class="ps-style' + (poster.style === s.id ? ' on' : '') + '" data-pstyle="' + s.id + '">' +
        '<span class="ps-prev ' + s.id + '"></span>' +
        '<span class="ps-style-name">' + s.name + '</span>' +
        '<span class="ps-style-desc">' + s.desc + '</span>' +
      '</button>';
    }).join('');
  }

  function renderPosterContent() {
    $('#poster-content').innerHTML = POSTER_CONTENTS.map(function (c) {
      return '<button class="' + (poster.content === c.id ? 'on' : '') + '" data-pcontent="' + c.id + '">' +
        c.name + '</button>';
    }).join('');
  }

  function renderPosterBg() {
    var cv = $('#poster-bg-thumb');
    if (cv) {
      var g = cv.getContext('2d');
      g.clearRect(0, 0, cv.width, cv.height);
      if (poster.bgImage) drawCover(g, poster.bgImage, 0, 0, cv.width, cv.height);
      else drawMountain(g, 0, 0, cv.width, cv.height);
    }
    $('#poster-bg-name').textContent = poster.bgCustom ? '自定义图片' : '默认山脉';
    $('#poster-bg-reset').classList.toggle('hidden', !poster.bgCustom);
  }

  function roundRect(g, x, y, w, h, r) {
    g.beginPath();
    g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + h, r);
    g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r);
    g.arcTo(x, y, x + w, y, r);
    g.closePath();
  }

  function drawMountain(g, x, y, w, h) {
    var sky = g.createLinearGradient(0, y, 0, y + h);
    sky.addColorStop(0, '#16233a');
    sky.addColorStop(.42, '#3f5a80');
    sky.addColorStop(.72, '#b87a4e');
    sky.addColorStop(1, '#f0c48a');
    g.fillStyle = sky;
    g.fillRect(x, y, w, h);

    // 月亮
    g.fillStyle = 'rgba(255,242,214,.95)';
    g.beginPath();
    g.arc(x + w * .8, y + h * .26, Math.max(6, w * .028), 0, Math.PI * 2);
    g.fill();

    // 远山
    g.fillStyle = '#3d4d68';
    g.beginPath();
    g.moveTo(x, y + h * .68);
    g.lineTo(x + w * .18, y + h * .44);
    g.lineTo(x + w * .36, y + h * .58);
    g.lineTo(x + w * .54, y + h * .4);
    g.lineTo(x + w * .76, y + h * .56);
    g.lineTo(x + w, y + h * .46);
    g.lineTo(x + w, y + h);
    g.lineTo(x, y + h);
    g.closePath();
    g.fill();

    // 近山
    g.fillStyle = '#1b2537';
    g.beginPath();
    g.moveTo(x, y + h * .88);
    g.lineTo(x + w * .15, y + h * .64);
    g.lineTo(x + w * .32, y + h * .78);
    g.lineTo(x + w * .5, y + h * .58);
    g.lineTo(x + w * .7, y + h * .76);
    g.lineTo(x + w, y + h * .62);
    g.lineTo(x + w, y + h);
    g.lineTo(x, y + h);
    g.closePath();
    g.fill();
  }

  function drawCover(g, img, x, y, w, h) {
    var iw = img.naturalWidth || img.width;
    var ih = img.naturalHeight || img.height;
    if (!iw || !ih) return;
    var scale = Math.max(w / iw, h / ih);
    var dw = iw * scale, dh = ih * scale;
    g.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
  }

  function drawPosterHead(g, W, headH, d) {
    var birch = poster.style === 'birch';

    if (birch) {
      g.fillStyle = '#ffffff';
      g.fillRect(0, 0, W, headH);
      var stripe = ['#4354f0', '#e8602f', '#0e9f6e', '#f5a524', '#7c5cf0', '#0ea5e9'];
      var sw = W / stripe.length;
      stripe.forEach(function (c, i) {
        g.fillStyle = c;
        g.fillRect(i * sw, 0, sw, 8);
      });
    } else {
      if (poster.bgImage) drawCover(g, poster.bgImage, 0, 0, W, headH);
      else drawMountain(g, 0, 0, W, headH);

      var veil = g.createLinearGradient(0, 0, 0, headH);
      veil.addColorStop(0, 'rgba(6,10,18,.52)');
      veil.addColorStop(.45, 'rgba(6,10,18,.12)');
      veil.addColorStop(1, 'rgba(6,10,18,.6)');
      g.fillStyle = veil;
      g.fillRect(0, 0, W, headH);
    }

    var ink = birch ? '#14161c' : '#ffffff';
    var ink2 = birch ? '#8b90a0' : 'rgba(255,255,255,.72)';

    g.textAlign = 'left';
    g.fillStyle = ink2;
    g.font = '600 22px ' + POSTER_SANS;
    g.fillText('装备台账 · 户外装备清单', 44, 64);

    g.fillStyle = ink;
    g.font = '800 54px ' + POSTER_SANS;
    g.fillText(String(poster.title || '个人装备清单').slice(0, 14), 44, 134);

    var dt = new Date();
    g.fillStyle = ink2;
    g.font = '500 22px ' + POSTER_SANS;
    g.fillText(dt.getFullYear() + '-' + pad(dt.getMonth() + 1) + '-' + pad(dt.getDate()), 44, 170);

    var stats = [];
    if (poster.content !== 'price') stats.push({ v: fmtWeight(d.totalW) || '—', k: '总重量' });
    if (poster.content !== 'weight') stats.push({ v: CUR + money2(d.totalP), k: '总价值' });
    stats.push({ v: d.count + ' 件', k: '装备数量' });
    stats.push({ v: d.order.length + ' 类', k: '分类' });

    var r = 58, cy = 254, gapX = 18;
    var total = stats.length * r * 2 + (stats.length - 1) * gapX;
    var startX = (W - total) / 2 + r;
    stats.forEach(function (s, i) {
      var cx = startX + i * (r * 2 + gapX);
      g.beginPath();
      g.arc(cx, cy, r, 0, Math.PI * 2);
      g.fillStyle = birch ? 'rgba(67,84,240,.07)' : 'rgba(255,255,255,.12)';
      g.fill();
      g.lineWidth = 2.5;
      g.strokeStyle = birch ? 'rgba(67,84,240,.3)' : 'rgba(255,255,255,.72)';
      g.stroke();

      g.textAlign = 'center';
      g.fillStyle = ink;
      var val = String(s.v);
      g.font = '800 ' + (val.length > 8 ? 19 : 24) + 'px ' + POSTER_SANS;
      g.fillText(val, cx, cy + 2);
      g.fillStyle = ink2;
      g.font = '500 17px ' + POSTER_SANS;
      g.fillText(s.k, cx, cy + 28);
    });
  }

  function drawPosterBody(g, W, pad, y, rowH, gap, d, st) {
    var x = pad, w = W - pad * 2;
    var ink = st === 'wild' ? '#e9ebf1' : '#14161c';
    var sub = st === 'wild' ? 'rgba(255,255,255,.55)' : '#a0a5b3';

    d.order.forEach(function (cat) {
      var items = d.groups[cat];
      var color = CAT_COLORS[cat] || '#8b90a0';

      g.fillStyle = color;
      roundRect(g, x, y + 2, 7, 24, 3.5);
      g.fill();

      g.fillStyle = ink;
      g.font = '800 26px ' + POSTER_SANS;
      g.textAlign = 'left';
      g.fillText(cat + '系统', x + 18, y + 23);

      g.textAlign = 'right';
      g.fillStyle = sub;
      g.font = '500 19px ' + POSTER_SANS;
      g.fillText(items.length + ' 件', x + w, y + 23);
      y += 42;

      items.forEach(function (item, idx) {
        if (st === 'wild') g.fillStyle = 'rgba(255,255,255,.07)';
        else if (st === 'list') g.fillStyle = '#ffffff';
        else g.fillStyle = idx % 2 ? '#fafbfd' : '#ffffff';
        roundRect(g, x, y, w, 46, 10);
        g.fill();

        g.textAlign = 'left';
        g.font = '22px "Segoe UI Emoji","Apple Color Emoji",sans-serif';
        g.fillStyle = '#000';
        g.fillText(item.icon || catIcon(cat), x + 14, y + 31);

        g.fillStyle = ink;
        g.font = '600 21px ' + POSTER_SANS;
        var nm = item.name || '';
        var full = nm;
        while (nm.length > 1 && g.measureText(nm).width > w - 250) nm = nm.slice(0, -1);
        if (nm !== full) nm = nm.slice(0, -1) + '…';
        g.fillText(nm, x + 48, y + 30);

        var bits = [];
        if (poster.content !== 'price') {
          var wt = fmtWeight(gearWeight(item));
          if (wt) bits.push(wt);
        }
        if (poster.content !== 'weight' && item.refPrice) {
          bits.push(CUR + money2(item.refPrice));
        }
        g.textAlign = 'right';
        g.fillStyle = st === 'wild' ? 'rgba(255,255,255,.82)' : '#5d6272';
        g.font = '500 19px ' + POSTER_SANS;
        g.fillText(bits.join('    '), x + w - 14, y + 30);

        y += rowH;
      });

      y += gap;
    });
  }

  function drawPosterFoot(g, W, H, pad, d, st) {
    var y = H - 58;
    g.textAlign = 'left';
    g.fillStyle = st === 'wild' ? 'rgba(255,255,255,.45)' : '#a0a5b3';
    g.font = '500 18px ' + POSTER_SANS;
    g.fillText('装备台账 · 记录每一件的重量与价格', pad, y);

    g.textAlign = 'right';
    g.fillText('共 ' + d.count + ' 件装备', W - pad, y);
  }

  function buildPoster(d) {
    var W = 750;
    var pad = 44;
    var headH = poster.style === 'birch' ? 336 : 420;
    var rowH = 54;
    var gap = 22;
    var bodyH = 0;
    d.order.forEach(function (c) { bodyH += 42 + d.groups[c].length * rowH + gap; });
    var footH = 110;
    var H = headH + 24 + bodyH + footH;

    var cv = document.createElement('canvas');
    cv.width = W;
    cv.height = H;
    var g = cv.getContext('2d');
    var st = poster.style;

    if (st === 'wild') g.fillStyle = '#0f1218';
    else if (st === 'birch') g.fillStyle = '#ffffff';
    else g.fillStyle = '#f4f2ed';
    g.fillRect(0, 0, W, H);

    drawPosterHead(g, W, headH, d);
    drawPosterBody(g, W, pad, headH + 26, rowH, gap, d, st);
    drawPosterFoot(g, W, H, pad, d, st);
    return cv;
  }

  function generatePoster() {
    var d = posterData();
    if (!d.count) { toast('装备库里还没有装备'); return; }
    var cv = buildPoster(d);
    poster.result = cv.toDataURL('image/png');
    var img = $('#poster-result-img');
    if (img) img.src = poster.result;
    closeSheet('#poster-sheet');
    openSheet('#poster-view-sheet');
    setTimeout(function () {
      var sc = $('#poster-view-sheet .sheet-scroll');
      if (sc) sc.scrollTop = 0;
    }, 60);
  }

  function dataUrlToBlob(dataUrl) {
    var parts = String(dataUrl).split(',');
    var mime = (parts[0].match(/:(.*?);/) || [])[1] || 'image/png';
    var bin = atob(parts[1]);
    var arr = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    return new Blob([arr], { type: mime });
  }

  function savePoster() {
    if (!poster.result) { toast('先点「生成」'); return; }
    var name = String(poster.title || '装备清单').replace(/[\\/:*?"<>|]/g, '');
    try {
      var url = URL.createObjectURL(dataUrlToBlob(poster.result));
      var a = document.createElement('a');
      a.href = url;
      a.download = name + '.png';
      a.click();
      setTimeout(function () { URL.revokeObjectURL(url); }, 3000);
      toast('图片已保存');
    } catch (e) {
      toast('保存失败，可以长按图片保存');
    }
  }

  function zoomPoster() {
    if (!poster.result) return;
    try {
      var url = URL.createObjectURL(dataUrlToBlob(poster.result));
      var w = window.open(url, '_blank');
      if (!w) toast('长按图片可以保存');
      setTimeout(function () { URL.revokeObjectURL(url); }, 60000);
    } catch (e) {
      toast('长按图片可以保存');
    }
  }

  function pickFile(accept, cb) {
    var f = document.createElement('input');
    f.type = 'file';
    f.accept = accept;
    f.onchange = function () { if (f.files[0]) cb(f.files[0]); };
    f.click();
  }

  /* =========================================================
     弹层控制
     ========================================================= */
  function openSheet(sel) { $(sel).classList.add('open'); }
  function closeSheet(sel) { $(sel).classList.remove('open'); }

  function switchTab(name) {
    state.tab = name;
    $$('.tab').forEach(function (t) { t.classList.toggle('on', t.getAttribute('data-tab') === name); });
    $$('.view').forEach(function (v) { v.classList.add('hidden'); });
    var view = $('#view-' + name);
    if (view) view.classList.remove('hidden');
    if (name === 'gear') renderGear();
    if (name === 'stats') renderStats();
    if (name === 'assets') renderAssets();
    if (name === 'mine') renderMine();
    window.scrollTo(0, 0);
  }

  function ownedItem(gearId) {
    return DB.items.find(function (it) { return it.catalogId === gearId && !it.deleted; }) || null;
  }

  /* ---------- 云同步 ---------- */
  var focusTimer = 0;
  var cloudConnected = false;
  var LS_SYNC = 'gear.sync.lastAt';

  function getLastSync() {
    try { return Number(localStorage.getItem(LS_SYNC)) || 0; } catch (e) { return 0; }
  }
  function setLastSync() {
    try { localStorage.setItem(LS_SYNC, String(Date.now())); } catch (e) {}
  }
  function fmtSyncTime(ts) {
    if (!ts) return '尚未同步';
    var d = new Date(ts);
    var hh = pad(d.getHours()) + ':' + pad(d.getMinutes());
    var day = d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
    return day === todayStr() ? '今天 ' + hh : (d.getMonth() + 1) + '月' + d.getDate() + '日 ' + hh;
  }

  // 同 id 取 updatedAt 大的；这样既保留本地示例数据，
  // 也不会把同步期间刚改完、还没上传的记录覆盖掉
  function mergeById(localList, remoteList) {
    var map = {};
    var out = [];
    (localList || []).forEach(function (x) { if (x && x.id) map[x.id] = x; });
    (remoteList || []).forEach(function (r) {
      if (!r || !r.id) return;
      var l = map[r.id];
      if (!l || (r.updatedAt || 0) > (l.updatedAt || 0)) map[r.id] = r;
    });
    for (var k in map) if (Object.prototype.hasOwnProperty.call(map, k)) out.push(map[k]);
    return out;
  }

  function doSync(manual) {
    if (!window.Cloud || !Cloud.enabled() || !Cloud.isReady()) {
      if (manual) toast('未配置云端');
      return;
    }
    if (manual) toast('正在同步…');
    Cloud.sync(DB).then(function (merged) {
      if (!merged) {
        if (manual) toast(Cloud.status() === 'syncing' ? '正在同步，请稍候' : '同步失败');
        return;
      }
      // 云端只有真实记录；合并时本地示例继续留在本机展示、不上传
      DB.items = mergeById(DB.items, merged.items);
      DB.gear = mergeById(DB.gear, merged.gear);
      try {
        localStorage.setItem(LS, JSON.stringify({ items: DB.items, gear: DB.gear }));
      } catch (e) {}
      renderAssets(); renderGear(); renderStats();
      if (manual) toast('同步完成');
    });
  }

  function setupCloud() {
    if (!window.Cloud || !Cloud.enabled()) return;
    var dot = $('#sync-dot');
    var tokenMode = Cloud.isTokenMode();

    Cloud.onStatus(function (s) {
      var cls = 'sync-dot';
      if (s === 'ok') cls += ' ok';
      else if (s === 'syncing') cls += ' syncing';
      else if (s === 'error') cls += ' error';
      if (s === 'ok') setLastSync();
      dot.className = cls;
      dot.title = s === 'error'
        ? '同步失败：' + Cloud.lastError()
        : s === 'ok' ? '已同步 · ' + fmtSyncTime(getLastSync())
        : s === 'syncing' ? '同步中' : '待同步';
    });

    // Gist 模式：把登录框改造成 Token 输入框
    if (tokenMode) {
      var emailEl = $('#login-email');
      var pwdEl = $('#login-pwd');
      if (emailEl) {
        emailEl.type = 'password';
        emailEl.placeholder = 'GitHub Token（gist 权限）';
      }
      if (pwdEl) pwdEl.classList.add('hidden');
      if ($('#login-btn')) $('#login-btn').textContent = '连接并同步';
      var h2 = $('.login-wrap h2');
      if (h2) h2.textContent = '连接云同步';
      var sub = $('.login-sub');
      if (sub) sub.innerHTML = '数据存进你自己的私有 Gist<br>换手机、换电脑都能看到同一份';
      var tip = $('.login-tip');
      if (tip) tip.innerHTML = '获取方式：GitHub → Settings → Developer settings<br>→ Personal access tokens (classic) → 勾选 gist';
      if ($('#login-skip')) $('#login-skip').textContent = '先离线使用，连接后自动同步';
    }

    Cloud.boot().then(function (res) {
      cloudConnected = !!res.loggedIn;
      if (!res.loggedIn) {
        // Token 模式不弹窗打扰，等用户主动去 ⚙ 里连接
        if (!tokenMode) openSheet('#login-sheet');
        return;
      }
      doSync(false);
    });

    // 切回页面时补一次同步（30 秒节流）
    window.addEventListener('focus', function () {
      var now = Date.now();
      if (now - focusTimer < 30000) return;
      focusTimer = now;
      doSync(false);
    });
  }

  /* =========================================================
     导入导出
     ========================================================= */
  function csvEscape(v) {
    var s = String(v == null ? '' : v);
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }

  function exportCSV() {
    var head = ['名称', '分类', '购买日期', '价格', '数量', '附加', '单位', '数量单位', '状态', '已用次数', '备注'];
    var rows = DB.items.filter(function (it) { return !it.deleted && !it.demo; }).map(function (it) {
      return [it.name, it.cat, it.purchaseDate, it.price, it.qty, it.extra || 0,
              it.lifeValue || 0, it.lifeUnit, it.status, it.baseCount || 0, it.notes || ''];
    });
    var csv = '\ufeff' + [head].concat(rows).map(function (r) { return r.map(csvEscape).join(','); }).join('\n');
    var blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = '物品台账_' + todayStr() + '.csv';
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
    toast('已导出 CSV');
  }

  function itemKey(name, date, price, qty) {
    return [String(name).trim(), date || '', Number(price) || 0, Number(qty) || 1].join('|');
  }

  function importCSV(file) {
    var reader = new FileReader();
    reader.onload = function () {
      var text = String(reader.result || '').replace(/^\ufeff/, '');
      var rows = parseCSV(text).filter(function (r) {
        return r.length && String(r[0] == null ? '' : r[0]).trim();
      });
      if (rows.length < 2) { toast('文件为空'); return; }

      // 同名 + 同日期 + 同价格 + 同数量视为重复，避免重复导入翻倍
      var seen = {};
      DB.items.forEach(function (it) {
        if (!it.deleted) seen[itemKey(it.name, it.purchaseDate, it.price, it.qty)] = true;
      });

      var n = 0, skip = 0;
      for (var i = 1; i < rows.length; i++) {
        var cols = rows[i];
        var name = String(cols[0] || '').trim();
        if (!name) continue;
        var date = cols[2] || todayStr();
        var price = Number(cols[3]) || 0;
        var qty = Number(cols[4]) || 1;
        var key = itemKey(name, date, price, qty);
        if (seen[key]) { skip++; continue; }
        seen[key] = true;

        // CSV 里的自定义分类自动补进来，不要都塞到「其他」
        var cName = String(cols[1] || '').trim() || '其他';
        if (CATS.indexOf(cName) < 0) { CATS.push(cName); saveCats(); }

        DB.items.unshift({
          id: uid(),
          name: name,
          cat: cName,
          purchaseDate: date,
          price: price,
          qty: qty,
          extra: Number(cols[5]) || 0,
          lifeValue: Number(cols[6]) || 0,
          lifeUnit: ['年', '月', '天'].indexOf(cols[7]) >= 0 ? cols[7] : '年',
          hasExpiry: (Number(cols[6]) || 0) > 0,
          status: ['服役中', '预备役', '已退役'].indexOf(cols[8]) >= 0 ? cols[8] : '服役中',
          subtractResale: false, resale: 0,
          trackPerUse: Number(cols[9]) > 0,
          baseCount: Number(cols[9]) || 0,
          useLog: [],
          notes: cols[10] || '',
          icon: '📦'
        });
        n++;
      }
      saveAll();
      renderAssets(); renderGear(); renderStats();
      toast('已导入 ' + n + ' 条' + (skip ? '，跳过重复 ' + skip + ' 条' : ''));
    };
    reader.readAsText(file);
  }

  // 整段解析，支持引号里带换行和逗号
  function parseCSV(text) {
    var rows = [], row = [], cur = '', q = false;
    for (var i = 0; i < text.length; i++) {
      var ch = text[i];
      if (q) {
        if (ch === '"') {
          if (text[i + 1] === '"') { cur += '"'; i++; }
          else q = false;
        } else cur += ch;
      } else if (ch === '"') {
        q = true;
      } else if (ch === ',') {
        row.push(cur); cur = '';
      } else if (ch === '\n') {
        row.push(cur); rows.push(row); row = []; cur = '';
      } else if (ch !== '\r') {
        cur += ch;
      }
    }
    if (cur !== '' || row.length) { row.push(cur); rows.push(row); }
    return rows;
  }

  /* ---------- 全量备份（JSON） ---------- */
  function exportBackup() {
    var data = {
      app: 'gear-ledger',
      version: 2,
      exportedAt: new Date().toISOString(),
      items: DB.items,
      gear: DB.gear
    };
    var blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = '装备台账_备份_' + todayStr() + '.json';
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
    toast('已导出备份');
  }

  function importBackup(file) {
    var reader = new FileReader();
    reader.onload = function () {
      var data;
      try { data = JSON.parse(String(reader.result || '')); } catch (e) {
        toast('文件格式不对，不是备份文件');
        return;
      }
      if (!data || (!Array.isArray(data.items) && !Array.isArray(data.gear))) {
        toast('文件里没有台账数据');
        return;
      }
      if (!confirm('导入备份会和当前数据合并，同一条记录以更新时间新的为准。继续吗？')) return;

      var items = (data.items || []).filter(function (x) { return x && typeof x === 'object'; });
      var gear = (data.gear || []).filter(function (x) { return x && typeof x === 'object'; });
      items.forEach(function (x) {
        if (!x.id) x.id = uid();
        if (!Array.isArray(x.useLog)) x.useLog = [];
      });
      gear.forEach(function (x) {
        if (!x.id) x.id = newGearId();
        if (!Array.isArray(x.tags)) x.tags = [];
        if (!Array.isArray(x.specs)) x.specs = [];
        if (!Array.isArray(x.perf)) x.perf = [];
      });

      DB.items = mergeById(DB.items, items);
      DB.gear = mergeById(DB.gear, gear);
      saveAll();
      renderAssets(); renderGear(); renderStats();
      toast('已导入备份：物品 ' + items.length + ' 条，装备 ' + gear.length + ' 件');
    };
    reader.readAsText(file);
  }

  function openMenu() {
    var cloudBtns = '';
    var syncInfo = '';
    if (window.Cloud && Cloud.enabled()) {
      syncInfo = '<div class="menu-meta">' +
        (cloudConnected ? '上次同步：' + fmtSyncTime(getLastSync()) : '还没连接云同步') +
        '</div>';
      if (cloudConnected) {
        cloudBtns =
          '<button class="btn-main ghost" data-menu="sync">立即同步</button>' +
          '<button class="btn-main ghost" data-menu="logout">断开云同步</button>';
      } else {
        cloudBtns = '<button class="btn-main ghost" data-menu="connect">连接云同步</button>';
      }
    }
    var el = document.createElement('div');
    el.className = 'sheet open';
    el.id = 'menu-sheet';
    el.innerHTML =
      '<div class="sheet-panel" style="height:auto;max-height:90vh;overflow-y:auto;border-radius:20px 20px 0 0;margin-top:auto">' +
        '<div class="sheet-head"><span style="width:44px"></span><strong>更多</strong>' +
        '<button class="icon-btn" data-menu-close>✕</button></div>' +
        '<div style="padding:14px 14px calc(22px + var(--safe-b));display:flex;flex-direction:column;gap:10px">' +
          syncInfo +
          cloudBtns +
          '<button class="btn-main ghost" data-menu="backup">导出备份（JSON）</button>' +
          '<button class="btn-main ghost" data-menu="restore">导入备份（JSON）</button>' +
          '<button class="btn-main ghost" data-menu="import">导入 CSV</button>' +
          '<button class="btn-main ghost" data-menu="reset">恢复示例数据</button>' +
          '<button class="btn-main ghost" data-menu="clear" style="color:#f04438;border-color:#ffe3e1">清空全部记录</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(el);
    // 点遮罩关闭
    el.addEventListener('click', function (e) {
      if (e.target === el) el.remove();
    });
  }

  /* =========================================================
     事件绑定
     ========================================================= */
  document.addEventListener('click', function (ev) {
    var el = ev.target;

    // 关闭弹层
    if (el.closest('[data-close]')) {
      var sheet = el.closest('.sheet');
      if (sheet) sheet.classList.remove('open');
      return;
    }
    if (el.closest('[data-menu-close]')) {
      var m = $('#menu-sheet'); if (m) m.remove();
      return;
    }
    if (el.closest('#demo-tip-close')) {
      try { localStorage.setItem(DEMO_TIP_KEY, '1'); } catch (e) {}
      $('#demo-tip').classList.add('hidden');
      return;
    }

    // 底部导航
    var tab = el.closest('[data-tab]');
    if (tab) { switchTab(tab.getAttribute('data-tab')); return; }

    // 状态 tab
    var st = el.closest('[data-state]');
    if (st) { state.status = st.getAttribute('data-state'); renderAssets(); return; }

    // 空状态：一键回到全部
    if (el.closest('#asset-empty-reset')) {
      state.cat = '全部分类';
      state.status = '全部';
      state.q = '';
      var resetQ = $('#q');
      if (resetQ) resetQ.value = '';
      renderAssets();
      return;
    }

    // 分类 chip
    var chip = el.closest('[data-cat]');
    if (chip) { state.cat = chip.getAttribute('data-cat'); renderAssets(); return; }

    // 装备库分类
    var gchip = el.closest('[data-gcat]');
    if (gchip) { state.gearCat = gchip.getAttribute('data-gcat'); renderGear(); return; }

    // 装备库视图切换：文字 / 宫格 / 列表
    var gview = el.closest('[data-gview]');
    if (gview) {
      state.gearView = gview.getAttribute('data-gview');
      try { localStorage.setItem('gear-ledger-view', state.gearView); } catch (e) {}
      renderGear();
      return;
    }

    // 分组折叠
    var gcol = el.closest('[data-gcol]');
    if (gcol) {
      var ck = gcol.getAttribute('data-gcol');
      state.gearCollapsed[ck] = !state.gearCollapsed[ck];
      renderGear();
      return;
    }

    // 装备筛选
    if (el.closest('#btn-gfilter')) { openGearFilter(); return; }
    if (el.closest('#btn-gfilter-reset')) {
      resetGearFilters();
      renderGearFilter();
      renderGear();
      return;
    }
    if (el.closest('#btn-gfilter-apply')) {
      closeSheet('#gfilter-sheet');
      return;
    }
    var gfb = el.closest('[data-gfbrand]');
    if (gfb) { state.gearBrand = gfb.getAttribute('data-gfbrand'); renderGearFilter(); renderGear(); return; }
    var gft = el.closest('[data-gftype]');
    if (gft) { state.gearType = gft.getAttribute('data-gftype'); renderGearFilter(); renderGear(); return; }
    var gfp = el.closest('[data-gfprice]');
    if (gfp) { state.gearPrice = gfp.getAttribute('data-gfprice'); renderGearFilter(); renderGear(); return; }
    if (el.closest('[data-gffav]')) {
      state.gearFav = !state.gearFav;
      renderGearFilter();
      renderGear();
      return;
    }

    // 资产视图切换：文字 / 宫格 / 列表
    var aview = el.closest('[data-aview]');
    if (aview) {
      state.assetView = aview.getAttribute('data-aview');
      try { localStorage.setItem('gear-ledger-asset-view', state.assetView); } catch (e) {}
      renderAssets();
      return;
    }

    // 资产卡片
    var asset = el.closest('.asset, .acard, .aitem');
    if (asset) { openDetail(asset.getAttribute('data-id')); return; }

    // 收藏（必须先于卡片打开判断）
    var fav = el.closest('[data-fav]');
    if (fav) {
      ev.stopPropagation();
      var g = DB.gear.find(function (x) { return x.id === fav.getAttribute('data-fav'); });
      if (g) { g.fav = !g.fav; g.updatedAt = Date.now(); saveAll(); renderGear(); }
      return;
    }

    // 加入资产（必须先于卡片打开判断）
    var gadd = el.closest('[data-gadd]');
    if (gadd) {
      ev.stopPropagation();
      var gear = DB.gear.find(function (x) { return x.id === gadd.getAttribute('data-gadd'); });
      if (gear) {
        if (ownedItem(gear.id)) { toast('这件装备已在你的资产里'); return; }
        closeSheet('#gsheet');
        openEditor(null, {
          name: gear.name,
          cat: CATS.indexOf(gear.cat) >= 0 ? gear.cat : '户外',
          price: gear.refPrice,
          icon: gear.icon,
          catalogId: gear.id
        });
      }
      return;
    }

    // 从装备库跳回资产详情
    var goto = el.closest('[data-goto]');
    if (goto) {
      ev.stopPropagation();
      closeSheet('#gsheet');
      switchTab('assets');
      openDetail(goto.getAttribute('data-goto'));
      return;
    }

    // 编辑装备
    var gedit = el.closest('[data-gedit]');
    if (gedit) {
      ev.stopPropagation();
      var eg = DB.gear.find(function (x) { return x.id === gedit.getAttribute('data-gedit'); });
      if (eg) { closeSheet('#gsheet'); openGearEditor(eg); }
      return;
    }

    var open = el.closest('[data-open]');
    if (open) { openGear(open.getAttribute('data-open')); return; }

    // 用了一次
    var use = el.closest('[data-use]');
    if (use) {
      ev.stopPropagation();
      var id = use.getAttribute('data-use');
      var it = DB.items.find(function (x) { return x.id === id; });
      if (it) {
        it.useLog = it.useLog || [];
        it.useLog.push(todayStr());
        it.updatedAt = Date.now();
        saveAll();
        openDetail(id);
        toast('已记录一次使用');
      }
      return;
    }

    // 我的：分类管理
    if (el.closest('#mine-cats')) { openCats(); return; }
    if (el.closest('#cat-add')) { addCat(); return; }
    var catRen = el.closest('[data-cat-rename]');
    if (catRen) { renameCat(catRen.getAttribute('data-cat-rename')); return; }
    var catDel = el.closest('[data-cat-del]');
    if (catDel) { deleteCat(catDel.getAttribute('data-cat-del')); return; }

    // 我的：数据与分享
    var mineAct = el.closest('[data-mine]');
    if (mineAct) {
      var mact = mineAct.getAttribute('data-mine');
      if (mact === 'csv') exportCSV();
      if (mact === 'backup') exportBackup();
      if (mact === 'restore') pickFile('.json,application/json', importBackup);
      if (mact === 'importCsv') pickFile('.csv,text/csv', importCSV);
      if (mact === 'poster') openPoster();
      return;
    }

    // 生成装备图片
    var planBtn = el.closest('[data-plan]');
    if (planBtn) {
      poster.plan = planBtn.getAttribute('data-plan');
      renderPosterPlans(posterData());
      return;
    }
    var pstyleBtn = el.closest('[data-pstyle]');
    if (pstyleBtn) {
      poster.style = pstyleBtn.getAttribute('data-pstyle');
      renderPosterStyles();
      return;
    }
    var pcontentBtn = el.closest('[data-pcontent]');
    if (pcontentBtn) {
      poster.content = pcontentBtn.getAttribute('data-pcontent');
      renderPosterContent();
      return;
    }
    if (el.closest('#poster-bg-pick')) {
      var bgFile = $('#poster-bg-file');
      if (bgFile) bgFile.click();
      return;
    }
    if (el.closest('#poster-bg-reset')) {
      poster.bgImage = null;
      poster.bgCustom = false;
      renderPosterBg();
      return;
    }
    if (el.closest('#poster-gen')) { generatePoster(); return; }
    if (el.closest('#poster-cancel')) { closeSheet('#poster-sheet'); return; }
    if (el.closest('#poster-save')) { savePoster(); return; }
    if (el.closest('#poster-result-img')) { zoomPoster(); return; }

    // 菜单
    var mi = el.closest('[data-menu]');
    if (mi) {
      var act = mi.getAttribute('data-menu');
      var ms = $('#menu-sheet');
      if (ms) ms.remove();
      if (act === 'export') exportCSV();
      if (act === 'import') {
        var fi = document.createElement('input');
        fi.type = 'file'; fi.accept = '.csv,text/csv';
        fi.onchange = function () { if (fi.files[0]) importCSV(fi.files[0]); };
        fi.click();
      }
      if (act === 'backup') exportBackup();
      if (act === 'restore') {
        var fb = document.createElement('input');
        fb.type = 'file'; fb.accept = '.json,application/json';
        fb.onchange = function () { if (fb.files[0]) importBackup(fb.files[0]); };
        fb.click();
      }
      if (act === 'reset') {
        if (confirm('恢复示例数据会清空当前全部记录，确定吗？')) {
          var stamp = Date.now();
          // 旧的真实记录保留删除标记，云端才会一起清掉；旧示例直接丢掉
          var keepItems = [];
          DB.items.forEach(function (x) {
            if (x.demo) return;
            x.deleted = true; x.updatedAt = stamp;
            keepItems.push(x);
          });
          var keepGear = [];
          DB.gear.forEach(function (x) {
            if (x.demo) return;
            x.deleted = true; x.updatedAt = stamp;
            keepGear.push(x);
          });
          // 示例 id 加时间后缀，避免和刚删掉的老记录撞 id 导致删除失效
          var seedSuffix = '_' + stamp.toString(36);
          var freshGear = markDemo(seedGear());
          var gearIdMap = {};
          freshGear.forEach(function (g) {
            var oldId = g.id;
            g.id = oldId + seedSuffix;
            gearIdMap[oldId] = g.id;
          });
          var freshItems = markDemo(seedItems());
          freshItems.forEach(function (it) {
            it.id = it.id + seedSuffix;
            if (it.catalogId && gearIdMap[it.catalogId]) it.catalogId = gearIdMap[it.catalogId];
          });
          DB.items = keepItems.concat(freshItems);
          DB.gear = keepGear.concat(freshGear);
          resetGearFilters();
          saveAll();
          renderAssets(); renderGear(); renderStats();
          toast('已恢复');
        }
      }
      if (act === 'clear') {
        if (confirm('清空全部记录？会同时清空云端，不可撤销。建议先导出 CSV。')) {
          var now = Date.now();
          DB.items.forEach(function (x) { x.deleted = true; x.updatedAt = now; });
          DB.gear.forEach(function (x) { x.deleted = true; x.updatedAt = now; });
          resetGearFilters();
          saveAll();
          renderAssets(); renderGear(); renderStats();
          toast('已清空');
        }
      }
      if (act === 'connect') { openSheet('#login-sheet'); }
      if (act === 'sync') { doSync(true); }
      if (act === 'logout') {
        Cloud.logout().then(function () {
          cloudConnected = false;
          openSheet('#login-sheet');
          $('#login-err').textContent = '';
        });
      }
      return;
    }

    // 图标选择
    if (el.closest('#icon-preview')) {
      $('#icon-picker').classList.toggle('hidden');
      return;
    }
    var ip = el.closest('[data-icon]');
    if (ip) {
      state.formIcon = ip.getAttribute('data-icon');
      $('#icon-preview').innerHTML = state.formIcon + ' <small>选择</small>';
      $('#icon-picker').classList.add('hidden');
      return;
    }

    // 装备图标选择
    if (el.closest('#gicon-preview')) {
      $('#gicon-picker').classList.toggle('hidden');
      return;
    }
    var gip = el.closest('[data-gicon]');
    if (gip) {
      state.gearFormIcon = gip.getAttribute('data-gicon');
      $('#gicon-preview').innerHTML = state.gearFormIcon + ' <small>选择</small>';
      $('#gicon-picker').classList.add('hidden');
      return;
    }

    // 搜索开合
    if (el.closest('#btn-search')) {
      $('#searchbox').classList.toggle('hidden');
      if (!$('#searchbox').classList.contains('hidden')) $('#q').focus();
      return;
    }
    if (el.closest('#btn-q-clear')) {
      $('#q').value = ''; state.q = '';
      $('#searchbox').classList.add('hidden');
      renderAssets();
      return;
    }
  });

  // 顶部齿轮
  $('#btn-more').addEventListener('click', openMenu);

  // 新增
  $('#btn-new').addEventListener('click', function () { openEditor(null, null); });
  $('#btn-g-new').addEventListener('click', function () { openGearEditor(null); });
  $('#btn-g-new-top').addEventListener('click', function () { openGearEditor(null); });

  // 装备编辑表单
  $('#geditor-form').addEventListener('submit', saveGearEditor);
  $('#btn-gdel').addEventListener('click', deleteGear);

  // 编辑 / 删除
  $('#btn-edit').addEventListener('click', function () {
    var it = DB.items.find(function (x) { return x.id === state.detailId; });
    if (it) { closeSheet('#detail-sheet'); openEditor(it, null); }
  });

  $('#btn-del').addEventListener('click', function () {
    var it = DB.items.find(function (x) { return x.id === state.detailId; });
    if (!it) return;
    if (confirm('删除「' + it.name + '」？')) {
      it.deleted = true;
      it.updatedAt = Date.now();
      saveAll(); closeSheet('#detail-sheet'); renderAssets(); toast('已删除');
    }
  });

  // 表单
  $('#editor-form').addEventListener('submit', saveEditor);

  // 排序
  $('#sort-select').addEventListener('change', function (e) {
    state.sort = e.target.value;
    renderAssets();
  });

  // 搜索
  $('#q').addEventListener('input', function (e) {
    state.q = e.target.value;
    renderAssets();
  });
  $('#gq').addEventListener('input', function (e) {
    state.gearQ = e.target.value;
    renderGear();
  });

  // 点遮罩关闭（登录框除外，必须登录）
  $$('.sheet').forEach(function (s) {
    s.addEventListener('click', function (e) {
      if (s.id === 'login-sheet') return;
      if (e.target === s) s.classList.remove('open');
    });
  });

  /* 我的：下拉与输入 */
  document.addEventListener('change', function (ev) {
    var el = ev.target;
    if (el.id === 'mine-cur') { setCur(el.value); return; }
    if (el.id === 'mine-theme') { setTheme(el.value); return; }
    if (el.id === 'poster-bg-file') {
      var file = el.files && el.files[0];
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function () {
        var img = new Image();
        img.onload = function () {
          poster.bgImage = img;
          poster.bgCustom = true;
          renderPosterBg();
          toast('背景已更换');
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
      return;
    }
  });

  document.addEventListener('input', function (ev) {
    var el = ev.target;
    if (el.id === 'poster-title') {
      poster.title = el.value.trim() || '个人装备清单';
      try { localStorage.setItem('gearLedger.posterTitle', poster.title); } catch (e) {}
    }
  });

  /* =========================================================
     初始化
     ========================================================= */
  $('#editor-cat').innerHTML = CATS.map(function (c) {
    return '<option>' + esc(c) + '</option>';
  }).join('');

  $('#icon-picker').innerHTML = ICONS.map(function (ic) {
    return '<button type="button" data-icon="' + ic + '">' + ic + '</button>';
  }).join('');

  $('#geditor-cat').innerHTML = GEAR_CATS.map(function (c) {
    return '<option>' + c + '</option>';
  }).join('');

  $('#gicon-picker').innerHTML = ICONS.map(function (ic) {
    return '<button type="button" data-gicon="' + ic + '">' + ic + '</button>';
  }).join('');

  /* 外观与货币 */
  applyTheme();
  applyCur();
  renderMine();

  if (window.matchMedia) {
    var mq = window.matchMedia('(prefers-color-scheme: dark)');
    var onScheme = function () { if (getTheme() === 'auto') applyTheme(); };
    if (mq.addEventListener) mq.addEventListener('change', onScheme);
    else if (mq.addListener) mq.addListener(onScheme);
  }

  $('#cat-new').addEventListener('keydown', function (e) {
    if (e.key === 'Enter') { e.preventDefault(); addCat(); }
  });

  // 登录
  if ($('#login-btn')) {
    $('#login-btn').addEventListener('click', function () {
      var first = $('#login-email').value.trim();
      var pwd = $('#login-pwd').value;
      var err = $('#login-err');
      var tokenMode = Cloud.isTokenMode();

      if (tokenMode) {
        if (!first) { err.textContent = '请粘贴 GitHub Token'; return; }
        err.textContent = '连接中…';
        Cloud.login(first).then(function () {
          err.textContent = '';
          $('#login-email').value = '';
          cloudConnected = true;
          closeSheet('#login-sheet');
          toast('已连接，开始同步');
          doSync(false);
        }).catch(function (e) {
          err.textContent = (e && e.message) ? e.message : '连接失败';
        });
        return;
      }

      if (!first || !pwd) { err.textContent = '请填写邮箱和密码'; return; }
      err.textContent = '登录中…';
      Cloud.login(first, pwd).then(function () {
        err.textContent = '';
        $('#login-pwd').value = '';
        cloudConnected = true;
        closeSheet('#login-sheet');
        toast('已登录');
        doSync(false);
      }).catch(function (e) {
        err.textContent = (e && e.message) ? e.message : '登录失败，请检查邮箱和密码';
      });
    });

    $('#login-pwd').addEventListener('keydown', function (e) {
      if (e.key === 'Enter') $('#login-btn').click();
    });
    $('#login-email').addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && Cloud.isTokenMode()) $('#login-btn').click();
    });
    $('#login-skip').addEventListener('click', function () {
      closeSheet('#login-sheet');
      toast('离线模式：先存本机，连接后会自动合并');
    });
  }

  /* 横滑筛选条：滚到头时取消右缘渐隐 */
  ['#cat-chips', '#gear-chips'].forEach(function (sel) {
    var box = $(sel);
    if (!box) return;
    box.addEventListener('scroll', function () { updateChipsEdge(box); });
    bindChipsDrag(box);
  });
  window.addEventListener('resize', function () {
    updateChipsEdge($('#cat-chips'));
    updateChipsEdge($('#gear-chips'));
  });

  renderAssets();
  renderGear();
  renderStats();
  setupCloud();

  // 深链接：?tab=gear / ?detail=s1 / ?gear=g1 / ?edit=1
  try {
    var qs = new URLSearchParams(location.search);
    var t = qs.get('tab');
    if (t === 'gear' || t === 'stats' || t === 'assets') switchTab(t);
    if (qs.get('detail')) { switchTab('assets'); openDetail(qs.get('detail')); }
    if (qs.get('gear')) { switchTab('gear'); openGear(qs.get('gear')); }
    if (qs.get('edit')) { switchTab('assets'); openEditor(null, null); }
    if (qs.get('connect')) { openSheet('#login-sheet'); }
  } catch (err) { /* 忽略 */ }
})();
