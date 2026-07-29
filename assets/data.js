/* 電線管の寸法データ
 * 数値の単位はすべて mm。
 * od = 外径 / id = 内径 / t = 管体の肉厚
 * 被覆管はさらに steelOd = 被覆前の鋼管外径 / coating = 被覆厚（片側）を持ち、
 *   od = steelOd + coating×2、id = steelOd − t×2 − coating×2 の関係になります。
 * 鋼製電線管は JIS C 8305、硬質ビニル電線管は JIS C 8430 の規格値。
 * PF管・CD管は JIS C 8411 に基づく代表値で、メーカーにより数 mm の差があります。
 * ポリエチライニング電線管は JIS C 8380 G形。鋼管部は厚鋼電線管と同寸で、
 * 被覆厚は 0.6mm（公差 ±0.2mm 程度）を代表値として計算しています。
 *
 * 施工まわりの値（公共建築工事標準仕様書 電気設備工事編）:
 *   maxSupportSpan = 支持点間隔の上限。金属管 2000 / 合成樹脂管 1500。
 *     （金属製可とう電線管は 1000 だが、この表には管種として持っていません）
 *   jointSupport   = 管相互の接続点が支持の対象か。金属管は明記がなく false、
 *     合成樹脂管は対象なので true（PF/CD管は「接続点の両側」）。
 *   stockLength    = 定尺。鋼製電線管 3660 / 硬質ビニル電線管 4000。
 *     PF管・CD管はコイル巻きで定尺がないため null。
 *   connection     = 管と継手のつなぎ方。
 *     'ねじなし'（E管・止めねじで締める）/ 'ねじ込み'（C管・G管・PE管）/
 *     'コネクタ'（PF管・CD管）/ '差込接着'（VE管）。
 *     B形・A形ノーマルベンドの区別はねじなし管だけの話なので、
 *     この値で画面の選択肢を絞ります。
 *
 * ノーマルベンド（90°の既製継手）の寸法は JIS C 8330:1999 付図1・付図2。
 * 下の NORMAL_BEND を参照。
 */
(function (root) {
  'use strict';

  var PIPE_SERIES = [
    {
      id: 'E',
      stockLength: 3660,
      jointSupport: false,
      material: '鋼',
      maxSupportSpan: 2000,
      name: 'ねじなし電線管',
      short: 'E管',
      connection: 'ねじなし',
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
      stockLength: 3660,
      jointSupport: false,
      material: '鋼',
      maxSupportSpan: 2000,
      name: '薄鋼電線管',
      short: 'C管',
      connection: 'ねじ込み',
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
      stockLength: 3660,
      jointSupport: false,
      material: '鋼',
      maxSupportSpan: 2000,
      name: '厚鋼電線管',
      short: 'G管',
      connection: 'ねじ込み',
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
      stockLength: null,
      jointSupport: true,
      material: '樹脂',
      maxSupportSpan: 1500,
      name: '合成樹脂製可とう電線管（PF管）',
      short: 'PF管',
      connection: 'コネクタ',
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
      stockLength: null,
      jointSupport: true,
      material: '樹脂',
      maxSupportSpan: 1500,
      name: '合成樹脂製可とう電線管（CD管）',
      short: 'CD管',
      connection: 'コネクタ',
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
      stockLength: 4000,
      jointSupport: true,
      material: '樹脂',
      maxSupportSpan: 1500,
      name: '硬質ビニル電線管',
      short: 'VE管',
      connection: '差込接着',
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
      stockLength: 3660,
      jointSupport: false,
      material: '鋼',
      maxSupportSpan: 2000,
      name: 'ポリエチライニング電線管（ねじ付き）',
      short: 'PE管',
      connection: 'ねじ込み',
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

  /* ノーマルベンド（90°の既製継手）の寸法。JIS C 8330:1999 付図1・付図2。
   *   r = 管の芯（中心線）の曲げ半径 / a = 曲げ終わりから管端までの直線部
   *   l = 面間寸法。全サイズで l = r + a が成立する
   *   tol = JIS の公差（r・l それぞれに同値）
   * 薄鋼とねじなしは外径が同じなので、呼びが同じなら寸法も同じ。
   * E管の r・l は パナソニック DS03xx（ねじなしノーマルベンド）のカタログ値と
   * 全サイズ一致することを確認済み。
   *
   * 呼び19について。kikakurui.com で読んだ JIS C 8330 表1 のノーマルベンドの呼びは
   * C25〜C75 / E25〜E75 / G16〜G104 で 19 を含まない。しかしパナソニックは
   * 「JIS C8330／ねじなしノーマルベンド／呼び E19」として DS0319 を出しており、
   * 止めねじも2本（呼び25と同じ）で B形の並びに乗っている。ここは実在する製品の
   * カタログ値（r=90・l=135）を採る。
   * ただし 外山電気の TCNA19（A形）は r=70・l=120 と別寸法なので、
   * varies:true を付けて「製品によって寸法が違う」旨を画面に出す。
   * C19 は A形を含めても製品を確認できていないため、キーごと持たない。
   *
   * 注意：内線規程 3110-8 の「内側の半径は管内径の6倍以上」は
   * 「金属管を曲げる場合」＝現場でのベンダー曲げに対する規定であり、
   * JIS規格品である既製継手には適用されない。実際、下の値はどれも6倍に達しない。 */
  var NORMAL_BEND = {
    // パナソニック DS0319。外山 TCNA19（A形）は r=70・l=120 と別寸法
    'E:E19': { r: 90, a: 45, l: 135, tol: null, varies: true },
    'E:E25': { r: 120, a: 50, l: 170, tol: 6 },
    'E:E31': { r: 150, a: 60, l: 210, tol: 7 },
    'E:E39': { r: 180, a: 75, l: 255, tol: 9 },
    'E:E51': { r: 230, a: 100, l: 330, tol: 11 },
    'E:E63': { r: 290, a: 120, l: 410, tol: 14 },
    'E:E75': { r: 350, a: 150, l: 500, tol: 17 },

    // C19 は製品がないため、あえて登録しない
    'C:C25': { r: 120, a: 50, l: 170, tol: 6 },
    'C:C31': { r: 150, a: 60, l: 210, tol: 7 },
    'C:C39': { r: 180, a: 75, l: 255, tol: 9 },
    'C:C51': { r: 230, a: 100, l: 330, tol: 11 },
    'C:C63': { r: 290, a: 120, l: 410, tol: 14 },
    'C:C75': { r: 350, a: 150, l: 500, tol: 17 },

    'G:G16': { r: 90, a: 60, l: 150, tol: 4 },
    'G:G22': { r: 110, a: 70, l: 180, tol: 5 },
    'G:G28': { r: 140, a: 75, l: 215, tol: 7 },
    'G:G36': { r: 170, a: 80, l: 250, tol: 8 },
    'G:G42': { r: 210, a: 85, l: 295, tol: 10 },
    'G:G54': { r: 235, a: 110, l: 345, tol: 11 },
    'G:G70': { r: 275, a: 150, l: 425, tol: 13 },
    'G:G82': { r: 310, a: 200, l: 510, tol: 15 },
    'G:G92': { r: 355, a: 220, l: 575, tol: 17 },
    'G:G104': { r: 395, a: 250, l: 645, tol: 19 }
  };

  /* ねじなし電線管（E管）の継手に、管がどれだけ入るか。パナソニック製の標準値。
   *   socket        = B形ノーマルベンドの受口の深さ（本体に直接差し込む）
   *   coupling      = 標準カップリングへの差し込み深さ（管1本あたり）
   *   couplingLength= カップリングの全長。ほぼ coupling × 2
   * A形ノーマルベンドは受口が無く、別途カップリングでつなぐので coupling を使う。
   * ねじなしコネクタ（ボックス接続用）の差し込み深さも coupling とほぼ同じ
   * （メーカー設計により1〜2mm浅いことがある）。
   *
   * 薄鋼・厚鋼・ポリエチライニングはねじ込み接続なので、この表は持っていない。
   *
   * socket はパナソニック DS03xx のカタログ図の ℓ（受口の深さ）。
   * 直線部 a（= l − r）より必ず浅い＝管は曲げ始めまでは届かない。 */
  var FITTING_INSERT = {
    'E:E19': { socket: 30, coupling: 28.5, couplingLength: 57 },
    'E:E25': { socket: 34, coupling: 33.0, couplingLength: 66 },
    'E:E31': { socket: 39, coupling: 38.0, couplingLength: 76 },
    'E:E39': { socket: 44, coupling: 43.0, couplingLength: 86 },
    'E:E51': { socket: 49, coupling: 47.5, couplingLength: 95 },
    'E:E63': { socket: 55, coupling: 52.5, couplingLength: 105 },
    'E:E75': { socket: 60, coupling: 57.0, couplingLength: 114 }
  };

  /* ポリエチライニング電線管は鋼管部が厚鋼電線管と同じなので、厚鋼用の値を当てる。
   * ライニング用の専用品の寸法は未確認なので、代表値として印を付けておく。 */
  (function fillLinedBend() {
    Object.keys(NORMAL_BEND).forEach(function (k) {
      if (k.indexOf('G:') !== 0) return;
      var v = NORMAL_BEND[k];
      NORMAL_BEND['PE:' + k.slice(2)] = {
        r: v.r, a: v.a, l: v.l, tol: v.tol, jis: v.jis, approx: true
      };
    });
  })();

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
          connection: s.connection,
          approx: !!s.approx,
          material: s.material,
          maxSupportSpan: s.maxSupportSpan,
          stockLength: s.stockLength,
          jointSupport: s.jointSupport,
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

  /**
   * その呼びのノーマルベンドを引く。無ければ null（既製品が存在しない呼び）。
   * @returns {{r,a,l,tol,jis,approx}|null} r は管の芯の曲げ半径
   */
  function findNormalBend(name) {
    var size = findSize(name);
    if (!size) return null;
    return NORMAL_BEND[size.key] || null;
  }

  /**
   * その呼びの継手への差し込み寸法を引く。ねじ込み接続の管には無いので null。
   * @returns {{socket, coupling, couplingLength}|null}
   */
  function findFittingInsert(name) {
    var size = findSize(name);
    if (!size) return null;
    return FITTING_INSERT[size.key] || null;
  }

  var api = {
    PIPE_SERIES: PIPE_SERIES,
    NORMAL_BEND: NORMAL_BEND,
    FITTING_INSERT: FITTING_INSERT,
    allSizes: allSizes,
    findSize: findSize,
    findSeries: findSeries,
    findNormalBend: findNormalBend,
    findFittingInsert: findFittingInsert
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.HaikanData = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
