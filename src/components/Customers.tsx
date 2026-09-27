import {
  useEffect,
  useMemo,
  useState,
} from 'react';
import { supabase } from '../lib/supabase';

type Customer = {
  id: number;
  name: string;
  contact_person: string | null;
  phone: string | null;
  address: string | null;
  customer_type:
    | 'INDIVIDUAL'
    | 'SHOP';
  notes: string | null;
};

type CustomerForm = {
  name: string;
  contact_person: string;
  phone: string;
  address: string;
  customer_type:
    | 'INDIVIDUAL'
    | 'SHOP';
  notes: string;
};

const emptyForm: CustomerForm = {
  name: '',
  contact_person: '',
  phone: '',
  address: '',
  customer_type: 'INDIVIDUAL',
  notes: '',
};

function Customers() {
  const [customers, setCustomers] =
    useState<Customer[]>([]);

  const [form, setForm] =
    useState<CustomerForm>({
      ...emptyForm,
    });

  const [
    editingCustomerId,
    setEditingCustomerId,
  ] = useState<number | null>(null);

  const [search, setSearch] =
    useState('');

  const [typeFilter, setTypeFilter] =
    useState<
      '' | 'INDIVIDUAL' | 'SHOP'
    >('');

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [message, setMessage] =
    useState('');

  const [errorMessage, setErrorMessage] =
    useState('');

  useEffect(() => {
    void loadCustomers();
  }, []);

  async function loadCustomers() {
    setLoading(true);
    setErrorMessage('');

    const {
      data,
      error,
    } = await supabase
      .from('customers')
      .select(`
        id,
        name,
        contact_person,
        phone,
        address,
        customer_type,
        notes
      `)
      .eq('is_active', true)
      .order('name');

    if (error) {
      console.error(
        'Failed to load customers:',
        error,
      );

      setErrorMessage(
        error.message,
      );

      setLoading(false);
      return;
    }

    setCustomers(
      data ?? [],
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

  function resetForm(
    clearMessages = true,
  ) {
    setForm({
      ...emptyForm,
    });

    setEditingCustomerId(null);

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
        form.customer_type ===
          'SHOP'
          ? 'Shop name is required.'
          : 'Customer name is required.',
      );

      return;
    }

    setSaving(true);

    const customerData = {
      name:
        form.name.trim(),

      contact_person:
        form.contact_person.trim() ||
        null,

      phone:
        form.phone.trim() ||
        null,

      address:
        form.address.trim() ||
        null,

      customer_type:
        form.customer_type,

      notes:
        form.notes.trim() ||
        null,
    };

    try {
      if (
        editingCustomerId ===
        null
      ) {
        const {
          error,
        } = await supabase
          .from('customers')
          .insert(
            customerData,
          );

        if (error) {
          throw error;
        }

        setMessage(
          'Customer added successfully.',
        );
      } else {
        const {
          error,
        } = await supabase
          .from('customers')
          .update(
            customerData,
          )
          .eq(
            'id',
            editingCustomerId,
          );

        if (error) {
          throw error;
        }

        setMessage(
          'Customer updated successfully.',
        );
      }

      resetForm(false);

      await loadCustomers();
    } catch (error) {
      console.error(
        'Failed to save customer:',
        error,
      );

      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Failed to save customer.',
      );
    } finally {
      setSaving(false);
    }
  }

  function startEdit(
    customer: Customer,
  ) {
    setEditingCustomerId(
      customer.id,
    );

    setForm({
      name:
        customer.name,

      contact_person:
        customer.contact_person ??
        '',

      phone:
        customer.phone ??
        '',

      address:
        customer.address ??
        '',

      customer_type:
        customer.customer_type,

      notes:
        customer.notes ??
        '',
    });

    setMessage('');
    setErrorMessage('');

    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  }

  async function deactivateCustomer(
    customer: Customer,
  ) {
    const confirmed =
      window.confirm(
        `Deactivate "${customer.name}"?`,
      );

    if (!confirmed) {
      return;
    }

    const {
      error,
    } = await supabase
      .from('customers')
      .update({
        is_active: false,
      })
      .eq(
        'id',
        customer.id,
      );

    if (error) {
      console.error(
        'Failed to deactivate customer:',
        error,
      );

      setErrorMessage(
        error.message,
      );

      return;
    }

    if (
      editingCustomerId ===
      customer.id
    ) {
      resetForm();
    }

    setMessage(
      'Customer deactivated successfully.',
    );

    await loadCustomers();
  }

  const filteredCustomers =
    useMemo(() => {
      const normalizedSearch =
        search
          .trim()
          .toLowerCase();

      return customers.filter(
        (customer) => {
          const matchesSearch =
            normalizedSearch ===
              '' ||
            customer.name
              .toLowerCase()
              .includes(
                normalizedSearch,
              ) ||
            (
              customer.contact_person ??
              ''
            )
              .toLowerCase()
              .includes(
                normalizedSearch,
              ) ||
            (
              customer.phone ??
              ''
            )
              .toLowerCase()
              .includes(
                normalizedSearch,
              ) ||
            (
              customer.address ??
              ''
            )
              .toLowerCase()
              .includes(
                normalizedSearch,
              );

          const matchesType =
            typeFilter === '' ||
            customer.customer_type ===
              typeFilter;

          return (
            matchesSearch &&
            matchesType
          );
        },
      );
    }, [
      customers,
      search,
      typeFilter,
    ]);

  if (loading) {
    return (
      <p>
        Loading customers...
      </p>
    );
  }

  return (
    <>
      <style>
        {`
          .customers-page {
            width: 100%;
            max-width: 1200px;
            margin: 0 auto;
          }

          .customer-form-card {
            padding: 22px;
            background: #ffffff;
            border: 1px solid #e4e7ec;
            border-radius: 14px;
            box-shadow:
              0 1px 2px rgba(16, 24, 40, 0.05);
          }

          .customer-form-header {
            margin-bottom: 20px;
          }

          .customer-form-header h2 {
            margin-bottom: 5px;
          }

          .customer-form-header p {
            color: #667085;
            font-size: 14px;
          }

          .customer-form-grid {
            display: grid;
            grid-template-columns:
              repeat(2, minmax(0, 1fr));
            gap: 16px;
          }

          .customer-field {
            min-width: 0;
          }

          .customer-field.full-width {
            grid-column: 1 / -1;
          }

          .customer-field label {
            display: block;
            margin-bottom: 6px;
            color: #101828;
            font-size: 14px;
            font-weight: 600;
          }

          .customer-field input,
          .customer-field textarea {
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

          .customer-field textarea {
            min-height: 90px;
            resize: vertical;
          }

          .customer-field input:focus,
          .customer-field textarea:focus {
            outline: none;
            border-color: #2563eb;
            box-shadow:
              0 0 0 3px rgba(37, 99, 235, 0.12);
          }

          .customer-type {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 8px;
          }

          .customer-type button {
            min-height: 42px;
          }

          .customer-type button.active {
            border-color: #2563eb;
            background: #eff6ff;
            color: #1d4ed8;
          }

          .customer-form-actions {
            grid-column: 1 / -1;
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
            margin-top: 2px;
          }

          .customer-form-actions button {
            min-width: 120px;
          }

          .customer-message {
            grid-column: 1 / -1;
            padding: 10px 12px;
            border-radius: 8px;
            font-size: 14px;
          }

          .customer-success {
            border: 1px solid #bbf7d0;
            background: #f0fdf4;
            color: #15803d;
          }

          .customer-error {
            border: 1px solid #fecaca;
            background: #fef2f2;
            color: #dc2626;
          }

          .customer-list-section {
            margin-top: 28px;
          }

          .customer-filters {
            display: grid;
            grid-template-columns:
              2fr 1fr;
            gap: 12px;
            margin-bottom: 10px;
          }

          .customer-filters input,
          .customer-filters select {
            width: 100%;
            min-height: 42px;
            box-sizing: border-box;
            padding: 9px 12px;
            border: 1px solid #d0d5dd;
            border-radius: 6px;
            background: #ffffff;
            color: #101828;
          }

          .customer-filters input:focus,
          .customer-filters select:focus {
            outline: none;
            border-color: #2563eb;
            box-shadow:
              0 0 0 3px rgba(37, 99, 235, 0.12);
          }

          .customer-count {
            margin-bottom: 14px;
            color: #667085;
            font-size: 13px;
          }

          .customer-grid {
            display: grid;
            grid-template-columns:
              repeat(
                auto-fill,
                minmax(280px, 1fr)
              );
            gap: 16px;
          }

          .customer-card {
            padding: 18px;
            background: #ffffff;
            border: 1px solid #e4e7ec;
            border-radius: 12px;
            box-shadow:
              0 1px 2px rgba(16, 24, 40, 0.05);
          }

          .customer-card-header {
            display: flex;
            align-items: flex-start;
            justify-content: space-between;
            gap: 12px;
            margin-bottom: 12px;
          }

          .customer-card-header h3 {
            margin: 0;
            color: #101828;
          }

          .customer-type-badge {
            flex: 0 0 auto;
            padding: 4px 8px;
            border-radius: 999px;
            background: #eff6ff;
            color: #1d4ed8;
            font-size: 11px;
            font-weight: 700;
          }

          .customer-card p {
            margin-bottom: 7px;
            color: #667085;
            font-size: 14px;
            overflow-wrap: anywhere;
          }

          .customer-card strong {
            color: #344054;
          }

          .customer-card-actions {
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
            margin-top: 16px;
          }

          .customer-card-actions button {
            min-width: 100px;
          }

          @media (max-width: 700px) {
            .customer-form-card {
              padding: 16px;
              border-radius: 10px;
            }

            .customer-form-grid {
              grid-template-columns: 1fr;
            }

            .customer-field.full-width,
            .customer-form-actions,
            .customer-message {
              grid-column: auto;
            }

            .customer-filters {
              grid-template-columns: 1fr;
            }

            .customer-grid {
              grid-template-columns: 1fr;
            }

            .customer-form-actions {
              flex-direction: column;
            }

            .customer-form-actions button {
              width: 100%;
            }

            .customer-card-actions {
              flex-direction: column;
            }

            .customer-card-actions button {
              width: 100%;
            }
          }
        `}
      </style>

      <main className="customers-page">
        <h1>Customers</h1>

        <section className="customer-form-card">
          <div className="customer-form-header">
            <h2>
              {editingCustomerId ===
              null
                ? 'Add Customer'
                : 'Edit Customer'}
            </h2>

            <p>
              Maintain customer and shop
              details for sales and
              outstanding balances.
            </p>
          </div>

          <form
            onSubmit={
              handleSubmit
            }
            className="customer-form-grid"
          >
            <div className="customer-field">
              <label>
                Customer Type
              </label>

              <div className="customer-type">
                <button
                  type="button"
                  className={
                    form.customer_type ===
                    'INDIVIDUAL'
                      ? 'active'
                      : ''
                  }
                  onClick={() =>
                    setForm(
                      (current) => ({
                        ...current,
                        customer_type:
                          'INDIVIDUAL',
                      }),
                    )
                  }
                >
                  Retail Customer
                </button>

                <button
                  type="button"
                  className={
                    form.customer_type ===
                    'SHOP'
                      ? 'active'
                      : ''
                  }
                  onClick={() =>
                    setForm(
                      (current) => ({
                        ...current,
                        customer_type:
                          'SHOP',
                      }),
                    )
                  }
                >
                  Wholesale Customer
                </button>
              </div>
            </div>

            <div className="customer-field">
              <label htmlFor="customerName">
                {form.customer_type ===
                'SHOP'
                  ? 'Shop Name'
                  : 'Customer Name'}
              </label>

              <input
                id="customerName"
                name="name"
                value={
                  form.name
                }
                onChange={
                  handleChange
                }
                placeholder={
                  form.customer_type ===
                  'SHOP'
                    ? 'Shop name'
                    : 'Customer name'
                }
              />
            </div>

            <div className="customer-field">
              <label htmlFor="contactPerson">
                {form.customer_type ===
                'SHOP'
                  ? 'Contact Person / Owner'
                  : 'Contact Person (optional)'}
              </label>

              <input
                id="contactPerson"
                name="contact_person"
                value={
                  form.contact_person
                }
                onChange={
                  handleChange
                }
                placeholder="Contact person"
              />
            </div>

            <div className="customer-field">
              <label htmlFor="phone">
                Phone Number
              </label>

              <input
                id="phone"
                name="phone"
                value={
                  form.phone
                }
                onChange={
                  handleChange
                }
                type="tel"
                inputMode="tel"
                placeholder="Phone number"
              />
            </div>

            <div className="customer-field full-width">
              <label htmlFor="address">
                Address
              </label>

              <textarea
                id="address"
                name="address"
                value={
                  form.address
                }
                onChange={
                  handleChange
                }
                rows={3}
                placeholder="Customer or shop address"
              />
            </div>

            <div className="customer-field full-width">
              <label htmlFor="notes">
                Notes
              </label>

              <textarea
                id="notes"
                name="notes"
                value={
                  form.notes
                }
                onChange={
                  handleChange
                }
                rows={3}
                placeholder="Optional notes"
              />
            </div>

            {message && (
              <div className="customer-message customer-success">
                {message}
              </div>
            )}

            {errorMessage && (
              <div className="customer-message customer-error">
                {errorMessage}
              </div>
            )}

            <div className="customer-form-actions">
              <button
                type="submit"
                disabled={saving}
              >
                {saving
                  ? 'Saving...'
                  : editingCustomerId ===
                      null
                    ? 'Add Customer'
                    : 'Update Customer'}
              </button>

              {editingCustomerId !==
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

        <section className="customer-list-section">
          <h2>
            Customer List
          </h2>

          <div className="customer-filters">
            <input
              value={
                search
              }
              onChange={(
                event,
              ) =>
                setSearch(
                  event.target
                    .value,
                )
              }
              placeholder="Search name, contact, phone or address"
            />

            <select
              value={
                typeFilter
              }
              onChange={(
                event,
              ) =>
                setTypeFilter(
                  event.target
                    .value as
                    | ''
                    | 'INDIVIDUAL'
                    | 'SHOP',
                )
              }
            >
              <option value="">
                All Customers
              </option>

              <option value="INDIVIDUAL">
                Retail Customers
              </option>

              <option value="SHOP">
                Wholesale Customers
              </option>
            </select>
          </div>

          <p className="customer-count">
            Showing{' '}
            {
              filteredCustomers.length
            }{' '}
            of {customers.length}{' '}
            customers
          </p>

          {filteredCustomers.length ===
          0 ? (
            <p>
              No matching customers.
            </p>
          ) : (
            <div className="customer-grid">
              {filteredCustomers.map(
                (customer) => (
                  <article
                    key={
                      customer.id
                    }
                    className="customer-card"
                  >
                    <div className="customer-card-header">
                      <h3>
                        {
                          customer.name
                        }
                      </h3>

                      <span className="customer-type-badge">
                        {customer.customer_type ===
                        'SHOP'
                          ? 'WHOLESALE'
                          : 'RETAIL'}
                      </span>
                    </div>

                    {customer.contact_person && (
                      <p>
                        <strong>
                          Contact:
                        </strong>{' '}
                        {
                          customer.contact_person
                        }
                      </p>
                    )}

                    {customer.phone && (
                      <p>
                        <strong>
                          Phone:
                        </strong>{' '}
                        {
                          customer.phone
                        }
                      </p>
                    )}

                    {customer.address && (
                      <p>
                        <strong>
                          Address:
                        </strong>{' '}
                        {
                          customer.address
                        }
                      </p>
                    )}

                    {customer.notes && (
                      <p>
                        <strong>
                          Notes:
                        </strong>{' '}
                        {
                          customer.notes
                        }
                      </p>
                    )}

                    <div className="customer-card-actions">
                      <button
                        type="button"
                        onClick={() =>
                          startEdit(
                            customer,
                          )
                        }
                      >
                        Edit
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          void deactivateCustomer(
                            customer,
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

export default Customers;