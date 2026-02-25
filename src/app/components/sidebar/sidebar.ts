import {Component, inject} from '@angular/core';
import {Divider} from 'primeng/divider';
import {UserComponent} from '../user/user.component';
import {Account} from '../account/account';
import {UserService} from '../../service/user.service';
import {AsyncPipe} from '@angular/common';

@Component({
  selector: 'app-sidebar',
  imports: [
    Divider,
    UserComponent,
    Account,
    AsyncPipe
  ],
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.scss',
})
export class Sidebar {
  protected userService = inject(UserService);
}
