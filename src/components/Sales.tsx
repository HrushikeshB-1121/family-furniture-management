import {
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";
import { supabase } from "../lib/supabase";

const IST_TIME_ZONE = "Asia/Kolkata";

const SHOP_DETAILS = {
  name: "Sri Krishna Furniture And Home Appliances",
  description:
    "Wholesale & Retail All Wooden Furniture • Home Appliances",
  addressLine1:
    "Netaji Chowk, Girls High School Road",
  addressLine2:
    "Backside of Central Library, ADILABAD 504 001 (T.G.)",
  gstin: "36EPFPP1731D1Z3",
  phones: "9490137625 / 7780322770",
  bankAccount: "565220110000468",
  bankName: "Bank of India",
  ifsc: "BKID0005652",
};

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
  locations: Location[];
  totalAmount: number;
  paidNow: number;
  dueAmount: number;
  paymentMethod: string | null;
  notes: string | null;
};

function normalizePhone(value: string) {
  const digits = value.replace(/\D/g, "");

  if (digits.length > 10) {
    return digits.slice(-10);
  }

  return digits;
}

function getISTDateTimeValue(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: IST_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);

  const values = Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );

  return `${values.year}-${values.month}-${values.day}T${values.hour}:${values.minute}`;
}

function formatISTDateTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return new Intl.DateTimeFormat("en-IN", {
    timeZone: IST_TIME_ZONE,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(date);
}

function formatCurrency(value: number) {
  return `₹${value.toLocaleString("en-IN", {
    maximumFractionDigits: 2,
  })}`;
}

function formatPaymentMethod(value: string | null) {
  switch (value) {
    case "CASH":
      return "Cash";
    case "UPI":
      return "UPI";
    case "CARD":
      return "Card";
    case "BANK_TRANSFER":
      return "Bank Transfer";
    default:
      return value ?? "-";
  }
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

  const [productSearch, setProductSearch] =
    useState("");

  const [showProductDropdown, setShowProductDropdown] =
    useState(false);

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

  const [saleDate, setSaleDate] = useState(
    getISTDateTimeValue(),
  );

  const [loadingData, setLoadingData] =
    useState(true);

  const [saving, setSaving] = useState(false);

  const [message, setMessage] = useState("");

  const [errorMessage, setErrorMessage] =
    useState("");

  const [lastBill, setLastBill] =
    useState<BillData | null>(null);

  const [showBillPreview, setShowBillPreview] =
    useState(false);

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

  const filteredProducts = useMemo(() => {
    const search = productSearch
      .trim()
      .toLowerCase();

    if (!search) {
      return products;
    }

    return products.filter((product) => {
      const sku = product.sku.toLowerCase();
      const name = product.name.toLowerCase();

      return (
        sku.includes(search) ||
        name.includes(search)
      );
    });
  }, [productSearch, products]);

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
    setProductSearch("");
    setShowProductDropdown(false);

    setDraftLocationId("");
    setDraftQuantity("1");
    setDraftSellingPrice("");

    setCart([]);

    setPaidNow("");
    setPaymentMethod("CASH");
    setNotes("");
    setSaleDate(getISTDateTimeValue());

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

  function selectProduct(product: Product) {
    setDraftProductId(String(product.id));

    setProductSearch(
      `${product.sku} - ${product.name}`,
    );

    setShowProductDropdown(false);

    setErrorMessage("");
  }

  function handleProductSearchChange(
    value: string,
  ) {
    setProductSearch(value);
    setDraftProductId("");
    setDraftSellingPrice("");
    setShowProductDropdown(true);
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
    setProductSearch("");
    setShowProductDropdown(false);

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

    if (!saleDate) {
      setErrorMessage(
        "Sale date and time is required.",
      );
      return;
    }

    const saleDateValue = new Date(saleDate);

    if (Number.isNaN(saleDateValue.getTime())) {
      setErrorMessage(
        "Enter a valid sale date and time.",
      );
      return;
    }

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
          "create_sale_with_date",
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
            p_sale_date:
              saleDateValue.toISOString(),
          },
        );

      if (error) {
        throw error;
      }

      const saleId = Number(data);

      const bill: BillData = {
        saleId,
        saleDate:
          saleDateValue.toISOString(),
        customer:
          selectedCustomer,
        items: cart,
        products,
        locations,
        totalAmount: cartTotal,
        paidNow: numericPaidNow,
        dueAmount,
        paymentMethod:
          numericPaidNow > 0
            ? paymentMethod
            : null,
        notes:
          notes.trim() || null,
      };

      setLastBill(bill);
      setShowBillPreview(true);

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
        product_id: Number(row.product_id),
        location_id: Number(row.location_id),
        quantity: Number(row.quantity),
      })),
    );
  }

  function printBill() {
    setShowBillPreview(true);

    setTimeout(() => {
      const invoiceElement =
        document.querySelector(".invoice-paper");

      if (!invoiceElement) {
        setErrorMessage(
          "Invoice is not ready for printing.",
        );
        return;
      }

      const printWindow = window.open(
        "",
        "_blank",
        "width=900,height=1000",
      );

      if (!printWindow) {
        setErrorMessage(
          "Please allow pop-ups to print the invoice.",
        );
        return;
      }

      const styles = Array.from(
        document.querySelectorAll("style"),
      )
        .map((style) => style.textContent ?? "")
        .join("\n");

      printWindow.document.open();

      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="UTF-8" />
            <title>Invoice #${lastBill?.saleId ?? ""}</title>

            <style>
              ${styles}

              @page {
                size: A4;
                margin: 0;
              }

              html,
              body {
                margin: 0 !important;
                padding: 0 !important;
                width: 210mm !important;
                background: #ffffff !important;
              }

              body {
                min-height: 0 !important;
              }

              .invoice-paper {
                width: 210mm !important;
                min-height: 0 !important;
                height: auto !important;
                margin: 0 !important;
                padding: 12mm !important;
                box-sizing: border-box !important;
                background: #ffffff !important;
                box-shadow: none !important;
                page-break-after: avoid !important;
                break-after: avoid-page !important;
                page-break-inside: avoid !important;
                break-inside: avoid !important;
              }

              .invoice-paper * {
                visibility: visible !important;
              }
            </style>
          </head>

          <body>
            ${invoiceElement.outerHTML}
          </body>
        </html>
      `);

      printWindow.document.close();
      printWindow.focus();

      printWindow.addEventListener(
        "afterprint",
        () => {
          printWindow.close();
        },
        { once: true },
      );

      setTimeout(() => {
        printWindow.print();
      }, 300);
    }, 100);
  }

  function closeBillPreview() {
    setShowBillPreview(false);
  }

  if (loadingData) {
    return <div>Loading...</div>;
  }

  return (
    <>
      <style>
        {`
          .sales-screen {
            width: 100%;
            max-width: 1100px;
            margin: 0 auto;
          }

          .sales-screen > h2 {
            margin-bottom: 20px;
          }

          .sales-section {
            margin-bottom: 20px;
            padding: 20px;
            background: #ffffff;
            border: 1px solid #e4e7ec;
            border-radius: 14px;
            box-shadow: 0 1px 2px rgba(16, 24, 40, 0.05);
          }

          .sales-section h3 {
            margin-bottom: 16px;
          }

          .sales-row {
            display: grid;
            gap: 16px;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            margin-bottom: 16px;
          }

          .sales-field {
            position: relative;
          }

          .sales-field label {
            display: block;
            margin-bottom: 6px;
            color: #101828;
            font-size: 14px;
            font-weight: 600;
          }

          .sales-field input,
          .sales-field select,
          .sales-field textarea {
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

          .sales-field textarea {
            min-height: 90px;
          }

          .sales-field input:focus,
          .sales-field select:focus,
          .sales-field textarea:focus {
            border-color: #2563eb;
            outline: none;
            box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.12);
          }

          .product-picker {
            position: relative;
          }

          .product-picker-input {
            padding-right: 38px !important;
          }

          .product-picker-clear {
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

          .product-picker-clear:hover {
            background: #f2f4f7;
            color: #101828;
          }

          .product-dropdown {
            position: absolute;
            z-index: 30;
            left: 0;
            right: 0;
            top: calc(100% + 4px);
            max-height: 280px;
            overflow-y: auto;
            border: 1px solid #d0d5dd;
            border-radius: 8px;
            background: #ffffff;
            box-shadow: 0 10px 25px rgba(16, 24, 40, 0.12);
          }

          .product-option {
            width: 100%;
            min-height: auto;
            display: block;
            padding: 10px 12px;
            border: 0;
            border-bottom: 1px solid #f2f4f7;
            border-radius: 0;
            background: #ffffff;
            text-align: left;
          }

          .product-option:last-child {
            border-bottom: 0;
          }

          .product-option:hover {
            background: #eff6ff;
          }

          .product-option-sku {
            display: block;
            color: #2563eb;
            font-size: 13px;
            font-weight: 700;
          }

          .product-option-name {
            display: block;
            margin-top: 2px;
            color: #344054;
            font-size: 14px;
          }

          .product-picker-hint {
            margin-top: 6px;
            color: #667085;
            font-size: 12px;
          }

          .selected-product {
            margin-top: 6px;
            color: #15803d;
            font-size: 13px;
            font-weight: 600;
          }

          .sales-actions {
            display: flex;
            gap: 8px;
            flex-wrap: wrap;
          }

          .sales-cart-wrapper {
            width: 100%;
            overflow-x: auto;
            -webkit-overflow-scrolling: touch;
          }

          .sales-cart {
            width: 100%;
            min-width: 700px;
            border-collapse: collapse;
          }

          .sales-cart th,
          .sales-cart td {
            border-bottom: 1px solid #e4e7ec;
            padding: 10px;
            text-align: left;
            vertical-align: middle;
          }

          .sales-cart th {
            background: #f9fafb;
            color: #101828;
            font-weight: 650;
          }

          .sales-cart input {
            width: 100%;
            min-width: 80px;
            box-sizing: border-box;
            padding: 7px 9px;
            border: 1px solid #d0d5dd;
            border-radius: 6px;
          }

          .sales-total {
            margin-top: 16px;
            text-align: right;
            font-size: 18px;
            color: #101828;
          }

          .sales-message {
            margin-bottom: 16px;
            padding: 11px 13px;
            border-radius: 8px;
            font-size: 14px;
          }

          .sales-success {
            border: 1px solid #bbf7d0;
            background: #f0fdf4;
            color: #15803d;
          }

          .sales-error {
            border: 1px solid #fecaca;
            background: #fef2f2;
            color: #dc2626;
          }

          .bill-action-card {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 16px;
            flex-wrap: wrap;
          }

          .bill-action-card p {
            margin: 4px 0 0;
            color: #667085;
          }

          .bill-action-buttons {
            display: flex;
            gap: 8px;
            flex-wrap: wrap;
          }

          .bill-modal-overlay {
            position: fixed;
            inset: 0;
            z-index: 1000;
            display: flex;
            justify-content: center;
            align-items: flex-start;
            overflow-y: auto;
            padding: 24px;
            background: rgba(16, 24, 40, 0.65);
          }

          .bill-modal {
            width: 100%;
            max-width: 900px;
            margin: auto;
            border-radius: 12px;
            background: #eef1f5;
            box-shadow: 0 24px 60px rgba(16, 24, 40, 0.25);
          }

          .bill-modal-toolbar {
            display: flex;
            justify-content: space-between;
            align-items: center;
            gap: 12px;
            padding: 14px 18px;
            border-bottom: 1px solid #d0d5dd;
            background: #ffffff;
            border-radius: 12px 12px 0 0;
          }

          .bill-modal-toolbar-title {
            margin: 0;
            color: #101828;
            font-size: 16px;
            font-weight: 700;
          }

          .bill-modal-actions {
            display: flex;
            gap: 8px;
            flex-wrap: wrap;
          }

          .invoice-paper {
            width: 210mm;
            min-height: 297mm;
            box-sizing: border-box;
            margin: 20px auto;
            padding: 16mm;
            background: #ffffff;
            color: #111827;
            box-shadow: 0 5px 25px rgba(16, 24, 40, 0.12);
            font-family: Arial, Helvetica, sans-serif;
          }

          .invoice-header {
            display: grid;
            grid-template-columns: 1fr auto;
            gap: 24px;
            align-items: start;
            padding-bottom: 14px;
            border-bottom: 2px solid #111827;
          }

          .invoice-shop-name {
            margin: 0;
            color: #111827;
            font-size: 24px;
            line-height: 1.2;
            letter-spacing: 0.2px;
          }

          .invoice-shop-description {
            margin: 6px 0;
            color: #374151;
            font-size: 12px;
            font-weight: 600;
          }

          .invoice-shop-address {
            margin: 3px 0;
            color: #4b5563;
            font-size: 12px;
            line-height: 1.45;
          }

          .invoice-gstin {
            margin: 8px 0 0;
            color: #111827;
            font-size: 12px;
            font-weight: 700;
          }

          .invoice-contact {
            margin: 3px 0 0;
            color: #374151;
            font-size: 12px;
          }

          .invoice-title-box {
            min-width: 150px;
            padding: 12px 14px;
            border: 1px solid #9ca3af;
            text-align: center;
          }

          .invoice-title {
            margin: 0;
            color: #111827;
            font-size: 22px;
            font-weight: 800;
            letter-spacing: 1px;
          }

          .invoice-original {
            margin: 6px 0 0;
            color: #6b7280;
            font-size: 10px;
            text-transform: uppercase;
            letter-spacing: 0.7px;
          }

          .invoice-meta-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 16px;
            margin: 18px 0;
          }

          .invoice-meta-box {
            border: 1px solid #d1d5db;
          }

          .invoice-meta-heading {
            padding: 7px 10px;
            border-bottom: 1px solid #d1d5db;
            background: #f9fafb;
            color: #374151;
            font-size: 10px;
            font-weight: 800;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }

          .invoice-meta-content {
            padding: 10px;
            font-size: 12px;
            line-height: 1.55;
          }

          .invoice-customer-name {
            margin: 0 0 3px;
            font-size: 14px;
            font-weight: 800;
          }

          .invoice-item-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 4px;
            font-size: 11px;
          }

          .invoice-item-table th {
            padding: 9px 8px;
            border-top: 1px solid #111827;
            border-bottom: 1px solid #111827;
            background: #f8fafc;
            color: #111827;
            font-weight: 800;
            text-align: left;
          }

          .invoice-item-table td {
            padding: 9px 8px;
            border-bottom: 1px solid #e5e7eb;
            vertical-align: top;
          }

          .invoice-item-table .center {
            text-align: center;
          }

          .invoice-item-table .right {
            text-align: right;
          }

          .invoice-item-sku {
            margin-top: 3px;
            color: #6b7280;
            font-size: 9px;
          }

          .invoice-summary-area {
            display: flex;
            justify-content: flex-end;
            margin-top: 16px;
          }

          .invoice-summary {
            width: 310px;
          }

          .invoice-summary-row {
            display: flex;
            justify-content: space-between;
            gap: 20px;
            padding: 6px 0;
            border-bottom: 1px solid #e5e7eb;
            font-size: 12px;
          }

          .invoice-summary-row.total {
            margin-top: 4px;
            padding: 10px 0;
            border-top: 2px solid #111827;
            border-bottom: 2px solid #111827;
            font-size: 14px;
            font-weight: 800;
          }

          .invoice-summary-row.due {
            font-size: 14px;
            font-weight: 800;
          }

          .invoice-notes-box {
            margin-top: 20px;
            padding: 10px;
            border: 1px solid #d1d5db;
          }

          .invoice-notes-title {
            margin: 0 0 4px;
            color: #374151;
            font-size: 10px;
            font-weight: 800;
            text-transform: uppercase;
          }

          .invoice-notes-text {
            margin: 0;
            color: #4b5563;
            font-size: 11px;
            white-space: pre-wrap;
          }

          .invoice-footer {
            display: grid;
            grid-template-columns: 1fr 190px;
            gap: 24px;
            margin-top: 28px;
            padding-top: 14px;
            border-top: 1px solid #9ca3af;
          }

          .invoice-bank-title {
            margin: 0 0 6px;
            color: #111827;
            font-size: 11px;
            font-weight: 800;
          }

          .invoice-bank {
            color: #4b5563;
            font-size: 10px;
            line-height: 1.6;
          }

          .invoice-signature {
            display: flex;
            flex-direction: column;
            justify-content: flex-end;
            min-height: 80px;
            text-align: center;
          }

          .invoice-signature-line {
            margin-top: auto;
            padding-top: 12px;
            border-top: 1px solid #6b7280;
            color: #111827;
            font-size: 10px;
            font-weight: 700;
          }

          .invoice-thank-you {
            margin: 22px 0 0;
            padding-top: 10px;
            border-top: 1px solid #e5e7eb;
            color: #374151;
            text-align: center;
            font-size: 11px;
            font-weight: 600;
          }

          @media (max-width: 700px) {
            .sales-section {
              padding: 16px;
              border-radius: 10px;
            }

            .sales-row {
              grid-template-columns: 1fr;
              gap: 14px;
            }

            .sales-actions button,
            .bill-action-buttons button,
            .bill-modal-actions button {
              width: 100%;
            }

            .bill-modal-overlay {
              padding: 8px;
            }

            .bill-modal-toolbar {
              align-items: stretch;
              flex-direction: column;
            }

            .bill-modal-actions {
              width: 100%;
            }

            .invoice-paper {
              width: 100%;
              min-height: auto;
              margin: 8px auto;
              padding: 18px;
              box-shadow: none;
            }

            .invoice-header,
            .invoice-meta-grid,
            .invoice-footer {
              grid-template-columns: 1fr;
            }

            .invoice-title-box {
              width: 100%;
              box-sizing: border-box;
            }

            .invoice-summary {
              width: 100%;
            }

            .invoice-item-table {
              font-size: 10px;
            }

            .invoice-item-table th,
            .invoice-item-table td {
              padding: 6px 4px;
            }
          }
        `}
      </style>

      <main className="sales-screen">
        <h2>New Sale</h2>

        {message && (
          <div className="sales-message sales-success">
            {message}
          </div>
        )}

        {errorMessage && (
          <div className="sales-message sales-error">
            {errorMessage}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <section className="sales-section">
            <h3>Sale Details</h3>

            <div className="sales-row">
              <div className="sales-field">
                <label htmlFor="sale-date">
                  Sale Date &amp; Time
                </label>

                <input
                  id="sale-date"
                  type="datetime-local"
                  value={saleDate}
                  onChange={(event) =>
                    setSaleDate(
                      event.target.value,
                    )
                  }
                  required
                />

                <p className="product-picker-hint">
                  Uses IST. Change this when the sale
                  actually happened earlier.
                </p>
              </div>
            </div>
          </section>

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
              <div className="sales-field product-picker">
                <label htmlFor="sale-product-search">
                  Product
                </label>

                <input
                  id="sale-product-search"
                  className="product-picker-input"
                  type="text"
                  value={productSearch}
                  onChange={(event) =>
                    handleProductSearchChange(
                      event.target.value,
                    )
                  }
                  onFocus={() =>
                    setShowProductDropdown(true)
                  }
                  placeholder="Search by SKU or product name"
                  autoComplete="off"
                />

                {productSearch && (
                  <button
                    type="button"
                    className="product-picker-clear"
                    aria-label="Clear product"
                    onClick={() => {
                      setProductSearch("");
                      setDraftProductId("");
                      setDraftSellingPrice("");
                      setShowProductDropdown(true);
                    }}
                  >
                    ×
                  </button>
                )}

                {showProductDropdown && (
                  <div className="product-dropdown">
                    {filteredProducts.length === 0 ? (
                      <div
                        style={{
                          padding: "12px",
                          color: "#667085",
                          fontSize: "14px",
                        }}
                      >
                        No products found.
                      </div>
                    ) : (
                      filteredProducts.map(
                        (product) => (
                          <button
                            key={product.id}
                            type="button"
                            className="product-option"
                            onMouseDown={(event) =>
                              event.preventDefault()
                            }
                            onClick={() =>
                              selectProduct(
                                product,
                              )
                            }
                          >
                            <span className="product-option-sku">
                              {product.sku}
                            </span>

                            <span className="product-option-name">
                              {product.name}
                            </span>
                          </button>
                        ),
                      )
                    )}
                  </div>
                )}

                <p className="product-picker-hint">
                  Type SKU or product name to search.
                </p>

                {draftProduct && (
                  <p className="selected-product">
                    Selected: {draftProduct.sku} -{" "}
                    {draftProduct.name}
                  </p>
                )}
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
                          {location.name} (
                          {available} available)
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
              <div className="sales-cart-wrapper">
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
                              {formatCurrency(
                                item.quantity *
                                  item.sellingPrice,
                              )}
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
              </div>
            )}

            <div className="sales-total">
              <p>
                <strong>
                  Total:{" "}
                  {formatCurrency(cartTotal)}
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
                Due:{" "}
                {formatCurrency(dueAmount)}
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
            <div className="bill-action-card">
              <div>
                <strong>
                  Invoice #{lastBill.saleId} is ready
                </strong>

                <p>
                  The professional invoice is ready to view or print.
                </p>
              </div>

              <div className="bill-action-buttons">
                <button
                  type="button"
                  onClick={() =>
                    setShowBillPreview(true)
                  }
                >
                  View Bill
                </button>

                <button
                  type="button"
                  onClick={printBill}
                >
                  Print Bill
                </button>
              </div>
            </div>
          </section>
        )}
      </main>

      {lastBill && showBillPreview && (
        <div
          className="bill-modal-overlay"
          onMouseDown={(event) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              closeBillPreview();
            }
          }}
        >
          <div className="bill-modal">
            <div className="bill-modal-toolbar">
              <p className="bill-modal-toolbar-title">
                Invoice #{lastBill.saleId}
              </p>

              <div className="bill-modal-actions">
                <button
                  type="button"
                  onClick={closeBillPreview}
                >
                  Close
                </button>
              </div>
            </div>

            <article className="invoice-paper printable-bill">
              <header className="invoice-header">
                <div>
                  <h1 className="invoice-shop-name">
                    {SHOP_DETAILS.name}
                  </h1>

                  <p className="invoice-shop-description">
                    {SHOP_DETAILS.description}
                  </p>

                  <p className="invoice-shop-address">
                    {SHOP_DETAILS.addressLine1}
                    <br />
                    {SHOP_DETAILS.addressLine2}
                  </p>

                  <p className="invoice-gstin">
                    GSTIN: {SHOP_DETAILS.gstin}
                  </p>

                  <p className="invoice-contact">
                    Phone: {SHOP_DETAILS.phones}
                  </p>
                </div>

                <div className="invoice-title-box">
                  <h2 className="invoice-title">
                    INVOICE
                  </h2>

                  <p className="invoice-original">
                    Original for Customer
                  </p>
                </div>
              </header>

              <section className="invoice-meta-grid">
                <div className="invoice-meta-box">
                  <div className="invoice-meta-heading">
                    Bill To
                  </div>

                  <div className="invoice-meta-content">
                    <p className="invoice-customer-name">
                      {lastBill.customer.name}
                    </p>

                    {lastBill.customer.phone && (
                      <div>
                        Phone:{" "}
                        {lastBill.customer.phone}
                      </div>
                    )}

                    {lastBill.customer.address && (
                      <div>
                        Address:{" "}
                        {lastBill.customer.address}
                      </div>
                    )}

                    {lastBill.customer.customer_type ===
                      "SHOP" &&
                      lastBill.customer.contact_person && (
                        <div>
                          Contact Person:{" "}
                          {
                            lastBill.customer
                              .contact_person
                          }
                        </div>
                      )}
                  </div>
                </div>

                <div className="invoice-meta-box">
                  <div className="invoice-meta-heading">
                    Invoice Details
                  </div>

                  <div className="invoice-meta-content">
                    <div>
                      <strong>
                        Invoice No:
                      </strong>{" "}
                      #{lastBill.saleId}
                    </div>

                    <div>
                      <strong>
                        Date:
                      </strong>{" "}
                      {formatISTDateTime(
                        lastBill.saleDate,
                      )}{" "}
                      IST
                    </div>

                    <div>
                      <strong>
                        Payment:
                      </strong>{" "}
                      {formatPaymentMethod(
                        lastBill.paymentMethod,
                      )}
                    </div>
                  </div>
                </div>
              </section>

              <table className="invoice-item-table">
                <thead>
                  <tr>
                    <th
                      style={{
                        width: "7%",
                      }}
                    >
                      S.No
                    </th>

                    <th>
                      Particulars &amp; Details
                    </th>

                    <th
                      className="center"
                      style={{
                        width: "10%",
                      }}
                    >
                      Qty
                    </th>

                    <th
                      className="right"
                      style={{
                        width: "17%",
                      }}
                    >
                      Rate
                    </th>

                    <th
                      className="right"
                      style={{
                        width: "18%",
                      }}
                    >
                      Amount
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {lastBill.items.map(
                    (item, index) => {
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
                          <td className="center">
                            {index + 1}
                          </td>

                          <td>
                            <strong>
                              {product?.name ??
                                "-"}
                            </strong>

                            <div className="invoice-item-sku">
                              SKU:{" "}
                              {product?.sku ??
                                "-"}
                            </div>
                          </td>

                          <td className="center">
                            {item.quantity}
                          </td>

                          <td className="right">
                            {formatCurrency(
                              item.sellingPrice,
                            )}
                          </td>

                          <td className="right">
                            {formatCurrency(
                              item.quantity *
                                item.sellingPrice,
                            )}
                          </td>
                        </tr>
                      );
                    },
                  )}
                </tbody>
              </table>

              <div className="invoice-summary-area">
                <div className="invoice-summary">
                  <div className="invoice-summary-row total">
                    <span>
                      Total Amount
                    </span>

                    <span>
                      {formatCurrency(
                        lastBill.totalAmount,
                      )}
                    </span>
                  </div>

                  <div className="invoice-summary-row">
                    <span>
                      Paid
                    </span>

                    <span>
                      {formatCurrency(
                        lastBill.paidNow,
                      )}
                    </span>
                  </div>

                  <div className="invoice-summary-row due">
                    <span>
                      Balance Due
                    </span>

                    <span>
                      {formatCurrency(
                        lastBill.dueAmount,
                      )}
                    </span>
                  </div>

                  <div className="invoice-summary-row">
                    <span>
                      Payment Method
                    </span>

                    <span>
                      {formatPaymentMethod(
                        lastBill.paymentMethod,
                      )}
                    </span>
                  </div>
                </div>
              </div>

              {lastBill.notes && (
                <section className="invoice-notes-box">
                  <p className="invoice-notes-title">
                    Notes
                  </p>

                  <p className="invoice-notes-text">
                    {lastBill.notes}
                  </p>
                </section>
              )}

              <footer className="invoice-footer">
                <div>
                  <p className="invoice-bank-title">
                    Bank Details
                  </p>

                  <div className="invoice-bank">
                    <div>
                      A/c No:{" "}
                      {SHOP_DETAILS.bankAccount}
                    </div>

                    <div>
                      Bank:{" "}
                      {SHOP_DETAILS.bankName}
                    </div>

                    <div>
                      IFSC:{" "}
                      {SHOP_DETAILS.ifsc}
                    </div>
                  </div>
                </div>

                <div className="invoice-signature">
                  <div className="invoice-signature-line">
                    Authorized Signatory
                  </div>
                </div>
              </footer>

              <p className="invoice-thank-you">
                Thank you for your business.
              </p>
            </article>
          </div>
        </div>
      )}
    </>
  );
}