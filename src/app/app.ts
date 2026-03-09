import {Component, inject, OnInit} from '@angular/core';
import {RouterLink, RouterOutlet} from '@angular/router';
import {Toast} from 'primeng/toast';
import {FormsModule, ReactiveFormsModule} from '@angular/forms';
import {ThemeSwitcher} from './themeswitcher';
import {AccountService} from './service/account.service';
import {MenuItem, MessageService} from 'primeng/api';
import {Menubar} from 'primeng/menubar';
import {DatePicker} from 'primeng/datepicker';
import {Sidebar} from './components/sidebar/sidebar';
import {WebSocketNotification, WebSocketNotificationKind, WebSocketService} from './service/web-socket-service';
import {DateTimeService} from './service/date-time.service';
import {TransactionService} from './service/transaction.service';


@Component({
  selector: 'app-root',
  imports: [RouterOutlet, Toast, FormsModule, ThemeSwitcher, ReactiveFormsModule, Menubar, DatePicker, Sidebar, RouterLink],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App implements OnInit {
  private account_service = inject(AccountService);
  private transaction_service = inject(TransactionService);
  private dt_service = inject(DateTimeService);
  private message = inject(MessageService);
  private web_socket_service = inject(WebSocketService);
  protected items: MenuItem[];

  range_dates: Date[];

  constructor() {
    this.items = [
      {
        label: 'Export',
        icon: 'pi pi-file-export',
        items: [
          {
            label: 'CSV',
            icon: 'pi pi-file-plus',
            command: () => this.download_csv()
          },
          {
            label: 'XLSX',
            icon: 'pi pi-file-excel',
            command: () => this.download_xlsx()
          },
          {
            label: 'JSON',
            icon: 'pi pi-file',
            command: () => this.download_json()
          }
        ]
      }
    ]
  }

  private readonly RANGE_STORAGE_KEY = 'app_date_range';

  private save_date_range(range: Date[]): void {
    localStorage.setItem(this.RANGE_STORAGE_KEY, JSON.stringify(range.map(d => d.toISOString())));
  }

  private load_date_range(): Date[] | null {
    const stored = localStorage.getItem(this.RANGE_STORAGE_KEY);
    if (!stored) return null;
    try {
      const parsed: string[] = JSON.parse(stored);
      const dates = parsed.map(s => new Date(s));
      if (dates.some(d => isNaN(d.getTime()))) return null;
      return dates;
    } catch {
      return null;
    }
  }

  ngOnInit(): void {
    const now = new Date();
    const two_months_ago = new Date(now);
    two_months_ago.setMonth(two_months_ago.getMonth() - 2);
    const restored = this.load_date_range();
    this.range_dates = restored ?? [two_months_ago, now];
    this.dt_service.time_range = this.range_dates;

    this.web_socket_service.connect().subscribe({
      next: (msg) => {
        const notification = JSON.parse(msg.data) as WebSocketNotification;
        switch (notification.event) {
          case WebSocketNotificationKind.ALL_MONITORS_UPDATED:
            this.message.add({
              severity: 'success',
              summary: 'Оновлено',
              detail: 'Статистику по всім банківським аккаунтам оновлено успішно.'
            });
            break;
          case WebSocketNotificationKind.MONITOR_PENDING:
            this.account_service.monitor_status = notification;
            this.message.add({
              severity: 'info',
              summary: 'Оновлюється',
              detail: `Рахунок ${notification.masked_pan} оновлюється.`
            });
            break;
          case WebSocketNotificationKind.MONITOR_UPDATED:
            this.account_service.monitor_status = notification;
            this.transaction_service.refill_data_event = Date.now();//next random umber
            this.message.add({
              severity: 'success',
              summary: 'Оновлено',
              detail: `Статистику по рахунку ${notification.masked_pan} оновлено успішно.`
            });
            break;
        }
      },
      error: (err) => console.error('WebSocket error:', err),
      complete: () => console.log('Connection closed')
    })
  }

  protected on_range_change(range: [Date, Date]) {
    if (range[0] && range[1]) {
      this.dt_service.time_range = this.range_dates;
      this.save_date_range(this.range_dates);
    }
  }


  download_csv() {
    const filter = this.transaction_service.last_transactions_filter;
    if (!filter) {
      this.message.add({severity: 'warn', summary: 'CSV', detail: 'No transactions loaded yet.'});
      return;
    }
    this.transaction_service.download_csv(filter);
  }


  download_xlsx() {
    const filter = this.transaction_service.last_transactions_filter;
    if (!filter) {
      this.message.add({severity: 'warn', summary: 'CSV', detail: 'No transactions loaded yet.'});
      return;
    }
    this.transaction_service.download_xlsx(filter);
  }


  download_json() {
    const filter = this.transaction_service.last_transactions_filter;
    if (!filter) {
      this.message.add({severity: 'warn', summary: 'CSV', detail: 'No transactions loaded yet.'});
      return;
    }
    this.transaction_service.download_json(filter);
  }

}
