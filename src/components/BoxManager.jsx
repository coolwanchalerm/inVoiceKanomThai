import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Edit2, Box, X, Check } from 'lucide-react';
import { supabase } from '../supabaseClient';

export default function BoxManager() {
  const [boxes, setBoxes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);

  const [form, setForm] = useState({ name: '', capacity: 1, image_url: '', box_code: '' });

  useEffect(() => {
    fetchBoxes();
  }, []);

  const fetchBoxes = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('box_types').select('*').order('created_at', { ascending: false });
    if (!error && data) {
      setBoxes(data);
    }
    setLoading(false);
  };

  const suggestBoxCode = (cap, currentBoxes = boxes) => {
    const targetCapacity = Number(cap);
    const sameCapacityBoxes = currentBoxes.filter(b => b.capacity === targetCapacity && b.id !== editingId);
    
    let maxNum = 0;
    sameCapacityBoxes.forEach(b => {
      if (b.box_code && b.box_code.startsWith(`B${targetCapacity}-`)) {
        const parts = b.box_code.split('-');
        const num = parseInt(parts[parts.length - 1], 10);
        if (!isNaN(num) && num > maxNum) {
          maxNum = num;
        }
      }
    });
    
    return `B${targetCapacity}-${maxNum + 1}`;
  };

  const handleStartAdd = () => {
    const defaultCap = 1;
    const code = suggestBoxCode(defaultCap);
    setForm({ name: '', capacity: defaultCap, image_url: '', box_code: code });
    setIsAdding(true);
  };

  const handleCapacityChange = (val) => {
    const targetCap = Number(val);
    const code = suggestBoxCode(targetCap);
    setForm(prev => ({
      ...prev,
      capacity: targetCap,
      box_code: code
    }));
  };

  const handleSave = async () => {
    if (!form.name || !form.box_code) return;

    const payload = {
      name: form.name,
      capacity: Number(form.capacity),
      image_url: form.image_url,
      box_code: form.box_code
    };

    if (editingId) {
      const { error } = await supabase.from('box_types').update(payload).eq('id', editingId);
      if (error) {
        alert('บันทึกไม่สำเร็จ: ' + error.message);
        return;
      }
    } else {
      const { error } = await supabase.from('box_types').insert([payload]);
      if (error) {
        alert('บันทึกไม่สำเร็จ: ' + error.message);
        return;
      }
    }
    
    setIsAdding(false);
    setEditingId(null);
    setForm({ name: '', capacity: 1, image_url: '', box_code: '' });
    fetchBoxes();
  };

  const startEdit = (box) => {
    setEditingId(box.id);
    setForm({ 
      name: box.name, 
      capacity: box.capacity, 
      image_url: box.image_url || '', 
      box_code: box.box_code || suggestBoxCode(box.capacity) 
    });
    setIsAdding(true);
  };

  const handleDelete = async (id) => {
    if (confirm('ยืนยันการลบกล่อง?')) {
      await supabase.from('box_types').delete().eq('id', id);
      fetchBoxes();
    }
  };

  if (loading) return <div style={{ padding: '2rem', textAlign: 'center' }}>กำลังโหลดข้อมูลกล่อง...</div>;

  return (
    <div className="card" style={{ padding: '1.5rem', marginBottom: '2rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
          <Box size={24} /> จัดการรูปแบบกล่อง
        </h2>
        {!isAdding && (
          <button className="btn btn-primary" onClick={handleStartAdd}>
            <Plus size={18} /> เพิ่มกล่องใหม่
          </button>
        )}
      </div>

      {isAdding && (
        <div style={{ backgroundColor: '#f8fafc', padding: '1.5rem', borderRadius: '12px', marginBottom: '1.5rem', border: '1px solid #e2e8f0' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.25rem' }}>ชื่อกล่อง</label>
              <input type="text" value={form.name} onChange={e => setForm({...form, name: e.target.value})} style={{ width: '100%', padding: '0.5rem', borderRadius: '8px', border: '1px solid #cbd5e1' }} placeholder="เช่น กล่องใส 4 ช่อง" />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.25rem' }}>ความจุ (ชิ้น)</label>
              <input type="number" min="1" value={form.capacity} onChange={e => handleCapacityChange(e.target.value)} style={{ width: '100%', padding: '0.5rem', borderRadius: '8px', border: '1px solid #cbd5e1' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.25rem' }}>รหัสกล่อง</label>
              <input type="text" value={form.box_code} onChange={e => setForm({...form, box_code: e.target.value})} style={{ width: '100%', padding: '0.5rem', borderRadius: '8px', border: '1px solid #cbd5e1' }} placeholder="เช่น B1-1" />
            </div>
          </div>
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.25rem' }}>URL รูปภาพ (ถ้ามี)</label>
            <input type="text" value={form.image_url} onChange={e => setForm({...form, image_url: e.target.value})} style={{ width: '100%', padding: '0.5rem', borderRadius: '8px', border: '1px solid #cbd5e1' }} placeholder="https://..." />
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
            <button className="btn btn-secondary" onClick={() => { setIsAdding(false); setEditingId(null); setForm({ name: '', capacity: 1, image_url: '', box_code: '' }); }}><X size={16} /> ยกเลิก</button>
            <button className="btn btn-primary" onClick={handleSave}><Check size={16} /> บันทึก</button>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {boxes.map(box => (
          <div key={box.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px' }}>
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
              <div style={{ width: '60px', height: '60px', backgroundColor: '#f1f5f9', borderRadius: '8px', overflow: 'hidden' }}>
                {box.image_url ? (
                  <img src={box.image_url} alt={box.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#cbd5e1' }}><Box size={24} /></div>
                )}
              </div>
              <div>
                <div style={{ fontWeight: 'bold', fontSize: '1.1rem' }}>
                  {box.box_code ? <span style={{ color: '#db2777', marginRight: '0.5rem' }}>[{box.box_code}]</span> : ''}
                  {box.name}
                </div>
                <div style={{ color: '#64748b', fontSize: '0.85rem' }}>ความจุ: {box.capacity} ชิ้น</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button onClick={() => startEdit(box)} style={{ padding: '0.5rem', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', color: '#475569', cursor: 'pointer' }}><Edit2 size={16} /></button>
              <button onClick={() => handleDelete(box.id)} style={{ padding: '0.5rem', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', color: '#ef4444', cursor: 'pointer' }}><Trash2 size={16} /></button>
            </div>
          </div>
        ))}
        {boxes.length === 0 && !isAdding && (
          <div style={{ textAlign: 'center', color: '#94a3b8', padding: '2rem 0' }}>ยังไม่มีข้อมูลกล่อง</div>
        )}
      </div>
    </div>
  );
}
