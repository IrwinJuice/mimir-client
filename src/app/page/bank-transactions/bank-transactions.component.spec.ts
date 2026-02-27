import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BankTransactionsComponent } from './bank-transactions.component';

describe('Bills', () => {
  let component: BankTransactionsComponent;
  let fixture: ComponentFixture<BankTransactionsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BankTransactionsComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(BankTransactionsComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
