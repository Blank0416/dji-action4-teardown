# CONTRACT —— DJI Osmo Action 4 · 3D 拆解页

> 这份文件是这个项目的**接口契约**。任何部件模块都必须按这里的形状写，否则集成时会碎。
> 读者：所有部件作者。**只读；不要改这份文件，也不要改 `src/engine/*`、`src/data/layout.js`、`src/main.js`、`src/*.css`。**
> 你只写自己的 `src/parts/<id>.js`（和 `src/data/copy.js` 里的对应条目）。

---

## 0. 项目目标（一句话）

一个**单文件、离线、双击即开**的网页：用 Three.js 纯代码还原 DJI Osmo Action 4 运动相机，
点击任一部件触发"整机拆解 + 镜头飞过去看细节"，配名称/参数标注、部件清单、参数面板、拆解进度条。

**硬红线：**

1. **不加载任何外部资源**：不加载 glTF/OBJ/图片/字体文件。所有几何是代码生成的，
   所有贴图是 canvas 现画的（`detail.js` 提供）。打包后是一个 HTML。
2. **不依赖浏览器无关能力**：不用 WebGPU、不用 WGL2 扩展、不用 worker。
3. **可以 import 'three'**（构建时会把 three 一起打进单文件）。
4. 中文注释、中文 UI 文案；注释写"为什么"，不写"这行做了什么"。
5. 严禁 `console.log` 残留（`tools/probe.mjs` 会检查）。

---

## 1. 坐标系（重要）

右手系，**单位 1 = 50 mm**，机身外形 70.5 × 44.2 × 32.8 mm ⇒ `1.41 × 0.884 × 0.656`。

```
        +Y  上（顶面按键）
         │
         │      +Z  前（镜头 / 前屏面）
         │    ╱
         │  ╱
         └──────── +X  右（USB-C / 卡槽门所在的侧壁）
```

- 机身包络：`X ∈ [-0.705, 0.705]`，`Y ∈ [-0.442, 0.442]`，`Z ∈ [-0.328, 0.328]`
- 内腔（只有中框壁之外的部分可占）：`X ∈ [-0.655, 0.655]`，`Y ∈ [-0.392, 0.392]`，`Z ∈ [-0.300, 0.300]`
- **镜头轴心**：`(0.300, 0.008, +Z)`，镜头朝 +Z
- **前屏中心**：`(-0.300, 0.008, +Z)`，1.4" 方形屏（320×320）
- **后屏**：2.5" 横向屏，居中，`Z = -0.298`
- **顶面**：`Y = +0.442`，按键模组占 `x ∈ [-0.58, 0.58], z ∈ [-0.13, 0.13]`
- **底面**：`Y = -0.442`，磁吸底座占 `y ∈ [-0.522, -0.442]`

`src/data/layout.js` 里有每件的 `slot`（允许占位盒），建模**必须**落在里面（±2% 容差）。
`slot` 之外的东西只有一种情况可以越界：**贴片/丝印**（厚度 ≤0.01 的 decal）。

---

## 2. 你要交付的部件

| id | 中文名 | slot 中心 (cx,cy,cz) | slot 尺寸 (w,h,d) | 这件的辨识点（必须做出来） |
|---|---|---|---|---|
| `frontcover` | 前面板 · 前屏 | 0, 0, 0.298 | 1.41 × 0.884 × 0.06 | 圆角面板，挖两个孔：镜头圆孔(半径 0.318，圆心 x=0.300)、方形前屏窗口(0.504，圆心 x=-0.300)；前屏玻璃 + 屏边；麦克风微孔；背面螺丝柱/定位柱、排线座 |
| `lens` | 镜头模组 | 0.300, 0.008, 0.254 | 0.66 × 0.66 × 0.148 | 铝压圈(滚花/齿纹) + 两级镜筒 + 3 片以上镜片(不同曲率/镀膜反光) + 6~7 片光圈叶片 + 后组镜片 + 后座排线 |
| `sensor` | 1/1.3" 影像传感器 | 0.280, 0, 0.1325 | 0.62 × 0.56 × 0.085 | 陶瓷基板 + 硅 die(带像素区反光/金线) + 保护玻璃 + 金属屏蔽框 + 软排线 + 连接器 |
| `heatsink` | 导热模组 | 0.020, 0, 0.055 | 0.94 × 0.62 × 0.05 | 石墨片(黑哑光) + 铜均热板(暖铜) + 导热垫 + 屏蔽罩 + 铜箔走线 |
| `mainboard` | 主板 | 0, 0, -0.004 | 1.30 × 0.78 × 0.052 | PCB(深青灰) + SoC(大 die, 丝印) + 内存/闪存颗粒 + PMIC + WiFi 模组 + microSD 卡座 + Type-C 座 + 晶振 + 阻容阵列 + 屏蔽罩 + 螺丝孔 |
| `battery` | 1770 mAh 电池 | 0, -0.018, -0.155 | 1.24 × 0.70 × 0.218 | 铝塑膜电芯(银灰) + 印刷标签(`detail.tex.cell()`) + 保护板(BMS) + 镍带焊点 + 连接器 + 拉手胶带 |
| `rearscreen` | 2.5" 触摸屏模组 | 0, 0, -0.298 | 1.30 × 0.72 × 0.06 | 黑边玻璃盖板 + 触摸层 + LCD 组件 + 金属中框 + 触摸排线；屏上有一点点自发光 HUD(`detail.tex.screen({kind:'rear'})`) |
| `topkeys` | 顶部按键模组 | 0, 0.414, 0 | 1.16 × 0.14 × 0.26 | 录制键(Ø0.20，带红色指示环) + 电源/QS 键(Ø0.16) + 麦克风孔阵 + 按键排线 + 密封圈 |
| `mount` | 磁吸快拆底座 | 0, -0.482, 0 | 1.00 × 0.11 × 0.52 | 金属底板 + 4 颗磁铁(暗钢) + 弹性卡扣 + 释放推钮 + 定位销 + 硅胶垫 |
| `shell` | 中框机身 | 0, 0, 0 | 1.41 × 0.884 × 0.656 | **空壳**：壁厚约 0.045 的包裹体。必须开：前开口(整个正面)、后开口(整个背面)、顶面按键开口(x∈[-0.58,0.58], z∈[-0.13,0.13])、底面磁吸开口(x∈[-0.5,0.5], z∈[-0.26,0.26])、右侧 USB-C/卡槽橡胶门(x=+0.705)、扬声器孔阵；内部支撑筋与螺丝柱 |

**允许越界的两个例外**：`topkeys` 的键帽可以凸出到 `y=0.50`；`mount` 的推钮可以凸出到 `y=-0.53`。

---

## 3. 部件模块形状

```js
// src/parts/battery.js
import * as THREE from 'three';

/**
 * 1770 mAh 电池模组。
 * @param {{kit, detail, layout, THREE}} env  —— 引擎注入，不要自己 import kit
 * @returns {THREE.Group} 一个直接可加进场景的 Group
 */
export default function build(env) {
  const { kit, detail } = env;
  const g = new THREE.Group();

  // ... 建模 ...

  return g;
}
```

规则：

- **默认导出**一个函数，参数 `env`，返回 `THREE.Group`。
- `env` 里有：`THREE`、`kit`（材质/几何库）、`detail`（贴图/细零件库）、`layout`（本文件的数据）、
  `PART`（你自己的 layout 条目）、`mm`（=1/50，把毫米换成单位：`0.8 * env.mm`）。
- Group 内部坐标**就是世界坐标**：直接在绝对位置上摆件，不要自己再平移中心。
  返回后引擎只做"平移 slot 中心的 explode 位移"，不会替你居中。
- 三角面预算：**4k–45k**。低于 4k 会显得像积木，高于 45k 会拖慢整机（全场景目标 < 220k）。
- 同一个部件内尽量复用几何（`InstancedMesh` 铺阻容/螺丝/孔阵），不要 for 循环里 new 100 个 BoxGeometry。
- 不要给每件自建 `MeshStandardMaterial` 调色；**用 `kit.mat(...)` / `kit.tint(...)`**，
  这样 10 件是同一套质感。屏幕/指示灯可以用 `detail.mat.screen()` / `kit.glow()`。
- **不要**设置 `castShadow/receiveShadow` 之外的渲染状态；引擎负责选中高亮（会克隆你的材质加自发光）。
- 不要写 `requestAnimationFrame`、不要写 DOM、不要 `console.*`。
- 可选导出：`export function update(t, state) {}` —— 需要持续动画（呼吸灯、屏幕微闪）才写，
  引擎会按帧调用，`t` 是秒。

---

## 4. 可用工具（别自己造轮子）

### `kit`（`src/engine/kit.js`）

```js
kit.mat('body'|'bodyDeep'|'bodyLite'|'metal'|'metalDark'|'steel'|'magnet'|'pcb'|'silicon'
        |'copper'|'gold'|'cell'|'ceramic'|'graphite'|'rubber'|'glass', {覆盖参数})
kit.mat('body', { color: 0x4a5058, roughness: 0.5 })   // 带 over 会 clone 并缓存
kit.tint(0x7fb3c8, { rough: .6, metal: .1 })           // 低饱和标识色
kit.glow(0xe0403c, 1.6)                                // 自发光（指示灯）
kit.box(w,h,d,mat) / kit.cyl(rt,rb,h,seg,mat) / kit.sphere(r,seg,mat) / kit.plane(w,h,mat)
kit.pins(n, spacing, mat, {w,h,d})                     // 一排引脚
kit.trace(points, radius, mat)                         // 沿折线的圆管（热管/走线）
kit.grid(cols, rows, cell, (x,y,i,j)=>mesh)            // 阵列
kit.dot(x,y,z,mat,size)                                // 小球
kit.rng(seed)                                          // 确定性随机（每次打开长得一样）
kit.damp/clamp01/easeInOut/easeOut/easeIn/easeOutBack
kit.stats(group)                                       // {tris, meshes} 自查用
```

### `detail.tex`：程序化贴图（全部 canvas 现画）

```js
detail.tex.pcb({base,trace,silk})        // {map, normalMap, roughnessMap}
detail.tex.brushed(hex, {repeat,strength,dir})  // {map, roughnessMap}
detail.tex.grain(hex, {repeat,amount})   // {map}
detail.tex.label({lines:[..], w,h, fg, accent, bg, align})  // 丝印文字 → Texture
detail.tex.screen({kind:'front'|'rear', w,h})               // {map, emissiveMap} 屏幕 HUD
detail.tex.cell()                                          // 电池包皮
```

### `detail.mat` / `detail.parts`：细零件

```js
detail.mat.screen(hud, {emissive})                 // 屏幕玻璃材质（带 HUD）
detail.mat.glass({color, opacity, rough})          // 透视玻璃（拒绝折射）
detail.mat.decal(texture, {opacity, color})        // 丝印贴片材质

detail.parts.cbox(w,h,d,mat,r,seg)                 // 倒角盒（r=倒角半径，0.006 就是 CNC 边）
detail.parts.plate({w,h,r,holes:[Path],depth,bevel}, mat)   // 带孔挤出板（前后框必用）
detail.parts.tube({outer,inner,depth,bevel}, mat)  // 环形挤出（镜头压圈）
detail.parts.roundedRectShape(w,h,r) / circlePath(r) / rectPath(w,h,r)
detail.parts.screw(r, mat)                         // 螺丝（十字槽）
detail.parts.port('usbc'|'microsd'|'battery', {w,h})
detail.parts.smdField(count, {w,h,d}, mat)         // InstancedMesh 贴片阵列
detail.parts.flex(points, width, mat)              // 扁平排线（沿折线）
detail.parts.decal(w, h, texture)                  // 丝印贴片 mesh（朝 +Z）
detail.parts.ring(rOut, rIn, depth, mat)           // 环形件
```

### 示例

`src/parts/battery.js` 是**参考实现**（拿电池当范例：倒角盒 + 贴图 + 贴片 + 排线 + 螺丝）。
新写一件之前先读它。

---

## 5. 自查（必须自己跑，跑绿再交）

```powershell
# 单件几何自查：包围盒是否越界、三角面数、是否有 NaN、是否与其它件穿插
node tools/probe.mjs battery

# 全部件一起检查（集成后由 Lead 跑）
node tools/probe.mjs
```

`probe` 会打印每件的 `slot / 实测包围盒 / 越界量 / 三角面 / 网格数`，
并对越界、NaN、面数为 0、超出预算的情况返回非 0 退出码。**退出码必须为 0。**

---

## 6. 文案（`src/data/copy.js`，由文案作者统一写）

部件模块**不写**任何长文案。UI 上显示的中文名、英文名、介绍、参数，全部来自 `copy.js`，
按 `id` 索引。你要做的只是建模。

---

## 7. 风格基准（决定"像不像真机"的那几条）

1. **倒角**：所有硬边件都要 0.004–0.012 的倒角（`cbox` 的 r 参数）。直角边是廉价感的第一来源。
2. **面差**：面板/盖板之间留 0.008–0.015 的缝，别做成一块整料。
3. **低饱和**：机身是深石墨（0x3b4047 一档），金属是冷灰铝，唯一的高饱和色是**录制红**（0xd93b32 一档），
   且只出现在录制键/指示灯这种小面积上。
4. **细节密度递减**：正面（观众最先看）细节最密；背面/底面可以粗一档。
5. **不要发光的玩具感**：屏幕 HUD 的自发光强度控制在 0.6–1.2，指示灯除外。

---

## 8. 交付清单

- [ ] `src/parts/<id>.js` 默认导出 `build(env)`
- [ ] `node tools/probe.mjs <id>` 退出码 0
- [ ] 无 `console.*`、无 `TODO`、无外部资源引用
- [ ] 文件头有中文注释块，说明这个部件在真机上是什么、你做了哪几层
- [ ] 三角面在 4k–45k