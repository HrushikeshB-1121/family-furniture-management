import {
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from 'react';
import { supabase } from '../lib/supabase';

const IST_TIME_ZONE = 'Asia/Kolkata';
const IST_OFFSET_MINUTES = 330;

type MovementType =
  | 'OWNER_CASH_IN'
  | 'OWNER_CASH_OUT'
  | 'CASH_ADJUSTMENT';

type CashMovement = {
  id: number;
  movement_type: MovementType;
  amount: number;
  movement_date: string;
  notes: string | null;
};

function getLocalDateTimeValue(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: IST_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);

  const values = Object.fromEntries(
    parts
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, part.value]),
  );

  return `${values.year}-${values.month}-${values.day}T${values.hour}:${values.minute}`;
}

function getTodayValue() {
  return getLocalDateTimeValue().slice(0, 10);
}

function parseIstDateTimeValue(value: string) {
  const [datePart, timePart] = value.split('T');

  if (!datePart || !timePart) {
    return new Date(NaN);
  }

  const [year, month, day] =
    datePart.split('-').map(Number);

  const [hour, minute] =
    timePart.split(':').map(Number);

  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day) ||
    !Number.isInteger(hour) ||
    !Number.isInteger(minute)
  ) {
    return new Date(NaN);
  }

  return new Date(
    Date.UTC(
      year,
      month - 1,
      day,
      hour,
      minute,
    ) -
      IST_OFFSET_MINUTES * 60 * 1000,
  );
}

function formatMoney(value: number) {
  return value.toLocaleString('en-IN');
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString('en-IN', {
    timeZone: IST_TIME_ZONE,
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getIstDate(value: string) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: IST_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(value));
}

function movementTypeLabel(type: MovementType) {
  switch (type) {
    case 'OWNER_CASH_IN':
      return 'Money Added to Shop';

    case 'OWNER_CASH_OUT':
      return 'Money Taken from Shop';

    case 'CASH_ADJUSTMENT':
      return 'Cash Adjustment';
  }
}

function CashMovements() {
  const [movements, setMovements] =
    useState<CashMovement[]>([]);

  const [movementType, setMovementType] =
    useState<MovementType>('OWNER_CASH_IN');

  const [amount, setAmount] = useState('');

  const [movementDate, setMovementDate] =
    useState(getLocalDateTimeValue());

  const [notes, setNotes] = useState('');

  const [filterFromDate, setFilterFromDate] =
    useState('');

  const [filterToDate, setFilterToDate] =
    useState('');

  const [filterType, setFilterType] =
    useState<MovementType | ''>('');

  const [editingId, setEditingId] =
    useState<number | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [deletingId, setDeletingId] =
    useState<number | null>(null);

  const [message, setMessage] = useState('');

  const [errorMessage, setErrorMessage] =
    useState('');

  useEffect(() => {
    void loadMovements();
  }, []);

  async function loadMovements() {
    setLoading(true);
    setErrorMessage('');

    const { data, error } = await supabase
      .from('cash_movements')
      .select(
        'id, movement_type, amount, movement_date, notes',
      )
      .order('movement_date', {
        ascending: false,
      });

    if (error) {
      console.error(
        'Failed to load cash movements:',
        error,
      );

      setErrorMessage(error.message);
      setMovements([]);
      setLoading(false);
      return;
    }

    setMovements(
      (data ?? []).map((movement) => ({
        ...movement,
        id: Number(movement.id),
        amount: Number(movement.amount),
      })) as CashMovement[],
    );

    setLoading(false);
  }

  function resetForm() {
    setEditingId(null);
    setMovementType('OWNER_CASH_IN');
    setAmount('');
    setMovementDate(getLocalDateTimeValue());
    setNotes('');
  }

  function startEditing(movement: CashMovement) {
    setMessage('');
    setErrorMessage('');

    setEditingId(movement.id);

    setMovementType(
      movement.movement_type,
    );

    setAmount(
      String(movement.amount),
    );

    setMovementDate(
      getLocalDateTimeValue(
        new Date(movement.movement_date),
      ),
    );

    setNotes(
      movement.notes ?? '',
    );

    window.setTimeout(() => {
      document
        .getElementById('cash-movement-form')
        ?.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
        });
    }, 0);
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    setMessage('');
    setErrorMessage('');

    const numericAmount =
      Number(amount);

    const movementDateValue =
      parseIstDateTimeValue(
        movementDate,
      );

    if (
      !Number.isFinite(
        numericAmount,
      )
    ) {
      setErrorMessage(
        'Enter a valid amount.',
      );
      return;
    }

    if (
      movementType ===
      'CASH_ADJUSTMENT'
        ? numericAmount === 0
        : numericAmount <= 0
    ) {
      setErrorMessage(
        movementType ===
        'CASH_ADJUSTMENT'
          ? 'Cash adjustment cannot be 0.'
          : 'Amount must be greater than 0.',
      );
      return;
    }

    if (
      !movementDate ||
      Number.isNaN(
        movementDateValue.getTime(),
      )
    ) {
      setErrorMessage(
        'Enter a valid date and time.',
      );
      return;
    }

    setSaving(true);

    const payload = {
      movement_type:
        movementType,

      amount:
        numericAmount,

      movement_date:
        movementDateValue.toISOString(),

      notes:
        notes.trim() || null,
    };

    const result =
      editingId === null
        ? await supabase
            .from(
              'cash_movements',
            )
            .insert(
              payload,
            )
        : await supabase
            .from(
              'cash_movements',
            )
            .update(
              payload,
            )
            .eq(
              'id',
              editingId,
            );

    if (result.error) {
      console.error(
        'Failed to save cash movement:',
        result.error,
      );

      setErrorMessage(
        result.error.message,
      );

      setSaving(false);
      return;
    }

    setMessage(
      editingId === null
        ? 'Cash movement recorded successfully.'
        : 'Cash movement updated successfully.',
    );

    resetForm();

    setSaving(false);

    await loadMovements();
  }

  async function handleDelete(
    movement: CashMovement,
  ) {
    const confirmed =
      window.confirm(
        `Delete ${movementTypeLabel(
          movement.movement_type,
        )} of INR ${Math.abs(
          movement.amount,
        ).toLocaleString(
          'en-IN',
        )}?`,
      );

    if (!confirmed) {
      return;
    }

    setMessage('');
    setErrorMessage('');

    setDeletingId(
      movement.id,
    );

    const { error } =
      await supabase
        .from(
          'cash_movements',
        )
        .delete()
        .eq(
          'id',
          movement.id,
        );

    if (error) {
      console.error(
        'Failed to delete cash movement:',
        error,
      );

      setErrorMessage(
        error.message,
      );

      setDeletingId(null);
      return;
    }

    if (
      editingId ===
      movement.id
    ) {
      resetForm();
    }

    setMessage(
      'Cash movement deleted successfully.',
    );

    setDeletingId(null);

    await loadMovements();
  }

  const filteredMovements =
    useMemo(() => {
      return movements.filter(
        (movement) => {
          const movementDate =
            getIstDate(
              movement.movement_date,
            );

          if (
            filterFromDate &&
            movementDate <
              filterFromDate
          ) {
            return false;
          }

          if (
            filterToDate &&
            movementDate >
              filterToDate
          ) {
            return false;
          }

          if (
            filterType &&
            movement.movement_type !==
              filterType
          ) {
            return false;
          }

          return true;
        },
      );
    }, [
      movements,
      filterFromDate,
      filterToDate,
      filterType,
    ]);

  const summary =
    useMemo(() => {
      return filteredMovements.reduce(
        (
          result,
          movement,
        ) => {
          if (
            movement.movement_type ===
            'OWNER_CASH_IN'
          ) {
            result.cashIn +=
              movement.amount;
          }

          if (
            movement.movement_type ===
            'OWNER_CASH_OUT'
          ) {
            result.cashOut +=
              movement.amount;
          }

          if (
            movement.movement_type ===
            'CASH_ADJUSTMENT'
          ) {
            result.adjustment +=
              movement.amount;
          }

          return result;
        },
        {
          cashIn: 0,
          cashOut: 0,
          adjustment: 0,
        },
      );
    }, [
      filteredMovements,
    ]);

  if (loading) {
    return (
      <p>
        Loading cash movements...
      </p>
    );
  }

  return (
    <>
      <style>
        {`
          .cash-movements-page {
            width: 100%;
            max-width: 1100px;
            margin: 0 auto;
          }

          .cash-movements-header {
            margin-bottom: 20px;
          }

          .cash-movements-header h1 {
            margin-bottom: 5px;
          }

          .cash-movements-description {
            color: #667085;
            font-size: 14px;
            line-height: 1.5;
          }

          .cash-movements-message {
            margin-bottom: 16px;
            padding: 11px 13px;
            border-radius: 8px;
            font-size: 14px;
          }

          .cash-movements-success {
            border: 1px solid #bbf7d0;
            background: #f0fdf4;
            color: #15803d;
          }

          .cash-movements-error {
            border: 1px solid #fecaca;
            background: #fef2f2;
            color: #dc2626;
          }

          .cash-movements-card {
            margin-bottom: 20px;
            padding: 20px;
            background: #ffffff;
            border: 1px solid #e4e7ec;
            border-radius: 14px;
            box-shadow:
              0 1px 2px rgba(16, 24, 40, 0.05);
            scroll-margin-top: 90px;
          }

          .cash-movements-card-header {
            margin-bottom: 16px;
          }

          .cash-movements-card-header h2 {
            margin-bottom: 5px;
          }

          .cash-movements-card-description {
            color: #667085;
            font-size: 13px;
            line-height: 1.5;
          }

          .cash-movements-type {
            display: grid;
            grid-template-columns: repeat(3, minmax(0, 1fr));
            gap: 10px;
            margin-bottom: 18px;
          }

          .cash-movements-type button {
            min-height: 45px;
          }

          .cash-movements-type button.active {
            background: #eff6ff;
            border-color: #2563eb;
            color: #1d4ed8;
          }

          .cash-movements-form-grid {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 14px;
          }

          .cash-movements-field.full {
            grid-column: 1 / -1;
          }

          .cash-movements-field label {
            display: block;
            margin-bottom: 6px;
            color: #101828;
            font-size: 13px;
            font-weight: 600;
          }

          .cash-movements-field input,
          .cash-movements-field textarea {
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

          .cash-movements-field input:focus,
          .cash-movements-field textarea:focus {
            outline: none;
            border-color: #2563eb;
            box-shadow:
              0 0 0 3px rgba(37, 99, 235, 0.12);
          }

          .cash-movements-hint {
            margin-top: 5px;
            color: #98a2b3;
            font-size: 11px;
            line-height: 1.4;
          }

          .cash-movements-actions {
            display: flex;
            flex-wrap: wrap;
            gap: 10px;
            margin-top: 16px;
          }

          .cash-movements-actions button {
            min-height: 40px;
          }

          .cash-movements-cancel {
            background: #ffffff;
            color: #344054;
            border-color: #d0d5dd;
          }

          .cash-movements-summary {
            display: grid;
            grid-template-columns: repeat(3, minmax(0, 1fr));
            gap: 12px;
            margin-bottom: 20px;
          }

          .cash-movements-summary-card {
            padding: 17px;
            background: #ffffff;
            border: 1px solid #e4e7ec;
            border-radius: 12px;
            box-shadow:
              0 1px 2px rgba(16, 24, 40, 0.05);
          }

          .cash-movements-summary-label {
            color: #667085;
            font-size: 12px;
            font-weight: 600;
          }

          .cash-movements-summary-value {
            margin-top: 5px;
            color: #101828;
            font-size: 22px;
            font-weight: 700;
          }

          .cash-movements-summary-subtext {
            margin-top: 5px;
            color: #98a2b3;
            font-size: 11px;
          }

          .cash-movements-filters {
            display: grid;
            grid-template-columns: repeat(3, minmax(0, 1fr));
            gap: 12px;
            margin-bottom: 14px;
          }

          .cash-movements-filter label {
            display: block;
            margin-bottom: 6px;
            color: #101828;
            font-size: 12px;
            font-weight: 600;
          }

          .cash-movements-filter input,
          .cash-movements-filter select {
            width: 100%;
            min-height: 40px;
            box-sizing: border-box;
            padding: 8px 10px;
            border: 1px solid #d0d5dd;
            border-radius: 6px;
            background: #ffffff;
            color: #101828;
            font-size: 13px;
          }

          .cash-movements-clear {
            width: 100%;
            min-height: 40px;
          }

          .cash-movements-table-wrapper {
            width: 100%;
            overflow-x: auto;
            -webkit-overflow-scrolling: touch;
            border: 1px solid #e4e7ec;
            border-radius: 10px;
          }

          .cash-movements-table {
            width: 100%;
            min-width: 850px;
            border-collapse: collapse;
          }

          .cash-movements-table th,
          .cash-movements-table td {
            padding: 11px 12px;
            border-bottom: 1px solid #eaecf0;
            text-align: left;
            vertical-align: top;
            font-size: 13px;
          }

          .cash-movements-table th {
            background: #f9fafb;
            color: #344054;
            font-size: 12px;
            font-weight: 700;
          }

          .cash-movements-table tbody tr:last-child td {
            border-bottom: 0;
          }

          .cash-movement-in {
            color: #15803d;
            font-weight: 700;
          }

          .cash-movement-out {
            color: #b45309;
            font-weight: 700;
          }

          .cash-movement-adjustment {
            color: #1d4ed8;
            font-weight: 700;
          }

          .cash-movement-notes {
            color: #667085;
          }

          .cash-movement-actions {
            white-space: nowrap;
          }

          .cash-movement-row-button {
            min-height: 32px;
            margin-right: 6px;
            padding: 5px 9px;
            font-size: 12px;
          }

          .cash-movement-delete {
            color: #b42318;
            border-color: #fecdca;
            background: #fff5f4;
          }

          .cash-movements-empty {
            padding: 28px 20px;
            text-align: center;
            border: 1px dashed #d0d5dd;
            border-radius: 10px;
            color: #667085;
          }

          @media (max-width: 850px) {
            .cash-movements-type,
            .cash-movements-form-grid,
            .cash-movements-summary,
            .cash-movements-filters {
              grid-template-columns: 1fr;
            }

            .cash-movements-field.full {
              grid-column: auto;
            }
          }

          @media (max-width: 600px) {
            .cash-movements-card {
              padding: 16px;
            }

            .cash-movements-actions button {
              width: 100%;
            }
          }
        `}
      </style>

      <main className="cash-movements-page">
        <div className="cash-movements-header">
          <h1>Cash Movements</h1>

          <p className="cash-movements-description">
            Record money moved between home and the shop
            counter, and record cash shortages or excess
            found during reconciliation.
          </p>
        </div>

        <section
          id="cash-movement-form"
          className="cash-movements-card"
        >
          <div className="cash-movements-card-header">
            <h2>
              {editingId === null
                ? 'Add Cash Movement'
                : 'Edit Cash Movement'}
            </h2>

            <p className="cash-movements-card-description">
              Owner cash movements are separate from sales,
              supplier/customer payments, and shop expenses.
              The system starts from ₹0; use Money Added to Shop
              for any cash physically placed in the counter.
            </p>
          </div>

          <div className="cash-movements-type">
            <button
              type="button"
              className={
                movementType ===
                'OWNER_CASH_IN'
                  ? 'active'
                  : ''
              }
              onClick={() =>
                setMovementType(
                  'OWNER_CASH_IN',
                )
              }
            >
              Money Added to Shop
            </button>

            <button
              type="button"
              className={
                movementType ===
                'OWNER_CASH_OUT'
                  ? 'active'
                  : ''
              }
              onClick={() =>
                setMovementType(
                  'OWNER_CASH_OUT',
                )
              }
            >
              Money Taken from Shop
            </button>

            <button
              type="button"
              className={
                movementType ===
                'CASH_ADJUSTMENT'
                  ? 'active'
                  : ''
              }
              onClick={() =>
                setMovementType(
                  'CASH_ADJUSTMENT',
                )
              }
            >
              Cash Adjustment
            </button>
          </div>

          <form
            onSubmit={
              handleSubmit
            }
          >
            <div className="cash-movements-form-grid">
              <div className="cash-movements-field">
                <label htmlFor="cash-movement-amount">
                  {movementType ===
                  'CASH_ADJUSTMENT'
                    ? 'Adjustment Amount'
                    : 'Amount'}
                </label>

                <input
                  id="cash-movement-amount"
                  type="number"
                  step="0.01"
                  min={
                    movementType ===
                    'CASH_ADJUSTMENT'
                      ? undefined
                      : '0.01'
                  }
                  value={amount}
                  onChange={(event) =>
                    setAmount(
                      event.target
                        .value,
                    )
                  }
                  placeholder={
                    movementType ===
                    'CASH_ADJUSTMENT'
                      ? 'Example: -500 or 500'
                      : 'Amount'
                  }
                  required
                />

                {movementType ===
                  'CASH_ADJUSTMENT' && (
                  <p className="cash-movements-hint">
                    Enter a negative amount for a shortage
                    and a positive amount for excess cash.
                  </p>
                )}
              </div>

              <div className="cash-movements-field">
                <label htmlFor="cash-movement-date">
                  Date &amp; Time
                </label>

                <input
                  id="cash-movement-date"
                  type="datetime-local"
                  value={movementDate}
                  onChange={(event) =>
                    setMovementDate(
                      event.target
                        .value,
                    )
                  }
                  required
                />

                <p className="cash-movements-hint">
                  IST (India). Defaults to now.
                  Change it when the movement actually happened earlier.
                </p>
              </div>

              <div className="cash-movements-field full">
                <label htmlFor="cash-movement-notes">
                  Notes
                </label>

                <textarea
                  id="cash-movement-notes"
                  rows={3}
                  value={notes}
                  onChange={(event) =>
                    setNotes(
                      event.target
                        .value,
                    )
                  }
                  placeholder={
                    movementType ===
                    'OWNER_CASH_IN'
                      ? 'Example: Opening counter cash'
                      : movementType ===
                          'OWNER_CASH_OUT'
                        ? 'Example: Took cash home'
                        : 'Example: Cash shortage found during closing'
                  }
                />
              </div>
            </div>

            <div className="cash-movements-actions">
              <button
                type="submit"
                disabled={saving}
              >
                {saving
                  ? 'Saving...'
                  : editingId ===
                      null
                    ? 'Save Cash Movement'
                    : 'Update Cash Movement'}
              </button>

              {editingId !==
                null && (
                <button
                  type="button"
                  className="cash-movements-cancel"
                  onClick={
                    resetForm
                  }
                  disabled={saving}
                >
                  Cancel Edit
                </button>
              )}
            </div>
          </form>
        </section>

        {message && (
          <div className="cash-movements-message cash-movements-success">
            {message}
          </div>
        )}

        {errorMessage && (
          <div className="cash-movements-message cash-movements-error">
            {errorMessage}
          </div>
        )}

        <section className="cash-movements-summary">
          <article className="cash-movements-summary-card">
            <div className="cash-movements-summary-label">
              Money Added
            </div>

            <div className="cash-movements-summary-value">
              INR {formatMoney(
                summary.cashIn,
              )}
            </div>

            <div className="cash-movements-summary-subtext">
              Home → Shop
            </div>
          </article>

          <article className="cash-movements-summary-card">
            <div className="cash-movements-summary-label">
              Money Taken
            </div>

            <div className="cash-movements-summary-value">
              INR {formatMoney(
                summary.cashOut,
              )}
            </div>

            <div className="cash-movements-summary-subtext">
              Shop → Home
            </div>
          </article>

          <article className="cash-movements-summary-card">
            <div className="cash-movements-summary-label">
              Cash Adjustments
            </div>

            <div className="cash-movements-summary-value">
              INR {formatMoney(
                summary.adjustment,
              )}
            </div>

            <div className="cash-movements-summary-subtext">
              Positive = excess · Negative = shortage
            </div>
          </article>
        </section>

        <section className="cash-movements-card">
          <div className="cash-movements-card-header">
            <h2>
              Cash Movement History
            </h2>

            <p className="cash-movements-card-description">
              Review owner cash movements and cash
              adjustments by date or type.
              All times are shown in IST.
            </p>
          </div>

          <div className="cash-movements-filters">
            <div className="cash-movements-filter">
              <label htmlFor="cash-movements-from-date">
                From Date
              </label>

              <input
                id="cash-movements-from-date"
                type="date"
                value={filterFromDate}
                max={getTodayValue()}
                onChange={(event) =>
                  setFilterFromDate(
                    event.target
                      .value,
                  )
                }
              />
            </div>

            <div className="cash-movements-filter">
              <label htmlFor="cash-movements-to-date">
                To Date
              </label>

              <input
                id="cash-movements-to-date"
                type="date"
                value={filterToDate}
                max={getTodayValue()}
                onChange={(event) =>
                  setFilterToDate(
                    event.target
                      .value,
                  )
                }
              />
            </div>

            <div className="cash-movements-filter">
              <label htmlFor="cash-movements-filter-type">
                Type
              </label>

              <select
                id="cash-movements-filter-type"
                value={filterType}
                onChange={(event) =>
                  setFilterType(
                    event.target
                      .value as MovementType | '',
                  )
                }
              >
                <option value="">
                  All types
                </option>

                <option value="OWNER_CASH_IN">
                  Money Added to Shop
                </option>

                <option value="OWNER_CASH_OUT">
                  Money Taken from Shop
                </option>

                <option value="CASH_ADJUSTMENT">
                  Cash Adjustment
                </option>
              </select>
            </div>
          </div>

          <button
            type="button"
            className="cash-movements-clear"
            onClick={() => {
              setFilterFromDate('');
              setFilterToDate('');
              setFilterType('');
            }}
          >
            Clear Filters
          </button>

          <div
            style={{
              marginTop: '14px',
            }}
          >
            {filteredMovements.length ===
            0 ? (
              <div className="cash-movements-empty">
                No cash movements found for the selected
                filters.
              </div>
            ) : (
              <div className="cash-movements-table-wrapper">
                <table className="cash-movements-table">
                  <thead>
                    <tr>
                      <th>
                        Date &amp; Time
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

                      <th>
                        Actions
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {filteredMovements.map(
                      (
                        movement,
                      ) => {
                        const amountClass =
                          movement.movement_type ===
                          'OWNER_CASH_IN'
                            ? 'cash-movement-in'
                            : movement.movement_type ===
                                'OWNER_CASH_OUT'
                              ? 'cash-movement-out'
                              : 'cash-movement-adjustment';

                        const displayAmount =
                          movement.movement_type ===
                          'CASH_ADJUSTMENT'
                            ? `${
                                movement.amount >=
                                0
                                  ? '+'
                                  : ''
                              }INR ${formatMoney(
                                movement.amount,
                              )}`
                            : `INR ${formatMoney(
                                movement.amount,
                              )}`;

                        return (
                          <tr
                            key={
                              movement.id
                            }
                          >
                            <td>
                              {formatDateTime(
                                movement.movement_date,
                              )}
                            </td>

                            <td>
                              <strong>
                                {movementTypeLabel(
                                  movement.movement_type,
                                )}
                              </strong>
                            </td>

                            <td
                              className={
                                amountClass
                              }
                            >
                              {
                                displayAmount
                              }
                            </td>

                            <td className="cash-movement-notes">
                              {
                                movement.notes ??
                                '—'
                              }
                            </td>

                            <td className="cash-movement-actions">
                              <button
                                type="button"
                                className="cash-movement-row-button"
                                onClick={() =>
                                  startEditing(
                                    movement,
                                  )
                                }
                                disabled={
                                  deletingId ===
                                  movement.id
                                }
                              >
                                Edit
                              </button>

                              <button
                                type="button"
                                className="cash-movement-row-button cash-movement-delete"
                                onClick={() =>
                                  void handleDelete(
                                    movement,
                                  )
                                }
                                disabled={
                                  deletingId ===
                                  movement.id
                                }
                              >
                                {deletingId ===
                                movement.id
                                  ? 'Deleting...'
                                  : 'Delete'}
                              </button>
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
        </section>
      </main>
    </>
  );
}

export default CashMovements;