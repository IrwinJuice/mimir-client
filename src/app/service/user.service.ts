import {inject, Injectable} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {environment} from '../../environments/environment';
import {BehaviorSubject, catchError, Observable, of} from 'rxjs';
import {MessageService} from 'primeng/api';

export type CreateUser = {
  name: string
}

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

  private _selected_user = new BehaviorSubject<User | null>(null);
  selected_user$ = this._selected_user.asObservable();

  set selected_user(next: User | null) {
    this._selected_user.next(next);
  }

  get selected_user(): User {
    return this._selected_user.value;
  }

  get_users(): Observable<User[]> {
    return this.http.get<User[]>(`${environment.apiBase}/users`)
      .pipe(
        catchError(error => {
          this.message.add({severity: 'error', summary: 'Error', detail: `${error.message}`});
          return of([]);
        })
      );
  }

  create_user(user: CreateUser) {
    return this.http.post<User>(`${environment.apiBase}/users`, user)
      .pipe(
        catchError(error => {
          this.message.add({severity: 'error', summary: 'Error', detail: `${error.message}`});
          throw Error(error);
        })
      );
  }

  delete_user(idu: number): Observable<void> {
    return this.http.delete<void>(`${environment.apiBase}/users/${idu}`).pipe(
      catchError(error => {
        this.message.add({severity: 'error', summary: 'Error', detail: `${error.message}`});
        throw Error(error);
      })
    );
  }
}
