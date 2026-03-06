import {Injectable, signal} from '@angular/core';
import {ThemeState} from '../themeswitcher';




/**
 * PrimeNG CSS variable names used as chart colors.
 * Each entry maps to a --p-{color}-{shade} custom property on :root.
 * get_css_var() resolves the current computed value at runtime,
 * so colors automatically follow the active PrimeNG theme, primary and surface.
 */
export const CHART_COLOR_VARS = [
  '--p-blue-500',
  '--p-green-500',
  '--p-orange-500',
  '--p-purple-500',
  '--p-teal-500',
  '--p-yellow-500',
  '--p-pink-500',
  '--p-cyan-500',
  '--p-red-500',
  '--p-indigo-500',
  '--p-sky-500',
  '--p-violet-500',
  '--p-emerald-500',
] as const;

/** Read a PrimeNG CSS variable from the document root and return its resolved value. */
export function get_css_var(varName: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
}

@Injectable({
  providedIn: 'root',
})
export class ThemeService {
  theme_state = signal<ThemeState>(null);
  // account_monitor → CSS variable name (e.g. '--p-blue-500')
  color_map: Map<string, string> = new Map();
  color_array = [...CHART_COLOR_VARS];

  /** Returns the live resolved color for a given external_id.
   *  Reads the CSS variable from the DOM, so it always reflects
   *  the current PrimeNG theme (preset, primary, surface, dark/light). */
  get_color(external_id: string): string {
    const cssVar = this.color_map.get(external_id);
    if (!cssVar) return get_css_var('--p-surface-500') || '#888888';
    return get_css_var(cssVar);
  }
}
