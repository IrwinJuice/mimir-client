import {inject, Injectable} from '@angular/core';
import {MessageService} from 'primeng/api';
import {HttpClient} from '@angular/common/http';
import {environment} from '../../environments/environment';
import {BehaviorSubject, catchError, Observable, of, Subject, tap} from 'rxjs';
import {WebSocketNotification} from './web-socket-service';
import {ThemeService} from './theme.service';

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

export enum AccountMonitorStatus {
  NEVER = 'Never',
  PENDING = 'Pending',
  UPDATED = 'Updated',
}

export enum ChartColorsLatte {
  Lavender = '#7287fd',
  Peach = '#fe640b',
  Maroon = '#e64553',
  Mauve = '#8839ef',
  Teal = '#179299',
  Yellow = '#df8e1d',
  Pink = '#ea76cb',
  Green = '#40a02b',
  Red = '#d20f39',
  Flamingo = '#dd7878',
  Sky = '#04a5e5',
  Sapphire = '#209fb5',
  Blue = '#1e66f5',
}

export enum ChartColorsMocha {
  Lavender = '#7287fd',
  Flamingo = '#f2cdcd',
  Green = '#a6e3a1',
  Mauve = '#cba6f7',
  Pink = '#f5c2e7',
  Red = '#f38ba8',
  Maroon = '#eba0ac',
  Peach = '#fab387',
  Yellow = '#f9e2af',
  Teal = '#94e2d5',
  Sky = '#89dceb',
  Sapphire = '#74c7ec',
  Blue = '#89b4fa',
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
  updated_at: string | null,
  last_taken_date: string | null,
  status: AccountMonitorStatus,
}

@Injectable({
  providedIn: 'root',
})

export class AccountService {

  private theme_service = inject(ThemeService);
  private message = inject(MessageService);
  private http = inject(HttpClient);

  private _accounts = new BehaviorSubject<Account[]>([]);
  accounts$ = this._accounts.asObservable();

  private _monitor_status = new Subject<WebSocketNotification>();
  monitor_status$ = this._monitor_status.asObservable();

  // account_monitor - color
  color_map: Map<String, String> = new Map();
  color_array = ['Lavender', 'Peach', 'Maroon', 'Mauve', 'Teal', 'Yellow', 'Pink', 'Green', 'Red', 'Flamingo', 'Sky', 'Sapphire', 'Blue',];

  get_color(external_id: string): string {
    const colorName = this.color_map.get(external_id) as keyof typeof ChartColorsLatte;
    if (!colorName) return '#888888';
    const isDark = this.theme_service.theme_state().darkTheme;
    return isDark
      ? ChartColorsMocha[colorName as keyof typeof ChartColorsMocha]
      : ChartColorsLatte[colorName as keyof typeof ChartColorsLatte];
  }


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

  // Update accounts statistics for the given user in the time range
  update_accounts_stat(idu: number, from: string | number, to: string | number): Observable<AccountMonitor[]> {
    const fromParam = encodeURIComponent(String(from));
    const toParam = encodeURIComponent(String(to));
    const url = `${environment.apiBase}/users/${idu}/accounts/stat?from=${fromParam}&to=${toParam}`;
    return this.http.put<AccountMonitor[]>(url, {}).pipe(
      catchError(error => {
        this.message.add({severity: 'error', summary: 'Error', detail: `${error.message}`});
        return of(null);
      })
    );
  }

  // Fetch account monitors for the given user in the time range
  get_account_monitors(idu: number): Observable<AccountMonitor[]> {
    const url = `${environment.apiBase}/users/${idu}/monitors`;
    return this.http.get<AccountMonitor[]>(url).pipe(
      tap((monitors) => {
        let count = 0;
        for (let m of monitors) {
          if (!this.color_map.has(m.external_id)) {
            if (count >= this.color_array.length) {
              count = 0;
            }
            this.color_map.set(m.external_id, this.color_array[count]);
            count++;
          }
        }
      }),
      catchError(error => {
        this.message.add({severity: 'error', summary: 'Error', detail: `${error.message}`});
        return of(null);
      })
    );
  }

  // Fetch account monitor by external_id
  get_account_monitor(idu: number, external_id: string): Observable<AccountMonitor> {
    const url = `${environment.apiBase}/users/${idu}/monitors/${external_id}`;
    return this.http.get<AccountMonitor>(url).pipe(
      catchError(error => {
        this.message.add({severity: 'error', summary: 'Error', detail: `${error.message}`});
        return of(null);
      })
    );
  }

}
