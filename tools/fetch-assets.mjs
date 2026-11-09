// Downloads the CC0 sand/rock textures and scanned rocks the reef uses from Poly Haven
// (https://polyhaven.com) into public/assets. Safe to re-run: existing files are skipped.
import fs from 'node:fs';
import path from 'node:path';

const OUT = path.resolve('public/assets');
const RES = '1k';

// id -> which maps to keep (diff = albedo, nor_gl = normal, rough/arm = roughness)
const TEXTURES = {
  coast_sand_01: ['diff', 'nor_gl'],
  lichen_rock: ['diff', 'nor_gl'],
  mossy_rock: ['diff', 'nor_gl'],
};
const MODELS = ['rock_moss_set_01', 'rock_moss_set_02'];

async function get(url, dest) {
  if (fs.existsSync(dest) && fs.statSync(dest).size > 0) return 'skip';
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const r = await fetch(url);
      if (!r.ok) throw new Error(`${r.status} ${url}`);
      fs.writeFileSync(dest, Buffer.from(await r.arrayBuffer()));
      return 'ok';
    } catch (e) {
      if (attempt === 2) throw e;
    }
  }
}

async function files(id) {
  const r = await fetch(`https://api.polyhaven.com/files/${id}`);
  if (!r.ok) throw new Error(`files ${id}: ${r.status}`);
  return r.json();
}

const jobs = [];
for (const [id, maps] of Object.entries(TEXTURES)) {
  jobs.push((async () => {
    const f = await files(id);
    for (const m of maps) {
      const key = m === 'nor_gl' ? 'nor_gl' : m === 'diff' ? 'Diffuse' : m;
      const entry = (f[key] || f[m])?.[RES]?.jpg;
      if (!entry) { console.warn(`! ${id} has no ${m}`); continue; }
      const res = await get(entry.url, path.join(OUT, 'tex', `${id}_${m}.jpg`));
      console.log(res.padEnd(4), `${id}_${m}`);
    }
  })());
}
for (const id of MODELS) {
  jobs.push((async () => {
    const f = await files(id);
    const g = f.gltf[RES].gltf;
    const dir = path.join(OUT, 'models', id);
    if (fs.existsSync(path.join(dir, `${id}.json`))) return console.log('skip', id);
    await get(g.url, path.join(dir, `${id}.gltf`));
    for (const [rel, inc] of Object.entries(g.include)) await get(inc.url, path.join(dir, rel));
    // inline the binary buffers and save as .json so the model is one plain JSON file
    const gltfPath = path.join(dir, `${id}.gltf`);
    const doc = JSON.parse(fs.readFileSync(gltfPath, 'utf8'));
    for (const b of doc.buffers) {
      if (b.uri.startsWith('data:')) continue;
      const bin = path.join(dir, b.uri);
      b.uri = 'data:application/octet-stream;base64,' + fs.readFileSync(bin).toString('base64');
      fs.rmSync(bin);
    }
    fs.writeFileSync(path.join(dir, `${id}.json`), JSON.stringify(doc));
    fs.rmSync(gltfPath);
    console.log('ok  ', id);
  })());
}
await Promise.all(jobs);
console.log('done');
