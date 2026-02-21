import {Routes} from '@angular/router';
import {Bills} from './page/bills/bills';

export const routes: Routes = [
  {path: '', redirectTo: 'bills', pathMatch: 'full'},
  {path: 'bills', component: Bills}
];
