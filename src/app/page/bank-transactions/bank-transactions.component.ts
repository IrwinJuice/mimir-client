import {Component, DestroyRef, effect, inject, OnInit} from '@angular/core';
import {ChartModule} from 'primeng/chart';
import {FormArray, FormBuilder, FormGroup, FormsModule, ReactiveFormsModule} from '@angular/forms';
import {Mcc, MccService} from '../../service/mcc.service';
import {User, UserService} from '../../service/user.service';
import {of, skip, switchMap, tap} from 'rxjs';
import {
  BankTransaction,
  BankTransactionFilter,
  FilterCondition,
  FilterException,
  TransactionService
} from '../../service/transaction.service';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {DateTimeService} from '../../service/date-time.service';
import {MessageService} from 'primeng/api';
import {AgCharts} from 'ag-charts-angular';
import {DateTime} from 'luxon';
import {ThemeService} from '../../service/theme.service';
import {Tab, TabList, TabPanel, TabPanels, Tabs} from 'primeng/tabs';
import {TableModule} from 'primeng/table';
import {SelectButton} from 'primeng/selectbutton';
import {Button} from 'primeng/button';
import {Select} from 'primeng/select';
import {InputText} from 'primeng/inputtext';
import {Fieldset} from 'primeng/fieldset';
import {Tooltip} from 'primeng/tooltip';
import {AgBubbleSeriesStylerParams, AgBubbleSeriesStylerResult, AgTooltipRendererResult} from 'ag-charts-enterprise';

export type FilterFieldType = 'number' | 'string';

export interface FilterField {
  label: string;
  value: string;
  type: FilterFieldType;
}

export interface FilterOperator {
  label: string;
  value: string;
}

const STRING_OPERATORS: FilterOperator[] = [
  {label: 'Дорівнює', value: 'eq'},
  {label: 'Не дорівнює', value: 'neq'},
  {label: 'Починається з', value: 'startsWith'},
  {label: 'Закінчується на', value: 'endsWith'},
  {label: 'Містить', value: 'contains'},
];

const NUMBER_OPERATORS: FilterOperator[] = [
  {label: '=', value: 'eq'},
  {label: '!=', value: 'neq'},
  {label: '<', value: 'lt'},
  {label: '>', value: 'gt'},
  {label: '≤', value: 'lte'},
  {label: '≥', value: 'gte'},
];

const FILTER_FIELDS: FilterField[] = [
  {label: 'Amount', value: 'amount', type: 'number'},
  {label: 'Currency', value: 'currency', type: 'string'},
  {label: 'Description', value: 'description', type: 'string'},
  {label: 'Receipt ID', value: 'receipt_id', type: 'string'},
  {label: 'MCC', value: 'mcc', type: 'number'},
  {label: 'Bank Acc. ID', value: 'external_id', type: 'string'},
];

const COMBINATORS = [
  {label: 'AND NOT', value: 'AND NOT'},
  {label: 'AND', value: 'AND'},
  {label: 'OR NOT', value: 'OR NOT'},
  {label: 'OR', value: 'OR'},
];

const EXCEPTIONS_STORAGE_KEY = 'bank_transaction_exceptions';

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
    Button,
    Select,
    InputText,
    Fieldset,
    Tooltip,
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
  private fb = inject(FormBuilder);

  mcc_list: Mcc[] = [];
  transactions: BankTransaction[] = [];

  data: any = {labels: [], datasets: []};
  options: any;

  user: User;

  theme_service = inject(ThemeService);
  themeState = this.theme_service.themeState;
  chart_options = [];
  chart_idx = 1;

  filter_fields: FilterField[] = FILTER_FIELDS;
  combinators = COMBINATORS;

  // Two-level FormArray:
  // exceptions_form.exceptions = FormArray of groups
  // each group = FormGroup { conditions: FormArray of condition rows }
  exceptions_form: FormGroup = this.fb.group({
    exceptions: this.fb.array([])
  });

  get exceptions(): FormArray {
    return this.exceptions_form.get('exceptions') as FormArray;
  }

  get_conditions(groupIndex: number): FormArray {
    return this.exceptions.at(groupIndex).get('conditions') as FormArray;
  }

  get_operators_for(groupIndex: number, condIndex: number): FilterOperator[] {
    const field: FilterField | null = this.get_conditions(groupIndex).at(condIndex)?.get('field')?.value;
    if (!field) return [];
    return field.type === 'number' ? NUMBER_OPERATORS : STRING_OPERATORS;
  }

  on_field_change(groupIndex: number, condIndex: number) {
    this.get_conditions(groupIndex).at(condIndex).patchValue({operator: null, value: ''});
  }

  private new_condition_group(field: FilterField | null = null, operator: FilterOperator | null = null, value: string = '') {
    return this.fb.group({field: [field], operator: [operator], value: [value]});
  }

  add_filter_exception() {
    const group = this.fb.group({
      combinator: ['AND NOT'],
      conditions: this.fb.array([this.new_condition_group()])
    });
    this.exceptions.push(group);
  }

  private add_default_exception(conditions: { field: FilterField, operator: FilterOperator, value: string }[]) {
    const group = this.fb.group({
      combinator: ['AND NOT'],
      conditions: this.fb.array(conditions.map(c => this.new_condition_group(c.field, c.operator, c.value)))
    });
    this.exceptions.push(group);
  }

  remove_filter_exception(groupIndex: number) {

    this.exceptions.removeAt(groupIndex);
  }

  private save_exceptions_to_storage(): void {
    const data = this.build_exceptions();
    localStorage.setItem(EXCEPTIONS_STORAGE_KEY, JSON.stringify(data));
  }

  private restore_exceptions_from_storage(): boolean {
    try {
      const raw = localStorage.getItem(EXCEPTIONS_STORAGE_KEY);
      if (!raw) return false;
      const parsed: FilterException[] = JSON.parse(raw);
      if (!Array.isArray(parsed) || parsed.length === 0) return false;

      for (const ex of parsed) {
        const conditions = ex.conditions
          .map(c => {
            const field = FILTER_FIELDS.find(f => f.value === c.field) ?? null;
            const operatorList = field?.type === 'number' ? NUMBER_OPERATORS : STRING_OPERATORS;
            const operator = operatorList.find(o => o.value === c.operator) ?? null;
            return this.new_condition_group(field, operator, c.value);
          });
        const group = this.fb.group({
          combinator: [ex.combinator ?? 'AND NOT'],
          conditions: this.fb.array(conditions),
        });
        this.exceptions.push(group);
      }
      return true;
    } catch {
      return false;
    }
  }

  private seed_default_exceptions(): void {
    const mccField = FILTER_FIELDS.find(f => f.value === 'mcc')!;
    const descField = FILTER_FIELDS.find(f => f.value === 'description')!;
    const eqNum = NUMBER_OPERATORS.find(o => o.value === 'eq')!;
    const eqStr = STRING_OPERATORS.find(o => o.value === 'eq')!;

    this.add_default_exception([
      {field: mccField, operator: eqNum, value: '4829'},
      {field: descField, operator: eqStr, value: 'Переказ на картку'},
    ]);
    this.add_default_exception([
      {field: mccField, operator: eqNum, value: '4829'},
      {field: descField, operator: eqStr, value: 'З Білої картки'},
    ]);
  }

  add_condition(groupIndex: number) {
    this.get_conditions(groupIndex).push(this.new_condition_group());
  }

  remove_condition(groupIndex: number, condIndex: number) {
    const conditions = this.get_conditions(groupIndex);
    if (conditions.length === 1) {
      // removing last condition removes the whole group
      this.exceptions.removeAt(groupIndex);
    } else {
      conditions.removeAt(condIndex);
    }
  }

  constructor() {
    this.chart_options = [
      {name: 'Загальна', chart_idx: 1},
      {name: 'Option 2', chart_idx: 2},
      {name: 'Option 3', chart_idx: 3}
    ];

    const restored = this.restore_exceptions_from_storage();
    if (!restored) {
      this.seed_default_exceptions();
    }

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
          // mcc_list: [],
          idu: this.user.idu,
          from,
          to,
          exceptions: this.build_exceptions(),
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
          to,
          exceptions: this.build_exceptions(),
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

  to_uk_date(date: string) {
    return DateTime.fromISO(date, {zone: 'utc'}).setLocale("uk-UA").toLocaleString(DateTime.DATETIME_SHORT_WITH_SECONDS);
  }


  on_chart_select(idx: number) {
    switch (idx) {
      case 1:
        this.draw_main_chart()
        break;
      case 2:
        this.draw_income_outcome()
        break;
    }

  }

  draw_main_chart() {

    let data = [...this.transactions]
      .map(t => {
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

    const series = groups.map(([external_id, items]) => ({
      type: "bubble",
      sizeKey: "size_key",
      xKey: "time",
      yKey: "amount_" + external_id,
      yName: items?.[0]?.masked_pan ?? external_id,
      size: 10, //defaults to 7
      maxSize: 30, //defaults to 30
      styler: ({datum}: { datum: any }) => {

      },
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

    console.log(data)

    const options: any = {
      theme: this.themeState().darkTheme ? 'ag-default-dark' : 'ag-default',
      background: {visible: false},
      data,
      series: [
        {
          type: 'line',
          xKey: 'month',
          yKey: 'outcome',
          yName: 'Витрати (UAH)',
          tooltip: {
            renderer: ({datum}: { datum: any }) => ({
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
            renderer: ({datum}: { datum: any }) => ({
              title: datum.month,
              content: `Дохід: ${datum.outcome.toFixed(2)} UAH`,
            }),
          },
        },
      ],
      axes: [
        {type: 'category', position: 'bottom', label: {autoRotate: true}},
        {type: 'number', position: 'left'},
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

  private build_exceptions(): FilterException[] {
    return this.exceptions.controls
      .map(group => {
        const conditions = (group.get('conditions') as FormArray).controls;
        const built: FilterCondition[] = conditions
          .filter(c => c.get('field')?.value && c.get('operator')?.value && c.get('value')?.value !== '')
          .map(c => ({
            field: (c.get('field')!.value as FilterField).value,
            operator: (c.get('operator')!.value as FilterOperator).value,
            value: String(c.get('value')!.value),
          }));
        return {combinator: group.get('combinator')!.value as string, conditions: built} as FilterException;
      })
      .filter(ex => ex.conditions.length > 0);
  }

  apply_exceptions() {
    const last = this.t_service.last_transactions_filter;
    if (!last) return;
    this.save_exceptions_to_storage();
    const filter: BankTransactionFilter = {
      ...last,
      exceptions: this.build_exceptions(),
    };
    this.t_service.get_transactions(filter).pipe(
      tap((t_list) => {
        this.transactions = t_list || [];
        this.on_chart_select(this.chart_idx);
      }),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe();
  }
}
