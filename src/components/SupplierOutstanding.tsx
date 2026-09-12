import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';

type Supplier = {
  id: number;
  name: string;
  phone: string | null;
  address: string | null;
};

type SupplierTransaction = {
  supplier_id: number;
  transaction_type:
    | 'OPENING_BALANCE'
    | 'PURCHASE'
    | 'PAYMENT'
    | 'ADJUSTMENT';
  amount: number;
  transaction_date: string;
};

type SupplierBalance = Supplier & {
  openingBalance: number;
  totalPurchases: number;
  totalPaid: number;
  adjustments: number;
  outstanding: number;
};

function SupplierOutstanding() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [transactions, setTransactions] = useState<
    SupplierTransaction[]
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

    const [suppliersResult, transactionsResult] =
      await Promise.all([
        supabase
          .from('suppliers')
          .select('id, name, phone, address')
          .eq('is_active', true)
          .order('name'),

        supabase
          .from('supplier_transactions')
          .select(
            'supplier_id, transaction_type, amount, transaction_date',
          )
          .order('transaction_date'),
      ]);

    if (suppliersResult.error) {
      console.error(
        'Failed to load suppliers:',
        suppliersResult.error,
      );
      setErrorMessage(suppliersResult.error.message);
    }

    if (transactionsResult.error) {
      console.error(
        'Failed to load supplier transactions:',
        transactionsResult.error,
      );
      setErrorMessage(transactionsResult.error.message);
    }

    setSuppliers(suppliersResult.data ?? []);

    setTransactions(
      (transactionsResult.data ?? []).map((transaction) => ({
        ...transaction,
        amount: Number(transaction.amount),
      })),
    );

    setLoading(false);
  }

  const balances = useMemo<SupplierBalance[]>(() => {
    return suppliers
      .map((supplier) => {
        const supplierTransactions = transactions.filter(
          (transaction) =>
            transaction.supplier_id === supplier.id,
        );

        const openingBalance = supplierTransactions
          .filter(
            (transaction) =>
              transaction.transaction_type ===
              'OPENING_BALANCE',
          )
          .reduce(
            (sum, transaction) => sum + transaction.amount,
            0,
          );

        const totalPurchases = supplierTransactions
          .filter(
            (transaction) =>
              transaction.transaction_type === 'PURCHASE',
          )
          .reduce(
            (sum, transaction) => sum + transaction.amount,
            0,
          );

        const totalPaid = supplierTransactions
          .filter(
            (transaction) =>
              transaction.transaction_type === 'PAYMENT',
          )
          .reduce(
            (sum, transaction) => sum + transaction.amount,
            0,
          );

        const adjustments = supplierTransactions
          .filter(
            (transaction) =>
              transaction.transaction_type === 'ADJUSTMENT',
          )
          .reduce(
            (sum, transaction) => sum + transaction.amount,
            0,
          );

        const outstanding =
          openingBalance +
          totalPurchases +
          adjustments -
          totalPaid;

        return {
          ...supplier,
          openingBalance,
          totalPurchases,
          totalPaid,
          adjustments,
          outstanding,
        };
      })
      .filter((supplier) => supplier.outstanding !== 0);
  }, [suppliers, transactions]);

  const filteredBalances = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    if (!normalizedSearch) {
      return balances;
    }

    return balances.filter((supplier) => {
      return (
        supplier.name
          .toLowerCase()
          .includes(normalizedSearch) ||
        (supplier.phone ?? '').includes(normalizedSearch) ||
        (supplier.address ?? '')
          .toLowerCase()
          .includes(normalizedSearch)
      );
    });
  }, [balances, search]);

  const totalOutstanding = filteredBalances.reduce(
    (sum, supplier) => sum + supplier.outstanding,
    0,
  );

  if (loading) {
    return <p>Loading supplier balances...</p>;
  }

  return (
    <main>
      <h1>Supplier Outstanding</h1>

      <p>
        Total Payable: INR{' '}
        {totalOutstanding.toLocaleString('en-IN')}
      </p>

      {errorMessage && <p>{errorMessage}</p>}

      <input
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder="Search supplier, phone or address"
      />

      {filteredBalances.length === 0 ? (
        <p>No outstanding supplier balances.</p>
      ) : (
        <div>
          {filteredBalances.map((supplier) => (
            <article key={supplier.id}>
              <h2>{supplier.name}</h2>

              {supplier.phone && (
                <p>
                  <strong>Phone:</strong> {supplier.phone}
                </p>
              )}

              {supplier.address && (
                <p>
                  <strong>Address:</strong> {supplier.address}
                </p>
              )}

              <p>
                <strong>Opening Balance:</strong> INR{' '}
                {supplier.openingBalance.toLocaleString('en-IN')}
              </p>

              <p>
                <strong>Total Purchases:</strong> INR{' '}
                {supplier.totalPurchases.toLocaleString('en-IN')}
              </p>

              <p>
                <strong>Total Paid:</strong> INR{' '}
                {supplier.totalPaid.toLocaleString('en-IN')}
              </p>

              <p>
                <strong>Adjustments:</strong> INR{' '}
                {supplier.adjustments.toLocaleString('en-IN')}
              </p>

              <p>
                <strong>Outstanding:</strong> INR{' '}
                {supplier.outstanding.toLocaleString('en-IN')}
              </p>
            </article>
          ))}
        </div>
      )}
    </main>
  );
}

export default SupplierOutstanding;