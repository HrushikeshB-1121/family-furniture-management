import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { supabase } from '../lib/supabase';

type Customer = {
  id: number;
  name: string;
  contact_person: string | null;
  phone: string | null;
  customer_type:
    | 'INDIVIDUAL'
    | 'SHOP';
};

type CustomerTransaction = {
  id: number;
  customer_id: number;
  transaction_type:
    | 'OPENING_BALANCE'
    | 'SALE'
    | 'PAYMENT'
    | 'ADJUSTMENT';
  amount: number;
  sale_id: number | null;
  transaction_date: string;
  payment_method: string | null;
  notes: string | null;
};

type Sale = {
  id: number;
  customer_id: number | null;
  total_amount: number;
  paid_now: number;
  sale_date: string;
  payment_method: string | null;
};

type CustomerBalance =
  Customer & {
    openingBalance: number;
    totalSales: number;
    paidAtSale: number;
    totalLaterPaid: number;
    adjustments: number;
    outstanding: number;
  };

type CustomerHistoryEntry = {
  id: string;
  transactionDate: string;
  typeLabel: string;
  reference: string;
  delta: number;
  paymentMethod: string | null;
  notes: string | null;
};

function CustomerOutstanding() {
  const [customers, setCustomers] =
    useState<Customer[]>([]);

  const [transactions, setTransactions] =
    useState<
      CustomerTransaction[]
    >([]);

  const [sales, setSales] =
    useState<Sale[]>([]);

  const [search, setSearch] =
    useState('');

  const [historyCustomerId, setHistoryCustomerId] =
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
        .from(
          'customer_transactions',
        )
        .select(
          'id, customer_id, transaction_type, amount, sale_id, transaction_date, payment_method, notes',
        )
        .order(
          'transaction_date',
        ),

      supabase
        .from('sales')
        .select(
          'id, customer_id, total_amount, paid_now, sale_date, payment_method',
        ),
    ]);

    if (customersResult.error) {
      console.error(
        'Failed to load customers:',
        customersResult.error,
      );

      setErrorMessage(
        customersResult.error.message,
      );
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

      setErrorMessage(
        salesResult.error.message,
      );
    }

    setCustomers(
      customersResult.data ?? [],
    );

    setTransactions(
      (
        transactionsResult.data ??
        []
      ).map(
        (transaction) => ({
          ...transaction,
          id: Number(
            transaction.id,
          ),
          amount: Number(
            transaction.amount,
          ),
          sale_id:
            transaction.sale_id !==
            null
              ? Number(
                  transaction.sale_id,
                )
              : null,
        }),
      ),
    );

    setSales(
      (
        salesResult.data ??
        []
      ).map((sale) => ({
        ...sale,
        id: Number(
          sale.id,
        ),
        total_amount:
          Number(
            sale.total_amount,
          ),
        paid_now:
          Number(
            sale.paid_now,
          ),
      })),
    );

    setLoading(false);
  }

  const balances =
    useMemo<
      CustomerBalance[]
    >(() => {
      return customers
        .map((customer) => {
          const customerTransactions =
            transactions.filter(
              (transaction) =>
                transaction.customer_id ===
                customer.id,
            );

          const customerSales =
            sales.filter(
              (sale) =>
                sale.customer_id ===
                customer.id,
            );

          const totalSales =
            customerSales.reduce(
              (
                sum,
                sale,
              ) =>
                sum +
                sale.total_amount,
              0,
            );

          const paidAtSale =
            customerSales.reduce(
              (
                sum,
                sale,
              ) =>
                sum +
                sale.paid_now,
              0,
            );

          const totalLaterPaid =
            customerTransactions
              .filter(
                (
                  transaction,
                ) =>
                  transaction.transaction_type ===
                  'PAYMENT',
              )
              .reduce(
                (
                  sum,
                  transaction,
                ) =>
                  sum +
                  transaction.amount,
                0,
              );

          const openingBalance =
            customerTransactions
              .filter(
                (
                  transaction,
                ) =>
                  transaction.transaction_type ===
                  'OPENING_BALANCE',
              )
              .reduce(
                (
                  sum,
                  transaction,
                ) =>
                  sum +
                  transaction.amount,
                0,
              );

          const adjustments =
            customerTransactions
              .filter(
                (
                  transaction,
                ) =>
                  transaction.transaction_type ===
                  'ADJUSTMENT',
              )
              .reduce(
                (
                  sum,
                  transaction,
                ) =>
                  sum +
                  transaction.amount,
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
          (customer) =>
            customer.outstanding > 0,
        );
    }, [
      customers,
      transactions,
      sales,
    ]);

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
        (customer) =>
          customer.name
            .toLowerCase()
            .includes(
              normalizedSearch,
            ) ||
          (
            customer.contact_person ??
            ''
          )
            .toLowerCase()
            .includes(
              normalizedSearch,
            ) ||
          (
            customer.phone ??
            ''
          ).includes(
            normalizedSearch,
          ),
      );
    }, [
      balances,
      search,
    ]);

  const selectedHistoryCustomer =
    useMemo(() => {
      return customers.find(
        (customer) =>
          String(customer.id) ===
          historyCustomerId,
      ) ?? null;
    }, [
      customers,
      historyCustomerId,
    ]);

  useEffect(() => {
    if (!historyCustomerId) {
      return;
    }

    const animationFrame =
      window.requestAnimationFrame(() => {
        historySectionRef.current?.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
        });
      });

    return () =>
      window.cancelAnimationFrame(
        animationFrame,
      );
  }, [historyCustomerId]);

  const selectedCustomerTransactions =
    useMemo(() => {
      if (!selectedHistoryCustomer) {
        return [];
      }

      return transactions.filter(
        (transaction) =>
          transaction.customer_id ===
          selectedHistoryCustomer.id,
      );
    }, [
      selectedHistoryCustomer,
      transactions,
    ]);

  const selectedCustomerSales =
    useMemo(() => {
      if (!selectedHistoryCustomer) {
        return [];
      }

      return sales.filter(
        (sale) =>
          sale.customer_id ===
          selectedHistoryCustomer.id,
      );
    }, [
      selectedHistoryCustomer,
      sales,
    ]);

  const historyEntries =
    useMemo<CustomerHistoryEntry[]>(() => {
      if (!selectedHistoryCustomer) {
        return [];
      }

      const saleById =
        new Map(
          selectedCustomerSales.map(
            (sale) => [
              sale.id,
              sale,
            ],
          ),
        );

      const paymentSaleIds =
        new Set(
          selectedCustomerTransactions
            .filter(
              (transaction) =>
                transaction.transaction_type ===
                  'PAYMENT' &&
                transaction.sale_id !==
                  null,
            )
            .map(
              (transaction) =>
                transaction.sale_id,
            ),
        );

      const entries: Array<
        CustomerHistoryEntry & {
          sortOrder: number;
        }
      > = [];

      for (const transaction of
        selectedCustomerTransactions) {
        if (
          transaction.transaction_type ===
          'SALE'
        ) {
          const sale =
            transaction.sale_id !== null
              ? saleById.get(
                  transaction.sale_id,
                )
              : undefined;

          const saleAmount =
            sale?.total_amount ??
            transaction.amount;

          entries.push({
            id: `sale-${transaction.id}`,
            transactionDate:
              transaction.transaction_date,
            typeLabel: 'Sale',
            reference:
              transaction.sale_id !==
              null
                ? `Bill #${transaction.sale_id}`
                : 'Sale',
            delta: saleAmount,
            paymentMethod:
              sale?.payment_method ??
              null,
            notes:
              transaction.notes,
            sortOrder: 10,
          });

          const paidAtSale =
            sale?.paid_now ?? 0;

          if (
            paidAtSale > 0 &&
            (
              transaction.sale_id ===
                null ||
              !paymentSaleIds.has(
                transaction.sale_id,
              )
            )
          ) {
            entries.push({
              id: `sale-payment-${transaction.id}`,
              transactionDate:
                transaction.transaction_date,
              typeLabel:
                'Payment at Sale',
              reference:
                transaction.sale_id !==
                null
                  ? `Bill #${transaction.sale_id}`
                  : 'Payment',
              delta:
                -paidAtSale,
              paymentMethod:
                sale?.payment_method ??
                null,
              notes: null,
              sortOrder: 20,
            });
          }

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
            typeLabel:
              'Payment',
            reference: `Pay #${transaction.id}`,
            delta:
              -transaction.amount,
            paymentMethod:
              transaction.payment_method,
            notes:
              transaction.notes,
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
            typeLabel:
              'Opening Balance',
            reference:
              'Opening Balance',
            delta:
              transaction.amount,
            paymentMethod: null,
            notes:
              transaction.notes,
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
            typeLabel:
              'Adjustment',
            reference:
              'Adjustment',
            delta:
              transaction.amount,
            paymentMethod: null,
            notes:
              transaction.notes,
            sortOrder: 40,
          });
        }
      }

      entries.sort(
        (a, b) => {
          const dateDifference =
            new Date(
              a.transactionDate,
            ).getTime() -
            new Date(
              b.transactionDate,
            ).getTime();

          if (
            dateDifference !==
            0
          ) {
            return dateDifference;
          }

          return (
            a.sortOrder -
            b.sortOrder
          );
        },
      );

      return entries.map(
        (entry) => entry,
      );
    }, [
      selectedHistoryCustomer,
      selectedCustomerTransactions,
      selectedCustomerSales,
    ]);

  const historyEndingBalance =
    historyEntries.reduce(
      (
        balance,
        entry,
      ) =>
        balance +
        entry.delta,
      0,
    );

  const totalOutstanding =
    filteredBalances.reduce(
      (
        sum,
        customer,
      ) =>
        sum +
        customer.outstanding,
      0,
    );

  const retailCustomers =
    filteredBalances.filter(
      (customer) =>
        customer.customer_type ===
        'INDIVIDUAL',
    ).length;

  const wholesaleCustomers =
    filteredBalances.filter(
      (customer) =>
        customer.customer_type ===
        'SHOP',
    ).length;

  function formatMoney(
    value: number,
  ) {
    return Math.abs(value).toLocaleString(
      'en-IN',
    );
  }

  function formatSignedMoney(
    value: number,
  ) {
    if (value > 0) {
      return `+INR ${formatMoney(
        value,
      )}`;
    }

    if (value < 0) {
      return `-INR ${formatMoney(
        value,
      )}`;
    }

    return 'INR 0';
  }

  function formatDateTime(
    value: string,
  ) {
    return new Date(
      value,
    ).toLocaleString(
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

  function handleHistoryClick(
    customerId: number,
  ) {
    const nextCustomerId =
      String(customerId);

    setHistoryCustomerId(
      historyCustomerId ===
        nextCustomerId
        ? ''
        : nextCustomerId,
    );
  }

  if (loading) {
    return (
      <p>
        Loading customer balances...
      </p>
    );
  }

  return (
    <>
      <style>
        {`
          .customer-outstanding-page {
            width: 100%;
            max-width: 1200px;
            margin: 0 auto;
          }

          .customer-outstanding-header {
            margin-bottom: 20px;
          }

          .customer-outstanding-header h1 {
            margin-bottom: 5px;
          }

          .customer-outstanding-description {
            color: #667085;
            font-size: 14px;
          }

          .customer-outstanding-error {
            margin-bottom: 16px;
            padding: 11px 13px;
            border: 1px solid #fecaca;
            border-radius: 8px;
            background: #fef2f2;
            color: #dc2626;
            font-size: 14px;
          }

          .outstanding-summary {
            display: grid;
            grid-template-columns:
              repeat(3, minmax(0, 1fr));
            gap: 12px;
            margin-bottom: 20px;
          }

          .outstanding-summary-card {
            padding: 17px;
            background: #ffffff;
            border: 1px solid #e4e7ec;
            border-radius: 12px;
            box-shadow:
              0 1px 2px rgba(16, 24, 40, 0.05);
          }

          .outstanding-summary-label {
            color: #667085;
            font-size: 12px;
            font-weight: 600;
          }

          .outstanding-summary-value {
            margin-top: 5px;
            color: #101828;
            font-size: 23px;
            line-height: 1.2;
            font-weight: 700;
          }

          .outstanding-summary-value.due {
            color: #b45309;
          }

          .customer-outstanding-search {
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

          .customer-outstanding-search:focus {
            outline: none;
            border-color: #2563eb;
            box-shadow:
              0 0 0 3px rgba(37, 99, 235, 0.12);
          }

          .customer-outstanding-count {
            margin-bottom: 14px;
            color: #667085;
            font-size: 13px;
          }

          .balance-grid {
            display: grid;
            grid-template-columns:
              repeat(
                auto-fill,
                minmax(300px, 1fr)
              );
            gap: 16px;
          }

          .balance-card {
            background: #ffffff;
            border: 1px solid #e4e7ec;
            border-radius: 12px;
            box-shadow:
              0 1px 2px rgba(16, 24, 40, 0.05);
            overflow: hidden;
          }

          .balance-card-header {
            display: flex;
            align-items: flex-start;
            justify-content: space-between;
            gap: 12px;
            padding: 17px 18px;
            border-bottom: 1px solid #e4e7ec;
            background: #f9fafb;
          }

          .balance-card-header h2 {
            margin: 0;
            font-size: 18px;
            line-height: 1.3;
          }

          .customer-type-badge {
            flex: 0 0 auto;
            padding: 4px 8px;
            border-radius: 999px;
            background: #eff6ff;
            color: #1d4ed8;
            font-size: 10px;
            font-weight: 700;
          }

          .balance-contact {
            padding: 14px 18px 4px;
          }

          .balance-contact p {
            margin-bottom: 6px;
            color: #667085;
            font-size: 13px;
          }

          .balance-contact strong {
            color: #344054;
          }

          .balance-breakdown {
            display: grid;
            grid-template-columns:
              repeat(2, minmax(0, 1fr));
            gap: 10px;
            padding: 12px 18px;
          }

          .balance-item {
            padding: 10px;
            border: 1px solid #eaecf0;
            border-radius: 8px;
            background: #fcfcfd;
          }

          .balance-item-label {
            color: #667085;
            font-size: 11px;
            font-weight: 600;
          }

          .balance-item-value {
            margin-top: 3px;
            color: #101828;
            font-size: 14px;
            font-weight: 650;
          }

          .balance-main {
            margin: 4px 18px 12px;
            padding: 14px;
            border: 1px solid #fde68a;
            border-radius: 10px;
            background: #fffbeb;
          }

          .balance-main-label {
            color: #92400e;
            font-size: 12px;
            font-weight: 600;
          }

          .balance-main-value {
            margin-top: 3px;
            color: #b45309;
            font-size: 22px;
            font-weight: 750;
          }

          .balance-actions {
            padding: 0 18px 18px;
          }

          .history-button {
            width: 100%;
            min-height: 40px;
            padding: 8px 12px;
            border: 1px solid #d0d5dd;
            border-radius: 8px;
            background: #ffffff;
            color: #175cd3;
            font-size: 13px;
            font-weight: 700;
            cursor: pointer;
          }

          .history-button:hover {
            background: #eff6ff;
            border-color: #93c5fd;
          }

          .history-button:focus {
            outline: none;
            border-color: #2563eb;
            box-shadow:
              0 0 0 3px rgba(37, 99, 235, 0.12);
          }

          .balance-empty {
            padding: 32px 20px;
            text-align: center;
            background: #ffffff;
            border: 1px solid #e4e7ec;
            border-radius: 12px;
            color: #667085;
          }

          .customer-history-section {
            margin-top: 28px;
            scroll-margin-top: 24px;
            margin-bottom: 20px;
            padding: 20px;
            background: #ffffff;
            border: 1px solid #e4e7ec;
            border-radius: 14px;
            box-shadow:
              0 1px 2px rgba(16, 24, 40, 0.05);
          }

          .customer-history-header {
            display: flex;
            align-items: flex-start;
            justify-content: space-between;
            gap: 16px;
            margin-bottom: 16px;
          }

          .customer-history-header h2 {
            margin-bottom: 5px;
          }

          .customer-history-description {
            color: #667085;
            font-size: 14px;
          }

          .customer-history-close {
            flex: 0 0 auto;
            min-height: 36px;
            padding: 7px 11px;
            border: 1px solid #d0d5dd;
            border-radius: 7px;
            background: #ffffff;
            color: #344054;
            font-size: 12px;
            font-weight: 650;
            cursor: pointer;
          }

          .customer-history-close:hover {
            background: #f9fafb;
          }

          .customer-history-summary {
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

          .customer-history-customer-name {
            color: #101828;
            font-weight: 700;
          }

          .customer-history-current-balance {
            color: #667085;
            font-size: 13px;
          }

          .customer-history-current-balance strong {
            color: #b45309;
            font-size: 15px;
          }

          .customer-history-table-wrapper {
            width: 100%;
            overflow-x: auto;
            -webkit-overflow-scrolling: touch;
            border: 1px solid #e4e7ec;
            border-radius: 10px;
          }

          .customer-history-table {
            width: 100%;
            min-width: 780px;
            border-collapse: collapse;
          }

          .customer-history-table th,
          .customer-history-table td {
            padding: 11px 12px;
            border-bottom: 1px solid #eaecf0;
            text-align: left;
            vertical-align: top;
            font-size: 13px;
          }

          .customer-history-table th {
            background: #f9fafb;
            color: #344054;
            font-size: 12px;
            font-weight: 700;
          }

          .customer-history-table tbody tr:last-child td {
            border-bottom: 0;
          }

          .history-type {
            color: #101828;
            font-weight: 650;
          }

          .history-reference {
            margin-top: 2px;
            color: #667085;
            font-size: 12px;
          }

          .history-notes {
            margin-top: 3px;
            color: #98a2b3;
            font-size: 11px;
          }

          .history-amount {
            white-space: nowrap;
            font-weight: 650;
          }

          .history-amount.credit {
            color: #b45309;
          }

          .history-amount.payment {
            color: #15803d;
          }

          .history-balance {
            white-space: nowrap;
            color: #101828;
            font-weight: 700;
          }

          .history-method {
            color: #667085;
            white-space: nowrap;
          }

          .customer-history-final-balance {
            margin-top: 14px;
            padding: 14px;
            border: 1px solid #bfdbfe;
            border-radius: 10px;
            background: #eff6ff;
          }

          .customer-history-final-balance-label {
            color: #1e40af;
            font-size: 12px;
            font-weight: 600;
          }

          .customer-history-final-balance-value {
            margin-top: 3px;
            color: #1e3a8a;
            font-size: 21px;
            font-weight: 750;
          }

          @media (max-width: 900px) {
            .outstanding-summary {
              grid-template-columns:
                repeat(2, minmax(0, 1fr));
            }
          }

          @media (max-width: 600px) {
            .outstanding-summary {
              grid-template-columns: 1fr;
            }

            .balance-grid {
              grid-template-columns: 1fr;
            }

            .balance-card-header {
              padding: 15px;
            }

            .balance-contact {
              padding: 14px 15px 4px;
            }

            .balance-breakdown {
              padding-left: 15px;
              padding-right: 15px;
            }

            .balance-main {
              margin-left: 15px;
              margin-right: 15px;
            }

            .balance-actions {
              padding-left: 15px;
              padding-right: 15px;
            }

            .outstanding-summary-value {
              font-size: 20px;
            }

            .customer-history-section {
              padding: 16px;
            }

            .customer-history-header,
            .customer-history-summary {
              align-items: flex-start;
              flex-direction: column;
            }

            .customer-history-close {
              width: 100%;
            }
          }
        `}
      </style>

      <main className="customer-outstanding-page">
        <div className="customer-outstanding-header">
          <h1>
            Customer Outstanding
          </h1>

          <p className="customer-outstanding-description">
            View customers who currently owe
            money, including their payment
            history and outstanding amounts.
          </p>
        </div>

        {errorMessage && (
          <div className="customer-outstanding-error">
            {errorMessage}
          </div>
        )}

        <section className="outstanding-summary">
          <article className="outstanding-summary-card">
            <div className="outstanding-summary-label">
              Total Outstanding
            </div>

            <div className="outstanding-summary-value due">
              INR{' '}
              {formatMoney(
                totalOutstanding,
              )}
            </div>
          </article>

          <article className="outstanding-summary-card">
            <div className="outstanding-summary-label">
              Customers Owing
            </div>

            <div className="outstanding-summary-value">
              {
                filteredBalances.length
              }
            </div>
          </article>

          <article className="outstanding-summary-card">
            <div className="outstanding-summary-label">
              Retail / Wholesale
            </div>

            <div className="outstanding-summary-value">
              {retailCustomers}{' '}
              /{' '}
              {wholesaleCustomers}
            </div>
          </article>
        </section>

        <input
          className="customer-outstanding-search"
          value={search}
          onChange={(event) =>
            setSearch(
              event.target.value,
            )
          }
          placeholder="Search customer, shop, contact or phone"
        />

        <p className="customer-outstanding-count">
          Showing{' '}
          {
            filteredBalances.length
          }{' '}
          of {balances.length}{' '}
          customers owing money
        </p>

        {filteredBalances.length ===
        0 ? (
          <div className="balance-empty">
            No outstanding customer
            balances found.
          </div>
        ) : (
          <div className="balance-grid">
            {filteredBalances.map(
              (customer) => {
                const isHistoryOpen =
                  historyCustomerId ===
                  String(customer.id);

                return (
                  <article
                    key={
                      customer.id
                    }
                    className="balance-card"
                  >
                    <div className="balance-card-header">
                      <h2>
                        {
                          customer.name
                        }
                      </h2>

                      <span className="customer-type-badge">
                        {customer.customer_type ===
                        'SHOP'
                          ? 'WHOLESALE'
                          : 'RETAIL'}
                      </span>
                    </div>

                    <div className="balance-contact">
                      {customer.contact_person && (
                        <p>
                          <strong>
                            Contact:
                          </strong>{' '}
                          {
                            customer.contact_person
                          }
                        </p>
                      )}

                      {customer.phone && (
                        <p>
                          <strong>
                            Phone:
                          </strong>{' '}
                          {
                            customer.phone
                          }
                        </p>
                      )}
                    </div>

                    <div className="balance-breakdown">
                      <div className="balance-item">
                        <div className="balance-item-label">
                          Opening Balance
                        </div>

                        <div className="balance-item-value">
                          INR{' '}
                          {
                            formatMoney(
                              customer.openingBalance,
                            )
                          }
                        </div>
                      </div>

                      <div className="balance-item">
                        <div className="balance-item-label">
                          Total Sales
                        </div>

                        <div className="balance-item-value">
                          INR{' '}
                          {
                            formatMoney(
                              customer.totalSales,
                            )
                          }
                        </div>
                      </div>

                      <div className="balance-item">
                        <div className="balance-item-label">
                          Paid at Sale
                        </div>

                        <div className="balance-item-value">
                          INR{' '}
                          {
                            formatMoney(
                              customer.paidAtSale,
                            )
                          }
                        </div>
                      </div>

                      <div className="balance-item">
                        <div className="balance-item-label">
                          Payments After Sale
                        </div>

                        <div className="balance-item-value">
                          INR{' '}
                          {
                            formatMoney(
                              customer.totalLaterPaid,
                            )
                          }
                        </div>
                      </div>

                      <div className="balance-item">
                        <div className="balance-item-label">
                          Adjustments
                        </div>

                        <div className="balance-item-value">
                          INR{' '}
                          {
                            formatMoney(
                              customer.adjustments,
                            )
                          }
                        </div>
                      </div>
                    </div>

                    <div className="balance-main">
                      <div className="balance-main-label">
                        Outstanding
                      </div>

                      <div className="balance-main-value">
                        INR{' '}
                        {
                          formatMoney(
                            customer.outstanding,
                          )
                        }
                      </div>
                    </div>

                    <div className="balance-actions">
                      <button
                        type="button"
                        className="history-button"
                        onClick={() =>
                          handleHistoryClick(
                            customer.id,
                          )
                        }
                      >
                        {isHistoryOpen
                          ? 'Hide History'
                          : 'History'}
                      </button>
                    </div>
                  </article>
                );
              },
            )}
          </div>
        )}

        {selectedHistoryCustomer && (
          <section
            ref={historySectionRef}
            className="customer-history-section"
          >
            <div className="customer-history-header">
              <div>
                <h2>
                  {selectedHistoryCustomer.name}{' '}
                  — History / Ledger
                </h2>

                <p className="customer-history-description">
                  Complete chronological account
                  history for this customer.
                </p>
              </div>

              <button
                type="button"
                className="customer-history-close"
                onClick={() =>
                  setHistoryCustomerId('')
                }
              >
                Hide History
              </button>
            </div>

            <div className="customer-history-summary">
              <div>
                <div className="customer-history-customer-name">
                  {
                    selectedHistoryCustomer.name
                  }
                </div>

                <div className="customer-history-current-balance">
                  Current Outstanding:{' '}
                  <strong>
                    INR{' '}
                    {formatMoney(
                      historyEndingBalance,
                    )}
                  </strong>
                </div>
              </div>

              <div className="customer-history-current-balance">
                {
                  selectedHistoryCustomer.customer_type ===
                  'SHOP'
                    ? 'WHOLESALE'
                    : 'RETAIL'
                }
              </div>
            </div>

            {historyEntries.length ===
            0 ? (
              <div className="balance-empty">
                No account transactions found for
                this customer.
              </div>
            ) : (
              <>
                <div className="customer-history-table-wrapper">
                  <table className="customer-history-table">
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
                        let runningBalance =
                          0;

                        return historyEntries.map(
                          (
                            entry,
                          ) => {
                            runningBalance +=
                              entry.delta;

                            return (
                              <tr
                                key={
                                  entry.id
                                }
                              >
                                <td>
                                  {
                                    formatDateTime(
                                      entry.transactionDate,
                                    )
                                  }
                                </td>

                                <td>
                                  <div className="history-type">
                                    {
                                      entry.typeLabel
                                    }
                                  </div>
                                </td>

                                <td>
                                  <div className="history-type">
                                    {
                                      entry.reference
                                    }
                                  </div>

                                  {entry.notes && (
                                    <div className="history-notes">
                                      {
                                        entry.notes
                                      }
                                    </div>
                                  )}
                                </td>

                                <td
                                  className={`history-amount ${
                                    entry.delta <
                                    0
                                      ? 'payment'
                                      : 'credit'
                                  }`}
                                >
                                  {
                                    formatSignedMoney(
                                      entry.delta,
                                    )
                                  }
                                </td>

                                <td className="history-method">
                                  {
                                    entry.paymentMethod ===
                                    'BANK_TRANSFER'
                                      ? 'Bank Transfer'
                                      : entry.paymentMethod ===
                                          'CASH'
                                        ? 'Cash'
                                        : entry.paymentMethod ===
                                            'UPI'
                                          ? 'UPI'
                                          : entry.paymentMethod ===
                                              'CARD'
                                            ? 'Card'
                                            : entry.paymentMethod ??
                                              '—'
                                  }
                                </td>

                                <td className="history-balance">
                                  INR{' '}
                                  {
                                    formatMoney(
                                      runningBalance,
                                    )
                                  }
                                </td>
                              </tr>
                            );
                          },
                        );
                      })()}
                    </tbody>
                  </table>
                </div>

                <div className="customer-history-final-balance">
                  <div className="customer-history-final-balance-label">
                    Current Outstanding
                  </div>

                  <div className="customer-history-final-balance-value">
                    INR{' '}
                    {
                      formatMoney(
                        historyEndingBalance,
                      )
                    }
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

export default CustomerOutstanding;
