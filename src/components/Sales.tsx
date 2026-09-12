import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";

type Location = {
  id: number;
  name: string;
};

type Product = {
  id: number;
  sku: string;
  name: string;
  default_selling_price: number;
  unit: string;
};

type Customer = {
  id: number;
  name: string;
  phone: string | null;
  customer_type: "INDIVIDUAL" | "SHOP";
  contact_person: string | null;
};

export default function Sales() {
  const [locations, setLocations] = useState<Location[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);

  const [locationId, setLocationId] = useState("");
  const [productId, setProductId] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [sellingPrice, setSellingPrice] = useState("");
  const [paidNow, setPaidNow] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("CASH");
  const [notes, setNotes] = useState("");

  const [customerSearch, setCustomerSearch] = useState("");
  const [showNewCustomer, setShowNewCustomer] = useState(false);

  const [newCustomerType, setNewCustomerType] =
    useState<"INDIVIDUAL" | "SHOP">("INDIVIDUAL");
  const [newCustomerName, setNewCustomerName] = useState("");
  const [newCustomerContact, setNewCustomerContact] = useState("");
  const [newCustomerPhone, setNewCustomerPhone] = useState("");

  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoadingData(true);
    setMessage("");

    const [locationsResult, productsResult, customersResult] =
      await Promise.all([
        supabase
          .from("locations")
          .select("id, name")
          .eq("is_active", true)
          .order("name"),

        supabase
          .from("products")
          .select("id, sku, name, default_selling_price, unit")
          .eq("is_active", true)
          .order("name"),

        supabase
          .from("customers")
          .select(
            "id, name, phone, customer_type, contact_person"
          )
          .eq("is_active", true)
          .order("name"),
      ]);

    if (locationsResult.error) {
      setMessage(locationsResult.error.message);
    } else {
      setLocations(locationsResult.data ?? []);
    }

    if (productsResult.error) {
      setMessage(productsResult.error.message);
    } else {
      setProducts(productsResult.data ?? []);
    }

    if (customersResult.error) {
      setMessage(customersResult.error.message);
    } else {
      setCustomers(customersResult.data ?? []);
    }

    setLoadingData(false);
  }

  const selectedProduct = products.find(
    (product) => String(product.id) === productId
  );

  useEffect(() => {
    if (selectedProduct) {
      setSellingPrice(String(selectedProduct.default_selling_price ?? 0));
    }
  }, [selectedProduct]);

  const selectedCustomer = customers.find(
    (customer) => String(customer.id) === customerId
  );

  const filteredCustomers = useMemo(() => {
    const search = customerSearch.trim().toLowerCase();

    if (!search) {
      return customers.slice(0, 20);
    }

    return customers
      .filter((customer) => {
        return (
          customer.name.toLowerCase().includes(search) ||
          (customer.phone ?? "").toLowerCase().includes(search) ||
          (customer.contact_person ?? "")
            .toLowerCase()
            .includes(search)
        );
      })
      .slice(0, 20);
  }, [customers, customerSearch]);

  const numericPrice = Number(sellingPrice) || 0;
  const numericPaid = Number(paidNow) || 0;

  const totalAmount = numericPrice * quantity;
  const dueAmount = Math.max(totalAmount - numericPaid, 0);

  function resetForm() {
    setLocationId("");
    setProductId("");
    setCustomerId("");
    setQuantity(1);
    setSellingPrice("");
    setPaidNow("");
    setPaymentMethod("CASH");
    setNotes("");
    setCustomerSearch("");
  }

  async function createCustomer() {
    setMessage("");

    if (!newCustomerName.trim()) {
      setMessage(
        newCustomerType === "SHOP"
          ? "Shop name is required."
          : "Customer name is required."
      );
      return;
    }

    const { data, error } = await supabase
      .from("customers")
      .insert({
        name: newCustomerName.trim(),
        contact_person:
          newCustomerType === "SHOP"
            ? newCustomerContact.trim() || null
            : null,
        phone: newCustomerPhone.trim() || null,
        customer_type: newCustomerType,
      })
      .select(
        "id, name, phone, customer_type, contact_person"
      )
      .single();

    if (error) {
      setMessage(error.message);
      return;
    }

    if (data) {
      setCustomers((current) =>
        [...current, data].sort((a, b) =>
          a.name.localeCompare(b.name)
        )
      );

      setCustomerId(String(data.id));
      setCustomerSearch(data.name);
    }

    setNewCustomerName("");
    setNewCustomerContact("");
    setNewCustomerPhone("");
    setNewCustomerType("INDIVIDUAL");
    setShowNewCustomer(false);
    setMessage("Customer created.");
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setMessage("");

    if (!locationId) {
      setMessage("Select a location.");
      return;
    }

    if (!productId) {
      setMessage("Select a product.");
      return;
    }

    if (quantity <= 0) {
      setMessage("Quantity must be greater than 0.");
      return;
    }

    if (numericPrice <= 0) {
      setMessage("Selling price must be greater than 0.");
      return;
    }

    if (numericPaid < 0) {
      setMessage("Paid amount cannot be negative.");
      return;
    }

    if (numericPaid > totalAmount) {
      setMessage("Paid amount cannot be greater than total.");
      return;
    }

    // If money is still due, we need a customer
    // so the outstanding amount can be tracked.
    if (dueAmount > 0 && !selectedCustomer) {
      setMessage(
        "Select a customer for a credit/partial-payment sale."
      );
      return;
    }

    setLoading(true);

    const { error } = await supabase.rpc("create_sale", {
      p_customer_id: selectedCustomer?.id ?? null,
      p_location_id: Number(locationId),
      p_product_id: Number(productId),
      p_quantity: quantity,
      p_selling_price: numericPrice,
      p_paid_now: numericPaid,
      p_payment_method:
        numericPaid > 0 ? paymentMethod : null,
      p_notes: notes.trim() || null,
    });

    if (error) {
      setMessage(error.message);
      setLoading(false);
      return;
    }

    setMessage(
      selectedCustomer && dueAmount > 0
        ? `Sale created successfully. Customer due: ₹${dueAmount.toLocaleString()}`
        : "Sale created successfully."
    );

    resetForm();
    setLoading(false);
  }

  if (loadingData) {
    return <div>Loading...</div>;
  }

  return (
    <div>
      <h2>New Sale</h2>

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

      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: 12 }}>
          <label>Location</label>
          <br />
          <select
            value={locationId}
            onChange={(e) => setLocationId(e.target.value)}
          >
            <option value="">Select location</option>
            {locations.map((location) => (
              <option key={location.id} value={location.id}>
                {location.name}
              </option>
            ))}
          </select>
        </div>

        <div style={{ marginBottom: 12 }}>
          <label>Product</label>
          <br />
          <select
            value={productId}
            onChange={(e) => setProductId(e.target.value)}
          >
            <option value="">Select product</option>
            {products.map((product) => (
              <option key={product.id} value={product.id}>
                {product.sku} - {product.name}
              </option>
            ))}
          </select>
        </div>

        <div style={{ marginBottom: 12 }}>
          <label>Quantity</label>
          <br />
          <input
            type="number"
            min="1"
            value={quantity}
            onChange={(e) =>
              setQuantity(Number(e.target.value) || 1)
            }
          />
        </div>

        <div style={{ marginBottom: 12 }}>
          <label>Selling Price</label>
          <br />
          <input
            type="number"
            min="0"
            value={sellingPrice}
            onChange={(e) => setSellingPrice(e.target.value)}
          />
        </div>

        <div style={{ marginBottom: 12 }}>
          <strong>Total: ₹{totalAmount.toLocaleString()}</strong>
        </div>

        <div style={{ marginBottom: 12 }}>
          <label>Customer</label>
          <br />

          <input
            type="text"
            placeholder="Search customer"
            value={customerSearch}
            onChange={(e) => {
              setCustomerSearch(e.target.value);
              setCustomerId("");
            }}
          />

          <select
            value={customerId}
            onChange={(e) => {
              setCustomerId(e.target.value);

              const customer = customers.find(
                (item) => String(item.id) === e.target.value
              );

              if (customer) {
                setCustomerSearch(customer.name);
              }
            }}
            style={{ display: "block", marginTop: 6 }}
          >
            <option value="">Walk-in customer</option>

            {filteredCustomers.map((customer) => (
              <option key={customer.id} value={customer.id}>
                {customer.name}
                {customer.phone
                  ? ` - ${customer.phone}`
                  : ""}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={() =>
              setShowNewCustomer((current) => !current)
            }
            style={{ marginTop: 6 }}
          >
            {showNewCustomer
              ? "Cancel New Customer"
              : "New Customer"}
          </button>
        </div>

        {showNewCustomer && (
          <div
            style={{
              border: "1px solid #ccc",
              padding: 12,
              marginBottom: 12,
            }}
          >
            <h3>Quick Customer Creation</h3>

            <div style={{ marginBottom: 8 }}>
              <label>Type</label>
              <br />
              <select
                value={newCustomerType}
                onChange={(e) =>
                  setNewCustomerType(
                    e.target.value as "INDIVIDUAL" | "SHOP"
                  )
                }
              >
                <option value="INDIVIDUAL">Individual</option>
                <option value="SHOP">Shop</option>
              </select>
            </div>

            <div style={{ marginBottom: 8 }}>
              <label>
                {newCustomerType === "SHOP"
                  ? "Shop Name"
                  : "Customer Name"}
              </label>
              <br />
              <input
                value={newCustomerName}
                onChange={(e) =>
                  setNewCustomerName(e.target.value)
                }
              />
            </div>

            {newCustomerType === "SHOP" && (
              <div style={{ marginBottom: 8 }}>
                <label>Owner / Contact Person</label>
                <br />
                <input
                  value={newCustomerContact}
                  onChange={(e) =>
                    setNewCustomerContact(e.target.value)
                  }
                />
              </div>
            )}

            <div style={{ marginBottom: 8 }}>
              <label>Phone</label>
              <br />
              <input
                value={newCustomerPhone}
                onChange={(e) =>
                  setNewCustomerPhone(e.target.value)
                }
              />
            </div>

            <button type="button" onClick={createCustomer}>
              Create Customer
            </button>
          </div>
        )}

        <div style={{ marginBottom: 12 }}>
          <label>Paid Now</label>
          <br />
          <input
            type="number"
            min="0"
            value={paidNow}
            onChange={(e) => setPaidNow(e.target.value)}
          />
        </div>

        {numericPaid > 0 && (
          <div style={{ marginBottom: 12 }}>
            <label>Payment Method</label>
            <br />
            <select
              value={paymentMethod}
              onChange={(e) =>
                setPaymentMethod(e.target.value)
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
            Due: ₹{dueAmount.toLocaleString()}
          </strong>
        </div>

        <div style={{ marginBottom: 12 }}>
          <label>Notes</label>
          <br />
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
          />
        </div>

        <button type="submit" disabled={loading}>
          {loading ? "Saving..." : "Create Sale"}
        </button>
      </form>
    </div>
  );
}