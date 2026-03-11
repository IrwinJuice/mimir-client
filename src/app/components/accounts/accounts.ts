import {ChangeDetectorRef, Component, DestroyRef, inject, OnInit} from '@angular/core';
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
import {finalize, mergeMap, NEVER, Observable, switchMap, take, tap} from 'rxjs';
import {MessageService, TreeNode} from 'primeng/api';
import {TreeTableModule} from 'primeng/treetable';
import {DateTime} from 'luxon';
import * as cc from 'currency-codes';
import {ProgressBar} from 'primeng/progressbar';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {DateTimeService} from '../../service/date-time.service';
import {ThemeService} from '../../service/theme.service';
import {TransactionService} from '../../service/transaction.service';
import {Popover} from 'primeng/popover';

interface Column {
  field: string;
  header: string;
  width: string;
}

@Component({
  selector: 'app-accounts',
  imports: [
    ReactiveFormsModule,
    Button,
    Dialog,
    InputText,
    Select,
    AsyncPipe,
    FormsModule,
    TreeTableModule,
    ProgressBar,
    Popover,
  ],
  templateUrl: './accounts.html',
  styleUrl: './accounts.scss',
})
export class Accounts implements OnInit {

  loading = false;

  private dr = inject(DestroyRef);

  private fb = inject(FormBuilder);
  protected account_service = inject(AccountService);
  protected theme_service = inject(ThemeService);
  private dt_service = inject(DateTimeService);
  private message = inject(MessageService);
  private cdr = inject(ChangeDetectorRef);
  private t_service = inject(TransactionService);

  protected readonly account_kinds: AccountKind[] = [AccountKind.MONO];
  protected visible_account_dialog = false;
  protected visible_edit_dialog = false;
  protected editing_ida: number | null = null;
  protected account_form = this.fb.nonNullable.group({
    account_kind: [AccountKind.MONO, Validators.required],
    account_token: ['', Validators.required],
    account_name: ['', Validators.required],
  });
  protected edit_form = this.fb.nonNullable.group({
    edit_name: [''],
    edit_token: [''],
  });


  protected accounts$: Observable<BankAccount[]> = this.account_service.accounts$;
  protected monitors: AccountMonitor[] = [];

  accounts_tree: TreeNode[] = [];
  selection_keys: Record<string, { checked: boolean }> = {};
  cols!: Column[];

  ngOnInit(): void {

    this.cols = [
      {field: 'name', header: 'Аккаунт', width: '300px'},
      {field: 'balance', header: 'Баланс', width: '150px'},
      {field: 'last_taken_date', header: 'З', width: '100px'},
      {field: 'updated_at', header: 'По', width: '100px'},
      {field: 'iban', header: 'IBAN', width: '250px'},
    ];

    this.fetch_accounts();

    this.subscribe_monitor_status();

  }

  private subscribe_monitor_status() {
    this.account_service.monitor_status$
      .pipe(
        takeUntilDestroyed(this.dr),
        mergeMap((notification) => {
          console.log('notification', notification)
          const account = this.accounts_tree.find((node) => node.data.ida === notification.ida);
          if (account) {
            const monitor = account.children.find((node) => node.data.external_id === notification.external_id);
            return this.account_service.get_account_monitor(monitor.data.external_id).pipe(
              tap((m) => {
                monitor.data = {
                  ida: m.ida,
                  iban: m.iban,
                  external_id: m.external_id,
                  color: this.theme_service.resolve_monitor_color(m.external_id),
                  name: m.masked_pan,
                  loading: m.status === AccountMonitorStatus.PENDING,
                  balance: m.balance + ' ' + cc.number(`${m.currency_code}`).code,
                  updated_at: m.updated_at ? DateTime.fromISO(m.updated_at, {zone: 'local'}).setLocale("uk-UA").toLocaleString(DateTime.DATETIME_SHORT_WITH_SECONDS) : 'Дані не оновлювались',
                  last_taken_date: m.last_taken_date ? DateTime.fromISO(m.last_taken_date, {zone: 'local'}).setLocale("uk-UA").toLocaleString(DateTime.DATETIME_SHORT_WITH_SECONDS) : 'Дані не оновлювались',
                };
                this.accounts_tree = [...this.accounts_tree];
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

  private fetch_accounts() {
    this.account_service.get_accounts().pipe(
      take(1),
      switchMap((accounts) => {
        this.account_service.accounts = accounts;
        accounts.forEach((a) => {
          // include ida in the node data so later lookups (by data.ida) work
          this.accounts_tree.push({
            key: `account-${a.ida}`,
            data: {account: true, name: `${a.name}`, ida: a.ida},
            children: []
          });
          this.selection_keys[`account-${a.ida}`] = {
            checked: true
          }
        });
        return this.account_service.get_accounts_monitors();
      }),
      tap((monitors) => {
        this.monitors = monitors || [];
        this.monitors.forEach((m) => {
          const parent = this.accounts_tree.find(n => n.key === `account-${m.ida}`);
          if (parent) {
            parent.children!.push({
              key: `monitor-${m.ida}-${m.external_id}`,
              data: {
                // include ida and external_id for reliable future lookups
                ida: m.ida,
                iban: m.iban,
                external_id: m.external_id,
                color: this.theme_service.resolve_monitor_color(m.external_id),
                name: m.masked_pan,
                loading: m.status === AccountMonitorStatus.PENDING,
                balance: m.balance + ' ' + cc.number(`${m.currency_code}`).code,
                updated_at: m.updated_at ? DateTime.fromISO(m.updated_at, {zone: 'local'}).setLocale("uk-UA").toLocaleString(DateTime.DATETIME_SHORT_WITH_SECONDS) : 'Дані не оновлювались',
                last_taken_date: m.last_taken_date ? DateTime.fromISO(m.last_taken_date, {zone: 'local'}).setLocale("uk-UA").toLocaleString(DateTime.DATETIME_SHORT_WITH_SECONDS) : 'Дані не оновлювались',
              },
              leaf: true
            });
            parent.expanded = true;
          }
          this.selection_keys[`monitor-${m.ida}-${m.external_id}`] = {
            checked: true
          }
        });

        this.accounts_tree = [...this.accounts_tree];
        this.cdr.detectChanges();
      })
    ).subscribe();
  }

  on_selection_change(keys: Record<string, { checked: boolean }>): void {
    this.selection_keys = keys;

    const ida_list: number[] = [];
    const external_id_list: string[] = [];

    for (const [key, val] of Object.entries(keys)) {
      if (!(val)?.checked) continue;

      if (key.startsWith('account-')) {
        // key = 'account-1' → ida = 1
        const ida = Number(key.slice('account-'.length));
        if (!isNaN(ida)) ida_list.push(ida);
      } else if (key.startsWith('monitor-')) {
        // key = 'monitor-1-Vb2IecNJleJpaf68itjujQ' → external_id = 'Vb2IecNJleJpaf68itjujQ'
        // format: monitor-{ida}-{external_id}  where external_id may contain '-'
        const without_prefix = key.slice('monitor-'.length);          // '1-Vb2IecNJleJpaf68itjujQ'
        const first_dash = without_prefix.indexOf('-');
        if (first_dash !== -1) {
          const external_id = without_prefix.slice(first_dash + 1);    // 'Vb2IecNJleJpaf68itjujQ'
          external_id_list.push(external_id);
        }
      }
    }

    const last = this.t_service.last_transactions_filter;
    if (!last) return;

    this.t_service.last_transactions_filter = {
      ...last,
      ida_list,
      external_id_list,
    };

    this.t_service.refill_data_event = Date.now();// next random namer
  }

  delete_account(ida: number): void {
    this.account_service.delete_account(ida).pipe(
      take(1),
      tap(() => {
        this.accounts_tree = this.accounts_tree.filter(n => n.data.ida !== ida);
        this.account_service.accounts = this.account_service.accounts.filter(a => a.ida !== ida);
        // clean up selection keys for this account and its monitors
        Object.keys(this.selection_keys)
          .filter(k => k === `account-${ida}` || k.startsWith(`monitor-${ida}-`))
          .forEach(k => delete this.selection_keys[k]);
        this.message.add({severity: 'info', summary: 'Account', detail: 'Акаунт видалено.'});
        this.on_selection_change({...this.selection_keys});
        this.cdr.detectChanges();
      })
    ).subscribe();
  }

  add_account() {
    if (this.account_form.valid) {
      const account: CreateAccount = {
        kind: this.account_form.controls.account_kind.value,
        token: this.account_form.controls.account_token.value,
        name: this.account_form.controls.account_name.value,
      };

      this.account_service.add_account(account).pipe(
        take(1),
        tap((account) => {
          this.account_service.accounts = [...this.account_service.accounts, account]
          // include ida in node data
          this.accounts_tree.push({
            key: `account-${account.ida}`,
            data: {kind: account.kind, ida: account.ida},
            children: []
          });
          this.selection_keys[`account-${account.ida}`] = {
            checked: true
          }
          this.message.add({severity: 'info', summary: 'Account', detail: 'Успішно додано.'});
          this.visible_account_dialog = false;
        })
      ).subscribe();
    }
  }

  fetch_stats() {
    this.loading = true;
    const time_range = this.dt_service.time_range;
    if (!time_range || time_range.length < 2) {
      this.message.add({severity: 'warn', summary: 'Dates', detail: 'Please select a date range.'});
      this.loading = false;
      return;
    }

    // Normalize selected date range to UTC using Luxon. DatePicker return dd.mm.yy 00:00:00, but for 'to' we need end of the day.
    // - `from`: the start of the selected day in the local timezone (00:00:00 local) converted to UTC
    // - `to`: the end of the selected day in the local timezone (23:59:59.999 local) converted to UTC
    const from_iso_date = DateTime.fromJSDate(time_range[0], {zone: 'local'}).toISODate();
    const from_dt = DateTime.fromISO(from_iso_date, {zone: 'utc'}).startOf('day');
    const to_iso_date = DateTime.fromJSDate(time_range[1], {zone: 'local'}).toISODate();
    const to_dt = DateTime.fromISO(to_iso_date, {zone: 'utc'}).endOf('day');

    const from = Math.floor(from_dt.toSeconds());
    const to = Math.floor(to_dt.toSeconds());

    // from should be < to
    this.account_service.update_accounts_stat(from, to).pipe(
      tap((result) => {
        if (result) {
          console.log('result', result)
          this.monitors = result;

          // Build a new accountsTree immutably so change detection picks up child changes
          const new_tree = this.accounts_tree.map(acc => {
            // prefer acc.data.ida but fall back to parsing from key if needed
            const acc_id = acc?.data?.ida ?? (() => {
              const parts = (acc.key || '').split('-');
              return parts.length > 1 ? Number(parts[1]) : undefined;
            })();

            const children = result
              .filter(m => m.ida === acc_id)
              .map(m => ({
                key: `monitor-${m.ida}-${m.external_id}`,
                data: {

                  // include ida and external_id for reliable future lookups
                  ida: m.ida,
                  iban: m.iban,
                  external_id: m.external_id,
                  color: this.theme_service.resolve_monitor_color(m.external_id),
                  name: m.masked_pan,
                  loading: m.status === AccountMonitorStatus.PENDING,
                  balance: m.balance + ' ' + cc.number(`${m.currency_code}`).code,
                  updated_at: m.updated_at ? DateTime.fromISO(m.updated_at, {zone: 'local'}).setLocale("uk-UA").toLocaleString(DateTime.DATETIME_SHORT_WITH_SECONDS) : 'Дані не оновлювались',
                  last_taken_date: m.last_taken_date ? DateTime.fromISO(m.last_taken_date, {zone: 'local'}).setLocale("uk-UA").toLocaleString(DateTime.DATETIME_SHORT_WITH_SECONDS) : 'Дані не оновлювались',
                },
                leaf: true
              }));

            // update selection keys for the monitors of this account
            children.forEach(ch => this.selection_keys[ch.key] = {checked: true});
            acc.expanded = true;
            return {...acc, children} as TreeNode;
          });

          this.accounts_tree = new_tree;

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

  edit_account(ida: number): void {
    const account = this.account_service.accounts.find(a => a.ida === ida);
    if (!account) return;
    this.editing_ida = ida;
    this.edit_form.setValue({edit_name: account.name, edit_token: ''});
    this.visible_edit_dialog = true;
  }

  save_edit_account(): void {
    if (!this.edit_form.valid || this.editing_ida == null) return;
    const {edit_name, edit_token} = this.edit_form.getRawValue();
    this.account_service.update_account(this.editing_ida, edit_name, edit_token).pipe(
      take(1),
      tap((updated) => {
        this.account_service.accounts = this.account_service.accounts.map(a =>
          a.ida === updated.ida ? updated : a
        );
        const node = this.accounts_tree.find(n => n.data.ida === updated.ida);
        if (node) node.data = {...node.data, name: updated.name};
        this.accounts_tree = [...this.accounts_tree];
        this.message.add({severity: 'success', summary: 'Account', detail: 'Аккаунт оновлено.'});
        this.visible_edit_dialog = false;
        this.editing_ida = null;
        this.cdr.detectChanges();
      })
    ).subscribe();
  }
}
