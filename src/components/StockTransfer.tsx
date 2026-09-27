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

function StockTransfer() {
  const [products, setProducts] = useState<
    Product[]
  >([]);

  const [locations, setLocations] =
    useState<Location[]>([]);

  const [stock, setStock] = useState<
    StockRow[]
  >([]);

  const [productId, setProductId] =
    useState('');

  const [productSearch, setProductSearch] =
    useState('');

  const [showProductDropdown, setShowProductDropdown] =
    useState(false);

  const [sourceLocationId, setSourceLocationId] =
    useState('');

  const [destinationLocationId, setDestinationLocationId] =
    useState('');

  const [quantity, setQuantity] =
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

  const selectedSourceLocation =
    locations.find(
      (location) =>
        String(location.id) ===
        sourceLocationId,
    );

  const selectedDestinationLocation =
    locations.find(
      (location) =>
        String(location.id) ===
        destinationLocationId,
    );

  const availableSourceStock =
    getAvailableStock(
      Number(productId),
      Number(sourceLocationId),
    );

  function getAvailableStock(
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

    if (
      sourceLocationId ===
      destinationLocationId
    ) {
      setErrorMessage(
        'Source and destination locations must be different.',
      );
      return;
    }

    const transferQuantity =
      Number(quantity);

    if (
      !Number.isFinite(
        transferQuantity,
      ) ||
      transferQuantity <= 0
    ) {
      setErrorMessage(
        'Quantity must be greater than 0.',
      );
      return;
    }

    setSaving(true);

    try {
      const {
        data,
        error,
      } = await supabase.rpc(
        'transfer_stock',
        {
          p_product_id:
            Number(productId),

          p_source_location_id:
            Number(
              sourceLocationId,
            ),

          p_destination_location_id:
            Number(
              destinationLocationId,
            ),

          p_quantity:
            transferQuantity,

          p_notes:
            notes.trim() || null,
        },
      );

      if (error) {
        throw error;
      }

      const transferId =
        Number(data);

      setMessage(
        `Stock transferred successfully. ${transferQuantity} unit(s) moved. Transfer #${transferId}.`,
      );

      resetForm();

      await refreshStock();
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
        Loading stock transfer...
      </p>
    );
  }

  return (
    <>
      <style>
        {`
          .transfer-page {
            width: 100%;
            max-width: 850px;
            margin: 0 auto;
          }

          .transfer-description {
            margin-bottom: 20px;
            color: #667085;
          }

          .transfer-card {
            padding: 20px;
            background: #ffffff;
            border: 1px solid #e4e7ec;
            border-radius: 14px;
            box-shadow:
              0 1px 2px rgba(16, 24, 40, 0.05);
          }

          .transfer-field {
            position: relative;
            margin-bottom: 18px;
          }

          .transfer-field label {
            display: block;
            margin-bottom: 6px;
            color: #101828;
            font-size: 14px;
            font-weight: 600;
          }

          .transfer-field input,
          .transfer-field select,
          .transfer-field textarea {
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

          .transfer-field textarea {
            min-height: 90px;
            resize: vertical;
          }

          .transfer-field input:focus,
          .transfer-field select:focus,
          .transfer-field textarea:focus {
            outline: none;
            border-color: #2563eb;
            box-shadow:
              0 0 0 3px rgba(37, 99, 235, 0.12);
          }

          .transfer-picker {
            position: relative;
          }

          .transfer-picker-clear {
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

          .transfer-picker-clear:hover {
            background: #f2f4f7;
            color: #101828;
          }

          .transfer-dropdown {
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

          .transfer-option {
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

          .transfer-option:last-child {
            border-bottom: 0;
          }

          .transfer-option:hover {
            background: #eff6ff;
          }

          .transfer-option-sku {
            display: block;
            color: #2563eb;
            font-size: 13px;
            font-weight: 700;
          }

          .transfer-option-name {
            display: block;
            margin-top: 2px;
            color: #101828;
            font-size: 14px;
            font-weight: 600;
          }

          .transfer-picker-hint {
            margin-top: 6px;
            color: #667085;
            font-size: 12px;
          }

          .transfer-selected {
            margin-top: 7px;
            color: #15803d;
            font-size: 13px;
            font-weight: 600;
          }

          .stock-availability {
            margin: -4px 0 18px;
            padding: 11px 13px;
            border: 1px solid #bfdbfe;
            border-radius: 8px;
            background: #eff6ff;
            color: #1e40af;
            font-size: 14px;
          }

          .stock-availability strong {
            color: #101828;
          }

          .location-flow {
            display: grid;
            grid-template-columns: minmax(0, 1fr) 36px minmax(0, 1fr);
            align-items: end;
            gap: 10px;
          }

          .location-arrow {
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 42px;
            color: #667085;
            font-size: 20px;
            font-weight: 700;
          }

          .transfer-message {
            margin-bottom: 16px;
            padding: 11px 13px;
            border-radius: 8px;
            font-size: 14px;
          }

          .transfer-success {
            border: 1px solid #bbf7d0;
            background: #f0fdf4;
            color: #15803d;
          }

          .transfer-error {
            border: 1px solid #fecaca;
            background: #fef2f2;
            color: #dc2626;
          }

          .transfer-submit {
            width: 100%;
            margin-top: 4px;
          }

          @media (max-width: 600px) {
            .transfer-card {
              padding: 16px;
              border-radius: 10px;
            }

            .location-flow {
              grid-template-columns: 1fr;
              gap: 8px;
            }

            .location-arrow {
              min-height: 24px;
              transform: rotate(90deg);
            }
          }
        `}
      </style>

      <main className="transfer-page">
        <h1>
          Stock Transfer
        </h1>

        <p className="transfer-description">
          Move stock from one location
          to another.
        </p>

        {message && (
          <div className="transfer-message transfer-success">
            {message}
          </div>
        )}

        {errorMessage && (
          <div className="transfer-message transfer-error">
            {errorMessage}
          </div>
        )}

        <section className="transfer-card">
          <form
            onSubmit={
              handleSubmit
            }
          >
            <div className="transfer-field transfer-picker">
              <label htmlFor="transfer-product-search">
                Product
              </label>

              <input
                id="transfer-product-search"
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
                  className="transfer-picker-clear"
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
                <div className="transfer-dropdown">
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
                          className="transfer-option"
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
                          <span className="transfer-option-sku">
                            {product.sku}
                          </span>

                          <span className="transfer-option-name">
                            {product.name}
                          </span>
                        </button>
                      ),
                    )
                  )}
                </div>
              )}

              <p className="transfer-picker-hint">
                Type SKU or product name to search.
              </p>

              {selectedProduct && (
                <p className="transfer-selected">
                  Selected:{" "}
                  {selectedProduct.sku} -{" "}
                  {selectedProduct.name}
                </p>
              )}
            </div>

            <div className="location-flow">
              <div className="transfer-field">
                <label htmlFor="source-location">
                  From Location
                </label>

                <select
                  id="source-location"
                  value={
                    sourceLocationId
                  }
                  onChange={(event) =>
                    setSourceLocationId(
                      event.target.value,
                    )
                  }
                >
                  <option value="">
                    Select source location
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

              <div className="location-arrow">
                →
              </div>

              <div className="transfer-field">
                <label htmlFor="destination-location">
                  To Location
                </label>

                <select
                  id="destination-location"
                  value={
                    destinationLocationId
                  }
                  onChange={(event) =>
                    setDestinationLocationId(
                      event.target.value,
                    )
                  }
                >
                  <option value="">
                    Select destination location
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
            </div>

            {selectedProduct &&
              selectedSourceLocation && (
                <div className="stock-availability">
                  Available at{' '}
                  <strong>
                    {
                      selectedSourceLocation.name
                    }
                  </strong>
                  :{' '}
                  <strong>
                    {availableSourceStock}
                  </strong>{' '}
                  unit(s)
                </div>
              )}

            {selectedDestinationLocation &&
              selectedSourceLocation &&
              sourceLocationId ===
                destinationLocationId && (
                <div className="transfer-message transfer-error">
                  Source and destination
                  locations must be different.
                </div>
              )}

            <div className="transfer-field">
              <label htmlFor="transfer-quantity">
                Quantity
              </label>

              <input
                id="transfer-quantity"
                type="number"
                min="1"
                step="1"
                value={quantity}
                onChange={(event) =>
                  setQuantity(
                    event.target.value,
                  )
                }
                placeholder="Enter quantity"
              />
            </div>

            <div className="transfer-field">
              <label htmlFor="transfer-notes">
                Notes
                (optional)
              </label>

              <textarea
                id="transfer-notes"
                value={notes}
                onChange={(event) =>
                  setNotes(
                    event.target.value,
                  )
                }
                placeholder="Any additional note"
                rows={3}
              />
            </div>

            <button
              type="submit"
              className="transfer-submit"
              disabled={saving}
            >
              {saving
                ? 'Transferring...'
                : 'Transfer Stock'}
            </button>
          </form>
        </section>
      </main>
    </>
  );
}

export default StockTransfer;