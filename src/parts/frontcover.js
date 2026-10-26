/* ============================================================
   frontcover.js — 前面板 · 前屏（正面最外层）
   ------------------------------------------------------------
   真机这块是一整片 CNC 石墨色前面板，上面并排嵌着两套东西：
     · 右侧 Ø31.8 mm 的镜头开孔，孔缘一圈深色压铸护圈护住镜片
     · 左侧 1.4" 方形前屏（320×320），黑亮玻璃盖板下压着 HUD
   正面从外到内是：面板 → 外圈台阶 → 镜头护圈 / 屏边框 → 屏盖板。
   翻到背面才有"承载件"的样子：六颗螺丝柱、两根定位柱、屏幕排线座、
   镜头座补强钢圈、上下两条导电泡棉。
   分层取值全部写在注释里，改动时对着 slot（z 0.268–0.328）核。
   ============================================================ */

import * as THREE from 'three';

export default function build(env) {
  const { kit, detail } = env;
  const g = new THREE.Group();

  /* ---------- 0. 基准坐标（与 layout 的 slot 严格对齐） ---------- */
  const AX = 0.300;       // 镜头轴心 x
  const AY = 0.008;       // 镜头轴心 y
  const SX = -0.300;      // 前屏中心 x
  const SY = 0.008;       // 前屏中心 y
  const LENS_R = 0.318;   // 契约规定的镜头开孔半径
  const SCR_W = 0.504;    // 契约规定的方形屏窗口边长

  // 两个开孔路径：每一层板都复用它，孔位因此严格同轴
  const holeLens = detail.parts.circlePath(LENS_R, AX, AY);
  const holeScreen = detail.parts.rectPath(SCR_W, SCR_W, 0.062, SX, SY);

  /* ---------- 1. 主面板（带两孔的挤出板） ---------- */
  // 外廓比 slot 小 0.014：ExtrudeGeometry 的 bevel 会向外扩 bevelSize，
  // 先扣掉，实测包围盒才正好等于 1.41 × 0.884。
  const panel = detail.parts.plate(
    {
      w: 1.396, h: 0.870, r: 0.10,
      holes: [holeLens, holeScreen],
      depth: 0.026, bevel: 0.005,
    },
    kit.mat('body', { roughness: 0.68, metalness: 0.08 })
  );
  panel.position.z = 0.280;          // z ∈ [0.275, 0.311]
  g.add(panel);

  /* ---------- 2. 内背板：制造面差，也给螺丝柱一个根 ---------- */
  const backPlate = detail.parts.plate(
    {
      w: 1.340, h: 0.828, r: 0.094,
      holes: [holeLens, holeScreen],
      depth: 0.012, bevel: 0.004,
    },
    kit.mat('bodyDeep', { roughness: 0.82 })
  );
  backPlate.position.z = 0.272;      // z ∈ [0.268, 0.288]
  g.add(backPlate);

  /* ---------- 3. 正面外圈台阶：沿外缘高起的一圈窄边 ---------- */
  const frontRim = detail.parts.plate({
    w: 1.390, h: 0.864, r: 0.098,
    holes: [detail.parts.roundedRectShape(1.290, 0.764, 0.080)],
    depth: 0.012, bevel: 0.004,
  }, kit.mat('bodyDeep', { color: 0x343940, roughness: 0.55, metalness: 0.18 }));
  frontRim.position.z = 0.306;       // z ∈ [0.302, 0.322]
  g.add(frontRim);

  /* ---------- 4. 前屏：深底 + HUD + 盖板玻璃 + 黑边 ---------- */
  // 先垫一层深色底：从窗口看进去不能是通透的空洞
  const screenWell = detail.parts.plate(
    { w: 0.532, h: 0.532, r: 0.064, depth: 0.008, bevel: 0.002 },
    kit.mat('graphite', { color: 0x1b1f23 })
  );
  screenWell.position.set(SX, SY, 0.286);
  g.add(screenWell);

  // HUD：detail.tex.screen 现画 512² 取景框界面 —— 前面板离体后屏是亮的
  const hud = detail.tex.screen({ kind: 'front', w: 512, h: 512 });
  const hudMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.486, 0.486), detail.mat.screen(hud, { emissive: 0.95 }));
  hudMesh.position.set(SX, SY, 0.2965);
  g.add(hudMesh);

  // 盖板玻璃：有真实反射，屏幕才不像一块灰塑料
  const coverGlass = new THREE.Mesh(new THREE.PlaneGeometry(0.506, 0.506), detail.mat.glass({ color: 0x0b1015, opacity: 0.34, rough: 0.045 }));
  coverGlass.position.set(SX, SY, 0.3035);
  g.add(coverGlass);

  // 屏边框：黑亮细边，遮住盖板与开孔之间的工艺缝
  const scrBezel = detail.parts.plate({
    w: 0.556, h: 0.556, r: 0.072,
    holes: [detail.parts.rectPath(SCR_W, SCR_W, 0.060, 0, 0)],
    depth: 0.014, bevel: 0.003,
  }, kit.mat('bodyDeep', { color: 0x171b1f, roughness: 0.26, metalness: 0.34 }));
  scrBezel.position.set(SX, SY, 0.300);   // z ∈ [0.297, 0.317]
  g.add(scrBezel);

  /* ---------- 5. 镜头孔：压铸护圈 + 倒角环 + 三颗小螺丝 ---------- */
  const collar = detail.parts.ring(0.372, 0.330, 0.014,
    kit.mat('metalDark', { color: 0x3b4047, roughness: 0.38, metalness: 0.62 }), { seg: 44, bevel: 0.004 });
  collar.position.set(AX, AY, 0.306);     // z ∈ [0.302, 0.324]
  g.add(collar);

  // 孔缘倒角：把挤出板的直角边包掉，不然从侧面看是纸片
  const chamfer = detail.parts.ring(0.330, LENS_R, 0.006,
    kit.mat('bodyDeep', { color: 0x1b1f24, roughness: 0.5 }), { seg: 44, bevel: 0.0015 });
  chamfer.position.set(AX, AY, 0.309);
  g.add(chamfer);

  const screwMat = kit.mat('metalDark', { color: 0x535a63, roughness: 0.4, metalness: 0.8 });
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + Math.PI / 2;
    const sc = detail.parts.screw(0.013, screwMat);
    sc.rotation.x = Math.PI / 2;          // 螺丝原本朝 +Y，转成朝 +Z
    sc.position.set(AX + Math.cos(a) * 0.352, AY + Math.sin(a) * 0.352, 0.3065);
    g.add(sc);
  }

  /* ---------- 6. 麦克风微孔：一排 6 个 Ø0.017 的小孔 ---------- */
  const micMesh = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(0.0085, 0.0085, 0.007, 12),
    kit.mat('rubber', { color: 0x0c0f12 }),
    6
  );
  const micM = new THREE.Matrix4();
  const micQ = new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2, 0, 0));
  const one = new THREE.Vector3(1, 1, 1);
  for (let i = 0; i < 6; i++) {
    micM.compose(new THREE.Vector3(SX + (i - 2.5) * 0.034, -0.352, 0.3075), micQ, one);
    micMesh.setMatrixAt(i, micM);
  }
  micMesh.instanceMatrix.needsUpdate = true;
  micMesh.castShadow = micMesh.receiveShadow = true;
  g.add(micMesh);

  /* ---------- 7. 背面：螺丝柱 / 定位柱 / 排线座 / 补强圈 ---------- */
  const bossGeo = new THREE.CylinderGeometry(0.024, 0.026, 0.016, 16);
  const bossMat = kit.mat('bodyDeep', { color: 0x2a2f35 });
  const holeMat = kit.mat('rubber', { color: 0x0d1013 });
  const holeGeo = new THREE.CylinderGeometry(0.010, 0.010, 0.004, 10);
  const bosses = [
    [0.612, 0.352], [-0.612, 0.352], [0.612, -0.352], [-0.612, -0.352],
    [SX, 0.352], [SX, -0.352],
  ];
  for (const [x, y] of bosses) {
    // CylinderGeometry 的轴是 +Y，这里统一转 90° 让柱子朝后（-Z）
    const b = new THREE.Mesh(bossGeo, bossMat);
    b.rotation.x = Math.PI / 2;
    b.position.set(x, y, 0.271);          // z ∈ [0.263, 0.279]
    b.castShadow = b.receiveShadow = true;
    g.add(b);
    const h = new THREE.Mesh(holeGeo, holeMat);   // 柱顶的螺纹孔
    h.rotation.x = Math.PI / 2;
    h.position.set(x, y, 0.2625);
    g.add(h);
  }

  // 两根定位柱：装配时插进中框，颜色比壳体亮一档以示是金属件
  const pinGeo = new THREE.CylinderGeometry(0.011, 0.011, 0.014, 12);
  const pinMat = kit.mat('metal', { color: 0xb4bac1, roughness: 0.34, metalness: 0.8 });
  for (const sx of [-1, 1]) {
    const p = new THREE.Mesh(pinGeo, pinMat);
    p.rotation.x = Math.PI / 2;           // 定位柱朝后伸
    p.position.set(sx * 0.52, -0.300, 0.2725);
    p.castShadow = p.receiveShadow = true;
    g.add(p);
  }

  // 屏幕排线座：黑塑壳 + 一排金针
  const connBody = detail.parts.cbox(0.20, 0.058, 0.016, kit.mat('rubber', { color: 0x14181c }), 0.004, 2);
  connBody.position.set(SX, SY - 0.238, 0.270);
  g.add(connBody);
  const connPins = kit.pins(8, 0.021, kit.mats.gold, { w: 0.010, h: 0.010, d: 0.008 });
  connPins.position.set(SX, SY - 0.238, 0.2665);
  g.add(connPins);

  // 镜头座补强钢圈：拧螺丝时压住面板，是背面唯一的结构件
  const stiff = detail.parts.ring(0.336, 0.300, 0.005,
    kit.mat('steel', { color: 0x5a616a, roughness: 0.46, metalness: 0.7 }), { seg: 36, bevel: 0.001 });
  stiff.position.set(AX, AY, 0.2725);
  g.add(stiff);

  // 上下两条导电泡棉：压住主板屏蔽罩，顺带遮住背面的走线
  const foamMat = kit.mat('graphite', { color: 0x2b3035 });
  for (const sy of [-1, 1]) {
    const foam = detail.parts.cbox(1.10, 0.020, 0.008, foamMat, 0.004, 2);
    foam.position.set(0, sy * 0.402, 0.2715);
    g.add(foam);
  }

  /* ---------- 8. 丝印：右下角一小块参数标 ---------- */
  // 纯 Node 环境没有 document，贴图返回 null，这里必须判空
  const silk = detail.tex.label({
    lines: ['4K / 120', '155°  F2.8'],
    w: 384, h: 160, fg: 'rgba(206,214,222,0.55)',
  });
  if (silk) {
    const decal = detail.parts.decal(0.30, 0.125, silk, { opacity: 0.85 });
    decal.position.set(0.470, -0.352, 0.3115);
    g.add(decal);
  }

  return g;
}