import {
  useEffect,
  useMemo,
  useState,
} from 'react';
import { supabase } from '../lib/supabase';

type PurchaseItem = {
  id: number;
  product_id: number;
  quantity: number;
  products:
    | {
        sku: string;
        name: string;
      }
    | null;
};

type Purchase = {
  id: number;
  supplier_id: number;
  location_id: number;
  purchase_date: string;
  invoice_number: string | null;
  notes: string | null;
  status: string;
  suppliers:
    | {
        name: string;
      }
    | null;
  locations:
    | {
        name: string;
      }
    | null;
  purchase_items: PurchaseItem[];
};

export default function PendingPurchases() {
  const [purchases, setPurchases] =
    useState<Purchase[]>([]);

  const [costs, setCosts] =
    useState<Record<number, string>>({});

  const [paidNow, setPaidNow] =
    useState<Record<number, string>>({});

  const [paymentMethods, setPaymentMethods] =
    useState<Record<number, string>>({});

  const [search, setSearch] =
    useState('');

  const [loading, setLoading] =
    useState(true);

  const [confirmingId, setConfirmingId] =
    useState<number | null>(null);

  const [message, setMessage] =
    useState('');

  useEffect(() => {
    void loadPendingPurchases();
  }, []);

  async function loadPendingPurchases() {
    setLoading(true);
    setMessage('');

    const {
      data,
      error,
    } = await supabase
      .from('purchases')
      .select(`
        id,
        supplier_id,
        location_id,
        purchase_date,
        invoice_number,
        notes,
        status,
        suppliers (
          name
        ),
        locations (
          name
        ),
        purchase_items (
          id,
          product_id,
          quantity,
          products (
            sku,
            name
          )
        )
      `)
      .eq(
        'status',
        'PENDING',
      )
      .order(
        'purchase_date',
        {
          ascending: false,
        },
      );

    if (error) {
      console.error(
        'Failed to load pending purchases:',
        error,
      );

      setMessage(
        error.message,
      );

      setPurchases([]);
      setLoading(false);
      return;
    }

    setPurchases(
      (data ?? []) as unknown as Purchase[],
    );

    setLoading(false);
  }

  function calculatePurchaseTotal(
    purchase: Purchase,
  ) {
    return purchase.purchase_items.reduce(
      (
        total,
        item,
      ) => {
        const unitCost =
          Number(
            costs[item.id] ?? 0,
          );

        return (
          total +
          unitCost *
            item.quantity
        );
      },
      0,
    );
  }

  async function confirmPurchase(
    purchase: Purchase,
  ) {
    setMessage('');

    if (
      purchase.purchase_items
        .length === 0
    ) {
      setMessage(
        'This purchase has no items.',
      );

      return;
    }

    if (purchase.purchase_items.length !== 1) {
      setMessage(
        'This purchase has multiple items, but the current confirmation flow supports one item at a time. No changes were made.',
      );
      return;
    }

    for (const item of
      purchase.purchase_items) {
      const unitCost =
        Number(
          costs[item.id],
        );

      if (
        !Number.isFinite(
          unitCost,
        ) ||
        unitCost <= 0
      ) {
        setMessage(
          `Enter a valid purchase cost for ${
            item.products?.name ??
            'the product'
          }.`,
        );

        return;
      }
    }

    const totalAmount =
      calculatePurchaseTotal(
        purchase,
      );

    const payment =
      Number(
        paidNow[
          purchase.id
        ] ?? 0,
      );

    if (
      !Number.isFinite(
        payment,
      ) ||
      payment < 0
    ) {
      setMessage(
        'Paid amount cannot be negative.',
      );

      return;
    }

    if (
      payment >
      totalAmount
    ) {
      setMessage(
        'Paid amount cannot be greater than purchase total.',
      );

      return;
    }

    setConfirmingId(
      purchase.id,
    );

    const item =
      purchase.purchase_items[0];

    const {
      error,
    } = await supabase.rpc(
      'confirm_purchase_with_date',
      {
        p_purchase_id:
          purchase.id,

        p_unit_cost:
          Number(
            costs[item.id],
          ),

        p_paid_now:
          payment,

        p_payment_method:
          payment > 0
            ? paymentMethods[
                purchase.id
              ] ?? 'CASH'
            : null,

        p_payment_date:
          new Date().toISOString(),
      },
    );

    if (error) {
      setMessage(
        error.message,
      );

      setConfirmingId(
        null,
      );

      return;
    }

    setMessage(
      `Purchase #${purchase.id} confirmed successfully.`,
    );

    setPurchases(
      (current) =>
        current.filter(
          (item) =>
            item.id !==
            purchase.id,
        ),
    );

    setCosts(
      (current) => {
        const next = {
          ...current,
        };

        purchase.purchase_items.forEach(
          (item) => {
            delete next[
              item.id
            ];
          },
        );

        return next;
      },
    );

    setPaidNow(
      (current) => {
        const next = {
          ...current,
        };

        delete next[
          purchase.id
        ];

        return next;
      },
    );

    setPaymentMethods(
      (current) => {
        const next = {
          ...current,
        };

        delete next[
          purchase.id
        ];

        return next;
      },
    );

    setConfirmingId(
      null,
    );
  }

  const filteredPurchases =
    useMemo(() => {
      const value =
        search
          .trim()
          .toLowerCase();

      if (!value) {
        return purchases;
      }

      return purchases.filter(
        (purchase) => {
          const supplier =
            purchase.suppliers
              ?.name ??
            '';

          const location =
            purchase.locations
              ?.name ??
            '';

          const invoice =
            purchase.invoice_number ??
            '';

          const productsText =
            purchase.purchase_items
              .map(
                (item) =>
                  `${item.products?.sku ?? ''} ${
                    item.products?.name ?? ''
                  }`,
              )
              .join(' ');

          return (
            String(
              purchase.id,
            ).includes(value) ||
            supplier
              .toLowerCase()
              .includes(value) ||
            location
              .toLowerCase()
              .includes(value) ||
            invoice
              .toLowerCase()
              .includes(value) ||
            productsText
              .toLowerCase()
              .includes(value)
          );
        },
      );
    }, [
      purchases,
      search,
    ]);

  const pendingItemCount =
    purchases.reduce(
      (
        total,
        purchase,
      ) =>
        total +
        purchase.purchase_items
          .reduce(
            (
              itemTotal,
              item,
            ) =>
              itemTotal +
              item.quantity,
            0,
          ),
      0,
    );

  const visibleItemCount =
    filteredPurchases.reduce(
      (
        total,
        purchase,
      ) =>
        total +
        purchase.purchase_items
          .reduce(
            (
              itemTotal,
              item,
            ) =>
              itemTotal +
              item.quantity,
            0,
          ),
      0,
    );

  function formatDate(
    value: string,
  ) {
    return new Date(
      value,
    ).toLocaleString(
      'en-IN',
    );
  }

  function formatMoney(
    value: number,
  ) {
    return value.toLocaleString(
      'en-IN',
    );
  }

  function clearSearch() {
    setSearch('');
  }

  if (loading) {
    return (
      <div>
        Loading pending purchases...
      </div>
    );
  }

  return (
    <>
      <style>
        {`
          .pending-page {
            width: 100%;
            max-width: 1200px;
            margin: 0 auto;
          }

          .pending-header {
            margin-bottom: 20px;
          }

          .pending-header h1 {
            margin-bottom: 5px;
          }

          .pending-description {
            color: #667085;
            font-size: 14px;
          }

          .pending-message {
            margin-bottom: 16px;
            padding: 11px 13px;
            border-radius: 8px;
            border: 1px solid #fecaca;
            background: #fef2f2;
            color: #dc2626;
            font-size: 14px;
          }

          .pending-summary {
            display: grid;
            grid-template-columns:
              repeat(2, minmax(0, 1fr));
            gap: 12px;
            margin-bottom: 18px;
          }

          .pending-summary-card {
            padding: 16px;
            background: #ffffff;
            border: 1px solid #e4e7ec;
            border-radius: 10px;
            box-shadow:
              0 1px 2px rgba(16, 24, 40, 0.05);
          }

          .pending-summary-label {
            color: #667085;
            font-size: 12px;
            font-weight: 600;
          }

          .pending-summary-value {
            margin-top: 4px;
            color: #101828;
            font-size: 23px;
            font-weight: 700;
          }

          .pending-search {
            display: flex;
            gap: 8px;
            margin-bottom: 18px;
          }

          .pending-search input {
            flex: 1;
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

          .pending-search input:focus {
            outline: none;
            border-color: #2563eb;
            box-shadow:
              0 0 0 3px rgba(37, 99, 235, 0.12);
          }

          .pending-clear {
            min-width: 75px;
          }

          .pending-count {
            margin-bottom: 14px;
            color: #667085;
            font-size: 13px;
          }

          .purchase-card {
            margin-bottom: 18px;
            background: #ffffff;
            border: 1px solid #e4e7ec;
            border-radius: 12px;
            box-shadow:
              0 1px 2px rgba(16, 24, 40, 0.05);
            overflow: hidden;
          }

          .purchase-card-header {
            display: flex;
            align-items: flex-start;
            justify-content: space-between;
            gap: 16px;
            padding: 18px 20px;
            border-bottom: 1px solid #e4e7ec;
            background: #f9fafb;
          }

          .purchase-card-header h2 {
            margin: 0 0 4px;
            font-size: 18px;
          }

          .purchase-date {
            color: #667085;
            font-size: 13px;
          }

          .pending-badge {
            flex: 0 0 auto;
            padding: 5px 9px;
            border-radius: 999px;
            background: #fffbeb;
            color: #b45309;
            font-size: 11px;
            font-weight: 700;
          }

          .purchase-details {
            display: grid;
            grid-template-columns:
              repeat(3, minmax(0, 1fr));
            gap: 14px;
            padding: 16px 20px;
          }

          .purchase-detail-label {
            color: #667085;
            font-size: 12px;
            font-weight: 600;
          }

          .purchase-detail-value {
            margin-top: 3px;
            color: #101828;
            font-size: 14px;
            font-weight: 600;
            overflow-wrap: anywhere;
          }

          .purchase-notes {
            margin: 0 20px 16px;
            padding: 10px 12px;
            border-radius: 8px;
            background: #f9fafb;
            color: #667085;
            font-size: 13px;
          }

          .purchase-items-wrapper {
            width: 100%;
            padding: 0 20px;
            overflow-x: auto;
            -webkit-overflow-scrolling: touch;
          }

          .purchase-items {
            width: 100%;
            min-width: 650px;
            border-collapse: collapse;
          }

          .purchase-items th,
          .purchase-items td {
            padding: 10px 12px;
            border-bottom: 1px solid #e4e7ec;
            text-align: left;
            vertical-align: middle;
            font-size: 13px;
          }

          .purchase-items th {
            background: #f9fafb;
            color: #101828;
            font-weight: 650;
          }

          .purchase-items td {
            color: #475467;
          }

          .purchase-items tbody tr:last-child td {
            border-bottom: 0;
          }

          .purchase-product-name {
            color: #101828;
            font-weight: 600;
          }

          .purchase-product-sku {
            margin-top: 2px;
            color: #2563eb;
            font-size: 12px;
            font-weight: 700;
          }

          .purchase-cost-input {
            min-width: 120px;
            min-height: 38px;
            padding: 7px 9px;
            border: 1px solid #d0d5dd;
            border-radius: 6px;
            background: #ffffff;
            color: #101828;
          }

          .purchase-cost-input:focus {
            outline: none;
            border-color: #2563eb;
            box-shadow:
              0 0 0 3px rgba(37, 99, 235, 0.12);
          }

          .purchase-total-row {
            display: flex;
            justify-content: flex-end;
            padding: 16px 20px 8px;
          }

          .purchase-total {
            color: #101828;
            font-size: 17px;
            font-weight: 700;
          }

          .purchase-payment {
            display: grid;
            grid-template-columns:
              minmax(0, 1fr)
              minmax(0, 1fr);
            gap: 14px;
            padding: 12px 20px 18px;
          }

          .purchase-field label {
            display: block;
            margin-bottom: 6px;
            color: #101828;
            font-size: 13px;
            font-weight: 600;
          }

          .purchase-field input,
          .purchase-field select {
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

          .purchase-field input:focus,
          .purchase-field select:focus {
            outline: none;
            border-color: #2563eb;
            box-shadow:
              0 0 0 3px rgba(37, 99, 235, 0.12);
          }

          .purchase-due {
            margin: 0 20px 16px;
            padding: 11px 13px;
            border-radius: 8px;
            background: #fffbeb;
            border: 1px solid #fde68a;
            color: #b45309;
            font-size: 14px;
            font-weight: 600;
          }

          .purchase-confirm {
            display: flex;
            justify-content: flex-end;
            padding: 0 20px 20px;
          }

          .purchase-confirm button {
            min-width: 180px;
          }

          .pending-empty {
            padding: 32px 20px;
            text-align: center;
            background: #ffffff;
            border: 1px solid #e4e7ec;
            border-radius: 12px;
            color: #667085;
          }

          @media (max-width: 800px) {
            .purchase-details {
              grid-template-columns:
                repeat(2, minmax(0, 1fr));
            }

            .purchase-payment {
              grid-template-columns: 1fr;
            }
          }

          @media (max-width: 600px) {
            .pending-summary {
              grid-template-columns: 1fr 1fr;
            }

            .pending-search {
              flex-direction: column;
            }

            .pending-clear {
              width: 100%;
            }

            .purchase-card-header {
              padding: 15px;
            }

            .purchase-details {
              grid-template-columns: 1fr;
              padding: 14px 15px;
            }

            .purchase-items-wrapper {
              padding: 0 15px;
            }

            .purchase-total-row {
              padding-left: 15px;
              padding-right: 15px;
            }

            .purchase-payment {
              padding-left: 15px;
              padding-right: 15px;
            }

            .purchase-due {
              margin-left: 15px;
              margin-right: 15px;
            }

            .purchase-confirm {
              padding-left: 15px;
              padding-right: 15px;
            }

            .purchase-confirm button {
              width: 100%;
            }
          }
        `}
      </style>

      <main className="pending-page">
        <div className="pending-header">
          <h1>
            Pending Purchases
          </h1>

          <p className="pending-description">
            Review stock received by staff,
            enter the purchase cost, and confirm
            the purchase.
          </p>
        </div>

        {message && (
          <div className="pending-message">
            {message}
          </div>
        )}

        <section className="pending-summary">
          <article className="pending-summary-card">
            <div className="pending-summary-label">
              Pending Purchases
            </div>

            <div className="pending-summary-value">
              {purchases.length}
            </div>
          </article>

          <article className="pending-summary-card">
            <div className="pending-summary-label">
              Units Pending
            </div>

            <div className="pending-summary-value">
              {pendingItemCount.toLocaleString(
                'en-IN',
              )}
            </div>
          </article>
        </section>

        {purchases.length > 0 && (
          <>
            <div className="pending-search">
              <input
                type="text"
                value={search}
                onChange={(event) =>
                  setSearch(
                    event.target.value,
                  )
                }
                placeholder="Search purchase ID, supplier, invoice, product or location"
              />

              {search && (
                <button
                  type="button"
                  className="pending-clear"
                  onClick={
                    clearSearch
                  }
                >
                  Clear
                </button>
              )}
            </div>

            <p className="pending-count">
              Showing{' '}
              {
                filteredPurchases.length
              }{' '}
              of {purchases.length}{' '}
              pending purchases
              {search
                ? ` • ${visibleItemCount.toLocaleString(
                    'en-IN',
                  )} units`
                : ''}
            </p>
          </>
        )}

        {filteredPurchases.length ===
        0 ? (
          <div className="pending-empty">
            {purchases.length ===
            0
              ? 'No pending purchases.'
              : 'No pending purchases match your search.'}
          </div>
        ) : (
          <div>
            {filteredPurchases.map(
              (purchase) => {
                const totalAmount =
                  calculatePurchaseTotal(
                    purchase,
                  );

                const payment =
                  Number(
                    paidNow[
                      purchase.id
                    ] ?? 0,
                  );

                const supplierDue =
                  Math.max(
                    totalAmount -
                      payment,
                    0,
                  );

                return (
                  <article
                    key={
                      purchase.id
                    }
                    className="purchase-card"
                  >
                    <div className="purchase-card-header">
                      <div>
                        <h2>
                          Purchase #
                          {
                            purchase.id
                          }
                        </h2>

                        <div className="purchase-date">
                          {
                            formatDate(
                              purchase.purchase_date,
                            )
                          }
                        </div>
                      </div>

                      <span className="pending-badge">
                        PENDING
                      </span>
                    </div>

                    <div className="purchase-details">
                      <div>
                        <div className="purchase-detail-label">
                          Supplier
                        </div>

                        <div className="purchase-detail-value">
                          {
                            purchase.suppliers
                              ?.name ??
                            '-'
                          }
                        </div>
                      </div>

                      <div>
                        <div className="purchase-detail-label">
                          Location
                        </div>

                        <div className="purchase-detail-value">
                          {
                            purchase.locations
                              ?.name ??
                            '-'
                          }
                        </div>
                      </div>

                      <div>
                        <div className="purchase-detail-label">
                          Invoice / Reference
                        </div>

                        <div className="purchase-detail-value">
                          {
                            purchase.invoice_number ??
                            '-'
                          }
                        </div>
                      </div>
                    </div>

                    {purchase.notes && (
                      <div className="purchase-notes">
                        <strong>
                          Notes:
                        </strong>{' '}
                        {
                          purchase.notes
                        }
                      </div>
                    )}

                    <div className="purchase-items-wrapper">
                      <table className="purchase-items">
                        <thead>
                          <tr>
                            <th>
                              Product
                            </th>

                            <th>
                              Quantity
                            </th>

                            <th>
                              Unit Cost
                            </th>

                            <th>
                              Total
                            </th>
                          </tr>
                        </thead>

                        <tbody>
                          {purchase.purchase_items.map(
                            (item) => {
                              const unitCost =
                                Number(
                                  costs[
                                    item.id
                                  ] ??
                                  0,
                                );

                              const lineTotal =
                                unitCost *
                                item.quantity;

                              return (
                                <tr
                                  key={
                                    item.id
                                  }
                                >
                                  <td>
                                    <div className="purchase-product-name">
                                      {
                                        item.products
                                          ?.name ??
                                        '-'
                                      }
                                    </div>

                                    <div className="purchase-product-sku">
                                      {
                                        item.products
                                          ?.sku ??
                                        '-'
                                      }
                                    </div>
                                  </td>

                                  <td>
                                    {
                                      item.quantity
                                    }
                                  </td>

                                  <td>
                                    <input
                                      className="purchase-cost-input"
                                      type="number"
                                      min="0.01"
                                      step="0.01"
                                      value={
                                        costs[
                                          item.id
                                        ] ??
                                        ''
                                      }
                                      onChange={(
                                        event,
                                      ) =>
                                        setCosts(
                                          (
                                            current,
                                          ) => ({
                                            ...current,
                                            [item.id]:
                                              event
                                                .target
                                                .value,
                                          }),
                                        )
                                      }
                                    />
                                  </td>

                                  <td>
                                    ₹
                                    {
                                      formatMoney(
                                        lineTotal,
                                      )
                                    }
                                  </td>
                                </tr>
                              );
                            },
                          )}
                        </tbody>
                      </table>
                    </div>

                    <div className="purchase-total-row">
                      <div className="purchase-total">
                        Total Purchase: ₹
                        {
                          formatMoney(
                            totalAmount,
                          )
                        }
                      </div>
                    </div>

                    <div className="purchase-payment">
                      <div className="purchase-field">
                        <label
                          htmlFor={`paid-${purchase.id}`}
                        >
                          Paid Now
                        </label>

                        <input
                          id={`paid-${purchase.id}`}
                          type="number"
                          min="0"
                          step="0.01"
                          value={
                            paidNow[
                              purchase.id
                            ] ??
                            ''
                          }
                          onChange={(
                            event,
                          ) =>
                            setPaidNow(
                              (
                                current,
                              ) => ({
                                ...current,
                                [purchase.id]:
                                  event
                                    .target
                                    .value,
                              }),
                            )
                          }
                          placeholder="Enter payment amount"
                        />
                      </div>

                      {payment > 0 && (
                        <div className="purchase-field">
                          <label
                            htmlFor={`payment-method-${purchase.id}`}
                          >
                            Payment Method
                          </label>

                          <select
                            id={`payment-method-${purchase.id}`}
                            value={
                              paymentMethods[
                                purchase.id
                              ] ??
                              'CASH'
                            }
                            onChange={(
                              event,
                            ) =>
                              setPaymentMethods(
                                (
                                  current,
                                ) => ({
                                  ...current,
                                  [purchase.id]:
                                    event
                                      .target
                                      .value,
                                }),
                              )
                            }
                          >
                            <option value="CASH">
                              Cash
                            </option>

                            <option value="UPI">
                              UPI
                            </option>

                            <option value="CARD">
                              Card
                            </option>

                            <option value="BANK_TRANSFER">
                              Bank Transfer
                            </option>
                          </select>
                        </div>
                      )}
                    </div>

                    <div className="purchase-due">
                      Supplier Due: ₹
                      {
                        formatMoney(
                          supplierDue,
                        )
                      }
                    </div>

                    <div className="purchase-confirm">
                      <button
                        type="button"
                        disabled={
                          confirmingId ===
                          purchase.id
                        }
                        onClick={() =>
                          void confirmPurchase(
                            purchase,
                          )
                        }
                      >
                        {confirmingId ===
                        purchase.id
                          ? 'Confirming...'
                          : 'Confirm Purchase'}
                      </button>
                    </div>
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
