/* ============================================================
   rearscreen.js — 2.5" 触摸屏模组（后屏）
   ------------------------------------------------------------
   后屏是整机背面唯一的面子，真机是「盖板玻璃 + 黑边丝印 + 触摸层 +
   LCD 组件 + 金属中框」压在一起的一摞：
     · 盖板玻璃：边缘 0.05 的倒角 + 一圈黑色丝印，透过玻璃看到窄黑边
     · 屏幕本体：1.14 × 0.64 的暗屏 HUD（detail.tex.screen 现画的）
     · 触摸层：一层几乎全透的 ITO 板，只有一点点反射
     · LCD 组件：玻璃基板 + 背光 + 银灰反射箔（拆开后从正面看得见背面）
     · 金属中框：整件的主结构，带两道加强筋
     · 触摸排线：从屏下边缘拐出来接到主板的 ZIF 座
   层与层之间刻意留 0.0005–0.002 的间隙，避免同面穿插导致的闪面。
   ============================================================ */

import * as THREE from 'three';

export default function build(env) {
  const { kit, detail } = env;
  const g = new THREE.Group();

  /* ---------- 0. 基准 ---------- */
  const CW = 1.30, CH = 0.72;     // 玻璃外形 = slot 尺寸
  const ZB = -0.328;              // 背面（观众这一侧）
  const CR = 0.056;               // 四角圆角半径

  const matMetal = kit.mat('metal', { color: 0xb4bbc3, roughness: 0.36, metalness: 0.72 });
  const matDark = kit.mat('rubber', { color: 0x08090b, roughness: 0.9 });
  const matLcd = kit.mat('silicon', { color: 0x171c22, roughness: 0.34, metalness: 0.22 });
  const matFoil = kit.mat('metal', { color: 0x9aa1a9, roughness: 0.5, metalness: 0.55 });

  /* ---------- 1. 盖板玻璃 ---------- */
  // 挤出面自带的倒角就是玻璃边缘那圈高光，比手工 chamfer 稳
  const glassMat = detail.mat.glass({ color: 0x0c1014, opacity: 0.34, rough: 0.05 });
  const glass = detail.parts.plate({
    w: CW - 0.006, h: CH - 0.006, r: CR, depth: 0.002, bevel: 0.003,
  }, glassMat);
  glass.position.set(0, 0, ZB + 0.003);
  g.add(glass);

  /* ---------- 2. 玻璃边缘的黑色丝印 ---------- */
  // 真机这圈黑边是印在玻璃内侧的，宽 3 mm，让玻璃边缘不透光
  const print = detail.parts.plate({
    w: CW - 0.010, h: CH - 0.010, r: CR - 0.004,
    holes: [detail.parts.rectPath(1.252, 0.672, 0.048)],
    depth: 0.001, bevel: 0.001,
  }, matDark);
  print.position.set(0, 0, ZB + 0.0075);
  g.add(print);

  /* ---------- 3. 黑边（显示区的边框，很窄） ---------- */
  const bezel = detail.parts.plate({
    w: 1.252, h: 0.672, r: 0.048,
    holes: [detail.parts.rectPath(1.145, 0.644, 0.032)],
    depth: 0.002, bevel: 0.001,
  }, matDark);
  bezel.position.set(0, 0, ZB + 0.0085);
  g.add(bezel);

  /* ---------- 4. 触摸层 ---------- */
  // 只留一点点反射，透过去才是屏；暗场里这一层几乎读不出来，但对边缘很关键
  const touch = detail.parts.plate({
    w: 1.24, h: 0.662, r: 0.044, depth: 0.001, bevel: 0.001,
  }, detail.mat.glass({ color: 0x161c22, opacity: 0.16, rough: 0.12 }));
  touch.position.set(0, 0, ZB + 0.011);
  g.add(touch);

  /* ---------- 5. 屏幕画面（暗屏 HUD） ---------- */
  const hud = detail.tex.screen({ kind: 'rear', w: 640, h: 360 });
  const lcdFace = new THREE.Mesh(new THREE.PlaneGeometry(1.14, 0.64), detail.mat.screen(hud, { emissive: 0.95 }));
  lcdFace.rotation.y = Math.PI;          // 屏幕朝 -Z（观众从背面看进来）
  lcdFace.position.set(0, 0, ZB + 0.0135);
  g.add(lcdFace);
  // 屏面四周压一圈极细的亮边，模拟 LCD 边缘的漏光
  const halo = detail.parts.plate({
    w: 1.156, h: 0.656, r: 0.03,
    holes: [detail.parts.rectPath(1.142, 0.642, 0.028)],
    depth: 0.001, bevel: 0.0005,
  }, kit.tint(0x39434d, { rough: 0.5, metal: 0.2, emissive: 0x1a2a33, emissiveIntensity: 0.6 }));
  halo.position.set(0, 0, ZB + 0.0138);
  g.add(halo);

  /* ---------- 6. LCD 组件 ---------- */
  // 玻璃基板 + 偏光片 + 背光，压成一块 0.03 厚的夹心
  const lcd = detail.parts.cbox(1.20, 0.68, 0.030, matLcd, 0.004, 2);
  lcd.position.set(0, 0, ZB + 0.029);
  g.add(lcd);
  // 背光反射箔：拆开后从侧面看到的那层银色
  const foil = detail.parts.cbox(1.18, 0.662, 0.004, matFoil, 0.002, 1);
  foil.position.set(0, 0, ZB + 0.0465);
  g.add(foil);
  // 一圈防水双面胶：屏模组和中框之间那层黑色胶
  for (const sz of [-1, 1]) {
    const tape = detail.parts.cbox(1.19, 0.010, 0.010, matDark, 0.002, 1);
    tape.position.set(0, sz * 0.336, ZB + 0.038);
    g.add(tape);
  }

  /* ---------- 7. 金属中框 ---------- */
  // 整件的结构件，中间开口让 LCD 透出来，边缘和机身中框贴合
  const frame = detail.parts.plate({
    w: CW - 0.008, h: CH - 0.008, r: 0.052,
    holes: [detail.parts.rectPath(1.17, 0.65, 0.02)],
    depth: 0.008, bevel: 0.002,
  }, matMetal);
  frame.position.set(0, 0, ZB + 0.050);
  g.add(frame);
  // 两道加强筋（横 / 竖各一）
  const ribH = detail.parts.cbox(0.92, 0.014, 0.006, matMetal, 0.002, 1);
  ribH.position.set(0, 0.14, ZB + 0.053);
  g.add(ribH);
  const ribV = detail.parts.cbox(0.014, 0.60, 0.006, matMetal, 0.002, 1);
  ribV.position.set(-0.40, 0, ZB + 0.053);
  g.add(ribV);

  /* ---------- 8. 触摸排线 + ZIF 连接器 ---------- */
  // 注意：flex 的宽度方向恒为 up × 切线（水平），所以排线路径必须 x 恒定、
  // 只沿 y/z 走，宽度才会整条落在 X 上；一旦横向偏移，0.07 的带宽会扫出
  // 0.07 的 z 跨度，把整个模组顶出机身包络
  const flexMat = kit.mat('bodyLite', { color: 0x6f5a3a, roughness: 0.82, metalness: 0.05 });
  const flex = detail.parts.flex([
    [0.40, 0.294, ZB + 0.028],
    [0.40, 0.316, ZB + 0.034],
    [0.40, 0.336, ZB + 0.046],
  ], 0.068, flexMat, 40);
  g.add(flex);
  // 屏边补强胶片
  const stiff = detail.parts.cbox(0.092, 0.026, 0.004, matDark, 0.002, 1);
  stiff.position.set(0.40, 0.298, ZB + 0.029);
  g.add(stiff);
  // ZIF 连接器：黑色翻盖 + 一排金手指触点
  const conn = detail.parts.cbox(0.086, 0.040, 0.012, kit.mat('rubber', { color: 0x14171a }), 0.003, 2);
  conn.position.set(0.40, 0.338, ZB + 0.049);
  g.add(conn);
  const pinMat = kit.mats.gold;
  for (let i = 0; i < 4; i++) {
    const pin = new THREE.Mesh(new THREE.BoxGeometry(0.011, 0.007, 0.004), pinMat);
    pin.position.set(0.376 + i * 0.016, 0.338, ZB + 0.0555);
    g.add(pin);
  }

  return g;
}