/* UI 配線。計算は HaikanCalc、寸法データは HaikanData に置いてあります。 */
(function () {
  'use strict';

  var D = window.HaikanData;
  var C = window.HaikanCalc;

  var $ = function (sel, ctx) { return (ctx || document).querySelector(sel); };
  var $$ = function (sel, ctx) {
    return Array.prototype.slice.call((ctx || document).querySelectorAll(sel));
  };

  /* ---------------------------------------------------------------- 共通 */

  /** 小数1桁に丸めて、末尾の .0 は落とす */
  function fmt(n) {
    if (n === null || n === undefined || !isFinite(n)) return '—';
    var r = Math.round(n * 10) / 10;
    return String(r);
  }

  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  function big(label, value, unit) {
    return '<div class="big"><span class="label">' + esc(label) + '</span>' +
      '<span class="value">' + esc(value) + '</span>' +
      '<span class="unit-t">' + esc(unit || '') + '</span></div>';
  }

  function kv(pairs) {
    return '<div class="kv">' + pairs.map(function (p) {
      return '<div><div class="k">' + esc(p[0]) + '</div>' +
        '<div class="v">' + esc(p[1]) + '</div></div>';
    }).join('') + '</div>';
  }

  function msg(text, kind) {
    return '<div class="msg ' + (kind || '') + '">' + esc(text) + '</div>';
  }

  /* --------------------------------------------------- 管セレクトの生成 */

  var DIRECT = '__direct__';

  function fillPipeSelect(sel, defaultName) {
    var html = '<option value="' + DIRECT + '">直接入力（外径）</option>';
    D.PIPE_SERIES.forEach(function (s) {
      html += '<optgroup label="' + esc(s.short + '（' + s.name + '）') + '">';
      s.sizes.forEach(function (z) {
        html += '<option value="' + esc(z.key) + '">' +
          esc(z.name + (z.code ? '／' + z.code : '') + '  外径 ' + fmt(z.od) + 'mm') +
          '</option>';
      });
      html += '</optgroup>';
    });
    sel.innerHTML = html;
    // 呼びだけ渡されてもシリーズ込みのキーに解決してから選ぶ
    if (defaultName) {
      var size = D.findSize(defaultName);
      sel.value = size ? size.key : defaultName;
    }
  }

  /** セレクト＋直接入力欄から外径とラベルを取り出す */
  function readPipe(sel, odInput) {
    if (sel.value === DIRECT) {
      odInput.hidden = false;
      var v = parseFloat(odInput.value);
      if (!isFinite(v) || v <= 0) return null;
      return { od: v, label: '外径' + fmt(v) };
    }
    odInput.hidden = true;
    var size = D.findSize(sel.value);
    if (!size) return null;
    return { od: size.od, label: size.label, size: size };
  }

  /* ------------------------------------------------------------ 図の描画 */

  /**
   * 配管の断面を横一列に描く。
   * items: [{center, od, label}]（center は左端 0 基準の mm）
   * dims:  [{from, to, label}]（mm 座標での寸法線）
   */
  function layoutSVG(items, totalWidth, dims) {
    if (!items.length || !(totalWidth > 0)) return '';

    var W = 600, PAD = 24;
    var maxOd = Math.max.apply(null, items.map(function (i) { return i.od; }));

    // 本数が少ないと引き伸ばされて図が縦に間延びするので、管の直径に上限をかける
    var s = Math.min((W - PAD * 2) / totalWidth, 120 / maxOd);
    var offX = (W - totalWidth * s) / 2;

    var yLabel = 14;
    var railY = yLabel + 10 + maxOd * s;
    var dimY = railY + 26;
    var H = dimY + 22;

    var x = function (mm) { return offX + mm * s; };
    var out = [];

    out.push('<svg viewBox="0 0 ' + W + ' ' + Math.round(H) + '" role="img" aria-label="配管の配置図">');

    // 取り付け面（ラック / 壁）
    out.push('<line class="rail" x1="' + x(0) + '" y1="' + railY +
      '" x2="' + x(totalWidth) + '" y2="' + railY + '"/>');

    items.forEach(function (it) {
      var r = (it.od * s) / 2;
      var cx = x(it.center);
      var cy = railY - r;
      out.push('<circle class="pipe-fill" cx="' + cx.toFixed(1) + '" cy="' + cy.toFixed(1) +
        '" r="' + Math.max(r, 2).toFixed(1) + '"/>');
      // 芯の位置を示す一点鎖線
      out.push('<line class="cl" x1="' + cx.toFixed(1) + '" y1="' + (cy - r - 6).toFixed(1) +
        '" x2="' + cx.toFixed(1) + '" y2="' + (dimY + 6) + '"/>');
      out.push('<text class="strong" x="' + cx.toFixed(1) + '" y="' + yLabel +
        '" text-anchor="middle">' + esc(it.label) + '</text>');
    });

    (dims || []).forEach(function (d) {
      var x1 = x(d.from), x2 = x(d.to);
      out.push('<line class="dim" x1="' + x1.toFixed(1) + '" y1="' + dimY +
        '" x2="' + x2.toFixed(1) + '" y2="' + dimY + '"/>');
      [x1, x2].forEach(function (px) {
        out.push('<line class="dim" x1="' + px.toFixed(1) + '" y1="' + (dimY - 5) +
          '" x2="' + px.toFixed(1) + '" y2="' + (dimY + 5) + '"/>');
      });
      // 幅が狭いラベルは省略して重なりを避ける
      if (Math.abs(x2 - x1) > 30) {
        out.push('<text x="' + ((x1 + x2) / 2).toFixed(1) + '" y="' + (dimY + 17) +
          '" text-anchor="middle">' + esc(d.label) + '</text>');
      }
    });

    out.push('</svg>');
    return out.join('');
  }

  /* ------------------------------------------------- モード1：2本の芯々 */

  var two = {
    p1: $('#two-p1'), p1od: $('#two-p1-od'),
    p2: $('#two-p2'), p2od: $('#two-p2-od'),
    dir: $('#two-dir'),
    gap: $('#two-gap'), pitch: $('#two-pitch'),
    gapField: $('#two-gap-field'), pitchField: $('#two-pitch-field'),
    result: $('#two-result'), figure: $('#two-figure')
  };

  function renderTwo() {
    var byGap = two.dir.value === 'pitch';
    two.gapField.hidden = !byGap;
    two.pitchField.hidden = byGap;

    var a = readPipe(two.p1, two.p1od);
    var b = readPipe(two.p2, two.p2od);
    if (!a || !b) {
      two.result.innerHTML = msg('外径を入力してください', 'warn');
      two.figure.innerHTML = '';
      return;
    }

    var pitch, gap;
    try {
      if (byGap) {
        gap = parseFloat(two.gap.value);
        pitch = C.centerPitch(a.od, b.od, gap).pitch;
      } else {
        pitch = parseFloat(two.pitch.value);
        gap = C.clearanceFromPitch(a.od, b.od, pitch).clearance;
      }
    } catch (e) {
      two.result.innerHTML = msg(e.message, 'warn');
      two.figure.innerHTML = '';
      return;
    }

    var html = big(byGap ? '芯々距離' : '管と管のあき',
      fmt(byGap ? pitch : gap), 'mm');

    html += kv([
      [a.label + ' 外径', fmt(a.od) + ' mm'],
      [b.label + ' 外径', fmt(b.od) + ' mm'],
      ['芯々距離', fmt(pitch) + ' mm'],
      ['管と管のあき', fmt(gap) + ' mm'],
      ['外面〜外面', fmt(pitch + (a.od + b.od) / 2) + ' mm']
    ]);

    if (gap < 0) {
      html += msg('あきがマイナスです。この芯々距離では管が干渉します。', 'bad');
    } else if (gap < 5) {
      html += msg('あきが 5mm 未満です。カップリングやサドルの逃げが取れるか確認してください。', 'warn');
    }

    two.result.innerHTML = html;

    var c1 = a.od / 2;
    var c2 = c1 + pitch;
    var total = c2 + b.od / 2;
    two.figure.innerHTML = layoutSVG(
      [{ center: c1, od: a.od, label: a.label }, { center: c2, od: b.od, label: b.label }],
      total,
      [{ from: c1, to: c2, label: fmt(pitch) }]
    );
  }

  /* --------------------------------------------- モード2：均等割り付け */

  var even = {
    pipe: $('#even-pipe'), pipeOd: $('#even-pipe-od'),
    width: $('#even-width'), margin: $('#even-margin'),
    mode: $('#even-mode'),
    gap: $('#even-gap'), count: $('#even-count'), pitch: $('#even-pitch'),
    gapField: $('#even-gap-field'), countField: $('#even-count-field'),
    pitchField: $('#even-pitch-field'),
    result: $('#even-result'), figure: $('#even-figure'), marks: $('#even-marks')
  };

  function renderEven() {
    var mode = even.mode.value;
    even.gapField.hidden = mode !== 'max';
    even.countField.hidden = mode === 'max';
    even.pitchField.hidden = mode !== 'fixed';

    var p = readPipe(even.pipe, even.pipeOd);
    if (!p) {
      even.result.innerHTML = msg('外径を入力してください', 'warn');
      even.figure.innerHTML = ''; even.marks.innerHTML = '';
      return;
    }

    var width = parseFloat(even.width.value);
    var margin = parseFloat(even.margin.value);
    var html = '', layout, total, dims = [], items = [];

    try {
      if (mode === 'fixed') {
        var pitchIn = parseFloat(even.pitch.value);
        var cnt = parseInt(even.count.value, 10);
        var rw = C.requiredWidth(p.od, cnt, pitchIn, margin);
        layout = { positions: rw.positions, pitch: pitchIn, gap: rw.gap, count: cnt };
        total = rw.width;
        html += big('必要な幅', fmt(rw.width), 'mm');
        html += kv([
          ['本数', cnt + ' 本'],
          ['ピッチ', fmt(pitchIn) + ' mm'],
          ['管と管のあき', fmt(rw.gap) + ' mm'],
          ['端の管の外面〜外面', fmt(rw.span) + ' mm'],
          ['端あき（片側）', fmt(margin) + ' mm']
        ]);
        if (rw.gap < 0) html += msg('ピッチが外径より小さいため管が重なります。', 'bad');
        if (isFinite(width) && rw.width > width) {
          html += msg('有効幅 ' + fmt(width) + 'mm に対して ' +
            fmt(rw.width - width) + 'mm 足りません。', 'bad');
        }
      } else {
        var count;
        if (mode === 'max') {
          var minGap = parseFloat(even.gap.value);
          count = C.maxCount(width, p.od, margin, minGap);
          if (count < 1) {
            even.result.innerHTML = msg('この幅には 1 本も入りません。', 'bad');
            even.figure.innerHTML = ''; even.marks.innerHTML = '';
            return;
          }
          even.count.value = count;
          html += big('入る本数', String(count), '本');
        } else {
          count = parseInt(even.count.value, 10);
        }

        layout = C.layoutEven(width, p.od, count, margin);
        total = width;

        if (mode !== 'max') html += big('ピッチ', fmt(layout.pitch), 'mm');

        html += kv([
          ['本数', layout.count + ' 本'],
          ['ピッチ（芯々）', layout.pitch === null ? '—' : fmt(layout.pitch) + ' mm'],
          ['管と管のあき', layout.gap === null ? '—' : fmt(layout.gap) + ' mm'],
          ['端あき（片側）', fmt(margin) + ' mm'],
          ['有効幅', fmt(width) + ' mm']
        ]);

        if (!layout.fits) html += msg('この条件では収まりません。幅・本数・端あきを見直してください。', 'bad');
        else if (layout.gap !== null && layout.gap < 5) {
          html += msg('あきが 5mm 未満です。サドルや継手が入るか確認してください。', 'warn');
        }
      }
    } catch (e) {
      even.result.innerHTML = msg(e.message, 'warn');
      even.figure.innerHTML = ''; even.marks.innerHTML = '';
      return;
    }

    even.result.innerHTML = html;

    items = layout.positions.map(function (c, i) {
      return { center: c, od: p.od, label: String(i + 1) };
    });
    if (items.length > 1) {
      dims.push({ from: 0, to: items[0].center, label: fmt(items[0].center) });
      for (var i = 1; i < items.length; i++) {
        dims.push({
          from: items[i - 1].center,
          to: items[i].center,
          label: fmt(items[i].center - items[i - 1].center)
        });
      }
      dims.push({
        from: items[items.length - 1].center,
        to: total,
        label: fmt(total - items[items.length - 1].center)
      });
    }
    even.figure.innerHTML = layoutSVG(items, total, dims);

    // 墨出し表：左端からの累計と、直前の管からのピッチ
    var rows = items.map(function (it, i) {
      var step = i === 0 ? '—' : fmt(it.center - items[i - 1].center);
      return '<tr><td>' + (i + 1) + '</td><td>' + fmt(it.center) +
        '</td><td>' + step + '</td></tr>';
    }).join('');
    even.marks.innerHTML =
      '<table><thead><tr><th>本</th><th>左端からの芯（mm）</th><th>前の管から（mm）</th></tr></thead>' +
      '<tbody>' + rows + '</tbody></table>';
  }

  /* ----------------------------------------------- モード3：サイズ混在 */

  var mixed = {
    mode: $('#mixed-mode'),
    gap: $('#mixed-gap'), width: $('#mixed-width'), margin: $('#mixed-margin'),
    gapField: $('#mixed-gap-field'), widthField: $('#mixed-width-field'),
    list: $('#mixed-list'), add: $('#mixed-add'), clear: $('#mixed-clear'),
    result: $('#mixed-result'), figure: $('#mixed-figure'), marks: $('#mixed-marks')
  };

  function mixedAddRow(defaultName) {
    var row = document.createElement('div');
    row.className = 'pipe-row';
    row.innerHTML =
      '<div class="pitch-band" hidden>' +
        '<span class="pitch-label">前の管からの芯々ピッチ</span>' +
        '<div class="unit"><input type="number" class="pitch-input" step="1">' +
        '<span>mm</span></div>' +
      '</div>' +
      '<div class="pipe-main">' +
        '<span class="idx"></span>' +
        '<select class="pipe-select"></select>' +
        '<input type="number" class="od-input" step="0.1" min="0" placeholder="外径 mm" hidden>' +
        '<button type="button" class="del" aria-label="削除">×</button>' +
      '</div>';
    var sel = $('select', row);
    fillPipeSelect(sel, defaultName || 'E25');
    $('.del', row).addEventListener('click', function () {
      row.remove();
      renderMixed();
    });
    mixed.list.appendChild(row);
    renderMixed();
  }

  /**
   * 2本目以降の行から芯々ピッチを読む。
   * 未入力の欄は、あき指定モードで使っている値から求めたピッチで埋めておく
   * （切り替えた直後から意味のある数字が並ぶようにするため）。
   */
  function readPitches(pipes) {
    var gap = parseFloat(mixed.gap.value);
    if (!isFinite(gap)) gap = 0;
    return pipes.slice(1).map(function (p, i) {
      var el = $('.pitch-input', p.row);
      if (el.value === '') {
        el.value = fmt((pipes[i].od + p.od) / 2 + gap);
      }
      return parseFloat(el.value);
    });
  }

  function renderMixed() {
    var mode = mixed.mode.value;
    var byWidth = mode === 'width';
    var byEach = mode === 'each';
    mixed.gapField.hidden = mode !== 'gap';
    mixed.widthField.hidden = !byWidth;

    var rows = $$('.pipe-row', mixed.list);
    rows.forEach(function (r, i) {
      $('.idx', r).textContent = String(i + 1);
      // 2本目以降だけがピッチを持つ（1本目は端あきで位置が決まる）
      $('.pitch-band', r).hidden = !(byEach && i > 0);
    });

    var pipes = [];
    var incomplete = false;
    rows.forEach(function (r) {
      var p = readPipe($('select', r), $('.od-input', r));
      if (p) { p.row = r; pipes.push(p); } else incomplete = true;
    });

    if (!pipes.length) {
      mixed.result.innerHTML = msg(
        rows.length ? '外径を入力してください' : '「＋ 追加」で配管を並べてください', 'warn');
      mixed.figure.innerHTML = ''; mixed.marks.innerHTML = '';
      return;
    }

    var margin = parseFloat(mixed.margin.value);
    var gap, out, pitches = null;
    try {
      if (byEach) {
        pitches = readPitches(pipes);
        out = C.layoutMixedPitches(pipes, pitches, margin);
      } else if (byWidth) {
        out = C.layoutMixedInWidth(pipes, parseFloat(mixed.width.value), margin);
        gap = out.gap;
      } else {
        gap = parseFloat(mixed.gap.value);
        out = C.layoutMixed(pipes, gap, margin);
      }
    } catch (e) {
      mixed.result.innerHTML = msg(e.message, 'warn');
      mixed.figure.innerHTML = ''; mixed.marks.innerHTML = '';
      return;
    }

    // 表示用に、各ペアのあきをそろえておく（均一モードは同じ値の繰り返し）
    var gaps = out.gaps || out.pitches.map(function () { return gap; });

    var minGap = gaps.length ? Math.min.apply(null, gaps) : null;

    var html = byWidth
      ? big('管と管のあき', fmt(gap), 'mm')
      : big('必要な総幅', fmt(out.totalWidth), 'mm');
    html += kv([
      ['本数', pipes.length + ' 本'],
      ['総幅', fmt(out.totalWidth) + ' mm'],
      [byEach ? '最小のあき' : '管と管のあき',
        minGap === null ? '—' : fmt(byEach ? minGap : gap) + ' mm'],
      ['端の管の外面〜外面', fmt(out.span) + ' mm'],
      ['端あき（片側）', fmt(margin) + ' mm']
    ]);
    if (incomplete) html += msg('外径が未入力の行は計算から外しています。', 'warn');

    if (byEach) {
      var bad = [];
      gaps.forEach(function (g, i) { if (g < 0) bad.push((i + 1) + '→' + (i + 2)); });
      if (bad.length) {
        html += msg('管が干渉しています（' + bad.join('、') +
          '）。ピッチが外径の合計の半分を下回っています。', 'bad');
      } else if (minGap !== null && minGap < 5) {
        html += msg('いちばん狭いあきが 5mm 未満です。サドルや継手が入るか確認してください。', 'warn');
      }
    } else if (gap < 0) {
      html += msg(byWidth
        ? 'この総幅には収まりません。幅を広げるか、端あき・本数を見直してください。'
        : 'あきがマイナスです。管が干渉します。', 'bad');
    } else if (byWidth && gap < 5) {
      html += msg('あきが 5mm 未満です。サドルや継手が入るか確認してください。', 'warn');
    }
    mixed.result.innerHTML = html;

    var items = out.items.map(function (it) {
      return { center: it.center, od: it.od, label: it.label };
    });
    var dims = [];
    for (var i = 1; i < items.length; i++) {
      dims.push({
        from: items[i - 1].center,
        to: items[i].center,
        label: fmt(items[i].center - items[i - 1].center)
      });
    }
    mixed.figure.innerHTML = layoutSVG(items, out.totalWidth, dims);

    var body = out.items.map(function (it, i) {
      var g = i === 0 ? null : gaps[i - 1];
      return '<tr><td>' + esc(it.label) + '</td><td>' + fmt(it.od) +
        '</td><td>' + fmt(it.center) + '</td><td>' +
        (i === 0 ? '—' : fmt(out.pitches[i - 1])) + '</td><td' +
        (g !== null && g < 0 ? ' class="bad-cell"' : '') + '>' +
        (i === 0 ? '—' : fmt(g)) + '</td></tr>';
    }).join('');
    mixed.marks.innerHTML =
      '<table><thead><tr><th>管</th><th>外径</th><th>左端<br>からの芯</th>' +
      '<th>前の管<br>から</th><th>あき</th></tr></thead>' +
      '<tbody>' + body + '</tbody></table>';
  }

  /* --------------------------------------------- モード4：曲げのずらし */

  var stag = {
    pitch: $('#stag-pitch'), angle: $('#stag-angle'), count: $('#stag-count'),
    result: $('#stag-result'), marks: $('#stag-marks'), quick: $('#stag-quick')
  };

  function renderStagger() {
    var pitch = parseFloat(stag.pitch.value);
    var angle = parseFloat(stag.angle.value);
    var count = parseInt(stag.count.value, 10);
    var r;
    try {
      r = C.parallelStagger(pitch, angle);
    } catch (e) {
      stag.result.innerHTML = msg(e.message, 'warn');
      stag.marks.innerHTML = '';
      return;
    }
    if (!(count >= 2)) count = 2;

    var html = big('隣の管とのずらし量', fmt(r.stagger), 'mm');
    html += kv([
      ['芯々ピッチ', fmt(pitch) + ' mm'],
      ['曲げ角度', fmt(angle) + ' °'],
      ['本数', count + ' 本'],
      ['端から端の合計', fmt(r.stagger * (count - 1)) + ' mm']
    ]);
    html += msg('曲げの内側になる管ほど曲げ位置が手前になります。1本目を基準に、外側へ向かって順に足していってください。', '');
    stag.result.innerHTML = html;

    var rows = '';
    for (var i = 0; i < count; i++) {
      rows += '<tr><td>' + (i + 1) + '</td><td>' + fmt(r.stagger * i) + '</td></tr>';
    }
    stag.marks.innerHTML =
      '<table><thead><tr><th>本</th><th>1本目からのずらし（mm）</th></tr></thead>' +
      '<tbody>' + rows + '</tbody></table>';
  }

  /* ------------------------------------------------------------ 寸法表 */

  var tbl = {
    series: $('#tbl-series'), search: $('#tbl-search'),
    body: $('#tbl-body'), notes: $('#tbl-notes')
  };

  function renderTable() {
    var sid = tbl.series.value;
    var q = tbl.search.value.trim().toLowerCase();

    var shown = D.PIPE_SERIES.filter(function (s) { return !sid || s.id === sid; });
    var html = '<table><thead><tr>' +
      '<th>呼び</th><th>外径 mm</th><th>内径 mm</th><th>肉厚 mm</th>' +
      '</tr></thead><tbody>';
    var hits = 0;

    shown.forEach(function (s) {
      var sizes = s.sizes.filter(function (z) {
        if (!q) return true;
        return (z.name + ' ' + (z.code || '') + ' ' + s.name + ' ' + s.short + ' ' + s.std)
          .toLowerCase().indexOf(q) >= 0;
      });
      if (!sizes.length) return;
      hits += sizes.length;
      html += '<tr class="series-head"><td colspan="4">' +
        esc(s.short + '　' + s.name) +
        (s.approx ? ' <span class="approx-mark">（' +
          esc(s.approxNote || '外径は代表値') + '）</span>' : '') +
        '</td></tr>';
      sizes.forEach(function (z) {
        html += '<tr><td>' + esc(z.name) +
          (z.code ? '<span class="code">' + esc(z.code) + '</span>' : '') +
          '</td><td>' + fmt(z.od) +
          '</td><td>' + fmt(z.id) + '</td><td>' +
          (z.t === undefined ? '—' : fmt(z.t)) + '</td></tr>';
      });
    });

    html += '</tbody></table>';
    tbl.body.innerHTML = hits ? html : '';
    if (!hits) tbl.body.innerHTML = '<p class="hint">該当するサイズがありません。</p>';

    tbl.notes.innerHTML = shown.map(function (s) {
      return '<p><strong>' + esc(s.short) + '</strong>（' + esc(s.std) + '）：' +
        esc(s.note) + '</p>';
    }).join('');
  }

  /* -------------------------------------------------------------- 初期化 */

  function initTabs() {
    $$('.tab').forEach(function (t) {
      t.addEventListener('click', function () {
        $$('.tab').forEach(function (x) {
          x.classList.toggle('is-active', x === t);
          x.setAttribute('aria-selected', x === t ? 'true' : 'false');
        });
        $$('.panel').forEach(function (p) {
          p.classList.toggle('is-active', p.id === 'panel-' + t.dataset.tab);
        });
      });
    });

    $$('.mode').forEach(function (m) {
      m.addEventListener('click', function () {
        $$('.mode').forEach(function (x) { x.classList.toggle('is-active', x === m); });
        $$('.mode-panel').forEach(function (p) {
          p.classList.toggle('is-active', p.id === 'mode-' + m.dataset.mode);
        });
        renderAll();
      });
    });
  }

  function bind(els, handler) {
    els.forEach(function (el) {
      if (!el) return;
      el.addEventListener('input', handler);
      el.addEventListener('change', handler);
    });
  }

  function renderAll() {
    renderTwo();
    renderEven();
    renderMixed();
    renderStagger();
    renderTable();
  }

  function init() {
    fillPipeSelect(two.p1, 'E25');
    fillPipeSelect(two.p2, 'E25');
    fillPipeSelect(even.pipe, 'E25');

    D.PIPE_SERIES.forEach(function (s) {
      var o = document.createElement('option');
      o.value = s.id;
      o.textContent = s.short + '（' + s.name + '）';
      tbl.series.appendChild(o);
    });

    bind([two.p1, two.p1od, two.p2, two.p2od, two.dir, two.gap, two.pitch], renderTwo);
    bind([even.pipe, even.pipeOd, even.width, even.margin, even.mode,
      even.gap, even.count, even.pitch], renderEven);
    bind([mixed.mode, mixed.gap, mixed.width, mixed.margin], renderMixed);
    bind([stag.pitch, stag.angle, stag.count], renderStagger);
    bind([tbl.series, tbl.search], renderTable);

    // 混在モードは行が動的なので、リスト全体で拾う
    mixed.list.addEventListener('input', renderMixed);
    mixed.list.addEventListener('change', renderMixed);
    mixed.add.addEventListener('click', function () { mixedAddRow('E25'); });
    mixed.clear.addEventListener('click', function () {
      mixed.list.innerHTML = '';
      renderMixed();
    });

    $$('.chip', stag.quick).forEach(function (c) {
      c.addEventListener('click', function () {
        stag.angle.value = c.dataset.angle;
        renderStagger();
      });
    });

    initTabs();
    ['E25', 'E31', 'E51'].forEach(mixedAddRow);
    renderAll();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
