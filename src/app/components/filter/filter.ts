import {Component, EventEmitter, inject, Input, OnInit, Output} from '@angular/core';
import {Button} from 'primeng/button';
import {Select} from 'primeng/select';
import {InputText} from 'primeng/inputtext';
import {Tooltip} from 'primeng/tooltip';
import {Fieldset} from 'primeng/fieldset';
import {FormArray, FormBuilder, FormGroup, ReactiveFormsModule} from '@angular/forms';
import {FilterCondition, FilterException, TransactionService} from '../../service/transaction.service';
import {
  COMBINATORS,
  FILTER_FIELDS,
  FilterField,
  FilterOperator,
  NUMBER_OPERATORS,
  STRING_OPERATORS
} from '../../service/account.service';

/**
 * UI component for building and applying exception-based transaction filters.
 *
 * The component uses a two-level reactive form structure:
 * - `exceptions`: a list of exception groups
 * - `conditions`: a list of field/operator/value conditions inside each group
 *
 * It accepts the current exceptions through the `ex` input and emits updated
 * exceptions through `exChange`.
 */
@Component({
  selector: 'app-filter',
  imports: [
    Fieldset,
    Button,
    Select,
    InputText,
    Fieldset,
    Tooltip,
    ReactiveFormsModule,
  ],
  templateUrl: './filter.html',
  styleUrl: './filter.scss',
})
export class Filter implements OnInit {
  private fb = inject(FormBuilder);
  private t_service = inject(TransactionService);

  /**
   * Available fields that can be selected for a filter condition.
   */
  filter_fields: FilterField[] = FILTER_FIELDS;

  /**
   * Supported logical combinators for exception groups.
   */
  combinators = COMBINATORS;

  /**
   * Root reactive form that stores all exception groups.
   *
   * Structure:
   * - `exceptions`: `FormArray`
   *   - each entry is a `FormGroup`
   *   - each group contains `combinator` and `conditions`
   */
  exceptions_form: FormGroup = this.fb.group({
    exceptions: this.fb.array([])
  });

  /**
   * Cached exception list received from the parent component.
   */
  _ex: FilterException[] = [];

  /**
   * Emits the normalized list of filter exceptions when changes are applied.
   */
  @Output() exChange = new EventEmitter<FilterException[]>();

  /**
   * Rebuilds the reactive form from the provided exception list.
   *
   * @param next Exception groups received from the parent component.
   */
  @Input()
  set ex(next: FilterException[]) {
    this._ex = next;
    this.exceptions.clear();

    if (next.length > 0) {
      for (const ex of next) {
        const conditions = ex.conditions
          .map(c => {
            const field = FILTER_FIELDS.find(f => f.value === c.field) ?? null;
            const operator_list = field?.type === 'number' ? NUMBER_OPERATORS : STRING_OPERATORS;
            const operator = operator_list.find(o => o.value === c.operator) ?? null;
            return this.new_condition_group(field, operator, c.value);
          });
        const group = this.fb.group({
          combinator: [ex.combinator ?? 'AND NOT'],
          conditions: this.fb.array(conditions),
        });
        this.exceptions.push(group);
      }
    }
  }

  /**
   * Emits the current exception state after Angular input/output bindings are ready.
   */
  ngOnInit() {
    this.exChange.emit(this.build_exceptions());
  }

  /**
   * Returns the form array that stores all exception groups.
   */
  get exceptions(): FormArray {
    return this.exceptions_form.get('exceptions') as FormArray;
  }

  /**
   * Returns the conditions form array for a specific exception group.
   *
   * @param group_index Index of the exception group.
   */
  get_conditions(group_index: number): FormArray {
    return this.exceptions.at(group_index).get('conditions') as FormArray;
  }

  /**
   * Returns the list of operators allowed for the selected field.
   *
   * Numeric fields use numeric operators; all other fields use string operators.
   *
   * @param group_index Index of the exception group.
   * @param cond_index Index of the condition inside the group.
   */
  get_operators_for(group_index: number, cond_index: number): FilterOperator[] {
    const field: FilterField | null = this.get_conditions(group_index).at(cond_index)?.get('field')?.value;
    if (!field) return [];
    return field.type === 'number' ? NUMBER_OPERATORS : STRING_OPERATORS;
  }

  /**
   * Updates the enabled state of operator and value controls after a field change.
   *
   * If no field is selected, dependent controls are disabled and reset.
   *
   * @param group_index Index of the exception group.
   * @param cond_index Index of the condition inside the group.
   */
  on_field_change(group_index: number, cond_index: number) {
    const cond = this.get_conditions(group_index).at(cond_index);
    const has_field = !!cond.get('field')?.value;
    const operator_ctrl = cond.get('operator')!;
    const value_ctrl = cond.get('value')!;
    if (has_field) {
      operator_ctrl.enable();
      value_ctrl.enable();
    } else {
      operator_ctrl.disable();
      value_ctrl.disable();
    }
    cond.patchValue({operator: null, value: ''});
  }

  /**
   * Creates a new condition form group.
   *
   * Operator and value controls are disabled until a field is selected.
   *
   * @param field Initial field value.
   * @param operator Initial operator value.
   * @param value Initial comparison value.
   */
  private new_condition_group(field: FilterField | null = null, operator: FilterOperator | null = null, value = '') {
    const has_field = !!field;
    return this.fb.group({
      field: [field],
      operator: [{value: operator, disabled: !has_field}],
      value: [{value: value, disabled: !has_field}],
    });
  }

  /**
   * Adds a new empty filter exception group to the form.
   */
  add_filter_exception() {
    const group = this.fb.group({
      combinator: ['AND NOT'],
      conditions: this.fb.array([this.new_condition_group()])
    });
    this.exceptions.push(group);
  }

  //
  // /**
  //  * Adds a pre-populated default exception group.
  //  *
  //  * @param conditions Condition definitions used to seed the new group.
  //  */
  // private add_default_exception(conditions: { field: FilterField, operator: FilterOperator, value: string }[]) {
  //   const group = this.fb.group({
  //     combinator: ['AND NOT'],
  //     conditions: this.fb.array(conditions.map(c => this.new_condition_group(c.field, c.operator, c.value)))
  //   });
  //   this.exceptions.push(group);
  // }

  /**
   * Removes a filter exception group by index.
   *
   * @param group_index Index of the group to remove.
   */
  remove_filter_exception(group_index: number) {
    this.exceptions.removeAt(group_index);
  }


  /**
   * Adds a new empty condition row to an existing exception group.
   *
   * @param groupIndex Index of the exception group to update.
   */
  add_condition(group_index: number) {
    this.get_conditions(group_index).push(this.new_condition_group());
  }

  /**
   * Removes a condition from a group.
   *
   * If the last condition is removed, the entire exception group is removed as well.
   *
   * @param groupIndex Index of the exception group.
   * @param condIndex Index of the condition to remove.
   */
  remove_condition(group_index: number, cond_index: number) {
    const conditions = this.get_conditions(group_index);
    if (conditions.length === 1) {
      this.exceptions.removeAt(group_index);
    } else {
      conditions.removeAt(cond_index);
    }
  }

  /**
   * Builds a normalized exception payload from the current form state.
   *
   * Incomplete conditions are ignored, and empty exception groups are excluded.
   */
  private build_exceptions(): FilterException[] {
    return this.exceptions.controls
      .map(group => {
        const conditions = (group.get('conditions') as FormArray).controls;
        const built: FilterCondition[] = conditions
          .map(c => (c as FormGroup).getRawValue())
          .filter(raw => raw.field && raw.operator && raw.value !== '')
          .map(raw => ({
            field: (raw.field as FilterField).value,
            operator: (raw.operator as FilterOperator).value,
            value: String(raw.value),
          }));
        return {combinator: group.get('combinator')!.value as string, conditions: built} as FilterException;
      })
      .filter(ex => ex.conditions.length > 0);
  }

  /**
   * Persists the current exceptions and emits them to the parent component.
   */
  apply_exceptions() {
    const data = this.build_exceptions();
    this.t_service.save_exceptions_to_storage(data);
    this.exChange.emit(this.build_exceptions());
  }
}
