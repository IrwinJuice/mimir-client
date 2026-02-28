import {Component, DestroyRef, inject, OnInit, PLATFORM_ID} from '@angular/core';
import {isPlatformBrowser} from '@angular/common';
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
import {DateTime} from 'luxon';
import {AgCharts} from 'ag-charts-angular';
import { getData } from "./data";
// Chart Options Type Interface
import { AgChartOptions } from 'ag-charts-community';

@Component({
  selector: 'app-bank-transaction',
  imports: [
    ChartModule,
    Checkbox,
    FormsModule,
    AgCharts,
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

  data: any = {labels: [], datasets: []};
  options: any;

  user: User;


  constructor() {
    this.initChart();
  }

  ngOnInit() {

    this.user_service.selected_user$.pipe(
      skip(1),
      switchMap((user) => {
        this.user = user;
        return this.mcc_service.fetch_mcc_by_idu(user.idu);
      }),
      switchMap((mcc_list) => {
        this.mcc_list = mcc_list || [];

        let time_range = this.dt_service.time_range;
        if (!time_range || time_range.length < 2) {
          this.message.add({severity: 'warn', summary: 'Dates', detail: 'Please select a date range.'});
          return of([] as BankTransaction[]);
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
        this.transactions = t_list || [];
        console.log(this.transactions)
        // Build chart from transactions
        this.buildChartByDate();
      }),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe();

  }

  initChart() {
    this.options = {
      zoom: {
        enabled: true,
      },
      tooltip: {
        enabled: false,
      },
      axes: {
        x: {
          type: "number",
          nice: false,
          interval: {
            minSpacing: 80,
            maxSpacing: 120,
          },
          label: {
            autoRotate: false,
          },
        },
      },
      data: getData(),
      series: [
        {
          type: "line",
          xKey: "year",
          yKey: "spending",
        },
      ],
    };
  }

  // Build chart aggregates by day (chart shows sum of amounts per day)

  private buildChartByDate() {
    if (!this.transactions || this.transactions.length === 0) {
      this.data = {labels: [], datasets: []};
      return;
    }

    const labels = this.transactions.map(t => {
      return DateTime.fromISO(t.transaction_time, {zone: 'utc'}).setLocale("uk-UA").toLocaleString(DateTime.DATETIME_SHORT_WITH_SECONDS)
    })

    const data = this.transactions.map(t => {
      return t.amount;
    });

    this.data = {
      labels,
      datasets: [
        {
          label: 'Amount',
          backgroundColor: '#06b6d4',
          borderColor: '#06b6d4',
          data
        }
      ]
    };
  }

  protected onSelect($event: any) {
    // $event is the ngModel (array) for mss_selected, just rebuild chart with new filter
    // make sure values are Mcc[]
    if (Array.isArray($event)) {
      this.mss_selected = $event;
    }
    this.buildChartByDate();
  }

  trackByMcc(index: number, item: Mcc) {
    return item.mcc;
  }

}
