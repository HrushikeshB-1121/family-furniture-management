import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

type Supplier = {
  id: number;
  name: string;
};

type Customer = {
  id: number;
  name: string;
  phone: string | null;
};

type Balance = {
  id: number;
  name: string;
  balance: number;
};

function Payments() {
  const [mode, setMode] = useState<'SUPPLIER' | 'CUSTOMER'>(
    'SUPPLIER',
  );

  const [supplierBalances, setSupplierBalances] = useState<
    Balance[]
  >([]);

  const [customerBalances, setCustomerBalances] = useState<
    Balance[]
  >([]);

  const [partyId, setPartyId] = useState('');
  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [notes, setNotes] = useState('');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    void loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    setErrorMessage('');

    const [
      suppliersResult,
      customersResult,
      supplierTransactionsResult,
      customerTransactionsResult,
    ] = await Promise.all([
      supabase
        .from('suppliers')
        .select('id, name')
        .eq('is_active', true)
        .order('name'),

      supabase
        .from('customers')
        .select('id, name, phone')
        .eq('is_active', true)
        .order('name'),

      supabase
        .from('supplier_transactions')
        .select('supplier_id, transaction_type, amount'),

      supabase
        .from('customer_transactions')
        .select('customer_id, transaction_type, amount'),
    ]);

    if (suppliersResult.error) {
      setErrorMessage(suppliersResult.error.message);
    }

    if (customersResult.error) {
      setErrorMessage(customersResult.error.message);
    }

    if (supplierTransactionsResult.error) {
      setErrorMessage(
        supplierTransactionsResult.error.message,
      );
    }

    if (customerTransactionsResult.error) {
      setErrorMessage(
        customerTransactionsResult.error.message,
      );
    }

    const supplierList: Supplier[] = suppliersResult.data ?? [];
    const customerList: Customer[] = customersResult.data ?? [];

    const calculatedSupplierBalances =
      calculateSupplierBalances(
        supplierList,
        supplierTransactionsResult.data ?? [],
      );

    const calculatedCustomerBalances =
      calculateCustomerBalances(
        customerList,
        customerTransactionsResult.data ?? [],
      );

    setSupplierBalances(calculatedSupplierBalances);
    setCustomerBalances(calculatedCustomerBalances);

    setLoading(false);
  }

  function calculateSupplierBalances(
    supplierList: Supplier[],
    transactions: Array<{
      supplier_id: number;
      transaction_type: string;
      amount: number;
    }>,
  ): Balance[] {
    return supplierList
      .map((supplier) => {
        let balance = 0;

        transactions
          .filter(
            (transaction) =>
              transaction.supplier_id === supplier.id,
          )
          .forEach((transaction) => {
            const value = Number(transaction.amount);

            if (
              transaction.transaction_type ===
                'OPENING_BALANCE' ||
              transaction.transaction_type === 'PURCHASE'
            ) {
              balance += value;
            }

            if (
              transaction.transaction_type === 'PAYMENT'
            ) {
              balance -= value;
            }

            if (
              transaction.transaction_type ===
              'ADJUSTMENT'
            ) {
              balance += value;
            }
          });

        return {
          id: supplier.id,
          name: supplier.name,
          balance,
        };
      })
      .filter((supplier) => supplier.balance > 0);
  }

  function calculateCustomerBalances(
    customerList: Customer[],
    transactions: Array<{
      customer_id: number;
      transaction_type: string;
      amount: number;
    }>,
  ): Balance[] {
    return customerList
      .map((customer) => {
        let balance = 0;

        transactions
          .filter(
            (transaction) =>
              transaction.customer_id === customer.id,
          )
          .forEach((transaction) => {
            const value = Number(transaction.amount);

            if (
              transaction.transaction_type ===
                'OPENING_BALANCE' ||
              transaction.transaction_type === 'SALE'
            ) {
              balance += value;
            }

            if (
              transaction.transaction_type === 'PAYMENT'
            ) {
              balance -= value;
            }

            if (
              transaction.transaction_type ===
              'ADJUSTMENT'
            ) {
              balance += value;
            }
          });

        return {
          id: customer.id,
          name: customer.name,
          balance,
        };
      })
      .filter((customer) => customer.balance > 0);
  }

  function changeMode(
    newMode: 'SUPPLIER' | 'CUSTOMER',
  ) {
    setMode(newMode);
    setPartyId('');
    setAmount('');
    setPaymentMethod('');
    setNotes('');
    setMessage('');
    setErrorMessage('');
  }

  const availableParties =
    mode === 'SUPPLIER'
      ? supplierBalances
      : customerBalances;

  async function handleSubmit(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    setMessage('');
    setErrorMessage('');

    if (!partyId) {
      setErrorMessage(
        mode === 'SUPPLIER'
          ? 'Select a supplier.'
          : 'Select a customer.',
      );
      return;
    }

    const paymentAmount = Number(amount);

    if (
      !Number.isFinite(paymentAmount) ||
      paymentAmount <= 0
    ) {
      setErrorMessage(
        'Payment amount must be greater than 0.',
      );
      return;
    }

    const selectedBalance = availableParties.find(
      (party) => String(party.id) === partyId,
    );

    if (!selectedBalance) {
      setErrorMessage('Selected party was not found.');
      return;
    }

    if (paymentAmount > selectedBalance.balance) {
      setErrorMessage(
        `Payment cannot be greater than the current outstanding balance of INR ${selectedBalance.balance.toLocaleString(
          'en-IN',
        )}.`,
      );
      return;
    }

    if (!paymentMethod) {
      setErrorMessage('Select a payment method.');
      return;
    }

    setSaving(true);

    try {
      if (mode === 'SUPPLIER') {
        const { error } = await supabase
          .from('supplier_transactions')
          .insert({
            supplier_id: Number(partyId),
            transaction_type: 'PAYMENT',
            amount: paymentAmount,
            transaction_date: new Date().toISOString(),
            payment_method: paymentMethod,
            notes: notes.trim() || null,
          });

        if (error) {
          throw error;
        }

        setMessage(
          `Supplier payment of INR ${paymentAmount.toLocaleString(
            'en-IN',
          )} recorded successfully.`,
        );
      } else {
        const { error } = await supabase
          .from('customer_transactions')
          .insert({
            customer_id: Number(partyId),
            transaction_type: 'PAYMENT',
            amount: paymentAmount,
            transaction_date: new Date().toISOString(),
            payment_method: paymentMethod,
            notes: notes.trim() || null,
          });

        if (error) {
          throw error;
        }

        setMessage(
          `Customer payment of INR ${paymentAmount.toLocaleString(
            'en-IN',
          )} recorded successfully.`,
        );
      }

      setPartyId('');
      setAmount('');
      setPaymentMethod('');
      setNotes('');

      await loadData();
    } catch (error) {
      console.error('Failed to record payment:', error);

      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Failed to record payment.',
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <p>Loading payments...</p>;
  }

  return (
    <main>
      <h1>Payments</h1>

      <div>
        <button
          type="button"
          onClick={() => changeMode('SUPPLIER')}
        >
          Pay Supplier
        </button>

        <button
          type="button"
          onClick={() => changeMode('CUSTOMER')}
        >
          Collect Customer Payment
        </button>
      </div>

      <h2>
        {mode === 'SUPPLIER'
          ? 'Pay Supplier'
          : 'Collect Customer Payment'}
      </h2>

      <form onSubmit={handleSubmit}>
        <div>
          <label htmlFor="party">
            {mode === 'SUPPLIER'
              ? 'Supplier'
              : 'Customer'}
          </label>

          <select
            id="party"
            value={partyId}
            onChange={(event) =>
              setPartyId(event.target.value)
            }
          >
            <option value="">
              Select{' '}
              {mode === 'SUPPLIER'
                ? 'supplier'
                : 'customer'}
            </option>

            {availableParties.map((party) => (
              <option key={party.id} value={party.id}>
                {party.name} — Due INR{' '}
                {party.balance.toLocaleString('en-IN')}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="amount">Amount</label>

          <input
            id="amount"
            type="number"
            min="0.01"
            step="0.01"
            value={amount}
            onChange={(event) =>
              setAmount(event.target.value)
            }
            placeholder="Payment amount"
          />
        </div>

        <div>
          <label htmlFor="paymentMethod">
            Payment Method
          </label>

          <select
            id="paymentMethod"
            value={paymentMethod}
            onChange={(event) =>
              setPaymentMethod(event.target.value)
            }
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
            <option value="OTHER">Other</option>
          </select>
        </div>

        <div>
          <label htmlFor="notes">Notes</label>

          <textarea
            id="notes"
            value={notes}
            onChange={(event) =>
              setNotes(event.target.value)
            }
            rows={3}
            placeholder="Optional notes"
          />
        </div>

        <button type="submit" disabled={saving}>
          {saving ? 'Saving...' : 'Save Payment'}
        </button>
      </form>

      {message && <p>{message}</p>}
      {errorMessage && <p>{errorMessage}</p>}
    </main>
  );
}

export default Payments;