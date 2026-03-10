import {inject, Injectable} from '@angular/core';
import {MessageService} from 'primeng/api';
import {HttpClient} from '@angular/common/http';
import {environment} from '../../environments/environment';
import {BehaviorSubject, catchError, Observable, of, Subject} from 'rxjs';
import {WebSocketNotification} from './web-socket-service';



export const FILTER_FIELDS: FilterField[] = [
  {label: 'Amount', value: 'amount', type: 'number'},
  {label: 'Currency', value: 'currency', type: 'string'},
  {label: 'Description', value: 'description', type: 'string'},
  {label: 'Receipt ID', value: 'receipt_id', type: 'string'},
  {label: 'MCC', value: 'mcc', type: 'number'},
  {label: 'Bank Acc. ID', value: 'external_id', type: 'string'},
]

export const STRING_OPERATORS: FilterOperator[] = [
  {label: 'Дорівнює', value: 'eq'},
  {label: 'Не дорівнює', value: 'neq'},
  {label: 'Починається з', value: 'startsWith'},
  {label: 'Закінчується на', value: 'endsWith'},
  {label: 'Містить', value: 'contains'},
];

export const NUMBER_OPERATORS: FilterOperator[] = [
  {label: '=', value: 'eq'},
  {label: '!=', value: 'neq'},
  {label: '<', value: 'lt'},
  {label: '>', value: 'gt'},
  {label: '≤', value: 'lte'},
  {label: '≥', value: 'gte'},
];


export const COMBINATORS = [
  {label: 'AND NOT', value: 'AND NOT'},
  {label: 'AND', value: 'AND'},
  {label: 'OR NOT', value: 'OR NOT'},
  {label: 'OR', value: 'OR'},
];

export type FilterFieldType = 'number' | 'string';

export interface FilterField {
  label: string;
  value: string;
  type: FilterFieldType;
}

export interface FilterOperator {
  label: string;
  value: string;
}


export interface CreateAccount {
  kind: string,
  token: string
  name: string
}

export interface Account {
  ida: number,
  kind: string,
  name: string
}

export enum AccountKind {
  MONO = 'Mono'
}

export enum AccountMonitorStatus {
  NEVER = 'Never',
  PENDING = 'Pending',
  UPDATED = 'Updated',
}

export interface AccountMonitor {
  ida: number,
  external_id: string,
  currency_code: number,
  balance: number,
  credit_limit: number,
  iban: string,
  masked_pan: string,
  kind: AccountKind,
  updated_at: string | null,
  last_taken_date: string | null,
  status: AccountMonitorStatus,
}

@Injectable({
  providedIn: 'root',
})

export class AccountService {

  private message = inject(MessageService);
  private http = inject(HttpClient);

  private _accounts = new BehaviorSubject<Account[]>([]);
  accounts$ = this._accounts.asObservable();

  private _monitor_status = new Subject<WebSocketNotification>();
  monitor_status$ = this._monitor_status.asObservable();



  set accounts(next: Account[]) {
    this._accounts.next(next);
  }

  get accounts(): Account[] {
    return this._accounts.value;
  }

  set monitor_status(notification: WebSocketNotification) {
    this._monitor_status.next(notification);
  }


  add_account(account: CreateAccount) {
    return this.http.post<Account>(`${environment.apiBase}/accounts`, account)
      .pipe(
        catchError(error => {
          this.message.add({severity: 'error', summary: 'Error', detail: `${error.message}`});
          throw Error(error);
        })
      );
  }

  get_accounts(): Observable<Account[]> {
    return this.http.get<Account[]>(`${environment.apiBase}/accounts`)
      .pipe(
        catchError(error => {
          this.message.add({severity: 'error', summary: 'Error', detail: `${error.message}`});
          return of([]);
        })
      );
  }

  // Update accounts statistics for the given user in the time range
  update_accounts_stat(from: string | number, to: string | number): Observable<AccountMonitor[]> {
    const from_param = encodeURIComponent(String(from));
    const to_param = encodeURIComponent(String(to));
    const url = `${environment.apiBase}/accounts/stat?from=${from_param}&to=${to_param}`;
    return this.http.put<AccountMonitor[]>(url, {}).pipe(
      catchError(error => {
        this.message.add({severity: 'error', summary: 'Error', detail: `${error.message}`});
        return of(null);
      })
    );
  }

  // Fetch accounts monitors
  get_accounts_monitors(): Observable<AccountMonitor[]> {
    const url = `${environment.apiBase}/monitors`;
    return this.http.get<AccountMonitor[]>(url).pipe(
      catchError(error => {
        this.message.add({severity: 'error', summary: 'Error', detail: `${error.message}`});
        return of(null);
      })
    );
  }

  // Fetch account monitor by external_id
  get_account_monitor(external_id: string): Observable<AccountMonitor> {
    const url = `${environment.apiBase}/monitors/${external_id}`;
    return this.http.get<AccountMonitor>(url).pipe(
      catchError(error => {
        this.message.add({severity: 'error', summary: 'Error', detail: `${error.message}`});
        return of(null);
      })
    );
  }

  update_account(ida: number, name: string, token: string): Observable<Account> {
    return this.http.put<Account>(`${environment.apiBase}/accounts/${ida}`, {name, token}).pipe(
      catchError(error => {
        this.message.add({severity: 'error', summary: 'Error', detail: `${error.message}`});
        throw Error(error);
      })
    );
  }

  delete_account(ida: number): Observable<void> {
    return this.http.delete<void>(`${environment.apiBase}/accounts/${ida}`).pipe(
      catchError(error => {
        this.message.add({severity: 'error', summary: 'Error', detail: `${error.message}`});
        throw Error(error);
      })
    );
  }

}
