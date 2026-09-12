import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';

type Category = {
  id: number;
  name: string;
};

type Supplier = {
  id: number;
  name: string;
};

type Product = {
  id: number;
  sku: string;
  name: string;
  category_id: number;
  supplier_id: number | null;
  default_purchase_cost: number | null;
  default_selling_price: number | null;
  unit: string;
  size: string | null;
  model: string | null;
  box_type: string | null;
  thickness: string | null;
  seating_capacity: number | null;
  specification: string | null;
};

type ProductForm = {
  sku: string;
  name: string;
  category_id: string;
  supplier_id: string;
  default_purchase_cost: string;
  default_selling_price: string;
  unit: string;
  size: string;
  model: string;
  box_type: string;
  thickness: string;
  seating_capacity: string;
  specification: string;
};

const emptyForm: ProductForm = {
  sku: '',
  name: '',
  category_id: '',
  supplier_id: '',
  default_purchase_cost: '',
  default_selling_price: '',
  unit: 'piece',
  size: '',
  model: '',
  box_type: '',
  thickness: '',
  seating_capacity: '',
  specification: '',
};

function Products() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);

  const [form, setForm] = useState<ProductForm>(emptyForm);
  const [editingProductId, setEditingProductId] = useState<number | null>(
    null,
  );

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    void loadData();
  }, []);

  async function loadData() {
    setLoading(true);

    const [categoriesResult, suppliersResult, productsResult] =
      await Promise.all([
        supabase
          .from('categories')
          .select('id, name')
          .eq('is_active', true)
          .order('name'),

        supabase
          .from('suppliers')
          .select('id, name')
          .eq('is_active', true)
          .order('name'),

        supabase
          .from('products')
          .select(`
            id,
            sku,
            name,
            category_id,
            supplier_id,
            default_purchase_cost,
            default_selling_price,
            unit,
            size,
            model,
            box_type,
            thickness,
            seating_capacity,
            specification
          `)
          .eq('is_active', true)
          .order('name'),
      ]);

    if (categoriesResult.error) {
      console.error('Failed to load categories:', categoriesResult.error);
    }

    if (suppliersResult.error) {
      console.error('Failed to load suppliers:', suppliersResult.error);
    }

    if (productsResult.error) {
      console.error('Failed to load products:', productsResult.error);
    }

    setCategories(categoriesResult.data ?? []);
    setSuppliers(suppliersResult.data ?? []);
    setProducts(productsResult.data ?? []);

    setLoading(false);
  }

  function handleChange(
    event: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >,
  ) {
    const { name, value } = event.target;

    setForm((current) => ({
      ...current,
      [name]: value,
    }));
  }

  function resetForm() {
    setForm({ ...emptyForm });
    setEditingProductId(null);
    setMessage('');
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage('');

    if (!form.sku.trim() || !form.name.trim() || !form.category_id) {
      setMessage('SKU, product name and category are required.');
      return;
    }

    if (
      form.default_purchase_cost &&
      Number(form.default_purchase_cost) < 0
    ) {
      setMessage('Purchase cost cannot be negative.');
      return;
    }

    if (
      form.default_selling_price &&
      Number(form.default_selling_price) < 0
    ) {
      setMessage('Selling price cannot be negative.');
      return;
    }

    if (form.seating_capacity && Number(form.seating_capacity) < 1) {
      setMessage('Seating capacity must be at least 1.');
      return;
    }

    setSaving(true);

    const productData = {
      sku: form.sku.trim(),
      name: form.name.trim(),
      category_id: Number(form.category_id),
      supplier_id: form.supplier_id ? Number(form.supplier_id) : null,
      default_purchase_cost: form.default_purchase_cost
        ? Number(form.default_purchase_cost)
        : null,
      default_selling_price: form.default_selling_price
        ? Number(form.default_selling_price)
        : null,
      unit: form.unit.trim() || 'piece',
      size: form.size.trim() || null,
      model: form.model.trim() || null,
      box_type: form.box_type.trim() || null,
      thickness: form.thickness.trim() || null,
      seating_capacity: form.seating_capacity
        ? Number(form.seating_capacity)
        : null,
      specification: form.specification.trim() || null,
    };

    let error = null;

    if (editingProductId === null) {
      const result = await supabase.from('products').insert(productData);
      error = result.error;
    } else {
      const result = await supabase
        .from('products')
        .update(productData)
        .eq('id', editingProductId);

      error = result.error;
    }

    setSaving(false);

    if (error) {
      console.error('Failed to save product:', error);
      setMessage(error.message);
      return;
    }

    setMessage(
      editingProductId === null
        ? 'Product added successfully.'
        : 'Product updated successfully.',
    );

    resetForm();
    await loadData();
  }

  function startEdit(product: Product) {
    setEditingProductId(product.id);

    setForm({
      sku: product.sku,
      name: product.name,
      category_id: String(product.category_id),
      supplier_id:
        product.supplier_id !== null ? String(product.supplier_id) : '',
      default_purchase_cost:
        product.default_purchase_cost !== null
          ? String(product.default_purchase_cost)
          : '',
      default_selling_price:
        product.default_selling_price !== null
          ? String(product.default_selling_price)
          : '',
      unit: product.unit,
      size: product.size ?? '',
      model: product.model ?? '',
      box_type: product.box_type ?? '',
      thickness: product.thickness ?? '',
      seating_capacity:
        product.seating_capacity !== null
          ? String(product.seating_capacity)
          : '',
      specification: product.specification ?? '',
    });

    setMessage('');

    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  }

  async function deactivateProduct(product: Product) {
    const confirmed = window.confirm(
      'Deactivate "' + product.name + '" (' + product.sku + ')?',
    );

    if (!confirmed) {
      return;
    }

    const { error } = await supabase
      .from('products')
      .update({ is_active: false })
      .eq('id', product.id);

    if (error) {
      console.error('Failed to deactivate product:', error);
      setMessage(error.message);
      return;
    }

    if (editingProductId === product.id) {
      resetForm();
    }

    setMessage('Product deactivated successfully.');

    await loadData();
  }

  function getCategoryName(categoryId: number) {
    return (
      categories.find((category) => category.id === categoryId)?.name ?? '-'
    );
  }

  function getSupplierName(supplierId: number | null) {
    if (supplierId === null) {
      return '-';
    }

    return (
      suppliers.find((supplier) => supplier.id === supplierId)?.name ?? '-'
    );
  }

  const filteredProducts = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return products.filter((product) => {
      const matchesSearch =
        normalizedSearch === '' ||
        product.sku.toLowerCase().includes(normalizedSearch) ||
        product.name.toLowerCase().includes(normalizedSearch) ||
        (product.model ?? '').toLowerCase().includes(normalizedSearch) ||
        (product.size ?? '').toLowerCase().includes(normalizedSearch);

      const matchesCategory =
        categoryFilter === '' ||
        String(product.category_id) === categoryFilter;

      return matchesSearch && matchesCategory;
    });
  }, [products, search, categoryFilter]);

  if (loading) {
    return <p>Loading products...</p>;
  }

  return (
    <main className="products-page">
      <h1>Products</h1>

      <form onSubmit={handleSubmit} className="product-form">
        <h2>
          {editingProductId === null ? 'Add Product' : 'Edit Product'}
        </h2>

        <input
          name="sku"
          value={form.sku}
          onChange={handleChange}
          placeholder="SKU e.g. SOF-001"
        />

        <input
          name="name"
          value={form.name}
          onChange={handleChange}
          placeholder="Product name"
        />

        <select
          name="category_id"
          value={form.category_id}
          onChange={handleChange}
        >
          <option value="">Select category</option>

          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>

        <select
          name="supplier_id"
          value={form.supplier_id}
          onChange={handleChange}
        >
          <option value="">Select supplier</option>

          {suppliers.map((supplier) => (
            <option key={supplier.id} value={supplier.id}>
              {supplier.name}
            </option>
          ))}
        </select>

        <input
          name="default_purchase_cost"
          value={form.default_purchase_cost}
          onChange={handleChange}
          type="number"
          min="0"
          step="0.01"
          placeholder="Default purchase cost"
        />

        <input
          name="default_selling_price"
          value={form.default_selling_price}
          onChange={handleChange}
          type="number"
          min="0"
          step="0.01"
          placeholder="Default selling price"
        />

        <input
          name="unit"
          value={form.unit}
          onChange={handleChange}
          placeholder="Unit"
        />

        <input
          name="size"
          value={form.size}
          onChange={handleChange}
          placeholder="Size (e.g. 4x6)"
        />

        <input
          name="model"
          value={form.model}
          onChange={handleChange}
          placeholder="Model / design"
        />

        <input
          name="box_type"
          value={form.box_type}
          onChange={handleChange}
          placeholder="Box type"
        />

        <input
          name="thickness"
          value={form.thickness}
          onChange={handleChange}
          placeholder="Thickness"
        />

        <input
          name="seating_capacity"
          value={form.seating_capacity}
          onChange={handleChange}
          type="number"
          min="1"
          placeholder="Seating capacity"
        />

        <textarea
          name="specification"
          value={form.specification}
          onChange={handleChange}
          placeholder="Specification"
          rows={3}
        />

        <div className="form-actions">
          <button type="submit" disabled={saving}>
            {saving
              ? 'Saving...'
              : editingProductId === null
                ? 'Add Product'
                : 'Update Product'}
          </button>

          {editingProductId !== null && (
            <button type="button" onClick={resetForm}>
              Cancel
            </button>
          )}
        </div>

        {message && <p>{message}</p>}
      </form>

      <section className="product-list">
        <h2>Product List</h2>

        <div className="product-filters">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search SKU, product, model or size"
          />

          <select
            value={categoryFilter}
            onChange={(event) => setCategoryFilter(event.target.value)}
          >
            <option value="">All categories</option>

            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </div>

        <p>
          Showing {filteredProducts.length} of {products.length} products
        </p>

        {filteredProducts.length === 0 ? (
          <p>No matching products.</p>
        ) : (
          <div className="product-grid">
            {filteredProducts.map((product) => (
              <article key={product.id} className="product-card">
                <h3>
                  {product.sku} — {product.name}
                </h3>

                <p>
                  <strong>Category:</strong>{' '}
                  {getCategoryName(product.category_id)}
                </p>

                <p>
                  <strong>Supplier:</strong>{' '}
                  {getSupplierName(product.supplier_id)}
                </p>

                {product.size && (
                  <p>
                    <strong>Size:</strong> {product.size}
                  </p>
                )}

                {product.model && (
                  <p>
                    <strong>Model:</strong> {product.model}
                  </p>
                )}

                {product.box_type && (
                  <p>
                    <strong>Box:</strong> {product.box_type}
                  </p>
                )}

                {product.thickness && (
                  <p>
                    <strong>Thickness:</strong> {product.thickness}
                  </p>
                )}

                {product.seating_capacity !== null && (
                  <p>
                    <strong>Seating:</strong> {product.seating_capacity}
                  </p>
                )}

                {product.specification && (
                  <p>
                    <strong>Specification:</strong> {product.specification}
                  </p>
                )}

                <p>
                  <strong>Purchase:</strong>{' '}
                  {product.default_purchase_cost !== null
                    ? 'INR ' +
                        product.default_purchase_cost.toLocaleString('en-IN')
                    : '-'}
                </p>

                <p>
                  <strong>Selling:</strong>{' '}
                  {product.default_selling_price !== null
                    ? 'INR ' +
                        product.default_selling_price.toLocaleString('en-IN')
                    : '-'}
                </p>

                <div className="card-actions">
                  <button type="button" onClick={() => startEdit(product)}>
                    Edit
                  </button>

                  <button
                    type="button"
                    onClick={() => deactivateProduct(product)}
                  >
                    Deactivate
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

export default Products;