import {Component, inject, OnInit} from '@angular/core';
import {RouterOutlet} from '@angular/router';
import {Toast} from 'primeng/toast';
import {FormsModule, ReactiveFormsModule} from '@angular/forms';
import {ThemeSwitcher} from './themeswitcher';
import {AccountService} from './service/account.service';
import {MenuItem} from 'primeng/api';
import {Menubar} from 'primeng/menubar';
import {DatePicker} from 'primeng/datepicker';
import {Sidebar} from './components/sidebar/sidebar';
import {Button} from 'primeng/button';


@Component({
  selector: 'app-root',
  imports: [RouterOutlet, Toast, FormsModule, ThemeSwitcher, ReactiveFormsModule, Menubar, DatePicker, Sidebar, Button],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App implements OnInit {
  stats_loading = false;
  private account_service = inject(AccountService);
  protected items: MenuItem[];

  rangeDates: Date[];


  ngOnInit(): void {
    // initialize rangeDates: [now, now - 1 years]
    // const now = new Date();
    // const fiveYearsAgo = new Date(now);
    // fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 1);
    // this.rangeDates = [now, fiveYearsAgo];
    const now = new Date();
    // set range to now and two months ago
    const twoMonthsAgo = new Date(now);
    twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);
    this.rangeDates = [now, twoMonthsAgo];


  }

  protected onRangeChange() {
    this.account_service.time_range = this.rangeDates;
  }

  protected fetchStats() {

  }
}
