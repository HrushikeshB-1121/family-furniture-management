import {
  useEffect,
  useMemo,
  useState,
} from 'react';
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

function getLocalDateTimeValue(date = new Date()) {
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60 * 1000);

  return local.toISOString().slice(0, 16);
}

function Payments() {
  const [mode, setMode] =
    useState<'SUPPLIER' | 'CUSTOMER'>(
      'SUPPLIER',
    );

  const [supplierBalances, setSupplierBalances] =
    useState<Balance[]>([]);

  const [customerBalances, setCustomerBalances] =
    useState<Balance[]>([]);

  const [partyId, setPartyId] = useState('');

  const [partySearch, setPartySearch] =
    useState('');

  const [showPartyDropdown, setShowPartyDropdown] =
    useState(false);

  const [amount, setAmount] = useState('');

  const [paymentMethod, setPaymentMethod] =
    useState('');

  const [paymentDate, setPaymentDate] =
    useState(getLocalDateTimeValue());

  const [notes, setNotes] = useState('');

  const [loading, setLoading] = useState(true);

  const [saving, setSaving] = useState(false);

  const [message, setMessage] = useState('');

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
      customersResult,
      supplierTransactionsResult,
      customerTransactionsResult,
      salesResult,
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
        .select(
          'supplier_id, transaction_type, amount',
        ),

      supabase
        .from('customer_transactions')
        .select(
          'customer_id, transaction_type, amount',
        ),

      supabase
        .from('sales')
        .select(
          'customer_id, total_amount, paid_now',
        )
        .not('customer_id', 'is', null),
    ]);

    if (suppliersResult.error) {
      setErrorMessage(
        suppliersResult.error.message,
      );
    }

    if (customersResult.error) {
      setErrorMessage(
        customersResult.error.message,
      );
    }

    if (
      supplierTransactionsResult.error
    ) {
      setErrorMessage(
        supplierTransactionsResult.error.message,
      );
    }

    if (
      customerTransactionsResult.error
    ) {
      setErrorMessage(
        customerTransactionsResult.error.message,
      );
    }

    if (salesResult.error) {
      setErrorMessage(
        salesResult.error.message,
      );
    }

    const supplierList: Supplier[] =
      suppliersResult.data ?? [];

    const customerList: Customer[] =
      customersResult.data ?? [];

    const calculatedSupplierBalances =
      calculateSupplierBalances(
        supplierList,
        supplierTransactionsResult.data ?? [],
      );

    const calculatedCustomerBalances =
      calculateCustomerBalances(
        customerList,
        customerTransactionsResult.data ?? [],
        salesResult.data ?? [],
      );

    setSupplierBalances(
      calculatedSupplierBalances,
    );

    setCustomerBalances(
      calculatedCustomerBalances,
    );

    setLoading(false);
  }

  function calculateCustomerBalances(
    customerList: Customer[],
    transactions: Array<{
      customer_id: number;
      transaction_type: string;
      amount: number;
    }>,
    sales: Array<{
      customer_id: number | null;
      total_amount: number;
      paid_now: number;
    }>,
  ): Balance[] {
    return customerList
      .map((customer) => {
        let balance = 0;

        sales
          .filter(
            (sale) =>
              sale.customer_id ===
              customer.id,
          )
          .forEach((sale) => {
            const totalAmount =
              Number(
                sale.total_amount,
              ) || 0;

            const paidAtSale =
              Number(sale.paid_now) || 0;

            balance += Math.max(
              totalAmount -
                paidAtSale,
              0,
            );
          });

        transactions
          .filter(
            (transaction) =>
              transaction.customer_id ===
              customer.id,
          )
          .forEach((transaction) => {
            const value =
              Number(
                transaction.amount,
              );

            if (
              transaction.transaction_type ===
              'OPENING_BALANCE'
            ) {
              balance += value;
            }

            if (
              transaction.transaction_type ===
              'PAYMENT'
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
      .filter(
        (customer) =>
          customer.balance > 0,
      );
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
              transaction.supplier_id ===
              supplier.id,
          )
          .forEach((transaction) => {
            const value =
              Number(
                transaction.amount,
              );

            if (
              transaction.transaction_type ===
                'OPENING_BALANCE' ||
              transaction.transaction_type ===
                'PURCHASE'
            ) {
              balance += value;
            }

            if (
              transaction.transaction_type ===
              'PAYMENT'
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
      .filter(
        (supplier) =>
          supplier.balance > 0,
      );
  }

  function changeMode(
    newMode:
      | 'SUPPLIER'
      | 'CUSTOMER',
  ) {
    setMode(newMode);
    setPartyId('');
    setPartySearch('');
    setShowPartyDropdown(false);
    setAmount('');
    setPaymentMethod('');
    setPaymentDate(
      getLocalDateTimeValue(),
    );
    setNotes('');
    setMessage('');
    setErrorMessage('');
  }

  const availableParties =
    mode === 'SUPPLIER'
      ? supplierBalances
      : customerBalances;

  const selectedParty =
    availableParties.find(
      (party) =>
        String(party.id) === partyId,
    );

  const filteredParties = useMemo(() => {
    const search =
      partySearch
        .trim()
        .toLowerCase();

    if (!search) {
      return availableParties;
    }

    return availableParties.filter(
      (party) =>
        party.name
          .toLowerCase()
          .includes(search),
    );
  }, [
    availableParties,
    partySearch,
  ]);

  function selectParty(
    party: Balance,
  ) {
    setPartyId(
      String(party.id),
    );

    setPartySearch(
      party.name,
    );

    setShowPartyDropdown(false);

    setErrorMessage('');
  }

  function handlePartySearchChange(
    value: string,
  ) {
    setPartySearch(value);
    setPartyId('');
    setShowPartyDropdown(true);
    setErrorMessage('');
  }

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

    const paymentAmount =
      Number(amount);

    if (
      !Number.isFinite(
        paymentAmount,
      ) ||
      paymentAmount <= 0
    ) {
      setErrorMessage(
        'Payment amount must be greater than 0.',
      );
      return;
    }

    if (!paymentDate) {
      setErrorMessage(
        'Payment date and time is required.',
      );
      return;
    }

    const paymentDateValue =
      new Date(paymentDate);

    if (
      Number.isNaN(
        paymentDateValue.getTime(),
      )
    ) {
      setErrorMessage(
        'Enter a valid payment date and time.',
      );
      return;
    }

    const selectedBalance =
      availableParties.find(
        (party) =>
          String(party.id) ===
          partyId,
      );

    if (!selectedBalance) {
      setErrorMessage(
        'Selected party was not found.',
      );
      return;
    }

    if (
      paymentAmount >
      selectedBalance.balance
    ) {
      setErrorMessage(
        `Payment cannot be greater than the current outstanding balance of INR ${selectedBalance.balance.toLocaleString(
          'en-IN',
        )}.`,
      );
      return;
    }

    if (!paymentMethod) {
      setErrorMessage(
        'Select a payment method.',
      );
      return;
    }

    setSaving(true);

    try {
      if (
        mode === 'SUPPLIER'
      ) {
        const { error } =
          await supabase
            .from(
              'supplier_transactions',
            )
            .insert({
              supplier_id:
                Number(partyId),
              transaction_type:
                'PAYMENT',
              amount:
                paymentAmount,
              transaction_date:
                paymentDateValue.toISOString(),
              payment_method:
                paymentMethod,
              notes:
                notes.trim() ||
                null,
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
        const { error } =
          await supabase
            .from(
              'customer_transactions',
            )
            .insert({
              customer_id:
                Number(partyId),
              transaction_type:
                'PAYMENT',
              amount:
                paymentAmount,
              transaction_date:
                paymentDateValue.toISOString(),
              payment_method:
                paymentMethod,
              notes:
                notes.trim() ||
                null,
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
      setPartySearch('');
      setShowPartyDropdown(false);
      setAmount('');
      setPaymentMethod('');
      setPaymentDate(
        getLocalDateTimeValue(),
      );
      setNotes('');

      await loadData();
    } catch (error) {
      console.error(
        'Failed to record payment:',
        error,
      );

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
    return (
      <p>
        Loading payments...
      </p>
    );
  }

  return (
    <>
      <style>
        {`
          .payments-page {
            width: 100%;
            max-width: 800px;
            margin: 0 auto;
          }

          .payments-mode {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 10px;
            margin-bottom: 20px;
          }

          .payments-mode button {
            min-height: 44px;
          }

          .payments-mode button.active {
            background: #eff6ff;
            border-color: #2563eb;
            color: #1d4ed8;
          }

          .payments-card {
            padding: 20px;
            background: #ffffff;
            border: 1px solid #e4e7ec;
            border-radius: 14px;
            box-shadow:
              0 1px 2px rgba(16, 24, 40, 0.05);
          }

          .payments-field {
            position: relative;
            margin-bottom: 16px;
          }

          .payments-field label {
            display: block;
            margin-bottom: 6px;
            color: #101828;
            font-size: 14px;
            font-weight: 600;
          }

          .payments-field input,
          .payments-field select,
          .payments-field textarea {
            width: 100%;
            min-height: 42px;
            padding: 9px 12px;
            box-sizing: border-box;
            border: 1px solid #d0d5dd;
            border-radius: 6px;
            background: #ffffff;
            color: #101828;
            font-size: 14px;
          }

          .payments-field input:focus,
          .payments-field select:focus,
          .payments-field textarea:focus {
            outline: none;
            border-color: #2563eb;
            box-shadow:
              0 0 0 3px rgba(37, 99, 235, 0.12);
          }

          .party-picker {
            position: relative;
          }

          .party-picker-clear {
            position: absolute;
            right: 8px;
            top: 34px;
            width: 28px;
            min-height: 28px;
            padding: 0;
            border: 0;
            background: transparent;
            color: #667085;
            font-size: 18px;
          }

          .party-picker-clear:hover {
            background: #f2f4f7;
          }

          .party-dropdown {
            position: absolute;
            z-index: 30;
            left: 0;
            right: 0;
            top: calc(100% + 4px);
            max-height: 280px;
            overflow-y: auto;
            background: #ffffff;
            border: 1px solid #d0d5dd;
            border-radius: 8px;
            box-shadow:
              0 10px 25px rgba(16, 24, 40, 0.12);
          }

          .party-option {
            width: 100%;
            min-height: auto;
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 16px;
            padding: 11px 12px;
            border: 0;
            border-bottom: 1px solid #f2f4f7;
            border-radius: 0;
            background: #ffffff;
            text-align: left;
          }

          .party-option:last-child {
            border-bottom: 0;
          }

          .party-option:hover {
            background: #eff6ff;
          }

          .party-name {
            color: #101828;
            font-size: 14px;
            font-weight: 600;
          }

          .party-due {
            flex: 0 0 auto;
            color: #b45309;
            font-size: 13px;
            font-weight: 600;
          }

          .party-hint {
            margin-top: 6px;
            color: #667085;
            font-size: 12px;
          }

          .selected-party {
            margin-top: 8px;
            padding: 10px 12px;
            border: 1px solid #bfdbfe;
            border-radius: 8px;
            background: #eff6ff;
            color: #1e40af;
            font-size: 13px;
          }

          .selected-party strong {
            color: #101828;
          }

          .payment-summary {
            margin-bottom: 16px;
            padding: 12px 14px;
            border-radius: 8px;
            background: #f9fafb;
            border: 1px solid #e4e7ec;
          }

          .payment-summary p {
            margin: 0;
          }

          .payment-date-hint {
            margin-top: 6px;
            color: #667085;
            font-size: 12px;
          }

          .payments-message {
            margin-bottom: 16px;
            padding: 11px 13px;
            border-radius: 8px;
            font-size: 14px;
          }

          .payments-success {
            border: 1px solid #bbf7d0;
            background: #f0fdf4;
            color: #15803d;
          }

          .payments-error {
            border: 1px solid #fecaca;
            background: #fef2f2;
            color: #dc2626;
          }

          .payments-submit {
            width: 100%;
            margin-top: 4px;
          }

          @media (max-width: 600px) {
            .payments-mode {
              grid-template-columns: 1fr;
            }

            .payments-card {
              padding: 16px;
              border-radius: 10px;
            }

            .party-option {
              align-items: flex-start;
              flex-direction: column;
              gap: 3px;
            }
          }
        `}
      </style>

      <main className="payments-page">
        <h1>Payments</h1>

        {message && (
          <div className="payments-message payments-success">
            {message}
          </div>
        )}

        {errorMessage && (
          <div className="payments-message payments-error">
            {errorMessage}
          </div>
        )}

        <div className="payments-mode">
          <button
            type="button"
            className={
              mode === 'SUPPLIER'
                ? 'active'
                : ''
            }
            onClick={() =>
              changeMode(
                'SUPPLIER',
              )
            }
          >
            Pay Supplier
          </button>

          <button
            type="button"
            className={
              mode === 'CUSTOMER'
                ? 'active'
                : ''
            }
            onClick={() =>
              changeMode(
                'CUSTOMER',
              )
            }
          >
            Collect Customer Payment
          </button>
        </div>

        <section className="payments-card">
          <h2>
            {mode === 'SUPPLIER'
              ? 'Pay Supplier'
              : 'Collect Customer Payment'}
          </h2>

          <form
            onSubmit={
              handleSubmit
            }
          >
            <div className="payments-field party-picker">
              <label htmlFor="party-search">
                {mode === 'SUPPLIER'
                  ? 'Supplier'
                  : 'Customer'}
              </label>

              <input
                id="party-search"
                type="text"
                value={partySearch}
                onChange={(
                  event,
                ) =>
                  handlePartySearchChange(
                    event.target.value,
                  )
                }
                onFocus={() =>
                  setShowPartyDropdown(
                    true,
                  )
                }
                autoComplete="off"
                placeholder={
                  mode === 'SUPPLIER'
                    ? 'Search supplier'
                    : 'Search customer'
                }
              />

              {partySearch && (
                <button
                  type="button"
                  className="party-picker-clear"
                  aria-label={`Clear ${
                    mode === 'SUPPLIER'
                      ? 'supplier'
                      : 'customer'
                  }`}
                  onClick={() => {
                    setPartySearch(
                      '',
                    );
                    setPartyId('');
                    setShowPartyDropdown(
                      true,
                    );
                  }}
                >
                  ×
                </button>
              )}

              {showPartyDropdown && (
                <div className="party-dropdown">
                  {filteredParties.length ===
                  0 ? (
                    <div
                      style={{
                        padding:
                          '12px',
                        color:
                          '#667085',
                        fontSize:
                          '14px',
                      }}
                    >
                      No outstanding{' '}
                      {mode ===
                      'SUPPLIER'
                        ? 'suppliers'
                        : 'customers'}{' '}
                      found.
                    </div>
                  ) : (
                    filteredParties.map(
                      (party) => (
                        <button
                          key={
                            party.id
                          }
                          type="button"
                          className="party-option"
                          onMouseDown={(
                            event,
                          ) =>
                            event.preventDefault()
                          }
                          onClick={() =>
                            selectParty(
                              party,
                            )
                          }
                        >
                          <span className="party-name">
                            {
                              party.name
                            }
                          </span>

                          <span className="party-due">
                            Due INR{' '}
                            {party.balance.toLocaleString(
                              'en-IN',
                            )}
                          </span>
                        </button>
                      ),
                    )
                  )}
                </div>
              )}

              <p className="party-hint">
                Search by name and select the
                outstanding party.
              </p>

              {selectedParty && (
                <div className="selected-party">
                  <strong>
                    Selected:
                  </strong>{' '}
                  {selectedParty.name}
                  {' — '}
                  Due INR{' '}
                  {selectedParty.balance.toLocaleString(
                    'en-IN',
                  )}
                </div>
              )}
            </div>

            <div className="payments-field">
              <label htmlFor="amount">
                Amount
              </label>

              <input
                id="amount"
                type="number"
                min="0.01"
                step="0.01"
                value={amount}
                onChange={(
                  event,
                ) =>
                  setAmount(
                    event.target
                      .value,
                  )
                }
                placeholder="Payment amount"
              />
            </div>

            <div className="payments-field">
              <label htmlFor="paymentDate">
                Payment Date &amp; Time
              </label>

              <input
                id="paymentDate"
                type="datetime-local"
                value={paymentDate}
                onChange={(
                  event,
                ) =>
                  setPaymentDate(
                    event.target
                      .value,
                  )
                }
                required
              />

              <p className="payment-date-hint">
                Defaults to now. Change this when
                the payment actually happened earlier.
              </p>
            </div>

            <div className="payments-field">
              <label htmlFor="paymentMethod">
                Payment Method
              </label>

              <select
                id="paymentMethod"
                value={
                  paymentMethod
                }
                onChange={(
                  event,
                ) =>
                  setPaymentMethod(
                    event.target
                      .value,
                  )
                }
              >
                <option value="">
                  Select payment method
                </option>

                <option value="CASH">
                  Cash
                </option>

                <option value="UPI">
                  UPI
                </option>

                <option value="BANK_TRANSFER">
                  Bank Transfer
                </option>

                <option value="CARD">
                  Card
                </option>

                <option value="OTHER">
                  Other
                </option>
              </select>
            </div>

            <div className="payments-field">
              <label htmlFor="notes">
                Notes
              </label>

              <textarea
                id="notes"
                value={notes}
                onChange={(
                  event,
                ) =>
                  setNotes(
                    event.target
                      .value,
                  )
                }
                rows={3}
                placeholder="Optional notes"
              />
            </div>

            <button
              type="submit"
              className="payments-submit"
              disabled={saving}
            >
              {saving
                ? 'Saving...'
                : 'Save Payment'}
            </button>
          </form>
        </section>
      </main>
    </>
  );
}

export default Payments;
