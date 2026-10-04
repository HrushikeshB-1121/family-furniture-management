import { useEffect, useMemo, useState } from 'react';
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
  const [quantities, setQuantities] = useState<Record<number, string>>({});
  const [notes, setNotes] = useState('');
  const [search, setSearch] = useState('');

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
    setSearch('');
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
          'Opening stock quantity must be a whole number greater than or equal to 0.',
        );
        return;
      }
    }

    setSaving(true);

    try {
     const { data, error } = await supabase.rpc(
      'set_opening_stock_batch_with_date',
      {
        p_location_id: Number(locationId),
        p_items: items,
        p_notes: notes.trim() || null,
        p_opening_date: new Date().toISOString(),
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

  const selectedLocation = locations.find(
    (location) =>
      location.id === Number(locationId),
  );

  const filteredProducts = useMemo(() => {
    const normalizedSearch =
      search.trim().toLowerCase();

    if (!normalizedSearch) {
      return products;
    }

    return products.filter(
      (product) =>
        product.name
          .toLowerCase()
          .includes(normalizedSearch) ||
        product.sku
          .toLowerCase()
          .includes(normalizedSearch),
    );
  }, [products, search]);

  const alreadySetCount = products.filter(
    (product) =>
      openingSet[product.id] === true,
  ).length;

  const enteredCount = products.filter(
    (product) =>
      !openingSet[product.id] &&
      quantities[product.id]?.trim() !== '',
  ).length;

  if (loading) {
    return (
      <p>Loading opening stock...</p>
    );
  }

  return (
    <>
      <style>
        {`
          .opening-stock-page {
            width: 100%;
            max-width: 1200px;
            margin: 0 auto;
          }

          .opening-stock-header {
            margin-bottom: 20px;
          }

          .opening-stock-header h1 {
            margin-bottom: 5px;
          }

          .opening-stock-description {
            color: #667085;
            font-size: 14px;
            line-height: 1.5;
          }

          .opening-stock-info {
            margin-bottom: 18px;
            padding: 13px 15px;
            border: 1px solid #dbeafe;
            border-radius: 10px;
            background: #eff6ff;
            color: #1e40af;
            font-size: 13px;
            line-height: 1.5;
          }

          .opening-stock-error {
            margin-bottom: 16px;
            padding: 11px 13px;
            border: 1px solid #fecaca;
            border-radius: 8px;
            background: #fef2f2;
            color: #dc2626;
            font-size: 14px;
          }

          .opening-stock-success {
            margin-bottom: 16px;
            padding: 11px 13px;
            border: 1px solid #bbf7d0;
            border-radius: 8px;
            background: #f0fdf4;
            color: #15803d;
            font-size: 14px;
          }

          .opening-stock-summary {
            display: grid;
            grid-template-columns:
              repeat(3, minmax(0, 1fr));
            gap: 12px;
            margin-bottom: 20px;
          }

          .opening-stock-summary-card {
            padding: 17px;
            background: #ffffff;
            border: 1px solid #e4e7ec;
            border-radius: 12px;
            box-shadow:
              0 1px 2px rgba(16, 24, 40, 0.05);
          }

          .opening-stock-summary-label {
            color: #667085;
            font-size: 12px;
            font-weight: 600;
          }

          .opening-stock-summary-value {
            margin-top: 5px;
            color: #101828;
            font-size: 23px;
            line-height: 1.2;
            font-weight: 700;
          }

          .opening-stock-summary-note {
            margin-top: 4px;
            color: #98a2b3;
            font-size: 11px;
          }

          .opening-stock-card {
            padding: 18px;
            background: #ffffff;
            border: 1px solid #e4e7ec;
            border-radius: 12px;
            box-shadow:
              0 1px 2px rgba(16, 24, 40, 0.05);
          }

          .opening-stock-location-section {
            margin-bottom: 18px;
          }

          .opening-stock-label {
            display: block;
            margin-bottom: 6px;
            color: #344054;
            font-size: 13px;
            font-weight: 600;
          }

          .opening-stock-select,
          .opening-stock-input,
          .opening-stock-notes,
          .opening-stock-search {
            width: 100%;
            box-sizing: border-box;
            min-height: 42px;
            padding: 9px 12px;
            border: 1px solid #d0d5dd;
            border-radius: 6px;
            background: #ffffff;
            color: #101828;
            font-size: 14px;
          }

          .opening-stock-notes {
            min-height: 86px;
            resize: vertical;
          }

          .opening-stock-select:focus,
          .opening-stock-input:focus,
          .opening-stock-notes:focus,
          .opening-stock-search:focus {
            outline: none;
            border-color: #2563eb;
            box-shadow:
              0 0 0 3px rgba(37, 99, 235, 0.12);
          }

          .opening-stock-search-row {
            display: flex;
            gap: 10px;
            align-items: flex-end;
            margin-bottom: 14px;
          }

          .opening-stock-search-wrapper {
            flex: 1;
          }

          .opening-stock-results {
            margin-bottom: 10px;
            color: #667085;
            font-size: 13px;
          }

          .opening-stock-table-wrapper {
            overflow-x: auto;
            border: 1px solid #eaecf0;
            border-radius: 10px;
          }

          .opening-stock-table {
            width: 100%;
            min-width: 680px;
            border-collapse: collapse;
          }

          .opening-stock-table th {
            padding: 11px 14px;
            background: #f9fafb;
            border-bottom: 1px solid #eaecf0;
            color: #667085;
            font-size: 11px;
            font-weight: 700;
            text-align: left;
          }

          .opening-stock-table td {
            padding: 12px 14px;
            border-bottom: 1px solid #f2f4f7;
            color: #344054;
            font-size: 13px;
            vertical-align: middle;
          }

          .opening-stock-table tr:last-child td {
            border-bottom: none;
          }

          .opening-stock-product-sku {
            color: #667085;
            font-size: 11px;
            font-weight: 700;
          }

          .opening-stock-product-name {
            margin-top: 2px;
            color: #101828;
            font-size: 13px;
            font-weight: 600;
          }

          .opening-stock-status {
            display: inline-flex;
            align-items: center;
            padding: 4px 8px;
            border-radius: 999px;
            font-size: 10px;
            font-weight: 700;
          }

          .opening-stock-status-set {
            background: #ecfdf3;
            color: #15803d;
          }

          .opening-stock-status-not-set {
            background: #f2f4f7;
            color: #667085;
          }

          .opening-stock-input {
            max-width: 180px;
          }

          .opening-stock-input:disabled {
            background: #f9fafb;
            color: #98a2b3;
          }

          .opening-stock-notes-section {
            margin-top: 18px;
          }

          .opening-stock-actions {
            display: flex;
            align-items: center;
            justify-content: flex-end;
            margin-top: 18px;
          }

          .opening-stock-button {
            min-height: 42px;
            padding: 9px 16px;
            border: 1px solid #2563eb;
            border-radius: 7px;
            background: #2563eb;
            color: #ffffff;
            font-size: 14px;
            font-weight: 600;
            cursor: pointer;
          }

          .opening-stock-button:hover:not(:disabled) {
            background: #1d4ed8;
            border-color: #1d4ed8;
          }

          .opening-stock-button:disabled {
            opacity: 0.6;
            cursor: not-allowed;
          }

          .opening-stock-loading {
            padding: 18px;
            text-align: center;
            color: #667085;
            font-size: 13px;
          }

          .opening-stock-empty {
            padding: 28px 20px;
            text-align: center;
            color: #667085;
          }

          .opening-stock-empty strong {
            display: block;
            margin-bottom: 4px;
            color: #344054;
            font-size: 14px;
          }

          .opening-stock-mobile-list {
            display: none;
          }

          .opening-stock-mobile-item {
            padding: 14px;
            border: 1px solid #eaecf0;
            border-radius: 10px;
            background: #ffffff;
          }

          .opening-stock-mobile-header {
            display: flex;
            align-items: flex-start;
            justify-content: space-between;
            gap: 12px;
            margin-bottom: 12px;
          }

          .opening-stock-mobile-meta {
            margin-top: 3px;
            color: #667085;
            font-size: 11px;
          }

          @media (max-width: 900px) {
            .opening-stock-summary {
              grid-template-columns:
                repeat(2, minmax(0, 1fr));
            }
          }

          @media (max-width: 700px) {
            .opening-stock-table-wrapper {
              display: none;
            }

            .opening-stock-mobile-list {
              display: grid;
              gap: 10px;
            }

            .opening-stock-search-row {
              align-items: stretch;
            }

            .opening-stock-input {
              max-width: none;
            }
          }

          @media (max-width: 600px) {
            .opening-stock-summary {
              grid-template-columns: 1fr;
            }

            .opening-stock-card {
              padding: 15px;
            }

            .opening-stock-summary-value {
              font-size: 20px;
            }

            .opening-stock-actions {
              justify-content: stretch;
            }

            .opening-stock-button {
              width: 100%;
            }

            .opening-stock-search-row {
              flex-direction: column;
            }
          }
        `}
      </style>

      <main className="opening-stock-page">
        <div className="opening-stock-header">
          <h1>Opening Stock</h1>

          <p className="opening-stock-description">
            Enter the physical stock you already have
            before starting normal purchases and sales.
          </p>
        </div>

        <div className="opening-stock-info">
          Opening stock is recorded separately from
          purchases and stock adjustments. Once opening
          stock is set for a product and location, use
          Stock Adjustment for future corrections.
        </div>

        {errorMessage && (
          <div className="opening-stock-error">
            {errorMessage}
          </div>
        )}

        {message && (
          <div className="opening-stock-success">
            {message}
          </div>
        )}

        <section className="opening-stock-summary">
          <article className="opening-stock-summary-card">
            <div className="opening-stock-summary-label">
              Location
            </div>

            <div className="opening-stock-summary-value">
              {selectedLocation?.name ?? '-'}
            </div>

            <div className="opening-stock-summary-note">
              Selected stock location
            </div>
          </article>

          <article className="opening-stock-summary-card">
            <div className="opening-stock-summary-label">
              Already Set
            </div>

            <div className="opening-stock-summary-value">
              {alreadySetCount}
            </div>

            <div className="opening-stock-summary-note">
              Products with opening stock recorded
            </div>
          </article>

          <article className="opening-stock-summary-card">
            <div className="opening-stock-summary-label">
              Ready to Save
            </div>

            <div className="opening-stock-summary-value">
              {enteredCount}
            </div>

            <div className="opening-stock-summary-note">
              Products with quantity entered
            </div>
          </article>
        </section>

        <form
          className="opening-stock-card"
          onSubmit={handleSubmit}
        >
          <div className="opening-stock-location-section">
            <label
              className="opening-stock-label"
              htmlFor="opening-stock-location"
            >
              Location
            </label>

            <select
              id="opening-stock-location"
              className="opening-stock-select"
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
            <div className="opening-stock-loading">
              Loading opening stock status...
            </div>
          )}

          {locationId && !loadingOpening && (
            <>
              <div className="opening-stock-search-row">
                <div className="opening-stock-search-wrapper">
                  <label
                    className="opening-stock-label"
                    htmlFor="opening-stock-search"
                  >
                    Search Products
                  </label>

                  <input
                    id="opening-stock-search"
                    className="opening-stock-search"
                    type="text"
                    value={search}
                    onChange={(event) =>
                      setSearch(event.target.value)
                    }
                    placeholder="Search by SKU or product name"
                  />
                </div>
              </div>

              <div className="opening-stock-results">
                Showing {filteredProducts.length} of{' '}
                {products.length} products
              </div>

              {filteredProducts.length === 0 ? (
                <div className="opening-stock-empty">
                  <strong>
                    No products found
                  </strong>

                  Try a different SKU or product name.
                </div>
              ) : (
                <>
                  <div className="opening-stock-table-wrapper">
                    <table className="opening-stock-table">
                      <thead>
                        <tr>
                          <th>Product</th>
                          <th>Opening Quantity</th>
                          <th>Status</th>
                        </tr>
                      </thead>

                      <tbody>
                        {filteredProducts.map(
                          (product) => {
                            const alreadySet =
                              openingSet[
                                product.id
                              ] === true;

                            return (
                              <tr
                                key={
                                  product.id
                                }
                              >
                                <td>
                                  <div className="opening-stock-product-sku">
                                    {product.sku}
                                  </div>

                                  <div className="opening-stock-product-name">
                                    {product.name}
                                  </div>
                                </td>

                                <td>
                                  <input
                                    className="opening-stock-input"
                                    type="number"
                                    min="0"
                                    step="1"
                                    value={
                                      quantities[
                                        product.id
                                      ] ?? ''
                                    }
                                    disabled={
                                      alreadySet
                                    }
                                    onChange={(
                                      event,
                                    ) =>
                                      updateQuantity(
                                        product.id,
                                        event
                                          .target
                                          .value,
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
                                  <span
                                    className={`opening-stock-status ${
                                      alreadySet
                                        ? 'opening-stock-status-set'
                                        : 'opening-stock-status-not-set'
                                    }`}
                                  >
                                    {alreadySet
                                      ? 'Already set'
                                      : 'Not set'}
                                  </span>
                                </td>
                              </tr>
                            );
                          },
                        )}
                      </tbody>
                    </table>
                  </div>

                  <div className="opening-stock-mobile-list">
                    {filteredProducts.map(
                      (product) => {
                        const alreadySet =
                          openingSet[
                            product.id
                          ] === true;

                        return (
                          <div
                            key={
                              product.id
                            }
                            className="opening-stock-mobile-item"
                          >
                            <div className="opening-stock-mobile-header">
                              <div>
                                <div className="opening-stock-product-name">
                                  {product.name}
                                </div>

                                <div className="opening-stock-mobile-meta">
                                  {product.sku}
                                </div>
                              </div>

                              <span
                                className={`opening-stock-status ${
                                  alreadySet
                                    ? 'opening-stock-status-set'
                                    : 'opening-stock-status-not-set'
                                }`}
                              >
                                {alreadySet
                                  ? 'Already set'
                                  : 'Not set'}
                              </span>
                            </div>

                            <label
                              className="opening-stock-label"
                              htmlFor={`mobile-opening-${product.id}`}
                            >
                              Opening Quantity
                            </label>

                            <input
                              id={`mobile-opening-${product.id}`}
                              className="opening-stock-input"
                              type="number"
                              min="0"
                              step="1"
                              value={
                                quantities[
                                  product.id
                                ] ?? ''
                              }
                              disabled={
                                alreadySet
                              }
                              onChange={(
                                event,
                              ) =>
                                updateQuantity(
                                  product.id,
                                  event
                                    .target
                                    .value,
                                )
                              }
                              placeholder={
                                alreadySet
                                  ? 'Already set'
                                  : 'Enter quantity'
                              }
                            />
                          </div>
                        );
                      },
                    )}
                  </div>
                </>
              )}
            </>
          )}

          <div className="opening-stock-notes-section">
            <label
              className="opening-stock-label"
              htmlFor="opening-stock-notes"
            >
              Notes <span style={{ color: '#98a2b3' }}>(optional)</span>
            </label>

            <textarea
              id="opening-stock-notes"
              className="opening-stock-notes"
              value={notes}
              onChange={(event) =>
                setNotes(event.target.value)
              }
              placeholder="Example: Physical stock counted before system go-live"
              rows={3}
            />
          </div>

          <div className="opening-stock-actions">
            <button
              type="submit"
              className="opening-stock-button"
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
      </main>
    </>
  );
}

export default OpeningStock;