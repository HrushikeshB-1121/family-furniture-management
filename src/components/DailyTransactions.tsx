import {
  useEffect,
  useMemo,
  useState,
} from 'react';
import { supabase } from '../lib/supabase';

const IST_TIME_ZONE = 'Asia/Kolkata';
const IST_OFFSET_MINUTES = 330;

type Sale = {
  id: number;
  sale_date: string;
  total_amount: number;
  paid_now: number;
  payment_method: string | null;
  customer_id: number | null;
  notes: string | null;
  customers:
    | {
        name: string;
      }
    | null;
};

type CustomerPayment = {
  id: number;
  customer_id: number;
  amount: number;
  transaction_date: string;
  payment_method: string | null;
  notes: string | null;
  customers:
    | {
        name: string;
      }
    | null;
};

type SupplierPayment = {
  id: number;
  supplier_id: number;
  purchase_id: number | null;
  amount: number;
  transaction_date: string;
  payment_method: string | null;
  notes: string | null;
  suppliers:
    | {
        name: string;
      }
    | null;
};

type Expense = {
  id: number;
  expense_date: string;
  category: string;
  amount: number;
  payment_method: string;
  notes: string | null;
};

type CashMovement = {
  id: number;
  movement_type:
    | 'OWNER_CASH_IN'
    | 'OWNER_CASH_OUT'
    | 'CASH_ADJUSTMENT';
  amount: number;
  movement_date: string;
  notes: string | null;
};

type PaymentMethodTotals = {
  CASH: number;
  UPI: number;
  CARD: number;
  BANK_TRANSFER: number;
  OTHER: number;
};

function getTodayDate() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: IST_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());

  const values = Object.fromEntries(
    parts
      .filter((part) => part.type !== 'literal')
      .map((part) => [
        part.type,
        part.value,
      ]),
  );

  return `${values.year}-${values.month}-${values.day}`;
}

function getDayBounds(dateValue: string) {
  const [year, month, day] =
    dateValue
      .split('-')
      .map(Number);

  const start = new Date(
    Date.UTC(
      year,
      month - 1,
      day,
      0,
      0,
      0,
      0,
    ) -
      IST_OFFSET_MINUTES *
        60 *
        1000,
  );

  const end = new Date(
    Date.UTC(
      year,
      month - 1,
      day + 1,
      0,
      0,
      0,
      0,
    ) -
      IST_OFFSET_MINUTES *
        60 *
        1000,
  );

  return {
    start,
    end,
  };
}

function formatMoney(
  value: number,
) {
  return value.toLocaleString(
    'en-IN',
  );
}

function formatTime(
  value: string,
) {
  return new Date(
    value,
  ).toLocaleTimeString(
    'en-IN',
    {
      timeZone:
        IST_TIME_ZONE,
      hour: '2-digit',
      minute: '2-digit',
    },
  );
}

function paymentMethodLabel(
  value: string | null,
) {
  switch (value) {
    case 'CASH':
      return 'Cash';

    case 'UPI':
      return 'UPI';

    case 'CARD':
      return 'Card';

    case 'BANK_TRANSFER':
      return 'Bank Transfer';

    default:
      return 'Other';
  }
}

function DailyTransactions() {
  const [selectedDate, setSelectedDate] =
    useState(getTodayDate());

  const [sales, setSales] =
    useState<Sale[]>([]);

  const [customerPayments, setCustomerPayments] =
    useState<CustomerPayment[]>([]);

  const [supplierPayments, setSupplierPayments] =
    useState<SupplierPayment[]>([]);

  const [expenses, setExpenses] =
    useState<Expense[]>([]);

  const [cashMovements, setCashMovements] =
    useState<CashMovement[]>([]);

  const [openingCash, setOpeningCash] =
    useState(0);

  const [loading, setLoading] =
    useState(true);

  const [errorMessage, setErrorMessage] =
    useState('');

  const [expandedSection, setExpandedSection] =
    useState<
      | 'SALES'
      | 'CUSTOMER_PAYMENTS'
      | 'SUPPLIER_PAYMENTS'
      | 'EXPENSES'
      | 'CASH_MOVEMENTS'
      | null
    >(null);

  async function loadData(
    dateValue: string,
  ) {
    setLoading(true);
    setErrorMessage('');

    const {
      start,
      end,
    } = getDayBounds(
      dateValue,
    );

    const startIso =
      start.toISOString();

    const endIso =
      end.toISOString();

    const [
      salesResult,
      customerPaymentsResult,
      supplierPaymentsResult,
      expensesResult,
      cashMovementsResult,
      priorSalesResult,
      priorCustomerPaymentsResult,
      priorSupplierPaymentsResult,
      priorExpensesResult,
      priorCashMovementsResult,
    ] = await Promise.all([
      supabase
        .from('sales')
        .select(`
          id,
          sale_date,
          total_amount,
          paid_now,
          payment_method,
          customer_id,
          notes,
          customers (
            name
          )
        `)
        .gte(
          'sale_date',
          startIso,
        )
        .lt(
          'sale_date',
          endIso,
        )
        .order(
          'sale_date',
          {
            ascending: true,
          },
        ),

      supabase
        .from(
          'customer_transactions',
        )
        .select(`
          id,
          customer_id,
          amount,
          transaction_date,
          payment_method,
          notes,
          customers (
            name
          )
        `)
        .eq(
          'transaction_type',
          'PAYMENT',
        )
        .gte(
          'transaction_date',
          startIso,
        )
        .lt(
          'transaction_date',
          endIso,
        )
        .order(
          'transaction_date',
          {
            ascending: true,
          },
        ),

      supabase
        .from(
          'supplier_transactions',
        )
        .select(`
          id,
          supplier_id,
          purchase_id,
          amount,
          transaction_date,
          payment_method,
          notes,
          suppliers (
            name
          )
        `)
        .eq(
          'transaction_type',
          'PAYMENT',
        )
        .gte(
          'transaction_date',
          startIso,
        )
        .lt(
          'transaction_date',
          endIso,
        )
        .order(
          'transaction_date',
          {
            ascending: true,
          },
        ),

      supabase
        .from('expenses')
        .select(`
          id,
          expense_date,
          category,
          amount,
          payment_method,
          notes
        `)
        .gte(
          'expense_date',
          startIso,
        )
        .lt(
          'expense_date',
          endIso,
        )
        .order(
          'expense_date',
          {
            ascending: true,
          },
        ),

      supabase
        .from('cash_movements')
        .select(`
          id,
          movement_type,
          amount,
          movement_date,
          notes
        `)
        .gte(
          'movement_date',
          startIso,
        )
        .lt(
          'movement_date',
          endIso,
        )
        .order(
          'movement_date',
          {
            ascending: true,
          },
        ),

      supabase
        .from('sales')
        .select(
          'paid_now, payment_method, sale_date',
        )
        .lt(
          'sale_date',
          startIso,
        ),

      supabase
        .from('customer_transactions')
        .select(
          'amount, payment_method, transaction_date',
        )
        .eq(
          'transaction_type',
          'PAYMENT',
        )
        .lt(
          'transaction_date',
          startIso,
        ),

      supabase
        .from('supplier_transactions')
        .select(
          'amount, payment_method, transaction_date',
        )
        .eq(
          'transaction_type',
          'PAYMENT',
        )
        .lt(
          'transaction_date',
          startIso,
        ),

      supabase
        .from('expenses')
        .select(
          'amount, payment_method, expense_date',
        )
        .lt(
          'expense_date',
          startIso,
        ),

      supabase
        .from('cash_movements')
        .select(
          'amount, movement_type, movement_date',
        )
        .lt(
          'movement_date',
          startIso,
        ),
    ]);

    const firstError =
      salesResult.error ??
      customerPaymentsResult.error ??
      supplierPaymentsResult.error ??
      expensesResult.error ??
      cashMovementsResult.error ??
      priorSalesResult.error ??
      priorCustomerPaymentsResult.error ??
      priorSupplierPaymentsResult.error ??
      priorExpensesResult.error ??
      priorCashMovementsResult.error;

    if (firstError) {
      console.error(
        'Failed to load daily transactions:',
        firstError,
      );

      setErrorMessage(
        firstError.message,
      );

      setSales([]);
      setCustomerPayments([]);
      setSupplierPayments([]);
      setExpenses([]);
      setCashMovements([]);
      setOpeningCash(0);
      setLoading(false);

      return;
    }

    setSales(
      (
        salesResult.data ?? []
      ).map(
        (sale) => ({
          ...sale,
          total_amount:
            Number(
              sale.total_amount,
            ),
          paid_now:
            Number(
              sale.paid_now,
            ),
        }),
      ) as unknown as Sale[],
    );

    setCustomerPayments(
      (
        customerPaymentsResult.data ??
        []
      ).map(
        (payment) => ({
          ...payment,
          amount:
            Number(
              payment.amount,
            ),
        }),
      ) as unknown as CustomerPayment[],
    );

    setSupplierPayments(
      (
        supplierPaymentsResult.data ??
        []
      ).map(
        (payment) => ({
          ...payment,
          amount:
            Number(
              payment.amount,
            ),
        }),
      ) as unknown as SupplierPayment[],
    );

    setExpenses(
      (
        expensesResult.data ??
        []
      ).map(
        (expense) => ({
          ...expense,
          amount:
            Number(
              expense.amount,
            ),
        }),
      ) as Expense[],
    );

    setCashMovements(
      (
        cashMovementsResult.data ??
        []
      ).map(
        (movement) => ({
          ...movement,
          id: Number(
            movement.id,
          ),
          amount: Number(
            movement.amount,
          ),
        }),
      ) as CashMovement[],
    );

    const priorCashIn =
      (priorSalesResult.data ?? []).reduce(
        (sum, sale) =>
          sum +
          (sale.payment_method ===
          'CASH'
            ? Number(
                sale.paid_now,
              )
            : 0),
        0,
      ) +
      (
        priorCustomerPaymentsResult.data ??
        []
      ).reduce(
        (sum, payment) =>
          sum +
          (payment.payment_method ===
          'CASH'
            ? Number(
                payment.amount,
              )
            : 0),
        0,
      ) +
      (
        priorCashMovementsResult.data ??
        []
      ).reduce(
        (sum, movement) =>
          movement.movement_type ===
          'OWNER_CASH_IN'
            ? sum +
              Number(
                movement.amount,
              )
            : sum,
        0,
      );

    const priorCashOut =
      (
        priorSupplierPaymentsResult.data ??
        []
      ).reduce(
        (sum, payment) =>
          sum +
          (payment.payment_method ===
          'CASH'
            ? Number(
                payment.amount,
              )
            : 0),
        0,
      ) +
      (
        priorExpensesResult.data ??
        []
      ).reduce(
        (sum, expense) =>
          sum +
          (expense.payment_method ===
          'CASH'
            ? Number(
                expense.amount,
              )
            : 0),
        0,
      ) +
      (
        priorCashMovementsResult.data ??
        []
      ).reduce(
        (sum, movement) =>
          movement.movement_type ===
          'OWNER_CASH_OUT'
            ? sum +
              Number(
                movement.amount,
              )
            : sum,
        0,
      );

    const priorAdjustments =
      (
        priorCashMovementsResult.data ??
        []
      ).reduce(
        (sum, movement) =>
          movement.movement_type ===
          'CASH_ADJUSTMENT'
            ? sum +
              Number(
                movement.amount,
              )
            : sum,
        0,
      );

    const calculatedOpeningCash =
      priorCashIn -
      priorCashOut +
      priorAdjustments;

    setOpeningCash(
      calculatedOpeningCash,
    );

    setLoading(false);
  }

  useEffect(() => {
    void loadData(
      selectedDate,
    );
  }, [selectedDate]);

  const salesTotal =
    useMemo(
      () =>
        sales.reduce(
          (
            total,
            sale,
          ) =>
            total +
            sale.total_amount,
          0,
        ),
      [sales],
    );

  const salesCollected =
    useMemo(
      () =>
        sales.reduce(
          (
            total,
            sale,
          ) =>
            total +
            sale.paid_now,
          0,
        ),
      [sales],
    );

  const salesDue =
    Math.max(
      salesTotal -
        salesCollected,
      0,
    );

  const customerPaymentsTotal =
    useMemo(
      () =>
        customerPayments.reduce(
          (
            total,
            payment,
          ) =>
            total +
            payment.amount,
          0,
        ),
      [customerPayments],
    );

  const supplierPaymentsTotal =
    useMemo(
      () =>
        supplierPayments.reduce(
          (
            total,
            payment,
          ) =>
            total +
            payment.amount,
          0,
        ),
      [supplierPayments],
    );

  const expensesTotal =
    useMemo(
      () =>
        expenses.reduce(
          (
            total,
            expense,
          ) =>
            total +
            expense.amount,
          0,
        ),
      [expenses],
    );

  const ownerCashInTotal =
    useMemo(
      () =>
        cashMovements
          .filter(
            (movement) =>
              movement.movement_type ===
              'OWNER_CASH_IN',
          )
          .reduce(
            (
              total,
              movement,
            ) =>
              total +
              movement.amount,
            0,
          ),
      [cashMovements],
    );

  const ownerCashOutTotal =
    useMemo(
      () =>
        cashMovements
          .filter(
            (movement) =>
              movement.movement_type ===
              'OWNER_CASH_OUT',
          )
          .reduce(
            (
              total,
              movement,
            ) =>
              total +
              movement.amount,
            0,
          ),
      [cashMovements],
    );

  const cashAdjustmentTotal =
    useMemo(
      () =>
        cashMovements
          .filter(
            (movement) =>
              movement.movement_type ===
              'CASH_ADJUSTMENT',
          )
          .reduce(
            (
              total,
              movement,
            ) =>
              total +
              movement.amount,
            0,
          ),
      [cashMovements],
    );

  const cashSalesCollected =
    sales.reduce(
      (
        total,
        sale,
      ) =>
        total +
        (sale.payment_method ===
        'CASH'
          ? sale.paid_now
          : 0),
      0,
    );

  const cashCustomerPayments =
    customerPayments.reduce(
      (
        total,
        payment,
      ) =>
        total +
        (payment.payment_method ===
        'CASH'
          ? payment.amount
          : 0),
      0,
    );

  const cashSupplierPayments =
    supplierPayments.reduce(
      (
        total,
        payment,
      ) =>
        total +
        (payment.payment_method ===
        'CASH'
          ? payment.amount
          : 0),
      0,
    );

  const cashExpenses =
    expenses.reduce(
      (
        total,
        expense,
      ) =>
        total +
        (expense.payment_method ===
        'CASH'
          ? expense.amount
          : 0),
      0,
    );

  const counterCashReceived =
    cashSalesCollected +
    cashCustomerPayments +
    ownerCashInTotal;

  const counterCashPaid =
    cashSupplierPayments +
    cashExpenses +
    ownerCashOutTotal;

  const closingCash =
    openingCash +
    counterCashReceived -
    counterCashPaid +
    cashAdjustmentTotal;

  const totalReceived =
    salesCollected +
    customerPaymentsTotal;

  const totalPaid =
    supplierPaymentsTotal +
    expensesTotal;

  const netMovement =
    totalReceived -
    totalPaid;

  const receivedByMethod =
    useMemo<PaymentMethodTotals>(
      () => {
        const totals: PaymentMethodTotals =
          {
            CASH: 0,
            UPI: 0,
            CARD: 0,
            BANK_TRANSFER: 0,
            OTHER: 0,
          };

        sales.forEach(
          (sale) => {
            const method =
              sale.payment_method;

            if (
              method ===
                'CASH' ||
              method ===
                'UPI' ||
              method ===
                'CARD' ||
              method ===
                'BANK_TRANSFER'
            ) {
              totals[method] +=
                sale.paid_now;
            } else {
              totals.OTHER +=
                sale.paid_now;
            }
          },
        );

        customerPayments.forEach(
          (payment) => {
            const method =
              payment.payment_method;

            if (
              method ===
                'CASH' ||
              method ===
                'UPI' ||
              method ===
                'CARD' ||
              method ===
                'BANK_TRANSFER'
            ) {
              totals[method] +=
                payment.amount;
            } else {
              totals.OTHER +=
                payment.amount;
            }
          },
        );

        return totals;
      },
      [
        sales,
        customerPayments,
      ],
    );

  const paidByMethod =
    useMemo<PaymentMethodTotals>(
      () => {
        const totals: PaymentMethodTotals =
          {
            CASH: 0,
            UPI: 0,
            CARD: 0,
            BANK_TRANSFER: 0,
            OTHER: 0,
          };

        supplierPayments.forEach(
          (payment) => {
            const method =
              payment.payment_method;

            if (
              method ===
                'CASH' ||
              method ===
                'UPI' ||
              method ===
                'CARD' ||
              method ===
                'BANK_TRANSFER'
            ) {
              totals[method] +=
                payment.amount;
            } else {
              totals.OTHER +=
                payment.amount;
            }
          },
        );

        expenses.forEach(
          (expense) => {
            const method =
              expense.payment_method;

            if (
              method ===
                'CASH' ||
              method ===
                'UPI' ||
              method ===
                'CARD' ||
              method ===
                'BANK_TRANSFER'
            ) {
              totals[method] +=
                expense.amount;
            } else {
              totals.OTHER +=
                expense.amount;
            }
          },
        );

        return totals;
      },
      [
        supplierPayments,
        expenses,
      ],
    );

  function toggleSection(
    section:
      | 'SALES'
      | 'CUSTOMER_PAYMENTS'
      | 'SUPPLIER_PAYMENTS'
      | 'EXPENSES'
      | 'CASH_MOVEMENTS',
  ) {
    setExpandedSection(
      (current) =>
        current === section
          ? null
          : section,
    );
  }

  return (
    <>
      <style>
        {`
          .daily-transactions-page {
            width: 100%;
            max-width: 1200px;
            margin: 0 auto;
            padding: 24px;
            box-sizing: border-box;
          }

          .daily-transactions-header {
            display: flex;
            align-items: flex-end;
            justify-content: space-between;
            gap: 20px;
            margin-bottom: 22px;
          }

          .daily-transactions-header h1 {
            margin: 0;
            color: #101828;
            font-size: 28px;
            line-height: 1.2;
          }

          .daily-transactions-description {
            margin-top: 7px;
            color: #667085;
            font-size: 14px;
          }

          .daily-transactions-date {
            flex: 0 0 auto;
          }

          .daily-transactions-date label {
            display: block;
            margin-bottom: 6px;
            color: #344054;
            font-size: 12px;
            font-weight: 600;
          }

          .daily-transactions-date input {
            min-height: 42px;
            padding: 8px 11px;
            border: 1px solid #d0d5dd;
            border-radius: 8px;
            background: #ffffff;
            color: #101828;
            font-size: 14px;
          }

          .daily-transactions-error {
            margin-bottom: 18px;
            padding: 12px 14px;
            border: 1px solid #fecaca;
            border-radius: 9px;
            background: #fef2f2;
            color: #b91c1c;
            font-size: 14px;
          }

          .daily-summary-grid {
            display: grid;
            grid-template-columns:
              repeat(4, minmax(0, 1fr));
            gap: 12px;
            margin-bottom: 18px;
          }

          .daily-summary-card {
            padding: 17px;
            background: #ffffff;
            border: 1px solid #e4e7ec;
            border-radius: 12px;
            box-shadow:
              0 1px 2px rgba(16, 24, 40, 0.05);
          }

          .daily-summary-label {
            color: #667085;
            font-size: 12px;
            font-weight: 600;
          }

          .daily-summary-value {
            margin-top: 6px;
            color: #101828;
            font-size: 24px;
            line-height: 1.2;
            font-weight: 750;
          }

          .daily-summary-meta {
            margin-top: 5px;
            color: #98a2b3;
            font-size: 11px;
          }

          .daily-summary-received {
            color: #15803d;
          }

          .daily-summary-paid {
            color: #b45309;
          }

          .daily-summary-net-positive {
            color: #15803d;
          }

          .daily-summary-net-negative {
            color: #dc2626;
          }

          .daily-section-grid {
            display: grid;
            grid-template-columns:
              repeat(2, minmax(0, 1fr));
            gap: 14px;
            margin-bottom: 18px;
          }

          .daily-section-card {
            background: #ffffff;
            border: 1px solid #e4e7ec;
            border-radius: 12px;
            overflow: hidden;
          }

          .daily-section-card-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 15px;
            padding: 16px 17px;
            border-bottom: 1px solid #e4e7ec;
            background: #f9fafb;
          }

          .daily-section-title {
            margin: 0;
            color: #101828;
            font-size: 15px;
            font-weight: 700;
          }

          .daily-section-main {
            padding: 17px;
          }

          .daily-section-amount {
            margin-top: 3px;
            color: #101828;
            font-size: 22px;
            font-weight: 750;
          }

          .daily-section-subtext {
            margin-top: 5px;
            color: #667085;
            font-size: 12px;
          }

          .daily-section-button {
            min-height: 35px;
            padding: 6px 10px;
            border: 1px solid #d0d5dd;
            border-radius: 7px;
            background: #ffffff;
            color: #344054;
            font-size: 12px;
            font-weight: 600;
            cursor: pointer;
          }

          .daily-section-button:hover {
            background: #f2f4f7;
          }

          .daily-detail {
            padding: 0 17px 17px;
          }

          .daily-detail-table-wrapper {
            width: 100%;
            overflow-x: auto;
          }

          .daily-detail-table {
            width: 100%;
            min-width: 620px;
            border-collapse: collapse;
          }

          .daily-detail-table th,
          .daily-detail-table td {
            padding: 9px 8px;
            border-bottom: 1px solid #eaecf0;
            text-align: left;
            vertical-align: top;
            font-size: 12px;
          }

          .daily-detail-table th {
            background: #f9fafb;
            color: #475467;
            font-weight: 650;
          }

          .daily-detail-table td strong {
            color: #101828;
          }

          .daily-detail-empty {
            padding: 14px;
            border: 1px dashed #d0d5dd;
            border-radius: 8px;
            color: #667085;
            font-size: 13px;
            text-align: center;
          }

          .daily-payment-breakdown {
            background: #ffffff;
            border: 1px solid #e4e7ec;
            border-radius: 12px;
            overflow: hidden;
          }

          .daily-payment-breakdown-header {
            padding: 16px 17px;
            border-bottom: 1px solid #e4e7ec;
            background: #f9fafb;
          }

          .daily-payment-breakdown-header h2 {
            margin: 0;
            color: #101828;
            font-size: 15px;
          }

          .daily-payment-grid {
            display: grid;
            grid-template-columns:
              repeat(5, minmax(0, 1fr));
          }

          .counter-cash-grid {
            grid-template-columns:
              repeat(5, minmax(0, 1fr));
          }

          .daily-payment-cell {
            padding: 15px;
            border-right: 1px solid #eaecf0;
          }

          .daily-payment-cell:last-child {
            border-right: 0;
          }

          .daily-payment-label {
            color: #667085;
            font-size: 11px;
            font-weight: 600;
          }

          .daily-payment-received-label {
            margin-top: 8px;
            color: #98a2b3;
            font-size: 10px;
          }

          .daily-payment-paid-label {
            margin-top: 8px;
            color: #98a2b3;
            font-size: 10px;
          }

          .daily-payment-value {
            margin-top: 3px;
            color: #101828;
            font-size: 15px;
            font-weight: 700;
          }

          .daily-payment-net {
            color: #15803d;
          }

          @media (max-width: 950px) {
            .daily-summary-grid {
              grid-template-columns:
                repeat(2, minmax(0, 1fr));
            }

            .daily-section-grid {
              grid-template-columns: 1fr;
            }
          }

          @media (max-width: 600px) {
            .daily-transactions-page {
              padding: 16px;
            }

            .daily-transactions-header {
              align-items: stretch;
              flex-direction: column;
              gap: 14px;
            }

            .daily-transactions-header h1 {
              font-size: 23px;
            }

            .daily-transactions-date input {
              width: 100%;
              box-sizing: border-box;
            }

            .daily-summary-grid {
              grid-template-columns: 1fr;
            }

            .daily-payment-grid {
              grid-template-columns:
                repeat(2, minmax(0, 1fr));
            }

            .daily-payment-cell {
              border-right: 1px solid #eaecf0;
              border-bottom: 1px solid #eaecf0;
            }

            .daily-payment-cell:nth-child(2n) {
              border-right: 0;
            }

            .daily-payment-cell:nth-last-child(-n + 1) {
              grid-column: 1 / -1;
              border-right: 0;
            }
          }
        `}
      </style>

      <main className="daily-transactions-page">
        <div className="daily-transactions-header">
          <div>
            <h1>
              Daily Transactions
            </h1>

            <p className="daily-transactions-description">
              Day-wise summary of sales,
              collections, payments, expenses,
              and counter cash movements.
            </p>
          </div>

          <div className="daily-transactions-date">
            <label htmlFor="daily-transaction-date">
              Select Date
            </label>

            <input
              id="daily-transaction-date"
              type="date"
              value={selectedDate}
              onChange={(event) =>
                setSelectedDate(
                  event.target.value,
                )
              }
            />
          </div>
        </div>

        {errorMessage && (
          <div className="daily-transactions-error">
            {errorMessage}
          </div>
        )}

        {loading ? (
          <p>
            Loading daily transactions...
          </p>
        ) : (
          <>
            <section className="daily-summary-grid">
              <article className="daily-summary-card">
                <div className="daily-summary-label">
                  Total Sales
                </div>

                <div className="daily-summary-value">
                  ₹{formatMoney(salesTotal)}
                </div>

                <div className="daily-summary-meta">
                  {sales.length} bill
                  {sales.length === 1
                    ? ''
                    : 's'}
                </div>
              </article>

              <article className="daily-summary-card">
                <div className="daily-summary-label">
                  Money Received
                </div>

                <div className="daily-summary-value daily-summary-received">
                  ₹
                  {formatMoney(
                    totalReceived,
                  )}
                </div>

                <div className="daily-summary-meta">
                  Today's bills +
                  old dues
                </div>
              </article>

              <article className="daily-summary-card">
                <div className="daily-summary-label">
                  Money Paid
                </div>

                <div className="daily-summary-value daily-summary-paid">
                  ₹{formatMoney(totalPaid)}
                </div>

                <div className="daily-summary-meta">
                  Supplier payments +
                  expenses
                </div>
              </article>

              <article className="daily-summary-card">
                <div className="daily-summary-label">
                  Net Movement
                </div>

                <div
                  className={[
                    'daily-summary-value',
                    netMovement >= 0
                      ? 'daily-summary-net-positive'
                      : 'daily-summary-net-negative',
                  ].join(' ')}
                >
                  ₹
                  {formatMoney(
                    netMovement,
                  )}
                </div>

                <div className="daily-summary-meta">
                  Received − Paid
                </div>
              </article>
            </section>

            <section className="daily-section-grid">
              <article className="daily-section-card">
                <div className="daily-section-card-header">
                  <h2 className="daily-section-title">
                    Today's Sales
                  </h2>

                  <button
                    type="button"
                    className="daily-section-button"
                    onClick={() =>
                      toggleSection(
                        'SALES',
                      )
                    }
                  >
                    {expandedSection ===
                    'SALES'
                      ? 'Hide Bills'
                      : 'View Bills'}
                  </button>
                </div>

                <div className="daily-section-main">
                  <div className="daily-section-amount">
                    ₹
                    {formatMoney(
                      salesTotal,
                    )}
                  </div>

                  <div className="daily-section-subtext">
                    {sales.length} bill
                    {sales.length === 1
                      ? ''
                      : 's'} · Collected ₹
                    {formatMoney(
                      salesCollected,
                    )}{' '}
                    · Due ₹
                    {formatMoney(
                      salesDue,
                    )}
                  </div>
                </div>

                {expandedSection ===
                  'SALES' && (
                  <div className="daily-detail">
                    {sales.length ===
                    0 ? (
                      <div className="daily-detail-empty">
                        No sales for
                        this day.
                      </div>
                    ) : (
                      <div className="daily-detail-table-wrapper">
                        <table className="daily-detail-table">
                          <thead>
                            <tr>
                              <th>
                                Time (IST)
                              </th>
                              <th>
                                Bill
                              </th>
                              <th>
                                Customer
                              </th>
                              <th>
                                Total
                              </th>
                              <th>
                                Paid
                              </th>
                              <th>
                                Due
                              </th>
                              <th>
                                Method
                              </th>
                            </tr>
                          </thead>

                          <tbody>
                            {sales.map(
                              (sale) => (
                                <tr
                                  key={
                                    sale.id
                                  }
                                >
                                  <td>
                                    {formatTime(
                                      sale.sale_date,
                                    )}
                                  </td>

                                  <td>
                                    <strong>
                                      #
                                      {
                                        sale.id
                                      }
                                    </strong>
                                  </td>

                                  <td>
                                    {
                                      sale
                                        .customers
                                        ?.name ??
                                      'Walk-in / Unknown'
                                    }
                                  </td>

                                  <td>
                                    ₹
                                    {formatMoney(
                                      sale.total_amount,
                                    )}
                                  </td>

                                  <td>
                                    ₹
                                    {formatMoney(
                                      sale.paid_now,
                                    )}
                                  </td>

                                  <td>
                                    ₹
                                    {formatMoney(
                                      Math.max(
                                        sale.total_amount -
                                          sale.paid_now,
                                        0,
                                      ),
                                    )}
                                  </td>

                                  <td>
                                    {paymentMethodLabel(
                                      sale.payment_method,
                                    )}
                                  </td>
                                </tr>
                              ),
                            )}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </article>

              <article className="daily-section-card">
                <div className="daily-section-card-header">
                  <h2 className="daily-section-title">
                    Customer Payments
                  </h2>

                  <button
                    type="button"
                    className="daily-section-button"
                    onClick={() =>
                      toggleSection(
                        'CUSTOMER_PAYMENTS',
                      )
                    }
                  >
                    {expandedSection ===
                    'CUSTOMER_PAYMENTS'
                      ? 'Hide Payments'
                      : 'View Payments'}
                  </button>
                </div>

                <div className="daily-section-main">
                  <div className="daily-section-amount">
                    ₹
                    {formatMoney(
                      customerPaymentsTotal,
                    )}
                  </div>

                  <div className="daily-section-subtext">
                    {customerPayments.length}{' '}
                    payment
                    {customerPayments.length ===
                    1
                      ? ''
                      : 's'} · Old dues
                    collected
                  </div>
                </div>

                {expandedSection ===
                  'CUSTOMER_PAYMENTS' && (
                  <div className="daily-detail">
                    {customerPayments.length ===
                    0 ? (
                      <div className="daily-detail-empty">
                        No customer
                        payments for
                        this day.
                      </div>
                    ) : (
                      <div className="daily-detail-table-wrapper">
                        <table className="daily-detail-table">
                          <thead>
                            <tr>
                              <th>
                                Time (IST)
                              </th>
                              <th>
                                Customer
                              </th>
                              <th>
                                Amount
                              </th>
                              <th>
                                Method
                              </th>
                              <th>
                                Notes
                              </th>
                            </tr>
                          </thead>

                          <tbody>
                            {customerPayments.map(
                              (
                                payment,
                              ) => (
                                <tr
                                  key={
                                    payment.id
                                  }
                                >
                                  <td>
                                    {formatTime(
                                      payment.transaction_date,
                                    )}
                                  </td>

                                  <td>
                                    <strong>
                                      {
                                        payment
                                          .customers
                                          ?.name ??
                                        'Unknown Customer'
                                      }
                                    </strong>
                                  </td>

                                  <td>
                                    ₹
                                    {formatMoney(
                                      payment.amount,
                                    )}
                                  </td>

                                  <td>
                                    {paymentMethodLabel(
                                      payment.payment_method,
                                    )}
                                  </td>

                                  <td>
                                    {
                                      payment.notes ??
                                      '-'
                                    }
                                  </td>
                                </tr>
                              ),
                            )}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </article>

              <article className="daily-section-card">
                <div className="daily-section-card-header">
                  <h2 className="daily-section-title">
                    Supplier Payments
                  </h2>

                  <button
                    type="button"
                    className="daily-section-button"
                    onClick={() =>
                      toggleSection(
                        'SUPPLIER_PAYMENTS',
                      )
                    }
                  >
                    {expandedSection ===
                    'SUPPLIER_PAYMENTS'
                      ? 'Hide Payments'
                      : 'View Payments'}
                  </button>
                </div>

                <div className="daily-section-main">
                  <div className="daily-section-amount">
                    ₹
                    {formatMoney(
                      supplierPaymentsTotal,
                    )}
                  </div>

                  <div className="daily-section-subtext">
                    {supplierPayments.length}{' '}
                    payment
                    {supplierPayments.length ===
                    1
                      ? ''
                      : 's'} · Paid to
                    suppliers
                  </div>
                </div>

                {expandedSection ===
                  'SUPPLIER_PAYMENTS' && (
                  <div className="daily-detail">
                    {supplierPayments.length ===
                    0 ? (
                      <div className="daily-detail-empty">
                        No supplier
                        payments for
                        this day.
                      </div>
                    ) : (
                      <div className="daily-detail-table-wrapper">
                        <table className="daily-detail-table">
                          <thead>
                            <tr>
                              <th>
                                Time (IST)
                              </th>
                              <th>
                                Supplier
                              </th>
                              <th>
                                Purchase
                              </th>
                              <th>
                                Amount
                              </th>
                              <th>
                                Method
                              </th>
                              <th>
                                Notes
                              </th>
                            </tr>
                          </thead>

                          <tbody>
                            {supplierPayments.map(
                              (
                                payment,
                              ) => (
                                <tr
                                  key={
                                    payment.id
                                  }
                                >
                                  <td>
                                    {formatTime(
                                      payment.transaction_date,
                                    )}
                                  </td>

                                  <td>
                                    <strong>
                                      {
                                        payment
                                          .suppliers
                                          ?.name ??
                                        'Unknown Supplier'
                                      }
                                    </strong>
                                  </td>

                                  <td>
                                    {payment.purchase_id !==
                                    null
                                      ? `#${payment.purchase_id}`
                                      : '-'}
                                  </td>

                                  <td>
                                    ₹
                                    {formatMoney(
                                      payment.amount,
                                    )}
                                  </td>

                                  <td>
                                    {paymentMethodLabel(
                                      payment.payment_method,
                                    )}
                                  </td>

                                  <td>
                                    {
                                      payment.notes ??
                                      '-'
                                    }
                                  </td>
                                </tr>
                              ),
                            )}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </article>

              <article className="daily-section-card">
                <div className="daily-section-card-header">
                  <h2 className="daily-section-title">
                    Shop Expenses
                  </h2>

                  <button
                    type="button"
                    className="daily-section-button"
                    onClick={() =>
                      toggleSection(
                        'EXPENSES',
                      )
                    }
                  >
                    {expandedSection ===
                    'EXPENSES'
                      ? 'Hide Expenses'
                      : 'View Expenses'}
                  </button>
                </div>

                <div className="daily-section-main">
                  <div className="daily-section-amount">
                    ₹
                    {formatMoney(
                      expensesTotal,
                    )}
                  </div>

                  <div className="daily-section-subtext">
                    {expenses.length} expense
                    {expenses.length ===
                    1
                      ? ''
                      : 's'} recorded
                  </div>
                </div>

                {expandedSection ===
                  'EXPENSES' && (
                  <div className="daily-detail">
                    {expenses.length ===
                    0 ? (
                      <div className="daily-detail-empty">
                        No expenses for
                        this day.
                      </div>
                    ) : (
                      <div className="daily-detail-table-wrapper">
                        <table className="daily-detail-table">
                          <thead>
                            <tr>
                              <th>
                                Time (IST)
                              </th>
                              <th>
                                Category
                              </th>
                              <th>
                                Amount
                              </th>
                              <th>
                                Method
                              </th>
                              <th>
                                Notes
                              </th>
                            </tr>
                          </thead>

                          <tbody>
                            {expenses.map(
                              (
                                expense,
                              ) => (
                                <tr
                                  key={
                                    expense.id
                                  }
                                >
                                  <td>
                                    {formatTime(
                                      expense.expense_date,
                                    )}
                                  </td>

                                  <td>
                                    <strong>
                                      {
                                        expense.category
                                      }
                                    </strong>
                                  </td>

                                  <td>
                                    ₹
                                    {formatMoney(
                                      expense.amount,
                                    )}
                                  </td>

                                  <td>
                                    {paymentMethodLabel(
                                      expense.payment_method,
                                    )}
                                  </td>

                                  <td>
                                    {
                                      expense.notes ??
                                      '-'
                                    }
                                  </td>
                                </tr>
                              ),
                            )}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </article>

              <article className="daily-section-card">
                <div className="daily-section-card-header">
                  <h2 className="daily-section-title">
                    Cash Movements
                  </h2>

                  <button
                    type="button"
                    className="daily-section-button"
                    onClick={() =>
                      toggleSection(
                        'CASH_MOVEMENTS',
                      )
                    }
                  >
                    {expandedSection ===
                    'CASH_MOVEMENTS'
                      ? 'Hide Movements'
                      : 'View Movements'}
                  </button>
                </div>

                <div className="daily-section-main">
                  <div className="daily-section-amount">
                    ₹
                    {formatMoney(
                      ownerCashInTotal +
                        ownerCashOutTotal,
                    )}
                  </div>

                  <div className="daily-section-subtext">
                    Added ₹
                    {formatMoney(
                      ownerCashInTotal,
                    )}
                    {' · '}
                    Taken ₹
                    {formatMoney(
                      ownerCashOutTotal,
                    )}
                    {' · '}
                    Adjustment ₹
                    {formatMoney(
                      cashAdjustmentTotal,
                    )}
                  </div>
                </div>

                {expandedSection ===
                  'CASH_MOVEMENTS' && (
                  <div className="daily-detail">
                    {cashMovements.length ===
                    0 ? (
                      <div className="daily-detail-empty">
                        No cash movements
                        for this day.
                      </div>
                    ) : (
                      <div className="daily-detail-table-wrapper">
                        <table className="daily-detail-table">
                          <thead>
                            <tr>
                              <th>
                                Time (IST)
                              </th>
                              <th>
                                Type
                              </th>
                              <th>
                                Amount
                              </th>
                              <th>
                                Notes
                              </th>
                            </tr>
                          </thead>

                          <tbody>
                            {cashMovements.map(
                              (
                                movement,
                              ) => {
                                const label =
                                  movement.movement_type ===
                                  'OWNER_CASH_IN'
                                    ? 'Money Added to Shop'
                                    : movement.movement_type ===
                                        'OWNER_CASH_OUT'
                                      ? 'Money Taken from Shop'
                                      : 'Cash Adjustment';

                                const displayAmount =
                                  movement.movement_type ===
                                  'CASH_ADJUSTMENT'
                                    ? `${
                                        movement.amount >=
                                        0
                                          ? '+'
                                          : ''
                                      }₹${formatMoney(
                                        movement.amount,
                                      )}`
                                    : `₹${formatMoney(
                                        movement.amount,
                                      )}`;

                                return (
                                  <tr
                                    key={
                                      movement.id
                                    }
                                  >
                                    <td>
                                      {formatTime(
                                        movement.movement_date,
                                      )}
                                    </td>

                                    <td>
                                      <strong>
                                        {
                                          label
                                        }
                                      </strong>
                                    </td>

                                    <td>
                                      {
                                        displayAmount
                                      }
                                    </td>

                                    <td>
                                      {
                                        movement.notes ??
                                        '-'
                                      }
                                    </td>
                                  </tr>
                                );
                              },
                            )}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </article>
            </section>

            <section className="daily-payment-breakdown">
              <div className="daily-payment-breakdown-header">
                <h2>
                  Counter Cash
                </h2>
              </div>

              <div className="daily-payment-grid counter-cash-grid">
                <div className="daily-payment-cell">
                  <div className="daily-payment-label">
                    Opening Cash
                  </div>

                  <div className="daily-payment-value">
                    ₹
                    {formatMoney(
                      openingCash,
                    )}
                  </div>

                  <div className="daily-payment-received-label">
                    Starts from ₹0 and carries
                    forward automatically
                  </div>
                </div>

                <div className="daily-payment-cell">
                  <div className="daily-payment-label">
                    Cash Received
                  </div>

                  <div className="daily-payment-value">
                    ₹
                    {formatMoney(
                      counterCashReceived,
                    )}
                  </div>

                  <div className="daily-payment-received-label">
                    Cash sales + customer cash +
                    money added
                  </div>
                </div>

                <div className="daily-payment-cell">
                  <div className="daily-payment-label">
                    Cash Paid
                  </div>

                  <div className="daily-payment-value">
                    ₹
                    {formatMoney(
                      counterCashPaid,
                    )}
                  </div>

                  <div className="daily-payment-paid-label">
                    Supplier cash + expenses +
                    money taken
                  </div>
                </div>

                <div className="daily-payment-cell">
                  <div className="daily-payment-label">
                    Cash Adjustment
                  </div>

                  <div className="daily-payment-value">
                    ₹
                    {formatMoney(
                      cashAdjustmentTotal,
                    )}
                  </div>

                  <div className="daily-payment-received-label">
                    Positive = excess · Negative =
                    shortage
                  </div>
                </div>

                <div className="daily-payment-cell">
                  <div className="daily-payment-label">
                    Closing Cash
                  </div>

                  <div className="daily-payment-value">
                    ₹
                    {formatMoney(
                      closingCash,
                    )}
                  </div>

                  <div className="daily-payment-received-label">
                    Expected cash remaining in the
                    counter
                  </div>
                </div>
              </div>
            </section>

            <section className="daily-payment-breakdown">
              <div className="daily-payment-breakdown-header">
                <h2>
                  Payment Method Breakdown
                </h2>
              </div>

              <div className="daily-payment-grid">
                {[
                  [
                    'Cash',
                    'CASH',
                  ],
                  [
                    'UPI',
                    'UPI',
                  ],
                  [
                    'Bank Transfer',
                    'BANK_TRANSFER',
                  ],
                  [
                    'Card',
                    'CARD',
                  ],
                  [
                    'Other',
                    'OTHER',
                  ],
                ].map(
                  ([
                    label,
                    key,
                  ]) => {
                    const method =
                      key as keyof PaymentMethodTotals;

                    const received =
                      receivedByMethod[
                        method
                      ];

                    const paid =
                      paidByMethod[
                        method
                      ];

                    const net =
                      received -
                      paid;

                    return (
                      <div
                        key={key}
                        className="daily-payment-cell"
                      >
                        <div className="daily-payment-label">
                          {label}
                        </div>

                        <div className="daily-payment-received-label">
                          Received
                        </div>

                        <div className="daily-payment-value">
                          ₹
                          {formatMoney(
                            received,
                          )}
                        </div>

                        <div className="daily-payment-paid-label">
                          Paid
                        </div>

                        <div className="daily-payment-value">
                          ₹
                          {formatMoney(
                            paid,
                          )}
                        </div>

                        <div className="daily-payment-received-label">
                          Net
                        </div>

                        <div
                          className={[
                            'daily-payment-value',
                            net >= 0
                              ? 'daily-payment-net'
                              : '',
                          ].join(' ')}
                        >
                          ₹
                          {formatMoney(
                            net,
                          )}
                        </div>
                      </div>
                    );
                  },
                )}
              </div>
            </section>
          </>
        )}
      </main>
    </>
  );
}

export default DailyTransactions;