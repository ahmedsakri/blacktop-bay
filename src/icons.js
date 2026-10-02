// Self-hosted SVG symbols keep every control independent of font/OS glyphs.
export function icon(name, className = '') {
  return `<svg class="ui-icon ${className}" aria-hidden="true" focusable="false"><use href="/assets/ui/race-icons.svg?v=20261002-3#${name}"></use></svg>`;
}
