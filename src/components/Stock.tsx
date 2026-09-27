import {
  useEffect,
  useMemo,
  useState,
} from 'react';
import { supabase } from '../lib/supabase';

type StockRow = {
  product_id: number;
  location_id: number;
  quantity: number;
  sku: string;
  product_name: string;
  location_name: string;
};

type Product = {
  id: number;
  sku: string;
  name: string;
  category_id: number;
};

type Category = {
  id: number;
  name: string;
};

type Location = {
  id: number;
  name: string;
};

function Stock() {
  const [stock, setStock] = useState<StockRow[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] =
    useState<Category[]>([]);
  const [locations, setLocations] =
    useState<Location[]>([]);

  const [search, setSearch] =
    useState('');

  const [categoryFilter, setCategoryFilter] =
    useState('');

  const [loading, setLoading] =
    useState(true);

  const [errorMessage, setErrorMessage] =
    useState('');

  useEffect(() => {
    void loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    setErrorMessage('');

    const [
      stockResult,
      productsResult,
      categoriesResult,
      locationsResult,
    ] = await Promise.all([
      supabase
        .from('current_stock')
        .select('*'),

      supabase
        .from('products')
        .select(
          'id, sku, name, category_id',
        )
        .eq('is_active', true)
        .order('name'),

      supabase
        .from('categories')
        .select(
          'id, name',
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
    ]);

    if (stockResult.error) {
      console.error(
        'Failed to load stock:',
        stockResult.error,
      );

      setErrorMessage(
        'Failed to load stock.',
      );

      setLoading(false);
      return;
    }

    if (productsResult.error) {
      console.error(
        'Failed to load products:',
        productsResult.error,
      );

      setErrorMessage(
        productsResult.error.message,
      );
    }

    if (categoriesResult.error) {
      console.error(
        'Failed to load categories:',
        categoriesResult.error,
      );

      setErrorMessage(
        categoriesResult.error.message,
      );
    }

    if (locationsResult.error) {
      console.error(
        'Failed to load locations:',
        locationsResult.error,
      );

      setErrorMessage(
        locationsResult.error.message,
      );
    }

    const loadedProducts =
      productsResult.data ?? [];

    const loadedCategories =
      categoriesResult.data ?? [];

    const loadedLocations =
      locationsResult.data ?? [];

    setProducts(
      loadedProducts,
    );

    setCategories(
      loadedCategories,
    );

    setLocations(
      loadedLocations,
    );

    const productMap =
      new Map(
        loadedProducts.map(
          (product) => [
            product.id,
            product,
          ],
        ),
      );

    const locationMap =
      new Map(
        loadedLocations.map(
          (location) => [
            location.id,
            location,
          ],
        ),
      );

    const rows: StockRow[] =
      (
        stockResult.data ?? []
      ).map((row) => {
        const product =
          productMap.get(
            Number(row.product_id),
          );

        const location =
          locationMap.get(
            Number(row.location_id),
          );

        return {
          product_id:
            Number(
              row.product_id,
            ),

          location_id:
            Number(
              row.location_id,
            ),

          quantity:
            Number(
              row.quantity,
            ),

          sku:
            product?.sku ??
            '-',

          product_name:
            product?.name ??
            '-',

          location_name:
            location?.name ??
            '-',
        };
      });

    setStock(rows);
    setLoading(false);
  }

  const stockMap = useMemo(() => {
    const map = new Map<
      string,
      number
    >();

    for (const row of stock) {
      map.set(
        `${row.product_id}-${row.location_id}`,
        row.quantity,
      );
    }

    return map;
  }, [stock]);

  function getQuantity(
    productId: number,
    locationId: number,
  ) {
    return (
      stockMap.get(
        `${productId}-${locationId}`,
      ) ?? 0
    );
  }

  function getCategoryName(
    categoryId: number,
  ) {
    return (
      categories.find(
        (category) =>
          category.id === categoryId,
      )?.name ?? '-'
    );
  }

  const filteredProducts =
    useMemo(() => {
      const normalizedSearch =
        search
          .trim()
          .toLowerCase();

      return products.filter(
        (product) => {
          const matchesSearch =
            normalizedSearch ===
              '' ||
            product.sku
              .toLowerCase()
              .includes(
                normalizedSearch,
              ) ||
            product.name
              .toLowerCase()
              .includes(
                normalizedSearch,
              );

          const matchesCategory =
            categoryFilter ===
              '' ||
            String(
              product.category_id,
            ) ===
              categoryFilter;

          return (
            matchesSearch &&
            matchesCategory
          );
        },
      );
    }, [
      products,
      search,
      categoryFilter,
    ]);

  const totalStock =
    products.reduce(
      (productTotal, product) =>
        productTotal +
        locations.reduce(
          (
            locationTotal,
            location,
          ) =>
            locationTotal +
            getQuantity(
              product.id,
              location.id,
            ),
          0,
        ),
      0,
    );

  const productsWithStock =
    products.filter((product) =>
      locations.some(
        (location) =>
          getQuantity(
            product.id,
            location.id,
          ) > 0,
      ),
    ).length;

  const filteredTotalStock =
    filteredProducts.reduce(
      (productTotal, product) =>
        productTotal +
        locations.reduce(
          (
            locationTotal,
            location,
          ) =>
            locationTotal +
            getQuantity(
              product.id,
              location.id,
            ),
          0,
        ),
      0,
    );

  if (loading) {
    return (
      <p>
        Loading stock...
      </p>
    );
  }

  return (
    <>
      <style>
        {`
          .stock-page {
            width: 100%;
            max-width: 1400px;
            margin: 0 auto;
          }

          .stock-header {
            margin-bottom: 20px;
          }

          .stock-header h1 {
            margin-bottom: 5px;
          }

          .stock-description {
            color: #667085;
            font-size: 14px;
          }

          .stock-summary {
            display: grid;
            grid-template-columns:
              repeat(3, minmax(0, 1fr));
            gap: 14px;
            margin-bottom: 20px;
          }

          .stock-summary-card {
            padding: 18px;
            background: #ffffff;
            border: 1px solid #e4e7ec;
            border-radius: 12px;
            box-shadow:
              0 1px 2px rgba(16, 24, 40, 0.05);
          }

          .stock-summary-label {
            color: #667085;
            font-size: 13px;
            font-weight: 600;
          }

          .stock-summary-value {
            margin-top: 5px;
            color: #101828;
            font-size: 26px;
            line-height: 1.2;
            font-weight: 700;
          }

          .stock-filters {
            display: grid;
            grid-template-columns:
              2fr 1fr;
            gap: 12px;
            margin-bottom: 14px;
          }

          .stock-filters input,
          .stock-filters select {
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

          .stock-filters input:focus,
          .stock-filters select:focus {
            outline: none;
            border-color: #2563eb;
            box-shadow:
              0 0 0 3px rgba(37, 99, 235, 0.12);
          }

          .stock-count {
            margin-bottom: 14px;
            color: #667085;
            font-size: 13px;
          }

          .stock-table-card {
            background: #ffffff;
            border: 1px solid #e4e7ec;
            border-radius: 12px;
            box-shadow:
              0 1px 2px rgba(16, 24, 40, 0.05);
            overflow: hidden;
          }

          .stock-table-wrapper {
            width: 100%;
            overflow-x: auto;
            -webkit-overflow-scrolling: touch;
          }

          .stock-table {
            width: 100%;
            min-width: 760px;
            border-collapse: collapse;
          }

          .stock-table th,
          .stock-table td {
            padding: 12px 14px;
            border-bottom: 1px solid #e4e7ec;
            text-align: left;
            vertical-align: middle;
            font-size: 14px;
          }

          .stock-table th {
            background: #f9fafb;
            color: #101828;
            font-weight: 650;
            white-space: nowrap;
          }

          .stock-table td {
            color: #475467;
          }

          .stock-table tbody tr:last-child td {
            border-bottom: 0;
          }

          .stock-table tbody tr:hover {
            background: #fbfcfe;
          }

          .stock-product-name {
            color: #101828;
            font-weight: 600;
          }

          .stock-product-sku {
            color: #2563eb;
            font-size: 12px;
            font-weight: 700;
          }

          .stock-category {
            margin-top: 2px;
            color: #667085;
            font-size: 12px;
          }

          .stock-quantity {
            text-align: center !important;
            font-weight: 600;
          }

          .stock-zero {
            color: #98a2b3 !important;
            background: #fafafa;
            font-weight: 500 !important;
          }

          .stock-positive {
            color: #15803d !important;
          }

          .stock-total {
            color: #101828 !important;
            font-weight: 700;
          }

          .stock-empty {
            padding: 30px;
            text-align: center;
            color: #667085;
          }

          .stock-error {
            margin-bottom: 16px;
            padding: 11px 13px;
            border: 1px solid #fecaca;
            border-radius: 8px;
            background: #fef2f2;
            color: #dc2626;
            font-size: 14px;
          }

          @media (max-width: 800px) {
            .stock-summary {
              grid-template-columns: 1fr;
            }

            .stock-filters {
              grid-template-columns: 1fr;
            }

            .stock-summary-value {
              font-size: 22px;
            }
          }
        `}
      </style>

      <main className="stock-page">
        <div className="stock-header">
          <h1>Stock</h1>

          <p className="stock-description">
            View current inventory across all
            showroom and storage locations.
          </p>
        </div>

        {errorMessage && (
          <div className="stock-error">
            {errorMessage}
          </div>
        )}

        <section className="stock-summary">
          <article className="stock-summary-card">
            <div className="stock-summary-label">
              Total Products
            </div>

            <div className="stock-summary-value">
              {products.length}
            </div>
          </article>

          <article className="stock-summary-card">
            <div className="stock-summary-label">
              Products In Stock
            </div>

            <div className="stock-summary-value">
              {productsWithStock}
            </div>
          </article>

          <article className="stock-summary-card">
            <div className="stock-summary-label">
              Total Units
            </div>

            <div className="stock-summary-value">
              {totalStock.toLocaleString(
                'en-IN',
              )}
            </div>
          </article>
        </section>

        <section>
          <div className="stock-filters">
            <input
              value={search}
              onChange={(event) =>
                setSearch(
                  event.target.value,
                )
              }
              placeholder="Search SKU or product name"
            />

            <select
              value={categoryFilter}
              onChange={(event) =>
                setCategoryFilter(
                  event.target.value,
                )
              }
            >
              <option value="">
                All Categories
              </option>

              {categories.map(
                (category) => (
                  <option
                    key={category.id}
                    value={category.id}
                  >
                    {category.name}
                  </option>
                ),
              )}
            </select>
          </div>

          <p className="stock-count">
            Showing{' '}
            {filteredProducts.length}{' '}
            of {products.length}{' '}
            products
            {search ||
            categoryFilter
              ? ` • ${filteredTotalStock.toLocaleString(
                  'en-IN',
                )} units in filtered results`
              : ''}
          </p>
        </section>

        <section className="stock-table-card">
          {filteredProducts.length ===
          0 ? (
            <div className="stock-empty">
              No matching products found.
            </div>
          ) : (
            <div className="stock-table-wrapper">
              <table className="stock-table">
                <thead>
                  <tr>
                    <th>
                      Product
                    </th>

                    {locations.map(
                      (location) => (
                        <th
                          key={
                            location.id
                          }
                          className="stock-quantity"
                        >
                          {
                            location.name
                          }
                        </th>
                      ),
                    )}

                    <th className="stock-quantity">
                      Total
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {filteredProducts.map(
                    (product) => {
                      const total =
                        locations.reduce(
                          (
                            sum,
                            location,
                          ) =>
                            sum +
                            getQuantity(
                              product.id,
                              location.id,
                            ),
                          0,
                        );

                      return (
                        <tr
                          key={
                            product.id
                          }
                        >
                          <td>
                            <div className="stock-product-name">
                              {
                                product.name
                              }
                            </div>

                            <div className="stock-product-sku">
                              {
                                product.sku
                              }
                            </div>

                            <div className="stock-category">
                              {
                                getCategoryName(
                                  product.category_id,
                                )
                              }
                            </div>
                          </td>

                          {locations.map(
                            (
                              location,
                            ) => {
                              const quantity =
                                getQuantity(
                                  product.id,
                                  location.id,
                                );

                              return (
                                <td
                                  key={
                                    location.id
                                  }
                                  className={`stock-quantity ${
                                    quantity ===
                                    0
                                      ? 'stock-zero'
                                      : 'stock-positive'
                                  }`}
                                >
                                  {
                                    quantity
                                  }
                                </td>
                              );
                            },
                          )}

                          <td className="stock-quantity stock-total">
                            {total}
                          </td>
                        </tr>
                      );
                    },
                  )}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </>
  );
}

export default Stock;