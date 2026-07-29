/* UI 配線。計算は HaikanCalc、寸法データは HaikanData に置いてあります。 */
(function () {
  'use strict';

  var D = window.HaikanData;
  var C = window.HaikanCalc;
  var F = window.HaikanFigures;

  var $ = function (sel, ctx) { return (ctx || document).querySelector(sel); };
  var $$ = function (sel, ctx) {
    return Array.prototype.slice.call((ctx || document).querySelectorAll(sel));
  };

  /* ---------------------------------------------------------------- 共通 */

  // 数値の整形と HTML エスケープは図の組み立てと共通なので figures.js のものを使う
  var fmt = F.fmt;
  var esc = F.esc;

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
    two.figure.innerHTML = F.layoutSVG(
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
    even.figure.innerHTML = F.layoutSVG(items, total, dims);

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
    toStagger: $('#mixed-to-stagger'),
    result: $('#mixed-result'), figure: $('#mixed-figure'), marks: $('#mixed-marks')
  };

  // 混在モードの最新の並び。「曲げのずらしへ送る」から読む
  var mixedLatest = null;

  function mixedAddRow(defaultName) {
    var row = document.createElement('div');
    row.className = 'pipe-row';
    row.innerHTML =
      '<div class="pitch-band" hidden>' +
        '<select class="pitch-kind" aria-label="前の管との寸法の指定方法">' +
          '<option value="pitch">芯々ピッチ</option>' +
          '<option value="gap">あき</option>' +
        '</select>' +
        '<div class="unit"><input type="number" class="pitch-input" step="1" ' +
        'aria-label="前の管との寸法"><span>mm</span></div>' +
        '<span class="pitch-calc"></span>' +
      '</div>' +
      '<div class="pipe-main">' +
        '<span class="idx"></span>' +
        '<select class="pipe-select"></select>' +
        '<input type="number" class="od-input" step="0.1" min="0" placeholder="外径 mm" hidden>' +
        '<button type="button" class="del" aria-label="削除">×</button>' +
      '</div>';
    var sel = $('.pipe-select', row);
    fillPipeSelect(sel, defaultName || 'E25');
    $('.del', row).addEventListener('click', function () {
      row.remove();
      renderMixed();
      saveState();
    });
    mixed.list.appendChild(row);
    renderMixed();
  }

  /**
   * 2本目以降の行から、前の管との寸法（芯々ピッチ または あき）を読む。
   * - 未入力の欄は、あき指定モードで使っている値から埋めておく
   *   （切り替えた直後から意味のある数字が並ぶようにするため）
   * - 種類を切り替えたときは、配置が変わらないように値を換算する
   */
  function readSpecs(pipes) {
    var base = parseFloat(mixed.gap.value);
    if (!isFinite(base)) base = 0;

    return pipes.slice(1).map(function (p, i) {
      var kindEl = $('.pitch-kind', p.row);
      var el = $('.pitch-input', p.row);
      var kind = kindEl.value;
      var half = (pipes[i].od + p.od) / 2;
      var fallback = kind === 'gap' ? base : half + base;

      // ピッチ ⇄ あき の切り替えで配置が飛ばないよう、半径ぶんを足し引きする
      if (el.value !== '' && kindEl.dataset.prevKind && kindEl.dataset.prevKind !== kind) {
        var v = parseFloat(el.value);
        if (isFinite(v)) el.value = fmt(kind === 'gap' ? v - half : v + half);
      }
      kindEl.dataset.prevKind = kind;

      // 既定値を入れるのは最初の1回だけ。入力途中で消したときに
      // 数字が勝手に復活しないよう、以降は空欄のままにする。
      el.placeholder = fmt(fallback);
      if (!el.dataset.init) {
        el.dataset.init = '1';
        if (el.value === '') el.value = fmt(fallback);
      }

      // 空欄はプレースホルダに出している既定値で計算する（結果が消えないように）
      return { kind: kind, value: el.value === '' ? fallback : parseFloat(el.value) };
    });
  }

  /** ピッチ欄の横に、指定していないほうの寸法を出す */
  function showDerived(pipes, out) {
    pipes.slice(1).forEach(function (p, i) {
      var kindEl = $('.pitch-kind', p.row);
      var el = $('.pitch-calc', p.row);
      var other = kindEl.value === 'gap'
        ? '芯々 ' + fmt(out.pitches[i])
        : 'あき ' + fmt(out.gaps[i]);
      el.textContent = '＝ ' + other + ' mm';
      el.classList.toggle('bad-text', out.gaps[i] < 0);
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
      var p = readPipe($('.pipe-select', r), $('.od-input', r));
      if (p) { p.row = r; pipes.push(p); } else incomplete = true;
    });

    if (!pipes.length) {
      mixed.result.innerHTML = msg(
        rows.length ? '外径を入力してください' : '「＋ 追加」で配管を並べてください', 'warn');
      mixed.figure.innerHTML = ''; mixed.marks.innerHTML = '';
      mixedLatest = null;
      mixed.toStagger.disabled = true;
      return;
    }

    var margin = parseFloat(mixed.margin.value);
    var gap, out;
    try {
      if (byEach) {
        out = C.layoutMixedSpecs(pipes, readSpecs(pipes), margin);
        showDerived(pipes, out);
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
      mixedLatest = null;
      mixed.toStagger.disabled = true;
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

    // 「曲げのずらしへ送る」で使うので、いまの並びを覚えておく
    mixedLatest = {
      labels: out.items.map(function (it) { return it.label; }),
      ods: out.items.map(function (it) { return it.od; }),
      // 図でノーマルベンドを描くための曲げ半径（芯）。既製品がある呼びだけ出せる
      radii: pipes.map(function (p) {
        var nb = p.size ? D.findNormalBend(p.size.key) : null;
        return nb ? nb.r : 0;
      }),
      // 面間寸法（交点から継手の端まで）。切断位置を出すのに使う
      faces: pipes.map(function (p) {
        var nb = p.size ? D.findNormalBend(p.size.key) : null;
        return nb ? nb.l : 0;
      }),
      // 呼び19のように製品差がある管の印
      varies: pipes.map(function (p) {
        var nb = p.size ? D.findNormalBend(p.size.key) : null;
        return !!(nb && nb.varies);
      }),
      // 継手への差し込み寸法。呼びごとに違うので管ごとに持っていく
      inserts: pipes.map(function (p) {
        return p.size ? D.findFittingInsert(p.size.key) : null;
      }),
      // 現場曲げ（ベンダー）の最小曲げ半径（芯）。外径だけの入力では出せない
      fieldRadii: pipes.map(function (p) {
        return p.size ? C.minBendRadius(p.size.id, p.size.od).center : 0;
      }),
      // 注記の出典を材質で書き分けるために持っていく
      materials: pipes.map(function (p) { return p.size ? p.size.material : ''; }),
      pitches: out.pitches.slice()
    };
    mixed.toStagger.disabled = out.pitches.length === 0;

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
    mixed.figure.innerHTML = F.layoutSVG(items, out.totalWidth, dims);

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
    pitch: $('#stag-pitch'), pitch2: $('#stag-pitch2'),
    angle: $('#stag-angle'), count: $('#stag-count'),
    pipe: $('#stag-pipe'), pipeOd: $('#stag-pipe-od'),
    source: $('#stag-source'), uniformRow: $('#stag-uniform-row'),
    imported: $('#stag-imported'), note: $('#stag-note'),
    result: $('#stag-result'), figure: $('#stag-figure'),
    marks: $('#stag-marks'), quick: $('#stag-quick'), bend: $('#stag-bend'),
    insert: $('#stag-insert'), insertField: $('#stag-insert-field'),
    insertKind: $('#stag-insert-kind'), insertManual: $('#stag-insert-manual')
  };

  // サイズ混在から持ち込んだ並び（{labels:[], pitches:[]}）。無ければ null
  var staggerImport = null;

  function renderStagger() {
    // サイズ混在から持ち込んだ並びが無ければ、取り込みは選べない
    var useMixed = stag.source.value === 'mixed' && staggerImport;
    if (stag.source.value === 'mixed' && !staggerImport) stag.source.value = 'uniform';
    stag.uniformRow.hidden = useMixed;
    stag.imported.hidden = !useMixed;

    var angle = parseFloat(stag.angle.value);
    var after = stag.pitch2.value === '' ? undefined : parseFloat(stag.pitch2.value);
    var pitches, labels;

    var ods = null;
    var normalR = null;   // ノーマルベンド（既製継手）の芯の曲げ半径。無い呼びは 0
    var normalL = null;   // 同じく面間寸法（交点から継手の端まで）。無い呼びは 0
    var normalV = null;   // 製品によって寸法が違う呼び（19）かどうか
    var fitIns = null;    // 継手への差し込み寸法（{socket, coupling}）。無ければ null
    var fieldR = null;    // 現場曲げ（ベンダー）の最小曲げ半径（芯）。内径不明なら 0
    var bend = null, bendLabel = '', bendMaterial = '';  // 一定ピッチのときの管の情報

    if (useMixed) {
      pitches = staggerImport.pitches;
      labels = staggerImport.labels;
      ods = staggerImport.ods || null;
      normalR = staggerImport.radii || null;
      normalL = staggerImport.faces || null;
      normalV = staggerImport.varies || null;
      fitIns = staggerImport.inserts || null;
      fieldR = staggerImport.fieldRadii || null;
      // 1本でも樹脂管が混ざっていれば、条文未確認である旨を添える
      if ((staggerImport.materials || []).indexOf('樹脂') >= 0) bendMaterial = '樹脂';
      stag.pitch2.placeholder = '手前と同じ（ばらばらのまま）';
      stag.imported.textContent = 'サイズ混在から ' + labels.length + ' 本を取り込みました（' +
        labels.join(' / ') + '）。ピッチは ' + pitches.map(fmt).join(' / ') + ' mm です。';
    } else {
      var pitch = parseFloat(stag.pitch.value);
      var count = parseInt(stag.count.value, 10);
      if (!(count >= 2)) count = 2;
      stag.pitch2.placeholder = isFinite(pitch)
        ? '手前と同じ（' + fmt(pitch) + '）' : '手前と同じ';
      pitches = [];
      for (var k = 0; k < count - 1; k++) pitches.push(pitch);
      labels = null;
      // 図で管の太さを描くために外径を拾う（同じ管が並ぶ前提）
      var sp = readPipe(stag.pipe, stag.pipeOd);
      if (sp) {
        var nb = sp.size ? D.findNormalBend(sp.size.key) : null;
        // 外径しか分からない（直接入力）ときは、現場曲げの最小半径は出せない
        var fr = sp.size ? C.minBendRadius(sp.size.id, sp.size.od).center : 0;
        bend = nb;
        bendLabel = sp.label;
        bendMaterial = sp.size ? sp.size.material : '';
        var fi = sp.size ? D.findFittingInsert(sp.size.key) : null;
        ods = []; normalR = []; normalL = []; normalV = []; fieldR = []; fitIns = [];
        for (var j = 0; j < count; j++) {
          ods.push(sp.od);
          normalR.push(nb ? nb.r : 0);
          normalL.push(nb ? nb.l : 0);
          normalV.push(!!(nb && nb.varies));
          fieldR.push(fr);
          fitIns.push(fi);
        }
      }
    }

    var r;
    try {
      r = C.parallelStaggerList(pitches, angle, after);
    } catch (e) {
      stag.result.innerHTML = msg(e.message, 'warn');
      stag.figure.innerHTML = ''; stag.marks.innerHTML = '';
      return;
    }

    var count2 = r.offsets.length;
    var shifts = r.pairs.map(function (p) { return p.stagger; });
    var uniform = shifts.every(function (v) { return Math.abs(v - shifts[0]) < 1e-6; });
    var sameP = r.pairs.every(function (p) { return p.pitchAfter === p.pitch; });

    var html = uniform
      ? big('隣の管とのずらし量', fmt(shifts[0]), 'mm')
      : big('端から端のずらし合計', fmt(r.total), 'mm');

    html += kv([
      ['手前のピッチ', uniform && !useMixed ? fmt(pitches[0]) + ' mm'
        : pitches.map(fmt).join(' / ') + ' mm'],
      ['曲げた先のピッチ', sameP ? '手前と同じ'
        : fmt(r.pairs[0].pitchAfter) + ' mm' + (r.pairs.length > 1 ? '（全ペア）' : '')],
      ['曲げ角度', fmt(angle) + ' °'],
      ['本数', count2 + ' 本'],
      ['端から端の合計', fmt(r.total) + ' mm']
    ]);

    var minShift = Math.min.apply(null, shifts);
    var maxShift = Math.max.apply(null, shifts);
    if (minShift > 0) {
      html += msg('曲げの内側になる管ほど曲げ位置が手前になります。' +
        '1本目を基準に、外側へ向かって順に足していってください。', '');
    } else if (maxShift < 0) {
      html += msg('ずらし量がマイナスです。曲げの外側になる管のほうが手前で曲がります。' +
        '1本目を基準に、外側へ向かって順に手前へ戻してください。', 'warn');
    } else if (minShift === 0 && maxShift === 0) {
      html += msg('ずらし量が 0 です。どの管も同じ位置で曲げます。', '');
    } else {
      html += msg('ペアによってずらす向きが違います。表の符号どおりに、' +
        'プラスは先へ、マイナスは手前へずらしてください。', 'warn');
    }
    if (!sameP) {
      html += msg('曲げ角度はどの管も ' + fmt(angle) + '° のままで、' +
        '曲げ位置のずらし方だけで曲げた先のピッチを ' +
        fmt(r.pairs[0].pitchAfter) + 'mm に揃えています。', '');
    }
    // 曲げ方（ノーマルベンド／現場曲げ／半径なし）で、図に描く曲げ半径を決める。
    // どの管も同じ半径で曲げるかぎり曲げ位置のずらし量は変わらないので、計算はそのまま。
    var way = stag.bend.value;
    var isRight = Math.abs(angle - 90) < 1e-9;   // ノーマルベンドは90°の継手だけ
    var radii = null, faces = null, note = '', noteKind = '';
    stag.insertField.hidden = way !== 'normal';

    if (way === 'normal') {
      if (!isRight) {
        note = 'ノーマルベンドは 90° の継手です。' + fmt(angle) +
          '° は現場での曲げになるので、「現場曲げ」に切り替えると最小曲げ半径で描けます。';
        noteKind = 'warn';
      } else if (normalR && normalR.some(function (v) { return v > 0; })) {
        radii = normalR;
        faces = normalL;
        var uniq = radii.filter(function (v, i, a) { return v > 0 && a.indexOf(v) === i; });
        note = 'ノーマルベンドの曲げ半径（芯）' + uniq.map(fmt).join(' / ') + 'mm で描いています。';
        // 呼び19だけは JIS 表1 に無く、製品によって寸法が違う
        note += (normalV || []).some(function (v, i) { return v && faces[i] > 0; })
          ? '呼び19は JIS C 8330 表1 の呼びに入っておらず、製品によって寸法が違います' +
            '（パナソニック DS0319 は半径90・面間135、外山 TCNA19（A形）は半径70・面間120）。' +
            'ここはパナソニックの値で描いているので、使う製品を確かめてください。'
          : 'JIS C 8330 の規定寸法なので、メーカーによる違いはありません。';
        if (bend && bend.approx) {
          note += ' ポリエチライニング用の専用品の寸法は未確認のため、厚鋼用の値を当てています。';
        }
        if (radii.some(function (v) { return v === 0; })) {
          note += ' 既製品が無い呼びは尖った角のまま描いています。';
        }
      } else if (!useMixed && bendLabel && !bend) {
        note = bendLabel + ' のノーマルベンドは製品を確認できていません' +
          '（JIS C 8330 表1 の呼びにも入っていません）。現場でのベンダー曲げになるので、' +
          '「現場曲げ」に切り替えてください。製品が見つかれば寸法を入れられます。';
        noteKind = 'warn';
      } else if (!ods) {
        note = '配管を選ぶと、ノーマルベンドの曲げ半径で描きます。';
      }
    } else if (way === 'field') {
      if (fieldR && fieldR.some(function (v) { return v > 0; })) {
        radii = fieldR;
        var uniqF = radii.filter(function (v, i, a) { return v > 0 && a.indexOf(v) === i; });
        note = '現場曲げの最小曲げ半径（芯）' + uniqF.map(fmt).join(' / ') +
          'mm で描いています。「曲げの内側の半径は管内径の6倍以上」から、' +
          '内径×6 ＋ 外径÷2 で出した下限値です';
        note += bendMaterial === '樹脂'
          ? '（金属管の内線規程 3110-8 と同じ扱いにしています。合成樹脂管の条文は未確認です）。'
          : '（内線規程 3110-8）。';
        note += ' 実際にはこれより大きく曲げることが多いので、' +
          '墨出しの位置は曲げ加工タブの「取り代」で確かめてください。';
      } else if (ods) {
        note = '外径だけの入力では内径が分からないので、最小曲げ半径を出せません。' +
          '一覧から配管を選ぶか、「半径を描かない」にしてください。';
        noteKind = 'warn';
      } else {
        note = '配管を選ぶと、現場曲げの最小曲げ半径で描きます。';
      }
    }

    // ノーマルベンドを使うなら、管は交点まで届かない。継手の端が来る位置で切る。
    // サイズが混ざると管ごとに面間寸法が変わるので、切断位置のずれは
    // 曲げ位置（交点）のずれとは一致しない。そこを表と図で見えるようにする。
    var cut = null, insKind = stag.insertKind.value, insMissing = false;
    if (faces && faces.some(function (v) { return v > 0; })) {
      // 差し込み寸法は呼びごとに違うので、管ごとに引く。
      // ねじ込み接続の管（薄鋼・厚鋼・ライニング）には表が無いので手入力になる。
      var manual = parseFloat(stag.insert.value);
      if (!(manual >= 0)) manual = 0;
      var inserts = faces.map(function (v, i) {
        if (v <= 0) return 0;
        if (insKind === 'none') return 0;
        if (insKind === 'manual') return manual;
        var fi = fitIns ? fitIns[i] : null;
        if (!fi) { insMissing = true; return 0; }
        return insKind === 'socket' ? fi.socket : fi.coupling;
      });
      try {
        cut = C.normalBendCuts(r.offsets, faces, inserts);
      } catch (e) { cut = null; }
    }
    stag.insertManual.hidden = insKind !== 'manual';

    if (cut) {
      var backs = cut.backs.filter(function (v, i, a) { return v > 0 && a.indexOf(v) === i; });
      var cutShift = cut.shifts.every(function (v) {
        return Math.abs(v - cut.shifts[0]) < 1e-6;
      });
      html += kv([
        ['交点から切断位置まで', backs.map(fmt).join(' / ') + ' mm'],
        [cutShift ? '切断位置のずらし量' : '端から端の切断位置の差',
          fmt(cutShift ? cut.shifts[0] : cut.total) + ' mm']
      ]);
    }

    // 管どうしが当たらないか。直線部はピッチで分かるが、曲げの途中は
    // 半径が違ったり曲げた先を詰めたりすると寄ってくるので、芯線を刻んで測る。
    var clash = null;
    if (ods && ods.every(function (v) { return v > 0; })) {
      try {
        clash = C.bendClearance({
          offsets: r.offsets, pitches: pitches, angle: angle, ods: ods, radii: radii
        });
      } catch (e) { clash = null; }
    }

    if (clash) {
      var name = function (p) {
        return labels
          ? (p.index + 1) + '本目と' + (p.index + 2) + '本目（' +
            labels[p.index] + '・' + labels[p.index + 1] + '）'
          : (p.index + 1) + '本目と' + (p.index + 2) + '本目';
      };
      var where = function (p) {
        if (p.atBend) return '曲げの途中';
        return p.pitchAfter < p.pitch ? '曲げた先の直線部' : '手前の直線部';
      };
      // 同じ内容が並ぶと読みにくいので、2組まで出して残りは数で言う
      var listPairs = function (list, body) {
        var head = list.slice(0, 2).map(body).join('、');
        return list.length > 2 ? head + '、ほか ' + (list.length - 2) + ' 組' : head;
      };
      var hit = clash.pairs.filter(function (p) { return !p.ok; });
      var tight = clash.pairs.filter(function (p) { return p.ok && p.clearance < 5; });
      var bendTight = clash.pairs.filter(function (p) {
        return p.ok && p.clearance >= 5 && p.atBend;
      });

      if (hit.length) {
        html += msg('管が重なります。' + listPairs(hit, function (p) {
          return name(p) + 'が' + where(p) + 'で ' + fmt(-p.clearance) +
            'mm 重なります（芯々 ' + fmt(p.minCenter) + 'mm・必要 ' + fmt(p.need) + 'mm）';
        }) + '。図の×印がその位置です。', 'bad');

        var byBend = hit.some(function (p) { return p.atBend; });
        var varyR = radii && radii.some(function (v, i) { return i && v !== radii[0]; });
        html += msg(byBend
          ? '直線部では足りていても、曲げの途中で寄ることがあります。' +
            (varyR ? 'この並びは管ごとに曲げ半径が違うので、' +
              '半径の小さい管が先に曲がりきって、隣の管の内側へ入り込みます。' : '') +
            '曲げた先のピッチを広げるか、手前のピッチを見直してください。'
          : hit.every(function (p) { return p.pitchAfter < p.pitch; })
            ? '曲げた先のピッチが外径に対して狭すぎます。芯々を広げてください。'
            : 'ピッチが外径に対して狭すぎます。芯々を広げてください。', '');
      } else if (tight.length) {
        html += msg('あきがほとんどありません。' + listPairs(tight, function (p) {
          return name(p) + 'は' + where(p) + 'であき ' + fmt(p.clearance) + 'mm';
        }) + '。サドルや継手が入るか確認してください。', 'warn');
      } else if (bendTight.length) {
        html += msg('直線部より曲げの途中のほうが狭くなります。' +
          listPairs(bendTight, function (p) {
            return name(p) + 'は芯々 ' + fmt(p.minCenter) + 'mm（あき ' +
              fmt(p.clearance) + 'mm）まで寄ります';
          }) + '。', '');
      }
    }

    stag.result.innerHTML = html;

    stag.figure.innerHTML = F.staggerSVG({
      pitches: pitches,
      offsets: r.offsets,
      angle: angle,
      ods: ods,
      radii: radii,
      faces: faces,
      cutBacks: cut ? cut.backs : null,
      clashes: clash ? clash.pairs.filter(function (p) { return !p.ok; }) : null,
      pitchesAfter: r.pairs.map(function (p) { return p.pitchAfter; })
    });

    if (cut) {
      var uniqB = cut.backs.filter(function (v, i, a) { return v > 0 && a.indexOf(v) === i; });
      note += ' 管は交点まで届かないので、交点から手前へ ' + uniqB.map(fmt).join(' / ') +
        'mm 戻った位置で切ります（図の赤い線）。';
      var uniqIns = cut.insert.filter(function (v, i, a) {
        return faces[i] > 0 && v > 0 && a.indexOf(v) === i;
      });
      if (uniqIns.length) {
        note += ' 継手の面間寸法から、差し込み深さ ' + uniqIns.map(fmt).join(' / ') +
          'mm を引いた値です' +
          (insKind === 'socket' ? '（B形ノーマルベンドの受口の深さ）。'
            : insKind === 'coupling' ? '（A形＋ねじなしカップリング。管1本あたり）。'
              : '。');
      } else if (insKind === 'none') {
        note += ' これは継手の面間寸法そのもので、差し込むぶんは見込んでいません。';
      }
      if (insMissing) {
        note += ' ねじ込み接続の管は差し込み寸法の表を持っていないので、' +
          'その管は面間寸法のまま出しています。実測して「手入力」に入れてください。';
        noteKind = noteKind || 'warn';
      }
      if (cut.backs.some(function (v, i) { return faces[i] > 0 && v <= 0; })) {
        note += ' 差し込み深さが面間寸法以上になっています。値を見直してください。';
        noteKind = 'warn';
      }
      if (!cut.ok) note += ' 継手が無い呼びの管は、切断位置を出していません。';
    }

    stag.note.className = 'msg' + (noteKind ? ' ' + noteKind : '');
    stag.note.textContent = note;
    stag.note.hidden = !note;

    var rows = r.offsets.map(function (x, i) {
      var has = cut && faces[i] > 0;
      return '<tr><td>' + (i + 1) + '</td>' +
        (labels ? '<td>' + esc(labels[i]) + '</td>' : '') +
        '<td>' + (i === 0 ? '—' : fmt(pitches[i - 1])) + '</td>' +
        '<td>' + (i === 0 ? '—' : fmt(shifts[i - 1])) + '</td>' +
        '<td>' + fmt(x) + '</td>' +
        (cut ? '<td>' + (has ? fmt(cut.backs[i]) : '—') + '</td>' +
          '<td>' + (i === 0 ? '—' : (has && faces[i - 1] > 0 ? fmt(cut.shifts[i - 1]) : '—')) +
          '</td><td class="strong">' + (has ? fmt(cut.cuts[i]) : '—') + '</td>' : '') +
        '</tr>';
    }).join('');
    stag.marks.innerHTML =
      '<table><thead><tr><th>本</th>' + (labels ? '<th>管</th>' : '') +
      '<th>前との<br>ピッチ</th><th>前から<br>ずらす</th>' +
      '<th>交点<br>1本目から</th>' +
      (cut ? '<th>交点から<br>戻す</th><th>切断位置<br>前からずらす</th>' +
        '<th>切断位置<br>1本目から</th>' : '') +
      '</tr></thead><tbody>' + rows + '</tbody></table>';
  }

  /* ------------------------------------------- モード5：サドル・支持点 */

  var sup = {
    pipe: $('#sup-pipe'), pipeOd: $('#sup-pipe-od'),
    length: $('#sup-length'), span: $('#sup-span'), margin: $('#sup-margin'),
    stock: $('#sup-stock'), first: $('#sup-first'), extra: $('#sup-extra'),
    jointMode: $('#sup-joint-mode'), firstField: $('#sup-first-field'), cuts: $('#sup-cuts'),
    coupling: $('#sup-coupling'), saddle: $('#sup-saddle'),
    atJoint: $('#sup-atjoint'), jointOffset: $('#sup-joint-offset'),
    result: $('#sup-result'), figure: $('#sup-figure'), marks: $('#sup-marks')
  };
  // 管を選び直したときだけ上限間隔と定尺を入れ替える（手で直した値を毎回上書きしないため）
  var supLastSeries = null;
  // カップリング長さは呼びごとに違うので、シリーズではなくサイズで見張る
  var supLastSize = null;
  var SUP_COUPLING_DEFAULT = 60;   // 寸法表を持っていない管に使う目安

  var SUP_KIND = { even: '等間隔', joint: '接続点の両側', fill: '間を埋める' };

  /** 「1200, 3400」のような入力を数値の配列にする */
  function parseList(text) {
    return String(text || '').split(/[,、\s]+/)
      .filter(function (s) { return s !== ''; })
      .map(function (s) { return parseFloat(s); })
      .filter(function (v) { return isFinite(v); });
  }

  function renderSupport() {
    var p = readPipe(sup.pipe, sup.pipeOd);
    var series = p && p.size ? D.findSeries(p.size.series) : null;

    if (series && series.id !== supLastSeries) {
      sup.span.value = series.maxSupportSpan;
      sup.stock.value = series.stockLength === null ? '' : series.stockLength;
      supLastSeries = series.id;
    } else if (!series) {
      supLastSeries = null;
    }

    // 呼びを変えたら、その呼びのカップリング全長を入れ替える。
    // 表が無い管（ねじ込み接続）まで前の呼びの値を引きずると紛らわしいので、
    // その場合は目安の既定値に戻す。
    var sizeKey = p && p.size ? p.size.key : null;
    if (sizeKey !== supLastSize) {
      var fit = sizeKey ? D.findFittingInsert(sizeKey) : null;
      sup.coupling.value = fit ? fit.couplingLength : SUP_COUPLING_DEFAULT;
      supLastSize = sizeKey;
    }

    var length = parseFloat(sup.length.value);
    var maxSpan = parseFloat(sup.span.value);
    var margin = parseFloat(sup.margin.value);
    var stock = sup.stock.value === '' ? null : parseFloat(sup.stock.value);
    var first = sup.first.value === '' ? null : parseFloat(sup.first.value);
    var jointMode = sup.jointMode.value;
    // 均等に割るときは、最初の継ぎまでの距離を指定する余地がない
    sup.firstField.hidden = jointMode === 'even';
    sup.first.placeholder = stock ? '定尺と同じ（' + fmt(stock) + '）' : '定尺と同じ';

    // 接続点の両側に支持を置くか。既定は材質にしたがう
    var mode = sup.atJoint.value;
    var atJoint = mode === 'on' || (mode === 'auto' && !!(series && series.jointSupport));

    var joints, r;
    try {
      joints = C.jointPositions(length, stock, first, parseList(sup.extra.value), jointMode);
      r = C.supportPlan({
        length: length, maxSpan: maxSpan, endMargin: margin,
        joints: joints,
        couplingLength: parseFloat(sup.coupling.value),
        saddleWidth: parseFloat(sup.saddle.value),
        supportAtJoints: atJoint,
        jointOffset: parseFloat(sup.jointOffset.value)
      });
    } catch (e) {
      sup.result.innerHTML = msg(e.message, 'warn');
      sup.figure.innerHTML = ''; sup.marks.innerHTML = '';
      return;
    }

    var maxUsed = r.spans.length ? Math.max.apply(null, r.spans) : 0;

    var html = big('サドルの数', String(r.count), '個');
    html += kv([
      ['いちばん広い間隔', fmt(maxUsed) + ' mm'],
      ['間隔の上限', fmt(maxSpan) + ' mm'],
      ['接続点', joints.length ? joints.length + ' 箇所' : 'なし'],
      ['接続点までの最短', r.minJointDistance === null ? '—'
        : fmt(r.minJointDistance) + ' mm'],
      ['当たる距離', joints.length ? fmt(r.clear) + ' mm 未満' : '—'],
      ['端からの距離', fmt(margin) + ' mm'],
      ['配管の全長', fmt(length) + ' mm']
    ]);

    if (maxUsed > maxSpan + 1e-9) {
      html += msg('この条件では上限間隔に収まりません。端からの距離を見直してください。', 'bad');
    }

    if (r.clashes.length) {
      var lines = r.clashes.map(function (cl) {
        var at = fmt(r.positions[cl.index].x) + 'mm';
        if (cl.suggest === null) {
          return (cl.index + 1) + '番（' + at + '）は逃がす場所がありません';
        }
        var d = cl.suggest - r.positions[cl.index].x;
        return (cl.index + 1) + '番（' + at + '）を ' + fmt(Math.abs(d)) + 'mm ' +
          (d > 0 ? '先へ' : '手前へ') + '（' + fmt(cl.suggest) + 'mm）';
      });
      html += msg('サドルが接続点に当たっています。' + lines.join('、') + '。', 'bad');
      if (r.clashes.some(function (cl) { return cl.suggest === null; })) {
        html += msg('逃がすと上限間隔を超えてしまう箇所があります。' +
          'サドルを1つ増やすか、接続点の位置そのものを見直してください。', 'warn');
      }
    } else if (joints.length) {
      html += msg('どのサドルも接続点に当たっていません。', 'ok');
    }

    if (r.supportAtJoints) {
      html += msg('接続点の両側 ' + fmt(r.jointOffset) + 'mm の位置に支持点を置いたうえで、' +
        '間を上限間隔以下で埋めています。' +
        (r.jointOffset > parseFloat(sup.jointOffset.value)
          ? '（指定の距離ではカップリングに当たるため ' + fmt(r.jointOffset) + 'mm まで広げました）'
          : ''), '');
    }

    if (series) {
      html += msg(series.short + 'は' + series.material + '製です。' +
        '支持点間隔の目安は ' + fmt(series.maxSupportSpan) + 'mm 以下、' +
        (series.jointSupport
          ? '管相互の接続点も支持の対象です（PF管・CD管は接続点の両側）。'
          : '管相互の接続点は支持の対象として明記されていません（ボックス等との接続点と管端が対象）。') +
        '（出典：公共建築工事標準仕様書 電気設備工事編。金属管2m以下・合成樹脂管1.5m以下・' +
        '金属製可とう電線管1m以下、ボックスや管端からは0.3m以内。' +
        '内線規程にも同様の規定がありますが原文は未確認です。' +
        '現場や施工要領の基準があればそちらを優先してください）', '');
    }
    sup.result.innerHTML = html;

    sup.figure.innerHTML = F.supportSVG({
      length: length, margin: margin, positions: r.positions,
      joints: joints, couplingLength: parseFloat(sup.coupling.value),
      jointChecks: r.jointChecks
    });

    var rows = r.positions.map(function (pos, i) {
      // 接続点までの距離。当たっていれば逃がし先も添える
      var near = '—';
      if (pos.distance !== null) {
        near = fmt(pos.distance);
        if (pos.clash !== null) {
          near = '<span class="bad-text">' + near + '</span>' +
            '<span class="code">' +
            (pos.suggest === null ? '当たり' : '→' + fmt(pos.suggest)) + '</span>';
        }
      }
      return '<tr' + (pos.clash === null ? '' : ' class="row-bad"') + '>' +
        '<td>' + (i + 1) + '</td>' +
        '<td>' + fmt(pos.x) + '</td>' +
        '<td>' + (i === 0 ? '—' : fmt(pos.x - r.positions[i - 1].x)) + '</td>' +
        '<td>' + esc(SUP_KIND[pos.kind] || pos.kind) + '</td>' +
        '<td>' + near + '</td>' +
        '</tr>';
    }).join('');
    sup.marks.innerHTML =
      '<table><thead><tr><th>番</th><th>端から</th><th>前から</th>' +
      '<th>種別</th><th>接続点<br>まで</th></tr></thead><tbody>' + rows + '</tbody></table>';

    renderCuts(length, joints, stock);
  }

  /** 管を何本使って、どこで切って、端材がどれだけ出るか */
  function renderCuts(length, joints, stock) {
    var pieces = C.pieceLengths(length, joints);

    if (!stock) {
      // 定尺が分からなければ、切り出す長さだけ出す
      sup.cuts.innerHTML = '<h3 class="sub-head">管の拾い</h3>' +
        msg('定尺を入れると、必要な本数と端材まで出します。', '') +
        '<div class="table-wrap"><table><thead><tr><th>本</th><th>切る長さ（mm）</th>' +
        '</tr></thead><tbody>' + pieces.map(function (v, i) {
          return '<tr><td>' + (i + 1) + '</td><td>' + fmt(v) + '</td></tr>';
        }).join('') + '</tbody></table></div>';
      return;
    }

    var cl;
    try {
      cl = C.cutList(pieces, stock);
    } catch (e) {
      sup.cuts.innerHTML = '<h3 class="sub-head">管の拾い</h3>' + msg(e.message, 'warn');
      return;
    }

    var html = '<h3 class="sub-head">管の拾い</h3>';
    html += big('必要な定尺', String(cl.stockCount), '本');
    html += kv([
      ['定尺の長さ', fmt(stock) + ' mm'],
      ['切る本数', pieces.length + ' 本'],
      ['端材の合計', fmt(cl.totalWaste) + ' mm'],
      ['いちばん長い端材', fmt(cl.longestOffcut) + ' mm']
    ]);

    // 切る長さの並び（端から順）。ひと目で拾えるように文章でも出す
    html += msg('端から ' + pieces.map(fmt).join(' + ') + ' mm に切ります。', '');

    var rows = cl.bins.map(function (b, i) {
      return '<tr><td>' + (i + 1) + '本目</td>' +
        '<td>' + b.cuts.map(fmt).join(' + ') + '</td>' +
        '<td>' + fmt(b.waste) + '</td></tr>';
    }).join('');
    html += '<div class="table-wrap"><table><thead><tr><th>定尺</th>' +
      '<th>切り出し（mm）</th><th>端材（mm）</th></tr></thead>' +
      '<tbody>' + rows + '</tbody></table></div>';

    sup.cuts.innerHTML = html;
  }

  /* ------------------------------------------ 曲げ1：オフセット（振り） */

  var off = {
    rise: $('#off-rise'), angle: $('#off-angle'),
    result: $('#off-result'), figure: $('#off-figure')
  };

  function renderOffset() {
    var r;
    try {
      r = C.offset(parseFloat(off.rise.value), parseFloat(off.angle.value));
    } catch (e) {
      off.result.innerHTML = msg(e.message, 'warn');
      off.figure.innerHTML = '';
      return;
    }

    var html = big('曲げと曲げの間隔', fmt(r.travel), 'mm');
    html += kv([
      ['段差', fmt(r.rise) + ' mm'],
      ['曲げ角度', fmt(r.angle) + ' °'],
      ['倍率（1 ÷ sin角度）', '×' + fmt(r.multiplier)],
      ['縮み代', fmt(r.shrink) + ' mm'],
      ['走り方向に進む距離', fmt(r.run) + ' mm']
    ]);
    html += msg('1つ目の墨から ' + fmt(r.travel) + 'mm 先が2つ目の墨です。' +
      'この振りで走りは ' + fmt(r.shrink) + 'mm 縮むので、その分を見込んで拾ってください。', '');
    html += msg('曲げ半径のない折れ線として計算しています。実際のベンダーでは半径のぶん差が出るので、' +
      '1本目は現物合わせで確かめてください。', '');
    off.result.innerHTML = html;

    off.figure.innerHTML = F.offsetSVG(r);
  }

  /* --------------------------------------------- 曲げ2：曲げの取り代 */

  var tk = {
    pipe: $('#tk-pipe'), pipeOd: $('#tk-pipe-od'),
    a: $('#tk-a'), b: $('#tk-b'), radius: $('#tk-radius'), angle: $('#tk-angle'),
    result: $('#tk-result'), figure: $('#tk-figure')
  };

  function renderTakeup() {
    var p = readPipe(tk.pipe, tk.pipeOd);
    var r;
    try {
      r = C.bendMarks(parseFloat(tk.a.value), parseFloat(tk.b.value),
        parseFloat(tk.radius.value), parseFloat(tk.angle.value));
    } catch (e) {
      tk.result.innerHTML = msg(e.message, 'warn');
      tk.figure.innerHTML = '';
      return;
    }

    var html = big('切断長', fmt(r.developed), 'mm');
    html += kv([
      ['取り代', fmt(r.takeup) + ' mm'],
      ['曲げ始めの墨（管端Aから）', fmt(r.markStart) + ' mm'],
      ['曲げ終わりの墨', fmt(r.markEnd) + ' mm'],
      ['交点から曲げ始めまで', fmt(r.tangent) + ' mm'],
      ['曲げている部分の長さ', fmt(r.arc) + ' mm']
    ]);

    if (!r.fits) {
      html += msg('外寸が曲げ半径に対して短すぎます。この半径では曲げきれません。', 'bad');
    }

    // 選んだ管があれば、現場曲げの下限と既製継手の寸法を並べて出す
    if (p && p.size) {
      var mb = C.minBendRadius(p.size.id, p.size.od);
      var tnb = D.findNormalBend(p.size.key);
      var pairs = [
        [p.label + ' の最小曲げ半径（内側）', fmt(mb.inner) + ' mm'],
        ['同じく管の芯で', fmt(mb.center) + ' mm']
      ];
      if (tnb) {
        pairs.push(['ノーマルベンドの半径（芯）', fmt(tnb.r) + ' mm']);
        pairs.push(['同じく面間寸法', fmt(tnb.l) + ' mm']);
      }
      html += kv(pairs);

      // 既製継手の半径をそのまま入れている場合は、6倍ルールの対象外
      var isFitting = tnb && Math.abs(r.radius - tnb.r) < 0.5;
      if (isFitting) {
        html += msg('入力した半径は ' + p.label + ' のノーマルベンド（JIS C 8330）の寸法です。' +
          '内線規程の「内径の6倍以上」は現場でのベンダー曲げに対する規定なので、' +
          '既製継手には当てはまりません。', 'ok');
      } else if (r.radius < mb.center) {
        html += msg('曲げ半径が内線規程の下限を下回っています。' +
          '内側の半径は管内径（' + fmt(p.size.id) + 'mm）の6倍以上、' +
          '管の芯で ' + fmt(mb.center) + 'mm 以上にしてください' +
          (tnb ? '（現場で曲げずにノーマルベンド 半径 ' + fmt(tnb.r) +
            'mm を使う手もあります）' : '') + '。', 'bad');
      } else {
        html += msg('内線規程の「内側の半径は管内径の6倍以上」を満たしています。', 'ok');
      }
    }
    tk.result.innerHTML = html;

    tk.figure.innerHTML = F.takeupSVG(r);
  }

  /* ----------------------------------------------- 曲げ3：障害物よけ */

  var sd = {
    kind: $('#sd-kind'), height: $('#sd-height'), angle: $('#sd-angle'),
    width: $('#sd-width'), clear: $('#sd-clear'), widthRow: $('#sd-width-row'),
    result: $('#sd-result'), figure: $('#sd-figure'), marks: $('#sd-marks')
  };

  function renderSaddle() {
    var four = sd.kind.value === '4';
    sd.widthRow.hidden = !four;

    var h = parseFloat(sd.height.value);
    var angle = parseFloat(sd.angle.value);
    var r;
    try {
      r = four
        ? C.saddle4(h, parseFloat(sd.width.value), angle, parseFloat(sd.clear.value))
        : C.saddle3(h, angle);
    } catch (e) {
      sd.result.innerHTML = msg(e.message, 'warn');
      sd.figure.innerHTML = ''; sd.marks.innerHTML = '';
      return;
    }

    var html, rows;
    if (four) {
      html = big('墨と墨の合計', fmt(r.total), 'mm');
      html += kv([
        ['1→2（立ち上がり）', fmt(r.spans[0]) + ' mm'],
        ['2→3（上を通る）', fmt(r.spans[1]) + ' mm'],
        ['3→4（立ち下がり）', fmt(r.spans[2]) + ' mm'],
        ['側面の曲げ角度', fmt(angle) + ' °'],
        ['縮み代', fmt(r.shrink) + ' mm']
      ]);
      rows = r.marks.map(function (m, i) {
        return '<tr><td>' + (i + 1) + '</td><td>' + fmt(m) + '</td><td>' +
          (i === 0 ? '—' : fmt(r.spans[i - 1])) + '</td></tr>';
      }).join('');
    } else {
      html = big('中央から両側の墨まで', fmt(r.markSpacing), 'mm');
      html += kv([
        ['中央の曲げ角度', fmt(r.centerAngle) + ' °'],
        ['側面の曲げ角度', fmt(r.sideAngle) + ' °'],
        ['障害物の高さ', fmt(r.height) + ' mm'],
        ['縮み代', fmt(r.shrink) + ' mm']
      ]);
      html += msg('障害物の真上に中央の墨を付け、そこから前後に ' + fmt(r.markSpacing) +
        'mm ずつが両側の墨です。', '');
      rows = [0, 1, 2].map(function (i) {
        return '<tr><td>' + (i + 1) + '</td><td>' + fmt(i * r.markSpacing) +
          '</td><td>' + (i === 0 ? '—' : fmt(r.markSpacing)) + '</td></tr>';
      }).join('');
    }

    html += msg('曲げ半径のない折れ線として計算しています。実際のベンダーでは半径のぶん差が出るので、' +
      '1本目は現物合わせで確かめてください。', '');
    sd.result.innerHTML = html;

    sd.figure.innerHTML = F.saddleSVG(r, four ? 4 : 3, parseFloat(sd.width.value));

    sd.marks.innerHTML =
      '<table><thead><tr><th>墨</th><th>1つ目からの累計（mm）</th>' +
      '<th>前から（mm）</th></tr></thead><tbody>' + rows + '</tbody></table>';
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

  /* ---------------------------------------------------------- 入力の保存
   * 入力した値・開いていたタブ・モードを localStorage に置いて、
   * 次に開いたときに続きから使えるようにします。
   * プライベートブラウズなどで使えない環境では、黙って保存なしで動きます。 */

  var STORE_KEY = 'haikan.inputs.v1';
  var storeReady = false;  // 復元し終えるまでは保存しない

  var canStore = (function () {
    try {
      window.localStorage.setItem(STORE_KEY + '.probe', '1');
      window.localStorage.removeItem(STORE_KEY + '.probe');
      return true;
    } catch (e) { return false; }
  })();

  /** 混在モードの行は id を持たないので、行ごとに拾う */
  function collectRows() {
    return $$('.pipe-row', mixed.list).map(function (r) {
      return {
        pipe: $('.pipe-select', r).value,
        od: $('.od-input', r).value,
        kind: $('.pitch-kind', r).value,
        pitch: $('.pitch-input', r).value
      };
    });
  }

  function saveState() {
    if (!storeReady || !canStore) return;
    var fields = {};
    $$('input[id], select[id]').forEach(function (el) { fields[el.id] = el.value; });

    var active = $('.tab.is-active');
    try {
      window.localStorage.setItem(STORE_KEY, JSON.stringify({
        v: 1,
        tab: active ? active.dataset.tab : null,
        modes: $$('.panel').map(function (p) {
          var m = $('.mode.is-active', p);
          return m ? m.dataset.mode : null;
        }),
        fields: fields,
        rows: collectRows(),
        staggerImport: staggerImport
      }));
    } catch (e) { /* 容量オーバーなどは保存をあきらめる */ }
  }

  function readState() {
    if (!canStore) return null;
    try {
      var raw = window.localStorage.getItem(STORE_KEY);
      var d = raw ? JSON.parse(raw) : null;
      return d && d.v === 1 ? d : null;
    } catch (e) { return null; }
  }

  function restoreState(d) {
    if (!d) return;

    if (d.staggerImport && Array.isArray(d.staggerImport.pitches)) {
      staggerImport = d.staggerImport;
    }

    // 行数を合わせてから値を入れる（行は動的に作られるため）
    if (Array.isArray(d.rows)) {
      mixed.list.innerHTML = '';
      d.rows.forEach(function (row) { mixedAddRow(row.pipe); });
      $$('.pipe-row', mixed.list).forEach(function (r, i) {
        var row = d.rows[i];
        if (!row) return;
        $('.pipe-select', r).value = row.pipe;
        $('.od-input', r).value = row.od;
        var kind = $('.pitch-kind', r);
        kind.value = row.kind;
        kind.dataset.prevKind = row.kind;
        var pitch = $('.pitch-input', r);
        pitch.value = row.pitch;
        // 空欄のまま保存されていたら、既定値で埋め戻さずそのままにする
        pitch.dataset.init = '1';
      });
    }

    Object.keys(d.fields || {}).forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.value = d.fields[id];
    });

    if (d.tab) {
      var tab = $('.tab[data-tab="' + d.tab + '"]');
      if (tab) activateTab(tab);
    }
    (d.modes || []).forEach(function (name) {
      if (!name) return;
      var btn = $('.mode[data-mode="' + name + '"]');
      if (btn) activateMode(btn);
    });

    // 管を選び直したときだけ上限間隔と定尺を入れ替える仕掛けがあるので、
    // 復元した管を「いま選ばれているもの」として覚えさせ、値を上書きさせない
    var p = readPipe(sup.pipe, sup.pipeOd);
    supLastSeries = p && p.size ? p.size.series : null;
    supLastSize = p && p.size ? p.size.key : null;
  }

  function resetInputs() {
    if (!window.confirm('入力をすべて既定値に戻します。よろしいですか？')) return;
    if (canStore) {
      try { window.localStorage.removeItem(STORE_KEY); } catch (e) { /* 無視 */ }
    }
    window.location.reload();
  }

  /* -------------------------------------------------------------- 初期化 */

  function activateTab(tab) {
    $$('.tab').forEach(function (x) {
      x.classList.toggle('is-active', x === tab);
      x.setAttribute('aria-selected', x === tab ? 'true' : 'false');
    });
    $$('.panel').forEach(function (p) {
      p.classList.toggle('is-active', p.id === 'panel-' + tab.dataset.tab);
    });
  }

  /** モードの切り替えは、そのタブの中だけに効かせる */
  function activateMode(btn) {
    var panel = btn.closest('.panel');
    if (!panel) return;
    $$('.mode', panel).forEach(function (x) { x.classList.toggle('is-active', x === btn); });
    $$('.mode-panel', panel).forEach(function (p) {
      p.classList.toggle('is-active', p.id === 'mode-' + btn.dataset.mode);
    });
  }

  function initTabs() {
    $$('.tab').forEach(function (t) {
      t.addEventListener('click', function () { activateTab(t); saveState(); });
    });

    $$('.mode').forEach(function (m) {
      m.addEventListener('click', function () {
        activateMode(m);
        renderAll();
        saveState();
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
    renderSupport();
    renderOffset();
    renderTakeup();
    renderSaddle();
    renderTable();
  }

  function init() {
    fillPipeSelect(two.p1, 'E25');
    fillPipeSelect(two.p2, 'E25');
    fillPipeSelect(even.pipe, 'E25');
    fillPipeSelect(sup.pipe, 'E25');
    fillPipeSelect(stag.pipe, 'E25');
    fillPipeSelect(tk.pipe, 'E25');

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
    bind([stag.pipe, stag.pipeOd, stag.pitch, stag.pitch2, stag.angle, stag.count,
      stag.source, stag.bend, stag.insert, stag.insertKind], renderStagger);
    bind([sup.pipe, sup.pipeOd, sup.length, sup.span, sup.margin,
      sup.stock, sup.first, sup.extra, sup.coupling, sup.saddle,
      sup.atJoint, sup.jointOffset, sup.jointMode], renderSupport);
    bind([off.rise, off.angle], renderOffset);
    bind([tk.pipe, tk.pipeOd, tk.a, tk.b, tk.radius, tk.angle], renderTakeup);
    bind([sd.kind, sd.height, sd.angle, sd.width, sd.clear], renderSaddle);
    bind([tbl.series, tbl.search], renderTable);

    // 混在モードは行が動的なので、リスト全体で拾う
    mixed.list.addEventListener('input', renderMixed);
    mixed.list.addEventListener('change', renderMixed);
    mixed.toStagger.addEventListener('click', function () {
      if (!mixedLatest || !mixedLatest.pitches.length) return;
      staggerImport = {
        labels: mixedLatest.labels.slice(),
        ods: mixedLatest.ods.slice(),
        radii: mixedLatest.radii.slice(),
        faces: mixedLatest.faces.slice(),
        varies: mixedLatest.varies.slice(),
        inserts: mixedLatest.inserts.slice(),
        fieldRadii: mixedLatest.fieldRadii.slice(),
        materials: mixedLatest.materials.slice(),
        pitches: mixedLatest.pitches.slice()
      };
      stag.source.value = 'mixed';
      activateTab($('.tab[data-tab="pitch"]'));
      activateMode($('.mode[data-mode="stagger"]'));
      renderAll();
      saveState();
      // 取り込んだ内容はカードの上のほうに出るので、先頭まで戻す
      window.scrollTo(0, 0);
    });

    mixed.add.addEventListener('click', function () { mixedAddRow('E25'); saveState(); });
    mixed.clear.addEventListener('click', function () {
      mixed.list.innerHTML = '';
      renderMixed();
      saveState();
    });

    // 角度のクイック選択。どのモードでも data-target の欄に値を入れて描き直す
    $$('.quick[data-target]').forEach(function (q) {
      var target = $('#' + q.dataset.target);
      $$('.chip', q).forEach(function (c) {
        c.addEventListener('click', function () {
          target.value = c.dataset.angle;
          renderAll();
          saveState();
        });
      });
    });

    initTabs();
    $('#reset-btn').addEventListener('click', resetInputs);

    var saved = readState();
    if (saved) {
      restoreState(saved);
    } else {
      ['E25', 'E31', 'E51'].forEach(mixedAddRow);
    }

    renderAll();

    // 復元が終わってから保存を始める（途中の状態を書き込まないため）
    storeReady = true;
    document.addEventListener('input', saveState);
    document.addEventListener('change', saveState);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
