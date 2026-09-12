import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';

type Customer = {
  id: number;
  name: string;
  contact_person: string | null;
  phone: string | null;
  customer_type: 'INDIVIDUAL' | 'SHOP';
};

type CustomerTransaction = {
  customer_id: number;
  transaction_type:
    | 'OPENING_BALANCE'
    | 'SALE'
    | 'PAYMENT'
    | 'ADJUSTMENT';
  amount: number;
  transaction_date: string;
};

type CustomerBalance = Customer & {
  totalSales: number;
  totalPaid: number;
  openingBalance: number;
  adjustments: number;
  outstanding: number;
};

function CustomerOutstanding() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [transactions, setTransactions] = useState<
    CustomerTransaction[]
  >([]);

  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    void loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    setErrorMessage('');

    const [customersResult, transactionsResult] =
      await Promise.all([
        supabase
          .from('customers')
          .select(
            'id, name, contact_person, phone, customer_type',
          )
          .eq('is_active', true)
          .order('name'),

        supabase
          .from('customer_transactions')
          .select(
            'customer_id, transaction_type, amount, transaction_date',
          )
          .order('transaction_date'),
      ]);

    if (customersResult.error) {
      console.error(customersResult.error);
      setErrorMessage(customersResult.error.message);
    }

    if (transactionsResult.error) {
      console.error(transactionsResult.error);
      setErrorMessage(transactionsResult.error.message);
    }

    setCustomers(customersResult.data ?? []);

    setTransactions(
      (transactionsResult.data ?? []).map((transaction) => ({
        ...transaction,
        amount: Number(transaction.amount),
      })),
    );

    setLoading(false);
  }

  const balances = useMemo<CustomerBalance[]>(() => {
    return customers
      .map((customer) => {
        const customerTransactions = transactions.filter(
          (transaction) =>
            transaction.customer_id === customer.id,
        );

        const totalSales = customerTransactions
          .filter(
            (transaction) =>
              transaction.transaction_type === 'SALE',
          )
          .reduce((sum, transaction) => sum + transaction.amount, 0);

        const totalPaid = customerTransactions
          .filter(
            (transaction) =>
              transaction.transaction_type === 'PAYMENT',
          )
          .reduce((sum, transaction) => sum + transaction.amount, 0);

        const openingBalance = customerTransactions
          .filter(
            (transaction) =>
              transaction.transaction_type ===
              'OPENING_BALANCE',
          )
          .reduce((sum, transaction) => sum + transaction.amount, 0);

        const adjustments = customerTransactions
          .filter(
            (transaction) =>
              transaction.transaction_type === 'ADJUSTMENT',
          )
          .reduce((sum, transaction) => sum + transaction.amount, 0);

        const outstanding =
          openingBalance +
          totalSales +
          adjustments -
          totalPaid;

        return {
          ...customer,
          totalSales,
          totalPaid,
          openingBalance,
          adjustments,
          outstanding,
        };
      })
      .filter((customer) => customer.outstanding !== 0);
  }, [customers, transactions]);

  const filteredBalances = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    if (!normalizedSearch) {
      return balances;
    }

    return balances.filter((customer) => {
      return (
        customer.name.toLowerCase().includes(normalizedSearch) ||
        (customer.contact_person ?? '')
          .toLowerCase()
          .includes(normalizedSearch) ||
        (customer.phone ?? '').includes(normalizedSearch)
      );
    });
  }, [balances, search]);

  const totalOutstanding = filteredBalances.reduce(
    (sum, customer) => sum + customer.outstanding,
    0,
  );

  if (loading) {
    return <p>Loading customer balances...</p>;
  }

  return (
    <main>
      <h1>Customer Outstanding</h1>

      <p>
        Total Outstanding: INR{' '}
        {totalOutstanding.toLocaleString('en-IN')}
      </p>

      {errorMessage && <p>{errorMessage}</p>}

      <input
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder="Search customer, shop, owner or phone"
      />

      {filteredBalances.length === 0 ? (
        <p>No outstanding customer balances.</p>
      ) : (
        <div>
          {filteredBalances.map((customer) => (
            <article key={customer.id}>
              <h2>{customer.name}</h2>

              <p>
                <strong>Type:</strong>{' '}
                {customer.customer_type === 'SHOP'
                  ? 'Shop'
                  : 'Individual'}
              </p>

              {customer.contact_person && (
                <p>
                  <strong>Contact:</strong>{' '}
                  {customer.contact_person}
                </p>
              )}

              {customer.phone && (
                <p>
                  <strong>Phone:</strong> {customer.phone}
                </p>
              )}

              <p>
                <strong>Total Sales:</strong> INR{' '}
                {customer.totalSales.toLocaleString('en-IN')}
              </p>

              <p>
                <strong>Total Paid:</strong> INR{' '}
                {customer.totalPaid.toLocaleString('en-IN')}
              </p>

              <p>
                <strong>Outstanding:</strong> INR{' '}
                {customer.outstanding.toLocaleString('en-IN')}
              </p>
            </article>
          ))}
        </div>
      )}
    </main>
  );
}

export default CustomerOutstanding;