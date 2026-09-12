import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';

type Customer = {
  id: number;
  name: string;
  contact_person: string | null;
  phone: string | null;
  address: string | null;
  customer_type: 'INDIVIDUAL' | 'SHOP';
  notes: string | null;
};

type CustomerForm = {
  name: string;
  contact_person: string;
  phone: string;
  address: string;
  customer_type: 'INDIVIDUAL' | 'SHOP';
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
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [form, setForm] = useState<CustomerForm>({ ...emptyForm });

  const [editingCustomerId, setEditingCustomerId] = useState<number | null>(
    null,
  );

  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<
    '' | 'INDIVIDUAL' | 'SHOP'
  >('');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [message, setMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    void loadCustomers();
  }, []);

  async function loadCustomers() {
    setLoading(true);
    setErrorMessage('');

    const { data, error } = await supabase
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
      console.error('Failed to load customers:', error);
      setErrorMessage(error.message);
      setLoading(false);
      return;
    }

    setCustomers(data ?? []);
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
    setEditingCustomerId(null);
    setMessage('');
    setErrorMessage('');
  }

  async function handleSubmit(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    setMessage('');
    setErrorMessage('');

    if (!form.name.trim()) {
      setErrorMessage('Customer or shop name is required.');
      return;
    }

    setSaving(true);

    const customerData = {
      name: form.name.trim(),
      contact_person: form.contact_person.trim() || null,
      phone: form.phone.trim() || null,
      address: form.address.trim() || null,
      customer_type: form.customer_type,
      notes: form.notes.trim() || null,
    };

    let error = null;

    if (editingCustomerId === null) {
      const result = await supabase
        .from('customers')
        .insert(customerData);

      error = result.error;
    } else {
      const result = await supabase
        .from('customers')
        .update(customerData)
        .eq('id', editingCustomerId);

      error = result.error;
    }

    setSaving(false);

    if (error) {
      console.error('Failed to save customer:', error);
      setErrorMessage(error.message);
      return;
    }

    setMessage(
      editingCustomerId === null
        ? 'Customer added successfully.'
        : 'Customer updated successfully.',
    );

    resetForm();
    await loadCustomers();
  }

  function startEdit(customer: Customer) {
    setEditingCustomerId(customer.id);

    setForm({
      name: customer.name,
      contact_person: customer.contact_person ?? '',
      phone: customer.phone ?? '',
      address: customer.address ?? '',
      customer_type: customer.customer_type,
      notes: customer.notes ?? '',
    });

    setMessage('');
    setErrorMessage('');

    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  }

  async function deactivateCustomer(customer: Customer) {
    const confirmed = window.confirm(
      'Deactivate "' + customer.name + '"?',
    );

    if (!confirmed) {
      return;
    }

    const { error } = await supabase
      .from('customers')
      .update({ is_active: false })
      .eq('id', customer.id);

    if (error) {
      console.error('Failed to deactivate customer:', error);
      setErrorMessage(error.message);
      return;
    }

    if (editingCustomerId === customer.id) {
      resetForm();
    }

    setMessage('Customer deactivated successfully.');

    await loadCustomers();
  }

  const filteredCustomers = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return customers.filter((customer) => {
      const matchesSearch =
        normalizedSearch === '' ||
        customer.name.toLowerCase().includes(normalizedSearch) ||
        (customer.contact_person ?? '')
          .toLowerCase()
          .includes(normalizedSearch) ||
        (customer.phone ?? '')
          .toLowerCase()
          .includes(normalizedSearch) ||
        (customer.address ?? '')
          .toLowerCase()
          .includes(normalizedSearch);

      const matchesType =
        typeFilter === '' || customer.customer_type === typeFilter;

      return matchesSearch && matchesType;
    });
  }, [customers, search, typeFilter]);

  if (loading) {
    return <p>Loading customers...</p>;
  }

  return (
    <main>
      <h1>Customers</h1>

      <form onSubmit={handleSubmit}>
        <h2>
          {editingCustomerId === null
            ? 'Add Customer'
            : 'Edit Customer'}
        </h2>

        <div>
          <label htmlFor="customerType">Type</label>

          <select
            id="customerType"
            name="customer_type"
            value={form.customer_type}
            onChange={handleChange}
          >
            <option value="INDIVIDUAL">Individual</option>
            <option value="SHOP">Shop</option>
          </select>
        </div>

        <div>
          <label htmlFor="customerName">
            Customer / Shop Name
          </label>

          <input
            id="customerName"
            name="name"
            value={form.name}
            onChange={handleChange}
            placeholder="Customer or shop name"
          />
        </div>

        <div>
          <label htmlFor="contactPerson">
            Contact Person / Owner
          </label>

          <input
            id="contactPerson"
            name="contact_person"
            value={form.contact_person}
            onChange={handleChange}
            placeholder="Owner or contact person"
          />
        </div>

        <div>
          <label htmlFor="phone">Phone Number</label>

          <input
            id="phone"
            name="phone"
            value={form.phone}
            onChange={handleChange}
            type="tel"
            placeholder="Phone number"
          />
        </div>

        <div>
          <label htmlFor="address">Address</label>

          <textarea
            id="address"
            name="address"
            value={form.address}
            onChange={handleChange}
            rows={3}
            placeholder="Address"
          />
        </div>

        <div>
          <label htmlFor="notes">Notes</label>

          <textarea
            id="notes"
            name="notes"
            value={form.notes}
            onChange={handleChange}
            rows={3}
            placeholder="Notes"
          />
        </div>

        <div>
          <button type="submit" disabled={saving}>
            {saving
              ? 'Saving...'
              : editingCustomerId === null
                ? 'Add Customer'
                : 'Update Customer'}
          </button>

          {editingCustomerId !== null && (
            <button type="button" onClick={resetForm}>
              Cancel
            </button>
          )}
        </div>

        {message && <p>{message}</p>}
        {errorMessage && <p>{errorMessage}</p>}
      </form>

      <section>
        <h2>Customer List</h2>

        <div>
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search name, owner, phone or address"
          />

          <select
            value={typeFilter}
            onChange={(event) =>
              setTypeFilter(
                event.target.value as
                  | ''
                  | 'INDIVIDUAL'
                  | 'SHOP',
              )
            }
          >
            <option value="">All</option>
            <option value="INDIVIDUAL">Individuals</option>
            <option value="SHOP">Shops</option>
          </select>
        </div>

        <p>
          Showing {filteredCustomers.length} of {customers.length}
          customers
        </p>

        {filteredCustomers.length === 0 ? (
          <p>No matching customers.</p>
        ) : (
          <div>
            {filteredCustomers.map((customer) => (
              <article key={customer.id}>
                <h3>{customer.name}</h3>

                <p>
                  <strong>Type:</strong>{' '}
                  {customer.customer_type === 'SHOP'
                    ? 'Shop'
                    : 'Individual'}
                </p>

                {customer.contact_person && (
                  <p>
                    <strong>Contact:</strong>{' '}
                    {customer.contact_person}
                  </p>
                )}

                {customer.phone && (
                  <p>
                    <strong>Phone:</strong> {customer.phone}
                  </p>
                )}

                {customer.address && (
                  <p>
                    <strong>Address:</strong> {customer.address}
                  </p>
                )}

                {customer.notes && (
                  <p>
                    <strong>Notes:</strong> {customer.notes}
                  </p>
                )}

                <div>
                  <button
                    type="button"
                    onClick={() => startEdit(customer)}
                  >
                    Edit
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      void deactivateCustomer(customer)
                    }
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

export default Customers;