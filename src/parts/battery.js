/* ============================================================
   battery.js — 1770 mAh 电池模组（参考实现）
   ------------------------------------------------------------
   真机这块是「铝塑膜软包电芯 + 顶部保护板」：
     · 电芯本体：银灰铝塑膜，正面印满品牌/容量/条码（detail.tex.cell() 现画的）
     · 铝塑膜的折边：四个边一圈压出来的薄边，是软包电池最好认的特征
     · 顶部保护板（BMS）：一颗控制 IC + 两颗 MOS + 保险丝 + 电池连接器
     · 两条镍带把极耳焊到保护板上，焊点是两个小圆凸
     · 拉手胶带：换电池时扯的那条，故意伸到外面一点
     · 泡棉 + 绝缘垫：防止和主板/后屏共振
   这件是给其它部件作者看的范例：倒角、面差、贴图、实例化细件都在这儿。
   ============================================================ */

import * as THREE from 'three';

export default function build(env) {
  const { kit, detail, PART, mm } = env;
  const g = new THREE.Group();

  // 电芯几何：18.7 × 9.7 × 3.5 mm 量级的软包，压扁放在机身下部
  const CELL_W = 1.16;
  const CELL_H = 0.60;
  const CELL_D = 0.145;
  const cy = -0.018;            // slot 中心
  const cz = -0.155;
  const cellZ = cz - 0.014;     // 电芯略偏后，前面留出保护板/走线空间

  const cellMat = kit.mat('cell', { roughness: 0.54, metalness: 0.28 });
  const cell = detail.parts.cbox(CELL_W, CELL_H, CELL_D, cellMat, 0.014, 3);
  cell.position.set(0, cy, cellZ);
  g.add(cell);

  /* ---------- 铝塑膜折边：一圈薄边 ---------- */
  const edgeMat = kit.mat('cell', { color: 0x9aa3ac, roughness: 0.36, metalness: 0.5 });
  const rimH = 0.012;
  // 上下两条（长边）
  for (const sy of [-1, 1]) {
    const rim = detail.parts.cbox(CELL_W + 0.006, rimH, CELL_D + 0.006, edgeMat, 0.004, 2);
    rim.position.set(0, cy + sy * (CELL_H / 2), cellZ);
    g.add(rim);
  }
  // 左右两条（短边）
  for (const sx of [-1, 1]) {
    const rim = detail.parts.cbox(rimH, CELL_H + 0.006, CELL_D + 0.006, edgeMat, 0.004, 2);
    rim.position.set(sx * (CELL_W / 2), cy, cellZ);
    g.add(rim);
  }

  /* ---------- 顶部保护板（BMS） ---------- */
  const bmsY = cy + CELL_H / 2 + 0.011;
  const bmsMat = kit.mat('pcb', { color: 0x28322f, roughness: 0.7 });
  const bms = detail.parts.cbox(0.86, 0.016, 0.19, bmsMat, 0.003, 2);
  bms.position.set(-0.04, bmsY, cellZ + 0.004);
  g.add(bms);

  // 保护 IC（SOT-23 那种小块）
  const icMat = kit.mat('silicon', { color: 0x1b2027, roughness: 0.42, metalness: 0.2 });
  const ic = detail.parts.cbox(0.085, 0.016, 0.062, icMat, 0.002, 1);
  ic.position.set(-0.10, bmsY + 0.014, cellZ + 0.02);
  g.add(ic);
  // 两颗 MOS
  for (let i = 0; i < 2; i++) {
    const mos = detail.parts.cbox(0.062, 0.014, 0.05, icMat, 0.002, 1);
    mos.position.set(-0.10 + i * 0.078, bmsY + 0.014, cellZ - 0.03);
    g.add(mos);
  }
  // 保险丝（白色陶瓷小条）
  const fuse = detail.parts.cbox(0.05, 0.016, 0.03, kit.mats.ceramic, 0.002, 1);
  fuse.position.set(0.03, bmsY + 0.014, cellZ + 0.03);
  g.add(fuse);
  // 电池连接器（黑色塑壳 + 金色触点）
  const connBody = detail.parts.cbox(0.16, 0.05, 0.075, kit.mat('rubber', { color: 0x14171a }), 0.006, 2);
  connBody.position.set(0.30, bmsY + 0.016, cellZ - 0.01);
  g.add(connBody);
  const connPort = detail.parts.port('battery', { w: 0.11, h: 0.03 });
  connPort.position.set(0.30, bmsY + 0.036, cellZ - 0.01);
  connPort.rotation.x = -Math.PI / 2;
  g.add(connPort);

  // 保护板上的阻容：实例化一片，距离一远就是"电路感"
  const smd = detail.parts.smdField(26, { w: 0.014, h: 0.008, d: 0.009 }, kit.mats.ceramic, 0x7117);
  smd.userData.fill(-0.42, 0.16, bmsY + 0.011, bmsY + 0.011, cellZ, 3);
  g.add(smd);

  /* ---------- 极耳 + 镍带 + 焊点 ---------- */
  const nickelMat = kit.mat('metal', { color: 0xc3c8cd, roughness: 0.3, metalness: 0.86 });
  for (const sx of [-1, 1]) {
    const tab = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.012, 0.055), nickelMat);
    tab.position.set(sx * 0.30, cy + CELL_H / 2 + 0.004, cellZ + sx * 0.03);
    tab.castShadow = tab.receiveShadow = true;
    g.add(tab);
    // 焊点：一颗被压扁的圆点
    const spot = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.02, 0.006, 12), nickelMat);
    spot.position.set(sx * 0.30, cy + CELL_H / 2 + 0.012, cellZ + sx * 0.03);
    g.add(spot);
  }

  /* ---------- 拉手胶带（换电池时扯的那条） ---------- */
  const tapeMat = kit.mat('bodyLite', { color: 0x8a9099, roughness: 0.85, metalness: 0.02 });
  const tape = new THREE.Mesh(new THREE.BoxGeometry(0.30, 0.005, 0.11), tapeMat);
  tape.position.set(-0.47, cy - 0.02, cellZ + 0.02);
  tape.rotation.z = 0.08;
  tape.castShadow = tape.receiveShadow = true;
  g.add(tape);

  /* ---------- 缓冲泡棉 / 绝缘垫 ---------- */
  const foamMat = kit.mat('graphite', { color: 0x2a2e33, roughness: 0.95 });
  for (const sy of [-1, 1]) {
    const foam = detail.parts.cbox(0.98, 0.022, 0.05, foamMat, 0.006, 2);
    foam.position.set(0, cy + sy * (CELL_H / 2 - 0.05), cellZ + CELL_D / 2 + 0.012);
    g.add(foam);
  }
  // 侧边绝缘青稞纸：贴在电芯背面，颜色比铝塑膜深一档
  const paper = new THREE.Mesh(
    new THREE.BoxGeometry(CELL_W - 0.02, CELL_H - 0.02, 0.004),
    kit.mat('graphite', { color: 0x3d3a33, roughness: 0.9 })
  );
  paper.position.set(0, cy, cellZ - CELL_D / 2 - 0.004);
  paper.receiveShadow = true;
  g.add(paper);

  /* ---------- 二维码贴纸（质检标） ---------- */
  const qrTex = detail.tex.label({ lines: [], w: 128, h: 128, bg: '#e8ecef' });
  if (qrTex) {
    const qr = detail.parts.decal(0.16, 0.16, qrTex, { opacity: 0.9 });
    qr.position.set(0.46, cy - 0.16, cellZ + CELL_D / 2 + 0.002);
    g.add(qr);
  }

  /* ---------- 温度传感器（NTC）与走线 ---------- */
  const ntc = detail.parts.cbox(0.03, 0.006, 0.03, kit.mat('ceramic', { color: 0x2c3138 }), 0.002, 1);
  ntc.position.set(-0.34, cy - 0.12, cellZ + CELL_D / 2 + 0.004);
  g.add(ntc);
  const wire = detail.parts.flex(
    [[-0.34, cy - 0.12, cellZ + CELL_D / 2 + 0.006],
     [-0.28, cy - 0.02, cellZ + CELL_D / 2 + 0.02],
     [-0.18, cy + CELL_H / 2 - 0.02, cellZ + 0.02],
     [-0.06, bmsY + 0.004, cellZ + 0.01]],
    0.018, kit.mat('rubber', { color: 0x241f22 }), 24
  );
  g.add(wire);

  /* ---------- 铝塑膜压痕 / 加强筋 / 绝缘贴（近看才有工业感，远看只是明暗变化） ---------- */
  const creaseMat = kit.mat('cell', { color: 0x8f979f, roughness: 0.44, metalness: 0.42 });
  for (let i = 0; i < 12; i++) {
    const line = new THREE.Mesh(new THREE.BoxGeometry(0.006, CELL_H - 0.10, 0.004), creaseMat);
    line.position.set(-0.50 + i * 0.091, cy, cellZ + CELL_D / 2 + 0.001);
    g.add(line);
  }
  for (const sy of [-1, 1]) {
    const rib = detail.parts.cbox(CELL_W - 0.10, 0.012, 0.012, creaseMat, 0.004, 2);
    rib.position.set(0, cy + sy * (CELL_H / 2 - 0.055), cellZ + CELL_D / 2 + 0.004);
    g.add(rib);
  }
  const cornerMat = kit.mat('graphite', { color: 0x4a4238, roughness: 0.88 });
  for (const sx of [-1, 1]) {
    for (const sy of [-1, 1]) {
      const c = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.075, 0.004), cornerMat);
      c.position.set(sx * (CELL_W / 2 - 0.035), cy + sy * (CELL_H / 2 - 0.035), cellZ + CELL_D / 2 + 0.002);
      g.add(c);
    }
  }
  // 第二片贴片阻容（保护板靠后一侧）
  const smd2 = detail.parts.smdField(34, { w: 0.012, h: 0.007, d: 0.008 }, kit.mats.ceramic, 0x2222);
  if (smd2?.userData?.fill) smd2.userData.fill(-0.42, 0.10, bmsY + 0.011, bmsY + 0.011, cellZ - 0.055, 2);
  g.add(smd2);
  // 连接器金针（8 脚）
  const pinMat = kit.mat('gold', { roughness: 0.3, metalness: 0.95 });
  for (let i = 0; i < 8; i++) {
    const pin = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.008, 0.052), pinMat);
    pin.position.set(0.245 + i * 0.0157, bmsY + 0.036, cellZ - 0.01);
    g.add(pin);
  }
  // 极耳根部绝缘胶带
  const rootMat = kit.mat('bodyLite', { color: 0xb9a44a, roughness: 0.82 });
  for (const sx of [-1, 1]) {
    const root = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.006, 0.075), rootMat);
    root.position.set(sx * 0.30, cy + CELL_H / 2 + 0.014, cellZ + sx * 0.03);
    g.add(root);
  }

  return g;
}