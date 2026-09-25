import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";

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
  products: Product | null;
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
  const [sales, setSales] = useState<Sale[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    void loadSales();
  }, []);

  async function loadSales() {
    setLoading(true);
    setMessage("");

    const { data, error } = await supabase
      .from("sales")
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
          id,
          quantity,
          selling_price,
          total_amount,
          products (
            sku,
            name
          )
        )
      `)
      .order("sale_date", {
        ascending: false,
      });

    if (error) {
      console.error(
        "Failed to load sales history:",
        error,
      );

      setMessage(error.message);
      setSales([]);
      setLoading(false);
      return;
    }

    const normalizedSales: Sale[] = (data ?? []).map(
      (row) => {
        const customer = Array.isArray(row.customers)
          ? row.customers[0] ?? null
          : row.customers;

        const location = Array.isArray(row.locations)
          ? row.locations[0] ?? null
          : row.locations;

        return {
          id: Number(row.id),
          sale_date: row.sale_date,
          total_amount: Number(row.total_amount),
          paid_now: Number(row.paid_now),
          payment_method: row.payment_method,
          notes: row.notes,
          customers: customer,
          locations: location,
          sale_items: (row.sale_items ?? []).map(
            (item) => ({
              id: Number(item.id),
              quantity: Number(item.quantity),
              selling_price: Number(
                item.selling_price,
              ),
              total_amount: Number(
                item.total_amount,
              ),
              products: Array.isArray(item.products)
                ? item.products[0] ?? null
                : item.products,
            }),
          ),
        };
      },
    );

    setSales(normalizedSales);
    setLoading(false);
  }

  const filteredSales = useMemo(() => {
    const value = search.trim().toLowerCase();

    if (!value) {
      return sales;
    }

    return sales.filter((sale) => {
      const customerName =
        sale.customers?.name ?? "Walk-in customer";

      const customerPhone =
        sale.customers?.phone ?? "";

      const locationName =
        sale.locations?.name ?? "";

      const productText = sale.sale_items
        .map((item) =>
          `${item.products?.sku ?? ""} ${
            item.products?.name ?? ""
          }`,
        )
        .join(" ");

      return (
        String(sale.id).includes(value) ||
        customerName.toLowerCase().includes(value) ||
        customerPhone.toLowerCase().includes(value) ||
        locationName.toLowerCase().includes(value) ||
        productText.toLowerCase().includes(value)
      );
    });
  }, [sales, search]);

  function formatDate(value: string) {
    return new Date(value).toLocaleString();
  }

  function getDue(sale: Sale) {
    return Math.max(
      Number(sale.total_amount) -
        Number(sale.paid_now),
      0,
    );
  }

  if (loading) {
    return <div>Loading sales history...</div>;
  }

  return (
    <main>
      <h2>Sales History</h2>

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

      <div style={{ marginBottom: 16 }}>
        <label htmlFor="sales-history-search">
          Search
        </label>
        <br />

        <input
          id="sales-history-search"
          type="text"
          placeholder="Sale ID, customer, phone, product or location"
          value={search}
          onChange={(event) =>
            setSearch(event.target.value)
          }
        />
      </div>

      {filteredSales.length === 0 ? (
        <p>No sales found.</p>
      ) : (
        <div>
          {filteredSales.map((sale) => {
            const customerName =
              sale.customers?.name ??
              "Walk-in customer";

            const customerPhone =
              sale.customers?.phone;

            const due = getDue(sale);

            return (
              <article
                key={sale.id}
                style={{
                  border: "1px solid #ccc",
                  padding: 16,
                  marginBottom: 16,
                }}
              >
                <h3>Sale #{sale.id}</h3>

                <p>
                  <strong>Date:</strong>{" "}
                  {formatDate(sale.sale_date)}
                </p>

                <p>
                  <strong>Customer:</strong>{" "}
                  {customerName}
                  {customerPhone
                    ? ` - ${customerPhone}`
                    : ""}
                </p>

                <p>
                  <strong>Location:</strong>{" "}
                  {sale.locations?.name ?? "-"}
                </p>

                <table>
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th>Qty</th>
                      <th>Selling Price</th>
                      <th>Total</th>
                    </tr>
                  </thead>

                  <tbody>
                    {sale.sale_items.map((item) => (
                      <tr key={item.id}>
                        <td>
                          <strong>
                            {item.products?.sku ?? "-"}
                          </strong>
                          <br />
                          {item.products?.name ?? "-"}
                        </td>

                        <td>
                          {Number(item.quantity)}
                        </td>

                        <td>
                          ₹
                          {Number(
                            item.selling_price,
                          ).toLocaleString()}
                        </td>

                        <td>
                          ₹
                          {Number(
                            item.total_amount,
                          ).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <p>
                  <strong>
                    Total: ₹
                    {Number(
                      sale.total_amount,
                    ).toLocaleString()}
                  </strong>
                </p>

                <p>
                  <strong>
                    Paid: ₹
                    {Number(
                      sale.paid_now,
                    ).toLocaleString()}
                  </strong>
                </p>

                <p>
                  <strong>
                    Due: ₹
                    {due.toLocaleString()}
                  </strong>
                </p>

                {sale.payment_method && (
                  <p>
                    <strong>
                      Payment Method:
                    </strong>{" "}
                    {sale.payment_method}
                  </p>
                )}

                {sale.notes && (
                  <p>
                    <strong>Notes:</strong>{" "}
                    {sale.notes}
                  </p>
                )}
              </article>
            );
          })}
        </div>
      )}
    </main>
  );
}