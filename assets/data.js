/* 電線管の寸法データ
 * 数値の単位はすべて mm。
 * od = 外径 / id = 内径 / t = 管体の肉厚
 * 被覆管はさらに steelOd = 被覆前の鋼管外径 / coating = 被覆厚（片側）を持ち、
 *   od = steelOd + coating×2、id = steelOd − t×2 − coating×2 の関係になります。
 * 鋼製電線管は JIS C 8305、硬質ビニル電線管は JIS C 8430 の規格値。
 * PF管・CD管は JIS C 8411 に基づく代表値で、メーカーにより数 mm の差があります。
 * ポリエチライニング電線管は JIS C 8380 G形。鋼管部は厚鋼電線管と同寸で、
 * 被覆厚は 0.6mm（公差 ±0.2mm 程度）を代表値として計算しています。
 */
(function (root) {
  'use strict';

  var PIPE_SERIES = [
    {
      id: 'E',
      material: '鋼',
      maxSupportSpan: 2000,
      name: 'ねじなし電線管',
      short: 'E管',
      std: 'JIS C 8305',
      note: '呼び径は外径に近い値。カップリング部は外径より太くなるため、芯々を詰める場合は継手外径で確認してください。',
      sizes: [
        { name: 'E19', nominal: 19, od: 19.1, t: 1.2, id: 16.7 },
        { name: 'E25', nominal: 25, od: 25.4, t: 1.2, id: 23.0 },
        { name: 'E31', nominal: 31, od: 31.8, t: 1.4, id: 29.0 },
        { name: 'E39', nominal: 39, od: 38.1, t: 1.4, id: 35.3 },
        { name: 'E51', nominal: 51, od: 50.8, t: 1.4, id: 48.0 },
        { name: 'E63', nominal: 63, od: 63.5, t: 1.6, id: 60.3 },
        { name: 'E75', nominal: 75, od: 76.2, t: 1.6, id: 73.0 }
      ]
    },
    {
      id: 'C',
      material: '鋼',
      maxSupportSpan: 2000,
      name: '薄鋼電線管',
      short: 'C管',
      std: 'JIS C 8305',
      note: '呼び径は外径に近い値。両端にねじが切られるねじ込み管です。',
      sizes: [
        { name: 'C19', nominal: 19, od: 19.1, t: 1.6, id: 15.9 },
        { name: 'C25', nominal: 25, od: 25.4, t: 1.6, id: 22.2 },
        { name: 'C31', nominal: 31, od: 31.8, t: 1.6, id: 28.6 },
        { name: 'C39', nominal: 39, od: 38.1, t: 1.6, id: 34.9 },
        { name: 'C51', nominal: 51, od: 50.8, t: 1.6, id: 47.6 },
        { name: 'C63', nominal: 63, od: 63.5, t: 2.0, id: 59.5 },
        { name: 'C75', nominal: 75, od: 76.2, t: 2.0, id: 72.2 }
      ]
    },
    {
      id: 'G',
      material: '鋼',
      maxSupportSpan: 2000,
      name: '厚鋼電線管',
      short: 'G管',
      std: 'JIS C 8305',
      note: '呼び径は内径に近い値。同じ呼びでも薄鋼・ねじなしとは外径が異なるので注意。',
      sizes: [
        { name: 'G16', nominal: 16, od: 21.0, t: 2.3, id: 16.4 },
        { name: 'G22', nominal: 22, od: 26.5, t: 2.3, id: 21.9 },
        { name: 'G28', nominal: 28, od: 33.3, t: 2.5, id: 28.3 },
        { name: 'G36', nominal: 36, od: 41.9, t: 2.5, id: 36.9 },
        { name: 'G42', nominal: 42, od: 47.8, t: 2.5, id: 42.8 },
        { name: 'G54', nominal: 54, od: 59.6, t: 2.8, id: 54.0 },
        { name: 'G70', nominal: 70, od: 75.2, t: 2.8, id: 69.6 },
        { name: 'G82', nominal: 82, od: 87.9, t: 2.8, id: 82.3 },
        { name: 'G92', nominal: 92, od: 100.7, t: 3.5, id: 93.7 },
        { name: 'G104', nominal: 104, od: 113.4, t: 3.5, id: 106.4 }
      ]
    },
    {
      id: 'PF',
      material: '樹脂',
      maxSupportSpan: 1500,
      name: '合成樹脂製可とう電線管（PF管）',
      short: 'PF管',
      std: 'JIS C 8411',
      note: '外径は代表値です。単層・複層やメーカーによって数 mm 変わるため、狭い場所ではカタログ値で確認してください。',
      approx: true,
      sizes: [
        { name: 'PF14', nominal: 14, od: 21.5, id: 14.0 },
        { name: 'PF16', nominal: 16, od: 23.0, id: 16.0 },
        { name: 'PF22', nominal: 22, od: 30.5, id: 22.0 },
        { name: 'PF28', nominal: 28, od: 36.9, id: 28.0 },
        { name: 'PF36', nominal: 36, od: 45.5, id: 36.0 },
        { name: 'PF42', nominal: 42, od: 52.0, id: 42.0 }
      ]
    },
    {
      id: 'CD',
      material: '樹脂',
      maxSupportSpan: 1500,
      name: '合成樹脂製可とう電線管（CD管）',
      short: 'CD管',
      std: 'JIS C 8411',
      note: 'コンクリート埋設専用（オレンジ）。外径は代表値です。',
      approx: true,
      sizes: [
        { name: 'CD14', nominal: 14, od: 19.0, id: 14.0 },
        { name: 'CD16', nominal: 16, od: 21.0, id: 16.0 },
        { name: 'CD22', nominal: 22, od: 27.5, id: 22.0 },
        { name: 'CD28', nominal: 28, od: 34.0, id: 28.0 },
        { name: 'CD36', nominal: 36, od: 42.0, id: 36.0 },
        { name: 'CD42', nominal: 42, od: 48.0, id: 42.0 }
      ]
    },
    {
      id: 'VE',
      material: '樹脂',
      maxSupportSpan: 1500,
      name: '硬質ビニル電線管',
      short: 'VE管',
      std: 'JIS C 8430',
      note: '呼び径はおおむね内径ですが、VE16 のみ内径 18mm です（規格上の呼びと実寸がずれる唯一のサイズ）。',
      sizes: [
        { name: 'VE14', nominal: 14, od: 18.0, t: 2.0, id: 14.0 },
        { name: 'VE16', nominal: 16, od: 22.0, t: 2.0, id: 18.0 },
        { name: 'VE22', nominal: 22, od: 26.0, t: 2.0, id: 22.0 },
        { name: 'VE28', nominal: 28, od: 34.0, t: 3.0, id: 28.0 },
        { name: 'VE36', nominal: 36, od: 42.0, t: 3.0, id: 36.0 },
        { name: 'VE42', nominal: 42, od: 48.0, t: 3.0, id: 42.0 },
        { name: 'VE54', nominal: 54, od: 60.0, t: 3.0, id: 54.0 },
        { name: 'VE70', nominal: 70, od: 76.0, t: 3.0, id: 70.0 },
        { name: 'VE82', nominal: 82, od: 89.0, t: 3.5, id: 82.0 },
        { name: 'VE100', nominal: 100, od: 114.0, t: 4.5, id: 105.0 }
      ]
    },
    {
      id: 'PE',
      material: '鋼',
      maxSupportSpan: 2000,
      name: 'ポリエチライニング電線管（ねじ付き）',
      short: 'PE管',
      std: 'JIS C 8380 G形',
      note: '鋼管部は厚鋼電線管（JIS C 8305・G管）と同寸で、その内外面にポリエチレンを被覆したもの。' +
        '呼びも厚鋼電線管と同じ G16〜G104 です。地中埋設や塩害・薬品のある場所に使います。' +
        '外径（仕上外径）と鋼管の外径はパナソニックのカタログ値。' +
        '被覆厚は外面が片側 0.6mm（仕上外径 − 鋼管の外径 ÷ 2）です。' +
        '内径は内面被覆も 0.6mm として計算した代表値なので、通線本数を詰める場合はカタログで確認してください。' +
        'ラインナップと仕上外径はメーカーにより異なります。',
      approx: true,
      approxNote: '内径は代表値',
      // steelOd = 被覆前の鋼管外径 / t = 鋼管の肉厚 / coating = 被覆厚（片側）/ code = 品番
      // od（仕上外径）と steelOd はカタログ値。id = steelOd − t×2 − coating×2 は代表値。
      sizes: [
        { name: 'G16', code: 'DWL16K', nominal: 16, steelOd: 21.0, t: 2.3, coating: 0.6, od: 22.2, id: 15.2 },
        { name: 'G22', code: 'DWL22K', nominal: 22, steelOd: 26.5, t: 2.3, coating: 0.6, od: 27.7, id: 20.7 },
        { name: 'G28', code: 'DWL28K', nominal: 28, steelOd: 33.3, t: 2.5, coating: 0.6, od: 34.5, id: 27.1 },
        { name: 'G36', code: 'DWL36K', nominal: 36, steelOd: 41.9, t: 2.5, coating: 0.6, od: 43.1, id: 35.7 },
        { name: 'G42', code: 'DWL42K', nominal: 42, steelOd: 47.8, t: 2.5, coating: 0.6, od: 49.0, id: 41.6 },
        { name: 'G54', code: 'DWL54K', nominal: 54, steelOd: 59.6, t: 2.8, coating: 0.6, od: 60.8, id: 52.8 },
        { name: 'G70', code: 'DWL70K', nominal: 70, steelOd: 75.2, t: 2.8, coating: 0.6, od: 76.4, id: 68.4 },
        { name: 'G82', code: 'DWL82K', nominal: 82, steelOd: 87.9, t: 2.8, coating: 0.6, od: 89.1, id: 81.1 },
        { name: 'G92', code: 'DWL92K', nominal: 92, steelOd: 100.7, t: 3.5, coating: 0.6, od: 101.9, id: 92.5 },
        { name: 'G104', code: 'DWL04K', nominal: 104, steelOd: 113.4, t: 3.5, coating: 0.6, od: 114.6, id: 105.2 }
      ]
    }
  ];

  /* PE管は呼びが厚鋼電線管と同じ G16… なので、名前だけではシリーズを特定できない。
   * シリーズ込みの一意キー（"PE:G16"）と、重複時にシリーズ名を足した表示ラベルを用意する。 */
  (function assignKeys() {
    var seen = {};
    PIPE_SERIES.forEach(function (s) {
      s.sizes.forEach(function (z) { seen[z.name] = (seen[z.name] || 0) + 1; });
    });
    PIPE_SERIES.forEach(function (s) {
      s.sizes.forEach(function (z) {
        z.key = s.id + ':' + z.name;
        z.label = seen[z.name] > 1 ? s.short + ' ' + z.name : z.name;
      });
    });
  })();

  /** 全シリーズのサイズを 1 本の配列に展開（シリーズ情報付き） */
  function allSizes() {
    var out = [];
    PIPE_SERIES.forEach(function (s) {
      s.sizes.forEach(function (z) {
        out.push({
          series: s.id,
          seriesName: s.name,
          seriesShort: s.short,
          std: s.std,
          approx: !!s.approx,
          material: s.material,
          maxSupportSpan: s.maxSupportSpan,
          key: z.key,
          name: z.name,
          label: z.label,
          code: z.code,
          nominal: z.nominal,
          od: z.od,
          id: z.id,
          t: z.t,
          steelOd: z.steelOd,
          coating: z.coating
        });
      });
    });
    return out;
  }

  /**
   * サイズを 1 件引く。大文字小文字は無視。
   * シリーズ込みのキー（"PE:G16"）でも、呼びだけ（"E25"）でも引ける。
   * 呼びが複数シリーズで重複する場合（G16 など）は、先に定義されたシリーズを返す。
   */
  function findSize(name) {
    if (!name) return null;
    var q = String(name).trim().toUpperCase();
    var all = allSizes();
    var hit = all.filter(function (z) { return z.key.toUpperCase() === q; });
    if (!hit.length) hit = all.filter(function (z) { return z.name.toUpperCase() === q; });
    return hit.length ? hit[0] : null;
  }

  function findSeries(id) {
    var hit = PIPE_SERIES.filter(function (s) { return s.id === id; });
    return hit.length ? hit[0] : null;
  }

  var api = {
    PIPE_SERIES: PIPE_SERIES,
    allSizes: allSizes,
    findSize: findSize,
    findSeries: findSeries
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.HaikanData = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
