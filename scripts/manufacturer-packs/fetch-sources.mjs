/** Fetch the exact licensed archive copies recorded for the expansion packs. */
import {readFile, writeFile, mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve, join} from 'node:path';
import {fileURLToPath} from 'node:url';

const args = process.argv.slice(2);
const option = name => { const i = args.indexOf(name); return i < 0 ? null : args[i + 1]; };
const out = option('--out');
if (!out) throw new Error('Usage: node scripts/manufacturer-packs/fetch-sources.mjs --out <source-directory> [--pack <pack-name>] [--check]');
const destination = resolve(out);
const evidence = fileURLToPath(new URL('../../docs/manufacturer-sources/', import.meta.url));
const {models} = JSON.parse(await readFile(join(evidence, 'source-index.json'), 'utf8'));
const selected = models.filter(model => !option('--pack') || model.pack === option('--pack'));
if (!selected.length) throw new Error('No models match the requested pack.');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
if (!args.includes('--check')) await mkdir(destination, {recursive: true});
for (const model of selected) {
  const metadata = await readFile(join(evidence, model.metadata));
  const parsed = JSON.parse(metadata), license = (parsed.metadata || parsed).license;
  if (license?.slug !== 'by' || !String(license.url).includes('/by/4.0'))
    throw new Error(`${model.id}: preserved source evidence must identify CC BY 4.0.`);
  const target = join(destination, `${model.uid}.glb`);
  let bytes;
  try { bytes = await readFile(target); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  if (!bytes) {
    if (args.includes('--check')) throw new Error(`${model.id}: source is missing from ${destination}`);
    const response = await fetch(model.download);
    if (!response.ok) throw new Error(`${model.id}: archive returned HTTP ${response.status}`);
    bytes = Buffer.from(await response.arrayBuffer());
    if (hash(bytes) !== model.sourceSha256) throw new Error(`${model.id}: downloaded source checksum differs from the licensed reviewed copy.`);
    await writeFile(target, bytes);
  }
  if (hash(bytes) !== model.sourceSha256) throw new Error(`${model.id}: local source checksum differs from the reviewed copy; existing file was preserved.`);
  if (!args.includes('--check')) await writeFile(join(destination, `${model.uid}.json`), metadata);
  console.log(`${model.id}: verified ${bytes.length} source bytes${args.includes('--check') ? '' : ' and copied attribution evidence'}`);
}
