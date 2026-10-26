/* ============================================================
   sensor.js — 影像传感器模组（1/1.3" CMOS 堆叠封装）
   ------------------------------------------------------------
   从下往上就是一条真实的封装流水线：
     ① BGA 焊球阵列 —— 贴在主板上的焊点
     ② 有机基板 —— 走线/贴片元件/排线座
     ③ 陶瓷封装框 —— 四面围墙，中间开口留出器件腔
     ④ 硅片 die —— 中央的感光面，边缘打金线到陶瓷焊盘
     ⑤ 微透镜 / 彩色滤光层 —— 一层半球阵列，靠反光看出网格
     ⑥ 蓝玻璃 IR 滤光片 —— 半透明偏青蓝，本身是块"玻璃"
     ⑦ 金属屏蔽框 —— 把滤镜压在框上，最顶面到 slot 上沿
   中心 (0.280, 0)，z 从 0.090 走到 0.175。
   ============================================================ */

import * as THREE from 'three';

export default function build(env) {
  const { kit, detail } = env;
  const g = new THREE.Group();

  const CX = 0.280;
  const CY = 0;
  const at = (mesh, z) => { mesh.position.set(CX, CY, z); return mesh; };

  /* ---------- 1. BGA 焊球（6×5 阵列，落在 z=0.090） ---------- */
  const ballMat = kit.mat('metal', { color: 0xb8bec6, roughness: 0.26, metalness: 0.9 });
  const ballGeo = new THREE.SphereGeometry(0.0045, 6, 4);
  const balls = new THREE.InstancedMesh(ballGeo, ballMat, 30);
  {
    const m = new THREE.Matrix4();
    let i = 0;
    for (let ix = 0; ix < 6; ix++) {
      for (let iy = 0; iy < 5; iy++) {
        m.makeTranslation(CX - 0.180 + ix * 0.072, CY - 0.130 + iy * 0.065, 0.0945);
        balls.setMatrixAt(i++, m);
      }
    }
    balls.instanceMatrix.needsUpdate = true;
    balls.castShadow = balls.receiveShadow = true;
    g.add(balls);
  }

  /* ---------- 2. 有机基板 + 贴片元件 + 排线座 ---------- */
  const pcbMat = kit.mat('pcb', { color: 0x243230, roughness: 0.72 });
  g.add(at(detail.parts.cbox(0.460, 0.400, 0.024, pcbMat, 0.012, 2), 0.110));

  // 板边金手指：传感器模组直接压在主板连接器上
  const fingerMat = kit.mat('gold', { roughness: 0.34, metalness: 0.85 });
  g.add(at(kit.pins(16, 0.026, fingerMat, { w: 0.018, h: 0.004, d: 0.010 }), 0.1225));

  // 陶瓷框两侧的贴片元件带（远看就是"电路感"）
  const smdMat = kit.mat('ceramic', { color: 0x8d8779, roughness: 0.6 });
  for (const s of [-1, 1]) {
    const f = detail.parts.smdField(34, { w: 0.014, h: 0.009, d: 0.008 }, smdMat, 0xa11 + s);
    f.userData.fill(0.070, 0.490, CY + s * 0.170, CY + s * 0.192, 0.1235, 2 + s);
    g.add(f);
  }

  /* ---------- 3. 陶瓷封装框（四面墙 + 内台阶） ---------- */
  const cerMat = kit.mat('ceramic', { roughness: 0.56, metalness: 0.04 });
  // 外墙：0.36×0.30，中间开 0.252×0.212 的腔
  g.add(at(detail.parts.plate({
    w: 0.360, h: 0.300, r: 0.020,
    holes: [detail.parts.rectPath(0.252, 0.212, 0.012)],
    depth: 0.026, bevel: 0.003,
  }, cerMat), 0.125));
  // 内台阶：腔底一圈承片台，把 die 托起来
  g.add(at(detail.parts.plate({
    w: 0.252, h: 0.212, r: 0.012,
    holes: [detail.parts.rectPath(0.200, 0.160, 0.008)],
    depth: 0.008, bevel: 0.0015,
  }, kit.mat('ceramic', { color: 0x7d776a, roughness: 0.62 })), 0.1395));

  /* ---------- 4. 硅片 die（中央感光面） ---------- */
  const dieMat = kit.mat('silicon', { color: 0x2b3442, roughness: 0.30, metalness: 0.55 });
  g.add(at(detail.parts.cbox(0.190, 0.150, 0.015, dieMat, 0.002, 2), 0.1295));
  // die 边缘的一圈密封环（深色细框，让硅片的边界更清楚）
  g.add(at(detail.parts.plate({
    w: 0.194, h: 0.154, r: 0.002,
    holes: [detail.parts.rectPath(0.184, 0.144, 0.002)],
    depth: 0.0012, bevel: 0,
  }, kit.mat('graphite')), 0.1372));

  /* ---------- 5. 彩色滤光层（彩虹膜）+ 微透镜网格 ---------- */
  // 彩虹膜：一层极薄的高光面，斜角看会泛蓝紫 —— CMOS 感光面就是这个味道
  g.add(at(detail.parts.plate({
    w: 0.186, h: 0.146, r: 0.002, depth: 0.0018, bevel: 0,
  }, kit.hueMat(0x3f5f96, { metal: 0.62, rough: 0.18 })), 0.1382));

  // 微透镜：10×8 半球阵列，压在这层膜上
  const lensGeo = new THREE.SphereGeometry(0.0078, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2);
  const lensMat = kit.hueMat(0x6f86b8, { metal: 0.35, rough: 0.22 });
  const microlens = new THREE.InstancedMesh(lensGeo, lensMat, 80);
  {
    const m = new THREE.Matrix4();
    let i = 0;
    for (let ix = 0; ix < 10; ix++) {
      for (let iy = 0; iy < 8; iy++) {
        m.makeTranslation(CX - 0.0855 + ix * 0.019, CY - 0.0648 + iy * 0.0185, 0.1392);
        microlens.setMatrixAt(i++, m);
      }
    }
    microlens.instanceMatrix.needsUpdate = true;
    microlens.castShadow = microlens.receiveShadow = true;
    g.add(microlens);
  }

  /* ---------- 6. 金线键合（die 边缘 → 陶瓷焊盘） ---------- */
  const wireMat = kit.mat('gold', { color: 0xc9a866, roughness: 0.28, metalness: 0.92 });
  const padMat = kit.mat('gold', { color: 0xb08f52, roughness: 0.36, metalness: 0.85 });
  const pads = [];
  const wire = (x0, y0, x1, y1) => {
    g.add(kit.trace([
      [CX + x0, CY + y0, 0.1376],
      [CX + (x0 + x1) / 2, CY + (y0 + y1) / 2, 0.1452],
      [CX + x1, CY + y1, 0.1402],
    ], 0.0022, wireMat, 10));
  };
  // 上下各 7 根，左右各 5 根
  for (let i = 0; i < 7; i++) {
    const x = -0.075 + i * 0.025;
    for (const s of [-1, 1]) {
      wire(x, s * 0.072, x, s * 0.101);
      pads.push([x, s * 0.101, 0]);
    }
  }
  for (let i = 0; i < 5; i++) {
    const y = -0.060 + i * 0.030;
    for (const s of [-1, 1]) {
      wire(s * 0.092, y, s * 0.121, y);
      pads.push([s * 0.121, y, 1]);
    }
  }
  // 焊盘：24 个金色小方块，长边朝腔心
  const padGeo = new THREE.BoxGeometry(0.014, 0.010, 0.0018);
  const padMesh = new THREE.InstancedMesh(padGeo, padMat, pads.length);
  {
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const one = new THREE.Vector3(1, 1, 1);
    const eu = new THREE.Euler();
    pads.forEach(([x, y, rot], i) => {
      eu.set(0, 0, rot ? Math.PI / 2 : 0);
      q.setFromEuler(eu);
      m.compose(new THREE.Vector3(CX + x, CY + y, 0.1406), q, one);
      padMesh.setMatrixAt(i, m);
    });
    padMesh.instanceMatrix.needsUpdate = true;
    g.add(padMesh);
  }

  /* ---------- 7. 蓝玻璃 IR 滤光片 ---------- */
  const irGlass = detail.mat.glass({ color: 0x1c4c66, opacity: 0.42, rough: 0.05 });
  g.add(at(detail.parts.plate({
    w: 0.300, h: 0.260, r: 0.008, depth: 0.007, bevel: 0.0015,
  }, irGlass), 0.1555));

  /* ---------- 8. 金属屏蔽框（压住滤镜，顶到 slot 上沿） ---------- */
  const shieldMat = kit.mat('steel', { color: 0x5b636d, roughness: 0.38, metalness: 0.8 });
  g.add(at(detail.parts.plate({
    w: 0.345, h: 0.300, r: 0.014,
    holes: [detail.parts.roundedRectShape(0.302, 0.262, 0.010)],
    depth: 0.011, bevel: 0.002,
  }, shieldMat), 0.162));
  // 框内侧的一圈内衬，遮住滤镜与框之间的缝
  g.add(at(detail.parts.plate({
    w: 0.302, h: 0.262, r: 0.010,
    holes: [detail.parts.rectPath(0.296, 0.256, 0.008)],
    depth: 0.004, bevel: 0.001,
  }, kit.mat('metalDark', { color: 0x30363d, roughness: 0.5 })), 0.1598));

  /* ---------- 9. 四角安装螺丝 ---------- */
  const screwMat = kit.mat('metalDark', { color: 0x767d86, roughness: 0.34, metalness: 0.85 });
  for (const sx of [-1, 1]) {
    for (const sy of [-1, 1]) {
      const sc = detail.parts.screw(0.013, screwMat);
      sc.rotation.x = Math.PI / 2;                     // 朝向 +Z 拧
      sc.position.set(CX + sx * 0.200, CY + sy * 0.163, 0.1215);
      g.add(sc);
    }
  }

  /* ---------- 10. 侧向 FPC 排线 + 连接器 ---------- */
  const flexMat = kit.mat('rubber', { color: 0x2a2118, roughness: 0.82, metalness: 0.05 });
  g.add(detail.parts.flex([
    [CX + 0.150, CY - 0.150, 0.115],
    [CX + 0.195, CY - 0.192, 0.115],
    [CX + 0.220, CY - 0.225, 0.115],
    [CX + 0.228, CY - 0.246, 0.115],
  ], 0.046, flexMat, 26));
  const conn = detail.parts.cbox(0.078, 0.062, 0.026, kit.mat('rubber', { color: 0x15191d }), 0.006, 2);
  conn.position.set(CX + 0.222, CY - 0.246, 0.115);
  g.add(conn);
  g.add((() => {
    const p = kit.pins(8, 0.014, padMat, { w: 0.008, h: 0.008, d: 0.014 });
    p.position.set(CX + 0.222, CY - 0.246, 0.115);
    return p;
  })());

  return g;
}