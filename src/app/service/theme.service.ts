import {Injectable, signal} from '@angular/core';
import {ThemeState} from '../themeswitcher';
import {BankTransaction} from './transaction.service';

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
  private color_pointer = 0;

  theme_state = signal<ThemeState>(null);
  // account_monitor → CSS variable name (e.g. '--p-blue-500')
  monitor_color_map: Map<string, string> = new Map();
  color_array = [...CHART_COLOR_VARS];

  resolve_monitor_color(external_id: string): string {
    if (this.monitor_color_map.has(external_id)) {
      return this.monitor_color_map.get(external_id);
    } else {
      if (this.color_pointer >= this.color_array.length){
        this.color_pointer = 0;
      }
      let cssVar = this.color_array[this.color_pointer];
      const color = get_css_var(cssVar);
      this.monitor_color_map.set(external_id, color);
      this.color_pointer++;
      return color;
    }
  }

  /** Resolves CHART_COLOR_VARS to actual colour values at the moment of calling. */
  get_chart_fills(): string[] {
    return CHART_COLOR_VARS.toReversed().map(v => get_css_var(v)).filter(c => c.length > 0);
  }

}
