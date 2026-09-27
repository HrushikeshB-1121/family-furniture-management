import {
  useEffect,
  useMemo,
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

type CustomerBalance =
  Customer & {
    openingBalance: number;
    totalSales: number;
    paidAtSale: number;
    totalLaterPaid: number;
    adjustments: number;
    outstanding: number;
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
          'customer_id, transaction_type, amount, sale_id, transaction_date',
        )
        .order(
          'transaction_date',
        ),

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
    return value.toLocaleString(
      'en-IN',
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
            margin: 4px 18px 18px;
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

          .balance-empty {
            padding: 32px 20px;
            text-align: center;
            background: #ffffff;
            border: 1px solid #e4e7ec;
            border-radius: 12px;
            color: #667085;
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

            .outstanding-summary-value {
              font-size: 20px;
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
              (customer) => (
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
                </article>
              ),
            )}
          </div>
        )}
      </main>
    </>
  );
}

export default CustomerOutstanding;