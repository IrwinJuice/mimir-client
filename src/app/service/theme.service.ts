import {Injectable, signal} from '@angular/core';
import {ThemeState} from '../themeswitcher';

@Injectable({
  providedIn: 'root',
})
export class ThemeService {
  theme_state = signal<ThemeState>(null);
}
