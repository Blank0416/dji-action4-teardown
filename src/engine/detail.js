/* ============================================================
   detail.js — 程序化贴图 + 细零件库
   ------------------------------------------------------------
   整个页面不加载任何外部图片/模型：所有表面纹理、丝印文字、
   屏幕 HUD 都是这里用 canvas 2D 现画出来的。
   纯 Node 环境（tools/probe.mjs、tools/render.mjs）没有 document，
   这里所有函数会退化成返回 null 贴图，几何与逻辑照常可测。
   ============================================================ */

import * as THREE from 'three';

const T = THREE;

/* ---------- canvas 基础设施 ---------- */

function cv(w, h) {
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

const NUL = { map: null, roughnessMap: null, normalMap: null, emissiveMap: null };

function rng(seed) {
  let a = (seed >>> 0) || 0x9e3779b9;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function toTex(canvas, { srgb = true, repeat = 1, aniso = 4 } = {}) {
  if (!canvas) return null;
  const t = new T.CanvasTexture(canvas);
  t.wrapS = t.wrapT = T.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  t.anisotropy = aniso;
  if (srgb) t.colorSpace = T.SRGBColorSpace;
  t.needsUpdate = true;
  return t;
}

/** 高度图 → 法线图（贴图细节的性价比核心） */
function heightToNormal(heightCanvas, strength = 2.0) {
  if (!heightCanvas) return null;
  const w = heightCanvas.width, h = heightCanvas.height;
  const src = heightCanvas.getContext('2d').getImageData(0, 0, w, h).data;
  const out = cv(w, h);
  const octx = out.getContext('2d');
  const img = octx.createImageData(w, h);
  const H = (x, y) => {
    const xx = (x + w) % w, yy = (y + h) % h;
    return src[((yy * w + xx) << 2)] / 255;
  };
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = (H(x + 1, y) - H(x - 1, y)) * strength;
      const dy = (H(x, y + 1) - H(x, y - 1)) * strength;
      const len = Math.hypot(dx, dy, 1);
      const i = ((y * w + x) << 2);
      img.data[i] = ((-dx / len) * 0.5 + 0.5) * 255;
      img.data[i + 1] = ((-dy / len) * 0.5 + 0.5) * 255;
      img.data[i + 2] = ((1 / len) * 0.5 + 0.5) * 255;
      img.data[i + 3] = 255;
    }
  }
  octx.putImageData(img, 0, 0);
  return out;
}

const shade = (hex, amt) => {
  const c = new T.Color(hex);
  c.offsetHSL(0, 0, amt);
  return c.getStyle();
};

/* ============================================================
   贴图
   ============================================================ */

function pcbTexture({ base = '#26343a', trace = '#3b5a54', silk = '#98a29c', size = 512, seed = 0x51a3 } = {}) {
  if (typeof document === 'undefined') return NUL;
  const c = cv(size, size), x = c.getContext('2d');
  const hgt = cv(size, size), hx = hgt.getContext('2d');
  const r = rng(seed);

  x.fillStyle = base; x.fillRect(0, 0, size, size);
  hx.fillStyle = '#8a8a8a'; hx.fillRect(0, 0, size, size);

  // 大面积覆铜（比阻焊亮一点点，让板子有"块面"）
  for (let i = 0; i < 6; i++) {
    const w = 90 + r() * 300, h = 70 + r() * 260;
    x.fillStyle = shade(base, 0.035 + r() * 0.02);
    x.fillRect(r() * (size - w), r() * (size - h), w, h);
  }

  // 走线
  const drawTrace = (pts, wpx, alpha) => {
    x.strokeStyle = `rgba(${parseInt(trace.slice(1, 3), 16)},${parseInt(trace.slice(3, 5), 16)},${parseInt(trace.slice(5, 7), 16)},${alpha})`;
    x.lineWidth = wpx; x.lineCap = 'round'; x.lineJoin = 'round';
    x.beginPath(); x.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) x.lineTo(pts[i][0], pts[i][1]);
    x.stroke();
    hx.strokeStyle = `rgba(255,255,255,${alpha * 0.7})`;
    hx.lineWidth = wpx; hx.stroke();
  };
  for (let i = 0; i < 80; i++) {
    let px = r() * size, py = r() * size;
    const n = 2 + Math.floor(r() * 3);
    const pts = [[px, py]];
    for (let s = 0; s < n; s++) {
      const horiz = r() < 0.5, len = 26 + r() * 130, dir = r() < 0.5 ? -1 : 1;
      if (horiz) { px += dir * len; py += (r() < 0.5 ? -1 : 1) * len * 0.3; }
      else { py += dir * len; px += (r() < 0.5 ? -1 : 1) * len * 0.3; }
      pts.push([px, py]);
    }
    drawTrace(pts, 1 + r() * 2.0, 0.4 + r() * 0.45);
  }

  // 过孔
  for (let i = 0; i < 170; i++) {
    const px = r() * size, py = r() * size, rad = 2.0 + r() * 2.2;
    x.beginPath(); x.arc(px, py, rad, 0, 6.2832);
    x.fillStyle = shade(base, -0.09); x.fill();
    x.beginPath(); x.arc(px, py, rad * 0.45, 0, 6.2832);
    x.fillStyle = '#1a2226'; x.fill();
    hx.beginPath(); hx.arc(px, py, rad, 0, 6.2832); hx.fillStyle = '#4a4a4a'; hx.fill();
  }

  // 丝印：细线框 + 假编号
  x.strokeStyle = `rgba(${parseInt(silk.slice(1, 3), 16)},${parseInt(silk.slice(3, 5), 16)},${parseInt(silk.slice(5, 7), 16)},0.42)`;
  x.lineWidth = 1.4;
  for (let i = 0; i < 26; i++) {
    const w = 24 + r() * 70, h = 16 + r() * 50;
    x.strokeRect(r() * (size - w), r() * (size - h), w, h);
  }
  x.fillStyle = `rgba(${parseInt(silk.slice(1, 3), 16)},${parseInt(silk.slice(3, 5), 16)},${parseInt(silk.slice(5, 7), 16)},0.5)`;
  const tags = ['U1', 'U2', 'C12', 'R7', 'L3', 'J1', 'Q4', 'TP2', 'D1', 'Y1'];
  for (let i = 0; i < 60; i++) {
    x.font = `600 ${8 + r() * 5}px "Consolas", monospace`;
    x.fillText(tags[Math.floor(r() * tags.length)], r() * size, r() * size);
  }

  return {
    map: toTex(c),
    normalMap: toTex(heightToNormal(hgt, 1.5), { srgb: false }),
    roughnessMap: toTex(c, { srgb: false }),
  };
}

function brushedTexture(hex, { size = 512, dir = 'x', seed = 0x2f11, strength = 0.08 } = {}) {
  const c = cv(size, size);
  if (!c) return null;
  const x = c.getContext('2d');
  const base = new T.Color(hex);
  x.fillStyle = base.getStyle(); x.fillRect(0, 0, size, size);
  const r = rng(seed);
  for (let i = 0; i < size * 2.6; i++) {
    const t = r();
    x.strokeStyle = base.clone().offsetHSL(0, 0, (t - 0.5) * strength * 2).getStyle();
    x.globalAlpha = 0.35 + r() * 0.5;
    x.lineWidth = r() < 0.85 ? 1 : 2;
    x.beginPath();
    if (dir === 'x') { const y = r() * size; x.moveTo(0, y); x.lineTo(size, y + (r() - 0.5) * 2); }
    else { const px = r() * size; x.moveTo(px, 0); x.lineTo(px + (r() - 0.5) * 2, size); }
    x.stroke();
  }
  x.globalAlpha = 1;
  return { map: toTex(c), normalMap: null, roughnessMap: toTex(c, { srgb: false }) };
}

function grainTexture(hex, { size = 256, amount = 14, seed = 0x7c3d } = {}) {
  const c = cv(size, size);
  if (!c) return null;
  const x = c.getContext('2d');
  const base = new T.Color(hex);
  x.fillStyle = base.getStyle(); x.fillRect(0, 0, size, size);
  const img = x.getImageData(0, 0, size, size);
  const d = img.data;
  const r = rng(seed);
  for (let i = 0; i < d.length; i += 4) {
    const n = (r() - 0.5) * amount;
    d[i] += n; d[i + 1] += n; d[i + 2] += n;
  }
  x.putImageData(img, 0, 0);
  return { map: toTex(c) };
}

/**
 * 丝印/铭牌：在透明底上写文字 + 细线框，用作 decal 贴片。
 * @param {object} o
 * @param {string[]|string} o.lines 文本行
 * @param {number} o.w 画布宽（px）
 * @param {number} o.h 画布高（px）
 * @param {string} o.fg 文字色
 * @param {string} [o.accent] 强调色（小色块）
 */
function labelTexture({ lines = [], w = 512, h = 256, fg = 'rgba(232,238,244,0.92)', accent = null, bg = null, pad = 24, align = 'left' } = {}) {
  if (typeof document === 'undefined') return null;
  const c = cv(w, h), x = c.getContext('2d');
  if (bg) { x.fillStyle = bg; x.fillRect(0, 0, w, h); }
  if (accent) { x.fillStyle = accent; x.fillRect(0, 0, pad * 0.9, h); }
  x.fillStyle = fg;
  x.textBaseline = 'middle';
  const arr = Array.isArray(lines) ? lines : [lines];
  const lh = (h - pad * 2) / Math.max(arr.length, 1);
  arr.forEach((ln, i) => {
    const size = Math.min(lh * 0.62, w * 0.11);
    x.font = `600 ${size}px "Microsoft YaHei", "Segoe UI", system-ui, sans-serif`;
    x.textAlign = align;
    x.fillText(ln, align === 'center' ? w / 2 : pad * 1.6, pad + lh * (i + 0.5));
  });
  const t = toTex(c);
  if (t) t.wrapS = t.wrapT = T.ClampToEdgeWrapping;
  return t;
}

/** 屏幕 HUD：给前屏/后屏做"开机但静止"的界面感（暗底 + 少量自发光） */
function screenTexture({ w = 512, h = 512, kind = 'front' } = {}) {
  if (typeof document === 'undefined') return NUL;
  const c = cv(w, h), x = c.getContext('2d');
  const e = cv(w, h), ex = e.getContext('2d');

  const g = x.createRadialGradient(w * 0.5, h * 0.42, w * 0.05, w * 0.5, h * 0.5, w * 0.85);
  g.addColorStop(0, '#10161c'); g.addColorStop(1, '#05080b');
  x.fillStyle = g; x.fillRect(0, 0, w, h);
  ex.fillStyle = '#000'; ex.fillRect(0, 0, w, h);

  const cyan = 'rgba(120,205,230,0.85)';
  const dim = 'rgba(150,170,185,0.35)';

  if (kind === 'front') {
    // 取景框角标
    x.strokeStyle = dim; x.lineWidth = 3;
    const m = w * 0.1;
    [[m, m, 1, 1], [w - m, m, -1, 1], [m, h - m, 1, -1], [w - m, h - m, -1, -1]].forEach(([px, py, sx, sy]) => {
      x.beginPath(); x.moveTo(px, py + sy * h * 0.09); x.lineTo(px, py); x.lineTo(px + sx * w * 0.09, py); x.stroke();
    });
    // REC
    x.fillStyle = '#e0403c';
    x.beginPath(); x.arc(w * 0.18, h * 0.13, w * 0.035, 0, 6.2832); x.fill();
    ex.fillStyle = 'rgba(224,64,60,0.9)';
    ex.beginPath(); ex.arc(w * 0.18, h * 0.13, w * 0.035, 0, 6.2832); ex.fill();
    x.fillStyle = cyan; x.font = `700 ${w * 0.11}px "Consolas", monospace`; x.textBaseline = 'middle';
    x.fillText('00:42', w * 0.27, h * 0.135);
    ex.fillStyle = 'rgba(120,205,230,0.55)';
    ex.font = `700 ${w * 0.11}px "Consolas", monospace`;
    ex.fillText('00:42', w * 0.27, h * 0.135);
    // 底部参数条
    x.fillStyle = dim; x.font = `600 ${w * 0.075}px "Consolas", monospace`;
    x.fillText('4K  120', w * 0.1, h * 0.87);
    x.fillText('D-LOG M', w * 0.46, h * 0.87);
  } else {
    // 后屏：状态栏 + 中央对焦框
    x.fillStyle = dim; x.font = `600 ${w * 0.05}px "Consolas", monospace`;
    x.fillText('4K/120  10-BIT  155°', w * 0.06, h * 0.12);
    x.fillText('1/500  f2.8  ISO 100', w * 0.06, h * 0.2);
    x.strokeStyle = cyan; x.lineWidth = 4;
    const cw = w * 0.18, ch = w * 0.18;
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sy]) => {
      const px = w / 2 + sx * cw, py = h / 2 + sy * ch;
      x.beginPath();
      x.moveTo(px, py - sy * ch * 0.5); x.lineTo(px, py); x.lineTo(px - sx * cw * 0.5, py);
      x.stroke();
    });
    x.fillStyle = 'rgba(232,238,244,0.5)';
    x.font = `600 ${w * 0.22}px "Consolas", monospace`;
    x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText('00:00:42', w / 2, h * 0.88);
    x.textAlign = 'left';
  }
  return { map: toTex(c), emissiveMap: toTex(e) };
}

/** 电池包皮：印刷字 + 条码 + 回收标识（锂电那点"真实感"全在这儿） */
function cellWrapperTexture({ w = 1024, h = 512 } = {}) {
  if (typeof document === 'undefined') return NUL;
  const c = cv(w, h), x = c.getContext('2d');
  x.fillStyle = '#8e979f'; x.fillRect(0, 0, w, h);
  // 上下银边（铝塑膜折边）
  const gr = x.createLinearGradient(0, 0, 0, h);
  gr.addColorStop(0, 'rgba(255,255,255,0.30)');
  gr.addColorStop(0.5, 'rgba(255,255,255,0.02)');
  gr.addColorStop(1, 'rgba(0,0,0,0.16)');
  x.fillStyle = gr; x.fillRect(0, 0, w, h);

  const ink = 'rgba(30,36,42,0.86)';
  x.fillStyle = ink;
  x.font = '700 58px "Microsoft YaHei", sans-serif'; x.textBaseline = 'middle';
  x.fillText('DJI  CBC02', 54, 90);
  x.font = '600 34px "Consolas", monospace';
  x.fillText('Li-ion Polymer  3.85V  1770mAh  6.80Wh', 54, 148);
  x.font = '600 26px "Consolas", monospace';
  x.fillText('MODEL HB02-1770  MADE IN CHINA', 54, 196);

  // 条码
  const r = rng(0x91b);
  let px = 60;
  for (let i = 0; i < 70; i++) {
    const bw = 2 + r() * 6;
    if (r() > 0.42) { x.fillStyle = 'rgba(24,28,33,0.9)'; x.fillRect(px, 236, bw, 74); }
    px += bw + 1 + r() * 2;
  }
  // 回收标识（简化三角箭头）
  x.strokeStyle = ink; x.lineWidth = 5;
  x.beginPath(); x.moveTo(w * 0.78, h - 90); x.lineTo(w * 0.86, h - 160); x.lineTo(w * 0.94, h - 90); x.closePath(); x.stroke();
  x.font = '700 30px "Consolas", monospace';
  x.fillText('Li-ion', w * 0.795, h - 70);

  return { map: toTex(c) };
}

/* ============================================================
   几何细零件
   ============================================================ */

/** 倒角盒：把 BoxGeometry 顶点往内收再补圆角，seg 越大越圆 */
function roundedBoxGeo(w, h, d, r = 0.02, seg = 3) {
  r = Math.min(r, Math.min(w, h, d) * 0.49);
  const g = new T.BoxGeometry(w, h, d, seg + 1, seg + 1, seg + 1);
  const pos = g.attributes.position;
  const hw = w / 2 - r, hh = h / 2 - r, hd = d / 2 - r;
  const v = new T.Vector3(), n = new T.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    n.set(
      Math.max(-1, Math.min(1, v.x / hw)),
      Math.max(-1, Math.min(1, v.y / hh)),
      Math.max(-1, Math.min(1, v.z / hd))
    );
    const len = n.length();
    if (len > 1e-6) n.divideScalar(len);
    v.set(
      Math.max(-hw, Math.min(hw, v.x)) + n.x * r,
      Math.max(-hh, Math.min(hh, v.y)) + n.y * r,
      Math.max(-hd, Math.min(hd, v.z)) + n.z * r
    );
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  return g;
}

/** 圆角矩形 Shape（可当挤出/挖孔用） */
function roundedRectShape(w, h, r = 0.03) {
  const s = new T.Shape();
  const x = -w / 2, y = -h / 2;
  r = Math.min(r, Math.min(w, h) * 0.49);
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h);
  s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

function circlePath(r, cx = 0, cy = 0) {
  const p = new T.Path();
  p.absarc(cx, cy, r, 0, Math.PI * 2, true);
  return p;
}

function rectPath(w, h, r = 0.02, cx = 0, cy = 0) {
  const p = new T.Path();
  const x = cx - w / 2, y = cy - h / 2;
  r = Math.min(r, Math.min(w, h) * 0.49);
  p.moveTo(x + r, y);
  p.lineTo(x + w - r, y);
  p.quadraticCurveTo(x + w, y, x + w, y + r);
  p.lineTo(x + w, y + h - r);
  p.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  p.lineTo(x + r, y + h);
  p.quadraticCurveTo(x, y + h, x, y + h - r);
  p.lineTo(x, y + r);
  p.quadraticCurveTo(x, y, x + r, y);
  return p;
}

/* ============================================================
   工厂
   ============================================================ */

export function createDetail(kit) {
  const cache = new Map();
  const memo = (key, fn) => {
    if (!cache.has(key)) cache.set(key, fn());
    return cache.get(key);
  };

  const tex = {
    pcb: (o = {}) => memo('pcb|' + JSON.stringify(o), () => pcbTexture(o)),
    brushed: (hex, o = {}) => memo('br|' + hex + '|' + JSON.stringify(o), () => brushedTexture(hex, o)),
    grain: (hex, o = {}) => memo('gr|' + hex + '|' + JSON.stringify(o), () => grainTexture(hex, o)),
    label: (o = {}) => memo('lb|' + JSON.stringify(o), () => labelTexture(o)),
    screen: (o = {}) => memo('sc|' + JSON.stringify(o), () => screenTexture(o)),
    cell: (o = {}) => memo('cw|' + JSON.stringify(o), () => cellWrapperTexture(o)),
    toTex,
    heightToNormal,
  };

  /* ---------- 材质 ---------- */

  const mat = {
    /** 屏幕玻璃：深色高反，几乎全透到 HUD 贴图 */
    screen(hud, { emissive = 1.0 } = {}) {
      return new T.MeshStandardMaterial({
        color: 0x0a0d10,
        roughness: 0.08,
        metalness: 0.55,
        map: hud?.map || null,
        emissive: new T.Color(0xffffff),
        emissiveMap: hud?.emissiveMap || null,
        emissiveIntensity: emissive,
      });
    },

    /** 透视玻璃（镜头玻璃、保护片）：不折射，只留反射与一点点底色 */
    glass({ color = 0x0e1318, opacity = 0.28, rough = 0.06 } = {}) {
      return new T.MeshPhysicalMaterial({
        color, roughness: rough, metalness: 0.1,
        transparent: true, opacity,
        side: T.DoubleSide, depthWrite: false,
      });
    },

    /** 透明贴片（丝印 decal） */
    decal(texture, { opacity = 1, color = 0xffffff } = {}) {
      return new T.MeshBasicMaterial({
        map: texture || null,
        transparent: true, opacity,
        color: new T.Color(color),
        depthWrite: false,
        polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4,
        toneMapped: true,
      });
    },
  };

  /* ---------- 细零件 ---------- */

  const parts = {
    roundedBoxGeo,

    /** 倒角盒 mesh */
    cbox(w, h, d, material, r = 0.02, seg = 3) {
      const m = new T.Mesh(roundedBoxGeo(w, h, d, r, seg), material);
      m.castShadow = m.receiveShadow = true;
      return m;
    },

    roundedRectShape,
    circlePath,
    rectPath,

    /**
     * 带孔的板（挤出）。用于前框/后框这类"中间要开口"的件。
     * @param {{w:number,h:number,r:number,holes:Array,y?:number,depth:number,bevel?:number}} o
     */
    plate({ w, h, r = 0.03, holes = [], depth = 0.04, bevel = 0.006 }, material) {
      const s = roundedRectShape(w, h, r);
      holes.forEach((hole) => s.holes.push(hole));
      const g = new T.ExtrudeGeometry(s, {
        depth, bevelEnabled: bevel > 0, bevelSize: bevel, bevelThickness: bevel,
        bevelSegments: 2, curveSegments: 20,
      });
      g.computeVertexNormals();
      const m = new T.Mesh(g, material);
      m.castShadow = m.receiveShadow = true;
      return m;
    },

    /** 沿 Shape 挤出的环形（镜头套筒那种） */
    tube({ outer, inner, depth, bevel = 0.004 }, material) {
      const s = new T.Shape();
      s.absarc(0, 0, outer, 0, Math.PI * 2, false);
      s.holes.push(circlePath(inner));
      const g = new T.ExtrudeGeometry(s, { depth, bevelEnabled: bevel > 0, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 2, curveSegments: 48 });
      g.computeVertexNormals();
      const m = new T.Mesh(g, material);
      m.castShadow = m.receiveShadow = true;
      return m;
    },

    /** 螺丝：圆柱 + 十字槽 + 一圈倒角 */
    screw(radius = 0.016, material = null, { head = 'cross' } = {}) {
      const g = new T.Group();
      const mm = material || kit.mat('metalDark');
      const r = radius;
      const body = new T.Mesh(new T.CylinderGeometry(r, r * 0.92, r * 0.7, 16), mm);
      body.position.y = r * 0.35;
      g.add(body);
      const top = new T.Mesh(new T.CylinderGeometry(r * 1.16, r * 1.16, r * 0.24, 18), mm);
      top.position.y = r * 0.82;
      g.add(top);
      if (head === 'cross') {
        const dk = kit.mat('metalDark', { color: 0x111417, roughness: 0.9, metalness: 0.2 });
        const a = new T.Mesh(new T.BoxGeometry(r * 1.5, r * 0.16, r * 0.3), dk);
        a.position.y = r * 0.95; g.add(a);
        const b = a.clone(); b.rotation.y = Math.PI / 2; g.add(b);
      }
      g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
      return g;
    },

    /** 接口：type-c / microsd / battery 触点排 */
    port(kind = 'usbc', { w = 0.15, h = 0.075 } = {}) {
      const g = new T.Group();
      const shellMat = kit.mat('metal', { color: 0x9aa2ab, roughness: 0.34, metalness: 0.85 });
      const darkMat = kit.mat('metalDark', { color: 0x0e1114, roughness: 0.92, metalness: 0.15 });
      const gold = kit.mats.gold;

      if (kind === 'usbc') {
        const body = parts.cbox(w, h * 0.62, 0.05, shellMat, 0.02, 3);
        body.rotation.x = Math.PI / 2;
        body.position.z = -0.02;
        g.add(body);
        const mouth = new T.Mesh(new T.BoxGeometry(w * 0.8, h * 0.34, 0.03), darkMat);
        mouth.position.z = 0.012; g.add(mouth);
        const tongue = new T.Mesh(new T.BoxGeometry(w * 0.62, h * 0.1, 0.036), gold);
        tongue.position.z = 0.016; g.add(tongue);
      } else if (kind === 'microsd') {
        const body = parts.cbox(w, h * 0.72, 0.04, shellMat, 0.006, 2);
        body.position.z = -0.02; g.add(body);
        const mouth = new T.Mesh(new T.BoxGeometry(w * 0.86, h * 0.5, 0.02), darkMat);
        mouth.position.z = 0.01; g.add(mouth);
      } else {
        // 电池触点：一排金色弹片
        for (let i = 0; i < 4; i++) {
          const t = new T.Mesh(new T.BoxGeometry(0.02, 0.012, 0.05), gold);
          t.position.set((i - 1.5) * 0.045, 0, 0);
          g.add(t);
        }
      }
      g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
      return g;
    },

    /** 贴片元件阵列（板子上铺一层，距离一远就是"电路感"） */
    smdField(count, { w = 0.016, h = 0.010, d = 0.010 } = {}, material = null, seed = 0x4b2) {
      const geo = new T.BoxGeometry(w, h, d);
      const mesh = new T.InstancedMesh(geo, material || kit.mats.ceramic, count);
      const r = rng(seed);
      const dummy = new T.Object3D();
      mesh.userData.fill = (x0, x1, y0, y1, z, s = 1) => {
        const rr = rng(seed + s);
        for (let i = 0; i < count; i++) {
          dummy.position.set(x0 + rr() * (x1 - x0), y0 + rr() * (y1 - y0), z + (rr() - 0.5) * 0.004);
          dummy.rotation.set(0, rr() < 0.5 ? 0 : Math.PI / 2, 0);
          dummy.scale.setScalar(0.7 + rr() * 0.7);
          dummy.updateMatrix();
          mesh.setMatrixAt(i, dummy.matrix);
        }
        mesh.instanceMatrix.needsUpdate = true;
        return mesh;
      };
      mesh.castShadow = mesh.receiveShadow = true;
      return mesh;
    },

    /** 扁平排线：沿折线的扁带（用 TubeGeometry 压扁不够稳，这里自己铺面） */
    flex(points, width = 0.08, material = null, samples = 40) {
      const pts = points.map((p) => new T.Vector3(...p));
      const curve = new T.CatmullRomCurve3(pts, false, 'catmullrom', 0.3);
      const pos = [], idx = [];
      const up = new T.Vector3(0, 1, 0);
      const a = new T.Vector3(), b = new T.Vector3(), t = new T.Vector3(), wv = new T.Vector3();
      for (let i = 0; i <= samples; i++) {
        const u = i / samples;
        const p = curve.getPointAt(u);
        curve.getTangentAt(u, t);
        wv.crossVectors(up, t);
        if (wv.lengthSq() < 1e-6) wv.set(1, 0, 0);
        wv.normalize().multiplyScalar(width / 2);
        a.copy(p).add(wv); b.copy(p).sub(wv);
        pos.push(a.x, a.y, a.z, b.x, b.y, b.z);
      }
      for (let i = 0; i < samples; i++) {
        const o = i * 2;
        idx.push(o, o + 1, o + 2, o + 1, o + 3, o + 2);
      }
      const g = new T.BufferGeometry();
      g.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
      g.setIndex(idx);
      g.computeVertexNormals();
      const m = new T.Mesh(g, material || kit.mat('plasticDark', { color: 0x22262b, roughness: 0.85, side: T.DoubleSide }));
      m.castShadow = m.receiveShadow = true;
      return m;
    },

    /** 透明贴片（丝印/铭牌），默认朝 +Z 贴在 z 平面上 */
    decal(w, h, texture, { opacity = 1, color = 0xffffff } = {}) {
      const m = new T.Mesh(new T.PlaneGeometry(w, h), mat.decal(texture, { opacity, color }));
      m.renderOrder = 2;
      return m;
    },

    /**
     * 圆形开孔器：返回一个"带一圈螺丝孔的环"（镜头周围那种）
     * @param {number} rOut 外半径
     * @param {number} rIn 内半径
     * @param {number} depth 深度
     */
    ring(rOut, rIn, depth, material, { seg = 64, bevel = 0.004 } = {}) {
      const s = new T.Shape();
      s.absarc(0, 0, rOut, 0, Math.PI * 2, false);
      s.holes.push(circlePath(rIn));
      const g = new T.ExtrudeGeometry(s, { depth, bevelEnabled: bevel > 0, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 2, curveSegments: seg });
      g.computeVertexNormals();
      const m = new T.Mesh(g, material);
      m.castShadow = m.receiveShadow = true;
      return m;
    },
  };

  return { tex, mat, parts, T };
}

export default createDetail;