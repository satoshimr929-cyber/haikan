/* 配管ピッチ・割り付けの計算ロジック（純関数のみ）
 * 単位はすべて mm、角度は度。
 * UI から独立させてあるので Node からもそのまま require できます。
 */
(function (root) {
  'use strict';

  var DEG = Math.PI / 180;

  function isNum(v) {
    return typeof v === 'number' && isFinite(v);
  }

  function req(v, label) {
    if (!isNum(v)) throw new Error(label + ' に数値を入力してください');
    return v;
  }

  /**
   * 2本の配管の芯々距離。
   * 外径の半分ずつ＋管と管のあき（clearance）。
   * @returns {{pitch:number, clearance:number, od1:number, od2:number}}
   */
  function centerPitch(od1, od2, clearance) {
    req(od1, '外径1'); req(od2, '外径2'); req(clearance, 'あき');
    return {
      od1: od1,
      od2: od2,
      clearance: clearance,
      pitch: (od1 + od2) / 2 + clearance
    };
  }

  /**
   * 芯々距離から管と管のあきを逆算。負の値は干渉を意味する。
   * @returns {{clearance:number, interference:boolean}}
   */
  function clearanceFromPitch(od1, od2, pitch) {
    req(od1, '外径1'); req(od2, '外径2'); req(pitch, '芯々距離');
    var c = pitch - (od1 + od2) / 2;
    return { clearance: c, interference: c < 0 };
  }

  /**
   * 有効幅に同一径の管が最大何本入るか。
   * @param {number} width  取り付け可能な有効幅
   * @param {number} od     管の外径
   * @param {number} margin 端から管の外面までの最小あき（両端）
   * @param {number} minGap 管と管の最小あき
   */
  function maxCount(width, od, margin, minGap) {
    req(width, '有効幅'); req(od, '外径');
    req(margin, '端あき'); req(minGap, '管間あき');
    var usable = width - 2 * margin;
    if (usable < od) return 0;
    return Math.floor((usable - od) / (od + minGap)) + 1;
  }

  /**
   * 有効幅に count 本を均等割り付けしたときの芯位置。
   * 端あき margin を確保し、残りを等ピッチで割る。
   * @returns {{count, pitch, gap, positions:number[], margin, usable, fits:boolean}}
   */
  function layoutEven(width, od, count, margin) {
    req(width, '有効幅'); req(od, '外径'); req(margin, '端あき');
    if (!isNum(count) || count < 1) throw new Error('本数は1以上で入力してください');
    count = Math.floor(count);

    var usable = width - 2 * margin;
    var positions = [];
    var pitch = null;
    var gap = null;

    if (count === 1) {
      positions.push(width / 2);
    } else {
      pitch = (usable - od) / (count - 1);
      gap = pitch - od;
      for (var i = 0; i < count; i++) {
        positions.push(margin + od / 2 + i * pitch);
      }
    }

    return {
      count: count,
      pitch: pitch,
      gap: gap,
      positions: positions,
      margin: margin,
      usable: usable,
      fits: usable >= od && (count === 1 || gap >= 0)
    };
  }

  /**
   * ピッチを指定して count 本並べたときに必要な幅。
   * @returns {{width, span, positions:number[], gap:number}}
   */
  function requiredWidth(od, count, pitch, margin) {
    req(od, '外径'); req(pitch, 'ピッチ'); req(margin, '端あき');
    if (!isNum(count) || count < 1) throw new Error('本数は1以上で入力してください');
    count = Math.floor(count);

    var span = (count - 1) * pitch + od; // 端の管の外面から外面まで
    var positions = [];
    for (var i = 0; i < count; i++) positions.push(margin + od / 2 + i * pitch);

    return {
      width: span + 2 * margin,
      span: span,
      positions: positions,
      gap: pitch - od
    };
  }

  /**
   * 外径の違う管を左から順に、一定のあきで並べる。
   * @param {Array<{od:number,label?:string}>} pipes
   * @param {number} gap    管と管のあき
   * @param {number} margin 端あき
   * @returns {{items:Array, totalWidth:number, span:number, pitches:number[]}}
   */
  function layoutMixed(pipes, gap, margin) {
    if (!Array.isArray(pipes) || pipes.length === 0) {
      throw new Error('配管を1本以上追加してください');
    }
    req(gap, '管間あき'); req(margin, '端あき');

    var x = margin;
    var items = [];
    pipes.forEach(function (p, i) {
      req(p.od, (i + 1) + '本目の外径');
      items.push({
        label: p.label || String(i + 1),
        od: p.od,
        left: x,
        center: x + p.od / 2,
        right: x + p.od
      });
      x += p.od + gap;
    });

    var span = items[items.length - 1].right - items[0].left;
    var pitches = [];
    for (var i = 1; i < items.length; i++) {
      pitches.push(items[i].center - items[i - 1].center);
    }

    return {
      items: items,
      pitches: pitches,
      span: span,
      totalWidth: span + 2 * margin
    };
  }

  /**
   * 隣り合う管の芯々ピッチを1つずつ指定して並べる。
   * ピッチが決まっている既設配管に合わせるときや、ピッチが不揃いな盤内で使う。
   * @param {Array<{od:number,label?:string}>} pipes
   * @param {number[]} pitches 芯々ピッチ（pipes.length − 1 個）
   * @param {number} margin    端あき
   * @returns {{items:Array, pitches:number[], gaps:number[], span:number, totalWidth:number, fits:boolean}}
   */
  function layoutMixedPitches(pipes, pitches, margin) {
    if (!Array.isArray(pipes) || pipes.length === 0) {
      throw new Error('配管を1本以上追加してください');
    }
    req(margin, '端あき');
    if (!Array.isArray(pitches) || pitches.length !== pipes.length - 1) {
      throw new Error('ピッチの数が配管の本数と合っていません');
    }

    var items = [];
    var center = margin + req(pipes[0].od, '1本目の外径') / 2;
    var push = function (p, i, c) {
      items.push({
        label: p.label || String(i + 1),
        od: p.od,
        left: c - p.od / 2,
        center: c,
        right: c + p.od / 2
      });
    };
    push(pipes[0], 0, center);

    for (var i = 1; i < pipes.length; i++) {
      req(pipes[i].od, (i + 1) + '本目の外径');
      req(pitches[i - 1], i + '→' + (i + 1) + ' のピッチ');
      center += pitches[i - 1];
      push(pipes[i], i, center);
    }

    // 各ピッチから、その2本の管のあきを出す（負なら干渉）
    var gaps = pitches.map(function (p, i) {
      return p - (pipes[i].od + pipes[i + 1].od) / 2;
    });

    var span = items[items.length - 1].right - items[0].left;
    return {
      items: items,
      pitches: pitches.slice(),
      gaps: gaps,
      span: span,
      totalWidth: span + 2 * margin,
      fits: gaps.every(function (g) { return g >= 0; })
    };
  }

  /**
   * 隣り合う管ごとに「芯々ピッチ」か「あき」かを選んで指定して並べる。
   * 図面で芯々が決まっている箇所と、あきだけ決まっている箇所を混ぜて入力できる。
   * @param {Array<{od:number,label?:string}>} pipes
   * @param {Array<{kind:'pitch'|'gap', value:number}>} specs 指定（pipes.length − 1 個）
   * @param {number} margin 端あき
   * @returns layoutMixedPitches と同じ形
   */
  function layoutMixedSpecs(pipes, specs, margin) {
    if (!Array.isArray(pipes) || pipes.length === 0) {
      throw new Error('配管を1本以上追加してください');
    }
    if (!Array.isArray(specs) || specs.length !== pipes.length - 1) {
      throw new Error('指定の数が配管の本数と合っていません');
    }

    var pitches = specs.map(function (s, i) {
      var kind = s && s.kind === 'gap' ? 'gap' : 'pitch';
      var label = (i + 1) + '→' + (i + 2) + ' の' + (kind === 'gap' ? 'あき' : 'ピッチ');
      var v = req(s && s.value, label);
      if (kind !== 'gap') return v;
      // あき指定なら、両側の半径ぶんを足して芯々ピッチに直す
      return v + (req(pipes[i].od, (i + 1) + '本目の外径') +
        req(pipes[i + 1].od, (i + 2) + '本目の外径')) / 2;
    });

    return layoutMixedPitches(pipes, pitches, margin);
  }

  /**
   * 総幅から管と管のあきを逆算する。
   * 決まった幅の中に外径の違う管を等間隔で収めたいときに使う。
   * @param {Array<{od:number,label?:string}>} pipes
   * @param {number} totalWidth 端あきを含む総幅
   * @param {number} margin     端あき
   * @returns {number} 管と管のあき（負なら収まらない）
   */
  function gapForWidth(pipes, totalWidth, margin) {
    if (!Array.isArray(pipes) || pipes.length < 2) {
      throw new Error('あきを逆算するには配管を2本以上並べてください');
    }
    req(totalWidth, '総幅'); req(margin, '端あき');
    var sum = pipes.reduce(function (acc, p, i) {
      return acc + req(p.od, (i + 1) + '本目の外径');
    }, 0);
    return (totalWidth - 2 * margin - sum) / (pipes.length - 1);
  }

  /**
   * 総幅を指定して外径の違う管を等間隔に割り付ける。
   * 戻り値は layoutMixed と同じ形に gap / fits を足したもの。
   */
  function layoutMixedInWidth(pipes, totalWidth, margin) {
    var gap = gapForWidth(pipes, totalWidth, margin);
    var out = layoutMixed(pipes, gap, margin);
    out.gap = gap;
    out.fits = gap >= 0;
    return out;
  }

  /**
   * 並行して走る配管群を同じ角度で曲げるとき、隣の管の曲げ位置をどれだけ
   * 前後にずらすか（芯々ピッチ × tan(θ/2)）。
   * 90°なら ずらし量 = ピッチ そのものになる。
   */
  function parallelStagger(pitch, angleDeg) {
    req(pitch, 'ピッチ'); req(angleDeg, '曲げ角度');
    if (angleDeg <= 0 || angleDeg >= 180) {
      throw new Error('曲げ角度は0〜180°の間で入力してください');
    }
    return {
      pitch: pitch,
      angle: angleDeg,
      stagger: pitch * Math.tan((angleDeg / 2) * DEG)
    };
  }

  var api = {
    centerPitch: centerPitch,
    clearanceFromPitch: clearanceFromPitch,
    maxCount: maxCount,
    layoutEven: layoutEven,
    requiredWidth: requiredWidth,
    layoutMixed: layoutMixed,
    layoutMixedPitches: layoutMixedPitches,
    layoutMixedSpecs: layoutMixedSpecs,
    gapForWidth: gapForWidth,
    layoutMixedInWidth: layoutMixedInWidth,
    parallelStagger: parallelStagger
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.HaikanCalc = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
