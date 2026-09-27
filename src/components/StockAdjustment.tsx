import {
  useEffect,
  useMemo,
  useState,
} from 'react';
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

type StockRow = {
  product_id: number;
  location_id: number;
  quantity: number;
};

function StockAdjustment() {
  const [products, setProducts] =
    useState<Product[]>([]);

  const [locations, setLocations] =
    useState<Location[]>([]);

  const [stock, setStock] =
    useState<StockRow[]>([]);

  const [productId, setProductId] =
    useState('');

  const [productSearch, setProductSearch] =
    useState('');

  const [
    showProductDropdown,
    setShowProductDropdown,
  ] = useState(false);

  const [locationId, setLocationId] =
    useState('');

  const [adjustmentType, setAdjustmentType] =
    useState<'INCREASE' | 'DECREASE'>(
      'INCREASE',
    );

  const [quantity, setQuantity] =
    useState('');

  const [reason, setReason] =
    useState('');

  const [notes, setNotes] =
    useState('');

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [message, setMessage] =
    useState('');

  const [errorMessage, setErrorMessage] =
    useState('');

  useEffect(() => {
    void loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    setErrorMessage('');

    const [
      productsResult,
      locationsResult,
      stockResult,
    ] = await Promise.all([
      supabase
        .from('products')
        .select(
          'id, sku, name',
        )
        .eq('is_active', true)
        .order('name'),

      supabase
        .from('locations')
        .select(
          'id, name',
        )
        .eq('is_active', true)
        .order('name'),

      supabase
        .from('current_stock')
        .select(
          'product_id, location_id, quantity',
        ),
    ]);

    if (productsResult.error) {
      console.error(
        'Failed to load products:',
        productsResult.error,
      );

      setErrorMessage(
        'Failed to load products.',
      );
    }

    if (locationsResult.error) {
      console.error(
        'Failed to load locations:',
        locationsResult.error,
      );

      setErrorMessage(
        'Failed to load locations.',
      );
    }

    if (stockResult.error) {
      console.error(
        'Failed to load stock:',
        stockResult.error,
      );

      setErrorMessage(
        'Failed to load stock.',
      );
    }

    setProducts(
      productsResult.data ?? [],
    );

    setLocations(
      locationsResult.data ?? [],
    );

    setStock(
      (stockResult.data ?? []).map(
        (row) => ({
          product_id: Number(
            row.product_id,
          ),
          location_id: Number(
            row.location_id,
          ),
          quantity: Number(
            row.quantity,
          ),
        }),
      ),
    );

    setLoading(false);
  }

  const filteredProducts = useMemo(() => {
    const search =
      productSearch
        .trim()
        .toLowerCase();

    if (!search) {
      return products;
    }

    return products.filter(
      (product) =>
        product.sku
          .toLowerCase()
          .includes(search) ||
        product.name
          .toLowerCase()
          .includes(search),
    );
  }, [
    productSearch,
    products,
  ]);

  const selectedProduct =
    products.find(
      (product) =>
        String(product.id) ===
        productId,
    );

  const selectedLocation =
    locations.find(
      (location) =>
        String(location.id) ===
        locationId,
    );

  const currentStock =
    getCurrentStock(
      Number(productId),
      Number(locationId),
    );

  function getCurrentStock(
    selectedProductId: number,
    selectedLocationId: number,
  ) {
    if (
      !selectedProductId ||
      !selectedLocationId
    ) {
      return 0;
    }

    const stockRow =
      stock.find(
        (row) =>
          row.product_id ===
            selectedProductId &&
          row.location_id ===
            selectedLocationId,
      );

    return Number(
      stockRow?.quantity ?? 0,
    );
  }

  function selectProduct(
    product: Product,
  ) {
    setProductId(
      String(product.id),
    );

    setProductSearch(
      `${product.sku} - ${product.name}`,
    );

    setShowProductDropdown(
      false,
    );

    setErrorMessage('');
  }

  function handleProductSearchChange(
    value: string,
  ) {
    setProductSearch(value);
    setProductId('');
    setShowProductDropdown(true);
    setErrorMessage('');
  }

  function resetForm() {
    setProductId('');
    setProductSearch('');
    setShowProductDropdown(false);

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
      setErrorMessage(
        'Reason is required.',
      );
      return;
    }

    const adjustmentQuantity =
      Number(quantity);

    if (
      !Number.isFinite(
        adjustmentQuantity,
      ) ||
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
      const {
        data,
        error,
      } = await supabase.rpc(
        'adjust_stock',
        {
          p_product_id:
            Number(productId),

          p_location_id:
            Number(locationId),

          p_quantity:
            signedQuantity,

          p_reason:
            reason.trim(),

          p_notes:
            notes.trim() || null,
        },
      );

      if (error) {
        throw error;
      }

      const adjustmentId =
        Number(data);

      setMessage(
        `Stock adjustment completed successfully. ${
          adjustmentType === 'INCREASE'
            ? adjustmentQuantity
            : -adjustmentQuantity
        } unit(s) adjusted. Adjustment #${adjustmentId}.`,
      );

      resetForm();

      await refreshStock();
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

  async function refreshStock() {
    const {
      data,
      error,
    } = await supabase
      .from('current_stock')
      .select(
        'product_id, location_id, quantity',
      );

    if (error) {
      console.error(
        'Failed to refresh stock:',
        error,
      );
      return;
    }

    setStock(
      (data ?? []).map(
        (row) => ({
          product_id: Number(
            row.product_id,
          ),
          location_id: Number(
            row.location_id,
          ),
          quantity: Number(
            row.quantity,
          ),
        }),
      ),
    );
  }

  if (loading) {
    return (
      <p>
        Loading stock adjustment...
      </p>
    );
  }

  return (
    <>
      <style>
        {`
          .adjustment-page {
            width: 100%;
            max-width: 850px;
            margin: 0 auto;
          }

          .adjustment-description {
            margin-bottom: 20px;
            color: #667085;
          }

          .adjustment-card {
            padding: 20px;
            background: #ffffff;
            border: 1px solid #e4e7ec;
            border-radius: 14px;
            box-shadow:
              0 1px 2px rgba(16, 24, 40, 0.05);
          }

          .adjustment-field {
            position: relative;
            margin-bottom: 18px;
          }

          .adjustment-field label {
            display: block;
            margin-bottom: 6px;
            color: #101828;
            font-size: 14px;
            font-weight: 600;
          }

          .adjustment-field input,
          .adjustment-field select,
          .adjustment-field textarea {
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

          .adjustment-field textarea {
            min-height: 90px;
            resize: vertical;
          }

          .adjustment-field input:focus,
          .adjustment-field select:focus,
          .adjustment-field textarea:focus {
            outline: none;
            border-color: #2563eb;
            box-shadow:
              0 0 0 3px rgba(37, 99, 235, 0.12);
          }

          .adjustment-picker {
            position: relative;
          }

          .adjustment-picker-clear {
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

          .adjustment-picker-clear:hover {
            background: #f2f4f7;
            color: #101828;
          }

          .adjustment-dropdown {
            position: absolute;
            z-index: 30;
            left: 0;
            right: 0;
            top: calc(100% + 4px);
            max-height: 280px;
            overflow-y: auto;
            background: #ffffff;
            border: 1px solid #d0d5dd;
            border-radius: 8px;
            box-shadow:
              0 10px 25px rgba(16, 24, 40, 0.12);
          }

          .adjustment-option {
            width: 100%;
            min-height: auto;
            display: block;
            padding: 11px 12px;
            border: 0;
            border-bottom: 1px solid #f2f4f7;
            border-radius: 0;
            background: #ffffff;
            text-align: left;
          }

          .adjustment-option:last-child {
            border-bottom: 0;
          }

          .adjustment-option:hover {
            background: #eff6ff;
          }

          .adjustment-option-sku {
            display: block;
            color: #2563eb;
            font-size: 13px;
            font-weight: 700;
          }

          .adjustment-option-name {
            display: block;
            margin-top: 2px;
            color: #101828;
            font-size: 14px;
            font-weight: 600;
          }

          .adjustment-picker-hint {
            margin-top: 6px;
            color: #667085;
            font-size: 12px;
          }

          .adjustment-selected {
            margin-top: 7px;
            color: #15803d;
            font-size: 13px;
            font-weight: 600;
          }

          .stock-info {
            margin: -2px 0 18px;
            padding: 11px 13px;
            border: 1px solid #bfdbfe;
            border-radius: 8px;
            background: #eff6ff;
            color: #1e40af;
            font-size: 14px;
          }

          .stock-info strong {
            color: #101828;
          }

          .adjustment-type {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 10px;
            margin-bottom: 18px;
          }

          .adjustment-type-button {
            min-height: 46px;
            border: 1px solid #d0d5dd;
            background: #ffffff;
            color: #344054;
          }

          .adjustment-type-button.increase-active {
            border-color: #16a34a;
            background: #f0fdf4;
            color: #15803d;
          }

          .adjustment-type-button.decrease-active {
            border-color: #dc2626;
            background: #fef2f2;
            color: #dc2626;
          }

          .adjustment-message {
            margin-bottom: 16px;
            padding: 11px 13px;
            border-radius: 8px;
            font-size: 14px;
          }

          .adjustment-success {
            border: 1px solid #bbf7d0;
            background: #f0fdf4;
            color: #15803d;
          }

          .adjustment-error {
            border: 1px solid #fecaca;
            background: #fef2f2;
            color: #dc2626;
          }

          .adjustment-submit {
            width: 100%;
            margin-top: 4px;
          }

          @media (max-width: 600px) {
            .adjustment-card {
              padding: 16px;
              border-radius: 10px;
            }

            .adjustment-type {
              grid-template-columns: 1fr;
            }
          }
        `}
      </style>

      <main className="adjustment-page">
        <h1>
          Stock Adjustment
        </h1>

        <p className="adjustment-description">
          Use this to correct physical stock
          differences, damaged items, or
          missing stock.
        </p>

        {message && (
          <div className="adjustment-message adjustment-success">
            {message}
          </div>
        )}

        {errorMessage && (
          <div className="adjustment-message adjustment-error">
            {errorMessage}
          </div>
        )}

        <section className="adjustment-card">
          <form
            onSubmit={
              handleSubmit
            }
          >
            <div className="adjustment-field adjustment-picker">
              <label htmlFor="adjustment-product-search">
                Product
              </label>

              <input
                id="adjustment-product-search"
                type="text"
                value={productSearch}
                onChange={(event) =>
                  handleProductSearchChange(
                    event.target.value,
                  )
                }
                onFocus={() =>
                  setShowProductDropdown(
                    true,
                  )
                }
                autoComplete="off"
                placeholder="Search by SKU or product name"
              />

              {productSearch && (
                <button
                  type="button"
                  className="adjustment-picker-clear"
                  aria-label="Clear product"
                  onClick={() => {
                    setProductSearch('');
                    setProductId('');
                    setShowProductDropdown(
                      true,
                    );
                    setErrorMessage('');
                  }}
                >
                  ×
                </button>
              )}

              {showProductDropdown && (
                <div className="adjustment-dropdown">
                  {filteredProducts.length ===
                  0 ? (
                    <div
                      style={{
                        padding:
                          '12px',
                        color:
                          '#667085',
                        fontSize:
                          '14px',
                      }}
                    >
                      No products found.
                    </div>
                  ) : (
                    filteredProducts.map(
                      (product) => (
                        <button
                          key={
                            product.id
                          }
                          type="button"
                          className="adjustment-option"
                          onMouseDown={(
                            event,
                          ) =>
                            event.preventDefault()
                          }
                          onClick={() =>
                            selectProduct(
                              product,
                            )
                          }
                        >
                          <span className="adjustment-option-sku">
                            {product.sku}
                          </span>

                          <span className="adjustment-option-name">
                            {product.name}
                          </span>
                        </button>
                      ),
                    )
                  )}
                </div>
              )}

              <p className="adjustment-picker-hint">
                Type SKU or product name to search.
              </p>

              {selectedProduct && (
                <p className="adjustment-selected">
                  Selected:{' '}
                  {selectedProduct.sku} -{' '}
                  {selectedProduct.name}
                </p>
              )}
            </div>

            <div className="adjustment-field">
              <label htmlFor="adjustment-location">
                Location
              </label>

              <select
                id="adjustment-location"
                value={locationId}
                onChange={(event) =>
                  setLocationId(
                    event.target.value,
                  )
                }
              >
                <option value="">
                  Select location
                </option>

                {locations.map(
                  (location) => (
                    <option
                      key={
                        location.id
                      }
                      value={
                        location.id
                      }
                    >
                      {location.name}
                    </option>
                  ),
                )}
              </select>
            </div>

            {selectedProduct &&
              selectedLocation && (
                <div className="stock-info">
                  Current stock at{' '}
                  <strong>
                    {
                      selectedLocation.name
                    }
                  </strong>
                  :{' '}
                  <strong>
                    {currentStock}
                  </strong>{' '}
                  unit(s)
                </div>
              )}

            <div>
              <label
                style={{
                  display: 'block',
                  marginBottom: '6px',
                  color: '#101828',
                  fontSize: '14px',
                  fontWeight: 600,
                }}
              >
                Adjustment Type
              </label>

              <div className="adjustment-type">
                <button
                  type="button"
                  className={`adjustment-type-button ${
                    adjustmentType ===
                    'INCREASE'
                      ? 'increase-active'
                      : ''
                  }`}
                  onClick={() =>
                    setAdjustmentType(
                      'INCREASE',
                    )
                  }
                >
                  + Increase Stock
                </button>

                <button
                  type="button"
                  className={`adjustment-type-button ${
                    adjustmentType ===
                    'DECREASE'
                      ? 'decrease-active'
                      : ''
                  }`}
                  onClick={() =>
                    setAdjustmentType(
                      'DECREASE',
                    )
                  }
                >
                  − Decrease Stock
                </button>
              </div>
            </div>

            <div className="adjustment-field">
              <label htmlFor="adjustment-quantity">
                Quantity
              </label>

              <input
                id="adjustment-quantity"
                type="number"
                min="1"
                step="1"
                value={quantity}
                onChange={(event) =>
                  setQuantity(
                    event.target.value,
                  )
                }
                placeholder="Enter whole number quantity"
              />
            </div>

            <div className="adjustment-field">
              <label htmlFor="adjustment-reason">
                Reason
              </label>

              <input
                id="adjustment-reason"
                type="text"
                value={reason}
                onChange={(event) =>
                  setReason(
                    event.target.value,
                  )
                }
                placeholder="Example: Physical count difference"
              />
            </div>

            <div className="adjustment-field">
              <label htmlFor="adjustment-notes">
                Notes (optional)
              </label>

              <textarea
                id="adjustment-notes"
                value={notes}
                onChange={(event) =>
                  setNotes(
                    event.target.value,
                  )
                }
                placeholder="Additional details"
                rows={3}
              />
            </div>

            <button
              type="submit"
              className="adjustment-submit"
              disabled={saving}
            >
              {saving
                ? 'Saving...'
                : 'Adjust Stock'}
            </button>
          </form>
        </section>
      </main>
    </>
  );
}

export default StockAdjustment;