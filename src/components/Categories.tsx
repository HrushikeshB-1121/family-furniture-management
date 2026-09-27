import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

type Category = {
  id: number;
  name: string;
  code: string;
  next_sku_number: number;
  is_active: boolean;
};

type CategoryForm = {
  name: string;
  code: string;
};

const emptyForm: CategoryForm = {
  name: '',
  code: '',
};

function Categories() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [form, setForm] = useState<CategoryForm>({
    ...emptyForm,
  });

  const [editingCategoryId, setEditingCategoryId] =
    useState<number | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [message, setMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    void loadCategories();
  }, []);

  async function loadCategories() {
    setLoading(true);
    setErrorMessage('');

    const { data, error } = await supabase
      .from('categories')
      .select(
        'id, name, code, next_sku_number, is_active',
      )
      .order('name');

    if (error) {
      console.error(
        'Failed to load categories:',
        error,
      );

      setErrorMessage(error.message);
      setLoading(false);
      return;
    }

    setCategories(data ?? []);
    setLoading(false);
  }

  function handleChange(
    event: React.ChangeEvent<HTMLInputElement>,
  ) {
    const { name, value } = event.target;

    setForm((current) => ({
      ...current,
      [name]:
        name === 'code'
          ? value.toUpperCase().replace(/[^A-Z]/g, '')
          : value,
    }));
  }

  function resetForm() {
    setForm({ ...emptyForm });
    setEditingCategoryId(null);
    setMessage('');
    setErrorMessage('');
  }

  async function handleSubmit(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    setMessage('');
    setErrorMessage('');

    const name = form.name.trim();
    const code = form.code.trim().toUpperCase();

    if (!name) {
      setErrorMessage(
        'Category name is required.',
      );
      return;
    }

    if (!/^[A-Z]{2,5}$/.test(code)) {
      setErrorMessage(
        'Category code must be 2 to 5 uppercase letters.',
      );
      return;
    }

    setSaving(true);

    try {
      if (editingCategoryId === null) {
        const { error } = await supabase
          .from('categories')
          .insert({
            name,
            code,
          });

        if (error) {
          throw error;
        }

        setMessage(
          'Category added successfully.',
        );
      } else {
        const { error } = await supabase
          .from('categories')
          .update({
            name,
            code,
          })
          .eq('id', editingCategoryId);

        if (error) {
          throw error;
        }

        setMessage(
          'Category updated successfully.',
        );
      }

      resetForm();
      await loadCategories();
    } catch (error) {
      console.error(
        'Failed to save category:',
        error,
      );

      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Failed to save category.',
      );
    } finally {
      setSaving(false);
    }
  }

  function startEdit(category: Category) {
    setEditingCategoryId(category.id);

    setForm({
      name: category.name,
      code: category.code,
    });

    setMessage('');
    setErrorMessage('');

    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  }

  async function deactivateCategory(
    category: Category,
  ) {
    const confirmed = window.confirm(
      `Deactivate "${category.name}" (${category.code})?`,
    );

    if (!confirmed) {
      return;
    }

    const { error } = await supabase
      .from('categories')
      .update({
        is_active: false,
      })
      .eq('id', category.id);

    if (error) {
      console.error(
        'Failed to deactivate category:',
        error,
      );

      setErrorMessage(error.message);
      return;
    }

    if (
      editingCategoryId === category.id
    ) {
      resetForm();
    }

    setMessage(
      'Category deactivated successfully.',
    );

    await loadCategories();
  }

  async function activateCategory(
    category: Category,
  ) {
    const { error } = await supabase
      .from('categories')
      .update({
        is_active: true,
      })
      .eq('id', category.id);

    if (error) {
      console.error(
        'Failed to activate category:',
        error,
      );

      setErrorMessage(error.message);
      return;
    }

    setMessage(
      'Category activated successfully.',
    );

    await loadCategories();
  }

  if (loading) {
    return <p>Loading categories...</p>;
  }

  return (
    <main className="categories-page">
      <h1>Categories</h1>

      <form
        onSubmit={handleSubmit}
        className="category-form"
      >
        <h2>
          {editingCategoryId === null
            ? 'Add Category'
            : 'Edit Category'}
        </h2>

        <input
          name="name"
          value={form.name}
          onChange={handleChange}
          placeholder="Category name"
        />

        <input
          name="code"
          value={form.code}
          onChange={handleChange}
          placeholder="Category code e.g. CHA"
          maxLength={5}
        />

        <p>
          New products in this category will use this
          code for automatic SKUs.
        </p>

        <div className="form-actions">
          <button
            type="submit"
            disabled={saving}
          >
            {saving
              ? 'Saving...'
              : editingCategoryId === null
                ? 'Add Category'
                : 'Update Category'}
          </button>

          {editingCategoryId !== null && (
            <button
              type="button"
              onClick={resetForm}
            >
              Cancel
            </button>
          )}
        </div>

        {message && <p>{message}</p>}

        {errorMessage && (
          <p>{errorMessage}</p>
        )}
      </form>

      <section className="category-list">
        <h2>Category List</h2>

        {categories.length === 0 ? (
          <p>No categories found.</p>
        ) : (
          <div className="category-grid">
            {categories.map((category) => (
              <article
                key={category.id}
                className="category-card"
              >
                <h3>{category.name}</h3>

                <p>
                  <strong>Code:</strong>{' '}
                  {category.code}
                </p>

                <p>
                  <strong>Next SKU:</strong>{' '}
                  {category.code}-
                  {String(
                    category.next_sku_number,
                  ).padStart(3, '0')}
                </p>

                <p>
                  <strong>Status:</strong>{' '}
                  {category.is_active
                    ? 'Active'
                    : 'Inactive'}
                </p>

                <div className="card-actions">
                  <button
                    type="button"
                    onClick={() =>
                      startEdit(category)
                    }
                  >
                    Edit
                  </button>

                  {category.is_active ? (
                    <button
                      type="button"
                      onClick={() =>
                        void deactivateCategory(
                          category,
                        )
                      }
                    >
                      Deactivate
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() =>
                        void activateCategory(
                          category,
                        )
                      }
                    >
                      Activate
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

export default Categories;