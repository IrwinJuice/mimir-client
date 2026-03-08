import { bootstrapApplication } from '@angular/platform-browser';
import { app_config } from './app/app.config';
import { App } from './app/app';

bootstrapApplication(App, app_config)
  .catch((err) => console.error(err));
