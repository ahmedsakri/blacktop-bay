import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js';

const DEFAULT_DEADLINE_MS = 15_000;

function asError(value, fallback = 'Compressed texture decoding failed.') {
  return value instanceof Error ? value : new Error(typeof value === 'string' && value ? value : fallback);
}

/** One shared transcoder, with a deadline and permanent failure for its session. */
export class BoundedKTX2Loader extends KTX2Loader {
  constructor(manager, { timeoutMs = DEFAULT_DEADLINE_MS, onFailure = null, setTimeout: schedule = globalThis.setTimeout, clearTimeout: cancel = globalThis.clearTimeout } = {}) {
    super(manager);
    this.failure = null;
    this.onFailure = onFailure;
    this.timeoutMs = Number.isFinite(timeoutMs) ? Math.max(1, Math.min(DEFAULT_DEADLINE_MS, timeoutMs)) : DEFAULT_DEADLINE_MS;
    // Browser timers require Window as their receiver; storing them as loader
    // methods without binding throws before the decoder can initialize.
    this._schedule = schedule.bind(globalThis);
    this._cancel = cancel.bind(globalThis);
    this._pending = new Set();
    this._textures = new WeakMap();
    this._boundedInit = null;
    this._baseInitStarted = false;
    this._baseDisposed = false;
    this.setWorkerLimit(2);
  }

  setWorkerLimit(limit) {
    return super.setWorkerLimit(Number.isFinite(limit) ? Math.max(1, Math.min(2, Math.floor(limit))) : 2);
  }

  _track(operation, textureResult = false) {
    if (this.failure) return Promise.reject(this.failure);
    return new Promise((resolve, reject) => {
      const task = { reject, timer: null };
      this._pending.add(task);
      try {
        task.timer = this._schedule(() => this._fail(new Error('Compressed texture decoding exceeded its 15-second deadline.')), this.timeoutMs);
      } catch (error) { this._fail(error); return; }
      const settle = () => {
        if (!this._pending.delete(task)) return false;
        this._cancel(task.timer);
        return true;
      };
      let result;
      try { result = operation(); } catch (error) { this._fail(error); return; }
      Promise.resolve(result).then(value => {
        if (settle()) resolve(value);
        else if (textureResult) value?.dispose?.();
      }, error => {
        if (this._pending.has(task)) this._fail(error);
      });
    });
  }

  _releaseResources() {
    // KTX2Loader decrements a global counter in dispose, even if init never ran.
    // Invoke it at most once, only after its init registered this loader.
    if (this._baseInitStarted && !this._baseDisposed) {
      this._baseDisposed = true;
      super.dispose();
    } else {
      this.workerPool.dispose();
      if (this.workerSourceURL) URL.revokeObjectURL(this.workerSourceURL);
    }
    this.workerSourceURL = '';
    this.transcoderBinary = null;
    this.workerPool.workerCreator = null;
  }

  _fail(reason, notify = true) {
    if (this.failure) return this.failure;
    this.failure = asError(reason);
    for (const task of this._pending) {
      this._cancel(task.timer);
      task.reject(this.failure);
    }
    this._pending.clear();
    this._releaseResources();
    if (notify && typeof this.onFailure === 'function') {
      // A reporting callback must not strand the promises it is reporting.
      try { this.onFailure(this.failure); } catch { /* The loader is already safely failed. */ }
    }
    return this.failure;
  }

  init() {
    if (this.failure) return Promise.reject(this.failure);
    if (this._boundedInit) return this._boundedInit;
    let initialization;
    try {
      initialization = super.init();
      this._baseInitStarted = Boolean(this.transcoderPending);
    } catch (error) {
      return Promise.reject(this._fail(error));
    }
    // This continuation also runs after a deadline: late fetch completion can create
    // a worker Blob URL, which must be revoked without decrementing the counter again.
    const ready = Promise.resolve(initialization).then(() => {
      if (this.failure) {
        this._releaseResources();
        throw this.failure;
      }
      const createWorker = this.workerPool.workerCreator;
      this.workerPool.setWorkerCreator(() => {
        if (this.failure) throw this.failure;
        const worker = createWorker();
        const fatal = event => {
          event.preventDefault?.();
          event.stopImmediatePropagation?.();
          this._fail(event.error || event.data?.error || event.message || 'Compressed texture worker failed.');
        };
        worker.addEventListener('error', fatal);
        worker.addEventListener('messageerror', fatal);
        // Installed before WorkerPool's listener, so a fatal message cannot be
        // mistaken for a completed texture or dispatch another queued task.
        worker.addEventListener('message', event => {
          if (event.data?.type === 'basis-init-error') fatal(event);
        });
        return worker;
      });
      return this;
    });
    this._boundedInit = this._track(() => ready);
    return this._boundedInit;
  }

  _createTexture(buffer, config = {}) {
    if (this.failure) return Promise.reject(this.failure);
    if (this._textures.has(buffer)) return this._textures.get(buffer);
    const pending = this._track(() => super._createTexture(buffer, config), true);
    this._textures.set(buffer, pending);
    return pending;
  }

  load(url, onLoad, onProgress, onError) {
    if (this.failure) {
      if (onError) { onError(this.failure); return; }
      throw this.failure;
    }
    return super.load(url, onLoad, onProgress, onError);
  }

  parse(buffer, onLoad, onError) {
    if (this.workerConfig === null && !this.failure) {
      throw new Error('THREE.KTX2Loader: Missing initialization with `.detectSupport( renderer )`.');
    }
    // Do not use the base parse task cache: it retains unbounded worker promises.
    return this._createTexture(buffer).then(texture => {
      if (onLoad) onLoad(texture);
      return texture;
    }).catch(error => {
      if (onError) { onError(error); return undefined; }
      throw error;
    });
  }

  dispose() {
    this._fail(new Error('Compressed texture loader was disposed.'), false);
    return this;
  }
}
