/* 实测 AI 桥接层（本地测试用）
 *
 * 作用：让原型能选真实 Excel、调真实 DeepSeek，并把结果交回 app.js。
 * 为什么要有这一层而不是直接 fetch api.deepseek.com：
 *   1. 浏览器直连会被 CORS 拦（DeepSeek 不返回跨域响应头）；
 *   2. Key 写在前端 JS 里等于公开。
 * 因此所有模型调用都走本地桥 ai-server/server.py，Key 只存在服务端。
 *
 * 没有桥（例如直接双击 index.html 打开）时，health() 返回 false，
 * app.js 会退回原来的演示流程，页面不会坏。
 */
(function (global) {
  'use strict';

  var BASE = '';                    // 由 server.py 同源托管时用相对路径即可
  var probe = { done: false, ok: false, info: null };

  function health(cb) {
    if (probe.done) { cb(probe.ok, probe.info); return; }
    var done = false;
    function finish(ok, info) {
      if (done) return;
      done = true;
      probe.done = true; probe.ok = ok; probe.info = info || null;
      cb(ok, info || null);
    }
    // 超时兜底：file:// 下 fetch 会快速失败，但某些环境会挂住
    var timer = setTimeout(function () { finish(false, null); }, 4000);
    try {
      fetch(BASE + '/api/ai/health', { method: 'GET' })
        .then(function (r) { return r.json(); })
        .then(function (j) { clearTimeout(timer); finish(!!(j && j.ok), j); })
        .catch(function () { clearTimeout(timer); finish(false, null); });
    } catch (e) { clearTimeout(timer); finish(false, null); }
  }

  function pickFile(multiple, cb) {
    pickInput('.xlsx,.xls,.csv', multiple, cb);
  }

  /* 相册 / 系统相机。capture 会直接把系统相机拉起来（手机上比 getUserMedia 更可靠：
     后者在 http:// + 非 localhost 下根本不可用）。 */
  function pickImage(multiple, cb) {
    pickInput('image/*', multiple, cb, true);
  }

  function pickInput(accept, multiple, cb, capture) {
    var input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.multiple = !!multiple;
    if (capture) input.setAttribute('capture', 'environment');
    input.style.position = 'fixed';
    input.style.left = '-9999px';
    document.body.appendChild(input);
    var settled = false;
    input.addEventListener('change', function () {
      settled = true;
      var files = Array.prototype.slice.call(input.files || []);
      cleanup();
      cb(files);
    });
    function cleanup() {
      setTimeout(function () {
        if (input.parentNode) input.parentNode.removeChild(input);
      }, 0);
    }
    window.addEventListener('focus', function once() {
      window.removeEventListener('focus', once);
      setTimeout(function () {
        if (!settled) { settled = true; cleanup(); cb([]); }
      }, 600);
    });
    input.click();
  }

  function readBase64(file) {
    return new Promise(function (resolve, reject) {
      var fr = new FileReader();
      fr.onload = function () {
        var s = String(fr.result || '');
        var i = s.indexOf(',');
        resolve(i >= 0 ? s.slice(i + 1) : s);
      };
      fr.onerror = function () { reject(new Error('读取失败：' + file.name)); };
      fr.readAsDataURL(file);
    });
  }

  function sizeText(bytes) {
    if (bytes >= 1048576) return (bytes / 1048576).toFixed(1) + ' MB';
    return Math.max(1, Math.round(bytes / 1024)) + ' KB';
  }

  /* 把一批文件/照片交给后端：解析 → 规则层 → 模型 → 校验，一次返回。
   * photos 传 [{src}]（dataURL 或 dataURL 字符串）即可，由这里转成后端要的形状。
   * hooks: onSent() 请求发出；onDone(res)；onError(msg) */
  function convert(category, files, hooks, photos) {
    hooks = hooks || {};
    var list = Array.prototype.slice.call(files || []);
    var shots = Array.prototype.slice.call(photos || []);

    var fileJobs = list.map(function (f) {
      return readBase64(f).then(function (b64) {
        return { name: f.name, data: b64 };
      });
    });
    var photoJobs = shots.map(function (p, i) {
      if (!p || !p.src) return null;
      var s = String(p.src);
      var b64 = s.indexOf(',') >= 0 ? s.slice(s.indexOf(',') + 1) : s;
      return Promise.resolve({
        name: (p.file && p.file.name) || ('照片 ' + (i + 1) + '.jpg'),
        data: b64
      });
    }).filter(Boolean);

    Promise.all(fileJobs).then(function (filePayload) {
      return Promise.all(photoJobs).then(function (photoPayload) {
        if (hooks.onRead) hooks.onRead(filePayload.length, photoPayload.length);
        if (hooks.onSent) hooks.onSent();
        return fetch(BASE + '/api/ai/convert', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            category: category,
            files: filePayload,
            photos: photoPayload,
            online: true
          })
        });
      });
    }).then(function (r) {
      return r.json().then(function (j) {
        if (!r.ok || !j || !j.ok) {
          throw new Error((j && j.error) || ('HTTP ' + r.status));
        }
        return j;
      });
    }).then(function (res) {
      if (hooks.onDone) hooks.onDone(res);
    }).catch(function (e) {
      if (hooks.onError) hooks.onError(e && e.message ? e.message : String(e));
    });
  }

  global.RtaBridge = {
    health: health,
    pickFile: pickFile,
    pickImage: pickImage,
    convert: convert,
    sizeText: sizeText,
    info: function () { return probe.info; }
  };
})(window);
