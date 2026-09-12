import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

type PurchaseItem = {
  id: number;
  product_id: number;
  quantity: number;
  products:
    | {
        sku: string;
        name: string;
      }[]
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
      }[]
    | null;
  locations:
    | {
        name: string;
      }[]
    | null;
  purchase_items: PurchaseItem[];
};

export default function PendingPurchases() {
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [costs, setCosts] = useState<Record<number, string>>({});
  const [paidNow, setPaidNow] = useState<Record<number, string>>({});
  const [paymentMethods, setPaymentMethods] = useState<
    Record<number, string>
  >({});
  const [loading, setLoading] = useState(true);
  const [confirmingId, setConfirmingId] = useState<number | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    loadPendingPurchases();
  }, []);

  async function loadPendingPurchases() {
    setLoading(true);
    setMessage("");

    const { data, error } = await supabase
      .from("purchases")
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
      .eq("status", "PENDING")
      .order("purchase_date", { ascending: false });

    if (error) {
      setMessage(error.message);
      setPurchases([]);
      setLoading(false);
      return;
    }

    setPurchases((data ?? []) as unknown as Purchase[]);
    setLoading(false);
  }

  function calculatePurchaseTotal(purchase: Purchase) {
    return purchase.purchase_items.reduce((total, item) => {
      const unitCost = Number(costs[item.id] ?? 0);
      return total + unitCost * item.quantity;
    }, 0);
  }

  async function confirmPurchase(purchase: Purchase) {
    setMessage("");

    if (purchase.purchase_items.length === 0) {
      setMessage("This purchase has no items.");
      return;
    }

    for (const item of purchase.purchase_items) {
      const unitCost = Number(costs[item.id]);

      if (!Number.isFinite(unitCost) || unitCost <= 0) {
        setMessage(
          `Enter a valid purchase cost for ${
            item.products?.[0]?.name ?? "the product"
          }.`
        );
        return;
      }
    }

    const totalAmount = calculatePurchaseTotal(purchase);
    const payment = Number(paidNow[purchase.id] ?? 0);

    if (!Number.isFinite(payment) || payment < 0) {
      setMessage("Paid amount cannot be negative.");
      return;
    }

    if (payment > totalAmount) {
      setMessage("Paid amount cannot be greater than purchase total.");
      return;
    }

    setConfirmingId(purchase.id);

    const costEntries = purchase.purchase_items.map((item) => ({
      purchase_item_id: item.id,
      unit_cost: Number(costs[item.id]),
    }));

    const { error } = await supabase.rpc("confirm_purchase", {
      p_purchase_id: purchase.id,
      p_items: costEntries,
      p_paid_now: payment,
      p_payment_method:
        payment > 0 ? paymentMethods[purchase.id] ?? "CASH" : null,
    });

    if (error) {
      setMessage(error.message);
      setConfirmingId(null);
      return;
    }

    setMessage(`Purchase #${purchase.id} confirmed successfully.`);

    setPurchases((current) =>
      current.filter((item) => item.id !== purchase.id)
    );

    setCosts((current) => {
      const next = { ...current };

      purchase.purchase_items.forEach((item) => {
        delete next[item.id];
      });

      return next;
    });

    setPaidNow((current) => {
      const next = { ...current };
      delete next[purchase.id];
      return next;
    });

    setPaymentMethods((current) => {
      const next = { ...current };
      delete next[purchase.id];
      return next;
    });

    setConfirmingId(null);
  }

  if (loading) {
    return <div>Loading pending purchases...</div>;
  }

  return (
    <div>
      <h2>Pending Purchases</h2>

      {message && (
        <div
          style={{
            marginBottom: 16,
            padding: 10,
            border: "1px solid #ccc",
          }}
        >
          {message}
        </div>
      )}

      {purchases.length === 0 ? (
        <p>No pending purchases.</p>
      ) : (
        purchases.map((purchase) => {
          const totalAmount = calculatePurchaseTotal(purchase);
          const payment = Number(paidNow[purchase.id] ?? 0);
          const supplierDue = Math.max(totalAmount - payment, 0);

          return (
            <div
              key={purchase.id}
              style={{
                border: "1px solid #ccc",
                padding: 16,
                marginBottom: 16,
              }}
            >
              <h3>Purchase #{purchase.id}</h3>

              <div style={{ marginBottom: 10 }}>
                <strong>Supplier:</strong>{" "}
                {purchase.suppliers?.[0]?.name ?? "-"}
              </div>

              <div style={{ marginBottom: 10 }}>
                <strong>Location:</strong>{" "}
                {purchase.locations?.[0]?.name ?? "-"}
              </div>

              <div style={{ marginBottom: 10 }}>
                <strong>Date:</strong>{" "}
                {new Date(purchase.purchase_date).toLocaleString()}
              </div>

              <div style={{ marginBottom: 10 }}>
                <strong>Invoice:</strong>{" "}
                {purchase.invoice_number ?? "-"}
              </div>

              {purchase.notes && (
                <div style={{ marginBottom: 10 }}>
                  <strong>Notes:</strong> {purchase.notes}
                </div>
              )}

              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  marginBottom: 16,
                }}
              >
                <thead>
                  <tr>
                    <th
                      style={{
                        textAlign: "left",
                        borderBottom: "1px solid #ccc",
                        padding: 8,
                      }}
                    >
                      Product
                    </th>

                    <th
                      style={{
                        textAlign: "left",
                        borderBottom: "1px solid #ccc",
                        padding: 8,
                      }}
                    >
                      Quantity
                    </th>

                    <th
                      style={{
                        textAlign: "left",
                        borderBottom: "1px solid #ccc",
                        padding: 8,
                      }}
                    >
                      Unit Cost
                    </th>

                    <th
                      style={{
                        textAlign: "left",
                        borderBottom: "1px solid #ccc",
                        padding: 8,
                      }}
                    >
                      Total
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {purchase.purchase_items.map((item) => {
                    const unitCost = Number(costs[item.id] ?? 0);
                    const lineTotal = unitCost * item.quantity;

                    return (
                      <tr key={item.id}>
                        <td style={{ padding: 8 }}>
                          {item.products?.[0]?.sku ?? "-"} -{" "}
                          {item.products?.[0]?.name ?? "-"}
                        </td>

                        <td style={{ padding: 8 }}>
                          {item.quantity}
                        </td>

                        <td style={{ padding: 8 }}>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={costs[item.id] ?? ""}
                            onChange={(e) =>
                              setCosts((current) => ({
                                ...current,
                                [item.id]: e.target.value,
                              }))
                            }
                          />
                        </td>

                        <td style={{ padding: 8 }}>
                          ₹{lineTotal.toLocaleString()}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              <div style={{ marginBottom: 10 }}>
                <strong>
                  Total Purchase: ₹{totalAmount.toLocaleString()}
                </strong>
              </div>

              <div style={{ marginBottom: 10 }}>
                <label>Paid Now</label>
                <br />

                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={paidNow[purchase.id] ?? ""}
                  onChange={(e) =>
                    setPaidNow((current) => ({
                      ...current,
                      [purchase.id]: e.target.value,
                    }))
                  }
                />
              </div>

              {payment > 0 && (
                <div style={{ marginBottom: 10 }}>
                  <label>Payment Method</label>
                  <br />

                  <select
                    value={paymentMethods[purchase.id] ?? "CASH"}
                    onChange={(e) =>
                      setPaymentMethods((current) => ({
                        ...current,
                        [purchase.id]: e.target.value,
                      }))
                    }
                  >
                    <option value="CASH">Cash</option>
                    <option value="UPI">UPI</option>
                    <option value="CARD">Card</option>
                    <option value="BANK_TRANSFER">
                      Bank Transfer
                    </option>
                  </select>
                </div>
              )}

              <div style={{ marginBottom: 12 }}>
                <strong>
                  Supplier Due: ₹{supplierDue.toLocaleString()}
                </strong>
              </div>

              <button
                type="button"
                disabled={confirmingId === purchase.id}
                onClick={() => confirmPurchase(purchase)}
              >
                {confirmingId === purchase.id
                  ? "Confirming..."
                  : "Confirm Purchase"}
              </button>
            </div>
          );
        })
      )}
    </div>
  );
}