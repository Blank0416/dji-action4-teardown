/* ============================================================
   render.src.mjs — 不开浏览器也能看几何：纯 Node 软件光栅化
   ------------------------------------------------------------
   为什么不用无头浏览器：本机 CPU 很容易被跑满，用户明确禁止。
   这里用 z-buffer + 平面着色 + 简易三光源，把 10 个部件渲成 PNG，
   够用来判断「形状对不对、有没有穿模、构图有没有出画」。

   局限：没有阴影/环境反射/抗锯齿，颜色偏平 —— 只看形，不看质感。
   ============================================================ */

import * as THREE from 'three';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

import { createKit } from '../src/engine/kit.js';
import * as layout from '../src/data/layout.js';

/* 部件模块用动态 import：并行开发期间某个文件可能还没落地，
   缺了只警告不中断，方便提前看已经写完的部件 */
const PART_IDS = ['frontcover', 'lens', 'sensor', 'heatsink', 'mainboard',
  'battery', 'rearscreen', 'topkeys', 'mount', 'shell'];
const MODULES = {};
for (const id of PART_IDS) {
  try {
    MODULES[id] = await import(`../src/parts/${id}.js`);
  } catch (err) {
    console.warn(`  ! 部件 ${id} 尚未就绪：${err.code || err.message}`);
  }
}

/* ---------------- 命令行 ---------------- */
const argv = process.argv.slice(2);
const arg = (name, def = null) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : def;
};
const P = Number(arg('p', '0'));
const W = Number(arg('w', '1000'));
const H = Number(arg('h', '640'));
const only = arg('part');
const shotArg = arg('shot');
const BG = 0x0a0c10;

const SHOT_TABLE = {
  closed: layout.SHOTS.closed,
  open: layout.SHOTS.open,
  top: { from: [0.9, 4.6, 1.6], look: [0.05, 0, 0], fov: 34 },
  front: { from: [0.5, 0.7, 4.9], look: [0.1, 0, 0], fov: 34 },
  back: { from: [-0.6, 0.9, -4.6], look: [0, 0, 0], fov: 34 },
  left: { from: [-4.6, 1.0, 1.2], look: [0, 0, 0], fov: 34 },
  right: { from: [4.6, 1.0, 1.2], look: [0, 0, 0], fov: 34 },
};
const shotName = shotArg ?? (P > 0.5 ? 'open' : 'closed');
const SHOT = SHOT_TABLE[shotName];
if (!SHOT) throw new Error(`未知机位 ${shotName}，可选：${Object.keys(SHOT_TABLE).join(', ')}`);
const outPath = arg('out', `tools/out/${shotName}-p${P}${only ? '-' + only : ''}.png`);

/* ---------------- 装场景 ---------------- */
const kit = createKit();
const env = { THREE, kit, detail: kit.detail, layout, mm: 1 / layout.APP.scale };
const scene = new THREE.Scene();

for (const def of layout.PARTS) {
  if (only && def.id !== only) continue;
  const mod = MODULES[def.id];
  if (!mod) continue;
  const group = mod.default({ ...env, PART: def });
  const e = easeInOut(localT(def, P));
  group.position.set(def.explode[0] * e, def.explode[1] * e, def.explode[2] * e);
  group.name = def.id;
  scene.add(group);
}
scene.updateMatrixWorld(true);

function easeInOut(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}
function localT(def, p) {
  const [t0, t1] = def.win;
  if (t1 <= t0) return 0;
  const u = (p - t0) / (t1 - t0);
  return u < 0 ? 0 : u > 1 ? 1 : u;
}

/* ---------------- 相机 ---------------- */
const camera = new THREE.PerspectiveCamera(SHOT.fov ?? 34, W / H, 0.05, 300);
camera.position.fromArray(SHOT.from);
camera.lookAt(new THREE.Vector3().fromArray(SHOT.look));
camera.updateMatrixWorld(true);
camera.updateProjectionMatrix();

const vp = new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
const view = camera.matrixWorldInverse;
const camPos = camera.position.clone();

/* ---------------- 缓冲 ---------------- */
const n = W * H;
const color = new Float32Array(n * 3);
const depth = new Float32Array(n).fill(Infinity);

const bg = new THREE.Color(BG);
const bgLin = [bg.r, bg.g, bg.b];
for (let i = 0; i < n; i++) {
  color[i * 3] = bgLin[0];
  color[i * 3 + 1] = bgLin[1];
  color[i * 3 + 2] = bgLin[2];
}

/* ---------------- 收集三角形 ---------------- */
const tris = []; // {x0,y0,z0,... , normal[3], col[3], alpha}
const LIGHT = new THREE.Vector3(0.42, 0.82, 0.5).normalize();
const LIGHT2 = new THREE.Vector3(-0.5, 0.35, -0.6).normalize();
const lightInv = view.clone();

let meshCount = 0;
let rawTris = 0;

scene.traverse((o) => {
  if (!o.isMesh || !o.visible) return;
  const mat = Array.isArray(o.material) ? o.material[0] : o.material;
  if (!mat) return;
  meshCount++;
  const geo = o.geometry;
  const pos = geo.attributes?.position;
  if (!pos) return;

  const baseCol = mat.color ? mat.color : new THREE.Color(0x888888);
  const emissive = mat.emissive ? mat.emissive : new THREE.Color(0, 0, 0);
  const emissiveIntensity = mat.emissiveIntensity ?? 0;
  const transparent = Boolean(mat.transparent) && (mat.opacity ?? 1) < 0.99;
  const alpha = transparent ? Math.max(0.18, (mat.opacity ?? 1) * 0.7) : 1;

  const matrix = o.matrixWorld;
  const instanced = o.isInstancedMesh ? o.count : 1;
  const instMat = new THREE.Matrix4();

  for (let k = 0; k < instanced; k++) {
    let m = matrix;
    if (o.isInstancedMesh) {
      o.getMatrixAt(k, instMat);
      m = new THREE.Matrix4().multiplyMatrices(matrix, instMat);
    }
    const index = geo.index;
    const count = index ? index.count : pos.count;
    for (let i = 0; i < count; i += 3) {
      const ia = index ? index.getX(i) : i;
      const ib = index ? index.getX(i + 1) : i + 1;
      const ic = index ? index.getX(i + 2) : i + 2;
      rawTris++;

      // 世界坐标顶点
      const ax = pos.getX(ia), ay = pos.getY(ia), az = pos.getZ(ia);
      const bx = pos.getX(ib), by = pos.getY(ib), bz = pos.getZ(ib);
      const cx = pos.getX(ic), cy = pos.getY(ic), cz = pos.getZ(ic);
      const wa = worldPoint(m, ax, ay, az);
      const wb = worldPoint(m, bx, by, bz);
      const wc = worldPoint(m, cx, cy, cz);

      // 法线（世界空间）
      const ux = wb[0] - wa[0], uy = wb[1] - wa[1], uz = wb[2] - wa[2];
      const vx = wc[0] - wa[0], vy = wc[1] - wa[1], vz = wc[2] - wa[2];
      let nx = uy * vz - uz * vy;
      let ny = uz * vx - ux * vz;
      let nz = ux * vy - uy * vx;
      const nl = Math.hypot(nx, ny, nz);
      if (nl < 1e-12) continue;
      nx /= nl; ny /= nl; nz /= nl;

      // 视线方向（用于双面判定与轮廓光）
      const mvx = (wa[0] + wb[0] + wc[0]) / 3 - camPos.x;
      const mvy = (wa[1] + wb[1] + wc[1]) / 3 - camPos.y;
      const mvz = (wa[2] + wb[2] + wc[2]) / 3 - camPos.z;
      const ml = Math.hypot(mvx, mvy, mvz) || 1;
      const vdx = mvx / ml, vdy = mvy / ml, vdz = mvz / ml;
      if (nx * vdx + ny * vdy + nz * vdz > 0) { nx = -nx; ny = -ny; nz = -nz; }

      // 投影
      const pa = project(vp, wa);
      const pb = project(vp, wb);
      const pc = project(vp, wc);
      if (!pa || !pb || !pc) continue;
      const area = (pb[0] - pa[0]) * (pc[1] - pa[1]) - (pb[1] - pa[1]) * (pc[0] - pa[0]);
      if (area >= -0.0001) continue; // 背面剔除（投影后逆时针为正，这里取负）

      // 光照：一主一辅 + 环境，饱和一点好判断形体
      const lam = Math.max(0, nx * LIGHT.x + ny * LIGHT.y + nz * LIGHT.z);
      const lam2 = Math.max(0, nx * LIGHT2.x + ny * LIGHT2.y + nz * LIGHT2.z);
      const rim = Math.pow(1 - Math.min(1, Math.abs(nx * vdx + ny * vdy + nz * vdz)), 3) * 0.35;
      const shade = 0.2 + 0.72 * lam + 0.22 * lam2 + rim;

      const er = emissive.r * emissiveIntensity;
      const eg = emissive.g * emissiveIntensity;
      const eb = emissive.b * emissiveIntensity;

      tris.push({
        x: [pa[0], pb[0], pc[0]],
        y: [pa[1], pb[1], pc[1]],
        w: [1 / pa[3], 1 / pb[3], 1 / pc[3]],
        r: Math.min(1, baseCol.r * shade + er),
        g: Math.min(1, baseCol.g * shade + eg),
        b: Math.min(1, baseCol.b * shade + eb),
        a: alpha,
      });
    }
  }
});
void lightInv;

/* ---------------- 光栅化 ---------------- */
const t0 = Date.now();
const opaque = tris.filter((t) => t.a >= 0.99);
const blended = tris.filter((t) => t.a < 0.99);

for (const t of opaque) raster(t, true);
// 半透明最后画：只做深度测试、不写深度（避免玻璃后面的东西被抹掉）
for (const t of blended) raster(t, false);

function raster(t, writeDepth) {
  const xs = t.x, ys = t.y;
  const minX = Math.max(0, Math.floor(Math.min(xs[0], xs[1], xs[2])));
  const maxX = Math.min(W - 1, Math.ceil(Math.max(xs[0], xs[1], xs[2])));
  const minY = Math.max(0, Math.floor(Math.min(ys[0], ys[1], ys[2])));
  const maxY = Math.min(H - 1, Math.ceil(Math.max(ys[0], ys[1], ys[2])));
  if (maxX < minX || maxY < minY) return;
  // 极小三角形（远小于一像素）直接丢掉，省时间
  const area = (xs[1] - xs[0]) * (ys[2] - ys[0]) - (xs[2] - xs[0]) * (ys[1] - ys[0]);
  if (Math.abs(area) < 0.12) return;
  const inv = 1 / area;

  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const px = x + 0.5, py = y + 0.5;
      const w0 = ((xs[1] - px) * (ys[2] - py) - (xs[2] - px) * (ys[1] - py)) * inv;
      const w1 = ((xs[2] - px) * (ys[0] - py) - (xs[0] - px) * (ys[2] - py)) * inv;
      const w2 = 1 - w0 - w1;
      if (w0 < 0 || w1 < 0 || w2 < 0) continue;
      const iw = w0 * t.w[0] + w1 * t.w[1] + w2 * t.w[2];
      if (iw <= 1e-9) continue;
      const d = 1 / iw;
      const idx = y * W + x;
      if (d > depth[idx]) continue;
      if (writeDepth) depth[idx] = d;
      if (t.a >= 0.99) {
        color[idx * 3] = t.r;
        color[idx * 3 + 1] = t.g;
        color[idx * 3 + 2] = t.b;
      } else {
        const a = t.a;
        color[idx * 3] = color[idx * 3] * (1 - a) + t.r * a;
        color[idx * 3 + 1] = color[idx * 3 + 1] * (1 - a) + t.g * a;
        color[idx * 3 + 2] = color[idx * 3 + 2] * (1 - a) + t.b * a;
      }
    }
  }
}

/* ---------------- 编码 PNG ---------------- */
const px = Buffer.alloc(n * 3);
for (let i = 0; i < n; i++) {
  // 线性 → sRGB 近似（Gamma 1/2.2），并把过暗的底噪压掉一点
  for (let c = 0; c < 3; c++) {
    const v = Math.pow(Math.min(1, Math.max(0, color[i * 3 + c])), 1 / 2.2);
    px[i * 3 + c] = Math.round(v * 255);
  }
}
const png = encodePNG(W, H, px);
fs.mkdirSync(path.dirname(path.resolve(outPath)), { recursive: true });
fs.writeFileSync(outPath, png);

console.log(
  `\n  ✔ ${outPath}\n    ${W}×${H} · ${shotName} 机位 · P=${P.toFixed(2)} · ` +
  `${rawTris} 三角 / ${meshCount} 网格 / ${opaque.length + blended.length} 可见 · ` +
  `光栅耗时 ${Date.now() - t0} ms · ${(png.length / 1024).toFixed(0)} KB\n`
);

/* ---------------- 工具函数 ---------------- */
function worldPoint(m, x, y, z) {
  const e = m.elements;
  return [
    e[0] * x + e[4] * y + e[8] * z + e[12],
    e[1] * x + e[5] * y + e[9] * z + e[13],
    e[2] * x + e[6] * y + e[10] * z + e[14],
  ];
}

/** 投影到屏幕坐标，返回 [sx, sy, ndcZ, w] */
function project(m, p) {
  const e = m.elements;
  const x = p[0], y = p[1], z = p[2];
  const w = e[3] * x + e[7] * y + e[11] * z + e[15];
  if (w <= 1e-5) return null;
  const nx = (e[0] * x + e[4] * y + e[8] * z + e[12]) / w;
  const ny = (e[1] * x + e[5] * y + e[9] * z + e[13]) / w;
  const nz = (e[2] * x + e[6] * y + e[10] * z + e[14]) / w;
  return [(nx * 0.5 + 0.5) * W, (1 - (ny * 0.5 + 0.5)) * H, nz, w];
}

function encodePNG(w, h, rgb) {
  const rowLen = w * 3 + 1;
  const raw = Buffer.alloc(rowLen * h);
  for (let y = 0; y < h; y++) {
    raw[y * rowLen] = 0; // filter: none
    rgb.copy(raw, y * rowLen + 1, y * w * 3, (y + 1) * w * 3);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });

  const chunks = [];
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  chunks.push(sig);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;   // bit depth
  ihdr[9] = 2;   // color type: truecolor
  ihdr[10] = 0;  // compression
  ihdr[11] = 0;  // filter
  ihdr[12] = 0;  // interlace
  chunks.push(chunk('IHDR', ihdr));
  chunks.push(chunk('IDAT', idat));
  chunks.push(chunk('IEND', Buffer.alloc(0)));
  return Buffer.concat(chunks);
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])) >>> 0, 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

let _crcTable = null;
function crcTable() {
  if (_crcTable) return _crcTable;
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[i] = c >>> 0;
  }
  _crcTable = t;
  return t;
}

function crc32(buf) {
  const T = crcTable();
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = T[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}