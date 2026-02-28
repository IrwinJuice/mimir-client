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


@Component({
  selector: 'app-root',
  imports: [RouterOutlet, Toast, FormsModule, ThemeSwitcher, ReactiveFormsModule, Menubar, DatePicker, Sidebar],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App implements OnInit {
  private account_service = inject(AccountService);
  private dt_service = inject(DateTimeService);
  private message = inject(MessageService);
  private web_socket_service = inject(WebSocketService);
  protected items: MenuItem[];

  range_dates: Date[];


  ngOnInit(): void {
    const now = new Date();
    // set range to now and two months ago
    const twoMonthsAgo = new Date(now);
    twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);
    this.range_dates = [now, twoMonthsAgo];
    this.dt_service.time_range = this.range_dates;

    this.web_socket_service.connect().subscribe({
      next: (msg) => {
        let notification = JSON.parse(msg.data) as WebSocketNotification;
        console.log('Received:', notification)
        console.log('event:', notification.event)
        console.log('event:', notification.event === WebSocketNotificationKind.MONITOR_PENDING)


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

  protected onRangeChange() {
    this.dt_service.time_range = this.range_dates;
  }

}
