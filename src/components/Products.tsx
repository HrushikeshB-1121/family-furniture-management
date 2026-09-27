import {
  useEffect,
  useMemo,
  useState,
} from 'react';
import { supabase } from '../lib/supabase';

type Category = {
  id: number;
  name: string;
  code: string;
};

type Product = {
  id: number;
  sku: string;
  name: string;
  category_id: number;
  default_selling_price: number | null;
  unit: string;
  size: string | null;
  model: string | null;
  box_type: string | null;
  thickness: string | null;
  seating_capacity: number | null;
  specification: string | null;
  default_purchase_cost: number | null;
};

type ProductForm = {
  sku: string;
  name: string;
  category_id: string;
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
  const [categories, setCategories] =
    useState<Category[]>([]);

  const [products, setProducts] =
    useState<Product[]>([]);

  const [form, setForm] =
    useState<ProductForm>({
      ...emptyForm,
    });

  const [
    editingProductId,
    setEditingProductId,
  ] = useState<number | null>(null);

  const [search, setSearch] =
    useState('');

  const [categoryFilter, setCategoryFilter] =
    useState('');

  const [categorySearch, setCategorySearch] =
    useState('');

  const [
    showCategoryDropdown,
    setShowCategoryDropdown,
  ] = useState(false);

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
      categoriesResult,
      productsResult,
      costsResult,
    ] = await Promise.all([
      supabase
        .from('categories')
        .select(
          'id, name, code',
        )
        .eq('is_active', true)
        .order('name'),

      supabase
        .from('products')
        .select(`
          id,
          sku,
          name,
          category_id,
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

      supabase
        .from('product_costs')
        .select(
          'product_id, default_purchase_cost',
        ),
    ]);

    if (categoriesResult.error) {
      console.error(
        'Failed to load categories:',
        categoriesResult.error,
      );

      setErrorMessage(
        categoriesResult.error.message,
      );
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

    if (costsResult.error) {
      console.error(
        'Failed to load product costs:',
        costsResult.error,
      );

      setErrorMessage(
        costsResult.error.message,
      );
    }

    const costMap =
      new Map<number, number | null>();

    for (const cost of
      costsResult.data ?? []) {
      costMap.set(
        cost.product_id,
        cost.default_purchase_cost !==
          null
          ? Number(
              cost.default_purchase_cost,
            )
          : null,
      );
    }

    const loadedProducts: Product[] =
      (
        productsResult.data ?? []
      ).map((product) => ({
        ...product,
        default_purchase_cost:
          costMap.get(
            product.id,
          ) ?? null,
      }));

    setCategories(
      categoriesResult.data ?? [],
    );

    setProducts(
      loadedProducts,
    );

    setLoading(false);
  }

  function handleChange(
    event: React.ChangeEvent<
      HTMLInputElement |
        HTMLSelectElement |
        HTMLTextAreaElement
    >,
  ) {
    const {
      name,
      value,
    } = event.target;

    setForm((current) => ({
      ...current,
      [name]: value,
    }));
  }

  const selectedCategory =
    categories.find(
      (category) =>
        String(category.id) ===
        form.category_id,
    );

  const filteredCategories =
    useMemo(() => {
      const normalizedSearch =
        categorySearch
          .trim()
          .toLowerCase();

      if (!normalizedSearch) {
        return categories;
      }

      return categories.filter(
        (category) =>
          category.name
            .toLowerCase()
            .includes(
              normalizedSearch,
            ) ||
          category.code
            .toLowerCase()
            .includes(
              normalizedSearch,
            ),
      );
    }, [
      categories,
      categorySearch,
    ]);

  function selectCategory(
    category: Category,
  ) {
    setForm((current) => ({
      ...current,
      category_id: String(
        category.id,
      ),
    }));

    setCategorySearch(
      `${category.name} (${category.code})`,
    );

    setShowCategoryDropdown(false);
    setErrorMessage('');
  }

  function handleCategorySearchChange(
    value: string,
  ) {
    setCategorySearch(value);

    setForm((current) => ({
      ...current,
      category_id: '',
    }));

    setShowCategoryDropdown(true);
    setErrorMessage('');
  }

  function resetForm(
    clearMessages = true,
  ) {
    setForm({
      ...emptyForm,
    });

    setEditingProductId(null);
    setCategorySearch('');
    setShowCategoryDropdown(false);

    if (clearMessages) {
      setMessage('');
      setErrorMessage('');
    }
  }

  async function handleSubmit(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    setMessage('');
    setErrorMessage('');

    if (!form.name.trim()) {
      setErrorMessage(
        'Product name is required.',
      );
      return;
    }

    if (!form.category_id) {
      setErrorMessage(
        'Category is required.',
      );
      return;
    }

    if (
      form.default_purchase_cost &&
      Number(
        form.default_purchase_cost,
      ) < 0
    ) {
      setErrorMessage(
        'Purchase cost cannot be negative.',
      );
      return;
    }

    if (
      form.default_selling_price &&
      Number(
        form.default_selling_price,
      ) < 0
    ) {
      setErrorMessage(
        'Selling price cannot be negative.',
      );
      return;
    }

    if (
      form.seating_capacity &&
      Number(
        form.seating_capacity,
      ) < 1
    ) {
      setErrorMessage(
        'Seating capacity must be at least 1.',
      );
      return;
    }

    if (
      form.seating_capacity &&
      !Number.isInteger(
        Number(
          form.seating_capacity,
        ),
      )
    ) {
      setErrorMessage(
        'Seating capacity must be a whole number.',
      );
      return;
    }

    setSaving(true);

    try {
      const productData = {
        ...(editingProductId !==
        null
          ? {
              sku:
                form.sku.trim(),
            }
          : {}),

        name:
          form.name.trim(),

        category_id:
          Number(
            form.category_id,
          ),

        default_selling_price:
          form.default_selling_price
            ? Number(
                form.default_selling_price,
              )
            : null,

        unit:
          form.unit.trim() ||
          'piece',

        size:
          form.size.trim() ||
          null,

        model:
          form.model.trim() ||
          null,

        box_type:
          form.box_type.trim() ||
          null,

        thickness:
          form.thickness.trim() ||
          null,

        seating_capacity:
          form.seating_capacity
            ? Number(
                form.seating_capacity,
              )
            : null,

        specification:
          form.specification.trim() ||
          null,
      };

      let productId: number;

      if (
        editingProductId === null
      ) {
        const {
          data,
          error,
        } = await supabase
          .from('products')
          .insert(productData)
          .select(
            'id, sku',
          )
          .single();

        if (
          error ||
          !data
        ) {
          throw (
            error ??
            new Error(
              'Failed to create product.',
            )
          );
        }

        productId =
          data.id;
      } else {
        const {
          error,
        } = await supabase
          .from('products')
          .update(
            productData,
          )
          .eq(
            'id',
            editingProductId,
          );

        if (error) {
          throw error;
        }

        productId =
          editingProductId;
      }

      const purchaseCost =
        form.default_purchase_cost
          ? Number(
              form.default_purchase_cost,
            )
          : null;

      if (
        purchaseCost === null
      ) {
        const {
          error,
        } = await supabase
          .from(
            'product_costs',
          )
          .delete()
          .eq(
            'product_id',
            productId,
          );

        if (error) {
          throw error;
        }
      } else {
        const {
          error,
        } = await supabase
          .from(
            'product_costs',
          )
          .upsert({
            product_id:
              productId,

            default_purchase_cost:
              purchaseCost,

            updated_at:
              new Date().toISOString(),
          });

        if (error) {
          throw error;
        }
      }

      setMessage(
        editingProductId ===
          null
          ? 'Product added successfully.'
          : 'Product updated successfully.',
      );

      resetForm(false);

      await loadData();
    } catch (error) {
      console.error(
        'Failed to save product:',
        error,
      );

      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Failed to save product.',
      );
    } finally {
      setSaving(false);
    }
  }

  function startEdit(
    product: Product,
  ) {
    setEditingProductId(
      product.id,
    );

    setForm({
      sku:
        product.sku,

      name:
        product.name,

      category_id:
        String(
          product.category_id,
        ),

      default_purchase_cost:
        product.default_purchase_cost !==
        null
          ? String(
              product.default_purchase_cost,
            )
          : '',

      default_selling_price:
        product.default_selling_price !==
        null
          ? String(
              product.default_selling_price,
            )
          : '',

      unit:
        product.unit,

      size:
        product.size ??
        '',

      model:
        product.model ??
        '',

      box_type:
        product.box_type ??
        '',

      thickness:
        product.thickness ??
        '',

      seating_capacity:
        product.seating_capacity !==
        null
          ? String(
              product.seating_capacity,
            )
          : '',

      specification:
        product.specification ??
        '',
    });

    const category =
      categories.find(
        (value) =>
          value.id ===
          product.category_id,
      );

    setCategorySearch(
      category
        ? `${category.name} (${category.code})`
        : '',
    );

    setShowCategoryDropdown(
      false,
    );

    setMessage('');
    setErrorMessage('');

    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  }

  async function deactivateProduct(
    product: Product,
  ) {
    const confirmed =
      window.confirm(
        `Deactivate "${product.name}" (${product.sku})?`,
      );

    if (!confirmed) {
      return;
    }

    const {
      error,
    } = await supabase
      .from('products')
      .update({
        is_active: false,
      })
      .eq(
        'id',
        product.id,
      );

    if (error) {
      console.error(
        'Failed to deactivate product:',
        error,
      );

      setErrorMessage(
        error.message,
      );
      return;
    }

    if (
      editingProductId ===
      product.id
    ) {
      resetForm();
    }

    setMessage(
      'Product deactivated successfully.',
    );

    await loadData();
  }

  function getCategoryName(
    categoryId: number,
  ) {
    return (
      categories.find(
        (category) =>
          category.id ===
          categoryId,
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
              ) ||
            (
              product.model ??
              ''
            )
              .toLowerCase()
              .includes(
                normalizedSearch,
              ) ||
            (
              product.size ??
              ''
            )
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

  if (loading) {
    return (
      <p>
        Loading products...
      </p>
    );
  }

  return (
    <>
      <style>
        {`
          .products-page {
            width: 100%;
            max-width: 1200px;
            margin: 0 auto;
          }

          .product-form-card {
            padding: 22px;
            background: #ffffff;
            border: 1px solid #e4e7ec;
            border-radius: 14px;
            box-shadow:
              0 1px 2px rgba(16, 24, 40, 0.05);
          }

          .product-form-header {
            margin-bottom: 20px;
          }

          .product-form-header h2 {
            margin-bottom: 5px;
          }

          .product-form-header p {
            color: #667085;
            font-size: 14px;
          }

          .product-form-grid {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 16px;
          }

          .product-field {
            position: relative;
          }

          .product-field.full-width {
            grid-column: 1 / -1;
          }

          .product-field label {
            display: block;
            margin-bottom: 6px;
            color: #101828;
            font-size: 14px;
            font-weight: 600;
          }

          .product-field input,
          .product-field textarea {
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

          .product-field textarea {
            min-height: 90px;
            resize: vertical;
          }

          .product-field input:focus,
          .product-field textarea:focus {
            outline: none;
            border-color: #2563eb;
            box-shadow:
              0 0 0 3px rgba(37, 99, 235, 0.12);
          }

          .product-field input[readonly] {
            background: #f9fafb;
            color: #667085;
          }

          .sku-note {
            margin-top: 6px;
            color: #667085;
            font-size: 12px;
          }

          .category-picker {
            position: relative;
          }

          .category-picker-clear {
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

          .category-picker-clear:hover {
            background: #f2f4f7;
          }

          .category-dropdown {
            position: absolute;
            z-index: 30;
            left: 0;
            right: 0;
            top: calc(100% + 4px);
            max-height: 250px;
            overflow-y: auto;
            background: #ffffff;
            border: 1px solid #d0d5dd;
            border-radius: 8px;
            box-shadow:
              0 10px 25px rgba(16, 24, 40, 0.12);
          }

          .category-option {
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

          .category-option:last-child {
            border-bottom: 0;
          }

          .category-option:hover {
            background: #eff6ff;
          }

          .category-option-name {
            display: block;
            color: #101828;
            font-size: 14px;
            font-weight: 600;
          }

          .category-option-code {
            display: block;
            margin-top: 2px;
            color: #2563eb;
            font-size: 12px;
            font-weight: 700;
          }

          .category-hint {
            margin-top: 6px;
            color: #667085;
            font-size: 12px;
          }

          .selected-category {
            margin-top: 6px;
            color: #15803d;
            font-size: 13px;
            font-weight: 600;
          }

          .product-list {
            margin-top: 28px;
          }

          .product-filters {
            display: grid;
            grid-template-columns: 2fr 1fr;
            gap: 12px;
            margin-bottom: 10px;
          }

          .product-filters input,
          .product-filters select {
            width: 100%;
            min-height: 42px;
            box-sizing: border-box;
            padding: 9px 12px;
            border: 1px solid #d0d5dd;
            border-radius: 6px;
            background: #ffffff;
            color: #101828;
          }

          .product-filters input:focus,
          .product-filters select:focus {
            outline: none;
            border-color: #2563eb;
            box-shadow:
              0 0 0 3px rgba(37, 99, 235, 0.12);
          }

          .product-count {
            margin-bottom: 14px;
            color: #667085;
            font-size: 13px;
          }

          .product-grid {
            display: grid;
            grid-template-columns:
              repeat(auto-fill, minmax(260px, 1fr));
            gap: 16px;
          }

          .product-card {
            padding: 18px;
            background: #ffffff;
            border: 1px solid #e4e7ec;
            border-radius: 12px;
            box-shadow:
              0 1px 2px rgba(16, 24, 40, 0.05);
          }

          .product-card h3 {
            margin-bottom: 12px;
            color: #101828;
            line-height: 1.35;
          }

          .product-card p {
            margin-bottom: 7px;
            color: #667085;
            font-size: 14px;
          }

          .product-card strong {
            color: #344054;
          }

          .product-card .card-actions {
            margin-top: 16px;
          }

          .form-actions {
            grid-column: 1 / -1;
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
            margin-top: 4px;
          }

          .form-actions button {
            min-width: 120px;
          }

          .product-message {
            grid-column: 1 / -1;
            margin-top: 2px;
            padding: 10px 12px;
            border-radius: 8px;
            font-size: 14px;
          }

          .product-success {
            border: 1px solid #bbf7d0;
            background: #f0fdf4;
            color: #15803d;
          }

          .product-error {
            border: 1px solid #fecaca;
            background: #fef2f2;
            color: #dc2626;
          }

          @media (max-width: 750px) {
            .product-form-card {
              padding: 16px;
              border-radius: 10px;
            }

            .product-form-grid {
              grid-template-columns: 1fr;
            }

            .product-field.full-width,
            .form-actions,
            .product-message {
              grid-column: auto;
            }

            .product-filters {
              grid-template-columns: 1fr;
            }

            .product-grid {
              grid-template-columns: 1fr;
            }

            .form-actions {
              flex-direction: column;
            }

            .form-actions button {
              width: 100%;
            }
          }
        `}
      </style>

      <main className="products-page">
        <h1>Products</h1>

        <section className="product-form-card">
          <div className="product-form-header">
            <h2>
              {editingProductId ===
              null
                ? 'Add Product'
                : 'Edit Product'}
            </h2>

            <p>
              Add furniture products and
              maintain their pricing and
              specifications.
            </p>
          </div>

          <form
            onSubmit={
              handleSubmit
            }
            className="product-form-grid"
          >
            <div className="product-field">
              <label>
                SKU
              </label>

              {editingProductId !==
              null ? (
                <input
                  name="sku"
                  value={
                    form.sku
                  }
                  readOnly
                  placeholder="SKU"
                />
              ) : (
                <>
                  <input
                    value="Auto-generated"
                    readOnly
                  />

                  <p className="sku-note">
                    SKU is generated
                    automatically from
                    the selected category.
                  </p>
                </>
              )}
            </div>

            <div className="product-field">
              <label htmlFor="product-name">
                Product Name
              </label>

              <input
                id="product-name"
                name="name"
                value={
                  form.name
                }
                onChange={
                  handleChange
                }
                placeholder="Example: 3 Seater Sofa"
              />
            </div>

            <div className="product-field category-picker">
              <label htmlFor="category-search">
                Category
              </label>

              <input
                id="category-search"
                type="text"
                value={
                  categorySearch
                }
                onChange={(
                  event,
                ) =>
                  handleCategorySearchChange(
                    event.target.value,
                  )
                }
                onFocus={() =>
                  setShowCategoryDropdown(
                    true,
                  )
                }
                autoComplete="off"
                placeholder="Search category"
              />

              {categorySearch && (
                <button
                  type="button"
                  className="category-picker-clear"
                  aria-label="Clear category"
                  onClick={() => {
                    setCategorySearch(
                      '',
                    );

                    setForm(
                      (
                        current,
                      ) => ({
                        ...current,
                        category_id:
                          '',
                      }),
                    );

                    setShowCategoryDropdown(
                      true,
                    );
                  }}
                >
                  ×
                </button>
              )}

              {showCategoryDropdown && (
                <div className="category-dropdown">
                  {filteredCategories.length ===
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
                      No categories found.
                    </div>
                  ) : (
                    filteredCategories.map(
                      (
                        category,
                      ) => (
                        <button
                          key={
                            category.id
                          }
                          type="button"
                          className="category-option"
                          onMouseDown={(
                            event,
                          ) =>
                            event.preventDefault()
                          }
                          onClick={() =>
                            selectCategory(
                              category,
                            )
                          }
                        >
                          <span className="category-option-name">
                            {
                              category.name
                            }
                          </span>

                          <span className="category-option-code">
                            {
                              category.code
                            }
                          </span>
                        </button>
                      ),
                    )
                  )}
                </div>
              )}

              <p className="category-hint">
                Search by category name
                or code.
              </p>

              {selectedCategory && (
                <p className="selected-category">
                  Selected:{' '}
                  {
                    selectedCategory.name
                  } (
                  {
                    selectedCategory.code
                  }
                  )
                </p>
              )}
            </div>

            <div className="product-field">
              <label htmlFor="purchase-cost">
                Default Purchase Cost
              </label>

              <input
                id="purchase-cost"
                name="default_purchase_cost"
                value={
                  form.default_purchase_cost
                }
                onChange={
                  handleChange
                }
                type="number"
                min="0"
                step="0.01"
                placeholder="Purchase cost"
              />
            </div>

            <div className="product-field">
              <label htmlFor="selling-price">
                Default Selling Price
              </label>

              <input
                id="selling-price"
                name="default_selling_price"
                value={
                  form.default_selling_price
                }
                onChange={
                  handleChange
                }
                type="number"
                min="0"
                step="0.01"
                placeholder="Selling price"
              />
            </div>

            <div className="product-field">
              <label htmlFor="unit">
                Unit
              </label>

              <input
                id="unit"
                name="unit"
                value={
                  form.unit
                }
                onChange={
                  handleChange
                }
                placeholder="piece"
              />
            </div>

            <div className="product-field">
              <label htmlFor="size">
                Size
              </label>

              <input
                id="size"
                name="size"
                value={
                  form.size
                }
                onChange={
                  handleChange
                }
                placeholder="Example: 4x6"
              />
            </div>

            <div className="product-field">
              <label htmlFor="model">
                Model / Design
              </label>

              <input
                id="model"
                name="model"
                value={
                  form.model
                }
                onChange={
                  handleChange
                }
                placeholder="Model / design name"
              />
            </div>

            <div className="product-field">
              <label htmlFor="box-type">
                Box Type
              </label>

              <input
                id="box-type"
                name="box_type"
                value={
                  form.box_type
                }
                onChange={
                  handleChange
                }
                placeholder="Example: Storage box"
              />
            </div>

            <div className="product-field">
              <label htmlFor="thickness">
                Thickness
              </label>

              <input
                id="thickness"
                name="thickness"
                value={
                  form.thickness
                }
                onChange={
                  handleChange
                }
                placeholder="Example: 6 inch"
              />
            </div>

            <div className="product-field">
              <label htmlFor="seating-capacity">
                Seating Capacity
              </label>

              <input
                id="seating-capacity"
                name="seating_capacity"
                value={
                  form.seating_capacity
                }
                onChange={
                  handleChange
                }
                type="number"
                min="1"
                step="1"
                placeholder="Example: 3"
              />
            </div>

            <div className="product-field full-width">
              <label htmlFor="specification">
                Specification
              </label>

              <textarea
                id="specification"
                name="specification"
                value={
                  form.specification
                }
                onChange={
                  handleChange
                }
                placeholder="Additional product details"
                rows={3}
              />
            </div>

            {message && (
              <div className="product-message product-success">
                {message}
              </div>
            )}

            {errorMessage && (
              <div className="product-message product-error">
                {errorMessage}
              </div>
            )}

            <div className="form-actions">
              <button
                type="submit"
                disabled={saving}
              >
                {saving
                  ? 'Saving...'
                  : editingProductId ===
                      null
                    ? 'Add Product'
                    : 'Update Product'}
              </button>

              {editingProductId !==
                null && (
                <button
                  type="button"
                  onClick={() =>
                    resetForm()
                  }
                >
                  Cancel
                </button>
              )}
            </div>
          </form>
        </section>

        <section className="product-list">
          <h2>Product List</h2>

          <div className="product-filters">
            <input
              value={search}
              onChange={(
                event,
              ) =>
                setSearch(
                  event.target
                    .value,
                )
              }
              placeholder="Search SKU, product, model or size"
            />

            <select
              value={
                categoryFilter
              }
              onChange={(
                event,
              ) =>
                setCategoryFilter(
                  event.target
                    .value,
                )
              }
            >
              <option value="">
                All categories
              </option>

              {categories.map(
                (category) => (
                  <option
                    key={
                      category.id
                    }
                    value={
                      category.id
                    }
                  >
                    {category.name}
                  </option>
                ),
              )}
            </select>
          </div>

          <p className="product-count">
            Showing{' '}
            {
              filteredProducts.length
            }{' '}
            of {products.length}{' '}
            products
          </p>

          {filteredProducts.length ===
          0 ? (
            <p>
              No matching products.
            </p>
          ) : (
            <div className="product-grid">
              {filteredProducts.map(
                (product) => (
                  <article
                    key={
                      product.id
                    }
                    className="product-card"
                  >
                    <h3>
                      {
                        product.sku
                      }{' '}
                      —{' '}
                      {
                        product.name
                      }
                    </h3>

                    <p>
                      <strong>
                        Category:
                      </strong>{' '}
                      {
                        getCategoryName(
                          product.category_id,
                        )
                      }
                    </p>

                    {product.size && (
                      <p>
                        <strong>
                          Size:
                        </strong>{' '}
                        {
                          product.size
                        }
                      </p>
                    )}

                    {product.model && (
                      <p>
                        <strong>
                          Model:
                        </strong>{' '}
                        {
                          product.model
                        }
                      </p>
                    )}

                    {product.box_type && (
                      <p>
                        <strong>
                          Box:
                        </strong>{' '}
                        {
                          product.box_type
                        }
                      </p>
                    )}

                    {product.thickness && (
                      <p>
                        <strong>
                          Thickness:
                        </strong>{' '}
                        {
                          product.thickness
                        }
                      </p>
                    )}

                    {product.seating_capacity !==
                      null && (
                      <p>
                        <strong>
                          Seating:
                        </strong>{' '}
                        {
                          product.seating_capacity
                        }
                      </p>
                    )}

                    {product.specification && (
                      <p>
                        <strong>
                          Specification:
                        </strong>{' '}
                        {
                          product.specification
                        }
                      </p>
                    )}

                    <p>
                      <strong>
                        Purchase:
                      </strong>{' '}
                      {product.default_purchase_cost !==
                      null
                        ? `INR ${product.default_purchase_cost.toLocaleString(
                            'en-IN',
                          )}`
                        : '-'}
                    </p>

                    <p>
                      <strong>
                        Selling:
                      </strong>{' '}
                      {product.default_selling_price !==
                      null
                        ? `INR ${product.default_selling_price.toLocaleString(
                            'en-IN',
                          )}`
                        : '-'}
                    </p>

                    <div className="card-actions">
                      <button
                        type="button"
                        onClick={() =>
                          startEdit(
                            product,
                          )
                        }
                      >
                        Edit
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          void deactivateProduct(
                            product,
                          )
                        }
                      >
                        Deactivate
                      </button>
                    </div>
                  </article>
                ),
              )}
            </div>
          )}
        </section>
      </main>
    </>
  );
}

export default Products;