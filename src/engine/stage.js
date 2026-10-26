/* ============================================================
   stage.js — 渲染器 / 场景 / 灯光 / 地面
   ------------------------------------------------------------
   深色虚空 + 一组低饱和柔光棚。DJI Action 4 本身是深石墨色，
   所以这盏棚灯的关键不是"打亮"，而是把轮廓、倒角、玻璃反射勾出来：
     · 一个大顶光：给机身正面（朝上的那个面）铺一层柔光
     · 暖/冷两侧：同一零件两面反射不同色相，体积感才出来
     · 背后一条冷蓝色轮廓光：深色件在深色底上的"边界"全靠它
     · 品牌红点缀：参考图里那点暗红反光，克制到只有边缘能看见
   ============================================================ */

import * as THREE from 'three';

function buildEnvironment(renderer) {
  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();

  const env = new THREE.Scene();
  // 环境比背景亮一档：金属件靠反射吃饭，环境一暗镜头压圈就整块发黑
  env.background = new THREE.Color(0x1a1f26);

  const panel = (color, intensity, w, h, pos, rot) => {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(intensity) })
    );
    m.position.set(...pos);
    m.rotation.set(...rot);
    env.add(m);
  };

  // 主顶光（大而柔，略偏冷）
  panel(0xdfe9f3, 2.25, 14, 14, [0, 9, 1.2], [Math.PI / 2, 0, 0]);
  // 暖侧（右侧来的低色温）
  panel(0xdcbe93, 1.05, 9, 11, [-8, 1.5, 2.5], [0, Math.PI / 2, 0]);
  // 冷侧
  panel(0x8fb2d6, 1.35, 9, 11, [8, 1.0, -1.5], [0, -Math.PI / 2, 0]);
  // 背后轮廓（细长条，专门勾机身边缘）
  panel(0xa8bdd6, 0.85, 14, 3.2, [0, 2.2, -9], [0, 0, 0]);
  // 品牌红：非常暗的一点，只在亚光塑料上留一丝暖红
  panel(0x8c2f28, 0.55, 6, 5, [0, -5.5, 6], [-Math.PI / 2.4, 0, 0]);
  // 地面反弹（防止下半身死黑）
  panel(0x3a3128, 0.75, 16, 16, [0, -6.5, 0], [-Math.PI / 2, 0, 0]);

  // 0.045 会让 PMREM 采样数超上限并刷警告，降到 0.028 消除
  const rt = pmrem.fromScene(env, 0.028);
  pmrem.dispose();
  env.traverse((o) => {
    if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); }
  });
  return rt.texture;
}

/** 地面：一圈从中心衰减的暖灰光斑（不用贴图文件，直接 canvas 画） */
function buildFloor() {
  const g = new THREE.Group();

  let tex = null;
  if (typeof document !== 'undefined') {
    const s = 512;
    const c = document.createElement('canvas');
    c.width = c.height = s;
    const x = c.getContext('2d');
    const gr = x.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    gr.addColorStop(0, 'rgba(150,168,186,0.30)');
    gr.addColorStop(0.42, 'rgba(120,136,152,0.10)');
    gr.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = gr;
    x.fillRect(0, 0, s, s);
    tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
  }

  const disc = new THREE.Mesh(
    new THREE.PlaneGeometry(22, 22),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.8, depthWrite: false })
  );
  disc.rotation.x = -Math.PI / 2;
  disc.position.y = -2.1;
  g.add(disc);

  // 极淡的圆环刻度（工业感，不抢主体）
  const ringMat = new THREE.MeshBasicMaterial({ color: 0x51606f, transparent: true, opacity: 0.16, depthWrite: false });
  for (let i = 1; i <= 3; i++) {
    const r = 2.2 * i;
    const ring = new THREE.Mesh(new THREE.RingGeometry(r - 0.006, r + 0.006, 128), ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = -2.095;
    g.add(ring);
  }
  return g;
}

export function createStage(canvas) {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: false,
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.06;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0a0c10);
  scene.fog = new THREE.FogExp2(0x0a0c10, 0.028);

  const camera = new THREE.PerspectiveCamera(34, window.innerWidth / window.innerHeight, 0.05, 120);
  camera.position.set(2.6, 1.5, 3.4);

  const env = buildEnvironment(renderer);
  scene.environment = env;
  scene.environmentIntensity = 1.0;

  // 灯光：环境贴图已经给了大部分体积感，实测光只负责阴影和高光
  const key = new THREE.DirectionalLight(0xf2f7fc, 2.05);
  key.position.set(3.4, 6.2, 4.6);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.near = 0.5;
  key.shadow.camera.far = 26;
  const sc = key.shadow.camera;
  sc.left = -4.2; sc.right = 4.2; sc.top = 4.2; sc.bottom = -4.2;
  key.shadow.bias = -0.0012;
  key.shadow.normalBias = 0.02;
  scene.add(key);

  const rim = new THREE.DirectionalLight(0x9dc3e8, 1.15);
  rim.position.set(-4.4, 2.2, -4.2);
  scene.add(rim);

  const fill = new THREE.DirectionalLight(0xdcc4a2, 0.5);
  fill.position.set(-3.2, -1.8, 3.0);
  scene.add(fill);

  const floor = buildFloor();
  scene.add(floor);

  const api = {
    renderer, scene, camera, floor,
    render() { renderer.render(scene, camera); },
    resize() {
      const w = window.innerWidth, h = window.innerHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setSize(w, h, false);
    },
  };
  window.addEventListener('resize', () => api.resize());
  return api;
}