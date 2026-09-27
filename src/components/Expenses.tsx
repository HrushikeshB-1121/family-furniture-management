import {
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from 'react';
import { supabase } from '../lib/supabase';

type PaymentMethod =
  | 'CASH'
  | 'UPI'
  | 'CARD'
  | 'BANK_TRANSFER';

type Expense = {
  id: number;
  expense_date: string;
  category: string;
  amount: number;
  payment_method: PaymentMethod;
  notes: string | null;
};

const expenseCategories = [
  'Electricity',
  'Transport',
  'Food',
  'Rent',
  'Salary',
  'Maintenance',
  'Phone / Internet',
  'Packaging',
  'Other',
] as const;

function getLocalDateTimeValue(date = new Date()) {
  const offset = date.getTimezoneOffset();
  const local = new Date(
    date.getTime() - offset * 60 * 1000,
  );

  return local.toISOString().slice(0, 16);
}

function getTodayValue() {
  return getLocalDateTimeValue().slice(0, 10);
}

function Expenses() {
  const [expenses, setExpenses] =
    useState<Expense[]>([]);

  const [category, setCategory] =
    useState('');

  const [amount, setAmount] =
    useState('');

  const [expenseDate, setExpenseDate] =
    useState(getLocalDateTimeValue());

  const [paymentMethod, setPaymentMethod] =
    useState<PaymentMethod | ''>('');

  const [notes, setNotes] =
    useState('');

  const [filterFromDate, setFilterFromDate] =
    useState('');

  const [filterToDate, setFilterToDate] =
    useState('');

  const [filterCategory, setFilterCategory] =
    useState('');

  const [editingExpenseId, setEditingExpenseId] =
    useState<number | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [deletingId, setDeletingId] =
    useState<number | null>(null);

  const [message, setMessage] =
    useState('');

  const [errorMessage, setErrorMessage] =
    useState('');

  useEffect(() => {
    void loadExpenses();
  }, []);

  async function loadExpenses() {
    setLoading(true);
    setErrorMessage('');

    const { data, error } = await supabase
      .from('expenses')
      .select(
        'id, expense_date, category, amount, payment_method, notes',
      )
      .order('expense_date', {
        ascending: false,
      });

    if (error) {
      console.error(
        'Failed to load expenses:',
        error,
      );

      setErrorMessage(error.message);
      setExpenses([]);
      setLoading(false);
      return;
    }

    setExpenses(
      (data ?? []).map((expense) => ({
        ...expense,
        id: Number(expense.id),
        amount: Number(expense.amount),
      })) as Expense[],
    );

    setLoading(false);
  }

  function resetForm() {
    setEditingExpenseId(null);
    setCategory('');
    setAmount('');
    setExpenseDate(getLocalDateTimeValue());
    setPaymentMethod('');
    setNotes('');
  }

  function startEditing(expense: Expense) {
    setMessage('');
    setErrorMessage('');
    setEditingExpenseId(expense.id);
    setCategory(expense.category);
    setAmount(String(expense.amount));
    setExpenseDate(
      getLocalDateTimeValue(
        new Date(expense.expense_date),
      ),
    );
    setPaymentMethod(expense.payment_method);
    setNotes(expense.notes ?? '');

    window.setTimeout(() => {
      document
        .getElementById('expense-form')
        ?.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
        });
    }, 0);
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    setMessage('');
    setErrorMessage('');

    const numericAmount = Number(amount);
    const expenseDateValue = new Date(
      expenseDate,
    );

    if (!category.trim()) {
      setErrorMessage(
        'Select an expense category.',
      );
      return;
    }

    if (
      !Number.isFinite(numericAmount) ||
      numericAmount <= 0
    ) {
      setErrorMessage(
        'Expense amount must be greater than 0.',
      );
      return;
    }

    if (
      !expenseDate ||
      Number.isNaN(expenseDateValue.getTime())
    ) {
      setErrorMessage(
        'Enter a valid expense date and time.',
      );
      return;
    }

    if (!paymentMethod) {
      setErrorMessage(
        'Select a payment method.',
      );
      return;
    }

    setSaving(true);

    const payload = {
      expense_date:
        expenseDateValue.toISOString(),
      category: category.trim(),
      amount: numericAmount,
      payment_method: paymentMethod,
      notes: notes.trim() || null,
    };

    const result =
      editingExpenseId === null
        ? await supabase
            .from('expenses')
            .insert(payload)
        : await supabase
            .from('expenses')
            .update(payload)
            .eq('id', editingExpenseId);

    if (result.error) {
      console.error(
        'Failed to save expense:',
        result.error,
      );

      setErrorMessage(result.error.message);
      setSaving(false);
      return;
    }

    setMessage(
      editingExpenseId === null
        ? 'Expense recorded successfully.'
        : 'Expense updated successfully.',
    );

    resetForm();
    setSaving(false);
    await loadExpenses();
  }

  async function handleDelete(expense: Expense) {
    const confirmed = window.confirm(
      `Delete ${expense.category} expense of INR ${expense.amount.toLocaleString(
        'en-IN',
      )}?`,
    );

    if (!confirmed) {
      return;
    }

    setMessage('');
    setErrorMessage('');
    setDeletingId(expense.id);

    const { error } = await supabase
      .from('expenses')
      .delete()
      .eq('id', expense.id);

    if (error) {
      console.error(
        'Failed to delete expense:',
        error,
      );

      setErrorMessage(error.message);
      setDeletingId(null);
      return;
    }

    if (editingExpenseId === expense.id) {
      resetForm();
    }

    setMessage('Expense deleted successfully.');
    setDeletingId(null);
    await loadExpenses();
  }

  const filteredExpenses =
    useMemo(() => {
      return expenses.filter((expense) => {
        const expenseDate =
          expense.expense_date.slice(0, 10);

        if (
          filterFromDate &&
          expenseDate < filterFromDate
        ) {
          return false;
        }

        if (
          filterToDate &&
          expenseDate > filterToDate
        ) {
          return false;
        }

        if (
          filterCategory &&
          expense.category !== filterCategory
        ) {
          return false;
        }

        return true;
      });
    }, [
      expenses,
      filterFromDate,
      filterToDate,
      filterCategory,
    ]);

  const totalExpenses =
    filteredExpenses.reduce(
      (sum, expense) =>
        sum + expense.amount,
      0,
    );

  const paymentTotals = useMemo(() => {
    return filteredExpenses.reduce(
      (totals, expense) => {
        totals[expense.payment_method] +=
          expense.amount;
        return totals;
      },
      {
        CASH: 0,
        UPI: 0,
        CARD: 0,
        BANK_TRANSFER: 0,
      } as Record<PaymentMethod, number>,
    );
  }, [filteredExpenses]);

  function formatMoney(value: number) {
    return value.toLocaleString('en-IN');
  }

  function formatDateTime(value: string) {
    return new Date(value).toLocaleString(
      'en-IN',
      {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      },
    );
  }

  function formatPaymentMethod(
    method: PaymentMethod,
  ) {
    switch (method) {
      case 'BANK_TRANSFER':
        return 'Bank Transfer';
      case 'CASH':
        return 'Cash';
      case 'UPI':
        return 'UPI';
      case 'CARD':
        return 'Card';
      default:
        return method;
    }
  }

  if (loading) {
    return <p>Loading expenses...</p>;
  }

  return (
    <>
      <style>
        {`
          .expenses-page {
            width: 100%;
            max-width: 1100px;
            margin: 0 auto;
          }

          .expenses-header {
            margin-bottom: 20px;
          }

          .expenses-header h1 {
            margin-bottom: 5px;
          }

          .expenses-description {
            color: #667085;
            font-size: 14px;
          }

          .expenses-message {
            margin-bottom: 16px;
            padding: 11px 13px;
            border-radius: 8px;
            font-size: 14px;
          }

          .expenses-success {
            border: 1px solid #bbf7d0;
            background: #f0fdf4;
            color: #15803d;
          }

          .expenses-error {
            border: 1px solid #fecaca;
            background: #fef2f2;
            color: #dc2626;
          }

          .expenses-summary {
            display: grid;
            grid-template-columns: repeat(3, minmax(0, 1fr));
            gap: 12px;
            margin-bottom: 20px;
          }

          .expenses-summary-card {
            padding: 17px;
            background: #ffffff;
            border: 1px solid #e4e7ec;
            border-radius: 12px;
            box-shadow: 0 1px 2px rgba(16, 24, 40, 0.05);
          }

          .expenses-summary-label {
            color: #667085;
            font-size: 12px;
            font-weight: 600;
          }

          .expenses-summary-value {
            margin-top: 5px;
            color: #101828;
            font-size: 22px;
            line-height: 1.2;
            font-weight: 700;
          }

          .expenses-summary-value.due {
            color: #b45309;
          }

          .expenses-summary-subtext {
            margin-top: 5px;
            color: #98a2b3;
            font-size: 11px;
          }

          .expenses-card {
            margin-bottom: 20px;
            padding: 20px;
            background: #ffffff;
            border: 1px solid #e4e7ec;
            border-radius: 14px;
            box-shadow: 0 1px 2px rgba(16, 24, 40, 0.05);
            scroll-margin-top: 90px;
          }

          .expenses-card-header {
            margin-bottom: 16px;
          }

          .expenses-card-header h2 {
            margin-bottom: 5px;
          }

          .expenses-card-description {
            color: #667085;
            font-size: 13px;
          }

          .expenses-form-grid {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 14px;
          }

          .expenses-field.full {
            grid-column: 1 / -1;
          }

          .expenses-field label {
            display: block;
            margin-bottom: 6px;
            color: #101828;
            font-size: 13px;
            font-weight: 600;
          }

          .expenses-field input,
          .expenses-field select,
          .expenses-field textarea {
            width: 100%;
            min-height: 42px;
            box-sizing: border-box;
            padding: 9px 12px;
            border: 1px solid #d0d5dd;
            border-radius: 6px;
            background: #ffffff;
            color: #101828;
            font-size: 14px;
          }

          .expenses-field input:focus,
          .expenses-field select:focus,
          .expenses-field textarea:focus {
            outline: none;
            border-color: #2563eb;
            box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.12);
          }

          .expense-date-hint {
            margin-top: 5px;
            color: #98a2b3;
            font-size: 11px;
          }

          .expenses-actions {
            display: flex;
            flex-wrap: wrap;
            gap: 10px;
            margin-top: 16px;
          }

          .expenses-actions button {
            min-height: 40px;
          }

          .expenses-cancel {
            background: #ffffff;
            color: #344054;
            border-color: #d0d5dd;
          }

          .expenses-filters {
            display: grid;
            grid-template-columns: repeat(4, minmax(0, 1fr));
            gap: 12px;
            margin-bottom: 14px;
          }

          .expenses-filter label {
            display: block;
            margin-bottom: 6px;
            color: #101828;
            font-size: 12px;
            font-weight: 600;
          }

          .expenses-filter input,
          .expenses-filter select {
            width: 100%;
            min-height: 40px;
            box-sizing: border-box;
            padding: 8px 10px;
            border: 1px solid #d0d5dd;
            border-radius: 6px;
            background: #ffffff;
            color: #101828;
            font-size: 13px;
          }

          .expenses-filter-actions {
            display: flex;
            align-items: flex-end;
          }

          .expenses-clear-filters {
            min-height: 40px;
            width: 100%;
          }

          .expenses-count {
            margin-bottom: 12px;
            color: #667085;
            font-size: 12px;
          }

          .expenses-table-wrapper {
            width: 100%;
            overflow-x: auto;
            -webkit-overflow-scrolling: touch;
            border: 1px solid #e4e7ec;
            border-radius: 10px;
          }

          .expenses-table {
            width: 100%;
            min-width: 850px;
            border-collapse: collapse;
          }

          .expenses-table th,
          .expenses-table td {
            padding: 11px 12px;
            border-bottom: 1px solid #eaecf0;
            text-align: left;
            vertical-align: top;
            font-size: 13px;
          }

          .expenses-table th {
            background: #f9fafb;
            color: #344054;
            font-size: 12px;
            font-weight: 700;
          }

          .expenses-table tbody tr:last-child td {
            border-bottom: 0;
          }

          .expense-category {
            color: #101828;
            font-weight: 650;
          }

          .expense-notes {
            margin-top: 3px;
            color: #98a2b3;
            font-size: 11px;
          }

          .expense-amount {
            white-space: nowrap;
            color: #b45309;
            font-weight: 700;
          }

          .expense-method {
            color: #667085;
            white-space: nowrap;
          }

          .expense-actions-cell {
            white-space: nowrap;
          }

          .expense-row-button {
            min-height: 32px;
            margin-right: 6px;
            padding: 5px 9px;
            font-size: 12px;
          }

          .expense-delete-button {
            color: #b42318;
            border-color: #fecdca;
            background: #fff5f4;
          }

          .expenses-empty {
            padding: 28px 20px;
            text-align: center;
            background: #ffffff;
            border: 1px dashed #d0d5dd;
            border-radius: 10px;
            color: #667085;
          }

          @media (max-width: 850px) {
            .expenses-summary,
            .expenses-form-grid,
            .expenses-filters {
              grid-template-columns: 1fr;
            }

            .expenses-field.full {
              grid-column: auto;
            }
          }

          @media (max-width: 600px) {
            .expenses-card {
              padding: 16px;
            }

            .expenses-summary-value {
              font-size: 20px;
            }

            .expenses-actions button {
              width: 100%;
            }
          }
        `}
      </style>

      <main className="expenses-page">
        <div className="expenses-header">
          <h1>Expenses</h1>
          <p className="expenses-description">
            Record shop expenses with the actual date,
            time and payment method, then review the
            recorded expenses below.
          </p>
        </div>

        {message && (
          <div className="expenses-message expenses-success">
            {message}
          </div>
        )}

        {errorMessage && (
          <div className="expenses-message expenses-error">
            {errorMessage}
          </div>
        )}

        <section
          id="expense-form"
          className="expenses-card"
        >
          <div className="expenses-card-header">
            <h2>
              {editingExpenseId === null
                ? 'Add Expense'
                : 'Edit Expense'}
            </h2>

            <p className="expenses-card-description">
              Expense Date &amp; Time is the actual time
              the expense happened. It can be changed for
              late entries or corrections.
            </p>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="expenses-form-grid">
              <div className="expenses-field">
                <label htmlFor="expense-date">
                  Expense Date &amp; Time
                </label>

                <input
                  id="expense-date"
                  type="datetime-local"
                  value={expenseDate}
                  onChange={(event) =>
                    setExpenseDate(
                      event.target.value,
                    )
                  }
                  required
                />

                <p className="expense-date-hint">
                  Defaults to now. Change this when the
                  expense actually happened earlier.
                </p>
              </div>

              <div className="expenses-field">
                <label htmlFor="expense-category">
                  Category
                </label>

                <select
                  id="expense-category"
                  value={category}
                  onChange={(event) =>
                    setCategory(event.target.value)
                  }
                  required
                >
                  <option value="">
                    Select expense category
                  </option>

                  {expenseCategories.map(
                    (expenseCategory) => (
                      <option
                        key={expenseCategory}
                        value={expenseCategory}
                      >
                        {expenseCategory}
                      </option>
                    ),
                  )}
                </select>
              </div>

              <div className="expenses-field">
                <label htmlFor="expense-amount">
                  Amount
                </label>

                <input
                  id="expense-amount"
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={amount}
                  onChange={(event) =>
                    setAmount(event.target.value)
                  }
                  placeholder="Expense amount"
                  required
                />
              </div>

              <div className="expenses-field">
                <label htmlFor="expense-payment-method">
                  Payment Method
                </label>

                <select
                  id="expense-payment-method"
                  value={paymentMethod}
                  onChange={(event) =>
                    setPaymentMethod(
                      event.target.value as
                        | PaymentMethod
                        | '',
                    )
                  }
                  required
                >
                  <option value="">
                    Select payment method
                  </option>

                  <option value="CASH">Cash</option>
                  <option value="UPI">UPI</option>
                  <option value="BANK_TRANSFER">
                    Bank Transfer
                  </option>
                  <option value="CARD">Card</option>
                </select>
              </div>

              <div className="expenses-field full">
                <label htmlFor="expense-notes">
                  Notes
                </label>

                <textarea
                  id="expense-notes"
                  rows={3}
                  value={notes}
                  onChange={(event) =>
                    setNotes(event.target.value)
                  }
                  placeholder="Optional details, bill number, purpose, etc."
                />
              </div>
            </div>

            <div className="expenses-actions">
              <button
                type="submit"
                disabled={saving}
              >
                {saving
                  ? 'Saving...'
                  : editingExpenseId === null
                    ? 'Save Expense'
                    : 'Update Expense'}
              </button>

              {editingExpenseId !== null && (
                <button
                  type="button"
                  className="expenses-cancel"
                  onClick={resetForm}
                  disabled={saving}
                >
                  Cancel Edit
                </button>
              )}
            </div>
          </form>
        </section>

        <section className="expenses-card">
          <div className="expenses-card-header">
            <h2>Expense History</h2>
            <p className="expenses-card-description">
              Review expenses by date range or category.
            </p>
          </div>

          <div className="expenses-summary">
            <article className="expenses-summary-card">
              <div className="expenses-summary-label">
                Total Expenses
              </div>

              <div className="expenses-summary-value due">
                INR {formatMoney(totalExpenses)}
              </div>

              <div className="expenses-summary-subtext">
                {filteredExpenses.length} entries
              </div>
            </article>

            <article className="expenses-summary-card">
              <div className="expenses-summary-label">
                Cash + UPI
              </div>

              <div className="expenses-summary-value">
                INR{' '}
                {formatMoney(
                  paymentTotals.CASH +
                    paymentTotals.UPI,
                )}
              </div>

              <div className="expenses-summary-subtext">
                Cash INR {formatMoney(paymentTotals.CASH)}
                {' · '}
                UPI INR {formatMoney(paymentTotals.UPI)}
              </div>
            </article>

            <article className="expenses-summary-card">
              <div className="expenses-summary-label">
                Bank + Card
              </div>

              <div className="expenses-summary-value">
                INR{' '}
                {formatMoney(
                  paymentTotals.BANK_TRANSFER +
                    paymentTotals.CARD,
                )}
              </div>

              <div className="expenses-summary-subtext">
                Bank INR{' '}
                {formatMoney(paymentTotals.BANK_TRANSFER)}
                {' · '}
                Card INR {formatMoney(paymentTotals.CARD)}
              </div>
            </article>
          </div>

          <div className="expenses-filters">
            <div className="expenses-filter">
              <label htmlFor="expenses-from-date">
                From Date
              </label>

              <input
                id="expenses-from-date"
                type="date"
                value={filterFromDate}
                max={getTodayValue()}
                onChange={(event) =>
                  setFilterFromDate(
                    event.target.value,
                  )
                }
              />
            </div>

            <div className="expenses-filter">
              <label htmlFor="expenses-to-date">
                To Date
              </label>

              <input
                id="expenses-to-date"
                type="date"
                value={filterToDate}
                max={getTodayValue()}
                onChange={(event) =>
                  setFilterToDate(
                    event.target.value,
                  )
                }
              />
            </div>

            <div className="expenses-filter">
              <label htmlFor="expenses-filter-category">
                Category
              </label>

              <select
                id="expenses-filter-category"
                value={filterCategory}
                onChange={(event) =>
                  setFilterCategory(
                    event.target.value,
                  )
                }
              >
                <option value="">
                  All categories
                </option>

                {expenseCategories.map(
                  (expenseCategory) => (
                    <option
                      key={expenseCategory}
                      value={expenseCategory}
                    >
                      {expenseCategory}
                    </option>
                  ),
                )}
              </select>
            </div>
          </div>

          <div className="expenses-filter-actions">
            <button
              type="button"
              className="expenses-clear-filters"
              onClick={() => {
                setFilterFromDate('');
                setFilterToDate('');
                setFilterCategory('');
              }}
            >
              Clear Filters
            </button>
          </div>

          <p className="expenses-count">
            Showing {filteredExpenses.length} of{' '}
            {expenses.length} expenses
          </p>

          {filteredExpenses.length === 0 ? (
            <div className="expenses-empty">
              No expenses found for the selected filters.
            </div>
          ) : (
            <div className="expenses-table-wrapper">
              <table className="expenses-table">
                <thead>
                  <tr>
                    <th>Date &amp; Time</th>
                    <th>Category</th>
                    <th>Amount</th>
                    <th>Payment Method</th>
                    <th>Notes</th>
                    <th>Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredExpenses.map((expense) => (
                    <tr key={expense.id}>
                      <td>
                        {formatDateTime(
                          expense.expense_date,
                        )}
                      </td>

                      <td>
                        <div className="expense-category">
                          {expense.category}
                        </div>
                      </td>

                      <td className="expense-amount">
                        INR {formatMoney(expense.amount)}
                      </td>

                      <td className="expense-method">
                        {formatPaymentMethod(
                          expense.payment_method,
                        )}
                      </td>

                      <td>
                        {expense.notes ? (
                          <div className="expense-notes">
                            {expense.notes}
                          </div>
                        ) : (
                          '—'
                        )}
                      </td>

                      <td className="expense-actions-cell">
                        <button
                          type="button"
                          className="expense-row-button"
                          onClick={() =>
                            startEditing(expense)
                          }
                          disabled={
                            deletingId === expense.id
                          }
                        >
                          Edit
                        </button>

                        <button
                          type="button"
                          className="expense-row-button expense-delete-button"
                          onClick={() =>
                            void handleDelete(expense)
                          }
                          disabled={
                            deletingId === expense.id
                          }
                        >
                          {deletingId === expense.id
                            ? 'Deleting...'
                            : 'Delete'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </>
  );
}

export default Expenses;
