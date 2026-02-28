import {Component, DestroyRef, inject, OnInit, PLATFORM_ID} from '@angular/core';
import {AsyncPipe, isPlatformBrowser} from '@angular/common';
import {ChartModule} from 'primeng/chart';
import {Checkbox} from 'primeng/checkbox';
import {FormsModule} from '@angular/forms';
import {Mcc, MccService} from '../../service/mcc.service';
import {User, UserService} from '../../service/user.service';
import {of, skip, switchMap, tap} from 'rxjs';
import {BankTransaction, TransactionService} from '../../service/transaction.service';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {DateTimeService} from '../../service/date-time.service';
import {MessageService} from 'primeng/api';

@Component({
  selector: 'app-bank-transaction',
  imports: [
    ChartModule,
    Checkbox,
    FormsModule,
    AsyncPipe
  ],
  templateUrl: './bank-transactions.component.html',
  styleUrl: './bank-transactions.component.scss',
})
export class BankTransactionsComponent implements OnInit {
  private message = inject(MessageService);
  private mcc_service = inject(MccService);
  private dt_service = inject(DateTimeService);
  protected user_service = inject(UserService);
  protected transaction_service = inject(TransactionService);
  private destroyRef = inject(DestroyRef);

  mcc_list: Mcc[] = [];
  transactions: BankTransaction[] = [];
  mss_selected: Mcc[] = [];

  data: any;
  options: any;
  platformId = inject(PLATFORM_ID);

  user: User;

  ngOnInit() {
    this.initChart();

    this.user_service.selected_user$.pipe(
      skip(1),
      switchMap((user) => {
        this.user = user;
        return this.mcc_service.fetch_mcc_by_idu(user.idu);
      }),
      switchMap((mcc_list) => {
        this.mcc_list = mcc_list;

        let time_range = this.dt_service.time_range;
        if (!time_range || time_range.length < 2) {
          this.message.add({severity: 'warn', summary: 'Dates', detail: 'Please select a date range.'});
          return of([]);
        }

        // rangeDates is [start, end] — convert to ISO strings
        const toDate: Date = time_range[0];
        const fromDate: Date = time_range[1];

        // Convert to Unix timestamps (seconds since epoch)
        const to = Math.floor(toDate.getTime() / 1000);
        const from = Math.floor(fromDate.getTime() / 1000);
        return this.transaction_service.get_transactions(this.user.idu, [], [], [], from, to)
      }),
      tap((t_list) => {
        this.transactions = t_list;
        console.log('transactions', t_list)
      }),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe();

  }

  initChart() {
    if (isPlatformBrowser(this.platformId)) {
      const documentStyle = getComputedStyle(document.documentElement);
      const textColor = documentStyle.getPropertyValue('--p-text-color');
      const textColorSecondary = documentStyle.getPropertyValue('--p-text-muted-color');
      const surfaceBorder = documentStyle.getPropertyValue('--p-content-border-color');

      this.data = {
        labels: ['January', 'February', 'March', 'April', 'May', 'June', 'July'],
        datasets: [
          {
            label: 'My First dataset',
            backgroundColor: documentStyle.getPropertyValue('--p-cyan-500'),
            borderColor: documentStyle.getPropertyValue('--p-cyan-500'),
            data: [65, 59, 80, 81, 56, 55, 40]
          },
          {
            label: 'My Second dataset',
            backgroundColor: documentStyle.getPropertyValue('--p-gray-500'),
            borderColor: documentStyle.getPropertyValue('--p-gray-500'),
            data: [28, 48, 40, 19, 86, 27, 90]
          }
        ]
      };

      this.options = {
        maintainAspectRatio: false,
        aspectRatio: 0.8,
        plugins: {
          legend: {
            labels: {
              color: textColor
            }
          }
        },
        scales: {
          x: {
            ticks: {
              color: textColorSecondary,
              font: {
                weight: 500
              }
            },
            grid: {
              color: surfaceBorder,
              drawBorder: false
            }
          },
          y: {
            ticks: {
              color: textColorSecondary
            },
            grid: {
              color: surfaceBorder,
              drawBorder: false
            }
          }
        }
      };
      // this.cd.markForCheck();
    }
  }

  protected onSelect($event: any) {
    console.log("event", $event)
  }
}
