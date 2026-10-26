/* ============================================================
   mount.js — 底部磁吸快拆底座
   ------------------------------------------------------------
   真机底面这块是「磁吸快拆」接口：一块金属底板 + 4 颗磁铁 + 一圈磁吸环，
   两侧各一道 L 形爪轨卡进转接座，后端一个释放推钮，中间两颗定位销。
     · 底板：1.00 × 0.52，厚 0.020，四角 R0.05，底面倒角
     · 磁铁：4 颗 Ø0.112 嵌在底板开的沉孔里，略低于底平面
     · 磁吸环：中心一圈 Ø0.38 的磁环 + 圆台中心座
     · 双爪：左右各一条 L 形卡爪（立筋 + 内翻边），卡进快拆座的滑槽
     · 推钮：后端一颗带防滑纹的深灰滑块，按下才能解锁
     · 硅胶垫：顶面一圈橡胶垫，压在机身底部开口的缝里
   底板顶面（-0.427）藏在机身底部开口内，底面 -0.451 略微凸出机身。
   ============================================================ */

import * as THREE from 'three';

export default function build(env) {
  const { kit, detail } = env;
  const g = new THREE.Group();

  /* ---------- 0. 基准与材质 ---------- */
  const BW = 1.00, BD = 0.52;       // 底板 x × z = slot 尺寸
  const YT = -0.427;                // 底板顶面
  const TILT = Math.PI / 2;         // plate 默认朝 +Z，转 +90° 后朝下（-Y）

  const matMetal = kit.mat('metal', { color: 0xb7bec6, roughness: 0.34, metalness: 0.8 });
  const matSteel = kit.mat('steel', { color: 0xd2d8de, roughness: 0.24, metalness: 0.92 });
  const matMagnet = kit.mat('magnet', { color: 0x33383e });
  const matDeep = kit.mat('bodyDeep');
  const matLite = kit.mat('bodyLite');
  const matRubber = kit.mat('rubber', { color: 0x121518, roughness: 0.92 });

  /* ---------- 1. 底板（4 个磁铁沉孔） ---------- */
  const magnetPos = [
    [0.335, 0.155], [-0.335, 0.155], [0.335, -0.155], [-0.335, -0.155],
  ];
  const basePlate = detail.parts.plate({
    w: BW - 0.004, h: BD - 0.004, r: 0.050,
    holes: magnetPos.map(([mx, mz]) => detail.parts.circlePath(0.058, mx, mz)),
    depth: 0.020, bevel: 0.002,
  }, matMetal);
  basePlate.rotation.x = TILT;
  basePlate.position.set(0, YT - 0.002, 0);   // 世界 y：顶 -0.427、底 -0.451
  g.add(basePlate);

  /* ---------- 2. 四颗磁铁 ---------- */
  // 每颗磁铁比沉孔低 0.001，从底下看是 4 个暗钢色的圆盘
  for (const [mx, mz] of magnetPos) {
    const mag = kit.cyl(0.056, 0.056, 0.014, 28, matMagnet);
    mag.position.set(mx, YT - 0.021, mz);
    g.add(mag);
    // 磁铁外面一圈铜色的压装环
    const ring = detail.parts.ring(0.060, 0.056, 0.003, kit.mat('copper'), { seg: 28, bevel: 0.001 });
    ring.rotation.x = TILT;
    ring.position.set(mx, YT - 0.026, mz);
    g.add(ring);
  }

  /* ---------- 3. 磁吸环 + 中心座 ---------- */
  const magRing = detail.parts.ring(0.190, 0.146, 0.006, matMagnet, { seg: 48, bevel: 0.002 });
  magRing.rotation.x = TILT;
  magRing.position.set(0, YT - 0.0245, 0);     // 环体凸出底板 0.006
  g.add(magRing);
  // 环内部的中心圆台（转接座的吸附中心）
  const boss = kit.cyl(0.070, 0.080, 0.014, 32, matMetal);
  boss.position.set(0, YT - 0.018, 0);
  g.add(boss);
  // 中心大螺丝：把整个底座锁在机身内框上
  const bigScrew = detail.parts.screw(0.026, matSteel, { head: 'cross' });
  bigScrew.rotation.x = Math.PI;
  bigScrew.position.set(0, YT - 0.0245, 0);
  g.add(bigScrew);

  /* ---------- 4. 双爪接口（左右各一道 L 形卡爪） ---------- */
  // 立筋 + 内翻边 = L 形，翻边朝里，正好卡进快拆座的滑槽
  for (const dz of [1, -1]) {
    const rib = detail.parts.cbox(0.680, 0.026, 0.012, matMetal, 0.004, 2);
    rib.position.set(0, YT - 0.035, dz * 0.213);      // y -0.475 → -0.449
    g.add(rib);
    const flange = detail.parts.cbox(0.680, 0.008, 0.022, matMetal, 0.003, 2);
    flange.position.set(0, YT - 0.044, dz * 0.202);    // 翻边朝内
    g.add(flange);
    // 爪尖的小斜面，卡进去时靠它导入
    const tip = detail.parts.cbox(0.680, 0.006, 0.008, matSteel, 0.002, 1);
    tip.position.set(0, YT - 0.044, dz * 0.214);
    g.add(tip);
  }

  /* ---------- 5. 定位销 ---------- */
  for (const dx of [0.215, -0.215]) {
    const pin = kit.cyl(0.022, 0.027, 0.032, 20, matSteel);
    pin.position.set(dx, YT - 0.034, 0);
    g.add(pin);
    // 销子根部的橡胶垫圈
    const oring = detail.parts.ring(0.030, 0.027, 0.003, matRubber, { seg: 20, bevel: 0.001 });
    oring.rotation.x = TILT;
    oring.position.set(dx, YT - 0.020, 0);
    g.add(oring);
  }

  /* ---------- 6. 后端释放推钮 ---------- */
  // 推钮：按下解锁，带三道防滑纹；滑块比底板低 0.05
  const slider = detail.parts.cbox(0.230, 0.056, 0.048, matDeep, 0.008, 3);
  slider.position.set(0, YT - 0.045, -0.224);       // y -0.500 → -0.444
  g.add(slider);
  // 推钮顶部的浅色压条（一眼看出这是可动件）
  const sliderTop = detail.parts.cbox(0.200, 0.008, 0.040, matLite, 0.003, 1);
  sliderTop.position.set(0, YT - 0.074, -0.224);
  g.add(sliderTop);
  // 三道防滑竖纹
  for (let i = 0; i < 3; i++) {
    const grip = detail.parts.cbox(0.230, 0.030, 0.004, matDeep, 0.001, 1);
    grip.position.set(0, YT - 0.056, -0.2495 + i * 0.007);
    g.add(grip);
  }
  // 推钮两侧的导向槽
  for (const sx of [1, -1]) {
    const guide = detail.parts.cbox(0.014, 0.010, 0.060, matMetal, 0.002, 1);
    guide.position.set(sx * 0.126, YT - 0.030, -0.216);
    g.add(guide);
  }

  /* ---------- 7. 四颗固定螺丝（底面沉头） ---------- */
  for (const sx of [1, -1]) {
    for (const sz of [1, -1]) {
      const sc = detail.parts.screw(0.015, matSteel, { head: 'cross' });
      sc.rotation.x = Math.PI;                     // 头朝下，和底平面齐平
      sc.position.set(sx * 0.412, YT - 0.0165, sz * 0.194);
      g.add(sc);
    }
  }

  /* ---------- 8. 顶面硅胶垫 ---------- */
  // 压进机身底部开口的那一圈橡胶，防止磁吸底座和外壳硬碰
  const gasket = detail.parts.plate({
    w: 0.960, h: 0.480, r: 0.040,
    holes: [detail.parts.rectPath(0.884, 0.404, 0.030)],
    depth: 0.003, bevel: 0.001,
  }, matRubber);
  gasket.rotation.x = TILT;
  gasket.position.set(0, YT - 0.001, 0);            // 世界 y[-0.432, -0.427]
  g.add(gasket);

  return g;
}