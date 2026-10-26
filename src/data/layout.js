/* ============================================================
   layout.js — 装配坐标系、各部件占位盒、拆解向量、机位
   ------------------------------------------------------------
   坐标约定（右手系，单位 1 = 50 mm，机身尺寸 70.5×44.2×32.8 mm）：

       +Y = 上（顶部按键面）        -Y = 下（磁吸底座面）
       +Z = 前（镜头 / 前屏面）      -Z = 后（后屏面）
       +X = 右（USB-C / 卡槽门所在的侧壁）

   机身包络：X ∈ [-0.705, 0.705]，Y ∈ [-0.442, 0.442]，Z ∈ [-0.328, 0.328]

   每个部件有一个 slot（合拢状态下的允许占位盒），建模必须落在里面；
   explode 是"完全拆开"时相对 slot 中心的位移；win 是拆解进度窗口
   [t0, t1] —— 全局进度 P 落在窗口里该部件才动，所以拆解是有先后顺序的。
   ============================================================ */

export const APP = {
  title: 'DJI Osmo Action 4',
  subtitle: '3D 拆解可视化',
  cn: '大疆 Osmo Action 4 运动相机',
  tagline: '把 70.5 × 44.2 × 32.8 mm 的机身拆成 10 个层次，从 155° 镜片一路看到 1770 mAh 电芯。',
  unit: 'mm',
  scale: 50,
  version: '1.0.0',
};

/** 机身包络与内腔（部件作者的硬边界） */
export const DEVICE = {
  // 包络
  min: [-0.705, -0.442, -0.328],
  max: [0.705, 0.442, 0.328],
  // 内腔（中框内壁）：部件（除中框自身外）必须落在这里面
  cavityMin: [-0.655, -0.392, -0.300],
  cavityMax: [0.655, 0.392, 0.300],
  // 镜头轴心（前屏与镜头在正面并排）
  lensAxis: [0.300, 0.008, 0],
  frontScreen: [-0.300, 0.008, 0],
};

/** 整机关键尺寸（mm），UI 里做比例尺和标注用 */
export const DIM = {
  w: 70.5, h: 44.2, d: 32.8, weight: 145,
};

/**
 * 部件表。字段说明：
 *   id       模块名 src/parts/<id>.js
 *   slot     合拢状态占位盒 {cx,cy,cz,w,h,d}
 *   explode  完全拆开时的位移（相对 slot 中心）
 *   win      拆解进度窗口 [t0,t1]
 *   focus    {dir:[x,y,z], fov} 选中该件时的机位方向（相对部件中心）
 *   label    {side:'l'|'r'|'c', dy}  3D 标签挂在哪一侧
 *   glow     选中/高亮的自发光色（低饱和）
 */
export const PARTS = [
  {
    id: 'frontcover',
    slot: { cx: 0, cy: 0, cz: 0.298, w: 1.41, h: 0.884, d: 0.06 },
    explode: [0, 0, 1.62],
    win: [0.0, 0.34],
    focus: { dir: [0.42, 0.5, 1], fov: 30 },
    label: { side: 'l', dy: 0.1 },
    glow: 0x7fb3c8,
  },
  {
    id: 'lens',
    slot: { cx: 0.30, cy: 0.008, cz: 0.254, w: 0.66, h: 0.66, d: 0.148 },
    explode: [1.02, 0.72, 0.60],
    win: [0.06, 0.46],
    focus: { dir: [0.55, 0.42, 1], fov: 28 },
    label: { side: 'r', dy: 0.16 },
    glow: 0x6f9fd8,
  },
  {
    id: 'sensor',
    slot: { cx: 0.28, cy: 0.0, cz: 0.1325, w: 0.62, h: 0.56, d: 0.085 },
    explode: [1.05, 0.16, 0.60],
    win: [0.10, 0.50],
    focus: { dir: [0.35, 0.62, 1], fov: 28 },
    label: { side: 'r', dy: 0.05 },
    glow: 0x7fd4c0,
  },
  {
    id: 'heatsink',
    slot: { cx: 0.02, cy: 0.0, cz: 0.055, w: 0.94, h: 0.62, d: 0.05 },
    explode: [-0.62, 0.86, 0.42],
    win: [0.14, 0.54],
    focus: { dir: [0.3, 1, 0.55], fov: 30 },
    label: { side: 'l', dy: 0.05 },
    glow: 0xc88a5e,
  },
  {
    id: 'mainboard',
    slot: { cx: 0.0, cy: 0.0, cz: -0.004, w: 1.30, h: 0.78, d: 0.052 },
    explode: [1.42, 0.05, -0.10],
    win: [0.18, 0.62],
    focus: { dir: [1, 0.42, 0.62], fov: 32 },
    label: { side: 'r', dy: 0.0 },
    glow: 0x8fb87f,
  },
  {
    id: 'battery',
    slot: { cx: 0.0, cy: -0.018, cz: -0.155, w: 1.24, h: 0.70, d: 0.218 },
    explode: [-0.05, -1.22, 0.30],
    win: [0.20, 0.60],
    focus: { dir: [-0.3, -0.75, 1], fov: 30 },
    label: { side: 'l', dy: -0.1 },
    glow: 0xd0b070,
  },
  {
    id: 'rearscreen',
    slot: { cx: 0.0, cy: 0.0, cz: -0.298, w: 1.30, h: 0.72, d: 0.06 },
    explode: [0.10, 0.10, -1.62],
    win: [0.02, 0.36],
    focus: { dir: [-0.5, 0.5, -1], fov: 30 },
    label: { side: 'l', dy: 0.0 },
    glow: 0x8a9fd0,
  },
  {
    id: 'topkeys',
    slot: { cx: 0.0, cy: 0.414, cz: 0.0, w: 1.16, h: 0.14, d: 0.26 },
    explode: [0.92, 1.18, 0.12],
    win: [0.05, 0.40],
    focus: { dir: [0.5, 0.9, 0.7], fov: 30 },
    label: { side: 'r', dy: 0.14 },
    glow: 0xc07878,
  },
  {
    id: 'mount',
    slot: { cx: 0.0, cy: -0.482, cz: 0.0, w: 1.00, h: 0.11, d: 0.52 },
    explode: [-1.30, -1.05, 0.42],
    win: [0.12, 0.52],
    focus: { dir: [-0.6, -1, 0.8], fov: 30 },
    label: { side: 'l', dy: -0.16 },
    glow: 0x9099a8,
  },
  {
    id: 'shell',
    slot: { cx: 0, cy: 0, cz: 0, w: 1.41, h: 0.884, d: 0.656 },
    explode: [0, 0, 0],
    win: [0.0, 0.0],
    focus: { dir: [0.7, 0.45, 1], fov: 32 },
    label: { side: 'r', dy: -0.12 },
    glow: 0xb0b8c4,
  },
];

/** 机位预设：合拢全景 / 拆开全景 */
export const SHOTS = {
  // 合拢机位：3/4 前右视角，机身占画面高度约 55%
  closed: { from: [1.92, 1.18, 2.52], look: [0.0, 0.0, 0.04], fov: 32 },
  // 全拆机位：整个爆炸图要装得下，稍远、稍抬
  open: { from: [3.30, 2.30, 4.30], look: [0.16, 0.0, 0.0], fov: 44 },
};

/** 拆解进度的呼吸区间（自动播放用） */
export const OPEN_DUR = 2.1;

export const PART_IDS = PARTS.map((p) => p.id);

/** 取部件表项（未知 id 直接抛错，别让拼写错误静默成空白） */
export function partDef(id) {
  const d = PARTS.find((p) => p.id === id);
  if (!d) throw new Error(`[layout] 未知部件 "${id}"，可用：${PART_IDS.join(', ')}`);
  return d;
}

/** slot 中心 */
export function slotCenter(slot) {
  return [slot.cx, slot.cy, slot.cz];
}

/** 某部件在进度 P 下的局部拆解量（0..1） */
export function localT(def, P) {
  const [t0, t1] = def.win;
  if (t1 <= t0) return 0;
  const u = (P - t0) / (t1 - t0);
  return u < 0 ? 0 : u > 1 ? 1 : u;
}