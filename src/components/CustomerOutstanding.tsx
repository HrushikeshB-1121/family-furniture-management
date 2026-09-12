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
  sale_id: number | null;
  transaction_date: string;
};

type Sale = {
  id: number;
  customer_id: number | null;
  total_amount: number;
  paid_now: number;
};

type CustomerBalance = Customer & {
  openingBalance: number;
  totalSales: number;
  paidAtSale: number;
  totalLaterPaid: number;
  adjustments: number;
  outstanding: number;
};

function CustomerOutstanding() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [transactions, setTransactions] = useState<
    CustomerTransaction[]
  >([]);
  const [sales, setSales] = useState<Sale[]>([]);

  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    void loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    setErrorMessage('');

    const [
      customersResult,
      transactionsResult,
      salesResult,
    ] = await Promise.all([
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
          'customer_id, transaction_type, amount, sale_id, transaction_date',
        )
        .order('transaction_date'),

      supabase
        .from('sales')
        .select(
          'id, customer_id, total_amount, paid_now',
        ),
    ]);

    if (customersResult.error) {
      console.error(
        'Failed to load customers:',
        customersResult.error,
      );
      setErrorMessage(customersResult.error.message);
    }

    if (transactionsResult.error) {
      console.error(
        'Failed to load customer transactions:',
        transactionsResult.error,
      );
      setErrorMessage(
        transactionsResult.error.message,
      );
    }

    if (salesResult.error) {
      console.error(
        'Failed to load sales:',
        salesResult.error,
      );
      setErrorMessage(salesResult.error.message);
    }

    setCustomers(customersResult.data ?? []);

    setTransactions(
      (transactionsResult.data ?? []).map(
        (transaction) => ({
          ...transaction,
          amount: Number(transaction.amount),
          sale_id:
            transaction.sale_id !== null
              ? Number(transaction.sale_id)
              : null,
        }),
      ),
    );

    setSales(
      (salesResult.data ?? []).map((sale) => ({
        ...sale,
        total_amount: Number(sale.total_amount),
        paid_now: Number(sale.paid_now),
      })),
    );

    setLoading(false);
  }

  const balances = useMemo<CustomerBalance[]>(() => {
    return customers
      .map((customer) => {
        const customerTransactions =
          transactions.filter(
            (transaction) =>
              transaction.customer_id === customer.id,
          );

        const customerSales = sales.filter(
          (sale) =>
            sale.customer_id === customer.id,
        );

        const totalSales = customerSales.reduce(
          (sum, sale) => sum + sale.total_amount,
          0,
        );

        const paidAtSale = customerSales.reduce(
          (sum, sale) => sum + sale.paid_now,
          0,
        );

        const totalLaterPaid =
          customerTransactions
            .filter(
              (transaction) =>
                transaction.transaction_type ===
                'PAYMENT',
            )
            .reduce(
              (sum, transaction) =>
                sum + transaction.amount,
              0,
            );

        const openingBalance =
          customerTransactions
            .filter(
              (transaction) =>
                transaction.transaction_type ===
                'OPENING_BALANCE',
            )
            .reduce(
              (sum, transaction) =>
                sum + transaction.amount,
              0,
            );

        const adjustments =
          customerTransactions
            .filter(
              (transaction) =>
                transaction.transaction_type ===
                'ADJUSTMENT',
            )
            .reduce(
              (sum, transaction) =>
                sum + transaction.amount,
              0,
            );

        const outstanding =
          openingBalance +
          totalSales +
          adjustments -
          paidAtSale -
          totalLaterPaid;

        return {
          ...customer,
          openingBalance,
          totalSales,
          paidAtSale,
          totalLaterPaid,
          adjustments,
          outstanding,
        };
      })
      .filter(
        (customer) => customer.outstanding !== 0,
      );
  }, [customers, transactions, sales]);

  const filteredBalances = useMemo(() => {
    const normalizedSearch =
      search.trim().toLowerCase();

    if (!normalizedSearch) {
      return balances;
    }

    return balances.filter((customer) => {
      return (
        customer.name
          .toLowerCase()
          .includes(normalizedSearch) ||
        (customer.contact_person ?? '')
          .toLowerCase()
          .includes(normalizedSearch) ||
        (customer.phone ?? '').includes(
          normalizedSearch,
        )
      );
    });
  }, [balances, search]);

  const totalOutstanding =
    filteredBalances.reduce(
      (sum, customer) =>
        sum + customer.outstanding,
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
        {totalOutstanding.toLocaleString(
          'en-IN',
        )}
      </p>

      {errorMessage && (
        <p>{errorMessage}</p>
      )}

      <input
        value={search}
        onChange={(event) =>
          setSearch(event.target.value)
        }
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
                {customer.customer_type ===
                'SHOP'
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
                  <strong>Phone:</strong>{' '}
                  {customer.phone}
                </p>
              )}

              <p>
                <strong>Total Sales:</strong>{' '}
                INR{' '}
                {customer.totalSales.toLocaleString(
                  'en-IN',
                )}
              </p>

              <p>
                <strong>Paid at Sale:</strong>{' '}
                INR{' '}
                {customer.paidAtSale.toLocaleString(
                  'en-IN',
                )}
              </p>

              <p>
                <strong>Later Payments:</strong>{' '}
                INR{' '}
                {customer.totalLaterPaid.toLocaleString(
                  'en-IN',
                )}
              </p>

              <p>
                <strong>Outstanding:</strong>{' '}
                INR{' '}
                {customer.outstanding.toLocaleString(
                  'en-IN',
                )}
              </p>
            </article>
          ))}
        </div>
      )}
    </main>
  );
}

export default CustomerOutstanding;