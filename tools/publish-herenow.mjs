// Publishes dist/ to here.now (static hosting). Without HERENOW_API_KEY the site is
// anonymous: it expires after 24 hours unless claimed with the returned claim URL.
// usage: npm run build && node tools/publish-herenow.mjs
import fs from 'node:fs';
import path from 'node:path';

const API = 'https://here.now/api/v1';
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.json': 'application/json', '.jpg': 'image/jpeg', '.png': 'image/png', '.css': 'text/css' };
const files = [];
const walk = (d) => {
  for (const f of fs.readdirSync(d)) {
    const p = path.join(d, f);
    if (fs.statSync(p).isDirectory()) walk(p);
    else files.push({ abs: p, path: path.relative('dist', p).split(path.sep).join('/'), size: fs.statSync(p).size, contentType: TYPES[path.extname(p)] || 'application/octet-stream' });
  }
};
walk('dist');
const headers = { 'Content-Type': 'application/json', 'X-HereNow-Client': 'claude-code/big-fish' };
if (process.env.HERENOW_API_KEY) headers.Authorization = `Bearer ${process.env.HERENOW_API_KEY}`;

const res = await fetch(`${API}/publish`, {
  method: 'POST',
  headers,
  body: JSON.stringify({ files: files.map(({ path, size, contentType }) => ({ path, size, contentType })) }),
});
const site = await res.json();
if (!res.ok) {
  console.error('publish failed', res.status, JSON.stringify(site));
  process.exit(1);
}
const byPath = new Map(files.map((f) => [f.path, f]));
for (const u of site.upload.uploads) {
  const f = byPath.get(u.path);
  const r = await fetch(u.url, { method: u.method || 'PUT', headers: { 'Content-Type': f.contentType, ...(u.headers || {}) }, body: fs.readFileSync(f.abs) });
  if (!r.ok) {
    console.error('upload failed', u.path, r.status, await r.text());
    process.exit(1);
  }
  console.log('uploaded', u.path);
}
const fin = await fetch(`${API}/publish/${site.slug}/finalize`, { method: 'POST', headers, body: JSON.stringify({ versionId: site.upload.versionId }) });
const done = await fin.json();
if (!fin.ok) {
  console.error('finalize failed', fin.status, JSON.stringify(done));
  process.exit(1);
}
console.log(JSON.stringify({ siteUrl: done.siteUrl || site.siteUrl, claimUrl: site.claimUrl, expiresAt: site.expiresAt || done.expiresAt, slug: site.slug }, null, 2));
