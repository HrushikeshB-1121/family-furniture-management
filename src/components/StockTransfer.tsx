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

function StockTransfer() {
  const [products, setProducts] = useState<Product[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);

  const [productId, setProductId] = useState('');
  const [sourceLocationId, setSourceLocationId] = useState('');
  const [destinationLocationId, setDestinationLocationId] =
    useState('');
  const [quantity, setQuantity] = useState('');
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

  function resetForm() {
    setProductId('');
    setSourceLocationId('');
    setDestinationLocationId('');
    setQuantity('');
    setNotes('');
  }

  async function handleSubmit(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    setMessage('');
    setErrorMessage('');

    if (
      !productId ||
      !sourceLocationId ||
      !destinationLocationId
    ) {
      setErrorMessage(
        'Product, source location and destination location are required.',
      );
      return;
    }

    if (sourceLocationId === destinationLocationId) {
      setErrorMessage(
        'Source and destination locations must be different.',
      );
      return;
    }

    const transferQuantity = Number(quantity);

    if (
      !Number.isFinite(transferQuantity) ||
      transferQuantity <= 0
    ) {
      setErrorMessage(
        'Quantity must be greater than 0.',
      );
      return;
    }

    setSaving(true);

    try {
      const { data, error } = await supabase.rpc(
        'transfer_stock',
        {
          p_product_id: Number(productId),
          p_source_location_id: Number(sourceLocationId),
          p_destination_location_id:
            Number(destinationLocationId),
          p_quantity: transferQuantity,
          p_notes: notes.trim() || null,
        },
      );

      if (error) {
        throw error;
      }

      const transferId = Number(data);

      setMessage(
        `Stock transferred successfully. ${transferQuantity} unit(s) moved. Transfer #${transferId}.`,
      );

      resetForm();
    } catch (error) {
      console.error(
        'Failed to transfer stock:',
        error,
      );

      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Failed to transfer stock.',
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <p>Loading stock transfer...</p>;
  }

  return (
    <main>
      <h1>Stock Transfer</h1>

      <p>
        Move stock from one location to another.
      </p>

      <form onSubmit={handleSubmit}>
        <div>
          <label htmlFor="transfer-product">
            Product
          </label>

          <select
            id="transfer-product"
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
          <label htmlFor="source-location">
            From Location
          </label>

          <select
            id="source-location"
            value={sourceLocationId}
            onChange={(event) =>
              setSourceLocationId(event.target.value)
            }
          >
            <option value="">
              Select source location
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
          <label htmlFor="destination-location">
            To Location
          </label>

          <select
            id="destination-location"
            value={destinationLocationId}
            onChange={(event) =>
              setDestinationLocationId(
                event.target.value,
              )
            }
          >
            <option value="">
              Select destination location
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
          <label htmlFor="transfer-quantity">
            Quantity
          </label>

          <input
            id="transfer-quantity"
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
          <label htmlFor="transfer-notes">
            Notes (optional)
          </label>

          <textarea
            id="transfer-notes"
            value={notes}
            onChange={(event) =>
              setNotes(event.target.value)
            }
            placeholder="Any additional note"
            rows={3}
          />
        </div>

        <button
          type="submit"
          disabled={saving}
        >
          {saving
            ? 'Transferring...'
            : 'Transfer Stock'}
        </button>
      </form>

      {message && <p>{message}</p>}
      {errorMessage && <p>{errorMessage}</p>}
    </main>
  );
}

export default StockTransfer;