// Dialog history owns focus only. Callers own markup, visibility and game state.
const focusSelector = 'button,a[href],select,input,textarea,summary,[tabindex]';
const quote = value => JSON.stringify(String(value));

export function isAvailableFocus(element) {
  return Boolean(element && element.isConnected && !element.disabled && !element.hidden
    && !element.closest?.('[hidden],[inert]') && element.getClientRects?.().length);
}
function reference(target) {
  if (typeof target === 'string') return {selector:target};
  if (!target) return null;
  const id = target.id;
  const data = Array.from(target.attributes || []).find(attribute => attribute.name.startsWith('data-'));
  const selector = id ? `[id=${quote(id)}]` : data ? `[${data.name}=${quote(data.value)}]` : null;
  return {element:target,selector};
}
export function focusDialogTarget(target, {document, fallback, revealDetails = false} = {}) {
  const saved = target && typeof target === 'object' && ('element' in target || 'selector' in target) ? target : reference(target);
  const candidates = [saved?.element, saved?.selector && document?.querySelector(saved.selector)];
  if (fallback) candidates.push(typeof fallback === 'function' ? fallback() : typeof fallback === 'string' ? document?.querySelector(fallback) : fallback);
  for (const element of candidates) {
    // A rebuilt parent view may have collapsed the disclosure containing its launcher.
    if (revealDetails && element?.isConnected && !element.closest?.('[hidden],[inert]')) {
      let details = element.parentElement?.closest?.('details');
      while (details) { details.open = true; details = details.parentElement?.closest?.('details'); }
    }
    if (!isAvailableFocus(element)) continue;
    element.focus({preventScroll:true});
    if (!document || document.activeElement === element) return true;
  }
  return false;
}
export function dialogFocusable(dialog) {
  return Array.from(dialog?.querySelectorAll(focusSelector) || []).filter(element => element.tabIndex >= 0 && isAvailableFocus(element));
}
export function trapDialogFocus(event, dialog) {
  if (event.key !== 'Tab') return false;
  const elements = dialogFocusable(dialog), first = elements[0], last = elements.at(-1);
  if (!first) {event.preventDefault();dialog?.focus({preventScroll:true});return true;}
  const active = dialog.ownerDocument?.activeElement;
  if (event.shiftKey && (active === first || active === dialog || !dialog.contains(active))) {
    event.preventDefault();last.focus({preventScroll:true});return true;
  }
  if (!event.shiftKey && (active === last || !dialog.contains(active))) {
    event.preventDefault();first.focus({preventScroll:true});return true;
  }
  return false;
}
export function createDialogNavigation({document, dialog, fallback} = {}) {
  let opened = false, returnTarget = null;
  const parents = [];
  const focus = target => focusDialogTarget(target,{document,fallback});
  return {
    open({returnTo} = {}) {
      // Replacing one dialog with another must not replace the original external
      // opener with a button that is about to be removed from the document.
      if (returnTo) returnTarget = reference(returnTo);
      else if (!opened) {
        const active = document?.activeElement;
        returnTarget = active && !dialog?.contains(active) ? reference(active) : null;
      }
      opened = true;
    },
    setReturnTarget(target) {returnTarget = reference(target);},
    pushParent({restore, focus:target = document?.activeElement} = {}) {
      if (typeof restore !== 'function') return false;
      parents.push({restore,target:reference(target)});return true;
    },
    back() {
      const parent = parents.pop();
      if (!parent) return false;
      parent.restore();
      focusDialogTarget(parent.target,{document,fallback:() => dialogFocusable(dialog)[0] || dialog,revealDetails:true});
      return true;
    },
    resetParents() {parents.length = 0;},
    close() {
      const target = returnTarget;
      opened = false;returnTarget = null;parents.length = 0;
      return focus(target);
    },
    get depth() {return parents.length;},
  };
}
