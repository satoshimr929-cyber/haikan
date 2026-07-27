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
