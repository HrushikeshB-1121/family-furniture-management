import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { supabase } from '../lib/supabase';

type Supplier = {
  id: number;
  name: string;
  phone: string | null;
  address: string | null;
  is_active: boolean;
};

type SupplierTransaction = {
  id: number;
  supplier_id: number;
  transaction_type:
    | 'OPENING_BALANCE'
    | 'PURCHASE'
    | 'PAYMENT'
    | 'ADJUSTMENT';
  amount: number;
  purchase_id: number | null;
  transaction_date: string;
  payment_method: string | null;
  notes: string | null;
};

type SupplierBalance = Supplier & {
  openingBalance: number;
  totalPurchases: number;
  totalPaid: number;
  adjustments: number;
  outstanding: number;
};

type SupplierHistoryEntry = {
  id: string;
  transactionDate: string;
  typeLabel: string;
  reference: string;
  delta: number;
  paymentMethod: string | null;
  notes: string | null;
};

function SupplierOutstanding() {
  const [suppliers, setSuppliers] =
    useState<Supplier[]>([]);

  const [transactions, setTransactions] =
    useState<SupplierTransaction[]>([]);

  const [search, setSearch] =
    useState('');

  const [historySupplierId, setHistorySupplierId] =
    useState('');

  const historySectionRef =
    useRef<HTMLElement | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [errorMessage, setErrorMessage] =
    useState('');

  useEffect(() => {
    void loadData();
  }, []);

  useEffect(() => {
    if (!historySupplierId) {
      return;
    }

    requestAnimationFrame(() => {
      historySectionRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    });
  }, [historySupplierId]);

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
          'id, name, phone, address, is_active',
        )
        .order('name'),

      supabase
        .from('supplier_transactions')
        .select(
          'id, supplier_id, transaction_type, amount, purchase_id, transaction_date, payment_method, notes',
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
        id: Number(transaction.id),
        supplier_id: Number(
          transaction.supplier_id,
        ),
        amount: Number(
          transaction.amount,
        ),
        purchase_id:
          transaction.purchase_id !== null
            ? Number(
                transaction.purchase_id,
              )
            : null,
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

  const selectedHistorySupplier =
    useMemo(() => {
      return (
        suppliers.find(
          (supplier) =>
            String(supplier.id) ===
            historySupplierId,
        ) ?? null
      );
    }, [
      suppliers,
      historySupplierId,
    ]);

  const selectedSupplierTransactions =
    useMemo(() => {
      if (!selectedHistorySupplier) {
        return [];
      }

      return transactions.filter(
        (transaction) =>
          transaction.supplier_id ===
          selectedHistorySupplier.id,
      );
    }, [
      selectedHistorySupplier,
      transactions,
    ]);

  const historyEntries =
    useMemo<SupplierHistoryEntry[]>(() => {
      if (!selectedHistorySupplier) {
        return [];
      }

      const entries: Array<
        SupplierHistoryEntry & {
          sortOrder: number;
        }
      > = [];

      for (const transaction of
        selectedSupplierTransactions) {
        if (
          transaction.transaction_type ===
          'PURCHASE'
        ) {
          entries.push({
            id: `purchase-${transaction.id}`,
            transactionDate:
              transaction.transaction_date,
            typeLabel: 'Purchase',
            reference:
              transaction.purchase_id !== null
                ? `Purchase #${transaction.purchase_id}`
                : 'Purchase',
            delta: transaction.amount,
            paymentMethod: null,
            notes: transaction.notes,
            sortOrder: 10,
          });

          continue;
        }

        if (
          transaction.transaction_type ===
          'PAYMENT'
        ) {
          entries.push({
            id: `payment-${transaction.id}`,
            transactionDate:
              transaction.transaction_date,
            typeLabel: 'Payment',
            reference:
              transaction.purchase_id !== null
                ? `Payment for Purchase #${transaction.purchase_id}`
                : `Pay #${transaction.id}`,
            delta: -transaction.amount,
            paymentMethod:
              transaction.payment_method,
            notes: transaction.notes,
            sortOrder: 30,
          });

          continue;
        }

        if (
          transaction.transaction_type ===
          'OPENING_BALANCE'
        ) {
          entries.push({
            id: `opening-${transaction.id}`,
            transactionDate:
              transaction.transaction_date,
            typeLabel: 'Opening Balance',
            reference: 'Opening Balance',
            delta: transaction.amount,
            paymentMethod: null,
            notes: transaction.notes,
            sortOrder: 5,
          });

          continue;
        }

        if (
          transaction.transaction_type ===
          'ADJUSTMENT'
        ) {
          entries.push({
            id: `adjustment-${transaction.id}`,
            transactionDate:
              transaction.transaction_date,
            typeLabel: 'Adjustment',
            reference: 'Adjustment',
            delta: transaction.amount,
            paymentMethod: null,
            notes: transaction.notes,
            sortOrder: 40,
          });
        }
      }

      entries.sort((a, b) => {
        const dateDifference =
          new Date(
            a.transactionDate,
          ).getTime() -
          new Date(
            b.transactionDate,
          ).getTime();

        if (dateDifference !== 0) {
          return dateDifference;
        }

        return a.sortOrder - b.sortOrder;
      });

      return entries.map((entry) => ({
        id: entry.id,
        transactionDate:
          entry.transactionDate,
        typeLabel: entry.typeLabel,
        reference: entry.reference,
        delta: entry.delta,
        paymentMethod:
          entry.paymentMethod,
        notes: entry.notes,
      }));
    }, [
      selectedHistorySupplier,
      selectedSupplierTransactions,
    ]);

  const historyEndingBalance =
    historyEntries.reduce(
      (balance, entry) =>
        balance + entry.delta,
      0,
    );

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

  function formatMoney(value: number) {
    return Math.abs(value).toLocaleString(
      'en-IN',
    );
  }

  function formatSignedMoney(value: number) {
    if (value > 0) {
      return `+INR ${formatMoney(value)}`;
    }

    if (value < 0) {
      return `-INR ${formatMoney(value)}`;
    }

    return 'INR 0';
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
    value: string | null,
  ) {
    if (value === 'BANK_TRANSFER') {
      return 'Bank Transfer';
    }

    if (value === 'CASH') {
      return 'Cash';
    }

    if (value === 'UPI') {
      return 'UPI';
    }

    if (value === 'CARD') {
      return 'Card';
    }

    return value ?? '—';
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

          .supplier-outstanding-search:focus,
          .supplier-history-search:focus {
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
            margin: 4px 18px 8px;
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

          .supplier-history-button {
            width: calc(100% - 36px);
            min-height: 40px;
            margin: 0 18px 18px;
            padding: 9px 12px;
            border: 1px solid #d0d5dd;
            border-radius: 8px;
            background: #ffffff;
            color: #344054;
            font-size: 14px;
            font-weight: 650;
            cursor: pointer;
          }

          .supplier-history-button:hover {
            background: #f9fafb;
            border-color: #98a2b3;
          }

          .supplier-history-button:focus-visible {
            outline: none;
            border-color: #2563eb;
            box-shadow:
              0 0 0 3px rgba(37, 99, 235, 0.12);
          }

          .supplier-history-section {
            scroll-margin-top: 24px;
            margin-top: 30px;
            margin-bottom: 20px;
            padding: 20px;
            background: #ffffff;
            border: 1px solid #e4e7ec;
            border-radius: 14px;
            box-shadow:
              0 1px 2px rgba(16, 24, 40, 0.05);
          }

          .supplier-history-header {
            margin-bottom: 16px;
          }

          .supplier-history-header h2 {
            margin-bottom: 5px;
          }

          .supplier-history-description {
            color: #667085;
            font-size: 14px;
          }

          .supplier-history-summary {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
            margin-bottom: 14px;
            padding: 12px 14px;
            border: 1px solid #e4e7ec;
            border-radius: 10px;
            background: #f9fafb;
          }

          .supplier-history-supplier-name {
            color: #101828;
            font-weight: 700;
          }

          .supplier-history-current-balance {
            color: #667085;
            font-size: 13px;
          }

          .supplier-history-current-balance strong {
            color: #b45309;
            font-size: 15px;
          }

          .supplier-history-table-wrapper {
            width: 100%;
            overflow-x: auto;
            -webkit-overflow-scrolling: touch;
            border: 1px solid #e4e7ec;
            border-radius: 10px;
          }

          .supplier-history-table {
            width: 100%;
            min-width: 780px;
            border-collapse: collapse;
          }

          .supplier-history-table th,
          .supplier-history-table td {
            padding: 11px 12px;
            border-bottom: 1px solid #eaecf0;
            text-align: left;
            vertical-align: top;
            font-size: 13px;
          }

          .supplier-history-table th {
            background: #f9fafb;
            color: #344054;
            font-size: 12px;
            font-weight: 700;
          }

          .supplier-history-table tbody tr:last-child td {
            border-bottom: 0;
          }

          .supplier-history-type {
            color: #101828;
            font-weight: 650;
          }

          .supplier-history-notes {
            margin-top: 3px;
            color: #98a2b3;
            font-size: 11px;
          }

          .supplier-history-amount {
            white-space: nowrap;
            font-weight: 650;
          }

          .supplier-history-amount.credit {
            color: #b45309;
          }

          .supplier-history-amount.payment {
            color: #15803d;
          }

          .supplier-history-balance {
            white-space: nowrap;
            color: #101828;
            font-weight: 700;
          }

          .supplier-history-method {
            color: #667085;
            white-space: nowrap;
          }

          .supplier-history-final-balance {
            margin-top: 14px;
            padding: 14px;
            border: 1px solid #bfdbfe;
            border-radius: 10px;
            background: #eff6ff;
          }

          .supplier-history-final-balance-label {
            color: #1e40af;
            font-size: 12px;
            font-weight: 600;
          }

          .supplier-history-final-balance-value {
            margin-top: 3px;
            color: #1e3a8a;
            font-size: 21px;
            font-weight: 750;
          }

          .supplier-history-empty {
            padding: 28px 20px;
            text-align: center;
            border: 1px dashed #d0d5dd;
            border-radius: 10px;
            background: #fcfcfd;
            color: #667085;
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

            .supplier-history-button {
              width: calc(100% - 30px);
              margin-left: 15px;
              margin-right: 15px;
            }

            .supplier-outstanding-summary-value {
              font-size: 20px;
            }

            .supplier-history-section {
              padding: 16px;
            }

            .supplier-history-summary {
              align-items: flex-start;
              flex-direction: column;
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
              (supplier) => {
                const isHistoryOpen =
                  historySupplierId ===
                  String(supplier.id);

                return (
                  <article
                    key={supplier.id}
                    className="supplier-balance-card"
                  >
                    <div className="supplier-balance-card-header">
                      <h2>
                        {supplier.name}
                        {!supplier.is_active && ' (Inactive)'}
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

                    <button
                      type="button"
                      className="supplier-history-button"
                      aria-expanded={
                        isHistoryOpen
                      }
                      onClick={() =>
                        setHistorySupplierId(
                          isHistoryOpen
                            ? ''
                            : String(
                                supplier.id,
                              ),
                        )
                      }
                    >
                      {isHistoryOpen
                        ? 'Hide History'
                        : 'History'}
                    </button>
                  </article>
                );
              },
            )}
          </div>
        )}

        {selectedHistorySupplier && (
          <section
            ref={historySectionRef}
            className="supplier-history-section"
          >
            <div className="supplier-history-header">
              <h2>
                {selectedHistorySupplier.name}{' '}
                — History / Ledger
              </h2>

              <p className="supplier-history-description">
                Complete chronological account
                history for this supplier.
              </p>
            </div>

            <div className="supplier-history-summary">
              <div>
                <div className="supplier-history-supplier-name">
                  {selectedHistorySupplier.name}
                </div>

                <div className="supplier-history-current-balance">
                  Current Payable:{' '}
                  <strong>
                    INR{' '}
                    {formatMoney(
                      historyEndingBalance,
                    )}
                  </strong>
                </div>
              </div>

              <div className="supplier-history-current-balance">
                SUPPLIER
              </div>
            </div>

            {historyEntries.length === 0 ? (
              <div className="supplier-history-empty">
                No account transactions found
                for this supplier.
              </div>
            ) : (
              <>
                <div className="supplier-history-table-wrapper">
                  <table className="supplier-history-table">
                    <thead>
                      <tr>
                        <th>
                          Date &amp; Time
                        </th>

                        <th>
                          Type
                        </th>

                        <th>
                          Reference
                        </th>

                        <th>
                          Amount
                        </th>

                        <th>
                          Method
                        </th>

                        <th>
                          Running Balance
                        </th>
                      </tr>
                    </thead>

                    <tbody>
                      {(() => {
                        let runningBalance = 0;

                        return historyEntries.map(
                          (entry) => {
                            runningBalance +=
                              entry.delta;

                            return (
                              <tr
                                key={
                                  entry.id
                                }
                              >
                                <td>
                                  {formatDateTime(
                                    entry.transactionDate,
                                  )}
                                </td>

                                <td>
                                  <div className="supplier-history-type">
                                    {
                                      entry.typeLabel
                                    }
                                  </div>
                                </td>

                                <td>
                                  <div className="supplier-history-type">
                                    {
                                      entry.reference
                                    }
                                  </div>

                                  {entry.notes && (
                                    <div className="supplier-history-notes">
                                      {
                                        entry.notes
                                      }
                                    </div>
                                  )}
                                </td>

                                <td
                                  className={`supplier-history-amount ${
                                    entry.delta <
                                    0
                                      ? 'payment'
                                      : 'credit'
                                  }`}
                                >
                                  {formatSignedMoney(
                                    entry.delta,
                                  )}
                                </td>

                                <td className="supplier-history-method">
                                  {formatPaymentMethod(
                                    entry.paymentMethod,
                                  )}
                                </td>

                                <td className="supplier-history-balance">
                                  INR{' '}
                                  {formatMoney(
                                    runningBalance,
                                  )}
                                </td>
                              </tr>
                            );
                          },
                        );
                      })()}
                    </tbody>
                  </table>
                </div>

                <div className="supplier-history-final-balance">
                  <div className="supplier-history-final-balance-label">
                    Current Payable
                  </div>

                  <div className="supplier-history-final-balance-value">
                    INR{' '}
                    {formatMoney(
                      historyEndingBalance,
                    )}
                  </div>
                </div>
              </>
            )}
          </section>
        )}
      </main>
    </>
  );
}

export default SupplierOutstanding;
