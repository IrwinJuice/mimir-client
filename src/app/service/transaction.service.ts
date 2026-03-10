import {inject, Injectable} from '@angular/core';
import {MessageService} from 'primeng/api';
import {HttpClient} from '@angular/common/http';
import {catchError, Observable, of, Subject, tap} from 'rxjs';
import {environment} from '../../environments/environment';

export const EXCEPTIONS_STORAGE_KEY = 'bank_transaction_exceptions';

export interface BankTransaction {
  id: string,
  external_id: string,
  ida: number,
  amount: number,
  currency: string,
  currency_code: number,
  description: string | null,
  mcc: number | null,
  mcc_description?: string | null,
  masked_pan?: string | null,
  hold: boolean,
  transaction_time: string,
  receipt_id: string | null,
  balance: number | null,

  tags: TransactionTag[]
}

/// A single tag.
/// Severity values: primary | secondary | success | info | warn | danger | contrast
export interface TransactionTag {
  tag: string,
  severity: string,
}

export interface FilterCondition {
  field: string;      // 'amount' | 'currency' | 'description' | 'receipt_id' | 'mcc'
  operator: string;   // 'eq' | 'neq' | 'lt' | 'gt' | 'lte' | 'gte' | 'startsWith' | 'endsWith' | 'contains'
  value: string;
}

// One exception = combinator + (cond1 AND cond2 AND ...)
// combinator examples: 'AND NOT', 'AND', 'OR NOT', 'OR'
export interface FilterException {
  combinator: string;
  conditions: FilterCondition[];
}

export interface BankTransactionFilter {
  ida_list: number[],
  external_id_list: string[],
  exceptions?: FilterException[],
  from: string | number,
  to: string | number
}

interface BankTransactionTag {
  idt: string,
  tags: TransactionTag[]
}

@Injectable({
  providedIn: 'root',
})
export class TransactionService {

  private message = inject(MessageService);
  private http = inject(HttpClient);

  current_transactions: BankTransaction[] = [];
  last_transactions_filter: BankTransactionFilter | null = null;

  private _refill_data_event = new Subject<number>();
  refill_data_event$ = this._refill_data_event.asObservable();


  // just random number to trigger data update
  set refill_data_event(notification: number) {
    this._refill_data_event.next(notification);
  }


  // Fetch transactions monitor by external_id
  get_transactions(filter: BankTransactionFilter): Observable<BankTransaction[]> {
    this.last_transactions_filter = filter;
    const url = `${environment.apiBase}/transactions`;
    return this.http.post<BankTransaction[]>(url, filter).pipe(
      tap((ts) => this.current_transactions = ts),
      catchError(error => {
        this.message.add({severity: 'error', summary: 'Error', detail: `${error.error}`});
        return of([] as BankTransaction[]);
      })
    );
  }

  // Download transactions as CSV file
  download_csv(filter: BankTransactionFilter): void {

    const url = `${environment.apiBase}/transactions/csv`;
    this.http.post(url, filter, {responseType: 'blob', observe: 'response'}).pipe(
      catchError(error => {
        this.message.add({severity: 'error', summary: 'Error', detail: `${error.error}`});
        return of(null);
      })
    ).subscribe(response => {
      if (!response) return;

      // Try to extract filename from Content-Disposition header
      const disposition = response.headers.get('Content-Disposition');
      let filename = 'transactions.csv';
      if (disposition) {
        const match = disposition.match(/filename="?([^";\n]+)"?/);
        if (match?.[1]) filename = match[1].trim();
      }

      const blob = new Blob([response.body!], {type: 'text/csv;charset=utf-8;'});
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    });
  }

  // Download transactions as xlsx file
  download_xlsx(filter: BankTransactionFilter): void {

    const url = `${environment.apiBase}/transactions/xlsx`;
    this.http.post(url, filter, {responseType: 'blob', observe: 'response'}).pipe(
      catchError(error => {
        this.message.add({severity: 'error', summary: 'Error', detail: `${error.error}`});
        return of(null);
      })
    ).subscribe(response => {
      if (!response) return;

      // Try to extract filename from Content-Disposition header
      const disposition = response.headers.get('Content-Disposition');
      let filename = 'transactions.xlsx';
      if (disposition) {
        const match = disposition.match(/filename="?([^";\n]+)"?/);
        if (match?.[1]) filename = match[1].trim();
      }

      const blob = new Blob([response.body!], {type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    });
  }

  // Download transactions as json file
  download_json(filter: BankTransactionFilter): void {

    const url = `${environment.apiBase}/transactions/json`;
    this.http.post(url, filter, {responseType: 'blob', observe: 'response'}).pipe(
      catchError(error => {
        this.message.add({severity: 'error', summary: 'Error', detail: `${error.error}`});
        return of(null);
      })
    ).subscribe(response => {
      if (!response) return;

      // Try to extract filename from Content-Disposition header
      const disposition = response.headers.get('Content-Disposition');
      let filename = 'transactions.json';
      if (disposition) {
        const match = disposition.match(/filename="?([^";\n]+)"?/);
        if (match?.[1]) filename = match[1].trim();
      }

      const blob = new Blob([response.body!], {type: 'application/json; charset=utf-8'});
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    });
  }

  get_all_transactions_tags(): Observable<TransactionTag[]> {
    const url = `${environment.apiBase}/tags`;
    return this.http.get<TransactionTag[]>(url).pipe(
      catchError(error => {
        this.message.add({severity: 'error', summary: 'Error', detail: `${error.error}`});
        return of(null);
      })
    );
  }

  add_transactions_tags(tags: BankTransactionTag[]): Observable<BankTransactionTag[]> {
    const url = `${environment.apiBase}/tags/batch_insert`;
    return this.http.post<BankTransactionTag[]>(url, tags).pipe(
      catchError(error => {
        this.message.add({severity: 'error', summary: 'Error', detail: `${error.error}`});
        return of([]);
      }));
  }

  delete_transactions_tags(tags: BankTransactionTag[]): Observable<BankTransactionTag[]> {
    const url = `${environment.apiBase}/tags/batch_delete`;
    return this.http.post<BankTransactionTag[]>(url, tags).pipe(
      catchError(error => {
        this.message.add({severity: 'error', summary: 'Error', detail: `${error.error}`});
        return of([]);
      }));
  }
  /**
   * Saves the current exception list to local storage.
   */
  save_exceptions_to_storage(data: FilterException[]): void {
    localStorage.setItem(EXCEPTIONS_STORAGE_KEY, JSON.stringify(data));
  }

}
