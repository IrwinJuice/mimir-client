import {ApplicationConfig, provideBrowserGlobalErrorListeners} from '@angular/core';
import {provideRouter} from '@angular/router';

import {routes} from './app.routes';

import {providePrimeNG} from 'primeng/config';
import Aura from '@primeuix/themes/aura';
import {provideHttpClient, withFetch} from '@angular/common/http';
import {MessageService} from 'primeng/api';
import { AllCommunityModule, ModuleRegistry } from 'ag-charts-community';
import { AllEnterpriseModule } from 'ag-charts-enterprise';

// Enable all Community features
ModuleRegistry.registerModules([AllCommunityModule, AllEnterpriseModule]);

export const app_config: ApplicationConfig = {
  providers: [
    provideHttpClient(withFetch()),
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    providePrimeNG({
      theme: {
        preset: Aura, options: {darkModeSelector: '.p-dark'}
      }
    }),
    MessageService,
  ]
};
