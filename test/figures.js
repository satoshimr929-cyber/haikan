/* 図（SVG）の検査。Playwright が入っている環境でのみ動きます。
 *   node test/figures.js
 * npm test（計算のテスト）とは別で、必須依存にはしていません。
 *
 * 見ているのは次の4点です。
 *   1. ラベルが viewBox からはみ出していないか（文字が切れる）
 *   2. ラベルどうしが重なっていないか
 *   3. ページに横スクロールが出ていないか
 *   4. JS エラーが出ていないか
 */
'use strict';

var PW = process.env.PLAYWRIGHT_MODULE || 'playwright';
var chromium;
try {
  chromium = require(PW).chromium;
} catch (e) {
  console.error('Playwright が見つかりません。PLAYWRIGHT_MODULE で場所を指定できます。');
  process.exit(2);
}

var URL = 'file://' + require('path').resolve(__dirname, '..', 'index.html');
var WIDTHS = [320, 390, 480, 900];

/** SVG のユーザー座標で、ラベルのはみ出しと重なりを調べる */
function inspect(page, sel) {
  return page.evaluate(function (s) {
    var svg = document.querySelector(s + ' svg');
    if (!svg) return { missing: true };
    var vb = svg.viewBox.baseVal;
    var texts = Array.prototype.slice.call(svg.querySelectorAll('text'));
    var clip = [];
    texts.forEach(function (t) {
      var b = t.getBBox(), over = [];
      if (b.x < vb.x - 0.5) over.push('左');
      if (b.x + b.width > vb.x + vb.width + 0.5) over.push('右');
      if (b.y < vb.y - 0.5) over.push('上');
      if (b.y + b.height > vb.y + vb.height + 0.5) over.push('下');
      if (over.length) clip.push(t.textContent + '→' + over.join(','));
    });
    var rects = texts.map(function (t) { return t.getBoundingClientRect(); });
    var overlaps = 0;
    for (var i = 0; i < rects.length; i++) {
      for (var j = i + 1; j < rects.length; j++) {
        var a = rects[i], c = rects[j];
        if (a.left < c.right - 1 && c.left < a.right - 1 &&
            a.top < c.bottom - 1 && c.top < a.bottom - 1) overlaps++;
      }
    }
    return { clip: clip, overlaps: overlaps, labels: texts.length };
  }, sel);
}

/* 各モードで振る条件。fields は入力の id と値。 */
var CASES = [
  { tab: 'pitch', mode: 'two', fig: '#two-figure', sets: [{}] },
  { tab: 'pitch', mode: 'even', fig: '#even-figure', sets: [
    { 'even-mode': 'count', 'even-count': '2' },
    { 'even-count': '6' }, { 'even-count': '12' },
    { 'even-count': '24' }, { 'even-count': '40' }
  ] },
  { tab: 'pitch', mode: 'mixed', fig: '#mixed-figure', sets: [
    {}, { 'mixed-mode': 'width', 'mixed-width': '400' },
    { 'mixed-mode': 'each' }
  ] },
  { tab: 'pitch', mode: 'stagger', fig: '#stag-figure', sets: [
    { 'stag-angle': '90', 'stag-count': '4' },
    { 'stag-angle': '45' }, { 'stag-angle': '22.5', 'stag-count': '3' },
    { 'stag-angle': '170', 'stag-count': '2' }, { 'stag-angle': '5', 'stag-count': '3' },
    { 'stag-angle': '90', 'stag-count': '20' },
    { 'stag-pitch': '75', 'stag-pitch2': '150', 'stag-angle': '45', 'stag-count': '4' },
    { 'stag-pitch2': '30' }, { 'stag-pitch': '60', 'stag-pitch2': '200', 'stag-angle': '10' },
    { 'stag-pitch': '200', 'stag-pitch2': '20', 'stag-angle': '60', 'stag-count': '6' }
  ] },
  { tab: 'pitch', mode: 'support', fig: '#sup-figure', sets: [
    { 'sup-length': '5000' }, { 'sup-length': '1000' }, { 'sup-length': '30000' },
    { 'sup-length': '8000', 'sup-span': '1500' }, { 'sup-length': '600', 'sup-margin': '300' }
  ] },
  { tab: 'bend', mode: 'offset', fig: '#off-figure', sets: [
    { 'off-rise': '100', 'off-angle': '30' }, { 'off-angle': '45' },
    { 'off-angle': '22.5' }, { 'off-angle': '60' }, { 'off-angle': '5' },
    { 'off-rise': '1000', 'off-angle': '45' }, { 'off-rise': '10', 'off-angle': '85' }
  ] },
  { tab: 'bend', mode: 'takeup', fig: '#tk-figure', sets: [
    { 'tk-a': '500', 'tk-b': '400', 'tk-radius': '200', 'tk-angle': '90' },
    { 'tk-angle': '45' }, { 'tk-angle': '22.5' }, { 'tk-angle': '135' },
    { 'tk-radius': '50' }, { 'tk-radius': '400' },
    { 'tk-a': '2000', 'tk-b': '200', 'tk-radius': '150', 'tk-angle': '90' }
  ] },
  { tab: 'bend', mode: 'saddle', fig: '#sd-figure', sets: [
    { 'sd-kind': '3', 'sd-height': '50', 'sd-angle': '22.5' },
    { 'sd-angle': '30' }, { 'sd-angle': '45' }, { 'sd-height': '300', 'sd-angle': '45' },
    { 'sd-kind': '4', 'sd-height': '50', 'sd-width': '300', 'sd-angle': '22.5' },
    { 'sd-width': '1500' }, { 'sd-height': '400', 'sd-width': '200', 'sd-angle': '45' }
  ] }
];

(async function () {
  var browser = await chromium.launch();
  var checked = 0, failed = 0;

  function fail(msg) { failed++; console.log('  NG  ' + msg); }

  for (var w of WIDTHS) {
    var page = await browser.newPage({ viewport: { width: w, height: 900 } });
    var errors = [];
    page.on('pageerror', function (e) { errors.push(String(e.message)); });
    page.on('console', function (m) { if (m.type() === 'error') errors.push(m.text()); });
    await page.goto(URL);
    await page.waitForTimeout(200);

    for (var cs of CASES) {
      await page.click('[data-tab="' + cs.tab + '"]');
      await page.click('[data-mode="' + cs.mode + '"]');
      for (var set of cs.sets) {
        for (var id of Object.keys(set)) {
          var el = await page.$('#' + id);
          var tag = await el.evaluate(function (n) { return n.tagName; });
          if (tag === 'SELECT') await page.selectOption('#' + id, set[id]);
          else await page.fill('#' + id, set[id]);
        }
        await page.waitForTimeout(90);
        checked++;

        var label = w + 'px ' + cs.mode + ' ' + JSON.stringify(set);
        var r = await inspect(page, cs.fig);
        if (r.missing) fail(label + ' : 図が出ていない');
        else {
          if (r.clip.length) fail(label + ' : はみ出し ' + r.clip.join(' '));
          if (r.overlaps) fail(label + ' : ラベルの重なり ' + r.overlaps);
        }
      }
    }

    var scroll = await page.evaluate(function () {
      return document.documentElement.scrollWidth - document.documentElement.clientWidth;
    });
    if (scroll > 0) fail(w + 'px : 横スクロール ' + scroll + 'px');
    if (errors.length) fail(w + 'px : JSエラー ' + errors.join(' / '));
    await page.close();
  }

  await browser.close();
  console.log('\n' + checked + ' 通り検査 → ' + (failed ? failed + ' 件の問題' : '問題なし'));
  process.exit(failed ? 1 : 0);
})();
