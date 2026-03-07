import {ChangeDetectorRef, Component, DestroyRef, effect, inject, OnInit} from '@angular/core';
import {ChartModule} from 'primeng/chart';
import {FormsModule, ReactiveFormsModule} from '@angular/forms';
import {Mcc, MccService} from '../../service/mcc.service';
import {User, UserService} from '../../service/user.service';
import {of, skip, switchMap, take, tap} from 'rxjs';
import {
  BankTransaction,
  BankTransactionFilter,
  FilterException,
  TransactionService
} from '../../service/transaction.service';
import {
  AccountService,
  EXCEPTIONS_STORAGE_KEY,
  FILTER_FIELDS,
  NUMBER_OPERATORS,
  STRING_OPERATORS,
} from '../../service/account.service';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {DateTimeService} from '../../service/date-time.service';
import {MessageService} from 'primeng/api';
import {AgCharts} from 'ag-charts-angular';
import {DateTime} from 'luxon';
import {CHART_COLOR_VARS, get_css_var, ThemeService} from '../../service/theme.service';
import {Tab, TabList, TabPanel, TabPanels, Tabs} from 'primeng/tabs';
import {TableModule} from 'primeng/table';
import {SelectButton} from 'primeng/selectbutton';
import {AgTooltipRendererResult} from 'ag-charts-enterprise';
import {Filter} from '../../components/filter/filter';

@Component({
  selector: 'app-bank-transaction',
  imports: [
    ChartModule,
    FormsModule,
    ReactiveFormsModule,
    AgCharts,
    Tabs,
    TabPanel,
    TabList,
    Tab,
    TabPanels,
    TableModule,
    SelectButton,
    Filter,
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
  private account_service = inject(AccountService);
  private destroyRef = inject(DestroyRef);
  private theme_service = inject(ThemeService);
  private cd = inject(ChangeDetectorRef);


  mcc_list: Mcc[] = [];
  transactions: BankTransaction[] = [];

  data: any = {labels: [], datasets: []};
  options: any = this.create_default_chart_options();

  user: User;

  theme_state = this.theme_service.theme_state;
  chart_options = [];
  chart_idx = 1;

  exceptions: FilterException[] = [];


  constructor() {
    this.chart_options = [
      {name: 'Загальна', chart_idx: 1},
      {name: 'Дохід та витрати', chart_idx: 2},
      {name: 'MCC Витрати', chart_idx: 3},
      {name: 'MCC Дохід', chart_idx: 4}
    ];

    this.exceptions = this.restore_exceptions_from_storage();
    if (this.exceptions.length < 1) {
      this.exceptions = this.seed_default_exceptions();
    }

    effect(() => {
      this.theme_state();
      this.on_chart_select(this.chart_idx, this.transactions);
    });
  }

  /**
   * Creates a minimal chart configuration used before transaction data is loaded.
   * This keeps the chart binding stable and aligns the theme with the current app theme.
   */
  private create_default_chart_options() {
    return {
      theme: this.theme_service.theme_state().darkTheme ? 'ag-default-dark' : 'ag-default',
      background: {visible: false},
      data: [],
      series: [],
    };
  }

  private restore_exceptions_from_storage(): FilterException[] {
    try {
      const raw = localStorage.getItem(EXCEPTIONS_STORAGE_KEY);
      if (!raw) return [];
      const parsed: FilterException[] = JSON.parse(raw);
      if (!Array.isArray(parsed) || parsed.length === 0) return [];
      return parsed;
    } catch {
      return [];
    }
  }

  private seed_default_exceptions(): FilterException[] {
    const mccField = FILTER_FIELDS.find(f => f.value === 'mcc')!;
    const descField = FILTER_FIELDS.find(f => f.value === 'description')!;
    const eqNum = NUMBER_OPERATORS.find(o => o.value === 'eq')!;
    const eqStr = STRING_OPERATORS.find(o => o.value === 'eq')!;
    const f: FilterException = {
      combinator: 'AND NOT',
      conditions: [
        {field: mccField.value, operator: eqNum.value, value: '4829'},
        {field: descField.value, operator: eqStr.value, value: 'Переказ на картку'},
      ]
    }

    const s: FilterException = {
      combinator: 'AND NOT',
      conditions: [
        {field: mccField.value, operator: eqNum.value, value: '4829'},
        {field: descField.value, operator: eqStr.value, value: 'З Білої картки'},
      ]
    }

    return [f, s];
  }

  ngOnInit() {

    this.user_service.selected_user$.pipe(
      skip(1),
      switchMap((user) => {
        if (!user) {
          return of([] as BankTransaction[]);
        }
        this.user = user;
        return this.mcc_service.fetch_mcc_by_idu(user.idu);
      }),
      switchMap((mcc_list_or_empty) => {
        if (!this.user) {
          return of([] as BankTransaction[]);
        }
        this.mcc_list = (mcc_list_or_empty as Mcc[]) || [];

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
          idu: this.user.idu,
          from,
          to,
          exceptions: this.exceptions,
        }
        return this.t_service.get_transactions(filter)
      }),
      tap((t_list) => {
        this.transactions = t_list || [];
        this.on_chart_select(this.chart_idx, t_list);
        this.cd.detectChanges();
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
          to,
          exceptions: this.exceptions,
        };
        this.t_service.last_transactions_filter = filter;
        return this.t_service.get_transactions(filter)
      }),
      tap((t_list) => {
        this.transactions = t_list || [];
        this.on_chart_select(this.chart_idx, t_list);
        this.cd.detectChanges();
      }),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe();


    this.t_service.refill_data_event$.pipe(
      skip(1), // skip event from account.ts on_selection_change()
      takeUntilDestroyed(this.destroyRef),
      switchMap((_) => {
        const filter = this.t_service.last_transactions_filter;
        return this.t_service.get_transactions(filter)
      }),
      tap((t_list) => {
        this.transactions = t_list || [];
        this.on_chart_select(this.chart_idx, t_list);
        this.cd.detectChanges();
      }),
    ).subscribe();

  }

  to_uk_date(date: string) {
    return DateTime.fromISO(date, {zone: 'utc'}).setLocale("uk-UA").toLocaleString(DateTime.DATETIME_SHORT_WITH_SECONDS);
  }


  on_chart_select(idx: number, t_list: BankTransaction[]) {
    switch (idx) {
      case 1:
        this.draw_main_chart(t_list)
        break;
      case 2:
        this.draw_income_outcome(t_list)
        break;
      case 3:
        this.draw_mcc_outcome(t_list)
        break;
      case 4:
        this.draw_mcc_income(t_list)
        break;
    }

  }

  draw_main_chart(t_list: BankTransaction[]) {
    let data = t_list.map(t => {
      let amount_key = 'amount_' + t.external_id;
      return {
        time: DateTime.fromISO(t.transaction_time, {zone: 'utc'}).toJSDate(),
        time_string: this.to_uk_date(t.transaction_time),
        external_id: t.external_id,
        size_key: Math.abs(t.amount),
        description: t.description,
        masked_pan: t.masked_pan,
        [amount_key]: t.amount / 100,
      };
    });

    const groups = Object.entries(Object.groupBy(data, ({external_id}) => external_id));

    const series = groups.map(([external_id, items]) => {

      const color = this.theme_service.resolve_monitor_color(external_id);
      return {
        type: "bubble",
        sizeKey: "size_key",
        xKey: "time",
        yKey: "amount_" + external_id,
        yName: items?.[0]?.masked_pan ?? external_id,
        size: 10,
        maxSize: 30,
        fill: color,
        stroke: color,
        tooltip: {
          renderer: ({datum}: { datum: any }) => {
            return {
              title: datum.masked_pan,
              heading: datum.description,
              data: [
                {label: "Amount", value: datum["amount_" + external_id]},
                {label: "Time", value: datum["time_string"]}
              ],
            } as AgTooltipRendererResult;
          },
        },
      };
    });

    let options = {
      theme: "ag-default",
      background: {
        visible: false
      },
      zoom: {enabled: true, minVisibleItems: 1},
      navigator: {enabled: true, miniChart: {enabled: true}},
      tooltip: {enabled: true},
      axes: {
        x: {
          type: "time",
          position: "bottom",
          label: {format: "%d.%m.%y", autoRotate: true},
        },
        y: {
          type: "number",
          position: "left",
          label: {
            formatter: ({value}: { value: number }) => value,
          },
        },
      },
      data,
      series,
    };


    const state = this.theme_state();
    if (state.darkTheme) {
      options.theme = "ag-default-dark";
    }
    this.options = options;
    this.cd.detectChanges();
  }


  draw_income_outcome(t_list: BankTransaction[]) {
    // Group transactions by "YYYY-MM" month key
    const groups = Object.groupBy(
      t_list,
      (t) => DateTime.fromISO(t.transaction_time, {zone: 'utc'}).toFormat('yyyy-MM')
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

    const isDark = this.theme_state().darkTheme;
    const outcomeColor = get_css_var('--p-red-500');
    const incomeColor = get_css_var('--p-green-500');
    const options = {
      theme: isDark ? 'ag-default-dark' : 'ag-default',
      background: {visible: false},
      data,

      series: [
        {
          type: 'bar',
          xKey: 'month',
          yKey: 'outcome',
          yName: 'Витрати (UAH)',
          fill: outcomeColor,
        },
        {
          type: 'bar',
          xKey: 'month',
          yKey: 'income',
          yName: 'Дохід (UAH)',
          fill: incomeColor,
        },
      ],
      axes: {
        x: {type: 'category', position: 'bottom', label: {autoRotate: true}},
        y: {type: 'number', position: 'left'},
      },
    };

    this.options = options;
    this.cd.detectChanges();
  }

  draw_mcc_outcome(t_list: BankTransaction[]) {
    // Group transactions by MCC
    const groups = Object.groupBy(
      t_list,
      (t) => t.mcc
    );


    // Sum positive amounts (income) per month
    const data = Object.entries(groups)
      .map(([mcc, items]) => {
        const outcome = (items ?? [])
          .filter(t => t.amount < 0)
          .reduce((sum, t) => sum + t.amount, 0);
        return {
          mcc_d: items[0].mcc_description,
          label: `${mcc}:${items[0].mcc_description}`,
          outcome: Math.abs(outcome) / 100,  // positive value, UAH
        };
      })
      .filter((o) => o.outcome !== 0)
      .sort((a, b) => a.mcc_d.localeCompare(b.mcc_d));

    const isDark = this.theme_state().darkTheme;
    const fills = this.theme_service.get_chart_fills();
    const options = {
      theme: isDark ? 'ag-default-dark' : 'ag-default',
      background: {visible: false},
      data,
      series: [{type: 'pie', angleKey: 'outcome', legendItemKey: 'label', fills}],
    };

    this.options = options;
    this.cd.detectChanges();
  }

  draw_mcc_income(t_list: BankTransaction[]) {
    // Group transactions by MCC
    const groups = Object.groupBy(
      t_list,
      (t) => t.mcc
    );


    // Sum positive amounts (income) per month
    const data = Object.entries(groups)
      .map(([mcc, items]) => {
        const income = (items ?? [])
          .filter(t => t.amount > 0)
          .reduce((sum, t) => sum + t.amount, 0);
        return {
          // mcc,
          mcc_d: items[0].mcc_description,
          label: `${mcc}:${items[0].mcc_description}`,
          income: Math.abs(income) / 100,  // positive value, UAH
        };
      })
      .filter((i) => i.income !== 0)
      .sort((a, b) => a.label.localeCompare(b.label));

    const isDark = this.theme_state().darkTheme;
    const fills = this.theme_service.get_chart_fills();
    const options = {
      theme: isDark ? 'ag-default-dark' : 'ag-default',
      background: {visible: false},
      data,
      series: [{type: 'pie', angleKey: 'income', legendItemKey: 'label', fills}],
    };

    this.options = options;
    this.cd.detectChanges();
  }


  apply_filter_changes() {
    const last = this.t_service.last_transactions_filter;
    if (!last) return;

    const filter: BankTransactionFilter = {
      ...last,
      exceptions: this.exceptions,
    };
    this.t_service.get_transactions(filter).pipe(
      take(1),
      tap((t_list) => {
        this.transactions = t_list || [];
        this.on_chart_select(this.chart_idx, t_list);
        this.cd.detectChanges();
      }),
    ).subscribe();
  }
}
