import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Component, computed, effect, inject, PLATFORM_ID, signal } from '@angular/core';
import { $t, updatePreset, updateSurfacePalette } from '@primeuix/themes';
import Aura from '@primeuix/themes/aura';
import Lara from '@primeuix/themes/lara';
import Material from '@primeuix/themes/material';
import Nora from '@primeuix/themes/nora';
import { PrimeNG } from 'primeng/config';
import { SelectButtonModule } from 'primeng/selectbutton';
import { StyleClassModule } from 'primeng/styleclass';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { DOCUMENT, isPlatformBrowser } from '@angular/common';

const presets = {
  Aura,
  Material,
  Lara,
  Nora
};

export interface ThemeState {
  preset?: string;
  primary?: string;
  surface?: string;
  darkTheme?: boolean;
}

@Component({
  selector: 'theme-switcher',
  standalone: true,
  imports: [CommonModule, FormsModule, StyleClassModule, SelectButtonModule, ToggleSwitchModule],
  template: ` <div class="card flex justify-end p-2 mb-4">
        <ul class="flex list-none m-0 p-0 gap-2 items-center">
            <li>
                <button type="button" class="inline-flex w-8 h-8 p-0 items-center justify-center surface-0 dark:surface-800 border border-surface-200 dark:border-surface-600 rounded" (click)="onThemeToggler()">
                    <i [ngClass]="'pi ' + iconClass()" class="dark:text-white"></i>
                </button>
            </li>
            <li class="relative">
                <button
                    pStyleClass="@next"
                    enterFromClass="hidden"
                    enterActiveClass="animate-scalein"
                    leaveToClass="hidden"
                    leaveActiveClass="animate-fadeout"
                    [hideOnOutsideClick]="true"
                    type="button"
                    class="inline-flex w-8 h-8 p-0 items-center justify-center surface-0 dark:surface-800 border border-surface-200 dark:border-surface-600 rounded"
                >
                    <i class="pi pi-palette dark:text-white"></i>
                </button>
                <div class="absolute top-[2.5rem] right-0 hidden w-[18rem] p-3 bg-white dark:bg-surface-800 rounded-md shadow border border-surface-200 dark:border-surface-700 flex-col justify-start items-start gap-3.5 inline-flex origin-top z-10">
                    <div class="flex-col justify-start items-start gap-2 inline-flex pr-4">
                        <span class="text-sm font-medium">Primary Colors</span>
                        <div class="self-stretch justify-start items-start gap-2 inline-flex flex-wrap">
                            @for (primaryColor of primaryColors(); track primaryColor.name) {
                                <button
                                    type="button"
                                    [title]="primaryColor.name"
                                    (click)="updateColors($event, 'primary', primaryColor)"
                                    class="outline outline-2 outline-offset-1 outline-transparent cursor-pointer p-0 rounded-[50%] w-5 h-5"
                                    [ngStyle]="{
                                        'background-color': primaryColor.name === 'noir' ? 'var(--text-color)' : primaryColor.palette['500'],
                                        'outline-color': selectedPrimaryColor() === primaryColor.name ? 'var(--p-primary-color)' : ''
                                    }"
                                ></button>
                            }
                        </div>
                    </div>
                    <div class="flex-col justify-start items-start gap-2 inline-flex pr-2">
                        <span class="text-sm font-medium">Surface Colors</span>
                        <div class="self-stretch justify-start items-start gap-2 inline-flex">
                            @for (surface of surfaces; track surface.name) {
                                <button
                                    type="button"
                                    [title]="surface.name"
                                    (click)="updateColors($event, 'surface', surface)"
                                    class="outline outline-2 outline-offset-1 outline-transparent cursor-pointer p-0 rounded-[50%] w-5 h-5"
                                    [ngStyle]="{
                                        'background-color': surface.palette['500'],
                                        'outline-color': selectedSurfaceColor() === surface.name ? 'var(--p-primary-color)' : ''
                                    }"
                                ></button>
                            }
                        </div>
                    </div>
                    <div class="flex-col justify-start items-start gap-2 inline-flex w-full">
                        <span class="text-sm font-medium">Preset</span>
                        <div class="inline-flex p-[0.28rem] items-start gap-[0.28rem] rounded-[0.71rem] border border-[#00000003] w-full">
                            <p-selectbutton [options]="presets" [ngModel]="selectedPreset()" (ngModelChange)="onPresetChange($event)" [unselectable]="false" size="small" />
                        </div>
                    </div>
                    <div class="inline-flex flex-col justify-start items-start gap-2 w-full pt-4 pb-2">
                        <span class="text-sm font-medium m-0">Ripple Effect</span>
                        <p-toggleswitch [(ngModel)]="ripple" />
                    </div>
                </div>
            </li>
        </ul>
    </div>`
})
export class ThemeSwitcher {
  private readonly STORAGE_KEY = 'themeSwitcherState';

  document = inject(DOCUMENT);

  iconClass = computed(() =>
    this.themeState().darkTheme ? 'pi-sun' : 'pi-moon'
  );

  presets = Object.keys(presets);

  platformId = inject(PLATFORM_ID);

  config: PrimeNG = inject(PrimeNG);

  themeState = signal<ThemeState>(null);

  theme = computed(() => (this.themeState()?.darkTheme ? 'dark' : 'light'));

  selectedPreset = computed(() => this.themeState().preset);

  selectedSurfaceColor = computed(() => this.themeState().surface);

  selectedPrimaryColor = computed(() => {
    return this.themeState().primary;
  });

  constructor() {
    this.themeState.set({ ...this.loadthemeState() });

    effect(() => {
      const state = this.themeState();

      this.savethemeState(state);
      this.handleDarkModeTransition(state);
    });
  }

  ngOnInit() {
    if (isPlatformBrowser(this.platformId)) {
      this.onPresetChange(this.themeState().preset);
    }
  }

  get ripple() {
    return this.config.ripple();
  }

  set ripple(value: boolean) {
    this.config.ripple.set(value);
  }

  transitionComplete = signal<boolean>(false);

  primaryColors = computed(() => {
    const presetPalette = presets[this.themeState().preset].primitive;
    const colors = [
      'emerald',
      'green',
      'lime',
      'orange',
      'amber',
      'yellow',
      'teal',
      'cyan',
      'sky',
      'blue',
      'indigo',
      'violet',
      'purple',
      'fuchsia',
      'pink',
      'rose',
    ];
    const palettes = [{ name: 'noir', palette: {} }];

    colors.forEach((color) => {
      palettes.push({
        name: color,
        palette: presetPalette[color],
      });
    });

    return palettes;
  });

  surfaces = [
    {
      name: 'slate',
      palette: {
        0: '#ffffff',
        50: '#f8fafc',
        100: '#f1f5f9',
        200: '#e2e8f0',
        300: '#cbd5e1',
        400: '#94a3b8',
        500: '#64748b',
        600: '#475569',
        700: '#334155',
        800: '#1e293b',
        900: '#0f172a',
        950: '#020617',
      },
    },
    {
      name: 'gray',
      palette: {
        0: '#ffffff',
        50: '#f9fafb',
        100: '#f3f4f6',
        200: '#e5e7eb',
        300: '#d1d5db',
        400: '#9ca3af',
        500: '#6b7280',
        600: '#4b5563',
        700: '#374151',
        800: '#1f2937',
        900: '#111827',
        950: '#030712',
      },
    },
    {
      name: 'zinc',
      palette: {
        0: '#ffffff',
        50: '#fafafa',
        100: '#f4f4f5',
        200: '#e4e4e7',
        300: '#d4d4d8',
        400: '#a1a1aa',
        500: '#71717a',
        600: '#52525b',
        700: '#3f3f46',
        800: '#27272a',
        900: '#18181b',
        950: '#09090b',
      },
    },
    {
      name: 'neutral',
      palette: {
        0: '#ffffff',
        50: '#fafafa',
        100: '#f5f5f5',
        200: '#e5e5e5',
        300: '#d4d4d4',
        400: '#a3a3a3',
        500: '#737373',
        600: '#525252',
        700: '#404040',
        800: '#262626',
        900: '#171717',
        950: '#0a0a0a',
      },
    },
    {
      name: 'stone',
      palette: {
        0: '#ffffff',
        50: '#fafaf9',
        100: '#f5f5f4',
        200: '#e7e5e4',
        300: '#d6d3d1',
        400: '#a8a29e',
        500: '#78716c',
        600: '#57534e',
        700: '#44403c',
        800: '#292524',
        900: '#1c1917',
        950: '#0c0a09',
      },
    },
    {
      name: 'soho',
      palette: {
        0: '#ffffff',
        50: '#ececec',
        100: '#dedfdf',
        200: '#c4c4c6',
        300: '#adaeb0',
        400: '#97979b',
        500: '#7f8084',
        600: '#6a6b70',
        700: '#55565b',
        800: '#3f4046',
        900: '#2c2c34',
        950: '#16161d',
      },
    },
    {
      name: 'viva',
      palette: {
        0: '#ffffff',
        50: '#f3f3f3',
        100: '#e7e7e8',
        200: '#cfd0d0',
        300: '#b7b8b9',
        400: '#9fa1a1',
        500: '#87898a',
        600: '#6e7173',
        700: '#565a5b',
        800: '#3e4244',
        900: '#262b2c',
        950: '#0e1315',
      },
    },
    {
      name: 'ocean',
      palette: {
        0: '#ffffff',
        50: '#fbfcfc',
        100: '#F7F9F8',
        200: '#EFF3F2',
        300: '#DADEDD',
        400: '#B1B7B6',
        500: '#828787',
        600: '#5F7274',
        700: '#415B61',
        800: '#29444E',
        900: '#183240',
        950: '#0c1920',
      },
    },
  ];

  onThemeToggler() {
    this.themeState.update((state) => ({
      ...state,
      darkTheme: !state.darkTheme,
    }));
  }

  getPresetExt() {
    const color = this.primaryColors().find(
      (c) => c.name === this.selectedPrimaryColor()
    );

    if (color.name === 'noir') {
      return {
        semantic: {
          primary: {
            50: '{surface.50}',
            100: '{surface.100}',
            200: '{surface.200}',
            300: '{surface.300}',
            400: '{surface.400}',
            500: '{surface.500}',
            600: '{surface.600}',
            700: '{surface.700}',
            800: '{surface.800}',
            900: '{surface.900}',
            950: '{surface.950}',
          },
          colorScheme: {
            light: {
              primary: {
                color: '{primary.950}',
                contrastColor: '#ffffff',
                hoverColor: '{primary.800}',
                activeColor: '{primary.700}',
              },
              highlight: {
                background: '{primary.950}',
                focusBackground: '{primary.700}',
                color: '#ffffff',
                focusColor: '#ffffff',
              },
            },
            dark: {
              primary: {
                color: '{primary.50}',
                contrastColor: '{primary.950}',
                hoverColor: '{primary.200}',
                activeColor: '{primary.300}',
              },
              highlight: {
                background: '{primary.50}',
                focusBackground: '{primary.300}',
                color: '{primary.950}',
                focusColor: '{primary.950}',
              },
            },
          },
        },
      };
    } else {
      if (this.themeState().preset === 'Nora') {
        return {
          semantic: {
            primary: color.palette,
            colorScheme: {
              light: {
                primary: {
                  color: '{primary.600}',
                  contrastColor: '#ffffff',
                  hoverColor: '{primary.700}',
                  activeColor: '{primary.800}',
                },
                highlight: {
                  background: '{primary.600}',
                  focusBackground: '{primary.700}',
                  color: '#ffffff',
                  focusColor: '#ffffff',
                },
              },
              dark: {
                primary: {
                  color: '{primary.500}',
                  contrastColor: '{surface.900}',
                  hoverColor: '{primary.400}',
                  activeColor: '{primary.300}',
                },
                highlight: {
                  background: '{primary.500}',
                  focusBackground: '{primary.400}',
                  color: '{surface.900}',
                  focusColor: '{surface.900}',
                },
              },
            },
          },
        };
      } else if (this.themeState().preset === 'Material') {
        return {
          semantic: {
            primary: color.palette,
            colorScheme: {
              light: {
                primary: {
                  color: '{primary.500}',
                  contrastColor: '#ffffff',
                  hoverColor: '{primary.400}',
                  activeColor: '{primary.300}',
                },
                highlight: {
                  background:
                    'color-mix(in srgb, {primary.color}, transparent 88%)',
                  focusBackground:
                    'color-mix(in srgb, {primary.color}, transparent 76%)',
                  color: '{primary.700}',
                  focusColor: '{primary.800}',
                },
              },
              dark: {
                primary: {
                  color: '{primary.400}',
                  contrastColor: '{surface.900}',
                  hoverColor: '{primary.300}',
                  activeColor: '{primary.200}',
                },
                highlight: {
                  background:
                    'color-mix(in srgb, {primary.400}, transparent 84%)',
                  focusBackground:
                    'color-mix(in srgb, {primary.400}, transparent 76%)',
                  color: 'rgba(255,255,255,.87)',
                  focusColor: 'rgba(255,255,255,.87)',
                },
              },
            },
          },
        };
      } else {
        return {
          semantic: {
            primary: color.palette,
            colorScheme: {
              light: {
                primary: {
                  color: '{primary.500}',
                  contrastColor: '#ffffff',
                  hoverColor: '{primary.600}',
                  activeColor: '{primary.700}',
                },
                highlight: {
                  background: '{primary.50}',
                  focusBackground: '{primary.100}',
                  color: '{primary.700}',
                  focusColor: '{primary.800}',
                },
              },
              dark: {
                primary: {
                  color: '{primary.400}',
                  contrastColor: '{surface.900}',
                  hoverColor: '{primary.300}',
                  activeColor: '{primary.200}',
                },
                highlight: {
                  background:
                    'color-mix(in srgb, {primary.400}, transparent 84%)',
                  focusBackground:
                    'color-mix(in srgb, {primary.400}, transparent 76%)',
                  color: 'rgba(255,255,255,.87)',
                  focusColor: 'rgba(255,255,255,.87)',
                },
              },
            },
          },
        };
      }
    }
  }

  startViewTransition(state: ThemeState): void {
    const transition = (document as any).startViewTransition(() => {
      this.toggleDarkMode(state);
    });

    transition.ready.then(() => this.onTransitionEnd());
  }

  toggleDarkMode(state: ThemeState): void {
    if (state.darkTheme) {
      this.document.documentElement.classList.add('p-dark');
    } else {
      this.document.documentElement.classList.remove('p-dark');
    }
  }

  onTransitionEnd() {
    this.transitionComplete.set(true);
    setTimeout(() => {
      this.transitionComplete.set(false);
    });
  }

  handleDarkModeTransition(state: ThemeState): void {
    if (isPlatformBrowser(this.platformId)) {
      if ((document as any).startViewTransition) {
        this.startViewTransition(state);
      } else {
        this.toggleDarkMode(state);
        this.onTransitionEnd();
      }
    }
  }

  updateColors(event: any, type: string, color: any) {
    if (type === 'primary') {
      this.themeState.update((state) => ({ ...state, primary: color.name }));
    } else if (type === 'surface') {
      this.themeState.update((state) => ({ ...state, surface: color.name }));
    }
    this.applyTheme(type, color);

    event.stopPropagation();
  }

  applyTheme(type: string, color: any) {
    if (type === 'primary') {
      updatePreset(this.getPresetExt());
    } else if (type === 'surface') {
      updateSurfacePalette(color.palette);
    }
  }

  onPresetChange(event: any) {
    this.themeState.update((state) => ({ ...state, preset: event }));
    const preset = presets[event];
    const surfacePalette = this.surfaces.find(
      (s) => s.name === this.selectedSurfaceColor()
    )?.palette;
    if (this.themeState().preset === 'Material') {
      document.body.classList.add('material');
      this.config.ripple.set(true);
    } else {
      document.body.classList.remove('material');
      this.config.ripple.set(false);
    }
    $t()
      .preset(preset)
      .preset(this.getPresetExt())
      .surfacePalette(surfacePalette)
      .use({ useDefaultOptions: true });
  }

  loadthemeState(): any {
    if (isPlatformBrowser(this.platformId)) {
      const storedState = localStorage.getItem(this.STORAGE_KEY);
      if (storedState) {
        return JSON.parse(storedState);
      }
    }
    return {
      preset: 'Aura',
      primary: 'noir',
      surface: null,
      darkTheme: false,
    };
  }

  savethemeState(state: any): void {
    if (isPlatformBrowser(this.platformId)) {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(state));
    }
  }
}
