import {ChangeDetectorRef, Component, DestroyRef, inject, Input, OnInit} from '@angular/core';
import {FormBuilder, FormsModule, ReactiveFormsModule, Validators} from '@angular/forms';
import {Button} from 'primeng/button';
import {Dialog} from 'primeng/dialog';
import {InputText} from 'primeng/inputtext';
import {Select} from 'primeng/select';
import {AsyncPipe} from '@angular/common';
import {
  Account as BankAccount,
  AccountKind,
  AccountMonitor,
  AccountMonitorStatus,
  AccountService,
  CreateAccount
} from '../../service/account.service';
import {finalize, map, mergeMap, NEVER, Observable, switchMap, take, tap} from 'rxjs';
import {MessageService, TreeNode} from 'primeng/api';
import {User} from '../../service/user.service';
import {TreeTableModule} from 'primeng/treetable';
import {DateTime} from 'luxon';
import * as cc from 'currency-codes';
import {ProgressBar} from 'primeng/progressbar';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {DateTimeService} from '../../service/date-time.service';

interface Column {
  field: string;
  header: string;
  width: string;
}

@Component({
  selector: 'app-account',
  imports: [
    ReactiveFormsModule,
    Button,
    Dialog,
    InputText,
    Select,
    AsyncPipe,
    FormsModule,
    TreeTableModule,
    ProgressBar
  ],
  templateUrl: './account.html',
  styleUrl: './account.scss',
})
export class Account implements OnInit {

  @Input({required: true})
  public user: User;

  loading = false;

  private formBuilder = inject(FormBuilder);
  protected account_service = inject(AccountService);
  private dt_service = inject(DateTimeService);
  private message = inject(MessageService);
  private destroyRef = inject(DestroyRef);
  private cdr = inject(ChangeDetectorRef);

  protected readonly account_kinds: AccountKind[] = [AccountKind.MONO];
  protected visible_account_dialog = false;
  protected accountForm = this.formBuilder.nonNullable.group({
    account_kind: [AccountKind.MONO, Validators.required],
    account_token: ['', Validators.required],
  });


  protected accounts$: Observable<BankAccount[]> = this.account_service.accounts$;
  protected monitors: AccountMonitor[] = [];

  accountsTree: TreeNode[] = [];
  selectionKeys: any = {};
  cols!: Column[];

  ngOnInit(): void {

    this.cols = [
      {field: 'kind', header: 'Аккаунт', width: '200px'},
      // {field: 'iban', header: 'IBAN'},
      {field: 'balance', header: 'Баланс', width: '100px'},
      {field: 'last_taken_date', header: 'З', width: '100px'},
      {field: 'updated_at', header: 'По', width: '100px'},
    ];


    this.account_service.get_accounts_by_idu(this.user.idu).pipe(
      take(1),
      switchMap((accounts) => {
        this.account_service.accounts = accounts;
        accounts.forEach((a) => {
          // include ida in the node data so later lookups (by data.ida) work
          this.accountsTree.push({
            key: `account-${a.ida}`,
            data: {kind: a.kind, ida: a.ida},
            children: []
          });
          this.selectionKeys[`account-${a.ida}`] = {
            checked: true
          }
        });
        return this.account_service.get_account_monitors(this.user.idu);
      }),
      tap((monitors) => {
        this.monitors = monitors || [];
        this.monitors.forEach((m) => {
          const parent = this.accountsTree.find(n => n.key === `account-${m.ida}`);
          if (parent) {
            parent.children!.push({
              key: `monitor-${m.ida}-${m.external_id}`,
              data: {
                // include ida and external_id for reliable future lookups
                ida: m.ida,
                external_id: m.external_id,
                kind: m.masked_pan,
                loading: m.status === AccountMonitorStatus.PENDING,
                balance: m.balance + ' ' + cc.number(`${m.currency_code}`).code,
                updated_at: m.updated_at ? DateTime.fromISO(m.updated_at, {zone: 'utc'}).setLocale("uk-UA").toLocaleString(DateTime.DATETIME_SHORT_WITH_SECONDS) : 'Дані не оновлювались',
                last_taken_date: m.last_taken_date ? DateTime.fromISO(m.last_taken_date, {zone: 'utc'}).setLocale("uk-UA").toLocaleString(DateTime.DATETIME_SHORT_WITH_SECONDS) : 'Дані не оновлювались',
              },
              leaf: true
            });
            parent.expanded = true;
          }
          this.selectionKeys[`monitor-${m.ida}-${m.external_id}`] = {
            checked: true
          }
        });

        this.accountsTree = [...this.accountsTree];
        this.cdr.detectChanges();
      })
    ).subscribe();

    this.account_service.monitor_status$
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        mergeMap((notification) => {
          let account = this.accountsTree.find((node) => node.data.ida === notification.ida);
          if (account) {
            let monitor = account.children.find((node) => node.data.external_id === notification.external_id);
            return this.account_service.get_account_monitor(this.user.idu, monitor.data.external_id).pipe(
              tap((m) => {
                console.log('m', m)
                monitor.data = {
                  // include ida and external_id for reliable future lookups
                  ida: m.ida,
                  external_id: m.external_id,
                  kind: m.masked_pan,
                  loading: m.status === AccountMonitorStatus.PENDING,
                  balance: m.balance + ' ' + cc.number(`${m.currency_code}`).code,
                  updated_at: m.updated_at ? DateTime.fromISO(m.updated_at, {zone: 'utc'}).setLocale("uk-UA").toLocaleString(DateTime.DATETIME_SHORT_WITH_SECONDS) : 'Дані не оновлювались',
                  last_taken_date: m.last_taken_date ? DateTime.fromISO(m.last_taken_date, {zone: 'utc'}).setLocale("uk-UA").toLocaleString(DateTime.DATETIME_SHORT_WITH_SECONDS) : 'Дані не оновлювались',
                };
                this.accountsTree = [...this.accountsTree];
                this.cdr.detectChanges();
              })
            );
          } else {
            return NEVER;
          }
        }),
      )
      .subscribe();

  }

  add_account() {
    if (this.accountForm.valid) {
      const account: CreateAccount = {
        kind: this.accountForm.controls.account_kind.value,
        token: this.accountForm.controls.account_token.value,
        idu: this.user.idu,
      };

      this.account_service.add_account(account).pipe(
        take(1),
        tap((account) => {
          this.account_service.accounts = [...this.account_service.accounts, account]
          // include ida in node data
          this.accountsTree.push({
            key: `account-${account.ida}`,
            data: {kind: account.kind, ida: account.ida},
            children: []
          });
          this.selectionKeys[`account-${account.ida}`] = {
            checked: true
          }
          this.message.add({severity: 'info', summary: 'Account', detail: 'Успішно додано.'});
          this.visible_account_dialog = false;
        })
      ).subscribe();
    }
  }

  // Use date-picker rangeDates to call stats endpoint
  fetch_stats() {
    this.loading = true;
    let time_range = this.dt_service.time_range;
    if (!time_range || time_range.length < 2) {
      this.message.add({severity: 'warn', summary: 'Dates', detail: 'Please select a date range.'});
      this.loading = false;
      return;
    }

    // rangeDates is [start, end] — convert to ISO strings (strip timezone if needed)
    const toDate: Date = time_range[1];
    const fromDate: Date = time_range[0];

    // Convert to Unix timestamps (seconds since epoch)
    const to = Math.floor(toDate.getTime() / 1000);
    const from = Math.floor(fromDate.getTime() / 1000);

    // from should be < to
    this.account_service.update_accounts_stat(this.user.idu, from, to).pipe(
      take(1),
      tap((result) => {
        if (result) {
          console.log('accounts stats:', result);
          this.monitors = result;

          // Build a new accountsTree immutably so change detection picks up child changes
          const newTree = this.accountsTree.map(acc => {
            // prefer acc.data.ida but fall back to parsing from key if needed
            const accId = acc?.data?.ida ?? (() => {
              const parts = (acc.key || '').split('-');
              return parts.length > 1 ? Number(parts[1]) : undefined;
            })();

            const children = (result as AccountMonitor[]).filter(m => m.ida === accId).map(m => ({
              key: `monitor-${m.ida}-${m.external_id}`,
              data: {
                ida: m.ida,
                external_id: m.external_id,
                kind: m.masked_pan,
                loading: m.status === AccountMonitorStatus.PENDING,
                balance: m.balance + ' ' + cc.number(`${m.currency_code}`).code,
                updated_at: m.updated_at ? DateTime.fromISO(m.updated_at, {zone: 'utc'}).setLocale("uk-UA").toLocaleString(DateTime.DATETIME_SHORT_WITH_SECONDS) : 'Дані не оновлювались',
                last_taken_date: m.last_taken_date ? DateTime.fromISO(m.last_taken_date, {zone: 'utc'}).setLocale("uk-UA").toLocaleString(DateTime.DATETIME_SHORT_WITH_SECONDS) : 'Дані не оновлювались',
              },
              leaf: true
            }));

            // update selection keys for the monitors of this account
            children.forEach(ch => this.selectionKeys[ch.key] = {checked: true});
            acc.expanded = true;
            return {...acc, children} as TreeNode;
          });

          this.accountsTree = newTree;

        } else {
          this.message.add({severity: 'warn', summary: 'Stats', detail: 'No data returned.'});
        }
      }),
      finalize(() => {
        this.loading = false;
        this.cdr.detectChanges();
      })
    ).subscribe();
  }

}
