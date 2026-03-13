import {ChangeDetectorRef, Component, DestroyRef, effect, inject, OnInit} from '@angular/core';
import {ChartModule} from 'primeng/chart';
import {FormArray, FormBuilder, FormsModule, ReactiveFormsModule, Validators} from '@angular/forms';
import {Mcc, MccService} from '../../service/mcc.service';
import {debounceTime, of, skip, Subject, switchMap, take, tap} from 'rxjs';
import {
  BankTransaction,
  BankTransactionFilter,
  EXCEPTIONS_STORAGE_KEY,
  FilterException,
  SEVERITY_OPTIONS,
  TransactionService,
  TransactionTag
} from '../../service/transaction.service';
import {FILTER_FIELDS, NUMBER_OPERATORS, STRING_OPERATORS,} from '../../service/account.service';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {DateTimeService} from '../../service/date-time.service';
import {MessageService} from 'primeng/api';
import {AgCharts} from 'ag-charts-angular';
import {DateTime} from 'luxon';
import {get_css_var, ThemeService} from '../../service/theme.service';
import {Tab, TabList, TabPanel, TabPanels, Tabs} from 'primeng/tabs';
import {TableModule} from 'primeng/table';
import {SelectButton} from 'primeng/selectbutton';
import {AgTooltipRendererResult} from 'ag-charts-enterprise';
import {Filter} from '../../components/filter/filter';
import {Tag} from 'primeng/tag';
import {ToggleButton} from 'primeng/togglebutton';
import {Button} from 'primeng/button';
import {Tooltip} from 'primeng/tooltip';
import {Dialog} from 'primeng/dialog';
import {Select} from 'primeng/select';
import {AutoComplete, AutoCompleteCompleteEvent} from 'primeng/autocomplete';

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
    Tag,
    ToggleButton,
    Button,
    Tooltip,
    Dialog,
    Select,
    AutoComplete,
  ],
  templateUrl: './bank-transactions.component.html',
  styleUrl: './bank-transactions.component.scss',
})
export class BankTransactionsComponent implements OnInit {
  private dr = inject(DestroyRef);
  private fb = inject(FormBuilder);

  private message = inject(MessageService);
  private mcc_service = inject(MccService);
  private dt_service = inject(DateTimeService);
  protected t_service = inject(TransactionService);
  private theme_service = inject(ThemeService);
  private cd = inject(ChangeDetectorRef);


  mcc_list: Mcc[] = [];
  transactions: BankTransaction[] = [];

  tags = new Map<string, TransactionTag>();
  get tags_list(): { key: string; tag: string; severity: string }[] {
    return [...this.tags.values()].map(t => ({ key: t.severity + '+' + t.tag, tag: t.tag, severity: t.severity }));
  }
  all_tag_names: string[] = [];
  tags_suggestions: string[] = [];
  selected_transactions: BankTransaction[] = [];
  protected selected_tag_map: Record<string, boolean> = {};

  show_add_tag_dialog = false;
  batch_tag_form = this.fb.group({
    rows: this.fb.array([this.create_tag_row()]),
  });

  private search$ = new Subject<string>();

  show_delete_tag_dialog = false;
  batch_delete_tag_form = this.fb.group({
    rows: this.fb.array([this.create_delete_tag_row()]),
  });

  get tag_rows() {
    return this.batch_tag_form.get('rows') as FormArray;
  }

  get delete_tag_rows() {
    return this.batch_delete_tag_form.get('rows') as FormArray;
  }


  data = {labels: [], datasets: []};
  options: any = this.create_default_chart_options();


  theme_state = this.theme_service.theme_state;
  chart_options = [];
  chart_idx = 1;

  exceptions: FilterException[] = [];
  readonly severity_options = SEVERITY_OPTIONS;

  constructor() {
    this.chart_options = [
      {name: 'Загальна', chart_idx: 1},
      {name: 'Дохід та витрати', chart_idx: 2},
      {name: 'MCC Витрати', chart_idx: 3},
      {name: 'MCC-G Витрати', chart_idx: 4},
      {name: 'MCC Дохід', chart_idx: 5},
      {name: 'Tag Витрати', chart_idx: 6},
      {name: 'Tag Дохід', chart_idx: 7},
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


  private create_tag_row() {
    return this.fb.group({
      tag: ['', [Validators.required, Validators.minLength(1)]],
      severity: ['primary', Validators.required],
    });
  }

  add_tag_row() {
    this.tag_rows.push(this.create_tag_row());
  }

  remove_tag_row(index: number) {
    if (this.tag_rows.length > 1) this.tag_rows.removeAt(index);
  }

  private create_delete_tag_row() {
    return this.fb.group({
      tag: ['', [Validators.required, Validators.minLength(1)]],
      severity: ['primary', Validators.required],
    });
  }

  add_delete_tag_row() {
    this.delete_tag_rows.push(this.create_delete_tag_row());
  }

  remove_delete_tag_row(index: number) {
    if (this.delete_tag_rows.length > 1) this.delete_tag_rows.removeAt(index);
  }

  // Maps a PrimeNG tag severity to togglebutton design-token overrides.
  // Checked (on)  → full severity color.
  // Unchecked (off) → secondary / muted.
  tag_toggle_style(severity: string): Record<string, string> {
    const bg = `var(--p-tag-${severity}-background)`;
    const fg = `var(--p-tag-${severity}-color)`;
    return {

      '--p-togglebutton-font-weight': 'bold',


      '--p-togglebutton-checked-background': 'inherited',
      '--p-togglebutton-checked-hover-background': bg,
      '--p-togglebutton-checked-color': fg,
      '--p-togglebutton-checked-border-color': 'inherited',// bg,
      '--p-togglebutton-content-checked-background': bg,

      '--p-togglebutton-background': 'inherited',//'var(--p-tag-secondary-background)',
      '--p-togglebutton-hover-background': 'var(--p-tag-secondary-background)',
      '--p-togglebutton-color': 'var(--p-tag-secondary-color)',
      '--p-togglebutton-border-color': 'inherited',//'var(--p-tag-secondary-background)',
      '--p-togglebutton-content-background': 'var(--p-tag-secondary-background)',
    };
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
    const mcc_field = FILTER_FIELDS.find(f => f.value === 'mcc')!;
    const desc_field = FILTER_FIELDS.find(f => f.value === 'description')!;
    const eq_num = NUMBER_OPERATORS.find(o => o.value === 'eq')!;
    const eq_str = STRING_OPERATORS.find(o => o.value === 'eq')!;
    const f: FilterException = {
      combinator: 'AND NOT',
      conditions: [
        {field: mcc_field.value, operator: eq_num.value, value: '4829', severity: null},
        {field: desc_field.value, operator: eq_str.value, value: 'Переказ на картку', severity: null},
      ]
    }

    const s: FilterException = {
      combinator: 'AND NOT',
      conditions: [
        {field: mcc_field.value, operator: eq_num.value, value: '4829', severity: null},
        {field: desc_field.value, operator: eq_str.value, value: 'З Білої картки', severity: null},
      ]
    }

    return [f, s];
  }

  ngOnInit() {

    this.t_service.get_all_transactions_tags().pipe(
      tap((tags) => {
        if (!tags) return;
        this.tags.clear();
        tags.forEach(t => {
          const key = `${t.severity}+${t.tag}`;
          this.tags.set(key, t);
        });
      }),
      take(1),
    ).subscribe()

    this.mcc_service.fetch_mcc().pipe(
      switchMap((mcc_list_or_empty) => {
        this.mcc_list = (mcc_list_or_empty as Mcc[]) || [];

        const time_range = this.dt_service.time_range;
        if (!time_range || time_range.length < 2) {
          this.message.add({severity: 'warn', summary: 'Dates', detail: 'Please select a date range.'});
          return of([] as BankTransaction[]);
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

        const filter: BankTransactionFilter = {
          external_id_list: [],
          ida_list: [],
          from,
          to,
          exceptions: this.build_active_exceptions(),
        }
        return this.t_service.get_transactions(filter)
      }),
      tap((t_list) => {
        this.refill_transactions(t_list);
      }),
      takeUntilDestroyed(this.dr)
    ).subscribe();

    this.dt_service.time_range$.pipe(
      skip(1),
      switchMap((time_range) => {
        if (!time_range || time_range.length < 2) {
          this.message.add({severity: 'warn', summary: 'Dates', detail: 'Please select a date range.'});
          return of([] as BankTransaction[]);
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

        const filter: BankTransactionFilter = {
          ...this.t_service.last_transactions_filter,
          from,
          to,
          exceptions: this.build_active_exceptions(),
        };
        this.t_service.last_transactions_filter = filter;
        return this.t_service.get_transactions(filter)
      }),
      tap((t_list) => {
        this.refill_transactions(t_list);
      }),
      takeUntilDestroyed(this.dr)
    ).subscribe();


    this.t_service.refill_data_event$.pipe(
      skip(1), // skip event from account.ts on_selection_change()
      takeUntilDestroyed(this.dr),
      switchMap(() => {
        const filter = this.t_service.last_transactions_filter;
        return this.t_service.get_transactions(filter)
      }),
      tap((t_list) => {
        this.refill_transactions(t_list);
      }),
    ).subscribe();

    this.search$
      .pipe(
        takeUntilDestroyed(this.dr),
        debounceTime(300),
        switchMap(query =>
          this.t_service.get_all_transactions_tags_name().pipe(
            tap(tags => {
              this.all_tag_names = tags;
              this.tags_suggestions = query
                ? this.all_tag_names.filter(t => t.toLowerCase().includes(query))
                : [...this.all_tag_names];
              this.cd.detectChanges();
            }),
          )
        ),
      )
      .subscribe();
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
        this.draw_mcc_group_outcome(t_list)
        break;
      case 5:
        this.draw_mcc_income(t_list)
        break;
      case 6:
        this.draw_tags_outcome(t_list)
        break;
      case 7:
        this.draw_tags_income(t_list)
        break;
    }

  }

  apply_filter_changes() {
    const last = this.t_service.last_transactions_filter;
    if (!last) return;

    const filter: BankTransactionFilter = {
      ...last,
      exceptions: this.build_active_exceptions(),
    };
    this.t_service.get_transactions(filter).pipe(
      take(1),
      tap((t_list) => {
        this.refill_transactions(t_list);
      }),
    ).subscribe();
  }

  /**
   * Called whenever a tag toggle button changes state.
   * Off → adds an AND NOT exception for that tag.
   * On  → removes the exception.
   */
  on_tag_toggle() {
    this.fetch_with_current_exceptions();
  }

  /**
   * Merges the user-defined exceptions with the tag-derived exceptions
   * and returns the combined list used for every fetch.
   */
  private build_active_exceptions(): FilterException[] {
    const tag_exceptions: FilterException[] = Object.entries(this.selected_tag_map)
      .filter(([, enabled]) => !enabled)
      .map(([tag_combo]) => ({
        combinator: 'AND NOT',
        conditions: [{field: 'tag', operator: 'eq', value: tag_combo.split("+")[1], severity: tag_combo.split("+")[0]}],
      } as FilterException));

    const enabled_exceptions = this.exceptions.filter(ex => ex.enabled !== false);
    return [...enabled_exceptions, ...tag_exceptions];
  }

  private fetch_with_current_exceptions() {
    const last = this.t_service.last_transactions_filter;
    if (!last) return;

    const filter: BankTransactionFilter = {
      ...last,
      exceptions: this.build_active_exceptions(),
    };
    this.t_service.get_transactions(filter).pipe(
      take(1),
      tap((t_list) => {
        this.refill_transactions(t_list);
      }),
    ).subscribe();
  }

  private refill_transactions(t_list: BankTransaction[]) {
    this.transactions = t_list || [];
    t_list.forEach((t) =>
      t.tags.forEach((tag) => {
        const key = tag.severity + '+' + tag.tag;
        if (!this.tags.has(key)) {
          this.tags.set(key, tag);
        }
        if (!(key in this.selected_tag_map)) {
          this.selected_tag_map[key] = true;
        }
      })
    );
    this.on_chart_select(this.chart_idx, t_list);
    this.cd.detectChanges();
  }

  open_add_tag_dialog() {
    if (this.selected_transactions.length === 0) {
      this.message.add({severity: 'warn', summary: 'Теги', detail: 'Оберіть хоча б одну транзакцію.'});
      return;
    }
    while (this.tag_rows.length > 1) this.tag_rows.removeAt(1);
    this.tag_rows.at(0).reset({tag: '', severity: 'primary'});
    this.show_add_tag_dialog = true;
  }

  open_delete_tag_dialog() {
    if (this.selected_transactions.length === 0) {
      this.message.add({severity: 'warn', summary: 'Теги', detail: 'Оберіть хоча б одну транзакцію.'});
      return;
    }
    while (this.delete_tag_rows.length > 1) this.delete_tag_rows.removeAt(1);
    this.delete_tag_rows.at(0).reset({tag: '', severity: 'primary'});
    this.show_delete_tag_dialog = true;
  }

  submit_add_tag() {
    if (this.batch_tag_form.invalid) return;

    const new_tags: TransactionTag[] = this.batch_tag_form.value.rows as TransactionTag[];

    const payload = this.selected_transactions.map(t => ({
      idt: t.idt,
      tags: new_tags,
    }));

    this.t_service.add_transactions_tags(payload).pipe(
      take(1),
      tap((results) => {
        if (!results || results.length === 0) return;

        // Build a lookup: transaction id → returned tags
        const tag_map = new Map(results.map(r => [r['idt'], r['tags'] as TransactionTag[]]));

        // Patch tags in place — no refetch needed
        this.transactions = this.transactions.map(t => {
          const updated = tag_map.get(t.idt);
          return updated ? {...t, tags: updated} : t;
        });

        for (const ntag of new_tags) {
          const key = ntag.severity + '+' + ntag.tag;
          this.tags.set(key, ntag);
          if (!(key in this.selected_tag_map)) {
            this.selected_tag_map[key] = true;
          }
        }

        this.cd.detectChanges();
        this.show_add_tag_dialog = false;
        this.message.add({
          severity: 'success',
          summary: 'Теги',
          detail: `${new_tags.length} тег(и) додано до ${results.length} транзакцій.`,
        });
      }),
    ).subscribe();
  }

  search($event: AutoCompleteCompleteEvent) {
    const query = ($event.query ?? '').toLowerCase();
    this.search$.next(query);
  }

  submit_delete_tag() {
    if (this.batch_delete_tag_form.invalid) return;

    const tags_to_delete: TransactionTag[] = (this.batch_delete_tag_form.value.rows as {
      tag: string;
      severity: string
    }[])
      .map(r => ({tag: r.tag, severity: r.severity}));

    const payload = this.selected_transactions.map(t => ({
      idt: t.idt,
      tags: tags_to_delete,
    }));

    this.t_service.delete_transactions_tags(payload).pipe(
      take(1),
      tap((results) => {
        if (!results || results.length === 0) return;

        const tag_map = new Map(results.map(r => [r['idt'], r['tags'] as TransactionTag[]]));

        this.transactions = this.transactions.map(t => {
          const updated = tag_map.get(t.idt);
          return updated ? {...t, tags: updated} : t;
        });

        this.cd.detectChanges();
        this.show_delete_tag_dialog = false;
        this.message.add({
          severity: 'success',
          summary: 'Теги',
          detail: `${tags_to_delete.length} тег(и) видалено з ${results.length} транзакцій.`,
        });
      }),
    ).subscribe();
  }


  ////// DRAW

  private draw_main_chart(t_list: BankTransaction[]) {
    const data = t_list.map(t => {
      const amount_key = 'amount_' + t.external_id;
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
          renderer: ({datum}: { datum: Record<string, unknown> }) => {
            return {
              title: datum["masked_pan"],
              heading: datum["description"],
              data: [
                {label: "Amount", value: datum["amount_" + external_id]},
                {label: "Time", value: datum["time_string"]}
              ],
            } as AgTooltipRendererResult;
          },
        },
      };
    });

    const options = {
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


  private draw_income_outcome(t_list: BankTransaction[]) {
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

    const is_dark = this.theme_state().darkTheme;
    const outcome_color = get_css_var('--p-red-500');
    const income_color = get_css_var('--p-green-500');
    this.options = {
      theme: is_dark ? 'ag-default-dark' : 'ag-default',
      background: {visible: false},
      data,

      series: [
        {
          type: 'bar',
          xKey: 'month',
          yKey: 'outcome',
          yName: 'Витрати (UAH)',
          fill: outcome_color,
        },
        {
          type: 'bar',
          xKey: 'month',
          yKey: 'income',
          yName: 'Дохід (UAH)',
          fill: income_color,
        },
      ],
    };
    this.cd.detectChanges();
  }

  private draw_mcc_group_outcome(t_list: BankTransaction[]) {
    const with_mcc_group = t_list.map((t) => {
      const mcc_group = this.mcc_list[t.mcc].group;
      return {
        ...t,
        mcc_group
      }
    })

    // Group transactions by MCC
    const groups = Object.groupBy(
      with_mcc_group,
      (t) => t.mcc_group.type
    );
    // Sum positive amounts (income) per month
    const data = Object.entries(groups)
      .map(([mcc, items]) => {
        const outcome = (items ?? [])
          .filter(t => t.amount < 0)
          .reduce((sum, t) => sum + t.amount, 0);
        return {
          mcc_d: items[0].mcc_group.description.uk,
          label: `${mcc}:${items[0].mcc_group.description.uk}`,
          outcome: Math.abs(outcome) / 100,  // positive value, UAH
        };
      })
      .filter((o) => o.outcome !== 0)
      .sort((a, b) => a.mcc_d.localeCompare(b.mcc_d));

    const is_dark = this.theme_state().darkTheme;
    const fills = this.theme_service.get_chart_fills();
    this.options = {
      theme: is_dark ? 'ag-default-dark' : 'ag-default',
      background: {visible: false},
      data,
      series: [{type: 'donut', angleKey: 'outcome', calloutLabelKey: 'label', fills}],
    };
    this.cd.detectChanges();
  }

  private draw_mcc_outcome(t_list: BankTransaction[]) {
    // Group transactions by MCC
    const groups = Object.groupBy(
      t_list,
      (t) => t.mcc
    );

    // Sum negative amounts (outcome) per month
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

    const is_dark = this.theme_state().darkTheme;
    const fills = this.theme_service.get_chart_fills();
    this.options = {
      theme: is_dark ? 'ag-default-dark' : 'ag-default',
      background: {visible: false},
      data,
      series: [{type: 'donut', angleKey: 'outcome', calloutLabelKey: 'label', fills}],
    };
    this.cd.detectChanges();
  }

  private draw_mcc_income(t_list: BankTransaction[]) {
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

    const is_dark = this.theme_state().darkTheme;
    const fills = this.theme_service.get_chart_fills();
    this.options = {
      theme: is_dark ? 'ag-default-dark' : 'ag-default',
      background: {visible: false},
      data,
      // series: [{type: 'pie', angleKey: 'income', legendItemKey: 'label', fills}],
      series: [{type: 'donut', angleKey: 'income', calloutLabelKey: 'label', fills}],
    };
    this.cd.detectChanges();
  }

  private draw_tags_income(t_list: BankTransaction[]) {

    const tag_map = new Map<string, number>

    t_list.forEach((tx) => {
      if (tx.amount > 0) {
        tx.tags.forEach((tag) => {
          const key = `${tag.tag}/${tag.severity}`;
          const current_value = tag_map.get(key) ?? 0;
          tag_map.set(key, current_value + tx.amount)
        })
      }
    })

    const data = [...tag_map]
      .map(([k, v]) => {
        return {
          label: k,
          income: Math.abs(v) / 100,  // positive value, UAH
        };
      }).filter((i) => i.income !== 0)
      .sort((a, b) => a.label.localeCompare(b.label));

    const is_dark = this.theme_state().darkTheme;
    const fills = this.theme_service.get_chart_fills();
    this.options = {
      theme: is_dark ? 'ag-default-dark' : 'ag-default',
      background: {visible: false},
      data,
      series: [{type: 'donut', angleKey: 'income', calloutLabelKey: 'label', fills}],
    };
    this.cd.detectChanges();
  }

  private draw_tags_outcome(t_list: BankTransaction[]) {

    const tag_map = new Map<string, number>

    t_list.forEach((tx) => {
      if (tx.amount < 0) {
        tx.tags.forEach((tag) => {
          const key = `${tag.tag}/${tag.severity}`;
          const current_value = tag_map.get(key) ?? 0;
          tag_map.set(key, current_value + tx.amount)
        })
      }
    })

    const data = [...tag_map]
      .map(([k, v]) => {
        return {
          label: k,
          income: Math.abs(v) / 100,  // positive value, UAH
        };
      }).filter((i) => i.income !== 0)
      .sort((a, b) => a.label.localeCompare(b.label));

    const is_dark = this.theme_state().darkTheme;
    const fills = this.theme_service.get_chart_fills();
    this.options = {
      theme: is_dark ? 'ag-default-dark' : 'ag-default',
      background: {visible: false},
      data,
      series: [{type: 'donut', angleKey: 'income', calloutLabelKey: 'label', fills}],
    };
    this.cd.detectChanges();

  }

}

