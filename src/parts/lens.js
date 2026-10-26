/* ============================================================
   lens.js — 镜头模组（155° 超广角）
   ------------------------------------------------------------
   真机是「铝压圈 + 三级镜筒 + 六片镜片 + 七叶光圈 + VCM」的堆叠：
     · 最外圈：阳极氧化铝压圈，侧壁一圈滚花（拧滤镜时防滑）
     · 压圈内侧：距离/刻度环，一圈镭雕刻度，是镜头最好认的细节
     · 三级镜筒：Ø0.290 → Ø0.262 → Ø0.236，逐级收细并带台阶倒角
     · 六片镜片：从 Ø0.250 的前玉收到 Ø0.130 的后组，曲率递减；
       前玉用 detail.mat.glass 拿真实反射，内组用低透玻璃叠出层次
     · 七叶光圈 + 后部铜线圈/磁钢（VCM）与 FPC 排线
   轴向 z 0.180（后）→ 0.328（前），全部落在 slot 里。
   ============================================================ */

import * as THREE from 'three';

export default function build(env) {
  const { kit, detail } = env;
  const g = new THREE.Group();

  /* ---------- 0. 光轴：与 layout 的 lensAxis 一致 ---------- */
  const AX = 0.300;
  const AY = 0.008;

  // 镜片统一按"球冠"造：给开口半径 a 与矢高 h，反推球半径 R 与张角
  const makeElement = (a, h, mat) => {
    const th = 2 * Math.atan(h / a);
    const R = a / Math.sin(th);
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(R, 28, 6, 0, Math.PI * 2, 0, th), mat);
    mesh.castShadow = mesh.receiveShadow = true;
    return { mesh, R, a, h };
  };
  // 镜片表面在半径 r 处的高度（用来把镀膜环贴在玻璃上，不穿模）
  const surfaceZ = (el, apexZ, r) => apexZ - (el.R - Math.sqrt(el.R * el.R - r * r));

  /* ---------- 1. 铝压圈 + 滚花 ---------- */
  const alu = kit.mat('metalDark', { color: 0x6d747d, roughness: 0.34, metalness: 0.78 });
  const trim = detail.parts.ring(0.318, 0.268, 0.024, alu, { seg: 44, bevel: 0.004 });
  trim.position.set(AX, AY, 0.298);       // z ∈ [0.294, 0.326]
  g.add(trim);

  // 滚花：44 条径向细棱，比直接给圆柱加分段更像"齿"
  const knurlMat = kit.mat('metalDark', { color: 0x7d848d, roughness: 0.30, metalness: 0.82 });
  const knurlGeo = new THREE.BoxGeometry(0.026, 0.0055, 0.020);
  const knurl = new THREE.InstancedMesh(knurlGeo, knurlMat, 44);
  const m4 = new THREE.Matrix4();
  for (let i = 0; i < 44; i++) {
    const a = (i / 44) * Math.PI * 2;
    m4.makeRotationZ(a).setPosition(AX + Math.cos(a) * 0.312, AY + Math.sin(a) * 0.312, 0.306);
    knurl.setMatrixAt(i, m4);
  }
  knurl.instanceMatrix.needsUpdate = true;
  knurl.castShadow = knurl.receiveShadow = true;
  g.add(knurl);

  /* ---------- 2. 刻度环（距离刻度） ---------- */
  const distRing = detail.parts.ring(0.270, 0.246, 0.012, kit.mat('bodyDeep', { color: 0x22262b, roughness: 0.55 }), { seg: 44, bevel: 0.002 });
  distRing.position.set(AX, AY, 0.302);  // z ∈ [0.300, 0.316]
  g.add(distRing);

  // 刻度：24 条，每 3 条加长一条（真机就是这样标最近/无穷远）
  const tickMat = kit.mat('metal', { color: 0xd2d8de, roughness: 0.32, metalness: 0.7 });
  const tickGeo = new THREE.BoxGeometry(0.016, 0.0042, 0.0016);
  const ticks = new THREE.InstancedMesh(tickGeo, tickMat, 24);
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    const rad = i % 3 === 0 ? 0.256 : 0.259;
    m4.makeRotationZ(a).setPosition(AX + Math.cos(a) * rad, AY + Math.sin(a) * rad, 0.3165);
    ticks.setMatrixAt(i, m4);
  }
  ticks.instanceMatrix.needsUpdate = true;
  g.add(ticks);

  /* ---------- 3. 三级镜筒（逐级收细 + 台阶倒角） ---------- */
  const barrelMat = kit.mat('metalDark', { color: 0x2c3138, roughness: 0.5, metalness: 0.55 });
  const barrels = [
    [0.290, 0.034, 0.281],   // 一级
    [0.262, 0.034, 0.249],   // 二级
    [0.236, 0.024, 0.222],   // 三级
  ];
  for (const [r, h, z] of barrels) {
    const b = kit.cyl(r, r, h, 48, barrelMat);
    b.rotation.x = Math.PI / 2;
    b.position.set(AX, AY, z);
    g.add(b);
  }
  // 台阶之间的过渡环，把圆柱的直边打断
  const stepRing = detail.parts.ring(0.292, 0.264, 0.006, kit.mat('metalDark', { color: 0x3a4047, roughness: 0.42, metalness: 0.62 }), { seg: 40, bevel: 0.0015 });
  stepRing.position.set(AX, AY, 0.266);
  g.add(stepRing);

  /* ---------- 4. 六片镜片 ---------- */
  // 前玉单独给一个玻璃材质：反射是这件的灵魂，不能用共享灰块
  const frontGlass = detail.mat.glass({ color: 0x0c1116, opacity: 0.30, rough: 0.03 });
  const innerGlass = kit.mat('glass', { color: 0x101822, opacity: 0.42, roughness: 0.05 });
  const rearGlass = kit.mat('glass', { color: 0x0d141c, opacity: 0.5, roughness: 0.06 });

  const elements = [
    // [开口半径, 矢高, 顶点 z, 材质, 是否朝后]
    [0.250, 0.014, 0.324, frontGlass, false],
    [0.230, 0.012, 0.302, innerGlass, false],
    [0.214, 0.011, 0.290, innerGlass, false],
    [0.192, 0.010, 0.262, innerGlass, false],
    [0.174, 0.009, 0.240, innerGlass, false],
    [0.130, 0.009, 0.184, rearGlass, true],
  ];
  const built = [];
  for (const [a, h, apex, mat, backward] of elements) {
    const el = makeElement(a, h, mat);
    el.mesh.rotation.x = backward ? -Math.PI / 2 : Math.PI / 2;
    // 球冠顶点在局部 +Z（朝后时为 -Z），据此把顶点摆到 apex
    el.mesh.position.set(AX, AY, backward ? apex + el.R : apex - el.R);
    g.add(el.mesh);
    built.push({ el, apex, backward });
  }

  // 镀膜环：贴在玻璃表面内侧的一圈彩色反射，模拟多层镀膜的干涉色
  const coat1 = kit.hueMat(0x6a80c0, { metal: 0.55, rough: 0.22 });
  const coat2 = kit.hueMat(0x7f6aa8, { metal: 0.5, rough: 0.26 });
  const ring1 = detail.parts.ring(0.244, 0.200, 0.0012, coat1, { seg: 40, bevel: 0 });
  ring1.position.set(AX, AY, surfaceZ(built[0].el, 0.324, 0.222) + 0.0006);
  g.add(ring1);
  const ring2 = detail.parts.ring(0.184, 0.146, 0.0012, coat2, { seg: 36, bevel: 0 });
  ring2.position.set(AX, AY, surfaceZ(built[2].el, 0.290, 0.165) + 0.0006);
  g.add(ring2);

  /* ---------- 5. 七叶光圈 ---------- */
  // 每片是一个偏心扇形：内缘窄、外缘宽，转起来就是错位叠放的叶片
  const bladeMat = kit.mat('metalDark', { color: 0x24282e, roughness: 0.52, metalness: 0.5 });
  const N = 7;
  const rIn = 0.086;
  const rOut = 0.176;
  const half = (Math.PI / N) * 1.12;
  for (let i = 0; i < N; i++) {
    const sh = new THREE.Shape();
    sh.moveTo(Math.cos(-half) * rIn, Math.sin(-half) * rIn);
    sh.lineTo(Math.cos(-half * 1.02) * rOut, Math.sin(-half * 1.02) * rOut);
    sh.lineTo(Math.cos(half * 1.02) * rOut, Math.sin(half * 1.02) * rOut);
    sh.lineTo(Math.cos(half * 0.30) * rIn, Math.sin(half * 0.30) * rIn);
    sh.closePath();
    const blade = new THREE.Mesh(new THREE.ExtrudeGeometry(sh, { depth: 0.0025, bevelEnabled: false, curveSegments: 4 }), bladeMat);
    blade.castShadow = blade.receiveShadow = true;
    const holder = new THREE.Group();
    holder.rotation.z = (i / N) * Math.PI * 2 + i * 0.045;   // 每片再错一点，叠出齿感
    holder.position.set(AX, AY, 0.246 + (i % 2) * 0.0014);
    holder.add(blade);
    g.add(holder);
  }

  /* ---------- 6. 后座：法兰 + VCM 线圈 / 磁钢 + 后组镜片 ---------- */
  const flange = detail.parts.ring(0.240, 0.170, 0.008, kit.mat('steel', { color: 0x535a63, roughness: 0.44, metalness: 0.72 }), { seg: 40, bevel: 0.0015 });
  flange.position.set(AX, AY, 0.206);
  g.add(flange);

  const hub = kit.cyl(0.160, 0.152, 0.020, 40, barrelMat);
  hub.rotation.x = Math.PI / 2;
  hub.position.set(AX, AY, 0.196);
  g.add(hub);

  // 铜线圈（两圈）+ 四颗磁钢：对焦/防抖马达，拆开后最容易认出的"铜+黑钢"组合
  const coilMat = kit.mat('copper', { roughness: 0.36, metalness: 0.7 });
  for (const [r, tube, z] of [[0.172, 0.013, 0.197], [0.172, 0.010, 0.187]]) {
    const coil = new THREE.Mesh(new THREE.TorusGeometry(r, tube, 8, 26), coilMat);
    coil.position.set(AX, AY, z);
    coil.castShadow = coil.receiveShadow = true;
    g.add(coil);
  }
  const magMat = kit.mat('magnet', { color: 0x4d545c });
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const mag = new THREE.Mesh(new THREE.BoxGeometry(0.024, 0.050, 0.016), magMat);
    mag.rotation.z = a;
    mag.position.set(AX + Math.cos(a) * 0.198, AY + Math.sin(a) * 0.198, 0.192);
    mag.castShadow = mag.receiveShadow = true;
    g.add(mag);
  }

  // 后座的固定小螺丝（朝后拧，藏在法兰下面）
  const screwMat = kit.mat('metalDark', { color: 0x50575f, roughness: 0.42, metalness: 0.8 });
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + 0.3;
    const sc = detail.parts.screw(0.011, screwMat);
    sc.rotation.x = -Math.PI / 2;
    sc.position.set(AX + Math.cos(a) * 0.205, AY + Math.sin(a) * 0.205, 0.2075);
    g.add(sc);
  }

  /* ---------- 7. 后部 FPC 排线 + 连接器 ---------- */
  const flexMat = kit.mat('rubber', { color: 0x2a2018, roughness: 0.8, metalness: 0.05 });
  const flex = detail.parts.flex([
    [AX, AY - 0.150, 0.198],
    [AX + 0.045, AY - 0.215, 0.198],
    [AX + 0.130, AY - 0.268, 0.197],
    [AX + 0.220, AY - 0.300, 0.197],
  ], 0.034, flexMat, 30);
  g.add(flex);

  const conn = detail.parts.cbox(0.062, 0.050, 0.010, kit.mat('rubber', { color: 0x14181c }), 0.004, 2);
  conn.position.set(AX + 0.226, AY - 0.300, 0.197);
  g.add(conn);
  const connPins = kit.pins(9, 0.012, kit.mats.gold, { w: 0.006, h: 0.006, d: 0.012 });
  connPins.position.copy(conn.position);
  g.add(connPins);

  return g;
}