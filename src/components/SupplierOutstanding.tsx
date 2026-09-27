import {
  useEffect,
  useMemo,
  useState,
} from 'react';
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
  const [suppliers, setSuppliers] =
    useState<Supplier[]>([]);

  const [transactions, setTransactions] =
    useState<SupplierTransaction[]>([]);

  const [search, setSearch] =
    useState('');

  const [loading, setLoading] =
    useState(true);

  const [errorMessage, setErrorMessage] =
    useState('');

  useEffect(() => {
    void loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    setErrorMessage('');

    const [
      suppliersResult,
      transactionsResult,
    ] = await Promise.all([
      supabase
        .from('suppliers')
        .select(
          'id, name, phone, address',
        )
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

      setErrorMessage(
        suppliersResult.error.message,
      );
    }

    if (transactionsResult.error) {
      console.error(
        'Failed to load supplier transactions:',
        transactionsResult.error,
      );

      setErrorMessage(
        transactionsResult.error.message,
      );
    }

    setSuppliers(
      suppliersResult.data ?? [],
    );

    setTransactions(
      (
        transactionsResult.data ?? []
      ).map((transaction) => ({
        ...transaction,
        amount: Number(
          transaction.amount,
        ),
      })),
    );

    setLoading(false);
  }

  const balances =
    useMemo<SupplierBalance[]>(
      () => {
        return suppliers
          .map((supplier) => {
            const supplierTransactions =
              transactions.filter(
                (transaction) =>
                  transaction.supplier_id ===
                  supplier.id,
              );

            const openingBalance =
              supplierTransactions
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

            const totalPurchases =
              supplierTransactions
                .filter(
                  (transaction) =>
                    transaction.transaction_type ===
                    'PURCHASE',
                )
                .reduce(
                  (sum, transaction) =>
                    sum + transaction.amount,
                  0,
                );

            const totalPaid =
              supplierTransactions
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

            const adjustments =
              supplierTransactions
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
          .filter(
            (supplier) =>
              supplier.outstanding > 0,
          );
      },
      [suppliers, transactions],
    );

  const filteredBalances =
    useMemo(() => {
      const normalizedSearch =
        search
          .trim()
          .toLowerCase();

      if (!normalizedSearch) {
        return balances;
      }

      return balances.filter(
        (supplier) =>
          supplier.name
            .toLowerCase()
            .includes(
              normalizedSearch,
            ) ||
          (
            supplier.phone ?? ''
          ).includes(
            normalizedSearch,
          ) ||
          (
            supplier.address ?? ''
          )
            .toLowerCase()
            .includes(
              normalizedSearch,
            ),
      );
    }, [balances, search]);

  const totalOutstanding =
    filteredBalances.reduce(
      (sum, supplier) =>
        sum + supplier.outstanding,
      0,
    );

  const totalPurchases =
    filteredBalances.reduce(
      (sum, supplier) =>
        sum + supplier.totalPurchases,
      0,
    );

  function formatMoney(
    value: number,
  ) {
    return value.toLocaleString(
      'en-IN',
    );
  }

  if (loading) {
    return (
      <p>
        Loading supplier balances...
      </p>
    );
  }

  return (
    <>
      <style>
        {`
          .supplier-outstanding-page {
            width: 100%;
            max-width: 1200px;
            margin: 0 auto;
          }

          .supplier-outstanding-header {
            margin-bottom: 20px;
          }

          .supplier-outstanding-header h1 {
            margin-bottom: 5px;
          }

          .supplier-outstanding-description {
            color: #667085;
            font-size: 14px;
          }

          .supplier-outstanding-error {
            margin-bottom: 16px;
            padding: 11px 13px;
            border: 1px solid #fecaca;
            border-radius: 8px;
            background: #fef2f2;
            color: #dc2626;
            font-size: 14px;
          }

          .supplier-outstanding-summary {
            display: grid;
            grid-template-columns:
              repeat(3, minmax(0, 1fr));
            gap: 12px;
            margin-bottom: 20px;
          }

          .supplier-outstanding-summary-card {
            padding: 17px;
            background: #ffffff;
            border: 1px solid #e4e7ec;
            border-radius: 12px;
            box-shadow:
              0 1px 2px rgba(16, 24, 40, 0.05);
          }

          .supplier-outstanding-summary-label {
            color: #667085;
            font-size: 12px;
            font-weight: 600;
          }

          .supplier-outstanding-summary-value {
            margin-top: 5px;
            color: #101828;
            font-size: 23px;
            line-height: 1.2;
            font-weight: 700;
          }

          .supplier-outstanding-summary-value.due {
            color: #b45309;
          }

          .supplier-outstanding-search {
            width: 100%;
            min-height: 42px;
            box-sizing: border-box;
            margin-bottom: 10px;
            padding: 9px 12px;
            border: 1px solid #d0d5dd;
            border-radius: 6px;
            background: #ffffff;
            color: #101828;
            font-size: 14px;
          }

          .supplier-outstanding-search:focus {
            outline: none;
            border-color: #2563eb;
            box-shadow:
              0 0 0 3px rgba(37, 99, 235, 0.12);
          }

          .supplier-outstanding-count {
            margin-bottom: 14px;
            color: #667085;
            font-size: 13px;
          }

          .supplier-balance-grid {
            display: grid;
            grid-template-columns:
              repeat(
                auto-fill,
                minmax(300px, 1fr)
              );
            gap: 16px;
          }

          .supplier-balance-card {
            background: #ffffff;
            border: 1px solid #e4e7ec;
            border-radius: 12px;
            box-shadow:
              0 1px 2px rgba(16, 24, 40, 0.05);
            overflow: hidden;
          }

          .supplier-balance-card-header {
            display: flex;
            align-items: flex-start;
            justify-content: space-between;
            gap: 12px;
            padding: 17px 18px;
            border-bottom: 1px solid #e4e7ec;
            background: #f9fafb;
          }

          .supplier-balance-card-header h2 {
            margin: 0;
            font-size: 18px;
            line-height: 1.3;
          }

          .supplier-badge {
            flex: 0 0 auto;
            padding: 4px 8px;
            border-radius: 999px;
            background: #eff6ff;
            color: #1d4ed8;
            font-size: 10px;
            font-weight: 700;
          }

          .supplier-balance-contact {
            padding: 14px 18px 4px;
          }

          .supplier-balance-contact p {
            margin-bottom: 6px;
            color: #667085;
            font-size: 13px;
          }

          .supplier-balance-contact strong {
            color: #344054;
          }

          .supplier-balance-breakdown {
            display: grid;
            grid-template-columns:
              repeat(2, minmax(0, 1fr));
            gap: 10px;
            padding: 12px 18px;
          }

          .supplier-balance-item {
            padding: 10px;
            border: 1px solid #eaecf0;
            border-radius: 8px;
            background: #fcfcfd;
          }

          .supplier-balance-item-label {
            color: #667085;
            font-size: 11px;
            font-weight: 600;
          }

          .supplier-balance-item-value {
            margin-top: 3px;
            color: #101828;
            font-size: 14px;
            font-weight: 650;
          }

          .supplier-balance-main {
            margin: 4px 18px 18px;
            padding: 14px;
            border: 1px solid #fde68a;
            border-radius: 10px;
            background: #fffbeb;
          }

          .supplier-balance-main-label {
            color: #92400e;
            font-size: 12px;
            font-weight: 600;
          }

          .supplier-balance-main-value {
            margin-top: 3px;
            color: #b45309;
            font-size: 22px;
            font-weight: 750;
          }

          .supplier-balance-empty {
            padding: 32px 20px;
            text-align: center;
            background: #ffffff;
            border: 1px solid #e4e7ec;
            border-radius: 12px;
            color: #667085;
          }

          @media (max-width: 900px) {
            .supplier-outstanding-summary {
              grid-template-columns:
                repeat(2, minmax(0, 1fr));
            }
          }

          @media (max-width: 600px) {
            .supplier-outstanding-summary {
              grid-template-columns: 1fr;
            }

            .supplier-balance-grid {
              grid-template-columns: 1fr;
            }

            .supplier-balance-card-header {
              padding: 15px;
            }

            .supplier-balance-contact {
              padding: 14px 15px 4px;
            }

            .supplier-balance-breakdown {
              padding-left: 15px;
              padding-right: 15px;
            }

            .supplier-balance-main {
              margin-left: 15px;
              margin-right: 15px;
            }

            .supplier-outstanding-summary-value {
              font-size: 20px;
            }
          }
        `}
      </style>

      <main className="supplier-outstanding-page">
        <div className="supplier-outstanding-header">
          <h1>
            Supplier Outstanding
          </h1>

          <p className="supplier-outstanding-description">
            View suppliers we currently owe
            money to, including purchase and
            payment history.
          </p>
        </div>

        {errorMessage && (
          <div className="supplier-outstanding-error">
            {errorMessage}
          </div>
        )}

        <section className="supplier-outstanding-summary">
          <article className="supplier-outstanding-summary-card">
            <div className="supplier-outstanding-summary-label">
              Total Payable
            </div>

            <div className="supplier-outstanding-summary-value due">
              INR{' '}
              {formatMoney(
                totalOutstanding,
              )}
            </div>
          </article>

          <article className="supplier-outstanding-summary-card">
            <div className="supplier-outstanding-summary-label">
              Suppliers Owing
            </div>

            <div className="supplier-outstanding-summary-value">
              {filteredBalances.length}
            </div>
          </article>

          <article className="supplier-outstanding-summary-card">
            <div className="supplier-outstanding-summary-label">
              Total Purchases
            </div>

            <div className="supplier-outstanding-summary-value">
              INR{' '}
              {formatMoney(
                totalPurchases,
              )}
            </div>
          </article>
        </section>

        <input
          className="supplier-outstanding-search"
          value={search}
          onChange={(event) =>
            setSearch(
              event.target.value,
            )
          }
          placeholder="Search supplier, phone or address"
        />

        <p className="supplier-outstanding-count">
          Showing{' '}
          {filteredBalances.length}{' '}
          of {balances.length}{' '}
          suppliers owing money
        </p>

        {filteredBalances.length === 0 ? (
          <div className="supplier-balance-empty">
            No outstanding supplier
            balances found.
          </div>
        ) : (
          <div className="supplier-balance-grid">
            {filteredBalances.map(
              (supplier) => (
                <article
                  key={supplier.id}
                  className="supplier-balance-card"
                >
                  <div className="supplier-balance-card-header">
                    <h2>
                      {supplier.name}
                    </h2>

                    <span className="supplier-badge">
                      SUPPLIER
                    </span>
                  </div>

                  <div className="supplier-balance-contact">
                    {supplier.phone && (
                      <p>
                        <strong>
                          Phone:
                        </strong>{' '}
                        {supplier.phone}
                      </p>
                    )}

                    {supplier.address && (
                      <p>
                        <strong>
                          Address:
                        </strong>{' '}
                        {supplier.address}
                      </p>
                    )}
                  </div>

                  <div className="supplier-balance-breakdown">
                    <div className="supplier-balance-item">
                      <div className="supplier-balance-item-label">
                        Opening Balance
                      </div>

                      <div className="supplier-balance-item-value">
                        INR{' '}
                        {formatMoney(
                          supplier.openingBalance,
                        )}
                      </div>
                    </div>

                    <div className="supplier-balance-item">
                      <div className="supplier-balance-item-label">
                        Total Purchases
                      </div>

                      <div className="supplier-balance-item-value">
                        INR{' '}
                        {formatMoney(
                          supplier.totalPurchases,
                        )}
                      </div>
                    </div>

                    <div className="supplier-balance-item">
                      <div className="supplier-balance-item-label">
                        Payments Made
                      </div>

                      <div className="supplier-balance-item-value">
                        INR{' '}
                        {formatMoney(
                          supplier.totalPaid,
                        )}
                      </div>
                    </div>

                    <div className="supplier-balance-item">
                      <div className="supplier-balance-item-label">
                        Adjustments
                      </div>

                      <div className="supplier-balance-item-value">
                        INR{' '}
                        {formatMoney(
                          supplier.adjustments,
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="supplier-balance-main">
                    <div className="supplier-balance-main-label">
                      Outstanding
                    </div>

                    <div className="supplier-balance-main-value">
                      INR{' '}
                      {formatMoney(
                        supplier.outstanding,
                      )}
                    </div>
                  </div>
                </article>
              ),
            )}
          </div>
        )}
      </main>
    </>
  );
}

export default SupplierOutstanding;