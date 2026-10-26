/* ============================================================
   heatsink.js — 导热模组（石墨片 + 铜均热板 + 鳍片阵列 + 热管 + 导热垫 + 压片）
   ------------------------------------------------------------
   真机这颗是典型的"三层夹心"：贴着芯片的一面是黑石墨片（横向导热快、绝缘），
   中间是铜均热板（把热点摊开），朝外是一排铜鳍片吃结构风道；鳍片根部还埋着
   两根绕出来的烧结铜热管，靠相变把 SoC 的热量搬到远端。
   这块件的 slot 只有 2.5 mm 厚，所以整组堆叠必须是扁的，靠"平面内"的密度取胜：
     · 底层  —— 大面积黑石墨片 + 四周固定胶带，跟暖铜形成整块冷暖对比
     · 中层  —— 铜均热板（边缘铣台阶）+ 4 条导热铜箔带
     · 热管  —— 3 根沿鳍片根部走的铜管，鳍片间隙里能看见它们
     · 鳍片  —— 24 片，厚度 0.44–0.6 mm 交替、顶边倒圆，鳍间留出风道
     · 导热垫 —— 偏粉灰的软胶，被压扁后厚度变薄、四周鼓出来
     · 压片  —— 两条拉丝钢侧轨 + 4 个 Z 形弹片 + 顶部铜压条 + 4 颗螺丝
     · 铭牌  —— 石墨面上的丝印型号 + 一道气流箭头
   ============================================================ */

import * as THREE from 'three';

export default function build(env) {
  const { kit, detail, PART, mm } = env;
  const g = new THREE.Group();
  const S = PART.slot;

  /* ---------- 1. 基准：局部坐标以 slot 中心为原点 ---------- */
  const Z_BACK = S.cz - 0.025;      // 贴主板那一侧（0.030）
  const T_BASE = 0.010;             // 铜均热板厚
  const T_GRA = 0.008;              // 石墨片厚（压在铜板上，露出右半边的铜）

  const at = (mesh, x, y, z) => { mesh.position.set(S.cx + x, S.cy + y, z); g.add(mesh); return mesh; };
  const cbox = (w, h, d, m, r = 0.004, seg = 2) => detail.parts.cbox(w, h, d, m, r, seg);

  /* ---------- 2. 材质：一半暖铜、一半石墨灰 ---------- */
  const cuMat = kit.mat('copper', { color: 0xb5835f, roughness: 0.32, metalness: 0.78 });
  const cuLiteMat = kit.mat('copper', { color: 0xc4906a, roughness: 0.28, metalness: 0.8 });
  const cuDeepMat = kit.mat('copper', { color: 0x9c6f50, roughness: 0.4, metalness: 0.72 });
  const graMat = kit.mat('graphite', { color: 0x2b2f34, roughness: 0.94, metalness: 0.08 });
  const steelMat = kit.mat('steel', { color: 0x6d757d, roughness: 0.36, metalness: 0.84 });
  const padPink = kit.mat('rubber', { color: 0x9c8886, roughness: 0.9, metalness: 0.0 });
  const padGray = kit.mat('rubber', { color: 0x8b8f93, roughness: 0.92, metalness: 0.0 });
  const screwMat = kit.mat('metal', { color: 0x929aa2, roughness: 0.28, metalness: 0.9 });
  const tapeMat = kit.mat('graphite', { color: 0x17191c, roughness: 0.98 });

  /* ---------- 3. 铜均热板：整块的底，所有东西都压在它上面 ---------- */
  const baseZ = Z_BACK + T_BASE / 2;
  at(cbox(0.90, 0.56, T_BASE, cuMat, 0.004, 3), 0, 0, baseZ);
  // 边缘四条铣出来的台阶条：真机这里是一圈压出来的加强边
  for (const sy of [-1, 1]) {
    at(cbox(0.89, 0.022, 0.0022, cuLiteMat, 0.001, 1), 0, sy * 0.259, Z_BACK + T_BASE + 0.001);
  }
  for (const sx of [-1, 1]) {
    at(cbox(0.022, 0.50, 0.0022, cuLiteMat, 0.001, 1), sx * 0.434, 0, Z_BACK + T_BASE + 0.001);
  }

  /* ---------- 4. 石墨片：盖住左半边（"一半铜一半石墨灰"就靠这层） ---------- */
  const graZ = Z_BACK + T_BASE + T_GRA / 2;
  const graTop = graZ + T_GRA / 2;
  at(cbox(0.40, 0.56, T_GRA, graMat, 0.004, 3), -0.24, 0, graZ);
  // 石墨片上下两边压的黑胶带（真机上就是靠它固定的，是这道件的"软"细节）
  for (const sy of [-1, 1]) {
    at(cbox(0.42, 0.014, 0.0018, tapeMat, 0.001, 1), -0.24, sy * 0.272, graTop + 0.001);
  }

  /* ---------- 5. 铜箔走线：贴在石墨上面的几条导热铜带 ---------- */
  const foilMat = kit.mat('copper', { color: 0xc08a63, roughness: 0.36, metalness: 0.72 });
  [-0.20, -0.06, 0.10, 0.24].forEach((fy, i) => {
    g.add(kit.trace([
      [S.cx - 0.43, S.cy + fy, graTop + 0.001],
      [S.cx - 0.28, S.cy + fy + (i % 2 ? 0.012 : -0.012), graTop + 0.001],
      [S.cx - 0.06, S.cy + fy, graTop + 0.001],
    ], 0.0022, foilMat, 12));
  });

  /* ---------- 6. 热管：三根沿鳍片根部走的烧结铜管，鳍缝里能看见 ---------- */
  const pipeZ = Z_BACK + 0.024;     // 埋进鳍片根部
  [0.02, 0.19, 0.36].forEach((px, i) => {
    const sag = 0.003 + i * 0.001;
    g.add(kit.trace([
      [S.cx + px, S.cy - 0.252, pipeZ],
      [S.cx + px, S.cy, pipeZ + sag],
      [S.cx + px, S.cy + 0.252, pipeZ],
    ], 0.0068, cuDeepMat, 26));
    // 管端封头：两团被压圆的焊点，让管子有"封死了"的实感
    for (const sy of [-1, 1]) {
      const cap = kit.sphere(0.0082, 10, cuLiteMat);
      cap.scale.z = 0.8;
      at(cap, px, sy * 0.256, pipeZ);
    }
  });

  /* ---------- 7. 鳍片阵列：24 片，厚度/高度都做差，顶边倒圆 ---------- */
  const rnd = kit.rng(0x4a17);
  const FIN_H = 0.028;
  const finBase = graTop + 0.001;
  const finTop = finBase + FIN_H;
  for (let i = 0; i < 24; i++) {
    const fx = -0.02 + i * 0.019;
    // 厚度在 0.44–0.6 mm 之间交替；完全均匀会像格栅而不像散热器
    const t = i % 3 === 0 ? 0.012 : i % 2 === 0 ? 0.010 : 0.0088;
    const h = FIN_H * (0.95 + rnd() * 0.07);
    at(cbox(t, 0.52, h, i % 2 ? cuMat : cuLiteMat, 0.0026, 3), fx, 0, finBase + h / 2);
  }

  /* ---------- 8. 顶部压条：两条顺 X、两条跨 Y，把 24 片鳍片串成一体 ---------- */
  for (const sy of [-1, 1]) {
    at(cbox(0.45, 0.030, 0.005, cuMat, 0.002, 2), 0.20, sy * 0.235, finTop - 0.0005);
  }
  for (const bx of [-0.014, 0.424]) {
    at(cbox(0.014, 0.50, 0.005, cuLiteMat, 0.002, 2), bx, 0, finTop - 0.001);
  }

  /* ---------- 9. 导热垫：软胶被压扁 —— 厚度压薄、四周鼓出来 ---------- */
  const pad = (w, l, x, y, m) => {
    const p = cbox(w, l, 0.016, m, 0.006, 3);
    p.scale.set(1.08, 1.05, 0.58);      // 厚度方向(±Z)压到 58%，横向反而涨出去
    p.rotation.z = (x * y) % 0.06;
    at(p, x, y, graTop + 0.0048);
  };
  pad(0.17, 0.13, -0.25, -0.10, padPink);
  pad(0.15, 0.11, -0.25, -0.235, padGray);
  pad(0.07, 0.16, -0.40, 0.02, padPink);

  /* ---------- 10. 屏蔽罩：石墨片区上方一块冲孔钢罩（孔是真开的） ---------- */
  const vents = [];
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      vents.push(detail.parts.circlePath(0.0105, -0.072 + c * 0.072, -0.040 + r * 0.040));
    }
  }
  const shield = detail.parts.plate(
    { w: 0.235, h: 0.145, r: 0.005, holes: vents, depth: 0.005, bevel: 0.002 }, steelMat);
  at(shield, -0.25, 0.19, graTop + 0.002);
  // 罩子两侧的接地弹片
  for (const sx of [-1, 1]) {
    at(cbox(0.010, 0.10, 0.004, steelMat, 0.001, 1), -0.25 + sx * 0.124, 0.19, graTop + 0.004);
  }

  /* ---------- 11. 固定压片：两条钢侧轨 + 4 个 Z 形弹片 + 4 颗螺丝 ---------- */
  for (const sy of [-1, 1]) {
    at(cbox(0.90, 0.016, 0.029, steelMat, 0.004, 2), 0, sy * 0.272, Z_BACK + 0.0145);
  }
  for (const sy of [-1, 1]) {
    for (const cx0 of [-0.28, 0.20]) {
      // 竖片（卡在侧轨外侧）+ 向内伸的压爪
      at(cbox(0.05, 0.010, 0.034, steelMat, 0.002, 2), cx0, sy * 0.284, Z_BACK + 0.017);
      at(cbox(0.05, 0.030, 0.005, cuLiteMat, 0.002, 2), cx0, sy * 0.267, Z_BACK + 0.033);
    }
  }
  for (const sx of [-1, 1]) {
    for (const sy of [-1, 1]) {
      const sc = detail.parts.screw(0.016, screwMat);
      sc.rotation.x = Math.PI / 2;          // 螺丝从 +Z 面压进去
      at(sc, sx * 0.43, sy * 0.255, Z_BACK + 0.009);
    }
  }
  // 两个定位销：装配时先插进去再上螺丝，拆开时能看到这对小白点
  for (const [px, py] of [[-0.43, -0.27], [0.43, 0.27]]) {
    const pin = kit.cyl(0.011, 0.011, 0.014, 12, kit.mat('metal', { color: 0xb6bcc2 }));
    pin.rotation.x = Math.PI / 2;
    at(pin, px, py, Z_BACK + 0.007);
  }

  /* ---------- 12. 铭牌 + 气流箭头：石墨面是唯一够黑够大的地方放丝印 ---------- */
  const plateTex = detail.tex.label({
    lines: ['HEATSINK  HB02-HS', 'GRAPHITE + Cu VC'], w: 512, h: 160,
    fg: 'rgba(214,218,222,0.62)', align: 'left',
  });
  at(detail.parts.decal(0.19, 0.06, plateTex, { opacity: 0.95 }), -0.26, 0.035, graTop + 0.0012);
  const arrowTex = detail.tex.label({
    lines: ['AIR FLOW ►'], w: 256, h: 96, fg: 'rgba(226,196,150,0.72)', align: 'left',
  });
  at(detail.parts.decal(0.13, 0.049, arrowTex, { opacity: 0.9 }), -0.26, -0.165, graTop + 0.0012);

  /* ---------- 13. 铜板背面的导热硅脂痕：一层很薄的半透膜 ---------- */
  const grease = new THREE.Mesh(
    new THREE.CylinderGeometry(0.17, 0.17, 0.0015, 24),
    kit.mat('ceramic', { color: 0x6f6a63, roughness: 0.95 })
  );
  grease.rotation.x = Math.PI / 2;
  grease.scale.set(1.5, 1, 1.0);
  at(grease, 0.18, -0.02, Z_BACK + 0.001);

  return g;
}