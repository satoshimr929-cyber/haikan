/* 図（SVG）の組み立て。DOM には触らず、文字列を返すだけにしてあります。
 * app.js から HaikanFigures として使います。 */
(function (root) {
  'use strict';

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

  /* 図の文字は CSS 側で 12px / 狭い画面では 17px に変わる。JS からは実際の
   * 大きさが分からないので、余白はつねに大きいほうに合わせて確保する。
   * LABEL_DROP = 寸法線からラベルのベースラインまで
   * LABEL_ROOM = ラベルのベースラインから図の下端まで */
  var LABEL_DROP = 20;
  var LABEL_ROOM = 10;
  /* 17px の文字が上端で切れないベースラインの下限（アセンダぶんの余裕） */
  var LABEL_TOP = 20;

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

    var yLabel = LABEL_TOP;
    var railY = yLabel + 10 + maxOd * s;
    var dimY = railY + 26;
    var H = dimY + LABEL_DROP + LABEL_ROOM;

    var x = function (mm) { return offX + mm * s; };
    var out = [];

    // 芯どうしが詰まっていると管のラベルが重なるので、その場合は端だけに振る
    var minStep = Infinity;
    for (var n = 1; n < items.length; n++) {
      minStep = Math.min(minStep, (items[n].center - items[n - 1].center) * s);
    }
    var showAll = items.length < 2 || minStep >= 24;
    var last = items.length - 1;

    out.push('<svg viewBox="0 0 ' + W + ' ' + Math.round(H) + '" role="img" aria-label="配管の配置図">');

    // 取り付け面（ラック / 壁）
    out.push('<line class="rail" x1="' + x(0) + '" y1="' + railY +
      '" x2="' + x(totalWidth) + '" y2="' + railY + '"/>');

    items.forEach(function (it, i) {
      var r = (it.od * s) / 2;
      var cx = x(it.center);
      var cy = railY - r;
      out.push('<circle class="pipe-fill" cx="' + cx.toFixed(1) + '" cy="' + cy.toFixed(1) +
        '" r="' + Math.max(r, 2).toFixed(1) + '"/>');
      // 芯の位置を示す一点鎖線
      out.push('<line class="cl" x1="' + cx.toFixed(1) + '" y1="' + (cy - r - 6).toFixed(1) +
        '" x2="' + cx.toFixed(1) + '" y2="' + (dimY + 6) + '"/>');
      if (showAll || i === 0 || i === last) {
        out.push('<text class="strong" x="' + cx.toFixed(1) + '" y="' + yLabel +
          '" text-anchor="middle">' + esc(it.label) + '</text>');
      }
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
        out.push('<text x="' + ((x1 + x2) / 2).toFixed(1) + '" y="' + (dimY + LABEL_DROP) +
          '" text-anchor="middle">' + esc(d.label) + '</text>');
      }
    });

    out.push('</svg>');
    return out.join('');
  }

  /**
   * 並行配管を同じ角度で曲げたところを真上から見た図。
   * 曲げの内側になる管ほど曲げ位置が手前になり、そのずれが stagger。
   * 1本目を内側（図の上）に置き、外側へ向かって順に曲げ位置をずらして描く。
   */
  function staggerSVG(o) {
    if (!o) return '';
    var pitches = o.pitches, offsets = o.offsets, angleDeg = o.angle;
    var after = o.pitchesAfter || pitches;
    var ods = Array.isArray(o.ods) ? o.ods : null;
    var count = offsets ? offsets.length : 0;
    if (count < 2 || !pitches || pitches.length !== count - 1) return '';
    if (!pitches.every(function (v) { return v > 0; })) return '';
    if (!offsets.every(isFinite)) return '';

    var t = angleDeg * Math.PI / 180;
    var cos = Math.cos(t), sin = Math.sin(t);
    var maxPitch = Math.max.apply(null, pitches);
    var maxAfter = Math.max.apply(null, after);
    var maxShift = Math.max.apply(null, offsets.map(Math.abs));
    var leadIn = Math.max(maxPitch * 1.4, maxShift * 1.2, 40); // 曲げ手前の直線部
    var leadOut = Math.max(Math.max(maxPitch, maxAfter) * 1.6, 60); // 曲げた先の直線部

    // モデル座標（mm・y は下向き）で各管の 始点／曲げ位置／終点 を出す。
    // ずらし量は負にもなるので、いちばん手前の曲げ位置から直線部を取る。
    var i, rowY = [0];
    for (i = 0; i < pitches.length; i++) rowY.push(rowY[i] + pitches[i]);
    var startX = Math.min.apply(null, offsets) - leadIn;

    var pipes = [];
    for (i = 0; i < count; i++) {
      var vxi = offsets[i], vyi = rowY[i];
      pipes.push({
        start: [startX, vyi],
        vertex: [vxi, vyi],
        end: [vxi + leadOut * cos, vyi - leadOut * sin]
      });
    }

    // 角度によっては曲げた先が左へ戻るので、実際の範囲から囲みを取る
    var xs = [], ys = [];
    pipes.forEach(function (p) {
      [p.start, p.vertex, p.end].forEach(function (q) { xs.push(q[0]); ys.push(q[1]); });
    });
    // 管を太さのある帯で描くので、半径ぶんを囲みに足しておく
    var halfOd = ods ? Math.max.apply(null, ods) / 2 : 0;
    var minX = Math.min.apply(null, xs) - halfOd, maxX = Math.max.apply(null, xs) + halfOd;
    var minY = Math.min.apply(null, ys) - halfOd, maxY = Math.max.apply(null, ys) + halfOd;
    var bw = maxX - minX, bh = maxY - minY;
    if (!(bw > 0) || !(bh > 0)) return '';

    var W = 600, PADL = 36, PADR = 22, TOP = LABEL_TOP, MAXH = 420;
    var DIM = 18 + LABEL_DROP + LABEL_ROOM; // 寸法線の位置 + ラベル + 下の余白
    var inner = W - PADL - PADR;
    // まず幅いっぱいに広げ、縦に間延びしすぎる形だけ高さで頭打ちにする
    var s = inner / bw;
    if (TOP + bh * s + DIM > MAXH) s = (MAXH - TOP - DIM) / bh;
    var offX = PADL + (inner - bw * s) / 2;
    var X = function (x) { return offX + (x - minX) * s; };
    var Y = function (y) { return TOP + (y - minY) * s; };

    var drawH = bh * s;
    var dimY = TOP + drawH + 18;
    var H = TOP + drawH + DIM;
    var o = [];

    o.push('<svg viewBox="0 0 ' + W + ' ' + Math.round(H) +
      '" role="img" aria-label="並行配管の曲げ位置をずらした図">');

    // 曲げ位置を結ぶ線。まっすぐ並ばずに斜めに流れることが見てとれる
    o.push('<line class="ghost" x1="' + X(pipes[0].vertex[0]).toFixed(1) +
      '" y1="' + Y(pipes[0].vertex[1]).toFixed(1) +
      '" x2="' + X(pipes[count - 1].vertex[0]).toFixed(1) +
      '" y2="' + Y(pipes[count - 1].vertex[1]).toFixed(1) + '"/>');

    // 管の間隔が文字の高さより狭いと番号が重なるので、その場合は端だけに振る
    var step = Math.min.apply(null, pitches) * s;
    var showAll = step >= 20;
    var showEnds = (rowY[count - 1] - rowY[0]) * s >= 20;

    pipes.forEach(function (p, i) {
      var pts = [p.start, p.vertex, p.end].map(function (q) {
        return X(q[0]).toFixed(1) + ',' + Y(q[1]).toFixed(1);
      }).join(' ');

      // 外径が分かっていれば、管の太さぶんの帯にする。
      // 外周を1枚、内側をもう1枚重ねて、管の壁が見えるようにする。
      var w = ods && ods[i] > 0 ? ods[i] * s : 0;
      if (w >= 5) {
        o.push('<polyline class="pipe-wall" style="stroke-width:' + w.toFixed(1) +
          '" points="' + pts + '"/>');
        o.push('<polyline class="pipe-bore" style="stroke-width:' +
          Math.max(w - 3, 1).toFixed(1) + '" points="' + pts + '"/>');
      }

      o.push('<polyline class="' + (w >= 5 ? 'pipe-center' : 'pipe-line') +
        '" points="' + pts + '"/>');
      o.push('<circle class="vertex" cx="' + X(p.vertex[0]).toFixed(1) +
        '" cy="' + Y(p.vertex[1]).toFixed(1) + '" r="3"/>');
      if (showAll || (showEnds ? (i === 0 || i === count - 1) : i === 0)) {
        o.push('<text class="strong" x="' + (X(p.start[0]) - 6).toFixed(1) +
          '" y="' + (Y(p.start[1]) + 4).toFixed(1) + '" text-anchor="end">' +
          (i + 1) + '</text>');
      }
      // 曲げ位置から下の寸法線へ落とす引き出し線
      o.push('<line class="cl" x1="' + X(p.vertex[0]).toFixed(1) +
        '" y1="' + Y(p.vertex[1]).toFixed(1) +
        '" x2="' + X(p.vertex[0]).toFixed(1) + '" y2="' + (dimY + 6) + '"/>');
    });

    // 曲げずにまっすぐ進んだ場合の線と、そこからの振れ角
    var v0 = pipes[0].vertex;
    var r = 26;
    o.push('<line class="ghost" x1="' + X(v0[0]).toFixed(1) + '" y1="' + Y(v0[1]).toFixed(1) +
      '" x2="' + (X(v0[0]) + r * 1.7).toFixed(1) + '" y2="' + Y(v0[1]).toFixed(1) + '"/>');
    o.push('<path class="dim" fill="none" d="M ' + (X(v0[0]) + r).toFixed(1) + ' ' +
      Y(v0[1]).toFixed(1) + ' A ' + r + ' ' + r + ' 0 ' + (angleDeg > 180 ? 1 : 0) + ' 0 ' +
      (X(v0[0]) + r * cos).toFixed(1) + ' ' + (Y(v0[1]) - r * sin).toFixed(1) + '"/>');
    // 角度が大きいと図の外へ出るので、内側に収まる位置まで戻す
    var aLabelX = Math.min(W - PADR - 14, X(v0[0]) + (r + 13) * Math.cos(t / 2));
    var aLabelY = Math.max(LABEL_TOP, Y(v0[1]) - (r + 13) * Math.sin(t / 2) + 4);
    o.push('<text x="' + aLabelX.toFixed(1) + '" y="' + aLabelY.toFixed(1) +
      '" text-anchor="middle">' + fmt(angleDeg) + '°</text>');

    // 手前のピッチ。ペアごとに違うことがあるので、すべての区間に入れる
    var px = X(startX) + Math.min(26, leadIn * s * 0.4);
    o.push('<line class="dim" x1="' + px.toFixed(1) + '" y1="' + Y(rowY[0]).toFixed(1) +
      '" x2="' + px.toFixed(1) + '" y2="' + Y(rowY[count - 1]).toFixed(1) + '"/>');
    rowY.forEach(function (y) {
      o.push('<line class="dim" x1="' + (px - 4).toFixed(1) + '" y1="' + Y(y).toFixed(1) +
        '" x2="' + (px + 4).toFixed(1) + '" y2="' + Y(y).toFixed(1) + '"/>');
    });
    pitches.forEach(function (v, k) {
      if (v * s <= 34) return;
      o.push(tryLabel(px + 6, Y((rowY[k] + rowY[k + 1]) / 2) + 4, fmt(v), 'start'));
    });

    // 曲げた先のピッチ。曲げた先の直線部に直交する向きで引く
    var d = leadOut * 0.72;
    var pitchAfter = after[0];
    var a0 = [pipes[0].vertex[0] + d * cos, pipes[0].vertex[1] - d * sin];
    var a1 = [a0[0] + pitchAfter * sin, a0[1] + pitchAfter * cos];
    o.push('<line class="dim" x1="' + X(a0[0]).toFixed(1) + '" y1="' + Y(a0[1]).toFixed(1) +
      '" x2="' + X(a1[0]).toFixed(1) + '" y2="' + Y(a1[1]).toFixed(1) + '"/>');
    [a0, a1].forEach(function (q) {
      // 寸法線と直角に、短い矢羽根を付ける
      o.push('<line class="dim" x1="' + (X(q[0]) - 4 * cos).toFixed(1) +
        '" y1="' + (Y(q[1]) + 4 * sin).toFixed(1) +
        '" x2="' + (X(q[0]) + 4 * cos).toFixed(1) +
        '" y2="' + (Y(q[1]) - 4 * sin).toFixed(1) + '"/>');
    });
    if (pitchAfter * s > 34) {
      var mid = [(a0[0] + a1[0]) / 2, (a0[1] + a1[1]) / 2];
      o.push('<text x="' + (X(mid[0]) + 11 * cos).toFixed(1) +
        '" y="' + (Y(mid[1]) - 11 * sin + 4).toFixed(1) +
        '" text-anchor="middle">' + fmt(pitchAfter) + '</text>');
    }

    // 下側：曲げ位置のずれ
    o.push('<line class="dim" x1="' + X(pipes[0].vertex[0]).toFixed(1) + '" y1="' + dimY +
      '" x2="' + X(pipes[count - 1].vertex[0]).toFixed(1) + '" y2="' + dimY + '"/>');
    pipes.forEach(function (p) {
      o.push('<line class="dim" x1="' + X(p.vertex[0]).toFixed(1) + '" y1="' + (dimY - 5) +
        '" x2="' + X(p.vertex[0]).toFixed(1) + '" y2="' + (dimY + 5) + '"/>');
    });
    var shifts = [];
    for (var k = 1; k < count; k++) shifts.push(offsets[k] - offsets[k - 1]);
    var uniform = shifts.every(function (v) { return Math.abs(v - shifts[0]) < 1e-6; });
    var minSeg = Math.min.apply(null, shifts.map(function (v) { return Math.abs(v) * s; }));

    if (minSeg > 44) {
      for (k = 1; k < count; k++) {
        var x1 = X(pipes[k - 1].vertex[0]), x2 = X(pipes[k].vertex[0]);
        o.push(tryLabel((x1 + x2) / 2, dimY + LABEL_DROP, fmt(shifts[k - 1])));
      }
    } else if (uniform) {
      // 1つずつ書くと重なるので、同じ値ならまとめて「ずらし量 × 箇所数」で出す
      o.push(tryLabel((X(pipes[0].vertex[0]) + X(pipes[count - 1].vertex[0])) / 2,
        dimY + LABEL_DROP, fmt(shifts[0]) + ' × ' + (count - 1)));
    } else {
      // ばらばらのときは入るものだけ書く（重なる分は tryLabel が落とす）
      for (k = 1; k < count; k++) {
        o.push(tryLabel((X(pipes[k - 1].vertex[0]) + X(pipes[k].vertex[0])) / 2,
          dimY + LABEL_DROP, fmt(shifts[k - 1])));
      }
    }

    o.push('</svg>');
    return o.join('');
  }

  /* ------------------------------------------------------ 作図の共通土台
   * 曲げ加工の図はどれも「折れ線を描いて、寸法線を添える」形なので、
   * 縮尺とはみ出さない余白の計算をここにまとめてあります。 */

  var CW = 600, CPADL = 36, CPADR = 22, CMAXH = 420;

  /* 寸法が極端な形だとラベルどうしがぶつかる。実測はできないので文字数から
   * 大きさを見積もり、先に置いたものと重なる分は落とす。
   * 先に呼んだラベルほど優先されるので、大事な寸法から順に置くこと。 */
  var placed = [];

  function resetLabels() { placed = []; }

  function tryLabel(x, y, text, anchor, cls) {
    var w = String(text).length * 9.5 + 4;  // 狭い画面の 17px を想定
    var l = anchor === 'end' ? x - w : (anchor === 'start' ? x : x - w / 2);
    var box = { l: l, r: l + w, t: y - 15, b: y + 5 };

    for (var i = 0; i < placed.length; i++) {
      var p = placed[i];
      if (box.l < p.r && p.l < box.r && box.t < p.b && p.t < box.b) return '';
    }
    placed.push(box);

    return '<text ' + (cls ? 'class="' + cls + '" ' : '') +
      'x="' + x.toFixed(1) + '" y="' + y.toFixed(1) +
      '" text-anchor="' + (anchor || 'middle') + '">' + esc(text) + '</text>';
  }

  /**
   * 見せたい点をすべて渡すと、はみ出さない縮尺と座標変換を返す。
   * @param {Array<[number,number]>} points モデル座標（y は下向き）
   */
  function makeCanvas(points) {
    resetLabels();
    var xs = points.map(function (p) { return p[0]; });
    var ys = points.map(function (p) { return p[1]; });
    var minX = Math.min.apply(null, xs), maxX = Math.max.apply(null, xs);
    var minY = Math.min.apply(null, ys), maxY = Math.max.apply(null, ys);
    var bw = maxX - minX, bh = maxY - minY;
    if (!(bw > 0) || !isFinite(bw) || !isFinite(bh)) return null;

    var bottom = 18 + LABEL_DROP + LABEL_ROOM;
    var inner = CW - CPADL - CPADR;
    // まず幅いっぱいに広げ、縦に間延びしすぎる形だけ高さで頭打ちにする
    var s = inner / bw;
    if (bh > 0 && LABEL_TOP + bh * s + bottom > CMAXH) {
      s = (CMAXH - LABEL_TOP - bottom) / bh;
    }
    var offX = CPADL + (inner - bw * s) / 2;
    var drawH = bh * s;

    return {
      s: s,
      W: CW,
      H: LABEL_TOP + drawH + bottom,
      dimY: LABEL_TOP + drawH + 18,
      X: function (x) { return offX + (x - minX) * s; },
      Y: function (y) { return LABEL_TOP + (y - minY) * s; }
    };
  }

  function open(c, label) {
    return '<svg viewBox="0 0 ' + c.W + ' ' + Math.round(c.H) +
      '" role="img" aria-label="' + esc(label) + '">';
  }

  /** モデル座標の点列を折れ線で描く */
  function polyline(c, pts, cls) {
    return '<polyline class="' + (cls || 'pipe-line') + '" points="' +
      pts.map(function (p) { return c.X(p[0]).toFixed(1) + ',' + c.Y(p[1]).toFixed(1); })
        .join(' ') + '"/>';
  }

  function vertex(c, p) {
    return '<circle class="vertex" cx="' + c.X(p[0]).toFixed(1) +
      '" cy="' + c.Y(p[1]).toFixed(1) + '" r="3"/>';
  }

  /** 画面座標での寸法線。dir は矢羽根の向き（'h' なら縦棒、'v' なら横棒） */
  function dimLine(x1, y1, x2, y2, label, dir, drop) {
    var out = ['<line class="dim" x1="' + x1.toFixed(1) + '" y1="' + y1.toFixed(1) +
      '" x2="' + x2.toFixed(1) + '" y2="' + y2.toFixed(1) + '"/>'];
    [[x1, y1], [x2, y2]].forEach(function (p) {
      var dx = dir === 'v' ? 4 : 0, dy = dir === 'v' ? 0 : 5;
      out.push('<line class="dim" x1="' + (p[0] - dx).toFixed(1) +
        '" y1="' + (p[1] - dy).toFixed(1) + '" x2="' + (p[0] + dx).toFixed(1) +
        '" y2="' + (p[1] + dy).toFixed(1) + '"/>');
    });
    if (label !== null && label !== undefined) {
      var d = drop || {};
      out.push(tryLabel((x1 + x2) / 2 + (d.dx || 0),
        (y1 + y2) / 2 + (d.dy === undefined ? LABEL_DROP : d.dy),
        label, d.anchor));
    }
    return out.join('');
  }

  /** 斜めの寸法線。線に直交する向きにラベルを逃がす */
  function slantDim(c, p1, p2, label, side) {
    var x1 = c.X(p1[0]), y1 = c.Y(p1[1]), x2 = c.X(p2[0]), y2 = c.Y(p2[1]);
    var len = Math.hypot(x2 - x1, y2 - y1);
    if (!(len > 0)) return '';
    var n = [-(y2 - y1) / len, (x2 - x1) / len];
    var k = (side === undefined ? 1 : side) * 13;
    var out = ['<line class="dim" x1="' + x1.toFixed(1) + '" y1="' + y1.toFixed(1) +
      '" x2="' + x2.toFixed(1) + '" y2="' + y2.toFixed(1) + '"/>'];
    [[x1, y1], [x2, y2]].forEach(function (p) {
      out.push('<line class="dim" x1="' + (p[0] - n[0] * 4).toFixed(1) +
        '" y1="' + (p[1] - n[1] * 4).toFixed(1) + '" x2="' + (p[0] + n[0] * 4).toFixed(1) +
        '" y2="' + (p[1] + n[1] * 4).toFixed(1) + '"/>');
    });
    if (label !== null && len > 34) {
      out.push(tryLabel((x1 + x2) / 2 + n[0] * k, (y1 + y2) / 2 + n[1] * k + 4, label));
    }
    return out.join('');
  }

  /**
   * 曲げの振れ角。まっすぐ進んだ場合の線から、曲げた向きまでの弧を描く。
   * angleDeg は進行方向からの振れ（上向きが正）。
   */
  function angleArc(c, v, angleDeg, dirDeg) {
    var base = (dirDeg || 0) * Math.PI / 180;
    var t = angleDeg * Math.PI / 180;
    var cx = c.X(v[0]), cy = c.Y(v[1]), r = 24;
    var p = function (a) {
      return [(cx + r * Math.cos(base - a)).toFixed(1), (cy - r * Math.sin(base - a)).toFixed(1)];
    };
    var a0 = p(0), a1 = p(t);
    var out = ['<line class="ghost" x1="' + cx.toFixed(1) + '" y1="' + cy.toFixed(1) +
      '" x2="' + (cx + r * 1.7 * Math.cos(base)).toFixed(1) +
      '" y2="' + (cy - r * 1.7 * Math.sin(base)).toFixed(1) + '"/>'];
    out.push('<path class="dim" fill="none" d="M ' + a0[0] + ' ' + a0[1] +
      ' A ' + r + ' ' + r + ' 0 0 0 ' + a1[0] + ' ' + a1[1] + '"/>');
    var lx = cx + (r + 13) * Math.cos(base - t / 2);
    var ly = cy - (r + 13) * Math.sin(base - t / 2);
    out.push(tryLabel(Math.min(CW - CPADR - 14, Math.max(CPADL, lx)),
      Math.max(LABEL_TOP, ly + 4), fmt(angleDeg) + '°'));
    return out.join('');
  }

  /* -------------------------------------------------------- 曲げ加工の図 */

  /** オフセット（振り）を横から見た図 */
  function offsetSVG(r) {
    if (!r || !(r.rise > 0) || !isFinite(r.travel)) return '';

    var lead = Math.max(r.run * 0.6, r.rise * 0.8, 30);
    var b1 = [lead, r.rise];                 // 1つ目の曲げ
    var b2 = [lead + r.run, 0];              // 2つ目の曲げ
    var path = [[0, r.rise], b1, b2, [b2[0] + lead, 0]];

    var c = makeCanvas(path);
    if (!c) return '';
    var o = [open(c, 'オフセットの図')];

    o.push(polyline(c, path));
    o.push(vertex(c, b1));
    o.push(vertex(c, b2));
    o.push(angleArc(c, b1, r.angle));

    // 段差（縦）
    var vx = c.X(b2[0]) + 16;
    o.push(dimLine(vx, c.Y(0), vx, c.Y(r.rise), fmt(r.rise), 'v',
      { dx: 8, dy: 4, anchor: 'start' }));
    // 斜辺（曲げと曲げの間隔）
    o.push(slantDim(c, b1, b2, fmt(r.travel), -1));
    // 水平投影
    o.push(dimLine(c.X(b1[0]), c.dimY, c.X(b2[0]), c.dimY, fmt(r.run), 'h'));

    o.push('</svg>');
    return o.join('');
  }

  /** 曲げ半径のある1箇所の曲げを横から見た図 */
  function takeupSVG(r) {
    if (!r || !(r.radius > 0)) return '';

    var t = r.angle * Math.PI / 180;
    var cos = Math.cos(t), sin = Math.sin(t);
    var V = [0, 0];                                   // 交点
    var A = [-r.legA, 0];                             // 管端A
    var B = [r.legB * cos, -r.legB * sin];            // 管端B
    var T1 = [-r.tangent, 0];                         // 曲げ始め
    var T2 = [r.tangent * cos, -r.tangent * sin];     // 曲げ終わり
    var O = [-r.tangent, -r.radius];                  // 円弧の中心

    var c = makeCanvas([A, B, V, T1, T2, O]);
    if (!c) return '';
    var o = [open(c, '曲げの取り代の図')];

    // 曲げなければ角になる線（交点まで）を薄く
    o.push(polyline(c, [T1, V, T2], 'ghost'));
    // 実際の管：直線 → 円弧 → 直線
    o.push(polyline(c, [A, T1], 'pipe-line'));
    o.push(polyline(c, [T2, B], 'pipe-line'));
    o.push('<path class="pipe-line" fill="none" d="M ' + c.X(T1[0]).toFixed(1) + ' ' +
      c.Y(T1[1]).toFixed(1) + ' A ' + (r.radius * c.s).toFixed(1) + ' ' +
      (r.radius * c.s).toFixed(1) + ' 0 0 0 ' + c.X(T2[0]).toFixed(1) + ' ' +
      c.Y(T2[1]).toFixed(1) + '"/>');

    o.push(vertex(c, T1));
    o.push(vertex(c, T2));

    // 曲げ半径（中心から曲げ始めへ）
    o.push(slantDim(c, O, T1, 'R' + fmt(r.radius), 1));
    // 外寸A（交点まで）
    o.push(dimLine(c.X(A[0]), c.dimY, c.X(V[0]), c.dimY, 'A ' + fmt(r.legA), 'h'));
    // 外寸B（交点から管端まで）
    o.push(slantDim(c, V, B, 'B ' + fmt(r.legB), -1));

    o.push('</svg>');
    return o.join('');
  }

  /** 障害物よけ（3方・4方曲げ）を横から見た図 */
  function saddleSVG(r, kind, width) {
    if (!r || !(r.height > 0)) return '';

    var h = r.height;
    var run = r.run !== undefined ? r.run : h / Math.tan(r.angle * Math.PI / 180);
    if (!isFinite(run)) return '';
    var top = kind === 4 ? r.topRun : 0;
    var lead = Math.max(run * 0.7, h * 1.2, 30);

    // 走り面を y=0、障害物の上を y=-h とする
    var b1 = [lead, 0];
    var b2 = [lead + run, -h];
    var b3 = [lead + run + top, -h];
    var b4 = [lead + 2 * run + top, 0];
    var path = kind === 4
      ? [[0, 0], b1, b2, b3, b4, [b4[0] + lead, 0]]
      : [[0, 0], b1, b2, b4, [b4[0] + lead, 0]];

    var obsW = kind === 4 ? width : Math.max(run, h);
    var obsMid = lead + run + top / 2;
    var obs = [[obsMid - obsW / 2, 0], [obsMid + obsW / 2, -h]];

    var c = makeCanvas(path.concat([obs[0], obs[1]]));
    if (!c) return '';
    var o = [open(c, '障害物よけの図')];

    // 障害物
    o.push('<rect class="ghost" x="' + c.X(obs[0][0]).toFixed(1) +
      '" y="' + c.Y(obs[1][1]).toFixed(1) +
      '" width="' + (obsW * c.s).toFixed(1) +
      '" height="' + (h * c.s).toFixed(1) + '"/>');

    o.push(polyline(c, path));
    [b1, b2, b3, b4].forEach(function (p, i) {
      if (kind === 3 && i === 2) return; // 3方曲げは中央が1点
      o.push(vertex(c, p));
    });
    o.push(angleArc(c, b1, r.angle));

    // 高さ（縦）
    var vx = c.X(b1[0]) - 16;
    o.push(dimLine(vx, c.Y(0), vx, c.Y(-h), fmt(h), 'v',
      { dx: -8, dy: 4, anchor: 'end' }));
    // 斜めの区間（墨と墨の間隔）
    var spacing = fmt(kind === 4 ? r.spans[0] : r.markSpacing);
    o.push(slantDim(c, b1, b2, spacing, -1));
    o.push(slantDim(c, kind === 4 ? b3 : b2, b4, spacing, -1));
    // 4方曲げの上の直線部。図の上端には余白がないので、下の寸法線に置く
    if (kind === 4) {
      o.push(dimLine(c.X(b2[0]), c.dimY, c.X(b3[0]), c.dimY, fmt(r.topRun), 'h'));
    }

    o.push('</svg>');
    return o.join('');
  }

  /**
   * サドル・支持点の割り付けを横から見た図。
   * @param {object} p
   * @param {number} p.length
   * @param {number} p.margin
   * @param {Array} p.positions supportPlan の positions（{x, kind, clash, suggest}）
   * @param {number[]} [p.joints] 管の接続点
   * @param {number} [p.couplingLength] カップリングの長さ（接続点の描画に使う）
   * @param {Array} [p.jointChecks] 接続点ごとの最寄りの支持点（{joint, support, distance, clash}）
   */
  function supportSVG(p) {
    if (!p || !(p.length > 0) || !p.positions || p.positions.length < 2) return '';
    var length = p.length, margin = p.margin;
    var positions = p.positions;
    var joints = p.joints || [];
    var coupling = p.couplingLength > 0 ? p.couplingLength : 0;

    var pipeY = 0, h = length * 0.05; // 管の見た目の太さぶんだけ縦幅を持たせる
    var c = makeCanvas([[0, -h], [length, h]]);
    if (!c) return '';
    var o = [open(c, 'サドルの割り付け図')];
    var py = c.Y(pipeY);

    o.push(polyline(c, [[0, pipeY], [length, pipeY]]));

    // 接続点。カップリングの長さぶんの太い区間として管の上に重ねる
    joints.forEach(function (j) {
      var w = Math.max(coupling * c.s, 5);
      o.push('<rect class="coupling" x="' + (c.X(j) - w / 2).toFixed(1) +
        '" y="' + (py - 5) + '" width="' + w.toFixed(1) + '" height="10" rx="2"/>');
    });

    var seg = c.X(positions[1].x) - c.X(positions[0].x);

    positions.forEach(function (pos, i) {
      var px = c.X(pos.x);
      var bad = pos.clash !== null && pos.clash !== undefined;
      // サドルを管をまたぐコの字で表す
      o.push('<path class="' + (bad ? 'saddle-bad' : 'dim') + '" fill="none" d="M ' +
        (px - 6).toFixed(1) + ' ' + (py + 9) +
        ' L ' + (px - 6).toFixed(1) + ' ' + (py - 6) +
        ' L ' + (px + 6).toFixed(1) + ' ' + (py - 6) +
        ' L ' + (px + 6).toFixed(1) + ' ' + (py + 9) + '"/>');
      o.push('<line class="cl" x1="' + px.toFixed(1) + '" y1="' + (py - 8) +
        '" x2="' + px.toFixed(1) + '" y2="' + (c.dimY + 6) + '"/>');
      // 逃がし先があれば、そこに薄いサドルを重ねて見せる
      if (pos.suggest !== null && pos.suggest !== undefined) {
        var sx = c.X(pos.suggest);
        o.push('<path class="ghost" fill="none" d="M ' + (sx - 6).toFixed(1) + ' ' +
          (py + 9) + ' L ' + (sx - 6).toFixed(1) + ' ' + (py - 6) +
          ' L ' + (sx + 6).toFixed(1) + ' ' + (py - 6) +
          ' L ' + (sx + 6).toFixed(1) + ' ' + (py + 9) + '"/>');
      }
      if (i === 0 || i === positions.length - 1 || seg >= 24) {
        o.push(tryLabel(px, py - 12, String(i + 1), 'middle', 'strong'));
      }
    });

    // 接続点から最寄りの支持点までの距離。管と下の寸法線のあいだに引く
    var midY = (py + c.dimY) / 2;
    (p.jointChecks || []).forEach(function (jc) {
      var x1 = c.X(jc.joint), x2 = c.X(jc.support);
      if (Math.abs(x2 - x1) < 3) return; // ほぼ重なっていれば線にならない
      o.push('<line class="' + (jc.clash ? 'saddle-bad' : 'dim') + '" x1="' + x1.toFixed(1) +
        '" y1="' + midY.toFixed(1) + '" x2="' + x2.toFixed(1) +
        '" y2="' + midY.toFixed(1) + '"/>');
      [x1, x2].forEach(function (x) {
        o.push('<line class="dim" x1="' + x.toFixed(1) + '" y1="' + (midY - 4).toFixed(1) +
          '" x2="' + x.toFixed(1) + '" y2="' + (midY + 4).toFixed(1) + '"/>');
      });
      o.push(tryLabel((x1 + x2) / 2, midY - 7, fmt(jc.distance)));
    });

    // 端あきと支持点の間隔
    var showEach = seg > 44;
    o.push(dimLine(c.X(0), c.dimY, c.X(positions[0].x), c.dimY,
      showEach ? fmt(margin) : null, 'h'));
    for (var i = 1; i < positions.length; i++) {
      o.push(dimLine(c.X(positions[i - 1].x), c.dimY, c.X(positions[i].x), c.dimY,
        showEach ? fmt(positions[i].x - positions[i - 1].x) : null, 'h'));
    }
    var lastX = positions[positions.length - 1].x;
    o.push(dimLine(c.X(lastX), c.dimY, c.X(length), c.dimY,
      showEach ? fmt(length - lastX) : null, 'h'));
    if (!showEach) {
      o.push(tryLabel((c.X(positions[0].x) + c.X(lastX)) / 2, c.dimY + LABEL_DROP,
        fmt(positions[1].x - positions[0].x) + ' × ' + (positions.length - 1)));
    }

    o.push('</svg>');
    return o.join('');
  }

  var api = {
    fmt: fmt,
    esc: esc,
    offsetSVG: offsetSVG,
    takeupSVG: takeupSVG,
    saddleSVG: saddleSVG,
    supportSVG: supportSVG,
    LABEL_DROP: LABEL_DROP,
    LABEL_ROOM: LABEL_ROOM,
    LABEL_TOP: LABEL_TOP,
    layoutSVG: layoutSVG,
    staggerSVG: staggerSVG
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.HaikanFigures = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
