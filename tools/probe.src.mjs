/* ============================================================
   probe.src.mjs — 部件几何自查（纯 Node，不启浏览器）
   ------------------------------------------------------------
   查什么：
     · 模块形状对不对（默认导出 build(env) → Group）
     · 包围盒是否落在 layout 给的 slot 里（越界量）
     · 有没有 NaN 顶点（NaN 会让整件在浏览器里消失，且不报错）
     · 三角面数是否在预算内
     · 是否残留 console.* / 引用了外部资源
     · 全部件模式下：内部件之间是否明显互相穿插
   ============================================================ */

import * as THREE from 'three';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createKit } from '../src/engine/kit.js';
import * as layout from '../src/data/layout.js';

const ROOT = path.resolve(import.meta.dirname, '..');
const PARTS_DIR = path.join(ROOT, 'src', 'parts');

const TOL = 0.035;              // slot 容差（单位 ≈ 1.75 mm）
const MIN_TRIS = 2500;
const MAX_TRIS = 45000;
const MAX_TRIS_TOTAL = 230000;
const INTERIOR = ['lens', 'sensor', 'heatsink', 'mainboard', 'battery'];

const C = {
  reset: '\x1b[0m', dim: '\x1b[2m', red: '\x1b[31m', grn: '\x1b[32m',
  yel: '\x1b[33m', cyn: '\x1b[36m', bold: '\x1b[1m',
};
const ok = (s) => `${C.grn}✔${C.reset} ${s}`;
const bad = (s) => `${C.red}✖${C.reset} ${s}`;
const warn = (s) => `${C.yel}!${C.reset} ${s}`;
const f3 = (n) => (Math.abs(n) < 1e-4 ? ' 0.000' : n.toFixed(3).padStart(6));

const kit = createKit();

/* ---------- 单个部件 ---------- */

async function loadPart(def) {
  const file = path.join(PARTS_DIR, `${def.id}.js`);
  const errors = [];
  const warns = [];

  if (!fs.existsSync(file)) {
    return { def, errors: [`缺少文件 src/parts/${def.id}.js`], warns };
  }
  const src = fs.readFileSync(file, 'utf8');

  // 静态检查
  if (/\bconsole\s*\./.test(src)) errors.push('源码里有 console.* 残留');
  if (/\bTODO\b|\bFIXME\b/.test(src)) warns.push('源码里有 TODO/FIXME');
  const extAsset = src.match(/["'`][^"'`]*\.(png|jpg|jpeg|glb|gltf|obj|hdr|svg|woff2?)["'`]/i);
  if (extAsset) errors.push(`引用了外部资源 ${extAsset[0]}`);
  const imports = [...src.matchAll(/^\s*import\s[^'"]*["']([^"']+)["']/gm)].map((m) => m[1]);
  const badImport = imports.filter((s) => s !== 'three' && !s.startsWith('.'));
  if (badImport.length) errors.push(`非法 import：${badImport.join(', ')}`);

  let mod;
  try {
    mod = await import(pathToFileURL(file).href);
  } catch (e) {
    return { def, errors: [`import 失败：${e.message}`], warns };
  }
  const build = mod.default;
  if (typeof build !== 'function') {
    return { def, errors: ['没有默认导出 build(env) 函数'], warns };
  }

  let group;
  try {
    group = build({ THREE, kit, detail: kit.detail, layout, PART: def, mm: 1 / 50 });
  } catch (e) {
    return { def, errors: [`build() 抛错：${e.message}`], warns };
  }
  if (!group || !group.isObject3D) {
    return { def, errors: ['build() 没有返回 THREE.Group / Object3D'], warns };
  }

  // NaN 扫描
  let nanCount = 0;
  group.traverse((o) => {
    if (o.isMesh && o.geometry?.attributes?.position) {
      const a = o.geometry.attributes.position.array;
      for (let i = 0; i < a.length; i++) if (!Number.isFinite(a[i])) { nanCount++; if (nanCount > 8) return; }
    }
    if (!Number.isFinite(o.position.x + o.position.y + o.position.z)) nanCount++;
  });
  if (nanCount) errors.push(`发现 ${nanCount} 处 NaN 坐标`);

  const stats = kit.stats(group);
  const box = new THREE.Box3().setFromObject(group);
  if (box.isEmpty()) errors.push('包围盒为空（没有可见网格？）');

  const s = def.slot;
  const slotMin = [s.cx - s.w / 2, s.cy - s.h / 2, s.cz - s.d / 2];
  const slotMax = [s.cx + s.w / 2, s.cy + s.h / 2, s.cz + s.d / 2];
  const bbMin = [box.min.x, box.min.y, box.min.z];
  const bbMax = [box.max.x, box.max.y, box.max.z];
  const over = [
    Math.max(0, slotMin[0] - bbMin[0], bbMax[0] - slotMax[0]),
    Math.max(0, slotMin[1] - bbMin[1], bbMax[1] - slotMax[1]),
    Math.max(0, slotMin[2] - bbMin[2], bbMax[2] - slotMax[2]),
  ];
  const worst = Math.max(...over);
  if (worst > TOL) {
    errors.push(`越界 ${f3(worst)} > 容差 ${TOL}（slot x[${f3(slotMin[0])},${f3(slotMax[0])}] y[${f3(slotMin[1])},${f3(slotMax[1])}] z[${f3(slotMin[2])},${f3(slotMax[2])}]，实测 x[${f3(bbMin[0])},${f3(bbMax[0])}] y[${f3(bbMin[1])},${f3(bbMax[1])}] z[${f3(bbMin[2])},${f3(bbMax[2])}]）`);
  } else if (worst > 0.008) {
    warns.push(`轻微越界 ${f3(worst)}（容差内）`);
  }

  if (stats.tris < MIN_TRIS) warns.push(`面数偏少 ${stats.tris} < ${MIN_TRIS}`);
  if (stats.tris > MAX_TRIS) errors.push(`面数超预算 ${stats.tris} > ${MAX_TRIS}`);

  // 越出机身包络（除底座/按键外都不许）
  const dmin = layout.DEVICE.min, dmax = layout.DEVICE.max;
  const envOver = Math.max(
    dmin[0] - bbMin[0], bbMax[0] - dmax[0],
    dmin[1] - bbMin[1], bbMax[1] - dmax[1],
    dmin[2] - bbMin[2], bbMax[2] - dmax[2]
  );
  const allow = def.id === 'mount' || def.id === 'topkeys' ? 0.09 : 0.004;
  if (envOver > allow) errors.push(`越出机身包络 ${f3(envOver)}`);

  return { def, errors, warns, stats, box, src };
}

/* ---------- 主流程 ---------- */

const argv = process.argv.slice(2).filter((a) => !a.startsWith('-'));
const target = argv[0];
const defs = target ? [layout.partDef(target)] : layout.PARTS;

console.log(`\n${C.bold}部件几何自查${C.reset} ${C.dim}(${defs.length} 件)${C.reset}`);
console.log(`${C.dim}slot 容差 ±${TOL}（≈${(TOL * 50).toFixed(1)} mm），面数预算 ${MIN_TRIS}–${MAX_TRIS}${C.reset}\n`);

let failed = 0, totalTris = 0, totalMeshes = 0;
const built = [];

for (const def of defs) {
  const r = await loadPart(def);
  const id = def.id.padEnd(11);
  if (r.errors.length) {
    failed++;
    console.log(`${bad(C.cyn + id + C.reset)} ${r.errors.join('；')}`);
    r.warns.forEach((w) => console.log(`            ${warn(w)}`));
    continue;
  }
  totalTris += r.stats.tris;
  totalMeshes += r.stats.meshes;
  built.push(r);
  const sb = r.box;
  console.log(
    `${ok(C.cyn + id + C.reset)} tris ${String(r.stats.tris).padStart(6)}  meshes ${String(r.stats.meshes).padStart(3)}  ` +
    `${C.dim}bbox x[${f3(sb.min.x)},${f3(sb.max.x)}] y[${f3(sb.min.y)},${f3(sb.max.y)}] z[${f3(sb.min.z)},${f3(sb.max.z)}]${C.reset}`
  );
  r.warns.forEach((w) => console.log(`            ${warn(w)}`));
}

/* 全部件模式：内部件互相穿插 + 总量 */
if (!target && built.length > 1) {
  if (totalTris > MAX_TRIS_TOTAL) {
    failed++;
    console.log(`\n${bad(`场景总面数 ${totalTris} 超出 ${MAX_TRIS_TOTAL}`)}`);
  }
  const byId = new Map(built.map((r) => [r.def.id, r]));
  console.log(`\n${C.bold}内部件穿插检查${C.reset} ${C.dim}(AABB 重叠体积 > 0.004 才提示)${C.reset}`);
  let overlapIssues = 0;
  for (let i = 0; i < INTERIOR.length; i++) {
    for (let j = i + 1; j < INTERIOR.length; j++) {
      const a = byId.get(INTERIOR[i]), b = byId.get(INTERIOR[j]);
      if (!a || !b) continue;
      const dx = Math.min(a.box.max.x, b.box.max.x) - Math.max(a.box.min.x, b.box.min.x);
      const dy = Math.min(a.box.max.y, b.box.max.y) - Math.max(a.box.min.y, b.box.min.y);
      const dz = Math.min(a.box.max.z, b.box.max.z) - Math.max(a.box.min.z, b.box.min.z);
      const vol = dx > 0 && dy > 0 && dz > 0 ? dx * dy * dz : 0;
      if (vol > 0.004) {
        overlapIssues++;
        console.log(`  ${warn(`${INTERIOR[i]} × ${INTERIOR[j]} 重叠 ${vol.toFixed(3)}`)} ${C.dim}(dx ${f3(dx)} dy ${f3(dy)} dz ${f3(dz)})${C.reset}`);
      }
    }
  }
  if (!overlapIssues) console.log(`  ${C.dim}无${C.reset}`);

  const missing = layout.PART_IDS.filter((id) => !byId.has(id));
  if (missing.length) console.log(`\n${warn(`还没做的部件：${missing.join(', ')}`)}`);
}

console.log(
  `\n${C.bold}合计${C.reset} ${C.dim}tris ${totalTris} / ${MAX_TRIS_TOTAL}　meshes ${totalMeshes}　` +
  `预算占用 ${((totalTris / MAX_TRIS_TOTAL) * 100).toFixed(0)}%${C.reset}`
);

if (failed) {
  console.log(`\n${bad(`${failed} 件未通过`)}\n`);
  process.exit(1);
}
console.log(`\n${ok('全部通过')}\n`);