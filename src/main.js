/* ============================================================
   main.js — 集成层：把「引擎 + 数据 + 10 个部件」拧成一个页面
   ------------------------------------------------------------
   这一层只做四件事，其余全部交给下层：
     1. 装配：建舞台、装部件、给每件算包围盒
     2. 进度：一个全局拆解进度 P，各部件按自己的 win 窗口错峰移动
     3. 交互：拖拽环绕 / 滚轮缩放 / 点击选中 / 键盘
     4. 界面：清单、详情面板、3D 标签、底部滑杆
   部件模块不碰 DOM，UI 不碰几何 —— 两边只在这里相遇。
   ============================================================ */

import '../tokens.css';
import '../ui.css';

import * as THREE from 'three';
import { createStage } from './engine/stage.js';
import { createCameraRig } from './engine/camera.js';
import { createKit } from './engine/kit.js';
import * as layout from './data/layout.js';
import { COPY, GUIDE, LOADING, ORDER_TIP, copyOf } from './data/copy.js';

/* 部件模块：用命名空间导入，这样可选导出 update(t) 也能拿到 */
import * as modFrontcover from './parts/frontcover.js';
import * as modLens from './parts/lens.js';
import * as modSensor from './parts/sensor.js';
import * as modHeatsink from './parts/heatsink.js';
import * as modMainboard from './parts/mainboard.js';
import * as modBattery from './parts/battery.js';
import * as modRearscreen from './parts/rearscreen.js';
import * as modTopkeys from './parts/topkeys.js';
import * as modMount from './parts/mount.js';
import * as modShell from './parts/shell.js';

const MODULES = {
  frontcover: modFrontcover,
  lens: modLens,
  sensor: modSensor,
  heatsink: modHeatsink,
  mainboard: modMainboard,
  battery: modBattery,
  rearscreen: modRearscreen,
  topkeys: modTopkeys,
  mount: modMount,
  shell: modShell,
};

const $ = (sel) => document.querySelector(sel);
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const damp = (cur, target, lambda, dt) => target + (cur - target) * Math.exp(-lambda * Math.max(dt, 0));

/* ------------------------------------------------------------
   状态：全部可寻址的东西收在一处，方便调试时打快照
   ------------------------------------------------------------ */
const state = {
  P: 0,            // 当前拆解进度（0 = 合拢，1 = 全拆）
  targetP: 0,      // 目标进度（滑杆/自动播放写入，显示用 P 平滑追它）
  playing: false,
  dir: 1,
  selected: null,  // 选中的部件 id
  hovered: null,
  labels: true,
  spin: true,
  dragging: false,
  dragDist: 0,
};

/* ------------------------------------------------------------
   装配：舞台 / 机位 / 材质库 / 部件
   ------------------------------------------------------------ */
const canvas = $('#stage');
const stage = createStage(canvas);
const rig = createCameraRig(stage.camera);
const kit = createKit();

const env = {
  THREE,
  kit,
  detail: kit.detail,
  layout,
  mm: 1 / layout.APP.scale,
};

/** @type {{def, group, mod, box, center, radius, labelEl, glow:boolean}[]} */
const parts = [];
const byId = new Map();
const explodeV = new THREE.Vector3();
const tmpBox = new THREE.Box3();
const tmpV = new THREE.Vector3();
/** 相机当前"被设计成看哪里"，用来判断选中部件是否已经跑出画面中心 */
const aimAt = new THREE.Vector3();

function buildParts() {
  for (const def of layout.PARTS) {
    const mod = MODULES[def.id];
    if (!mod || typeof mod.default !== 'function') {
      throw new Error(`[main] 部件模块缺失：src/parts/${def.id}.js 需要默认导出 build(env)`);
    }
    const group = mod.default({ ...env, PART: def });
    group.name = def.id;
    // 射线选中靠这个：命中任意子网格都能回溯到部件
    group.traverse((o) => { o.userData.partId = def.id; });
    stage.scene.add(group);

    tmpBox.setFromObject(group);
    const center = tmpBox.getCenter(new THREE.Vector3());
    const size = tmpBox.getSize(new THREE.Vector3());

    const part = {
      def, group, mod,
      box: tmpBox.clone(),
      center,
      radius: Math.max(size.x, size.y, size.z) * 0.5,
      labelEl: null,
      glow: false,
    };
    parts.push(part);
    byId.set(def.id, part);
  }
}

/* ------------------------------------------------------------
   高亮：给选中/悬停的部件加自发光
   ------------------------------------------------------------
   不直接改原材质（改了会把共享给别的件的实例一起点亮），
   而是每个网格第一次被点亮时克隆一份材质并缓存原材质，
   取消时换回去。整页最坏情况下也就多几十份材质。
   ------------------------------------------------------------ */
const glowCache = new WeakMap();

function materialList(mat) {
  return Array.isArray(mat) ? mat : [mat];
}

function paintPart(part, color, strength) {
  const c = new THREE.Color(color);
  part.group.traverse((o) => {
    if (!o.isMesh || !o.material) return;
    let rec = glowCache.get(o);
    if (!rec) {
      const orig = o.material;
      const clone = Array.isArray(orig) ? orig.map((m) => m.clone()) : orig.clone();
      rec = { orig, clone };
      glowCache.set(o, rec);
    }
    for (const m of materialList(rec.clone)) {
      // 屏幕（有 emissiveMap）和玻璃不参与高亮，否则 HUD 会被染色、玻璃会发白
      if (m.transparent || m.emissiveMap || !m.emissive) continue;
      m.emissive.copy(c);
      m.emissiveIntensity = strength;
    }
    o.material = rec.clone;
  });
  part.glow = true;
}

function unpaintPart(part) {
  if (!part.glow) return;
  part.group.traverse((o) => {
    if (!o.isMesh) return;
    const rec = glowCache.get(o);
    if (rec) o.material = rec.orig;
  });
  part.glow = false;
}

/** 按「选中 > 悬停 > 无」的优先级重算某件的发光 */
function refreshGlow(part) {
  const id = part.def.id;
  if (state.selected === id) {
    paintPart(part, part.def.glow ?? 0x8fc8e8, 0.62);
  } else if (state.hovered === id) {
    paintPart(part, part.def.glow ?? 0x8fc8e8, 0.18);
  } else {
    unpaintPart(part);
  }
}

/* ------------------------------------------------------------
   相机：机位由"部件 + 当前拆解量"算出，所以拆到一半选中也不会跑偏
   ------------------------------------------------------------ */
function partCenterNow(part, P = state.targetP) {
  const e = easeInOut(layout.localT(part.def, P));
  const v = part.center.clone();
  const ex = part.def.explode;
  v.x += ex[0] * e;
  v.y += ex[1] * e;
  v.z += ex[2] * e;
  return v;
}

function shotForPart(part) {
  const c = partCenterNow(part);
  const dir = new THREE.Vector3(...part.def.focus.dir).normalize();
  const dist = Math.max(0.62, part.radius * 2.15 + 0.28);
  return {
    from: c.clone().addScaledVector(dir, dist).toArray(),
    look: c.toArray(),
    fov: part.def.focus.fov ?? 32,
  };
}

function shotForProgress() {
  return state.targetP > 0.5 ? layout.SHOTS.open : layout.SHOTS.closed;
}

/* 兜底：任何未捕获错误都显示到遮罩上，避免用户只看到黑屏还不知道为什么 */
window.addEventListener('error', (e) => {
  const box = document.getElementById('loading');
  const tip = document.getElementById('loading-tip');
  if (tip) tip.textContent = `运行出错：${e.message || e.error}`;
  if (box) box.classList.remove('done');
});
window.addEventListener('unhandledrejection', (e) => {
  const box = document.getElementById('loading');
  const tip = document.getElementById('loading-tip');
  const msg = e.reason && (e.reason.message || e.reason);
  if (tip) tip.textContent = `运行出错：${msg}`;
  if (box) box.classList.remove('done');
});

/* ------------------------------------------------------------
   拆解：每帧把进度写进每个部件的位移
   ------------------------------------------------------------ */
function applyExplode() {
  for (const part of parts) {
    const e = easeInOut(layout.localT(part.def, state.P));
    const ex = part.def.explode;
    part.group.position.set(ex[0] * e, ex[1] * e, ex[2] * e);
  }
}

/* ------------------------------------------------------------
   界面：清单 / 详情 / 滑杆 / 标签
   ------------------------------------------------------------ */
const el = {
  loading: $('#loading'),
  loadingFill: $('#loading-fill'),
  loadingTip: $('#loading-tip'),
  list: $('#part-list'),
  count: $('#rail-count'),
  tip: $('#order-tip'),
  panel: $('#panel'),
  panelClose: $('#panel-close'),
  role: $('#panel-role'),
  title: $('#panel-title'),
  en: $('#panel-en'),
  desc: $('#panel-desc'),
  specs: $('#specs'),
  prev: $('#btn-prev'),
  next: $('#btn-next'),
  play: $('#btn-play'),
  playIcon: $('#play-icon'),
  scrub: $('#scrub'),
  pct: $('#pct'),
  stageName: $('#stage-name'),
  reset: $('#btn-reset'),
  labelsBtn: $('#btn-labels'),
  spinBtn: $('#btn-spin'),
  labels: $('#labels'),
  hint: $('#hint'),
  meta: $('#meta'),
};

/** 清单里的一条 */
function makeRailItem(part, i) {
  const copy = copyOf(part.def.id);
  const btn = document.createElement('button');
  btn.className = 'part-item';
  btn.type = 'button';
  btn.dataset.id = part.def.id;
  btn.innerHTML = `<span class="idx">${String(i + 1).padStart(2, '0')}</span>
    <span class="nm">${copy.cn}</span>
    <span class="tag">${copy.role}</span>`;
  btn.addEventListener('click', () => select(part.def.id));
  btn.addEventListener('pointerenter', () => setHover(part.def.id));
  btn.addEventListener('pointerleave', () => setHover(null));
  el.list.appendChild(btn);
  return btn;
}

/** 3D 标签（HTML 投影） */
function makeLabel(part, i) {
  const copy = copyOf(part.def.id);
  const div = document.createElement('div');
  div.className = 'label';
  div.innerHTML = `<span class="n">${String(i + 1).padStart(2, '0')}</span><span>${copy.cn}</span>`;
  el.labels.appendChild(div);
  return div;
}

function buildUI() {
  el.count.textContent = String(parts.length).padStart(2, '0');
  el.tip.textContent = ORDER_TIP;
  parts.forEach((part, i) => {
    part.railEl = makeRailItem(part, i);
    part.labelEl = makeLabel(part, i);
  });
  el.scrub.addEventListener('input', () => {
    state.playing = false;
    state.targetP = Number(el.scrub.value) / 1000;
    syncPlayUI();
  });
  el.play.addEventListener('click', togglePlay);
  el.reset.addEventListener('click', () => {
    clearSelection();
    state.playing = false;
    state.targetP = 0;
    rig.flyTo(layout.SHOTS.closed, { duration: 1.3 });
    syncPlayUI();
  });
  el.labelsBtn.addEventListener('click', () => {
    state.labels = !state.labels;
    el.labelsBtn.setAttribute('aria-pressed', String(state.labels));
    el.labels.style.display = state.labels ? '' : 'none';
  });
  el.spinBtn.addEventListener('click', () => {
    state.spin = !state.spin;
    el.spinBtn.setAttribute('aria-pressed', String(state.spin));
    applyIdleDrift();
  });
  el.panelClose.addEventListener('click', () => clearSelection());
  el.prev.addEventListener('click', () => stepSelection(-1));
  el.next.addEventListener('click', () => stepSelection(1));
}

function applyIdleDrift() {
  rig.setIdleDrift(state.spin && !state.selected ? 0.42 : 0);
}

function syncPlayUI() {
  el.play.classList.toggle('playing', state.playing);
  el.playIcon.textContent = state.playing ? '❚❚' : '▶';
  el.play.setAttribute('aria-label', state.playing ? '暂停拆解动画' : '播放拆解动画');
}

function togglePlay() {
  if (state.playing) {
    state.playing = false;
  } else {
    state.playing = true;
    state.dir = state.targetP >= 0.999 ? -1 : 1;
    if (state.targetP >= 0.999) state.targetP = 1;
  }
  syncPlayUI();
}

function setHover(id) {
  if (state.hovered === id) return;
  const prev = state.hovered ? byId.get(state.hovered) : null;
  state.hovered = id;
  if (prev) refreshGlow(prev);
  if (id) refreshGlow(byId.get(id));
  canvas.classList.toggle('hot', Boolean(id));
}

function updatePanel() {
  const id = state.selected;
  if (!id) {
    el.panel.classList.remove('show');
    return;
  }
  const part = byId.get(id);
  const copy = copyOf(id);
  el.role.textContent = copy.role;
  el.title.textContent = copy.cn;
  el.en.textContent = copy.en;
  el.desc.textContent = copy.desc;
  el.specs.innerHTML = copy.spec
    .map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`)
    .join('');
  el.panel.classList.add('show');
  el.panel.scrollTop = 0;
  void part;
}

function syncSelectionUI() {
  for (const part of parts) {
    const on = part.def.id === state.selected;
    part.railEl?.classList.toggle('active', on);
    part.labelEl?.classList.toggle('active', on);
    if (part.railEl && on) {
      part.railEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }
  updatePanel();
}

function select(id) {
  if (!id) return clearSelection();
  if (state.selected === id) return clearSelection();
  const part = byId.get(id);
  if (!part) return;

  state.selected = id;
  // 选中一件时，把它右侧的序列推进到"刚拆开"的状态，否则镜头对着合拢件看不到东西
  const need = Math.min(1, Math.max(part.def.win[1], 0.02) + 0.02);
  if (state.targetP < need) state.targetP = need;

  for (const p of parts) refreshGlow(p);
  syncSelectionUI();
  applyIdleDrift();
  const shot = shotForPart(part);
  aimAt.set(shot.look[0], shot.look[1], shot.look[2]);
  rig.flyTo(shot, { duration: 1.25, bulge: 0.75 });
}

function clearSelection() {
  if (!state.selected) return;
  state.selected = null;
  for (const p of parts) refreshGlow(p);
  syncSelectionUI();
  applyIdleDrift();
  const shot = shotForProgress();
  aimAt.set(shot.look[0], shot.look[1], shot.look[2]);
  rig.flyTo(shot, { duration: 1.35 });
}

function stepSelection(delta) {
  const ids = layout.PART_IDS;
  const i = state.selected ? ids.indexOf(state.selected) : -1;
  const next = i < 0 ? (delta > 0 ? 0 : ids.length - 1) : (i + delta + ids.length) % ids.length;
  select(ids[next]);
}

/* 标签每帧跟着模型走：把世界坐标投影成屏幕坐标 */
function updateLabels() {
  if (!state.labels) return;
  const w = window.innerWidth;
  const h = window.innerHeight;
  for (const part of parts) {
    const p = partCenterNow(part, state.P);
    const ex = part.def.explode;
    // 标签沿拆解方向再往外挪一点，贴在部件外侧
    p.x += (part.def.label?.side === 'l' ? -0.22 : part.def.label?.side === 'r' ? 0.22 : 0);
    p.y += part.def.label?.dy ?? 0;
    p.project(stage.camera);
    const behind = p.z > 1;
    const sx = (p.x * 0.5 + 0.5) * w;
    const sy = (-p.y * 0.5 + 0.5) * h;
    const visible =
      !behind &&
      (state.selected === part.def.id ||
        (state.P > 0.04 && layout.localT(part.def, state.P) > 0.12) ||
        state.hovered === part.def.id);
    part.labelEl.classList.toggle('on', visible);
    if (visible) {
      part.labelEl.style.left = `${sx.toFixed(1)}px`;
      part.labelEl.style.top = `${sy.toFixed(1)}px`;
    }
    void ex;
  }
}

function updateHUD() {
  const p = Math.round(state.P * 1000) / 10;
  el.pct.textContent = `${p.toFixed(1)}%`;
  const v = Math.round(state.P * 1000);
  if (Number(el.scrub.value) !== v) el.scrub.value = String(v);
  el.scrub.style.setProperty('--p', `${(state.P * 100).toFixed(2)}%`);
  // 当前正在动的部件：给用户一个"拆到哪一层"的读数
  const moving = parts.filter((x) => {
    const t = layout.localT(x.def, state.P);
    return t > 0 && t < 1;
  });
  let text;
  if (state.selected) text = `聚焦 · ${copyOf(state.selected).cn}`;
  else if (state.P < 0.005) text = '整机 · 合拢状态';
  else if (state.P > 0.995) text = '全拆 · 10 层展开';
  else if (moving.length) text = `拆解中 · ${moving.length} 个层次在移动`;
  else text = `拆解进度 · ${p.toFixed(0)}%`;
  el.stageName.textContent = text;
  void clamp01;
}

/* ------------------------------------------------------------
   输入：指针拖拽 / 滚轮 / 键盘
   ------------------------------------------------------------ */
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
let lastX = 0, lastY = 0;

function pick(clientX, clientY) {
  pointer.x = (clientX / window.innerWidth) * 2 - 1;
  pointer.y = -(clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(pointer, stage.camera);
  const hits = raycaster.intersectObjects(parts.map((p) => p.group), true);
  for (const hit of hits) {
    const mat = Array.isArray(hit.object.material) ? hit.object.material[0] : hit.object.material;
    // 玻璃/屏幕这类半透件不抢点击（否则镜头前的那层玻璃永远挡着）
    if (!mat || (mat.transparent && mat.opacity < 0.5)) continue;
    return hit.object.userData.partId ?? null;
  }
  return null;
}

function bindInput() {
  canvas.addEventListener('pointerdown', (e) => {
    state.dragging = true;
    state.dragDist = 0;
    lastX = e.clientX;
    lastY = e.clientY;
    canvas.classList.add('dragging');
    canvas.setPointerCapture?.(e.pointerId);
  });

  canvas.addEventListener('pointermove', (e) => {
    const dx = e.clientX - lastX;
    const dy = e.clientY - lastY;
    if (state.dragging) {
      state.dragDist += Math.abs(dx) + Math.abs(dy);
      if (state.dragDist > 3) rig.addOrbit(dx, dy);
      lastX = e.clientX;
      lastY = e.clientY;
    } else {
      lastX = e.clientX;
      lastY = e.clientY;
      // 悬停拾取：指针停下才查，避免快速划过时每帧射线
      const id = pick(e.clientX, e.clientY);
      setHover(id);
    }
    // 轻微的鼠标视差，让静止画面也有体积感
    const nx = (e.clientX / window.innerWidth) * 2 - 1;
    const ny = (e.clientY / window.innerHeight) * 2 - 1;
    rig.setParallax(nx * 0.55, -ny * 0.45);
  });

  const endDrag = (e) => {
    if (!state.dragging) return;
    state.dragging = false;
    canvas.classList.remove('dragging');
    canvas.releasePointerCapture?.(e.pointerId);
    // 位移很小 → 当成点击（拖动结束不算选中，否则一拖就误选）
    if (state.dragDist <= 6) {
      const id = pick(e.clientX, e.clientY);
      if (id) select(id);
      else clearSelection();
    }
    hideHint();
  };
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', () => {
    state.dragging = false;
    canvas.classList.remove('dragging');
  });
  canvas.addEventListener('pointerleave', () => {
    setHover(null);
    rig.setParallax(0, 0);
  });

  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    // 滚轮向上 = 推近
    rig.addZoom(1 + Math.sign(e.deltaY) * 0.085);
    hideHint();
  }, { passive: false });

  window.addEventListener('keydown', (e) => {
    if (e.target instanceof HTMLInputElement) return;
    switch (e.key) {
      case ' ':
        e.preventDefault();
        togglePlay();
        break;
      case 'Escape':
        clearSelection();
        break;
      case 'r':
      case 'R':
        el.reset.click();
        break;
      case 'ArrowLeft':
        e.preventDefault();
        state.playing = false;
        state.targetP = clamp01(state.targetP - (e.shiftKey ? 0.006 : 0.03));
        syncPlayUI();
        break;
      case 'ArrowRight':
        e.preventDefault();
        state.playing = false;
        state.targetP = clamp01(state.targetP + (e.shiftKey ? 0.006 : 0.03));
        syncPlayUI();
        break;
      default: {
        // 1–9、0 = 选中第 1–10 件
        if (/^[0-9]$/.test(e.key)) {
          const idx = Number(e.key) === 0 ? 9 : Number(e.key) - 1;
          const id = layout.PART_IDS[idx];
          if (id) select(id);
        }
      }
    }
    hideHint();
  });
}

let hintTimer = 0;
function startHint() {
  hintTimer = setTimeout(hideHint, 8000);
}
function hideHint() {
  clearTimeout(hintTimer);
  if (!el.hint.classList.contains('off')) el.hint.classList.add('off');
}

/* ------------------------------------------------------------
   主循环
   ------------------------------------------------------------ */
const clock = new THREE.Clock();
let fpsAcc = 0, fpsFrames = 0, fpsShown = 60;

function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(clock.getDelta(), 0.06);
  const t = clock.elapsedTime;

  // 自动播放：P 追 targetP，追到了就停
  if (state.playing) {
    state.targetP += state.dir * (dt / layout.OPEN_DUR);
    if (state.targetP >= 1) {
      state.targetP = 1;
      state.playing = false;
      syncPlayUI();
    } else if (state.targetP <= 0) {
      state.targetP = 0;
      state.playing = false;
      syncPlayUI();
    }
  }

  // 显示用进度平滑追目标（拖滑杆时参数化，不会一顿一顿）
  state.P = damp(state.P, state.targetP, 9, dt);
  if (Math.abs(state.P - state.targetP) < 0.0008) state.P = state.targetP;

  applyExplode();

  // 部件自己的微动画（呼吸灯、屏幕闪——可选导出）
  for (const part of parts) {
    if (part.mod && typeof part.mod.update === 'function') part.mod.update(t, state);
  }

  // 选中时相机跟着部件走（拆解进度变化时视觉中心不能漂）
  if (state.selected) {
    rig.update(t, dt);
    const shot = shotForPart(byId.get(state.selected));
    // 只在注视点真的跑掉了才重新对准：每帧都 flyTo 会让镜头一直重启缓动、抖个不停
    if (!rig.isFlying) {
      tmpV.set(shot.look[0], shot.look[1], shot.look[2]);
      if (tmpV.distanceTo(aimAt) > 0.06) {
        aimAt.copy(tmpV);
        rig.flyTo(
          { from: rig.position.toArray(), look: tmpV.toArray(), fov: shot.fov },
          { duration: 0.9, bulge: 0.2 }
        );
      }
    }
  } else {
    rig.update(t, dt);
  }

  updateLabels();
  updateHUD();
  stage.render();

  // FPS：每 0.5 s 刷一次，只在标题旁小字里露一手
  fpsAcc += dt;
  fpsFrames++;
  if (fpsAcc >= 0.5) {
    fpsShown = Math.round(fpsFrames / fpsAcc);
    fpsAcc = 0;
    fpsFrames = 0;
    el.meta.textContent = `${fpsShown} fps · 10 个部件 / 程序化生成`;
  }
}

/* ------------------------------------------------------------
   启动
   ------------------------------------------------------------ */
function boot() {
  el.loadingTip.textContent = LOADING.tip;
  el.loadingFill.style.width = '18%';

  // 让遮罩先画出来一帧，再做几何构建（构建是同步的，否则会白屏卡住）
  requestAnimationFrame(() => {
    try {
      buildParts();
      el.loadingFill.style.width = '52%';
    } catch (err) {
      el.loadingTip.textContent = `部件构建失败：${err.message}`;
      throw err;
    }

    requestAnimationFrame(() => {
      buildUI();
      bindInput();
      el.loadingFill.style.width = '100%';

      // 开场：从远处一个更松的机位推进到合拢机位
      rig.flyTo({ from: [4.1, 2.5, 5.2], look: [0, 0, 0.02], fov: 38 }, { instant: true });
      rig.update(0, 0.016);
      stage.render();

      setTimeout(() => {
        el.loading.classList.add('done');
        rig.flyTo(layout.SHOTS.closed, { duration: 2.1 });
        startHint();
      }, 240);

      applyIdleDrift();
      syncPlayUI();
      updateHUD();
      frame();
    });
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot, { once: true });
} else {
  boot();
}

/* 调试用：控制台里 __APP.state 能直接看到进度与选中项 */
window.__APP = { state, parts, rig, stage, layout, COPY, GUIDE };
void tmpBox;
void explodeV;
void fpsShown;