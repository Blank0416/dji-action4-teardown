/* ============================================================
   build.mjs
     node build.mjs          → dist\DJI-Action4-拆解.html（单文件，双击即开）
     node build.mjs --dev    → dev\bundle.js + dev\bundle.css，起本地服务
   ============================================================ */

import * as esbuild from 'esbuild';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

const root = import.meta.dirname;
const DEV = process.argv.includes('--dev');
const PORT = 5181;

const THREE = path.join(root, 'vendor', 'three.module.js');
const HTML = path.join(root, 'index.html');
const DIST = path.join(root, 'dist');
const OUT_NAME = 'DJI-Action4-拆解.html';

/** 公共配置：把裸模块名 three 指到本地 vendor，保证离线可用 */
const common = {
  entryPoints: [path.join(root, 'src', 'main.js')],
  bundle: true,
  alias: { three: THREE },
  target: ['chrome110', 'edge110', 'firefox110', 'safari16'],
  legalComments: 'none',
  logLevel: 'info',
  absWorkingDir: root,
};

/* ------------------------------------------------------------
   开发模式：esbuild 自己起服务并监听文件变化
   ------------------------------------------------------------ */
if (DEV) {
  const ctx = await esbuild.context({
    ...common,
    outdir: path.join(root, 'dev'),
    entryNames: 'bundle',
    sourcemap: true,
    format: 'iife',
  });
  await ctx.watch();
  const { host, port } = await ctx.serve({ servedir: root, host: '127.0.0.1', port: PORT });
  console.log(`\n  DJI Action 4 · 拆解页开发服务  http://${host}:${port}/index.html`);
  console.log(`  单件调试参数                http://${host}:${port}/index.html?part=lens&t=1\n`);
} else {
  /* ----------------------------------------------------------
     生产：把 CSS 与 JS 内联进一个 HTML
     ---------------------------------------------------------- */
  await mkdir(DIST, { recursive: true });

  const res = await esbuild.build({
    ...common,
    outdir: DIST,
    entryNames: 'bundle',
    format: 'iife',
    minify: true,
    write: false,
  });

  const pick = (ext) => res.outputFiles.find((f) => f.path.endsWith(ext))?.text ?? '';
  const js = pick('.js');
  const css = pick('.css');

  if (!js) throw new Error('打包失败：没有产出 JS');
  if (!css) console.warn('警告：没有产出 CSS（tokens.css / ui.css 是否被 import？）');

  let html = await readFile(HTML, 'utf8');

  // 注意：替换值必须用「函数形式」。压缩后的 JS 里含有 $& / $1 / $` 之类的序列，
  // 而 String.replace 的字符串替换值会解释它们 —— 尤其是 $& 会把被匹配掉的
  // <script src="./dev/bundle.js"> 原样塞回去，导致内联失败。函数形式不做这种解释。
  html = html.replace(
    /^\s*<link rel="stylesheet" href="\.\/dev\/bundle\.css">\s*$/m,
    () => `<style>\n${css}\n</style>`
  );
  html = html.replace(
    /^\s*<script src="\.\/dev\/bundle\.js"><\/script>\s*$/m,
    () => `<script>\n${sanitizeScript(js)}\n</script>`
  );

  if (html.includes('./dev/bundle.')) {
    throw new Error('内联失败：index.html 里还残留 ./dev/bundle.* 引用');
  }

  const out = path.join(DIST, OUT_NAME);
  await writeFile(out, html, 'utf8');

  const kb = (Buffer.byteLength(html, 'utf8') / 1024).toFixed(0);
  console.log(`\n  ✔ ${out}  (${kb} KB，双击即开，无需服务器)\n`);
}

/** 内联脚本里如果出现 "</script" 会提前闭合标签，转义一下 */
function sanitizeScript(code) {
  return code.replace(/<\/script/gi, '<\\/script');
}