import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';

type Supplier = {
  id: number;
  name: string;
  phone: string | null;
  address: string | null;
  is_active: boolean;
};

type SupplierForm = {
  name: string;
  phone: string;
  address: string;
};

const emptyForm: SupplierForm = { name: '', phone: '', address: '' };

export default function Suppliers() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [form, setForm] = useState<SupplierForm>(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => { void loadSuppliers(); }, []);

  async function loadSuppliers() {
    setLoading(true);
    setErrorMessage('');
    const { data, error } = await supabase
      .from('suppliers')
      .select('id, name, phone, address, is_active')
      .order('name');
    if (error) {
      setErrorMessage(error.message);
      setLoading(false);
      return;
    }
    setSuppliers(data ?? []);
    setLoading(false);
  }

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return suppliers;
    return suppliers.filter((supplier) =>
      [supplier.name, supplier.phone, supplier.address]
        .some((value) => value?.toLowerCase().includes(term)),
    );
  }, [search, suppliers]);

  function resetForm() {
    setForm(emptyForm);
    setEditingId(null);
  }

  async function saveSupplier(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage('');
    setErrorMessage('');
    if (!form.name.trim()) {
      setErrorMessage('Supplier name is required.');
      return;
    }
    setSaving(true);
    const values = {
      name: form.name.trim(),
      phone: form.phone.trim() || null,
      address: form.address.trim() || null,
    };
    const result = editingId === null
      ? await supabase.from('suppliers').insert({ ...values, is_active: true })
      : await supabase.from('suppliers').update(values).eq('id', editingId);
    if (result.error) {
      setErrorMessage(result.error.message);
    } else {
      setMessage(editingId === null ? 'Supplier added successfully.' : 'Supplier updated successfully.');
      resetForm();
      await loadSuppliers();
    }
    setSaving(false);
  }

  function startEdit(supplier: Supplier) {
    setEditingId(supplier.id);
    setForm({ name: supplier.name, phone: supplier.phone ?? '', address: supplier.address ?? '' });
    setMessage('');
    setErrorMessage('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function setActive(supplier: Supplier, isActive: boolean) {
    setMessage('');
    setErrorMessage('');
    const { error } = await supabase.from('suppliers').update({ is_active: isActive }).eq('id', supplier.id);
    if (error) {
      setErrorMessage(error.message);
      return;
    }
    setMessage(isActive ? 'Supplier reactivated.' : 'Supplier deactivated. Existing purchases and transactions are preserved.');
    await loadSuppliers();
  }

  return (
    <main className="suppliers-page">
      <style>{`
        .suppliers-page { width:100%; max-width:1200px; margin:0 auto; }
        .supplier-form-card,.supplier-list-card { padding:22px; background:#fff; border:1px solid #e4e7ec; border-radius:14px; box-shadow:0 1px 2px rgba(16,24,40,.05); margin-bottom:18px; }
        .supplier-form-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:14px; }
        .supplier-field { display:flex; flex-direction:column; gap:6px; }
        .supplier-field.full { grid-column:1/-1; }
        .supplier-field label { font-size:13px; font-weight:600; color:#344054; }
        .supplier-field input,.supplier-field textarea,.supplier-search { padding:10px 12px; border:1px solid #d0d5dd; border-radius:8px; font:inherit; }
        .supplier-actions,.supplier-row-actions { display:flex; gap:8px; align-items:center; flex-wrap:wrap; }
        .supplier-actions { margin-top:16px; }
        .supplier-actions button,.supplier-row-actions button { border:0; border-radius:8px; padding:9px 13px; cursor:pointer; font-weight:600; }
        .supplier-primary { background:#2563eb; color:white; }
        .supplier-secondary { background:#f2f4f7; color:#344054; }
        .supplier-table-wrap { overflow-x:auto; }
        .supplier-table { width:100%; border-collapse:collapse; }
        .supplier-table th,.supplier-table td { text-align:left; padding:12px 10px; border-bottom:1px solid #eaecf0; }
        .supplier-status { font-size:12px; font-weight:700; }
        .supplier-inactive { color:#b54708; }
        .supplier-message { padding:10px 12px; margin-bottom:12px; border-radius:8px; background:#ecfdf3; color:#027a48; }
        .supplier-error { padding:10px 12px; margin-bottom:12px; border-radius:8px; background:#fef3f2; color:#b42318; }
        @media(max-width:650px) { .supplier-form-grid { grid-template-columns:1fr; } .supplier-field.full { grid-column:auto; } }
      `}</style>
      <h1>Suppliers</h1>
      {message && <p className="supplier-message" role="status">{message}</p>}
      {errorMessage && <p className="supplier-error" role="alert">{errorMessage}</p>}
      <section className="supplier-form-card">
        <h2>{editingId === null ? 'Add Supplier' : 'Edit Supplier'}</h2>
        <form onSubmit={(event) => void saveSupplier(event)}>
          <div className="supplier-form-grid">
            <div className="supplier-field"><label htmlFor="supplier-name">Supplier Name</label><input id="supplier-name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required /></div>
            <div className="supplier-field"><label htmlFor="supplier-phone">Phone</label><input id="supplier-phone" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} /></div>
            <div className="supplier-field full"><label htmlFor="supplier-address">Address</label><textarea id="supplier-address" rows={2} value={form.address} onChange={(event) => setForm({ ...form, address: event.target.value })} /></div>
          </div>
          <div className="supplier-actions"><button className="supplier-primary" disabled={saving}>{saving ? 'Saving…' : editingId === null ? 'Add Supplier' : 'Save Changes'}</button>{editingId !== null && <button type="button" className="supplier-secondary" onClick={resetForm}>Cancel</button>}</div>
        </form>
      </section>
      <section className="supplier-list-card">
        <h2>Supplier List</h2>
        <input className="supplier-search" aria-label="Search suppliers" placeholder="Search supplier, phone or address" value={search} onChange={(event) => setSearch(event.target.value)} />
        {loading ? <p>Loading suppliers…</p> : filtered.length === 0 ? <p>No suppliers found.</p> : <div className="supplier-table-wrap"><table className="supplier-table"><thead><tr><th>Name</th><th>Phone</th><th>Address</th><th>Status</th><th>Actions</th></tr></thead><tbody>{filtered.map((supplier) => <tr key={supplier.id}><td>{supplier.name}</td><td>{supplier.phone ?? '—'}</td><td>{supplier.address ?? '—'}</td><td><span className={supplier.is_active ? 'supplier-status' : 'supplier-status supplier-inactive'}>{supplier.is_active ? 'Active' : 'Inactive'}</span></td><td><div className="supplier-row-actions"><button className="supplier-secondary" onClick={() => startEdit(supplier)}>Edit</button><button className="supplier-secondary" onClick={() => void setActive(supplier, !supplier.is_active)}>{supplier.is_active ? 'Deactivate' : 'Reactivate'}</button></div></td></tr>)}</tbody></table></div>}
      </section>
    </main>
  );
}
