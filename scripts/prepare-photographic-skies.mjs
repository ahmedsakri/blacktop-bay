// Offline preparation from reviewed originals named <assetId>.jpg.
// Verify shipping bytes without codecs: node scripts/prepare-photographic-skies.mjs --verify
// Rebuild exact bytes: set CAMBER_SKY_SOURCE_DIR, CAMBER_SHARP_MODULE (optional),
// CAMBER_TOKTX (optional, defaults to toktx on PATH), then run with --force.
// --update-manifest explicitly accepts regenerated derivatives for visual review.
// --family=<name[,name]>, --detail=desktop|mobile and --format=webp|ktx2 narrow that work.
import {readFile, writeFile, mkdtemp, rm, rename} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {pathToFileURL, fileURLToPath} from 'node:url';
import {join, resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {read as readKTX, KHR_DF_MODEL_UASTC, KHR_DF_TRANSFER_SRGB, KHR_SUPERCOMPRESSION_ZSTD} from 'three/addons/libs/ktx-parse.module.js';
import {PHOTOGRAPHIC_SKY_LIMITS} from '../src/photographic-sky-loader.js';

export const SKY_PREPARATION = Object.freeze({
  sourceCrop:'upper-half', resizeKernel:'lanczos3',
  sharpVersions:{sharp:'0.34.5', vips:'8.17.3', webp:'1.6.0', png:'1.6.50'},
  webp:{quality:90, effort:6},
  ktx2:{encoder:'toktx v4.4.2', flags:[
    '--t2', '--lower_left_maps_to_s0t0', '--genmipmap', '--encode', 'uastc',
    '--uastc_quality', '2', '--uastc_rdo_l', '1', '--uastc_rdo_m',
    '--zcmp', '18', '--assign_oetf', 'srgb', '--threads', '1',
  ]},
});
const root = new URL('../public/assets/environments/', import.meta.url);
const hash = buffer => createHash('sha256').update(buffer).digest('hex');
const run = promisify(execFile);
// Includes the minimum 4x4 block at the smallest mip levels (16 bytes per block).
export function skyBlockBytes(width, height) {
  let total = 0;
  do { total += Math.ceil(width / 4) * Math.ceil(height / 4) * 16; if (width === 1 && height === 1) break; width = Math.max(1, width >> 1); height = Math.max(1, height >> 1); } while (true);
  return total;
}
export function inspectSkyKTX(buffer, width, height) {
  if (buffer.length > PHOTOGRAPHIC_SKY_LIMITS.transferBytes) throw new Error('Sky KTX exceeds the runtime transfer limit');
  const ktx = readKTX(buffer);
  if (ktx.pixelWidth !== width || ktx.pixelHeight !== height || width / height !== 4 || width > 8192) throw new Error('Wrong sky KTX dimensions');
  if (ktx.faceCount !== 1 || ktx.layerCount !== 0 || ktx.pixelDepth !== 0) throw new Error('Sky KTX must be one 2D hemisphere');
  if (ktx.keyValue.KTXorientation !== 'ru' || ktx.dataFormatDescriptor[0].colorModel !== KHR_DF_MODEL_UASTC || ktx.dataFormatDescriptor[0].transferFunction !== KHR_DF_TRANSFER_SRGB || ktx.supercompressionScheme !== KHR_SUPERCOMPRESSION_ZSTD) throw new Error('Wrong sky KTX orientation, format or color space');
  if (ktx.keyValue.KTXwriter !== 'toktx v4.4.2 / libktx v4.4.2' || !ktx.keyValue.KTXwriterScParams?.includes('--uastc_rdo_m')) throw new Error('Sky KTX differs from the recorded deterministic encoder recipe');
  if (ktx.levels.length !== Math.floor(Math.log2(width)) + 1) throw new Error('Sky KTX lacks its complete mip chain');
  return {width, height, estimatedGPUBlockBytes:skyBlockBytes(width, height), orientation:'ru', format:'UASTC'};
}

async function main() {
  const args = process.argv.slice(2), verifyOnly = args.includes('--verify'), update = args.includes('--update-manifest'), force = args.includes('--force') || update;
  if (verifyOnly && force) throw new Error('--verify cannot be combined with regeneration');
  const option = name => args.find(arg => arg.startsWith('--' + name + '='))?.split('=')[1];
  const onlyFamilies = option('family')?.split(','), onlyDetail = option('detail'), onlyFormat = option('format');
  const manifestPath = new URL('provenance.json', root), manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  if (onlyFamilies?.some(name => !manifest.families[name]) || onlyDetail && !['desktop', 'mobile'].includes(onlyDetail) || onlyFormat && !['webp', 'ktx2'].includes(onlyFormat)) throw new Error('Unknown sky family, detail or format');
  let sharp, encoderReady = false, work;
  const staged = [];
  const codecs = async compressed => {
    if (!sharp) {
      sharp = (await import(process.env.CAMBER_SHARP_MODULE ? pathToFileURL(process.env.CAMBER_SHARP_MODULE).href : 'sharp')).default;
      for (const [name, version] of Object.entries(SKY_PREPARATION.sharpVersions)) if (sharp.versions[name] !== version) throw new Error(`Expected ${name} ${version}; received ${sharp.versions[name]}`);
    }
    if (compressed && !encoderReady) {
      const version = await run(process.env.CAMBER_TOKTX || 'toktx', ['--version']);
      if ((version.stdout + version.stderr).trim() !== SKY_PREPARATION.ktx2.encoder) throw new Error('Expected ' + SKY_PREPARATION.ktx2.encoder);
      encoderReady = true;
    }
    work ||= await mkdtemp(join(tmpdir(), 'camber-sky-prep-'));
  };
  try {
    for (const [family, entry] of Object.entries(manifest.families)) {
      if (onlyFamilies && !onlyFamilies.includes(family)) continue;
      let source;
      for (const detail of ['desktop', 'mobile']) for (const format of ['webp', 'ktx2']) {
        if (onlyDetail && onlyDetail !== detail || onlyFormat && onlyFormat !== format) continue;
        const compressed = format === 'ktx2', output = compressed ? entry[detail].compressed : entry[detail];
        if (!output) throw new Error('Missing reviewed sky derivative: ' + family + '/' + detail + '/' + format);
        const filename = output.url.split('/').at(-1), file = new URL(filename, root), existing = await readFile(file).catch(() => null);
        if (!force && existing && hash(existing) === output.sha256 && existing.length === output.bytes) {
          if (compressed) inspectSkyKTX(existing, output.width, output.height);
          console.log('Verified', filename); continue;
        }
        if (verifyOnly) throw new Error('Missing or changed sky derivative: ' + filename);
        if (!source) {
          if (!process.env.CAMBER_SKY_SOURCE_DIR) throw new Error('Set CAMBER_SKY_SOURCE_DIR to reviewed originals. Original: ' + entry.source);
          source = await readFile(join(process.env.CAMBER_SKY_SOURCE_DIR, entry.assetId + '.jpg'));
          if (hash(source) !== entry.sourceSha256) throw new Error('Source changed: ' + entry.assetId);
        }
        await codecs(compressed);
        const metadata = await sharp(source).metadata();
        if (metadata.width !== entry.sourceWidth || metadata.height !== entry.sourceHeight) throw new Error('Wrong source dimensions: ' + entry.assetId);
        // New desktop encodes try 8k, then fall back to 4k if their payload
        // exceeds the loader's bound. Exact rebuilds use the reviewed dimensions.
        let width = compressed && update ? (detail === 'mobile' ? 4096 : 8192) : output.width;
        const temporary = join(work, filename);
        let buffer;
        while (true) {
          const image = sharp(source).extract({left:0, top:0, width:metadata.width, height:metadata.height / 2}).resize(width, width / 4, {kernel:SKY_PREPARATION.resizeKernel});
          if (compressed) {
            const png = join(work, filename + '.png');
            await image.png().toFile(png);
            // Ignore user shell defaults so the recorded arguments are complete.
            await run(process.env.CAMBER_TOKTX || 'toktx', [...SKY_PREPARATION.ktx2.flags, temporary, png], {env:{...process.env, TOKTX_OPTIONS:''}, maxBuffer:1024 * 1024});
          } else await image.webp(SKY_PREPARATION.webp).toFile(temporary);
          buffer = await readFile(temporary);
          if (compressed && update && width === 8192 && buffer.length > PHOTOGRAPHIC_SKY_LIMITS.transferBytes) { width = 4096; continue; }
          break;
        }
        const sha256 = hash(buffer), height = width / 4;
        const dimensions = compressed ? inspectSkyKTX(buffer, width, height) : {width, height};
        if (!update && sha256 !== output.sha256) throw new Error('Derivative differs from reviewed checksum; inspect codecs before accepting with --update-manifest: ' + filename);
        if (update) Object.assign(output, dimensions, {sha256, bytes:buffer.length});
        staged.push({temporary, file});
        console.log('Prepared', filename, buffer.length, 'bytes');
      }
    }
    for (const {temporary, file} of staged) await rename(temporary, file);
    if (update) {
      manifest.preparation = SKY_PREPARATION;
      await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
    }
  } finally { if (work) await rm(work, {recursive:true, force:true}); }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
