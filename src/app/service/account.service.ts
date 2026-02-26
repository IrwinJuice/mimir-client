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
  updated_at: string | null,
  last_taken_date: string | null,
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

  // Update accounts statistics for the given user in the time range
  update_accounts_stat(idu: number, from: string | number, to: string | number): Observable<AccountMonitor> {
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
  // Fetch account monitors for the given user in the time range
  get_account_monitors(idu: number): Observable<AccountMonitor[]> {
    const url = `${environment.apiBase}/users/${idu}/monitors`;
    return this.http.get<AccountMonitor[]>(url).pipe(
      catchError(error => {
        this.message.add({severity: 'error', summary: 'Error', detail: `${error.message}`});
        return of(null);
      })
    );
  }




  getTreeTableNodesData() {
    return [
      {
        key: '0',
        data: {
          name: 'Applications',
          size: '100kb',
          type: 'Folder'
        },
        children: [
          {
            key: '0-0',
            data: {
              name: 'React',
              size: '25kb',
              type: 'Folder'
            },
            children: [
              {
                key: '0-0-0',
                data: {
                  name: 'react.app',
                  size: '10kb',
                  type: 'Application'
                }
              },
              {
                key: '0-0-1',
                data: {
                  name: 'native.app',
                  size: '10kb',
                  type: 'Application'
                }
              },
              {
                key: '0-0-2',
                data: {
                  name: 'mobile.app',
                  size: '5kb',
                  type: 'Application'
                }
              }
            ]
          },
          {
            key: '0-1',
            data: {
              name: 'editor.app',
              size: '25kb',
              type: 'Application'
            }
          },
          {
            key: '0-2',
            data: {
              name: 'settings.app',
              size: '50kb',
              type: 'Application'
            }
          }
        ]
      },
      {
        key: '1',
        data: {
          name: 'Cloud',
          size: '20kb',
          type: 'Folder'
        },
        children: [
          {
            key: '1-0',
            data: {
              name: 'backup-1.zip',
              size: '10kb',
              type: 'Zip'
            }
          },
          {
            key: '1-1',
            data: {
              name: 'backup-2.zip',
              size: '10kb',
              type: 'Zip'
            }
          }
        ]
      },
      {
        key: '2',
        data: {
          name: 'Desktop',
          size: '150kb',
          type: 'Folder'
        },
        children: [
          {
            key: '2-0',
            data: {
              name: 'note-meeting.txt',
              size: '50kb',
              type: 'Text'
            }
          },
          {
            key: '2-1',
            data: {
              name: 'note-todo.txt',
              size: '100kb',
              type: 'Text'
            }
          }
        ]
      },
      {
        key: '3',
        data: {
          name: 'Documents',
          size: '75kb',
          type: 'Folder'
        },
        children: [
          {
            key: '3-0',
            data: {
              name: 'Work',
              size: '55kb',
              type: 'Folder'
            },
            children: [
              {
                key: '3-0-0',
                data: {
                  name: 'Expenses.doc',
                  size: '30kb',
                  type: 'Document'
                }
              },
              {
                key: '3-0-1',
                data: {
                  name: 'Resume.doc',
                  size: '25kb',
                  type: 'Resume'
                }
              }
            ]
          },
          {
            key: '3-1',
            data: {
              name: 'Home',
              size: '20kb',
              type: 'Folder'
            },
            children: [
              {
                key: '3-1-0',
                data: {
                  name: 'Invoices',
                  size: '20kb',
                  type: 'Text'
                }
              }
            ]
          }
        ]
      },
      {
        key: '4',
        data: {
          name: 'Downloads',
          size: '25kb',
          type: 'Folder'
        },
        children: [
          {
            key: '4-0',
            data: {
              name: 'Spanish',
              size: '10kb',
              type: 'Folder'
            },
            children: [
              {
                key: '4-0-0',
                data: {
                  name: 'tutorial-a1.txt',
                  size: '5kb',
                  type: 'Text'
                }
              },
              {
                key: '4-0-1',
                data: {
                  name: 'tutorial-a2.txt',
                  size: '5kb',
                  type: 'Text'
                }
              }
            ]
          },
          {
            key: '4-1',
            data: {
              name: 'Travel',
              size: '15kb',
              type: 'Text'
            },
            children: [
              {
                key: '4-1-0',
                data: {
                  name: 'Hotel.pdf',
                  size: '10kb',
                  type: 'PDF'
                }
              },
              {
                key: '4-1-1',
                data: {
                  name: 'Flight.pdf',
                  size: '5kb',
                  type: 'PDF'
                }
              }
            ]
          }
        ]
      },
      {
        key: '5',
        data: {
          name: 'Main',
          size: '50kb',
          type: 'Folder'
        },
        children: [
          {
            key: '5-0',
            data: {
              name: 'bin',
              size: '50kb',
              type: 'Link'
            }
          },
          {
            key: '5-1',
            data: {
              name: 'etc',
              size: '100kb',
              type: 'Link'
            }
          },
          {
            key: '5-2',
            data: {
              name: 'var',
              size: '100kb',
              type: 'Link'
            }
          }
        ]
      },
      {
        key: '6',
        data: {
          name: 'Other',
          size: '5kb',
          type: 'Folder'
        },
        children: [
          {
            key: '6-0',
            data: {
              name: 'todo.txt',
              size: '3kb',
              type: 'Text'
            }
          },
          {
            key: '6-1',
            data: {
              name: 'logo.png',
              size: '2kb',
              type: 'Picture'
            }
          }
        ]
      },
      {
        key: '7',
        data: {
          name: 'Pictures',
          size: '150kb',
          type: 'Folder'
        },
        children: [
          {
            key: '7-0',
            data: {
              name: 'barcelona.jpg',
              size: '90kb',
              type: 'Picture'
            }
          },
          {
            key: '7-1',
            data: {
              name: 'primeng.png',
              size: '30kb',
              type: 'Picture'
            }
          },
          {
            key: '7-2',
            data: {
              name: 'prime.jpg',
              size: '30kb',
              type: 'Picture'
            }
          }
        ]
      },
      {
        key: '8',
        data: {
          name: 'Videos',
          size: '1500kb',
          type: 'Folder'
        },
        children: [
          {
            key: '8-0',
            data: {
              name: 'primefaces.mkv',
              size: '1000kb',
              type: 'Video'
            }
          },
          {
            key: '8-1',
            data: {
              name: 'intro.avi',
              size: '500kb',
              type: 'Video'
            }
          }
        ]
      }
    ];
  }


  getTreeTableNodes() {
    return Promise.resolve(this.getTreeTableNodesData());
  }

}
