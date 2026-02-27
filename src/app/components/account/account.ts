import {ChangeDetectorRef, Component, DestroyRef, inject, Input, OnInit, signal} from '@angular/core';
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
  AccountService,
  CreateAccount
} from '../../service/account.service';
import {finalize, Observable, switchMap, take, tap} from 'rxjs';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {MessageService, TreeNode} from 'primeng/api';
import {User} from '../../service/user.service';
import {TreeTableModule} from 'primeng/treetable';
import {DateTime} from 'luxon';
import * as cc from 'currency-codes';

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
    TreeTableModule
  ],
  templateUrl: './account.html',
  styleUrl: './account.scss',
})
export class Account implements OnInit {

  @Input({required: true})
  public user: User;

  loading = false;

  private formBuilder = inject(FormBuilder);
  private account_service = inject(AccountService);
  private message = inject(MessageService);
  private destroyRef = inject(DestroyRef);
  private cdr = inject(ChangeDetectorRef);

  protected readonly account_kinds: AccountKind[] = [AccountKind.MONO];
  protected visible_account_dialog = false;
  protected accountForm = this.formBuilder.nonNullable.group({
    account_kind: [AccountKind.MONO, Validators.required],
    account_token: ['', Validators.required],
  });

  protected accountsForm = this.formBuilder.nonNullable.group({
    ida_main: this.formBuilder.nonNullable.control(false)
  } as { [key: string]: any });

  protected accounts$: Observable<BankAccount[]> = this.account_service.accounts$;
  // .pipe(
  //   tap((accounts: AccountModel[]) => {
  //     console.log('accounts', accounts);
  //     accounts.forEach((account: AccountModel) => {
  //       const controlName = 'ida_' + account.ida;
  //       if (!this.accountsForm.contains(controlName)) {
  //         this.accountsForm.addControl(controlName, this.formBuilder.nonNullable.control(false));
  //       }
  //     });
  //   })
  // );

  protected mainIndeterminate = signal(false);

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
          this.accountsTree.push({
            key: `account-${a.ida}`,
            data: {kind: a.kind},
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
                kind: m.masked_pan,
                // iban: m.iban,
                balance: m.balance + ' ' + cc.number(`${m.currency_code}`).code,
                updated_at: DateTime.fromISO(m.updated_at, {zone: 'utc'}).setLocale("uk-UA").toLocaleString(DateTime.DATETIME_SHORT_WITH_SECONDS),
                last_taken_date: DateTime.fromISO(m.last_taken_date, {zone: 'utc'}).setLocale("uk-UA").toLocaleString(DateTime.DATETIME_SHORT_WITH_SECONDS),
              },
              leaf: true
            });
          }
          this.selectionKeys[`monitor-${m.ida}-${m.external_id}`] = {
            checked: true
          }
        });

        this.accountsTree = [...this.accountsTree];
        this.cdr.detectChanges();
      })
    ).subscribe();

    // When ida_main toggles — set all children (no event to avoid loop)
    this.accountsForm.get('ida_main')!.valueChanges.pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe((checked: boolean) => {
      this.mainIndeterminate.set(false);
      Object.keys(this.accountsForm.controls).forEach(key => {
        if (key !== 'ida_main') {
          this.accountsForm.get(key)!.setValue(checked, {emitEvent: false});
        }
      });
    });

    // When any child changes — update ida_main and indeterminate state
    this.accountsForm.valueChanges.pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe((values: { [key: string]: boolean }) => {
      const childKeys = Object.keys(values).filter(k => k !== 'ida_main');
      if (childKeys.length === 0) return;

      const checkedCount = childKeys.filter(k => values[k]).length;
      const allChecked = checkedCount === childKeys.length;
      const noneChecked = checkedCount === 0;

      this.mainIndeterminate.set(!allChecked && !noneChecked);
      this.accountsForm.get('ida_main')!.setValue(allChecked, {emitEvent: false});
    });
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
          this.message.add({severity: 'info', summary: 'Account', detail: 'Успішно додано.'});
          this.visible_account_dialog = false;
        })
      ).subscribe();
    }
  }

  // Use date-picker rangeDates to call stats endpoint
  fetchStats() {
    this.loading = true;
    let time_range = this.account_service.time_range;
    if (!time_range || time_range.length < 2) {
      this.message.add({severity: 'warn', summary: 'Dates', detail: 'Please select a date range.'});
      this.loading = false;
      return;
    }

    // rangeDates is [start, end] — convert to ISO strings (strip timezone if needed)
    const toDate: Date = time_range[0];
    const fromDate: Date = time_range[1];
    console.log(`to ${toDate}, from ${fromDate}`)

    // Convert to Unix timestamps (seconds since epoch)
    const to = Math.floor(toDate.getTime() / 1000);
    const from = Math.floor(fromDate.getTime() / 1000);

    // from should be < to
    this.account_service.update_accounts_stat(this.user.idu, from, to).pipe(
      take(1),
      tap((result) => {
        if (result) {
          this.message.add({severity: 'info', summary: 'Stats', detail: 'Stats fetched successfully.'});
          console.log('accounts stats:', result);
        } else {
          this.message.add({severity: 'warn', summary: 'Stats', detail: 'No data returned.'});
        }
      }),
      finalize(() => {
        this.loading = false;
      })
    ).subscribe();
  }

}
