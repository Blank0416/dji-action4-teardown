/* ============================================================
   camera.js — 镜头机位与平滑飞行
   "多镜头视角变换"的实现：每次切换沿一条二次贝塞尔弧线掠过，
   而不是直线拉近；注视点单独平滑跟随。
   ============================================================ */

import * as THREE from 'three';

const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const damp = (c, t, l, dt) => t + (c - t) * Math.exp(-l * Math.max(dt, 0));
/* 机位坐标既接受普通数组也接受 Vector3。
   （只写 a[0]/a[1]/a[2] 的话，Vector3 会取到 undefined，
   而 Vector3 构造函数把 undefined 吞成 0 —— 镜头会静默飞到原点。） */
const V = (a) => (a && a.isVector3 ? a.clone() : new THREE.Vector3(a[0], a[1], a[2]));

export function createCameraRig(camera) {
  const look = new THREE.Vector3(0, 0, 0);       // 当前注视点
  const lookT = new THREE.Vector3(0, 0, 0);      // 目标注视点
  const pos = camera.position.clone();
  const parallax = new THREE.Vector2(0, 0);      // 鼠标视差（-1..1）
  const parallaxSm = new THREE.Vector2(0, 0);

  let tween = null;          // 进行中的飞行
  let fov = camera.fov;
  let fovT = camera.fov;
  let idleSpin = 0;          // 待机时的缓慢环绕
  let idleAmp = 0;           // 待机环绕幅度（选中元件时归零）
  const baseUp = new THREE.Vector3(0, 1, 0);

  // 用户在机位之上叠加的自由环绕 / 缩放（切机位时自动归零）
  let yaw = 0, pitch = 0, zoom = 1;
  let yawT = 0, pitchT = 0, zoomT = 1;

  const UP = new THREE.Vector3(0, 1, 0);
  const tmpA = new THREE.Vector3(), tmpB = new THREE.Vector3(), tmpC = new THREE.Vector3();
  const off = new THREE.Vector3(), right = new THREE.Vector3();

  /** 计算弧线控制点：让路径向外鼓一点，掠过时有"绕过去看"的感觉 */
  function controlPoint(p0, p2, bulge) {
    tmpA.subVectors(p2, p0);
    const dist = tmpA.length();
    tmpB.copy(tmpA).normalize();
    // 与视线垂直的"侧向"轴
    tmpC.crossVectors(UP, tmpB);
    if (tmpC.lengthSq() < 1e-6) tmpC.set(1, 0, 0); else tmpC.normalize();
    return new THREE.Vector3()
      .addVectors(p0, p2).multiplyScalar(0.5)
      .addScaledVector(UP, dist * 0.16 * bulge)
      .addScaledVector(tmpC, dist * 0.11 * bulge);
  }

  /**
   * 飞到某个机位
   * @param {{from:number[], look:number[], fov?:number}} shot
   */
  function flyTo(shot, { duration = 1.45, instant = false, bulge = 1 } = {}) {
    const p2 = V(shot.from);
    const l2 = V(shot.look);
    fovT = shot.fov ?? 34;

    // 换机位时，用户叠加的自由环绕/缩放平滑归零（新机位是设计好的）
    yawT = 0; pitchT = 0; zoomT = 1;

    if (instant) {
      pos.copy(p2); camera.position.copy(p2);
      look.copy(l2); lookT.copy(l2);
      fov = fovT; camera.fov = fov; camera.updateProjectionMatrix();
      yaw = yawT; pitch = pitchT; zoom = zoomT;
      tween = null;
      return;
    }

    const p0 = pos.clone();
    tween = {
      p0, p1: controlPoint(p0, p2, bulge), p2,
      l0: look.clone(), l1: look.clone().lerp(l2, 0.5), l2,
      t: 0, dur: Math.max(duration, 0.001),
    };
    lookT.copy(l2);
  }

  /** 待机时的缓慢环绕幅度：0 = 完全静止 */
  function setIdleDrift(amp) { idleAmp = amp; }

  /** 鼠标视差，输入 -1..1 */
  function setParallax(x, y) { parallax.set(x, y); }

  /** 在机位之上叠加自由环绕（用户拖动）。dx/dy 是像素增量
      约定是"抓住物体拖"：向右拖，物体跟着往右转（镜头往左绕）；
      向下拖，物体正面跟着往下压（镜头因此升到上方俯视）。
      pitch > 0 会把镜头压到注视点下方，所以向下拖要取负号。 */
  function addOrbit(dx, dy) {
    yawT -= dx * 0.0045;
    pitchT = Math.max(-0.62, Math.min(0.72, pitchT - dy * 0.0032));
  }

  /** 缩放系数（用户滚轮），1 = 机位原距离 */
  function addZoom(f) {
    zoomT = Math.max(0.5, Math.min(2.1, zoomT * f));
  }

  /** 解释"现在这个机位的距离"，给外部做 UI 反馈用 */
  function resetOrbit() { yawT = 0; pitchT = 0; zoomT = 1; }

  function update(elapsed, dt) {
    if (tween) {
      tween.t = Math.min(tween.t + dt / tween.dur, 1);
      const e = easeInOut(tween.t);
      const u = 1 - e;
      // 二次贝塞尔
      pos.set(
        u * u * tween.p0.x + 2 * u * e * tween.p1.x + e * e * tween.p2.x,
        u * u * tween.p0.y + 2 * u * e * tween.p1.y + e * e * tween.p2.y,
        u * u * tween.p0.z + 2 * u * e * tween.p1.z + e * e * tween.p2.z
      );
      look.set(
        u * u * tween.l0.x + 2 * u * e * tween.l1.x + e * e * tween.l2.x,
        u * u * tween.l0.y + 2 * u * e * tween.l1.y + e * e * tween.l2.y,
        u * u * tween.l0.z + 2 * u * e * tween.l1.z + e * e * tween.l2.z
      );
      if (tween.t >= 1) tween = null;
    } else {
      // 没有飞行任务时：注视点平滑追随，并允许待机环绕
      look.x = damp(look.x, lookT.x, 4.2, dt);
      look.y = damp(look.y, lookT.y, 4.2, dt);
      look.z = damp(look.z, lookT.z, 4.2, dt);

      if (idleAmp > 0.001) {
        idleSpin += dt * 0.055;
        const r = idleAmp;
        const cx = Math.cos(idleSpin) * r;
        const cz = Math.sin(idleSpin) * r;
        pos.x = damp(pos.x, pos.x + cx * dt * 0.9, 1.1, dt);
        pos.z = damp(pos.z, pos.z + cz * dt * 0.9, 1.1, dt);
        pos.y = damp(pos.y, pos.y + Math.sin(elapsed * 0.24) * r * 0.22 * dt, 1.1, dt);
      }
    }

    // FOV 平滑
    if (Math.abs(fov - fovT) > 0.01) {
      fov = damp(fov, fovT, 5.5, dt);
      camera.fov = fov;
      camera.updateProjectionMatrix();
    }

    // 鼠标视差：非常克制，只挪一点点
    parallaxSm.x = damp(parallaxSm.x, parallax.x, 3.0, dt);
    parallaxSm.y = damp(parallaxSm.y, parallax.y, 3.0, dt);

    // 用户自由环绕 / 缩放：在"设计机位"之上叠加，平滑跟随
    yaw = damp(yaw, yawT, 5.5, dt);
    pitch = damp(pitch, pitchT, 5.5, dt);
    zoom = damp(zoom, zoomT, 5.5, dt);

    off.subVectors(pos, look);
    if (Math.abs(yaw) > 1e-4) off.applyAxisAngle(UP, yaw);
    if (Math.abs(pitch) > 1e-4) {
      right.crossVectors(UP, off);
      if (right.lengthSq() > 1e-8) off.applyAxisAngle(right.normalize(), pitch);
    }
    if (Math.abs(zoom - 1) > 1e-4) off.multiplyScalar(zoom);

    camera.position.set(
      look.x + off.x + parallaxSm.x * 0.22,
      look.y + off.y + parallaxSm.y * 0.14,
      look.z + off.z
    );
    camera.up.copy(baseUp);
    camera.lookAt(
      look.x + parallaxSm.x * 0.06,
      look.y + parallaxSm.y * 0.04,
      look.z
    );
  }

  return {
    flyTo, update, setIdleDrift, setParallax, addOrbit, addZoom, resetOrbit,
    get position() { return pos; },
    get look() { return look; },
    get isFlying() { return tween !== null; },
  };
}