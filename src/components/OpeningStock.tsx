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

type OpeningState = Record<number, boolean>;

function OpeningStock() {
  const [products, setProducts] = useState<Product[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [openingSet, setOpeningSet] = useState<OpeningState>({});

  const [locationId, setLocationId] = useState('');
  const [quantities, setQuantities] = useState<
    Record<number, string>
  >({});
  const [notes, setNotes] = useState('');

  const [loading, setLoading] = useState(true);
  const [loadingOpening, setLoadingOpening] = useState(false);
  const [saving, setSaving] = useState(false);

  const [message, setMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    void loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    setErrorMessage('');

    const [productsResult, locationsResult] =
      await Promise.all([
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

  async function loadOpeningState(nextLocationId: string) {
    setOpeningSet({});
    setQuantities({});
    setMessage('');
    setErrorMessage('');

    if (!nextLocationId) {
      return;
    }

    setLoadingOpening(true);

    const { data, error } = await supabase
      .from('stock_transactions')
      .select('product_id')
      .eq('location_id', Number(nextLocationId))
      .eq('transaction_type', 'OPENING');

    if (error) {
      console.error(
        'Failed to load opening stock state:',
        error,
      );
      setErrorMessage(
        'Failed to load opening stock information.',
      );
      setLoadingOpening(false);
      return;
    }

    const state: OpeningState = {};

    for (const row of data ?? []) {
      state[Number(row.product_id)] = true;
    }

    setOpeningSet(state);
    setLoadingOpening(false);
  }

  function handleLocationChange(
    event: React.ChangeEvent<HTMLSelectElement>,
  ) {
    const nextLocationId = event.target.value;

    setLocationId(nextLocationId);
    void loadOpeningState(nextLocationId);
  }

  function updateQuantity(
    productId: number,
    value: string,
  ) {
    setQuantities((current) => ({
      ...current,
      [productId]: value,
    }));
  }

  function resetForm() {
    setQuantities({});
    setNotes('');
  }

  async function handleSubmit(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    setMessage('');
    setErrorMessage('');

    if (!locationId) {
      setErrorMessage('Location is required.');
      return;
    }

    const items = products
      .filter(
        (product) =>
          !openingSet[product.id] &&
          quantities[product.id]?.trim() !== '',
      )
      .map((product) => ({
        product_id: product.id,
        quantity: Number(
          quantities[product.id],
        ),
      }));

    if (items.length === 0) {
      setErrorMessage(
        'Enter opening stock quantity for at least one product.',
      );
      return;
    }

    for (const item of items) {
      if (
        !Number.isFinite(item.quantity) ||
        item.quantity < 0 ||
        !Number.isInteger(item.quantity)
      ) {
        setErrorMessage(
          'Opening stock quantity must be a positive whole number.',
        );
        return;
      }
    }

    setSaving(true);

    try {
      const { data, error } = await supabase.rpc(
        'set_opening_stock_batch',
        {
          p_location_id: Number(locationId),
          p_items: items,
          p_notes: notes.trim() || null,
        },
      );

      if (error) {
        throw error;
      }

      const insertedCount = Number(data);

      setMessage(
        `Opening stock saved successfully for ${insertedCount} product(s).`,
      );

      resetForm();

      await loadOpeningState(locationId);
    } catch (error) {
      console.error(
        'Failed to set opening stock:',
        error,
      );

      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Failed to save opening stock.',
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <p>Loading opening stock...</p>;
  }

  return (
    <main>
      <h1>Opening Stock</h1>

      <p>
        Use this once to enter the physical stock you
        already have before starting normal purchases
        and sales.
      </p>

      <p>
        Opening stock is recorded separately from
        purchases and stock adjustments. Once opening
        stock is set for a product and location, use
        Stock Adjustment for future corrections.
      </p>

      <form onSubmit={handleSubmit}>
        <div>
          <label htmlFor="opening-stock-location">
            Location
          </label>

          <select
            id="opening-stock-location"
            value={locationId}
            onChange={handleLocationChange}
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

        {loadingOpening && (
          <p>Loading opening stock status...</p>
        )}

        {locationId && !loadingOpening && (
          <div style={{ marginTop: 16 }}>
            <table>
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Opening Quantity</th>
                  <th>Status</th>
                </tr>
              </thead>

              <tbody>
                {products.map((product) => {
                  const alreadySet =
                    openingSet[product.id] === true;

                  return (
                    <tr key={product.id}>
                      <td>
                        <strong>
                          {product.sku}
                        </strong>
                        <br />
                        {product.name}
                      </td>

                      <td>
                        <input
                          type="number"
                          min="0"
                          step="1"
                          value={
                            quantities[
                              product.id
                            ] ?? ''
                          }
                          disabled={alreadySet}
                          onChange={(event) =>
                            updateQuantity(
                              product.id,
                              event.target.value,
                            )
                          }
                          placeholder={
                            alreadySet
                              ? 'Already set'
                              : 'Enter quantity'
                          }
                          aria-label={`Opening quantity for ${product.sku}`}
                        />
                      </td>

                      <td>
                        {alreadySet
                          ? 'Already set'
                          : 'Not set'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div style={{ marginTop: 16 }}>
          <label htmlFor="opening-stock-notes">
            Notes (optional)
          </label>

          <textarea
            id="opening-stock-notes"
            value={notes}
            onChange={(event) =>
              setNotes(event.target.value)
            }
            placeholder="Example: Physical stock counted before system go-live"
            rows={3}
          />
        </div>

        <div style={{ marginTop: 16 }}>
          <button
            type="submit"
            disabled={
              saving ||
              loadingOpening ||
              !locationId
            }
          >
            {saving
              ? 'Saving...'
              : 'Save Opening Stock'}
          </button>
        </div>
      </form>

      {message && <p>{message}</p>}
      {errorMessage && <p>{errorMessage}</p>}
    </main>
  );
}

export default OpeningStock;