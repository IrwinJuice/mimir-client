import {Component, DestroyRef, effect, inject, OnInit} from '@angular/core';
import {ChartModule} from 'primeng/chart';
import {Checkbox} from 'primeng/checkbox';
import {FormsModule} from '@angular/forms';
import {Mcc, MccService} from '../../service/mcc.service';
import {User, UserService} from '../../service/user.service';
import {of, skip, switchMap, tap} from 'rxjs';
import {BankTransaction, BankTransactionFilter, TransactionService} from '../../service/transaction.service';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {DateTimeService} from '../../service/date-time.service';
import {MessageService} from 'primeng/api';
import {AgCharts} from 'ag-charts-angular';
import {DateTime} from 'luxon';
import {ThemeService} from '../../service/theme.service';
import {Tab, TabList, TabPanel, TabPanels, Tabs} from 'primeng/tabs';
import {TableModule} from 'primeng/table';
import {SelectButton} from 'primeng/selectbutton';
import {Divider} from 'primeng/divider';
import {Button} from 'primeng/button';

// Chart Options Type Interface

@Component({
  selector: 'app-bank-transaction',
  imports: [
    ChartModule,
    Checkbox,
    FormsModule,
    AgCharts,
    Tabs,
    TabPanel,
    TabList,
    Tab,
    TabPanels,
    TableModule,
    SelectButton,
    Divider,
    Button,

  ],
  templateUrl: './bank-transactions.component.html',
  styleUrl: './bank-transactions.component.scss',
})
export class BankTransactionsComponent implements OnInit {
  private message = inject(MessageService);
  private mcc_service = inject(MccService);
  private dt_service = inject(DateTimeService);
  protected user_service = inject(UserService);
  protected t_service = inject(TransactionService);
  private destroyRef = inject(DestroyRef);

  mcc_list: Mcc[] = [];
  transactions: BankTransaction[] = [];
  mcc_selected: Mcc[] = [];

  data: any = {labels: [], datasets: []};
  options: any;

  user: User;

  theme_service = inject(ThemeService);
  themeState = this.theme_service.themeState;
  chart_options = [];
  chart_idx = 1;

  constructor() {
    this.chart_options = [
      { name: 'Загальна', chart_idx: 1 },
      { name: 'Option 2', chart_idx: 2 },
      { name: 'Option 3', chart_idx: 3 }
    ];

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

        const toDate: Date = time_range[1];
        const fromDate: Date = time_range[0];

        // Convert to Unix timestamps (seconds since epoch)
        const to = Math.floor(toDate.getTime() / 1000);
        const from = Math.floor(fromDate.getTime() / 1000);
        const filter: BankTransactionFilter = {
          external_id_list: [],
          ida_list: [],
          mcc_list: [],
          idu: this.user.idu,
          from,
          to
        }
        return this.t_service.get_transactions(filter)
      }),
      tap((t_list) => {
        this.transactions = t_list || [];
        this.on_chart_select(this.chart_idx);
      }),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe();

    this.dt_service.time_range$.pipe(
      skip(1),
      switchMap((time_range) => {
        if (!time_range || time_range.length < 2) {
          this.message.add({severity: 'warn', summary: 'Dates', detail: 'Please select a date range.'});
          return of([] as BankTransaction[]);
        }
        const toDate: Date = time_range[1];
        const fromDate: Date = time_range[0];
        // Convert to Unix timestamps (seconds since epoch)
        const to = Math.floor(toDate.getTime() / 1000);
        const from = Math.floor(fromDate.getTime() / 1000);

        let filter: BankTransactionFilter = {
          ...this.t_service.last_transactions_filter,
          from,
          to
        };
        this.t_service.last_transactions_filter = filter;
        return this.t_service.get_transactions(filter)
      }),
      tap((t_list) => {
        this.transactions = t_list || [];
        this.on_chart_select(this.chart_idx);
      }),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe();

  }

  protected on_mcc_select($event: any) {
    // if (Array.isArray($event)) {
    //   this.mcc_selected = $event;
    // }
  }

  trackByMcc(index: number, item: Mcc) {
    return item.mcc;
  }


  to_uk_date(date: string) {
    return DateTime.fromISO(date, {zone: 'utc'}).setLocale("uk-UA").toLocaleString(DateTime.DATETIME_SHORT_WITH_SECONDS);
  }


  on_chart_select(idx: number) {
    switch(idx) {
      case 1: this.draw_main_chart()
        break;
      case 2: this.draw_income_outcome()
        break;
    }

  }

  draw_main_chart() {

    let data = [...this.transactions]
      .map(t => {
        let amount_key = 'amount_' + t.external_id;
        return {
          time: DateTime.fromISO(t.transaction_time, {zone: 'utc'}).toJSDate(),
          external_id: t.external_id,
          size_key: Math.abs(t.amount),
          [amount_key]: t.amount / 100,
        };
      });

    const groups = Object.entries(Object.groupBy(data, ({external_id}) => external_id));

    const series = groups.map(([external_id, items]) => ({
      type: "bubble",
      sizeKey: "size_key",
      xKey: "time",
      yKey: "amount_" + external_id,
      yName: external_id,
      size: 10, //defaults to 7
      maxSize: 30, //defaults to 30
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
      navigator: {enabled: true, miniChart: {enabled: true}},
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


  draw_income_outcome() {
    // Group transactions by "YYYY-MM" month key
    const groups = Object.groupBy(
      this.transactions,
      (t) => DateTime.fromISO(t.transaction_time, { zone: 'utc' }).toFormat('yyyy-MM')
    );


    // Sum positive amounts (income) per month
    const data = Object.entries(groups)
      .map(([month, items]) => {
        const outcome = (items ?? [])
          .filter(t => t.amount < 0)
          .reduce((sum, t) => sum + t.amount, 0);
        const income = (items ?? [])
          .filter(t => t.amount > 0)
          .reduce((sum, t) => sum + t.amount, 0);
        return {
          month,
          income: Math.abs(income) / 100,  // positive value, UAH
          outcome: Math.abs(outcome) / 100,  // positive value, UAH
        };
      })
      .sort((a, b) => a.month.localeCompare(b.month));

    console.log(data)

    const options: any = {
      theme: this.themeState().darkTheme ? 'ag-default-dark' : 'ag-default',
      background: { visible: false },
      data,
      series: [
        {
          type: 'line',
          xKey: 'month',
          yKey: 'outcome',
          yName: 'Витрати (UAH)',
          tooltip: {
            renderer: ({ datum }: { datum: any }) => ({
              title: datum.month,
              content: `Витрати: ${datum.outcome.toFixed(2)} UAH`,
            }),
          },
        },
        {
          type: 'line',
          xKey: 'month',
          yKey: 'income',
          yName: 'Дохід (UAH)',
          tooltip: {
            renderer: ({ datum }: { datum: any }) => ({
              title: datum.month,
              content: `Дохід: ${datum.outcome.toFixed(2)} UAH`,
            }),
          },
        },
      ],
      axes: [
        { type: 'category', position: 'bottom', label: { autoRotate: true } },
        { type: 'number', position: 'left' },
      ],
    };

    this.options = options;
  }
  //
  //   let radar: {angle_key: string, radius_key: number, radius_name: string}[] = []
  //
  //   this.transactions.map((tr) => {
  //     if (tr.amount < 0) {
  //
  //     }
  //   })
  //
  //   // // let groups_by_masked_pan = Map.groupBy(this.transactions, ({masked_pan}) => masked_pan);
  //   //
  //   // let groups = Map.groupBy(this.transactions, ({mcc}) => mcc);
  //   // groups.forEach((value, key) => {
  //   //   radar.push({})
  //   // })
  //
  //
  //   { type: 'radar-area', angleKey: 'department', radiusKey: 'quality', radiusName: `Quality` },
  //

    // let data = [...this.transactions]
    //
    //   .map(t => {
    //     let amount_key = 'amount_' + t.external_id;
    //     return {
    //       angleKey:
    //       external_id: t.external_id,
    //       size_key: Math.abs(t.amount),
    //       [amount_key]: t.amount / 100,
    //     };
    //   });
    // const groups = Object.entries(Object.groupBy(data, ({external_id}) => external_id));
    //
    //
    // const series = groups.map(([external_id, items]) => ({
    //   type: "pie",
    //   angleKey: 'amount',
    //   legendItemKey: 'asset',
    //   sizeKey: "size_key",
    //   xKey: "time",
    //   yKey: "amount_" + external_id,
    //   yName: external_id,
    //   size: 10, //defaults to 7
    //   maxSize: 30, //defaults to 30
    //   tooltip: {
    //     renderer: ({datum}: { datum: any }) => ({
    //       title: external_id,
    //       content: `${datum.time.toLocaleString()} — ${(datum.amount / 100).toFixed(2)} UAH`,
    //     }),
    //   },
    // }));
    //
    //
    // let options = {
    //   theme: "ag-default",
    //   background: {
    //     visible: false
    //   },
    //   zoom: {enabled: true, minVisibleItems: 1},
    //   navigator: {enabled: true, miniChart: {enabled: true}},
    //   tooltip: {enabled: true},
    //   axes: [
    //     {
    //       type: "time",
    //       position: "bottom",
    //       label: {format: "%d.%m %H:%M", autoRotate: true},
    //     },
    //     {
    //       type: "number",
    //       position: "left",
    //       label: {
    //         formatter: ({value}: { value: number }) => (value / 100).toFixed(2),
    //       },
    //     },
    //   ],
    //   data,
    //   series,
    // };
    //
    //
    // const state = this.themeState();
    // if (state.darkTheme) {
    //   options.theme = "ag-default-dark";
    // }
    // this.options = options;

  // }

  protected add_filter_exception() {

  }
}
