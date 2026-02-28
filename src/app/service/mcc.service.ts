import {inject, Injectable} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {catchError, Observable, of} from 'rxjs';
import {environment} from '../../environments/environment';
import {MessageService} from 'primeng/api';

export interface MccDescription {
  uk?: string;
  en?: string;
}

export interface MccGroup {
  type?: string;
  description?: MccDescription;
}

export interface MccEntry {
  mcc: string;
  group?: MccGroup;
  fullDescription?: MccDescription;
  shortDescription?: MccDescription;
}

export interface Mcc {
  mcc: string;
  group?: MccGroup;
  fullDescription?: MccDescription;
  shortDescription?: MccDescription;
}


// Merchant Category Codes
@Injectable({
  providedIn: 'root',
})
export class MccService {

  private message = inject(MessageService);
  private http = inject(HttpClient);

  fetch_mcc_by_idu(idu: number): Observable<Mcc[]> {
    const url = `${environment.apiBase}/users/${idu}/mcc`;
    return this.http.get<Mcc[]>(url).pipe(
      catchError(error => {
        this.message.add({severity: 'error', summary: 'Error', detail: `${error.message}`});
        return of(null);
      })
    );
  }
}
