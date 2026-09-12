import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

type PendingPurchase = {
  id: number;
  supplier_id: number | null;
  location_id: number;
  purchase_date: string;
  invoice_number: string | null;
  notes: string | null;
  supplier_name: string;
  location_name: string;
};

type PurchaseItem = {
  id: number;
  purchase_id: number;
  product_id: number;
  quantity: number;
  unit_cost: number | null;
  total_cost: number | null;
  sku: string;
  product_name: string;
};

type FormState = {
  unitCost: string;
  paidNow: string;
  paymentMethod: string;
};

const emptyForm: FormState = {
  unitCost: '',
  paidNow: '0',
  paymentMethod: '',
};

function PendingPurchases() {
  const [purchases, setPurchases] = useState<PendingPurchase[]>([]);
  const [items, setItems] = useState<Record<number, PurchaseItem[]>>({});
  const [forms, setForms] = useState<Record<number, FormState>>({});

  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [message, setMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    void loadPendingPurchases();
  }, []);

  async function loadPendingPurchases() {
    setLoading(true);
    setErrorMessage('');

    const { data, error } = await supabase
      .from('purchases')
      .select(`
        id,
        supplier_id,
        location_id,
        purchase_date,
        invoice_number,
        notes,
        suppliers (
          name
        ),
        locations (
          name
        )
      `)
      .eq('status', 'PENDING')
      .order('purchase_date', { ascending: false });

    if (error) {
      console.error('Failed to load pending purchases:', error);
      setErrorMessage(error.message);
      setLoading(false);
      return;
    }

    const pendingPurchases: PendingPurchase[] = (data ?? []).map(
      (purchase: any) => ({
        id: purchase.id,
        supplier_id: purchase.supplier_id,
        location_id: purchase.location_id,
        purchase_date: purchase.purchase_date,
        invoice_number: purchase.invoice_number,
        notes: purchase.notes,
        supplier_name: purchase.suppliers?.name ?? '-',
        location_name: purchase.locations?.name ?? '-',
      }),
    );

    setPurchases(pendingPurchases);

    if (pendingPurchases.length > 0) {
      await loadPurchaseItems(pendingPurchases);
    } else {
      setItems({});
    }

    setLoading(false);
  }

  async function loadPurchaseItems(pendingPurchases: PendingPurchase[]) {
    const purchaseIds = pendingPurchases.map((purchase) => purchase.id);

    const { data, error } = await supabase
      .from('purchase_items')
      .select(`
        id,
        purchase_id,
        product_id,
        quantity,
        unit_cost,
        total_cost,
        products (
          sku,
          name
        )
      `)
      .in('purchase_id', purchaseIds);

    if (error) {
      console.error('Failed to load purchase items:', error);
      setErrorMessage(error.message);
      return;
    }

    const grouped: Record<number, PurchaseItem[]> = {};

    for (const item of data ?? []) {
      const purchaseItem = item as any;

      const mappedItem: PurchaseItem = {
        id: purchaseItem.id,
        purchase_id: purchaseItem.purchase_id,
        product_id: purchaseItem.product_id,
        quantity: Number(purchaseItem.quantity),
        unit_cost:
          purchaseItem.unit_cost !== null
            ? Number(purchaseItem.unit_cost)
            : null,
        total_cost:
          purchaseItem.total_cost !== null
            ? Number(purchaseItem.total_cost)
            : null,
        sku: purchaseItem.products?.sku ?? '-',
        product_name: purchaseItem.products?.name ?? '-',
      };

      if (!grouped[mappedItem.purchase_id]) {
        grouped[mappedItem.purchase_id] = [];
      }

      grouped[mappedItem.purchase_id].push(mappedItem);
    }

    setItems(grouped);

    const initialForms: Record<number, FormState> = {};

    for (const purchase of pendingPurchases) {
      initialForms[purchase.id] = {
        ...emptyForm,
      };
    }

    setForms(initialForms);
  }

  function updateForm(
    purchaseId: number,
    field: keyof FormState,
    value: string,
  ) {
    setForms((current) => ({
      ...current,
      [purchaseId]: {
        ...(current[purchaseId] ?? emptyForm),
        [field]: value,
      },
    }));
  }

  function calculateTotalCost(
    purchaseItems: PurchaseItem[],
    unitCost: number,
  ) {
    return purchaseItems.reduce(
      (total, item) => total + item.quantity * unitCost,
      0,
    );
  }

  async function confirmPurchase(purchase: PendingPurchase) {
    setMessage('');
    setErrorMessage('');

    const purchaseItems = items[purchase.id] ?? [];
    const form = forms[purchase.id] ?? emptyForm;

    if (purchaseItems.length === 0) {
      setErrorMessage(
        `Purchase #${purchase.id} has no items.`,
      );
      return;
    }

    const unitCost = Number(form.unitCost);
    const paidNow = Number(form.paidNow);

    if (!Number.isFinite(unitCost) || unitCost < 0) {
      setErrorMessage('Unit cost must be 0 or greater.');
      return;
    }

    if (!Number.isFinite(paidNow) || paidNow < 0) {
      setErrorMessage('Paid Now must be 0 or greater.');
      return;
    }

    const totalCost = calculateTotalCost(purchaseItems, unitCost);

    if (paidNow > totalCost) {
      setErrorMessage(
        `Paid Now cannot be greater than the purchase total of INR ${totalCost.toLocaleString(
          'en-IN',
        )}.`,
      );
      return;
    }

    if (paidNow > 0 && !form.paymentMethod.trim()) {
      setErrorMessage('Select a payment method when Paid Now is greater than 0.');
      return;
    }

    const supplierDue = totalCost - paidNow;

    setSavingId(purchase.id);

    try {
      // Update every item with the confirmed cost.
      for (const item of purchaseItems) {
        const itemTotal = item.quantity * unitCost;

        const { error: itemUpdateError } = await supabase
          .from('purchase_items')
          .update({
            unit_cost: unitCost,
            total_cost: itemTotal,
          })
          .eq('id', item.id);

        if (itemUpdateError) {
          throw itemUpdateError;
        }
      }

      // Update the purchase itself.
      const { error: purchaseUpdateError } = await supabase
        .from('purchases')
        .update({
          status: 'CONFIRMED',
          total_amount: totalCost,
        })
        .eq('id', purchase.id);

      if (purchaseUpdateError) {
        throw purchaseUpdateError;
      }

      // Add purchase amount to supplier payable.
      if (purchase.supplier_id !== null) {
        const { error: supplierPurchaseError } = await supabase
          .from('supplier_transactions')
          .insert({
            supplier_id: purchase.supplier_id,
            transaction_type: 'PURCHASE',
            amount: totalCost,
            purchase_id: purchase.id,
            transaction_date: new Date().toISOString(),
            notes: `Purchase #${purchase.id}`,
          });

        if (supplierPurchaseError) {
          throw supplierPurchaseError;
        }

        // Record money paid to supplier, if any.
        if (paidNow > 0) {
          const { error: supplierPaymentError } = await supabase
            .from('supplier_transactions')
            .insert({
              supplier_id: purchase.supplier_id,
              transaction_type: 'PAYMENT',
              amount: paidNow,
              purchase_id: purchase.id,
              transaction_date: new Date().toISOString(),
              payment_method: form.paymentMethod.trim(),
              notes: `Payment against purchase #${purchase.id}`,
            });

          if (supplierPaymentError) {
            throw supplierPaymentError;
          }
        }
      }

      setMessage(
        `Purchase #${purchase.id} confirmed. Total: INR ${totalCost.toLocaleString(
          'en-IN',
        )}. Paid Now: INR ${paidNow.toLocaleString(
          'en-IN',
        )}. Supplier due: INR ${supplierDue.toLocaleString(
          'en-IN',
        )}.`,
      );

      await loadPendingPurchases();
    } catch (error) {
      console.error('Failed to confirm purchase:', error);

      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Failed to confirm purchase.',
      );
    } finally {
      setSavingId(null);
    }
  }

  if (loading) {
    return <p>Loading pending purchases...</p>;
  }

  return (
    <main>
      <h1>Pending Purchases</h1>

      <p>
        These are stock receipts waiting for the actual purchase cost to
        be confirmed by an admin.
      </p>

      {message && <p>{message}</p>}
      {errorMessage && <p>{errorMessage}</p>}

      {purchases.length === 0 ? (
        <p>No pending purchases.</p>
      ) : (
        <section>
          {purchases.map((purchase) => {
            const purchaseItems = items[purchase.id] ?? [];
            const form = forms[purchase.id] ?? emptyForm;

            const unitCost = Number(form.unitCost);
            const totalCost =
              Number.isFinite(unitCost) && unitCost >= 0
                ? calculateTotalCost(purchaseItems, unitCost)
                : 0;

            const paidNow = Number(form.paidNow);
            const supplierDue =
              Number.isFinite(paidNow) && paidNow >= 0
                ? totalCost - paidNow
                : totalCost;

            return (
              <article key={purchase.id}>
                <hr />

                <h2>Purchase #{purchase.id}</h2>

                <p>
                  <strong>Supplier:</strong> {purchase.supplier_name}
                </p>

                <p>
                  <strong>Location:</strong> {purchase.location_name}
                </p>

                <p>
                  <strong>Date:</strong>{' '}
                  {new Date(purchase.purchase_date).toLocaleString(
                    'en-IN',
                  )}
                </p>

                {purchase.invoice_number && (
                  <p>
                    <strong>Invoice / Reference:</strong>{' '}
                    {purchase.invoice_number}
                  </p>
                )}

                <h3>Items</h3>

                {purchaseItems.map((item) => (
                  <div key={item.id}>
                    <p>
                      {item.sku} - {item.product_name}
                    </p>

                    <p>Quantity: {item.quantity}</p>
                  </div>
                ))}

                <h3>Admin Confirmation</h3>

                <div>
                  <label htmlFor={`cost-${purchase.id}`}>
                    Unit Purchase Cost
                  </label>

                  <input
                    id={`cost-${purchase.id}`}
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.unitCost}
                    onChange={(event) =>
                      updateForm(
                        purchase.id,
                        'unitCost',
                        event.target.value,
                      )
                    }
                    placeholder="Enter actual cost"
                  />
                </div>

                <div>
                  <label htmlFor={`paid-${purchase.id}`}>
                    Paid Now
                  </label>

                  <input
                    id={`paid-${purchase.id}`}
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.paidNow}
                    onChange={(event) =>
                      updateForm(
                        purchase.id,
                        'paidNow',
                        event.target.value,
                      )
                    }
                    placeholder="0"
                  />
                </div>

                <div>
                  <label htmlFor={`method-${purchase.id}`}>
                    Payment Method
                  </label>

                  <select
                    id={`method-${purchase.id}`}
                    value={form.paymentMethod}
                    onChange={(event) =>
                      updateForm(
                        purchase.id,
                        'paymentMethod',
                        event.target.value,
                      )
                    }
                  >
                    <option value="">Select payment method</option>
                    <option value="CASH">Cash</option>
                    <option value="UPI">UPI</option>
                    <option value="BANK_TRANSFER">
                      Bank Transfer
                    </option>
                    <option value="CARD">Card</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>

                <p>
                  <strong>Total Cost:</strong> INR{' '}
                  {totalCost.toLocaleString('en-IN')}
                </p>

                <p>
                  <strong>Supplier Due:</strong> INR{' '}
                  {Math.max(supplierDue, 0).toLocaleString('en-IN')}
                </p>

                <button
                  type="button"
                  disabled={savingId === purchase.id}
                  onClick={() => void confirmPurchase(purchase)}
                >
                  {savingId === purchase.id
                    ? 'Confirming...'
                    : 'Confirm Purchase'}
                </button>
              </article>
            );
          })}
        </section>
      )}
    </main>
  );
}

export default PendingPurchases;