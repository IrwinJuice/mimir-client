import {inject, Injectable} from '@angular/core';
import {MessageService} from 'primeng/api';
import {HttpClient} from '@angular/common/http';
import {environment} from '../../environments/environment';
import {BehaviorSubject, catchError, Observable, of} from 'rxjs';

export type CreateAccount = {
  idu: number,
  kind: string,
  token: string
}

export type Account = {
  ida: number,
  idu: number,
  kind: string,
  token: string
}

export enum AccountKind {
  MONO = 'Mono'
}

export type AccountMonitor = {
  ida: number,
  external_id: string,
  currency_code: number,
  balance: number,
  credit_limit: number,
  iban: string,
  masked_pan: string,
  kind: AccountKind,
  updated_at: number | null,
  last_taken_date: number | null,

}

@Injectable({
  providedIn: 'root',
})

export class AccountService {

  private message = inject(MessageService);
  private http = inject(HttpClient);

  private _accounts = new BehaviorSubject<Account[]>([]);
  accounts$ = this._accounts.asObservable();


  private _time_range = new BehaviorSubject<Date[]>([]);
  time_range$ = this._time_range.asObservable();

  set accounts(next: Account[]) {
    this._accounts.next(next);
  }

  get accounts(): Account[] {
    return this._accounts.value;
  }

  set time_range(next: Date[]) {
    this._time_range.next(next);
  }

  get time_range(): Date[] {
    return this._time_range.value;
  }

  add_account(account: CreateAccount) {
    return this.http.post<Account>(`${environment.apiBase}/users/${account.idu}/accounts`, account)
      .pipe(
        catchError(error => {
          this.message.add({severity: 'error', summary: 'Error', detail: `${error.message}`});
          throw Error(error);
        })
      );
  }

  get_accounts_by_idu(idu: number): Observable<Account[]> {
    return this.http.get<Account[]>(`${environment.apiBase}/users/${idu}/accounts`)
      .pipe(
        catchError(error => {
          this.message.add({severity: 'error', summary: 'Error', detail: `${error.message}`});
          return of([]);
        })
      );
  }

  // Fetch accounts statistics for the given user in the time range
  get_accounts_stats(idu: number, from: string | number, to: string | number): Observable<AccountMonitor> {
    const fromParam = encodeURIComponent(String(from));
    const toParam = encodeURIComponent(String(to));
    const url = `${environment.apiBase}/users/${idu}/accounts/stat?from=${fromParam}&to=${toParam}`;
    return this.http.put<AccountMonitor>(url, {}).pipe(
      catchError(error => {
        this.message.add({severity: 'error', summary: 'Error', detail: `${error.message}`});
        return of(null);
      })
    );
  }
}
