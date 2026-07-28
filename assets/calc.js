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
   * 前後にずらすか。
   *
   *   ずらし量 = (曲げた先のピッチ − 手前のピッチ × cosθ) ÷ sinθ
   *
   * どの管も曲げ角度は同じまま曲げ位置だけをずらすので、ずらし量を変えれば
   * 曲げた先のピッチを手前と変えられる（ラックから盤へ入るときなど）。
   * 手前と同じピッチにする場合は ピッチ × tan(θ/2) に一致する。
   * ずらし量が負なら、外側の管のほうが手前で曲がる。
   *
   * @param {number} pitch        手前の芯々ピッチ
   * @param {number} angleDeg     曲げ角度
   * @param {number} [pitchAfter] 曲げた先の芯々ピッチ（省略時は手前と同じ）
   */
  function parallelStagger(pitch, angleDeg, pitchAfter) {
    req(pitch, '手前のピッチ'); req(angleDeg, '曲げ角度');
    if (angleDeg <= 0 || angleDeg >= 180) {
      throw new Error('曲げ角度は0〜180°の間で入力してください');
    }
    var after = (pitchAfter === undefined || pitchAfter === null)
      ? pitch : req(pitchAfter, '曲げた先のピッチ');
    var t = angleDeg * DEG;
    return {
      pitch: pitch,
      pitchAfter: after,
      angle: angleDeg,
      stagger: (after - pitch * Math.cos(t)) / Math.sin(t)
    };
  }

  /* ------------------------------------------------------------ 曲げ加工
   * どれも「曲げ半径のない、折れ線としての曲げ」を前提にした式です。
   * 実際のベンダーは曲げ半径のぶんだけ差が出るので、墨は現物合わせで
   * 微調整する前提の目安として使ってください（bendMarks だけは半径を扱います）。 */

  function checkAngle(angleDeg, label) {
    req(angleDeg, label || '曲げ角度');
    if (angleDeg <= 0 || angleDeg >= 90) {
      throw new Error((label || '曲げ角度') + 'は0〜90°の間で入力してください');
    }
    return angleDeg * DEG;
  }

  /**
   * オフセット（振り）。段差 rise を角度 angleDeg の2箇所曲げで越える。
   * 斜辺 = 段差 ÷ sinθ、水平投影 = 段差 ÷ tanθ、
   * 縮み代 = 斜辺 − 水平投影 = 段差 × tan(θ/2)
   * @returns {{rise, angle, travel, run, shrink, multiplier}}
   */
  function offset(rise, angleDeg) {
    req(rise, '段差');
    var t = checkAngle(angleDeg);
    var travel = rise / Math.sin(t);
    var run = rise / Math.tan(t);
    return {
      rise: rise,
      angle: angleDeg,
      travel: travel,        // 曲げと曲げのあいだの管の長さ（墨の間隔）
      run: run,              // 走り方向に進む距離
      shrink: travel - run,  // = rise × tan(θ/2)
      multiplier: 1 / Math.sin(t)
    };
  }

  /**
   * 曲げ半径のある1箇所の曲げ。legA・legB は交点（曲げなければ角になる点）
   * から管端までの外寸。
   * 接点まで = R × tan(θ/2)、円弧長 = R × θ、取り代 = 接点×2 − 円弧長
   * @returns {{tangent, arc, takeup, developed, markStart, markEnd}}
   */
  function bendMarks(legA, legB, radius, angleDeg) {
    req(legA, '外寸A'); req(legB, '外寸B'); req(radius, '曲げ半径');
    req(angleDeg, '曲げ角度');
    if (radius <= 0) throw new Error('曲げ半径は0より大きい値を入力してください');
    if (angleDeg <= 0 || angleDeg >= 180) {
      throw new Error('曲げ角度は0〜180°の間で入力してください');
    }
    var t = angleDeg * DEG;
    var tangent = radius * Math.tan(t / 2);
    var arc = radius * t;
    var takeup = 2 * tangent - arc;
    return {
      legA: legA, legB: legB, radius: radius, angle: angleDeg,
      tangent: tangent,             // 交点から曲げ始めまで
      arc: arc,                     // 曲げている部分の長さ
      takeup: takeup,               // 外寸の合計より短くなる量
      developed: legA + legB - takeup, // 切断長（展開長）
      markStart: legA - tangent,    // 管端Aから曲げ始めの墨まで
      markEnd: legA - tangent + arc, // 管端Aから曲げ終わりの墨まで
      fits: legA >= tangent && legB >= tangent
    };
  }

  /**
   * 内線規程の「曲げの内側の半径は管内径の6倍以上」から最小曲げ半径を出す。
   * @returns {{inner, center, factor}} inner=内側半径 / center=芯の半径
   */
  function minBendRadius(innerDia, outerDia, factor) {
    req(innerDia, '内径'); req(outerDia, '外径');
    var f = (factor === undefined || factor === null) ? 6 : req(factor, '倍率');
    var inner = innerDia * f;
    return { inner: inner, center: inner + outerDia / 2, factor: f };
  }

  /**
   * 3方曲げ（センターサドル）。障害物の高さ height を、中央 2θ・両側 θ で越える。
   * 中央の墨から両側の墨まで = 高さ ÷ sinθ、縮み代 = 高さ × tan(θ/2) × 2
   * @returns {{sideAngle, centerAngle, markSpacing, shrink, run}}
   */
  function saddle3(height, angleDeg) {
    req(height, '障害物の高さ');
    var t = checkAngle(angleDeg, '側面の曲げ角度');
    var spacing = height / Math.sin(t);
    var run = height / Math.tan(t);
    return {
      height: height,
      angle: angleDeg,             // saddle4 と形をそろえる（= sideAngle）
      sideAngle: angleDeg,
      centerAngle: angleDeg * 2,
      markSpacing: spacing,        // 中央の墨から片側の墨まで
      shrink: (spacing - run) * 2, // = 高さ × tan(θ/2) × 2
      run: run
    };
  }

  /**
   * 4方曲げ。障害物の高さ height・幅 width を、両側 θ の4箇所曲げで越える。
   * 上を通る直線部は 幅 + 逃げ×2。縮み代は3方曲げと同じ。
   * @returns {{marks:number[], spans:number[], topRun, shrink, total}}
   */
  function saddle4(height, width, angleDeg, clearance) {
    req(height, '障害物の高さ'); req(width, '障害物の幅');
    var c = (clearance === undefined || clearance === null) ? 0 : req(clearance, '逃げ');
    var t = checkAngle(angleDeg);
    var rise = height / Math.sin(t);
    var topRun = width + c * 2;
    var spans = [rise, topRun, rise];

    // 1つ目の墨を0として、そこからの累計で墨位置を出す
    var marks = [0];
    spans.forEach(function (v) { marks.push(marks[marks.length - 1] + v); });

    return {
      height: height, width: width, angle: angleDeg, clearance: c,
      marks: marks,
      spans: spans,
      topRun: topRun,
      shrink: (rise - height / Math.tan(t)) * 2,
      total: marks[marks.length - 1]
    };
  }

  /**
   * 支持点（サドル）の割り付け。全長 length の管を、上限間隔 maxSpan 以下、
   * 両端から endMargin の位置に支持点を置いて等間隔で割る。
   * layoutEven と同じ「両端に余白を取って等間隔で割る」形だが、
   * 本数を指定するのではなく上限間隔から決める点が違う。
   * @returns {{count, span, positions:number[], ok}}
   */
  function supportLayout(length, maxSpan, endMargin) {
    req(length, '配管の全長'); req(maxSpan, '支持点間隔の上限');
    req(endMargin, '端からの距離');
    if (maxSpan <= 0) throw new Error('支持点間隔の上限は0より大きい値を入力してください');
    if (length <= 0) throw new Error('配管の全長は0より大きい値を入力してください');

    var usable = length - 2 * endMargin;
    if (usable <= 0) {
      // 端あきを取ると場所が残らない短い管。両端1点ずつで見る
      return {
        count: 2, span: Math.max(length, 0),
        positions: [0, length], usable: usable,
        ok: length <= maxSpan
      };
    }

    var count = Math.max(2, Math.ceil(usable / maxSpan) + 1);
    var span = usable / (count - 1);
    var positions = [];
    for (var i = 0; i < count; i++) positions.push(endMargin + i * span);

    return {
      count: count,
      span: span,
      positions: positions,
      usable: usable,
      ok: span <= maxSpan + 1e-9
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
    parallelStagger: parallelStagger,
    offset: offset,
    bendMarks: bendMarks,
    minBendRadius: minBendRadius,
    saddle3: saddle3,
    saddle4: saddle4,
    supportLayout: supportLayout
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.HaikanCalc = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
