import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Edit2, Layers } from 'lucide-react';
import { supabase } from '../supabaseClient';

export default function SetManager() {
  const [sets, setSets] = useState([]);
  const [boxes, setBoxes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);

  const [form, setForm] = useState({ name: '', set_price: '', dessert_qty: 1, drink_qty: 0, allowed_boxes: [], allowed_dessert_max_price: 10 });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    const [setsRes, boxesRes] = await Promise.all([
      supabase.from('price_sets').select('*').order('set_price', { ascending: true }),
      supabase.from('box_types').select('*').order('capacity', { ascending: true })
    ]);
    
    if (!setsRes.error) setSets(setsRes.data);
    if (!boxesRes.error) setBoxes(boxesRes.data);
    
    setLoading(false);
  };

  const handleSave = async () => {
    if (!form.name || form.set_price === '') return;

    const payload = {
      name: form.name,
      set_price: Number(form.set_price),
      dessert_qty: Number(form.dessert_qty),
      drink_qty: Number(form.drink_qty || 0),
      allowed_boxes: form.allowed_boxes, // This is an array of UUIDs
      allowed_dessert_max_price: Number(form.allowed_dessert_max_price)
    };

    if (editingId) {
      await supabase.from('price_sets').update(payload).eq('id', editingId);
    } else {
      await supabase.from('price_sets').insert([payload]);
    }
    
    setIsAdding(false);
    setEditingId(null);
    setForm({ name: '', set_price: '', dessert_qty: 1, drink_qty: 0, allowed_boxes: [], allowed_dessert_max_price: 10 });
    fetchData();
  };

  const startEdit = (set) => {
    setEditingId(set.id);
    setForm({ 
      name: set.name, 
      set_price: set.set_price, 
      dessert_qty: set.dessert_qty, 
      drink_qty: set.drink_qty || 0,
      allowed_boxes: set.allowed_boxes || [],
      allowed_dessert_max_price: set.allowed_dessert_max_price
    });
    setIsAdding(true);
  };

  const handleDelete = async (id) => {
    if (confirm('ยืนยันการลบเซ็ตนี้?')) {
      await supabase.from('price_sets').delete().eq('id', id);
      fetchData();
    }
  };

  const toggleBox = (boxId) => {
    setForm(prev => {
      const isSelected = prev.allowed_boxes.includes(boxId);
      if (isSelected) {
        return { ...prev, allowed_boxes: prev.allowed_boxes.filter(id => id !== boxId) };
      } else {
        return { ...prev, allowed_boxes: [...prev.allowed_boxes, boxId] };
      }
    });
  };

  if (loading) return <div style={{ padding: '2rem', textAlign: 'center' }}>กำลังโหลดข้อมูลเซ็ต...</div>;

  return (
    <div className="card" style={{ padding: '1.5rem', marginBottom: '2rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
          <Layers size={24} /> จัดการเซ็ตราคา
        </h2>
        {!isAdding && (
          <button className="btn btn-primary" onClick={() => setIsAdding(true)}>
            <Plus size={18} /> สร้างเซ็ตใหม่
          </button>
        )}
      </div>

      {isAdding && (
        <div style={{ backgroundColor: '#f8fafc', padding: '1.5rem', borderRadius: '12px', marginBottom: '1.5rem', border: '1px solid #e2e8f0' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.25rem' }}>ชื่อเซ็ต</label>
              <input type="text" value={form.name} onChange={e => setForm({...form, name: e.target.value})} style={{ width: '100%', padding: '0.5rem', borderRadius: '8px', border: '1px solid #cbd5e1' }} placeholder="เช่น เซ็ตมินิ 10 บาท" />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.25rem' }}>ราคาขาย (บาท)</label>
              <input type="number" value={form.set_price} onChange={e => setForm({...form, set_price: e.target.value})} style={{ width: '100%', padding: '0.5rem', borderRadius: '8px', border: '1px solid #cbd5e1' }} />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.25rem' }}>จำนวนขนมที่ลูกค้าเลือกได้ (ชิ้น)</label>
              <input type="number" min="1" value={form.dessert_qty} onChange={e => setForm({...form, dessert_qty: e.target.value})} style={{ width: '100%', padding: '0.5rem', borderRadius: '8px', border: '1px solid #cbd5e1' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.25rem' }}>จำนวนเครื่องดื่มที่ลูกค้าเลือกได้ (ขวด)</label>
              <input type="number" min="0" value={form.drink_qty} onChange={e => setForm({...form, drink_qty: e.target.value})} style={{ width: '100%', padding: '0.5rem', borderRadius: '8px', border: '1px solid #cbd5e1' }} />
            </div>
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1rem', marginBottom: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.25rem' }}>จำกัดราคาขนมสูงสุด (บาท/ชิ้น)</label>
              <input type="number" value={form.allowed_dessert_max_price} onChange={e => setForm({...form, allowed_dessert_max_price: e.target.value})} style={{ width: '100%', padding: '0.5rem', borderRadius: '8px', border: '1px solid #cbd5e1' }} />
            </div>
          </div>
          
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>รูปแบบกล่องที่อนุญาตสำหรับเซ็ตนี้</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
              {boxes.map(box => {
                const isSelected = form.allowed_boxes.includes(box.id);
                return (
                  <div 
                    key={box.id} 
                    onClick={() => toggleBox(box.id)}
                    style={{
                      padding: '0.5rem 1rem',
                      borderRadius: '20px',
                      border: isSelected ? '2px solid #db2777' : '1px solid #cbd5e1',
                      backgroundColor: isSelected ? '#fdf2f8' : '#fff',
                      color: isSelected ? '#db2777' : '#475569',
                      cursor: 'pointer',
                      fontSize: '0.85rem',
                      userSelect: 'none'
                    }}
                  >
                    {box.name} (จุ {box.capacity})
                  </div>
                );
              })}
              {boxes.length === 0 && <span style={{ color: '#ef4444', fontSize: '0.85rem' }}>กรุณาสร้างกล่องก่อน</span>}
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
            <button className="btn btn-secondary" onClick={() => { setIsAdding(false); setEditingId(null); setForm({ name: '', set_price: '', dessert_qty: 1, drink_qty: 0, allowed_boxes: [], allowed_dessert_max_price: 10 }); }}>ยกเลิก</button>
            <button className="btn btn-primary" onClick={handleSave}>บันทึกเซ็ต</button>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {sets.map(set => (
          <div key={set.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px' }}>
            <div>
              <div style={{ fontWeight: 'bold', fontSize: '1.1rem', color: '#db2777' }}>{set.name} - {set.set_price}฿</div>
              <div style={{ color: '#64748b', fontSize: '0.85rem', marginTop: '0.25rem' }}>
                ได้ขนม {set.dessert_qty} ชิ้น {set.drink_qty > 0 ? `+ เครื่องดื่ม ${set.drink_qty} ขวด ` : ''}(ราคาสูงสุด {set.allowed_dessert_max_price}฿)
              </div>
              <div style={{ display: 'flex', gap: '0.25rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
                {(set.allowed_boxes || []).map(boxId => {
                  const b = boxes.find(x => x.id === boxId);
                  return b ? (
                    <span key={boxId} style={{ backgroundColor: '#f1f5f9', padding: '2px 8px', borderRadius: '4px', fontSize: '0.75rem', color: '#475569' }}>
                      {b.name}
                    </span>
                  ) : null;
                })}
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button onClick={() => startEdit(set)} style={{ padding: '0.5rem', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', color: '#475569', cursor: 'pointer' }}><Edit2 size={16} /></button>
              <button onClick={() => handleDelete(set.id)} style={{ padding: '0.5rem', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', color: '#ef4444', cursor: 'pointer' }}><Trash2 size={16} /></button>
            </div>
          </div>
        ))}
        {sets.length === 0 && !isAdding && (
          <div style={{ textAlign: 'center', color: '#94a3b8', padding: '2rem 0' }}>ยังไม่มีข้อมูลเซ็ตราคา</div>
        )}
      </div>
    </div>
  );
}
