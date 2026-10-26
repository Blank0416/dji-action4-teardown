/* ============================================================
   shell.js — 中框机身（空壳）
   ------------------------------------------------------------
   真机上这一件是「塑胶中框 + 内部骨架」：
     · 顶板 / 底板：两块带开孔的挤出面，分别让出顶部按键口、底部磁吸口
     · 左右侧壁：右壁给 USB-C 橡胶门让出一个方口，左壁开散热格栅
     · 前腔内框：镜头圆孔 + 1.4" 前屏方孔，炸开后能看见内部骨架
     · 后腔：一圈橡胶密封垫 + 四颗后盖螺丝柱（拆掉后屏才露出来）
     · 侧边防滑竖纹、底部磁吸导槽、四颗底部螺丝、麦克风微孔
   为什么不做成一个实心圆角盒：实心壳在拆解动画里会把整个内腔挡死，
   观众就看不到主板/电池/传感器了。所以这里是「前后贯通」的中空壳，
   内腔 1.31 × 0.784，和 layout.DEVICE.cavity 对齐。
   挤出面的倒角额外撑出 BEV 的量，所以形状要预先缩一圈，成品才是标称外形。
   ============================================================ */

import * as THREE from 'three';

export default function build(env) {
  const { kit, detail, mm } = env;
  const g = new THREE.Group();

  /* ---------- 0. 基准尺寸 ---------- */
  const W = 1.41;
  const H = 0.884;
  const T = 0.05;                    // 壁厚：内腔 1.31 × 0.784 = layout 的 cavity
  const ZF = 0.268;                  // 前端面（前面 0.06 让给前盖）
  const ZR = -0.328;                 // 后端面（后面 0.06 让给后屏）
  const CZ = (ZF + ZR) / 2;
  const D = ZF - ZR;                 // 0.596
  const BEV = 0.006;                 // 挤出倒角：边沿那道细高光
  const KEY_W = 1.16, KEY_D = 0.26;  // 顶部按键开口（对齐 topkeys 的 slot）
  const MNT_W = 1.00, MNT_D = 0.52;  // 底部磁吸开口（对齐 mount 的 slot）

  const matBody = kit.mats.body;
  const matDeep = kit.mats.bodyDeep;
  const matMetal = kit.mat('metalDark');
  const matRubber = kit.mats.rubber;
  const matDark = kit.mat('rubber', { color: 0x0d1013, roughness: 0.94 });

  /* ---------- 1. 顶板：整块挤出面，中间挖掉按键口 ---------- */
  // 挤出后绕 X 转 -90°，挤出方向 +Z 变成 +Y；局部 Y 映射到机身 -Z，
  // 所以挖孔的局部圆心要放在 CZ，孔心才落在机身 z = 0。
  const topPlate = detail.parts.plate({
    w: W - BEV * 2, h: D - BEV * 2, r: 0.072,
    holes: [detail.parts.rectPath(KEY_W + 0.014, KEY_D + 0.014, 0.05, 0, CZ)],
    depth: 0.05 - BEV * 2, bevel: BEV,
  }, matBody);
  topPlate.rotation.x = -Math.PI / 2;
  topPlate.position.set(0, H / 2 - T, CZ);
  g.add(topPlate);

  /* ---------- 2. 底板：挖掉磁吸口，四角带螺丝 ---------- */
  const botPlate = detail.parts.plate({
    w: W - BEV * 2, h: D - BEV * 2, r: 0.072,
    holes: [detail.parts.rectPath(MNT_W + 0.012, MNT_D + 0.012, 0.05, 0, -CZ)],
    depth: 0.05 - BEV * 2, bevel: BEV,
  }, matBody);
  botPlate.rotation.x = Math.PI / 2;
  botPlate.position.set(0, -(H / 2 - T), CZ);
  g.add(botPlate);

  /* ---------- 3. 左右侧壁 ---------- */
  const wallH = H - T * 2;           // 0.784
  const wallX = W / 2 - T / 2;       // 0.68
  const leftWall = detail.parts.cbox(T, wallH, D, matBody, 0.01, 2);
  leftWall.position.set(-wallX, 0, CZ);
  g.add(leftWall);

  // 右壁被 USB-C / 卡槽橡胶门切成四段：门洞四周各留一条边，缝里才看得见门
  const dz0 = -0.12, dz1 = 0.10, dy0 = -0.13, dy1 = 0.11;
  const doorFrame = [
    [ZR, dz0, -wallH / 2, wallH / 2],   // 后段整高
    [dz1, ZF, -wallH / 2, wallH / 2],   // 前段整高
    [dz0, dz1, dy1, wallH / 2],         // 门上沿
    [dz0, dz1, -wallH / 2, dy0],        // 门下沿
  ];
  for (const [z0, z1, y0, y1] of doorFrame) {
    const seg = detail.parts.cbox(T, y1 - y0, z1 - z0, matBody, 0.008, 2);
    seg.position.set(wallX, (y0 + y1) / 2, (z0 + z1) / 2);
    g.add(seg);
  }
  // 橡胶门：外表面正好落在 x = 0.705，四周留 3 mm 暗缝
  const door = detail.parts.cbox(0.045, dy1 - dy0 + 0.006, dz1 - dz0 + 0.006, matRubber, 0.016, 3);
  door.position.set(W / 2 - 0.0225, (dy0 + dy1) / 2, (dz0 + dz1) / 2);
  g.add(door);
  // 门的掀盖小舌：真机上指甲抠的那一小条
  const lip = detail.parts.cbox(0.012, 0.016, 0.11, matRubber, 0.005, 2);
  lip.position.set(W / 2 - 0.006, dy0 + 0.012, (dz0 + dz1) / 2);
  g.add(lip);

  /* ---------- 4. 前腔内框：镜头孔 + 前屏方孔 ---------- */
  // 这块是"拆掉前盖后第一眼看到"的东西，两个孔必须和 frontcover 的孔同心
  const innerFrame = detail.parts.plate({
    w: W - T * 2 + 0.008, h: H - T * 2 + 0.008, r: 0.05,
    holes: [
      detail.parts.circlePath(0.335, 0.30, 0.008),               // 镜头筒让位（Ø16.8 mm）
      detail.parts.rectPath(0.522, 0.522, 0.04, -0.30, 0.008),   // 1.4" 前屏让位
    ],
    depth: 0.02, bevel: 0.004,
  }, matDeep);
  innerFrame.position.set(0, 0, 0.232);
  g.add(innerFrame);

  /* ---------- 5. 侧边：防滑竖纹 + 散热格栅 ---------- */
  // 竖纹用一条几何铺满两侧（27 条），比 for 循环建 27 个 Mesh 省一半 draw call
  const ribZ = [];
  for (let i = 0; i < 9; i++) ribZ.push(0.110 + i * 0.0172);    // 前段（紧挨前盖）
  const ribZRight = ribZ.concat(ribZ.map((z) => z - 0.395));    // 右侧多一段后段
  const ribGeo = new THREE.BoxGeometry(0.004, 0.60, 0.0032);
  const ribMat = kit.mat('bodyDeep', { color: 0x30353a, roughness: 0.88 });
  const ribCount = ribZ.length * 2 + ribZRight.length;
  const ribs = new THREE.InstancedMesh(ribGeo, ribMat, ribCount);
  const m4 = new THREE.Matrix4();
  let ri = 0;
  for (const z of ribZRight) { m4.makeTranslation(W / 2 - 0.0005, 0, z); ribs.setMatrixAt(ri++, m4); }
  for (const z of ribZ) { m4.makeTranslation(-(W / 2 - 0.0005), 0, z); ribs.setMatrixAt(ri++, m4); }
  ribs.instanceMatrix.needsUpdate = true;
  ribs.castShadow = ribs.receiveShadow = true;
  g.add(ribs);

  // 左壁后段的散热格栅：7 条横槽（真机上是被动散热的主要出口）
  for (let i = 0; i < 7; i++) {
    const slot = detail.parts.cbox(0.005, 0.015, 0.128, matDark, 0.003, 1);
    slot.position.set(-(W / 2 - 0.002), -0.035 + i * 0.041, -0.195);
    g.add(slot);
  }

  /* ---------- 6. 顶板细节：麦克风微孔 ---------- */
  const micGeo = new THREE.CylinderGeometry(0.55 * mm, 0.55 * mm, 0.004, 10);
  const mics = new THREE.InstancedMesh(micGeo, matDark, 6);
  for (let i = 0; i < 6; i++) {
    m4.makeTranslation(-0.09 + i * 0.036, H / 2 + 0.0005, 0.198);
    mics.setMatrixAt(i, m4);
  }
  mics.instanceMatrix.needsUpdate = true;
  g.add(mics);

  /* ---------- 7. 底面：磁吸导槽 + 四颗螺丝 ---------- */
  // 导槽：磁吸口两侧的定位凸棱，装配时给底座导向（只敢凸 0.003，包络容差在这里）
  for (const sx of [-1, 1]) {
    const rail = detail.parts.cbox(0.012, 0.003, MNT_D + 0.06, matDeep, 0.001, 1);
    rail.position.set(sx * (MNT_W / 2 + 0.017), -H / 2 - 0.0015, CZ);
    g.add(rail);
  }
  // 磁吸口前后两条横向压边（磁吸座的定位基准）
  for (const sz of [-1, 1]) {
    const stop = detail.parts.cbox(MNT_W + 0.05, 0.003, 0.024, matDeep, 0.001, 1);
    stop.position.set(0, -H / 2 - 0.0015, sz * (MNT_D / 2 + 0.017) + CZ);
    g.add(stop);
  }
  // 四颗底部螺丝：头比底面只低 2.5 mm 的百分位，藏在一块浅浅的沉孔圈里
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.027, 0.027, 0.003, 18), matDark);
      ring.position.set(sx * 0.60, -H / 2 - 0.0005, CZ + sz * 0.20);
      g.add(ring);
      const screw = detail.parts.screw(0.019, matMetal);
      screw.rotation.x = Math.PI;
      screw.position.set(sx * 0.60, -H / 2 + 0.0175, CZ + sz * 0.20);
      g.add(screw);
    }
  }

  /* ---------- 8. 后腔：橡胶密封垫 + 四颗后盖螺丝柱 ---------- */
  // 后屏模组拆下来后，露出的就是这圈密封条和四个螺丝柱
  const sealT = 0.014;
  for (const sz of [-1, 1]) {
    const seal = detail.parts.cbox(1.24, 0.012, sealT, matRubber, 0.004, 2);
    seal.position.set(0, sz * (0.72 / 2 + 0.006), ZR + 0.012);
    g.add(seal);
  }
  for (const sx of [-1, 1]) {
    const seal = detail.parts.cbox(0.012, 0.72, sealT, matRubber, 0.004, 2);
    seal.position.set(sx * (1.30 / 2 + 0.004), 0, ZR + 0.012);
    g.add(seal);
  }
  for (const sx of [-1, 1]) {
    for (const sy of [-1, 1]) {
      const boss = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.036, 0.05, 14), matDeep);
      boss.rotation.x = Math.PI / 2;
      boss.position.set(sx * 0.60, sy * 0.33, ZR + 0.028);
      g.add(boss);
      const hole = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.006, 12), matDark);
      hole.rotation.x = Math.PI / 2;
      hole.position.set(sx * 0.60, sy * 0.33, ZR + 0.004);
      g.add(hole);
    }
  }

  /* ---------- 9. 内部支撑筋 ---------- */
  // 贴在内壁上的竖筋：真机用来扛挤压，也让内腔不至于是一整块黑板
  for (const sx of [-1, 1]) {
    for (const z of [0.09, 0.17]) {
      const rib = detail.parts.cbox(0.01, 0.76, 0.012, matDeep, 0.003, 1);
      rib.position.set(sx * (W / 2 - T / 2 - 0.005), 0, z);
      g.add(rib);
    }
  }
  // 前框与侧壁之间的三角加强片（就是那种注塑件上常见的斜拉筋）
  for (const sx of [-1, 1]) {
    const brace = detail.parts.cbox(0.09, 0.012, 0.05, matDeep, 0.003, 1);
    brace.position.set(sx * 0.615, 0.30, 0.20);
    brace.rotation.z = sx * 0.5;
    g.add(brace);
  }

  /* ---------- 10. 顶板后段：一颗铭牌凹槽（不做文字，只留形） ---------- */
  const notch = detail.parts.cbox(0.30, 0.004, 0.03, matDeep, 0.001, 1);
  notch.position.set(-0.28, H / 2 + 0.0005, CZ - 0.245);
  g.add(notch);

  return g;
}