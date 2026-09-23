import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

type Product = {
  id: number;
  sku: string;
  name: string;
};

type Location = {
  id: number;
  name: string;
};

function StockAdjustment() {
  const [products, setProducts] = useState<Product[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);

  const [productId, setProductId] = useState('');
  const [locationId, setLocationId] = useState('');
  const [adjustmentType, setAdjustmentType] = useState<'INCREASE' | 'DECREASE'>(
    'INCREASE',
  );
  const [quantity, setQuantity] = useState('');
  const [reason, setReason] = useState('');
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

    const [productsResult, locationsResult] = await Promise.all([
      supabase
        .from('products')
        .select('id, sku, name')
        .eq('is_active', true)
        .order('name'),

      supabase
        .from('locations')
        .select('id, name')
        .eq('is_active', true)
        .order('name'),
    ]);

    if (productsResult.error) {
      console.error(
        'Failed to load products:',
        productsResult.error,
      );
      setErrorMessage('Failed to load products.');
    }

    if (locationsResult.error) {
      console.error(
        'Failed to load locations:',
        locationsResult.error,
      );
      setErrorMessage('Failed to load locations.');
    }

    setProducts(productsResult.data ?? []);
    setLocations(locationsResult.data ?? []);

    setLoading(false);
  }

  function resetForm() {
    setProductId('');
    setLocationId('');
    setAdjustmentType('INCREASE');
    setQuantity('');
    setReason('');
    setNotes('');
  }

  async function handleSubmit(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    setMessage('');
    setErrorMessage('');

    if (!productId || !locationId) {
      setErrorMessage(
        'Product and location are required.',
      );
      return;
    }

    if (!reason.trim()) {
      setErrorMessage('Reason is required.');
      return;
    }

    const adjustmentQuantity = Number(quantity);

    if (
      !Number.isFinite(adjustmentQuantity) ||
      adjustmentQuantity <= 0
    ) {
      setErrorMessage(
        'Quantity must be greater than 0.',
      );
      return;
    }

    const signedQuantity =
      adjustmentType === 'INCREASE'
        ? adjustmentQuantity
        : -adjustmentQuantity;

    setSaving(true);

    try {
      const { data, error } = await supabase.rpc(
        'adjust_stock',
        {
          p_product_id: Number(productId),
          p_location_id: Number(locationId),
          p_quantity: signedQuantity,
          p_reason: reason.trim(),
          p_notes: notes.trim() || null,
        },
      );

      if (error) {
        throw error;
      }

      const adjustmentId = Number(data);

      setMessage(
        `Stock adjustment completed successfully. ${
          adjustmentType === 'INCREASE'
            ? adjustmentQuantity
            : -adjustmentQuantity
        } unit(s) adjusted. Adjustment #${adjustmentId}.`,
      );

      resetForm();
    } catch (error) {
      console.error(
        'Failed to adjust stock:',
        error,
      );

      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Failed to adjust stock.',
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <p>Loading stock adjustment...</p>;
  }

  return (
    <main>
      <h1>Stock Adjustment</h1>

      <p>
        Use this to correct physical stock differences,
        damaged items, or missing stock.
      </p>

      <form onSubmit={handleSubmit}>
        <div>
          <label htmlFor="adjustment-product">
            Product
          </label>

          <select
            id="adjustment-product"
            value={productId}
            onChange={(event) =>
              setProductId(event.target.value)
            }
          >
            <option value="">
              Select product
            </option>

            {products.map((product) => (
              <option
                key={product.id}
                value={product.id}
              >
                {product.sku} - {product.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="adjustment-location">
            Location
          </label>

          <select
            id="adjustment-location"
            value={locationId}
            onChange={(event) =>
              setLocationId(event.target.value)
            }
          >
            <option value="">
              Select location
            </option>

            {locations.map((location) => (
              <option
                key={location.id}
                value={location.id}
              >
                {location.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="adjustment-type">
            Adjustment Type
          </label>

          <select
            id="adjustment-type"
            value={adjustmentType}
            onChange={(event) =>
              setAdjustmentType(
                event.target.value as
                  | 'INCREASE'
                  | 'DECREASE',
              )
            }
          >
            <option value="INCREASE">
              Increase Stock
            </option>

            <option value="DECREASE">
              Decrease Stock
            </option>
          </select>
        </div>

        <div>
          <label htmlFor="adjustment-quantity">
            Quantity
          </label>

          <input
            id="adjustment-quantity"
            type="number"
            min="0.01"
            step="0.01"
            value={quantity}
            onChange={(event) =>
              setQuantity(event.target.value)
            }
            placeholder="Enter quantity"
          />
        </div>

        <div>
          <label htmlFor="adjustment-reason">
            Reason
          </label>

          <input
            id="adjustment-reason"
            type="text"
            value={reason}
            onChange={(event) =>
              setReason(event.target.value)
            }
            placeholder="Example: Physical count difference"
          />
        </div>

        <div>
          <label htmlFor="adjustment-notes">
            Notes (optional)
          </label>

          <textarea
            id="adjustment-notes"
            value={notes}
            onChange={(event) =>
              setNotes(event.target.value)
            }
            placeholder="Additional details"
            rows={3}
          />
        </div>

        <button
          type="submit"
          disabled={saving}
        >
          {saving
            ? 'Saving...'
            : 'Adjust Stock'}
        </button>
      </form>

      {message && <p>{message}</p>}
      {errorMessage && <p>{errorMessage}</p>}
    </main>
  );
}

export default StockAdjustment;