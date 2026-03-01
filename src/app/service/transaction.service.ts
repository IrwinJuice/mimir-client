import {inject, Injectable} from '@angular/core';
import {MessageService} from 'primeng/api';
import {HttpClient, HttpParams} from '@angular/common/http';
import {catchError, Observable, of, tap} from 'rxjs';
import {environment} from '../../environments/environment';

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

}

export interface BankTransactionFilter {
  idu: number,
  ida_list: number[],
  external_id_list: string[],
  mcc_list: string[],
  from: string | number,
  to: string | number
}

@Injectable({
  providedIn: 'root',
})
export class TransactionService {

  private message = inject(MessageService);
  private http = inject(HttpClient);

  current_transactions: BankTransaction[] = [];
  last_transactions_filter: BankTransactionFilter | null = null;


  // Fetch transactions monitor by external_id
  get_transactions(filter: BankTransactionFilter): Observable<BankTransaction[]> {
    this.last_transactions_filter = filter;

    let params = new HttpParams();
    params = params.append("from", filter.from);
    params = params.append("to", filter.to);

    if (filter.ida_list.length > 0) {
      params = params.append("ida_list", filter.ida_list.join(','));
    }
    if (filter.external_id_list.length > 0) {
      params = params.append("external_id_list", filter.external_id_list.join(','));
    }
    if (filter.mcc_list.length > 0) {
      // Fixed: previously appended external_id_list by mistake
      params = params.append("mcc_list", filter.mcc_list.join(','));
    }

    const url = `${environment.apiBase}/users/${filter.idu}/transactions`;
    return this.http.get<BankTransaction[]>(url, {params}).pipe(
      tap((ts) => this.current_transactions = ts),
      catchError(error => {
        this.message.add({severity: 'error', summary: 'Error', detail: `${error.error}`});
        return of([] as BankTransaction[]);
      })
    );
  }

  // Download transactions as CSV file
  download_csv(filter: BankTransactionFilter): void {
    let params = new HttpParams();
    params = params.append("from", filter.from);
    params = params.append("to", filter.to);

    if (filter.ida_list.length > 0) {
      params = params.append("ida_list", filter.ida_list.join(','));
    }
    if (filter.external_id_list.length > 0) {
      params = params.append("external_id_list", filter.external_id_list.join(','));
    }
    if (filter.mcc_list.length > 0) {
      params = params.append("mcc_list", filter.mcc_list.join(','));
    }

    const url = `${environment.apiBase}/users/${filter.idu}/transactions/csv`;
    this.http.get(url, {params, responseType: 'blob', observe: 'response'}).pipe(
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
    let params = new HttpParams();
    params = params.append("from", filter.from);
    params = params.append("to", filter.to);

    if (filter.ida_list.length > 0) {
      params = params.append("ida_list", filter.ida_list.join(','));
    }
    if (filter.external_id_list.length > 0) {
      params = params.append("external_id_list", filter.external_id_list.join(','));
    }
    if (filter.mcc_list.length > 0) {
      params = params.append("mcc_list", filter.mcc_list.join(','));
    }

    const url = `${environment.apiBase}/users/${filter.idu}/transactions/xlsx`;
    this.http.get(url, {params, responseType: 'blob', observe: 'response'}).pipe(
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
    let params = new HttpParams();
    params = params.append("from", filter.from);
    params = params.append("to", filter.to);

    if (filter.ida_list.length > 0) {
      params = params.append("ida_list", filter.ida_list.join(','));
    }
    if (filter.external_id_list.length > 0) {
      params = params.append("external_id_list", filter.external_id_list.join(','));
    }
    if (filter.mcc_list.length > 0) {
      params = params.append("mcc_list", filter.mcc_list.join(','));
    }

    const url = `${environment.apiBase}/users/${filter.idu}/transactions/json`;
    this.http.get(url, {params, responseType: 'blob', observe: 'response'}).pipe(
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
}
