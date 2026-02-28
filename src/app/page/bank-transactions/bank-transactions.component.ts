import {Component, DestroyRef, effect, inject, OnInit} from '@angular/core';
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
import {AgCharts} from 'ag-charts-angular';
import {DateTime} from 'luxon';
import {ThemeService} from '../../service/theme.service';

// Chart Options Type Interface

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

  theme_service = inject(ThemeService);
  themeState = this.theme_service.themeState;

  constructor() {
    this.setup_chart([]);

    effect(() => {
      const state = this.themeState();
      const options = {...this.options};
      if (state.darkTheme) {
        options.theme = "ag-default-dark";
      } else {
        options.theme = "ag-default";
      }
      this.options = options;
    });
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
        console.log(this.transactions);
        this.setup_chart(this.buildChartByDate());
      }),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe();

  }

  setup_chart(data: { time: Date, external_id: string, [key: string]: Date | string | number }[]) {
    const groups = Object.entries(Object.groupBy(data, ({external_id}) => external_id));
    console.log(groups)

    const series = groups.map(([external_id, items]) => ({
      type: "scatter",
      width: 10,
      xKey: "time",
      yKey: "amount_" + external_id,
      yName: external_id,
      // stacked: true,
      // normalizedTo: 100,
      tooltip: {
        renderer: ({datum}: { datum: any }) => ({
          title: external_id,
          content: `${datum.time.toLocaleString()} — ${(datum.amount / 100).toFixed(2)} UAH`,
        }),
      },
    }));


    let options = {
      theme: "ag-default",
      background: {
        visible: false
      },
      zoom: {enabled: true, minVisibleItems: 1},
      // navigator: {enabled: true, miniChart: {enabled: true}},
      tooltip: {enabled: true},
      axes: [
        {
          type: "time",
          position: "bottom",
          label: {format: "%d.%m %H:%M", autoRotate: true},
        },
        {
          type: "number",
          position: "left",
          label: {
            formatter: ({value}: { value: number }) => (value / 100).toFixed(2),
          },
        },
      ],
      data,
      series,
    };

    const state = this.themeState();
    if (state.darkTheme) {
      options.theme = "ag-default-dark";
    }
    this.options = options;
  }

  // Build chart data: x = transaction_time (Date), y = amount (kopecks as-is)
  private buildChartByDate(): { time: Date, external_id: string, [key: string]: Date | string | number }[] {
    if (!this.transactions || this.transactions.length === 0) {
      return [];
    }

    return [...this.transactions]
      .sort((a, b) => a.transaction_time.localeCompare(b.transaction_time))
      .map(t => {
        let amount_key = 'amount_' + t.external_id;
        return {
          time: DateTime.fromISO(t.transaction_time, {zone: 'utc'}).toJSDate(),
          external_id: t.external_id,
          [amount_key]: t.amount / 100
        };
      });
  }

  protected onSelect($event: any) {
    if (Array.isArray($event)) {
      this.mss_selected = $event;
    }
    this.setup_chart(this.buildChartByDate());
  }

  trackByMcc(index: number, item: Mcc) {
    return item.mcc;
  }

}
