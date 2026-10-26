/* ============================================================
   topkeys.js — 顶部按键组（快门 / 电源·QS / 麦克风）
   ------------------------------------------------------------
   真机顶部这一条是独立的一小块模组：顶盖 + 两颗按键 + 麦克风进音孔，
   从机身顶部那个 x∈[-0.58,0.58]、z∈[-0.13,0.13] 的口子里嵌进去。
     · 顶盖：1.16 × 0.26，上表面比机身顶面高 0.003，做出「面差」
     · 快门键：Ø0.196 银色亮面，根部一圈录制红指示环，外圈压一道暗缝
     · 电源键：Ø0.16，比快门矮一截，深灰键帽 + 浅一号的顶面
     · 麦克风：4 个 Ø0.022 的进音孔，孔后是一块深色声腔
     · 底面：支架板 + 两颗金属锅仔片 + 一条往机身后方去的按键排线
   所有按键都从顶盖的孔里穿出来，孔壁和键身之间留 0.002–0.006 的暗缝。
   ============================================================ */

import * as THREE from 'three';

export default function build(env) {
  const { kit, detail } = env;
  const g = new THREE.Group();

  /* ---------- 0. 基准与材质 ---------- */
  const TW = 1.16, TD = 0.26;      // 顶盖 x × z = slot 尺寸
  const YT = 0.445;                // 顶盖上表面（机身顶面 0.442 + 0.003 面差）
  const TILT = -Math.PI / 2;       // plate 默认朝 +Z，转 -90° 后朝 +Y

  const matBody = kit.mat('body');
  const matLite = kit.mat('bodyLite');
  const matDeep = kit.mat('bodyDeep');
  const matDark = kit.mat('rubber', { color: 0x0b0d0f, roughness: 0.94 });
  const matSteel = kit.mat('steel', { color: 0xd9dee3, roughness: 0.2, metalness: 0.92 });
  const matRed = kit.tint(0xd93b32, { rough: 0.44, metal: 0.1, emissive: 0x6e120e, emissiveIntensity: 0.45 });
  const matGlassDark = kit.tint(0x14181d, { rough: 0.14, metal: 0.3 });

  /* ---------- 1. 顶盖（挖两个键孔 + 4 个麦克风孔） ---------- */
  // 麦克风孔：世界 z=+0.088 一侧，local y = -0.088
  const micHoles = [];
  for (const mx of [-0.071, -0.024, 0.024, 0.071]) {
    micHoles.push(detail.parts.circlePath(0.011, mx, -0.088));
  }
  const cover = detail.parts.plate({
    w: TW - 0.006, h: TD - 0.006, r: 0.018,
    holes: [
      detail.parts.circlePath(0.104, 0.340, 0),     // 快门键孔
      detail.parts.circlePath(0.082, -0.340, 0),    // 电源键孔
      ...micHoles,
    ],
    depth: 0.030, bevel: 0.003,
  }, matBody);
  cover.rotation.x = TILT;
  cover.position.set(0, YT - 0.033, 0);   // 挤出范围 [-0.003, 0.033] → 顶面正好 0.445
  g.add(cover);

  /* ---------- 2. 快门键（银色亮面 + 录制红环） ---------- */
  // 底下的暗缝：从键孔和键身之间看到的那一圈黑
  const shutterRecess = kit.cyl(0.106, 0.106, 0.012, 40, matDark);
  shutterRecess.position.set(0.340, YT - 0.008, 0);
  g.add(shutterRecess);
  // 录制红指示环：一圈 Ø0.208 的薄碟，只露出 0.007 的环宽
  const redRing = kit.cyl(0.104, 0.104, 0.005, 44, matRed);
  redRing.position.set(0.340, YT - 0.000, 0);
  g.add(redRing);
  // 键身：略带拔模，越往上越细
  const barrel = kit.cyl(0.097, 0.0995, 0.039, 44, matSteel);
  barrel.position.set(0.340, YT + 0.0185, 0);      // 0.444 → 0.483
  g.add(barrel);
  // 键帽倒角圈（银亮面最亮的一圈就是它）
  const capChamfer = kit.cyl(0.088, 0.097, 0.010, 44, matSteel);
  capChamfer.position.set(0.340, YT + 0.042, 0);   // 0.483 → 0.493
  g.add(capChamfer);
  // 键帽顶面中间的红色录制点
  const recDot = kit.cyl(0.013, 0.013, 0.003, 24, matRed);
  recDot.position.set(0.340, YT + 0.0485, 0);      // 顶面 0.4995，压住 0.50 这条线
  g.add(recDot);

  /* ---------- 3. 电源 / QS 键 ---------- */
  const powerRecess = kit.cyl(0.084, 0.084, 0.012, 32, matDark);
  powerRecess.position.set(-0.340, YT - 0.008, 0);
  g.add(powerRecess);
  // 键身：比快门矮一截，只凸出 0.035
  const powerBody = kit.cyl(0.0765, 0.0785, 0.030, 32, matDeep);
  powerBody.position.set(-0.340, YT + 0.013, 0);    // 0.443 → 0.473
  g.add(powerBody);
  // 顶面用浅一号的料，暗场里能读出「这里有一颗键」
  const powerCap = kit.cyl(0.070, 0.0765, 0.008, 32, matLite);
  powerCap.position.set(-0.340, YT + 0.032, 0);     // 0.473 → 0.481
  g.add(powerCap);
  // 键帽上的一道细凹槽（QS 键的防滑线）
  const powerSlot = kit.cyl(0.0715, 0.0715, 0.0016, 32, matDeep);
  powerSlot.position.set(-0.340, YT + 0.0355, 0);
  g.add(powerSlot);

  /* ---------- 4. 麦克风声腔 ---------- */
  // 4 个孔后面是一块深色腔体，不然孔里会透出机身的亮面
  const chamber = detail.parts.cbox(0.155, 0.014, 0.030, matDark, 0.004, 2);
  chamber.position.set(0, YT - 0.022, 0.088);
  g.add(chamber);
  // 声腔里的一小片网（极细的深灰格栅，只做视觉层次）
  const mesh = detail.parts.cbox(0.145, 0.002, 0.026, kit.tint(0x1d2226, { rough: 0.7, metal: 0.4 }), 0.001, 1);
  mesh.position.set(0, YT - 0.0155, 0.088);
  g.add(mesh);

  /* ---------- 5. 顶盖上的小细节 ---------- */
  // 顶盖后缘的一块黑色亮窗（真机这里是状态指示窗）
  const win = detail.parts.cbox(0.030, 0.005, 0.013, matGlassDark, 0.002, 1);
  win.position.set(0.120, YT + 0.0005, -0.082);
  g.add(win);
  // 一颗小沉头螺丝，锁住顶盖后段
  const screw = detail.parts.screw(0.016, kit.mat('metalDark'), { head: 'cross' });
  screw.rotation.x = Math.PI;              // screw 沿 +Y 生成，翻过来朝下
  screw.position.set(-0.500, YT - 0.030, -0.082);
  g.add(screw);

  /* ---------- 6. 密封圈 ---------- */
  // 顶盖和机身顶面之间那圈防水胶条，比顶盖小一号，藏在缝里
  const gasket = detail.parts.plate({
    w: 1.140, h: 0.240, r: 0.016,
    holes: [detail.parts.rectPath(1.112, 0.212, 0.010)],
    depth: 0.004, bevel: 0.001,
  }, matDark);
  gasket.rotation.x = TILT;
  gasket.position.set(0, YT - 0.036, 0);
  g.add(gasket);

  /* ---------- 7. 底面支架 + 锅仔片 + 排线 ---------- */
  // 支架板：从底下看过去是这块板托着两颗键
  const bracket = detail.parts.plate({
    w: 0.900, h: 0.190, r: 0.020,
    holes: [detail.parts.rectPath(0.700, 0.110, 0.014)],
    depth: 0.006, bevel: 0.002,
  }, kit.tint(0x2c333a, { rough: 0.78, metal: 0.12 }));
  bracket.rotation.x = TILT;
  bracket.position.set(0, 0.398, 0);
  g.add(bracket);
  // 两颗金属锅仔片（按键的触感来源）
  for (const dx of [0.340, -0.340]) {
    const dome = kit.cyl(0.048, 0.052, 0.012, 28, kit.mat('metalDark'));
    dome.position.set(dx, 0.406, 0);
    g.add(dome);
    const dot = kit.cyl(0.010, 0.010, 0.003, 16, matDark);
    dot.position.set(dx, 0.413, 0);
    g.add(dot);
  }
  // 按键排线：沿 z 往机身后方走；flex 的宽度方向恒为水平，
  // 所以路径必须 x 恒定，带宽才会整条落在 X 轴上
  const flexMat = kit.mat('bodyLite', { color: 0x6b5a3c, roughness: 0.84, metalness: 0.05 });
  const tail = detail.parts.flex([
    [0.100, 0.400, -0.020],
    [0.100, 0.396, -0.070],
    [0.100, 0.390, -0.118],
  ], 0.062, flexMat, 28);
  g.add(tail);
  // 排线末端的 ZIF 座
  const zif = detail.parts.cbox(0.090, 0.014, 0.026, kit.tint(0x14171a, { rough: 0.8 }), 0.003, 2);
  zif.position.set(0.100, 0.390, -0.124);
  g.add(zif);

  return g;
}