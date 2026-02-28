import {Injectable, signal} from '@angular/core';
import {ThemeState} from '../themeswitcher';

@Injectable({
  providedIn: 'root',
})
export class ThemeService {
  themeState = signal<ThemeState>(null);
}
