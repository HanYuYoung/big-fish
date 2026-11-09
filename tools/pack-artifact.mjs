// Turns the Vite build in dist/ into a page for claude.ai Artifact publishing:
// the page body without its own <html>/<head>/<body> wrapper, plus the asset files.
import fs from 'node:fs';
import path from 'node:path';

const html = fs
  .readFileSync('dist/index.html', 'utf8')
  .replace(/<!doctype html>/i, '')
  .replace(/<\/?html[^>]*>/gi, '')
  .replace(/<\/?head>/gi, '')
  .replace(/<body[^>]*>/i, '')
  .replace(/<\/body>/i, '')
  .replace(/<meta charset="utf-8">\s*/i, '')
  .trim();
fs.mkdirSync('artifact', { recursive: true });
fs.writeFileSync('artifact/index.html', html + '\n');
const files = {};
const walk = (d) => {
  for (const f of fs.readdirSync(d)) {
    const p = path.join(d, f);
    if (fs.statSync(p).isDirectory()) walk(p);
    else files[path.relative('dist', p).split(path.sep).join('/')] = p.split(path.sep).join('/');
  }
};
walk('dist/assets');
fs.writeFileSync('artifact/files.json', JSON.stringify(files, null, 1));
console.log(Object.keys(files).length, 'files');
