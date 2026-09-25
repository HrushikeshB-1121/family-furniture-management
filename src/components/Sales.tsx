import {
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";
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
  address: string | null;
  customer_type: "INDIVIDUAL" | "SHOP";
  contact_person: string | null;
};

type StockRow = {
  product_id: number;
  location_id: number;
  quantity: number;
};

type CartItem = {
  id: string;
  productId: number;
  locationId: number;
  quantity: number;
  sellingPrice: number;
};

type BillData = {
  saleId: number;
  saleDate: string;
  customer: Customer;
  items: CartItem[];
  products: Product[];
  totalAmount: number;
  paidNow: number;
  dueAmount: number;
  paymentMethod: string | null;
};

function normalizePhone(value: string) {
  const digits = value.replace(/\D/g, "");

  if (digits.length > 10) {
    return digits.slice(-10);
  }

  return digits;
}

export default function Sales() {
  const [locations, setLocations] = useState<Location[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [stock, setStock] = useState<StockRow[]>([]);

  const [customerPhone, setCustomerPhone] = useState("");
  const [selectedCustomerId, setSelectedCustomerId] =
    useState("");

  const [showNewCustomer, setShowNewCustomer] =
    useState(false);

  const [newCustomerType, setNewCustomerType] =
    useState<"INDIVIDUAL" | "SHOP">("INDIVIDUAL");

  const [newCustomerName, setNewCustomerName] =
    useState("");

  const [newCustomerContact, setNewCustomerContact] =
    useState("");

  const [newCustomerAddress, setNewCustomerAddress] =
    useState("");

  const [draftProductId, setDraftProductId] =
    useState("");

  const [draftLocationId, setDraftLocationId] =
    useState("");

  const [draftQuantity, setDraftQuantity] =
    useState("1");

  const [draftSellingPrice, setDraftSellingPrice] =
    useState("");

  const [cart, setCart] = useState<CartItem[]>([]);

  const [paidNow, setPaidNow] = useState("");
  const [paymentMethod, setPaymentMethod] =
    useState("CASH");

  const [notes, setNotes] = useState("");

  const [loadingData, setLoadingData] =
    useState(true);

  const [saving, setSaving] = useState(false);

  const [message, setMessage] = useState("");

  const [errorMessage, setErrorMessage] =
    useState("");

  const [lastBill, setLastBill] =
    useState<BillData | null>(null);

  useEffect(() => {
    void loadData();
  }, []);

  async function loadData() {
    setLoadingData(true);
    setErrorMessage("");

    const [
      locationsResult,
      productsResult,
      customersResult,
      stockResult,
    ] = await Promise.all([
      supabase
        .from("locations")
        .select("id, name")
        .eq("is_active", true)
        .order("name"),

      supabase
        .from("products")
        .select(
          "id, sku, name, default_selling_price, unit",
        )
        .eq("is_active", true)
        .order("name"),

      supabase
        .from("customers")
        .select(
          "id, name, phone, address, customer_type, contact_person",
        )
        .eq("is_active", true)
        .order("name"),

      supabase
        .from("current_stock")
        .select(
          "product_id, location_id, quantity",
        ),
    ]);

    if (locationsResult.error) {
      setErrorMessage(
        locationsResult.error.message,
      );
    }

    if (productsResult.error) {
      setErrorMessage(
        productsResult.error.message,
      );
    }

    if (customersResult.error) {
      setErrorMessage(
        customersResult.error.message,
      );
    }

    if (stockResult.error) {
      setErrorMessage(
        stockResult.error.message,
      );
    }

    setLocations(locationsResult.data ?? []);
    setProducts(productsResult.data ?? []);
    setCustomers(customersResult.data ?? []);
    setStock(
      (stockResult.data ?? []).map((row) => ({
        product_id: Number(row.product_id),
        location_id: Number(row.location_id),
        quantity: Number(row.quantity),
      })),
    );

    setLoadingData(false);
  }

  const selectedCustomer = customers.find(
    (customer) =>
      String(customer.id) === selectedCustomerId,
  );

  const phoneMatches = useMemo(() => {
    const phone = normalizePhone(customerPhone);

    if (phone.length < 10) {
      return [];
    }

    return customers.filter(
      (customer) =>
        normalizePhone(customer.phone ?? "") === phone,
    );
  }, [customerPhone, customers]);

  const draftProduct = products.find(
    (product) =>
      String(product.id) === draftProductId,
  );

  const draftAvailableStock = getAvailableStock(
    Number(draftProductId),
    Number(draftLocationId),
  );

  const cartTotal = cart.reduce(
    (sum, item) =>
      sum +
      item.quantity * item.sellingPrice,
    0,
  );

  const numericPaidNow = Number(paidNow) || 0;

  const dueAmount = Math.max(
    cartTotal - numericPaidNow,
    0,
  );

  const cartProductMap = useMemo(
    () =>
      new Map(
        products.map((product) => [
          product.id,
          product,
        ]),
      ),
    [products],
  );

  const cartLocationMap = useMemo(
    () =>
      new Map(
        locations.map((location) => [
          location.id,
          location,
        ]),
      ),
    [locations],
  );

  useEffect(() => {
    if (!draftProduct) {
      return;
    }

    setDraftSellingPrice(
      String(
        draftProduct.default_selling_price ?? 0,
      ),
    );
  }, [draftProduct]);

  useEffect(() => {
    const phone = normalizePhone(customerPhone);

    if (phone.length < 10) {
      setSelectedCustomerId("");
      setShowNewCustomer(false);
      return;
    }

    if (phoneMatches.length === 1) {
      setSelectedCustomerId(
        String(phoneMatches[0].id),
      );
      setShowNewCustomer(false);
      return;
    }

    if (phoneMatches.length === 0) {
      setSelectedCustomerId("");
      setShowNewCustomer(true);
    }
  }, [customerPhone, phoneMatches]);

  function getAvailableStock(
    productId: number,
    locationId: number,
  ) {
    if (!productId || !locationId) {
      return 0;
    }

    const stockRow = stock.find(
      (row) =>
        row.product_id === productId &&
        row.location_id === locationId,
    );

    const alreadyInCart = cart
      .filter(
        (item) =>
          item.productId === productId &&
          item.locationId === locationId,
      )
      .reduce(
        (sum, item) => sum + item.quantity,
        0,
      );

    return Math.max(
      Number(stockRow?.quantity ?? 0) -
        alreadyInCart,
      0,
    );
  }

  function resetSaleForm() {
    setCustomerPhone("");
    setSelectedCustomerId("");
    setShowNewCustomer(false);

    setDraftProductId("");
    setDraftLocationId("");
    setDraftQuantity("1");
    setDraftSellingPrice("");

    setCart([]);

    setPaidNow("");
    setPaymentMethod("CASH");
    setNotes("");

    setNewCustomerType("INDIVIDUAL");
    setNewCustomerName("");
    setNewCustomerContact("");
    setNewCustomerAddress("");
  }

  async function handleCreateCustomer() {
    setMessage("");
    setErrorMessage("");

    const phone = normalizePhone(customerPhone);

    if (phone.length !== 10) {
      setErrorMessage(
        "Enter a valid 10-digit phone number.",
      );
      return;
    }

    if (!newCustomerName.trim()) {
      setErrorMessage(
        newCustomerType === "SHOP"
          ? "Shop name is required."
          : "Customer name is required.",
      );
      return;
    }

    const existingCustomer =
      customers.find(
        (customer) =>
          normalizePhone(customer.phone ?? "") ===
          phone,
      );

    if (existingCustomer) {
      setSelectedCustomerId(
        String(existingCustomer.id),
      );
      setShowNewCustomer(false);
      setMessage(
        "Existing customer found and selected.",
      );
      return;
    }

    const { data, error } = await supabase
      .from("customers")
      .insert({
        name: newCustomerName.trim(),
        phone,
        address:
          newCustomerAddress.trim() || null,
        customer_type: newCustomerType,
        contact_person:
          newCustomerType === "SHOP"
            ? newCustomerContact.trim() || null
            : null,
      })
      .select(
        "id, name, phone, address, customer_type, contact_person",
      )
      .single();

    if (error) {
      setErrorMessage(error.message);
      return;
    }

    if (!data) {
      setErrorMessage(
        "Customer was created but no data was returned.",
      );
      return;
    }

    const newCustomer =
      data as Customer;

    setCustomers((current) =>
      [...current, newCustomer].sort(
        (a, b) =>
          a.name.localeCompare(b.name),
      ),
    );

    setSelectedCustomerId(
      String(newCustomer.id),
    );

    setShowNewCustomer(false);

    setNewCustomerName("");
    setNewCustomerContact("");
    setNewCustomerAddress("");

    setMessage("Customer created.");
  }

  function addCartItem() {
    setMessage("");
    setErrorMessage("");

    if (!draftProductId) {
      setErrorMessage(
        "Select a product.",
      );
      return;
    }

    if (!draftLocationId) {
      setErrorMessage(
        "Select the location from which this product is being sold.",
      );
      return;
    }

    const quantity = Number(
      draftQuantity,
    );

    if (
      !Number.isInteger(quantity) ||
      quantity <= 0
    ) {
      setErrorMessage(
        "Quantity must be a whole number greater than 0.",
      );
      return;
    }

    const sellingPrice = Number(
      draftSellingPrice,
    );

    if (
      !Number.isFinite(sellingPrice) ||
      sellingPrice < 0
    ) {
      setErrorMessage(
        "Selling price cannot be negative.",
      );
      return;
    }

    const availableStock =
      getAvailableStock(
        Number(draftProductId),
        Number(draftLocationId),
      );

    if (quantity > availableStock) {
      setErrorMessage(
        `Only ${availableStock} unit(s) available at the selected location.`,
      );
      return;
    }

    const existingItemIndex =
      cart.findIndex(
        (item) =>
          item.productId ===
            Number(draftProductId) &&
          item.locationId ===
            Number(draftLocationId),
      );

    if (existingItemIndex >= 0) {
      const existingItem =
        cart[existingItemIndex];

      const totalQuantity =
        existingItem.quantity +
        quantity;

      const totalAvailable =
        Number(
          stock.find(
            (row) =>
              row.product_id ===
                Number(draftProductId) &&
              row.location_id ===
                Number(draftLocationId),
          )?.quantity ?? 0,
        );

      if (totalQuantity > totalAvailable) {
        setErrorMessage(
          `Only ${totalAvailable} unit(s) available at the selected location.`,
        );
        return;
      }

      setCart((current) =>
        current.map((item, index) =>
          index === existingItemIndex
            ? {
                ...item,
                quantity: totalQuantity,
                sellingPrice,
              }
            : item,
        ),
      );
    } else {
      setCart((current) => [
        ...current,
        {
          id: `${Date.now()}-${Math.random()}`,
          productId: Number(
            draftProductId,
          ),
          locationId: Number(
            draftLocationId,
          ),
          quantity,
          sellingPrice,
        },
      ]);
    }

    setDraftProductId("");
    setDraftLocationId("");
    setDraftQuantity("1");
    setDraftSellingPrice("");
    setErrorMessage("");
  }

  function removeCartItem(
    itemId: string,
  ) {
    setCart((current) =>
      current.filter(
        (item) => item.id !== itemId,
      ),
    );
  }

  function updateCartQuantity(
    itemId: string,
    value: string,
  ) {
    const quantity = Number(value);

    if (
      !Number.isInteger(quantity) ||
      quantity <= 0
    ) {
      return;
    }

    setCart((current) =>
      current.map((item) => {
        if (item.id !== itemId) {
          return item;
        }

        const availableStock =
          Number(
            stock.find(
              (row) =>
                row.product_id ===
                  item.productId &&
                row.location_id ===
                  item.locationId,
            )?.quantity ?? 0,
          );

        if (
          quantity > availableStock
        ) {
          return item;
        }

        return {
          ...item,
          quantity,
        };
      }),
    );
  }

  function updateCartPrice(
    itemId: string,
    value: string,
  ) {
    const price = Number(value);

    if (
      !Number.isFinite(price) ||
      price < 0
    ) {
      return;
    }

    setCart((current) =>
      current.map((item) =>
        item.id === itemId
          ? {
              ...item,
              sellingPrice: price,
            }
          : item,
      ),
    );
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    setMessage("");
    setErrorMessage("");

    if (!selectedCustomer) {
      setErrorMessage(
        "Select or create a customer using the phone number.",
      );
      return;
    }

    if (cart.length === 0) {
      setErrorMessage(
        "Add at least one product to the bill.",
      );
      return;
    }

    if (
      !Number.isFinite(numericPaidNow) ||
      numericPaidNow < 0
    ) {
      setErrorMessage(
        "Paid amount cannot be negative.",
      );
      return;
    }

    if (numericPaidNow > cartTotal) {
      setErrorMessage(
        "Paid amount cannot be greater than the sale total.",
      );
      return;
    }

    if (
      numericPaidNow > 0 &&
      !paymentMethod
    ) {
      setErrorMessage(
        "Select a payment method.",
      );
      return;
    }

    const items = cart.map((item) => ({
      product_id: item.productId,
      location_id: item.locationId,
      quantity: item.quantity,
      selling_price: item.sellingPrice,
    }));

    setSaving(true);

    try {
      const { data, error } =
        await supabase.rpc(
          "create_sale",
          {
            p_customer_id:
              selectedCustomer.id,
            p_items: items,
            p_paid_now:
              numericPaidNow,
            p_payment_method:
              numericPaidNow > 0
                ? paymentMethod
                : null,
            p_notes:
              notes.trim() || null,
          },
        );

      if (error) {
        throw error;
      }

      const saleId = Number(data);

      const bill: BillData = {
        saleId,
        saleDate:
          new Date().toISOString(),
        customer:
          selectedCustomer,
        items: cart,
        products,
        totalAmount: cartTotal,
        paidNow: numericPaidNow,
        dueAmount,
        paymentMethod:
          numericPaidNow > 0
            ? paymentMethod
            : null,
      };

      setLastBill(bill);

      setMessage(
        `Sale #${saleId} created successfully.`,
      );

      resetSaleForm();

      await refreshStock();
    } catch (error) {
      console.error(
        "Failed to create sale:",
        error,
      );

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Failed to create sale.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function refreshStock() {
    const { data, error } =
      await supabase
        .from("current_stock")
        .select(
          "product_id, location_id, quantity",
        );

    if (error) {
      console.error(
        "Failed to refresh stock:",
        error,
      );
      return;
    }

    setStock(
      (data ?? []).map((row) => ({
        product_id: Number(
          row.product_id,
        ),
        location_id: Number(
          row.location_id,
        ),
        quantity: Number(
          row.quantity,
        ),
      })),
    );
  }

  function printBill() {
    window.print();
  }

  if (loadingData) {
    return <div>Loading...</div>;
  }

  return (
    <>
      <style>
        {`
          .sales-screen {
            max-width: 1100px;
            margin: 0 auto;
          }

          .sales-section {
            border: 1px solid #ccc;
            padding: 16px;
            margin-bottom: 16px;
          }

          .sales-row {
            display: grid;
            gap: 12px;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            margin-bottom: 12px;
          }

          .sales-field label {
            display: block;
            font-weight: 600;
            margin-bottom: 4px;
          }

          .sales-field input,
          .sales-field select,
          .sales-field textarea {
            width: 100%;
            box-sizing: border-box;
            padding: 8px;
          }

          .sales-actions {
            display: flex;
            gap: 8px;
            flex-wrap: wrap;
          }

          .sales-cart {
            width: 100%;
            border-collapse: collapse;
          }

          .sales-cart th,
          .sales-cart td {
            border: 1px solid #ccc;
            padding: 8px;
            text-align: left;
          }

          .sales-cart input {
            width: 100%;
            box-sizing: border-box;
            padding: 6px;
          }

          .sales-total {
            text-align: right;
            font-size: 18px;
          }

          .sales-message {
            margin-bottom: 16px;
            padding: 10px;
            border: 1px solid #ccc;
          }

          .printable-bill {
            display: none;
          }

          @media (max-width: 700px) {
            .sales-row {
              grid-template-columns: 1fr;
            }

            .sales-cart {
              font-size: 13px;
            }
          }

          @media print {
            body * {
              visibility: hidden !important;
            }

            .printable-bill,
            .printable-bill * {
              visibility: visible !important;
            }

            .printable-bill {
              display: block !important;
              position: absolute;
              left: 0;
              top: 0;
              width: 100%;
              padding: 20px;
              box-sizing: border-box;
            }

            .printable-bill table {
              width: 100%;
              border-collapse: collapse;
            }

            .printable-bill th,
            .printable-bill td {
              border-bottom: 1px solid #ccc;
              padding: 8px 4px;
              text-align: left;
            }

            .printable-bill .bill-right {
              text-align: right;
            }
          }
        `}
      </style>

      <main className="sales-screen">
        <h2>New Sale</h2>

        {message && (
          <div className="sales-message">
            {message}
          </div>
        )}

        {errorMessage && (
          <div className="sales-message">
            {errorMessage}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <section className="sales-section">
            <h3>Customer</h3>

            <div className="sales-row">
              <div className="sales-field">
                <label htmlFor="customer-phone">
                  Phone Number
                </label>

                <input
                  id="customer-phone"
                  type="tel"
                  value={customerPhone}
                  onChange={(event) =>
                    setCustomerPhone(
                      event.target.value,
                    )
                  }
                  placeholder="Enter customer phone"
                />

                {selectedCustomer && (
                  <p>
                    <strong>
                      Existing customer:
                    </strong>{" "}
                    {selectedCustomer.name}
                  </p>
                )}
              </div>
            </div>

            {phoneMatches.length > 1 && (
              <div>
                <p>
                  Multiple customers have this
                  phone number. Select one:
                </p>

                {phoneMatches.map(
                  (customer) => (
                    <button
                      key={customer.id}
                      type="button"
                      onClick={() => {
                        setSelectedCustomerId(
                          String(
                            customer.id,
                          ),
                        );
                        setShowNewCustomer(
                          false,
                        );
                      }}
                    >
                      {customer.name}
                      {customer.address
                        ? ` - ${customer.address}`
                        : ""}
                    </button>
                  ),
                )}
              </div>
            )}

            {selectedCustomer && (
              <div className="sales-section">
                <p>
                  <strong>Name:</strong>{" "}
                  {selectedCustomer.name}
                </p>

                <p>
                  <strong>Phone:</strong>{" "}
                  {selectedCustomer.phone ??
                    "-"}
                </p>

                <p>
                  <strong>Address:</strong>{" "}
                  {selectedCustomer.address ??
                    "-"}
                </p>

                {selectedCustomer.customer_type ===
                  "SHOP" &&
                  selectedCustomer.contact_person && (
                    <p>
                      <strong>
                        Contact Person:
                      </strong>{" "}
                      {
                        selectedCustomer.contact_person
                      }
                    </p>
                  )}

                <button
                  type="button"
                  onClick={() => {
                    setSelectedCustomerId(
                      "",
                    );
                    setShowNewCustomer(false);
                  }}
                >
                  Change Customer
                </button>
              </div>
            )}

            {showNewCustomer &&
              !selectedCustomer && (
                <div className="sales-section">
                  <h4>
                    New Customer
                  </h4>

                  <p>
                    This customer will be saved
                    for future bills.
                  </p>

                  <div className="sales-row">
                    <div className="sales-field">
                      <label>
                        Customer Type
                      </label>

                      <select
                        value={
                          newCustomerType
                        }
                        onChange={(event) =>
                          setNewCustomerType(
                            event.target
                              .value as
                              | "INDIVIDUAL"
                              | "SHOP",
                          )
                        }
                      >
                        <option value="INDIVIDUAL">
                          Individual
                        </option>
                        <option value="SHOP">
                          Shop / Wholesaler
                        </option>
                      </select>
                    </div>

                    <div className="sales-field">
                      <label>
                        {newCustomerType ===
                        "SHOP"
                          ? "Shop Name"
                          : "Customer Name"}
                      </label>

                      <input
                        value={
                          newCustomerName
                        }
                        onChange={(event) =>
                          setNewCustomerName(
                            event.target
                              .value,
                          )
                        }
                      />
                    </div>

                    {newCustomerType ===
                      "SHOP" && (
                      <div className="sales-field">
                        <label>
                          Contact Person
                        </label>

                        <input
                          value={
                            newCustomerContact
                          }
                          onChange={(event) =>
                            setNewCustomerContact(
                              event.target
                                .value,
                            )
                          }
                        />
                      </div>
                    )}

                    <div className="sales-field">
                      <label>
                        Address
                      </label>

                      <input
                        value={
                          newCustomerAddress
                        }
                        onChange={(event) =>
                          setNewCustomerAddress(
                            event.target
                              .value,
                          )
                        }
                        placeholder="Address"
                      />
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      void handleCreateCustomer()
                    }
                  >
                    Save Customer
                  </button>
                </div>
              )}
          </section>

          <section className="sales-section">
            <h3>Add Products</h3>

            <div className="sales-row">
              <div className="sales-field">
                <label htmlFor="sale-product">
                  Product
                </label>

                <select
                  id="sale-product"
                  value={draftProductId}
                  onChange={(event) =>
                    setDraftProductId(
                      event.target.value,
                    )
                  }
                >
                  <option value="">
                    Select product
                  </option>

                  {products.map(
                    (product) => (
                      <option
                        key={product.id}
                        value={product.id}
                      >
                        {product.sku} -{" "}
                        {product.name}
                      </option>
                    ),
                  )}
                </select>
              </div>

              <div className="sales-field">
                <label htmlFor="sale-location">
                  Stock Location
                </label>

                <select
                  id="sale-location"
                  value={draftLocationId}
                  onChange={(event) =>
                    setDraftLocationId(
                      event.target.value,
                    )
                  }
                >
                  <option value="">
                    Select location
                  </option>

                  {locations.map(
                    (location) => {
                      const available =
                        draftProduct
                          ? getAvailableStock(
                              draftProduct.id,
                              location.id,
                            )
                          : 0;

                      return (
                        <option
                          key={location.id}
                          value={location.id}
                        >
                          {location.name}{" "}
                          ({available} available)
                        </option>
                      );
                    },
                  )}
                </select>
              </div>

              <div className="sales-field">
                <label htmlFor="sale-quantity">
                  Quantity
                </label>

                <input
                  id="sale-quantity"
                  type="number"
                  min="1"
                  step="1"
                  value={draftQuantity}
                  onChange={(event) =>
                    setDraftQuantity(
                      event.target.value,
                    )
                  }
                />
              </div>

              <div className="sales-field">
                <label htmlFor="sale-selling-price">
                  Selling Price
                </label>

                <input
                  id="sale-selling-price"
                  type="number"
                  min="0"
                  step="1"
                  value={
                    draftSellingPrice
                  }
                  onChange={(event) =>
                    setDraftSellingPrice(
                      event.target.value,
                    )
                  }
                />
              </div>
            </div>

            {draftProduct &&
              draftLocationId && (
                <p>
                  Available stock at selected
                  location:{" "}
                  <strong>
                    {draftAvailableStock}
                  </strong>
                </p>
              )}

            <button
              type="button"
              onClick={addCartItem}
            >
              Add Product
            </button>
          </section>

          <section className="sales-section">
            <h3>Bill Items</h3>

            {cart.length === 0 ? (
              <p>
                No products added yet.
              </p>
            ) : (
              <table className="sales-cart">
                <thead>
                  <tr>
                    <th>
                      Product
                    </th>
                    <th>
                      Qty
                    </th>
                    <th>
                      Selling Price
                    </th>
                    <th>
                      Amount
                    </th>
                    <th>
                      Action
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {cart.map(
                    (item) => {
                      const product =
                        cartProductMap.get(
                          item.productId,
                        );

                      const location =
                        cartLocationMap.get(
                          item.locationId,
                        );

                      return (
                        <tr
                          key={item.id}
                        >
                          <td>
                            <strong>
                              {product?.sku ??
                                "-"}
                            </strong>
                            <br />
                            {product?.name ??
                              "-"}
                            <br />
                            <small>
                              Stock:{" "}
                              {location?.name ??
                                "-"}
                            </small>
                          </td>

                          <td>
                            <input
                              type="number"
                              min="1"
                              step="1"
                              value={
                                item.quantity
                              }
                              onChange={(
                                event,
                              ) =>
                                updateCartQuantity(
                                  item.id,
                                  event.target
                                    .value,
                                )
                              }
                            />
                          </td>

                          <td>
                            <input
                              type="number"
                              min="0"
                              step="1"
                              value={
                                item.sellingPrice
                              }
                              onChange={(
                                event,
                              ) =>
                                updateCartPrice(
                                  item.id,
                                  event.target
                                    .value,
                                )
                              }
                            />
                          </td>

                          <td>
                            ₹
                            {(
                              item.quantity *
                              item.sellingPrice
                            ).toLocaleString()}
                          </td>

                          <td>
                            <button
                              type="button"
                              onClick={() =>
                                removeCartItem(
                                  item.id,
                                )
                              }
                            >
                              Remove
                            </button>
                          </td>
                        </tr>
                      );
                    },
                  )}
                </tbody>
              </table>
            )}

            <div className="sales-total">
              <p>
                <strong>
                  Total: ₹
                  {cartTotal.toLocaleString()}
                </strong>
              </p>
            </div>
          </section>

          <section className="sales-section">
            <h3>Payment</h3>

            <div className="sales-row">
              <div className="sales-field">
                <label htmlFor="paid-now">
                  Paid Now
                </label>

                <input
                  id="paid-now"
                  type="number"
                  min="0"
                  step="1"
                  value={paidNow}
                  onChange={(event) =>
                    setPaidNow(
                      event.target.value,
                    )
                  }
                />
              </div>

              <div className="sales-field">
                <label htmlFor="payment-method">
                  Payment Method
                </label>

                <select
                  id="payment-method"
                  value={paymentMethod}
                  onChange={(event) =>
                    setPaymentMethod(
                      event.target.value,
                    )
                  }
                  disabled={
                    numericPaidNow <= 0
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
            </div>

            <p>
              <strong>
                Due: ₹
                {dueAmount.toLocaleString()}
              </strong>
            </p>

            <div className="sales-field">
              <label htmlFor="sale-notes">
                Notes
              </label>

              <textarea
                id="sale-notes"
                value={notes}
                onChange={(event) =>
                  setNotes(
                    event.target.value,
                  )
                }
                rows={3}
              />
            </div>

            <div className="sales-actions">
              <button
                type="submit"
                disabled={
                  saving ||
                  !selectedCustomer ||
                  cart.length === 0
                }
              >
                {saving
                  ? "Saving..."
                  : "Create Sale"}
              </button>
            </div>
          </section>
        </form>

        {lastBill && (
          <section className="sales-section">
            <h3>
              Sale #{lastBill.saleId}
            </h3>

            <p>
              Sale created successfully.
            </p>

            <button
              type="button"
              onClick={printBill}
            >
              Print Bill
            </button>
          </section>
        )}

        {lastBill && (
          <section className="printable-bill">
            <div style={{ textAlign: "center" }}>
              <h1>
                Sri Krishna Furniture And
                Home Appliances
              </h1>

              <p>
                Bill No: #
                {lastBill.saleId}
              </p>

              <p>
                Date:{" "}
                {new Date(
                  lastBill.saleDate,
                ).toLocaleString()}
              </p>
            </div>

            <hr />

            <h3>
              Customer Details
            </h3>

            <p>
              <strong>Name:</strong>{" "}
              {lastBill.customer.name}
            </p>

            <p>
              <strong>Phone:</strong>{" "}
              {lastBill.customer.phone ??
                "-"}
            </p>

            {lastBill.customer.address && (
              <p>
                <strong>Address:</strong>{" "}
                {
                  lastBill.customer.address
                }
              </p>
            )}

            {lastBill.customer.customer_type ===
              "SHOP" &&
              lastBill.customer.contact_person && (
                <p>
                  <strong>
                    Contact Person:
                  </strong>{" "}
                  {
                    lastBill.customer
                      .contact_person
                  }
                </p>
              )}

            <table>
              <thead>
                <tr>
                  <th>
                    Product
                  </th>
                  <th>
                    Qty
                  </th>
                  <th>
                    Rate
                  </th>
                  <th className="bill-right">
                    Amount
                  </th>
                </tr>
              </thead>

              <tbody>
                {lastBill.items.map(
                  (item) => {
                    const product =
                      lastBill.products.find(
                        (value) =>
                          value.id ===
                          item.productId,
                      );

                    return (
                      <tr
                        key={item.id}
                      >
                        <td>
                          {product?.name ??
                            "-"}
                        </td>

                        <td>
                          {item.quantity}
                        </td>

                        <td>
                          ₹
                          {item.sellingPrice.toLocaleString()}
                        </td>

                        <td className="bill-right">
                          ₹
                          {(
                            item.quantity *
                            item.sellingPrice
                          ).toLocaleString()}
                        </td>
                      </tr>
                    );
                  },
                )}
              </tbody>
            </table>

            <hr />

            <p className="bill-right">
              <strong>
                Total: ₹
                {lastBill.totalAmount.toLocaleString()}
              </strong>
            </p>

            <p className="bill-right">
              Paid: ₹
              {lastBill.paidNow.toLocaleString()}
            </p>

            <p className="bill-right">
              <strong>
                Due: ₹
                {lastBill.dueAmount.toLocaleString()}
              </strong>
            </p>

            {lastBill.paymentMethod && (
              <p className="bill-right">
                Payment:{" "}
                {lastBill.paymentMethod}
              </p>
            )}

            <hr />

            <p
              style={{
                textAlign: "center",
              }}
            >
              Thank you for your business.
            </p>
          </section>
        )}
      </main>
    </>
  );
}