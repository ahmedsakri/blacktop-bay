const LOGO = '/assets/logo.svg?v=camber-reign-1';
const escape = value => String(value).replace(/[&<>"']/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));

/** Progress is optional and must represent completed work, never elapsed time. */
export function loaderProgress(value) {
  if (!value || !Number.isFinite(value.completed) || !Number.isFinite(value.total) || value.total <= 0) return null;
  const total = Math.floor(value.total);
  if (total < 1) return null;
  const completed = Math.min(total, Math.max(0, Math.floor(value.completed)));
  return { completed, total, percent: completed / total * 100 };
}

export function logoLoaderMarkup({label = 'Preparing Camber Reign…', detail = 'Your next drive is on its way.', variant = 'panel', progress = null} = {}) {
  const compact = variant === 'compact', known = loaderProgress(progress);
  return `<div class="logo-loader logo-loader--${compact ? 'compact' : 'panel'}" data-logo-loader data-determinate="${Boolean(known)}">
    <div class="logo-loader__brand" aria-hidden="true">
      <div class="logo-loader__aura"></div><img src="${LOGO}" alt="" width="900" height="300" decoding="async">
      <svg class="logo-loader__trace" viewBox="0 0 900 300" fill="none" aria-hidden="true" focusable="false"><g transform="translate(12 16) scale(1.15)"><path class="logo-loader__shield" pathLength="100" d="M30 26H180l14 27-38 115-64 41-64-32L8 76Z"/><path class="logo-loader__apex" pathLength="100" d="M26 76 45 43h116l11 16-34 94-48 34-43-25-14-25"/></g><path class="logo-loader__line" pathLength="100" d="M264 257H801l49-39"/></svg>
      <div class="logo-loader__shine"></div>
    </div>
    <div class="logo-loader__copy"><div class="logo-loader__heading"><p class="logo-loader__status" data-loader-label role="status" aria-live="polite" aria-atomic="true">${escape(label)}</p><span class="logo-loader__count" data-loader-count aria-hidden="true">${known ? `${known.completed} / ${known.total}` : ''}</span></div>
    <div class="logo-loader__track" data-loader-progress role="progressbar" aria-label="Completed preparation steps" aria-valuemin="0" aria-valuemax="${known?.total || 100}"${known ? ` aria-valuenow="${known.completed}"` : ''}><i data-loader-fill style="width:${known ? known.percent : 28}%"></i></div>
    <p class="logo-loader__detail" data-loader-detail>${escape(detail)}</p></div>
  </div>`;
}

/** Bind existing startup markup or freshly mounted markup without adding timers. */
export function bindLogoLoader(element) {
  if (!element) throw new Error('A logo loader element is required');
  const label = element.querySelector('[data-loader-label]'), detail = element.querySelector('[data-loader-detail]');
  const count = element.querySelector('[data-loader-count]'), bar = element.querySelector('[data-loader-progress]'), fill = element.querySelector('[data-loader-fill]');
  let disposed = false;
  return {
    update(next = {}) {
      if (disposed) return;
      if (typeof next.label === 'string' && label.textContent !== next.label) label.textContent = next.label;
      if (typeof next.detail === 'string') detail.textContent = next.detail;
      if (!Object.hasOwn(next, 'progress')) return;
      const known = loaderProgress(next.progress);
      element.dataset.determinate = String(Boolean(known));
      count.textContent = known ? `${known.completed} / ${known.total}` : '';
      bar.setAttribute('aria-valuemax', String(known?.total || 100));
      if (known) bar.setAttribute('aria-valuenow', String(known.completed));
      else bar.removeAttribute('aria-valuenow');
      fill.style.width = `${known ? known.percent : 28}%`;
    },
    destroy() { disposed = true; element.remove(); },
  };
}

/** Appends one scoped loader; destroying it leaves the host's other content intact. */
export function mountLogoLoader(host, options = {}) {
  const template = host.ownerDocument.createElement('template');
  template.innerHTML = logoLoaderMarkup(options);
  const element = template.content.firstElementChild;
  host.append(element);
  return bindLogoLoader(element);
}
