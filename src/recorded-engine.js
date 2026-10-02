import { ENGINE_RECORDINGS, RECORDING_CARS, RECORDING_MIXES } from './recorded-engine-manifest.js';

export const RECORDING_BUDGET = Object.freeze({ banks: 3, decodedBytes: 3 * 1024 * 1024, downloadBytes: 256 * 1024, voices: 3, timeoutMs: 8000 });
const clamp = (value, low, high) => Math.max(low, Math.min(high, Number.isFinite(value) ? value : low));
export function recordingForVehicle(vehicle = {}) {
  const bank = ENGINE_RECORDINGS[RECORDING_CARS[vehicle.id]];
  if (!bank || (vehicle.powertrain && (vehicle.powertrain === 'electric') !== (bank.kind === 'electric'))) return null;
  return bank;
}

/** Authored normalized-rev blend; source RPMs were not measured. */
export function recordedEngineFrame(bank, motion = {}, mix = [1, 1, 1]) {
  if (!bank) return { layers: [], cutoff: 0, gain: 0 };
  const rev = clamp(motion.rev, 0, 1), load = clamp(motion.load, 0, 1), torque = clamp(motion.torque ?? 1, 0, 1);
  const weights = bank.layers.map(() => 0);
  if (weights.length === 1) weights[0] = 1 - .72 * rev; // An idle take is not a high-RPM recording.
  else if (rev <= bank.layers[0].rev) weights[0] = 1;
  else if (rev >= bank.layers.at(-1).rev) weights[weights.length - 1] = 1;
  else for (let i = 0; i < bank.layers.length - 1; i++) {
    if (rev >= bank.layers[i].rev && rev < bank.layers[i + 1].rev) {
      const phase = (rev - bank.layers[i].rev) / (bank.layers[i + 1].rev - bank.layers[i].rev);
      weights[i] = Math.cos(phase * Math.PI / 2); weights[i + 1] = Math.sin(phase * Math.PI / 2); break;
    }
  }
  const electric = bank.kind === 'electric';
  // Driving takes contain road/motor motion: do not loop that sound at a standstill.
  const rolling = clamp((rev - .015) / .14, 0, 1);
  const presence = bank.movingOnly ? rolling * rolling * (3 - 2 * rolling) : 1;
  const pitch = clamp(mix[0], .88, 1.1), tone = clamp(mix[1], .8, 1.1), level = clamp(mix[2], 0, 1);
  return { gain: (electric ? .09 + .22 * load : .13 + .29 * load) * torque * clamp(motion.focus ?? 1, .75, 1) * level * presence,
    cutoff: (electric ? 1600 + 2200 * rev + 700 * load : 900 + 2300 * rev + 1400 * load) * tone,
    exhaust: electric ? 0 : .4 + .6 * load, presence,
    layers: bank.layers.map((layer, i) => ({ gain: weights[i], rate: clamp((1 + (rev - layer.rev) * .42) * pitch, .82, 1.3) })) };
}

async function boundedBytes(response, limit) {
  if (!response?.ok) throw new Error('Recording request failed.');
  const size = Number(response.headers?.get?.('content-length'));
  if (size > limit) throw new Error('Recording exceeds its download budget.');
  if (!response.body?.getReader) {
    const bytes = await response.arrayBuffer();
    if (bytes.byteLength > limit) throw new Error('Recording exceeds its download budget.');
    return bytes;
  }
  const reader = response.body.getReader(), chunks = [];
  let length = 0;
  try {
    while (true) {
      const part = await reader.read(); if (part.done) break;
      length += part.value.byteLength;
      if (length > limit) throw new Error('Recording exceeds its download budget.');
      chunks.push(part.value);
    }
  } catch (error) { await reader.cancel().catch(() => {}); throw error; }
  finally { reader.releaseLock(); }
  const bytes = new Uint8Array(length); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  return bytes.buffer;
}

/** Three loop voices, one selected-bank request and an LRU of decoded buffers. */
export function createRecordedEngine({ context, destination, fetchImpl = globalThis.fetch, schedule = globalThis.setTimeout, cancel = globalThis.clearTimeout } = {}) {
  const cache = new Map(), failed = new Set(), voices = [], graph = [];
  let selected = null, active = null, wanted = false, disposed = false, request = null, generation = 0, use = 0, blend = 0, fetches = 0;
  let filter = null, exhaust = null, output = null;
  const available = typeof context?.decodeAudioData === 'function' && typeof fetchImpl === 'function';
  const later = schedule.bind(globalThis), clear = cancel.bind(globalThis);
  const target = (parameter, value, seconds = .075) => {
    try { parameter?.setTargetAtTime(value, context.currentTime, seconds); } catch { /* Context may be closing. */ }
  };
  const bytesUsed = () => [...cache.values()].reduce((sum, entry) => sum + entry.bytes, 0);
  function trim() {
    for (const [id] of [...cache].sort((a, b) => a[1].used - b[1].used)) {
      if (cache.size <= RECORDING_BUDGET.banks && bytesUsed() <= RECORDING_BUDGET.decodedBytes) break;
      if (id !== active?.id) cache.delete(id);
    }
  }
  function stopVoices() {
    for (const voice of voices.splice(0)) {
      try { voice.source.stop(); voice.source.disconnect(); voice.gain.disconnect(); } catch { /* Already stopped. */ }
    }
    active = null; blend = 0;
  }
  function activate(bank, entry) {
    if (disposed || !wanted || selected?.id !== bank.id || active?.id === bank.id) return;
    stopVoices();
    try {
      if (!output) {
        output = context.createGain(); output.gain.value = 0; output.connect(destination);
        filter = context.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = 1400; filter.Q.value = .45; filter.connect(output);
        exhaust = context.createBiquadFilter(); exhaust.type = 'lowshelf'; exhaust.frequency.value = 180; exhaust.gain.value = 0; exhaust.connect(filter);
        graph.push(output, filter, exhaust);
      }
      for (const layer of bank.layers) {
        const source = context.createBufferSource(), gain = context.createGain();
        source.buffer = entry.buffer; source.loop = true; source.loopStart = layer.start; source.loopEnd = layer.end;
        gain.gain.value = 0; source.connect(gain); gain.connect(exhaust);
        voices.push({ source, gain }); source.start(context.currentTime, layer.start);
      }
      active = bank; entry.used = ++use; trim();
    } catch { failed.add(bank.id); stopVoices(); }
  }
  function pump() {
    if (!available || disposed || !wanted || !selected || request || failed.has(selected.id)) return;
    const bank = selected, existing = cache.get(bank.id);
    if (existing) { activate(bank, existing); return; }
    const controller = new AbortController(), token = ++generation;
    const job = { controller, token, timer: null }; request = job; fetches++;
    const work = (async () => {
      const response = await fetchImpl(bank.url, { signal: controller.signal, credentials: 'same-origin', cache: 'force-cache' });
      if (controller.signal.aborted || disposed || request !== job || token !== generation) throw new Error('Recording was cancelled.');
      const bytes = await boundedBytes(response, Math.min(bank.bytes, RECORDING_BUDGET.downloadBytes));
      if (controller.signal.aborted || disposed || request !== job || token !== generation) throw new Error('Recording was cancelled.');
      if (bytes.byteLength !== bank.bytes) throw new Error('Incomplete recording.');
      const buffer = await context.decodeAudioData(bytes);
      if (buffer.numberOfChannels !== 1 || !Number.isFinite(buffer.duration) || Math.abs(buffer.duration - bank.duration) > .025 || !Number.isFinite(buffer.length)) throw new Error('Unexpected recording format.');
      const decodedBytes = buffer.length * buffer.numberOfChannels * 4;
      if (decodedBytes > RECORDING_BUDGET.decodedBytes) throw new Error('Recording exceeds its decoded budget.');
      return { buffer, bytes: decodedBytes, used: ++use };
    })();
    const deadline = new Promise((resolve, reject) => {
      job.timer = later(() => { controller.abort(); reject(new Error('Recording request timed out.')); }, RECORDING_BUDGET.timeoutMs);
      job.timer?.unref?.();
    });
    Promise.race([work, deadline]).then(entry => {
      if (disposed || request !== job || token !== generation) return;
      cache.set(bank.id, entry); trim(); activate(bank, entry);
    }).catch(() => { if (!disposed && !job.cancelled) failed.add(bank.id); })
      .finally(() => { clear(job.timer); if (request === job) { request = null; pump(); } });
  }
  function setAudible(value) {
    const next = value === true && available && !disposed;
    if (wanted === next) return;
    wanted = next;
    if (!wanted) {
      target(output?.gain, 0, .035);
      if (request) { generation++; request.cancelled = true; request.controller.abort(); }
    }
  }
  function update(vehicle, motion, dt = 1 / 60) {
    if (disposed || !available) return 0;
    const bank = recordingForVehicle(vehicle);
    if (bank?.id !== selected?.id) {
      selected = bank; stopVoices();
      if (request) { generation++; request.cancelled = true; request.controller.abort(); }
    }
    if (!wanted) return 0;
    pump();
    if (!active || active.id !== selected?.id) return 0;
    const frame = recordedEngineFrame(active, motion, RECORDING_MIXES[vehicle.id]);
    blend += (1 - blend) * (1 - Math.exp(-clamp(dt, 0, .1) / .18));
    target(output.gain, frame.gain * blend);
    target(filter.frequency, frame.cutoff, .11);
    target(exhaust.gain, frame.exhaust * 2.5, .12);
    for (let i = 0; i < voices.length; i++) {
      target(voices[i].gain.gain, frame.layers[i].gain, .08);
      target(voices[i].source.playbackRate, frame.layers[i].rate, .07);
    }
    return blend * frame.presence;
  }
  function dispose() {
    if (disposed) return; disposed = true; wanted = false; generation++;
    if (request) { clear(request.timer); request.controller.abort(); request = null; }
    stopVoices(); for (const node of graph) try { node.disconnect(); } catch { /* Already disconnected. */ }
    graph.length = 0; cache.clear();
  }
  return { update, setAudible, dispose, status: () => ({ available, selected: selected?.id || null, active: active?.id || null, cacheBanks: cache.size, decodedBytes: bytesUsed(), voices: voices.length, pending: Boolean(request), fetches, failed: [...failed], blend }) };
}
