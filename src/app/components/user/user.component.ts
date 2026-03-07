import {Component, inject, OnInit, signal} from '@angular/core';
import {take, tap} from 'rxjs';
import {FormBuilder, FormsModule, ReactiveFormsModule, Validators} from '@angular/forms';
import {MessageService} from 'primeng/api';
import {CreateUser, User, UserService} from '../../service/user.service';
import {Select} from 'primeng/select';
import {Button} from 'primeng/button';
import {Dialog} from 'primeng/dialog';
import {InputText} from 'primeng/inputtext';

@Component({
  selector: 'app-user',
  imports: [
    Select,
    Button,
    FormsModule,
    Dialog,
    ReactiveFormsModule,
    InputText
  ],
  templateUrl: './user.component.html',
  styleUrl: './user.component.scss',
})
export class UserComponent implements OnInit {

  private formBuilder = inject(FormBuilder);
  private userService = inject(UserService);
  private message = inject(MessageService);

  protected readonly users = signal<User[]>([]);

  protected selected_user: User | undefined;
  protected user_loading = true;
  protected visible_user_dialog = false;
  protected userForm = this.formBuilder.nonNullable.group({
    name: ['', Validators.required],
  });


  ngOnInit(): void {
    this.userService.get_users().pipe(
      take(1),
      tap((users) => {
        this.users.set(users);
        if (users.length > 0) {
          this.selected_user = users[0];
          this.on_user_select(users[0]);
        }
        this.user_loading = false;
      })
    ).subscribe();
  }


  create_user() {
    if (this.userForm.valid) {
      const user: CreateUser = this.userForm.getRawValue();
      this.userService.create_user(user).pipe(
        take(1),
        tap((user) => {
          this.users.update(list => [...list, user]);
          this.on_user_select(user);
          this.selected_user = user;
          this.visible_user_dialog = false;
          this.message.add({severity: 'info', summary: 'User', detail: 'Успішно додано.'});
        })
      ).subscribe();
    }
  }


  on_user_select(user: User) {
    this.userService.selected_user = user;
  }

  delete_user() {
    const user = this.selected_user;
    if (!user) return;
    this.userService.delete_user(user.idu).pipe(
      take(1),
      tap(() => {
        this.users.update(list => list.filter(u => u.idu !== user.idu));
        const remaining = this.users();
        // clear first so bank-transactions clears its data
        this.userService.selected_user = null;
        this.selected_user = remaining[0] ?? undefined;
        if (this.selected_user) {
          this.userService.selected_user = this.selected_user;
        }
        this.message.add({severity: 'info', summary: 'User', detail: 'Користувача видалено.'});
      })
    ).subscribe();
  }
}
