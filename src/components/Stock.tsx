import { useEffect, useState } from 'react';
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
};

type Location = {
  id: number;
  name: string;
};

function Stock() {
  const [stock, setStock] = useState<StockRow[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void loadData();
  }, []);

  async function loadData() {
    setLoading(true);

    const [stockResult, productsResult, locationsResult] =
      await Promise.all([
        supabase.from('current_stock').select('*'),
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

    if (stockResult.error) {
      console.error('Failed to load stock:', stockResult.error);
      setLoading(false);
      return;
    }

    setProducts(productsResult.data ?? []);
    setLocations(locationsResult.data ?? []);

    const stockRows = stockResult.data ?? [];

    const productMap = new Map(
      (productsResult.data ?? []).map((product) => [
        product.id,
        product,
      ]),
    );

    const locationMap = new Map(
      (locationsResult.data ?? []).map((location) => [
        location.id,
        location,
      ]),
    );

    const rows: StockRow[] = stockRows.map((row) => {
      const product = productMap.get(row.product_id);
      const location = locationMap.get(row.location_id);

      return {
        product_id: row.product_id,
        location_id: row.location_id,
        quantity: Number(row.quantity),
        sku: product?.sku ?? '-',
        product_name: product?.name ?? '-',
        location_name: location?.name ?? '-',
      };
    });

    setStock(rows);
    setLoading(false);
  }

  function getQuantity(productId: number, locationId: number) {
    return (
      stock.find(
        (row) =>
          row.product_id === productId &&
          row.location_id === locationId,
      )?.quantity ?? 0
    );
  }

  if (loading) {
    return <p>Loading stock...</p>;
  }

  return (
    <main>
      <h1>Stock</h1>

      <table>
        <thead>
          <tr>
            <th>Product</th>

            {locations.map((location) => (
              <th key={location.id}>{location.name}</th>
            ))}

            <th>Total</th>
          </tr>
        </thead>

        <tbody>
          {products.map((product) => {
            const total = locations.reduce(
              (sum, location) =>
                sum + getQuantity(product.id, location.id),
              0,
            );

            return (
              <tr key={product.id}>
                <td>
                  <strong>{product.sku}</strong>
                  <br />
                  {product.name}
                </td>

                {locations.map((location) => (
                  <td key={location.id}>
                    {getQuantity(product.id, location.id)}
                  </td>
                ))}

                <td>
                  <strong>{total}</strong>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </main>
  );
}

export default Stock;