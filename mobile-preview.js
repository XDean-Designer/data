/**
 * 价目表 · 手机预览控制器（run-on-phone）
 *
 * 契约：
 *   - 逻辑画布固定 390 宽（= --phone-w），`transform: scale(vw / 390)` 铺满视口，绝不拉伸布局
 *   - 真机自动开启（UA 判定，不看视口宽度）；`?mobile=1|0` 强制；`?view=mobile|desktop` 为兼容别名
 *   - 键盘避让：visualViewport → `--kb-h`（**逻辑** px，已按 --mobile-scale 折算）→ 底部浮层抬起
 *   - 左缘滑动唤出左侧导航抽屉（跟手拖拽），抽屉 z-index 高于蒙层
 *
 * 本文件由 `_build-index.js` 注入；不要写回 `提成设置/index.html` 的内联脚本（那是另一个原型的壳）。
 */
(function () {
  var CONFIG = {
    logicalWidth: 390,
    logicalHeightFallback: 844,
    minLogicalHeight: 500,
    stageSelector: '.stage',
    navSelector: '.site-nav',
    navWidthCss: 'min(86vw, 300px)',
    edge: 22,
    kbJitterPx: 80
  };

  var root = document.documentElement;

  /* 本脚本在 <head> 执行，早于 body 解析 —— 所有 DOM 查询必须惰性，不能用顶层常量。 */
  function stageEl() {
    return document.querySelector(CONFIG.stageSelector);
  }
  function navEl() {
    return document.querySelector(CONFIG.navSelector);
  }
  function maskEl() {
    return document.getElementById('navDrawerMask');
  }
  function edgeEl() {
    return document.getElementById('navEdgeHit');
  }

  /* ---------- 模式判定 ---------- */

  function queryForce() {
    var qs;
    try {
      qs = new URLSearchParams(location.search);
    } catch (e) {
      return null;
    }
    var q = qs.get('mobile');
    if (q === '1' || q === 'true') return true;
    if (q === '0' || q === 'false') return false;
    /* 兼容旧约定（校验脚本 / 深链沿用） */
    var v = qs.get('view');
    if (v === 'mobile') return true;
    if (v === 'desktop') return false;
    return null;
  }

  /** 只认真机 UA / iPadOS 触屏 Mac；桌面窄窗、DevTools 设备模式一律不自动开启 */
  function isRealPhone() {
    var ua = navigator.userAgent || '';
    if (/Android|webOS|iPhone|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua)) {
      /* Android 平板 UA 不含 Mobile */
      if (/Android/i.test(ua) && !/Mobile/i.test(ua)) return false;
      return true;
    }
    if (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1) return true;
    return false;
  }

  function shouldMobile() {
    var force = queryForce();
    if (force !== null) return force;
    return isRealPhone();
  }

  /* ---------- 尺寸：台面锁可视区，画布按 390 逻辑宽缩放 ---------- */

  function mobileScale() {
    var s = parseFloat(root.style.getPropertyValue('--mobile-scale'));
    return isFinite(s) && s > 0 ? s : 1;
  }

  function syncAppSize() {
    if (!root.classList.contains('view-mobile')) {
      root.style.removeProperty('--app-h');
      root.style.removeProperty('--app-w');
      return;
    }
    /* 高用 window.innerHeight：真机上它已排除 iOS 底/顶工具栏，但**不**随键盘变化
       —— 键盘占位交给 --kb-h，避免「台面缩小」与「浮层抬起」重复扣一次。 */
    var h = window.innerHeight || 0;
    var w = window.innerWidth || 0;
    if (h > 0) root.style.setProperty('--app-h', h + 'px');
    if (w > 0) root.style.setProperty('--app-w', w + 'px');
  }

  function updateScale() {
    if (!root.classList.contains('view-mobile')) return;
    var stage = stageEl();
    var w = stage ? stage.clientWidth : window.innerWidth;
    var h = stage ? stage.clientHeight : window.innerHeight;
    var lw = CONFIG.logicalWidth;
    var lh0 = CONFIG.logicalHeightFallback;
    if (!w || !h) return;
    var scale = w / lw;
    var logicalH = scale > 0 ? h / scale : h;
    /* 极矮视口（横屏 / 键盘挤压）回退等比，避免内部固定布局被压坏 */
    if (!isFinite(logicalH) || logicalH < CONFIG.minLogicalHeight) {
      scale = Math.min(w / lw, h / lh0);
      logicalH = lh0;
    }
    if (!isFinite(scale) || scale <= 0) scale = 1;
    root.style.setProperty('--mobile-scale', String(Math.round(scale * 1000) / 1000));
    root.style.setProperty('--mobile-h', Math.round(logicalH) + 'px');
  }

  /* ---------- 键盘避让 ---------- */

  function updateKeyboardInset() {
    if (!root.classList.contains('view-mobile')) {
      root.style.setProperty('--kb-h', '0px');
      return;
    }
    var vv = window.visualViewport;
    if (!vv) {
      root.style.setProperty('--kb-h', '0px');
      return;
    }
    /* iOS Safari 键盘弹出时 innerHeight 不变，只有 visualViewport.height 变；
       Android 压缩布局视口时两者一起变小，差值自然趋近 0，不会重复抬升。 */
    var overlap = (window.innerHeight || 0) - vv.height;
    if (!isFinite(overlap) || overlap < 0) overlap = 0;
    if (overlap < CONFIG.kbJitterPx) overlap = 0; /* 地址栏抖动不算键盘 */
    var logical = overlap / mobileScale();
    root.style.setProperty('--kb-h', Math.round(logical) + 'px');
  }

  /* ---------- 开关 ---------- */

  function applyMode() {
    var on = shouldMobile();
    root.classList.toggle('view-mobile', on);
    root.classList.toggle('is-mobile', on); /* run-on-phone 契约类名 */
    root.classList.toggle('view-desktop', !on);
    if (!on) {
      closeNavDrawer();
      root.style.removeProperty('--mobile-scale');
      root.style.removeProperty('--mobile-h');
      root.style.removeProperty('--kb-h');
      root.style.removeProperty('--app-h');
      root.style.removeProperty('--app-w');
      return;
    }
    syncAppSize();
    updateScale();
    updateKeyboardInset();
  }

  /* ---------- 导航抽屉 ---------- */

  function isNavOpen() {
    return root.classList.contains('nav-drawer-open');
  }

  function openNavDrawer() {
    if (!root.classList.contains('view-mobile')) return;
    var nav = navEl();
    var mask = maskEl();
    root.classList.add('nav-drawer-open', 'is-nav-open');
    if (nav) {
      nav.classList.remove('is-dragging');
      nav.style.transform = '';
    }
    if (mask) mask.setAttribute('aria-hidden', 'false');
  }

  function closeNavDrawer() {
    var nav = navEl();
    var mask = maskEl();
    root.classList.remove('nav-drawer-open', 'is-nav-open');
    if (nav) {
      nav.classList.remove('is-dragging');
      nav.style.transform = '';
    }
    if (mask) mask.setAttribute('aria-hidden', 'true');
  }

  function bindNavDrawer() {
    var nav = navEl();
    var mask = maskEl();
    var edgeHit = edgeEl();
    if (!nav) return;

    var drag = null;

    function navWidth() {
      return nav.getBoundingClientRect().width || Math.min(window.innerWidth * 0.86, 300);
    }

    function setDragX(x) {
      var w = navWidth();
      var tx = Math.max(-w, Math.min(0, x));
      nav.classList.add('is-dragging');
      nav.style.transform = 'translate3d(' + tx + 'px,0,0)';
      if (mask && root.classList.contains('view-mobile')) {
        var p = 1 + tx / w;
        mask.style.opacity = String(Math.max(0, Math.min(1, p)));
        mask.style.pointerEvents = p > 0.05 ? 'auto' : 'none';
      }
      return tx;
    }

    function resetDragPaint() {
      nav.classList.remove('is-dragging');
      nav.style.transform = '';
      if (mask) {
        mask.style.opacity = '';
        mask.style.pointerEvents = '';
      }
    }

    function endDrag(tx) {
      var w = navWidth();
      resetDragPaint();
      if (tx > -w * 0.55) openNavDrawer();
      else closeNavDrawer();
    }

    function onStart(clientX, clientY, target) {
      if (!root.classList.contains('view-mobile')) return false;
      var open = isNavOpen();
      var fromEdge = clientX <= CONFIG.edge || (edgeHit && edgeHit.contains(target));
      var fromNav = open && nav.contains(target);
      var fromMask = open && mask && mask.contains(target);
      if (!fromEdge && !fromNav && !fromMask) return false;
      drag = { x0: clientX, y0: clientY, open: open, axis: null, w: navWidth() };
      return true;
    }

    function onMove(clientX, clientY) {
      if (!drag) return;
      var dx = clientX - drag.x0;
      var dy = clientY - drag.y0;
      if (!drag.axis) {
        if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
        drag.axis = Math.abs(dx) >= Math.abs(dy) ? 'x' : 'y';
        if (drag.axis === 'y') {
          drag = null;
          return;
        }
      }
      if (drag.axis !== 'x') return;
      var base = drag.open ? 0 : -drag.w;
      setDragX(base + dx);
    }

    function onEnd(clientX) {
      if (!drag) return;
      var dx = clientX - drag.x0;
      var base = drag.open ? 0 : -drag.w;
      var tx = Math.max(-drag.w, Math.min(0, base + dx));
      var wasAxis = drag.axis;
      drag = null;
      if (wasAxis !== 'x') {
        resetDragPaint();
        return;
      }
      endDrag(tx);
    }

    document.addEventListener('touchstart', function (e) {
      if (!e.touches || !e.touches[0]) return;
      onStart(e.touches[0].clientX, e.touches[0].clientY, e.target);
    }, { passive: true });

    document.addEventListener('touchmove', function (e) {
      if (!drag || drag.axis === 'y') return;
      if (!e.touches || !e.touches[0]) return;
      var t = e.touches[0];
      onMove(t.clientX, t.clientY);
      if (drag && drag.axis === 'x' && e.cancelable) e.preventDefault();
    }, { passive: false });

    document.addEventListener('touchend', function (e) {
      var t = e.changedTouches && e.changedTouches[0];
      onEnd(t ? t.clientX : 0);
    }, { passive: true });

    document.addEventListener('touchcancel', function () {
      if (!drag) return;
      drag = null;
      resetDragPaint();
    }, { passive: true });

    if (mask) mask.addEventListener('click', closeNavDrawer);

    nav.addEventListener('click', function (e) {
      if (!root.classList.contains('view-mobile')) return;
      var item = e.target.closest('.nav-item[data-flow], a.nav-link');
      if (item) closeNavDrawer();
    });
  }

  /* ---------- 启动与监听 ---------- */

  applyMode();

  window.addEventListener('resize', function () {
    if (!root.classList.contains('view-mobile')) return;
    syncAppSize();
    updateScale();
    updateKeyboardInset();
  }, { passive: true });

  window.addEventListener('orientationchange', function () {
    if (!root.classList.contains('view-mobile')) return;
    syncAppSize();
    updateScale();
    updateKeyboardInset();
  }, { passive: true });

  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', function () {
      if (!root.classList.contains('view-mobile')) return;
      syncAppSize();
      updateScale();
      updateKeyboardInset();
    }, { passive: true });
    window.visualViewport.addEventListener('scroll', updateKeyboardInset, { passive: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bindNavDrawer);
  } else {
    bindNavDrawer();
  }

  /* 对外 API：保留 __comm2* 旧名（其它脚本 / 校验可能引用），并补齐 run-on-phone 契约名 */
  window.openSiteNav = openNavDrawer;
  window.closeSiteNav = closeNavDrawer;
  window.__comm2ApplyViewShell = applyMode;
  window.__comm2SyncAppHeight = syncAppSize;
  window.__comm2OpenNavDrawer = openNavDrawer;
  window.__comm2CloseNavDrawer = closeNavDrawer;
})();
