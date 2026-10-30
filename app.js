(function () {
  'use strict';

  var HOME_FLOW = 'login';
  var state = {
    pendingInvite: false,
    /* 首页数据导入 banner / 断点续进（本批演示态，刷新可丢） */
    importTask: {
      started: false,
      stage: 'idle', /* idle | analyzing | check | importing | done */
      resumeFlow: null,
      entry: 'home' /* home | workbench */
    },
    /* 三档识别结果（L1 原件 / L2 摘要 / L3 可入库） */
    tierResult: { l1: [], l2: [], l3Cats: [] },
    confirmItems: { cards: [], prices: [], acknowledged: false },
    archiveDomain: 'member',
    archiveReturn: 'members',
    digestId: null,
    sourceReturn: 'digest-detail',
    sourcePayload: null,
    coachPhase: null, /* null | home-more | wb-migrate */
    coachTimer: null,
    camTableGuide: false,
    /* ===== 新流程：先收来源，再让 AI 判断类别 ===== */
    pending: { excel: [], photo: [] },   /* 已拿到、尚未识别的内容 */
    analyzing: false,
    analyzeTimers: [],
    analysisCats: [],                    /* AI 认出的类别，按展示顺序 */
    /* 识别完成后由 AI 填充；下游（转换 / 核对 / 结果）沿用这套结构 */
    importSelection: { member: false, card: false, price: false, product: false },
    importSources: { member: null, card: null, price: null, product: null },
    importFiles: { member: [], card: [], price: [], product: [] },
    importPhotos: { member: [], card: [], price: [], product: [] },
    importCameraStream: null,
    importCameraDemo: false,
    camPreviewOpen: false,
    camPreviewIdx: 0,
    importPlan: { excel: [], photo: [] },
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
    /* 左侧「空态」导航强制预览：null | history-true | history-filter | archive | digest */
    emptyPreview: null,
    historyImported: false,
    histMonthOpen: null,
    /* v2.56：历史消费 × 会员 —— 手机号或会员编号命中后再校验姓名；不再提供解除 */
    importMode: 'main',
    historyUnmatched: {},
    historyTier: null,
    memberDetailId: null,
    historyReturnFlow: null,
    mhOpenYear: null,
    /* 本店已入库存量（再导入承接） */
    storeStock: { member: 0, card: 0, price: 0, product: 0, history: 0 },
    /* 再导模式：merge | replace；首次导入为 null */
    reimportMode: { member: null, card: null, price: null, product: null },
    historyReimportIntent: null, /* 仅 replace（v2.50 起一律清空再导；保留字段防旧引用） */
    historyAppended: false, /* 已废弃：不再追加导入 */
    viewReturn: null,
    pendingStockApply: false,
    /* 标准表转换 + 数据核对 */
    checkData: null,
    checkTab: 'member',
    checkFilter: 'all',
    checkLimit: 24,
    checkOpen: null,
    inlineEdit: null,
    convertDone: false,
    convertRunning: false,
    convertTimers: [],
    /* 兼容：旧映射/上传字段（入口已下线，仅防未定义） */
    uploadStd: {},
    uploadFocus: null,
    uploadHi: null,
    uploadStep: 0,
    srcDialog: null,
    importMapAck: {},
    importMapTab: 'member',
    importMapSkipResetAck: false,
    importCameraReturn: 'import-select',
    queueBusy: false,
    tplGen: null,
    importPreviewType: 'member',
    previewIdx: null,
    historyImporting: false,
    checkIgnoreArm: false,
    transferRunning: false,
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
  var BATCH_DEMO = { member: 126, card: 4, price: 42, product: 16 };
  var MERGE_DEMO = {
    member: { add: 18, upd: 12 },
    card: { add: 1, upd: 2 },
    price: { add: 5, upd: 8 },
    product: { add: 3, upd: 2 }
  };
  var STOCK_UNIT = { member: '人', card: '张', price: '项', product: '个' };

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

  /* 四类数据（v2.36）：会员 → 卡模板 → 价目表·项目 → 价目表·产品；库存不再进导入 */
  var ALL_CATS = ['member', 'card', 'price', 'product'];
  var IMPORT_CAT = {
    member: '会员资料',
    card: '卡模板',
    price: '价目表·项目',
    product: '价目表·产品'
  };
  var IMPORT_CAT_SHORT = { member: '会员', card: '卡模板', price: '价目项目', product: '价目产品' };
  var CAT_ICO = {
    member: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="3.6"/><path d="M4.8 20c0-3.7 3.2-5.6 7.2-5.6s7.2 1.9 7.2 5.6"/></svg>',
    card: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2.8" y="5.5" width="18.4" height="13" rx="2.6"/><path d="M2.8 10.2h18.4"/><path d="M6.6 14.6h4.2"/></svg>',
    price: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20.3 13.4l-6.9 6.9a2.1 2.1 0 0 1-2.9 0l-7.1-7.1a2 2 0 0 1-.6-1.4V5.4a2 2 0 0 1 2-2h6.4a2 2 0 0 1 1.4.6l7.7 7.7a2.1 2.1 0 0 1 0 1.7z"/><circle cx="8.1" cy="8.1" r="1.5"/></svg>',
    product: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5.4 7.6h13.2l1.2 12a1.4 1.4 0 0 1-1.4 1.5H5.6a1.4 1.4 0 0 1-1.4-1.5l1.2-12Z"/><path d="M8.8 9.6V6.4a3.2 3.2 0 0 1 6.4 0v3.2"/></svg>'
  };
  var CAT_DESC = {
    member: '会员编号 / 卡号 / 姓名 / 手机号 / 余额',
    card: '卡名称 / 类型 / 充值 / 折扣 / 权益 / 有效期 / 持卡人数',
    price: '项目 / 价格 / 项目组 / 可开单',
    product: '产品名 / 分类 / 售价 / 是否上架'
  };
  var CAT_UNIT = { member: '人', card: '张', price: '项', product: '个' };

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

  // 历史消费：只识别日期 / 金额 / 顾客姓名，其余列原样保留（v2.45 起不再提供手动指定字段）
  /* 历史订单演示：项目文案区分「充值类」与「消费类」（可重叠，见 historyRowFlags） */
  var HISTORY_ROWS = [
    { id: 'h01', date: '2025-12-28', amount: 1280, name: '李女士', phone: '', memberNo: '', raw: { 项目: '染发 + 护理', 支付方式: '微信', 门店: '悦己美发沙龙', 备注: '项目消费' } },
    { id: 'h02', date: '2025-12-19', amount: 168, name: '王先生', phone: '', memberNo: '', raw: { 项目: '洗剪吹', 支付方式: '现金', 门店: '悦己美发沙龙', 备注: '' } },
    { id: 'h03', date: '2025-11-30', amount: 680, name: '张女士', phone: '', memberNo: '', raw: { 项目: '烫发', 支付方式: '支付宝', 门店: '悦己美发沙龙', 备注: '老客' } },
    { id: 'h04', date: '2025-11-09', amount: 268, name: '陈先生', phone: '', memberNo: '', raw: { 项目: '头皮护理', 支付方式: '微信', 门店: '悦己美发沙龙', 备注: '' } },
    { id: 'h05', date: '2025-10-21', amount: 398, name: '刘女士', phone: '', memberNo: '', raw: { 项目: '染发', 支付方式: '储值卡', 门店: '悦己美发沙龙', 备注: '卡扣消费' } },
    { id: 'h06', date: '2025-09-15', amount: 88, name: '赵先生', phone: '', memberNo: '', raw: { 项目: '洗剪吹', 支付方式: '微信', 门店: '悦己美发沙龙', 备注: '' } },
    { id: 'h07', date: '2025-08-02', amount: 1580, name: '孙女士', phone: '', memberNo: '', raw: { 项目: '办卡·黄金储值卡', 支付方式: '银行卡', 门店: '悦己美发沙龙', 备注: '开卡' } },
    { id: 'h08', date: '2025-06-18', amount: 128, name: '', phone: '', memberNo: '', raw: { 项目: '洗剪吹', 支付方式: '现金', 门店: '悦己美发沙龙', 备注: '未留姓名' } },
    { id: 'h09', date: '2025-04-06', amount: 520, name: '周女士', phone: '', memberNo: '', raw: { 项目: '续费·护理年卡', 支付方式: '微信', 门店: '悦己美发沙龙', 备注: '' } },
    { id: 'h10', date: '2025-01-12', amount: 240, name: '吴先生', phone: '', memberNo: '', raw: { 项目: '造型', 支付方式: '支付宝', 门店: '悦己美发沙龙', 备注: '' } },
    { id: 'h11', date: '2024-12-24', amount: 960, name: '郑女士', phone: '', memberNo: '', raw: { 项目: '充卡·储值 1000', 支付方式: '微信', 门店: '悦己美发沙龙', 备注: '' } },
    { id: 'h12', date: '2024-10-03', amount: 180, name: '冯先生', phone: '', memberNo: '', raw: { 项目: '洗剪吹', 支付方式: '现金', 门店: '悦己美发沙龙', 备注: '' } },
    { id: 'h13', date: '2024-07-19', amount: 760, name: '李女士', phone: '', memberNo: '', raw: { 项目: '续次·剪发次卡', 支付方式: '银行卡', 门店: '悦己美发沙龙', 备注: '' } },
    { id: 'h14', date: '2024-03-08', amount: 1280, name: '许女士', phone: '', memberNo: '', raw: { 项目: '办卡·护理年卡', 支付方式: '微信', 门店: '悦己美发沙龙', 备注: '妇女节活动' } },
    { id: 'h15', date: '2023-11-11', amount: 620, name: '何先生', phone: '', memberNo: '', raw: { 项目: '染发', 支付方式: '支付宝', 门店: '悦己美发沙龙', 备注: '' } },
    { id: 'h16', date: '2023-05-26', amount: 300, name: '王先生', phone: '', memberNo: '', raw: { 项目: '头皮护理', 支付方式: '现金', 门店: '悦己美发沙龙', 备注: '' } }
  ];
  var HISTORY_FAIL_ROWS = [
    { line: 12, reason: '金额无法识别', diff: [['消费日期', '2025-12-31'], ['金额', '—', true], ['顾客姓名', '李女士']] },
    { line: 48, reason: '日期格式无法识别', diff: [['消费日期', '12月31', true], ['金额', '680'], ['顾客姓名', '李女士']] },
    { line: 96, reason: '金额为 0 或负数', diff: [['消费日期', '2025-08-14'], ['金额', '0', true], ['顾客姓名', '周先生']] },
    { line: 137, reason: '日期与金额都为空', diff: [['消费日期', '（空）', true], ['金额', '（空）', true], ['顾客姓名', '陈女士']] }
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
    var emptyOn = !!state.emptyPreview;
    $all('.site-nav [data-flow]').forEach(function (btn) {
      var match = !emptyOn && btn.getAttribute('data-flow') === flow;
      btn.classList.toggle('on', match);
    });
    $all('.site-nav [data-empty]').forEach(function (btn) {
      btn.classList.toggle('on', btn.getAttribute('data-empty') === state.emptyPreview);
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
    return ALL_CATS.some(function (k) { return (state.storeStock[k] || 0) > 0; });
  }

  function hasHistoryStock() {
    return state.storeStock.history > 0 && !state.historyDeleted;
  }

  var BANNER_MUTE_KEY = 'rtb_import_banner_muted';
  var WB_IMPORT_HIT_KEY = 'rtb_import_wb_hit';
  var POST_AI_FLOWS = [
    'import-analyze', 'import-cards', 'import-confirm',
    'import-check', 'import-result', 'import-fail',
    'history-import-preview', 'history-import-result', 'history-import-fail'
  ];
  var DOMAIN_FLOWS = {
    member: 'members',
    card: 'card-list',
    price: 'price-list',
    product: 'price-list',
    order: 'order-list'
  };
  /* 价目表模块：项目 + 产品同属一域展示（标题「价目表」） */
  var DOMAIN_LABEL = { member: '会员', card: '会员卡', price: '价目表', product: '价目表', order: '订单流水' };
  var DOMAIN_MATCH = {
    member: ['member'],
    card: ['card'],
    price: ['price', 'product'],
    product: ['price', 'product'],
    order: ['order']
  };
  var STAGE_COPY = {
    idle: { title: '数据导入', sub: '把老店数据导进来', go: '进入', progress: false, busy: false, done: false },
    analyzing: { title: '数据导入', sub: 'AI 识别中', go: '继续', progress: true, busy: true, done: false },
    check: { title: '数据导入', sub: '待核对', go: '继续', progress: true, busy: false, done: false },
    importing: { title: '数据导入', sub: '导入中', go: '继续', progress: true, busy: true, done: false },
    done: { title: '数据导入', sub: '已完成', go: '查看', progress: false, busy: false, done: true }
  };

  function bannerMuted() {
    try { return localStorage.getItem(BANNER_MUTE_KEY) === '1'; } catch (e) { return false; }
  }
  function muteImportBanner() {
    try { localStorage.setItem(BANNER_MUTE_KEY, '1'); } catch (e) {}
  }
  function clearBannerMute() {
    try { localStorage.removeItem(BANNER_MUTE_KEY); } catch (e) {}
  }
  function hasHitWorkbenchImport() {
    try { return localStorage.getItem(WB_IMPORT_HIT_KEY) === '1'; } catch (e) { return false; }
  }
  function markWorkbenchImportHit() {
    try { localStorage.setItem(WB_IMPORT_HIT_KEY, '1'); } catch (e) {}
  }

  function setImportStage(stage, resumeFlow) {
    state.importTask.stage = stage || 'idle';
    if (resumeFlow) state.importTask.resumeFlow = resumeFlow;
    if (stage && stage !== 'idle') state.importTask.started = true;
    renderImportBanner();
  }

  function leaveImportShell() {
    state.viewReturn = null;
    clearBannerMute();
    var entry = state.importTask.entry === 'workbench' ? 'workbench' : 'home';
    go(entry);
    renderImportBanner();
    if (state.importMode === 'history') exitHistoryMode();
  }

  var VIEW_LIST_FLOWS = ['members', 'card-list', 'price-list', 'order-list'];

  function openResultCatView(type) {
    state.viewReturn = 'import-result';
    if (type === 'member') go('members');
    else if (type === 'card') go('card-list');
    else if (type === 'price') go('price-list');
    else showToast(IMPORT_CAT_SHORT[type] + '列表为原型占位，以线上系统为准');
  }

  function resetImportBatch() {
    /* 一批已收尾：清掉待识别池、识别结果与核对态，重进时从头开始 */
    state.pending.excel = [];
    state.pending.photo = [];
    state.analysisCats = [];
    state.analyzing = false;
    (state.analyzeTimers || []).forEach(function (t) { clearTimeout(t); });
    state.analyzeTimers = [];
    state.checkData = null;
    state.checkOpen = null;
    state.inlineEdit = null;
    state.checkTab = 'member';
    state.checkFilter = 'all';
    state.hdrCats = [];
    state.importTask = { started: false, stage: 'idle', resumeFlow: null, entry: 'home' };
    if (state.importMode === 'history') exitHistoryMode();
    renderImportBanner();
  }

  function importBatchClosed() {
    return state.importTask.stage === 'done' || state.importTask.resumeFlow === 'import-result';
  }

  function resumeImportTask() {
    var flow = state.importTask.resumeFlow;
    var entry = state.importTask.entry || 'home';
    if (importBatchClosed()) {
      resetImportBatch();
      state.importTask.entry = entry === 'workbench' ? 'workbench' : 'home';
      go(hasP0Stock() ? 'import-overview' : 'import-select');
      return;
    }
    if (state.importTask.started && flow && POST_AI_FLOWS.indexOf(flow) >= 0) {
      go(flow);
      return;
    }
    enterMigrate(state.importTask.entry || 'home');
  }

  function renderImportBanner() {
    var el = $('#importBanner');
    if (!el) return;
    if (bannerMuted()) {
      el.hidden = true;
      return;
    }
    var stage = state.importTask.stage || 'idle';
    var copy = STAGE_COPY[stage] || STAGE_COPY.idle;
    el.hidden = false;
    el.classList.toggle('is-progress', !!copy.progress);
    el.classList.toggle('is-busy', !!copy.busy);
    el.classList.toggle('is-done', !!copy.done);
    var title = $('#importBannerTitle');
    var sub = $('#importBannerSub');
    var goLab = $('#importBannerGo');
    var dots = $('#importBannerDots');
    if (title) title.textContent = copy.title;
    if (sub) sub.textContent = copy.sub;
    if (goLab) goLab.textContent = copy.go;
    if (dots) dots.setAttribute('aria-hidden', copy.busy ? 'false' : 'true');
  }

  function enterMigrate(from) {
    exitHistoryMode();
    state.importTask.entry = from === 'workbench' ? 'workbench' : 'home';
    if (importBatchClosed()) {
      var entry = state.importTask.entry;
      resetImportBatch();
      state.importTask.entry = entry;
      go(hasP0Stock() ? 'import-overview' : 'import-select');
      return;
    }
    if (state.importTask.started && state.importTask.resumeFlow &&
        POST_AI_FLOWS.indexOf(state.importTask.resumeFlow) >= 0) {
      go(state.importTask.resumeFlow);
      return;
    }
    if (hasP0Stock()) go('import-overview');
    else go('import-overview');
  }

  function enterHistoryImport() {
    state.emptyPreview = null;
    if (hasHistoryStock()) openHistoryReimportSheet();
    else goHistoryImportStart();
  }

  /* 历史消费导入：v2.45 起复用通用导入流程（选择来源 → 上传 → 识别 → 分档 → 核对 → 完成） */
  function goHistoryImportStart() {
    state.importMode = 'history';
    state.historyAppended = false;
    state.pending.excel = [];
    state.pending.photo = [];
    state.analysisCats = [];
    state.checkData = null;
    state.historyTier = null;
    state.importSelection = { member: false, card: false, price: false, product: false };
    state.importSources = { member: null, card: null, price: null, product: null };
    state.importFiles = { member: [], card: [], price: [], product: [] };
    state.importPhotos = { member: [], card: [], price: [], product: [] };
    state.importTask = { started: false, stage: 'idle', resumeFlow: null, entry: 'home' };
    renderImportBanner();
    go('import-select');
    renderImportSelect();
  }

  function exitHistoryMode() {
    state.importMode = 'main';
    state.historyTier = null;
  }

  /* v2.45：历史消费导入的说明半屏已随专用导入页移除，要点并入「选择导入方式」页内提示 */

  function showImportBanner() {
    clearBannerMute();
    if (!state.importTask.started) setImportStage('idle', null);
    else renderImportBanner();
  }

  function hideImportBanner() {
    muteImportBanner();
    renderImportBanner();
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
    var body = $('#delBatchBody');
    if (body) {
      var bits = ALL_CATS.map(function (k) {
        var n = state.storeStock[k] || BATCH_DEMO[k];
        if (!n) return '';
        return IMPORT_CAT_SHORT[k] + ' <em class="num-em">' + n + '</em> ' + STOCK_UNIT[k];
      }).filter(Boolean);
      body.innerHTML = '将删除本次导入的 ' + bits.join('、') +
        '，已手动补录的条目也会一并删除。删除后需重新导入。';
    }
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
    syncImportFailUI();
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
    var fixed = 0;
    ['f1', 'f2'].forEach(function (id) {
      if (!state.failRemoved[id]) remain += 1;
      // 「已补录」按已填好字段计数（补录即推进），删行只是写回后的收尾
      if (state.failRemoved[id] || state.failFixed[id]) fixed += 1;
    });
    var count = $('#failScreenCount');
    if (count) count.textContent = remain;
    var fixedEl = $('#failFixedCount');
    if (fixedEl) fixedEl.textContent = fixed;
    var totalEl = $('#failTotalCount');
    if (totalEl) totalEl.textContent = 2;
    var bar = $('#failProgressBar');
    if (bar) bar.style.width = (fixed / 2 * 100) + '%';
    var resCount = $('#importFailCount');
    if (resCount) resCount.textContent = remain;
    var resHint = $('#importFailHint');
    if (resHint) resHint.textContent = remain > 0 ? '查看明细' : '已全部补录';
    var resTail = $('#importFailTail');
    if (resTail) resTail.textContent = remain > 0 ? '，可手动补录' : '，已全部补录';
    var resRow = $('#btnImportFailRow');
    if (resRow) {
      resRow.classList.add('hidden');
      resRow.setAttribute('aria-hidden', 'true');
    }
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
        memberNo: String(10001 + i),
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
    go('import-check');
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
    // 迁移中心：概况与引导合并为一屏，历史深链 / 旧跳转一律落到 import-overview
    if (flow === 'import-guide') flow = 'import-overview';
    /* ② 上传 Excel 页已并入选择导入方式 */
    if (flow === 'import-source') flow = 'import-select';
    /* ⑤ 失败/补录入口下线：软跳到对应结果页 */
    if (flow === 'import-fail') flow = 'import-result';
    if (flow === 'history-import-fail') flow = 'history-import-result';
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
    if (flow === 'home') {
      // 评审入口：?banner=1 强制恢复显示（清永久静音）
      try {
        if (new URLSearchParams(location.search).get('banner') === '1') clearBannerMute();
      } catch (err) { /* ignore */ }
      renderImportBanner();
    }
    if (state.importTask.started && POST_AI_FLOWS.indexOf(flow) >= 0) {
      state.importTask.resumeFlow = flow;
      if (flow === 'import-check' || flow === 'import-fail' ||
          flow === 'history-import-preview' || flow === 'history-import-fail') {
        state.importTask.stage = 'check';
      } else if (flow === 'import-result' || flow === 'history-import-result') {
        state.importTask.stage = 'done';
      } else if (flow === 'import-analyze' || flow === 'import-cards' || flow === 'import-confirm') {
        state.importTask.stage = flow === 'import-confirm' ? 'check' : 'analyzing';
      }
      renderImportBanner();
    }
    if (flow === 'import-overview') {
      renderImportOverview();
    }
    if (flow === 'import-select') {      renderImportSelect();
      renderExcelPick();
    }
    if (flow === 'import-source') {
      syncImportSourceModeUI(state.importMode === 'history');
      renderExcelPick();
    }
    if (flow === 'import-camera') {
      renderCamera();
      startCamera();
    }
    if (flow === 'import-analyze') {
      resetAnalysisProgress();
    }
    if (flow === 'import-cards') {
      renderCards();
    }
    if (flow === 'import-confirm') {
      renderConfirmPage();
    }
    if (flow === 'docs-pick') {
      /* list painted by openDocsPick */
    }
    if (flow === 'archive-list') {
      renderArchiveList();
    }
    if (flow === 'digest-list') {
      renderDigestList();
    }
    if (flow === 'digest-detail') {
      renderDigestDetail();
    }
    if (flow === 'source-preview') {
      renderSourcePreview();
    }
    if (flow === 'import-check') {
      renderCheck();
    }
    if (flow === 'history-import-preview') renderHistoryPreview();
    if (flow === 'history-import-result') renderHistoryResult();
    if (flow === 'history-import-fail') renderHistoryFail();
    if (flow === 'members') renderMembersOnce();
    if (flow === 'member-detail') renderMemberDetail();
    if (flow === 'member-history') renderMemberHistory();
    if (flow === 'history-orders') renderHistoryOrders();
    if (flow === 'history-detail') renderHistoryDetail();
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
      // AI 开始后，导入链路标题栏返回统一回首页 / 工作台
      // 例外：失败明细回成功页（data-go=import-result），不出壳
      if (state.importTask.started && el.classList.contains('back')) {
        var sc = el.closest('.screen');
        var flow = sc && sc.getAttribute('data-flow');
        if (flow && flow !== 'import-fail' && flow !== 'history-import-fail' && POST_AI_FLOWS.indexOf(flow) >= 0) {
          e.preventDefault();
          state.emptyPreview = null;
          leaveImportShell();
          return;
        }
      }
      var target = el.getAttribute('data-go');
      if (!target) return;
      state.emptyPreview = null;
      // 从成功页 / 概况「查看」进入业务列表时，返回应回 viewReturn（默认 HTML 写死 workbench）
      if (target === 'workbench' && state.viewReturn && el.classList.contains('back')) {
        var listSc = el.closest('.screen');
        var listFlow = listSc && listSc.getAttribute('data-flow');
        if (listFlow && VIEW_LIST_FLOWS.indexOf(listFlow) >= 0) {
          var ret = state.viewReturn;
          state.viewReturn = null;
          go(ret);
          return;
        }
      }
      // 兼容仍写 data-go="import-result" 的返回（概况查看）
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
        // 有存量时先进引导页并弹温和确认；空店落引导页不弹
        enterMigrate('home');
        if (hasP0Stock()) {
          setTimeout(function () {
            if (state.flow === 'import-overview') openImportClearSheet();
          }, 280);
        }
      });
    }
    if (later) {
      later.addEventListener('click', function () {
        hideInviteSheet();
        state.importTask.entry = 'home';
        showImportBanner();
        go('home');
      });
    }
    var mask = $('#inviteMask');
    if (mask) {
      mask.addEventListener('click', function () {
        hideInviteSheet();
        state.importTask.entry = 'home';
        showImportBanner();
        go('home');
      });
    }
  }

  function bindImportBanner() {
    var main = $('#btnImportBanner');
    var close = $('#btnImportBannerClose');
    if (main) {
      main.addEventListener('click', function () {
        resumeImportTask();
      });
    }
    if (close) {
      close.addEventListener('click', function (e) {
        e.stopPropagation();
        hideImportBanner();
        if (!hasHitWorkbenchImport()) {
          startCoachHomeMore();
        } else {
          showToast('已关闭。可从工作台进入数据导入');
        }
      });
    }
    document.addEventListener('click', function (e) {
      var leave = e.target.closest('[data-leave-import]');
      if (!leave) return;
      e.preventDefault();
      leaveImportShell();
    });
    renderImportBanner();
  }

  /* ===== 数据导入：来源选择 / 拍照 / 待识别清单 ===== */

  function collectPlan() {
    var excel = [];
    var photo = [];
    ALL_CATS.forEach(function (key) {
      if (!state.importSelection[key]) return;
      var src = state.importSources[key];
      if (src === 'photo') photo.push(key);
      else if (src === 'excel') excel.push(key);
    });
    state.importPlan = { excel: excel, photo: photo };
    return state.importPlan;
  }

  function selectedCats() {
    return ALL_CATS.filter(function (k) { return !!state.importSelection[k]; });
  }

  /* ===== 新流程：收来源 → AI 判断类别 → 分类卡片 ===== */

  function pendingTotal() {
    return state.pending.excel.length + state.pending.photo.length;
  }

  // 再导模式（合并 / 清空）必须五类都显式选过，这里给出全空模板
  function blankReimportMode() {
    var out = {};
    ALL_CATS.forEach(function (k) { out[k] = null; });
    return out;
  }

  function resetAnalysis() {
    var blankSel = {};
    var blankSrc = {};
    var blankFiles = {};
    var blankPhotos = {};
    ALL_CATS.forEach(function (k) {
      blankSel[k] = false;
      blankSrc[k] = null;
      blankFiles[k] = [];
      blankPhotos[k] = [];
    });
    state.importSelection = blankSel;
    state.importSources = blankSrc;
    state.importFiles = blankFiles;
    state.importPhotos = blankPhotos;
    state.analysisCats = [];
    state.checkData = null;
    state.convertDone = false;
    state.checkOpen = null;
    state.checkFilter = 'all';
    var blankMode = {};
    ALL_CATS.forEach(function (k) { blankMode[k] = null; });
    state.reimportMode = blankMode;
  }

  function fmtSize(bytes) {
    var n = Number(bytes) || 0;
    if (n >= 1024 * 1024) return (n / 1024 / 1024).toFixed(1) + ' MB';
    if (n >= 1024) return Math.round(n / 1024) + ' KB';
    return Math.max(n, 1) + ' B';
  }

  function pickLocalFiles(accept, multiple, onPick) {
    var input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.multiple = !!multiple;
    input.style.position = 'fixed';
    input.style.left = '-9999px';
    input.setAttribute('aria-hidden', 'true');
    input.addEventListener('change', function () {
      var files = Array.prototype.slice.call(input.files || []);
      if (files.length) onPick(files);
      if (input.parentNode) input.parentNode.removeChild(input);
    });
    document.body.appendChild(input);
    input.click();
  }

  function pendingKey() {
    return 'p' + Date.now().toString(36) + Math.random().toString(16).slice(2, 6);
  }

  /* 原型纯演示：点一下落预设文件，不调系统选择器。
     线上须改为 pickLocalFiles 调真实选择器上传（见 PRD）。
     readablePct = 可识别的已填内容占比；< EXCEL_ARCHIVE_PCT 则整份进原始存档。 */
  var EXCEL_ARCHIVE_PCT = 30;
  var DEMO_EXCEL_FILES = [
    { name: '老店会员与价目.xlsx', size: '1.2 MB', readablePct: 88 },
    { name: '会员卡模板.xlsx', size: '0.4 MB', readablePct: 91 },
    { name: '价目表导入表.xlsx', size: '0.6 MB', readablePct: 85 },
    { name: '店铺产品清单.xlsx', size: '0.5 MB', readablePct: 79 },
    { name: '会员资料补表.xlsx', size: '0.7 MB', readablePct: 22 }
  ];
  // 历史消费没有官方模板：演示数据用老系统 / 收银机导出的消费流水，不复用会员与价目表
  var HISTORY_DEMO_EXCEL_FILES = [
    { name: '收银机_消费流水 2025.xlsx', size: '0.8 MB', readablePct: 93 },
    { name: '老系统_账单导出 2024.xlsx', size: '1.1 MB', readablePct: 88 },
    { name: '手抄流水_转录 2023.xlsx', size: '0.3 MB', readablePct: 76 },
    { name: '会员消费明细_补充.xlsx', size: '0.5 MB', readablePct: 68 },
    { name: '历史账单_扫描转录.xlsx', size: '2.2 MB', readablePct: 24 }
  ];

  function excelReadablePct(f) {
    if (!f) return 90;
    var n = Number(f.readablePct);
    return isFinite(n) ? n : 90;
  }

  function excelIsArchive(f) {
    return excelReadablePct(f) < EXCEL_ARCHIVE_PCT;
  }

  function nextDemoExcel() {
    var used = {};
    state.pending.excel.forEach(function (f) { used[f.name] = true; });
    var i;
    for (i = 0; i < DEMO_EXCEL_FILES.length; i++) {
      if (!used[DEMO_EXCEL_FILES[i].name]) return DEMO_EXCEL_FILES[i];
    }
    return DEMO_EXCEL_FILES[state.pending.excel.length % DEMO_EXCEL_FILES.length];
  }

  function nextHistoryDemoExcel() {
    var used = {};
    state.pending.excel.forEach(function (f) { used[f.name] = true; });
    var i;
    for (i = 0; i < HISTORY_DEMO_EXCEL_FILES.length; i++) {
      if (!used[HISTORY_DEMO_EXCEL_FILES[i].name]) return HISTORY_DEMO_EXCEL_FILES[i];
    }
    return HISTORY_DEMO_EXCEL_FILES[state.pending.excel.length % HISTORY_DEMO_EXCEL_FILES.length];
  }

  function addPendingExcel() {
    if (state.pending.excel.length >= 5) {
      showToast('最多 5 个文件');
      return;
    }
    var demo = state.importMode === 'history' ? nextHistoryDemoExcel() : nextDemoExcel();
    state.pending.excel.push({
      id: pendingKey(),
      name: demo.name,
      size: demo.size,
      readablePct: demo.readablePct,
      demo: true
    });
    renderImportSelect();
    renderExcelPick();
    showToast('已添加演示文件');
  }

  function addPendingPhotos(srcList) {
    (srcList || []).forEach(function (src) {
      state.pending.photo.push({ id: pendingKey(), src: src });
    });
    state.importCameraDemo = false;
    renderImportSelect();
    renderCamera();
  }

  function removePendingExcel(id) {
    state.pending.excel = state.pending.excel.filter(function (f) { return f.id !== id; });
    renderImportSelect();
    renderExcelPick();
  }

  function removePendingPhoto(id) {
    state.pending.photo = state.pending.photo.filter(function (p) { return p.id !== id; });
    renderImportSelect();
    renderCamera();
  }

  function renderExcelPick() {
    var host = $('#excelPickList');
    if (!host) return;
    host.innerHTML = state.pending.excel.map(function (f, i) {
      return '<div class="pending-row">' +
        fmtIcon('xls') +
        '<span class="pending-row__body"><b>' + escHtml(f.name) + '</b><span>' + escHtml(f.size) + ' · 待识别</span></span>' +
        '<button type="button" class="pending-row__del" data-pending-del="' + f.id + '" aria-label="移除第 ' + (i + 1) + ' 个文件">' +
          ACT_ICO.trash + '<span>移除</span></button>' +
      '</div>';
    }).join('');
    host.classList.toggle('hidden', state.pending.excel.length === 0);
  }

  function pendingRoleText() {
    var e = state.pending.excel.length;
    var p = state.pending.photo.length;
    var bits = [];
    if (e) bits.push('Excel ' + e + ' 个');
    if (p) bits.push('照片 ' + p + ' 张');
    return bits.join(' · ');
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
    return (cats || ALL_CATS).reduce(function (s, k) {
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
    var total = pendingTotal();
    var isHist = state.importMode === 'history';
    /* 消费记录没有模板：Excel 与拍照都开放，两种来源可混在一批 */
    var histNote = $('#importHistoryNote');
    if (histNote) histNote.classList.toggle('hidden', !isHist);
    var tplBtn = $('#btnSelectDownloadTpl');
    if (tplBtn) tplBtn.classList.toggle('hidden', !!isHist);
    var photoBtn = $('#btnEnterPhoto');
    if (photoBtn) {
      photoBtn.classList.remove('hidden');
      photoBtn.disabled = false;
    }
    var excelSub = $('#srcExcelSub');
    if (excelSub) {
      excelSub.textContent = isHist
        ? '老系统 / 收银机导出 · xls / xlsx / csv'
        : '表格文件 · xls / xlsx / csv';
    }
    var photoSub = $('#srcPhotoSub');
    if (photoSub) {
      photoSub.textContent = isHist
        ? '纸质流水本、收银小票，对准拍'
        : '纸质价目表、手写本，对准拍';
    }
    var multiNote = $('#sourceMultiNote');
    if (multiNote) {
      multiNote.classList.remove('hidden');
      multiNote.textContent = isHist
        ? '最多 5 份表 + 5 张照片；也可回上一步混着传，传错了在列表里直接删。'
        : '最多 5 个文件；传错了在列表里直接删。';
    }
    var cnt = $('#pendingCount');
    if (cnt) cnt.textContent = total;
    var empty = $('#pendingEmpty');
    if (empty) empty.classList.toggle('hidden', total > 0);
    var head = $('#pendingHead');
    if (head) head.classList.toggle('hidden', total === 0);

    var list = $('#pendingList');
    if (list) {
      var rows = [];
      state.pending.excel.forEach(function (f, i) {
        rows.push('<div class="pending-row">' +
          fmtIcon('xls') +
          '<span class="pending-row__body"><b>' + escHtml(f.name) + '</b><span>' + escHtml(f.size) + ' · Excel</span></span>' +
          '<button type="button" class="pending-row__del" data-pending-del="' + f.id + '" aria-label="移除第 ' + (i + 1) + ' 个文件">' +
            ACT_ICO.trash + '<span>移除</span></button>' +
        '</div>');
      });
      state.pending.photo.forEach(function (p, i) {
        rows.push('<div class="pending-row is-photo">' +
          '<span class="pending-row__thumb">' + (p.src ? '<img src="' + p.src + '" alt="第 ' + (i + 1) + ' 张照片">' : '') + '</span>' +
          '<span class="pending-row__body"><b>照片 ' + (i + 1) + '</b><span>拍照 · 待识别</span></span>' +
          '<button type="button" class="pending-row__del" data-pending-del="' + p.id + '" aria-label="移除第 ' + (i + 1) + ' 张照片">' +
            ACT_ICO.trash + '<span>移除</span></button>' +
        '</div>');
      });
      list.innerHTML = rows.join('');
      list.classList.toggle('hidden', rows.length === 0);
    }

    var btn = $('#btnImportAnalyze');
    if (btn) {
      btn.disabled = total === 0;
      btn.textContent = total === 0 ? '先添加数据' : '开始识别（' + total + ' 份）';
    }
    var scw = $('#selectClearWarn');
    if (isHist) {
      if (scw) { scw.hidden = true; scw.textContent = ''; }
      return;
    }
    if (scw) {
      var labs = ALL_CATS.filter(function (k) {
        return (state.storeStock[k] || 0) > 0;
      }).map(function (k) { return IMPORT_CAT_SHORT[k]; });
      if (labs.length && total > 0) {
        scw.hidden = false;
        scw.className = 'soft-tip soft-tip--warn soft-tip--inline';
        scw.innerHTML = '<span class="soft-tip__ico" aria-hidden="true">i</span><span>开始识别后，将<strong>清空</strong>店内已有的「' +
          labs.join('、') + '」再写入本批。</span>';
      } else {
        scw.hidden = true;
        scw.textContent = '';
      }
    }
  }

  /* ---- 识别中 ---- */

  var analyzeTimerA = null;
  var analyzeTimerB = null;

  function resetAnalysisProgress() {
    if (state.analyzing) return;
    $all('[data-ana-step]').forEach(function (el) { el.classList.remove('is-on', 'is-done'); });
    var eq = $('#analyzeEq');
    if (eq) eq.classList.remove('is-run', 'is-done');
    var btn = $('#btnAnalyzeSkip');
    if (btn) { btn.disabled = false; btn.textContent = '跳过等待'; }
  }

  /** Figma / 深链：定格识别中页（历史与主链文案不同） */
  function paintAnalyzeStatic(isHist) {
    var labels = isHist
      ? ['读取文件', '抽取日期与金额', '对齐顾客姓名']
      : ['读取文件', '判断类别', '对齐字段'];
    labels.forEach(function (t, i) {
      var el = $('#anaLabel' + i);
      if (el) el.textContent = t;
    });
    var titleEl = $('#analyzeTitle');
    var leadEl = $('#analyzeLead');
    if (titleEl) titleEl.textContent = isHist ? '正在读这批老账单' : '正在看这批数据';
    if (leadEl) leadEl.textContent = isHist
      ? '抽取日期、金额、顾客姓名，其余列原样保留'
      : '读取表头、比对字段，判断属于哪几类';
    var fileNames = (state.pending.excel || []).map(function (f) { return f.name; });
    if ((state.pending.photo || []).length) {
      fileNames = fileNames.concat((state.pending.photo || []).map(function (_, i) { return '照片 ' + (i + 1); }));
    }
    if (!fileNames.length) fileNames = [isHist ? '老店收银流水.xlsx' : '（本批文件）'];
    var em0 = $('#anaEm0');
    var em1 = $('#anaEm1');
    var em2 = $('#anaEm2');
    if (em0) em0.textContent = fileNames[0];
    if (em1) em1.textContent = isHist ? '历史消费' : '会员资料';
    if (em2) em2.textContent = isHist ? '消费日期' : '会员姓名';
    var steps = $all('[data-ana-step]');
    steps.forEach(function (el, i) {
      el.classList.toggle('is-done', i === 0);
      el.classList.toggle('is-on', i === 1);
    });
    var eq = $('#analyzeEq');
    if (eq) {
      eq.classList.add('is-run');
      eq.classList.remove('is-done');
    }
    var btn = $('#btnAnalyzeSkip');
    if (btn) { btn.disabled = true; btn.textContent = '识别中…'; }
  }

  function startAnalysis() {
    if (state.analyzing) return;
    if (!pendingTotal()) {
      showToast('先添加 Excel 或拍照');
      return;
    }
    resetAnalysis();
    state.analyzing = true;
    setImportStage('analyzing', 'import-analyze');
    go('import-analyze');
    var steps = $all('[data-ana-step]');
    steps.forEach(function (el) { el.classList.remove('is-on', 'is-done'); });
    var eq = $('#analyzeEq');
    if (eq) {
      eq.classList.remove('is-done');
      eq.classList.add('is-run');
    }
    var btn = $('#btnAnalyzeSkip');
    if (btn) { btn.disabled = true; btn.textContent = '识别中…'; }

    var fileNames = (state.pending.excel || []).map(function (f) { return f.name; });
    if (!(state.pending.photo || []).length && !fileNames.length) fileNames = ['（本批文件）'];
    if ((state.pending.photo || []).length) {
      fileNames = fileNames.concat((state.pending.photo || []).map(function (_, i) { return '照片 ' + (i + 1); }));
    }
          var isHist = state.importMode === 'history';
          var catNames = isHist ? ['历史消费'] : ['会员资料', '卡模板', '价目表·项目', '价目表·产品'];
          var fieldNames = isHist
            ? ['消费日期', '实收金额', '顾客姓名', '支付方式']
            : ['会员姓名', '手机号', '卡名称', '有效期', '项目名', '价格', '产品名称', '是否上架'];
          var titleEl = $('#analyzeTitle');
          var leadEl = $('#analyzeLead');
          var labels = isHist
            ? ['读取文件', '抽取日期与金额', '对齐顾客姓名']
            : ['读取文件', '判断类别', '对齐字段'];
          labels.forEach(function (t, i) {
            var el = $('#anaLabel' + i);
            if (el) el.textContent = t;
          });
          if (titleEl) titleEl.textContent = isHist ? '正在读这批老账单' : '正在看这批数据';
          if (leadEl) leadEl.textContent = isHist
            ? '抽取日期、金额、顾客姓名，其余列原样保留'
            : '读取表头、比对字段，判断属于哪几类';
    var em0 = $('#anaEm0');
    var em1 = $('#anaEm1');
    var em2 = $('#anaEm2');
    var rot = { f: 0, c: 0, d: 0 };
    function paintEmRotate() {
      if (em0) em0.textContent = fileNames[rot.f % fileNames.length];
      if (em1) em1.textContent = catNames[rot.c % catNames.length];
      if (em2) em2.textContent = fieldNames[rot.d % fieldNames.length];
      rot.f += 1; rot.c += 1; rot.d += 1;
    }
    paintEmRotate();
    var tickTimer = setInterval(paintEmRotate, 520);
    state.analyzeTimers = [tickTimer];

    clearTimeout(analyzeTimerA);
    clearTimeout(analyzeTimerB);
    analyzeTimerA = setTimeout(function () {
      if (steps[0]) steps[0].classList.add('is-on');
    }, 60);
    analyzeTimerB = setTimeout(function () {
      if (steps[0]) { steps[0].classList.remove('is-on'); steps[0].classList.add('is-done'); }
      if (steps[1]) steps[1].classList.add('is-on');
    }, 720);
    state.analyzeTimers.push(analyzeTimerA, analyzeTimerB);
    state.analyzeTimers.push(setTimeout(function () {
      if (steps[1]) { steps[1].classList.remove('is-on'); steps[1].classList.add('is-done'); }
      if (steps[2]) steps[2].classList.add('is-on');
    }, 1400));
    state.analyzeTimers.push(setTimeout(function () {
      clearInterval(tickTimer);
      if (steps[2]) { steps[2].classList.remove('is-on'); steps[2].classList.add('is-done'); }
      if (eq) { eq.classList.remove('is-run'); eq.classList.add('is-done'); }
      if (em0) em0.textContent = '完成';
      if (em1) em1.textContent = '完成';
      if (em2) em2.textContent = '完成';
      commitAnalysis();
    }, 2200));
  }

  function skipAnalysis() {
    if (!state.analyzing) {
      if (!state.analysisCats.length) startAnalysis();
      return;
    }
    (state.analyzeTimers || []).forEach(function (t) {
      clearTimeout(t);
      clearInterval(t);
    });
    state.analyzeTimers = [];
    $all('[data-ana-step]').forEach(function (el) {
      el.classList.remove('is-on');
      el.classList.add('is-done');
    });
    var eq = $('#analyzeEq');
    if (eq) { eq.classList.remove('is-run'); eq.classList.add('is-done'); }
    commitAnalysis();
  }

  /* 演示剧本：有 Excel → 四类；只有照片 → 价目项目 / 产品；两者都有 → 四类。 */
  function analysisScript() {
    var hasExcel = state.pending.excel.length > 0;
    var hasPhoto = state.pending.photo.length > 0;
    if (hasExcel && hasPhoto) return ALL_CATS.slice();
    if (hasPhoto) return ['price', 'product'];
    return ['member', 'card', 'price', 'product'];
  }

  /** 已有同类数据 → 一律清空再导 */
  function applyForcedReplaceModes() {
    ALL_CATS.forEach(function (k) {
      if (state.importSelection[k] && (state.storeStock[k] || 0) > 0) {
        state.reimportMode[k] = 'replace';
      } else if (state.importSelection[k]) {
        state.reimportMode[k] = 'replace';
      }
    });
  }

  function clearConflictLabels() {
    return ALL_CATS.filter(function (k) {
      return state.importSelection[k] && (state.storeStock[k] || 0) > 0;
    }).map(function (k) { return IMPORT_CAT_SHORT[k]; });
  }

  function commitAnalysis() {
    if (state.importMode === 'history') { commitHistoryAnalysis(); return; }
    var cats = analysisScript();
    var excelCats = [];
    var photoCats = [];
    var i;
    for (i = 0; i < cats.length; i += 1) {
      var hasE = state.pending.excel.length > 0;
      var hasP = state.pending.photo.length > 0;
      // 交替分配：Excel 与照片都有的批次，按 2:1 分给两类来源
      var usePhoto = hasP && (!hasE || i % 3 === 1);
      if (usePhoto) photoCats.push(cats[i]);
      else excelCats.push(cats[i]);
      state.importSelection[cats[i]] = true;
      state.importSources[cats[i]] = usePhoto ? 'photo' : 'excel';
    }
    // 真实文件名落到 Excel 类；带上 readablePct（<30% 整份仅存档）
    state.pending.excel.forEach(function (f, idx) {
      var cat = excelCats[idx % Math.max(excelCats.length, 1)];
      if (cat) {
        state.importFiles[cat].push({
          name: f.name,
          size: f.size,
          readablePct: excelReadablePct(f),
          id: f.id
        });
      }
    });
    state.pending.photo.forEach(function (p, idx) {
      var cat = photoCats[idx % Math.max(photoCats.length, 1)];
      if (cat) state.importPhotos[cat].push({ id: p.id, src: p.src });
    });
    // 没有对应文件形态的类别：给一个演示文件名（默认可识别率充足）
    excelCats.forEach(function (k) {
      if (!state.importFiles[k].length) {
        state.importFiles[k].push({ name: IMPORT_CAT[k] + '.xlsx', size: '0.6 MB', readablePct: 90 });
      }
    });
    photoCats.forEach(function (k) {
      if (!state.importPhotos[k].length) {
        state.importPhotos[k].push({ id: 'demo-' + k, src: '' });
      }
    });
    state.analysisCats = cats;
    state.analyzing = false;
    state.checkData = null;
    state.tierResult = { l1: [], l2: [], l3Cats: [] };
    collectPlan();
    seedTierDemo();
    applyForcedReplaceModes();
    ensureCheckData();
    renderCards();
    renderConfirmPage();
    setImportStage('check', 'import-check');
    go('import-check');
  }

  /* ---- 历史消费：只有两层（识别摘要 / 原始存档），没有可直接入库 ---- */
  function commitHistoryAnalysis() {
    state.analyzing = false;
    state.checkData = null;
    state.analysisCats = ['history'];
    state.importSelection = { member: false, card: false, price: false, product: false };
    state.tierResult = { l1: [], l2: [], l3Cats: [] };
    state.historyTier = buildHistoryTier();
    state.histMonthOpen = null;
    renderCards();
    setImportStage('check', 'history-import-preview');
    go('history-import-preview');
  }

  function buildHistoryTier() {
    var rows = historyRows();
    var archive = [];
    var files = [];
    (state.pending.excel || []).forEach(function (f) {
      files.push(f.name);
      if (excelReadablePct(f) < EXCEL_ARCHIVE_PCT) {
        archive.push({ name: f.name, note: '可识别内容不足 ' + EXCEL_ARCHIVE_PCT + '%，整份仅存档备查' });
      }
    });
    var photos = state.pending.photo || [];
    photos.forEach(function (p, i) {
      files.push('照片 ' + (i + 1));
    });
    /* 演示：多张照片时留一张「字迹模糊」进原始存档 */
    if (photos.length > 1) {
      archive.push({ name: '照片 ' + photos.length + ' · 字迹模糊', note: '整张无法识别，仅存档备查' });
    }
    if (!photos.length) {
      archive.push({ name: '纸质流水本扫描.pdf', note: '扫描件无法识别，仅存档' });
    }
    return {
      digest: rows.length,
      total: rows.reduce(function (s, r) { return s + Number(r.amount || 0); }, 0),
      fail: HISTORY_FAIL_ROWS.length,
      archive: archive,
      excelCount: (state.pending.excel || []).length,
      photoCount: photos.length,
      files: files
    };
  }

  /* 核对页「确认导入」：走同一套进度，写入历史订单 */
  function submitHistoryImport() {
    if (state.historyImporting) return;
    state.historyImporting = true;
    var btn = $('#btnHistoryPreviewConfirm');
    if (btn) btn.disabled = true;
    var hasPhotos = (state.pending.photo || []).length > 0;
    runImportProgress({
      title: '正在导入历史消费',
      sub: hasPhotos
        ? '按原样写入历史订单，只识别日期 / 金额 / 顾客姓名'
        : '按原样写入历史订单，只识别日期 / 金额 / 顾客姓名',
      stages: [
        { at: 0, label: '读取本批数据' },
        { at: 34, label: '识别日期 / 金额 / 顾客姓名' },
        { at: 72, label: '写入历史订单' }
      ],
      duration: 2000,
      doneLabel: '导入完成',
      onDone: function () {
        state.historyImporting = false;
        if (btn) btn.disabled = false;
        state.historyDeleted = false;
        state.historyImported = true;
        var batchN = HISTORY_ROWS.length;
        /* v2.50：一律清空再导，写入本批条数（不再追加合并） */
        state.storeStock.history = batchN;
        state.historyAppended = false;
        state.historyReimportIntent = null;
        setImportStage('done', 'history-import-result');
        go('history-import-result');
      }
    });
  }

  /* 状态补拍用：直接给出「已识别、待核对」的历史批次 */
  function seedHistoryDemoBatch() {
    state.importMode = 'history';
    state.historyAppended = false;
    state.pending.photo = [];
    state.pending.excel = [{ id: 'hist-demo-xlsx', name: '收银机_消费流水 2025.xlsx', size: '0.8 MB', readablePct: 93, demo: true }];
    state.importSelection = { member: false, card: false, price: false, product: false };
    state.importSources = { member: null, card: null, price: null, product: null };
    state.importFiles = { member: [], card: [], price: [], product: [] };
    state.importPhotos = { member: [], card: [], price: [], product: [] };
    state.analysisCats = ['history'];
    state.historyTier = buildHistoryTier();
    state.histMonthOpen = null;
    state.importTask = { started: true, stage: 'check', resumeFlow: 'history-import-preview', entry: 'home' };
    renderImportBanner();
  }

  function addHistoryDemoFile() {
    if ((state.pending.excel || []).length) return;
    state.pending.excel = [{ id: 'hist-demo-xlsx', name: '收银机_消费流水 2025.xlsx', size: '0.8 MB', readablePct: 93, demo: true }];
    renderExcelPick();
  }

  /* ---- 三档识别总览 ---- */

  function ensureTierDemo() {
    if (state.tierResult && (state.tierResult.l1.length || state.tierResult.l2.length || state.tierResult.l3Cats.length)) {
      return;
    }
    seedTierDemo();
  }

  function catFilesAllArchived(k) {
    var files = (state.importFiles && state.importFiles[k]) || [];
    if (!files.length) return false;
    if (state.importSources[k] === 'photo') return false;
    return files.every(excelIsArchive);
  }

  function guessDomainFromFileName(name) {
    var s = String(name || '');
    if (/会员|持卡/.test(s)) return 'member';
    if (/卡模板|卡种|会员卡/.test(s)) return 'card';
    if (/价目|项目/.test(s)) return 'price';
    if (/库存|盘点/.test(s)) return 'product';
    if (/产品|卖品/.test(s)) return 'product';
    if (/流水|收银|账单/.test(s)) return 'order';
    return 'member';
  }

  /** 订单流水域演示存档（B1）：主链无 order 类别时仍保证 ···→原始存档可点通 */
  function ensureOrderArchiveDemo() {
    ensureTierDemo();
    if (!state.tierResult.l1) state.tierResult.l1 = [];
    var has = state.tierResult.l1.some(function (x) { return x.domain === 'order'; });
    if (has) return;
    state.tierResult.l1.push(
      {
        id: 'a-order-xls',
        domain: 'order',
        name: '老店收银流水导出.xlsx',
        kind: 'excel',
        size: '1.1 MB',
        note: '列名杂乱，无法结构化，仅作原始存档备查'
      },
      {
        id: 'a-order-scan',
        domain: 'order',
        name: '纸质流水本扫描.pdf',
        kind: 'excel',
        size: '2.4 MB',
        note: '扫描件无法识别，仅存档'
      }
    );
  }

  /* 内部英文字段键 → 中文展示名（对齐 CHECK_FIELDS.label） */
  function checkFieldLabel(cat, key) {
    if (!key) return '字段';
    var list = (typeof CHECK_FIELDS !== 'undefined' && CHECK_FIELDS[cat]) || [];
    for (var i = 0; i < list.length; i++) {
      if (list[i].key === key) return list[i].label;
    }
    return key;
  }

  function digestFromErrorRow(cat, row) {
    var f = row.f || {};
    var title = (typeof checkRowTitle === 'function' ? checkRowTitle(cat, row) : '') ||
      ((IMPORT_CAT_SHORT[cat] || cat) + ' · 未达门槛');
    var fails = (row.problems || []).filter(function (p) { return p.level === 'error'; }).map(function (p) {
      var key = p.field || '';
      return {
        key: key,
        k: key ? checkFieldLabel(cat, key) : '字段',
        v: p.msg || '无法入库',
        edit: ''
      };
    });
    if (!fails.length) fails = [{ key: '', k: '入库', v: '未达必填或含无法识别内容', edit: '' }];
    var fields = [];
    Object.keys(f).forEach(function (key) {
      if (fields.length >= 4) return;
      if (fieldEmpty(f[key]) || isUnreadableText(f[key])) return;
      if (moneyUnreadable(f[key]) || (typeof f[key] === 'string' && intUnreadable(f[key]) && /qty|times|count|duration|stock/i.test(key))) return;
      fields.push({ key: key, k: checkFieldLabel(cat, key), v: String(f[key]) });
    });
    var srcFile = ((state.importFiles[cat] || [])[0] || {}).name || '本批表格';
    return {
      id: 'd-' + cat + '-' + row.id,
      domain: cat,
      title: title,
      looseText: fails.map(function (x) { return x.v; }).join('；'),
      fields: fields,
      fails: fails,
      source: { kind: 'excel', name: srcFile, label: '系统存放的 Excel' }
    };
  }

  function seedTierDemo() {
    ensureCheckData();

    /* 整份 Excel 可识别已填 <30% → 仅存档；该类若只有这类文件则不进可入库 */
    ALL_CATS.forEach(function (k) {
      if (!state.importSelection[k]) return;
      if (!catFilesAllArchived(k)) return;
      state.importSelection[k] = false;
      if (state.checkData) delete state.checkData[k];
    });

    var l1 = [];
    var seenArch = {};
    function pushArch(item) {
      if (!item || !item.name || seenArch[item.name]) return;
      seenArch[item.name] = true;
      l1.push(item);
    }

    state.pending.excel.forEach(function (f) {
      if (!excelIsArchive(f)) return;
      pushArch({
        id: f.id || ('a-xls-' + f.name),
        domain: guessDomainFromFileName(f.name),
        name: f.name,
        kind: 'excel',
        size: f.size || '',
        note: '可识别已填内容约 ' + excelReadablePct(f) + '%（不足 ' + EXCEL_ARCHIVE_PCT + '%），整份仅存档'
      });
    });
    ALL_CATS.forEach(function (k) {
      (state.importFiles[k] || []).forEach(function (f) {
        if (!excelIsArchive(f)) return;
        pushArch({
          id: f.id || ('a-xls-' + f.name),
          domain: k,
          name: f.name,
          kind: 'excel',
          size: f.size || '',
          note: '可识别已填内容约 ' + excelReadablePct(f) + '%（不足 ' + EXCEL_ARCHIVE_PCT + '%），整份仅存档'
        });
      });
    });

    /* 演示：原始存档区至少有样例，避免常年空态 */
    pushArch({
      id: 'a-demo-blur',
      domain: 'member',
      name: '会员登记本（反光）.jpg',
      kind: 'photo',
      size: '0.8 MB',
      note: '反光严重，关键列不可读'
    });
    pushArch({
      id: 'a-demo-card',
      domain: 'card',
      name: '旧卡种对照表（手写）.jpg',
      kind: 'photo',
      size: '0.5 MB',
      note: '手写潦草，无法结构化'
    });
    pushArch({
      id: 'a-demo-mess',
      domain: 'price',
      name: '2019价目表扫描件.pdf',
      kind: 'excel',
      size: '0.4 MB',
      note: '版式杂乱，可识别已填不足 30%，整份仅存档'
    });
    pushArch({
      id: 'a-demo-prod',
      domain: 'product',
      name: '卖品进货单（模糊）.jpg',
      kind: 'photo',
      size: '0.7 MB',
      note: '字迹不清，无法结构化'
    });
    pushArch({
      id: 'a-order-xls',
      domain: 'order',
      name: '老店收银流水导出.xlsx',
      kind: 'excel',
      size: '1.1 MB',
      note: '列名杂乱，无法结构化，仅作原始存档备查'
    });
    pushArch({
      id: 'a-order-scan',
      domain: 'order',
      name: '纸质流水本扫描.pdf',
      kind: 'excel',
      size: '2.4 MB',
      note: '扫描件无法识别，仅存档'
    });
    if (state.pending.photo.length) {
      pushArch({ id: 'a-ph-1', domain: 'price', name: '墙贴价目（半张裁切）.jpg', kind: 'photo', size: '0.6 MB', note: '画面不全，无法结构化' });
    }

    var l2 = [];
    var perCat = {};
    ALL_CATS.forEach(function (k) {
      if (!state.importSelection[k]) return;
      recomputeCheck(k);
      checkRows(k).forEach(function (r) {
        if (r.ignored || !rowHasLevel(r, 'error')) return;
        perCat[k] = (perCat[k] || 0) + 1;
        if (perCat[k] > 4) return;
        l2.push(digestFromErrorRow(k, r));
      });
    });

    var l3Cats = ALL_CATS.filter(function (k) {
      return state.importSelection[k] && checkStats(k).importable > 0;
    });

    state.tierResult = { l1: l1, l2: l2, l3Cats: l3Cats };

    var hasCardFile = !!state.importSelection.card;
    var hasPriceFile = !!state.importSelection.price;
    var deriveCards = !hasCardFile && !!state.importSelection.member;
    var derivePrices = !hasPriceFile && !!state.importSelection.member;

    state.confirmItems = {
      acknowledged: false,
      cards: [
        { id: 'c1', name: '黄金卡', desc: '充 2000 送 200 · 全场 8 折', validity: '2027-12-31', holders: '296', fromMember: deriveCards, selected: false },
        { id: 'c2', name: '8 折卡', desc: '充 1000 送 100 · 全场 8 折', validity: '2026-06-30', holders: '296', fromMember: deriveCards, selected: false },
        { id: 'c3', name: '银卡（疑似已停）', desc: '充 500 送 50 · 老客续充', validity: '—', holders: '34', fromMember: deriveCards || hasCardFile, selected: false },
        { id: 'c4', name: '2018 体验卡', desc: '限时开卡礼 · 多店已停用', validity: '—', holders: '—', fromMember: false, selected: false }
      ],
      prices: [
        { id: 'p1', name: '剪发', desc: '项目 · ¥68 / 次', kind: 'price', fromMember: derivePrices, selected: false },
        { id: 'p2', name: '烫发', desc: '项目 · ¥288 / 次', kind: 'price', fromMember: derivePrices, selected: false },
        { id: 'p3', name: '染发', desc: '项目 · ¥368 / 次', kind: 'price', fromMember: derivePrices, selected: false },
        { id: 'p4', name: '头皮护理（旧价）', desc: '项目 · ¥128 / 次 · 价签年份较早', kind: 'price', fromMember: derivePrices, selected: false },
        { id: 'pr1', name: '护色洗发水', desc: '产品 · ¥98', kind: 'product', fromMember: false, selected: false },
        { id: 'pr2', name: '造型喷雾', desc: '产品 · ¥68', kind: 'product', fromMember: false, selected: false }
      ]
    };
    if (!hasCardFile && !deriveCards) state.confirmItems.cards = [];
    if (!hasPriceFile && !derivePrices) state.confirmItems.prices = [];
    if (hasCardFile && !deriveCards) {
      state.confirmItems.cards.forEach(function (c) { c.fromMember = false; });
    }
    if (hasPriceFile && !derivePrices) {
      state.confirmItems.prices.forEach(function (p) { p.fromMember = false; });
    }
  }

  function tierOverviewHtml() {
    var t = state.tierResult;
    var l1 = t.l1 || [];
    var l2 = t.l2 || [];
    var l3 = t.l3Cats || [];
    var okBody = l3.length
      ? l3.map(function (k) {
          var st = checkStats(k);
          return '<div class="tier-card tier-card--ok">' +
            '<span class="cat-card__ico" aria-hidden="true">' + (CAT_ICO[k] || '') + '</span>' +
            '<span class="tier-card__body">' +
            '<div class="tier-card__title">' + IMPORT_CAT[k] + '</div>' +
            '<div class="tier-card__meta">可入库 ' + st.importable + ' ' + CAT_UNIT[k] +
              (st.error ? ' · ' + st.error + ' 条未达门槛' : '') + '</div>' +
            '</span>' +
            '<span class="tier-card__okmark" aria-hidden="true"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg></span>' +
            '</div>';
        }).join('')
      : '<div class="tier-empty">本批没有可直接导入的数据</div>';
    var digBody = l2.length
      ? '<ul class="tier-mute-list">' + l2.map(function (d) {
          var reason = (d.fails && d.fails[0] && d.fails[0].v) || '未达入库门槛';
          return '<li><b>' + esc(d.title) + '</b><span>' + esc(DOMAIN_LABEL[d.domain] || IMPORT_CAT_SHORT[d.domain] || '') + ' · ' + esc(reason) + '</span></li>';
        }).join('') + '</ul>'
      : '<p class="tier-mute-empty">暂无</p>';
    var rawBody = l1.length
      ? '<ul class="tier-mute-list">' + l1.map(function (f) {
          return '<li><b>' + esc(f.name) + '</b><span>' + esc(f.note || '看不清') + '</span></li>';
        }).join('') + '</ul>'
      : '<p class="tier-mute-empty">暂无</p>';
    return '<section class="tier-sec tier-sec--ok">' +
        '<div class="tier-sec__hd"><h3>这些可放心导入</h3><em>' + l3.length + ' 类</em></div>' +
        okBody +
      '</section>' +
      '<section class="tier-sec tier-sec--mute">' +
        '<div class="tier-mute-card">' +
          '<div class="tier-sec__hd"><h3>识别摘要</h3><em>' + l2.length + ' 条</em></div>' +
          '<p class="tier-mute-tip">缺必填，或已填字段无法识别 / 数字解析失败。不会入库；可在业务页 ··· →「识别摘要」查看或补全。</p>' +
          digBody +
        '</div>' +
      '</section>' +
      '<section class="tier-sec tier-sec--mute">' +
        '<div class="tier-mute-card">' +
          '<div class="tier-sec__hd"><h3>原始存档</h3><em>' + l1.length + ' 份</em></div>' +
          '<p class="tier-mute-tip">整份 Excel 可识别已填内容不足 ' + EXCEL_ARCHIVE_PCT + '%，或照片/表格无法解析。已留原件，可在 ··· →「原始存档」查看。</p>' +
          rawBody +
        '</div>' +
      '</section>';
  }

  function historyTierOverviewHtml() {
    var t = state.historyTier || buildHistoryTier();
    var digBody = t.digest
      ? '<ul class="tier-mute-list">' +
          '<li><b>共 ' + t.digest + ' 笔 · 合计 ' + fmtMoney(t.total) + '</b><span>日期 / 金额 / 顾客姓名已抽出，其余列原样保留</span></li>' +
          (t.fail ? '<li><b>' + t.fail + ' 行未识别</b><span>缺日期或缺金额，不会写入历史订单</span></li>' : '') +
        '</ul>'
      : '<p class="tier-mute-empty">暂无</p>';
    var rawBody = t.archive.length
      ? '<ul class="tier-mute-list">' + t.archive.map(function (f) {
          return '<li><b>' + esc(f.name) + '</b><span>' + esc(f.note || '看不清') + '</span></li>';
        }).join('') + '</ul>'
      : '<p class="tier-mute-empty">暂无</p>';
    return '<section class="tier-sec tier-sec--mute">' +
        '<div class="tier-mute-card">' +
          '<div class="tier-sec__hd"><h3>识别摘要</h3><em>' + t.digest + ' 条</em></div>' +
          '<p class="tier-mute-tip">历史消费没有「可直接入库」这一档：核对完只写入「历史订单」，不进订单流水、不计业绩与会员余额。</p>' +
          digBody +
        '</div>' +
      '</section>' +
      '<section class="tier-sec tier-sec--mute">' +
        '<div class="tier-mute-card">' +
          '<div class="tier-sec__hd"><h3>原始存档</h3><em>' + t.archive.length + ' 份</em></div>' +
          '<p class="tier-mute-tip">无法解析的整份文件已留原件，可在历史订单页 ··· →「原始存档」查看。</p>' +
          rawBody +
        '</div>' +
      '</section>';
  }

  function renderCards() {
    var host = $('#cardsList');
    var empty = $('#cardsEmpty');
    var next = $('#btnCardsNext');
    var head = $('#cardsHead');
    var lead = $('#cardsLead');
    var hasAny;
    if (state.importMode === 'history') {
      if (head) head.textContent = '识别完成';
      if (lead) lead.textContent = '历史消费只有两层：能对上日期 / 金额 / 顾客姓名的进「识别摘要」，其余留原件存档。';
      hasAny = true;
      if (host) host.innerHTML = historyTierOverviewHtml();
      if (empty) empty.classList.add('hidden');
      if (next) {
        next.disabled = false;
        next.textContent = '去核对';
        next.setAttribute('data-go', 'history-import-preview');
      }
      return;
    }
    ensureCheckData();
    ensureTierDemo();
    if (head) head.textContent = '识别完成';
    if (lead) lead.textContent = '先看能放心导入的；其余已帮你保存，可随时去查。';
    hasAny = state.tierResult.l1.length || state.tierResult.l2.length || state.tierResult.l3Cats.length;
    if (host) host.innerHTML = hasAny ? tierOverviewHtml() : '';
    if (empty) empty.classList.toggle('hidden', !!hasAny);
    if (next) {
      next.disabled = false;
      next.textContent = '返回核对导入';
      next.setAttribute('data-go', 'import-check');
    }
  }

  function renderConfirmPage() {
    ensureTierDemo();
    var host = $('#confirmBody');
    if (!host) return;
    var cards = state.confirmItems.cards || [];
    var prices = state.confirmItems.prices || [];
    function itemHtml(it, kind) {
      var meta = '';
      if (kind === 'cards') {
        meta = '<span class="confirm-item__meta">有效期 ' + esc(it.validity || '—') +
          ' · 持卡 ' + esc(it.holders || '—') + '</span>';
      }
      return '<button type="button" class="confirm-item' + (it.selected ? ' is-on' : '') +
        '" data-confirm-kind="' + kind + '" data-confirm-id="' + it.id + '">' +
        '<span class="confirm-item__check" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg></span>' +
        '<span class="confirm-item__body"><span class="confirm-item__title">' + esc(it.name) +
        (it.fromMember ? '<span class="confirm-tag">从会员资料识别</span>' : '') +
        '</span><span class="confirm-item__desc">' + esc(it.desc) + '</span>' + meta + '</span></button>';
    }
    var html = '';
    if (cards.length) {
      var nOn = cards.filter(function (c) { return c.selected; }).length;
      html += '<div class="confirm-group"><div class="confirm-group__hd"><h3>会员卡模板</h3><span>已选 ' + nOn + ' / ' + cards.length + '</span></div>' +
        cards.map(function (c) { return itemHtml(c, 'cards'); }).join('') + '</div>';
    }
    if (prices.length) {
      var proj = prices.filter(function (c) { return c.kind !== 'product'; });
      var prods = prices.filter(function (c) { return c.kind === 'product'; });
      if (proj.length) {
        var pOn = proj.filter(function (c) { return c.selected; }).length;
        html += '<div class="confirm-group"><div class="confirm-group__hd"><h3>价目表·项目</h3><span>已选 ' + pOn + ' / ' + proj.length + '</span></div>' +
          proj.map(function (c) { return itemHtml(c, 'prices'); }).join('') + '</div>';
      }
      if (prods.length) {
        var dOn = prods.filter(function (c) { return c.selected; }).length;
        html += '<div class="confirm-group"><div class="confirm-group__hd"><h3>价目表·产品</h3><span>已选 ' + dOn + ' / ' + prods.length + '</span></div>' +
          prods.map(function (c) { return itemHtml(c, 'prices'); }).join('') + '</div>';
      }
    }
    if (!cards.length && !prices.length) {
      html = '<div class="tier-empty">本批未识别到卡模板或价目，可直接进入核对。</div>';
    }
    host.innerHTML = html;
    var note = $('#confirmFootNote');
    if (note) {
      note.textContent = (cards.length || prices.length)
        ? '不选的不会导入；可在识别摘要里再看。'
        : '没有需要确认的卡 / 价目，可返回核对。';
    }
    var next = $('#btnConfirmNext');
    if (next) next.textContent = '完成，返回核对';
  }

  function toggleConfirmItem(kind, id) {
    var list = state.confirmItems[kind] || [];
    list.forEach(function (it) {
      if (it.id === id) it.selected = !it.selected;
    });
    state.confirmItems.acknowledged = true;
    renderConfirmPage();
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
        delete state.uploadStd[key];
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

  function goCardsNext() {
    ensureTierDemo();
    var hasAny = state.tierResult.l1.length || state.tierResult.l2.length || state.tierResult.l3Cats.length;
    if (!hasAny && !selectedCats().length) {
      showToast('没有识别到数据，回去重新添加');
      go('import-select');
      return;
    }
    setImportStage('analyzing', 'import-confirm');
    go('import-confirm');
  }

  function goConfirmNext() {
    var cards = state.confirmItems.cards || [];
    var prices = state.confirmItems.prices || [];
    if ((cards.length || prices.length) && !state.confirmItems.acknowledged) {
      state.confirmItems.acknowledged = true;
      showToast('已记录：未选的卡 / 价目不会导入');
    }
    var selCard = cards.some(function (c) { return c.selected; });
    var selPrice = prices.some(function (p) { return p.selected; });
    if (cards.length && !selCard) state.importSelection.card = false;
    if (prices.length && !selPrice) {
      state.importSelection.price = false;
      state.importSelection.product = false;
    }
    if (selCard) state.importSelection.card = true;
    if (selPrice) {
      state.importSelection.price = true;
      state.importSelection.product = true;
    }
    collectPlan();
    applyForcedReplaceModes();
    ensureCheckData();
    setImportStage('check', 'import-check');
    go('import-check');
  }

  function openReimportModeSheet() {
    applyForcedReplaceModes();
    hideReimportModeSheet();
    return;
    var list = $('#reimportModeList');
    var need = selectedCats().filter(function (k) { return (state.storeStock[k] || 0) > 0; });
    if (!list) return;
    list.innerHTML = need.map(function (k) {
      var n = state.storeStock[k];
      var mode = state.reimportMode[k];
      return '<div class="reimport-row" data-reimport-cat="' + k + '">' +
        '<div class="reimport-row__lab"><b>' + IMPORT_CAT_SHORT[k] + '</b><span>已有 ' + n + ' ' + STOCK_UNIT[k] + '</span></div>' +
        '<div class="reimport-row__opts" role="radiogroup" aria-label="' + IMPORT_CAT[k] + '">' +
          '<button type="button" class="reimport-chip' + (mode === 'merge' ? ' is-on' : '') +
            '" data-reimport-mode="merge" data-reimport-for="' + k + '" role="radio" aria-checked="' +
            (mode === 'merge' ? 'true' : 'false') + '">合并</button>' +
          '<button type="button" class="reimport-chip is-danger' + (mode === 'replace' ? ' is-on' : '') +
            '" data-reimport-mode="replace" data-reimport-for="' + k + '" role="radio" aria-checked="' +
            (mode === 'replace' ? 'true' : 'false') + '">清空再导</button>' +
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
      member: { n: '#stockMember', t: '#stockMemberTag' },
      card: { n: '#stockCard', t: '#stockCardTag' },
      price: { n: '#stockPrice', t: '#stockPriceTag' },
      product: { n: '#stockProd', t: '#stockProdTag' }
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
    // 迁移中心双形态：首次进入看流程，已有存量看库存
    var any = hasP0Stock();
    var hubStock = $('#hubStock');
    if (hubStock) hubStock.classList.toggle('hidden', !any);
    var cta = $('#btnOverviewContinue');
    if (cta) cta.textContent = any ? '重新导入' : '开始导入';
    var del = $('#btnOverviewDelete');
    if (del) del.classList.toggle('hidden', !any);
  }

  function openImportClearSheet() {
    var mask = $('#importClearMask');
    var sheet = $('#importClearSheet');
    if (mask) {
      mask.classList.add('show');
      mask.setAttribute('aria-hidden', 'false');
    }
    if (sheet) sheet.classList.add('show');
  }

  function hideImportClearSheet() {
    var mask = $('#importClearMask');
    var sheet = $('#importClearSheet');
    if (mask) {
      mask.classList.remove('show');
      mask.setAttribute('aria-hidden', 'true');
    }
    if (sheet) sheet.classList.remove('show');
  }

  /** 有存量时先温和确认「会换成新数据」；空店直接进选源 */
  function startImportFromOverview() {
    state.reimportMode = blankReimportMode();
    if (hasP0Stock()) {
      openImportClearSheet();
      return;
    }
    go('import-select');
  }

  function openHistoryReimportSheet() {
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
    ALL_CATS.forEach(function (k) {
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
    var bits = [];
    var host = $('#resultStockList');
    var rows = [];
    ALL_CATS.forEach(function (k) {
      if (!state.importSelection[k]) return;
      var mode = state.reimportMode[k];
      var total = state.storeStock[k] || BATCH_DEMO[k];
      var tag = '已导入';
      var tagCls = 'is-on';
      if (mode === 'merge') {
        var d = MERGE_DEMO[k];
        tag = '新增 ' + d.add + ' · 更新 ' + d.upd;
        bits.push(IMPORT_CAT_SHORT[k] + ' 合并');
      } else if (mode === 'replace') {
        tag = '已清空后写入';
        bits.push(IMPORT_CAT_SHORT[k] + ' 覆盖');
      }
      rows.push('<button type="button" class="v3-stock__row" data-result-view="' + k + '">' +
        '<span class="v3-stock__ico" aria-hidden="true">' + (CAT_ICO[k] || '') + '</span>' +
        '<span class="v3-stock__label">' + IMPORT_CAT_SHORT[k] + '</span>' +
        '<span class="v3-stock__tag ' + tagCls + '">' + tag + '</span>' +
        '<span class="v3-stock__val"><em>' + total + '</em> ' + STOCK_UNIT[k] + '</span>' +
        '<svg class="v3-stock__chev" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>' +
      '</button>');
    });
    if (host) host.innerHTML = rows.join('');
    var mergeEl = $('#importResultMerge');
    if (mergeEl) {
      if (bits.length) {
        mergeEl.textContent = '本批处理：' + bits.join('；') + '。同键规则：手机号 / 卡名称 / 项目名 / 商品名 / 产品名。';
        mergeEl.classList.remove('hidden');
      } else {
        mergeEl.classList.add('hidden');
        mergeEl.textContent = '';
      }
    }
  }

  /* ---- 拍照 ---- */

  function openCamera() {
    state.camRailOpen = false;
    state.camDrawerOpen = false;
    closeCamPreview();
    go('import-camera');
    startCamWatermarkRotate();
    var drawer = $('#camAlbumDrawer');
    if (drawer) {
      drawer.classList.toggle('is-open', !!state.camDrawerOpen);
      var handle = $('#btnCamDrawer');
      if (handle) handle.setAttribute('aria-expanded', state.camDrawerOpen ? 'true' : 'false');
    }
  }

  function stopCamera() {
    stopCamWatermarkRotate();
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
    var txt = note && note.querySelector('.cam-demo__text');
    if (txt) txt.textContent = '这里拿不到相机取景，可用左下角「照片」从相册选，或点重试';
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

  /* 历史消费样张：老店流水本 / 收银小票转录，只含日期 / 顾客 / 项目 / 金额 / 支付方式 */
  var HISTORY_SHOT_ROWS = [
    ['2025-12-28', '李女士', '染发 + 护理', '¥1,280', '微信'],
    ['2025-12-19', '王先生', '洗剪吹', '¥168', '现金'],
    ['2025-11-30', '张女士', '烫发', '¥680', '支付宝'],
    ['2025-11-09', '陈先生', '头皮护理', '¥268', '微信'],
    ['2025-10-21', '刘女士', '染发', '¥398', '储值卡'],
    ['2025-09-15', '赵先生', '洗剪吹', '¥88', '微信'],
    ['2025-08-02', '孙女士', '烫染套餐', '¥1,580', '银行卡'],
    ['2025-06-18', '（未留名）', '洗剪吹', '¥128', '现金'],
    ['2025-04-06', '周女士', '护理年卡首付', '¥520', '微信'],
    ['2025-01-12', '吴先生', '造型', '¥240', '支付宝']
  ];

  function makeHistoryDemoShot(idx) {
    var W = 520;
    var H = 680;
    var c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    var g = c.getContext('2d');
    /* 纸张：略偏黄的信笺底，模拟手写流水本拍照 */
    g.fillStyle = '#e6dfd2';
    g.fillRect(0, 0, W, H);
    g.fillStyle = '#fffdf7';
    g.fillRect(22, 22, W - 44, H - 44);
    g.fillStyle = '#8a7a63';
    g.fillRect(22, 22, W - 44, 3);
    g.fillStyle = '#1b1b1b';
    g.font = 'bold 22px "Microsoft YaHei",sans-serif';
    g.fillText('老店流水本', 44, 76);
    g.fillStyle = '#9b9b9b';
    g.font = '13px "Microsoft YaHei",sans-serif';
    g.fillText('第 ' + idx + ' 页 · 手抄转录 · 演示照片', 44, 100);
    var heads = ['日期', '顾客', '项目', '金额', '支付'];
    var xs = [44, 132, 200, 372, 428];
    var top = 124;
    var rh = 46;
    var rows = 10;
    g.fillStyle = '#f4efe6';
    g.fillRect(36, top, W - 72, 36);
    g.fillStyle = '#5c5245';
    g.font = 'bold 13px "Microsoft YaHei",sans-serif';
    heads.forEach(function (h, i) { g.fillText(h, xs[i], top + 23); });
    /* 手写本的横线 */
    g.strokeStyle = '#e6ded0';
    g.lineWidth = 1;
    for (var i = 0; i <= rows; i += 1) {
      var y = top + 36 + i * rh;
      g.beginPath();
      g.moveTo(36, y + 0.5);
      g.lineTo(W - 36, y + 0.5);
      g.stroke();
    }
    g.font = '13px "Microsoft YaHei",sans-serif';
    g.fillStyle = '#3a3a3a';
    for (i = 0; i < rows; i += 1) {
      var r = HISTORY_SHOT_ROWS[(idx * 3 + i) % HISTORY_SHOT_ROWS.length];
      var yy = top + 36 + i * rh + 28;
      g.fillText(r[0], xs[0], yy);
      g.fillText(r[1], xs[1], yy);
      g.fillText(r[2], xs[2], yy);
      g.fillStyle = '#1b1b1b';
      g.fillText(r[3], xs[3], yy);
      g.fillStyle = '#3a3a3a';
      g.fillText(r[4], xs[4], yy);
    }
    g.fillStyle = '#a09585';
    g.font = '12px "Microsoft YaHei",sans-serif';
    g.fillText('以上为演示数据，仅用于展示识别流程', 44, H - 46);
    return c.toDataURL('image/jpeg', 0.85);
  }

  function makeDemoShot(idx) {
    if (state.importMode === 'history') return makeHistoryDemoShot(idx);
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
    g.font = 'bold 22px "Microsoft YaHei",sans-serif';
    g.fillText('拍照样张 ' + idx, 46, 76);
    g.fillStyle = '#9b9b9b';
    g.font = '14px "Microsoft YaHei",sans-serif';
    g.fillText('演示照片 · 仅用于展示识别流程', 46, 102);
    g.fillStyle = '#faf7f3';
    g.fillRect(40, 122, W - 80, 40);
    g.font = 'bold 15px "Microsoft YaHei",sans-serif';
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
    g.font = '15px "Microsoft YaHei",sans-serif';
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
    /* 动画结束后必须摘掉类，否则伪元素回落到不透明白底，取景会一直发白 */
    window.setTimeout(function () { vf.classList.remove('is-flash'); }, 320);
  }

  var CAM_WM_TEMPLATES = [
    { heads: ['会员编号', '会员姓名', '手机号', '卡种', '余额'] },
    { heads: ['卡名称', '卡类型', '充值', '折扣', '有效期'] },
    { heads: ['项目名', '项目组', '价格', '可开单', '时长'] },
    { heads: ['产品名', '分类', '售价', '上架', '库存'] }
  ];
  // 历史消费：只认日期 / 顾客 / 金额，取景水印固定为流水本表头
  var CAM_WM_TEMPLATES_HISTORY = [
    { heads: ['消费日期', '顾客姓名', '项目', '金额', '支付方式'] }
  ];
  function camWmTemplates() {
    return state.importMode === 'history' ? CAM_WM_TEMPLATES_HISTORY : CAM_WM_TEMPLATES;
  }
  var camWmTimer = null;
  var camWmIdx = 0;

  function paintCamWatermark() {
    var tpls = camWmTemplates();
    var tpl = tpls[camWmIdx % tpls.length];
    var grid = $('#camWmGrid');
    if (grid) {
      /* 只画表头：下方不再有表体线框，避免五列在窄屏被挤压成变形网格 */
      grid.innerHTML = '<thead><tr>' +
        tpl.heads.map(function (c) { return '<th>' + c + '</th>'; }).join('') +
        '</tr></thead>';
    }
  }

  function startCamWatermarkRotate() {
    stopCamWatermarkRotate();
    camWmIdx = 0;
    paintCamWatermark();
    /* 历史消费只有一套流水本表头，不轮换 */
    if (camWmTemplates().length < 2) return;
    camWmTimer = setInterval(function () {
      camWmIdx = (camWmIdx + 1) % camWmTemplates().length;
      paintCamWatermark();
    }, 2000);
  }

  function stopCamWatermarkRotate() {
    if (camWmTimer) clearInterval(camWmTimer);
    camWmTimer = null;
  }

  function syncCamWatermark() {
    paintCamWatermark();
  }

  var DEMO_ALBUMS = {};
  function demoAlbumShots() {
    var mode = state.importMode === 'history' ? 'history' : 'main';
    if (DEMO_ALBUMS[mode]) return DEMO_ALBUMS[mode];
    DEMO_ALBUMS[mode] = [1, 2, 3, 4, 5, 6, 7, 8].map(function (i) {
      return { id: 'album-' + mode + '-' + i, src: makeDemoShot(100 + i) };
    });
    return DEMO_ALBUMS[mode];
  }

  function camPhotoIndexBySrc(src) {
    var idx = -1;
    state.pending.photo.forEach(function (p, i) { if (p.src === src) idx = i; });
    return idx;
  }

  function toggleAlbumPick(src) {
    var idx = camPhotoIndexBySrc(src);
    if (idx >= 0) {
      state.pending.photo.splice(idx, 1);
      renderCamera();
      return;
    }
    if (state.pending.photo.length >= 5) { showToast('最多选 5 张'); return; }
    state.pending.photo.push({
      id: 'a' + Date.now().toString(36) + Math.random().toString(16).slice(2, 5),
      src: src
    });
    /* 相册选完把已选栏展开，让用户立刻看到它进了快门左侧的叠图 */
    state.camRailOpen = true;
    renderCamera();
  }

  /* ---- 叠图 ⇄ 已选照片行：照片从叠图飞进上一行，收起时再飞回叠图 ---- */
  function camMotionOff() {
    return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }

  function camStackTopRect(stackEl) {
    var top = stackEl ? stackEl.querySelector('img.cam-stack__top') : null;
    if (top) {
      var r = top.getBoundingClientRect();
      if (r.width && r.height) return r;
    }
    var base = stackEl ? stackEl.getBoundingClientRect() : null;
    if (!base || (!base.width && !base.height)) return null;
    var w = 46;
    return {
      left: base.left + (base.width - w) / 2,
      top: base.top + (base.height - w) / 2,
      width: w,
      height: w
    };
  }

  /* 从 fromRect 飞向 toRect；fadeOut=true 时终点淡出（收起方向） */
  function camFlyPhoto(src, fromRect, toRect, opts) {
    if (!src || !fromRect || !toRect || !fromRect.width) return null;
    var o = opts || {};
    var fly = document.createElement('img');
    fly.className = 'cam-fly';
    fly.alt = '';
    fly.src = src;
    fly.style.left = fromRect.left + 'px';
    fly.style.top = fromRect.top + 'px';
    fly.style.width = fromRect.width + 'px';
    fly.style.height = fromRect.height + 'px';
    document.body.appendChild(fly);
    var dx = toRect.left - fromRect.left;
    var dy = toRect.top - fromRect.top;
    var s = (toRect.width || fromRect.width) / fromRect.width;
    var anim = null;
    if (typeof fly.animate === 'function') {
      anim = fly.animate([
        { transform: 'translate(0,0) scale(1)', opacity: 1 },
        { transform: 'translate(' + dx + 'px,' + dy + 'px) scale(' + s + ')', opacity: o.fadeOut ? 0 : 1 }
      ], {
        duration: o.duration || 340,
        delay: o.delay || 0,
        easing: 'cubic-bezier(.22,.9,.28,1)',
        fill: 'forwards'
      });
    }
    var kill = function () { if (fly.parentNode) fly.parentNode.removeChild(fly); };
    if (anim) anim.onfinish = kill;
    window.setTimeout(kill, (o.delay || 0) + (o.duration || 340) + 260);
    return fly;
  }

  function camStackPulse(stackEl) {
    var top = stackEl ? stackEl.querySelector('img.cam-stack__top') : null;
    if (!top || typeof top.animate !== 'function') return;
    top.animate([
      { transform: 'scale(1)' },
      { transform: 'scale(.86)' },
      { transform: 'scale(1)' }
    ], { duration: 380, easing: 'ease-out' });
  }

  function camRailItems() {
    var rail = $('#camPickedRail');
    if (!rail) return [];
    return Array.prototype.slice.call(rail.querySelectorAll('.cam-rail__item'));
  }

  /* 展开：叠图里的照片逐张飞进上一行的格位 */
  function camRailOpenFly() {
    if (camMotionOff()) return;
    var stackEl = $('#btnCamStack');
    var stackRect = camStackTopRect(stackEl);
    var srcs = state.pending.photo.slice(-5);
    if (!stackRect || !srcs.length) return;
    var items = camRailItems();
    if (!items.length) return;
    camStackPulse(stackEl);
    items.forEach(function (item, i) {
      var p = srcs[i] || srcs[srcs.length - 1];
      var rect = item.getBoundingClientRect();
      if (!rect.width) return;
      var delay = i * 45;
      camFlyPhoto(p.src, stackRect, rect, { duration: 340, delay: delay });
      /* 真身延后淡入，避免和飞行图叠出重影 */
      if (typeof item.animate === 'function') {
        item.animate([
          { opacity: 0, transform: 'scale(.82)' },
          { opacity: 1, transform: 'scale(1)' }
        ], { duration: 220, delay: delay + 210, easing: 'ease-out', fill: 'backwards' });
      }
    });
  }

  /* 收起：先量旧格位 → 再重绘 → 照片飞回叠图并缩小淡出 */
  function camRailCollapseFly(rects) {
    if (camMotionOff() || !rects.length) return;
    var stackEl = $('#btnCamStack');
    var stackRect = camStackTopRect(stackEl);
    if (!stackRect) return;
    camStackPulse(stackEl);
    rects.slice().reverse().forEach(function (r, i) {
      camFlyPhoto(r.src, r.rect, stackRect, { duration: 320, delay: i * 40, fadeOut: true });
    });
  }

  function camRailItemRects() {
    return camRailItems().map(function (item) {
      var img = item.querySelector('img');
      return { src: img ? img.getAttribute('src') : '', rect: item.getBoundingClientRect() };
    }).filter(function (o) { return o.src && o.rect.width; });
  }

  function renderCamera() {
    var list = state.pending.photo;
    var strip = $('#importCameraStrip');
    if (strip) {
      strip.innerHTML = list.length
        ? list.map(function (p, i) { return shotThumbHtml(p, i, true, ''); }).join('')
        : '';
    }
    var stack = $('#btnCamStack');
    var layers = $('#camStackLayers');
    if (stack) stack.classList.toggle('has-shots', list.length > 0);
    if (layers) {
      /* 最上面一张显示真实照片，下面两层用灰阶层次垫底 */
      layers.innerHTML = list.length
        ? '<i class="cam-stack__ghost is-1"></i><i class="cam-stack__ghost is-2"></i>' +
          '<img class="cam-stack__top" src="' + list[list.length - 1].src + '" alt="">'
        : '';
    }
    var rail = $('#camPickedRail');
    if (rail) {
      if (state.camRailOpen && list.length) {
        rail.classList.remove('hidden');
        rail.innerHTML = list.slice(-5).map(function (p) {
          return '<span class="cam-rail__item">' +
            '<img src="' + p.src + '" alt="">' +
            '<button type="button" class="cam-rail__x" data-rail-del="' + p.id + '" aria-label="取消选择这张">×</button>' +
          '</span>';
        }).join('');
      } else {
        rail.classList.add('hidden');
        rail.innerHTML = '';
      }
    }
    var grid = $('#camAlbumGrid');
    var shots = demoAlbumShots();
    var albumMode = state.importMode === 'history' ? 'history' : 'main';
    if (grid && grid.dataset.mode !== albumMode) {
      grid.dataset.mode = albumMode;
      grid.innerHTML = shots.map(function (p, i) {
        return '<button type="button" class="cam-album" data-album-idx="' + i + '">' +
          '<img src="' + p.src + '" alt="">' +
          '<span class="cam-album__check" data-album-check="1" role="checkbox" aria-checked="false" aria-label="选择这张">' +
            '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>' +
          '</span>' +
        '</button>';
      }).join('');
    }
    if (grid) {
      Array.prototype.forEach.call(grid.querySelectorAll('[data-album-idx]'), function (btn) {
        var i = parseInt(btn.getAttribute('data-album-idx'), 10) || 0;
        var on = shots[i] ? camPhotoIndexBySrc(shots[i].src) >= 0 : false;
        btn.classList.toggle('is-on', on);
        var check = btn.querySelector('.cam-album__check');
        if (check) check.setAttribute('aria-checked', on ? 'true' : 'false');
      });
    }
    if (state.camPreviewOpen) syncCamPreview();
    syncCamWatermark();
  }

  function syncCamPreview() {
    var shots = demoAlbumShots();
    var idx = Math.max(0, Math.min(state.camPreviewIdx || 0, shots.length - 1));
    state.camPreviewIdx = idx;
    var shot = shots[idx];
    if (!shot) return;
    var img = $('#camPreviewImg');
    if (img) img.src = shot.src;
    var on = camPhotoIndexBySrc(shot.src) >= 0;
    var pick = $('#btnCamPreviewPick');
    if (pick) {
      pick.textContent = on ? '取消选择' : '选择这张';
      pick.classList.toggle('is-on', on);
    }
  }

  function camAlbumThumbRect(idx) {
    var btn = document.querySelector('#camAlbumGrid [data-album-idx="' + idx + '"]');
    if (!btn) return null;
    var img = btn.querySelector('img') || btn;
    return img.getBoundingClientRect();
  }

  function camPreviewImgTargetRect() {
    var vf = $('#importCameraVf') || $('#screen-import-camera');
    if (!vf) return { left: 40, top: 120, width: 310, height: 420 };
    var r = vf.getBoundingClientRect();
    var w = Math.min(r.width * 0.86, 320);
    var h = Math.min(r.height * 0.62, 440);
    return {
      left: r.left + (r.width - w) / 2,
      top: r.top + (r.height - h) / 2,
      width: w,
      height: h
    };
  }

  function openCamPreview(idx) {
    state.camPreviewOpen = true;
    state.camPreviewIdx = idx;
    syncCamPreview();
    var el = $('#camPreview');
    if (!el) return;
    el.classList.remove('hidden');
    el.classList.add('is-open');
    var shot = demoAlbumShots()[idx];
    var from = camAlbumThumbRect(idx);
    var to = camPreviewImgTargetRect();
    var img = $('#camPreviewImg');
    if (img) {
      img.style.opacity = '0';
      window.setTimeout(function () { img.style.opacity = ''; }, camMotionOff() ? 0 : 280);
    }
    if (shot && from && !camMotionOff()) {
      camFlyPhoto(shot.src, from, to, { duration: 360 });
    }
  }

  function closeCamPreview(opts) {
    if (!state.camPreviewOpen && !($('#camPreview') && !$('#camPreview').classList.contains('hidden'))) {
      state.camPreviewOpen = false;
      return;
    }
    var o = opts || {};
    var idx = state.camPreviewIdx;
    var shot = demoAlbumShots()[idx];
    var el = $('#camPreview');
    var img = $('#camPreviewImg');
    var from = img ? img.getBoundingClientRect() : null;
    var to = camAlbumThumbRect(idx);
    state.camPreviewOpen = false;
    if (shot && from && to && from.width && !camMotionOff() && !o.skipFly) {
      if (img) img.style.opacity = '0';
      camFlyPhoto(shot.src, from, to, { duration: 320, fadeOut: true });
    }
    if (el) {
      el.classList.remove('is-open');
      el.classList.add('hidden');
    }
    if (img) img.style.opacity = '';
  }

  function captureShot() {
    var src = null;
    var video = $('#importCameraVideo');
    if (!state.importCameraDemo && video && video.videoWidth) {
      var c = document.createElement('canvas');
      c.width = video.videoWidth;
      c.height = video.videoHeight;
      c.getContext('2d').drawImage(video, 0, 0, c.width, c.height);
      src = c.toDataURL('image/jpeg', 0.85);
    }
    if (!src) src = makeDemoShot(state.pending.photo.length + 1);
    state.pending.photo.push({
      id: 'p' + Date.now().toString(36) + Math.random().toString(16).slice(2, 6),
      src: src
    });
    flashShutter();
    renderCamera();
    showToast('已拍第 ' + state.pending.photo.length + ' 张');
  }

  function deleteShot(id) {
    var list = state.pending.photo;
    var idx = -1;
    list.forEach(function (p, i) { if (p.id === id) idx = i; });
    if (idx === -1) return;
    list.splice(idx, 1);
    renderCamera();
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
        '<span class="up-step__num">' + (done ? '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>' : (i + 1)) + '</span>' +
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
        list.innerHTML = '<p class="queue-empty">没有待上传的类别</p>';
      } else {
        var files = catFiles(cur);
        var full = files.length >= MAX_FILES_PER_CAT;
        var rows = files.map(function (f, i) {
          return '<div class="upload-file">' +
            fmtIcon('xls') +
            '<span class="upload-file__body"><b>' + f.name + '</b><span>' + f.size + '</span></span>' +
            '<button type="button" class="upload-row__del" data-clear-file="' + cur + '" data-file-idx="' + i + '" aria-label="移除"></button>' +
          '</div>';
        }).join('');
        list.innerHTML = '<div class="upload-row' + (files.length ? ' is-done' : '') + ' is-hi">' +
          '<span class="upload-row__cat">' + IMPORT_CAT[cur] + '</span>' +
          '<div class="upload-row__body">' +
            (files.length
              ? '<span class="upload-row__cnt">已选 ' + files.length + ' / ' + MAX_FILES_PER_CAT + ' 个表</span>' +
                '<div class="upload-files">' + rows + '</div>'
              : '<b>未选择文件</b><span>xls / xlsx / csv · ≤10MB · 最多 3 个</span>') +
          '</div>' +
          '<button type="button" class="upload-row__pick" data-pick-for="' + cur + '"' + (full ? ' disabled' : '') + '>' +
            (full ? '已达上限' : (files.length ? '再添加' : '选择文件')) +
          '</button>' +
        '</div>' +
        (files.length > 1
          ? '<p class="upload-multi-note">同类多表需列名一致</p>'
          : '');
      }
    }

    // 选好非标准表后才出现 AI 转换入口；用户可按标准模板自行标注（默认非标准）
    var aiRow = $('#uploadAiRow');
    var aiBadge = $('#uploadAiBadge');
    var aiText = $('#uploadAiText');
    var stdToggle = $('#uploadStdToggle');
    var picked = cur ? catFiles(cur) : [];
    if (aiRow) {
      var std = !!(picked.length && state.uploadStd[cur]);
      aiRow.classList.toggle('hidden', !picked.length);
      aiRow.classList.toggle('is-std', std);
      if (aiBadge) aiBadge.innerHTML = std
        ? '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="#fff" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>'
        : '<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true"><path d="M15.7757 5.77566L16.4308 3.81026H17.5692L18.2243 5.77566L20.1897 6.43079V7.56921L18.2243 8.22434L17.5692 10.1897H16.4308L15.7757 8.22434L13.8103 7.56921V6.43079L15.7757 5.77566Z"/><path d="M18 12V19H16V12H18Z"/><path fill-rule="evenodd" clip-rule="evenodd" d="M7.33731 6H10.6627L14.033 19H11.9668L11.1891 16H6.81084L6.03306 19H3.96694L7.33731 6ZM7.32936 14H10.6706L9.11508 8H8.88491L7.32936 14Z"/></svg>';
      if (aiText) aiText.textContent = std ? '标准模板，完美识别' : '其它表也能识别，可能要多核对';
      if (stdToggle) {
        stdToggle.checked = std;
        stdToggle.disabled = !picked.length;
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

  /* 演示选文件：不调系统选择器，直接落假文件 */
  function pickFileFor(cat) {
    var arr = catFiles(cat);
    if (arr.length >= MAX_FILES_PER_CAT) {
      showToast('最多 ' + MAX_FILES_PER_CAT + ' 个表，先移除一个');
      return;
    }
    var n = arr.length + 1;
    state.importFiles[cat] = arr.concat([{
      name: IMPORT_CAT[cat] + '导入表' + (n > 1 ? ' ' + n : '') + '.xlsx',
      size: '1.2 MB'
    }]);
    state.convertDone = false;
    showToast('已添加演示文件');
    renderUploadList();
    renderImportSelect();
  }

  /* 相册 / 系统相机：手机通过 http 访问时 getUserMedia 不可用（非安全上下文），
     这条入口用 input[type=file][capture] 调系统相机，是手机上唯一能拿到真照片的路。 */
  function pickPhotoFor() {
    pickLocalFiles('image/*', true, function (files) {
      var added = 0;
      var pending = [];
      files.forEach(function (f) {
        if (!/^image\//.test(f.type || '')) return;
        added += 1;
        pending.push(f);
      });
      if (!added) { showToast('没有可用的图片'); return; }
      var srcs = [];
      var left = added;
      pending.forEach(function (f) {
        var fr = new FileReader();
        fr.onload = function () {
          srcs.push(String(fr.result || ''));
          left -= 1;
          if (left === 0) {
            addPendingPhotos(srcs);
            showToast('已加入 ' + srcs.length + ' 张照片');
          }
        };
        fr.onerror = function () {
          left -= 1;
          if (left === 0 && srcs.length) {
            addPendingPhotos(srcs);
            showToast('已加入 ' + srcs.length + ' 张照片');
          }
        };
        fr.readAsDataURL(f);
      });
    });
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
        '<div class="queue-summary__line"><b>' + fileTotal + ' Excel</b><i>+</i><b>' + shots + ' 照片</b></div>' +
        '<div class="queue-summary__chips">' +
          plan.excel.concat(plan.photo).map(planChipHtml).join('') +
        '</div>';
    }
    var ec = $('#queueExcelCount');
    if (ec) ec.textContent = fileTotal + ' Excel';
    var pc = $('#queuePhotoCount');
    if (pc) pc.textContent = shots + ' 照片';

    var list = $('#queueExcelList');
    if (list) {
      var rows = [];
      files.forEach(function (k) {
        catFiles(k).forEach(function (f, i) {
          rows.push('<div class="queue-file">' +
            fmtIcon('xls') +
            '<span class="queue-file__body"><b>' + f.name + '</b><span>' + IMPORT_CAT_SHORT[k] + ' · ' + f.size + '</span></span>' +
            '<button type="button" class="queue-file__act" data-queue-file-change="' + k + '">' + ACT_ICO.swap + '<span>' + (catFiles(k).length > 1 ? '管理' : '更换') + '</span></button>' +
            '<button type="button" class="queue-file__act queue-file__act--del" data-clear-file="' + k + '" data-file-idx="' + i + '">' + ACT_ICO.trash + '<span>删除</span></button>' +
          '</div>');
        });
      });
      list.innerHTML = rows.length ? rows.join('') : '<p class="queue-empty">本批没有 Excel，照片将直接识别</p>';
    }

    var groups = $('#queuePhotoGroups');
    if (groups) {
      groups.innerHTML = plan.photo.length ? plan.photo.map(function (k) {
        var arr = state.importPhotos[k];
        return '<div class="queue-group">' +
          '<div class="queue-group__head"><b>' + IMPORT_CAT_SHORT[k] + '</b>' +
            '<span>' + arr.length + ' 照片</span>' +
            '<button type="button" class="queue-group__recam" data-queue-recam="' + k + '">补拍</button>' +
          '</div>' +
          (arr.length
            ? '<div class="queue-group__thumbs">' + arr.map(function (p, i) { return shotThumbHtml(p, i, true, k); }).join('') + '</div>'
            : '<div class="queue-list"><p class="queue-empty">还没有照片，点「补拍」继续</p></div>') +
        '</div>';
      }).join('') : '<div class="queue-list"><p class="queue-empty">本批没有照片</p></div>';
    }

    var note = $('#queueNote');
    if (note) {
      note.textContent = (files.length && plan.photo.length)
        ? 'Excel 与照片会统一进入识别'
        : (plan.photo.length ? '照片会进入识别流程' : 'Excel 会进入识别流程');
    }
  }

  function startRecognition() {
    /* 残留：旧队列页入口已下线；主路径走「开始识别」→ analyze */
    go('import-analyze');
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
          '<span class="map-tab__state">' + (ok ? '已确认' : '待确认') + '</span>' +
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
      go('import-check');
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
        go('import-check');
      });
    }
    var skip = $('#btnTplGenSkip');
    if (skip) {
      skip.addEventListener('click', function () {
        state.tplGenIncluded = [];
        go('import-check');
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
    if (state.importMode === 'history') {
      var t = state.historyTier || buildHistoryTier();
      var names = (t.files && t.files.length) ? t.files.join('、') : '历史消费.xlsx';
      el.textContent = '本批来源：' + names + ' · AI 识别';
      return;
    }
    var plan = collectPlan();
    var files = totalFiles(plan.excel);
    var shots = plan.photo.reduce(function (s, k) { return s + state.importPhotos[k].length; }, 0);
    var parts = [];
    if (files) parts.push('Excel ' + files + ' 个');
    if (shots) parts.push('照片 ' + shots + ' 张');
    if (files || shots) parts.push('AI 识别');
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
  var CHECK_UNIT = { member: '行', card: '行', price: '项', product: '个' };
  var CHECK_LV_LABEL = { error: '需修正', warn: '建议确认', ignored: '已忽略', ok: '可导入' };

  /* v2.25 可入库门槛：必填齐全即可导；任一字段（含选填）文字无法识别或金额/数字解析失败 → 不可导。
     列名对齐 excel模板/ 官方表头（见 PRD §15.7）。 */
  /* 卡模板权益列：按官方 5 sheet 区分（见 CARD_FIELDS_BY_TYPE） */
  var CARD_BENEFIT_KEYS = ['discount', 'rechargeDiscount', 'bonus', 'bonusDiscount', 'times', 'scope', 'scopeItems', 'gift', 'memberPrice', 'pkgMode', 'pkgItems', 'pkgScopeTimes', 'pkgScopeItems', 'pkgCommonTimes', 'includeItems'];

  /* 官方 RTB店铺卡模板导入文档模版-v2 · 按卡类型字段（不含序号） */
  var CARD_FIELDS_BY_TYPE = {
    '储值卡': [
      { key: 'name', label: '卡名', req: true },
      { key: 'price', label: '充值余额', type: 'money', req: true },
      { key: 'rechargeDiscount', label: '充值金额享受折扣', ph: '如 8.5' },
      { key: 'bonus', label: '赠送金额', type: 'money' },
      { key: 'bonusDiscount', label: '赠送金额享受折扣', ph: '如 8.5' },
      { key: 'gift', label: '赠送项目', ph: '小气泡:1;基础护理:2' },
      { key: 'memberPrice', label: '会员价项目', ph: '理发:打折,9.9' },
      { key: 'validity', label: '有效期限（月）', ph: '留空永久' },
      { key: 'desc', label: '卡项说明' },
      { key: 'shopCode', label: '连锁店编码', more: true }
    ],
    '计次卡': [
      { key: 'name', label: '卡名', req: true },
      { key: 'price', label: '购买价格', type: 'money', req: true },
      { key: 'times', label: '次数', type: 'number', req: true },
      { key: 'scope', label: '适用大类' },
      { key: 'scopeItems', label: '适用项目' },
      { key: 'gift', label: '赠送项目' },
      { key: 'validity', label: '有效期限（月）' },
      { key: 'desc', label: '卡项说明' },
      { key: 'shopCode', label: '连锁店编码', more: true }
    ],
    '折扣卡': [
      { key: 'name', label: '卡名', req: true },
      { key: 'price', label: '购买价格', type: 'money', req: true },
      { key: 'discount', label: '享受折扣', ph: '如 8.5', req: true },
      { key: 'gift', label: '赠送项目' },
      { key: 'memberPrice', label: '会员价项目' },
      { key: 'validity', label: '有效期限（月）' },
      { key: 'desc', label: '卡项说明' },
      { key: 'shopCode', label: '连锁店编码', more: true }
    ],
    '套餐卡': [
      { key: 'name', label: '卡名', req: true },
      { key: 'price', label: '购买价格', type: 'money', req: true },
      { key: 'pkgMode', label: '套餐卡项目模式', ph: '项目明细 / 范围 / 通用' },
      { key: 'pkgItems', label: '适用项目-项目明细清单', ph: '小气泡:1;基础护理:2' },
      { key: 'pkgScopeTimes', label: '适用项目范围-次数', type: 'number' },
      { key: 'pkgScopeItems', label: '适用项目范围-项目清单' },
      { key: 'pkgCommonTimes', label: '项目通用-次数', type: 'number' },
      { key: 'gift', label: '赠送项目' },
      { key: 'validity', label: '有效期限（月）' },
      { key: 'desc', label: '卡项说明' },
      { key: 'shopCode', label: '连锁店编码', more: true }
    ],
    '周期卡': [
      { key: 'name', label: '卡名', req: true },
      { key: 'price', label: '购买价格', type: 'money', req: true },
      { key: 'includeItems', label: '包含项目', ph: '小气泡;基础护理' },
      { key: 'gift', label: '赠送项目' },
      { key: 'validity', label: '有效期限（月）' },
      { key: 'desc', label: '卡项说明' },
      { key: 'shopCode', label: '连锁店编码', more: true }
    ]
  };

  function cardFieldsForType(type) {
    return CARD_FIELDS_BY_TYPE[type] || CARD_FIELDS_BY_TYPE['储值卡'];
  }

  function cardHasBenefit(f) {
    var type = f.type || '储值卡';
    var keys = {
      '储值卡': ['rechargeDiscount', 'bonus', 'bonusDiscount', 'gift', 'memberPrice'],
      '计次卡': ['times', 'scope', 'scopeItems', 'gift'],
      '折扣卡': ['discount', 'gift', 'memberPrice'],
      '套餐卡': ['pkgMode', 'pkgItems', 'pkgScopeTimes', 'pkgScopeItems', 'pkgCommonTimes', 'gift'],
      '周期卡': ['includeItems', 'gift']
    }[type] || CARD_BENEFIT_KEYS;
    return keys.some(function (k) { return !fieldEmpty(f[k]); });
  }

  // 字段定义：more=true 的收进「更多字段」，不占默认编辑区高度
  var CHECK_FIELDS = {
    member: [
      { key: 'memberNo', label: '会员编号', ph: '如 0001' },
      { key: 'cardNo', label: '会员卡号', ph: '每张卡唯一' },
      { key: 'name', label: '会员姓名', ph: '必填', req: true },
      { key: 'phone', label: '手机号', ph: '11 位数字' },
      { key: 'gender', label: '性别', type: 'select', opts: [{ v: '男', label: '男' }, { v: '女', label: '女' }] },
      { key: 'birthday', label: '生日', ph: '1990/2/11' },
      { key: 'cardType', label: '卡类型', type: 'select', opts: CHECK_CARD_TYPES.map(function (t) { return { v: t, label: t }; }) },
      { key: 'cardName', label: '卡名称', type: 'select', dynamic: 'cards' },
      { key: 'expiry', label: '有效期限', ph: '永久 / 2027/01/17' },
      { key: 'recharge', label: '充值余额', type: 'money' },
      { key: 'bonus', label: '赠送余额', type: 'money' },
      { key: 'remain', label: '卡剩余价值', type: 'money' },
      { key: 'countLeft', label: '计次剩余次数', type: 'number' },
      { key: 'channel', label: '来源渠道', type: 'select', opts: CHECK_CHANNELS },
      { key: 'gift', label: '赠送项目', ph: '小气泡:1;基础护理:2', more: true, wide: true },
      { key: 'special', label: '特殊项目', ph: '理发:打折,9.9;洗吹:固定金额,50', more: true, wide: true },
      { key: 'shopCode', label: '开卡店铺编码', ph: '单店可不填', more: true },
      { key: 'note', label: '备注', more: true, wide: true }
    ],
    /* 卡模板：校验与展示按 CARD_FIELDS_BY_TYPE；此处保留并集供兼容 */
    card: [
      { key: 'type', label: '卡类型', type: 'select', opts: CHECK_CARD_TYPES.map(function (t) { return { v: t, label: t }; }) },
      { key: 'name', label: '卡名', ph: '必填，店内唯一', req: true },
      { key: 'price', label: '充值余额 / 购买价格', type: 'money', req: true },
      { key: 'rechargeDiscount', label: '充值金额享受折扣', ph: '如 8.5' },
      { key: 'bonus', label: '赠送金额', type: 'money' },
      { key: 'bonusDiscount', label: '赠送金额享受折扣', ph: '如 8.5' },
      { key: 'discount', label: '享受折扣', ph: '如 8.5' },
      { key: 'times', label: '次数', type: 'number' },
      { key: 'scope', label: '适用大类', ph: '剪发 / 护理' },
      { key: 'scopeItems', label: '适用项目' },
      { key: 'pkgMode', label: '套餐卡项目模式' },
      { key: 'pkgItems', label: '适用项目-项目明细清单', more: true, wide: true },
      { key: 'pkgScopeTimes', label: '适用项目范围-次数', type: 'number' },
      { key: 'pkgScopeItems', label: '适用项目范围-项目清单', more: true, wide: true },
      { key: 'pkgCommonTimes', label: '项目通用-次数', type: 'number' },
      { key: 'includeItems', label: '包含项目' },
      { key: 'validity', label: '有效期限（月）', ph: '留空为永久' },
      { key: 'gift', label: '赠送项目', ph: '小气泡:1;基础护理:2', more: true, wide: true },
      { key: 'memberPrice', label: '会员价项目', ph: '理发:打折,9.9', more: true, wide: true },
      { key: 'desc', label: '卡项说明', more: true, wide: true },
      { key: 'shopCode', label: '连锁店编码', more: true }
    ],
    price: [
      { key: 'name', label: '项目名', ph: '必填，导入后唯一', req: true },
      { key: 'group', label: '项目组', ph: '不存在会新建' },
      { key: 'price', label: '价格', type: 'money', req: true },
      { key: 'bookable', label: '可开单', type: 'select', opts: [{ v: '是', label: '是' }, { v: '否', label: '否' }] },
      { key: 'top', label: '置顶', type: 'select', opts: [{ v: '否', label: '否' }, { v: '是', label: '是' }] },
      { key: 'duration', label: '服务时长（分钟）', type: 'number' },
      { key: 'shopCode', label: '连锁店编码', more: true }
    ],
    product: [
      { key: 'name', label: '产品名称', ph: '必填，导入后唯一', req: true },
      { key: 'category', label: '产品分类', ph: '如 洗护 / 造型' },
      { key: 'price', label: '产品售价', type: 'money', req: true },
      { key: 'memberPrice', label: '会员价', type: 'money' },
      { key: 'onShelf', label: '是否上架', type: 'select', opts: [{ v: '上架', label: '上架' }, { v: '下架', label: '下架' }] },
      { key: 'stockQty', label: '可售数量', type: 'number' },
      { key: 'shopCode', label: '适用门店', more: true },
      { key: 'note', label: '备注', more: true, wide: true }
    ]
  };

  function escHtml(s) {
    return String(s === null || s === undefined ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // 文件格式图标（面性 iOS 风格）：XLS 用 Excel 品牌绿，照片用同结构信息蓝
  var FMT_DOC = '<path d="M6.4 2.6h6.3l4.9 4.9v13.9c0 .9-.7 1.6-1.6 1.6H6.4c-.9 0-1.6-.7-1.6-1.6V4.2c0-.9.7-1.6 1.6-1.6Z"/>'
    + '<path d="M12.9 2.8v4.2c0 .6.5 1.1 1.1 1.1h4.2" fill="none" stroke="#fff" stroke-width="1.3" stroke-linejoin="round"/>'
    + '<path d="M7.4 11.6h6.2v1.5H7.4zM7.4 15h6.2v1.5H7.4z" fill="#fff" opacity=".9"/>';
  var FMT_IMG = '<path fill-rule="evenodd" d="M4.4 4.6h15.2c1 0 1.8.8 1.8 1.8v11.2c0 1-.8 1.8-1.8 1.8H4.4c-1 0-1.8-.8-1.8-1.8V6.4c0-1 .8-1.8 1.8-1.8Zm12.1 3.3a1.7 1.7 0 1 0 0 3.4 1.7 1.7 0 0 0 0-3.4ZM4.6 17.2h14.8l-4.3-5.5-3.2 3.9-2.2-2.4-5.1 4Z"/>';

  // 微操作图标（面性 iOS 风格，16 网格视觉重）
  var ACT_ICO = {
    swap: '<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true"><path d="M7 4.4l3.8 3.8H8.3v6.2H5.7V8.2H3.2L7 4.4Z"/><path d="M17 19.6l-3.8-3.8h2.5V9.6h2.6v6.2h2.5L17 19.6Z" opacity=".55"/></svg>',
    trash: '<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true"><path d="M9.4 3.4h5.2c.7 0 1.2.5 1.2 1.2v.8h3.4v2H4.8v-2h3.4v-.8c0-.7.5-1.2 1.2-1.2Z"/><path d="M6.2 9h11.6l-.8 10.1c-.1.9-.8 1.5-1.7 1.5H8.7c-.9 0-1.6-.6-1.7-1.5L6.2 9Z" opacity=".55"/></svg>'
  };

  function fmtIcon(kind) {
    var isImg = kind === 'img';
    return '<span class="fmt-ico ' + (isImg ? 'is-img' : 'is-xls') + '" aria-hidden="true">' +
      '<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">' + (isImg ? FMT_IMG : FMT_DOC) + '</svg>' +
    '</span>';
  }

  function fmtIconSmall(kind) {
    var isImg = kind === 'img';
    return '<span class="fmt-ico is-sm ' + (isImg ? 'is-img' : 'is-xls') + '" aria-hidden="true">' +
      '<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">' + (isImg ? FMT_IMG : FMT_DOC) + '</svg>' +
    '</span>';
  }

  // 某类数据本批的来源形态：拍照 → 图片图标，其余 → Excel
  function catFmtKind(key) {
    return state.importSources && state.importSources[key] === 'photo' ? 'img' : 'xls';
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

  function fieldEmpty(v) {
    return v === null || v === undefined || String(v).trim() === '';
  }

  /* 乱码 / OCR 失败占位（有值才判；空不算） */
  function isUnreadableText(v) {
    if (fieldEmpty(v)) return false;
    var s = String(v).trim();
    if (/[?？]{2,}/.test(s)) return true;
    if (/[□■�░▒▓]/.test(s)) return true;
    if (/无法识别|未识别|看不清|识别失败/.test(s)) return true;
    if (/^¥?\s*[—\-–_]+$/.test(s)) return true;
    return false;
  }

  /* 金额列：有值但解析失败 → 按无法识别拦导入 */
  function moneyUnreadable(v) {
    if (fieldEmpty(v)) return false;
    if (isUnreadableText(v)) return true;
    return parseMoney(v) === null;
  }

  function intUnreadable(v) {
    if (fieldEmpty(v)) return false;
    if (isUnreadableText(v)) return true;
    return !/^\d+$/.test(String(v).trim());
  }

  function markUnreadable(add, field, label) {
    add(field, 'error', (label || '字段') + '无法识别，不能导入');
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
    return ALL_CATS.filter(function (k) {
      return checkRows(k).length > 0;
    });
  }

  /* 核对页 UI tab：价目表·项目 + 产品合并为「价目表」 */
  function checkUiCats() {
    var raw = checkCats();
    var out = [];
    if (raw.indexOf('member') >= 0) out.push('member');
    if (raw.indexOf('card') >= 0) out.push('card');
    if (raw.indexOf('price') >= 0 || raw.indexOf('product') >= 0) out.push('price');
    return out;
  }

  function checkFindRowLoose(id) {
    var cats = ALL_CATS;
    var i;
    for (i = 0; i < cats.length; i += 1) {
      var row = checkFindRow(cats[i], id);
      if (row) return { cat: cats[i], row: row };
    }
    return null;
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

    // 预置问题行（v2.25：仅姓名必填；有值无法识别 / 解析失败 → 需修正）
    list[12].f.phone = '1380013abc';
    list[27].f.name = '';
    list[48].f.cardNo = list[7].f.cardNo;
    list[63].f.cardName = 'VIP金卡';
    list[77].f.recharge = '¥—';
    list[91].f.note = '???无法识别';
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
    /* 严格按官方 Excel 5 类 sheet 字段造数（RTB店铺卡模板导入文档模版-v2） */
    var seed = [
      { type: '储值卡', name: '八折银卡', price: '500.00', rechargeDiscount: '8.5', bonus: '50.00', bonusDiscount: '8.5', gift: '小气泡:1;基础护理:2', memberPrice: '理发:打折,9.9;洗吹:固定金额,50', validity: '', desc: '老顾客主推' },
      { type: '储值卡', name: '黄金卡', price: '1000.00', rechargeDiscount: '9', bonus: '100.00', bonusDiscount: '', gift: '', memberPrice: '', validity: '12', desc: '' },
      { type: '计次卡', name: '剪发5次卡', price: '500.00', times: '5', scope: '剪发', scopeItems: '剪发', gift: '', validity: '', desc: '' },
      { type: '计次卡', name: '头皮护理次卡', price: '680.00', times: '6', scope: '护理', scopeItems: '头皮护理', gift: '', validity: '12', desc: '' },
      { type: '折扣卡', name: '尊享折扣卡', price: '300.00', discount: '5.5', gift: '', memberPrice: '烫发:打折,8', validity: '6', desc: '' },
      { type: '折扣卡', name: '员工亲友卡', price: '0.00', discount: '8', gift: '', memberPrice: '', validity: '', desc: '仅限亲友' },
      { type: '套餐卡', name: '护理套餐卡', price: '310.00', pkgMode: '项目明细', pkgItems: '小气泡:1;基础护理:2', pkgScopeTimes: '', pkgScopeItems: '', pkgCommonTimes: '', gift: '', validity: '3', desc: '' },
      { type: '套餐卡', name: '烫染护套餐', price: '688.00', pkgMode: '项目明细', pkgItems: '烫发:1;染发:1;护理:1', pkgScopeTimes: '', pkgScopeItems: '', pkgCommonTimes: '', gift: '造型:1', validity: '6', desc: '' },
      { type: '周期卡', name: '季卡', price: '510.00', includeItems: '小气泡;基础护理', gift: '', validity: '3', desc: '' },
      { type: '周期卡', name: '年卡', price: '1980.00', includeItems: '全场通用', gift: '', validity: '12', desc: '' },
      { type: '储值卡', name: '体验卡', price: '100.00', rechargeDiscount: '', bonus: '', bonusDiscount: '', gift: '剪发:1', memberPrice: '', validity: '', desc: '新客体验' },
      { type: '计次卡', name: '洗吹次卡', price: '200.00', times: '10', scope: '洗吹', scopeItems: '洗吹', gift: '', validity: '', desc: '' }
    ];
    var list = seed.map(function (s, i) {
      var f = {
        type: s.type,
        name: s.name,
        price: s.price,
        rechargeDiscount: s.rechargeDiscount || '',
        bonus: s.bonus || '',
        bonusDiscount: s.bonusDiscount || '',
        discount: s.discount || '',
        times: s.times || '',
        scope: s.scope || '',
        scopeItems: s.scopeItems || '',
        pkgMode: s.pkgMode || '',
        pkgItems: s.pkgItems || '',
        pkgScopeTimes: s.pkgScopeTimes || '',
        pkgScopeItems: s.pkgScopeItems || '',
        pkgCommonTimes: s.pkgCommonTimes || '',
        includeItems: s.includeItems || '',
        validity: s.validity || '',
        gift: s.gift || '',
        memberPrice: s.memberPrice || '',
        desc: s.desc || '',
        shopCode: '',
        onShelf: '下架',
        shelfOn: false
      };
      return { id: 'c' + i, f: f, problems: [], ignored: false, aiFields: [] };
    });
    // 预置问题：折扣越界 / 有效期无法识别 / 无权益 / 卡名重复 / 金额无法识别
    list[5].f.discount = '12';
    list[7].f.validity = '半年';
    list[9].f.includeItems = '';
    list[9].f.gift = '';
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
          shopCode: '',
          onShelf: i % 7 === 0 ? '下架' : '上架'
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

  function buildProductRows() {
    var seed = [
      { name: '氨基酸洗发水', category: '洗护', price: '128.00', memberPrice: '108.00', onShelf: '上架', stockQty: '24' },
      { name: '护发精油', category: '洗护', price: '168.00', memberPrice: '148.00', onShelf: '上架', stockQty: '16' },
      { name: '造型发蜡', category: '造型', price: '98.00', memberPrice: '', onShelf: '上架', stockQty: '8' },
      { name: '头皮护理套装', category: '护理', price: '398.00', memberPrice: '358.00', onShelf: '上架', stockQty: '5' },
      { name: '家用护理面膜', category: '护理', price: '59.00', memberPrice: '49.00', onShelf: '下架', stockQty: '0' },
      { name: '旅行装洗护套装', category: '洗护', price: '39.00', memberPrice: '', onShelf: '上架', stockQty: '40' },
      { name: '宽齿梳', category: '工具', price: '25.00', memberPrice: '', onShelf: '上架', stockQty: '30' },
      { name: '真丝发圈', category: '饰物', price: '19.00', memberPrice: '15.00', onShelf: '上架', stockQty: '60' },
      { name: '吹风机（家用）', category: '工具', price: '299.00', memberPrice: '269.00', onShelf: '下架', stockQty: '2' },
      { name: '护色洗发水', category: '洗护', price: '138.00', memberPrice: '118.00', onShelf: '上架', stockQty: '12' },
      { name: '发膜', category: '护理', price: '88.00', memberPrice: '', onShelf: '上架', stockQty: '9' },
      { name: '免洗喷雾', category: '造型', price: '78.00', memberPrice: '68.00', onShelf: '上架', stockQty: '0' },
      { name: '头皮按摩梳', category: '工具', price: '45.00', memberPrice: '', onShelf: '上架', stockQty: '18' },
      { name: '精油皂', category: '洗护', price: '35.00', memberPrice: '', onShelf: '上架', stockQty: '22' },
      { name: '发饰礼盒', category: '饰物', price: '129.00', memberPrice: '109.00', onShelf: '上架', stockQty: '6' },
      { name: '定型喷雾', category: '造型', price: '108.00', memberPrice: '', onShelf: '上架', stockQty: '7' }
    ];
    var list = seed.map(function (s, i) {
      return {
        id: 'd' + i,
        f: {
          name: s.name, category: s.category, price: s.price,
          memberPrice: s.memberPrice, onShelf: s.onShelf,
          stockQty: s.stockQty, shopCode: '', note: ''
        },
        problems: [],
        ignored: false,
        aiFields: []
      };
    });
    list[2].f.price = '-99.00';
    list[6].f.onShelf = '已停售';
    list[9].f.name = '氨基酸洗发水';
    list[11].f.price = '面议';
    list[13].f.memberPrice = '¥—';
    return list;
  }

  function ensureCheckData() {
    if (state.checkData) return state.checkData;
    var data = {};
    if (state.importSelection.member) data.member = buildMemberRows();
    if (state.importSelection.card) data.card = buildCardRows();
    if (state.importSelection.price) data.price = buildPriceRows();
    if (state.importSelection.product) data.product = buildProductRows();
    if (!data.member && !data.card && !data.price && !data.product) data.member = buildMemberRows();
    state.checkData = data;
    enrichPriceFromCards();
    ALL_CATS.forEach(function (k) { if (state.checkData[k]) recomputeCheck(k); });
    return state.checkData;
  }

  /* 卡模板权益里提到、但本批价目/产品没有同名的项目 → 识别获取（价 0、默认下架、置顶） */
  function extractCardMentionedNames(f) {
    var names = [];
    var skip = { '全场通用': 1, '未分类': 1, '未分组': 1 };
    function addFrom(str) {
      String(str || '').split(/[;；]/).forEach(function (part) {
        var n = String(part || '').split(/[:：,/，]/)[0].trim();
        if (!n || skip[n] || /^\d+(\.\d+)?$/.test(n)) return;
        if (names.indexOf(n) === -1) names.push(n);
      });
    }
    addFrom(f.gift);
    addFrom(f.memberPrice);
    addFrom(f.scopeItems);
    addFrom(f.pkgItems);
    addFrom(f.pkgScopeItems);
    addFrom(f.includeItems);
    addFrom(f.scope);
    return names;
  }

  function enrichPriceFromCards() {
    var cards = (state.checkData && state.checkData.card) || [];
    if (!cards.length) return;
    if (!state.checkData.price) state.checkData.price = [];
    var existing = {};
    function markName(rows) {
      (rows || []).forEach(function (r) {
        var n = String((r.f || {}).name || '').trim();
        if (n) existing[n] = true;
      });
    }
    markName(state.checkData.price);
    markName(state.checkData.product);
    var added = [];
    var seen = {};
    cards.forEach(function (c) {
      extractCardMentionedNames(c.f || {}).forEach(function (n) {
        if (existing[n] || seen[n]) return;
        seen[n] = true;
        added.push({
          id: 'fc-' + added.length + '-' + n.length,
          f: {
            name: n,
            group: '识别获取',
            price: '0',
            bookable: '是',
            top: '否',
            duration: '',
            shopCode: '',
            onShelf: '下架',
            shelfOn: false,
            source: 'fromCard'
          },
          problems: [],
          ignored: false,
          aiFields: [],
          source: 'fromCard'
        });
        existing[n] = true;
      });
    });
    if (!added.length) return;
    state.checkData.price = added.concat(state.checkData.price);
    state.importSelection.price = true;
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
      if ((cat === 'price' || cat === 'product') && f.name) ctx.names[f.name] = (ctx.names[f.name] || 0) + 1;
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
      /* 入库必填：仅会员姓名；其余可空。有值则须可识别。 */
      if (fieldEmpty(f.name)) add('name', 'error', '会员姓名为空');
      else if (isUnreadableText(f.name)) markUnreadable(add, 'name', '会员姓名');

      if (!fieldEmpty(f.memberNo) && isUnreadableText(f.memberNo)) markUnreadable(add, 'memberNo', '会员编号');
      if (!fieldEmpty(f.cardNo)) {
        if (isUnreadableText(f.cardNo)) markUnreadable(add, 'cardNo', '会员卡号');
        else if (ctx.cardNos[f.cardNo] > 1) add('cardNo', 'error', '会员卡号与其他行重复');
      }
      if (!fieldEmpty(f.phone)) {
        if (isUnreadableText(f.phone) || !/^1\d{10}$/.test(String(f.phone).trim())) markUnreadable(add, 'phone', '手机号');
        else if (ctx.phones[f.phone] && ctx.phones[f.phone].length > 1) add('phone', 'warn', '同一手机号对应多个会员编号');
      }
      if (!fieldEmpty(f.gender) && isUnreadableText(f.gender)) markUnreadable(add, 'gender', '性别');
      else if (fieldEmpty(f.gender)) add('gender', 'warn', '性别为空，按「女」导入');
      if (!fieldEmpty(f.birthday)) {
        if (isUnreadableText(f.birthday)) markUnreadable(add, 'birthday', '生日');
        else if (!/^\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2}$/.test(f.birthday)) add('birthday', 'warn', '生日格式建议 1990/2/11');
      }
      if (!fieldEmpty(f.cardType)) {
        if (isUnreadableText(f.cardType)) markUnreadable(add, 'cardType', '卡类型');
        else if (CHECK_CARD_TYPES.indexOf(f.cardType) === -1) markUnreadable(add, 'cardType', '卡类型');
      }
      if (!fieldEmpty(f.cardName)) {
        if (isUnreadableText(f.cardName)) markUnreadable(add, 'cardName', '卡名称');
        else if (!ctx.cardNames[f.cardName]) add('cardName', 'warn', '店内无此卡，导入后可再关联');
      }
      if (moneyUnreadable(f.recharge)) markUnreadable(add, 'recharge', '充值余额');
      else if (!fieldEmpty(f.recharge) && parseMoney(f.recharge) === 0) add('recharge', 'warn', '充值余额为 0');
      if (moneyUnreadable(f.bonus)) markUnreadable(add, 'bonus', '赠送余额');
      if (moneyUnreadable(f.remain)) markUnreadable(add, 'remain', '卡剩余价值');
      if (intUnreadable(f.countLeft)) markUnreadable(add, 'countLeft', '计次剩余次数');
      if (!fieldEmpty(f.channel)) {
        if (isUnreadableText(f.channel)) markUnreadable(add, 'channel', '来源渠道');
        else if (!/^[1-9]$/.test(String(f.channel))) add('channel', 'warn', '来源渠道须为 1–9');
      }
      if (!fieldEmpty(f.expiry)) {
        if (isUnreadableText(f.expiry)) markUnreadable(add, 'expiry', '有效期限');
        else if (f.expiry !== '永久' && isPastDate(f.expiry)) add('expiry', 'warn', '卡已过期');
      }
      if (!fieldEmpty(f.gift)) {
        if (isUnreadableText(f.gift)) markUnreadable(add, 'gift', '赠送项目');
        else if (!dsl.test(f.gift)) add('gift', 'warn', '赠送项目格式应为「项目:次数」');
      }
      if (!fieldEmpty(f.special)) {
        if (isUnreadableText(f.special)) markUnreadable(add, 'special', '特殊项目');
        else if (!priceDsl.test(f.special)) add('special', 'warn', '特殊项目格式应为「项目:打折,9.9」');
      }
      if (!fieldEmpty(f.shopCode) && isUnreadableText(f.shopCode)) markUnreadable(add, 'shopCode', '开卡店铺编码');
      if (!fieldEmpty(f.note) && isUnreadableText(f.note)) markUnreadable(add, 'note', '备注');
      return out;
    }

    if (cat === 'card') {
      /* 按官方 5 sheet：卡名 + 充值余额/购买价格；权益列按类型至少一项 */
      var priceLabel = f.type === '储值卡' ? '充值余额' : '购买价格';
      if (fieldEmpty(f.name)) add('name', 'error', '卡名为空');
      else if (isUnreadableText(f.name)) markUnreadable(add, 'name', '卡名');
      else if (ctx.names[f.name] > 1) add('name', 'warn', '本批有同名卡，导入会跳过后者');

      if (fieldEmpty(f.price)) add('price', 'error', priceLabel + '为空');
      else if (moneyUnreadable(f.price)) markUnreadable(add, 'price', priceLabel);

      if (!fieldEmpty(f.type)) {
        if (isUnreadableText(f.type)) markUnreadable(add, 'type', '卡类型');
        else if (CHECK_CARD_TYPES.indexOf(f.type) === -1) markUnreadable(add, 'type', '卡类型');
      }

      if (!cardHasBenefit(f)) {
        var benefitKey = f.type === '计次卡' ? 'times' : (f.type === '折扣卡' ? 'discount' : (f.type === '周期卡' ? 'includeItems' : (f.type === '套餐卡' ? 'pkgItems' : 'gift')));
        add(benefitKey, 'error', '本类型权益至少填一项');
      }

      if (f.type === '计次卡' && fieldEmpty(f.times)) add('times', 'error', '次数为空');
      if (f.type === '折扣卡' && fieldEmpty(f.discount)) add('discount', 'error', '享受折扣为空');

      ['discount', 'rechargeDiscount', 'bonusDiscount'].forEach(function (dk) {
        if (fieldEmpty(f[dk])) return;
        if (moneyUnreadable(f[dk])) markUnreadable(add, dk, '折扣');
        else {
          var dv = parseMoney(f[dk]);
          if (dv !== '' && (dv <= 0 || dv > 10)) add(dk, 'error', '折扣须在 0–10 之间');
        }
      });
      if (intUnreadable(f.times)) markUnreadable(add, 'times', '次数');
      if (!fieldEmpty(f.scope) && isUnreadableText(f.scope)) markUnreadable(add, 'scope', '适用大类');
      if (!fieldEmpty(f.scopeItems) && isUnreadableText(f.scopeItems)) markUnreadable(add, 'scopeItems', '适用项目');
      if (!fieldEmpty(f.includeItems) && isUnreadableText(f.includeItems)) markUnreadable(add, 'includeItems', '包含项目');
      if (intUnreadable(f.validity)) markUnreadable(add, 'validity', '有效期限');
      if (!fieldEmpty(f.gift)) {
        if (isUnreadableText(f.gift)) markUnreadable(add, 'gift', '赠送项目');
        else if (!dsl.test(f.gift)) add('gift', 'warn', '赠送项目格式应为「项目:次数」');
      }
      if (!fieldEmpty(f.memberPrice)) {
        if (isUnreadableText(f.memberPrice)) markUnreadable(add, 'memberPrice', '会员价项目');
        else if (!priceDsl.test(f.memberPrice)) add('memberPrice', 'warn', '会员价格式应为「项目:打折,9.9」');
      }
      if (!fieldEmpty(f.desc) && isUnreadableText(f.desc)) markUnreadable(add, 'desc', '卡项说明');
      return out;
    }

    if (cat === 'price') {
      if (fieldEmpty(f.name)) add('name', 'error', '项目名为空');
      else if (isUnreadableText(f.name)) markUnreadable(add, 'name', '项目名');
      else if (ctx.names[f.name] > 1) add('name', 'warn', '本批有同名项目，导入会跳过后者');
      if (fieldEmpty(f.price)) add('price', 'error', '价格为空');
      else if (moneyUnreadable(f.price)) markUnreadable(add, 'price', '价格');
      else if (parseMoney(f.price) < 0) add('price', 'error', '价格不能为负');
      if (!fieldEmpty(f.group) && isUnreadableText(f.group)) markUnreadable(add, 'group', '项目组');
      else if (fieldEmpty(f.group)) add('group', 'warn', '项目组为空，将作为自定义新增');
      if (intUnreadable(f.duration)) markUnreadable(add, 'duration', '服务时长');
      if (!fieldEmpty(f.bookable)) {
        if (isUnreadableText(f.bookable)) markUnreadable(add, 'bookable', '可开单');
        else if (f.bookable !== '是' && f.bookable !== '否') add('bookable', 'warn', '可开单填「是 / 否」，按「是」处理');
      }
      if (!fieldEmpty(f.top)) {
        if (isUnreadableText(f.top)) markUnreadable(add, 'top', '置顶');
        else if (f.top !== '是' && f.top !== '否') add('top', 'warn', '置顶填「是 / 否」，按「否」处理');
      }
      if (!fieldEmpty(f.shopCode) && isUnreadableText(f.shopCode)) markUnreadable(add, 'shopCode', '连锁店编码');
      return out;
    }

    return out;
  }

  function checkProblemsProduct(row, ctx) {
    var f = row.f || {};
    var out = [];
    function add(field, level, msg) { out.push({ field: field, level: level, msg: msg }); }
    /* 入库必填：产品名称 + 产品售价；分类等选填 */
    if (fieldEmpty(f.name)) add('name', 'error', '产品名称为空');
    else if (isUnreadableText(f.name)) markUnreadable(add, 'name', '产品名称');
    else if (ctx.names[f.name] > 1) add('name', 'warn', '本批有同名产品，导入会跳过后者');
    if (fieldEmpty(f.price)) add('price', 'error', '产品售价为空');
    else if (moneyUnreadable(f.price)) markUnreadable(add, 'price', '产品售价');
    else if (parseMoney(f.price) < 0) add('price', 'error', '产品售价不能为负');
    if (!fieldEmpty(f.category) && isUnreadableText(f.category)) markUnreadable(add, 'category', '产品分类');
    else if (fieldEmpty(f.category)) add('category', 'warn', '产品分类为空，将归入「未分类」');
    if (moneyUnreadable(f.memberPrice)) markUnreadable(add, 'memberPrice', '会员价');
    if (!fieldEmpty(f.onShelf)) {
      if (isUnreadableText(f.onShelf)) markUnreadable(add, 'onShelf', '是否上架');
      else if (f.onShelf !== '上架' && f.onShelf !== '下架') add('onShelf', 'warn', '上架状态填「上架 / 下架」，按「下架」处理');
    }
    if (intUnreadable(f.stockQty)) markUnreadable(add, 'stockQty', '可售数量');
    if (!fieldEmpty(f.shopCode) && isUnreadableText(f.shopCode)) markUnreadable(add, 'shopCode', '适用门店');
    if (!fieldEmpty(f.note) && isUnreadableText(f.note)) markUnreadable(add, 'note', '备注');
    return out;
  }

  function recomputeCheck(cat) {
    var rows = checkRows(cat);
    var ctx = checkCtx(cat, rows);
    var fn = cat === 'product' ? checkProblemsProduct : checkProblems;
    rows.forEach(function (r) {
      r.problems = cat === 'product' ? fn(r, ctx) : fn(cat, r, ctx);
    });
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
        '<button type="button" class="check-editor__del" data-check-del="' + row.id + '" aria-label="删除此行" title="删除此行">' +
          '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4.6 7.2h14.8"/><path d="M9.4 7.2V5.4c0-.7.6-1.2 1.2-1.2h2.8c.6 0 1.2.5 1.2 1.2v1.8"/><path d="M6.6 7.2l.75 11c.06.9.8 1.6 1.7 1.6h5.9c.9 0 1.64-.7 1.7-1.6l.75-11"/><path d="M10.2 10.8v5.6M13.8 10.8v5.6"/></svg>' +
        '</button>' +
      '</div>' +
    '</div>';
  }

  function checkRowTitle(cat, row) {
    var f = row.f || {};
    if (cat === 'member') return f.name || '未填姓名';
    if (cat === 'card') return f.name || '未命名卡';
    if (cat === 'product') return f.name || '未命名产品';
    return f.name || '未命名项目';
  }

  function checkRowSub(cat, row) {
    var f = row.f || {};
    if (cat === 'member') return [f.memberNo, f.cardNo, f.phone, f.cardName].filter(Boolean).join(' · ');
    if (cat === 'card') return [f.type, f.price ? '¥' + f.price : '', f.validity ? f.validity + ' 个月' : '永久', f.scope].filter(Boolean).join(' · ');
    if (cat === 'product') return [f.category, f.price ? '售价 ¥' + f.price : '', f.memberPrice ? '会员 ¥' + f.memberPrice : '', f.onShelf].filter(Boolean).join(' · ');
    return [f.group, f.price ? '¥' + f.price : '', f.duration ? f.duration + ' 分钟' : ''].filter(Boolean).join(' · ');
  }

  function checkRowTag(cat, row) {
    var f = row.f || {};
    if (cat === 'member') return f.cardType || '';
    if (cat === 'card') return f.type || '';
    if (cat === 'product') return f.onShelf || '';
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
    return '<div class="check-row is-' + lvl + (open ? ' is-open' : '') + '" id="checkRow-' + row.id + '" data-check-row="' + row.id + '">' +
      '<button type="button" class="check-row__main" data-check-open="' + row.id + '" aria-expanded="' + (open ? 'true' : 'false') + '">' +
        fmtIcon(catFmtKind(cat)) +
        '<span class="check-row__body">' +
          '<span class="check-row__line1"><b>' + escHtml(checkRowTitle(cat, row)) + '</b>' +
            (tag ? '<i class="check-tag">' + escHtml(tag) + '</i>' : '') + ai +
          '</span>' +
          '<span class="check-row__line2">' + escHtml(checkRowSub(cat, row)) + '</span>' +
          issue +
        '</span>' +
        '<span class="check-row__state">' + CHECK_LV_LABEL[lvl] + '</span>' +
        '<svg class="check-row__chev" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>' +
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
    return rows;
  }

  function checkProblemRows(cat) {
    return checkRows(cat).filter(function (r) { return !r.ignored && rowIssues(r).length > 0; });
  }

  function scrollCheckRow(id) {
    var el = document.getElementById('checkRow-' + id);
    if (el && el.scrollIntoView) el.scrollIntoView({ block: 'center' });
  }

  function moneyOf(v) {
    var n = parseMoney(v);
    return typeof n === 'number' ? n : 0;
  }

  function verifyGroupKey(cat, row) {
    var f = row.f || {};
    if (cat === 'member') return f.cardType || '未分类卡';
    if (cat === 'card') return f.type || '未分类';
    if (cat === 'price') return f.group || '未分组';
    if (cat === 'product') return f.category || '未分类';
    return '全部';
  }

  function importableRows(cat) {
    return checkRows(cat).filter(function (r) {
      return !r.ignored && !rowHasLevel(r, 'error');
    });
  }

  function blockedRows(cat) {
    return checkRows(cat).filter(function (r) {
      return !r.ignored && rowHasLevel(r, 'error');
    });
  }

  function verifyTabMetrics(cat, rows) {
    if (cat === 'member') {
      var people = {};
      rows.forEach(function (r) {
        var f = r.f || {};
        people[f.memberNo || r.id] = true;
      });
      return [{ k: '人数', v: Object.keys(people).length }];
    }
    if (cat === 'card') return [{ k: '模板', v: rows.length + ' 种' }];
    if (cat === 'price') {
      var priceN = importableRows('price').length;
      var productN = importableRows('product').length;
      return [{ k: '项目', v: priceN }, { k: '产品', v: productN }];
    }
    if (cat === 'product') {
      return [{ k: '产品', v: rows.length }];
    }
    return [{ k: '条数', v: rows.length }];
  }

  function rowShelfOn(row) {
    var f = row.f || {};
    if (f.onShelf === '下架' || f.shelf === '下架' || f.shelfOn === false) return false;
    if (f.onShelf === '上架' || f.shelfOn === true) return true;
    return true;
  }

  function shelfSwitchHtml(cat, row) {
    var on = rowShelfOn(row);
    return '<button type="button" class="shelf-switch' + (on ? ' is-on' : '') +
      '" data-shelf-toggle="' + row.id + '" data-shelf-cat="' + cat +
      '" role="switch" aria-checked="' + (on ? 'true' : 'false') +
      '" aria-label="' + (on ? '上架' : '下架') + '"><i class="shelf-switch__knob"></i></button>';
  }

  function cardTileKv(f) {
    var validity = f.validity || '';
    if (validity && /^\d+$/.test(String(validity))) validity += ' 个月';
    if (!validity) validity = '永久';
    var priceLab = f.type === '储值卡' ? '充值余额' : '购买价格';
    var price = f.price ? fmtMoney(moneyOf(f.price)) : '—';
    var cells;
    if (f.type === '储值卡') {
      cells = [
        [priceLab, price],
        ['充值折扣', f.rechargeDiscount ? (f.rechargeDiscount + ' 折') : '—'],
        ['赠送金额', f.bonus ? fmtMoney(moneyOf(f.bonus)) : '—'],
        ['有效期', validity]
      ];
    } else if (f.type === '计次卡') {
      cells = [
        [priceLab, price],
        ['次数', f.times ? (f.times + ' 次') : '—'],
        ['适用大类', f.scope || '—'],
        ['有效期', validity]
      ];
    } else if (f.type === '折扣卡') {
      cells = [
        [priceLab, price],
        ['享受折扣', f.discount ? (f.discount + ' 折') : '—'],
        ['会员价', f.memberPrice ? '有' : '—'],
        ['有效期', validity]
      ];
    } else if (f.type === '套餐卡') {
      cells = [
        [priceLab, price],
        ['项目模式', f.pkgMode || '—'],
        ['明细', f.pkgItems || '—'],
        ['有效期', validity]
      ];
    } else if (f.type === '周期卡') {
      cells = [
        [priceLab, price],
        ['包含项目', f.includeItems || '—'],
        ['赠送', f.gift || '—'],
        ['有效期', validity]
      ];
    } else {
      cells = [[priceLab, price], ['有效期', validity], ['持卡', String(cardHoldersCount(f.name))], ['说明', f.desc || '—']];
    }
    return cells.map(function (c) {
      return '<div><dt>' + esc(c[0]) + '</dt><dd>' + esc(c[1]) + '</dd></div>';
    }).join('');
  }

  function cardTileFoot(f) {
    if (f.type === '储值卡') return f.gift || f.memberPrice || f.desc || '储值权益';
    if (f.type === '计次卡') return f.scopeItems || f.scope || '计次权益';
    if (f.type === '折扣卡') return f.memberPrice || f.gift || '折扣权益';
    if (f.type === '套餐卡') return f.pkgItems || f.pkgScopeItems || '套餐权益';
    if (f.type === '周期卡') return f.includeItems || '周期权益';
    return f.desc || '—';
  }

  function cardTileHtml(row) {
    var f = row.f || {};
    return '<article class="tpl-tile">' +
      '<div class="tpl-tile__hd">' +
        '<b>' + esc(f.name || '未命名卡') + '</b>' +
        '<span class="tpl-tile__type' + cardTypeClass(f.type) + '">' + esc(f.type || '未分类') + '</span>' +
      '</div>' +
      '<dl class="tpl-tile__kv">' + cardTileKv(f) + '</dl>' +
      '<div class="tpl-tile__ft">' +
        '<span>' + esc(cardTileFoot(f)) + '</span>' +
        shelfSwitchHtml('card', row) +
      '</div>' +
    '</article>';
  }

  /* 卡类型标签配色：储值蓝 / 计次粉 / 折扣紫 / 套餐黄 / 周期橙 */
  function cardTypeClass(type) {
    var t = String(type || '');
    if (t.indexOf('储值') >= 0) return ' is-saving';
    if (t.indexOf('计次') >= 0) return ' is-count';
    if (t.indexOf('折扣') >= 0) return ' is-discount';
    if (t.indexOf('套餐') >= 0) return ' is-package';
    if (t.indexOf('周期') >= 0) return ' is-period';
    return '';
  }

  /* 价目表·项目 / 产品：名称与价格均可点编辑；失焦自动保存，无确认/取消条 */
  function tappableEditRowHtml(cat, row) {
    var f = row.f || {};
    var priceVal = f.price === undefined || f.price === null ? '' : String(f.price);
    var ed = state.inlineEdit && state.inlineEdit.id === row.id ? state.inlineEdit : null;
    var nameText = escHtml(f.name || (cat === 'product' ? '未命名产品' : '未命名项目'));
    var nameHtml;
    var priceHtml;
    if (ed && ed.field === 'name') {
      nameHtml = '<label class="verify-row__name-box is-input">' +
        '<input type="text" class="verify-row__name-input" data-inline-input="name" value="' +
        nameText + '" placeholder="名称" autocomplete="off" aria-label="名称"></label>';
    } else {
      nameHtml = '<button type="button" class="verify-row__name" data-inline-start="' + row.id +
        '" data-inline-focus="name" data-inline-cat="' + cat + '">' + nameText + '</button>';
    }
    if (ed && ed.field === 'price') {
      priceHtml = '<label class="verify-row__price is-input"><span class="verify-row__cny">¥</span>' +
        '<input type="text" class="verify-row__price-input" data-inline-input="price" inputmode="decimal" value="' +
        escHtml(priceVal) + '" placeholder="价格" autocomplete="off" aria-label="价格"></label>';
    } else {
      priceHtml = '<button type="button" class="verify-row__price" data-inline-start="' + row.id +
        '" data-inline-focus="price" data-inline-cat="' + cat + '">' + fmtMoney(moneyOf(f.price)) + '</button>';
    }
    return '<div class="verify-row is-inline-tappable" data-inline-row="' + row.id + '" data-inline-cat="' + cat + '">' +
      nameHtml + priceHtml + shelfSwitchHtml(cat, row) +
    '</div>';
  }

  function focusInlineInput() {
    var host = document.getElementById('checkList');
    if (!host || !state.inlineEdit) return;
    var field = state.inlineEdit.field || 'price';
    var inp = host.querySelector('[data-inline-input="' + field + '"]');
    if (!inp) return;
    try { inp.focus({ preventScroll: true }); } catch (err) { inp.focus(); }
    if (inp.setSelectionRange) inp.setSelectionRange(0, String(inp.value || '').length);
  }

  function commitInlineEdit(silent) {
    var ed = state.inlineEdit;
    if (!ed) return false;
    var wrap = document.querySelector('#checkList [data-inline-row="' + ed.id + '"]');
    if (!wrap) { state.inlineEdit = null; return false; }
    var hit = checkFindRowLoose(ed.id);
    var cat = (ed.cat && checkFindRow(ed.cat, ed.id)) ? ed.cat : (hit && hit.cat) || state.checkTab;
    var row = hit && hit.row;
    if (!row) { state.inlineEdit = null; if (!silent) renderCheckList(); return false; }
    var nameEl = wrap.querySelector('[data-inline-input="name"]');
    var priceEl = wrap.querySelector('[data-inline-input="price"]');
    if (nameEl) {
      var nm = String(nameEl.value || '').trim();
      if (!nm) {
        showToast('名称不能为空');
        nameEl.focus();
        return false;
      }
      row.f.name = nm;
      if (row.aiFields && row.aiFields.length) {
        row.aiFields = row.aiFields.filter(function (k) { return k !== 'name'; });
      }
    }
    if (priceEl) {
      var rawPrice = String(priceEl.value || '').replace(/[¥￥,，\s]/g, '');
      if (rawPrice !== '' && !/^\d+(\.\d{1,2})?$/.test(rawPrice)) {
        showToast('价格请填写数字');
        priceEl.focus();
        return false;
      }
      row.f.price = rawPrice;
      if (row.aiFields && row.aiFields.length) {
        row.aiFields = row.aiFields.filter(function (k) { return k !== 'price'; });
      }
    }
    state.inlineEdit = null;
    state.checkOpen = null;
    recomputeCheck(cat);
    if (!silent) {
      renderCheckStats();
      renderCheckList();
      showToast('已修改');
    }
    return true;
  }

  function cancelInlineEdit() {
    if (!state.inlineEdit) return;
    state.inlineEdit = null;
    renderCheckList();
  }

  function verifyRowHtml(cat, row) {
    var f = row.f || {};
    if (cat === 'member') {
      var mPhone = String(f.phone || '');
      var mSub = [
        f.memberNo,
        mPhone ? (mPhone.length > 7 ? mPhone.slice(0, 3) + '****' + mPhone.slice(-4) : mPhone) : '',
        f.cardName
      ].filter(Boolean).join(' · ');
      return '<button type="button" class="verify-row is-edit" data-member-detail="' + row.id + '">' +
        '<span class="verify-row__main"><b>' + esc(f.name || '—') + '</b>' +
        '<i>' + esc(mSub || '未填联系方式') + '</i></span>' +
        '<span class="verify-row__val">' + fmtMoney(moneyOf(f.recharge) + moneyOf(f.remain)) + '</span></button>';
    }
    if (cat === 'card') {
      return cardPassHtml(row);
    }
    return tappableEditRowHtml(cat, row);
  }

  function cardHoldersCount(name) {
    var rows = (state.checkData && state.checkData.member) || [];
    var n = 0;
    rows.forEach(function (r) {
      if ((r.f || {}).cardName === name) n += 1;
    });
    return n > 0 ? n : '—';
  }

  function formatCardValidity(v) {
    if (!v || String(v).trim() === '') return '长期有效';
    var validity = String(v);
    if (!/月|天|永久|长期|—/.test(validity) && /^\d+$/.test(validity)) {
      validity = validity + ' 个月';
    }
    return validity;
  }

  function cardMoneyText(v) {
    if (v === undefined || v === null || String(v).trim() === '') return '';
    return '¥' + String(v).replace(/^[¥￥]\s*/, '');
  }

  /* 主权益拆「数字 + 单位」：单位小两档、浅一档色，与数字基线对齐 */
  function cardHeroHtml(val) {
    var s = String(val === undefined || val === null ? '' : val).trim();
    if (!s) return '<span class="card-pass__hero-val">—</span>';
    var unitClass = 'card-pass__hero-unit';
    if (s.charAt(0) === '¥' || s.charAt(0) === '￥') {
      return '<span class="' + unitClass + '">' + s.charAt(0) + '</span>' +
        '<span class="card-pass__hero-val">' + esc(s.slice(1).trim()) + '</span>';
    }
    var m = /^(.*?)\s*(折|次|人|个月)$/.exec(s);
    if (m) {
      return '<span class="card-pass__hero-val">' + esc(m[1]) + '</span>' +
        '<span class="' + unitClass + '">' + esc(m[2]) + '</span>';
    }
    return '<span class="card-pass__hero-val">' + esc(s) + '</span>';
  }

  /* 会员卡：卡名 + 类型 → 主权益（左标签/右数值）→ 底部三格统计（扁平、浅灰、靠字体分层） */
  function cardPassHtml(row) {
    var f = row.f || {};
    var type = f.type || '未分类';
    var holders = cardHoldersCount(f.name);
    var heroLab = '购价';
    var heroVal = cardMoneyText(f.price);
    var stats = [];
    function pushStat(lab, val) {
      if (val === undefined || val === null || String(val).trim() === '') return;
      stats.push({ lab: lab, val: String(val) });
    }
    if (type === '储值卡') {
      heroLab = '开卡价';
      pushStat('折扣', f.rechargeDiscount ? (f.rechargeDiscount + ' 折') : '');
      pushStat('赠金', cardMoneyText(f.bonus));
    } else if (type === '计次卡') {
      heroLab = '可用次数';
      heroVal = f.times ? (f.times + ' 次') : '';
      pushStat('范围', f.scopeItems || f.scope);
      pushStat('购价', cardMoneyText(f.price));
    } else if (type === '折扣卡') {
      heroLab = '折扣';
      heroVal = f.discount ? (f.discount + ' 折') : '';
      pushStat('会员价', f.memberPrice);
      pushStat('购价', cardMoneyText(f.price));
    } else if (type === '套餐卡') {
      pushStat('套餐项目', f.pkgItems || f.pkgScopeItems);
    } else if (type === '周期卡') {
      pushStat('包含项目', f.includeItems);
    } else {
      pushStat('折扣', f.discount ? (f.discount + ' 折') : '');
      pushStat('次数', f.times ? (f.times + ' 次') : '');
    }
    pushStat('有效期', formatCardValidity(f.validity || f.expiry));
    pushStat('持卡', holders === '—' ? '' : (holders + ' 人'));
    stats = stats.slice(0, 3);
    var statsHtml = stats.map(function (s) {
      return '<div class="card-pass__stat"><span>' + esc(s.lab) + '</span><b>' + esc(s.val) + '</b></div>';
    }).join('');
    return '<article class="card-pass">' +
      '<div class="card-pass__face">' +
        '<div class="card-pass__hd">' +
          '<b class="card-pass__name">' + esc(f.name || '未命名卡') + '</b>' +
          '<span class="card-pass__type' + cardTypeClass(type) + '">' + esc(type) + '</span>' +
        '</div>' +
        '<div class="card-pass__hero">' +
          '<span class="card-pass__hero-lab">' + esc(heroLab) + '</span>' +
          '<b class="card-pass__hero-num">' + cardHeroHtml(heroVal) + '</b>' +
        '</div>' +
        (statsHtml ? '<div class="card-pass__stats">' + statsHtml + '</div>' : '') +
      '</div>' +
      '<div class="card-pass__act">' + shelfSwitchHtml('card', row) + '</div>' +
    '</article>';
  }

  function verifyBoardLabel(k) {
    if (k === 'price') return '价目表';
    if (k === 'product') return '价目表';
    if (k === 'card') return '卡模板';
    if (k === 'member') return '会员';
    return IMPORT_CAT_SHORT[k] || k;
  }

  /* 「价目表·项目」等：按 · 拆两行，窄格也能完整显示 */
  function verifyLabelHtml(label) {
    var s = String(label || '');
    var i = s.indexOf('·');
    if (i < 0) return esc(s);
    return '<span class="lbl-2line">' +
      '<span>' + esc(s.slice(0, i)) + '</span>' +
      '<span>' + esc(s.slice(i + 1)) + '</span>' +
      '</span>';
  }

  function countMemberPeople() {
    var people = {};
    importableRows('member').forEach(function (r) {
      var f = r.f || {};
      people[f.memberNo || r.id] = true;
    });
    return Object.keys(people).length;
  }

  function renderCheckStats() {
    var cats = checkUiCats();
    var all = checkAllStats();
    var batchEl = $('#checkBatchText');
    if (batchEl) {
      batchEl.textContent = all.error
        ? ('可导入 ' + all.importable.toLocaleString('zh-CN') + ' 条 · 未达门槛 ' + all.error.toLocaleString('zh-CN') + ' 条不会写入。')
        : ('可导入 ' + all.importable.toLocaleString('zh-CN') + ' 条，和账本对一下即可。');
    }
    var metrics = $('#checkVerifyMetrics');
    if (metrics) {
      var memberN = countMemberPeople();
      var cardN = importableRows('card').length;
      var priceN = importableRows('price').length + importableRows('product').length;
      var icoUser = '<svg class="verify-dash__ico" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>';
      var icoCard = '<svg class="verify-dash__ico" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/><path d="M6 15h4"/></svg>';
      var icoPrice = '<svg class="verify-dash__ico" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/><path d="M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v0a2 2 0 0 1-2 2h-2a2 2 0 0 1-2-2v0Z"/><path d="M9 12h6M9 16h4"/></svg>';
      metrics.innerHTML =
        '<div class="verify-dash">' +
          '<button type="button" class="verify-dash__main" data-check-jump="member" aria-label="查看会员数据列表">' +
            '<span class="verify-dash__top">' + icoUser + '<span class="verify-dash__lab">会员人数</span></span>' +
            '<b class="verify-dash__num">' + memberN.toLocaleString('zh-CN') + '</b>' +
          '</button>' +
          '<div class="verify-dash__stack">' +
            '<button type="button" class="verify-dash__card" data-check-jump="card" aria-label="查看卡模板数据列表">' +
              '<span class="verify-dash__top">' + icoCard + '<span class="verify-dash__lab">卡模板</span></span>' +
              '<b class="verify-dash__num">' + cardN.toLocaleString('zh-CN') + '</b>' +
            '</button>' +
            '<button type="button" class="verify-dash__card" data-check-jump="price" aria-label="查看价目表数据列表">' +
              '<span class="verify-dash__top">' + icoPrice + '<span class="verify-dash__lab">价目表</span></span>' +
              '<b class="verify-dash__num">' + priceN.toLocaleString('zh-CN') + '</b>' +
            '</button>' +
          '</div>' +
        '</div>';
    }
    var totalEl = $('#checkTotal');
    if (totalEl) totalEl.textContent = all.total.toLocaleString('zh-CN');
    var catsEl = $('#checkCats');
    if (catsEl) catsEl.textContent = cats.length + ' 类';

    var tabs = $('#checkTabs');
    if (tabs) {
      tabs.classList.toggle('hidden', cats.length < 2);
      tabs.innerHTML = cats.map(function (k) {
        var on = k === state.checkTab;
        var lab = verifyBoardLabel(k);
        return '<button type="button" class="check-tab' + (on ? ' is-on' : '') + '" role="tab" aria-selected="' + (on ? 'true' : 'false') +
          '" aria-label="' + esc(lab) + '" data-check-tab="' + k + '">' +
          '<b>' + verifyLabelHtml(lab) + '</b></button>';
      }).join('');
      tabs.style.gridTemplateColumns = 'repeat(' + Math.max(cats.length, 1) + ', minmax(0, 1fr))';
      tabs.classList.toggle('is-dense', cats.length >= 4);
    }
    state.checkFilter = 'all';
    state.checkIgnoreArm = false;
  }

  function renderPriceSectionsHtml() {
    function sectionHtml(secCat, title, limit) {
      var rows = importableRows(secCat);
      if (!rows.length) return '';
      var groups = {};
      var order = [];
      rows.forEach(function (r) {
        var g = verifyGroupKey(secCat, r);
        if (!groups[g]) {
          groups[g] = [];
          if (g === '识别获取') order.unshift(g);
          else order.push(g);
        }
        groups[g].push(r);
      });
      if (order.indexOf('识别获取') > 0) {
        order.splice(order.indexOf('识别获取'), 1);
        order.unshift('识别获取');
      }
      var used = 0;
      var body = order.map(function (g) {
        var list = groups[g];
        var remain = Math.max(0, limit - used);
        if (remain <= 0) return '';
        var show = list.slice(0, remain);
        used += show.length;
        var more = list.length - show.length;
        var fromCard = g === '识别获取';
        var head = '<div class="verify-group__hd' + (fromCard ? ' price-from-card' : '') + '"><b>' +
          esc(g) + '</b><span>' + list.length + ' 条</span></div>';
        return '<div class="verify-group__block">' + head +
          show.map(function (r) { return verifyRowHtml(secCat, r); }).join('') +
          (more > 0 ? '<p class="verify-group__more">本组还有 ' + more + ' 条</p>' : '') +
        '</div>';
      }).join('');
      return '<section class="verify-group is-price-sec" data-price-sec="' + secCat + '">' +
        '<div class="verify-group__sec"><b>' + esc(title) + '</b><span>' + rows.length + ' 条</span></div>' +
        body +
      '</section>';
    }
    return sectionHtml('price', '项目', 10) + sectionHtml('product', '产品', 8);
  }

  function renderCheckList() {
    var host = $('#checkList');
    if (!host) return;
    var cat = state.checkTab;
    if (cat === 'product') cat = 'price';
    /* 价目表合并 tab 启用「大类眉标 + 项目名主信息」 */
    host.classList.toggle('is-price-cat', cat === 'price');
    var rows = cat === 'price'
      ? importableRows('price').concat(importableRows('product'))
      : importableRows(cat);
    var blocked = cat === 'price'
      ? blockedRows('price').concat(blockedRows('product'))
      : blockedRows(cat);
    var sum = $('#checkTabSum');
    if (sum) {
      sum.innerHTML = verifyTabMetrics(cat, rows).map(function (m) {
        return '<span><em>' + m.v + '</em>' + m.k + '</span>';
      }).join('');
    }
    var html = '';
    if (cat === 'price') {
      html = renderPriceSectionsHtml();
    } else {
      var groups = {};
      var order = [];
      if (cat === 'member') {
        groups[''] = rows;
        order = [''];
      } else {
        rows.forEach(function (r) {
          var g = verifyGroupKey(cat, r);
          if (!groups[g]) { groups[g] = []; order.push(g); }
          groups[g].push(r);
        });
      }
      html = order.map(function (g) {
        var list = groups[g];
        var show = list.slice(0, cat === 'card' ? 12 : 8);
        var more = list.length - show.length;
        var head = g
          ? '<div class="verify-group__hd"><b>' + esc(g) + '</b><span>' + list.length + ' 条</span></div>'
          : '';
        var body = show.map(function (r) { return verifyRowHtml(cat, r); }).join('');
        return '<section class="verify-group' + (cat === 'card' ? ' is-card-group' : '') + '">' +
          head + body +
          (more > 0 ? '<p class="verify-group__more">还有 ' + more + ' 条，导入后在列表中查看</p>' : '') +
        '</section>';
      }).join('');
    }
    if (blocked.length) {
      html += '<section class="verify-group is-blocked">' +
        '<div class="verify-group__hd"><b>未达入库门槛</b><span>' + blocked.length + ' 条</span></div>' +
        '<p class="verify-group__hint">缺必填或含无法识别字段，确认导入时不会写入。</p>' +
        blocked.slice(0, 6).map(function (r) {
          var bCat = (state.checkData.price || []).indexOf(r) >= 0 ? 'price'
            : ((state.checkData.product || []).indexOf(r) >= 0 ? 'product' : cat);
          var msg = ((r.problems || []).filter(function (p) { return p.level === 'error'; })[0] || {}).msg || '未达门槛';
          return '<div class="verify-row is-blocked"><span class="verify-row__main"><b>' +
            esc((typeof checkRowTitle === 'function' ? checkRowTitle(bCat, r) : '') || '—') +
            '</b><i>' + esc(msg) + '</i></span></div>';
        }).join('') +
        (blocked.length > 6 ? '<p class="verify-group__more">还有 ' + (blocked.length - 6) + ' 条未列出</p>' : '') +
      '</section>';
    }
    host.innerHTML = html;
    var empty = $('#checkEmpty');
    if (empty) empty.classList.toggle('hidden', rows.length > 0 || blocked.length > 0);
    var moreBtn = $('#btnCheckMore');
    if (moreBtn) moreBtn.classList.add('hidden');
  }

  function renderCheckSubNav() {
    var host = $('#checkSubNav');
    if (host) host.innerHTML = '';
  }

  function renderClearWarn() {
    var el = $('#checkClearWarn');
    if (!el) return;
    var labels = clearConflictLabels();
    if (!labels.length) {
      el.classList.add('hidden');
      el.textContent = '';
    } else {
      el.classList.remove('hidden');
      el.innerHTML = '<span class="soft-tip__ico" aria-hidden="true">i</span><span>本批将<strong>清空</strong>店内已有的「' +
        labels.join('、') + '」后写入新数据。</span>';
    }
    var submit = $('#btnCheckSubmit');
    if (submit) submit.textContent = '确认导入';
  }

  function renderCheck() {
    syncCheckModeUI(false);
    ensureCheckData();
    applyForcedReplaceModes();
    if (state.checkTab === 'product') state.checkTab = 'price';
    var cats = checkUiCats();
    if (cats.indexOf(state.checkTab) === -1) state.checkTab = cats[0] || 'member';
    renderCheckSubNav();
    renderClearWarn();
    renderCheckStats();
    renderCheckList();
  }

  /* 上传页按模式切换文案：历史消费不推官方模板，但允许表 + 照片混着传 */
  function syncImportSourceModeUI(isHist) {
    var tpl = $('#sourceTplPromo');
    if (tpl) tpl.classList.toggle('hidden', !!isHist);
    var note = $('#sourceHistoryNote');
    if (note) note.classList.toggle('hidden', !isHist);
    var multi = $('#sourceMultiNote');
    if (multi) {
      multi.classList.remove('hidden');
      multi.textContent = isHist
        ? '最多 5 份表 + 5 张照片；也可回上一步混着传，传错了在列表里直接删。'
        : '最多 5 个文件；传错了在列表里直接删。';
    }
    var lead = $('#sourceLead');
    if (lead) {
      lead.textContent = isHist
        ? '消费记录表：列名不必固定，系统会自己找这几列，无需手动指定。'
        : '推荐按官方标准模板填写，可完美识别。其它表也能识别，可能要多核对几行。';
    }
  }

  /* 通用核对页里的部件在历史模式下收起 / 恢复 */
  function syncCheckModeUI(isHist) {
    ['#checkVerifyMetrics', '#checkTabs', '#checkTabSum', '#checkShelfTip', '#checkClearWarn'].forEach(function (sel) {
      var el = $(sel);
      if (el) el.classList.toggle('hidden', !!isHist);
    });
    var title = $('#checkTitle');
    if (title) title.textContent = isHist ? '核对历史数据' : '核对导入';
    var foot = $('#checkFootNote');
    if (foot) foot.textContent = isHist
      ? '只写入「历史订单」，不进订单流水、不计业绩与会员余额。'
      : '只写入达门槛的行；未达门槛与整份存档不会写入。';
    var submit = $('#btnCheckSubmit');
    if (submit) submit.textContent = isHist ? '确认导入历史消费' : '确认导入';
  }

  /* v2.46：历史核对恢复独立屏（Figma 6-09），按月看样例后再导 */
  function renderHistoryPreview() {
    var list = $('#historyPreviewList');
    if (!list) return;
    var rows = historyRows();
    var t = state.historyTier || buildHistoryTier();
    var total = rows.reduce(function (s, r) { return s + Number(r.amount || 0); }, 0);
    var dates = rows.map(function (r) { return r.date; }).filter(Boolean).sort();
    var countEl = $('#historyPreviewCount');
    var rangeEl = $('#historyPreviewRange');
    var totalEl = $('#historyPreviewTotal');
    if (countEl) countEl.textContent = rows.length;
    if (rangeEl) {
      rangeEl.textContent = dates.length ? (dates[0] + ' ~ ' + dates[dates.length - 1]) : '—';
    }
    if (totalEl) totalEl.textContent = fmtMoney(total);

    var months = {};
    var order = [];
    rows.forEach(function (r) {
      var mk = historyMonthKey(r.date);
      if (!months[mk]) { months[mk] = { key: mk, rows: [], sum: 0 }; order.push(mk); }
      months[mk].rows.push(r);
      months[mk].sum += Number(r.amount || 0);
    });
    order.sort().reverse();
    list.innerHTML = order.map(function (mk) {
      var g = months[mk];
      var open = state.histMonthOpen === mk;
      var samples = g.rows.slice(0, 4).map(function (r) {
        return '<div class="hist-month__sample">' +
          '<span>' + esc(r.name || '未留姓名') + '</span>' +
          '<span>' + esc(r.raw['支付方式'] || '—') + '</span>' +
          '<b>' + fmtMoney(r.amount) + '</b></div>';
      }).join('');
      return '<button type="button" class="hist-month' + (open ? ' is-open' : '') + '" data-hist-month="' + mk + '" aria-expanded="' + (open ? 'true' : 'false') + '">' +
        '<span class="hist-month__hd"><b>' + (mk === '未知' ? '日期未识别' : mk) + '</b><span>' + g.rows.length + ' 笔 · ' + fmtMoney(g.sum) + '</span></span>' +
        (open ? '<span class="hist-month__body">' + samples + '</span>' : '') +
      '</button>';
    }).join('');

    var warn = $('#historyPreviewWarn');
    if (warn) warn.classList.toggle('hidden', !t.fail);
    var cnt = $('#historyPreviewFailCount');
    if (cnt) cnt.textContent = t.fail;
    var confirm = $('#btnHistoryPreviewConfirm');
    if (confirm) {
      confirm.disabled = !!state.historyImporting;
      confirm.textContent = '确认导入';
    }
  }

  /* v2.46：历史成功页恢复独立屏（Figma 6-10） */
  function renderHistoryResult() {
    var t = state.historyTier || buildHistoryTier();
    var batchN = HISTORY_ROWS.length;
    var total = state.historyDeleted ? 0 : (state.storeStock.history || batchN);
    var count = $('#historyResultCount');
    if (count) count.textContent = total;
    var failCount = $('#historyFailCount');
    if (failCount) failCount.textContent = HISTORY_FAIL_ROWS.length;
    var failRow = $('#btnHistoryFailRow');
    if (failRow) {
      failRow.classList.add('hidden');
      failRow.setAttribute('aria-hidden', 'true');
    }
    var lead = $('#historyResultLead');
    if (lead) {
      if (state.historyDeleted) {
        lead.textContent = '本批历史消费已删除，可重新导入。';
      } else {
        lead.textContent = '历史订单已入库，可在「工作台 · 店铺管理 · 历史订单」查看。';
      }
    }
    var src = $('#historyResultSource');
    if (src) {
      var srcBody = t.photoCount
        ? '表 ' + t.excelCount + ' 份 + 照片 ' + t.photoCount + ' 张'
        : '';
      if (state.historyDeleted) {
        src.textContent = '已删除本批' + (srcBody ? ' · ' + srcBody : ' · 只读核对');
      } else {
        src.textContent = srcBody ? '已写入本店 · ' + srcBody : '已写入本店，只读核对';
      }
    }
    var del = $('#btnHistoryDeleteBatch');
    if (del) del.classList.toggle('hidden', !!state.historyDeleted);
    var delCount = $('#historyDelCount');
    if (delCount) delCount.textContent = total || batchN;
  }

  function renderHistoryFail() {
    var list = $('#historyFailList');
    var cnt = $('#historyFailScreenCount');
    if (cnt) cnt.textContent = HISTORY_FAIL_ROWS.length;
    if (!list) return;
    list.innerHTML = HISTORY_FAIL_ROWS.map(function (f, i) {
      var diff = (f.diff || []).map(function (p) {
        return '<dt>' + p[0] + '</dt><dd' + (p[2] ? ' class="is-bad"' : '') + '>' + p[1] + '</dd>';
      }).join('');
      return '<div class="import-fail-item" data-history-fail="' + i + '">' +
        '<div class="import-fail-item__row">' +
          '<strong class="v3-num">第 ' + f.line + ' 行</strong>' +
          '<span class="import-fail-item__reason">' + f.reason + '</span>' +
        '</div>' +
        '<dl class="import-fail-item__diff">' + diff + '</dl>' +
      '</div>';
    }).join('') || '<div class="empty-hero" style="padding:36px 20px"><p class="empty-hero__title">暂无失败行</p><p class="empty-hero__hint">本批都识别成功了。</p></div>';
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
    state.checkOpen = null;
    renderCheckStats();
    renderCheckList();
    showToast('已保存');
  }

  function toggleCheckIgnore(cat, id) {
    var row = checkFindRow(cat, id);
    if (!row) return;
    row.ignored = !row.ignored;
    recomputeCheck(cat);
    state.checkOpen = null;
    renderCheckStats();
    renderCheckList();
    showToast(row.ignored ? '已忽略此行' : '已恢复此行');
  }

  var checkIgnoreArmTimer = null;

  function syncCheckIgnoreAll() {
    var btn = $('#btnCheckIgnoreAll');
    if (!btn) return;
    var n = checkProblemRows(state.checkTab).length;
    var txt = btn.querySelector('span');
    var label = state.checkIgnoreArm ? '再点一次确认' : '全部忽略';
    if (txt) txt.textContent = label;
    else btn.textContent = label;
    btn.classList.toggle('is-armed', !!state.checkIgnoreArm);
    btn.disabled = n === 0;
  }

  function resetCheckIgnoreArm() {
    state.checkIgnoreArm = false;
    clearTimeout(checkIgnoreArmTimer);
    syncCheckIgnoreAll();
  }

  function ignoreAllCheckProblems() {
    var cat = state.checkTab;
    var probs = checkProblemRows(cat);
    if (!probs.length) {
      showToast('当前类别没有待处理问题');
      resetCheckIgnoreArm();
      return;
    }
    if (!state.checkIgnoreArm) {
      state.checkIgnoreArm = true;
      syncCheckIgnoreAll();
      clearTimeout(checkIgnoreArmTimer);
      checkIgnoreArmTimer = setTimeout(function () {
        state.checkIgnoreArm = false;
        syncCheckIgnoreAll();
      }, 8000);
      return;
    }
    clearTimeout(checkIgnoreArmTimer);
    state.checkIgnoreArm = false;
    probs.forEach(function (r) { r.ignored = true; });
    recomputeCheck(cat);
    state.checkOpen = null;
    renderCheckStats();
    renderCheckList();
    showToast('已忽略 ' + probs.length + ' 行');
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
      row.f.price = '';
      row.f.discount = '';
    } else if (cat === 'product') {
      row.f.onShelf = '上架';
      row.f.stockQty = '0';
    } else {
      row.f.bookable = '是';
      row.f.top = '否';
    }
    if (!state.checkData) state.checkData = {};
    if (!state.checkData[cat]) state.checkData[cat] = [];
    state.checkData[cat].unshift(row);
    state.checkOpen = row.id;
    state.checkFilter = 'all';
    state.checkLimit = Math.max(state.checkLimit, 24);
    recomputeCheck(cat);
    renderCheckStats();
    renderCheckList();
    setTimeout(function () { scrollCheckRow(row.id); }, 40);
  }

  /* --- 标准表转换 --- */

  function convertAllStandard() {
    var cats = collectPlan().excel.filter(function (k) { return hasFiles(k); });
    if (!cats.length) return false;
    return cats.every(function (k) { return !!state.uploadStd[k]; });
  }

  function renderConvertSteps(allStd) {
    var host = $('#convertSteps');
    if (!host) return;
    var defs = allStd
      ? [
          { b: '读取原表', e: '表头 / 多 sheet' },
          { b: '校验列名', e: '对齐标准列' },
          { b: '逐行自检', e: '标出问题' }
        ]
      : [
          { b: '读取原表', e: '列名 / 表头' },
          { b: '理解字段', e: '对齐标准列' },
          { b: '转成标准表', e: '补默认值' },
          { b: '逐行自检', e: '标出问题' }
        ];
    host.innerHTML = defs.map(function (d, i) {
      return '<div class="conv-step" data-conv-step="' + i + '">' +
        '<span class="conv-step__dot">' +
          '<svg class="conv-step__tick" viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>' +
        '</span><b>' + d.b + '</b><em>' + d.e + '</em></div>';
    }).join('');
  }

  function resetConvertUI(allStd) {
    var next = $('#btnConvertNext');
    if (next) { next.disabled = true; next.textContent = '转换中…'; }
    renderConvertSteps(allStd);
    var title = $('#convertTitle');
    if (title) title.textContent = allStd ? '正在校验标准模板' : '正在转成标准模板';
    var lead = $('#convertLead');
    if (lead) lead.textContent = allStd ? '列名已符合官方模板，直接核对' : '非标准列名由 AI 对齐官方模板';
    var host = $('#convertResult');
    if (host) { host.innerHTML = ''; host.classList.add('hidden'); }
    var eq = $('#convertEq');
    if (eq) {
      eq.classList.remove('is-done');
      eq.setAttribute('aria-label', 'AI 正在处理');
    }
    $all('[data-conv-step]').forEach(function (el) { el.classList.remove('is-on', 'is-done'); });
  }

  /* 空态：转换页停在「还没开始」。与 resetConvertUI 的区别是按钮要给出下一步，而不是「转换中…」 */
  function setConvertIdle(msg) {
    var title = $('#convertTitle');
    if (title) title.textContent = '等待开始';
    var lead = $('#convertLead');
    if (lead) lead.textContent = msg || '';
    var next = $('#btnConvertNext');
    if (next) { next.disabled = true; next.textContent = '开始转换'; }
    var host = $('#convertResult');
    if (host) { host.innerHTML = ''; host.classList.add('hidden'); }
    var eq = $('#convertEq');
    if (eq) eq.classList.remove('is-done');
    $all('[data-conv-step]').forEach(function (el) { el.classList.remove('is-on', 'is-done'); });
  }

  function runConversion() {
    if (state.convertRunning) return;
    if (state.convertDone) {
      renderConvertResult();
      return;
    }
    state.convertRunning = true;
    var allStd = convertAllStandard();
    resetConvertUI(allStd);
    var steps = $all('[data-conv-step]');
    // 第一步立即点亮，避免开场空档
    if (steps[0]) steps[0].classList.add('is-on');
    var timers = [];
    steps.forEach(function (el, i) {
      timers.push(setTimeout(function () {
        steps.forEach(function (x, j) {
          x.classList.toggle('is-on', j === i);
          x.classList.toggle('is-done', j < i);
        });
      }, 380 + i * 480));
    });
    timers.push(setTimeout(function () {
      state.convertRunning = false;
      state.convertDone = true;
      state.convertTimers = [];
      steps.forEach(function (el) { el.classList.remove('is-on'); el.classList.add('is-done'); });
      var eq = $('#convertEq');
      if (eq) {
        eq.classList.add('is-done');
        eq.setAttribute('aria-label', '转换完成');
      }
      var title = $('#convertTitle');
      if (title) title.textContent = allStd ? '标准模板已读取' : '已转成标准模板';
      var lead = $('#convertLead');
      if (lead) lead.textContent = '未识别字段已标出，进概览逐行核对。';
      ensureCheckData();
      renderConvertResult();
      var all = checkAllStats();
      var next = $('#btnConvertNext');
      if (next) {
        next.disabled = false;
        next.textContent = all.importable ? '去核对 ' + all.importable.toLocaleString('zh-CN') + ' 行' : '去核对数据';
      }
    }, 380 + steps.length * 480 + 320));
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
        '<p class="conv-card__meta">' + st.total.toLocaleString('zh-CN') + ' ' + CHECK_UNIT[k] +
          (issues ? ' · 可逐行改' : '') + '</p>' +
        '<div class="conv-card__bar"><i style="width:' + okPct + '%"></i></div>' +
      '</div>';
    }).join('');

    var photoCats = collectPlan().photo;
    var photoNote = photoCats.length
      ? '<p class="conv-photo-note">拍照 ' + photoCats.reduce(function (s, k) { return s + state.importPhotos[k].length; }, 0) +
        ' 张已在后台转好</p>'
      : '';

    host.innerHTML = cards + photoNote +
      '<div class="conv-fallback">' +
        '<div class="conv-fallback__title"><b>转换不完整？</b></div>' +
        '<div class="conv-fallback__acts">' +
          '<button type="button" data-conv-act="tpl">' +
            '<span class="conv-fallback__ico" aria-hidden="true"><svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M12 3.4c.7 0 1.2.5 1.2 1.2v6.9l2-2 1.7 1.7-4.9 4.9-4.9-4.9 1.7-1.7 2 2V4.6c0-.7.5-1.2 1.2-1.2Z"/><rect x="4" y="17.4" width="16" height="2.4" rx="1.2"/></svg></span>' +
            '<span class="conv-fallback__txt"><b>下载标准模板</b><span>按模板重填</span></span>' +
          '</button>' +
          '<button type="button" data-conv-act="reupload">' +
            '<span class="conv-fallback__ico" aria-hidden="true"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4.6 12a7.4 7.4 0 0 1 12.4-5.4L19 8.6"/><path d="M19.4 4.6v4h-4"/><path d="M19.4 12a7.4 7.4 0 0 1-12.4 5.4L5 15.4"/><path d="M4.6 19.4v-4h4"/></svg></span>' +
            '<span class="conv-fallback__txt"><b>重新上传</b><span>换个文件</span></span>' +
          '</button>' +
        '</div>' +
      '</div>';
    host.classList.remove('hidden');
  }


  function esc(s) {
    return String(s === null || s === undefined ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function openMemberDetailSheet(id) {
    var row = checkFindRow('member', id);
    var body = $('#memberDetailBody');
    var sheet = $('#memberDetailSheet');
    var mask = $('#memberDetailMask');
    if (!row || !body || !sheet) return;
    var f = row.f || {};
    var pairs = [
      ['姓名', f.name], ['手机号', f.phone], ['会员编号', f.memberNo],
      ['卡种', f.cardName || f.cardType], ['卡号', f.cardNo],
      ['充值余额', f.recharge], ['卡余额', f.remain], ['有效期', f.expiry],
      ['性别', f.gender], ['生日', f.birthday], ['备注', f.note]
    ];
    body.innerHTML = '<dl class="member-detail-dl">' + pairs.map(function (p) {
      return '<div><dt>' + esc(p[0]) + '</dt><dd>' + esc(p[1] == null || p[1] === '' ? '—' : String(p[1])) + '</dd></div>';
    }).join('') + '</dl>';
    if (mask) mask.classList.add('show');
    sheet.classList.add('show');
    sheet.setAttribute('aria-hidden', 'false');
  }

  function hideMemberDetailSheet() {
    var sheet = $('#memberDetailSheet');
    var mask = $('#memberDetailMask');
    if (mask) mask.classList.remove('show');
    if (sheet) {
      sheet.classList.remove('show');
      sheet.setAttribute('aria-hidden', 'true');
    }
  }

  /* --- 确认传输：复用统一浮窗进度层 --- */

  function openCheckTransfer() {
    if (state.transferRunning) return;
    if (!state.checkData) ensureCheckData();
    var all = checkAllStats();
    var total = all.importable;
    if (!total) {
      showToast(all.error ? '没有达到导入门槛的数据' : '没有可导入的数据');
      return;
    }

    state.transferRunning = true;
    state.pendingStockApply = true;
    state.lastImportGate = { importable: all.importable, blocked: all.error };
    setImportStage('importing', 'import-check');
    runImportProgress({
      title: '正在导入',
      sub: '写入 ' + total.toLocaleString('zh-CN') + ' 条可入库数据' +
        (all.error ? ' · 跳过 ' + all.error.toLocaleString('zh-CN') + ' 条未达门槛' : ''),
      stages: [
        { at: 0, label: '准备数据' },
        { at: 30, label: '写入会员与持卡' },
        { at: 65, label: '写入卡模板与价目' },
        { at: 92, label: '完成' }
      ],
      duration: 2100,
      holdMs: 320,
      doneLabel: '导入完成',
      onDone: function () {
        state.transferRunning = false;
        setImportStage('done', 'import-result');
        go('import-result');
      }
    });
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
    if (sheet) {
      sheet.classList.add('show');
      sheet.setAttribute('aria-hidden', 'false');
    }
  }

  function hideCheckHelp() {
    var mask = $('#checkHelpMask');
    var sheet = $('#checkHelpSheet');
    if (mask) mask.classList.remove('show');
    if (sheet) {
      sheet.classList.remove('show');
      sheet.setAttribute('aria-hidden', 'true');
    }
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
    patchHistoryDemoNames();
    if (state.emptyPreview === 'history-true') return [];
    return state.historyDeleted ? [] : HISTORY_ROWS;
  }

  /* 演示数据：按会员 id 对齐手机号 / 会员编号 + 姓名（members 列表会按字母重排，不能用数组下标） */
  var HISTORY_DEMO_PATCHED = false;
  function patchHistoryDemoNames() {
    if (HISTORY_DEMO_PATCHED) return;
    HISTORY_DEMO_PATCHED = true;
    var all = ensureMembersData();
    if (!all || !all.length) return;
    var byId = {};
    all.forEach(function (m) { byId[m.id] = m; });
    /* 历史行 id → 会员 id；phone 与 memberNo 二选一演示两种命中路径 */
    var map = { h01: 0, h13: 0, h16: 0, h03: 2, h09: 2, h05: 5, h11: 5, h15: 7 };
    HISTORY_ROWS.forEach(function (r) {
      var mid = map[r.id];
      if (mid === undefined || !byId[mid]) return;
      var m = byId[mid];
      r.name = m.name;
      if (r.id === 'h01' || r.id === 'h13' || r.id === 'h03' || r.id === 'h05' || r.id === 'h15') {
        r.phone = m.phone;
      }
      if (r.id === 'h16' || r.id === 'h09' || r.id === 'h11') {
        r.memberNo = m.memberNo;
      }
    });
  }

  /* ===== 历史消费 × 会员（手机号 / 会员编号命中后再校验姓名） ===== */

  function findMemberById(id) {
    var all = ensureMembersData();
    for (var i = 0; i < all.length; i += 1) {
      if (all[i].id === Number(id)) return all[i];
    }
    return null;
  }

  function sameNameMembers(name) {
    var n = String(name || '').trim();
    if (!n) return [];
    return ensureMembersData().filter(function (m) { return m.name === n; });
  }

  /* 某会员名下的历史消费：须 phone 或 memberNo 命中本会员，且姓名相等；无手机号/编号不匹配 */
  function memberHistoryRows(m) {
    if (!m) return [];
    var mPhone = String(m.phone || '').trim();
    var mNo = String(m.memberNo || '').trim();
    return historyRows().filter(function (r) {
      var phone = String(r.phone || '').trim();
      var mno = String(r.memberNo || '').trim();
      if (!phone && !mno) return false;
      var hit = false;
      if (phone && mPhone && phone === mPhone) hit = true;
      if (mno && mNo && mno === mNo) hit = true;
      if (!hit) return false;
      return String(r.name || '').trim() === m.name;
    }).sort(function (a, b) { return a.date < b.date ? 1 : (a.date > b.date ? -1 : 0); });
  }

  function historyYearKey(date) {
    var m = /^(\d{4})/.exec(String(date || ''));
    return m ? m[1] : '';
  }

  /* 累计充值：办卡 / 充卡 / 续次 / 续费；累计消费：项目与产品消费；两者可重叠计入 */
  function historyRowFlags(r) {
    var t = String((r.raw && (r.raw['项目'] || '')) || '') + ' ' + String((r.raw && (r.raw['备注'] || '')) || '');
    var recharge = /办卡|开卡|充卡|充值|续次|续费|购卡/.test(t);
    var consume = /洗|剪|吹|烫|染|护|造型|美甲|美睫|产品|头皮|护理|套餐/.test(t) || !recharge;
    if (recharge && /赠.*?(洗|剪|吹|烫|染|护)|含(洗|剪|吹|烫|染|护)/.test(t)) consume = true;
    return { recharge: recharge, consume: consume };
  }

  function memberHistorySummary(m) {
    var rows = memberHistoryRows(m);
    var recharge = 0;
    var consume = 0;
    var years = [];
    rows.forEach(function (r) {
      var amt = Number(r.amount || 0);
      var flags = historyRowFlags(r);
      if (flags.recharge) recharge += amt;
      if (flags.consume) consume += amt;
      var y = historyYearKey(r.date);
      if (y && years.indexOf(y) === -1) years.push(y);
    });
    years.sort();
    return {
      rows: rows,
      visits: rows.length,
      recharge: recharge,
      consume: consume,
      total: consume,
      years: years,
      range: years.length ? (years[0] === years[years.length - 1] ? years[0] : years[0] + '–' + years[years.length - 1]) : ''
    };
  }

  function renderMemberDetail() {
    var host = $('#memberProfileBody');
    if (!host) return;
    if (state.memberDetailId == null) state.memberDetailId = 0;
    var m = findMemberById(state.memberDetailId);
    /* 纯占位：不渲染档案卡；仅在找不到会员时提示 */
    if (!m) {
      host.innerHTML = '<div class="mp-placeholder"><p class="mp-placeholder__title">会员不存在</p><p class="mp-placeholder__hint">返回列表重新选择。</p></div>';
      return;
    }
    host.innerHTML =
      '<div class="mp-placeholder">' +
        '<p class="mp-placeholder__title">顾客详情示意</p>' +
        '<p class="mp-placeholder__hint">线上以真实页面为准。点右上角「历史消费」查看「' + esc(m.name) + '」名下的历史订单。</p>' +
      '</div>';
  }

  function renderMemberHistory() {
    var host = $('#memberHistoryBody');
    if (!host) return;
    if (state.memberDetailId == null) state.memberDetailId = 0;
    var m = findMemberById(state.memberDetailId);
    if (!m) {
      host.innerHTML = '<div class="v3-empty"><p class="v3-empty__title">会员不存在</p><p class="v3-empty__hint">返回列表重新选择。</p></div>';
      return;
    }
    var s = memberHistorySummary(m);
    var icoUser = '<svg class="mh-profile__ico mh-profile__ico--user" viewBox="0 0 20 20" width="20" height="20" fill="none" aria-hidden="true"><path d="M2.81569 18H17.1843C17.6348 18 18 17.5942 18 17.0937C18 13.9474 15.3714 11.3968 10 11.3968C4.62857 11.3968 2 13.9474 2 17.0937C2 17.5942 2.36519 18 2.81569 18ZM13 5C13 6.65685 11.6569 8 10 8C8.34314 8 7 6.65685 7 5C7 3.34315 8.34314 2 10 2C11.6569 2 13 3.34315 13 5Z" stroke="#FF7272" stroke-width="2"/></svg>';
    var icoPhone = '<svg class="mh-profile__ico mh-profile__ico--phone" viewBox="0 0 16 16" width="16" height="16" fill="none" aria-hidden="true"><path d="M13.7756 12.514C13.7756 12.514 13.0031 13.2726 12.8138 13.4951C12.5055 13.8241 12.1421 13.9795 11.6659 13.9795C11.6201 13.9795 11.5712 13.9795 11.5254 13.9765C10.6186 13.9186 9.77596 13.5652 9.14396 13.2635C7.41589 12.4287 5.89848 11.2434 4.63754 9.7413C3.59642 8.48903 2.90031 7.33121 2.43929 6.08807C2.15534 5.3294 2.05154 4.7383 2.09734 4.18072C2.12787 3.82423 2.26526 3.52868 2.51867 3.27579L3.55979 2.2368C3.70939 2.09664 3.86815 2.02047 4.02386 2.02047C4.21621 2.02047 4.37192 2.13625 4.46962 2.23375C4.47267 2.2368 4.47572 2.23985 4.47878 2.2429C4.66502 2.41657 4.8421 2.59633 5.02834 2.78829C5.12299 2.88579 5.22069 2.98329 5.31839 3.08384L6.15189 3.91564C6.47553 4.23861 6.47553 4.53721 6.15189 4.86018C6.06335 4.94854 5.97787 5.0369 5.88932 5.12221C5.63286 5.38424 5.83433 5.18319 5.56871 5.42084C5.5626 5.42694 5.55649 5.42998 5.55344 5.43608C5.29087 5.69811 5.33972 5.95405 5.39468 6.12772C5.39773 6.13686 5.40078 6.146 5.40384 6.15515C5.62061 6.67921 5.92592 7.17281 6.39 7.76086L6.39305 7.7639C7.23572 8.79985 8.12418 9.60727 9.10423 10.2258C9.22941 10.305 9.35764 10.369 9.47977 10.4299C9.58968 10.4848 9.69349 10.5366 9.78203 10.5914C9.79424 10.5975 9.80645 10.6067 9.81867 10.6127C9.92247 10.6645 10.0202 10.6889 10.1209 10.6889C10.3743 10.6889 10.5331 10.5305 10.585 10.4787L11.1835 9.88146C11.2873 9.77786 11.4521 9.65294 11.6445 9.65294C11.8338 9.65294 11.9895 9.77177 12.0841 9.87536C12.0872 9.87841 12.0872 9.87841 12.0902 9.88146L13.7725 11.5603C14.087 11.8711 13.7756 12.514 13.7756 12.514Z" stroke="#6B6B6B" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    var profile =
      '<div class="mh-profile">' +
        '<div class="mh-profile__who">' +
          '<div class="mh-profile__name">' + icoUser + '<b>' + esc(m.name) + '</b></div>' +
          '<div class="mh-profile__phone">' + icoPhone + '<span>' + esc(m.phone || '未留手机号') + '</span></div>' +
        '</div>' +
        '<div class="mh-profile__stats" role="group" aria-label="历史订单汇总">' +
          '<div class="mh-profile__cell"><em>' + fmtMoney(s.recharge) + '</em><span>累计充值</span></div>' +
          '<div class="mh-profile__cell"><em>' + fmtMoney(s.consume) + '</em><span>累计消费</span></div>' +
          '<div class="mh-profile__cell"><em class="v3-num">' + s.visits + '</em><span>到店次数</span></div>' +
        '</div>' +
      '</div>';
    if (!s.rows.length) {
      host.innerHTML = profile +
        '<div class="v3-empty">' +
          '<p class="v3-empty__title">暂无历史消费</p>' +
          '<p class="v3-empty__hint">导入的历史记录里没有与「' + esc(m.name) + '」手机号或会员编号匹配的消费。</p>' +
        '</div>';
      return;
    }
    var groups = {};
    var order = [];
    s.rows.forEach(function (r) {
      var y = historyYearKey(r.date) || '未识别年份';
      if (!groups[y]) { groups[y] = { year: y, rows: [], sum: 0 }; order.push(y); }
      groups[y].rows.push(r);
      groups[y].sum += Number(r.amount || 0);
    });
    order.sort(function (a, b) { return a < b ? 1 : (a > b ? -1 : 0); });
    host.innerHTML =
      profile +
      '<div class="mh-list">' +
      order.map(function (y) {
        var g = groups[y];
        var open = state.mhOpenYear === y;
        return '<div class="mh-card' + (open ? ' is-open' : '') + '">' +
          '<button type="button" class="mh-card__hd" data-mh-year="' + esc(y) + '" aria-expanded="' + (open ? 'true' : 'false') + '">' +
            '<span class="mh-card__year">' + esc(y) + '</span>' +
            '<span class="mh-card__right"><em class="mh-card__amt">' + fmtMoney(g.sum) + '</em><i class="mh-card__cnt">' + g.rows.length + ' 笔</i>' +
              '<span class="mh-card__chev" aria-hidden="true"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg></span>' +
            '</span>' +
          '</button>' +
          (open ? '<div class="mh-card__body">' + g.rows.map(function (r) {
            var flags = historyRowFlags(r);
            var tag = flags.recharge && flags.consume ? '充值·消费' : (flags.recharge ? '充值' : '消费');
            return '<div class="mh-row">' +
              '<button type="button" class="mh-row__open" data-mh-open="' + esc(r.id) + '">' +
                '<span class="mh-row__main"><b>' + esc(r.raw['项目'] || '历史消费') + '</b>' +
                  '<i>' + esc(r.date) + ' · ' + esc(r.raw['支付方式'] || '—') + ' · ' + tag + '</i></span>' +
                '<span class="mh-row__amt">' + fmtMoney(r.amount) + '</span>' +
              '</button>' +
            '</div>';
          }).join('') + '</div>' : '') +
        '</div>';
      }).join('') +
      '</div>' +
      '<p class="mh-foot">按手机号或会员编号匹配后校验姓名；无手机号/编号的历史行不会挂到会员名下。</p>';
  }

  function historyFilterActive() {
    var q = state.historyQuery;
    return !!(q.from || q.to || (q.min !== '' && q.min != null) || (q.max !== '' && q.max != null) || q.name);
  }

  function historyMatches(row) {
    if (state.emptyPreview === 'history-filter') return false;
    var q = state.historyQuery;
    if (q.from && row.date < q.from) return false;
    if (q.to && row.date > q.to) return false;
    if (q.min !== '' && Number(row.amount) < Number(q.min)) return false;
    if (q.max !== '' && Number(row.amount) > Number(q.max)) return false;
    if (q.name && String(row.name || '').indexOf(q.name) === -1) return false;
    return true;
  }

  function clearHistoryFilterQuery() {
    state.historyQuery.from = '';
    state.historyQuery.to = '';
    state.historyQuery.min = '';
    state.historyQuery.max = '';
    state.historyQuery.name = '';
    if ($('#historySearch')) $('#historySearch').value = '';
    if ($('#historyFrom')) $('#historyFrom').value = '';
    if ($('#historyTo')) $('#historyTo').value = '';
    if ($('#historyMin')) $('#historyMin').value = '';
    if ($('#historyMax')) $('#historyMax').value = '';
  }

  function syncHistoryEmptyUI(mode) {
    var title = $('#historyEmptyTitle');
    var hint = $('#historyEmptyHint');
    var clearBtn = $('#btnHistoryEmptyClear');
    var importBtn = $('#btnHistoryEmptyImport');
    if (mode === 'true') {
      if (title) title.textContent = '还没有历史订单';
      if (hint) hint.textContent = '把老店账单导进来，只用于查看核对，不进订单流水。';
      if (clearBtn) clearBtn.classList.add('hidden');
      if (importBtn) {
        importBtn.classList.remove('btn-outline');
        importBtn.classList.add('btn-primary');
        importBtn.textContent = '导入';
      }
    } else {
      if (title) title.textContent = '没有符合条件的历史订单';
      if (hint) hint.textContent = '换个时间或金额范围试试。';
      if (clearBtn) clearBtn.classList.remove('hidden');
      if (importBtn) {
        importBtn.classList.remove('btn-primary');
        importBtn.classList.add('btn-outline');
        importBtn.textContent = '导入';
      }
    }
  }

  function histMonthKey(date) {
    var m = String(date || '').match(/^(\d{4})-(\d{1,2})/);
    return m ? m[1] + '-' + ('0' + m[2]).slice(-2) : '';
  }

  function histMonthLabel(key) {
    if (!key) return '日期未识别';
    return key.slice(0, 4) + ' 年 ' + Number(key.slice(5, 7)) + ' 月';
  }

  function renderHistoryOrders() {
    var list = $('#historyList');
    var empty = $('#historyEmpty');
    var summary = $('#historySummary');
    var screen = $('#screen-history-orders');
    if (!list) return;
    var base = historyRows();
    var rows = base.filter(historyMatches);
    var total = rows.reduce(function (s, r) { return s + Number(r.amount || 0); }, 0);
    if (summary) summary.textContent = '共 ' + rows.length + ' 条 · 合计 ' + fmtMoney(total);
    if (!rows.length) {
      list.innerHTML = '';
      var trueEmpty = state.emptyPreview === 'history-true' ||
        (state.emptyPreview !== 'history-filter' && base.length === 0);
      syncHistoryEmptyUI(trueEmpty ? 'true' : 'filter');
      if (empty) empty.classList.remove('hidden');
      if (screen) screen.classList.add('is-list-empty');
      return;
    }
    if (empty) empty.classList.add('hidden');
    if (screen) screen.classList.remove('is-list-empty');

    var groups = [];
    var byKey = {};
    rows.forEach(function (r) {
      var k = histMonthKey(r.date);
      if (!byKey[k]) {
        byKey[k] = { key: k, rows: [], total: 0 };
        groups.push(byKey[k]);
      }
      byKey[k].rows.push(r);
      byKey[k].total += Number(r.amount || 0);
    });
    groups.sort(function (a, b) { return a.key < b.key ? 1 : a.key > b.key ? -1 : 0; });

    list.innerHTML = groups.map(function (g) {
      return '<section class="hist-group">' +
        '<div class="hist-group__hd"><b>' + histMonthLabel(g.key) + '</b>' +
          '<span class="hist-group__sum">' + g.rows.length + ' 条 · ' + fmtMoney(g.total) + '</span></div>' +
        '<div class="hist-group__list">' +
          g.rows.map(function (r) {
            return '<button type="button" class="history-item" data-history-id="' + r.id + '">' +
              '<span class="history-item__main">' +
                '<span class="history-item__name">' + (r.name || '未留姓名') + '</span>' +
                '<span class="history-item__meta">' + r.date.slice(5) + ' · ' + (r.raw['项目'] || '—') +
                (r.raw['支付方式'] ? ' · ' + r.raw['支付方式'] : '') + '</span>' +
              '</span>' +
              '<span class="history-item__amount">' + fmtMoney(r.amount) + '</span>' +
              '<svg class="history-item__chev" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>' +
            '</button>';
          }).join('') +
        '</div>' +
      '</section>';
    }).join('');
  }

  function histDiffRows(pairs, rawMode) {
    return pairs.map(function (p) {
      var bad = p[2];
      var cls = 'hist-diff__v' + (rawMode || bad ? ' is-raw' : '') + (bad && !rawMode ? ' is-bad' : '');
      return '<div class="hist-diff__row">' +
        '<span class="hist-diff__k">' + p[0] + '</span>' +
        '<span class="' + cls + '">' + p[1] + '</span>' +
      '</div>';
    }).join('');
  }

  function renderHistoryDetail() {
    var body = $('#historyDetailBody');
    if (!body) return;
    /* 返回目标：从会员历史 / 核对页进来时回到来处 */
    var back = $('#btnHistoryDetailBack');
    if (back) back.setAttribute('data-go', state.historyReturnFlow || 'history-orders');
    var row = null;
    HISTORY_ROWS.forEach(function (r) { if (r.id === state.historySelectedId) row = r; });
    if (!row) {
      body.innerHTML = '<div class="v3-empty"><p class="v3-empty__title">记录不存在</p><p class="v3-empty__hint">该记录可能已被删除，返回列表重新选择。</p></div>';
      return;
    }
    var rawPairs = Object.keys(row.raw).map(function (k) {
      return [k, row.raw[k] || '未填'];
    });
    body.innerHTML =
      '<div class="history-detail-card">' +
        '<div class="history-detail-card__amount">' + fmtMoney(row.amount) + '</div>' +
        '<div class="history-detail-card__when">' + row.date + '</div>' +
        '<div class="history-detail-card__who">' + (row.name || '未留姓名') + '</div>' +
      '</div>' +
      '<div class="history-detail-sec">' +
        '<div class="history-detail-sec__title">已识别<i>3 项</i></div>' +
        histDiffRows([
          ['消费日期', row.date],
          ['金额', fmtMoney(row.amount)],
          ['顾客姓名', row.name || '未填']
        ]) +
      '</div>' +
      '<div class="history-detail-sec">' +
        '<div class="history-detail-sec__title">原始字段<i>' + rawPairs.length + ' 项</i></div>' +
        histDiffRows(rawPairs, true) +
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

  function historyMonthKey(dateStr) {
    var m = /^(\d{4})-(\d{2})/.exec(String(dateStr || ''));
    return m ? (m[1] + '-' + m[2]) : '未知';
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
        clearHistoryFilterQuery();
        if (state.emptyPreview === 'history-filter') state.emptyPreview = null;
        renderHistoryOrders();
        syncNav(state.flow);
      });
    }

    var emptyClear = $('#btnHistoryEmptyClear');
    if (emptyClear) {
      emptyClear.addEventListener('click', function () {
        clearHistoryFilterQuery();
        if (state.emptyPreview === 'history-filter') state.emptyPreview = null;
        renderHistoryOrders();
        syncNav(state.flow);
        showToast('已清除筛选');
      });
    }

    var list = $('#historyList');
    if (list) {
      list.addEventListener('click', function (e) {
        var item = e.target.closest('[data-history-id]');
        if (!item) return;
        state.historySelectedId = item.getAttribute('data-history-id');
        state.historyReturnFlow = null;
        go('history-detail');
      });
    }

    /* ---- v2.45/v2.47：会员详情 / 会员历史消费 ---- */
    var mhBack = $('#btnMemberHistoryBack');
    if (mhBack) {
      mhBack.addEventListener('click', function () {
        go('member-detail');
      });
    }
    var mhNav = $('#btnMemberHistoryNav');
    if (mhNav) {
      mhNav.addEventListener('click', function () {
        state.mhOpenYear = null;
        go('member-history');
      });
    }

    document.addEventListener('click', function (e) {
      /* 年份卡片：左边年份、右边金额，点开看该年明细 */
      var yb = e.target.closest('[data-mh-year]');
      if (yb) {
        var y = yb.getAttribute('data-mh-year');
        state.mhOpenYear = state.mhOpenYear === y ? null : y;
        renderMemberHistory();
        return;
      }
      /* 明细行 → 订单详情（返回回到会员历史） */
      var mo = e.target.closest('[data-mh-open]');
      if (mo) {
        state.historySelectedId = mo.getAttribute('data-mh-open');
        state.historyReturnFlow = 'member-history';
        go('history-detail');
        return;
      }
      /* 核对页 · 月份卡片开合（样例只看不点） */
      var cm = e.target.closest('[data-hist-month]');
      if (cm) {
        var mk = cm.getAttribute('data-hist-month');
        state.histMonthOpen = state.histMonthOpen === mk ? null : mk;
        renderHistoryPreview();
        return;
      }
      /* 历史完成页：去看历史订单 / 原始存档 */
      var hr = e.target.closest('[data-hist-result]');
      if (hr) {
        if (hr.getAttribute('data-hist-result') === 'archive') {
          openArchiveList('order', 'import-result');
        } else {
          exitHistoryMode();
          state.viewReturn = 'import-result';
          go('history-orders');
        }
        return;
      }
    });

    function wireHistoryImportEntry(el) {
      if (!el) return;
      el.addEventListener('click', function () {
        enterHistoryImport();
      });
    }
    wireHistoryImportEntry($('#btnHistoryOrdersImport'));
    wireHistoryImportEntry($('#btnHistoryEmptyImport'));

    var hrExport = $('#btnHistoryReimportExport');
    if (hrExport) {
      hrExport.addEventListener('click', function () {
        openExportStoreSheet();
      });
    }
    var hrContinue = $('#btnHistoryReimportContinue');
    if (hrContinue) {
      hrContinue.addEventListener('click', function () {
        hideHistoryReimportSheet();
        /* v2.50：一律清空再导（对齐主链 importClearSheet） */
        state.historyReimportIntent = 'replace';
        state.historyDeleted = true;
        state.storeStock.history = 0;
        goHistoryImportStart();
      });
    }
    var hrMask = $('#historyReimportMask');
    if (hrMask) hrMask.addEventListener('click', hideHistoryReimportSheet);
  }

  /* 历史消费导入：核对页（Figma 6-09）/ 完成页（6-10）/ 失败明细 */
  function bindHistoryImport() {
    var back = $('#btnHistoryPreviewBack');
    if (back) {
      back.addEventListener('click', function () {
        go('import-cards');
      });
    }

    var confirm = $('#btnHistoryPreviewConfirm');
    if (confirm) confirm.addEventListener('click', submitHistoryImport);

    var failRow = $('#btnHistoryFailRow');
    if (failRow) {
      failRow.classList.add('hidden');
      failRow.setAttribute('aria-hidden', 'true');
    }

    var failDl = $('#btnHistoryFailDownload');
    if (failDl) {
      failDl.addEventListener('click', function () {
        showToast('已生成 失败行.xls（演示）');
      });
    }

    var goOrders = $('#btnHistoryResultGo');
    if (goOrders) {
      goOrders.addEventListener('click', function () {
        exitHistoryMode();
        state.viewReturn = 'history-import-result';
        go('history-orders');
      });
    }

    function closeHistoryDel() {
      var mask = $('#historyDelMask');
      var dlg = $('#historyDelDialog');
      if (mask) mask.classList.remove('show');
      if (dlg) dlg.classList.remove('show');
    }

    var delBtn = $('#btnHistoryDeleteBatch');
    if (delBtn) {
      delBtn.addEventListener('click', function () {
        if (state.historyDeleted) return;
        var mask = $('#historyDelMask');
        var dlg = $('#historyDelDialog');
        if (mask) mask.classList.add('show');
        if (dlg) dlg.classList.add('show');
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
        renderHistoryResult();
        renderImportBanner();
        showToast('已删除本批历史消费');
      });
    }
  }

  function bindImport() {
    /* ---- 新流程：选来源 → 获取 → 识别 → 分类卡片 ---- */
    var enterExcel = $('#btnEnterExcel');
    if (enterExcel) {
      enterExcel.addEventListener('click', function () {
        state.uploadFocus = null;
        /* 选源页内联上传：点 Excel 卡直接落演示文件 */
        addPendingExcel();
        renderImportSelect();
      });
    }

    var enterPhoto = $('#btnEnterPhoto');
    if (enterPhoto) {
      enterPhoto.addEventListener('click', function () {
        openCamera();
      });
    }

    var pickExcel = $('#btnPickExcel');
    if (pickExcel) {
      pickExcel.addEventListener('click', function () {
        addPendingExcel();
      });
    }

    var analyze = $('#btnImportAnalyze');
    if (analyze) {
      analyze.addEventListener('click', function () {
        startAnalysis();
      });
    }

    var analyzeSkip = $('#btnAnalyzeSkip');
    if (analyzeSkip) {
      analyzeSkip.addEventListener('click', function () {
        skipAnalysis();
      });
    }

    var cardsNext = $('#btnCardsNext');
    if (cardsNext) {
      cardsNext.addEventListener('click', function () {
        go('import-check');
      });
    }

    // 待识别清单里的「移除」：Excel 与照片共用一个 data 属性，按 id 归属哪个池子分流
    document.addEventListener('click', function (e) {
      var del = e.target.closest('[data-pending-del]');
      if (!del) return;
      var id = del.getAttribute('data-pending-del');
      var inExcel = state.pending.excel.some(function (f) { return f.id === id; });
      if (inExcel) removePendingExcel(id);
      else removePendingPhoto(id);
      showToast('已移除');
    });

    var guideNext = $('#btnImportGuideNext');
    if (guideNext) {
      guideNext.addEventListener('click', function () {
        go('import-select');
      });
    }

    var selectBack = $('#btnImportSelectBack');
    if (selectBack) {
      selectBack.addEventListener('click', function () {
        if (state.importMode === 'history') {
          exitHistoryMode();
          go('history-orders');
          return;
        }
        if (hasP0Stock()) go('import-overview');
        else go('import-guide');
      });
    }

    var overviewContinue = $('#btnOverviewContinue');
    if (overviewContinue) {
      overviewContinue.addEventListener('click', function () {
        startImportFromOverview();
      });
    }
    var importClearExport = $('#btnImportClearExport');
    if (importClearExport) {
      importClearExport.addEventListener('click', function () {
        openExportStoreSheet();
      });
    }
    var importClearContinue = $('#btnImportClearContinue');
    if (importClearContinue) {
      importClearContinue.addEventListener('click', function () {
        hideImportClearSheet();
        state.reimportMode = blankReimportMode();
        go('import-select');
      });
    }
    var importClearMask = $('#importClearMask');
    if (importClearMask) {
      importClearMask.addEventListener('click', function () {
        hideImportClearSheet();
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
        else showToast(IMPORT_CAT_SHORT[type] + '列表为原型占位，以线上系统为准');
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
        // 来自「确认有效项」链路：直接进 L3 核对
        if (state.flow === 'import-confirm' || state.flow === 'import-cards' || state.confirmItems.acknowledged) {
          setImportStage('check', 'import-check');
          go('import-check');
          return;
        }
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
        }
      });
    }

    var uploadStdToggle = $('#uploadStdToggle');
    if (uploadStdToggle) {
      uploadStdToggle.addEventListener('change', function () {
        var cats = uploadCats();
        var cur = cats[state.uploadStep] || null;
        if (!cur) return;
        state.uploadStd[cur] = !!uploadStdToggle.checked;
        renderUploadList();
        showToast(uploadStdToggle.checked ? '按标准模板识别' : '其它表也能识别');
      });
    }

    var uploadDone = $('#btnImportUploadDone');
    if (uploadDone) {
      uploadDone.addEventListener('click', function () {
        go('import-select');
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

    var camDrawerBtn = $('#btnCamDrawer');
    if (camDrawerBtn) {
      camDrawerBtn.addEventListener('click', function () {
        state.camDrawerOpen = !state.camDrawerOpen;
        var drawer = $('#camAlbumDrawer');
        if (drawer) drawer.classList.toggle('is-open', !!state.camDrawerOpen);
        camDrawerBtn.setAttribute('aria-expanded', state.camDrawerOpen ? 'true' : 'false');
      });
    }
    var camStack = $('#btnCamStack');
    if (camStack) {
      camStack.addEventListener('click', function () {
        if (!state.pending.photo.length) {
          state.camDrawerOpen = true;
          var drawer = $('#camAlbumDrawer');
          if (drawer) drawer.classList.add('is-open');
          var handle = $('#btnCamDrawer');
          if (handle) handle.setAttribute('aria-expanded', 'true');
          return;
        }
        if (state.camRailOpen) {
          /* 收起：先量旧格位，再重绘，最后让照片飞回叠图 */
          var oldRects = camRailItemRects();
          state.camRailOpen = false;
          renderCamera();
          camRailCollapseFly(oldRects);
          return;
        }
        state.camRailOpen = true;
        renderCamera();
        camRailOpenFly();
      });
    }
    var camAlbumGrid = $('#camAlbumGrid');
    if (camAlbumGrid) {
      camAlbumGrid.addEventListener('click', function (e) {
        var btn = e.target.closest('[data-album-idx]');
        if (!btn) return;
        var idx = parseInt(btn.getAttribute('data-album-idx'), 10) || 0;
        var shot = demoAlbumShots()[idx];
        if (!shot) return;
        /* 点勾选块 = 选中/取消；点缩略图 = 打开大图预览 */
        if (e.target.closest('[data-album-check]')) {
          toggleAlbumPick(shot.src);
          return;
        }
        openCamPreview(idx);
      });
    }
    var camPickedRail = $('#camPickedRail');
    if (camPickedRail) {
      camPickedRail.addEventListener('click', function (e) {
        var del = e.target.closest('[data-rail-del]');
        if (!del) return;
        deleteShot(del.getAttribute('data-rail-del'));
      });
    }
    var camPreviewClose = $('#btnCamPreviewClose');
    if (camPreviewClose) camPreviewClose.addEventListener('click', function () { closeCamPreview(); });
    var camPreviewPick = $('#btnCamPreviewPick');
    if (camPreviewPick) {
      camPreviewPick.addEventListener('click', function () {
        var shot = demoAlbumShots()[state.camPreviewIdx];
        if (!shot) return;
        /* 「选择这张」选中并收起；文案为「取消选择」时取消选中并收起 */
        toggleAlbumPick(shot.src);
        closeCamPreview();
        renderCamera();
      });
    }
    var camPreviewEl = $('#camPreview');
    if (camPreviewEl) {
      camPreviewEl.addEventListener('click', function (e) {
        if (e.target === camPreviewEl) closeCamPreview();
      });
    }
    var camTableDemo = $('#btnCamTableDemo');
    if (camTableDemo) {
      camTableDemo.addEventListener('click', function () {
        state.camTableGuide = !state.camTableGuide;
        syncCamWatermark();
      });
    }

    var camDone = $('#btnCameraDone');
    if (camDone) {
      camDone.addEventListener('click', function () {
        go('import-select');
        if (state.pending.photo.length) showToast('已拍 ' + state.pending.photo.length + ' 张，可继续加 Excel');
      });
    }

    var camBack = $('#btnCameraBack');
    if (camBack) {
      camBack.addEventListener('click', function () {
        go('import-select');
      });
    }

    var camAlbum = $('#btnCameraAlbum');
    if (camAlbum) {
      camAlbum.addEventListener('click', function () {
        pickPhotoFor();
      });
    }

    var camRetry = $('#btnCameraRetry');
    if (camRetry) {
      camRetry.addEventListener('click', function (e) {
        e.stopPropagation();
        startCamera();
      });
    }

    var camScreen = $('#screen-import-camera');
    if (camScreen) {
      camScreen.addEventListener('click', function (e) {
        var del = e.target.closest('[data-shot-del]');
        if (del) deleteShot(del.getAttribute('data-shot-del'), del.getAttribute('data-shot-cat'));
      });
    }

    var history = $('#btnImportHistory');
    if (history) {
      history.addEventListener('click', function () {
        goHistoryImportStart();
      });
    }

    var backHome = $('#btnImportBackHome');
    if (backHome) {
      backHome.addEventListener('click', function () {
        state.viewReturn = null;
        exitHistoryMode();
        go('home');
      });
    }

    /* data-result-view 由 renderResultStockLines 动态生成，用委托 */
    var resultStockHost = $('#resultStockList');
    if (resultStockHost) {
      resultStockHost.addEventListener('click', function (e) {
        var btn = e.target.closest('[data-result-view]');
        if (!btn) return;
        openResultCatView(btn.getAttribute('data-result-view'));
      });
    }

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
        ALL_CATS.forEach(function (k) { state.storeStock[k] = 0; });
        var blankMode = {};
        ALL_CATS.forEach(function (k) { blankMode[k] = null; });
        state.reimportMode = blankMode;
        showToast('已删除已导入数据，会员与卡已回到导入前状态');
        go('import-guide');
      });
    }

    var failRow = $('#btnImportFailRow');
    if (failRow) {
      failRow.classList.add('hidden');
      failRow.setAttribute('aria-hidden', 'true');
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

    /* ---- 概览 / 微信引导 ---- */

    var checkScreen = $('#screen-import-check');
    if (checkScreen) {
      checkScreen.addEventListener('click', function (e) {
        var tab = e.target.closest('[data-check-tab]') || e.target.closest('[data-check-tab-jump]');
        if (tab) {
          var nextTab = tab.getAttribute('data-check-tab') || tab.getAttribute('data-check-tab-jump');
          if (nextTab && nextTab !== state.checkTab) {
            state.checkTab = nextTab;
            state.checkFilter = 'all';
            state.checkLimit = 24;
            state.checkOpen = null;
            state.inlineEdit = null;
            renderCheck();
          }
          return;
        }
        /* 顶部数据类型卡片：切到该类别 tab，并平滑滚到下方数据列表 */
        var jumpCard = e.target.closest('[data-check-jump]');
        if (jumpCard) {
          var jk = jumpCard.getAttribute('data-check-jump');
          if (jk && jk !== state.checkTab) {
            state.checkTab = jk;
            state.checkFilter = 'all';
            state.checkLimit = 24;
            state.checkOpen = null;
            state.inlineEdit = null;
            renderCheck();
          }
          var listHost = document.getElementById('checkList');
          if (listHost) {
            try { listHost.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
            catch (err) { listHost.scrollIntoView(); }
          }
          return;
        }
        var chip = e.target.closest('[data-check-filter]');
        if (chip) {
          state.checkFilter = chip.getAttribute('data-check-filter');
          state.checkOpen = null;
          state.inlineEdit = null;
          renderCheckStats();
          renderCheckList();
          return;
        }
        var shelfBtn = e.target.closest('[data-shelf-toggle]');
        if (shelfBtn) {
          e.preventDefault();
          e.stopPropagation();
          var sid = shelfBtn.getAttribute('data-shelf-toggle');
          var scat = shelfBtn.getAttribute('data-shelf-cat') || state.checkTab;
          var srow = checkFindRow(scat, sid) || (checkFindRowLoose(sid) || {}).row;
          if (srow && srow.f) {
            var nextOn = !rowShelfOn(srow);
            srow.f.onShelf = nextOn ? '上架' : '下架';
            srow.f.shelfOn = nextOn;
            renderCheckList();
            showToast(nextOn ? '已上架' : '已下架');
          }
          return;
        }
        var memBtn = e.target.closest('[data-member-detail]');
        if (memBtn) {
          openMemberDetailSheet(memBtn.getAttribute('data-member-detail'));
          return;
        }
        /* 价目表：名称 / 价格均可点编，失焦自动保存 */
        var inlineStart = e.target.closest('[data-inline-start]');
        if (inlineStart) {
          e.preventDefault();
          var iid = inlineStart.getAttribute('data-inline-start');
          var ifield = inlineStart.getAttribute('data-inline-focus') || 'price';
          var icat = inlineStart.getAttribute('data-inline-cat') || state.checkTab;
          if (state.inlineEdit && (state.inlineEdit.id !== iid || state.inlineEdit.field !== ifield)) {
            if (!commitInlineEdit(true)) return;
          }
          state.inlineEdit = { id: iid, field: ifield, cat: icat };
          state.checkOpen = null;
          renderCheckList();
          focusInlineInput();
          return;
        }
        var openBtn = e.target.closest('[data-check-open]');
        if (openBtn) {
          var oid = openBtn.getAttribute('data-check-open');
          state.checkOpen = state.checkOpen === oid ? null : oid;
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
        var ignoreAllBtn = e.target.closest('#btnCheckIgnoreAll');
        if (ignoreAllBtn) {
          ignoreAllCheckProblems();
          return;
        }
        /* 点编辑行之外：失焦路径会提交；此处兜底提交 */
        if (state.inlineEdit && !e.target.closest('[data-inline-row]')) commitInlineEdit();
      });

      /* 行内编辑：失焦自动保存；回车保存；Esc 取消 */
      checkScreen.addEventListener('focusout', function (e) {
        if (!state.inlineEdit) return;
        if (!e.target || !e.target.getAttribute || !e.target.getAttribute('data-inline-input')) return;
        var row = e.target.closest('[data-inline-row]');
        if (row && e.relatedTarget && row.contains(e.relatedTarget)) return;
        setTimeout(function () {
          if (state.inlineEdit) commitInlineEdit();
        }, 0);
      });
      checkScreen.addEventListener('keydown', function (e) {
        if (!state.inlineEdit) return;
        if (!e.target.closest('[data-inline-row]')) return;
        if (e.key === 'Enter') {
          e.preventDefault();
          commitInlineEdit();
        } else if (e.key === 'Escape') {
          e.preventDefault();
          cancelInlineEdit();
        }
      });
    }

    var checkBack = $('#btnCheckBack');
    if (checkBack) {
      checkBack.addEventListener('click', function () {
        if (state.importMode === 'history') {
          exitHistoryMode();
          go('history-orders');
          return;
        }
        leaveImportShell();
      });
    }
    var checkAdd = $('#btnCheckAdd');
    if (checkAdd) checkAdd.addEventListener('click', addCheckRow);
    var checkMore = $('#btnCheckMore');
    if (checkMore) {
      checkMore.addEventListener('click', function () {
        state.checkLimit += 24;
        renderCheckList();
      });
    }
    var checkSubmit = $('#btnCheckSubmit');
    if (checkSubmit) checkSubmit.addEventListener('click', function () {
      if (state.importMode === 'history') { submitHistoryImport(); return; }
      openCheckTransfer();
    });

    var mdClose = $('#btnMemberDetailClose');
    if (mdClose) mdClose.addEventListener('click', hideMemberDetailSheet);
    var mdMask = $('#memberDetailMask');
    if (mdMask) mdMask.addEventListener('click', hideMemberDetailSheet);

    var checkHelp = $('#btnCheckHelp');
    if (checkHelp) checkHelp.addEventListener('click', openCheckHelp);
    var checkHelpClose = $('#btnCheckHelpClose');
    if (checkHelpClose) checkHelpClose.addEventListener('click', hideCheckHelp);
    var checkHelpMask = $('#checkHelpMask');
    if (checkHelpMask) checkHelpMask.addEventListener('click', hideCheckHelp);

    document.addEventListener('click', function (e) {
      var openTpl = e.target.closest('[data-open-tpl]');
      if (openTpl) {
        e.preventDefault();
        openTplSheet();
      }
    });
    var tplDownload = $('#btnTplDownload');
    if (tplDownload) tplDownload.addEventListener('click', openTplSheet);
    var tplClose = $('#btnTplClose');
    if (tplClose) tplClose.addEventListener('click', hideTplSheet);
    var tplMask = $('#tplMask');
    if (tplMask) tplMask.addEventListener('click', hideTplSheet);

    bindLegacyCard();
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
        var row = e.target.closest('.pick-row[data-member-id]');
        if (!row) return;
        /* v2.45：进入「顾客详情」（示意占位），其内「消费明细 → 历史消费」 */
        state.memberDetailId = Number(row.getAttribute('data-member-id'));
        state.historyReturnFlow = null;
        go('member-detail');
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
    if (state.importMode === 'history') {
      renderHistoryResultSummary();
      renderResultSources();
      setImportStage('done', 'import-result');
      return;
    }
    if (state.pendingStockApply) {
      applyBatchToStock();
      state.pendingStockApply = false;
    }
    renderResultTierSummary();
    /* v2.36：成功页删除「已导入」明细第二卡 */
    var stockHost = $('#resultStockList');
    if (stockHost) {
      stockHost.innerHTML = '';
      var wrap = stockHost.closest('.v3-stock');
      if (wrap) wrap.classList.add('hidden');
    }
    renderResultSources();
    setImportStage('done', 'import-result');
  }

  function renderHistoryResultSummary() {
    var t = state.historyTier || buildHistoryTier();
    var title = $('#importResultTitle');
    var lead = $('#importResultLead');
    if (title) title.textContent = '历史消费已导入';
    if (lead) lead.textContent = '只写进「历史订单」；订单流水、业绩与会员余额都不受影响。';
    /* 历史模式下用不到主链的失败明细 / 删除本批 / 再导历史入口 */
    ['#btnImportFailRow', '#btnImportHistory', '#btnImportDeleteBatch', '#importResultMerge'].forEach(function (sel) {
      var el = $(sel);
      if (el) el.classList.add('hidden');
    });
    var host = $('#resultTierSummary');
    if (!host) return;
    host.innerHTML =
      '<div class="result-tier-card">' +
        '<div class="result-tier-row">' +
          '<span class="result-tier-row__lab"><b>写入历史订单</b><em>' + t.digest + ' 笔 · ' + fmtMoney(t.total) + '</em></span>' +
          '<span class="result-tier-row__num">' + t.digest + '</span>' +
          '<button type="button" class="result-tier-row__go" data-hist-result="orders">去看</button>' +
        '</div>' +
        '<div class="result-tier-row">' +
          '<span class="result-tier-row__lab"><b>仅存档</b><em>原件已留，可检索</em></span>' +
          '<span class="result-tier-row__num">' + t.archive.length + '</span>' +
          '<button type="button" class="result-tier-row__go" data-hist-result="archive">去看</button>' +
        '</div>' +
      '</div>';
  }

  function renderResultTierSummary() {
    if (state.importMode === 'history') { renderHistoryResultSummary(); return; }
    ['#btnImportFailRow', '#btnImportHistory', '#btnImportDeleteBatch'].forEach(function (sel) {
      var el = $(sel);
      if (el) el.classList.remove('hidden');
    });
    ensureTierDemo();
    var host = $('#resultTierSummary');
    if (!host) return;
    var l1 = (state.tierResult.l1 || []).length;
    var l2 = (state.tierResult.l2 || []).length;
    var l3n = 0;
    (state.tierResult.l3Cats || []).forEach(function (k) {
      if (state.importSelection[k]) l3n += checkStats(k).importable || batchCount(k) || 0;
    });
    host.innerHTML =
      '<div class="result-tier-card">' +
        '<div class="result-tier-row">' +
          '<span class="result-tier-row__lab"><b>已导入</b><em>对上字段，已写入本店</em></span>' +
          '<span class="result-tier-row__num">' + l3n + '</span>' +
          '<button type="button" class="result-tier-row__go" data-result-tier="l3">去看</button>' +
        '</div>' +
        '<div class="result-tier-row">' +
          '<span class="result-tier-row__lab"><b>识别摘要</b><em>可在各模块 ··· 查阅</em></span>' +
          '<span class="result-tier-row__num">' + l2 + '</span>' +
          '<button type="button" class="result-tier-row__go" data-result-tier="l2">去看</button>' +
        '</div>' +
        '<div class="result-tier-row">' +
          '<span class="result-tier-row__lab"><b>仅存档</b><em>原件已留，可检索</em></span>' +
          '<span class="result-tier-row__num">' + l1 + '</span>' +
          '<button type="button" class="result-tier-row__go" data-result-tier="l1">去看</button>' +
        '</div>' +
      '</div>';
  }

  function bindWorkbench() {
    $all('[data-wb]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var key = btn.getAttribute('data-wb');
        if (state.coachPhase === 'wb-migrate') {
          if (key === 'migrate') {
            endCoach(true);
            markWorkbenchImportHit();
            enterMigrate('workbench');
            return;
          }
          scheduleCoachEnd(3000);
        }
        if (key === 'migrate') {
          markWorkbenchImportHit();
          endCoach(true);
          enterMigrate('workbench');
          return;
        }
        if (key === 'history') { state.viewReturn = null; go('history-orders'); return; }
        if (key === 'flow') { state.viewReturn = null; go('order-list'); return; }
        if (key === 'price') { state.viewReturn = null; go('price-list'); return; }
        if (key === 'card') { state.viewReturn = null; go('card-list'); return; }
        if (key === 'customer') { state.viewReturn = null; go('members'); return; }
        showToast('演示占位');
      });
    });
    $all('[data-wb-tab]').forEach(function (tab) {
      tab.addEventListener('click', function () {
        var key = tab.getAttribute('data-wb-tab');
        if (state.coachPhase === 'wb-migrate' && key !== 'workbench') scheduleCoachEnd(3000);
        if (key === 'home') go('home');
        else if (key !== 'workbench') showToast('演示占位');
      });
    });
    var homeWb = $('#btnHomeWorkbench');
    if (homeWb) {
      homeWb.addEventListener('click', function () {
        if (state.coachPhase === 'home-more') {
          // 顶栏工作台入口也可作为「更多」等效入口
          advanceCoachToWorkbench();
          return;
        }
        go('workbench');
      });
    }
  }

  /* ---- 聚光灯引导 ---- */

  function endCoach(silent) {
    if (state.coachTimer) {
      clearTimeout(state.coachTimer);
      state.coachTimer = null;
    }
    state.coachPhase = null;
    var layer = $('#coachLayer');
    if (layer) layer.hidden = true;
    $all('.is-coach-target').forEach(function (el) { el.classList.remove('is-coach-target'); });
    if (!silent) { /* no-op */ }
  }

  function scheduleCoachEnd(ms) {
    if (state.coachTimer) clearTimeout(state.coachTimer);
    state.coachTimer = setTimeout(function () { endCoach(true); }, ms || 3000);
  }

  function placeCoachOn(el, tipTop) {
    var layer = $('#coachLayer');
    var hole = $('#coachHole');
    var tip = $('#coachTip');
    var phone = document.querySelector('.phone-inner');
    var t = $('#coachPaneT');
    var l = $('#coachPaneL');
    var r = $('#coachPaneR');
    var b = $('#coachPaneB');
    if (!layer || !hole || !el || !phone) return;
    layer.hidden = false;
    var pr = phone.getBoundingClientRect();
    var er = el.getBoundingClientRect();
    var pad = 8;
    var x = Math.max(0, er.left - pr.left - pad);
    var y = Math.max(0, er.top - pr.top - pad);
    var w = er.width + pad * 2;
    var h = er.height + pad * 2;
    var W = phone.clientWidth;
    var H = phone.clientHeight;
    hole.style.left = x + 'px';
    hole.style.top = y + 'px';
    hole.style.width = w + 'px';
    hole.style.height = h + 'px';
    if (t) { t.style.left = '0'; t.style.top = '0'; t.style.width = W + 'px'; t.style.height = y + 'px'; }
    if (l) { l.style.left = '0'; l.style.top = y + 'px'; l.style.width = x + 'px'; l.style.height = h + 'px'; }
    if (r) { r.style.left = (x + w) + 'px'; r.style.top = y + 'px'; r.style.width = Math.max(0, W - x - w) + 'px'; r.style.height = h + 'px'; }
    if (b) { b.style.left = '0'; b.style.top = (y + h) + 'px'; b.style.width = W + 'px'; b.style.height = Math.max(0, H - y - h) + 'px'; }
    if (tip) {
      var preferAbove = y > 110;
      var ty = typeof tipTop === 'number' ? tipTop : (preferAbove ? Math.max(12, y - 92) : (y + h + 14));
      tip.style.top = ty + 'px';
    }
  }

  function startCoachHomeMore() {
    endCoach(true);
    state.coachPhase = 'home-more';
    go('home');
    setTimeout(function () {
      var btn = $('#btnHomeMore');
      if (!btn) { endCoach(true); return; }
      btn.classList.add('is-coach-target');
      var title = $('#coachTipTitle');
      var text = $('#coachTipText');
      if (title) title.textContent = '数据导入在工作台';
      if (text) text.textContent = '请点「更多」进入工作台，再找「数据导入」。';
      placeCoachOn(btn, null);
    }, 80);
  }

  function hitEl(el, clientX, clientY) {
    if (!el) return false;
    var r = el.getBoundingClientRect();
    return clientX >= r.left && clientX <= r.right && clientY >= r.top && clientY <= r.bottom;
  }

  function bindCoachLayer() {
    var layer = $('#coachLayer');
    if (!layer) return;
    layer.addEventListener('click', function (e) {
      if (!state.coachPhase) return;
      e.preventDefault();
      e.stopPropagation();
      if (state.coachPhase === 'home-more') {
        if (hitEl($('#btnHomeMore'), e.clientX, e.clientY)) advanceCoachToWorkbench();
        else showToast('请先点「更多」进入工作台');
        return;
      }
      if (state.coachPhase === 'wb-migrate') {
        var tile = document.querySelector('[data-wb="migrate"]');
        if (hitEl(tile, e.clientX, e.clientY)) {
          endCoach(true);
          markWorkbenchImportHit();
          enterMigrate('workbench');
        } else {
          scheduleCoachEnd(3000);
          showToast('引导将在 3 秒后结束');
        }
      }
    });
  }

  function advanceCoachToWorkbench() {
    state.coachPhase = 'wb-migrate';
    $all('.is-coach-target').forEach(function (el) { el.classList.remove('is-coach-target'); });
    go('workbench');
    setTimeout(function () {
      var tile = document.querySelector('[data-wb="migrate"]');
      if (!tile) { endCoach(true); return; }
      tile.classList.add('is-coach-target');
      var title = $('#coachTipTitle');
      var text = $('#coachTipText');
      if (title) title.textContent = '点这里开始导入';
      if (text) text.textContent = '点「数据导入」结束引导；若点了别处，约 3 秒后引导也会结束。';
      placeCoachOn(tile, 120);
      try { tile.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch (e) {}
    }, 120);
  }

  function bindHomeActions() {
    $all('[data-home-act]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var act = btn.getAttribute('data-home-act');
        if (act === 'more') {
          if (state.coachPhase === 'home-more') advanceCoachToWorkbench();
          else go('workbench');
          return;
        }
        if (state.coachPhase === 'home-more') {
          showToast('请先点「更多」进入工作台');
          return;
        }
        if (act === 'member') { state.viewReturn = null; go('members'); return; }
        if (act === 'card') { state.viewReturn = null; go('card-list'); return; }
        showToast('演示占位');
      });
    });
  }

  /* ---- 原始存档 / 识别摘要 ---- */

  function domainItems(list, domain) {
    var allow = DOMAIN_MATCH[domain] || [domain];
    return (list || []).filter(function (it) { return allow.indexOf(it.domain) >= 0; });
  }

  /** 价目表·产品旧入口并入价目表域 */
  function normalizeArchiveDomain(domain) {
    if (domain === 'product') return 'price';
    return domain || 'member';
  }

  /** 价目表合并列表：行内区分项目 / 产品 */
  function domainKindTag(itemDomain) {
    if (itemDomain === 'price') return '项目';
    if (itemDomain === 'product') return '产品';
    return '';
  }

  function openArchiveList(domain, returnTo) {
    ensureTierDemo();
    var d = normalizeArchiveDomain(domain);
    if (d === 'order') ensureOrderArchiveDemo();
    state.emptyPreview = null;
    state.archiveDomain = d;
    state.archiveReturn = returnTo || DOMAIN_FLOWS[d] || 'members';
    closeAllTitleMenus();
    go('archive-list');
  }

  function openDigestList(domain, returnTo) {
    ensureTierDemo();
    var d = normalizeArchiveDomain(domain);
    state.emptyPreview = null;
    state.archiveDomain = d;
    state.archiveReturn = returnTo || DOMAIN_FLOWS[d] || 'members';
    closeAllTitleMenus();
    go('digest-list');
  }

  function renderArchiveList() {
    ensureTierDemo();
    var q = (($('#archiveSearch') && $('#archiveSearch').value) || '').trim().toLowerCase();
    var title = $('#archiveListTitle');
    var domainLab = DOMAIN_LABEL[state.archiveDomain] || '';
    if (title) {
      title.textContent = state.emptyPreview === 'archive'
        ? '原始存档'
        : ('原始存档 · ' + domainLab);
    }
    var rows = state.emptyPreview === 'archive'
      ? []
      : domainItems(state.tierResult.l1, state.archiveDomain).filter(function (f) {
          return !q || String(f.name).toLowerCase().indexOf(q) >= 0;
        });
    var host = $('#archiveList');
    var empty = $('#archiveEmpty');
    var screen = $('#screen-archive-list');
    if (host) {
      var showKind = state.archiveDomain === 'price';
      host.innerHTML = rows.map(function (f) {
        var kind = showKind ? domainKindTag(f.domain) : '';
        var meta = (kind ? kind + ' · ' : '') + (f.note || '') + (f.size ? ' · ' + f.size : '');
        return '<button type="button" class="arch-row" data-arch-id="' + f.id + '">' +
          '<span class="arch-row__ico" aria-hidden="true"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/></svg></span>' +
          '<span class="arch-row__body"><span class="arch-row__title">' + esc(f.name) +
          (kind ? '<em class="arch-row__kind">' + esc(kind) + '</em>' : '') +
          '</span>' +
          '<span class="arch-row__meta">' + esc(meta) + '</span></span>' +
          '<span class="arch-row__chev"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M9 6l6 6-6 6"/></svg></span></button>';
      }).join('');
    }
    if (empty) empty.classList.toggle('hidden', rows.length > 0);
    if (screen) screen.classList.toggle('is-list-empty', rows.length === 0);
  }

  function renderDigestList() {
    ensureTierDemo();
    var q = (($('#digestSearch') && $('#digestSearch').value) || '').trim().toLowerCase();
    var title = $('#digestListTitle');
    var domainLab = DOMAIN_LABEL[state.archiveDomain] || '';
    if (title) {
      title.textContent = state.emptyPreview === 'digest'
        ? '识别摘要'
        : ('识别摘要 · ' + domainLab);
    }
    var rows = state.emptyPreview === 'digest'
      ? []
      : domainItems(state.tierResult.l2, state.archiveDomain).filter(function (d) {
          if (!q) return true;
          var blob = (d.title + ' ' + d.looseText + ' ' + d.fields.map(function (f) { return f.v; }).join(' ')).toLowerCase();
          return blob.indexOf(q) >= 0;
        });
    var host = $('#digestList');
    var empty = $('#digestEmpty');
    var screen = $('#screen-digest-list');
    if (host) {
      var tip = rows.length
        ? '<p class="digest-list-tip">点进详情可把缺的字段补上，补完后就能导入系统。</p>'
        : '';
      var showKind = state.archiveDomain === 'price';
      host.innerHTML = tip + rows.map(function (d) {
        var miss = (d.fails || []).length;
        var kind = showKind ? domainKindTag(d.domain) : '';
        var metaBits = d.fields.map(function (f) { return f.k + ' ' + f.v; }).slice(0, 2);
        if (kind) metaBits.unshift(kind);
        if (miss) metaBits.push('缺 ' + miss + ' 项可补');
        return '<button type="button" class="arch-row" data-digest-id="' + d.id + '">' +
          '<span class="arch-row__ico" aria-hidden="true"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M8 6h11M8 12h11M8 18h7"/><path d="M4 6h.01M4 12h.01M4 18h.01"/></svg></span>' +
          '<span class="arch-row__body"><span class="arch-row__title">' + esc(d.title) +
          (kind ? '<em class="arch-row__kind">' + esc(kind) + '</em>' : '') +
          '</span>' +
          '<span class="arch-row__meta">' + esc(metaBits.join(' · ')) + '</span></span>' +
          '<span class="arch-row__chev"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M9 6l6 6-6 6"/></svg></span></button>';
      }).join('');
    }
    if (empty) empty.classList.toggle('hidden', rows.length > 0);
    if (screen) screen.classList.toggle('is-list-empty', rows.length === 0);
  }

  function promoteDigestToCheck(d) {
    /* 库存品类已并入价目表·产品：识别摘要里的 stock 域一律落回 product */
    var cat = d.domain === 'product' ? 'product'
      : (d.domain === 'price' ? 'price'
      : (d.domain === 'card' ? 'card'
      : (d.domain === 'stock' ? 'product' : 'member')));
    state.importSelection[cat] = true;
    if (!state.importSources[cat]) state.importSources[cat] = d.source && d.source.kind === 'photo' ? 'photo' : 'excel';
    ensureCheckData();
    if (!state.checkData[cat]) state.checkData[cat] = [];
    var f = {};
    function digestValKey(x) { return x.key || x.k; }
    (d.fields || []).forEach(function (x) {
      var kk = digestValKey(x);
      if (kk) f[kk] = x.v;
    });
    (d.fails || []).forEach(function (x) {
      var kk = digestValKey(x);
      if (!kk || kk === '入库') return;
      f[kk] = (x.edit || '').trim() || x.v;
    });
    // 优先内部英文字段键；中文键作兼容回退
    var row = {
      id: 'dig-' + d.id,
      f: {
        name: f.name || f['人物'] || f['姓名'] || f['会员姓名'] || f['卡名称'] || f['卡名'] || f['项目名'] || f['商品名'] || f['产品名称'] || d.title,
        phone: f.phone || f['手机号'] || '',
        cardName: f.cardName || f['正式卡种'] || f['卡名称'] || f['卡名'] || '',
        memberNo: f.memberNo || f['会员编号'] || '',
        cardType: f.cardType || f.type || f['卡类型'] || '储值卡',
        recharge: String(f.recharge || f.price || f['充值余额'] || f['金额'] || f['开卡价'] || f['售价'] || '').replace(/[^\d.]/g, '') || '0',
        remain: f.remain || '',
        type: f.type || f.cardType || f['卡类型'] || '储值卡',
        price: String(f.price || f.recharge || f['价格'] || f['产品售价'] || f['金额'] || f['售价'] || f['开卡价'] || '').replace(/[^\d.]/g, '') || '0',
        group: f.group || f['项目组'] || '未分组',
        bookable: (f.bookable || f['可开单'] || f['是否可开单'] || '是') === '否' ? '否' : '是',
        category: f.category || f['产品分类'] || f['商品分类'] || '默认分类',
        stockQty: f.stockQty || f.qty || f['可售数量'] || f['数量'] || f['库存数量'] || '',
        onShelf: cat === 'card' ? '下架' : (f.onShelf || f['是否上架'] || '上架'),
        shelfOn: cat === 'card' ? false : undefined
      },
      problems: [],
      ignored: false,
      aiFields: [],
      fromDigest: true
    };
    state.checkData[cat].unshift(row);
    if (cat === 'card') enrichPriceFromCards();
    recomputeCheck(cat);
    if (state.checkData.price) recomputeCheck('price');
    d.promoted = true;
    collectPlan();
    state.checkTab = cat;
    setImportStage('check', 'import-check');
    go('import-check');
    showToast('已补充，进入核对导入');
  }

  function renderDigestDetail() {
    ensureTierDemo();
    var d = (state.tierResult.l2 || []).filter(function (x) { return x.id === state.digestId; })[0];
    var host = $('#digestDetailBody');
    if (!host) return;
    if (!d) {
      host.innerHTML = '<p class="proto-note">未找到该摘要</p>';
      return;
    }
    (d.fails || []).forEach(function (f) { if (f.edit === undefined) f.edit = ''; });
    host.innerHTML =
      '<div class="digest-block"><div class="digest-block__hd">已识别字段</div>' +
        d.fields.map(function (f) {
          return '<div class="digest-kv"><b>' + esc(f.k) + '</b><span>' + esc(f.v) + '</span></div>';
        }).join('') +
      '</div>' +
      '<div class="digest-block"><div class="digest-block__hd">未能对应字段 · 可补充</div>' +
        '<p class="digest-edit-tip">把缺的信息补全后，就能导入系统。</p>' +
        (d.fails || []).map(function (f, i) {
          return '<label class="digest-edit">' +
            '<span class="digest-edit__lab">' + esc(f.k) + '</span>' +
            '<span class="digest-edit__hint">' + esc(f.v) + '</span>' +
            '<input class="digest-edit__inp" type="text" data-digest-fail="' + i + '" value="' + esc(f.edit || '') + '" placeholder="在此填写">' +
          '</label>';
        }).join('') +
      '</div>' +
      '<button type="button" class="digest-source" id="btnDigestSource">' +
        '<span class="digest-source__lab"><b>数据出处</b>' + esc(d.source.name) + '</span>' +
        '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M9 6l6 6-6 6"/></svg>' +
      '</button>' +
      '<div class="digest-foot">' +
        '<p class="digest-foot__tip">补充完整后点下方按钮，将进入「核对导入」。</p>' +
        '<button type="button" class="btn-primary" id="btnDigestPromote"' + (d.promoted ? ' disabled' : '') + '>' +
          (d.promoted ? '已加入本批导入' : '补充完成，导入') +
        '</button>' +
      '</div>';
    var srcBtn = $('#btnDigestSource');
    if (srcBtn) {
      srcBtn.onclick = function () {
        openSourcePreview(d.source, 'digest-detail');
      };
    }
    $all('[data-digest-fail]', host).forEach(function (inp) {
      inp.addEventListener('input', function () {
        var i = Number(inp.getAttribute('data-digest-fail'));
        if (d.fails[i]) d.fails[i].edit = inp.value;
      });
    });
    var promote = $('#btnDigestPromote');
    if (promote && !d.promoted) {
      promote.onclick = function () {
        var misses = (d.fails || []).filter(function (f) { return !String(f.edit || '').trim(); });
        if (misses.length) {
          showToast('还有 ' + misses.length + ' 项未补充：' + misses[0].k);
          return;
        }
        promoteDigestToCheck(d);
      };
    }
  }

  function openSourcePreview(source, ret) {
    state.sourcePayload = source || null;
    state.sourceReturn = ret || 'digest-detail';
    go('source-preview');
  }

  function renderSourcePreview() {
    var s = state.sourcePayload || { kind: 'excel', name: '未知文件', label: '出处' };
    var title = $('#sourcePreviewTitle');
    if (title) title.textContent = s.label || '数据出处';
    var host = $('#sourcePreviewBody');
    if (!host) return;
    if (s.kind === 'photo') {
      host.innerHTML = '<div class="src-preview"><div class="src-preview__ph">照片预览（演示）<br>' + esc(s.name) + '<br><br>真机将打开系统内存放的原图以便复核</div></div>';
    } else {
      host.innerHTML = '<div class="src-preview"><table class="src-preview__sheet"><thead><tr><th>列 A</th><th>列 B</th><th>列 C</th></tr></thead><tbody>' +
        '<tr><td>姓名</td><td>手机号</td><td>备注</td></tr>' +
        '<tr><td>王姐</td><td>138****6621</td><td>黄金卡</td></tr>' +
        '<tr><td>…</td><td>…</td><td>（演示片段）</td></tr>' +
        '</tbody></table><p class="proto-note" style="padding:12px 16px">文件：' + esc(s.name) + '</p></div>';
    }
  }

  function closeAllTitleMenus() {
    $all('[data-more-panel]').forEach(function (p) { p.hidden = true; });
  }

  function openDocsPick(kind) {
    state.docsPickKind = kind === 'archive' ? 'archive' : 'digest';
    var title = $('#docsPickTitle');
    var lead = $('#docsPickLead');
    if (title) title.textContent = '选择类别';
    if (lead) lead.textContent = state.docsPickKind === 'archive'
      ? '查看哪一类的原始存档？'
      : '查看哪一类的识别摘要？';
    var list = $('#docsPickList');
    if (list) {
      var items = [
        { k: 'member', lab: '会员资料' },
        { k: 'card', lab: '卡模板' },
        { k: 'price', lab: '价目表' }
      ];
      list.innerHTML = items.map(function (it) {
        return '<button type="button" class="docs-pick-row" data-docs-domain="' + it.k + '">' +
          '<span>' + it.lab + '</span>' +
          '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M9 6l6 6-6 6"/></svg>' +
          '</button>';
      }).join('');
    }
    go('docs-pick');
  }

  function finishDocsPick(domain) {
    var kind = state.docsPickKind || 'digest';
    var d = domain || 'member';
    if (kind === 'archive') openArchiveList(d, 'import-overview');
    else openDigestList(d, 'import-overview');
  }

  function openExportStoreSheet() {
    var any = hasP0Stock();
    if (!any) {
      showToast('本店还没有可导出的导入数据');
      return;
    }
    showToast('已开始导出店内数据（演示）');
  }

  function bindArchiveMenus() {
    document.addEventListener('click', function (e) {
      var more = e.target.closest('[data-more-menu]');
      if (more) {
        e.stopPropagation();
        var key = more.getAttribute('data-more-menu');
        var panel = document.querySelector('[data-more-panel="' + key + '"]');
        var open = panel && !panel.hidden;
        closeAllTitleMenus();
        if (panel && !open) panel.hidden = false;
        return;
      }
      var docsPick = e.target.closest('[data-docs-pick]');
      if (docsPick) {
        closeAllTitleMenus();
        openDocsPick(docsPick.getAttribute('data-docs-pick'));
        return;
      }
      var exportBtn = e.target.closest('[data-export-store]');
      if (exportBtn) {
        closeAllTitleMenus();
        openExportStoreSheet();
        return;
      }
      var docsDomain = e.target.closest('[data-docs-domain]');
      if (docsDomain) {
        finishDocsPick(docsDomain.getAttribute('data-docs-domain'));
        return;
      }
      var arch = e.target.closest('[data-arch-open]');
      if (arch) {
        var kind = arch.getAttribute('data-arch-open');
        var domain = arch.getAttribute('data-arch-domain') || 'member';
        if (kind === 'archive') openArchiveList(domain);
        else openDigestList(domain);
        return;
      }
      /* 订单流水菜单「历史订单」等 data-go：先收起下拉再交给全局 data-go */
      if (e.target.closest('[data-more-panel] [data-go]')) closeAllTitleMenus();
      else if (!e.target.closest('[data-more-panel]')) closeAllTitleMenus();

      var dig = e.target.closest('[data-digest-id]');
      if (dig) {
        state.digestId = dig.getAttribute('data-digest-id');
        go('digest-detail');
        return;
      }
      var af = e.target.closest('[data-arch-id]');
      if (af) {
        var id = af.getAttribute('data-arch-id');
        var file = (state.tierResult.l1 || []).filter(function (x) { return x.id === id; })[0];
        if (file) openSourcePreview({ kind: file.kind, name: file.name, label: file.kind === 'photo' ? '数据源照片' : '系统存放的 Excel' }, 'archive-list');
        return;
      }
      var rt = e.target.closest('[data-result-tier]');
      if (rt) {
        var tier = rt.getAttribute('data-result-tier');
        if (tier === 'l3') { openResultCatView('member'); return; }
        if (tier === 'l2') { openDigestList('member', 'import-result'); return; }
        if (tier === 'l1') { openArchiveList('member', 'import-result'); return; }
      }
      var ck = e.target.closest('[data-confirm-id]');
      if (ck) {
        toggleConfirmItem(ck.getAttribute('data-confirm-kind'), ck.getAttribute('data-confirm-id'));
      }
    });
    var dpb = $('#btnDocsPickBack');
    if (dpb) dpb.addEventListener('click', function () { go('import-overview'); });
    var ab = $('#btnArchiveBack');
    if (ab) ab.addEventListener('click', function () {
      state.emptyPreview = null;
      go(state.archiveReturn || 'members');
    });
    var db = $('#btnDigestBack');
    if (db) db.addEventListener('click', function () {
      state.emptyPreview = null;
      go(state.archiveReturn || 'members');
    });
    var sb = $('#btnSourceBack');
    if (sb) sb.addEventListener('click', function () { go(state.sourceReturn || 'digest-detail'); });
    var as = $('#archiveSearch');
    if (as) as.addEventListener('input', renderArchiveList);
    var ds = $('#digestSearch');
    if (ds) ds.addEventListener('input', renderDigestList);
    var cn = $('#btnConfirmNext');
    if (cn) cn.addEventListener('click', goConfirmNext);
  }

  function openEmptyPreview(kind) {
    state.emptyPreview = kind || null;
    if (kind === 'history-true') {
      clearHistoryFilterQuery();
      go('history-orders');
      return;
    }
    if (kind === 'history-filter') {
      /* 强制筛选无结果：保留演示数据存在感，但匹配恒为 0 */
      state.historyDeleted = false;
      state.historyQuery.name = '';
      state.historyQuery.from = '';
      state.historyQuery.to = '';
      state.historyQuery.min = '';
      state.historyQuery.max = '';
      if ($('#historySearch')) $('#historySearch').value = '';
      go('history-orders');
      return;
    }
    if (kind === 'archive') {
      state.archiveDomain = 'member';
      state.archiveReturn = 'workbench';
      if ($('#archiveSearch')) $('#archiveSearch').value = '';
      go('archive-list');
      return;
    }
    if (kind === 'digest') {
      state.archiveDomain = 'member';
      state.archiveReturn = 'workbench';
      if ($('#digestSearch')) $('#digestSearch').value = '';
      go('digest-list');
    }
  }

  function bindNav() {
    $all('.site-nav [data-flow]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        state.emptyPreview = null;
        state.viewReturn = null;
        var flow = btn.getAttribute('data-flow');
        // 从左侧导航直接进「认领门店」看完整态，不弹权限说明
        if (flow === 'claim') {
          state.claimEmpty = false;
        }
        // 开发导航进概况时补造数，便于直接评审再导入承接
        if (flow === 'import-overview' && !hasP0Stock()) {
          seedStoreStockDemo();
        }
        // 侧栏点「首页」：清 banner 静音，方便反复评审
        if (flow === 'home') clearBannerMute();
        go(flow);
        if (document.documentElement.classList.contains('view-mobile')) {
          document.documentElement.classList.remove('nav-drawer-open');
        }
      });
    });
    $all('.site-nav [data-empty]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        openEmptyPreview(btn.getAttribute('data-empty'));
        if (document.documentElement.classList.contains('view-mobile')) {
          document.documentElement.classList.remove('nav-drawer-open');
        }
      });
    });
  }

  function isPageReload() {
    try {
      var nav = performance.getEntriesByType && performance.getEntriesByType('navigation')[0];
      if (nav && nav.type) return nav.type === 'reload';
      if (performance.navigation) return performance.navigation.type === 1;
    } catch (err) { /* 老内核无 Navigation Timing，按「非刷新」处理 */ }
    return false;
  }

  function applyDeepLink() {
    var q = new URLSearchParams(location.search);
    var flow = q.get('flow');
    // 刷新（含 Ctrl+F5）一律回登录页：刷新后 state 已清空，
    // 停在链路中段只会是「有页面、没数据」的假状态。
    // ?capture= 抓取路由需要刷新直达，单独豁免。
    if (!q.get('capture') && isPageReload()) flow = null;
    if (flow === 'import-guide') flow = 'import-overview';
    if (flow && document.querySelector('.phone-inner > .screen[data-flow="' + flow + '"]')) {
      if (flow === 'import-overview' && !hasP0Stock()) seedStoreStockDemo();
      go(flow);
    } else {
      go(HOME_FLOW);
    }
  }

  // ===== 抓取路由（仅 ?capture= 生效，不影响默认演示行为） =====
  function seedCaptureImportDemo() {
    state.importSelection = { member: true, card: true, price: true, product: true };
    state.importSources = { member: 'excel', card: 'excel', price: 'excel', product: 'photo' };
    state.importFiles = {
      member: [{ name: '会员与持卡信息.xlsx', size: '1.2 MB' }],
      card: [{ name: '会员卡模板.xlsx', size: '0.4 MB' }],
      price: [{ name: '价目表.xlsx', size: '0.6 MB' }],
      product: []
    };
    state.importPhotos = {
      member: [], card: [], price: [],
      product: [{ id: 'cap-p1', src: '' }]
    };
    state.importPlan = { excel: ['member', 'card', 'price'], photo: ['product'] };
    state.analysisCats = ['member', 'card', 'price', 'product'];
    state.batchDeleted = false;
    collectPlan();
  }

  function seedStoreStockDemo() {
    state.storeStock = {
      member: BATCH_DEMO.member,
      card: BATCH_DEMO.card,
      price: BATCH_DEMO.price,
      product: BATCH_DEMO.product,
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
    // 首页数据导入 banner（待开始）
    if (cap === 'import-banner' || cap === 'migrate-fab') {
      clearBannerMute();
      state.importTask = { started: false, stage: 'idle', resumeFlow: null, entry: 'home' };
      go('home');
      renderImportBanner();
      return;
    }
    if (cap === 'import-overview') {
      seedStoreStockDemo();
      go('import-overview');
      return;
    }
    if (cap === 'import-overview-empty') {
      state.storeStock = { member: 0, card: 0, price: 0, product: 0 };
      go('import-overview');
      return;
    }
    // 有存量 · 重新导入温和确认半屏
    if (cap === 'import-clear') {
      seedStoreStockDemo();
      go('import-overview');
      step(openImportClearSheet, 500);
      return;
    }
    if (cap === 'import-select-empty') {
      state.pending.excel = [];
      state.pending.photo = [];
      go('import-select');
      return;
    }
    if (cap === 'reimport-mode') {
      // 该半屏的真实触发点是「识别结果」页点「下一步：核对」（见 commitAnalysis），
      // 因此底页必须是识别结果，否则浮层背景与触发时机不符。
      seedStoreStockDemo();
      seedCaptureImportDemo();
      collectPlan();
      state.reimportMode = blankReimportMode();
      go('import-cards');
      step(openReimportModeSheet, 400);
      return;
    }
    if (cap === 'history-reimport') {
      seedStoreStockDemo();
      go('history-orders');
      step(openHistoryReimportSheet, 400);
      return;
    }
    /* 历史消费 · AI 识别中（定格） */
    if (cap === 'history-import-analyze') {
      state.importMode = 'history';
      state.pending.excel = [
        { id: 'hist-e1', name: '老店收银流水.xlsx', size: '1.4 MB', readablePct: 72 }
      ];
      state.pending.photo = [];
      state.analyzing = true;
      setImportStage('analyzing', 'import-analyze');
      go('import-analyze');
      step(function () { paintAnalyzeStatic(true); }, 200);
      return;
    }
    /* 分域：原始存档 / 识别摘要（模块 ··· 落地，不导占位列表） */
    var archCap = /^archive-(member|card|price|product|order)$/.exec(cap);
    if (archCap) {
      seedCaptureImportDemo();
      collectPlan();
      state.checkData = null;
      state.tierResult = { l1: [], l2: [], l3Cats: [] };
      seedTierDemo();
      openArchiveList(archCap[1], DOMAIN_FLOWS[archCap[1]] || 'members');
      return;
    }
    var digCap = /^digest-(member|card|price|product)$/.exec(cap);
    if (digCap) {
      seedCaptureImportDemo();
      collectPlan();
      state.checkData = null;
      state.tierResult = { l1: [], l2: [], l3Cats: [] };
      seedTierDemo();
      openDigestList(digCap[1], DOMAIN_FLOWS[digCap[1]] || 'members');
      return;
    }
    if (cap === 'digest-detail-member') {
      seedCaptureImportDemo();
      collectPlan();
      state.checkData = null;
      state.tierResult = { l1: [], l2: [], l3Cats: [] };
      seedTierDemo();
      var digM = (state.tierResult.l2 || []).filter(function (d) { return d.domain === 'member'; })[0]
        || (state.tierResult.l2 || [])[0];
      state.digestId = digM ? digM.id : null;
      state.archiveDomain = digM ? digM.domain : 'member';
      state.archiveReturn = 'digest-list';
      go('digest-detail');
      return;
    }
    if (cap === 'fab-close') {
      // 浮球已下线：改为结果页 + 已完成 banner 态（兼容旧 capture id）
      seedCaptureImportDemo();
      clearBannerMute();
      setImportStage('done', 'import-result');
      go('import-result');
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
      go('import-cards');
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
    // 下游页需要有演示数据，否则卡片 / 核对 / 结果为空
    if (/^import-(cards|confirm|convert|result|fail)$/.test(cap) ||
        cap === 'import-source' || cap === 'import-camera' ||
        cap === 'import-select' || cap === 'import-analyze' ||
        cap === 'archive-list' || cap === 'digest-list' || cap === 'digest-detail') {
      seedCaptureImportDemo();
      if (cap === 'import-camera') {
        setCameraDemo(true);
      }
      if (cap === 'import-source' || cap === 'import-select') {
        state.pending.excel = [
          { id: 'cap-e1', name: '会员与持卡信息.xlsx', size: '1.2 MB', readablePct: 88 },
          { id: 'cap-e2', name: '会员资料补表.xlsx', size: '0.7 MB', readablePct: 22 }
        ];
        state.pending.photo = [];
      }
      if (cap === 'import-cards' || cap === 'import-confirm' ||
          cap === 'archive-list' || cap === 'digest-list' || cap === 'digest-detail') {
        collectPlan();
        state.checkData = null;
        state.tierResult = { l1: [], l2: [], l3Cats: [] };
        seedTierDemo();
      }
      if (cap === 'digest-detail') {
        var dig = (state.tierResult.l2 || [])[0];
        state.digestId = dig ? dig.id : null;
        state.archiveDomain = dig ? dig.domain : 'member';
      }
      if (cap === 'archive-list' || cap === 'digest-list') {
        state.archiveDomain = 'member';
      }
    }
    if (cap === 'wechat-tip') {
      seedCaptureImportDemo();
      go('import-source');
      step(function () {
        var mask = $('#wechatTipMask') || $('#wxGuideMask');
        var sheet = $('#wechatTipSheet') || $('#wxGuideSheet');
        if (typeof openWechatTip === 'function') openWechatTip();
        else if (mask && sheet) {
          mask.classList.add('show');
          sheet.classList.add('show');
        }
      }, 400);
      return;
    }
    // 四类全出的核对页（用于看密排 tab）；不改默认演示分支
    if (cap === 'import-check') {
      seedCaptureImportDemo();
      state.importSelection = { member: true, card: true, price: true, product: true };
      state.analysisCats = ALL_CATS.slice();
      state.checkData = null;
      go('import-check');
      return;
    }
    // 核对页 · 卡模板 tab（会员卡拟物 UI 抓取）
    if (cap === 'import-check-card') {
      seedCaptureImportDemo();
      state.importSelection = { member: true, card: true, price: true, product: true };
      state.analysisCats = ALL_CATS.slice();
      state.checkData = null;
      state.checkTab = 'card';
      go('import-check');
      return;
    }
    // 核对页 · 问题标记说明半屏
    if (cap === 'check-help') {
      seedCaptureImportDemo();
      state.importSelection = { member: true, card: true, price: true, product: true };
      state.analysisCats = ALL_CATS.slice();
      state.checkData = null;
      go('import-check');
      step(openCheckHelp, 500);
      return;
    }
    // 订单详情需要一条已选记录，否则是「记录不存在」空态
    if (cap === 'history-detail') {
      state.historySelectedId = HISTORY_ROWS[0].id;
      go('history-detail');
      return;
    }
    // 核对历史：独立核对屏（历史模式 · 按月样例）
    if (cap === 'history-import-preview' || cap === 'history-import-preview-open') {
      seedHistoryDemoBatch();
      if (cap === 'history-import-preview-open') state.histMonthOpen = historyMonthKey(HISTORY_ROWS[0].date);
      go('history-import-preview');
      return;
    }
    // 历史消费 · 导入完成 / 失败明细
    if (cap === 'history-import-result') {
      seedHistoryDemoBatch();
      state.storeStock.history = HISTORY_ROWS.length;
      state.historyDeleted = false;
      state.importTask = { started: true, stage: 'done', resumeFlow: 'history-import-result', entry: 'home' };
      go('history-import-result');
      return;
    }
    if (cap === 'history-import-fail') {
      seedHistoryDemoBatch();
      state.importTask = { started: true, stage: 'check', resumeFlow: 'history-import-fail', entry: 'home' };
      go('history-import-fail');
      return;
    }
    // 导入历史消费 · 选择方式（Excel 与拍照都可，可混传）
    if (cap === 'history-import-upload' || cap === 'history-import-upload-empty' ||
        cap === 'history-import-select') {
      goHistoryImportStart();
      return;
    }
    // 历史消费 · 已选文件、待识别
    if (cap === 'history-import-upload-picked' || cap === 'history-import-upload-map') {
      goHistoryImportStart();
      addHistoryDemoFile();
      go('import-source');
      return;
    }
    // 历史消费 · 拍照取景（消费记录水印）
    if (cap === 'history-import-camera') {
      goHistoryImportStart();
      state.pending.photo = [];
      state.camTableGuide = false;
      go('import-camera');
      step(function () {
        setCameraDemo(true);
        syncCamWatermark();
      }, 200);
      return;
    }
    // 会员历史消费（按姓名挂靠 · 顶部累计充值/消费/到店）
    if (cap === 'member-history') {
      if (typeof patchHistoryDemoNames === 'function') patchHistoryDemoNames();
      state.memberDetailId = 0;
      state.mhOpenYear = null;
      go('member-history');
      return;
    }
    // 历史消费 · 两层识别结果（抓取兼容；主路径已直达核对，不进 Figma 帧清单）
    if (cap === 'history-import-intro') {
      seedHistoryDemoBatch();
      go('import-cards');
      return;
    }
    /* ---- §三 状态补拍 ---- */
    if (cap === 'history-empty-true') {
      openEmptyPreview('history-true');
      return;
    }
    if (cap === 'history-empty-filter') {
      openEmptyPreview('history-filter');
      return;
    }
    if (cap === 'archive-empty') {
      openEmptyPreview('archive');
      return;
    }
    if (cap === 'digest-empty') {
      openEmptyPreview('digest');
      return;
    }
    if (cap === 'import-overview-empty') {
      state.storeStock = { member: 0, card: 0, price: 0, product: 0, history: 0 };
      state.historyImported = false;
      state.historyDeleted = false;
      go('import-overview');
      return;
    }
    if (cap === 'import-select-empty') {
      state.pending.excel = [];
      state.pending.photo = [];
      go('import-select');
      return;
    }
    if (cap === 'import-camera-normal' || cap === 'import-camera-table') {
      state.pending.photo = [];
      state.camTableGuide = cap === 'import-camera-table';
      go('import-camera');
      step(function () {
        setCameraDemo(true);
        syncCamWatermark();
      }, 200);
      return;
    }
    if (cap === 'import-cards-nol3') {
      seedCaptureImportDemo();
      collectPlan();
      state.checkData = null;
      seedTierDemo();
      state.tierResult.l3Cats = [];
      go('import-cards');
      return;
    }
    if (/^import-banner-(idle|analyzing|check|importing|done)$/.test(cap)) {
      var stage = cap.replace('import-banner-', '');
      clearBannerMute();
      state.importTask = {
        started: stage !== 'idle',
        stage: stage,
        resumeFlow: stage === 'idle' ? null
          : (stage === 'analyzing' ? 'import-analyze'
            : stage === 'check' ? 'import-check'
              : stage === 'importing' ? 'import-check'
                : 'import-result'),
        entry: 'home'
      };
      go('home');
      renderImportBanner();
      return;
    }
    if (cap === 'coach-home-more') {
      try { localStorage.removeItem(WB_IMPORT_HIT_KEY); } catch (e) {}
      muteImportBanner();
      startCoachHomeMore();
      return;
    }
    if (cap === 'coach-wb-migrate') {
      try { localStorage.removeItem(WB_IMPORT_HIT_KEY); } catch (e) {}
      muteImportBanner();
      endCoach(true);
      state.coachPhase = 'wb-migrate';
      go('workbench');
      step(function () {
        var tile = document.querySelector('[data-wb="migrate"]');
        if (!tile) return;
        tile.classList.add('is-coach-target');
        var title = $('#coachTipTitle');
        var text = $('#coachTipText');
        if (title) title.textContent = '点这里开始导入';
        if (text) text.textContent = '点「数据导入」结束引导；若点了别处，约 3 秒后引导也会结束。';
        placeCoachOn(tile, 120);
      }, 200);
      return;
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
    bindImportBanner();
    bindImport();
    bindHomeActions();
    bindArchiveMenus();
    bindCoachLayer();
    bindHistory();
    bindHistoryImport();
    bindMembers();
    bindWorkbench();
    applyDeepLink();
    applyCaptureRoute();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
