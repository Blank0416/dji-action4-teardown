/* ============================================================
   mainboard.js — 主板（PCB + 主控 SoC + 存储器 + PMIC + 屏蔽罩 + 连接器）
   ------------------------------------------------------------
   真机上这是整机的电气中心：一块 6 层 HDI 板，元件面塞满主控封装、LPDDR、
   eMMC、PMIC、射频屏蔽罩、microSD 卡座、ZIF 排线座和 Type-C 插座，
   背面是电池弹片和一块背板屏蔽罩。拆开后观众正对的就是它，所以这一件
   的第一指标不是"像"，而是"密"：
     · 板体   —— 深绿阻焊 + 金色走线 + 米白丝印（detail.tex.pcb 现画的）
     · 主控   —— 封装基板 + 裸露 die + 顶部丝印 + 一圈金色焊盘
     · 屏蔽罩 —— 拉丝不锈钢，顶部真开 9 个散热孔（透出下面的板面暗部）
     · 阻容   —— 5 组 InstancedMesh 共一百多颗，远看就是"电路感"
     · 走线   —— 板面上半埋的金色圆管，把主要区块连起来
     · 螺纹孔 —— 真通孔 + 镀金环 + 十字螺丝（板子不再是一块实心塑料）
   坐标：slot 中心 (0,0,-0.004)，元件面朝 +Z（镜头同侧），高度全部由 slot 推出。
   ============================================================ */

import * as THREE from 'three';

export default function build(env) {
  const { kit, detail, PART, mm } = env;
  const g = new THREE.Group();
  const S = PART.slot;

  /* ---------- 1. 基准：毫米 → 场景单位，全部从 slot 长出来 ---------- */
  const BW = S.w - 0.04;            // 板宽 1.26（两侧各留 1 mm 给中框内壁）
  const BH = S.h - 0.04;            // 板高 0.74
  const Z_TOP = S.cz + 0.010;       // 元件面（观众看到的那一面）
  const Z_TH = 0.018;               // 板厚 ≈0.9 mm
  const Z_BOT = Z_TOP - Z_TH;       // 背面
  const BEV = 0.002;                // 板边倒角：直角边是廉价感的第一来源
  const HOLE = 1.1 * mm;            // Ø2.2 mm 螺纹孔

  // 板内坐标 → 世界坐标。板内一律以 slot 中心为原点，改布局时只动一处。
  const at = (mesh, x, y, z) => { mesh.position.set(S.cx + x, S.cy + y, z); g.add(mesh); return mesh; };
  const cbox = (w, h, d, m, r = 0.004, seg = 2) => detail.parts.cbox(w, h, d, m, r, seg);

  /* ---------- 2. 材质 ---------- */
  // 阻焊不用 kit 里那版深青（那是给电池 BMS 小板用的），主板要更绿一点。
  const pcbTex = detail.tex.pcb({ base: '#1d3a2d', trace: '#c8a44c', silk: '#cbd2c7' });
  const pcbMat = pcbTex && pcbTex.map
    ? kit.mat('pcb', {
        map: pcbTex.map, normalMap: pcbTex.normalMap, roughnessMap: pcbTex.roughnessMap,
        color: 0xffffff, roughness: 0.66, normalScale: new THREE.Vector2(0.6, 0.6),
      })
    : kit.mat('pcb', { color: 0x22432f, roughness: 0.68 });

  const goldMat = kit.mat('gold', { color: 0xc3a462, roughness: 0.32, metalness: 0.92 });
  const traceMat = kit.mat('gold', { color: 0xb08f4c, roughness: 0.44, metalness: 0.8 });
  const chipMat = kit.mat('silicon', { color: 0x1c222a, roughness: 0.38, metalness: 0.24 });
  const dieMat = kit.mat('silicon', { color: 0x2d3948, roughness: 0.18, metalness: 0.42 });
  const canMat = kit.mat('steel', { color: 0x707880, roughness: 0.36, metalness: 0.82 });
  const darkMat = kit.mat('rubber', { color: 0x121518, roughness: 0.9 });
  const shellMat = kit.mat('metal', { color: 0x9aa2ab, roughness: 0.3, metalness: 0.86 });
  const screwMat = kit.mat('metal', { color: 0x8d949c, roughness: 0.28, metalness: 0.9 });

  /* ---------- 3. 板体：带真实通孔的挤出板 ---------- */
  const CORNERS = [[-0.575, 0.315], [-0.575, -0.315], [0.575, 0.315], [0.575, -0.315]];
  const holes = CORNERS.map(([hx, hy]) => detail.parts.circlePath(HOLE, hx, hy));
  const board = detail.parts.plate(
    { w: BW, h: BH, r: 0.012, holes, depth: Z_TH - BEV * 2, bevel: BEV }, pcbMat);
  board.position.set(S.cx, S.cy, Z_BOT + BEV);
  g.add(board);

  /* ---------- 4. 螺纹孔：镀金环 + 十字螺丝 ---------- */
  CORNERS.forEach(([hx, hy]) => {
    const ring = detail.parts.ring(HOLE + 0.009, HOLE, 0.003, goldMat, { seg: 20, bevel: 0.001 });
    at(ring, hx, hy, Z_TOP - 0.004);
    const sc = detail.parts.screw(0.018, screwMat);
    sc.rotation.x = Math.PI / 2;              // 螺丝轴向 +Z，帽面朝观众
    at(sc, hx, hy, Z_TOP - 0.013);
  });

  /* ---------- 5. 主控 SoC：基板 / 塑封 / 裸 die 三层 ---------- */
  const socX = -0.275, socY = 0.075;
  const soc = new THREE.Group();
  const sub = cbox(0.235, 0.235, 0.0035, kit.mat('silicon', { color: 0x17251f, roughness: 0.55 }), 0.004, 2);
  sub.position.z = 0.00175; soc.add(sub);
  const mold = cbox(0.205, 0.205, 0.005, chipMat, 0.010, 2);
  mold.position.z = 0.006; soc.add(mold);
  const die = cbox(0.115, 0.115, 0.0024, dieMat, 0.0015, 1);
  die.position.z = 0.0097; soc.add(die);
  // 封装四周的焊盘：一圈金色薄片，是"这是一颗 BGA"的最省证据
  for (const sy of [-1, 1]) {
    const row = cbox(0.24, 0.006, 0.002, goldMat, 0.001, 1);
    row.position.set(0, sy * 0.106, 0.0022); soc.add(row);
  }
  for (const sx of [-1, 1]) {
    const row = cbox(0.006, 0.24, 0.002, goldMat, 0.001, 1);
    row.position.set(sx * 0.106, 0, 0.0022); soc.add(row);
  }
  at(soc, socX, socY, Z_TOP);
  // die 顶部丝印
  const socTex = detail.tex.label({ lines: ['X1S', 'DJI 2023'], w: 256, h: 128, fg: 'rgba(206,214,222,0.72)', align: 'center' });
  at(detail.parts.decal(0.11, 0.055, socTex, { opacity: 0.9 }), socX, socY, Z_TOP + 0.0112);

  /* ---------- 6. 存储器：LPDDR + eMMC（塑封件，只留一道丝印） ---------- */
  const ram = cbox(0.19, 0.13, 0.0065, chipMat, 0.006, 2);
  at(ram, -0.275, -0.15, Z_TOP + 0.00325);
  const flash = cbox(0.15, 0.13, 0.0065, chipMat, 0.006, 2);
  at(flash, -0.028, -0.15, Z_TOP + 0.00325);
  // 封装角上的第一脚标记（转倒的薄圆片，正好当丝印圆点用）
  const pin1 = kit.cyl(0.006, 0.006, 0.001, 8, dieMat);
  pin1.rotation.x = Math.PI / 2;
  at(pin1, -0.355, -0.10, Z_TOP + 0.0068);

  /* ---------- 7. PMIC + 功率电感 + 钽电容 ---------- */
  const pmic = cbox(0.115, 0.095, 0.005, chipMat, 0.005, 2);
  at(pmic, -0.28, 0.30, Z_TOP + 0.0025);
  const coilMat = kit.mat('metalDark', { color: 0x4b525a, roughness: 0.5, metalness: 0.55 });
  for (const cx0 of [-0.13, 0.005]) {
    const coil = cbox(0.05, 0.05, 0.007, coilMat, 0.008, 2);
    at(coil, cx0, 0.315, Z_TOP + 0.0035);
  }
  // 钽电容：矮圆柱 + 顶面一道极性亮条。圆柱轴向是 +Y，必须转倒才躺得平
  for (const cy0 of [0.30, 0.245]) {
    const capMat = kit.mat('ceramic', { color: 0x8d7a5e, roughness: 0.55 });
    const cap = kit.cyl(0.022, 0.022, 0.008, 14, capMat);
    cap.rotation.x = Math.PI / 2;
    at(cap, -0.38, cy0, Z_TOP + 0.004);
    at(cbox(0.03, 0.008, 0.001, goldMat, 0.001, 1), -0.38, cy0, Z_TOP + 0.0085);
  }

  /* ---------- 8. 射频屏蔽罩：真开孔，孔下透出板面暗部 ---------- */
  const ventHoles = [];
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      ventHoles.push(detail.parts.circlePath(0.014, -0.108 + c * 0.108, -0.078 + r * 0.078));
    }
  }
  const can = detail.parts.plate(
    { w: 0.40, h: 0.30, r: 0.008, holes: ventHoles, depth: 0.007, bevel: 0.002 }, canMat);
  at(can, 0.17, 0.12, Z_TOP);
  // 罩子两侧的接地弹片：压在中框上，拆开时才有"被掰开"的感觉
  for (const sy of [-1, 1]) {
    at(cbox(0.06, 0.012, 0.004, shellMat, 0.001, 1), 0.055, 0.12 + sy * 0.145, Z_TOP + 0.007);
  }

  /* ---------- 9. microSD 卡座：导轨 + 盖板 + 一张露出一角的卡 ---------- */
  const sdX = 0.45, sdY = -0.15;
  at(cbox(0.30, 0.20, 0.004, shellMat, 0.006, 2), sdX, sdY, Z_TOP + 0.002);      // 托板
  for (const sy of [-1, 1]) {                                                     // 两侧导轨
    at(cbox(0.30, 0.018, 0.009, shellMat, 0.004, 2), sdX, sdY + sy * 0.098, Z_TOP + 0.0065);
  }
  at(cbox(0.022, 0.19, 0.010, shellMat, 0.004, 2), sdX - 0.142, sdY, Z_TOP + 0.007); // 尾挡
  at(cbox(0.24, 0.15, 0.003, canMat, 0.004, 2), sdX + 0.01, sdY, Z_TOP + 0.011);   // 金属盖
  const card = cbox(0.21, 0.13, 0.0026, kit.mat('bodyDeep', { color: 0x23262b }), 0.002, 1);
  at(card, sdX + 0.045, sdY, Z_TOP + 0.0068);                                    // 卡片伸出一角
  at(kit.pins(8, 0.012, goldMat, { w: 0.007, h: 0.002, d: 0.0026 }), sdX + 0.02, sdY - 0.035, Z_TOP + 0.0072);

  /* ---------- 10. Type-C 插座：板边侧插，嘴朝 +X ---------- */
  const tcX = 0.52, tcY = 0.24;
  at(cbox(0.10, 0.15, 0.010, shellMat, 0.005, 2), tcX, tcY, Z_TOP + 0.005);
  at(cbox(0.024, 0.108, 0.006, darkMat, 0.002, 1), tcX + 0.048, tcY, Z_TOP + 0.005);   // 口内暗腔
  at(cbox(0.038, 0.086, 0.0018, goldMat, 0.001, 1), tcX + 0.03, tcY, Z_TOP + 0.005);   // 舌片
  for (const sy of [-1, 1]) {                                                          // 固定脚
    at(cbox(0.03, 0.02, 0.006, shellMat, 0.002, 1), tcX - 0.05, tcY + sy * 0.06, Z_TOP + 0.003);
  }

  /* ---------- 11. ZIF 排线座 ×3 + 短排线 ---------- */
  const fpc = (x, y, rot) => {
    const box = new THREE.Group();
    const body = cbox(0.12, 0.055, 0.008, darkMat, 0.004, 2);
    body.position.z = 0.004; box.add(body);
    const lid = cbox(0.11, 0.026, 0.003, kit.mat('bodyLite', { color: 0x40474f, roughness: 0.8 }), 0.002, 1);
    lid.position.set(0, 0.016, 0.009); box.add(lid);
    const pins = kit.pins(10, 0.0095, goldMat, { w: 0.006, h: 0.006, d: 0.005 });
    pins.position.set(0, -0.020, 0.006); box.add(pins);
    box.rotation.z = rot;
    return at(box, x, y, Z_TOP);
  };
  fpc(-0.32, -0.31, 0);
  fpc(-0.14, -0.31, 0);
  fpc(-0.545, 0.20, Math.PI / 2);
  // 从最左边那个座子扯出来的一段软排线。detail.parts.flex() 的宽度方向是
  // up×切向，板面上平铺的排线会立起来，所以这里改用带一点扭转的薄片。
  const ribbon = cbox(0.11, 0.042, 0.0022, kit.mat('rubber', { color: 0x2a2025 }), 0.002, 1);
  ribbon.rotation.z = 0.62;
  at(ribbon, -0.40, -0.252, Z_TOP + 0.005);

  /* ---------- 12. 贴片阻容阵列：5 组实例化，一百多颗 ---------- */
  // 每组一个矩形空位；seed 固定，所以每次打开长得一样。
  const zones = [
    { n: 34, x: [-0.605, -0.445], y: [-0.275, 0.10], s: 1, gold: false },
    { n: 24, x: [0.395, 0.575], y: [0.02, 0.16], s: 2, gold: false },
    { n: 22, x: [0.06, 0.27], y: [-0.35, -0.27], s: 3, gold: false },
    { n: 16, x: [0.05, 0.19], y: [0.295, 0.35], s: 4, gold: false },
    { n: 16, x: [0.40, 0.58], y: [-0.34, -0.26], s: 5, gold: true },
  ];
  zones.forEach((z, i) => {
    const size = z.gold ? { w: 0.016, h: 0.0022, d: 0.012 } : { w: 0.013, h: 0.0062, d: 0.008 };
    const f = detail.parts.smdField(z.n, size, z.gold ? goldMat : kit.mats.ceramic, 0x5100 + i * 7);
    if (!f?.userData?.fill) return;
    f.userData.fill(S.cx + z.x[0], S.cx + z.x[1], S.cy + z.y[0], S.cy + z.y[1], Z_TOP + 0.0032, z.s);
    g.add(f);
  });

  /* ---------- 13. 走线：半埋在阻焊里的金铜色圆管 ---------- */
  const T = (pts, r = 0.0034, seg = 14) => {
    g.add(kit.trace(pts.map(([x, y]) => [S.cx + x, S.cy + y, Z_TOP]), r, traceMat, seg));
  };
  T([[-0.60, 0.355], [-0.30, 0.362], [0.16, 0.356], [0.42, 0.335]], 0.004, 26); // 板边天线馈线
  T([[-0.12, 0.26], [-0.12, 0.10], [-0.145, -0.02], [-0.15, -0.10]]);          // SoC 右侧总线
  T([[-0.09, 0.26], [-0.09, 0.09], [-0.115, -0.02], [-0.12, -0.09]]);
  T([[-0.06, 0.24], [-0.06, 0.02], [-0.085, -0.04]]);
  T([[-0.30, 0.193], [-0.30, 0.242], [-0.285, 0.252]]);                         // SoC → PMIC
  T([[-0.30, -0.043], [-0.30, -0.085]], 0.003, 8);                              // SoC → LPDDR
  T([[-0.255, -0.043], [-0.255, -0.085]], 0.003, 8);

  /* ---------- 14. 丝印 / 质检贴纸 ---------- */
  const silkTex = detail.tex.label({
    lines: ['MAIN BOARD', 'HB02-J4  REV.A'], w: 512, h: 128, fg: 'rgba(226,232,236,0.66)', align: 'left',
  });
  at(detail.parts.decal(0.26, 0.065, silkTex, { opacity: 0.95 }), 0.155, -0.095, Z_TOP + 0.0006);
  const qcTex = detail.tex.label({ lines: ['QC PASS'], w: 256, h: 96, bg: '#dfe4e8', fg: 'rgba(32,40,48,0.9)', align: 'center' });
  at(detail.parts.decal(0.10, 0.037, qcTex, { opacity: 0.92 }), -0.52, -0.36, Z_TOP + 0.0006);

  /* ---------- 15. 晶振（金属壳，两个不同频点） ---------- */
  const xtalMat = kit.mat('metal', { color: 0xb0b6bd, roughness: 0.26, metalness: 0.9 });
  at(cbox(0.05, 0.04, 0.006, xtalMat, 0.004, 2), 0.235, 0.315, Z_TOP + 0.007);
  at(cbox(0.045, 0.032, 0.005, xtalMat, 0.004, 2), -0.47, 0.245, Z_TOP + 0.0065);

  /* ---------- 16. 背面：背板屏蔽罩 + 电池弹片 + 两颗大件 ---------- */
  at(cbox(0.30, 0.24, 0.008, canMat, 0.006, 2), -0.22, 0.10, Z_BOT - 0.004);
  at(cbox(0.09, 0.07, 0.006, chipMat, 0.004, 2), 0.16, 0.20, Z_BOT - 0.003);
  at(cbox(0.07, 0.06, 0.005, chipMat, 0.004, 2), 0.05, -0.22, Z_BOT - 0.0025);
  // 电池座：塑壳 + 4 根金色弹片（朝 -Z，压在电池保护板上）
  at(cbox(0.24, 0.075, 0.010, darkMat, 0.005, 2), 0.10, -0.02, Z_BOT - 0.005);
  at(kit.pins(4, 0.038, goldMat, { w: 0.013, h: 0.048, d: 0.003 }), 0.10, -0.02, Z_BOT - 0.014);

  return g;
}