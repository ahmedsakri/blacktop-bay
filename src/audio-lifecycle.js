// Web Audio graphs may be silent yet continue processing. Suspend only after a
// quiet fade; resume an existing graph after prior user authorization. Timer
// and context seams permit lifecycle tests without a speaker or real browser.
export function createAudioLifecycle({getContext, wanted, changed = () => {}, schedule = setTimeout, cancel = clearTimeout, idleDelay = 240} = {}) {
 let authorized = false, disposed = false, timer = null, operation = null, retryBlocked = false;
 const clear = () => {if (timer !== null) cancel(timer); timer = null;};
 const resume = () => {
  const context = getContext();
  if (disposed || !authorized || !wanted() || !context || context.state === 'closed' || context.state === 'interrupted' || retryBlocked) return;
  if (context.state === 'running' || operation) return;
  operation = Promise.resolve().then(() => {if (!disposed && wanted()) return context.resume();}).catch(() => {retryBlocked = true;}).finally(() => {
   operation = null; changed();
   if (!disposed && !wanted()) sync();
  });
 };
 function sync() {
  if (disposed) return;
  if (wanted()) {clear(); resume(); return;}
  if (timer !== null || !authorized || getContext()?.state !== 'running') return;
  timer = schedule(() => {
   timer = null;
   const context = getContext();
   if (disposed || wanted() || context?.state !== 'running' || typeof context.suspend !== 'function') return;
   operation = Promise.resolve().then(() => context.suspend()).catch(() => {}).finally(() => {
    operation = null; changed(); if (!disposed && wanted()) resume();
   });
  }, idleDelay);
  timer?.unref?.();
 }
 return {
  authorize() {authorized = true; retryBlocked = false; sync();},
  sync,
  // A browser interruption is allowed to finish naturally. A later suspended
  // state can be resumed once; a rejected resume waits for the next gesture.
  stateChanged() {if (!disposed) {changed(); sync();}},
  dispose() {disposed = true; clear();},
 };
}
