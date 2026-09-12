import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';

type Product = {
  id: number;
  sku: string;
  name: string;
  default_selling_price: number | null;
};

type Location = {
  id: number;
  name: string;
};

type Customer = {
  id: number;
  name: string;
  contact_person: string | null;
  phone: string | null;
  customer_type: 'INDIVIDUAL' | 'SHOP';
};

type NewCustomerForm = {
  customerType: 'INDIVIDUAL' | 'SHOP';
  name: string;
  contactPerson: string;
  phone: string;
};

function Sales() {
  const [products, setProducts] = useState<Product[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);

  const [locationId, setLocationId] = useState('');
  const [productId, setProductId] = useState('');

  const [customerSearch, setCustomerSearch] = useState('');
  const [selectedCustomer, setSelectedCustomer] =
    useState<Customer | null>(null);

  const [showNewCustomer, setShowNewCustomer] = useState(false);

  const [newCustomer, setNewCustomer] = useState<NewCustomerForm>({
    customerType: 'INDIVIDUAL',
    name: '',
    contactPerson: '',
    phone: '',
  });

  const [quantity, setQuantity] = useState('');
  const [sellingPrice, setSellingPrice] = useState('');
  const [paidNow, setPaidNow] = useState('0');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [notes, setNotes] = useState('');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    void loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    setErrorMessage('');

    const [productsResult, locationsResult, customersResult] =
      await Promise.all([
        supabase
          .from('products')
          .select('id, sku, name, default_selling_price')
          .eq('is_active', true)
          .order('name'),

        supabase
          .from('locations')
          .select('id, name')
          .eq('is_active', true)
          .order('name'),

        supabase
          .from('customers')
          .select(
            'id, name, contact_person, phone, customer_type',
          )
          .eq('is_active', true)
          .order('name'),
      ]);

    if (productsResult.error) {
      console.error('Failed to load products:', productsResult.error);
      setErrorMessage('Failed to load products.');
    }

    if (locationsResult.error) {
      console.error('Failed to load locations:', locationsResult.error);
      setErrorMessage('Failed to load locations.');
    }

    if (customersResult.error) {
      console.error('Failed to load customers:', customersResult.error);
      setErrorMessage('Failed to load customers.');
    }

    setProducts(productsResult.data ?? []);
    setLocations(locationsResult.data ?? []);
    setCustomers(customersResult.data ?? []);

    setLoading(false);
  }

  function handleProductChange(value: string) {
    setProductId(value);

    const product = products.find(
      (item) => String(item.id) === value,
    );

    if (
      product?.default_selling_price !== null &&
      product?.default_selling_price !== undefined
    ) {
      setSellingPrice(String(product.default_selling_price));
    } else {
      setSellingPrice('');
    }
  }

  function resetForm() {
    setLocationId('');
    setProductId('');
    setCustomerSearch('');
    setSelectedCustomer(null);
    setShowNewCustomer(false);

    setNewCustomer({
      customerType: 'INDIVIDUAL',
      name: '',
      contactPerson: '',
      phone: '',
    });

    setQuantity('');
    setSellingPrice('');
    setPaidNow('0');
    setPaymentMethod('');
    setNotes('');
  }

  function clearCustomerSelection() {
    setSelectedCustomer(null);
    setCustomerSearch('');
  }

  function handleCustomerSearchChange(value: string) {
    setCustomerSearch(value);
    setSelectedCustomer(null);
  }

  async function createCustomer() {
    setErrorMessage('');

    if (!newCustomer.name.trim()) {
      setErrorMessage('Customer or shop name is required.');
      return;
    }

    if (!newCustomer.phone.trim()) {
      setErrorMessage(
        'Phone number is required for a saved customer.',
      );
      return;
    }

    const { data, error } = await supabase
      .from('customers')
      .insert({
        name: newCustomer.name.trim(),
        contact_person:
          newCustomer.contactPerson.trim() || null,
        phone: newCustomer.phone.trim(),
        customer_type: newCustomer.customerType,
      })
      .select(
        'id, name, contact_person, phone, customer_type',
      )
      .single();

    if (error || !data) {
      console.error('Failed to create customer:', error);

      setErrorMessage(
        error?.message ?? 'Failed to create customer.',
      );
      return;
    }

    const customer = data as Customer;

    setCustomers((current) =>
      [...current, customer].sort((a, b) =>
        a.name.localeCompare(b.name),
      ),
    );

    setSelectedCustomer(customer);
    setCustomerSearch(customer.phone ?? customer.name);
    setShowNewCustomer(false);

    setNewCustomer({
      customerType: 'INDIVIDUAL',
      name: '',
      contactPerson: '',
      phone: '',
    });
  }

  async function handleSubmit(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    setMessage('');
    setErrorMessage('');

    if (!locationId || !productId) {
      setErrorMessage('Location and product are required.');
      return;
    }

    const saleQuantity = Number(quantity);
    const price = Number(sellingPrice);
    const payment = Number(paidNow);

    if (!Number.isFinite(saleQuantity) || saleQuantity <= 0) {
      setErrorMessage('Quantity must be greater than 0.');
      return;
    }

    if (!Number.isFinite(price) || price < 0) {
      setErrorMessage('Selling price must be 0 or greater.');
      return;
    }

    if (!Number.isFinite(payment) || payment < 0) {
      setErrorMessage('Paid Now must be 0 or greater.');
      return;
    }

    const totalAmount = saleQuantity * price;

    if (payment > totalAmount) {
      setErrorMessage(
        'Paid Now cannot be greater than the sale total.',
      );
      return;
    }

    if (payment > 0 && !paymentMethod) {
      setErrorMessage(
        'Select a payment method when Paid Now is greater than 0.',
      );
      return;
    }

    setSaving(true);

    try {
      const { data: stockRow, error: stockLookupError } =
        await supabase
          .from('current_stock')
          .select('quantity')
          .eq('product_id', Number(productId))
          .eq('location_id', Number(locationId))
          .maybeSingle();

      if (stockLookupError) {
        throw stockLookupError;
      }

      const currentStock = Number(stockRow?.quantity ?? 0);

      if (currentStock < saleQuantity) {
        throw new Error(
          `Not enough stock. Available: ${currentStock}. Requested: ${saleQuantity}.`,
        );
      }

      const { data: sale, error: saleError } = await supabase
        .from('sales')
        .insert({
          customer_id: selectedCustomer?.id ?? null,
          location_id: Number(locationId),
          total_amount: totalAmount,
          paid_now: payment,
          payment_method: payment > 0 ? paymentMethod : null,
          notes: notes.trim() || null,
        })
        .select('id')
        .single();

      if (saleError || !sale) {
        throw saleError ?? new Error('Unable to create sale.');
      }

      const { error: saleItemError } = await supabase
        .from('sale_items')
        .insert({
          sale_id: sale.id,
          product_id: Number(productId),
          quantity: saleQuantity,
          selling_price: price,
          unit_cost: null,
          total_amount: totalAmount,
          total_cost: null,
          gross_profit: null,
        });

      if (saleItemError) {
        throw saleItemError;
      }

      const { error: stockTransactionError } =
        await supabase.from('stock_transactions').insert({
          product_id: Number(productId),
          location_id: Number(locationId),
          transaction_type: 'SALE',
          quantity: saleQuantity,
          transaction_date: new Date().toISOString(),
          reference_type: 'SALE',
          reference_id: sale.id,
          notes: `Sale #${sale.id}`,
        });

      if (stockTransactionError) {
        throw stockTransactionError;
      }

      /*
       * Customer ledger:
       * Sale adds the full amount to receivables.
       * Immediate payment reduces the receivable.
       *
       * Walk-in sales without a customer account do not create
       * customer ledger records.
       */
      if (selectedCustomer) {
        const { error: customerSaleError } =
          await supabase
            .from('customer_transactions')
            .insert({
              customer_id: selectedCustomer.id,
              transaction_type: 'SALE',
              amount: totalAmount,
              sale_id: sale.id,
              transaction_date: new Date().toISOString(),
              notes: `Sale #${sale.id}`,
            });

        if (customerSaleError) {
          throw customerSaleError;
        }

        if (payment > 0) {
          const { error: customerPaymentError } =
            await supabase
              .from('customer_transactions')
              .insert({
                customer_id: selectedCustomer.id,
                transaction_type: 'PAYMENT',
                amount: payment,
                sale_id: sale.id,
                transaction_date: new Date().toISOString(),
                payment_method: paymentMethod,
                notes: `Payment against sale #${sale.id}`,
              });

          if (customerPaymentError) {
            throw customerPaymentError;
          }
        }
      }

      const customerDue =
        selectedCustomer === null ? 0 : totalAmount - payment;

      setMessage(
        `Sale #${sale.id} created. Total: INR ${totalAmount.toLocaleString(
          'en-IN',
        )}. Paid Now: INR ${payment.toLocaleString(
          'en-IN',
        )}. Customer Due: INR ${customerDue.toLocaleString(
          'en-IN',
        )}.`,
      );

      resetForm();
    } catch (error) {
      console.error('Failed to create sale:', error);

      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Failed to create sale.',
      );
    } finally {
      setSaving(false);
    }
  }

  const matchingCustomers = useMemo(() => {
    const normalized = customerSearch.trim().toLowerCase();

    if (!normalized || selectedCustomer) {
      return [];
    }

    return customers
      .filter((customer) => {
        return (
          customer.name.toLowerCase().includes(normalized) ||
          (customer.contact_person ?? '')
            .toLowerCase()
            .includes(normalized) ||
          (customer.phone ?? '').includes(normalized)
        );
      })
      .slice(0, 8);
  }, [customerSearch, customers, selectedCustomer]);

  if (loading) {
    return <p>Loading sales...</p>;
  }

  return (
    <main>
      <h1>Create Sale</h1>

      <form onSubmit={handleSubmit}>
        <div>
          <label htmlFor="location">Location</label>

          <select
            id="location"
            value={locationId}
            onChange={(event) =>
              setLocationId(event.target.value)
            }
          >
            <option value="">Select location</option>

            {locations.map((location) => (
              <option key={location.id} value={location.id}>
                {location.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="customerSearch">Customer</label>

          {selectedCustomer ? (
            <div>
              <strong>{selectedCustomer.name}</strong>

              <p>
                {selectedCustomer.customer_type === 'SHOP'
                  ? 'Shop'
                  : 'Individual'}
                {selectedCustomer.phone
                  ? ` - ${selectedCustomer.phone}`
                  : ''}
              </p>

              <button
                type="button"
                onClick={clearCustomerSelection}
              >
                Change Customer
              </button>
            </div>
          ) : (
            <>
              <input
                id="customerSearch"
                value={customerSearch}
                onChange={(event) =>
                  handleCustomerSearchChange(
                    event.target.value,
                  )
                }
                placeholder="Search by name or phone"
              />

              {matchingCustomers.length > 0 && (
                <div>
                  {matchingCustomers.map((customer) => (
                    <button
                      key={customer.id}
                      type="button"
                      onClick={() => {
                        setSelectedCustomer(customer);
                        setCustomerSearch(
                          customer.phone ?? customer.name,
                        );
                      }}
                    >
                      {customer.name}
                      {customer.phone
                        ? ` - ${customer.phone}`
                        : ''}
                    </button>
                  ))}
                </div>
              )}

              <button
                type="button"
                onClick={() => setShowNewCustomer(true)}
              >
                + New Customer
              </button>
            </>
          )}
        </div>

        <div>
          <label htmlFor="product">Product</label>

          <select
            id="product"
            value={productId}
            onChange={(event) =>
              handleProductChange(event.target.value)
            }
          >
            <option value="">Select product</option>

            {products.map((product) => (
              <option key={product.id} value={product.id}>
                {product.sku} - {product.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="quantity">Quantity</label>

          <input
            id="quantity"
            type="number"
            min="0.01"
            step="0.01"
            value={quantity}
            onChange={(event) =>
              setQuantity(event.target.value)
            }
            placeholder="Quantity"
          />
        </div>

        <div>
          <label htmlFor="sellingPrice">
            Actual Selling Price Per Unit
          </label>

          <input
            id="sellingPrice"
            type="number"
            min="0"
            step="0.01"
            value={sellingPrice}
            onChange={(event) =>
              setSellingPrice(event.target.value)
            }
            placeholder="Selling price"
          />
        </div>

        <div>
          <label htmlFor="paidNow">Paid Now</label>

          <input
            id="paidNow"
            type="number"
            min="0"
            step="0.01"
            value={paidNow}
            onChange={(event) =>
              setPaidNow(event.target.value)
            }
            placeholder="0"
          />
        </div>

        <div>
          <label htmlFor="paymentMethod">
            Payment Method
          </label>

          <select
            id="paymentMethod"
            value={paymentMethod}
            onChange={(event) =>
              setPaymentMethod(event.target.value)
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

        <div>
          <label htmlFor="notes">Notes</label>

          <textarea
            id="notes"
            rows={2}
            value={notes}
            onChange={(event) =>
              setNotes(event.target.value)
            }
            placeholder="Optional notes"
          />
        </div>

        <button type="submit" disabled={saving}>
          {saving ? 'Saving...' : 'Create Sale'}
        </button>
      </form>

      {message && <p>{message}</p>}
      {errorMessage && <p>{errorMessage}</p>}

      {showNewCustomer && (
        <section>
          <h2>New Customer</h2>

          <div>
            <label htmlFor="newCustomerType">Type</label>

            <select
              id="newCustomerType"
              value={newCustomer.customerType}
              onChange={(event) =>
                setNewCustomer((current) => ({
                  ...current,
                  customerType: event.target.value as
                    | 'INDIVIDUAL'
                    | 'SHOP',
                }))
              }
            >
              <option value="INDIVIDUAL">Individual</option>
              <option value="SHOP">Shop</option>
            </select>
          </div>

          <div>
            <label htmlFor="newCustomerName">
              {newCustomer.customerType === 'SHOP'
                ? 'Shop Name'
                : 'Customer Name'}
            </label>

            <input
              id="newCustomerName"
              value={newCustomer.name}
              onChange={(event) =>
                setNewCustomer((current) => ({
                  ...current,
                  name: event.target.value,
                }))
              }
            />
          </div>

          {newCustomer.customerType === 'SHOP' && (
            <div>
              <label htmlFor="newCustomerContact">
                Owner / Contact Person
              </label>

              <input
                id="newCustomerContact"
                value={newCustomer.contactPerson}
                onChange={(event) =>
                  setNewCustomer((current) => ({
                    ...current,
                    contactPerson: event.target.value,
                  }))
                }
              />
            </div>
          )}

          <div>
            <label htmlFor="newCustomerPhone">Phone</label>

            <input
              id="newCustomerPhone"
              type="tel"
              value={newCustomer.phone}
              onChange={(event) =>
                setNewCustomer((current) => ({
                  ...current,
                  phone: event.target.value,
                }))
              }
              placeholder="Phone number"
            />
          </div>

          <button
            type="button"
            onClick={() => void createCustomer()}
          >
            Save Customer
          </button>

          <button
            type="button"
            onClick={() => {
              setShowNewCustomer(false);
              setErrorMessage('');
            }}
          >
            Cancel
          </button>
        </section>
      )}
    </main>
  );
}

export default Sales;