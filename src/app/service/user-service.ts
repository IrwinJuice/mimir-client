import {inject, Injectable} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {environment} from '../../environments/environment';
import {catchError, Observable, of} from 'rxjs';
import {MessageService} from 'primeng/api';

export type User = {
  idu: number,
  name: string
}

@Injectable({
  providedIn: 'root',
})
export class UserService {
  private message = inject(MessageService);
  private http = inject(HttpClient);


  get_users(): Observable<User[]> {
    return this.http.get<User[]>(`${environment.apiBase}/users`)
      .pipe(
        catchError(error => {
          this.message.add({ severity: 'error', summary: 'Error', detail: `${error.message}` });
          return of([]);
        })
      );
  }

}
