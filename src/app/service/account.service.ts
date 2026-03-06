import {inject, Injectable} from '@angular/core';
import {MessageService} from 'primeng/api';
import {HttpClient} from '@angular/common/http';
import {environment} from '../../environments/environment';
import {BehaviorSubject, catchError, Observable, of, Subject, tap} from 'rxjs';
import {WebSocketNotification} from './web-socket-service';

import { palette } from '@primeuix/themes';


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

/**
 * PrimeNG CSS variable names used as chart colors.
 * Each entry maps to a --p-{color}-{shade} custom property on :root.
 * get_css_var() resolves the current computed value at runtime,
 * so colors automatically follow the active PrimeNG theme, primary and surface.
 */
export const CHART_COLOR_VARS = [
  '--p-blue-500',
  '--p-green-500',
  '--p-orange-500',
  '--p-purple-500',
  '--p-teal-500',
  '--p-yellow-500',
  '--p-pink-500',
  '--p-cyan-500',
  '--p-red-500',
  '--p-indigo-500',
  '--p-sky-500',
  '--p-violet-500',
  '--p-emerald-500',
] as const;

/** Read a PrimeNG CSS variable from the document root and return its resolved value. */
export function get_css_var(varName: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
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

  private message = inject(MessageService);
  private http = inject(HttpClient);

  private _accounts = new BehaviorSubject<Account[]>([]);
  accounts$ = this._accounts.asObservable();

  private _monitor_status = new Subject<WebSocketNotification>();
  monitor_status$ = this._monitor_status.asObservable();

  // account_monitor → CSS variable name (e.g. '--p-blue-500')
  color_map: Map<string, string> = new Map();
  color_array = [...CHART_COLOR_VARS];

  /** Returns the live resolved color for a given external_id.
   *  Reads the CSS variable from the DOM, so it always reflects
   *  the current PrimeNG theme (preset, primary, surface, dark/light). */
  get_color(external_id: string): string {
    const cssVar = this.color_map.get(external_id);
    if (!cssVar) return get_css_var('--p-surface-400') || '#888888';
    return get_css_var(cssVar);
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
