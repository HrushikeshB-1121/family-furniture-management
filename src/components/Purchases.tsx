import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

type Product = {
  id: number;
  sku: string;
  name: string;
};

type Supplier = {
  id: number;
  name: string;
};

type Location = {
  id: number;
  name: string;
};

function Purchases() {
  const [products, setProducts] = useState<Product[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);

  const [supplierId, setSupplierId] = useState('');
  const [locationId, setLocationId] = useState('');
  const [productId, setProductId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [reference, setReference] = useState('');
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

    const [productsResult, suppliersResult, locationsResult] =
      await Promise.all([
        supabase
          .from('products')
          .select('id, sku, name')
          .eq('is_active', true)
          .order('name'),

        supabase
          .from('suppliers')
          .select('id, name')
          .eq('is_active', true)
          .order('name'),

        supabase
          .from('locations')
          .select('id, name')
          .eq('is_active', true)
          .order('name'),
      ]);

    if (productsResult.error) {
      console.error('Failed to load products:', productsResult.error);
      setErrorMessage('Failed to load products.');
    }

    if (suppliersResult.error) {
      console.error('Failed to load suppliers:', suppliersResult.error);
      setErrorMessage('Failed to load suppliers.');
    }

    if (locationsResult.error) {
      console.error('Failed to load locations:', locationsResult.error);
      setErrorMessage('Failed to load locations.');
    }

    setProducts(productsResult.data ?? []);
    setSuppliers(suppliersResult.data ?? []);
    setLocations(locationsResult.data ?? []);

    setLoading(false);
  }

  function resetForm() {
    setSupplierId('');
    setLocationId('');
    setProductId('');
    setQuantity('');
    setReference('');
    setNotes('');
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setMessage('');
    setErrorMessage('');

    if (!supplierId || !locationId || !productId) {
      setErrorMessage(
        'Supplier, location and product are required.',
      );
      return;
    }

    const receivedQuantity = Number(quantity);

    if (!Number.isFinite(receivedQuantity) || receivedQuantity <= 0) {
      setErrorMessage('Quantity must be greater than 0.');
      return;
    }

    setSaving(true);

    try {
      /*
       * Step 1:
       * Create a pending purchase record.
       *
       * No purchase cost is entered by staff.
       */
      const { data: purchase, error: purchaseError } = await supabase
        .from('purchases')
        .insert({
          supplier_id: Number(supplierId),
          location_id: Number(locationId),
          status: 'PENDING',
          invoice_number: reference.trim() || null,
          notes: notes.trim() || null,
          total_amount: 0,
        })
        .select('id')
        .single();

      if (purchaseError || !purchase) {
        throw (
          purchaseError ??
          new Error('Unable to create pending stock receipt.')
        );
      }

      /*
       * Step 2:
       * Record the product received.
       *
       * Cost remains NULL until an admin confirms it.
       */
      const { error: itemError } = await supabase
        .from('purchase_items')
        .insert({
          purchase_id: purchase.id,
          product_id: Number(productId),
          quantity: receivedQuantity,
          unit_cost: null,
          total_cost: null,
        });

      if (itemError) {
        throw itemError;
      }

      /*
       * Step 3:
       * Update stock immediately.
       *
       * This is the important staff workflow:
       * receiving stock does NOT wait for admin confirmation.
       */
      const { error: stockError } = await supabase
        .from('stock_transactions')
        .insert({
          product_id: Number(productId),
          location_id: Number(locationId),
          transaction_type: 'PURCHASE',
          quantity: receivedQuantity,
          transaction_date: new Date().toISOString(),
          reference_type: 'PURCHASE',
          reference_id: purchase.id,
          notes: `Stock received - pending purchase #${purchase.id}`,
        });

      if (stockError) {
        throw stockError;
      }

      setMessage(
        `Stock received successfully. ${receivedQuantity} unit(s) added to stock. Purchase #${purchase.id} is pending admin confirmation.`,
      );

      resetForm();
    } catch (error) {
      console.error('Failed to receive stock:', error);

      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Failed to receive stock.',
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <p>Loading stock receiving...</p>;
  }

  return (
    <main>
      <h1>Receive Stock</h1>

      <p>
        Enter the stock that has physically arrived. Purchase cost is
        handled later by an admin.
      </p>

      <form onSubmit={handleSubmit}>
        <div>
          <label htmlFor="supplier">Supplier</label>
          <select
            id="supplier"
            value={supplierId}
            onChange={(event) => setSupplierId(event.target.value)}
          >
            <option value="">Select supplier</option>

            {suppliers.map((supplier) => (
              <option key={supplier.id} value={supplier.id}>
                {supplier.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="location">Location</label>
          <select
            id="location"
            value={locationId}
            onChange={(event) => setLocationId(event.target.value)}
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
          <label htmlFor="product">Product</label>
          <select
            id="product"
            value={productId}
            onChange={(event) => setProductId(event.target.value)}
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
            onChange={(event) => setQuantity(event.target.value)}
            placeholder="Enter quantity"
          />
        </div>

        <div>
          <label htmlFor="reference">
            Invoice / Reference (optional)
          </label>
          <input
            id="reference"
            type="text"
            value={reference}
            onChange={(event) => setReference(event.target.value)}
            placeholder="Invoice number"
          />
        </div>

        <div>
          <label htmlFor="notes">Notes (optional)</label>
          <textarea
            id="notes"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Any additional note"
            rows={3}
          />
        </div>

        <button type="submit" disabled={saving}>
          {saving ? 'Saving...' : 'Receive Stock'}
        </button>
      </form>

      {message && <p>{message}</p>}

      {errorMessage && <p>{errorMessage}</p>}
    </main>
  );
}

export default Purchases;