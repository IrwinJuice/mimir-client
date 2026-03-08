import {Component} from '@angular/core';
import {Divider} from 'primeng/divider';
import {Accounts} from '../accounts/accounts';

@Component({
  selector: 'app-sidebar',
  imports: [
    Divider,
    Accounts,
  ],
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.scss',
})
export class Sidebar {
}
