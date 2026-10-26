/* tools/render.mjs —— 把 render.src.mjs 打包再跑（同 probe：alias three → vendor）
   用法：
     node tools/render.mjs                         默认：合拢机位 → tools/out/closed.png
     node tools/render.mjs --p 1                   全拆状态
     node tools/render.mjs --p 0.5 --out shots/a   自定义进度与输出
     node tools/render.mjs --part lens --p 1       只看某个部件
     node tools/render.mjs --shot top --p 1        指定机位（closed|open|top|front|left）
*/
import { build } from 'esbuild';
import { spawnSync } from 'node:child_process';
import { rm, mkdir } from 'node:fs/promises';

const out = 'tools/.render.bundle.mjs';

await build({
  entryPoints: ['tools/render.src.mjs'],
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node20',
  outfile: out,
  // three 走 external：部件模块用动态 import 载入，必须和本进程共用同一个 three 实例，
  // 否则 Object3D.add 的 instanceof 检查会炸
  external: ['three'],
  logLevel: 'error',
});

await mkdir('tools/out', { recursive: true });
const r = spawnSync(process.execPath, [out, ...process.argv.slice(2)], { stdio: 'inherit' });
await rm(out, { force: true });
process.exit(r.status ?? 1);