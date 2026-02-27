import {Routes} from '@angular/router';
import {BankTransactionsComponent} from './page/bank-transactions/bank-transactions.component';

export const routes: Routes = [
  {path: '', redirectTo: 'transactions', pathMatch: 'full'},
  {path: 'transactions', component: BankTransactionsComponent}
];
