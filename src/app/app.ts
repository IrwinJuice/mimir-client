import {Component, OnInit, signal} from '@angular/core';
import {RouterOutlet} from '@angular/router';
import {Toast} from 'primeng/toast';
import {Select} from 'primeng/select';
import {User, UserService} from './service/user-service';
import {FormsModule} from '@angular/forms';
import {take, tap} from 'rxjs';
import {Button} from 'primeng/button';
import {ThemeSwitcher} from './themeswitcher';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, Toast, Select, FormsModule, Button, ThemeSwitcher],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App implements OnInit {
  protected readonly title = signal('bills-client');
  protected readonly users = signal<User[]>([]);
  protected user_loading = true;
  protected selectedUser: User | undefined;

  constructor(private us: UserService) {
  }

  ngOnInit(): void {
    this.us.get_users().pipe(
      take(1),
      tap((users) => {
        this.users.set(users);
        this.user_loading = false;
      })
    ).subscribe();
  }


}
