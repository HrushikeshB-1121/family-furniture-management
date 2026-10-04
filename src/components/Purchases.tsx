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

type Supplier = {
  id: number;
  name: string;
};

type Location = {
  id: number;
  name: string;
};

function getLocalDateTimeValue(date = new Date()) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function Purchases() {
  const [products, setProducts] = useState<Product[]>(
    [],
  );

  const [suppliers, setSuppliers] = useState<Supplier[]>(
    [],
  );

  const [locations, setLocations] = useState<Location[]>(
    [],
  );

  const [supplierId, setSupplierId] =
    useState('');

  const [supplierSearch, setSupplierSearch] =
    useState('');

  const [showSupplierDropdown, setShowSupplierDropdown] =
    useState(false);

  const [locationId, setLocationId] =
    useState('');

  const [productId, setProductId] =
    useState('');

  const [productSearch, setProductSearch] =
    useState('');

  const [showProductDropdown, setShowProductDropdown] =
    useState(false);

  const [quantity, setQuantity] =
    useState('');

  const [reference, setReference] =
    useState('');

  const [notes, setNotes] =
    useState('');

  const [purchaseDate, setPurchaseDate] = useState(getLocalDateTimeValue());

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
      suppliersResult,
      locationsResult,
    ] = await Promise.all([
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
      console.error(
        'Failed to load products:',
        productsResult.error,
      );

      setErrorMessage(
        'Failed to load products.',
      );
    }

    if (suppliersResult.error) {
      console.error(
        'Failed to load suppliers:',
        suppliersResult.error,
      );

      setErrorMessage(
        'Failed to load suppliers.',
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

    setProducts(
      productsResult.data ?? [],
    );

    setSuppliers(
      suppliersResult.data ?? [],
    );

    setLocations(
      locationsResult.data ?? [],
    );

    setLoading(false);
  }

  const filteredSuppliers = useMemo(() => {
    const search =
      supplierSearch.trim().toLowerCase();

    if (!search) {
      return suppliers;
    }

    return suppliers.filter(
      (supplier) =>
        supplier.name
          .toLowerCase()
          .includes(search),
    );
  }, [
    supplierSearch,
    suppliers,
  ]);

  const filteredProducts = useMemo(() => {
    const search =
      productSearch.trim().toLowerCase();

    if (!search) {
      return products;
    }

    return products.filter(
      (product) =>
        product.name
          .toLowerCase()
          .includes(search) ||
        product.sku
          .toLowerCase()
          .includes(search),
    );
  }, [
    productSearch,
    products,
  ]);

  const selectedSupplier =
    suppliers.find(
      (supplier) =>
        String(supplier.id) === supplierId,
    );

  const selectedProduct =
    products.find(
      (product) =>
        String(product.id) === productId,
    );

  function selectSupplier(
    supplier: Supplier,
  ) {
    setSupplierId(
      String(supplier.id),
    );

    setSupplierSearch(
      supplier.name,
    );

    setShowSupplierDropdown(
      false,
    );

    setErrorMessage('');
  }

  function handleSupplierSearchChange(
    value: string,
  ) {
    setSupplierSearch(value);
    setSupplierId('');
    setShowSupplierDropdown(true);
    setErrorMessage('');
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
    setSupplierId('');
    setSupplierSearch('');
    setShowSupplierDropdown(false);

    setLocationId('');

    setProductId('');
    setProductSearch('');
    setShowProductDropdown(false);

    setQuantity('');
    setReference('');
    setNotes('');
    setPurchaseDate(getLocalDateTimeValue());
  }

  async function handleSubmit(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    setMessage('');
    setErrorMessage('');

    if (
      !supplierId ||
      !locationId ||
      !productId
    ) {
      setErrorMessage(
        'Supplier, location and product are required.',
      );
      return;
    }

    const purchaseDateValue = new Date(purchaseDate);
    if (!purchaseDate || Number.isNaN(purchaseDateValue.getTime())) {
      setErrorMessage('Enter a valid purchase date and time.');
      return;
    }

    const receivedQuantity =
      Number(quantity);

    if (
      !Number.isFinite(
        receivedQuantity,
      ) ||
      receivedQuantity <= 0
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
        'receive_stock_with_date',
        {
          p_supplier_id:
            Number(supplierId),

          p_location_id:
            Number(locationId),

          p_product_id:
            Number(productId),

          p_quantity:
            receivedQuantity,

          p_invoice_number:
            reference.trim() || null,

          p_notes:
            notes.trim() || null,

          p_purchase_date:
            purchaseDateValue.toISOString(),
        },
      );

      if (error) {
        throw error;
      }

      const purchaseId =
        Number(data);

      setMessage(
        `Stock received successfully. ${receivedQuantity} unit(s) added to stock. Purchase #${purchaseId} is pending admin confirmation.`,
      );

      resetForm();
    } catch (error) {
      console.error(
        'Failed to receive stock:',
        error,
      );

      setErrorMessage(
        error instanceof Error
          ? error.message
          : typeof error === 'object' && error !== null && 'message' in error
            ? String(error.message)
            : 'Failed to receive stock.',
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <p>
        Loading stock receiving...
      </p>
    );
  }

  return (
    <>
      <style>
        {`
          .receive-stock-page {
            width: 100%;
            max-width: 850px;
            margin: 0 auto;
          }

          .receive-stock-description {
            margin-bottom: 20px;
            color: #667085;
          }

          .receive-stock-card {
            padding: 20px;
            background: #ffffff;
            border: 1px solid #e4e7ec;
            border-radius: 14px;
            box-shadow:
              0 1px 2px rgba(16, 24, 40, 0.05);
          }

          .receive-field {
            position: relative;
            margin-bottom: 18px;
          }

          .receive-field label {
            display: block;
            margin-bottom: 6px;
            color: #101828;
            font-size: 14px;
            font-weight: 600;
          }

          .receive-field input,
          .receive-field select,
          .receive-field textarea {
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

          .receive-field textarea {
            min-height: 90px;
            resize: vertical;
          }

          .receive-field input:focus,
          .receive-field select:focus,
          .receive-field textarea:focus {
            outline: none;
            border-color: #2563eb;
            box-shadow:
              0 0 0 3px rgba(37, 99, 235, 0.12);
          }

          .receive-picker {
            position: relative;
          }

          .receive-picker-clear {
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

          .receive-picker-clear:hover {
            background: #f2f4f7;
            color: #101828;
          }

          .receive-dropdown {
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

          .receive-option {
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

          .receive-option:last-child {
            border-bottom: 0;
          }

          .receive-option:hover {
            background: #eff6ff;
          }

          .receive-option-title {
            display: block;
            color: #101828;
            font-size: 14px;
            font-weight: 600;
          }

          .receive-option-code {
            display: block;
            margin-top: 2px;
            color: #2563eb;
            font-size: 13px;
            font-weight: 700;
          }

          .receive-picker-hint {
            margin-top: 6px;
            color: #667085;
            font-size: 12px;
          }

          .receive-selected {
            margin-top: 7px;
            color: #15803d;
            font-size: 13px;
            font-weight: 600;
          }

          .receive-message {
            margin-bottom: 16px;
            padding: 11px 13px;
            border-radius: 8px;
            font-size: 14px;
          }

          .receive-success {
            border: 1px solid #bbf7d0;
            background: #f0fdf4;
            color: #15803d;
          }

          .receive-error {
            border: 1px solid #fecaca;
            background: #fef2f2;
            color: #dc2626;
          }

          .receive-submit {
            width: 100%;
            margin-top: 4px;
          }

          @media (max-width: 600px) {
            .receive-stock-card {
              padding: 16px;
              border-radius: 10px;
            }

            .receive-option {
              padding: 12px;
            }
          }
        `}
      </style>

      <main className="receive-stock-page">
        <h1>Receive Stock</h1>

        <p className="receive-stock-description">
          Enter the stock that has physically
          arrived. Purchase cost is handled later
          by an admin.
        </p>

        {message && (
          <div className="receive-message receive-success">
            {message}
          </div>
        )}

        {errorMessage && (
          <div className="receive-message receive-error">
            {errorMessage}
          </div>
        )}

        <section className="receive-stock-card">
          <form
            onSubmit={handleSubmit}
          >
            <div className="receive-field receive-picker">
              <label htmlFor="supplier-search">
                Supplier
              </label>

              <input
                id="supplier-search"
                type="text"
                value={supplierSearch}
                onChange={(event) =>
                  handleSupplierSearchChange(
                    event.target.value,
                  )
                }
                onFocus={() =>
                  setShowSupplierDropdown(
                    true,
                  )
                }
                autoComplete="off"
                placeholder="Search supplier"
              />

              {supplierSearch && (
                <button
                  type="button"
                  className="receive-picker-clear"
                  aria-label="Clear supplier"
                  onClick={() => {
                    setSupplierSearch('');
                    setSupplierId('');
                    setShowSupplierDropdown(
                      true,
                    );
                  }}
                >
                  ×
                </button>
              )}

              {showSupplierDropdown && (
                <div className="receive-dropdown">
                  {filteredSuppliers.length ===
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
                      No suppliers found.
                    </div>
                  ) : (
                    filteredSuppliers.map(
                      (supplier) => (
                        <button
                          key={
                            supplier.id
                          }
                          type="button"
                          className="receive-option"
                          onMouseDown={(
                            event,
                          ) =>
                            event.preventDefault()
                          }
                          onClick={() =>
                            selectSupplier(
                              supplier,
                            )
                          }
                        >
                          <span className="receive-option-title">
                            {
                              supplier.name
                            }
                          </span>
                        </button>
                      ),
                    )
                  )}
                </div>
              )}

              <p className="receive-picker-hint">
                Type to search for a supplier.
              </p>

              {selectedSupplier && (
                <p className="receive-selected">
                  Selected:{" "}
                  {selectedSupplier.name}
                </p>
              )}
            </div>

            <div className="receive-field">
              <label htmlFor="location">
                Location
              </label>

              <select
                id="location"
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

            <div className="receive-field receive-picker">
              <label htmlFor="product-search">
                Product
              </label>

              <input
                id="product-search"
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
                  className="receive-picker-clear"
                  aria-label="Clear product"
                  onClick={() => {
                    setProductSearch('');
                    setProductId('');
                    setShowProductDropdown(
                      true,
                    );
                  }}
                >
                  ×
                </button>
              )}

              {showProductDropdown && (
                <div className="receive-dropdown">
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
                          className="receive-option"
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
                          <span className="receive-option-code">
                            {product.sku}
                          </span>

                          <span className="receive-option-title">
                            {product.name}
                          </span>
                        </button>
                      ),
                    )
                  )}
                </div>
              )}

              <p className="receive-picker-hint">
                Type SKU or product name to search.
              </p>

              {selectedProduct && (
                <p className="receive-selected">
                  Selected:{" "}
                  {selectedProduct.sku} -{" "}
                  {selectedProduct.name}
                </p>
              )}
            </div>

            <div className="receive-field">
              <label htmlFor="purchase-date">Purchase Date &amp; Time</label>
              <input
                id="purchase-date"
                type="datetime-local"
                value={purchaseDate}
                onChange={(event) => setPurchaseDate(event.target.value)}
              />
            </div>

            <div className="receive-field">
              <label htmlFor="quantity">
                Quantity
              </label>

              <input
                id="quantity"
                type="number"
                min="0.01"
                step="0.01"
                value={quantity}
                onChange={(event) =>
                  setQuantity(
                    event.target.value,
                  )
                }
                placeholder="Enter quantity"
              />
            </div>

            <div className="receive-field">
              <label htmlFor="reference">
                Invoice / Reference
                (optional)
              </label>

              <input
                id="reference"
                type="text"
                value={reference}
                onChange={(event) =>
                  setReference(
                    event.target.value,
                  )
                }
                placeholder="Invoice number"
              />
            </div>

            <div className="receive-field">
              <label htmlFor="notes">
                Notes
                (optional)
              </label>

              <textarea
                id="notes"
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
              className="receive-submit"
              disabled={saving}
            >
              {saving
                ? 'Saving...'
                : 'Receive Stock'}
            </button>
          </form>
        </section>
      </main>
    </>
  );
}

export default Purchases;
