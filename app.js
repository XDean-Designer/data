(function () {
  'use strict';

  var HOME_FLOW = 'login';
  var state = {
    pendingInvite: false,
    fabVisible: false,
    importSelection: { member: true, card: false, price: true },
    importSources: { member: null, card: null, price: null },
    importFiles: { member: [], card: [], price: [] },
    importPhotos: { member: [], card: [], price: [] },
    uploadStep: 0,
    tplGen: null,
    tplGenIncluded: [],
    importCameraCat: null,
    importCameraReturn: 'import-select',
    importCameraStream: null,
    importCameraDemo: false,
    uploadFocus: null,
    uploadHi: null,
    hdrOpen: false,
    hdrCats: [],
    srcDialog: null,
    queueBusy: false,
    importMapTab: 'member',
    historyImporting: false,
    importMapValues: {},
    importMapAck: {},
    importPlan: { excel: [], photo: [] },
    importLastDataStep: 'import-source',
    importMapConfirmed: false,
    importFromPhoto: false,
    importMapSkipResetAck: false,
    importPreviewType: null,
    importMapReturned: false,
    importing: false,
    batchDeleted: false,
    claimEmpty: false,
    membersRendered: false,
    membersData: null,
    failFixId: null,
    failFixed: {},
    failRemoved: {},
    failEdit: {},
    historyQuery: { from: '', to: '', min: '', max: '', name: '' },
    historySelectedId: null,
    historyDeleted: false,
    historyImported: false,
    historyMap: { date: '消费日期', amount: '实收金额', name: '顾客姓名' },
    /* 本店已入库存量（再导入承接） */
    storeStock: { member: 0, card: 0, price: 0, history: 0 },
    /* 再导模式：merge | replace；首次导入为 null */
    reimportMode: { member: null, card: null, price: null },
    historyReimportIntent: null, /* append | replace */
    viewReturn: null,
    pendingStockApply: false,
    /* v2.0 标准表转换 + 数据概览 */
    checkData: null,
    checkTab: 'member',
    checkFilter: 'all',
    checkQuery: '',
    checkLimit: 24,
    checkOpen: null,
    checkProbIdx: 0,
    convertDone: false,
    convertRunning: false,
    convertTimers: [],
    wechatTipShown: false,
    ceremonyRunning: false,
    ceremonyCounts: null,
    ceremonyCode: '',
    legacy: {
      failId: null,
      cardFailId: null,
      name: '',
      gender: '',
      phone: '',
      mode: 'legacy',
      group: '',
      pickId: null,
      editingKey: null,
      cards: []
    },
    legacySeq: 0
  };
  var FAIL_FIX_SEED = {
    f1: { name: '赵女士', phone: '1380013abc', gender: '女' },
    f2: { name: '孙先生', phone: '13900001111', gender: '男' },
  };

  // 补录老卡可选卡种（分组 → 卡；价格 = 面值，meta = 余额/次数口径）
  var LEGACY_CARD_GROUPS = [
    {
      key: 'stored',
      label: '储值卡',
      cards: [
        { id: 's1', name: '储值卡 · 500', price: 500, meta: '面值 ¥500 · 余额按金额' },
        { id: 's2', name: '储值卡 · 1000', price: 1000, meta: '面值 ¥1,000 · 余额按金额' },
        { id: 's3', name: '储值卡 · 2000', price: 2000, meta: '面值 ¥2,000 · 余额按金额' },
        { id: 's4', name: '储值卡 · 5000', price: 5000, meta: '面值 ¥5,000 · 余额按金额' }
      ]
    },
    {
      key: 'count',
      label: '次卡',
      cards: [
        { id: 'c1', name: '洗剪吹次卡 · 10 次', price: 300, meta: '次数卡 · 共 10 次' },
        { id: 'c2', name: '洗剪吹次卡 · 20 次', price: 520, meta: '次数卡 · 共 20 次' },
        { id: 'c3', name: '头皮护理次卡 · 6 次', price: 680, meta: '次数卡 · 共 6 次' }
      ]
    },
    {
      key: 'package',
      label: '套餐',
      cards: [
        { id: 'p1', name: '染发套餐', price: 368, meta: '套餐 · 含染发 1 次' },
        { id: 'p2', name: '烫染护套餐', price: 688, meta: '套餐 · 含烫染各 1 次' },
        { id: 'p3', name: '护理年卡', price: 1980, meta: '年卡 · 有效 12 个月' }
      ]
    }
  ];

  var PREVIEW_TYPE_META = {
    member: { title: '会员与持卡明细', sub: '抽样 10 条 · 点行核对字段', count: 126 },
    card: { title: '卡模板明细', sub: '全部模板 · 点行核对字段', count: 4 },
    price: { title: '价目表明细', sub: '抽样 10 条 · 点行核对字段', count: 42 },
  };

  /* 本批导入造数；再导合并时的「新增 / 更新」演示拆分 */
  var BATCH_DEMO = { member: 126, card: 4, price: 42 };
  var MERGE_DEMO = {
    member: { add: 18, upd: 12 },
    card: { add: 1, upd: 2 },
    price: { add: 5, upd: 8 }
  };
  var STOCK_UNIT = { member: '人', card: '张', price: '项' };

  var INVITE_LANDING = {
    home: 1,
  };

  var TRIAGE_DEFER_MSG = {
    rts: '「获客」承接本期不做，敬请期待',
    rtp: '「卖货」承接本期不做，敬请期待',
    rtl: '「学习」承接本期不做，敬请期待',
  };

  var MEMBER_AVATARS = [
    'assets/member/avatar_card_female.png',
    'assets/member/avatar_male2.png',
    'assets/member/avatar_female2.png',
  ];

  // 运营标准会员表（members.xlsx）的 12 列 —— 自定义映射的参考列名
  var IMPORT_SOURCE_COLUMNS = [
    '会员编号', '姓名', '首字母', '手机号', '卡种', '卡有效期',
    '储值余额', '充值合计', '消费合计', '消费笔数', '距今天数', '支付方式',
  ];

  // 允许被自定义映射的源表列名：标准 12 列 + 性别（他系统表里常见，会员系统有该字段）
  var IMPORT_MAP_ALLOWED_COLUMNS = IMPORT_SOURCE_COLUMNS.concat(['性别']);

  // 性别称呼词表：先生 / 男士 → 男；女士 / 小姐 / 太太 / 夫人 → 女
  var GENDER_MALE_TITLES = ['先生', '男士'];
  var GENDER_FEMALE_TITLES = ['女士', '小姐', '太太', '夫人'];

  function deriveGenderFromName(name) {
    var s = String(name || '').trim();
    if (!s) return { value: '未知', source: 'none' };
    var i;
    for (i = 0; i < GENDER_MALE_TITLES.length; i += 1) {
      if (s.indexOf(GENDER_MALE_TITLES[i]) >= 0) {
        return { value: '男', source: 'name', hit: GENDER_MALE_TITLES[i] };
      }
    }
    for (i = 0; i < GENDER_FEMALE_TITLES.length; i += 1) {
      if (s.indexOf(GENDER_FEMALE_TITLES[i]) >= 0) {
        return { value: '女', source: 'name', hit: GENDER_FEMALE_TITLES[i] };
      }
    }
    return { value: '未知', source: 'none' };
  }

  function genderFieldLabel(g) {
    if (g.source === 'name') return g.value + ' · 按「' + g.hit + '」推断';
    if (g.source === 'column') return g.value + ' · 源表性别列';
    return '未知 · 无称呼可推断';
  }

  var SURNAME_PY = {
    艾: 'A',
    白: 'B',
    包: 'B',
    毕: 'B',
    蔡: 'C',
    曹: 'C',
    陈: 'C',
    程: 'C',
    崔: 'C',
    邓: 'D',
    丁: 'D',
    董: 'D',
    杜: 'D',
    段: 'D',
    范: 'F',
    方: 'F',
    冯: 'F',
    付: 'F',
    傅: 'F',
    高: 'G',
    葛: 'G',
    龚: 'G',
    郭: 'G',
    韩: 'H',
    何: 'H',
    贺: 'H',
    洪: 'H',
    侯: 'H',
    胡: 'H',
    黄: 'H',
    贾: 'J',
    江: 'J',
    姜: 'J',
    金: 'J',
    康: 'K',
    孔: 'K',
    赖: 'L',
    雷: 'L',
    李: 'L',
    梁: 'L',
    廖: 'L',
    林: 'L',
    刘: 'L',
    龙: 'L',
    卢: 'L',
    陆: 'L',
    罗: 'L',
    吕: 'L',
    马: 'M',
    毛: 'M',
    孟: 'M',
    莫: 'M',
    倪: 'N',
    聂: 'N',
    牛: 'N',
    欧: 'O',
    潘: 'P',
    彭: 'P',
    齐: 'Q',
    钱: 'Q',
    秦: 'Q',
    邱: 'Q',
    任: 'R',
    邵: 'S',
    沈: 'S',
    施: 'S',
    石: 'S',
    宋: 'S',
    苏: 'S',
    孙: 'S',
    谭: 'T',
    汤: 'T',
    唐: 'T',
    陶: 'T',
    田: 'T',
    万: 'W',
    汪: 'W',
    王: 'W',
    魏: 'W',
    吴: 'W',
    武: 'W',
    夏: 'X',
    萧: 'X',
    谢: 'X',
    熊: 'X',
    徐: 'X',
    许: 'X',
    薛: 'X',
    严: 'Y',
    颜: 'Y',
    杨: 'Y',
    叶: 'Y',
    易: 'Y',
    尹: 'Y',
    于: 'Y',
    余: 'Y',
    袁: 'Y',
    曾: 'Z',
    张: 'Z',
    章: 'Z',
    赵: 'Z',
    郑: 'Z',
    钟: 'Z',
    周: 'Z',
    朱: 'Z',
    邹: 'Z',
  };

  var SURNAME_LIST = Object.keys(SURNAME_PY);
  var GIVEN_MALE = ['伟', '强', '磊', '洋', '勇', '杰', '涛', '明', '超', '鹏', '浩', '宇', '昕然', '海泉'];
  var GIVEN_FEMALE = ['芳', '娜', '敏', '静', '丽', '婷', '雪', '琳', '雅婷', '欣怡', '佳', '倩', '璐', '涵'];
  // 会员当前持有的卡（取自会员卡模板的卡名称）
  var CARD_NAMES = ['黄金卡', '8折卡', '7.5折卡', '6折卡'];
  var PROJECTS = ['洗剪吹', '烫染护', '头皮护理', '造型', '美甲'];

  var IMPORT_CAT = { member: '会员与持卡信息', card: '会员卡模板', price: '价目表' };
  // 窄容器（tab / chip / 分类行）用短名，避免挤压换行
  var IMPORT_CAT_SHORT = { member: '会员与持卡', card: '卡模板', price: '价目表' };
  // 类别图标：与类型页保持同一套符号（36px 浅品牌底 + 20px 品牌色线描）
  var CAT_ICO = {
    member: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="3.6"/><path d="M4.8 20c0-3.7 3.2-5.6 7.2-5.6s7.2 1.9 7.2 5.6"/></svg>',
    card: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2.8" y="5.5" width="18.4" height="13" rx="2.6"/><path d="M2.8 10.2h18.4"/><path d="M6.6 14.6h4.2"/></svg>',
    price: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20.3 13.4l-6.9 6.9a2.1 2.1 0 0 1-2.9 0l-7.1-7.1a2 2 0 0 1-.6-1.4V5.4a2 2 0 0 1 2-2h6.4a2 2 0 0 1 1.4.6l7.7 7.7a2.1 2.1 0 0 1 0 1.7z"/><circle cx="8.1" cy="8.1" r="1.5"/></svg>'
  };

  // members.xlsx 的 12 列，即「会员与持卡信息」标准表头
  var MEMBER_STD_COLS = ['会员编号', '姓名', '首字母', '手机号', '卡种', '卡有效期', '储值余额', '充值合计', '消费合计', '消费笔数', '距今天数', '支付方式'];

  // 映射页按类别 tab 切换时使用的字段定义（每个类别一套，group 用于分组小标题）
  var IMPORT_FIELDS = {
    member: [
      { key: 'memberNo', label: '会员编号', group: '身份信息', opts: MEMBER_STD_COLS, ph: '输入源表列名，如 会员卡号' },
      { key: 'name', label: '姓名', group: '身份信息', opts: ['姓名', '会员姓名'], ph: '输入源表列名，如 顾客姓名' },
      { key: 'initial', label: '首字母', group: '身份信息', tag: '可推导', derived: true, opts: ['首字母'], ph: '输入源表列名，如 拼音首字母' },
      { key: 'phone', label: '手机号', group: '身份信息', opts: ['手机号', '联系电话', '手机'], ph: '输入源表列名，如 联系电话' },
      { key: 'cardType', label: '卡种', group: '身份信息', opts: ['卡种', '卡类型'], ph: '输入源表列名，如 卡名称' },
      { key: 'cardExpire', label: '卡有效期', group: '持卡与余额', opts: ['卡有效期', '有效期', '到期日'], ph: '输入源表列名，如 失效日期', hint: '支持文本日期与 Excel 日期序列号；远期日期（如 2123-11-09）按「长期有效」处理。' },
      { key: 'balance', label: '储值余额', group: '持卡与余额', opts: ['储值余额', '余额', '账户余额'], ph: '输入源表列名，如 账户余额' },
      { key: 'rechargeSum', label: '充值合计', group: '持卡与余额', opts: ['充值合计', '累计充值'], ph: '输入源表列名，如 累计充值' },
      { key: 'payMethod', label: '支付方式', group: '持卡与余额', opts: ['支付方式', '付款方式'], ph: '输入源表列名，如 结算方式' },
      { key: 'consumeSum', label: '消费合计', group: '旁路字段', tag: '仅展示', opts: ['消费合计', '累计消费'], ph: '输入源表列名，如 累计消费' },
      { key: 'consumeCount', label: '消费笔数', group: '旁路字段', tag: '仅展示', opts: ['消费笔数', '消费次数'], ph: '输入源表列名，如 到店次数' },
      { key: 'daysAgo', label: '距今天数', group: '旁路字段', tag: '仅展示', opts: ['距今天数'], ph: '输入源表列名，如 最近到店' }
    ],
    card: [
      { key: 'cardName', label: '卡名称', group: '基础信息', opts: ['卡名称', '卡种'], ph: '输入源表列名，如 卡片名称' },
      { key: 'recharge', label: '充值金额', group: '基础信息', opts: ['充值金额', '充值'], ph: '输入源表列名，如 办卡金额' },
      { key: 'bonus', label: '赠送金额', group: '基础信息', opts: ['赠送金额', '赠送'], ph: '输入源表列名，如 赠送' },
      { key: 'discountScope', label: '折扣范围', group: '折扣权益', tag: '二选一', opts: ['折扣范围', '折扣类型'], ph: '输入源表列名，如 全场／指定分类' },
      { key: 'discountValue', label: '折扣值', group: '折扣权益', opts: ['折扣值', '折扣', '折扣比例'], ph: '输入源表列名，如 8折／88%', hint: '「8折」「88%」「0.8」都按 8 折入库。' },
      { key: 'benefits', label: '项目/产品权益', group: '权益与会员价', tag: '多值', opts: ['权益项目', '项目权益', '包含项目'], ph: '输入源表列名，如 包含项目', hint: '多项用逗号分隔，写成「项目×次数」：染发×2，护理×1。开卡后按项目扣次。' },
      { key: 'memberPrice', label: '会员价', group: '权益与会员价', tag: '多值', opts: ['会员价', '卡耗价', '会员单价'], ph: '输入源表列名，如 会员价格', hint: '多项用逗号分隔，写成「项目 价格」：染发 98，护理 168。须与价目表项目同名。' },
      { key: 'validity', label: '有效期', group: '有效期', opts: ['有效期', '有效期限'], ph: '输入源表列名，如 有效月数', hint: '可填「12 个月」「365 天」或具体日期；留空按长期有效。' }
    ],
    price: [
      { key: 'item', label: '项目·产品', opts: ['项目', '项目名称'], ph: '输入源表列名，如 服务项目' },
      { key: 'category', label: '分类', opts: ['分类', '类别'], ph: '输入源表列名，如 项目分类' },
      { key: 'price', label: '价格', opts: ['价格', '单价'], ph: '输入源表列名，如 售价' },
      { key: 'memberPrice', label: '会员价', opts: ['会员价'], ph: '输入源表列名，如 会员价格' },
      { key: 'unit', label: '单位', opts: ['单位'], ph: '输入源表列名，如 计次单位' }
    ]
  };

  // 历史消费：只识别日期 / 金额 / 顾客姓名，其余列原样保留
  var HISTORY_COLUMNS = ['消费日期', '实收金额', '顾客姓名', '项目', '支付方式', '门店', '备注'];
  var HISTORY_ROWS = [
    { id: 'h01', date: '2025-12-28', amount: 1280, name: '李女士', raw: { 项目: '染发 + 护理', 支付方式: '微信', 门店: '悦己美发沙龙', 备注: '办卡前消费' } },
    { id: 'h02', date: '2025-12-19', amount: 168, name: '王先生', raw: { 项目: '洗剪吹', 支付方式: '现金', 门店: '悦己美发沙龙', 备注: '' } },
    { id: 'h03', date: '2025-11-30', amount: 680, name: '张女士', raw: { 项目: '烫发', 支付方式: '支付宝', 门店: '悦己美发沙龙', 备注: '老客' } },
    { id: 'h04', date: '2025-11-09', amount: 268, name: '陈先生', raw: { 项目: '头皮护理', 支付方式: '微信', 门店: '悦己美发沙龙', 备注: '' } },
    { id: 'h05', date: '2025-10-21', amount: 398, name: '刘女士', raw: { 项目: '染发', 支付方式: '储值卡', 门店: '悦己美发沙龙', 备注: '旧卡余额' } },
    { id: 'h06', date: '2025-09-15', amount: 88, name: '赵先生', raw: { 项目: '洗剪吹', 支付方式: '微信', 门店: '悦己美发沙龙', 备注: '' } },
    { id: 'h07', date: '2025-08-02', amount: 1580, name: '孙女士', raw: { 项目: '烫染套餐', 支付方式: '银行卡', 门店: '悦己美发沙龙', 备注: '含护理' } },
    { id: 'h08', date: '2025-06-18', amount: 128, name: '', raw: { 项目: '洗剪吹', 支付方式: '现金', 门店: '悦己美发沙龙', 备注: '未留姓名' } },
    { id: 'h09', date: '2025-04-06', amount: 520, name: '周女士', raw: { 项目: '护理年卡首付', 支付方式: '微信', 门店: '悦己美发沙龙', 备注: '' } },
    { id: 'h10', date: '2025-01-12', amount: 240, name: '吴先生', raw: { 项目: '造型', 支付方式: '支付宝', 门店: '悦己美发沙龙', 备注: '' } },
    { id: 'h11', date: '2024-12-24', amount: 960, name: '郑女士', raw: { 项目: '染发 + 造型', 支付方式: '微信', 门店: '悦己美发沙龙', 备注: '节日套餐' } },
    { id: 'h12', date: '2024-10-03', amount: 180, name: '冯先生', raw: { 项目: '洗剪吹', 支付方式: '现金', 门店: '悦己美发沙龙', 备注: '' } },
    { id: 'h13', date: '2024-07-19', amount: 760, name: '李女士', raw: { 项目: '烫发 + 护理', 支付方式: '银行卡', 门店: '悦己美发沙龙', 备注: '' } },
    { id: 'h14', date: '2024-03-08', amount: 1280, name: '许女士', raw: { 项目: '护理年卡', 支付方式: '微信', 门店: '悦己美发沙龙', 备注: '妇女节活动' } },
    { id: 'h15', date: '2023-11-11', amount: 620, name: '何先生', raw: { 项目: '染发', 支付方式: '支付宝', 门店: '悦己美发沙龙', 备注: '' } },
    { id: 'h16', date: '2023-05-26', amount: 300, name: '王先生', raw: { 项目: '头皮护理', 支付方式: '现金', 门店: '悦己美发沙龙', 备注: '' } }
  ];
  var HISTORY_FAIL_ROWS = [
    { line: 12, reason: '金额无法识别', raw: '消费日期 2025-12-31 · 原值「—」' },
    { line: 48, reason: '日期格式无法识别', raw: '顾客姓名 李女士 · 原值「12月31」' },
    { line: 96, reason: '金额为 0 或负数', raw: '顾客姓名 周先生 · 原值「0」' },
    { line: 137, reason: '日期与金额都为空', raw: '顾客姓名 陈女士 · 原始行全空' }
  ];

  function $(sel, root) {
    return (root || document).querySelector(sel);
  }
  function $all(sel, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(sel));
  }

  function showToast(msg) {
    var el = $('#protoToast');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(showToast._t);
    showToast._t = setTimeout(function () {
      el.classList.remove('show');
    }, 1800);
  }

  function syncNav(flow) {
    $all('.site-nav [data-flow]').forEach(function (btn) {
      btn.classList.toggle('on', btn.getAttribute('data-flow') === flow);
    });
  }

  /* ===== 统一导入进度层 =====
     识别 / 正式导入 / 历史消费导入共用：居中白卡 + 线性进度条 + 百分比 + 当前步骤
     opts = { title, sub, stages: [{at, label}], duration, doneLabel, holdMs, onDone } */
  var progressTimer = null;

  function runImportProgress(opts) {
    var box = $('#importProgress');
    if (!box) {
      if (opts && typeof opts.onDone === 'function') opts.onDone();
      return;
    }
    var o = opts || {};
    var stages = (o.stages && o.stages.length) ? o.stages : [{ at: 0, label: '处理中' }];
    var duration = Math.max(600, o.duration || 1800);
    var title = $('#importProgressTitle');
    var sub = $('#importProgressSub');
    var stepEl = $('#importProgressStep');
    var pctEl = $('#importProgressPct');
    var bar = $('#importProgressBar');
    var track = $('#importProgressTrack');
    var startAt = Date.now();

    clearTimeout(progressTimer);
    box.classList.remove('hidden', 'is-done');
    box.setAttribute('aria-hidden', 'false');
    if (title) title.textContent = o.title || '正在导入…';
    if (sub) sub.textContent = o.sub || '请稍候，不要关闭页面';
    if (stepEl) stepEl.textContent = stages[0].label;
    if (pctEl) pctEl.textContent = '0%';
    if (bar) bar.style.width = '0%';
    if (track) track.setAttribute('aria-valuenow', '0');

    function tick() {
      var t = Math.min(1, (Date.now() - startAt) / duration);
      // 前 70% 时间走完 86%，尾段放慢，避免「卡在 99%」的观感
      var eased = t < 0.7 ? (t / 0.7) * 0.86 : 0.86 + ((t - 0.7) / 0.3) * 0.14;
      var pct = Math.min(100, Math.round(eased * 100));

      if (t >= 1) {
        if (bar) bar.style.width = '100%';
        if (pctEl) pctEl.textContent = '100%';
        if (track) track.setAttribute('aria-valuenow', '100');
        if (stepEl) stepEl.textContent = o.doneLabel || '完成';
        box.classList.add('is-done');
        progressTimer = setTimeout(function () {
          box.classList.add('hidden');
          box.setAttribute('aria-hidden', 'true');
          if (typeof o.onDone === 'function') o.onDone();
        }, o.holdMs || 320);
        return;
      }

      var label = stages[0].label;
      for (var i = 0; i < stages.length; i++) {
        if (pct >= (stages[i].at || 0)) label = stages[i].label;
      }
      if (bar) bar.style.width = pct + '%';
      if (pctEl) pctEl.textContent = pct + '%';
      if (stepEl && stepEl.textContent !== label) stepEl.textContent = label;
      if (track) track.setAttribute('aria-valuenow', String(pct));
      progressTimer = setTimeout(tick, 60);
    }

    progressTimer = setTimeout(tick, 60);
  }

  function hideInviteSheet() {
    var mask = $('#inviteMask');
    var sheet = $('#inviteSheet');
    if (mask) mask.classList.remove('show');
    if (sheet) sheet.classList.remove('show');
  }

  function showInviteSheet() {
    var mask = $('#inviteMask');
    var sheet = $('#inviteSheet');
    if (mask) mask.classList.add('show');
    if (sheet) sheet.classList.add('show');
  }

  function scheduleInvite() {
    state.pendingInvite = true;
  }

  function tryShowPendingInvite(flow) {
    if (!state.pendingInvite || !INVITE_LANDING[flow]) return;
    state.pendingInvite = false;
    // 店内已有迁移数据时不再弹首次邀请
    if (hasP0Stock()) return;
    setTimeout(showInviteSheet, 320);
  }

  function hasP0Stock() {
    return state.storeStock.member > 0 || state.storeStock.card > 0 || state.storeStock.price > 0;
  }

  function hasHistoryStock() {
    return state.storeStock.history > 0 && !state.historyDeleted;
  }

  function enterMigrate() {
    maybeShowWechatTip();
    if (hasP0Stock()) go('import-overview');
    else go('import-guide');
  }

  function enterHistoryImport() {
    if (hasHistoryStock()) openHistoryReimportSheet();
    else go('history-import-intro');
  }

  function showFab() {
    state.fabVisible = true;
    var fab = $('#migrateFab');
    if (fab) fab.classList.add('show');
  }

  function hideFab() {
    state.fabVisible = false;
    var fab = $('#migrateFab');
    if (fab) fab.classList.remove('show');
  }

  function syncImportMapLockUI() {
    var screen = $('#screen-import-map');
    var badge = $('#importMapLockBadge');
    var on = !!state.importMapAck[state.importMapTab];
    if (screen) screen.classList.toggle('is-locked', on);
    if (badge) badge.classList.toggle('hidden', !on);
    syncMapAckButton();
  }

  function mapExcelCats() {
    return collectPlan().excel.filter(function (k) { return hasFiles(k); });
  }

  function allMapAcked() {
    var cats = mapExcelCats();
    if (!cats.length) return false;
    return cats.every(function (k) { return !!state.importMapAck[k]; });
  }

  function syncMapAckButton() {
    var btn = $('#btnImportMapPreview');
    if (!btn) return;
    var cats = mapExcelCats();
    var left = cats.filter(function (k) { return !state.importMapAck[k]; });
    if (!cats.length) {
      btn.disabled = true;
      btn.classList.remove('is-warn');
      btn.textContent = '下一步';
      return;
    }
    if (left.length) {
      btn.disabled = false;
      btn.classList.add('is-warn');
      btn.textContent = '还有 ' + left.length + ' 项待确认';
      return;
    }
    btn.classList.remove('is-warn');
    if (hasInvalidCustomMap()) {
      btn.disabled = true;
      btn.textContent = '先修正自定义字段';
    } else {
      btn.disabled = false;
      btn.textContent = '下一步';
    }
  }

  function setImportMapAck(on) {
    var cat = state.importMapTab;
    state.importMapAck[cat] = !!on;
    state.importMapConfirmed = !!on;
    var ack = $('#btnImportMapAck');
    var input = $('#importMapAckInput');
    if (ack) ack.classList.toggle('on', !!on);
    if (input) input.checked = !!on;
    syncImportMapLockUI();
    renderMapTabs(mapExcelCats(), state.importMapTab);
    // 勾完不再自动切页（会把用户正在看的字段表顶走），
    // 只把「下一个待确认」的 tab 高亮，用户自己决定何时切。
    if (on) {
      var left = mapExcelCats().filter(function (k) { return !state.importMapAck[k]; });
      if (!left.length) {
        showToast('全部映射已确认，可以进入下一步');
        return;
      }
      var tab = document.querySelector('.map-tab[data-map-tab="' + left[0] + '"]');
      if (tab) {
        tab.classList.remove('is-pulse');
        void tab.offsetWidth;
        tab.classList.add('is-pulse');
      }
      showToast('已确认「' + IMPORT_CAT[cat] + '」· 还有 ' + left.length + ' 项待确认');
    }
  }

  function resetImportMapAck() {
    state.importMapAck = {};
    state.importMapConfirmed = false;
    var ack = $('#btnImportMapAck');
    if (ack) ack.classList.remove('on');
    syncImportMapLockUI();
  }

  function unlockImportMap() {
    delete state.importMapAck[state.importMapTab];
    state.importMapConfirmed = false;
    var ack = $('#btnImportMapAck');
    var input = $('#importMapAckInput');
    if (ack) ack.classList.remove('on');
    if (input) input.checked = false;
    var screen = $('#screen-import-map');
    if (screen) screen.classList.remove('is-locked');
    syncMapAckButton();
  }

  function syncImportMapReturnHint() {
    var hint = $('#importMapReturnHint');
    if (hint) hint.classList.toggle('hidden', !state.importMapReturned);
  }

  // ===== 自定义字段映射 =====
  function normalizeColName(s) {
    return String(s || '').replace(/\s+/g, '').trim();
  }

  function allowedColumnsFor(cat) {
    var fields = IMPORT_FIELDS[cat] || IMPORT_FIELDS.member;
    var list = [];
    fields.forEach(function (f) {
      (f.opts || []).forEach(function (o) {
        if (o === '（跳过）' || o === '__derive__') return;
        if (list.indexOf(o) === -1) list.push(o);
      });
    });
    return list;
  }

  function isKnownSourceColumn(name, cat) {
    var n = normalizeColName(name);
    if (!n) return false;
    var list = (!cat || cat === 'member') ? IMPORT_MAP_ALLOWED_COLUMNS : allowedColumnsFor(cat);
    return list.some(function (col) {
      return normalizeColName(col) === n;
    });
  }

  function setMapRowCustomState(row, input) {
    if (!row) return;
    var msg = row.querySelector('.import-map-custom__msg');
    var raw = input ? input.value : '';
    var name = normalizeColName(raw);
    var cat = row.getAttribute('data-cat') || state.importMapTab;
    row.classList.remove('is-invalid', 'is-ok');
    if (!name) {
      if (msg) msg.textContent = '';
      return;
    }
    if (isKnownSourceColumn(name, cat)) {
      row.classList.add('is-ok');
      if (msg) msg.textContent = '已对到源表列「' + name + '」';
    } else {
      row.classList.add('is-invalid');
      if (msg) msg.textContent = '未识别到「' + name + '」，建议从源表列名中选择；本字段将按跳过处理';
    }
    updateMapAckGate();
  }

  function hasInvalidCustomMap() {
    return !!document.querySelector('#screen-import-map .import-map-row.is-invalid');
  }

  function updateMapAckGate() {
    var tip = $('.import-map-tip');
    var invalid = hasInvalidCustomMap();
    if (tip) {
      tip.textContent = invalid
        ? '自定义字段未识别：该字段会按跳过处理，可改对后再勾选确认。'
        : '自定义字段须与源表列名完全一致；未识别的字段会红字提示，并按跳过处理。';
      tip.classList.toggle('is-warn', invalid);
    }
    syncMapAckButton();
  }

  function syncMapCustomRow(select) {
    var row = select.closest('.import-map-row');
    if (!row) return;
    var box = row.querySelector('.import-map-custom');
    var input = row.querySelector('.import-map-custom__input');
    var isCustom = select.value === '__custom__';
    if (box) box.hidden = !isCustom;
    if (!isCustom) {
      row.classList.remove('is-invalid', 'is-ok');
      var msg = row.querySelector('.import-map-custom__msg');
      if (msg) msg.textContent = '';
      if (input) input.value = '';
      updateMapAckGate();
      return;
    }
    if (input) {
      setMapRowCustomState(row, input);
      input.focus();
    }
  }

  function bindMapCustomInputs() {
    $all('#screen-import-map .import-map-row').forEach(function (row) {
      var select = row.querySelector('.import-map-select');
      var input = row.querySelector('.import-map-custom__input');
      if (select) {
        select.addEventListener('change', function () {
          saveMapRowValue(row, select.value);
          syncMapCustomRow(select);
          if (row.getAttribute('data-field') === 'gender') syncGenderHint();
        });
      }
      if (input) {
        input.addEventListener('input', function () {
          setMapRowCustomState(row, input);
          if (row.getAttribute('data-field') === 'gender') syncGenderHint();
        });
        input.addEventListener('blur', function () {
          setMapRowCustomState(row, input);
        });
      }
    });
    updateMapAckGate();
    syncGenderHint();
  }

  function saveMapRowValue(row, value) {
    var cat = row.getAttribute('data-cat') || state.importMapTab;
    var field = row.getAttribute('data-field');
    if (!cat || !field) return;
    if (!state.importMapValues[cat]) state.importMapValues[cat] = {};
    state.importMapValues[cat][field] = value;
  }

  function syncGenderHint() {
    var hint = $('#importMapGenderHint');
    var row = document.querySelector('.import-map-row[data-field="gender"]');
    if (!hint || !row) return;
    var select = row.querySelector('.import-map-select');
    var input = row.querySelector('.import-map-custom__input');
    var v = select ? select.value : '__derive__';
    var text;
    if (v === '__derive__') {
      text = '先生 / 男士 → 男；女士 / 小姐 / 太太 / 夫人 → 女；无称呼不猜，记「未知」。';
    } else if (v === '性别') {
      text = '源表已有性别列，以列值为准；列为空时回退按称呼推断。';
    } else if (v === '__custom__') {
      var name = normalizeColName(input ? input.value : '');
      text = name && isKnownSourceColumn(name)
        ? '已对到源表列「' + name + '」，以该列值为准；为空时回退按称呼推断。'
        : '输入他系统里的性别列名（如 性别、性别(F/M)）；未识别会红字提示并按「自动识别」处理。';
    } else {
      text = '已选择跳过：性别将全部记为「未知」，可在会员详情补填。';
    }
    hint.textContent = text;
  }

  function setImportReturnedFromPreview(on) {
    state.importMapReturned = !!on;
    syncImportMapReturnHint();
  }

  function showDelBatchDialog() {
    var mEl = $('#delBatchMemberCount');
    var cEl = $('#delBatchCardCount');
    var pEl = $('#delBatchPriceCount');
    if (mEl) mEl.textContent = state.storeStock.member || BATCH_DEMO.member;
    if (cEl) cEl.textContent = state.storeStock.card || BATCH_DEMO.card;
    if (pEl) pEl.textContent = state.storeStock.price || BATCH_DEMO.price;
    var mask = $('#delBatchMask');
    var dlg = $('#delBatchDialog');
    if (mask) {
      mask.classList.add('show');
      mask.setAttribute('aria-hidden', 'false');
    }
    if (dlg) {
      dlg.classList.add('show');
      dlg.setAttribute('aria-hidden', 'false');
    }
  }

  function hideDelBatchDialog() {
    var mask = $('#delBatchMask');
    var dlg = $('#delBatchDialog');
    if (mask) {
      mask.classList.remove('show');
      mask.setAttribute('aria-hidden', 'true');
    }
    if (dlg) {
      dlg.classList.remove('show');
      dlg.setAttribute('aria-hidden', 'true');
    }
  }

  function setImportLoading(on) {
    state.importing = !!on;
    var btn = $('#btnImportPreviewConfirm');
    if (!btn) return;
    btn.disabled = !!on;
    btn.classList.toggle('is-loading', !!on);
    btn.textContent = on ? '正在导入…' : '确认无误，导入';
  }

  function showLocExplain() {
    var mask = $('#locExplainMask');
    var dlg = $('#locExplainDialog');
    if (mask) {
      mask.classList.add('show');
      mask.setAttribute('aria-hidden', 'false');
    }
    if (dlg) {
      dlg.classList.add('show');
      dlg.setAttribute('aria-hidden', 'false');
    }
  }

  function hideLocExplain() {
    var mask = $('#locExplainMask');
    var dlg = $('#locExplainDialog');
    if (mask) {
      mask.classList.remove('show');
      mask.setAttribute('aria-hidden', 'true');
    }
    if (dlg) {
      dlg.classList.remove('show');
      dlg.setAttribute('aria-hidden', 'true');
    }
  }

  function showLocSys() {
    var mask = $('#locSysMask');
    var dlg = $('#locSysDialog');
    if (mask) {
      mask.classList.add('show');
      mask.setAttribute('aria-hidden', 'false');
    }
    if (dlg) {
      dlg.classList.add('show');
      dlg.setAttribute('aria-hidden', 'false');
    }
  }

  function hideLocSys() {
    var mask = $('#locSysMask');
    var dlg = $('#locSysDialog');
    if (mask) {
      mask.classList.remove('show');
      mask.setAttribute('aria-hidden', 'true');
    }
    if (dlg) {
      dlg.classList.remove('show');
      dlg.setAttribute('aria-hidden', 'true');
    }
  }

  function syncClaimEmptyUI() {
    var screen = $('#screen-claim');
    if (screen) screen.classList.toggle('is-empty', !!state.claimEmpty);
  }

  // 进「认领门店」空态页后再弹权限说明（对照线上实拍：拒绝后落空态，可手工创建）
  function enterClaimWithLocationGate() {
    hideLocSys();
    hideLocExplain();
    state.claimEmpty = true;
    go('claim');
    syncClaimEmptyUI();
    showLocExplain();
  }

  function setFailGender(g, force) {
    var next = g || '';
    // 非强制模式下，再点一次已选中的选项即取消选择（性别可留空）
    if (!force && next && state.legacy.gender === next) next = '';
    state.legacy.gender = next;
    $all('[data-fail-gender]').forEach(function (btn) {
      var on = btn.getAttribute('data-fail-gender') === next;
      btn.classList.toggle('is-on', on);
      btn.setAttribute('aria-checked', on ? 'true' : 'false');
    });
  }

  function copyCard(c) {
    return {
      key: c.key,
      cardId: c.cardId,
      cardName: c.cardName,
      price: c.price,
      balance: c.balance || '',
      expiry: c.expiry || '',
      rechargeLeft: c.rechargeLeft || '',
      bonusLeft: c.bonusLeft || '',
      bonusItems: c.bonusItems || ''
    };
  }

  function nextCardKey() {
    state.legacySeq += 1;
    return 'lc' + state.legacySeq;
  }

  function cardMetaText(c) {
    var parts = [];
    if (c.balance !== '') parts.push('余额 ¥' + c.balance);
    if (c.expiry) parts.push('至 ' + c.expiry);
    return parts.join(' · ') || '未填写余额';
  }

  // 半屏里的会员卡列表（支持一会员多卡）
  function renderFailFixCards() {
    var l = state.legacy;
    var list = $('#failFixCardList');
    if (!list) return;
    var n = l.cards.length;
    list.innerHTML = l.cards.map(function (c) {
      return '<div class="fail-fix-card-item" data-card-key="' + c.key + '">' +
        '<span class="fail-fix-card-item__main">' +
        '<span class="fail-fix-card-item__name">' + c.cardName + '</span>' +
        '<span class="fail-fix-card-item__meta">' + cardMetaText(c) + '</span>' +
        '</span>' +
        '<button type="button" class="fail-fix-card-item__btn" data-card-edit="' + c.key + '">修改</button>' +
        '<button type="button" class="fail-fix-card-item__btn fail-fix-card-item__btn--del" data-card-del="' + c.key + '">删除</button>' +
        '</div>';
    }).join('');

    var title = $('#failFixCardsTitle');
    if (title) title.textContent = n > 0 ? '会员卡 · ' + n + ' 张' : '会员卡';

    var empty = $('#failFixCardEmpty');
    if (empty) {
      empty.classList.toggle('hidden', n > 0);
      empty.textContent = '尚未补录会员卡，可留空';
    }
  }

  // 补录半屏的字段校验：仅姓名必填；手机号填了必须是 1 开头 11 位；性别与会员卡可留空
  function validateFailFixFields() {
    var name = (($('#failFixName') || {}).value || '').trim();
    var phone = (($('#failFixPhone') || {}).value || '').trim();
    if (!name) return { ok: false, msg: '请填写姓名' };
    if (phone && !/^1\d{10}$/.test(phone)) return { ok: false, msg: '手机号需为 1 开头的 11 位数字' };
    return { ok: true, name: name, phone: phone };
  }

  // 记住这一条失败记录的最新编辑内容，便于再次打开时回填
  function saveFailEdit(id) {
    if (!id) return;
    var l = state.legacy;
    var phone = (($('#failFixPhone') || {}).value || '').trim();
    var name = (($('#failFixName') || {}).value || '').trim();
    state.failEdit[id] = {
      name: name,
      gender: l.gender || '',
      phone: phone,
      cards: l.cards.map(copyCard)
    };
  }

  function failFixedLabel(id) {
    var e = state.failEdit[id] || {};
    var n = (e.cards || []).length;
    return '已手动补录' + (n > 0 ? ' · ' + n + ' 张卡' : '');
  }

  function openFailFix(id) {
    if (state.failRemoved[id]) return;
    var seed = FAIL_FIX_SEED[id];
    if (!seed) return;
    var saved = state.failEdit[id] || {};
    state.failFixId = id;

    var name = $('#failFixName');
    var phone = $('#failFixPhone');
    if (name) name.value = saved.name !== undefined ? saved.name : seed.name;
    if (phone) phone.value = saved.phone !== undefined ? saved.phone : (seed.phone === '1380013abc' ? '' : seed.phone);
    setFailGender(saved.gender !== undefined ? saved.gender : (seed.gender || ''), true);

    var l = state.legacy;
    l.failId = id;
    l.cardFailId = id;
    l.cards = (saved.cards || []).map(copyCard);
    l.editingKey = null;
    l.pickId = null;
    renderFailFixCards();

    var hint = $('#failFixHint');
    if (hint) {
      hint.textContent = id === 'f1'
        ? '手机号格式错误，可改正后入库；也可清空留待后续补全'
        : '卡余额无法解析，可补录会员卡，也可留空';
    }
    var mask = $('#failFixMask');
    var sheet = $('#failFixSheet');
    if (mask) mask.classList.add('show');
    if (sheet) sheet.classList.add('show');
  }

  function hideFailFix() {
    state.failFixId = null;
    var mask = $('#failFixMask');
    var sheet = $('#failFixSheet');
    if (mask) mask.classList.remove('show');
    if (sheet) sheet.classList.remove('show');
  }

  // 关闭半屏但保留当前编辑中的失败记录（滑去添加卡 / 修改卡时用）
  function hideFailFixKeepState() {
    var mask = $('#failFixMask');
    var sheet = $('#failFixSheet');
    if (mask) mask.classList.remove('show');
    if (sheet) sheet.classList.remove('show');
  }

  function markFailFixed(id) {
    state.failFixed[id] = true;
    var item = document.querySelector('.import-fail-item[data-fail-id="' + id + '"]');
    if (!item) return;
    item.classList.add('is-fixed');
    var reason = item.querySelector('.import-fail-item__reason');
    if (reason) reason.textContent = failFixedLabel(id);
    // 「手动补录」与「补录完成」并列保留，便于再次调整补录内容
    var fix = item.querySelector('[data-fail-fix]');
    if (fix) {
      fix.classList.remove('hidden');
      fix.textContent = '手动补录';
    }
    var done = item.querySelector('[data-fail-done]');
    if (done) done.classList.remove('hidden');
  }

  // 已补录的条目在修改/删除卡后刷新卡数文案
  function syncFailItemReason(id) {
    if (!state.failFixed[id]) return;
    var item = document.querySelector('.import-fail-item[data-fail-id="' + id + '"]');
    if (!item) return;
    var reason = item.querySelector('.import-fail-item__reason');
    if (reason) reason.textContent = failFixedLabel(id);
  }

  function removeFailItem(id) {
    var item = document.querySelector('.import-fail-item[data-fail-id="' + id + '"]');
    if (!item) return;
    state.failRemoved[id] = true;
    item.classList.add('is-leaving');
    setTimeout(function () {
      item.remove();
      syncImportFailUI();
    }, 260);
  }

  function syncImportFailUI() {
    var remain = 0;
    ['f1', 'f2'].forEach(function (id) {
      if (!state.failRemoved[id]) remain += 1;
    });
    var count = $('#failScreenCount');
    if (count) count.textContent = remain;
    var resCount = $('#importFailCount');
    if (resCount) resCount.textContent = remain;
    var resHint = $('#importFailHint');
    if (resHint) resHint.textContent = remain > 0 ? '查看明细' : '已全部补录';
    var resTail = $('#importFailTail');
    if (resTail) resTail.textContent = remain > 0 ? '，可手动补录' : '，已全部补录';
    var resRow = $('#btnImportFailRow');
    if (resRow) resRow.classList.toggle('is-done', remain === 0);
    var empty = $('#importFailEmpty');
    if (empty) empty.classList.toggle('hidden', remain !== 0);
  }

  // ===== 补录老卡：添加卡 → 补录老卡 =====

  function legacyCardGroups() {
    return LEGACY_CARD_GROUPS;
  }

  function legacyFindCard(id) {
    var groups = legacyCardGroups();
    var i;
    var j;
    for (i = 0; i < groups.length; i += 1) {
      for (j = 0; j < groups[i].cards.length; j += 1) {
        if (groups[i].cards[j].id === id) {
          return { group: groups[i], card: groups[i].cards[j] };
        }
      }
    }
    return null;
  }

  function renderLegacyMember(el) {
    if (!el) return;
    var g = state.legacy;
    var letter = (g.name || '').charAt(0) || '会';
    el.innerHTML =
      '<span class="legacy-member__avatar" aria-hidden="true">' + letter + '</span>' +
      '<span class="legacy-member__main">' +
      '<span class="legacy-member__name">' + (g.name || '未填写姓名') +
      (g.gender ? '<span class="legacy-member__gender">' + g.gender + '</span>' : '') +
      '</span>' +
      '<span class="legacy-member__sub">' + (g.phone || '未填写手机号') + '</span>' +
      '</span>';
  }

  function renderLegacyGroups() {
    var wrap = $('#legacyGroupTabs');
    if (!wrap) return;
    var groups = legacyCardGroups();
    if (!state.legacy.group) state.legacy.group = groups[0].key;
    wrap.innerHTML = groups.map(function (g) {
      return '<button type="button" class="legacy-group-tab' +
        (g.key === state.legacy.group ? ' is-on' : '') +
        '" data-legacy-group="' + g.key + '" role="tab" aria-selected="' +
        (g.key === state.legacy.group ? 'true' : 'false') + '">' + g.label + '</button>';
    }).join('');
  }

  function renderLegacyCards() {
    var wrap = $('#legacyCardList');
    if (!wrap) return;
    var groups = legacyCardGroups();
    var cur = null;
    var i;
    for (i = 0; i < groups.length; i += 1) {
      if (groups[i].key === state.legacy.group) cur = groups[i];
    }
    if (!cur) cur = groups[0];
    wrap.innerHTML = cur.cards.map(function (c) {
      var on = state.legacy.pickId === c.id;
      return '<button type="button" class="legacy-card-item' + (on ? ' is-on' : '') +
        '" data-legacy-card="' + c.id + '" role="radio" aria-checked="' + (on ? 'true' : 'false') + '">' +
        '<span class="legacy-card-item__radio" aria-hidden="true"></span>' +
        '<span class="legacy-card-item__main">' +
        '<span class="legacy-card-item__name">' + c.name + '</span>' +
        '<span class="legacy-card-item__meta">' + c.meta + '</span>' +
        '</span>' +
        '<span class="legacy-card-item__price">¥' + c.price + '</span>' +
        '</button>';
    }).join('');
  }

  function renderLegacyCardScreen() {
    renderLegacyMember($('#legacyMemberRow'));
    renderLegacyGroups();
    renderLegacyCards();
    $all('[data-legacy-mode]').forEach(function (btn) {
      btn.classList.toggle('is-on', btn.getAttribute('data-legacy-mode') === state.legacy.mode);
    });
  }

  // 新增 / 编辑两种模式共用：编辑时回填该卡已填内容
  function renderLegacyDetailScreen() {
    renderLegacyMember($('#legacyDetailMember'));
    var l = state.legacy;
    var editing = null;
    var cardId = l.pickId;
    if (l.editingKey) {
      l.cards.forEach(function (c) {
        if (c.key === l.editingKey) editing = c;
      });
      cardId = editing ? editing.cardId : null;
    }
    var found = cardId ? legacyFindCard(cardId) : null;
    var picked = $('#legacyDetailCard');
    if (picked) {
      picked.innerHTML = found
        ? '<span class="legacy-picked__main">' +
          '<span class="legacy-picked__name">' + found.card.name + '</span>' +
          '<span class="legacy-picked__meta">' + found.card.meta + '</span>' +
          '</span>' +
          '<span class="legacy-picked__price">¥' + found.card.price + '</span>'
        : '<span class="legacy-picked__main"><span class="legacy-picked__name">未选择卡种</span></span>';
    }

    var title = $('#legacyDetailTitle');
    if (title) title.textContent = editing ? '修改会员卡' : '补录老卡';
    var confirmBtn = $('#btnLegacyConfirm');
    if (confirmBtn) confirmBtn.textContent = editing ? '保存修改' : '确认补录';

    var bal = $('#legacyBalance');
    var exp = $('#legacyExpiry');
    var rec = $('#legacyRechargeLeft');
    var bon = $('#legacyBonusLeft');
    var items = $('#legacyBonusItems');
    if (bal) bal.value = editing ? editing.balance : '';
    if (exp) exp.value = editing ? editing.expiry : '';
    if (rec) rec.value = editing ? editing.rechargeLeft : '';
    if (bon) bon.value = editing ? editing.bonusLeft : '';
    if (items) items.value = editing ? editing.bonusItems : '';
  }

  function screenEl(flow) {
    return document.querySelector('.phone-inner > .screen[data-flow="' + flow + '"]');
  }

  function slideTo(flow) {
    go(flow);
    var sc = screenEl(flow);
    if (!sc) return;
    sc.classList.remove('is-slide-out');
    sc.classList.add('is-slide-in');
    setTimeout(function () {
      sc.classList.remove('is-slide-in');
    }, 300);
  }

  function slideBackTo(flow, fromFlow) {
    var sc = screenEl(fromFlow);
    if (!sc) {
      go(flow);
      return;
    }
    sc.classList.add('is-slide-out');
    setTimeout(function () {
      sc.classList.remove('is-slide-out');
      go(flow);
    }, 220);
  }

  function surnameLetter(name) {
    var ch = name.charAt(0);
    return SURNAME_PY[ch] || '#';
  }

  function ensureMembersData() {
    if (state.membersData) return state.membersData;
    var list = [];
    var i;
    for (i = 0; i < 126; i += 1) {
      var surname = SURNAME_LIST[i % SURNAME_LIST.length];
      var female = i % 3 !== 0;
      var givenPool = female ? GIVEN_FEMALE : GIVEN_MALE;
      var given = givenPool[i % givenPool.length];
      var suffix = female ? '女士' : '先生';
      var name = surname + given + suffix;
      var phone = '1' + String(3 + (i % 7)) + String(900000000 + i * 137).slice(0, 9);
      var derived = deriveGenderFromName(name);
      list.push({
        id: i,
        name: name,
        phone: phone,
        gender: derived.value,
        genderSource: derived.source,
        genderHit: derived.hit || '',
        letter: surnameLetter(name),
        vip: i % 5 === 0,
        visitCount: (i % 4) + 1,
        lastConsume: '2025-' + String((i % 9) + 1).padStart(2, '0') + '-' + String((i % 27) + 1).padStart(2, '0'),
        cardName: CARD_NAMES[i % CARD_NAMES.length],
        balance: '¥' + (120 + (i * 37) % 2800),
        project: PROJECTS[i % PROJECTS.length],
        avatar: MEMBER_AVATARS[i % MEMBER_AVATARS.length],
      });
    }
    list.sort(function (a, b) {
      if (a.letter === b.letter) return a.name.localeCompare(b.name, 'zh-CN');
      return a.letter.localeCompare(b.letter);
    });
    state.membersData = list;
    return list;
  }

  function renderMembersList(filter) {
    var listEl = $('#membersPickList');
    var indexEl = $('#membersIndexBar');
    if (!listEl) return;
    var q = (filter || '').trim().toLowerCase();
    var all = ensureMembersData();
    var rows = all;
    if (q) {
      rows = all.filter(function (m) {
        return m.name.indexOf(q) !== -1 || m.phone.indexOf(q) !== -1;
      });
    }
    var html = '';
    var letters = [];
    var lastLetter = '';
    if (q && rows.length === 0) {
      html = '<div class="pick-empty show"><span>未找到匹配的会员</span></div>';
    } else {
      rows.forEach(function (m) {
        if (!q && m.letter !== lastLetter) {
          lastLetter = m.letter;
          if (letters.indexOf(m.letter) === -1) letters.push(m.letter);
          html += '<div class="pick-group-h" data-letter="' + m.letter + '">' + m.letter + '</div>';
        }
        var vipHtml = m.vip
          ? '<span class="vip grad"><b>VIP</b></span><span class="cnt">(' + m.visitCount + ')</span>'
          : '';
        html +=
          '<div class="pick-row" data-member-id="' +
          m.id +
          '">' +
          '<div class="avatar"><img src="' +
          m.avatar +
          '" alt=""></div>' +
          '<div class="info"><div class="line1"><span class="nm">' +
          m.name +
          '</span>' +
          vipHtml +
          '</div><div class="line2"><span class="phone">' +
          m.phone +
          '</span></div></div></div>';
      });
    }
    listEl.innerHTML = html;
    listEl.classList.toggle('is-searching', !!q);
    if (indexEl) {
      if (q || letters.length === 0) {
        indexEl.classList.add('hidden');
        indexEl.innerHTML = '';
      } else {
        indexEl.classList.remove('hidden');
        indexEl.innerHTML =
          '<i class="index-bar__gap" aria-hidden="true"></i>' +
          letters.map(function (L) {
            return '<span>' + L + '</span>';
          }).join('');
      }
    }
  }

  function renderMembersOnce() {
    if (state.membersRendered) return;
    state.membersRendered = true;
    renderMembersList('');
  }

  function buildPreviewSamples(type) {
    var members = ensureMembersData().slice(0, 10);
    if (type === 'member') {
      return members.map(function (m) {
        return {
          name: m.name,
          sub: m.phone + ' · ' + m.cardName,
          fields: [
            ['会员编号', 'M' + String(100001 + m.id)],
            ['姓名', m.name],
            ['手机号', m.phone],
            ['卡种', m.cardName],
            ['储值余额', m.balance],
            ['卡有效期', '2027-06-30'],
          ],
        };
      });
    }
    if (type === 'card') {
      var tpls = state.importSelection.card
        ? [
          { name: '黄金卡', recharge: '¥2,000', bonus: '¥200', scope: '全场', discount: '8 折', benefits: '染发×2，护理×1', memberPrice: '染发 98，护理 168', validity: '12 个月' },
          { name: '8折卡', recharge: '¥1,000', bonus: '¥100', scope: '全场', discount: '8 折', benefits: '—', memberPrice: '—', validity: '12 个月' },
          { name: '7.5折卡', recharge: '¥800', bonus: '¥80', scope: '全场', discount: '7.5 折', benefits: '洗剪吹×10', memberPrice: '洗剪吹 48', validity: '6 个月' },
          { name: '6折卡', recharge: '¥500', bonus: '¥50', scope: '指定分类', discount: '6 折', benefits: '护理×6', memberPrice: '护理 128', validity: '长期有效' },
        ]
        : tplIncluded().map(function (t) {
          return {
            name: t.name,
            recharge: fmtMoney(t.single),
            bonus: '待完善',
            scope: '全场',
            discount: t.discount + ' 折',
            benefits: '待完善',
            memberPrice: '待完善',
            validity: t.validity || '永久'
          };
        });
      return tpls.map(function (t) {
        return {
          name: t.name,
          sub: t.discount + ' · ' + t.validity,
          fields: [
            ['卡名称', t.name],
            ['充值金额', t.recharge],
            ['赠送金额', t.bonus],
            ['折扣权益', t.scope + ' · ' + t.discount],
            ['项目/产品权益', t.benefits],
            ['会员价', t.memberPrice],
            ['有效期', t.validity],
          ],
        };
      });
    }
    var priceNames = ['剪发', '烫发', '染发', '护理', '头皮护理', '造型设计', '洗吹', '接发', '眉型设计', '护发套餐'];
    return priceNames.map(function (name, i) {
      var price = 68 + i * 20;
      return {
        name: name,
        sub: '项目 · ¥' + price,
        fields: [
          ['名称', name],
          ['类型', '项目'],
          ['价格', '¥' + price],
          ['单位', '次'],
        ],
      };
    });
  }

  function renderImportPreviewDetail(type) {
    var meta = PREVIEW_TYPE_META[type] || PREVIEW_TYPE_META.member;
    var titleEl = $('#importPreviewDetailTitle');
    var subEl = $('#importPreviewDetailSub');
    if (titleEl) titleEl.textContent = meta.title;
    if (subEl) subEl.textContent = meta.sub;
    var wrap = $('#importPreviewCards');
    if (!wrap) return;
    var samples = buildPreviewSamples(type);
    state.importPreviewSamples = samples;
    wrap.innerHTML = samples
      .map(function (row, idx) {
        return (
          '<button type="button" class="import-preview-card" data-preview-idx="' +
          idx +
          '">' +
          '<span class="import-preview-card__name">' +
          row.name +
          '</span>' +
          '<span class="import-preview-card__sub">' +
          row.sub +
          '</span></button>'
        );
      })
      .join('');
  }

  function openPreviewType(type) {
    if (!PREVIEW_TYPE_META[type]) return;
    state.importPreviewType = type;
    renderImportPreviewDetail(type);
    go('import-preview-detail');
  }

  function showPreviewDetail(idx) {
    var samples = state.importPreviewSamples || [];
    var row = samples[idx];
    if (!row) return;
    var body = $('#previewDetailBody');
    if (body) {
      body.innerHTML = row.fields
        .map(function (pair) {
          return '<dt>' + pair[0] + '</dt><dd>' + pair[1] + '</dd>';
        })
        .join('');
    }
    var mask = $('#previewDetailMask');
    var sheet = $('#previewDetailSheet');
    if (mask) mask.classList.add('show');
    if (sheet) sheet.classList.add('show');
  }

  function hidePreviewDetail() {
    var mask = $('#previewDetailMask');
    var sheet = $('#previewDetailSheet');
    if (mask) mask.classList.remove('show');
    if (sheet) sheet.classList.remove('show');
  }

  function go(flow) {
    if (!flow) return;
    // 任何主动跳转都收掉进度层，避免遮罩残留挡住后续操作
    if (progressTimer) {
      clearTimeout(progressTimer);
      progressTimer = null;
      var pbox = $('#importProgress');
      if (pbox) {
        pbox.classList.add('hidden');
        pbox.setAttribute('aria-hidden', 'true');
      }
    }
    var prevFlow = state.flow || '';
    state.flow = flow;
    // 旧内核没有 overflow: clip 时，焦点仍可能把手机框滚出画框，跳页时归零兜底
    var phoneInner = $('.phone-inner');
    if (phoneInner && phoneInner.scrollTop) {
      phoneInner.scrollTop = 0;
      phoneInner.scrollLeft = 0;
    }
    $all('.phone-inner > .screen').forEach(function (sc) {
      var on = sc.getAttribute('data-flow') === flow;
      sc.classList.toggle('active', on);
      sc.classList.toggle('hidden', !on);
    });
    syncNav(flow);
    if (typeof history.replaceState === 'function') {
      var url = new URL(location.href);
      url.searchParams.set('flow', flow);
      history.replaceState(null, '', url.pathname + url.search + url.hash);
    }
    tryShowPendingInvite(flow);
    if (flow === 'claim') {
      syncClaimEmptyUI();
    }
    if (flow !== 'import-camera') stopCamera();
    if (flow !== 'import-source') state.uploadHi = null;
    if (flow === 'import-overview') {
      renderImportOverview();
    }
    if (flow === 'import-select') {
      renderImportSelect();
    }
    if (flow === 'import-source') {
      renderUploadList();
    }
    if (flow === 'import-camera') {
      renderCamera();
      startCamera();
    }
    if (flow === 'import-queue') {
      state.queueBusy = false;
      var qbtn = $('#btnQueueStart');
      if (qbtn) { qbtn.disabled = false; qbtn.textContent = '开始转换'; }
      renderQueue();
    }
    if (flow === 'import-convert') {
      runConversion();
    }
    if (flow === 'import-check') {
      renderCheck();
    }
    if (flow === 'import-preview') {
      setImportLoading(false);
      renderPreviewTypes();
    }
    if (flow === 'import-map') {
      var fromDownstream = ['import-tpl-gen', 'import-preview', 'import-preview-detail'].indexOf(prevFlow) > -1;
      if (state.importMapSkipResetAck || fromDownstream) {
        state.importMapSkipResetAck = false;
      } else {
        resetImportMapAck();
      }
      syncImportMapReturnHint();
      renderImportMap();
    }
    if (flow === 'import-tpl-gen') {
      renderTplGen();
    }
    if (flow === 'import-preview-detail') {
      if (!state.importPreviewType) state.importPreviewType = 'member';
      renderImportPreviewDetail(state.importPreviewType);
    } else {
      hidePreviewDetail();
    }
    if (flow === 'members') renderMembersOnce();
    if (flow === 'history-orders') renderHistoryOrders();
    if (flow === 'history-detail') renderHistoryDetail();
    if (flow === 'history-import-map') renderHistoryMap();
    if (flow === 'history-import-preview') renderHistoryPreview();
    if (flow === 'history-import-result') renderHistoryResult();
    if (flow === 'history-import-fail') renderHistoryFail();
    if (flow === 'import-result') onImportResultEnter();
    if (flow === 'import-fail') syncImportFailUI();
    if (flow === 'legacy-card') renderLegacyCardScreen();
    if (flow === 'legacy-detail') renderLegacyDetailScreen();
  }
  window.go = go;

  function bindDataGo() {
    document.addEventListener('click', function (e) {
      var el = e.target.closest('[data-go]');
      if (!el) return;
      var target = el.getAttribute('data-go');
      if (!target) return;
      // 从概况「查看」进入列表时，返回应回到概况而非结果页
      if (target === 'import-result' && state.viewReturn === 'import-overview') {
        state.viewReturn = null;
        go('import-overview');
        return;
      }
      go(target);
    });
  }

  function bindLogin() {
    var primary = $('#btnLoginPrimary');
    var experience = $('#btnLoginExperience');
    var sms = $('#btnLoginSms');
    if (primary) {
      primary.addEventListener('click', function () {
        enterClaimWithLocationGate();
      });
    }
    if (experience) {
      experience.addEventListener('click', function () {
        enterClaimWithLocationGate();
      });
    }
    if (sms) {
      sms.addEventListener('click', function () {
        showToast('验证码登录（演示占位）');
      });
    }
  }

  function bindLocationGate() {
    var reject = $('#btnLocExplainReject');
    var agree = $('#btnLocExplainAgree');
    var deny = $('#btnLocSysDeny');
    if (reject) {
      reject.addEventListener('click', function () {
        hideLocExplain();
        state.claimEmpty = true;
        syncClaimEmptyUI();
        showToast('未开启定位，可搜索门店或手工创建');
      });
    }
    if (agree) {
      agree.addEventListener('click', function () {
        hideLocExplain();
        showLocSys();
      });
    }
    if (deny) {
      deny.addEventListener('click', function () {
        hideLocSys();
        state.claimEmpty = true;
        syncClaimEmptyUI();
        showToast('未获得定位权限，可搜索门店或手工创建');
      });
    }
    $all('[data-loc-allow]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        hideLocSys();
        state.claimEmpty = false;
        syncClaimEmptyUI();
        go('claim');
        showToast('已定位到附近的 3 家门店');
      });
    });
  }

  function bindClaim() {
    $all('[data-claim-go]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        go('confirm');
      });
    });
    var manual = $('#btnClaimManual');
    if (manual) {
      manual.addEventListener('click', function () {
        go('confirm');
      });
    }
    var emptyCreate = $('#btnClaimEmptyCreate');
    if (emptyCreate) {
      emptyCreate.addEventListener('click', function () {
        go('confirm');
      });
    }
  }

  function bindConfirm() {
    var open = $('#btnConfirmOpen');
    if (open) {
      open.addEventListener('click', function () {
        go('triage');
      });
    }
    var tipClose = $('#btnConfirmTipClose');
    var tip = $('#confirmTip');
    if (tipClose && tip) {
      tipClose.addEventListener('click', function () {
        tip.classList.add('hidden');
      });
    }
    $all('.confirm-cat').forEach(function (chip) {
      chip.addEventListener('click', function () {
        $all('.confirm-cat').forEach(function (c) {
          c.classList.remove('on');
        });
        chip.classList.add('on');
      });
    });
  }

  function bindTriage() {
    $all('[data-triage]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var branch = btn.getAttribute('data-triage');
        if (branch === 'rts' || branch === 'rtp' || branch === 'rtl') {
          showToast(TRIAGE_DEFER_MSG[branch] || '敬请期待');
          return;
        }
        scheduleInvite();
        go('home');
      });
    });
    var skip = $('#btnTriageSkip');
    if (skip) {
      skip.addEventListener('click', function () {
        scheduleInvite();
        go('home');
      });
    }
  }

  function bindInvite() {
    var start = $('#btnInviteStart');
    var later = $('#btnInviteLater');
    if (start) {
      start.addEventListener('click', function () {
        hideInviteSheet();
        enterMigrate();
      });
    }
    if (later) {
      later.addEventListener('click', function () {
        hideInviteSheet();
        showFab();
      });
    }
    var mask = $('#inviteMask');
    if (mask) {
      mask.addEventListener('click', function () {
        hideInviteSheet();
        showFab();
      });
    }
  }

  function bindFab() {
    var fab = $('#migrateFab');
    var close = $('#migrateFabClose');
    if (fab) {
      fab.addEventListener('click', function (e) {
        if (e.target.closest('#migrateFabClose')) return;
        enterMigrate();
      });
    }
    if (close) {
      close.addEventListener('click', function (e) {
        e.stopPropagation();
        hideFab();
      });
    }
  }

  /* ===== 数据迁移：来源选择 / 拍照 / 待识别清单 ===== */

  function collectPlan() {
    var excel = [];
    var photo = [];
    // 单向依赖：会员卡模板必须有价目表；价目表可单独导入
    if (state.importSelection.card) state.importSelection.price = true;
    ['member', 'card', 'price'].forEach(function (key) {
      if (!state.importSelection[key]) return;
      var src = state.importSources[key];
      if (src === 'photo') photo.push(key);
      else if (src === 'excel') excel.push(key);
    });
    state.importPlan = { excel: excel, photo: photo };
    return state.importPlan;
  }

  function syncSelectDeps() {
    var cardOn = !!state.importSelection.card;
    var priceCard = document.querySelector('.import-card[data-import-card="price"]');
    if (priceCard) priceCard.classList.toggle('is-dep-locked', cardOn);
    var dep = document.getElementById('depPrice');
    if (dep) dep.classList.toggle('hidden', !cardOn);
    var depCard = document.getElementById('depCard');
    if (depCard) depCard.classList.toggle('is-on', cardOn);
  }

  function selectedCats() {
    return ['member', 'card', 'price'].filter(function (k) { return !!state.importSelection[k]; });
  }

  // 每个类别最多可加 3 个 Excel；同类多表共用一套字段映射
  var MAX_FILES_PER_CAT = 3;

  function catFiles(key) {
    return state.importFiles[key] || [];
  }

  function hasFiles(key) {
    return catFiles(key).length > 0;
  }

  function totalFiles(cats) {
    return (cats || ['member', 'card', 'price']).reduce(function (s, k) {
      return s + catFiles(k).length;
    }, 0);
  }

  // 移除某个类别的一个文件；idx 缺省时清空该类全部文件
  function removeFile(key, idx) {
    var arr = catFiles(key).slice();
    var i = Number(idx);
    if (idx === null || idx === undefined || idx === '' || isNaN(i) || i < 0 || i >= arr.length) {
      arr = [];
    } else {
      arr.splice(i, 1);
    }
    state.importFiles[key] = arr;
    delete state.importMapAck[key];
  }

  function isCatReady(key) {
    var src = state.importSources[key];
    if (src === 'photo') return state.importPhotos[key].length > 0;
    if (src === 'excel') return hasFiles(key);
    return false;
  }

  function planChipHtml(key) {
    var n = catFiles(key).length;
    var src = state.importSources[key] === 'photo'
      ? '拍照 ' + state.importPhotos[key].length + ' 张'
      : (n ? 'Excel ' + n + ' 个' : 'Excel 待上传');
    return '<span class="queue-chip"><b>' + IMPORT_CAT_SHORT[key] + '</b>' + src + '</span>';
  }

  function shotThumbHtml(p, i, withDel, cat) {
    return '<span class="shot-thumb">' +
      '<img src="' + p.src + '" alt="' + (cat ? IMPORT_CAT[cat] + ' ' : '') + '第 ' + (i + 1) + ' 张">' +
      (withDel ? '<button type="button" class="shot-thumb__del" data-shot-del="' + p.id + '" data-shot-cat="' + (cat || '') + '" aria-label="删除第 ' + (i + 1) + ' 张">×</button>' : '') +
    '</span>';
  }

  function renderImportSelect() {
    ['member', 'card', 'price'].forEach(function (key) {
      var card = document.querySelector('.import-card[data-import-card="' + key + '"]');
      if (!card) return;
      card.classList.toggle('on', !!state.importSelection[key]);
      $all('[data-src-for="' + key + '"]').forEach(function (btn) {
        var on = btn.getAttribute('data-src') === state.importSources[key];
        btn.classList.toggle('is-on', on);
        btn.setAttribute('aria-pressed', on ? 'true' : 'false');
      });

      var files = catFiles(key);
      var shots = state.importPhotos[key];
      var src = state.importSources[key];
      var ready = isCatReady(key);
      var badge = $('#state-' + key);
      if (badge) {
        if (!src) badge.textContent = '请选择来源';
        else if (src === 'photo') badge.textContent = ready ? '已拍 ' + shots.length + ' 张' : '待拍摄';
        else badge.textContent = ready ? ('已上传 ' + files.length + ' 个') : '待上传';
        badge.classList.toggle('is-ready', ready);
        badge.classList.toggle('is-pick', !src);
      }
      var titleB = card.querySelector('.import-card__text > b');
      if (titleB) {
        var stockTag = titleB.querySelector('.import-card__stock');
        var stockN = state.storeStock[key] || 0;
        if (stockN > 0) {
          if (!stockTag) {
            stockTag = document.createElement('span');
            stockTag.className = 'import-card__stock';
            titleB.appendChild(stockTag);
          }
          var mode = state.reimportMode[key];
          stockTag.textContent = mode === 'merge'
            ? '已有 · 合并'
            : (mode === 'replace' ? '已有 · 清空后导' : '已有数据');
        } else if (stockTag) {
          stockTag.remove();
        }
      }

      var box = $('#thumbs-' + key);
      if (!box) return;
      var html = '';
      if (src === 'photo' && shots.length) {
        html = shots.slice(0, 4).map(function (p, i) { return shotThumbHtml(p, i, true, key); }).join('') +
          (shots.length > 4 ? '<span class="import-card__more">+' + (shots.length - 4) + '</span>' : '') +
          '<button type="button" class="import-card__again" data-src-for="' + key + '" data-src="photo">继续拍</button>';
      } else if (src === 'excel' && files.length) {
        html = files.map(function (f, i) {
          return '<div class="import-card__file">' +
            '<span class="import-card__file-ico">XLS</span>' +
            '<span class="import-card__file-name">' + f.name + '</span>' +
            '<button type="button" class="import-card__file-del" data-clear-file="' + key + '" data-file-idx="' + i + '">移除</button>' +
          '</div>';
        }).join('');
      }
      box.innerHTML = html;
      box.classList.toggle('is-files', src === 'excel' && files.length > 0);
      box.classList.toggle('hidden', !html);
    });
    syncSelectDeps();
    syncSelectNextLabel();
  }

  function syncSelectNextLabel() {
    var btn = $('#btnImportSelectNext');
    if (!btn) return;
    var cats = selectedCats();
    var noSrc = cats.filter(function (k) { return !state.importSources[k]; });
    var noData = cats.filter(function (k) { return state.importSources[k] && !isCatReady(k); });
    if (!cats.length) btn.textContent = '下一步';
    else if (noSrc.length) btn.textContent = '还有 ' + noSrc.length + ' 类未选来源';
    else if (noData.length) btn.textContent = '还有 ' + noData.length + ' 类未采集';
    else btn.textContent = '下一步';
  }

  function focusImportCard(key, msg) {
    if (msg) showToast(msg);
    var card = document.querySelector('.import-card[data-import-card="' + key + '"]');
    if (!card) return;
    card.classList.remove('is-flash');
    void card.offsetWidth;
    card.classList.add('is-flash');
    if (card.scrollIntoView) card.scrollIntoView({ block: 'center' });
  }

  var SRC_ICO = {
    excel: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h6"/></svg>',
    photo: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 8a2 2 0 0 1 2-2h2l1.5-2h7L17 6h2a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><circle cx="12" cy="13" r="3.5"/></svg>'
  };

  var SRC_COPY = {
    excel: {
      title: 'Excel 表格',
      lead: '适合已有导出的表格，或记账软件导出的名单。',
      list: [
        '上传 xls / xlsx / csv，第一行是列名',
        '系统按列名自动对齐，可手工改',
        '核对抽样后导入，可在结果页整批删除'
      ],
      ok: '去上传表格'
    },
    photo: {
      title: '拍照识别',
      lead: '适合手写价目表、纸质登记本、截图打印件。',
      list: [
        '整张表格入框，四角对齐',
        '可连拍多页，拍完一起识别',
        '识别后自动成表，再核对导入'
      ],
      ok: '立即拍照'
    }
  };

  function openSrcDialog(key, src) {
    var copy = SRC_COPY[src];
    var mask = $('#srcDialogMask');
    if (!mask || !copy) return;
    state.srcDialog = { key: key, src: src };
    var ico = $('#srcDialogIco');
    if (ico) ico.innerHTML = SRC_ICO[src] || '';
    var title = $('#srcDialogTitle');
    if (title) title.textContent = copy.title;
    var sub = $('#srcDialogSub');
    if (sub) sub.textContent = IMPORT_CAT[key] + ' · 数据来源';
    var lead = $('#srcDialogLead');
    if (lead) lead.textContent = copy.lead;
    var list = $('#srcDialogList');
    if (list) list.innerHTML = copy.list.map(function (t) { return '<li>' + t + '</li>'; }).join('');
    var ok = $('#btnSrcDialogOk');
    if (ok) ok.textContent = copy.ok;
    mask.classList.add('show');
    mask.setAttribute('aria-hidden', 'false');
  }

  function closeSrcDialog() {
    var mask = $('#srcDialogMask');
    if (mask) {
      mask.classList.remove('show');
      mask.setAttribute('aria-hidden', 'true');
    }
    state.srcDialog = null;
  }

  // 确认切换：清掉另一形态的已采集内容（取消说明层不清理）
  function confirmSourceSwitch(key, src) {
    var msg = '';
    if (src === 'photo') {
      if (hasFiles(key)) {
        state.importFiles[key] = [];
        msg = '已切换为拍照，原 Excel 已移除';
      }
    } else if (state.importPhotos[key].length) {
      var n = state.importPhotos[key].length;
      state.importPhotos[key] = [];
      msg = '已切换为 Excel，' + n + ' 张照片已清空';
    }
    delete state.importMapAck[key];
    if (msg) showToast(msg);
    renderImportSelect();
    renderQueue();
  }

  function goSourceStep(key, src) {
    if (src === 'photo') {
      openCamera(key, 'import-select');
      return;
    }
    state.uploadFocus = null;
    state.uploadHi = key;
    go('import-source');
  }

  function pickImportSource(key, src) {
    if (state.importSources[key] === src) {
      goSourceStep(key, src);
      return;
    }
    state.importSources[key] = src;
    renderImportSelect();
    openSrcDialog(key, src);
  }

  function catsNeedingReimportMode() {
    return selectedCats().filter(function (k) {
      return (state.storeStock[k] || 0) > 0 && !state.reimportMode[k];
    });
  }

  function proceedSelectNext() {
    var cats = selectedCats();
    var missingPhoto = cats.filter(function (k) {
      return state.importSources[k] === 'photo' && !state.importPhotos[k].length;
    });
    if (missingPhoto.length) {
      focusImportCard(missingPhoto[0], '「' + IMPORT_CAT[missingPhoto[0]] + '」还没有拍照');
      openCamera(missingPhoto[0], 'import-select');
      return;
    }
    var missingFile = cats.filter(function (k) {
      return state.importSources[k] === 'excel' && !hasFiles(k);
    });
    if (missingFile.length) {
      state.uploadFocus = null;
      state.uploadHi = missingFile[0];
      showToast('「' + IMPORT_CAT[missingFile[0]] + '」还没上传表格');
      go('import-source');
      return;
    }
    go('import-queue');
  }

  function handleSelectNext() {
    var cats = selectedCats();
    if (!cats.length) {
      showToast('请至少选择一项');
      return;
    }
    var noSrc = cats.filter(function (k) { return !state.importSources[k]; });
    if (noSrc.length) {
      focusImportCard(noSrc[0], '「' + IMPORT_CAT[noSrc[0]] + '」还没选来源');
      return;
    }
    // 已有存量的类别：强制二选一（合并 / 清空本类），无静默默认
    if (catsNeedingReimportMode().length) {
      openReimportModeSheet();
      return;
    }
    proceedSelectNext();
  }

  function openReimportModeSheet() {
    var list = $('#reimportModeList');
    var need = selectedCats().filter(function (k) { return (state.storeStock[k] || 0) > 0; });
    if (!list) return;
    list.innerHTML = need.map(function (k) {
      var n = state.storeStock[k];
      var mode = state.reimportMode[k];
      return '<div class="reimport-mode-card" data-reimport-cat="' + k + '">' +
        '<p class="reimport-mode-card__title">' + IMPORT_CAT[k] + '</p>' +
        '<p class="reimport-mode-card__sub">本店已有 ' + n + ' ' + STOCK_UNIT[k] + '</p>' +
        '<div class="reimport-mode-opts" role="radiogroup" aria-label="' + IMPORT_CAT[k] + '导入方式">' +
          '<button type="button" class="reimport-mode-opt' + (mode === 'merge' ? ' is-on' : '') +
            '" data-reimport-mode="merge" data-reimport-for="' + k + '" role="radio" aria-checked="' +
            (mode === 'merge' ? 'true' : 'false') + '">' +
            '<span class="reimport-mode-opt__radio" aria-hidden="true"></span>' +
            '<span class="reimport-mode-opt__text"><b>合并到现有</b><span>新记录追加；同键（手机号 / 卡名 / 项目名）更新</span></span>' +
          '</button>' +
          '<button type="button" class="reimport-mode-opt is-danger' + (mode === 'replace' ? ' is-on' : '') +
            '" data-reimport-mode="replace" data-reimport-for="' + k + '" role="radio" aria-checked="' +
            (mode === 'replace' ? 'true' : 'false') + '">' +
            '<span class="reimport-mode-opt__radio" aria-hidden="true"></span>' +
            '<span class="reimport-mode-opt__text"><b>清空本类后导入</b><span>先删除本类已有 ' + n + ' ' + STOCK_UNIT[k] + '，再写入本批</span></span>' +
          '</button>' +
        '</div></div>';
    }).join('');
    syncReimportModeOk();
    var mask = $('#reimportModeMask');
    var sheet = $('#reimportModeSheet');
    if (mask) mask.classList.add('show');
    if (sheet) sheet.classList.add('show');
  }

  function hideReimportModeSheet() {
    var mask = $('#reimportModeMask');
    var sheet = $('#reimportModeSheet');
    if (mask) mask.classList.remove('show');
    if (sheet) sheet.classList.remove('show');
  }

  function syncReimportModeOk() {
    var need = selectedCats().filter(function (k) { return (state.storeStock[k] || 0) > 0; });
    var ok = need.every(function (k) { return !!state.reimportMode[k]; });
    var btn = $('#btnReimportModeOk');
    if (btn) btn.disabled = !ok;
  }

  function renderImportOverview() {
    var map = {
      member: { n: '#stockMember', t: '#stockMemberTag', unit: '人' },
      card: { n: '#stockCard', t: '#stockCardTag', unit: '张' },
      price: { n: '#stockPrice', t: '#stockPriceTag', unit: '项' }
    };
    Object.keys(map).forEach(function (k) {
      var n = state.storeStock[k] || 0;
      var nEl = $(map[k].n);
      var tEl = $(map[k].t);
      if (nEl) nEl.textContent = n;
      if (tEl) {
        tEl.textContent = n > 0 ? '已导入' : '未导入';
        tEl.classList.toggle('is-on', n > 0);
      }
    });
  }

  function openHistoryReimportSheet() {
    var cnt = $('#historyReimportCount');
    if (cnt) cnt.textContent = state.storeStock.history || HISTORY_ROWS.length;
    var mask = $('#historyReimportMask');
    var sheet = $('#historyReimportSheet');
    if (mask) mask.classList.add('show');
    if (sheet) sheet.classList.add('show');
  }

  function hideHistoryReimportSheet() {
    var mask = $('#historyReimportMask');
    var sheet = $('#historyReimportSheet');
    if (mask) mask.classList.remove('show');
    if (sheet) sheet.classList.remove('show');
  }

  function applyBatchToStock() {
    ['member', 'card', 'price'].forEach(function (k) {
      if (!state.importSelection[k]) return;
      var mode = state.reimportMode[k];
      var batch = batchCount(k);
      if (mode === 'replace' || !state.storeStock[k]) {
        state.storeStock[k] = batch;
      } else if (mode === 'merge') {
        state.storeStock[k] = (state.storeStock[k] || 0) + MERGE_DEMO[k].add;
      } else {
        state.storeStock[k] = batch;
      }
    });
  }

  function renderResultStockLines() {
    var anyMerge = false;
    var bits = [];
    ['member', 'card', 'price'].forEach(function (k) {
      if (!state.importSelection[k]) return;
      var mode = state.reimportMode[k];
      var totalEl = k === 'member' ? $('#resultMemberCount') : (k === 'card' ? $('#resultCardCount') : $('#resultPriceCount'));
      var okEl = k === 'member' ? $('#resultMemberOk') : (k === 'card' ? $('#resultCardOk') : $('#resultPriceOk'));
      if (totalEl) totalEl.textContent = state.storeStock[k] || BATCH_DEMO[k];
      if (mode === 'merge') {
        anyMerge = true;
        var d = MERGE_DEMO[k];
        if (okEl) okEl.textContent = '新增 ' + d.add + ' · 更新 ' + d.upd;
        bits.push(IMPORT_CAT_SHORT[k] + ' 合并');
      } else if (mode === 'replace') {
        if (okEl) okEl.textContent = '已清空后写入';
        bits.push(IMPORT_CAT_SHORT[k] + ' 覆盖');
      } else if (okEl) {
        okEl.textContent = '已入库';
      }
    });
    var mergeEl = $('#importResultMerge');
    if (mergeEl) {
      if (bits.length) {
        mergeEl.textContent = '本批处理：' + bits.join('；') + '。同键规则：手机号 / 卡名称 / 项目名。';
        mergeEl.classList.remove('hidden');
      } else {
        mergeEl.classList.add('hidden');
        mergeEl.textContent = '';
      }
    }
    void anyMerge;
  }

  /* ---- 拍照 ---- */

  function openCamera(key, returnFlow) {
    state.importCameraCat = key;
    state.importCameraReturn = returnFlow || 'import-select';
    go('import-camera');
  }

  function stopCamera() {
    var video = $('#importCameraVideo');
    if (state.importCameraStream) {
      state.importCameraStream.getTracks().forEach(function (t) { t.stop(); });
      state.importCameraStream = null;
    }
    if (video) {
      video.srcObject = null;
      video.classList.add('hidden');
    }
  }

  function setCameraDemo(on) {
    state.importCameraDemo = !!on;
    var video = $('#importCameraVideo');
    var note = $('#importCameraDemo');
    if (note) note.classList.toggle('hidden', !on);
    if (video && on) video.classList.add('hidden');
  }

  function startCamera() {
    stopCamera();
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraDemo(true);
      return;
    }
    navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false })
      .then(function (stream) {
        state.importCameraStream = stream;
        var video = $('#importCameraVideo');
        if (video) {
          video.srcObject = stream;
          video.classList.remove('hidden');
          var playing = video.play();
          if (playing && playing.catch) playing.catch(function () {});
        }
        setCameraDemo(false);
      })
      .catch(function () {
        setCameraDemo(true);
      });
  }

  function makeDemoShot(cat, idx) {
    var W = 520;
    var H = 680;
    var c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    var g = c.getContext('2d');
    g.fillStyle = '#e9e4dc';
    g.fillRect(0, 0, W, H);
    g.fillStyle = '#ffffff';
    g.fillRect(22, 22, W - 44, H - 44);
    g.fillStyle = '#1b1b1b';
    g.font = 'bold 22px "PingFang SC","Microsoft YaHei",sans-serif';
    g.fillText(IMPORT_CAT[cat] + ' 拍照样张 ' + idx, 46, 76);
    g.fillStyle = '#9b9b9b';
    g.font = '14px "PingFang SC","Microsoft YaHei",sans-serif';
    g.fillText('演示照片 · 仅用于展示识别流程', 46, 102);
    g.fillStyle = '#faf7f3';
    g.fillRect(40, 122, W - 80, 40);
    g.font = 'bold 15px "PingFang SC","Microsoft YaHei",sans-serif';
    g.fillStyle = '#444';
    var heads = ['项目', '价格', '备注'];
    var xs = [56, 254, 376];
    heads.forEach(function (h, i) { g.fillText(h, xs[i], 148); });
    var rows = 9;
    var rh = 52;
    g.strokeStyle = '#e6e1da';
    g.lineWidth = 1;
    var i;
    for (i = 0; i <= rows; i += 1) {
      var y = 162 + i * rh;
      g.beginPath();
      g.moveTo(40, y + 0.5);
      g.lineTo(W - 40, y + 0.5);
      g.stroke();
    }
    g.beginPath(); g.moveTo(40, 122); g.lineTo(40, 162 + rows * rh); g.stroke();
    g.beginPath(); g.moveTo(W - 40, 122); g.lineTo(W - 40, 162 + rows * rh); g.stroke();
    g.beginPath(); g.moveTo(240, 122); g.lineTo(240, 162 + rows * rh); g.stroke();
    g.beginPath(); g.moveTo(360, 122); g.lineTo(360, 162 + rows * rh); g.stroke();
    g.fillStyle = '#3a3a3a';
    g.font = '15px "PingFang SC","Microsoft YaHei",sans-serif';
    for (i = 0; i < rows; i += 1) {
      var yy = 162 + i * rh + 32;
      g.fillText('项目 ' + (i + 1), 56, yy);
      g.fillText('¥' + (68 + i * 30), 254, yy);
      g.fillText(i % 3 === 0 ? '热销' : '—', 376, yy);
    }
    return c.toDataURL('image/jpeg', 0.85);
  }

  function flashShutter() {
    var vf = $('#importCameraVf');
    if (!vf) return;
    vf.classList.remove('is-flash');
    void vf.offsetWidth;
    vf.classList.add('is-flash');
  }

  function renderCamera() {
    var cat = state.importCameraCat || 'price';
    var list = state.importPhotos[cat];
    var catEl = $('#importCameraFor');
    if (catEl) catEl.textContent = IMPORT_CAT[cat];
    var count = $('#importCameraCount');
    if (count) count.textContent = '已拍 ' + list.length + ' 张';
    var strip = $('#importCameraStrip');
    if (!strip) return;
    strip.innerHTML = list.length
      ? list.map(function (p, i) { return shotThumbHtml(p, i, true, cat); }).join('')
      : '<p class="cam-strip__empty">拍摄后在这里预览</p>';
  }

  function captureShot() {
    var cat = state.importCameraCat || 'price';
    var src = null;
    var video = $('#importCameraVideo');
    if (!state.importCameraDemo && video && video.videoWidth) {
      var c = document.createElement('canvas');
      c.width = video.videoWidth;
      c.height = video.videoHeight;
      c.getContext('2d').drawImage(video, 0, 0, c.width, c.height);
      src = c.toDataURL('image/jpeg', 0.85);
    }
    if (!src) src = makeDemoShot(cat, state.importPhotos[cat].length + 1);
    state.importPhotos[cat].push({
      id: 'p' + Date.now().toString(36) + Math.random().toString(16).slice(2, 6),
      src: src
    });
    flashShutter();
    renderCamera();
    renderImportSelect();
    showToast('已拍第 ' + state.importPhotos[cat].length + ' 张');
  }

  function deleteShot(id, cat) {
    var key = cat || state.importCameraCat;
    if (!key) return;
    var list = state.importPhotos[key];
    var idx = -1;
    list.forEach(function (p, i) { if (p.id === id) idx = i; });
    if (idx === -1) return;
    list.splice(idx, 1);
    renderCamera();
    renderImportSelect();
    renderQueue();
  }

  /* ---- 上传表格 ---- */

  var HDR_SAMPLE = {
    member: '000685 · 王芳 · W · 138****6621 · 黄金卡 · 2027-06-30 · 1280 · 3600 · 2320 · 18 · 96 · 储值账户',
    card: '黄金卡 · 2000 · 200 · 全场 · 8折 · 染发×2，护理×1 · 染发 98，护理 168 · 12 个月',
    price: '剪发 · 剪发造型 · 128 · 108 · 次'
  };

  function hdrGroupHtml(key) {
    var fields = IMPORT_FIELDS[key] || [];
    var cols = fields.map(function (f) { return f.label; });
    var groups = [];
    fields.forEach(function (f) {
      var name = f.group || '';
      if (!groups.length || groups[groups.length - 1].name !== name) groups.push({ name: name, cols: [] });
      groups[groups.length - 1].cols.push(f.label);
    });
    var body = groups.length > 1
      ? groups.map(function (g) {
        return '<div class="hdr-sub">' +
          (g.name ? '<span class="hdr-sub__name">' + g.name + '</span>' : '') +
          '<div class="hdr-group__chips">' + g.cols.map(function (c) { return '<span>' + c + '</span>'; }).join('') + '</div>' +
        '</div>';
      }).join('')
      : '<div class="hdr-group__chips">' + cols.map(function (c) { return '<span>' + c + '</span>'; }).join('') + '</div>';
    return '<div class="hdr-group" data-hdr-cat="' + key + '">' +
      '<div class="hdr-group__head"><b>' + IMPORT_CAT[key] + '</b><span>' + cols.length + ' 列</span></div>' +
      body +
      '<div class="hdr-group__eg"><i>示例</i>' + HDR_SAMPLE[key] + '</div>' +
    '</div>';
  }

  function renderHdrCard(cats) {
    var box = $('#hdrGroups');
    if (!box) return;
    var use = (cats && cats.length) ? cats : (state.hdrCats.length ? state.hdrCats : collectPlan().excel.slice(0, 1));
    state.hdrCats = use;
    box.innerHTML = use.map(hdrGroupHtml).join('');
    box.classList.toggle('is-collapsed', !state.hdrOpen);
    var btn = $('#btnHdrToggle');
    if (btn) {
      btn.textContent = state.hdrOpen ? '收起示例行' : '查看示例行';
      btn.setAttribute('aria-expanded', state.hdrOpen ? 'true' : 'false');
    }
    var tag = $('#hdrTag');
    if (tag) tag.textContent = use.length === 1 ? '当前类别' : '对齐更准';
    var lead = $('#hdrLead');
    if (lead) {
      lead.textContent = use.length === 1
        ? '按「' + IMPORT_CAT[use[0]] + '」的列名整理首行，识别更准。'
        : '首行改成下列列名，识别更准。';
    }
    var hint = $('#hdrHint');
    if (hint) {
      hint.textContent = '不要标题行、合并单元格、空行。';
    }
  }

  function uploadCats() {
    return collectPlan().excel;
  }

  function renderUploadSteps(cats, cur) {
    var host = $('#uploadSteps');
    if (!host) return;
    host.innerHTML = cats.map(function (k, i) {
      var done = hasFiles(k);
      var on = k === cur;
      return '<div class="up-step' + (on ? ' is-on' : '') + (done ? ' is-done' : '') + '" data-up-step="' + k + '">' +
        '<span class="up-step__num">' + (done ? '✓' : (i + 1)) + '</span>' +
        '<span class="up-step__name">' + IMPORT_CAT_SHORT[k] + '</span>' +
      '</div>';
    }).join('');
  }

  function renderUploadList() {
    var plan = collectPlan();
    var cats = plan.excel;

    // 从类型页 / 待识别页跳进来时，定位到指定的那一类（只生效一次）
    if (state.uploadFocus && cats.indexOf(state.uploadFocus) > -1) {
      state.uploadStep = cats.indexOf(state.uploadFocus);
      state.uploadHi = state.uploadFocus;
    }
    state.uploadFocus = null;
    if (state.uploadStep >= cats.length) state.uploadStep = 0;
    var cur = cats[state.uploadStep] || null;

    var list = $('#importUploadList');
    var forEl = $('#importUploadFor');
    var titleEl = $('#uploadStepTitle');
    if (titleEl) titleEl.textContent = cur ? '上传 Excel · ' + IMPORT_CAT_SHORT[cur] : '上传 Excel';
    if (forEl) {
      forEl.textContent = cur
        ? '第 ' + (state.uploadStep + 1) + ' / ' + cats.length + ' 类'
        : '本批没有要上传的表';
    }
    renderUploadSteps(cats, cur);

    if (list) {
      if (!cur) {
        list.innerHTML = '<p class="queue-empty">没有待上传的类别，返回上一步调整来源。</p>';
      } else {
        var files = catFiles(cur);
        var full = files.length >= MAX_FILES_PER_CAT;
        var rows = files.map(function (f, i) {
          return '<div class="upload-file">' +
            '<span class="upload-file__ico">XLS</span>' +
            '<span class="upload-file__body"><b>' + f.name + '</b><span>' + f.size + '</span></span>' +
            '<button type="button" class="upload-row__del" data-clear-file="' + cur + '" data-file-idx="' + i + '" aria-label="移除">×</button>' +
          '</div>';
        }).join('');
        list.innerHTML = '<div class="upload-row' + (files.length ? ' is-done' : '') + ' is-hi">' +
          '<span class="upload-row__cat">' + IMPORT_CAT[cur] + '</span>' +
          '<div class="upload-row__body">' +
            (files.length
              ? '<span class="upload-row__cnt">已选 ' + files.length + ' / ' + MAX_FILES_PER_CAT + ' 个表</span>' +
                '<div class="upload-files">' + rows + '</div>'
              : '<b>未选择文件</b><span>xls / xlsx / csv · 单个 ≤ 10MB · 最多 3 个</span>') +
          '</div>' +
          '<button type="button" class="upload-row__pick" data-pick-for="' + cur + '"' + (full ? ' disabled' : '') + '>' +
            (full ? '已达上限' : (files.length ? '再添加' : '选择文件')) +
          '</button>' +
        '</div>' +
        (files.length > 1
          ? '<p class="upload-multi-note">同类多个表共用一套字段映射，列名请保持一致。</p>'
          : '');
      }
    }
    renderHdrCard(cur ? [cur] : []);
    var hdr = $('#hdrCard');
    if (hdr) hdr.classList.toggle('hidden', !cur);

    var done = $('#btnImportUploadDone');
    if (done) {
      if (!cur) {
        done.textContent = '返回上一步';
      } else if (!hasFiles(cur)) {
        done.textContent = '请先选择表格';
      } else {
        var next = null;
        for (var i = state.uploadStep + 1; i < cats.length; i++) {
          if (!hasFiles(cats[i])) { next = cats[i]; break; }
        }
        done.textContent = next
          ? '完成，下一类：' + IMPORT_CAT_SHORT[next]
          : (cats.length > 1 ? '完成，进入待识别' : '完成');
      }
    }
  }

  function pickFileFor(cat) {
    var arr = catFiles(cat);
    if (arr.length >= MAX_FILES_PER_CAT) {
      showToast('每类最多 ' + MAX_FILES_PER_CAT + ' 个表，可先移除一个再添加');
      return;
    }
    var n = arr.length + 1;
    state.importFiles[cat] = arr.concat([{
      name: IMPORT_CAT[cat] + '导入表' + (n > 1 ? ' ' + n : '') + '.xlsx',
      size: '1.2 MB'
    }]);
    showToast('已添加 ' + state.importFiles[cat][n - 1].name + '（本类 ' + n + '/' + MAX_FILES_PER_CAT + '）');
    renderUploadList();
    renderImportSelect();
  }

  /* ---- 待识别清单 ---- */

  function renderQueue() {
    var plan = collectPlan();
    var files = plan.excel.filter(function (k) { return hasFiles(k); });
    var fileTotal = totalFiles(plan.excel);
    var shots = plan.photo.reduce(function (s, k) { return s + state.importPhotos[k].length; }, 0);

    var summary = $('#queueSummary');
    if (summary) {
      summary.innerHTML =
        '<div class="queue-summary__line"><b>' + fileTotal + ' 个 Excel</b><i>+</i><b>' + shots + ' 张照片</b></div>' +
        '<div class="queue-summary__chips">' +
          plan.excel.concat(plan.photo).map(planChipHtml).join('') +
        '</div>';
    }
    var ec = $('#queueExcelCount');
    if (ec) ec.textContent = fileTotal + ' 个';
    var pc = $('#queuePhotoCount');
    if (pc) pc.textContent = shots + ' 张';

    var list = $('#queueExcelList');
    if (list) {
      var rows = [];
      files.forEach(function (k) {
        catFiles(k).forEach(function (f, i) {
          rows.push('<div class="queue-file">' +
            '<span class="queue-file__ico">XLS</span>' +
            '<span class="queue-file__body"><b>' + f.name + '</b><span>' + IMPORT_CAT_SHORT[k] + ' · ' + f.size + ' · 将转标准表</span></span>' +
            '<button type="button" class="queue-file__act" data-queue-file-change="' + k + '">' + (catFiles(k).length > 1 ? '管理' : '更换') + '</button>' +
            '<button type="button" class="queue-file__act queue-file__act--del" data-clear-file="' + k + '" data-file-idx="' + i + '">删除</button>' +
          '</div>');
        });
      });
      list.innerHTML = rows.length ? (rows.join('') +
        (fileTotal > files.length
          ? '<p class="queue-empty">同类多个表共用一套字段映射，列名请保持一致。</p>'
          : '')) : '<p class="queue-empty">本批没有 Excel，照片将直接识别</p>';
    }

    var groups = $('#queuePhotoGroups');
    if (groups) {
      groups.innerHTML = plan.photo.length ? plan.photo.map(function (k) {
        var arr = state.importPhotos[k];
        return '<div class="queue-group">' +
          '<div class="queue-group__head"><b>' + IMPORT_CAT_SHORT[k] + '</b>' +
            '<span>' + arr.length + ' 张 · 自动识别列</span>' +
            '<button type="button" class="queue-group__recam" data-queue-recam="' + k + '">补拍</button>' +
          '</div>' +
          (arr.length
            ? '<div class="queue-group__thumbs">' + arr.map(function (p, i) { return shotThumbHtml(p, i, true, k); }).join('') + '</div>'
            : '<p class="queue-empty">还没有照片，点「补拍」继续</p>') +
        '</div>';
      }).join('') : '<p class="queue-empty">本批没有照片</p>';
    }

    var note = $('#queueNote');
    if (note) {
      note.textContent = (files.length && plan.photo.length)
        ? 'Excel 与照片都会先转成官方标准表，转换后进「数据概览」逐行核对；照片转换在后台完成。'
        : (plan.photo.length
          ? '照片在后台转成标准表，转换后进「数据概览」逐行核对。'
          : 'Excel 会先转成官方标准表，转换后进「数据概览」逐行核对。');
    }
  }

  function startRecognition() {
    if (state.queueBusy) return;
    var plan = collectPlan();
    var files = plan.excel.filter(function (k) { return hasFiles(k); });
    var fileTotal = totalFiles(plan.excel);
    var shots = plan.photo.reduce(function (s, k) { return s + state.importPhotos[k].length; }, 0);
    if (!files.length && !shots) {
      showToast('还没有可转换的内容');
      return;
    }
    state.queueBusy = true;
    // 本批重来：清掉上一批的转换结果与核对数据
    state.checkData = null;
    state.convertDone = false;
    state.convertRunning = false;
    state.checkOpen = null;
    state.checkFilter = 'all';
    state.checkQuery = '';
    state.checkProbIdx = 0;
    state.convertTimers.forEach(function (t) { clearTimeout(t); });
    state.convertTimers = [];
    state.queueBusy = false;
    go('import-convert');
  }

  /* ---- 映射（按类别 tab） ---- */

  function firstUnacked(cats) {
    for (var i = 0; i < cats.length; i += 1) {
      if (!state.importMapAck[cats[i]]) return cats[i];
    }
    return cats[0];
  }

  function renderMapTabs(cats, cur) {
    var tabs = $('#importMapTabs');
    var acked = cats.filter(function (k) { return !!state.importMapAck[k]; }).length;
    if (tabs) {
      tabs.classList.toggle('hidden', cats.length < 2);
      tabs.style.gridTemplateColumns = 'repeat(' + Math.max(cats.length, 2) + ', minmax(0, 1fr))';
      tabs.innerHTML = cats.map(function (k) {
        var on = k === cur;
        var ok = !!state.importMapAck[k];
        return '<button type="button" class="map-tab' + (on ? ' is-on' : '') + (ok ? ' is-ack' : '') + '"' +
          ' role="tab" aria-selected="' + (on ? 'true' : 'false') + '" data-map-tab="' + k + '">' +
          '<span class="map-tab__name">' + IMPORT_CAT_SHORT[k] + '</span>' +
          '<span class="map-tab__state">' + (ok ? '已确认 ✓' : '待确认') + '</span>' +
        '</button>';
      }).join('');
    }

    var prog = $('#mapProgress');
    if (prog) prog.classList.toggle('hidden', cats.length < 2);
    var txt = $('#mapProgressText');
    if (txt) txt.textContent = '已确认 ' + acked + '/' + cats.length;
    var bar = $('#mapProgressBar');
    if (bar) bar.style.width = (cats.length ? (acked / cats.length * 100) : 0) + '%';
    var hint = $('#mapProgressHint');
    if (hint) {
      var left = cats.filter(function (k) { return !state.importMapAck[k]; });
      hint.textContent = left.length
        ? '还有 ' + left.length + ' 项待确认：' + left.map(function (k) { return IMPORT_CAT_SHORT[k]; }).join('、')
        : '全部已确认，可以进入下一步';
      hint.classList.toggle('is-ok', !left.length);
    }
  }

  function renderImportMap(pinTab) {
    var cats = mapExcelCats();
    if (!cats.length) {
      go('import-preview');
      return;
    }
    // 进页 / 切回来时优先落在「还没确认」的那一类；手动切 tab 时不要抢焦点
    if (!pinTab) {
      var needJump = cats.indexOf(state.importMapTab) === -1;
      if (!needJump && state.importMapAck[state.importMapTab]) {
        needJump = cats.some(function (k) { return !state.importMapAck[k]; });
      }
      if (needJump) state.importMapTab = firstUnacked(cats);
    }
    var cat = state.importMapTab;

    renderMapTabs(cats, cat);

    var lead = $('#importMapLead');
    if (lead) {
      var extra = '';
      if (cat === 'card' && hasFiles('price')) {
        extra = '（权益项目与会员价按<b>价目表</b>校验）';
      }
      lead.innerHTML = '已识别为<strong>' + IMPORT_CAT[cat] + '</strong>，AI 已按列名猜好映射' + extra;
    }

    var multiNote = $('#mapMultiNote');
    if (multiNote) {
      var n = catFiles(cat).length;
      if (n > 1) {
        multiNote.classList.remove('hidden');
        multiNote.textContent = '本类 ' + n + ' 个表共用这一套映射，按第一份的列名对齐。';
      } else {
        multiNote.classList.add('hidden');
        multiNote.textContent = '';
      }
    }

    renderMapRows(cat);

    var photoNote = $('#importMapPhotoNote');
    var photoCats = collectPlan().photo;
    if (photoNote) {
      if (photoCats.length) {
        photoNote.classList.remove('hidden');
        photoNote.innerHTML = '另有 ' + photoCats.map(function (k) {
          return '<b>' + IMPORT_CAT[k] + '</b> ' + state.importPhotos[k].length + ' 张照片';
        }).join('、') + ' · 自动识别列，无需对齐';
      } else {
        photoNote.classList.add('hidden');
        photoNote.innerHTML = '';
      }
    }

    syncMapAckUI();
  }

  function renderMapRows(cat) {
    var host = $('#importMapRows');
    if (!host) return;
    var fields = IMPORT_FIELDS[cat] || IMPORT_FIELDS.member;
    var values = state.importMapValues[cat] || {};
    var lastGroup = '';
    host.innerHTML = fields.map(function (f) {
      var out = '';
      if (f.group && f.group !== lastGroup) {
        lastGroup = f.group;
        out += '<div class="map-group"><span>' + f.group + '</span></div>';
      }
      var opts = (f.opts || []).slice();
      var value = values[f.key];
      if (f.derived) {
        opts = ['__derive__'].concat(opts);
        if (!value) value = '__derive__';
      } else if (!value) {
        value = opts[0];
      }
      var options = opts.map(function (o) {
        var label = o === '__derive__' ? '按姓名称呼自动识别' : o;
        return '<option value="' + o + '"' + (o === value ? ' selected' : '') + '>' + label + '</option>';
      }).join('') + '<option value="（跳过）">（跳过）</option><option value="__custom__">自定义…</option>';
      var isCustom = value === '__custom__';
      out += '<div class="import-map-row' + (f.derived ? ' import-map-row--derived' : '') + '" data-field="' + f.key + '" data-cat="' + cat + '">' +
        '<strong>' + f.label + (f.tag ? '<span class="import-map-row__tag">' + f.tag + '</span>' : '') + '</strong>' +
        '<select class="import-map-select" id="importMapSelect-' + cat + '-' + f.key + '">' + options + '</select>' +
        '<div class="import-map-custom"' + (isCustom ? '' : ' hidden') + '>' +
          '<input type="text" class="import-map-custom__input" placeholder="' + (f.ph || '输入源表列名') + '" autocomplete="off">' +
          '<p class="import-map-custom__msg" aria-live="polite"></p>' +
        '</div>' +
        (f.hint ? '<p class="import-map-row__hint">' + f.hint + '</p>' : '') +
      '</div>';
      return out;
    }).join('');
    bindMapCustomInputs();
  }

  function syncMapAckUI() {
    var cat = state.importMapTab;
    var on = !!state.importMapAck[cat];
    var ack = $('#btnImportMapAck');
    var input = $('#importMapAckInput');
    var badge = $('#importMapLockBadge');
    var text = $('#importMapAckText');
    if (ack) ack.classList.toggle('on', on);
    if (input) input.checked = on;
    if (badge) badge.classList.toggle('hidden', !on);
    if (text) text.textContent = '确认「' + IMPORT_CAT[cat] + '」映射关系无误';
    state.importMapConfirmed = on;
    syncImportMapLockUI();
  }

  function jumpToUnacked() {
    var left = mapExcelCats().filter(function (k) { return !state.importMapAck[k]; });
    if (!left.length) return false;
    state.importMapTab = left[0];
    renderImportMap(true);
    var tab = document.querySelector('.map-tab[data-map-tab="' + left[0] + '"]');
    if (tab) {
      tab.classList.remove('is-pulse');
      void tab.offsetWidth;
      tab.classList.add('is-pulse');
      if (tab.scrollIntoView) tab.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }
    showToast('还有「' + IMPORT_CAT[left[0]] + '」未确认，已切到该项');
    return true;
  }

  function switchMapTab(cat) {
    if (!cat || cat === state.importMapTab) return;
    state.importMapTab = cat;
    renderImportMap(true);
  }

  /* ---- 自动生成卡模板（只导持卡信息、未导卡模板时） ---- */

  // 按 members.xlsx 的「卡种」实测值聚合（1432 条有卡种，合计与表内行数一致）
  // single = 单张卡的储值金额：取该卡种内「单卡余额最高」的那一条，不是整类合计
  var AUTO_TPL_SEED = [
    { name: '7折', count: 448, single: 2000, discount: 7 },
    { name: '黄金卡', count: 296, single: 5000, discount: 8 },
    { name: '8折', count: 296, single: 1500, discount: 8 },
    { name: '6折卡', count: 152, single: 1000, discount: 6 },
    { name: '6.5折', count: 129, single: 1000, discount: 6.5 },
    { name: '5折卡', count: 60, single: 1000, discount: 5 },
    { name: '7.5折卡', count: 34, single: 1000, discount: 7.5 },
    { name: '4折卡', count: 14, single: 1000, discount: 4 },
    { name: '8.8折卡', count: 2, single: 800, discount: 8.8 },
    { name: '3.8折', count: 1, single: 800, discount: 3.8 }
  ];

  function needTplGen() {
    return !!state.importSelection.member && !state.importSelection.card;
  }

  function tplDrafts() {
    if (!state.tplGen) {
      state.tplGen = AUTO_TPL_SEED.map(function (t, i) {
        return {
          id: 't' + i,
          name: t.name,
          count: t.count,
          single: t.single,       // 储值金额：单卡口径，取自表内余额最高的一条
          validity: '永久',        // 持卡信息推不出有效期，默认永久
          discount: t.discount,
          editing: false,
          on: true
        };
      });
    }
    return state.tplGen;
  }

  function tplIncluded() {
    return (state.tplGen || []).filter(function (t) { return !!t.on; });
  }

  function tplCount() {
    if (state.importSelection.card) return 4;
    return tplIncluded().length;
  }

  function renderTplGen() {
    var list = tplDrafts();
    var on = list.filter(function (t) { return t.on; });
    var lead = $('#tplGenLead');
    if (lead) {
      lead.innerHTML = '本批没有导入会员卡模板，已从持卡信息的「卡种」推得 <strong>' + list.length +
        '</strong> 张模板草案。<b>储值金额取该卡种内单卡余额最高的一条，有效期默认「永久」</b>，可逐张改后确认。';
    }
    var countEl = $('#tplGenCount');
    if (countEl) countEl.textContent = '已选 ' + on.length + ' 张';
    var all = $('#tplGenAll');
    if (all) {
      all.checked = list.length > 0 && on.length === list.length;
      all.indeterminate = on.length > 0 && on.length < list.length;
    }

    var host = $('#tplGenList');
    if (host) {
      host.innerHTML = list.map(function (t) {
        return '<div class="tpl-gen-row' + (t.on ? ' is-on' : '') + (t.editing ? ' is-editing' : '') + '" data-tpl-row="' + t.id + '">' +
          '<label class="tpl-gen-row__check">' +
            '<input type="checkbox" data-tpl-check="' + t.id + '"' + (t.on ? ' checked' : '') + '>' +
            '<span class="tpl-gen-row__box" aria-hidden="true"></span>' +
          '</label>' +
          '<div class="tpl-gen-row__body">' +
            '<div class="tpl-gen-row__title">' +
              '<input type="text" class="tpl-gen-row__name" data-tpl-name="' + t.id + '" value="' + t.name + '" aria-label="卡名称">' +
              (t.discount
                ? '<span class="tpl-gen-row__chip">全场 ' + t.discount + ' 折</span>'
                : '') +
              '<span class="tpl-gen-row__tag">待完善</span>' +
            '</div>' +
            '<p class="tpl-gen-row__meta">' + t.count + ' 人持卡</p>' +
            '<button type="button" class="tpl-gen-row__sum" data-tpl-edit="' + t.id + '" aria-expanded="' + (t.editing ? 'true' : 'false') + '">' +
              '<span>单卡储值 <b>' + fmtMoney(t.single) + '</b></span>' +
              '<span class="tpl-gen-row__dot" aria-hidden="true">·</span>' +
              '<span>有效期 <b>' + (t.validity || '永久') + '</b></span>' +
              '<span class="tpl-gen-row__act">' + (t.editing ? '收起' : '修改') + '</span>' +
            '</button>' +
            (t.editing
              ? '<div class="tpl-gen-edit">' +
                  '<label class="tpl-gen-field">' +
                    '<span>储值金额</span>' +
                    '<span class="tpl-gen-field__box"><i>¥</i>' +
                      '<input type="text" inputmode="numeric" data-tpl-single="' + t.id + '" value="' + t.single + '" aria-label="储值金额">' +
                    '</span>' +
                  '</label>' +
                  '<label class="tpl-gen-field">' +
                    '<span>有效期</span>' +
                    '<input type="text" data-tpl-validity="' + t.id + '" value="' + (t.validity || '') + '" placeholder="永久" aria-label="有效期">' +
                  '</label>' +
                '</div>'
              : '') +
          '</div>' +
        '</div>';
      }).join('');
    }

    var next = $('#btnTplGenNext');
    if (next) {
      next.disabled = on.length === 0;
      next.textContent = on.length
        ? '确认，生成 ' + on.length + ' 张模板'
        : '至少选 1 张，或点「本次不生成」';
    }
  }

  function bindTplGen() {
    var host = $('#tplGenList');
    if (host) {
      host.addEventListener('click', function (e) {
        var edit = e.target.closest('[data-tpl-edit]');
        if (edit) {
          var eid = edit.getAttribute('data-tpl-edit');
          (state.tplGen || []).forEach(function (t) {
            // 一次只展开一张，避免列表被撑得太长
            t.editing = t.id === eid ? !t.editing : false;
          });
          renderTplGen();
          return;
        }
        var check = e.target.closest('[data-tpl-check]');
        if (!check) return;
        var id = check.getAttribute('data-tpl-check');
        (state.tplGen || []).forEach(function (t) { if (t.id === id) t.on = check.checked; });
        renderTplGen();
      });
      host.addEventListener('input', function (e) {
        var name = e.target.closest('[data-tpl-name]');
        if (name) {
          var nid = name.getAttribute('data-tpl-name');
          (state.tplGen || []).forEach(function (t) { if (t.id === nid) t.name = name.value; });
          return;
        }
        var single = e.target.closest('[data-tpl-single]');
        if (single) {
          var sid = single.getAttribute('data-tpl-single');
          var digits = String(single.value || '').replace(/[^\d./]/g, '');
          if (digits !== single.value) single.value = digits;
          (state.tplGen || []).forEach(function (t) { if (t.id === sid) t.single = digits; });
          return;
        }
        var validity = e.target.closest('[data-tpl-validity]');
        if (validity) {
          var vid = validity.getAttribute('data-tpl-validity');
          (state.tplGen || []).forEach(function (t) { if (t.id === vid) t.validity = validity.value; });
        }
      });
      host.addEventListener('change', function (e) {
        var single = e.target.closest('[data-tpl-single]');
        if (single) {
          var sid = single.getAttribute('data-tpl-single');
          var num = String(single.value || '').replace(/[^\d.]/g, '');
          (state.tplGen || []).forEach(function (t) { if (t.id === sid && num !== '') t.single = num; });
          renderTplGen();
          return;
        }
        var validity = e.target.closest('[data-tpl-validity]');
        if (validity) {
          var vid = validity.getAttribute('data-tpl-validity');
          var val = String(validity.value || '').trim() || '永久';
          (state.tplGen || []).forEach(function (t) { if (t.id === vid) t.validity = val; });
          renderTplGen();
        }
      });
    }
    var all = $('#tplGenAll');
    if (all) {
      all.addEventListener('change', function () {
        (state.tplGen || []).forEach(function (t) { t.on = all.checked; });
        renderTplGen();
      });
    }
    var next = $('#btnTplGenNext');
    if (next) {
      next.addEventListener('click', function () {
        var picked = tplIncluded().filter(function (t) { return String(t.name || '').trim(); });
        if (!picked.length) {
          showToast('请至少勾选一张卡模板，或点「本次不生成」');
          return;
        }
        state.tplGenIncluded = picked.slice();
        go('import-preview');
      });
    }
    var skip = $('#btnTplGenSkip');
    if (skip) {
      skip.addEventListener('click', function () {
        state.tplGenIncluded = [];
        go('import-preview');
      });
    }
  }

  /* ---- 核对页 / 结果页的来源标注 ---- */

  var PREVIEW_COUNTS = { member: 126, card: 4, price: 42 };
  var PREVIEW_UNITS = { member: '人', card: '张', price: '项' };
  var PREVIEW_TAILS = {
    member: '会员编号 / 卡种 / 余额…',
    card: '卡名称 / 充值 / 权益…',
    price: '项目·产品 / 价格…'
  };

  function previewCats() {
    var cats = ['member', 'card', 'price'].filter(function (k) { return !!state.importSelection[k]; });
    if (cats.indexOf('card') === -1 && tplCount() > 0) cats.push('card');
    return cats.sort(function (a, b) {
      return ['member', 'card', 'price'].indexOf(a) - ['member', 'card', 'price'].indexOf(b);
    });
  }

  function renderPreviewTypes() {
    var host = $('#importPreviewTypes');
    if (!host) return;
    var cats = previewCats();
    PREVIEW_COUNTS.card = tplCount();
    host.innerHTML = cats.map(function (k) {
      var src = state.importSources[k];
      var badge = '';
      if (k === 'card' && !state.importSelection.card) {
        badge = '<span class="src-badge src-badge--auto">自动生成</span>';
      } else if (src === 'photo') {
        badge = '<span class="src-badge src-badge--photo">拍照 ' + state.importPhotos[k].length + ' 张</span>';
      } else if (src === 'excel') {
        badge = '<span class="src-badge">Excel</span>';
      }
      return '<button type="button" class="import-preview-type" data-preview-type="' + k + '">' +
        '<span class="import-card__ico" aria-hidden="true">' + (CAT_ICO[k] || '') + '</span>' +
        '<span class="import-preview-type__text"><b>' + IMPORT_CAT[k] + badge + '</b>' +
          '<span><em class="num-em">' + PREVIEW_COUNTS[k] + '</em> ' + PREVIEW_UNITS[k] + ' · ' + PREVIEW_TAILS[k] + '</span></span>' +
        '<img class="import-preview-type__chev" src="assets/figma/confirm/ico-chevron.svg" alt="" width="16" height="16">' +
      '</button>';
    }).join('');
    var sub = $('#importPreviewSub');
    if (sub) {
      var parts = cats.map(function (k) {
        return (k === 'member' ? '会员与持卡' : k === 'card' ? '卡模板' : '价目') + ' <em class="num-em">' + PREVIEW_COUNTS[k] + '</em>';
      });
      sub.innerHTML = parts.join(' · ') + '。点分类查看明细。';
    }
    var rc = $('#resultCardCount');
    if (rc) rc.textContent = PREVIEW_COUNTS.card;
    var dc = $('#delBatchCardCount');
    if (dc) dc.textContent = PREVIEW_COUNTS.card;
  }

  function renderResultSources() {
    var el = $('#importResultSources');
    if (!el) return;
    var plan = collectPlan();
    var files = totalFiles(plan.excel);
    var shots = plan.photo.reduce(function (s, k) { return s + state.importPhotos[k].length; }, 0);
    var parts = [];
    if (files) parts.push('Excel ' + files + ' 个');
    if (shots) parts.push('照片 ' + shots + ' 张');
    if (files || shots) parts.push('AI 转标准表');
    el.textContent = '本批来源：' + (parts.join(' · ') || '演示数据');
  }

  /* ===== v2.0 标准表转换 · 数据概览 · 仪式感传输 ===== */

  var CHECK_CARD_TYPES = ['储值卡', '计次卡', '折扣卡', '套餐卡', '周期卡'];
  // 店内已有的卡模板（官方样例 + 常见卡种）；卡名称不在这里就是「店内无此卡」
  var CHECK_CARD_NAMES = ['八折银卡', '剪发5次卡', '尊享折扣卡', '护理套餐卡', '季卡', '黄金卡', '7折卡', '8折卡', '6折卡', '5折卡'];
  var CHECK_CHANNELS = [
    { v: '1', label: '1 上门顾客' },
    { v: '2', label: '2 朋友介绍' },
    { v: '3', label: '3 微信小程序' },
    { v: '4', label: '4 支付宝' },
    { v: '5', label: '5 美团/点评' },
    { v: '6', label: '6 抖音' },
    { v: '7', label: '7 异业推广' },
    { v: '8', label: '8 活动推广' },
    { v: '9', label: '9 优惠券转赠' }
  ];
  var CHECK_UNIT = { member: '行', card: '行', price: '项' };
  var CHECK_LV_LABEL = { error: '需修正', warn: '建议确认', ignored: '已忽略', ok: '可导入' };

  // 字段定义：more=true 的收进「更多字段」，不占默认编辑区高度
  var CHECK_FIELDS = {
    member: [
      { key: 'memberNo', label: '会员编号', ph: '如 0001', req: true },
      { key: 'cardNo', label: '会员卡号', ph: '必填，每张卡唯一', req: true },
      { key: 'name', label: '会员姓名', ph: '必填', req: true },
      { key: 'phone', label: '手机号', ph: '11 位数字', req: true },
      { key: 'gender', label: '性别', type: 'select', opts: [{ v: '男', label: '男' }, { v: '女', label: '女' }] },
      { key: 'birthday', label: '生日', ph: '1990/2/11' },
      { key: 'cardType', label: '卡类型', type: 'select', opts: CHECK_CARD_TYPES.map(function (t) { return { v: t, label: t }; }), req: true },
      { key: 'cardName', label: '卡名称', type: 'select', dynamic: 'cards', req: true },
      { key: 'expiry', label: '有效期限', ph: '永久 / 2027/01/17' },
      { key: 'recharge', label: '充值余额', type: 'money' },
      { key: 'bonus', label: '赠送余额', type: 'money' },
      { key: 'remain', label: '卡剩余价值', type: 'money' },
      { key: 'countLeft', label: '计次剩余次数', type: 'number' },
      { key: 'channel', label: '来源渠道', type: 'select', opts: CHECK_CHANNELS, req: true },
      { key: 'gift', label: '赠送项目', ph: '小气泡:1;基础护理:2', more: true, wide: true },
      { key: 'special', label: '特殊项目', ph: '理发:打折,9.9;洗吹:固定金额,50', more: true, wide: true },
      { key: 'shopCode', label: '开卡店铺编码', ph: '单店可不填', more: true },
      { key: 'note', label: '备注', more: true, wide: true }
    ],
    card: [
      { key: 'type', label: '卡类型', type: 'select', opts: CHECK_CARD_TYPES.map(function (t) { return { v: t, label: t }; }), req: true },
      { key: 'name', label: '卡名', ph: '必填，店内唯一', req: true },
      { key: 'price', label: '购买价格 / 充值', type: 'money' },
      { key: 'discount', label: '享受折扣', ph: '如 8.5，留空不打折' },
      { key: 'times', label: '次数', type: 'number' },
      { key: 'scope', label: '适用大类 / 范围', ph: '留空为全部' },
      { key: 'validity', label: '有效期限（月）', ph: '留空为永久' },
      { key: 'gift', label: '赠送项目', ph: '小气泡:1;基础护理:2', more: true, wide: true },
      { key: 'memberPrice', label: '会员价项目', ph: '理发:打折,9.9', more: true, wide: true },
      { key: 'desc', label: '卡项说明', more: true, wide: true }
    ],
    price: [
      { key: 'name', label: '项目名', ph: '必填，导入后唯一', req: true },
      { key: 'group', label: '项目组', ph: '不存在会新建' },
      { key: 'price', label: '价格', type: 'money', req: true },
      { key: 'bookable', label: '可开单', type: 'select', opts: [{ v: '是', label: '是' }, { v: '否', label: '否' }] },
      { key: 'top', label: '置顶', type: 'select', opts: [{ v: '否', label: '否' }, { v: '是', label: '是' }] },
      { key: 'duration', label: '服务时长（分钟）', type: 'number' },
      { key: 'shopCode', label: '连锁店编码', more: true }
    ]
  };

  function escHtml(s) {
    return String(s === null || s === undefined ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function padNum(n, len) {
    var s = String(n);
    while (s.length < len) s = '0' + s;
    return s;
  }

  // 空 → ''；可解析 → 数字；不可解析 → null
  function parseMoney(v) {
    var s = String(v === null || v === undefined ? '' : v).replace(/[¥,\s]/g, '');
    if (s === '') return '';
    if (!/^-?\d+(\.\d+)?$/.test(s)) return null;
    return Number(s);
  }

  function isPastDate(str) {
    var m = /^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/.exec(String(str || '').trim());
    if (!m) return false;
    var d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    if (d.getFullYear() !== Number(m[1]) || d.getMonth() !== Number(m[2]) - 1 || d.getDate() !== Number(m[3])) return false;
    return d.getTime() < new Date(2026, 9, 26).getTime();
  }

  function checkRows(cat) {
    return (state.checkData && state.checkData[cat]) || [];
  }

  function checkCats() {
    return ['member', 'card', 'price'].filter(function (k) {
      return checkRows(k).length > 0;
    });
  }

  function checkFindRow(cat, id) {
    var rows = checkRows(cat);
    for (var i = 0; i < rows.length; i += 1) if (rows[i].id === id) return rows[i];
    return null;
  }

  function rowHasLevel(row, level) {
    for (var i = 0; i < row.problems.length; i += 1) if (row.problems[i].level === level) return true;
    return false;
  }

  function rowIssues(row) {
    return (row.problems || []).filter(function (p) { return p.level === 'error' || p.level === 'warn'; });
  }

  /* --- 造数：官方模板口径（会员一行一张卡） --- */

  function buildMemberRows() {
    var list = [];
    var total = 1433;
    var base = 1100;
    var i;
    for (i = 0; i < total; i += 1) {
      var mi = i < base ? i : ((i - base) * 4) % base;
      var surname = SURNAME_LIST[mi % SURNAME_LIST.length];
      var female = mi % 3 !== 0;
      var pool = female ? GIVEN_FEMALE : GIVEN_MALE;
      var name = surname + pool[mi % pool.length] + (female ? '女士' : '先生');
      var type = CHECK_CARD_TYPES[mi % CHECK_CARD_TYPES.length];
      var cardName = ['八折银卡', '剪发5次卡', '尊享折扣卡', '护理套餐卡', '季卡'][mi % 5];
      var gender = deriveGenderFromName(name).value || '女';
      var f = {
        memberNo: padNum(mi + 1, 4),
        cardNo: padNum(i + 1, 4),
        name: name,
        phone: '1' + String(3 + (mi % 7)) + String(900000000 + mi * 137).slice(0, 9),
        gender: gender,
        birthday: '1990/' + (1 + (mi % 12)) + '/' + (1 + (mi % 27)),
        cardType: type,
        cardName: cardName,
        expiry: type === '储值卡' ? '永久' : '2027/' + padNum(1 + (mi % 12), 2) + '/' + padNum(1 + (mi % 27), 2),
        recharge: type === '储值卡' ? (360 + (mi % 12) * 50).toFixed(2) : '',
        bonus: type === '储值卡' ? String((mi % 4) * 20) + '.00' : '',
        remain: type === '储值卡' ? '' : (400 + (mi % 8) * 80).toFixed(2),
        countLeft: type === '计次卡' ? String(2 + (mi % 8)) : '',
        channel: String(1 + (mi % 9)),
        gift: mi % 3 === 0 ? '小气泡:1;基础护理:2' : '',
        special: '',
        shopCode: '',
        note: ''
      };
      list.push({
        id: 'm' + i,
        f: f,
        problems: [],
        ignored: false,
        aiFields: i % 5 === 0 ? ['channel'] : []
      });
    }

    // 预置问题行：让概览一进来就能看到「能发现、能就地改」
    list[12].f.phone = '1380013abc';
    list[27].f.name = '';
    list[48].f.cardNo = list[7].f.cardNo;
    list[63].f.cardName = 'VIP金卡';
    list[77].f.recharge = '¥—';
    list[91].f.channel = '';
    list[104].f.gender = '';
    list[118].f.expiry = '2019/01/17';
    list[133].f.birthday = '1990-2-30';
    list[150].f.cardType = '年卡';
    list[166].f.cardType = '储值卡';
    list[166].f.recharge = '0';
    list[181].f.gift = '小气泡';
    return list;
  }

  function buildCardRows() {
    var seed = [
      { type: '储值卡', name: '八折银卡', price: '500.00', discount: '8.5', gift: '小气泡:1;基础护理:2', memberPrice: '理发:打折,9.9;洗吹:固定金额,50', validity: '', desc: '老顾客主推' },
      { type: '储值卡', name: '黄金卡', price: '1000.00', discount: '', gift: '', memberPrice: '', validity: '12', desc: '' },
      { type: '计次卡', name: '剪发5次卡', price: '500.00', times: '5', scope: '剪发', validity: '', desc: '' },
      { type: '计次卡', name: '头皮护理次卡', price: '680.00', times: '6', scope: '头皮护理', validity: '12', desc: '' },
      { type: '折扣卡', name: '尊享折扣卡', price: '300.00', discount: '5.5', validity: '6', desc: '' },
      { type: '折扣卡', name: '员工亲友卡', price: '0.00', discount: '8', validity: '', desc: '仅限亲友' },
      { type: '套餐卡', name: '护理套餐卡', price: '310.00', scope: '全场通用:4', validity: '3', desc: '' },
      { type: '套餐卡', name: '烫染护套餐', price: '688.00', scope: '小气泡:1;基础护理:2', validity: '6', desc: '' },
      { type: '周期卡', name: '季卡', price: '510.00', scope: '小气泡;基础护理', validity: '3', desc: '' },
      { type: '周期卡', name: '年卡', price: '1980.00', scope: '', validity: '12', desc: '' },
      { type: '储值卡', name: '体验卡', price: '100.00', discount: '', validity: '', desc: '新客体验' },
      { type: '计次卡', name: '洗吹次卡', price: '200.00', times: '10', scope: '洗吹', validity: '', desc: '' }
    ];
    var list = seed.map(function (s, i) {
      var f = {
        type: s.type, name: s.name, price: s.price, discount: s.discount || '',
        times: s.times || '', scope: s.scope || '', validity: s.validity || '',
        gift: s.gift || '', memberPrice: s.memberPrice || '', desc: s.desc || ''
      };
      return { id: 'c' + i, f: f, problems: [], ignored: false, aiFields: [] };
    });
    // 预置问题：折扣越界 / 有效期非数字 / 赠送项目格式 / 卡名重复 / 金额不可解析
    list[5].f.discount = '12';
    list[7].f.validity = '半年';
    list[9].f.gift = '小气泡';
    list[10].f.name = '八折银卡';
    list[11].f.price = '两百';
    return list;
  }

  function buildPriceRows() {
    var names = ['剪发', '洗吹', '烫发', '染发', '护理', '头皮护理', '造型设计', '接发', '眉型设计', '护发套餐', '美甲', '美睫', '修手', '去角质'];
    var groups = ['剪发', '洗吹', '烫染', '护理', '造型', '美甲'];
    var list = [];
    var i;
    for (i = 0; i < 42; i += 1) {
      list.push({
        id: 'p' + i,
        f: {
          name: names[i % names.length] + (i >= names.length ? ' · ' + (Math.floor(i / names.length) + 1) : ''),
          group: groups[i % groups.length],
          price: String(68 + i * 20) + '.00',
          bookable: '是',
          top: i % 6 === 0 ? '是' : '否',
          duration: String(30 + (i % 4) * 15),
          shopCode: ''
        },
        problems: [],
        ignored: false,
        aiFields: []
      });
    }
    // 预置问题
    list[5].f.price = '-20.00';
    list[11].f.duration = '一小时';
    list[17].f.name = '';
    list[23].f.group = '';
    list[29].f.bookable = 'maybe';
    list[35].f.price = '面议';
    return list;
  }

  function ensureCheckData() {
    if (state.checkData) return state.checkData;
    var data = {};
    if (state.importSelection.member) data.member = buildMemberRows();
    if (state.importSelection.card) data.card = buildCardRows();
    if (state.importSelection.price) data.price = buildPriceRows();
    if (!data.member && !data.card && !data.price) data.member = buildMemberRows();
    state.checkData = data;
    ['member', 'card', 'price'].forEach(function (k) { if (data[k]) recomputeCheck(k); });
    return data;
  }

  function checkCtx(cat, rows) {
    var ctx = { cardNos: {}, phones: {}, names: {}, cardNames: {} };
    CHECK_CARD_NAMES.forEach(function (n) { ctx.cardNames[n] = true; });
    checkRows('card').forEach(function (r) { if (r.f && r.f.name) ctx.cardNames[r.f.name] = true; });
    rows.forEach(function (r) {
      var f = r.f || {};
      if (cat === 'member') {
        if (f.cardNo) ctx.cardNos[f.cardNo] = (ctx.cardNos[f.cardNo] || 0) + 1;
        if (f.phone) {
          if (!ctx.phones[f.phone]) ctx.phones[f.phone] = [];
          var no = f.memberNo || '';
          if (ctx.phones[f.phone].indexOf(no) === -1) ctx.phones[f.phone].push(no);
        }
      }
      if (cat === 'card' && f.name) ctx.names[f.name] = (ctx.names[f.name] || 0) + 1;
      if (cat === 'price' && f.name) ctx.names[f.name] = (ctx.names[f.name] || 0) + 1;
    });
    return ctx;
  }

  function checkProblems(cat, row, ctx) {
    var f = row.f || {};
    var out = [];
    function add(field, level, msg) { out.push({ field: field, level: level, msg: msg }); }
    var dsl = /^[^:;]+:\d+(;\s*[^:;]+:\d+)*$/;
    var priceDsl = /^[^:;]+:(打折|固定金额),\d+(\.\d+)?(;\s*[^:;]+:(打折|固定金额),\d+(\.\d+)?)*$/;

    if (cat === 'member') {
      if (!f.memberNo) add('memberNo', 'error', '会员编号为空');
      if (!f.cardNo) add('cardNo', 'error', '会员卡号为空');
      else if (ctx.cardNos[f.cardNo] > 1) add('cardNo', 'error', '会员卡号与其他行重复');
      if (!f.name) add('name', 'error', '会员姓名为空');
      if (!f.phone) add('phone', 'error', '手机号为空');
      else if (!/^1\d{10}$/.test(f.phone)) add('phone', 'error', '手机号应为 11 位数字');
      else if (ctx.phones[f.phone] && ctx.phones[f.phone].length > 1) add('phone', 'warn', '同一手机号对应多个会员编号');
      if (!f.gender) add('gender', 'warn', '性别为空，按「女」导入');
      if (f.birthday && !/^\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2}$/.test(f.birthday)) add('birthday', 'warn', '生日格式建议 1990/2/11');
      if (!f.cardType) add('cardType', 'error', '卡类型为空');
      else if (CHECK_CARD_TYPES.indexOf(f.cardType) === -1) add('cardType', 'error', '卡类型须为储值 / 计次 / 折扣 / 套餐 / 周期卡');
      if (!f.cardName) add('cardName', 'error', '卡名称为空');
      else if (!ctx.cardNames[f.cardName]) add('cardName', 'error', '店内无此卡，改成已有卡名或忽略此行');
      var rc = parseMoney(f.recharge);
      if (f.cardType === '储值卡' && (f.recharge === '' || f.recharge === null || f.recharge === undefined)) add('recharge', 'error', '储值卡充值余额必填');
      else if (rc === null) add('recharge', 'error', '金额无法解析');
      else if (rc === 0) add('recharge', 'warn', '充值余额为 0');
      if (parseMoney(f.bonus) === null) add('bonus', 'error', '赠送余额无法解析');
      if (parseMoney(f.remain) === null) add('remain', 'error', '卡剩余价值无法解析');
      if (f.countLeft && !/^\d+$/.test(f.countLeft)) add('countLeft', 'error', '计次剩余次数应为整数');
      if (!f.channel) add('channel', 'error', '来源渠道必填');
      else if (!/^[1-9]$/.test(f.channel)) add('channel', 'warn', '来源渠道须为 1–9');
      if (f.expiry && f.expiry !== '永久' && isPastDate(f.expiry)) add('expiry', 'warn', '卡已过期');
      if (f.gift && !dsl.test(f.gift)) add('gift', 'warn', '赠送项目格式应为「项目:次数」');
      if (f.special && !priceDsl.test(f.special)) add('special', 'warn', '特殊项目格式应为「项目:打折,9.9」');
      return out;
    }

    if (cat === 'card') {
      if (!f.type) add('type', 'error', '卡类型为空');
      else if (CHECK_CARD_TYPES.indexOf(f.type) === -1) add('type', 'error', '卡类型不在 5 类之内');
      if (!f.name) add('name', 'error', '卡名为空');
      else if (ctx.names[f.name] > 1) add('name', 'warn', '本批有同名卡，导入会跳过后者');
      var pr = parseMoney(f.price);
      if (f.price !== '' && pr === null) add('price', 'error', '金额无法解析');
      if (f.type === '储值卡' && (f.price === '' || f.price === null)) add('price', 'error', '储值卡充值余额必填');
      if (f.discount !== '' && f.discount !== undefined) {
        var d = parseMoney(f.discount);
        if (d === null) add('discount', 'error', '折扣无法解析');
        else if (d <= 0 || d > 10) add('discount', 'error', '折扣须在 0–10 之间');
      }
      if (f.times && !/^\d+$/.test(f.times)) add('times', 'error', '次数应为整数');
      if (f.validity && !/^\d+$/.test(f.validity)) add('validity', 'error', '有效期限填月份数字，留空为永久');
      if (f.gift && !dsl.test(f.gift)) add('gift', 'warn', '赠送项目格式应为「项目:次数」');
      if (f.memberPrice && !priceDsl.test(f.memberPrice)) add('memberPrice', 'warn', '会员价格式应为「项目:打折,9.9」');
      return out;
    }

    // price
    if (!f.name) add('name', 'error', '项目名为空');
    else if (ctx.names[f.name] > 1) add('name', 'warn', '本批有同名项目，导入会跳过后者');
    if (f.price === '' || f.price === null || f.price === undefined) add('price', 'error', '价格为空');
    else if (parseMoney(f.price) === null) add('price', 'error', '价格无法解析');
    else if (parseMoney(f.price) < 0) add('price', 'error', '价格不能为负');
    if (!f.group) add('group', 'warn', '项目组为空，将作为自定义新增');
    if (f.duration && !/^\d+$/.test(f.duration)) add('duration', 'error', '服务时长填分钟数');
    if (f.bookable && f.bookable !== '是' && f.bookable !== '否') add('bookable', 'warn', '可开单填「是 / 否」，按「是」处理');
    if (f.top && f.top !== '是' && f.top !== '否') add('top', 'warn', '置顶填「是 / 否」，按「否」处理');
    return out;
  }

  function recomputeCheck(cat) {
    var rows = checkRows(cat);
    var ctx = checkCtx(cat, rows);
    rows.forEach(function (r) { r.problems = checkProblems(cat, r, ctx); });
  }

  function checkStats(cat) {
    var rows = checkRows(cat);
    var st = { total: rows.length, ok: 0, warn: 0, error: 0, ignored: 0, importable: 0 };
    rows.forEach(function (r) {
      if (r.ignored) { st.ignored += 1; return; }
      if (rowHasLevel(r, 'error')) st.error += 1;
      else if (rowHasLevel(r, 'warn')) st.warn += 1;
      else st.ok += 1;
    });
    st.importable = st.total - st.ignored - st.error;
    return st;
  }

  function checkAllStats() {
    var all = { total: 0, ok: 0, warn: 0, error: 0, ignored: 0, importable: 0 };
    checkCats().forEach(function (k) {
      var st = checkStats(k);
      all.total += st.total;
      all.ok += st.ok;
      all.warn += st.warn;
      all.error += st.error;
      all.ignored += st.ignored;
      all.importable += st.importable;
    });
    return all;
  }

  /* --- 概览渲染 --- */

  function checkFieldOpts(field, row) {
    if (field.dynamic === 'cards') {
      var names = CHECK_CARD_NAMES.slice();
      var cur = row.f.cardName || '';
      if (cur && names.indexOf(cur) === -1) names.unshift(cur);
      return names.map(function (n) { return { v: n, label: n }; });
    }
    return field.opts || [];
  }

  function checkFieldHtml(cat, row, field) {
    var val = row.f[field.key] === null || row.f[field.key] === undefined ? '' : row.f[field.key];
    var prob = null;
    (row.problems || []).forEach(function (p) { if (p.field === field.key && !prob) prob = p; });
    var cls = 'check-field' + (field.wide ? ' is-wide' : '') +
      (prob ? (prob.level === 'error' ? ' is-error' : ' is-warn') : '');
    var input;
    if (field.type === 'select') {
      var opts = checkFieldOpts(field, row);
      var found = opts.some(function (o) { return o.v === val; });
      input = '<select data-check-field="' + field.key + '">' +
        (val === '' ? '<option value="" selected>请选择</option>' : '') +
        (!found && val !== '' ? '<option value="' + escHtml(val) + '" selected>' + escHtml(val) + '</option>' : '') +
        opts.map(function (o) {
          return '<option value="' + escHtml(o.v) + '"' + (o.v === val ? ' selected' : '') + '>' + escHtml(o.label) + '</option>';
        }).join('') +
      '</select>';
    } else {
      var mode = field.type === 'money' ? 'decimal' : (field.type === 'number' ? 'numeric' : 'text');
      input = '<input type="text" inputmode="' + mode + '" data-check-field="' + field.key + '"' +
        ' value="' + escHtml(val) + '" placeholder="' + escHtml(field.ph || '') + '" autocomplete="off">';
    }
    return '<label class="' + cls + '">' +
      '<span class="check-field__label">' + escHtml(field.label) + (field.req ? '<i>必填</i>' : '') + '</span>' +
      input +
      (prob ? '<em class="check-field__msg">' + escHtml(prob.msg) + '</em>' : '') +
    '</label>';
  }

  function checkEditorHtml(cat, row) {
    var fields = CHECK_FIELDS[cat] || [];
    var main = fields.filter(function (f) { return !f.more; });
    var more = fields.filter(function (f) { return f.more; });
    return '<div class="check-editor">' +
      '<div class="check-editor__grid">' + main.map(function (f) { return checkFieldHtml(cat, row, f); }).join('') + '</div>' +
      (more.length
        ? '<details class="check-editor__more"><summary>更多字段（' + more.length + '）</summary>' +
          '<div class="check-editor__grid">' + more.map(function (f) { return checkFieldHtml(cat, row, f); }).join('') + '</div></details>'
        : '') +
      '<div class="check-editor__acts">' +
        '<button type="button" class="check-editor__save" data-check-save="' + row.id + '">保存</button>' +
        '<button type="button" class="check-editor__ghost" data-check-ignore="' + row.id + '">' + (row.ignored ? '取消忽略' : '忽略此行') + '</button>' +
        '<button type="button" class="check-editor__del" data-check-del="' + row.id + '">删除</button>' +
      '</div>' +
    '</div>';
  }

  function checkRowTitle(cat, row) {
    var f = row.f || {};
    if (cat === 'member') return f.name || '未填姓名';
    if (cat === 'card') return f.name || '未命名卡';
    return f.name || '未命名项目';
  }

  function checkRowSub(cat, row) {
    var f = row.f || {};
    if (cat === 'member') return [f.memberNo, f.cardNo, f.phone, f.cardName].filter(Boolean).join(' · ');
    if (cat === 'card') return [f.type, f.price ? '¥' + f.price : '', f.validity ? f.validity + ' 个月' : '永久', f.scope].filter(Boolean).join(' · ');
    return [f.group, f.price ? '¥' + f.price : '', f.duration ? f.duration + ' 分钟' : ''].filter(Boolean).join(' · ');
  }

  function checkRowTag(cat, row) {
    var f = row.f || {};
    if (cat === 'member') return f.cardType || '';
    if (cat === 'card') return f.type || '';
    return f.bookable === '否' ? '不可开单' : '可开单';
  }

  function checkRowHtml(cat, row) {
    var lvl = row.ignored ? 'ignored' : (rowHasLevel(row, 'error') ? 'error' : (rowIssues(row).length ? 'warn' : 'ok'));
    var issues = rowIssues(row);
    var issue = issues.length
      ? '<span class="check-row__issue">' + escHtml(issues[0].msg) + (issues.length > 1 ? ' 等 ' + issues.length + ' 处' : '') + '</span>'
      : '';
    var ai = (row.aiFields && row.aiFields.length) ? '<i class="check-tag is-ai">AI 推断</i>' : '';
    var tag = checkRowTag(cat, row);
    var open = state.checkOpen === row.id;
    var initial = checkRowTitle(cat, row).charAt(0) || '?';
    return '<div class="check-row is-' + lvl + (open ? ' is-open' : '') + '" id="checkRow-' + row.id + '" data-check-row="' + row.id + '">' +
      '<button type="button" class="check-row__main" data-check-open="' + row.id + '" aria-expanded="' + (open ? 'true' : 'false') + '">' +
        '<span class="check-row__avatar" aria-hidden="true">' + escHtml(initial) + '</span>' +
        '<span class="check-row__body">' +
          '<span class="check-row__line1"><b>' + escHtml(checkRowTitle(cat, row)) + '</b>' +
            (tag ? '<i class="check-tag">' + escHtml(tag) + '</i>' : '') + ai +
          '</span>' +
          '<span class="check-row__line2">' + escHtml(checkRowSub(cat, row)) + '</span>' +
          issue +
        '</span>' +
        '<span class="check-row__state">' + CHECK_LV_LABEL[lvl] + '</span>' +
      '</button>' +
      (open ? checkEditorHtml(cat, row) : '') +
    '</div>';
  }

  function checkVisibleRows() {
    var rows = checkRows(state.checkTab).slice();
    if (state.checkFilter === 'issue') {
      rows = rows.filter(function (r) { return !r.ignored && rowIssues(r).length > 0; });
    } else if (state.checkFilter === 'ignored') {
      rows = rows.filter(function (r) { return !!r.ignored; });
    }
    var q = (state.checkQuery || '').trim().toLowerCase();
    if (q) {
      rows = rows.filter(function (r) {
        var f = r.f || {};
        return [f.name, f.phone, f.cardNo, f.memberNo, f.cardName, f.group, f.type].join(' ').toLowerCase().indexOf(q) !== -1;
      });
    }
    return rows;
  }

  function checkProblemRows(cat) {
    return checkRows(cat).filter(function (r) { return !r.ignored && rowIssues(r).length > 0; });
  }

  function scrollCheckRow(id) {
    var el = document.getElementById('checkRow-' + id);
    if (el && el.scrollIntoView) el.scrollIntoView({ block: 'center' });
  }

  function renderCheckStats() {
    var cats = checkCats();
    var all = checkAllStats();
    var pct = all.total ? Math.round(all.importable / all.total * 100) : 0;

    var totalEl = $('#checkTotal');
    if (totalEl) totalEl.textContent = all.total.toLocaleString('zh-CN');
    var catsEl = $('#checkCats');
    if (catsEl) {
      catsEl.textContent = cats.length + ' 类' + (all.ignored ? ' · 已忽略 ' + all.ignored.toLocaleString('zh-CN') : '');
    }
    var okEl = $('#checkOk');
    if (okEl) okEl.textContent = all.ok.toLocaleString('zh-CN');
    var warnEl = $('#checkWarn');
    if (warnEl) warnEl.textContent = all.warn.toLocaleString('zh-CN');
    var errEl = $('#checkErr');
    if (errEl) errEl.textContent = all.error.toLocaleString('zh-CN');
    var pctEl = $('#checkDonutPct');
    if (pctEl) pctEl.textContent = pct + '%';
    var donut = $('#checkDonut');
    if (donut) donut.style.background = 'conic-gradient(#F32F41 0% ' + pct + '%, #F0E9E9 ' + pct + '% 100%)';

    var bars = $('#checkBars');
    if (bars) {
      var maxN = 1;
      cats.forEach(function (k) { maxN = Math.max(maxN, checkStats(k).total); });
      bars.innerHTML = cats.map(function (k) {
        var st = checkStats(k);
        var issues = st.error + st.warn;
        return '<button type="button" class="check-bar' + (k === state.checkTab ? ' is-on' : '') + '" data-check-tab-jump="' + k + '">' +
          '<span class="check-bar__label">' + IMPORT_CAT_SHORT[k] + '</span>' +
          '<span class="check-bar__track"><i class="is-' + k + '" style="width:' + Math.round(st.total / maxN * 100) + '%"></i></span>' +
          '<span class="check-bar__val">' + st.total.toLocaleString('zh-CN') + '</span>' +
          (issues ? '<span class="check-bar__badge">' + issues + ' 处</span>' : '<span class="check-bar__badge is-ok">✓</span>') +
        '</button>';
      }).join('');
    }

    var tabs = $('#checkTabs');
    if (tabs) {
      tabs.innerHTML = cats.map(function (k) {
        var st = checkStats(k);
        var on = k === state.checkTab;
        return '<button type="button" class="check-tab' + (on ? ' is-on' : '') + '" role="tab" aria-selected="' + (on ? 'true' : 'false') + '" data-check-tab="' + k + '">' +
          '<b>' + IMPORT_CAT_SHORT[k] + '</b>' +
          '<span>' + st.total.toLocaleString('zh-CN') + ' ' + CHECK_UNIT[k] +
            (st.error + st.warn ? '<i>' + (st.error + st.warn) + '</i>' : '') +
          '</span>' +
        '</button>';
      }).join('');
      tabs.style.gridTemplateColumns = 'repeat(' + Math.max(cats.length, 1) + ', minmax(0, 1fr))';
    }

    var chips = $('#checkChips');
    if (chips) {
      var st = checkStats(state.checkTab);
      var issueN = st.error + st.warn;
      var defs = [
        { k: 'all', label: '全部', n: st.total },
        { k: 'issue', label: '只看问题', n: issueN },
        { k: 'ignored', label: '已忽略', n: st.ignored }
      ];
      chips.innerHTML = defs.map(function (d) {
        return '<button type="button" class="check-chip' + (state.checkFilter === d.k ? ' is-on' : '') + '" data-check-filter="' + d.k + '">' +
          d.label + '<i>' + d.n + '</i></button>';
      }).join('');
    }

    var nav = $('#checkProbNav');
    var probs = checkProblemRows(state.checkTab);
    if (nav) {
      nav.classList.toggle('hidden', probs.length === 0);
      if (probs.length) {
        if (state.checkProbIdx >= probs.length) state.checkProbIdx = 0;
        var txt = $('#checkProbText');
        if (txt) txt.textContent = '第 ' + (state.checkProbIdx + 1) + ' / ' + probs.length + ' 个问题';
      }
    }
  }

  function renderCheckList() {
    var host = $('#checkList');
    if (!host) return;
    var rows = checkVisibleRows();
    var limit = state.checkFilter === 'issue' || state.checkFilter === 'ignored' ? 999 : state.checkLimit;
    var shown = rows.slice(0, limit);

    host.innerHTML = shown.map(function (r) { return checkRowHtml(state.checkTab, r); }).join('');

    var more = $('#btnCheckMore');
    if (more) {
      var rest = rows.length - shown.length;
      more.classList.toggle('hidden', rest <= 0);
      more.textContent = rest > 0 ? '加载更多（还有 ' + rest + ' 行）' : '加载更多';
    }
    var empty = $('#checkEmpty');
    if (empty) empty.classList.toggle('hidden', rows.length > 0);

    var clear = $('#btnCheckSearchClear');
    if (clear) clear.classList.toggle('hidden', !state.checkQuery);
  }

  function renderCheck() {
    ensureCheckData();
    var cats = checkCats();
    if (cats.indexOf(state.checkTab) === -1) state.checkTab = cats[0] || 'member';
    var input = $('#checkSearch');
    if (input && input.value !== state.checkQuery) input.value = state.checkQuery;
    renderCheckStats();
    renderCheckList();
  }

  function saveCheckRow(cat, id) {
    var row = checkFindRow(cat, id);
    if (!row) return;
    var wrap = document.getElementById('checkRow-' + id);
    if (wrap) {
      $all('[data-check-field]', wrap).forEach(function (el) {
        var key = el.getAttribute('data-check-field');
        row.f[key] = String(el.value || '').trim();
        if (row.aiFields && row.aiFields.length) {
          row.aiFields = row.aiFields.filter(function (k) { return k !== key; });
        }
      });
    }
    if (row.isNew) delete row.isNew;
    if (row.f.name === undefined) row.f.name = '';
    recomputeCheck(cat);
    state.checkOpen = id;
    renderCheckStats();
    renderCheckList();
    showToast('已保存，问题标记已更新');
  }

  function toggleCheckIgnore(cat, id) {
    var row = checkFindRow(cat, id);
    if (!row) return;
    row.ignored = !row.ignored;
    recomputeCheck(cat);
    state.checkOpen = id;
    renderCheckStats();
    renderCheckList();
    showToast(row.ignored ? '已忽略此行，不会计入传输' : '已恢复此行');
  }

  function deleteCheckRow(cat, id) {
    if (!state.checkData || !state.checkData[cat]) return;
    state.checkData[cat] = checkRows(cat).filter(function (r) { return r.id !== id; });
    recomputeCheck(cat);
    state.checkOpen = null;
    renderCheckStats();
    renderCheckList();
    showToast('已删除这一行');
  }

  function addCheckRow() {
    var cat = state.checkTab;
    var row = {
      id: cat + '-new-' + Date.now(),
      f: {},
      problems: [],
      ignored: false,
      isNew: true,
      aiFields: []
    };
    if (cat === 'member') {
      row.f.cardType = '储值卡';
      row.f.cardName = CHECK_CARD_NAMES[0];
      row.f.gender = '女';
      row.f.expiry = '永久';
      row.f.channel = '1';
    } else if (cat === 'card') {
      row.f.type = '储值卡';
    } else {
      row.f.bookable = '是';
      row.f.top = '否';
    }
    if (!state.checkData) state.checkData = {};
    if (!state.checkData[cat]) state.checkData[cat] = [];
    state.checkData[cat].unshift(row);
    state.checkOpen = row.id;
    state.checkFilter = 'all';
    state.checkQuery = '';
    state.checkLimit = Math.max(state.checkLimit, 24);
    recomputeCheck(cat);
    var input = $('#checkSearch');
    if (input) input.value = '';
    renderCheckStats();
    renderCheckList();
    setTimeout(function () { scrollCheckRow(row.id); }, 40);
  }

  function jumpCheckProblem(dir) {
    var cat = state.checkTab;
    var list = checkProblemRows(cat);
    if (!list.length) {
      showToast('当前类别没有待处理问题');
      return;
    }
    if (state.checkFilter !== 'issue') {
      state.checkFilter = 'issue';
      state.checkProbIdx = 0;
    }
    if (dir === 'next') state.checkProbIdx = (state.checkProbIdx + 1) % list.length;
    else if (dir === 'prev') state.checkProbIdx = (state.checkProbIdx - 1 + list.length) % list.length;
    else state.checkProbIdx = 0;
    var row = list[state.checkProbIdx];
    state.checkOpen = row.id;
    renderCheckStats();
    renderCheckList();
    setTimeout(function () { scrollCheckRow(row.id); }, 40);
  }

  /* --- 标准表转换 --- */

  function resetConvertUI() {
    var next = $('#btnConvertNext');
    if (next) { next.disabled = true; next.textContent = '转换中…'; }
    var title = $('#convertTitle');
    if (title) title.textContent = '正在把表格转成标准模板';
    var lead = $('#convertLead');
    if (lead) lead.textContent = '任意列名、多 sheet、合并单元格都能转；照片在后台转好，不单独展示。';
    var host = $('#convertResult');
    if (host) { host.innerHTML = ''; host.classList.add('hidden'); }
    var orbit = $('#convertOrbit');
    if (orbit) orbit.classList.remove('is-done');
    $all('[data-conv-step]').forEach(function (el) { el.classList.remove('is-on', 'is-done'); });
  }

  function runConversion() {
    if (state.convertRunning) return;
    if (state.convertDone) {
      renderConvertResult();
      return;
    }
    state.convertRunning = true;
    resetConvertUI();
    var steps = $all('[data-conv-step]');
    // 第一步立即点亮，避免开场 0.4s 四步全灭的空档
    if (steps[0]) steps[0].classList.add('is-on');
    var timers = [];
    [420, 960, 1500, 2020].forEach(function (ms, i) {
      timers.push(setTimeout(function () {
        steps.forEach(function (el, j) {
          el.classList.toggle('is-on', j === i);
          el.classList.toggle('is-done', j < i);
        });
      }, ms));
    });
    timers.push(setTimeout(function () {
      state.convertRunning = false;
      state.convertDone = true;
      state.convertTimers = [];
      steps.forEach(function (el) { el.classList.remove('is-on'); el.classList.add('is-done'); });
      var orbit = $('#convertOrbit');
      if (orbit) orbit.classList.add('is-done');
      var title = $('#convertTitle');
      if (title) title.textContent = '已转成官方标准模板';
      var lead = $('#convertLead');
      if (lead) lead.textContent = '原表不改；未识别的字段已标成「待补充 / 建议确认」，进概览逐行核对。';
      ensureCheckData();
      renderConvertResult();
      var all = checkAllStats();
      var next = $('#btnConvertNext');
      if (next) {
        next.disabled = false;
        next.textContent = all.importable ? '去核对 ' + all.importable.toLocaleString('zh-CN') + ' 行' : '去核对数据';
      }
    }, 2480));
    state.convertTimers = timers;
  }

  function renderConvertResult() {
    var host = $('#convertResult');
    if (!host) return;
    var cats = checkCats();
    var cards = cats.map(function (k) {
      var st = checkStats(k);
      var issues = st.error + st.warn;
      var cls = st.error ? 'is-warn' : (st.warn ? 'is-warn' : 'is-ok');
      var pill = st.error ? (st.error + ' 行需修正') : (st.warn ? (st.warn + ' 行建议确认') : '已对齐标准模板');
      var okPct = st.total ? Math.round((st.total - st.error - st.ignored) / st.total * 100) : 100;
      return '<div class="conv-card ' + cls + '">' +
        '<div class="conv-card__head">' +
          '<span class="conv-card__ico" aria-hidden="true">' + (CAT_ICO[k] || '') + '</span>' +
          '<span class="conv-card__name">' + IMPORT_CAT[k] + '</span>' +
          '<span class="conv-card__pill ' + cls + '">' + pill + '</span>' +
        '</div>' +
        '<p class="conv-card__meta">' + st.total.toLocaleString('zh-CN') + ' ' + CHECK_UNIT[k] + ' · 已按官方模板对齐 · ' +
          (issues ? '进概览可逐行改' : '无需处理') + '</p>' +
        '<div class="conv-card__bar"><i style="width:' + okPct + '%"></i></div>' +
      '</div>';
    }).join('');

    var photoCats = collectPlan().photo;
    var photoNote = photoCats.length
      ? '<p class="conv-photo-note">拍照 ' + photoCats.reduce(function (s, k) { return s + state.importPhotos[k].length; }, 0) +
        ' 张已在后台转成标准表，转换过程不在页面展开。</p>'
      : '';

    host.innerHTML = cards + photoNote +
      '<div class="conv-fallback">' +
        '<div class="conv-fallback__title"><b>转换不完整？数据不会丢</b><span>兜底</span></div>' +
        '<p>AI 尽力转，个别列或整表识别不了时：</p>' +
        '<div class="conv-fallback__acts">' +
          '<button type="button" data-conv-act="tpl"><b>下载标准模板</b><span>按模板重填后重传</span></button>' +
          '<button type="button" data-conv-act="reupload"><b>重新上传</b><span>换个文件再转一次</span></button>' +
          '<button type="button" data-conv-act="manual"><b>提交人工代导</b><span>运营代整理（演示占位）</span></button>' +
        '</div>' +
        '<p class="conv-fallback__note">也可以直接在数据概览里逐格改，或把整行忽略。</p>' +
      '</div>';
    host.classList.remove('hidden');
  }

  /* --- 仪式感：校验 → 封存 → 传输 --- */

  function ceremonyDateFormat() {
    var d = new Date();
    return String(d.getFullYear()) + padNum(d.getMonth() + 1, 2) + padNum(d.getDate(), 2);
  }

  function hideCeremony() {
    var box = $('#ceremony');
    if (box) {
      box.classList.add('hidden');
      box.setAttribute('aria-hidden', 'true');
    }
    state.ceremonyRunning = false;
  }

  function openCheckCeremony() {
    if (state.ceremonyRunning) return;
    if (!state.checkData) ensureCheckData();
    var blocking = [];
    checkCats().forEach(function (cat) {
      checkRows(cat).forEach(function (r) {
        if (!r.ignored && rowHasLevel(r, 'error')) blocking.push({ cat: cat, row: r });
      });
    });
    if (blocking.length) {
      var b = blocking[0];
      state.checkTab = b.cat;
      state.checkFilter = 'issue';
      state.checkProbIdx = 0;
      state.checkOpen = b.row.id;
      renderCheckStats();
      renderCheckList();
      setTimeout(function () { scrollCheckRow(b.row.id); }, 40);
      showToast('还有 ' + blocking.length + ' 行需修正，已跳到第一处');
      return;
    }

    var counts = {};
    var total = 0;
    checkCats().forEach(function (k) {
      var n = checkStats(k).importable;
      counts[k] = n;
      total += n;
    });
    if (!total) {
      showToast('没有可传输的数据');
      return;
    }

    state.ceremonyRunning = true;
    state.ceremonyCounts = counts;
    state.ceremonyCode = 'RTB-' + ceremonyDateFormat() + '-' + padNum(Math.floor(Math.random() * 9000) + 1000, 4);

    var box = $('#ceremony');
    if (!box) return;
    box.classList.remove('hidden');
    box.setAttribute('aria-hidden', 'false');
    var done = $('#ceremonyDone');
    if (done) done.classList.add('hidden');
    var seal = $('#ceremonySeal');
    if (seal) seal.classList.remove('is-on', 'is-done');
    var title = $('#ceremonyTitle');
    if (title) title.textContent = '正在校验本批数据';
    var eyebrow = $('#ceremonyEyebrow');
    if (eyebrow) eyebrow.textContent = '确认传输';

    $all('[data-cer-step]').forEach(function (el) { el.classList.remove('is-on', 'is-done'); });
    var lis = $all('[data-cer-step]');
    var labels = [
      { t: '正在逐行校验', s: '必填 / 格式 / 卡名称' },
      { t: '校验通过，正在封存', s: '生成本次传输编号' },
      { t: '封存完成，正在写入本店', s: '会员 / 卡模板 / 价目' }
    ];
    var timers = [];
    [0, 780, 1560].forEach(function (ms, i) {
      timers.push(setTimeout(function () {
        lis.forEach(function (el, j) {
          el.classList.toggle('is-on', j === i);
          el.classList.toggle('is-done', j < i);
        });
        if (title) title.textContent = labels[i].t;
        if (seal) seal.classList.toggle('is-on', i === 1);
      }, ms));
    });

    timers.push(setTimeout(function () {
      lis.forEach(function (el) { el.classList.remove('is-on'); el.classList.add('is-done'); });
      var sealEl = $('#ceremonySeal');
      if (sealEl) sealEl.classList.add('is-done');
      var eyebrowEl = $('#ceremonyEyebrow');
      if (eyebrowEl) eyebrowEl.textContent = '已封存';
      var titleEl = $('#ceremonyTitle');
      if (titleEl) titleEl.textContent = '本批已封存';
      var doneEl = $('#ceremonyDone');
      if (doneEl) doneEl.classList.remove('hidden');
      var dt = $('#ceremonyDoneTitle');
      if (dt) dt.textContent = '已封存并传输 ' + total.toLocaleString('zh-CN') + ' 条';
      var ds = $('#ceremonyDoneSub');
      if (ds) {
        ds.textContent = checkCats().map(function (k) {
          return IMPORT_CAT_SHORT[k] + ' ' + counts[k].toLocaleString('zh-CN');
        }).join(' · ');
      }
      var code = $('#ceremonyCode');
      if (code) code.textContent = state.ceremonyCode;
      state.pendingStockApply = true;
    }, 2380));
    state.ceremonyTimers = timers;
  }

  /* --- 微信「文件传输助手」引导 --- */

  function wechatTipMuted() {
    try { return localStorage.getItem('rtb_wechat_tip_muted') === '1'; } catch (e) { return false; }
  }

  function showWechatTip() {
    var mask = $('#wechatTipMask');
    var tip = $('#wechatTip');
    if (!mask || !tip) return;
    mask.classList.add('show');
    tip.classList.add('show');
    tip.setAttribute('aria-hidden', 'false');
    mask.setAttribute('aria-hidden', 'false');
  }

  function hideWechatTip() {
    var mask = $('#wechatTipMask');
    var tip = $('#wechatTip');
    if (mask) mask.classList.remove('show');
    if (tip) {
      tip.classList.remove('show');
      tip.setAttribute('aria-hidden', 'true');
    }
  }

  function maybeShowWechatTip() {
    if (state.wechatTipShown) return;
    state.wechatTipShown = true;
    if (document.documentElement.classList.contains('capture-mode')) return;
    if (wechatTipMuted()) return;
    setTimeout(showWechatTip, 360);
  }

  function openTplSheet() {
    var mask = $('#tplMask');
    var sheet = $('#tplSheet');
    if (mask) mask.classList.add('show');
    if (sheet) sheet.classList.add('show');
  }

  function hideTplSheet() {
    var mask = $('#tplMask');
    var sheet = $('#tplSheet');
    if (mask) mask.classList.remove('show');
    if (sheet) sheet.classList.remove('show');
  }

  function openCheckHelp() {
    var mask = $('#checkHelpMask');
    var sheet = $('#checkHelpSheet');
    if (mask) mask.classList.add('show');
    if (sheet) sheet.classList.add('show');
  }

  function hideCheckHelp() {
    var mask = $('#checkHelpMask');
    var sheet = $('#checkHelpSheet');
    if (mask) mask.classList.remove('show');
    if (sheet) sheet.classList.remove('show');
  }

  function batchCount(k) {
    if (state.checkData && checkRows(k).length) return checkStats(k).importable;
    return BATCH_DEMO[k];
  }

  /* ===== 历史订单（只读旁路） ===== */

  function fmtMoney(n) {
    return '¥' + Number(n || 0).toLocaleString('zh-CN');
  }

  function historyRows() {
    return state.historyDeleted ? [] : HISTORY_ROWS;
  }

  function historyMatches(row) {
    var q = state.historyQuery;
    if (q.from && row.date < q.from) return false;
    if (q.to && row.date > q.to) return false;
    if (q.min !== '' && Number(row.amount) < Number(q.min)) return false;
    if (q.max !== '' && Number(row.amount) > Number(q.max)) return false;
    if (q.name && String(row.name || '').indexOf(q.name) === -1) return false;
    return true;
  }

  function renderHistoryOrders() {
    var list = $('#historyList');
    var empty = $('#historyEmpty');
    var summary = $('#historySummary');
    if (!list) return;
    var rows = historyRows().filter(historyMatches);
    var total = rows.reduce(function (s, r) { return s + Number(r.amount || 0); }, 0);
    if (summary) summary.textContent = '共 ' + rows.length + ' 条 · 合计 ' + fmtMoney(total);
    if (!rows.length) {
      list.innerHTML = '';
      if (empty) empty.classList.remove('hidden');
      return;
    }
    if (empty) empty.classList.add('hidden');
    list.innerHTML = rows.map(function (r) {
      return '<button type="button" class="history-item" data-history-id="' + r.id + '">' +
        '<span class="history-item__main">' +
          '<span class="history-item__name">' + (r.name || '未留姓名') + '</span>' +
          '<span class="history-item__meta">' + r.date + ' · ' + (r.raw['项目'] || '') + '</span>' +
        '</span>' +
        '<span class="history-item__amount">' + fmtMoney(r.amount) + '</span>' +
      '</button>';
    }).join('');
  }

  function renderHistoryDetail() {
    var body = $('#historyDetailBody');
    if (!body) return;
    var row = null;
    HISTORY_ROWS.forEach(function (r) { if (r.id === state.historySelectedId) row = r; });
    if (!row) {
      body.innerHTML = '<p class="history-empty__hint">记录不存在</p>';
      return;
    }
    var rawKeys = Object.keys(row.raw);
    body.innerHTML =
      '<div class="history-detail-card">' +
        '<div class="history-detail-card__amount">' + fmtMoney(row.amount) + '</div>' +
        '<div class="history-detail-card__when">' + row.date + '</div>' +
        '<div class="history-detail-card__who">' + (row.name || '未留姓名') + '</div>' +
      '</div>' +
      '<div class="history-detail-sec">' +
        '<div class="history-detail-sec__title">已识别</div>' +
        '<dl class="history-detail-dl">' +
          '<dt>消费日期</dt><dd>' + row.date + '</dd>' +
          '<dt>金额</dt><dd>' + fmtMoney(row.amount) + '</dd>' +
          '<dt>顾客姓名</dt><dd>' + (row.name || '—') + '</dd>' +
        '</dl>' +
      '</div>' +
      '<div class="history-detail-sec">' +
        '<div class="history-detail-sec__title">原始字段</div>' +
        '<dl class="history-detail-dl">' +
          rawKeys.map(function (k) {
            return '<dt>' + k + '</dt><dd>' + (row.raw[k] || '—') + '</dd>';
          }).join('') +
        '</dl>' +
      '</div>' +
      '<p class="history-foot-note">只读：历史订单不参与开单、业绩与会员余额计算</p>';
  }

  function openHistoryFilter() {
    var q = state.historyQuery;
    if ($('#historyFrom')) $('#historyFrom').value = q.from;
    if ($('#historyTo')) $('#historyTo').value = q.to;
    if ($('#historyMin')) $('#historyMin').value = q.min;
    if ($('#historyMax')) $('#historyMax').value = q.max;
    if ($('#historyFilterMask')) $('#historyFilterMask').classList.add('show');
    if ($('#historyFilterSheet')) $('#historyFilterSheet').classList.add('show');
  }

  function closeHistoryFilter() {
    if ($('#historyFilterMask')) $('#historyFilterMask').classList.remove('show');
    if ($('#historyFilterSheet')) $('#historyFilterSheet').classList.remove('show');
  }

  function applyHistoryFilter() {
    var q = state.historyQuery;
    q.from = ($('#historyFrom') || {}).value || '';
    q.to = ($('#historyTo') || {}).value || '';
    q.min = ($('#historyMin') || {}).value || '';
    q.max = ($('#historyMax') || {}).value || '';
    closeHistoryFilter();
    renderHistoryOrders();
  }

  function renderHistoryMap() {
    var pairs = [['#historyMapDate', 'date'], ['#historyMapAmount', 'amount'], ['#historyMapName', 'name']];
    pairs.forEach(function (pair) {
      var sel = $(pair[0]);
      if (!sel) return;
      var key = pair[1];
      var opts = HISTORY_COLUMNS.slice();
      var cur = state.historyMap[key];
      var html = '';
      if (key === 'name') {
        html += '<option value=""' + (cur === '' ? ' selected' : '') + '>（不指定）</option>';
      }
      html += opts.map(function (c) {
        return '<option value="' + c + '"' + (c === cur ? ' selected' : '') + '>' + c + '</option>';
      }).join('');
      sel.innerHTML = html;
    });
  }

  function renderHistoryPreview() {
    var list = $('#historyPreviewList');
    var lead = $('#historyPreviewLead');
    if (!list) return;
    var rows = HISTORY_ROWS;
    var total = rows.reduce(function (s, r) { return s + Number(r.amount || 0); }, 0);
    var dates = rows.map(function (r) { return r.date; }).sort();
    if (lead) {
      lead.textContent = '共 ' + rows.length + ' 条 · ' + dates[0] + ' ~ ' + dates[dates.length - 1] + ' · 合计 ' + fmtMoney(total);
    }
    list.innerHTML = rows.slice(0, 5).map(function (r) {
      return '<div class="history-preview-row">' +
        '<span class="history-preview-row__name">' + (r.name || '未留姓名') + '</span>' +
        '<span class="history-preview-row__meta">' + r.date + '</span>' +
        '<span class="history-preview-row__amount">' + fmtMoney(r.amount) + '</span>' +
      '</div>';
    }).join('');
    var warn = $('#historyPreviewWarn');
    if (warn) warn.classList.toggle('hidden', !HISTORY_FAIL_ROWS.length);
    var cnt = $('#historyPreviewFailCount');
    if (cnt) cnt.textContent = HISTORY_FAIL_ROWS.length;
    // 进入本页时复位导入态（上次进度被中途跳转打断时不会留下禁用按钮）
    state.historyImporting = false;
    var hConfirm = $('#btnHistoryPreviewConfirm');
    if (hConfirm) hConfirm.disabled = false;
  }

  function renderHistoryResult() {
    var batchN = HISTORY_ROWS.length;
    var total = state.historyDeleted ? 0 : (state.storeStock.history || batchN);
    var count = $('#historyResultCount');
    if (count) count.textContent = total;
    var failCount = $('#historyFailCount');
    if (failCount) failCount.textContent = HISTORY_FAIL_ROWS.length;
    var lead = $('#historyResultLead');
    if (lead) {
      if (state.historyDeleted) {
        lead.textContent = '本批历史消费已删除，可重新导入。';
      } else if (state.historyReimportIntent === 'append' && total > batchN) {
        lead.textContent = '已追加 ' + batchN + ' 条，合计现有 ' + total + ' 条。可在「工作台 · 店铺管理 · 历史订单」查看。';
      } else {
        lead.textContent = '历史订单已入库，可在「工作台 · 店铺管理 · 历史订单」查看。';
      }
    }
    var del = $('#btnHistoryDeleteBatch');
    if (del) del.classList.toggle('hidden', state.historyDeleted);
    var delCount = $('#historyDelCount');
    if (delCount) delCount.textContent = total || batchN;
  }

  function renderHistoryFail() {
    var list = $('#historyFailList');
    var cnt = $('#historyFailScreenCount');
    if (cnt) cnt.textContent = HISTORY_FAIL_ROWS.length;
    if (!list) return;
    list.innerHTML = HISTORY_FAIL_ROWS.map(function (f) {
      return '<div class="import-fail-item">' +
        '<div class="import-fail-item__row"><strong>第 ' + f.line + ' 行</strong>' +
        '<span class="import-fail-item__reason">' + f.reason + '</span></div>' +
        '<p class="import-fail-item__meta">' + f.raw + '</p>' +
      '</div>';
    }).join('');
  }

  function bindHistory() {
    var search = $('#historySearch');
    if (search) {
      search.addEventListener('input', function () {
        state.historyQuery.name = search.value.trim();
        renderHistoryOrders();
      });
    }

    var filterBtn = $('#btnHistoryFilter');
    if (filterBtn) filterBtn.addEventListener('click', openHistoryFilter);

    var filterMask = $('#historyFilterMask');
    if (filterMask) filterMask.addEventListener('click', closeHistoryFilter);

    var apply = $('#btnHistoryFilterApply');
    if (apply) apply.addEventListener('click', applyHistoryFilter);

    var reset = $('#btnHistoryFilterReset');
    if (reset) {
      reset.addEventListener('click', function () {
        state.historyQuery.from = '';
        state.historyQuery.to = '';
        state.historyQuery.min = '';
        state.historyQuery.max = '';
        if ($('#historyFrom')) $('#historyFrom').value = '';
        if ($('#historyTo')) $('#historyTo').value = '';
        if ($('#historyMin')) $('#historyMin').value = '';
        if ($('#historyMax')) $('#historyMax').value = '';
        renderHistoryOrders();
      });
    }

    var list = $('#historyList');
    if (list) {
      list.addEventListener('click', function (e) {
        var item = e.target.closest('[data-history-id]');
        if (!item) return;
        state.historySelectedId = item.getAttribute('data-history-id');
        go('history-detail');
      });
    }

    var start = $('#btnHistoryImportStart');
    if (start) start.addEventListener('click', function () { go('history-import-upload'); });

    var pick = $('#btnHistoryPickFile');
    if (pick) {
      pick.addEventListener('click', function () {
        showToast('已选择 历史消费 2023-2025.xlsx（演示）');
        go('history-import-map');
      });
    }

    [['#historyMapDate', 'date'], ['#historyMapAmount', 'amount'], ['#historyMapName', 'name']].forEach(function (pair) {
      var sel = $(pair[0]);
      if (!sel) return;
      sel.addEventListener('change', function () {
        state.historyMap[pair[1]] = sel.value;
      });
    });

    var mapNext = $('#btnHistoryMapNext');
    if (mapNext) {
      mapNext.addEventListener('click', function () {
        if (!state.historyMap.date || !state.historyMap.amount) {
          showToast('请先指定日期与金额');
          return;
        }
        go('history-import-preview');
      });
    }

    var confirm = $('#btnHistoryPreviewConfirm');
    if (confirm) {
      confirm.addEventListener('click', function () {
        if (state.historyImporting) return;
        state.historyImporting = true;
        confirm.disabled = true;
        runImportProgress({
          title: '正在导入历史消费',
          sub: '整行原样写入历史订单，只识别日期 / 金额 / 顾客姓名',
          stages: [
            { at: 0, label: '读取表格' },
            { at: 34, label: '识别日期 / 金额 / 顾客姓名' },
            { at: 72, label: '写入历史订单' }
          ],
          duration: 2000,
          doneLabel: '导入完成',
          onDone: function () {
            confirm.disabled = false;
            state.historyImporting = false;
            state.historyDeleted = false;
            state.historyImported = true;
            var batchN = HISTORY_ROWS.length;
            if (state.historyReimportIntent === 'append' && state.storeStock.history > 0) {
              state.storeStock.history += batchN;
            } else {
              state.storeStock.history = batchN;
            }
            go('history-import-result');
          }
        });
      });
    }

    var failRow = $('#btnHistoryFailRow');
    if (failRow) failRow.addEventListener('click', function () { go('history-import-fail'); });

    var failDl = $('#btnHistoryFailDownload');
    if (failDl) {
      failDl.addEventListener('click', function () {
        showToast('已生成 失败行.xls（演示）');
      });
    }

    function closeHistoryDel() {
      if ($('#historyDelMask')) $('#historyDelMask').classList.remove('show');
      if ($('#historyDelDialog')) $('#historyDelDialog').classList.remove('show');
    }

    var delBtn = $('#btnHistoryDeleteBatch');
    if (delBtn) {
      delBtn.addEventListener('click', function () {
        if ($('#historyDelMask')) $('#historyDelMask').classList.add('show');
        if ($('#historyDelDialog')) $('#historyDelDialog').classList.add('show');
      });
    }

    var delCancel = $('#btnHistoryDelCancel');
    if (delCancel) delCancel.addEventListener('click', closeHistoryDel);
    var delMask = $('#historyDelMask');
    if (delMask) delMask.addEventListener('click', closeHistoryDel);

    var delConfirm = $('#btnHistoryDelConfirm');
    if (delConfirm) {
      delConfirm.addEventListener('click', function () {
        closeHistoryDel();
        state.historyDeleted = true;
        state.storeStock.history = 0;
        state.historyImported = false;
        renderHistoryResult();
        showToast('已删除本批历史消费');
        if (state.historyReimportIntent === 'replace') {
          state.historyReimportIntent = 'append';
          go('history-import-intro');
        }
      });
    }

    function wireHistoryImportEntry(el) {
      if (!el) return;
      el.addEventListener('click', function () {
        enterHistoryImport();
      });
    }
    wireHistoryImportEntry($('#btnHistoryOrdersImport'));
    wireHistoryImportEntry($('#btnHistoryEmptyImport'));

    var hrAppend = $('#btnHistoryReimportAppend');
    if (hrAppend) {
      hrAppend.addEventListener('click', function () {
        state.historyReimportIntent = 'append';
        hideHistoryReimportSheet();
        go('history-import-intro');
      });
    }
    var hrReplace = $('#btnHistoryReimportReplace');
    if (hrReplace) {
      hrReplace.addEventListener('click', function () {
        state.historyReimportIntent = 'replace';
        hideHistoryReimportSheet();
        if ($('#historyDelMask')) $('#historyDelMask').classList.add('show');
        if ($('#historyDelDialog')) $('#historyDelDialog').classList.add('show');
      });
    }
    var hrCancel = $('#btnHistoryReimportCancel');
    if (hrCancel) hrCancel.addEventListener('click', hideHistoryReimportSheet);
    var hrMask = $('#historyReimportMask');
    if (hrMask) hrMask.addEventListener('click', hideHistoryReimportSheet);
  }

  function bindImport() {
    var guideNext = $('#btnImportGuideNext');
    if (guideNext) {
      guideNext.addEventListener('click', function () {
        go('import-select');
      });
    }

    var selectBack = $('#btnImportSelectBack');
    if (selectBack) {
      selectBack.addEventListener('click', function () {
        if (hasP0Stock()) go('import-overview');
        else go('import-guide');
      });
    }

    var overviewContinue = $('#btnOverviewContinue');
    if (overviewContinue) {
      overviewContinue.addEventListener('click', function () {
        // 进入再导前清空上次模式，强制重新二选一
        state.reimportMode = { member: null, card: null, price: null };
        go('import-select');
      });
    }
    var overviewDelete = $('#btnOverviewDelete');
    if (overviewDelete) {
      overviewDelete.addEventListener('click', function () {
        showDelBatchDialog();
      });
    }
    $all('[data-overview-view]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var type = btn.getAttribute('data-overview-view');
        state.viewReturn = 'import-overview';
        if (type === 'member') go('members');
        else if (type === 'card') go('card-list');
        else if (type === 'price') go('price-list');
      });
    });

    var reimportList = $('#reimportModeList');
    if (reimportList) {
      reimportList.addEventListener('click', function (e) {
        var opt = e.target.closest('[data-reimport-mode]');
        if (!opt) return;
        var cat = opt.getAttribute('data-reimport-for');
        var mode = opt.getAttribute('data-reimport-mode');
        state.reimportMode[cat] = mode;
        openReimportModeSheet();
      });
    }
    var reimportOk = $('#btnReimportModeOk');
    if (reimportOk) {
      reimportOk.addEventListener('click', function () {
        if (catsNeedingReimportMode().length) {
          showToast('请为每一类选择合并或清空');
          return;
        }
        hideReimportModeSheet();
        renderImportSelect();
        proceedSelectNext();
      });
    }
    var reimportCancel = $('#btnReimportModeCancel');
    if (reimportCancel) reimportCancel.addEventListener('click', hideReimportModeSheet);
    var reimportMask = $('#reimportModeMask');
    if (reimportMask) reimportMask.addEventListener('click', hideReimportModeSheet);

    var selectScreen = $('#screen-import-select');
    if (selectScreen) {
      selectScreen.addEventListener('click', function (e) {
        var check = e.target.closest('[data-import-check]');
        if (check) {
          var key = check.getAttribute('data-import-check');
          var turningOn = !state.importSelection[key];
          if (key === 'price' && !turningOn && state.importSelection.card) {
            // 价目表是卡模板的前置，锁定期间不能单独取消
            showToast('价目表与「会员卡模板」绑定，取消卡模板后才能取消价目表');
            return;
          }
          state.importSelection[key] = turningOn;
          if (key === 'card' && turningOn) {
            state.importSelection.price = true;
            showToast('已连带勾选价目表：卡模板的项目权益与会员价要按价目表校验');
          }
          renderImportSelect();
          return;
        }
        var srcBtn = e.target.closest('[data-src-for]');
        if (srcBtn) {
          pickImportSource(srcBtn.getAttribute('data-src-for'), srcBtn.getAttribute('data-src'));
          return;
        }
        var del = e.target.closest('[data-clear-file]');
        if (del) {
          var k = del.getAttribute('data-clear-file');
          removeFile(k, del.getAttribute('data-file-idx'));
          renderImportSelect();
          renderQueue();
          showToast('已移除「' + IMPORT_CAT[k] + '」的 Excel');
          return;
        }
        var shotDel = e.target.closest('[data-shot-del]');
        if (shotDel) {
          deleteShot(shotDel.getAttribute('data-shot-del'), shotDel.getAttribute('data-shot-cat'));
        }
      });
    }

    var nextSelect = $('#btnImportSelectNext');
    if (nextSelect) {
      nextSelect.addEventListener('click', handleSelectNext);
    }

    var uploadScreen = $('#screen-import-source');
    if (uploadScreen) {
      uploadScreen.addEventListener('click', function (e) {
        var pick = e.target.closest('[data-pick-for]');
        if (pick) {
          pickFileFor(pick.getAttribute('data-pick-for'));
          return;
        }
        var step = e.target.closest('[data-up-step]');
        if (step) {
          var sk = step.getAttribute('data-up-step');
          var cats = uploadCats();
          var idx = cats.indexOf(sk);
          if (idx > -1) {
            state.uploadStep = idx;
            state.uploadHi = sk;
            renderUploadList();
          }
          return;
        }
        var del = e.target.closest('[data-clear-file]');
        if (del) {
          var k = del.getAttribute('data-clear-file');
          removeFile(k, del.getAttribute('data-file-idx'));
          renderUploadList();
          renderImportSelect();
          renderQueue();
        }
      });
    }

    var uploadDone = $('#btnImportUploadDone');
    if (uploadDone) {
      uploadDone.addEventListener('click', function () {
        var cats = uploadCats();
        if (!cats.length) {
          go('import-select');
          return;
        }
        var cur = cats[state.uploadStep] || cats[0];
        if (!hasFiles(cur)) {
          showToast('「' + IMPORT_CAT[cur] + '」还没选择文件');
          return;
        }
        var next = -1;
        for (var i = state.uploadStep + 1; i < cats.length; i++) {
          if (!hasFiles(cats[i])) { next = i; break; }
        }
        if (next > -1) {
          state.uploadStep = next;
          state.uploadHi = cats[next];
          renderUploadList();
          renderImportSelect();
          return;
        }
        state.uploadFocus = null;
        state.uploadHi = null;
        var noSrc = selectedCats().filter(function (k) { return !state.importSources[k]; });
        if (noSrc.length) {
          showToast('还有「' + noSrc.map(function (k) { return IMPORT_CAT[k]; }).join('、') + '」未选来源');
          go('import-select');
          return;
        }
        go('import-queue');
      });
    }

    var hdrToggle = $('#btnHdrToggle');
    if (hdrToggle) {
      hdrToggle.addEventListener('click', function () {
        state.hdrOpen = !state.hdrOpen;
        renderHdrCard(state.hdrCats);
      });
    }

    var srcOk = $('#btnSrcDialogOk');
    if (srcOk) {
      srcOk.addEventListener('click', function () {
        var d = state.srcDialog;
        if (!d) { closeSrcDialog(); return; }
        closeSrcDialog();
        confirmSourceSwitch(d.key, d.src);
        goSourceStep(d.key, d.src);
      });
    }

    var srcCancel = $('#btnSrcDialogCancel');
    if (srcCancel) srcCancel.addEventListener('click', closeSrcDialog);

    var srcMask = $('#srcDialogMask');
    if (srcMask) {
      srcMask.addEventListener('click', function (e) {
        if (e.target === srcMask) closeSrcDialog();
      });
    }

    var shutter = $('#btnImportCameraShutter');
    if (shutter) {
      shutter.addEventListener('click', captureShot);
    }

    var camDone = $('#btnCameraDone');
    if (camDone) {
      camDone.addEventListener('click', function () {
        var cat = state.importCameraCat || 'price';
        if (!state.importPhotos[cat].length) {
          showToast('还没有拍摄照片');
          return;
        }
        go(state.importCameraReturn);
      });
    }

    var camBack = $('#btnCameraBack');
    if (camBack) {
      camBack.addEventListener('click', function () {
        go(state.importCameraReturn);
      });
    }

    var camAlbum = $('#btnCameraAlbum');
    if (camAlbum) {
      camAlbum.addEventListener('click', function () {
        showToast('从相册选择（演示占位）');
      });
    }

    var camScreen = $('#screen-import-camera');
    if (camScreen) {
      camScreen.addEventListener('click', function (e) {
        var del = e.target.closest('[data-shot-del]');
        if (del) deleteShot(del.getAttribute('data-shot-del'), del.getAttribute('data-shot-cat'));
      });
    }

    var queueScreen = $('#screen-import-queue');
    if (queueScreen) {
      queueScreen.addEventListener('click', function (e) {
        var start = e.target.closest('#btnQueueStart');
        if (start) {
          startRecognition();
          return;
        }
        var change = e.target.closest('[data-queue-file-change]');
        if (change) {
          state.uploadFocus = change.getAttribute('data-queue-file-change');
          go('import-source');
          return;
        }
        var delFile = e.target.closest('[data-clear-file]');
        if (delFile) {
          var k = delFile.getAttribute('data-clear-file');
          removeFile(k, delFile.getAttribute('data-file-idx'));
          renderQueue();
          renderImportSelect();
          return;
        }
        var recam = e.target.closest('[data-queue-recam]');
        if (recam) {
          openCamera(recam.getAttribute('data-queue-recam'), 'import-queue');
          return;
        }
        var shotDel = e.target.closest('[data-shot-del]');
        if (shotDel) deleteShot(shotDel.getAttribute('data-shot-del'), shotDel.getAttribute('data-shot-cat'));
      });
    }

    var mapBack = $('#btnImportMapBack');
    if (mapBack) {
      mapBack.addEventListener('click', function () {
        setImportReturnedFromPreview(false);
        go('import-queue');
      });
    }

    var mapTabs = $('#importMapTabs');
    if (mapTabs) {
      mapTabs.addEventListener('click', function (e) {
        var tab = e.target.closest('[data-map-tab]');
        if (tab) switchMapTab(tab.getAttribute('data-map-tab'));
      });
    }

    bindTplGen();

    var ackInput = $('#importMapAckInput');
    if (ackInput) {
      ackInput.addEventListener('change', function () {
        setImportMapAck(ackInput.checked);
        if (ackInput.checked) setImportReturnedFromPreview(false);
      });
    }

    var preview = $('#btnImportMapPreview');
    if (preview) {
      preview.addEventListener('click', function () {
        if (!allMapAcked()) {
          if (!jumpToUnacked()) showToast('请先确认每一类 Excel 的映射关系');
          return;
        }
        if (hasInvalidCustomMap()) {
          showToast('未识别的自定义字段已按跳过处理');
        }
        setImportReturnedFromPreview(false);
        if (needTplGen()) {
          go('import-tpl-gen');
        } else {
          go('import-preview');
        }
      });
    }

    var previewConfirm = $('#btnImportPreviewConfirm');
    if (previewConfirm) {
      previewConfirm.addEventListener('click', function () {
        if (state.importing) return;
        setImportLoading(true);
        var plan = collectPlan();
        var names = plan.excel.concat(plan.photo).map(function (k) { return IMPORT_CAT_SHORT[k]; });
        runImportProgress({
          title: '正在导入',
          sub: names.length ? names.join(' · ') + '，导入完成前请不要关闭页面' : '正在写入本店数据',
          stages: [
            { at: 0, label: '校验数据' },
            { at: 26, label: '写入会员与持卡信息' },
            { at: 56, label: '写入卡模板与价目表' },
            { at: 84, label: '处理失败行' }
          ],
          duration: 2100,
          doneLabel: '导入完成',
          onDone: function () {
            setImportLoading(false);
            state.pendingStockApply = true;
            var screen = $('#screen-import-preview');
            if (screen && screen.classList.contains('active')) go('import-result');
          }
        });
      });
    }

    var previewBack = $('#btnImportPreviewBack');
    if (previewBack) {
      previewBack.addEventListener('click', function () {
        if (!mapExcelCats().length) {
          go('import-queue');
          return;
        }
        unlockImportMap();
        state.importMapSkipResetAck = true;
        setImportReturnedFromPreview(true);
        go('import-map');
      });
    }

    var previewTopBack = $('#btnImportPreviewTopBack');
    if (previewTopBack) {
      previewTopBack.addEventListener('click', function () {
        go(mapExcelCats().length ? 'import-map' : 'import-queue');
      });
    }

    var history = $('#btnImportHistory');
    if (history) {
      history.addEventListener('click', function () {
        go('history-import-intro');
      });
    }

    var backHome = $('#btnImportBackHome');
    if (backHome) {
      backHome.addEventListener('click', function () {
        go('home');
      });
    }

    $all('[data-result-view]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var type = btn.getAttribute('data-result-view');
        if (type === 'member') go('members');
        else if (type === 'card') go('card-list');
        else if (type === 'price') go('price-list');
      });
    });

    var delBatch = $('#btnImportDeleteBatch');
    if (delBatch) {
      delBatch.addEventListener('click', function () {
        showDelBatchDialog();
      });
    }

    var delCancel = $('#btnDelBatchCancel');
    if (delCancel) delCancel.addEventListener('click', hideDelBatchDialog);
    var delMask = $('#delBatchMask');
    if (delMask) delMask.addEventListener('click', hideDelBatchDialog);

    var delConfirm = $('#btnDelBatchConfirm');
    if (delConfirm) {
      delConfirm.addEventListener('click', function () {
        hideDelBatchDialog();
        state.batchDeleted = true;
        state.storeStock.member = 0;
        state.storeStock.card = 0;
        state.storeStock.price = 0;
        state.reimportMode = { member: null, card: null, price: null };
        showToast('已删除已导入数据，会员与卡已回到导入前状态');
        go('import-guide');
      });
    }

    var failRow = $('#btnImportFailRow');
    if (failRow) {
      failRow.addEventListener('click', function () {
        go('import-fail');
      });
    }

    var failDownload = $('#btnImportFailDownload');
    if (failDownload) {
      failDownload.addEventListener('click', function () {
        showToast('已生成失败明细.xls（演示）');
      });
    }

    var failScreen = $('#screen-import-fail');
    if (failScreen) {
      failScreen.addEventListener('click', function (e) {
        var fixBtn = e.target.closest('[data-fail-fix]');
        if (fixBtn) {
          openFailFix(fixBtn.getAttribute('data-fail-fix'));
          return;
        }
        var doneBtn = e.target.closest('[data-fail-done]');
        if (doneBtn) {
          removeFailItem(doneBtn.getAttribute('data-fail-done'));
        }
      });
    }

    // 失败补录 sheet：性别切换
    $all('[data-fail-gender]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        setFailGender(btn.getAttribute('data-fail-gender'));
      });
    });

    // 失败补录 sheet：卡列表内的修改 / 删除
    var fixCardList = $('#failFixCardList');
    if (fixCardList) {
      fixCardList.addEventListener('click', function (e) {
        var delBtn = e.target.closest('[data-card-del]');
        if (delBtn) {
          var delKey = delBtn.getAttribute('data-card-del');
          var l = state.legacy;
          l.cards = l.cards.filter(function (c) { return c.key !== delKey; });
          renderFailFixCards();
          saveFailEdit(l.failId || state.failFixId);
          syncFailItemReason(l.failId || state.failFixId);
          showToast('已删除这张会员卡');
          return;
        }
        var editBtn = e.target.closest('[data-card-edit]');
        if (editBtn) {
          var key = editBtn.getAttribute('data-card-edit');
          var card = null;
          state.legacy.cards.forEach(function (c) {
            if (c.key === key) card = c;
          });
          if (!card) return;
          state.legacy.editingKey = key;
          state.legacy.pickId = card.cardId;
          var f = legacyFindCard(card.cardId);
          if (f) state.legacy.group = f.group.key;
          hideFailFixKeepState();
          slideTo('legacy-detail');
        }
      });
    }

    // 失败补录 sheet：进入「添加卡」（补录老卡，新增模式）
    var addCard = $('#btnFailFixAddCard');
    if (addCard) {
      addCard.addEventListener('click', function () {
        var name = ($('#failFixName') || {}).value || '';
        var phone = ($('#failFixPhone') || {}).value || '';
        if (!name.trim()) {
          showToast('请先填写姓名');
          return;
        }
        var l = state.legacy;
        l.name = name.trim();
        l.phone = phone.trim();
        if (!l.gender) {
          var g = deriveGenderFromName(name);
          if (g.value === '男' || g.value === '女') setFailGender(g.value, true);
        }
        l.cardFailId = l.failId;
        l.editingKey = null;
        l.pickId = null;
        l.mode = 'legacy';
        if (!l.group) l.group = LEGACY_CARD_GROUPS[0].key;
        saveFailEdit(l.failId);
        // 关掉 sheet，让「添加卡」从右侧滑入
        hideFailFixKeepState();
        slideTo('legacy-card');
      });
    }

    var failSave = $('#btnFailFixSave');
    if (failSave) {
      failSave.addEventListener('click', function () {
        var id = state.failFixId;
        var v = validateFailFixFields();
        if (!v.ok) {
          showToast(v.msg);
          return;
        }
        if (id) {
          saveFailEdit(id);
          markFailFixed(id);
        }
        hideFailFix();
        showToast('已补录并入库');
      });
    }
    var failCancel = $('#btnFailFixCancel');
    if (failCancel) failCancel.addEventListener('click', hideFailFix);
    var failMask = $('#failFixMask');
    if (failMask) failMask.addEventListener('click', hideFailFix);

    /* ---- v2.0 转换 / 概览 / 仪式 / 微信引导 ---- */

    var convertResult = $('#convertResult');
    if (convertResult) {
      convertResult.addEventListener('click', function (e) {
        var act = e.target.closest('[data-conv-act]');
        if (!act) return;
        var kind = act.getAttribute('data-conv-act');
        if (kind === 'tpl') openTplSheet();
        else if (kind === 'reupload') {
          state.convertDone = false;
          go('import-source');
        } else if (kind === 'manual') {
          showToast('已记录，运营会在 1 个工作日内联系（演示占位）');
        }
      });
    }

    var convertNext = $('#btnConvertNext');
    if (convertNext) {
      convertNext.addEventListener('click', function () {
        if (convertNext.disabled) return;
        go('import-check');
      });
    }
    var convertBack = $('#btnConvertBack');
    if (convertBack) convertBack.addEventListener('click', function () { go('import-queue'); });
    var convertReupload = $('#btnConvertReupload');
    if (convertReupload) {
      convertReupload.addEventListener('click', function () {
        state.convertDone = false;
        go('import-source');
      });
    }

    var checkScreen = $('#screen-import-check');
    if (checkScreen) {
      checkScreen.addEventListener('click', function (e) {
        var tab = e.target.closest('[data-check-tab]') || e.target.closest('[data-check-tab-jump]');
        if (tab) {
          var nextTab = tab.getAttribute('data-check-tab') || tab.getAttribute('data-check-tab-jump');
          if (nextTab && nextTab !== state.checkTab) {
            state.checkTab = nextTab;
            state.checkFilter = 'all';
            state.checkQuery = '';
            state.checkLimit = 24;
            state.checkOpen = null;
            state.checkProbIdx = 0;
            var inp = $('#checkSearch');
            if (inp) inp.value = '';
            renderCheck();
          }
          return;
        }
        var chip = e.target.closest('[data-check-filter]');
        if (chip) {
          state.checkFilter = chip.getAttribute('data-check-filter');
          state.checkOpen = null;
          state.checkProbIdx = 0;
          renderCheckStats();
          renderCheckList();
          return;
        }
        var openBtn = e.target.closest('[data-check-open]');
        if (openBtn) {
          var oid = openBtn.getAttribute('data-check-open');
          state.checkOpen = state.checkOpen === oid ? null : oid;
          renderCheckStats();
          renderCheckList();
          return;
        }
        var saveBtn = e.target.closest('[data-check-save]');
        if (saveBtn) {
          saveCheckRow(state.checkTab, saveBtn.getAttribute('data-check-save'));
          return;
        }
        var ignoreBtn = e.target.closest('[data-check-ignore]');
        if (ignoreBtn) {
          toggleCheckIgnore(state.checkTab, ignoreBtn.getAttribute('data-check-ignore'));
          return;
        }
        var delBtn = e.target.closest('[data-check-del]');
        if (delBtn) {
          deleteCheckRow(state.checkTab, delBtn.getAttribute('data-check-del'));
          return;
        }
        var probBtn = e.target.closest('[data-check-prob]');
        if (probBtn) {
          jumpCheckProblem(probBtn.getAttribute('data-check-prob'));
        }
      });
    }

    var checkBack = $('#btnCheckBack');
    if (checkBack) checkBack.addEventListener('click', function () { go('import-convert'); });
    var checkAdd = $('#btnCheckAdd');
    if (checkAdd) checkAdd.addEventListener('click', addCheckRow);
    var checkMore = $('#btnCheckMore');
    if (checkMore) {
      checkMore.addEventListener('click', function () {
        state.checkLimit += 24;
        renderCheckList();
      });
    }
    var checkSearch = $('#checkSearch');
    if (checkSearch) {
      checkSearch.addEventListener('input', function () {
        state.checkQuery = checkSearch.value;
        state.checkOpen = null;
        renderCheckList();
      });
    }
    var checkSearchClear = $('#btnCheckSearchClear');
    if (checkSearchClear) {
      checkSearchClear.addEventListener('click', function () {
        state.checkQuery = '';
        if (checkSearch) { checkSearch.value = ''; checkSearch.focus(); }
        renderCheckList();
      });
    }
    var checkSubmit = $('#btnCheckSubmit');
    if (checkSubmit) checkSubmit.addEventListener('click', openCheckCeremony);

    var checkHelp = $('#btnCheckHelp');
    if (checkHelp) checkHelp.addEventListener('click', openCheckHelp);
    var checkHelpClose = $('#btnCheckHelpClose');
    if (checkHelpClose) checkHelpClose.addEventListener('click', hideCheckHelp);
    var checkHelpMask = $('#checkHelpMask');
    if (checkHelpMask) checkHelpMask.addEventListener('click', hideCheckHelp);

    var ceremonyDone = $('#btnCeremonyDone');
    if (ceremonyDone) {
      ceremonyDone.addEventListener('click', function () {
        hideCeremony();
        go('import-result');
      });
    }

    var wechatHow = $('#btnWechatHow');
    if (wechatHow) wechatHow.addEventListener('click', showWechatTip);
    var wechatTipOk = $('#btnWechatTipOk');
    if (wechatTipOk) {
      wechatTipOk.addEventListener('click', function () {
        var mute = $('#wechatTipMute');
        if (mute && mute.checked) {
          try { localStorage.setItem('rtb_wechat_tip_muted', '1'); } catch (err) { /* 忽略 */ }
        }
        var from = state.flow;
        hideWechatTip();
        if (from === 'import-guide') go('import-select');
      });
    }
    var wechatTipClose = $('#btnWechatTipClose');
    if (wechatTipClose) wechatTipClose.addEventListener('click', hideWechatTip);
    var wechatTipMask = $('#wechatTipMask');
    if (wechatTipMask) wechatTipMask.addEventListener('click', hideWechatTip);

    var tplDownload = $('#btnTplDownload');
    if (tplDownload) tplDownload.addEventListener('click', openTplSheet);
    var tplClose = $('#btnTplClose');
    if (tplClose) tplClose.addEventListener('click', hideTplSheet);
    var tplMask = $('#tplMask');
    if (tplMask) tplMask.addEventListener('click', hideTplSheet);

    bindLegacyCard();

    var closeFabAsk = $('#btnFabCloseYes');
    var keepFab = $('#btnFabCloseNo');
    if (closeFabAsk) {
      closeFabAsk.addEventListener('click', function () {
        hideFab();
        hideDialog('#fabCloseDialog');
      });
    }
    if (keepFab) {
      keepFab.addEventListener('click', function () {
        hideDialog('#fabCloseDialog');
      });
    }
  }

  function bindLegacyCard() {
    // 「添加卡」里的办理类型切换
    $all('[data-legacy-mode]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        state.legacy.mode = btn.getAttribute('data-legacy-mode');
        $all('[data-legacy-mode]').forEach(function (b) {
          b.classList.toggle('is-on', b === btn);
        });
      });
    });

    // 卡种分组 tab
    var tabs = $('#legacyGroupTabs');
    if (tabs) {
      tabs.addEventListener('click', function (e) {
        var tab = e.target.closest('[data-legacy-group]');
        if (!tab) return;
        state.legacy.group = tab.getAttribute('data-legacy-group');
        renderLegacyGroups();
        renderLegacyCards();
      });
    }

    // 卡种单选
    var list = $('#legacyCardList');
    if (list) {
      list.addEventListener('click', function (e) {
        var item = e.target.closest('[data-legacy-card]');
        if (!item) return;
        state.legacy.pickId = item.getAttribute('data-legacy-card');
        renderLegacyCards();
      });
    }

    var cardBack = $('#btnLegacyCardBack');
    if (cardBack) {
      cardBack.addEventListener('click', function () {
        var id = state.legacy.failId || state.failFixId;
        slideBackTo('import-fail', 'legacy-card');
        // 回到失败明细时重新打开补录半屏（不自动标记完成）
        setTimeout(function () {
          if (id) openFailFix(id);
        }, 240);
      });
    }

    var cardNext = $('#btnLegacyCardNext');
    if (cardNext) {
      cardNext.addEventListener('click', function () {
        if (!state.legacy.pickId) {
          showToast('请选择一个卡种');
          return;
        }
        // 从添加卡页挑选后一律是新增，编辑走半屏行内「修改」
        state.legacy.editingKey = null;
        slideTo('legacy-detail');
      });
    }

    var detailBack = $('#btnLegacyDetailBack');
    if (detailBack) {
      detailBack.addEventListener('click', function () {
        // 编辑态返回半屏；新增态返回选卡页
        if (state.legacy.editingKey) {
          var eid = state.legacy.failId || state.failFixId;
          state.legacy.editingKey = null;
          slideBackTo('import-fail', 'legacy-detail');
          setTimeout(function () {
            if (eid) openFailFix(eid);
          }, 240);
          return;
        }
        slideBackTo('legacy-card', 'legacy-detail');
      });
    }

    var confirm = $('#btnLegacyConfirm');
    if (confirm) {
      confirm.addEventListener('click', function () {
        var l = state.legacy;
        var bal = ($('#legacyBalance') || {}).value || '';
        var money = bal.replace(/[^\d.]/g, '');
        if (!money || !/^\d+(\.\d{1,2})?$/.test(money)) {
          showToast('请填写正确的卡内余额');
          return;
        }
        var vals = {
          balance: money,
          expiry: (($('#legacyExpiry') || {}).value || '').trim(),
          rechargeLeft: (($('#legacyRechargeLeft') || {}).value || '').trim(),
          bonusLeft: (($('#legacyBonusLeft') || {}).value || '').trim(),
          bonusItems: (($('#legacyBonusItems') || {}).value || '').trim()
        };
        var failId = l.failId || state.failFixId;

        if (l.editingKey) {
          // 编辑：就地更新该张卡
          l.cards.forEach(function (c) {
            if (c.key !== l.editingKey) return;
            c.balance = vals.balance;
            c.expiry = vals.expiry;
            c.rechargeLeft = vals.rechargeLeft;
            c.bonusLeft = vals.bonusLeft;
            c.bonusItems = vals.bonusItems;
          });
          showToast('已保存会员卡修改');
        } else {
          // 新增：追加一张
          var found = l.pickId ? legacyFindCard(l.pickId) : null;
          l.cards.push({
            key: nextCardKey(),
            cardId: l.pickId,
            cardName: found ? found.card.name : '会员卡',
            price: found ? found.card.price : 0,
            balance: vals.balance,
            expiry: vals.expiry,
            rechargeLeft: vals.rechargeLeft,
            bonusLeft: vals.bonusLeft,
            bonusItems: vals.bonusItems
          });
          showToast('补录成功，已写入本店会员卡');
        }

        l.editingKey = null;
        l.pickId = null;
        if (failId) saveFailEdit(failId);
        slideBackTo('import-fail', 'legacy-detail');
        setTimeout(function () {
          if (!failId) return;
          // 会员信息合法则本条置为已补录；不合法则回到半屏继续补
          var v = validateFailFixFields();
          if (v.ok) markFailFixed(failId);
          openFailFix(failId);
          if (!v.ok) showToast(v.msg);
        }, 260);
      });
    }
  }

  function bindPreviewDetail() {
    var overview = $('#screen-import-preview');
    if (overview) {
      overview.addEventListener('click', function (e) {
        var typeBtn = e.target.closest('[data-preview-type]');
        if (!typeBtn) return;
        openPreviewType(typeBtn.getAttribute('data-preview-type'));
      });
    }
    var cards = $('#importPreviewCards');
    if (cards) {
      cards.addEventListener('click', function (e) {
        var card = e.target.closest('[data-preview-idx]');
        if (!card) return;
        showPreviewDetail(Number(card.getAttribute('data-preview-idx')));
      });
    }
    var closeBtn = $('#btnPreviewDetailClose');
    if (closeBtn) closeBtn.addEventListener('click', hidePreviewDetail);
    var mask = $('#previewDetailMask');
    if (mask) mask.addEventListener('click', hidePreviewDetail);
  }

  function bindMembers() {
    var input = $('#membersSearchInput');
    if (input) {
      input.addEventListener('input', function () {
        renderMembersList(input.value);
      });
    }
    var cancel = $('#btnMembersSearchCancel');
    if (cancel) {
      cancel.addEventListener('click', function () {
        if (input) {
          input.value = '';
          renderMembersList('');
        }
        go('import-result');
      });
    }
    var list = $('#membersPickList');
    if (list) {
      list.addEventListener('click', function (e) {
        var row = e.target.closest('.pick-row');
        if (!row) return;
        showToast('会员详情占位');
      });
    }
  }

  function showDialog(sel) {
    var d = $(sel);
    if (d) d.classList.add('show');
  }
  function hideDialog(sel) {
    var d = $(sel);
    if (d) d.classList.remove('show');
  }

  function onImportResultEnter() {
    if (state.pendingStockApply) {
      applyBatchToStock();
      state.pendingStockApply = false;
    }
    renderResultStockLines();
    renderResultSources();
    // 导入成功后不再用浮球催促；工作台常驻入口即可
    if (state.fabVisible) {
      setTimeout(function () {
        showDialog('#fabCloseDialog');
      }, 400);
    }
  }

  function bindWorkbench() {
    $all('[data-wb]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var key = btn.getAttribute('data-wb');
        if (key === 'migrate') {
          enterMigrate();
          return;
        }
        if (key === 'history') {
          go('history-orders');
          return;
        }
        showToast('演示占位');
      });
    });
    $all('[data-wb-tab]').forEach(function (tab) {
      tab.addEventListener('click', function () {
        var key = tab.getAttribute('data-wb-tab');
        if (key === 'home') go('home');
        else if (key !== 'workbench') showToast('演示占位');
      });
    });
    var homeWb = $('#btnHomeWorkbench');
    if (homeWb) {
      homeWb.addEventListener('click', function () {
        go('workbench');
      });
    }
  }

  function bindNav() {
    $all('.site-nav [data-flow]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var flow = btn.getAttribute('data-flow');
        // 从左侧导航直接进「认领门店」看完整态，不弹权限说明
        if (flow === 'claim') {
          state.claimEmpty = false;
        }
        // 开发导航进概况时补造数，便于直接评审再导入承接
        if (flow === 'import-overview' && !hasP0Stock()) {
          seedStoreStockDemo();
        }
        go(flow);
        if (document.documentElement.classList.contains('view-mobile')) {
          document.documentElement.classList.remove('nav-drawer-open');
        }
      });
    });
  }

  function applyDeepLink() {
    var q = new URLSearchParams(location.search);
    var flow = q.get('flow');
    if (flow && document.querySelector('.phone-inner > .screen[data-flow="' + flow + '"]')) {
      if (flow === 'import-overview' && !hasP0Stock()) seedStoreStockDemo();
      go(flow);
    } else {
      go(HOME_FLOW);
    }
  }

  // ===== 抓取路由（仅 ?capture= 生效，不影响默认演示行为） =====
  function seedCaptureImportDemo() {
    state.importSelection = { member: true, card: true, price: true };
    state.importSources = { member: 'excel', card: 'excel', price: 'excel' };
    state.importFiles = {
      member: [{ name: '会员与持卡信息.xlsx', size: '1.2 MB' }],
      card: [{ name: '会员卡模板.xlsx', size: '0.4 MB' }],
      price: [{ name: '价目表.xlsx', size: '0.6 MB' }]
    };
    state.importPhotos = { member: [], card: [], price: [] };
    state.importPlan = { excel: ['member', 'card', 'price'], photo: [] };
    state.importMapTab = 'member';
    state.importMapAck = {};
    state.importMapConfirmed = false;
    state.importMapReturned = false;
    state.tplGen = null;
    state.batchDeleted = false;
    collectPlan();
  }

  function seedStoreStockDemo() {
    state.storeStock = {
      member: BATCH_DEMO.member,
      card: BATCH_DEMO.card,
      price: BATCH_DEMO.price,
      history: HISTORY_ROWS.length
    };
    state.historyImported = true;
    state.historyDeleted = false;
  }

  function applyCaptureRoute() {
    var cap = new URLSearchParams(location.search).get('capture');
    if (!cap) return;
    document.documentElement.classList.add('capture-mode');
    var style = document.createElement('style');
    // 藏导航，并清掉 .stage 的桌面台面边距（否则 html-to-design 会把
    // margin-left:200 / padding:24 20 40 收进画框，导致内容偏移溢出）
    style.textContent =
      '.capture-mode .site-nav,.capture-mode .nav-drawer-mask,.capture-mode .nav-edge-hit{display:none!important}' +
      '.capture-mode .stage{margin-left:0!important;padding:0!important}';
    document.head.appendChild(style);

    var step = function (fn, ms) {
      setTimeout(fn, ms || 260);
    };

    if (cap === 'claim-empty') {
      state.claimEmpty = true;
      go('claim');
      return;
    }
    if (cap === 'claim') {
      state.claimEmpty = false;
      go('claim');
      return;
    }
    if (cap === 'loc-explain') {
      state.claimEmpty = true;
      go('claim');
      step(showLocExplain);
      return;
    }
    if (cap === 'loc-sys') {
      state.claimEmpty = true;
      go('claim');
      step(function () {
        hideLocExplain();
        showLocSys();
      });
      return;
    }
    if (cap === 'invite') {
      go('home');
      step(showInviteSheet, 320);
      return;
    }
    if (cap === 'import-overview') {
      seedStoreStockDemo();
      go('import-overview');
      return;
    }
    if (cap === 'reimport-mode') {
      seedStoreStockDemo();
      seedCaptureImportDemo();
      state.reimportMode = { member: null, card: null, price: null };
      go('import-select');
      step(openReimportModeSheet, 400);
      return;
    }
    if (cap === 'history-reimport') {
      seedStoreStockDemo();
      go('history-orders');
      step(openHistoryReimportSheet, 400);
      return;
    }
    if (cap === 'fab-close') {
      seedCaptureImportDemo();
      go('import-result');
      showFab();
      step(function () {
        showDialog('#fabCloseDialog');
      }, 400);
      return;
    }
    if (cap === 'preview-detail') {
      seedCaptureImportDemo();
      openPreviewType('member');
      step(function () {
        showPreviewDetail(0);
      }, 320);
      return;
    }
    if (cap === 'fail-fix') {
      seedCaptureImportDemo();
      go('import-fail');
      step(function () {
        openFailFix('f1');
      }, 320);
      return;
    }
    if (cap === 'del-batch') {
      seedCaptureImportDemo();
      go('import-result');
      step(showDelBatchDialog, 320);
      return;
    }
    if (cap === 'import-progress') {
      seedCaptureImportDemo();
      go('import-queue');
      step(function () {
        var box = $('#importProgress');
        if (!box) return;
        clearTimeout(progressTimer);
        progressTimer = null;
        box.classList.remove('hidden', 'is-done');
        box.setAttribute('aria-hidden', 'false');
        var title = $('#importProgressTitle');
        var sub = $('#importProgressSub');
        var stepEl = $('#importProgressStep');
        var pctEl = $('#importProgressPct');
        var bar = $('#importProgressBar');
        var track = $('#importProgressTrack');
        if (title) title.textContent = '正在识别…';
        if (sub) sub.textContent = '正在解析 Excel 与照片';
        if (stepEl) stepEl.textContent = '对齐列名';
        if (pctEl) pctEl.textContent = '62%';
        if (bar) bar.style.width = '62%';
        if (track) track.setAttribute('aria-valuenow', '62');
      }, 320);
      return;
    }
    // 下游页需要有演示表格，否则映射页会跳过、队列为空
    if (/^import-(source|queue|map|tpl-gen|preview|preview-detail|result|fail)$/.test(cap) ||
        cap === 'import-camera') {
      seedCaptureImportDemo();
      if (cap === 'import-camera') {
        state.importCameraCat = 'price';
        state.importSources.price = 'photo';
        state.importPhotos.price = [];
        collectPlan();
        setCameraDemo(true);
      }
      if (cap === 'import-source') {
        // 展示「已选文件」态，更接近真实链路
        state.uploadStep = 0;
      }
    }
    if (document.querySelector('.phone-inner > .screen[data-flow="' + cap + '"]')) {
      go(cap);
    }
  }

  function boot() {
    bindDataGo();
    bindNav();
    bindLogin();
    bindLocationGate();
    bindClaim();
    bindConfirm();
    bindTriage();
    bindInvite();
    bindFab();
    bindImport();
    bindHistory();
    bindMapCustomInputs();
    bindPreviewDetail();
    bindMembers();
    bindWorkbench();
    applyDeepLink();
    syncImportMapLockUI();
    applyCaptureRoute();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
