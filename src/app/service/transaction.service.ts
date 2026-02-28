import {inject, Injectable} from '@angular/core';
import {MessageService} from 'primeng/api';
import {HttpClient, HttpParams} from '@angular/common/http';
import {catchError, Observable, of} from 'rxjs';
import {environment} from '../../environments/environment';

export interface BankTransaction {
  id: string,
  external_id: string,
  ida: number,
  amount: number,
  currency_code: number,
  description: string | null,
  mcc: number | null,
  hold: boolean,
  transaction_time: string,
  receipt_id: string | null,
  balance: number | null,
}

@Injectable({
  providedIn: 'root',
})
export class TransactionService {

  private message = inject(MessageService);
  private http = inject(HttpClient);

  // Fetch transactions monitor by external_id
  get_transactions(idu: number, ida_list: number[], external_id_list: string[], mcc_list: string[], from: string | number, to: string | number): Observable<BankTransaction[]> {

    let params = new HttpParams();
    params = params.append("from", from);
    params = params.append("to", to);

    if (ida_list.length > 0) {
      params = params.append("ida_list", ida_list.join(','));
    }
    if (external_id_list.length > 0) {
      params = params.append("external_id_list", external_id_list.join(','));
    }
    if (mcc_list.length > 0) {
      // Fixed: previously appended external_id_list by mistake
      params = params.append("mcc_list", mcc_list.join(','));
    }

    const url = `${environment.apiBase}/users/${idu}/transactions`;
    return this.http.get<BankTransaction[]>(url, {params}).pipe(
      catchError(error => {
        this.message.add({severity: 'error', summary: 'Error', detail: `${error.error}`});
        return of([] as BankTransaction[]);
      })
    );
  }
}
