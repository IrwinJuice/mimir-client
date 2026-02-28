import {Injectable} from '@angular/core';
import {BehaviorSubject} from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class DateTimeService {
  private _time_range = new BehaviorSubject<Date[]>([]);
  time_range$ = this._time_range.asObservable();


  set time_range(next: Date[]) {
    this._time_range.next(next);
  }

  get time_range(): Date[] {
    return this._time_range.value;
  }
}
