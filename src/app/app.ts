import {Component, inject, OnInit} from '@angular/core';
import {RouterOutlet} from '@angular/router';
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
  imports: [RouterOutlet, Toast, FormsModule, ThemeSwitcher, ReactiveFormsModule, Menubar, DatePicker, Sidebar],
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
    let e = "u9kA-TTcNf-Dvcr77-T-y3jOZzbQZDssp7wsl82ny7So"
    this.items = [
      {
        label: 'Export',
        icon: 'pi pi-file-export',
        items: [
          {
            label: 'CSV',
            icon: 'pi pi-file-plus',
            command: _ => this.download_csv()
          },
          {
            label: 'XLSX',
            icon: 'pi pi-file-excel',
            command: _ => this.download_xlsx()
          },
          {
            label: 'JSON',
            icon: 'pi pi-file',
            command: _ => this.download_json()
          }
        ]
      }
    ]
  }

  ngOnInit(): void {
    const now = new Date();
    // set range to now and two months ago
    const twoMonthsAgo = new Date(now);
    twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);
    this.range_dates = [twoMonthsAgo, now];
    this.dt_service.time_range = this.range_dates;

    this.web_socket_service.connect().subscribe({
      next: (msg) => {
        let notification = JSON.parse(msg.data) as WebSocketNotification;
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
            this.transaction_service.refill_data_event = Math.random();
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

  protected onRangeChange(range: [Date, Date]) {
    if (range[0] && range[1]) {
      this.dt_service.time_range = this.range_dates;
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
