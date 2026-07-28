/* 計算ロジックのテスト:  node test/calc.test.js */
'use strict';

var C = require('../assets/calc.js');
var D = require('../assets/data.js');

var pass = 0, fail = 0;

function near(actual, expected, tol) {
  return Math.abs(actual - expected) <= (tol === undefined ? 1e-6 : tol);
}

function check(name, cond) {
  if (cond) { pass++; console.log('  ok   ' + name); }
  else { fail++; console.log('  FAIL ' + name); }
}

function eq(name, actual, expected, tol) {
  if (near(actual, expected, tol)) { pass++; console.log('  ok   ' + name); }
  else { fail++; console.log('  FAIL ' + name + '  期待 ' + expected + ' / 実際 ' + actual); }
}

/** 文字列など、数値以外の完全一致 */
function is(name, actual, expected) {
  if (actual === expected) { pass++; console.log('  ok   ' + name); }
  else { fail++; console.log('  FAIL ' + name + '  期待 "' + expected + '" / 実際 "' + actual + '"'); }
}

function throws(name, fn) {
  try { fn(); fail++; console.log('  FAIL ' + name + '  例外が出ませんでした'); }
  catch (e) { pass++; console.log('  ok   ' + name); }
}

console.log('\ncenterPitch / clearanceFromPitch');
eq('E25同士・あき20 → 芯々45.4', C.centerPitch(25.4, 25.4, 20).pitch, 45.4);
eq('外径違い E25とE51・あき10 → 芯々48.1', C.centerPitch(25.4, 50.8, 10).pitch, 48.1);
eq('芯々から逆算すると元のあきに戻る',
  C.clearanceFromPitch(25.4, 50.8, C.centerPitch(25.4, 50.8, 10).pitch).clearance, 10);
check('芯々が足りなければ干渉と判定',
  C.clearanceFromPitch(25.4, 25.4, 20).interference === true);
check('あきが確保できていれば干渉しない',
  C.clearanceFromPitch(25.4, 25.4, 40).interference === false);
throws('数値以外は例外', function () { C.centerPitch(25.4, NaN, 10); });

console.log('\nmaxCount');
// 有効幅600・端あき30 → 使える幅540。E25(25.4)を最小あき20で並べる
// 540 >= 25.4 + n-1 本ぶんの (25.4+20)=45.4  →  n = floor((540-25.4)/45.4)+1 = 12
eq('600mm・端あき30・E25・最小あき20 → 12本', C.maxCount(600, 25.4, 30, 20), 12);
eq('幅が管1本ぶんちょうど → 1本', C.maxCount(85.4, 25.4, 30, 20), 1);
eq('幅が足りなければ0本', C.maxCount(50, 25.4, 30, 20), 0);

console.log('\nlayoutEven');
var le = C.layoutEven(600, 25.4, 6, 30);
eq('6本のピッチ = (540-25.4)/5', le.pitch, (540 - 25.4) / 5);
eq('あき = ピッチ - 外径', le.gap, le.pitch - 25.4);
eq('1本目の芯 = 端あき + 半径', le.positions[0], 30 + 12.7);
eq('最後の芯は右端から見て対称', 600 - le.positions[5], le.positions[0]);
eq('芯の数は本数と一致', le.positions.length, 6);
check('6本は収まる', le.fits === true);

var one = C.layoutEven(600, 25.4, 1, 30);
eq('1本なら中央', one.positions[0], 300);
check('1本ならピッチなし', one.pitch === null);

check('入りきらない本数は fits=false', C.layoutEven(300, 25.4, 20, 30).fits === false);
throws('本数0は例外', function () { C.layoutEven(600, 25.4, 0, 30); });

console.log('\nrequiredWidth');
var rw = C.requiredWidth(25.4, 6, 75, 30);
eq('必要幅 = 5×75 + 25.4 + 60', rw.width, 5 * 75 + 25.4 + 60);
eq('span は端の管の外面〜外面', rw.span, 5 * 75 + 25.4);
eq('あき = ピッチ - 外径', rw.gap, 75 - 25.4);
eq('layoutEven と往復して一致', C.layoutEven(rw.width, 25.4, 6, 30).pitch, 75, 1e-9);

console.log('\nlayoutMixed');
var lm = C.layoutMixed([{ od: 25.4, label: 'E25' }, { od: 31.8, label: 'E31' },
  { od: 50.8, label: 'E51' }], 20, 30);
eq('1本目の芯', lm.items[0].center, 30 + 12.7);
eq('1→2のピッチ = (25.4+31.8)/2 + 20', lm.pitches[0], (25.4 + 31.8) / 2 + 20);
eq('2→3のピッチ = (31.8+50.8)/2 + 20', lm.pitches[1], (31.8 + 50.8) / 2 + 20);
eq('総幅 = 外径合計 + あき2つ + 端あき2つ',
  lm.totalWidth, 25.4 + 31.8 + 50.8 + 20 * 2 + 30 * 2);
eq('span は端あきを含まない', lm.span, lm.totalWidth - 60);
eq('同径を並べれば centerPitch と同じ',
  C.layoutMixed([{ od: 25.4 }, { od: 25.4 }], 20, 0).pitches[0],
  C.centerPitch(25.4, 25.4, 20).pitch);
throws('空リストは例外', function () { C.layoutMixed([], 20, 30); });

console.log('\nlayoutMixedPitches（ピッチを1本ずつ指定）');
var lp = C.layoutMixedPitches(
  [{ od: 25.4, label: 'E25' }, { od: 31.8, label: 'E31' }, { od: 50.8, label: 'E51' }],
  [60, 100], 30);
eq('1本目の芯 = 端あき + 半径', lp.items[0].center, 30 + 12.7);
eq('2本目の芯 = 1本目 + 1つ目のピッチ', lp.items[1].center, 30 + 12.7 + 60);
eq('3本目の芯 = 2本目 + 2つ目のピッチ', lp.items[2].center, 30 + 12.7 + 60 + 100);
eq('1→2 のあき = 60 − (25.4+31.8)/2', lp.gaps[0], 60 - (25.4 + 31.8) / 2);
eq('2→3 のあき = 100 − (31.8+50.8)/2', lp.gaps[1], 100 - (31.8 + 50.8) / 2);
eq('総幅 = span + 端あき×2', lp.totalWidth, lp.span + 60);
eq('span は端の管の外面〜外面', lp.span, 60 + 100 + 25.4 / 2 + 50.8 / 2);
check('あきが確保できていれば fits=true', lp.fits === true);
check('ピッチは入力どおり返る', lp.pitches[0] === 60 && lp.pitches[1] === 100);

var same = [{ od: 25.4 }, { od: 31.8 }, { od: 50.8 }];
eq('全ピッチを均一にすると layoutMixed と総幅が一致',
  C.layoutMixedPitches(same, [(25.4 + 31.8) / 2 + 20, (31.8 + 50.8) / 2 + 20], 30).totalWidth,
  C.layoutMixed(same, 20, 30).totalWidth, 1e-9);
eq('芯位置も layoutMixed と一致',
  C.layoutMixedPitches(same, [(25.4 + 31.8) / 2 + 20, (31.8 + 50.8) / 2 + 20], 30).items[2].center,
  C.layoutMixed(same, 20, 30).items[2].center, 1e-9);

var tight = C.layoutMixedPitches(same, [20, 100], 30);
check('ピッチが狭すぎれば fits=false', tight.fits === false);
check('干渉しているペアだけ あきが負', tight.gaps[0] < 0 && tight.gaps[1] > 0);

eq('1本ならピッチ不要', C.layoutMixedPitches([{ od: 25.4 }], [], 30).totalWidth, 25.4 + 60);
throws('ピッチの数が合わなければ例外',
  function () { C.layoutMixedPitches(same, [60], 30); });
throws('ピッチが数値でなければ例外',
  function () { C.layoutMixedPitches(same, [60, NaN], 30); });
throws('空リストは例外', function () { C.layoutMixedPitches([], [], 30); });

console.log('\nlayoutMixedSpecs（ピッチ／あきを混ぜて指定）');
var three3 = [{ od: 25.4 }, { od: 31.8 }, { od: 50.8 }];
var half12 = (25.4 + 31.8) / 2;
var half23 = (31.8 + 50.8) / 2;

var sp = C.layoutMixedSpecs(three3,
  [{ kind: 'pitch', value: 60 }, { kind: 'gap', value: 20 }], 30);
eq('ピッチ指定はそのまま使われる', sp.pitches[0], 60);
eq('あき指定は 芯々 = あき + 外径の平均 に直る', sp.pitches[1], 20 + half23);
eq('ピッチ指定側のあきも出る', sp.gaps[0], 60 - half12);
eq('あき指定側のあきは入力どおり', sp.gaps[1], 20);
eq('2本目の芯', sp.items[1].center, 30 + 12.7 + 60);
eq('3本目の芯', sp.items[2].center, 30 + 12.7 + 60 + 20 + half23);

eq('全部ピッチ指定なら layoutMixedPitches と一致',
  C.layoutMixedSpecs(three3, [{ kind: 'pitch', value: 60 }, { kind: 'pitch', value: 100 }], 30).totalWidth,
  C.layoutMixedPitches(three3, [60, 100], 30).totalWidth, 1e-9);
eq('全部あき指定で同じ値なら layoutMixed と一致',
  C.layoutMixedSpecs(three3, [{ kind: 'gap', value: 20 }, { kind: 'gap', value: 20 }], 30).totalWidth,
  C.layoutMixed(three3, 20, 30).totalWidth, 1e-9);
eq('ピッチ指定とあき指定は換算すれば同じ配置',
  C.layoutMixedSpecs(three3, [{ kind: 'gap', value: 20 }, { kind: 'gap', value: 20 }], 30).items[2].center,
  C.layoutMixedSpecs(three3,
    [{ kind: 'pitch', value: 20 + half12 }, { kind: 'pitch', value: 20 + half23 }], 30).items[2].center,
  1e-9);

check('kind の指定がなければピッチ扱い',
  near(C.layoutMixedSpecs(three3, [{ value: 60 }, { value: 100 }], 30).pitches[0], 60, 1e-9));
check('あき指定でマイナスにすれば干渉と判定',
  C.layoutMixedSpecs(three3, [{ kind: 'gap', value: -1 }, { kind: 'gap', value: 20 }], 30).fits === false);
eq('1本なら指定不要', C.layoutMixedSpecs([{ od: 25.4 }], [], 30).totalWidth, 25.4 + 60);
throws('指定の数が合わなければ例外',
  function () { C.layoutMixedSpecs(three3, [{ kind: 'gap', value: 20 }], 30); });
throws('値が数値でなければ例外',
  function () { C.layoutMixedSpecs(three3, [{ kind: 'gap', value: 20 }, { kind: 'gap' }], 30); });
throws('空リストは例外', function () { C.layoutMixedSpecs([], [], 30); });

console.log('\ngapForWidth / layoutMixedInWidth（総幅からの逆算）');
var three = [{ od: 25.4 }, { od: 31.8 }, { od: 50.8 }];
eq('総幅208・端あき30・3本 → あき20', C.gapForWidth(three, 208, 30), 20);
eq('layoutMixed と往復して総幅が一致',
  C.layoutMixed(three, C.gapForWidth(three, 300, 30), 30).totalWidth, 300, 1e-9);
var inw = C.layoutMixedInWidth(three, 300, 30);
eq('逆算した配置の総幅は指定どおり', inw.totalWidth, 300, 1e-9);
eq('逆算したあきが gap に入る', inw.gap, C.gapForWidth(three, 300, 30));
eq('芯々ピッチ = 外径の平均 + あき', inw.pitches[0], (25.4 + 31.8) / 2 + inw.gap, 1e-9);
check('余裕があれば fits=true', inw.fits === true);
check('幅が足りなければ fits=false', C.layoutMixedInWidth(three, 150, 30).fits === false);
eq('幅が足りなければ あきはマイナス',
  C.gapForWidth(three, 150, 30) < 0, true);
throws('1本では逆算できない', function () { C.gapForWidth([{ od: 25.4 }], 300, 30); });
throws('総幅が数値でなければ例外', function () { C.gapForWidth(three, NaN, 30); });

console.log('\nparallelStagger');
eq('90°のずらし量はピッチと同じ', C.parallelStagger(75, 90).stagger, 75, 1e-9);
eq('45°は 75×tan22.5° ≒ 31.07', C.parallelStagger(75, 45).stagger, 75 * Math.tan(Math.PI / 8), 1e-9);
eq('30°は 75×tan15° ≒ 20.10', C.parallelStagger(75, 30).stagger, 75 * Math.tan(Math.PI / 12), 1e-9);
eq('60°は 75×tan30° ≒ 43.30', C.parallelStagger(75, 60).stagger, 75 / Math.sqrt(3), 1e-9);
throws('0°は例外', function () { C.parallelStagger(75, 0); });
throws('180°は例外', function () { C.parallelStagger(75, 180); });

// このずらし量を使えば曲げたあともピッチが保たれる、というのが計算の主旨。
// 曲げ位置を st ずらした2本の管の、曲げた先どうしの垂直距離を実際に出して確かめる。
// 進入方向を (1,0)、曲げ後を (cosθ, sinθ) とすると、法線は (-sinθ, cosθ)。
// 2本の曲げ位置の差ベクトル (st, -p) を法線に射影した長さが曲げ後のピッチになる。
function pitchAfterBend(pitch, angleDeg, stagger) {
  var t = angleDeg * Math.PI / 180;
  return Math.abs(stagger * -Math.sin(t) + -pitch * Math.cos(t));
}
[90, 45, 30, 22.5, 60, 120, 5].forEach(function (a) {
  var st = C.parallelStagger(75, a).stagger;
  eq(a + '°：ずらした後もピッチ75が保たれる', pitchAfterBend(75, a, st), 75, 1e-9);
});
check('ずらさないとピッチが変わってしまう',
  Math.abs(pitchAfterBend(75, 45, 0) - 75) > 1);

console.log('\nparallelStagger（曲げた先のピッチを変える）');
eq('省略すれば手前と同じピッチ', C.parallelStagger(75, 45).pitchAfter, 75);
eq('同じ値を渡しても結果は変わらない',
  C.parallelStagger(75, 45, 75).stagger, C.parallelStagger(75, 45).stagger, 1e-9);
eq('90°なら ずらし量 = 曲げた先のピッチ', C.parallelStagger(75, 90, 100).stagger, 100, 1e-9);
eq('90°では手前のピッチはずらし量に効かない',
  C.parallelStagger(40, 90, 100).stagger, C.parallelStagger(75, 90, 100).stagger, 1e-9);

// 曲げた先のピッチが指定どおりになるかを、実際に法線へ射影して確かめる
[[75, 100, 90], [75, 100, 45], [75, 50, 45], [75, 120, 30], [60, 60, 22.5],
 [75, 40, 120], [100, 30, 60]].forEach(function (c) {
  var st = C.parallelStagger(c[0], c[2], c[1]).stagger;
  eq(c[2] + '°：' + c[0] + '→' + c[1] + ' のピッチになる',
    pitchAfterBend2(c[0], c[2], st), c[1], 1e-9);
});

// 手前ピッチ p1・ずらし量 st で曲げたあとのピッチ（法線 (-sinθ, cosθ) への射影）
function pitchAfterBend2(pitch, angleDeg, stagger) {
  var t = angleDeg * Math.PI / 180;
  return Math.abs(stagger * Math.sin(t) + pitch * Math.cos(t));
}

check('広げるときはずらし量が大きくなる',
  C.parallelStagger(75, 45, 120).stagger > C.parallelStagger(75, 45, 75).stagger);
check('狭めるときはずらし量が小さくなる',
  C.parallelStagger(75, 45, 30).stagger < C.parallelStagger(75, 45, 75).stagger);
check('大きく狭めるとずらし量は負になる（外側が手前で曲がる）',
  C.parallelStagger(75, 45, 30).stagger < 0);
eq('曲げた先が 手前×cos角度 ならずらし量は0',
  C.parallelStagger(75, 60, 75 * Math.cos(Math.PI / 3)).stagger, 0, 1e-9);
throws('曲げた先のピッチが数値でなければ例外',
  function () { C.parallelStagger(75, 45, NaN); });

console.log('\noffset（オフセット・振り）');
var of45 = C.offset(100, 45);
eq('45°の斜辺 = 段差 ÷ sin45', of45.travel, 100 / Math.SQRT1_2 / 2 * 2, 1e-9);
eq('45°の斜辺は段差の1.414倍', of45.travel, 141.42135, 1e-4);
eq('45°の水平投影は段差と同じ', of45.run, 100, 1e-9);
eq('45°の縮み代は段差の0.414倍', of45.shrink, 100 * Math.tan(Math.PI / 8), 1e-9);
eq('倍率 = 1 ÷ sinθ', of45.multiplier, Math.SQRT2, 1e-9);
// 現場の経験則との突き合わせ（30°で1/4、45°で3/8、60°で1/2 に近い）
eq('30°の倍率はちょうど2.0', C.offset(100, 30).multiplier, 2, 1e-9);
eq('30°の縮み代は段差の0.268倍', C.offset(100, 30).shrink / 100, 0.26795, 1e-5);
eq('60°の縮み代は段差の0.577倍', C.offset(100, 60).shrink / 100, 0.57735, 1e-5);
eq('22.5°の倍率は2.613', C.offset(100, 22.5).multiplier, 2.61313, 1e-5);
eq('縮み代 = 斜辺 − 水平投影', of45.shrink, of45.travel - of45.run, 1e-9);
eq('斜辺から段差を逆算すると戻る',
  of45.travel * Math.sin(45 * Math.PI / 180), 100, 1e-9);
check('浅い角度ほど斜辺が長い', C.offset(100, 22.5).travel > C.offset(100, 60).travel);
throws('0°は例外', function () { C.offset(100, 0); });
throws('90°は例外', function () { C.offset(100, 90); });
throws('段差が数値でなければ例外', function () { C.offset(NaN, 45); });

console.log('\nbendMarks（曲げの取り代・切断長）');
var b90 = C.bendMarks(500, 400, 100, 90);
eq('90°の接点までは半径と同じ', b90.tangent, 100, 1e-9);
eq('90°の円弧長 = πR ÷ 2', b90.arc, Math.PI * 100 / 2, 1e-9);
eq('90°の取り代 = R × (2 − π/2)', b90.takeup, 100 * (2 - Math.PI / 2), 1e-9);
eq('90°の取り代は半径の0.4292倍', b90.takeup / 100, 0.42920, 1e-5);
eq('切断長 = 外寸A + 外寸B − 取り代', b90.developed, 500 + 400 - b90.takeup, 1e-9);
eq('曲げ始めの墨 = 外寸A − 接点まで', b90.markStart, 400, 1e-9);
eq('曲げ終わりの墨 = 曲げ始め + 円弧長', b90.markEnd, b90.markStart + b90.arc, 1e-9);
check('外寸が足りていれば fits=true', b90.fits === true);
check('外寸が接点に届かなければ fits=false', C.bendMarks(50, 400, 100, 90).fits === false);
// 角度を0に近づけると曲げがなくなり、取り代も0に近づく
check('角度が浅いほど取り代は小さい',
  C.bendMarks(500, 400, 100, 5).takeup < C.bendMarks(500, 400, 100, 45).takeup);
eq('ごく浅い角度では取り代がほぼ0', C.bendMarks(500, 400, 100, 0.01).takeup, 0, 1e-6);
eq('取り代は半径に比例', C.bendMarks(500, 400, 200, 90).takeup,
  C.bendMarks(500, 400, 100, 90).takeup * 2, 1e-9);
throws('半径0は例外', function () { C.bendMarks(500, 400, 0, 90); });
throws('180°は例外', function () { C.bendMarks(500, 400, 100, 180); });

console.log('\nminBendRadius（最小曲げ半径）');
var e25 = D.findSize('E25');
var mb = C.minBendRadius(e25.id, e25.od);
eq('内側半径 = 内径 × 6', mb.inner, 23.0 * 6);
eq('芯の半径 = 内側半径 + 外径 ÷ 2', mb.center, 23.0 * 6 + 25.4 / 2);
eq('倍率は指定できる', C.minBendRadius(23.0, 25.4, 8).inner, 23.0 * 8);
check('芯の半径は内側半径より大きい', mb.center > mb.inner);

console.log('\nsaddle3 / saddle4（障害物よけ）');
var s3 = C.saddle3(50, 22.5);
eq('中央の角度は側面の2倍', s3.centerAngle, 45);
eq('angle は側面の角度（saddle4 と同じ形）', s3.angle, s3.sideAngle);
check('3方も4方も angle / height / shrink を持つ',
  ['angle', 'height', 'shrink'].every(function (k) {
    return s3[k] !== undefined && C.saddle4(50, 300, 22.5)[k] !== undefined;
  }));
eq('22.5°の墨間隔は高さの2.613倍', s3.markSpacing / 50, 2.61313, 1e-5);
eq('墨間隔 = 高さ ÷ sinθ', s3.markSpacing, 50 / Math.sin(22.5 * Math.PI / 180), 1e-9);
eq('縮み代 = 高さ × tan(θ/2) × 2', s3.shrink, 2 * 50 * Math.tan(11.25 * Math.PI / 180), 1e-9);
eq('45°の3方曲げの縮み代', C.saddle3(100, 45).shrink, 2 * 100 * Math.tan(Math.PI / 8), 1e-9);

var s4 = C.saddle4(50, 300, 22.5, 20);
eq('上を通る直線部 = 幅 + 逃げ×2', s4.topRun, 300 + 40);
eq('墨は4つ', s4.marks.length, 4);
eq('1→2 は 高さ ÷ sinθ', s4.spans[0], 50 / Math.sin(22.5 * Math.PI / 180), 1e-9);
eq('2→3 は上の直線部', s4.spans[1], 340);
eq('3→4 は 1→2 と同じ', s4.spans[2], s4.spans[0], 1e-9);
eq('合計は各区間の和', s4.total, s4.spans[0] + s4.spans[1] + s4.spans[2], 1e-9);
eq('3方曲げと4方曲げで縮み代は同じ',
  C.saddle4(50, 300, 22.5).shrink, C.saddle3(50, 22.5).shrink, 1e-9);
eq('オフセット2つぶんの縮み代と一致',
  C.saddle4(50, 300, 30).shrink, C.offset(50, 30).shrink * 2, 1e-9);
eq('逃げを省くと0扱い', C.saddle4(50, 300, 22.5).topRun, 300);
throws('90°は例外', function () { C.saddle3(50, 90); });
throws('幅が数値でなければ例外', function () { C.saddle4(50, NaN, 22.5); });

console.log('\nsupportLayout（サドル・支持点の割り付け）');
var sp = C.supportLayout(5000, 2000, 300);
// 使える長さ 4400 → 2000以下にするには3区間 → 4点
eq('5m の金属管は4点', sp.count, 4);
eq('実間隔 = (5000 − 600) ÷ 3', sp.span, 4400 / 3, 1e-9);
check('実間隔は上限以下', sp.span <= 2000);
eq('1点目は端から300', sp.positions[0], 300);
eq('最後の点は反対の端から300', 5000 - sp.positions[3], 300, 1e-9);
eq('点の数は count と一致', sp.positions.length, sp.count);
check('収まっていれば ok=true', sp.ok === true);

// 5m では鋼・樹脂とも4点で足りる（樹脂の実間隔 1466.7mm は 1500mm 以内）
eq('5m は樹脂管でも4点', C.supportLayout(5000, 1500, 300).count, 4);
check('5m の樹脂管の実間隔は上限以下', C.supportLayout(5000, 1500, 300).span <= 1500);
// 8m まで伸ばすと差が出る
eq('8m の金属管は5点', C.supportLayout(8000, 2000, 300).count, 5);
eq('8m の樹脂管は6点', C.supportLayout(8000, 1500, 300).count, 6);
check('上限が狭いほうが点は多いか同じ', [3000, 5000, 8000, 12000].every(function (L) {
  return C.supportLayout(L, 1500, 300).count >= C.supportLayout(L, 2000, 300).count;
}));
check('どの長さでも実間隔は上限以下', [1000, 3000, 5000, 8000, 12000, 30000].every(function (L) {
  return [1500, 2000].every(function (S) {
    var r = C.supportLayout(L, S, 300);
    return !r.ok || r.span <= S + 1e-9;
  });
}));

eq('短い管は最低2点', C.supportLayout(1000, 2000, 300).count, 2);
eq('端あきで場所が残らない管も2点', C.supportLayout(500, 2000, 300).count, 2);
check('全長が上限を超える短管は ok=false', C.supportLayout(2500, 2000, 1500).ok === false);

// 同じ条件なら layoutEven（外径0の管を count 本並べる）と芯位置が一致する
var le2 = C.layoutEven(5000, 0, sp.count, 300);
eq('layoutEven と1点目が一致', le2.positions[0], sp.positions[0], 1e-9);
eq('layoutEven と最終点が一致', le2.positions[3], sp.positions[3], 1e-9);
eq('layoutEven と間隔が一致', le2.pitch, sp.span, 1e-9);

throws('上限0は例外', function () { C.supportLayout(5000, 0, 300); });
throws('全長0は例外', function () { C.supportLayout(0, 2000, 300); });

console.log('\njointPositions（管の接続点）');
eq('10m を定尺3.66m で継ぐと2箇所', C.jointPositions(10000, 3660).length, 2);
eq('1つ目は定尺どおり', C.jointPositions(10000, 3660)[0], 3660);
eq('2つ目は定尺の2本目', C.jointPositions(10000, 3660)[1], 7320);
check('全長と同じ位置や外側は入らない',
  C.jointPositions(7320, 3660).every(function (v) { return v > 0 && v < 7320; }));
eq('ちょうど定尺2本ぶんの管は継ぎ1箇所', C.jointPositions(7320, 3660).length, 1);
// 1本目を切って合わせる場合
var jp = C.jointPositions(10000, 3660, 1500);
eq('最初の継ぎをずらせる', jp[0], 1500);
eq('以降は定尺きざみ', jp[1], 1500 + 3660);
eq('ずらすと本数が変わることがある', jp.length, 3);
// 個別追加
var jp2 = C.jointPositions(10000, 3660, null, [500, 9000]);
eq('個別ぶんと合わせて4箇所', jp2.length, 4);
eq('昇順に並ぶ（先頭）', jp2[0], 500);
eq('昇順に並ぶ（末尾）', jp2[3], 9000);
check('昇順が保たれる', jp2.every(function (v, i) { return i === 0 || v > jp2[i - 1]; }));
eq('定尺と重なる個別指定は1つにまとまる',
  C.jointPositions(10000, 3660, null, [3660]).length, 2);
eq('定尺がなければ個別ぶんだけ',
  C.jointPositions(6000, null, null, [1500, 3000]).length, 2);
eq('定尺も個別もなければ空', C.jointPositions(6000, null).length, 0);
eq('範囲外の個別指定は落ちる',
  C.jointPositions(6000, null, null, [-100, 0, 6000, 8000]).length, 0);
throws('全長が数値でなければ例外', function () { C.jointPositions(NaN, 3660); });

console.log('\nsupportPlan（金属管：接続点を避ける）');
// 接続点も両側支持もなければ、従来の supportLayout と同じ
var plain = C.supportPlan({ length: 5000, maxSpan: 2000, endMargin: 300 });
var ref = C.supportLayout(5000, 2000, 300);
eq('接続点なしなら本数は supportLayout と同じ', plain.count, ref.count);
check('接続点なしなら位置も supportLayout と同じ', plain.positions.every(function (p, i) {
  return near(p.x, ref.positions[i], 1e-9);
}));
check('接続点なしなら当たりもなし', plain.clashes.length === 0 && plain.ok === true);

// E25・全長10m・定尺3.66m。等間隔だと 300 / 2725 / 5150 / 7575 / 10000-300
var steel = C.supportPlan({
  length: 10000, maxSpan: 2000, endMargin: 300,
  joints: C.jointPositions(10000, 3660),
  couplingLength: 60, saddleWidth: 25
});
eq('必要なあき = (60 + 25) ÷ 2', steel.clear, 42.5);
check('支持点はすべて上限間隔以内', steel.spans.every(function (v) { return v <= 2000 + 1e-9; }));
check('両側支持は使っていない', steel.supportAtJoints === false);
check('すべて等間隔由来', steel.positions.every(function (p) { return p.kind === 'even'; }));

// 接続点のすぐ上に支持点が来る条件を作って、当たりと逃がしを見る
var hit = C.supportPlan({
  length: 4000, maxSpan: 2000, endMargin: 300,
  joints: [2000], couplingLength: 60, saddleWidth: 25
});
eq('中央の支持点が接続点と重なる', hit.positions[1].x, 2000);
eq('当たりが1件', hit.clashes.length, 1);
eq('当たった相手は接続点2000', hit.clashes[0].joint, 2000);
check('当たっていれば ok=false', hit.ok === false);
check('逃がし先が出る', hit.clashes[0].suggest !== null);
eq('逃がし先は接続点から必要なあきぶん', Math.abs(hit.clashes[0].suggest - 2000), 42.5, 1e-9);
check('逃がし先は接続点と当たらない',
  Math.abs(hit.clashes[0].suggest - 2000) >= hit.clear - 1e-9);
check('逃がしたあとも両隣が上限以内', (function () {
  var s = hit.clashes[0].suggest;
  return (s - hit.positions[0].x) <= 2000 + 1e-9 &&
    (hit.positions[2].x - s) <= 2000 + 1e-9;
})());

// 当たっていない支持点には逃がし先を付けない
check('当たっていなければ suggest は null',
  hit.positions.filter(function (p) { return p.clash === null; })
    .every(function (p) { return p.suggest === null; }));

// 逃がすと上限を超えてしまう場合は提案しない
var tight = C.supportPlan({
  length: 4000, maxSpan: 1000, endMargin: 0,
  joints: [1000], couplingLength: 2000, saddleWidth: 0
});
check('逃がせない場合は suggest が null',
  tight.clashes.length > 0 && tight.clashes[0].suggest === null);

console.log('\nsupportPlan（樹脂管：接続点の両側に支持）');
var resin = C.supportPlan({
  length: 6000, maxSpan: 1500, endMargin: 300,
  joints: [2000, 4000], couplingLength: 60, saddleWidth: 25,
  supportAtJoints: true, jointOffset: 150
});
eq('接続点から支持までの距離は指定どおり', resin.jointOffset, 150);
check('両側支持を使っている', resin.supportAtJoints === true);
check('どの区間も上限以内', resin.spans.every(function (v) { return v <= 1500 + 1e-9; }));
check('当たりはない', resin.clashes.length === 0 && resin.ok === true);
eq('1点目は端あきの位置', resin.positions[0].x, 300);
eq('最終点は反対の端あきの位置', resin.positions[resin.positions.length - 1].x, 5700);
// 各接続点の両側に支持があるか
[2000, 4000].forEach(function (j) {
  check(j + 'mm の接続点の手前側に支持がある', resin.positions.some(function (p) {
    return p.kind === 'joint' && near(p.x, j - resin.jointOffset, 1e-6);
  }));
  check(j + 'mm の接続点の先側に支持がある', resin.positions.some(function (p) {
    return p.kind === 'joint' && near(p.x, j + resin.jointOffset, 1e-6);
  }));
});
// 指定した距離がカップリングに当たるなら、当たらない位置まで広げる
var narrow = C.supportPlan({
  length: 6000, maxSpan: 1500, endMargin: 300,
  joints: [3000], couplingLength: 200, saddleWidth: 50,
  supportAtJoints: true, jointOffset: 10
});
eq('狭すぎる指定は必要なあきまで広がる', narrow.jointOffset, narrow.clear);
eq('その必要なあきは (200 + 50) ÷ 2', narrow.clear, 125);
check('広げた結果カップリングと当たらない', narrow.positions.every(function (p) {
  return Math.abs(p.x - 3000) >= narrow.clear - 1e-9;
}));
check('接続点由来の支持はどれも接続点と当たらない', resin.positions.every(function (p) {
  return [2000, 4000].every(function (j) {
    return Math.abs(p.x - j) >= resin.clear - 1e-9;
  });
}));
check('埋めた支持点は fill として区別される',
  resin.positions.some(function (p) { return p.kind === 'fill'; }));

// 接続点が近すぎると、両側の支持が重なるので1つにまとまる
var close = C.supportPlan({
  length: 6000, maxSpan: 1500, endMargin: 300,
  joints: [3000, 3050], couplingLength: 60, saddleWidth: 25,
  supportAtJoints: true
});
check('近い接続点でも支持が重ならない', close.positions.every(function (p, i) {
  return i === 0 || p.x - close.positions[i - 1].x > 1;
}));
check('近い接続点でも上限以内', close.spans.every(function (v) { return v <= 1500 + 1e-9; }));

// 接続点が端に寄っていても端あきの内側に収まる
var edge = C.supportPlan({
  length: 6000, maxSpan: 1500, endMargin: 300,
  joints: [100, 5950], couplingLength: 60, saddleWidth: 25,
  supportAtJoints: true
});
check('端に寄った接続点でも端あきの内側', edge.positions.every(function (p) {
  return p.x >= 300 - 1e-9 && p.x <= 5700 + 1e-9;
}));

// 両側支持を切れば、接続点があっても等間隔のまま
var off2 = C.supportPlan({
  length: 6000, maxSpan: 1500, endMargin: 300,
  joints: [2000, 4000], couplingLength: 60, saddleWidth: 25,
  supportAtJoints: false
});
check('両側支持を切ると等間隔由来だけになる',
  off2.positions.every(function (p) { return p.kind === 'even'; }));
eq('両側支持を切ると supportLayout と同じ本数',
  off2.count, C.supportLayout(6000, 1500, 300).count);

throws('上限0は例外',
  function () { C.supportPlan({ length: 5000, maxSpan: 0, endMargin: 300 }); });
throws('全長が数値でなければ例外',
  function () { C.supportPlan({ length: NaN, maxSpan: 2000, endMargin: 300 }); });

console.log('\n支持点の基準（寸法データ側）');
check('全シリーズに材質と支持点間隔の上限がある', D.PIPE_SERIES.every(function (s) {
  return (s.material === '鋼' || s.material === '樹脂') && s.maxSupportSpan > 0;
}));
check('鋼は2000mm、樹脂は1500mm', D.PIPE_SERIES.every(function (s) {
  return s.maxSupportSpan === (s.material === '鋼' ? 2000 : 1500);
}));
is('E管は鋼', D.findSize('E25').material, '鋼');
is('PF管は樹脂', D.findSize('PF22').material, '樹脂');
is('PE管は鋼', D.findSize('PE:G28').material, '鋼');
eq('VE管の上限は1500', D.findSize('VE22').maxSupportSpan, 1500);

console.log('\n寸法データ');
var sizes = D.allSizes();
check('サイズが1件以上ある', sizes.length > 0);
check('外径 > 内径 がすべてで成り立つ', sizes.every(function (z) { return z.od > z.id; }));
check('肉厚がある管は 内径 = 外径 − 肉厚×2 − 被覆厚×4', sizes.every(function (z) {
  return z.t === undefined || near(z.id, z.od - z.t * 2 - (z.coating || 0) * 4, 0.05);
}));
check('被覆管は 外径 = 鋼管外径 + 被覆厚×2', sizes.every(function (z) {
  return z.steelOd === undefined || near(z.od, z.steelOd + z.coating * 2, 0.05);
}));
check('シリーズ込みのキーは重複していない',
  new Set(sizes.map(function (z) { return z.key; })).size === sizes.length);
check('呼びが重複するサイズは表示ラベルにシリーズ名が付く', sizes.every(function (z) {
  var dup = sizes.filter(function (o) { return o.name === z.name; }).length > 1;
  return dup ? z.label !== z.name && z.label.indexOf(z.name) >= 0 : z.label === z.name;
}));
check('各シリーズが外径の昇順', D.PIPE_SERIES.every(function (s) {
  return s.sizes.every(function (z, i) { return i === 0 || z.od > s.sizes[i - 1].od; });
}));
eq('findSize("E25") の外径', D.findSize('E25').od, 25.4);
// ポリエチライニング電線管（JIS C 8380 G形）は鋼管部が厚鋼電線管と同寸。
// 呼び / 品番 / 仕上外径 / 鋼管の外径 はパナソニックのカタログ値。
var PE = D.findSeries('PE');
var CATALOG = [
  ['G16', 'DWL16K', 22.2, 21.0], ['G22', 'DWL22K', 27.7, 26.5],
  ['G28', 'DWL28K', 34.5, 33.3], ['G36', 'DWL36K', 43.1, 41.9],
  ['G42', 'DWL42K', 49.0, 47.8], ['G54', 'DWL54K', 60.8, 59.6],
  ['G70', 'DWL70K', 76.4, 75.2], ['G82', 'DWL82K', 89.1, 87.9],
  ['G92', 'DWL92K', 101.9, 100.7], ['G104', 'DWL04K', 114.6, 113.4]
];
eq('カタログと同じサイズ数', PE.sizes.length, CATALOG.length);
CATALOG.forEach(function (row, i) {
  var z = PE.sizes[i];
  check('カタログ ' + row[0] + '：呼び・品番・仕上外径・鋼管外径が一致',
    z.name === row[0] && z.code === row[1] &&
    near(z.od, row[2], 1e-9) && near(z.steelOd, row[3], 1e-9));
});
check('PE管の鋼管外径は G管の外径とすべて一致', PE.sizes.every(function (z) {
  return near(z.steelOd, D.findSize('G:' + z.name).od, 1e-9);
}));
check('PE管の肉厚は G管の肉厚とすべて一致', PE.sizes.every(function (z) {
  return near(z.t, D.findSize('G:' + z.name).t, 1e-9);
}));
check('外面被覆はどのサイズも片側0.6mm', PE.sizes.every(function (z) {
  return near((z.od - z.steelOd) / 2, 0.6, 1e-9);
}));
check('被覆のぶん PE管は同じ呼びの G管より外径が大きい', PE.sizes.every(function (z) {
  return z.od > D.findSize('G:' + z.name).od;
}));
check('PE管は内径が代表値である旨の印が付いている',
  PE.approx === true && PE.approxNote === '内径は代表値');

console.log('\n呼びが重複するサイズの引き方');
eq('"G:G28" は G管の 33.3', D.findSize('G:G28').od, 33.3);
eq('"PE:G28" は PE管の 34.5', D.findSize('PE:G28').od, 34.5);
eq('呼びだけの "G28" は先に定義された G管', D.findSize('G28').od, 33.3);
eq('キーは小文字でも引ける', D.findSize('pe:g28').od, 34.5);
is('PE管の表示ラベルはシリーズ名付き', D.findSize('PE:G28').label, 'PE管 G28');
is('G管の表示ラベルもシリーズ名付き', D.findSize('G:G28').label, 'G管 G28');
is('重複しない呼びのラベルはそのまま', D.findSize('E25').label, 'E25');
is('PE管の品番が引ける', D.findSize('PE:G28').code, 'DWL28K');
eq('小文字でも引ける', D.findSize('e25').od, 25.4);
check('無いサイズは null', D.findSize('X99') === null);

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
