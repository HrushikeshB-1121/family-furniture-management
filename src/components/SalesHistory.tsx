import {
  useEffect,
  useMemo,
  useState,
} from 'react';
import { supabase } from '../lib/supabase';

type Customer = {
  name: string;
  phone: string | null;
};

type Location = {
  name: string;
};

type Product = {
  sku: string;
  name: string;
};

type SaleItem = {
  id: number;
  quantity: number;
  selling_price: number;
  total_amount: number;
  unit_cost: number | null;
  total_cost: number | null;
  gross_profit: number | null;
  products: Product | null;
  locations: Location | null;
};

type Sale = {
  id: number;
  sale_date: string;
  total_amount: number;
  paid_now: number;
  payment_method: string | null;
  notes: string | null;
  customers: Customer | null;
  locations: Location | null;
  sale_items: SaleItem[];
};

export default function SalesHistory() {
  const [sales, setSales] =
    useState<Sale[]>([]);

  const [search, setSearch] =
    useState('');

  const [fromDate, setFromDate] =
    useState('');

  const [toDate, setToDate] =
    useState('');

  const [loading, setLoading] =
    useState(true);

  const [message, setMessage] =
    useState('');

  useEffect(() => {
    void loadSales();
  }, []);

  async function loadSales() {
    setLoading(true);
    setMessage('');

    const {
      data,
      error,
    } = await supabase
      .from('sales')
      .select(`
        id,
        sale_date,
        total_amount,
        paid_now,
        payment_method,
        notes,
        customers (
          name,
          phone
        ),
        locations (
          name
        ),
        sale_items (
          *,
          products (
            sku,
            name
          ),
          locations (
            name
          )
        )
      `)
      .order(
        'sale_date',
        {
          ascending: false,
        },
      );

    if (error) {
      console.error(
        'Failed to load sales history:',
        error,
      );

      setMessage(
        error.message,
      );

      setSales([]);
      setLoading(false);
      return;
    }

    const normalizedSales: Sale[] =
      (
        data ?? []
      ).map(
        (row) => {
          const customer =
            Array.isArray(
              row.customers,
            )
              ? row.customers[0] ??
                null
              : row.customers;

          const location =
            Array.isArray(
              row.locations,
            )
              ? row.locations[0] ??
                null
              : row.locations;

          return {
            id: Number(
              row.id,
            ),

            sale_date:
              row.sale_date,

            total_amount:
              Number(
                row.total_amount,
              ),

            paid_now:
              Number(
                row.paid_now,
              ),

            payment_method:
              row.payment_method,

            notes:
              row.notes,

            customers:
              customer,

            locations:
              location,

            sale_items:
              (
                row.sale_items ??
                []
              ).map(
                (item) => {
                  const itemLocation =
                    Array.isArray(
                      item.locations,
                    )
                      ? item.locations[0] ??
                        null
                      : item.locations;

                  const product =
                    Array.isArray(
                      item.products,
                    )
                      ? item.products[0] ??
                        null
                      : item.products;

                  return {
                    id: Number(
                      item.id,
                    ),

                    quantity:
                      Number(
                        item.quantity,
                      ),

                    selling_price:
                      Number(
                        item.selling_price,
                      ),

                    total_amount:
                      Number(
                        item.total_amount,
                      ),

                    unit_cost: item.unit_cost === null || item.unit_cost === undefined
                      ? null
                      : Number(item.unit_cost),

                    total_cost: item.total_cost === null || item.total_cost === undefined
                      ? null
                      : Number(item.total_cost),

                    gross_profit: item.gross_profit === null || item.gross_profit === undefined
                      ? null
                      : Number(item.gross_profit),

                    products:
                      product,

                    locations:
                      itemLocation,
                  };
                },
              ),
          };
        },
      );

    setSales(
      normalizedSales,
    );

    setLoading(false);
  }

  const filteredSales =
    useMemo(() => {
      const value =
        search
          .trim()
          .toLowerCase();

      return sales.filter(
        (sale) => {
          const customerName =
            sale.customers
              ?.name ??
            'Walk-in customer';

          const customerPhone =
            sale.customers
              ?.phone ??
            '';

          const saleLocation =
            sale.locations
              ?.name ??
            '';

          const itemText =
            sale.sale_items
              .map(
                (item) => {
                  const productText =
                    `${item.products?.sku ?? ''} ${
                      item.products?.name ?? ''
                    }`;

                  const locationText =
                    item.locations
                      ?.name ??
                    '';

                  return `${productText} ${locationText}`;
                },
              )
              .join(' ');

          const matchesSearch =
            value === '' ||
            String(
              sale.id,
            ).includes(value) ||
            customerName
              .toLowerCase()
              .includes(value) ||
            customerPhone
              .toLowerCase()
              .includes(value) ||
            saleLocation
              .toLowerCase()
              .includes(value) ||
            itemText
              .toLowerCase()
              .includes(value);

          const saleDate =
            new Date(
              sale.sale_date,
            );

          const saleDateOnly =
            `${saleDate.getFullYear()}-${String(
              saleDate.getMonth() + 1,
            ).padStart(2, '0')}-${String(
              saleDate.getDate(),
            ).padStart(2, '0')}`;

          const matchesFromDate =
            !fromDate ||
            saleDateOnly >=
              fromDate;

          const matchesToDate =
            !toDate ||
            saleDateOnly <=
              toDate;

          return (
            matchesSearch &&
            matchesFromDate &&
            matchesToDate
          );
        },
      );
    }, [
      sales,
      search,
      fromDate,
      toDate,
    ]);

  const filteredTotals =
    useMemo(() => {
      return filteredSales.reduce(
        (totals, sale) => {
          totals.sales += 1;
          totals.amount +=
            Number(
              sale.total_amount,
            ) || 0;

          totals.paid +=
            Number(
              sale.paid_now,
            ) || 0;

          totals.due +=
            Math.max(
              Number(
                sale.total_amount,
              ) -
                Number(
                  sale.paid_now,
                ),
              0,
            );

          return totals;
        },
        {
          sales: 0,
          amount: 0,
          paid: 0,
          due: 0,
        },
      );
    }, [filteredSales]);

  function getSaleCost(sale: Sale): number | null {
    if (sale.sale_items.length === 0 || sale.sale_items.some((item) => item.total_cost === null)) return null;
    return sale.sale_items.reduce((sum, item) => sum + Number(item.total_cost), 0);
  }

  function getSaleGrossProfit(sale: Sale): number | null {
    const cost = getSaleCost(sale);
    return cost === null ? null : sale.total_amount - cost;
  }

  function formatDate(
    value: string,
  ) {
    return new Date(
      value,
    ).toLocaleString('en-IN');
  }

  function formatMoney(
    value: number,
  ) {
    return value.toLocaleString(
      'en-IN',
    );
  }

  function getDue(
    sale: Sale,
  ) {
    return Math.max(
      Number(
        sale.total_amount,
      ) -
        Number(
          sale.paid_now,
        ),
      0,
    );
  }

  function getSaleLocationLabel(
    sale: Sale,
  ) {
    if (
      sale.locations?.name
    ) {
      return sale.locations.name;
    }

    const uniqueLocations =
      Array.from(
        new Set(
          sale.sale_items
            .map(
              (item) =>
                item.locations
                  ?.name,
            )
            .filter(Boolean),
        ),
      );

    if (
      uniqueLocations.length ===
      1
    ) {
      return uniqueLocations[0];
    }

    if (
      uniqueLocations.length >
      1
    ) {
      return 'Multiple locations';
    }

    return '-';
  }

  function clearFilters() {
    setSearch('');
    setFromDate('');
    setToDate('');
  }

  if (loading) {
    return (
      <div>
        Loading sales history...
      </div>
    );
  }

  return (
    <>
      <style>
        {`
          .sales-history-page {
            width: 100%;
            max-width: 1200px;
            margin: 0 auto;
          }

          .sales-history-header {
            margin-bottom: 20px;
          }

          .sales-history-header h1 {
            margin-bottom: 5px;
          }

          .sales-history-description {
            color: #667085;
            font-size: 14px;
          }

          .sales-history-filters {
            display: grid;
            grid-template-columns:
              minmax(260px, 2fr)
              minmax(150px, 1fr)
              minmax(150px, 1fr)
              auto;
            gap: 10px;
            margin-bottom: 18px;
          }

          .sales-history-filters input {
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

          .sales-history-filters input:focus {
            outline: none;
            border-color: #2563eb;
            box-shadow:
              0 0 0 3px rgba(37, 99, 235, 0.12);
          }

          .sales-history-clear {
            min-width: 90px;
          }

          .sales-history-summary {
            display: grid;
            grid-template-columns:
              repeat(4, minmax(0, 1fr));
            gap: 12px;
            margin-bottom: 20px;
          }

          .sales-history-summary-card {
            padding: 16px;
            background: #ffffff;
            border: 1px solid #e4e7ec;
            border-radius: 10px;
            box-shadow:
              0 1px 2px rgba(16, 24, 40, 0.05);
          }

          .summary-label {
            color: #667085;
            font-size: 12px;
            font-weight: 600;
          }

          .summary-value {
            margin-top: 4px;
            color: #101828;
            font-size: 20px;
            font-weight: 700;
          }

          .sales-history-message {
            margin-bottom: 16px;
            padding: 11px 13px;
            border: 1px solid #fecaca;
            border-radius: 8px;
            background: #fef2f2;
            color: #dc2626;
            font-size: 14px;
          }

          .sales-history-count {
            margin-bottom: 14px;
            color: #667085;
            font-size: 13px;
          }

          .sale-card {
            margin-bottom: 16px;
            background: #ffffff;
            border: 1px solid #e4e7ec;
            border-radius: 12px;
            box-shadow:
              0 1px 2px rgba(16, 24, 40, 0.05);
            overflow: hidden;
          }

          .sale-card-header {
            display: flex;
            align-items: flex-start;
            justify-content: space-between;
            gap: 16px;
            padding: 18px 20px;
            border-bottom: 1px solid #e4e7ec;
            background: #f9fafb;
          }

          .sale-card-header h2 {
            margin: 0 0 4px;
            font-size: 18px;
          }

          .sale-meta {
            color: #667085;
            font-size: 13px;
          }

          .sale-status {
            flex: 0 0 auto;
            padding: 5px 9px;
            border-radius: 999px;
            font-size: 11px;
            font-weight: 700;
          }

          .sale-status-paid {
            background: #f0fdf4;
            color: #15803d;
          }

          .sale-status-due {
            background: #fffbeb;
            color: #b45309;
          }

          .sale-details {
            display: grid;
            grid-template-columns:
              repeat(3, minmax(0, 1fr));
            gap: 12px;
            padding: 16px 20px;
          }

          .sale-detail {
            min-width: 0;
          }

          .sale-detail-label {
            color: #667085;
            font-size: 12px;
            font-weight: 600;
          }

          .sale-detail-value {
            margin-top: 3px;
            color: #101828;
            font-size: 14px;
            font-weight: 600;
            overflow-wrap: anywhere;
          }

          .sale-items-wrapper {
            width: 100%;
            padding: 0 20px 16px;
            overflow-x: auto;
            -webkit-overflow-scrolling: touch;
          }

          .sale-items {
            width: 100%;
            min-width: 650px;
            border-collapse: collapse;
          }

          .sale-items th,
          .sale-items td {
            padding: 10px 12px;
            border-bottom: 1px solid #e4e7ec;
            text-align: left;
            vertical-align: middle;
            font-size: 13px;
          }

          .sale-items th {
            background: #f9fafb;
            color: #101828;
            font-weight: 650;
          }

          .sale-items td {
            color: #475467;
          }

          .sale-items tbody tr:last-child td {
            border-bottom: 0;
          }

          .sale-product-name {
            color: #101828;
            font-weight: 600;
          }

          .sale-product-sku {
            color: #2563eb;
            font-size: 12px;
            font-weight: 700;
          }

          .sale-totals {
            display: flex;
            justify-content: flex-end;
            padding: 0 20px 18px;
          }

          .sale-total-box {
            width: 100%;
            max-width: 320px;
          }

          .sale-total-row {
            display: flex;
            justify-content: space-between;
            gap: 20px;
            padding: 5px 0;
            color: #475467;
            font-size: 14px;
          }

          .sale-total-row.total {
            padding-top: 9px;
            margin-top: 5px;
            border-top: 1px solid #e4e7ec;
            color: #101828;
            font-size: 16px;
            font-weight: 700;
          }

          .sale-total-row.due {
            color: #b45309;
            font-weight: 700;
          }

          .sale-notes {
            margin: 0 20px 18px;
            padding: 10px 12px;
            border-radius: 8px;
            background: #f9fafb;
            color: #667085;
            font-size: 13px;
          }

          @media (max-width: 900px) {
            .sales-history-filters {
              grid-template-columns:
                repeat(2, minmax(0, 1fr));
            }

            .sales-history-summary {
              grid-template-columns:
                repeat(2, minmax(0, 1fr));
            }

            .sale-details {
              grid-template-columns:
                repeat(2, minmax(0, 1fr));
            }
          }

          @media (max-width: 600px) {
            .sales-history-filters {
              grid-template-columns: 1fr;
            }

            .sales-history-clear {
              width: 100%;
            }

            .sales-history-summary {
              grid-template-columns: 1fr 1fr;
            }

            .sale-card-header {
              padding: 15px;
            }

            .sale-details {
              grid-template-columns: 1fr;
              padding: 14px 15px;
            }

            .sale-items-wrapper {
              padding: 0 15px 14px;
            }

            .sale-totals {
              padding: 0 15px 16px;
            }

            .sale-notes {
              margin-left: 15px;
              margin-right: 15px;
            }

            .summary-value {
              font-size: 18px;
            }
          }
        `}
      </style>

      <main className="sales-history-page">
        <div className="sales-history-header">
          <h1>
            Sales History
          </h1>

          <p className="sales-history-description">
            Search and review completed sales,
            customers, products and payment details.
          </p>
        </div>

        {message && (
          <div className="sales-history-message">
            {message}
          </div>
        )}

        <section className="sales-history-filters">
          <input
            type="text"
            placeholder="Search sale ID, customer, phone, product or location"
            value={search}
            onChange={(event) =>
              setSearch(
                event.target.value,
              )
            }
          />

          <input
            type="date"
            value={fromDate}
            onChange={(event) =>
              setFromDate(
                event.target.value,
              )
            }
            aria-label="From date"
          />

          <input
            type="date"
            value={toDate}
            onChange={(event) =>
              setToDate(
                event.target.value,
              )
            }
            aria-label="To date"
          />

          <button
            type="button"
            className="sales-history-clear"
            onClick={clearFilters}
          >
            Clear
          </button>
        </section>

        <section className="sales-history-summary">
          <article className="sales-history-summary-card">
            <div className="summary-label">
              Sales
            </div>

            <div className="summary-value">
              {
                filteredTotals.sales
              }
            </div>
          </article>

          <article className="sales-history-summary-card">
            <div className="summary-label">
              Sales Amount
            </div>

            <div className="summary-value">
              ₹
              {formatMoney(
                filteredTotals.amount,
              )}
            </div>
          </article>

          <article className="sales-history-summary-card">
            <div className="summary-label">
              Collected
            </div>

            <div className="summary-value">
              ₹
              {formatMoney(
                filteredTotals.paid,
              )}
            </div>
          </article>

          <article className="sales-history-summary-card">
            <div className="summary-label">
              Outstanding
            </div>

            <div className="summary-value">
              ₹
              {formatMoney(
                filteredTotals.due,
              )}
            </div>
          </article>
        </section>

        <p className="sales-history-count">
          Showing{' '}
          {
            filteredSales.length
          }{' '}
          of {sales.length}{' '}
          sales
        </p>

        {filteredSales.length ===
        0 ? (
          <p>
            No sales found for the selected
            filters.
          </p>
        ) : (
          <div>
            {filteredSales.map(
              (sale) => {
                const customerName =
                  sale.customers
                    ?.name ??
                  'Walk-in customer';

                const customerPhone =
                  sale.customers
                    ?.phone;

                const due =
                  getDue(sale);

                const isPaid =
                  due === 0;

                return (
                  <article
                    key={
                      sale.id
                    }
                    className="sale-card"
                  >
                    <div className="sale-card-header">
                      <div>
                        <h2>
                          Sale #
                          {
                            sale.id
                          }
                        </h2>

                        <div className="sale-meta">
                          {
                            formatDate(
                              sale.sale_date,
                            )
                          }
                        </div>
                      </div>

                      <span
                        className={`sale-status ${
                          isPaid
                            ? 'sale-status-paid'
                            : 'sale-status-due'
                        }`}
                      >
                        {isPaid
                          ? 'PAID'
                          : 'PAYMENT DUE'}
                      </span>
                    </div>

                    <div className="sale-details">
                      <div className="sale-detail">
                        <div className="sale-detail-label">
                          Customer
                        </div>

                        <div className="sale-detail-value">
                          {
                            customerName
                          }

                          {customerPhone
                            ? ` — ${customerPhone}`
                            : ''}
                        </div>
                      </div>

                      <div className="sale-detail">
                        <div className="sale-detail-label">
                          Location
                        </div>

                        <div className="sale-detail-value">
                          {
                            getSaleLocationLabel(
                              sale,
                            )
                          }
                        </div>
                      </div>

                      <div className="sale-detail">
                        <div className="sale-detail-label">
                          Payment Method
                        </div>

                        <div className="sale-detail-value">
                          {sale.payment_method ??
                            '—'}
                        </div>
                      </div>
                    </div>

                    <div className="sale-items-wrapper">
                      <table className="sale-items">
                        <thead>
                          <tr>
                            <th>
                              Product
                            </th>

                            <th>
                              Location
                            </th>

                            <th>
                              Qty
                            </th>

                            <th>
                              Rate
                            </th>

                            <th>
                              Total
                            </th>

                            <th>Unit Cost</th>
                            <th>Gross Profit</th>
                          </tr>
                        </thead>

                        <tbody>
                          {sale.sale_items.map(
                            (item) => (
                              <tr
                                key={
                                  item.id
                                }
                              >
                                <td>
                                  <div className="sale-product-name">
                                    {
                                      item.products
                                        ?.name ??
                                      '-'
                                    }
                                  </div>

                                  <div className="sale-product-sku">
                                    {
                                      item.products
                                        ?.sku ??
                                      '-'
                                    }
                                  </div>
                                </td>
                                <td>
                                  {
                                    item.locations
                                      ?.name ??
                                    '-'
                                  }
                                </td>

                                <td>
                                  {
                                    Number(
                                      item.quantity,
                                    )
                                  }
                                </td>
                                <td>
                                  ₹
                                  {
                                    formatMoney(
                                      Number(
                                        item.selling_price,
                                      ),
                                    )
                                  }
                                </td>
                                <td>
                                  ₹
                                  {
                                    formatMoney(
                                      Number(
                                        item.total_amount,
                                      ),
                                    )
                                  }
                                </td>
                                <td>
                                  {item.unit_cost === null ? '—' : `₹${formatMoney(item.unit_cost)}`}
                                </td>
                                <td>
                                  {item.gross_profit === null ? '—' : `₹${formatMoney(item.gross_profit)}`}
                                </td>
                              </tr>
                            ),
                          )}
                        </tbody>
                      </table>
                    </div>

                    <div className="sale-totals">
                      <div className="sale-total-box">
                        <div className="sale-total-row">
                          <span>Total Cost</span>
                          <span>{getSaleCost(sale) === null ? 'Unavailable' : `₹${formatMoney(getSaleCost(sale)!)}`}</span>
                        </div>
                        <div className="sale-total-row">
                          <span>Gross Profit</span>
                          <span>{getSaleGrossProfit(sale) === null ? 'Unavailable' : `₹${formatMoney(getSaleGrossProfit(sale)!)}`}</span>
                        </div>
                        <div className="sale-total-row total">
                          <span>
                            Total
                          </span>

                          <span>
                            ₹
                            {
                              formatMoney(
                                Number(
                                  sale.total_amount,
                                ),
                              )
                            }
                          </span>
                        </div>

                        <div className="sale-total-row">
                          <span>
                            Paid
                          </span>

                          <span>
                            ₹
                            {
                              formatMoney(
                                Number(
                                  sale.paid_now,
                                ),
                              )
                            }
                          </span>
                        </div>

                        <div className="sale-total-row due">
                          <span>
                            Due
                          </span>

                          <span>
                            ₹
                            {
                              formatMoney(
                                due,
                              )
                            }
                          </span>
                        </div>
                      </div>
                    </div>

                    {sale.notes && (
                      <div className="sale-notes">
                        <strong>
                          Notes:
                        </strong>{' '}
                        {
                          sale.notes
                        }
                      </div>
                    )}
                  </article>
                );
              },
            )}
          </div>
        )}
      </main>
    </>
  );
}
