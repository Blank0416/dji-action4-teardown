/* ============================================================
   kit.js — 共享材质库 + 几何脚手架
   ------------------------------------------------------------
   10 个部件全部只用这套材质建模，保证质感是同一种语言：
   深石墨机身 + 低饱和金属 + 铜/金点缀，明度集中在 30%–75%。
   背景是深色虚空，所以机身基色比"实物"亮一档 —— 这是照明补偿，
   不是配色偏好（纯黑件在暗场里会糊成一整块剪影）。
   ============================================================ */

import * as THREE from 'three';
import { createDetail } from './detail.js';

/* ---------- 1. 材质库 ---------- */

function buildMaterials() {
  const S = (o) => new THREE.MeshStandardMaterial(o);
  const P = (o) => new THREE.MeshPhysicalMaterial(o);

  return {
    // 机身主色：深石墨灰，磨砂塑料（真机就是这种细腻的哑光）
    body: S({ color: 0x3b4047, roughness: 0.74, metalness: 0.04 }),
    // 略深的边圈/防滚条
    bodyDeep: S({ color: 0x2c3036, roughness: 0.8, metalness: 0.03 }),
    // 略亮的装饰件（按键帽、边框）
    bodyLite: S({ color: 0x4a5058, roughness: 0.66, metalness: 0.06 }),

    // 铝合金：镜头压圈、卡扣。金属感收一点，否则暗环境里整块发黑
    metal: S({ color: 0xa9b0b8, roughness: 0.42, metalness: 0.66 }),
    metalDark: S({ color: 0x626871, roughness: 0.48, metalness: 0.6 }),

    // 深色结构件、屏蔽罩、螺丝
    steel: S({ color: 0x4c525a, roughness: 0.45, metalness: 0.72 }),
    magnet: S({ color: 0x585f68, roughness: 0.36, metalness: 0.85 }),

    // 电路板：深青灰，哑光（不用真实阻焊绿，太饱和）
    pcb: S({ color: 0x2b3a3c, roughness: 0.76, metalness: 0.06 }),

    // 裸晶片：极暗冷调，表面略有光泽
    silicon: S({ color: 0x222932, roughness: 0.3, metalness: 0.18 }),

    // 铜：均热板、热管
    copper: S({ color: 0xa8765a, roughness: 0.34, metalness: 0.72 }),

    // 金手指/触点：低饱和哑金
    gold: S({ color: 0xb99b62, roughness: 0.4, metalness: 0.76 }),

    // 电池铝塑膜（贴图会带颜色，故 color 置白在 decorate 里处理）
    cell: S({ color: 0x8e979f, roughness: 0.52, metalness: 0.26 }),

    // 陶瓷/电容封装
    ceramic: S({ color: 0x9d9789, roughness: 0.6, metalness: 0.04 }),

    // 石墨片、导热垫：几乎全黑、极哑
    graphite: S({ color: 0x22262b, roughness: 0.92, metalness: 0.06 }),

    // 橡胶：卡槽门、密封圈
    rubber: S({ color: 0x191c20, roughness: 0.95, metalness: 0.0 }),

    // 玻璃：屏幕、镜头保护片。不做真折射（太贵），靠反射和高光读出来
    glass: P({
      color: 0x0b0f13, roughness: 0.07, metalness: 0.45,
      transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false,
    }),
  };
}

/* ---------- 1.5 程序化贴图挂到共享材质上 ---------- */

function decorate(detail, mats) {
  const put = (m, t, color, over) => {
    if (!t) return;
    if (t.map) m.map = t.map;
    if (t.normalMap) {
      m.normalMap = t.normalMap;
      m.normalScale = new THREE.Vector2(0.4, 0.4);
    }
    if (t.roughnessMap) m.roughnessMap = t.roughnessMap;
    m.color = new THREE.Color(color);
    if (over) Object.assign(m, over);
    m.needsUpdate = true;
  };

  put(mats.pcb, detail.tex.pcb({ base: '#2b3c3b', trace: '#3d5c55', silk: '#9ba39d' }), 0xffffff, {
    normalScale: new THREE.Vector2(0.55, 0.55), roughness: 0.72,
  });
  put(mats.body, detail.tex.grain(0x42474e, { repeat: 4, amount: 13 }), 0xffffff);
  put(mats.bodyDeep, detail.tex.grain(0x32373d, { repeat: 4, amount: 12 }), 0xffffff);
  put(mats.bodyLite, detail.tex.grain(0x51575f, { repeat: 4, amount: 12 }), 0xffffff);
  put(mats.metal, detail.tex.brushed(0xb2b9c1, { repeat: 3 }), 0xffffff);
  put(mats.metalDark, detail.tex.brushed(0x6d737c, { repeat: 3, strength: 0.07 }), 0xffffff);
  put(mats.steel, detail.tex.brushed(0x585f68, { repeat: 3, strength: 0.08 }), 0xffffff);
  put(mats.copper, detail.tex.brushed(0xb58467, { repeat: 2.5, strength: 0.06 }), 0xffffff);
  put(mats.cell, detail.tex.cell(), 0xffffff);
  put(mats.graphite, null, 0x22262b);

  // 金手指：只加极细凹凸，颜色不动（哑金要保准）
  const g = detail.tex.grain(0xb99b62, { size: 128, amount: 8, repeat: 4 });
  if (g && g.map) {
    mats.gold.normalMap = null;
    mats.gold.needsUpdate = true;
  }
}

/* ---------- 2. 工具 ---------- */

function makeRng(seed) {
  let a = (seed >>> 0) || 0x9e3779b9;
  return function rng() {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const damp = (cur, target, lambda, dt) => target + (cur - target) * Math.exp(-lambda * Math.max(dt, 0));
const clamp01 = (t) => (t < 0 ? 0 : t > 1 ? 1 : t);
const easeInOut = (t) => { t = clamp01(t); return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
const easeOut = (t) => 1 - Math.pow(1 - clamp01(t), 3);
const easeIn = (t) => Math.pow(clamp01(t), 3);
const easeOutBack = (t) => {
  const c1 = 1.70158, c3 = c1 + 1; t = clamp01(t);
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};

function accent(hex, amt = 0) {
  const c = new THREE.Color(hex);
  const t = amt > 0 ? 0xffffff : 0x000000;
  c.lerp(new THREE.Color(t), Math.min(Math.abs(amt), 1));
  return c.getHex();
}

/* ---------- 3. kit 工厂 ---------- */

export function createKit() {
  const mats = buildMaterials();
  const cache = new Map();
  const mark = (m) => { m.castShadow = true; m.receiveShadow = true; return m; };

  const kit = {
    THREE,
    mats,

    mat(name, over) {
      const base = mats[name];
      if (!base) throw new Error(`[kit] 未知材质 "${name}"，可用：${Object.keys(mats).join(', ')}`);
      if (!over) return base;
      const key = name + '|' + JSON.stringify(over);
      if (cache.has(key)) return cache.get(key);
      const m = base.clone();
      Object.assign(m, over);
      if (over.color !== undefined) m.color = new THREE.Color(over.color);
      cache.set(key, m);
      return m;
    },

    tint(hex, o = {}) {
      const key = 'tint|' + hex + '|' + JSON.stringify(o);
      if (cache.has(key)) return cache.get(key);
      const m = new THREE.MeshStandardMaterial({
        color: new THREE.Color(hex),
        roughness: o.rough ?? 0.62,
        metalness: o.metal ?? 0.08,
      });
      if (o.emissive !== undefined) {
        m.emissive = new THREE.Color(o.emissive);
        m.emissiveIntensity = o.emissiveIntensity ?? 0.35;
      }
      cache.set(key, m);
      return m;
    },

    glow(hex, intensity = 1.2) {
      const key = `glow|${hex}|${intensity}`;
      if (cache.has(key)) return cache.get(key);
      const m = new THREE.MeshStandardMaterial({
        color: new THREE.Color(hex),
        emissive: new THREE.Color(hex),
        emissiveIntensity: intensity,
        roughness: 0.5, metalness: 0,
        toneMapped: false,
      });
      cache.set(key, m);
      return m;
    },

    /* ---------- 几何快捷 ---------- */
    box(w, h, d, mat, seg) {
      return mark(new THREE.Mesh(new THREE.BoxGeometry(w, h, d, seg, seg, seg), mat));
    },
    cyl(rt, rb, h, seg, mat, open) {
      return mark(new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg, 1, !!open), mat));
    },
    sphere(r, seg, mat) {
      return mark(new THREE.Mesh(new THREE.SphereGeometry(r, seg, Math.max(4, seg / 2)), mat));
    },
    plane(w, h, mat) {
      return mark(new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat));
    },

    pins(n, spacing, mat, { w = 0.03, h = 0.06, d = 0.012 } = {}) {
      const g = new THREE.Group();
      const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(w, h, d), mat, n);
      const m4 = new THREE.Matrix4();
      const x0 = -((n - 1) * spacing) / 2;
      for (let i = 0; i < n; i++) { m4.makeTranslation(x0 + i * spacing, 0, 0); mesh.setMatrixAt(i, m4); }
      mesh.instanceMatrix.needsUpdate = true;
      mesh.castShadow = mesh.receiveShadow = true;
      g.add(mesh);
      return g;
    },

    trace(points, radius = 0.02, mat, tubular = 24) {
      const pts = points.map((p) => (Array.isArray(p) ? new THREE.Vector3(...p) : p));
      const curve = new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.4);
      const geo = new THREE.TubeGeometry(curve, tubular, radius, 6, false);
      const mesh = mark(new THREE.Mesh(geo, mat));
      mesh.userData.curve = curve;
      return mesh;
    },

    pointOn(mesh, t) {
      return mesh.userData.curve.getPointAt(clamp01(t));
    },

    grid(cols, rows, cell, fn, { centered = true } = {}) {
      const g = new THREE.Group();
      const ox = centered ? -((cols - 1) * cell) / 2 : 0;
      const oy = centered ? -((rows - 1) * cell) / 2 : 0;
      for (let j = 0; j < rows; j++) {
        for (let i = 0; i < cols; i++) {
          const o = fn(ox + i * cell, oy + j * cell, i, j);
          if (o) { o.position.x += ox + i * cell; o.position.y += oy + j * cell; g.add(o); }
        }
      }
      return g;
    },

    dot(x, y, z, mat, size = 0.03) {
      const m = new THREE.Mesh(new THREE.SphereGeometry(size, 8, 6), mat);
      m.position.set(x, y, z);
      return m;
    },

    rng: makeRng,
    damp, clamp01, easeInOut, easeOut, easeIn, easeOutBack, accent,

    hueMat(hex, opts) {
      return kit.tint(hex, { rough: 0.55, metal: 0.1, ...opts });
    },

    stats(root) {
      let tris = 0, meshes = 0;
      root.traverse((o) => {
        if (!o.isMesh) return;
        meshes++;
        const g = o.geometry;
        if (!g) return;
        const count = g.index ? g.index.count : (g.attributes.position ? g.attributes.position.count : 0);
        tris += (count / 3) * (o.isInstancedMesh ? o.count : 1);
      });
      return { tris: Math.round(tris), meshes };
    },
  };

  const detail = createDetail(kit);
  // 纯 Node 环境没有 document：跳过贴图挂载，几何/拆解逻辑照常可测
  if (typeof document !== 'undefined') decorate(detail, mats);
  kit.detail = detail;

  return kit;
}