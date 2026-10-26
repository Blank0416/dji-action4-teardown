/* tools/probe.mjs —— 把 probe.src.mjs 用 esbuild 打包再跑。
   为什么要打包：部件通过 kit 使用裸模块名 'three'，这里用 esbuild 的 alias
   指到 vendor/three.module.js，Node 里就能直接跑（不依赖 node_modules）。
   用法：node tools/probe.mjs            全部件
        node tools/probe.mjs battery    单件 */
import { build } from 'esbuild';
import { spawnSync } from 'node:child_process';
import { rm } from 'node:fs/promises';
import path from 'node:path';

const out = 'tools/.probe.bundle.mjs';

await build({
  entryPoints: ['tools/probe.src.mjs'],
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node20',
  outfile: out,
  alias: { three: path.resolve('vendor/three.module.js') },
  logLevel: 'error',
});

const r = spawnSync(process.execPath, [out, ...process.argv.slice(2)], { stdio: 'inherit' });
await rm(out, { force: true });
process.exit(r.status ?? 1);