import React, { useState, useMemo, useRef } from 'react';
import { Package, Plus, Trash2, Edit2, Check, X, ChevronLeft, ChevronRight, Box, Layers, Search, Upload, Image as ImageIcon } from 'lucide-react';
import BoxManager from './BoxManager';
import SetManager from './SetManager';
import { supabase } from '../supabaseClient';
import { optimizeImage } from '../utils/imageOptimizer';

export default function ProductManager({ products = [], onManageProduct }) {
  const [activeTab, setActiveTab] = useState('products');
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);
  
  const [newItem, setNewItem] = useState({ name: '', price: '', hasPromotion: false, promoQty: '', promoPrice: '', category: 'dessert', image_url: '' });
  const [editItem, setEditItem] = useState({ name: '', price: '', hasPromotion: false, promoQty: '', promoPrice: '', category: 'dessert', image_url: '' });

  const [searchQuery, setSearchQuery] = useState('');
  const [uploading, setUploading] = useState(false);
  const newImageRef = useRef(null);
  const editImageRef = useRef(null);

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const filteredProducts = useMemo(() => {
    if (!searchQuery.trim()) return products;
    const q = searchQuery.trim().toLowerCase();
    return products.filter(p => p.name.toLowerCase().includes(q));
  }, [products, searchQuery]);
  
  const totalPages = Math.ceil(filteredProducts.length / itemsPerPage);

  const paginatedProducts = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredProducts.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredProducts, currentPage]);

  const uploadImage = async (file) => {
    setUploading(true);
    try {
      const optimized = await optimizeImage(file, 400, 400, 0.8);
      const fileName = `products/${Date.now()}_${optimized.name}`;
      const { data, error } = await supabase.storage.from('images').upload(fileName, optimized);
      if (error) throw error;
      const { data: urlData } = supabase.storage.from('images').getPublicUrl(fileName);
      return urlData.publicUrl;
    } catch (err) {
      console.error('Upload failed:', err);
      alert('อัปโหลดรูปไม่สำเร็จ: ' + err.message);
      return null;
    } finally {
      setUploading(false);
    }
  };

  const handleAdd = () => {
    if (!newItem.name || newItem.price === '') return;
    onManageProduct('add', { 
      name: newItem.name, 
      price: Number(newItem.price),
      hasPromotion: newItem.hasPromotion,
      promoQty: Number(newItem.promoQty),
      promoPrice: Number(newItem.promoPrice),
      category: newItem.category,
      image_url: newItem.image_url || null
    });
    setNewItem({ name: '', price: '', hasPromotion: false, promoQty: '', promoPrice: '', category: 'dessert', image_url: '' });
    setIsAdding(false);
  };

  const startEdit = (product) => {
    setEditingId(product.id);
    setEditItem({ 
      name: product.name, 
      price: product.price,
      hasPromotion: product.hasPromotion || false,
      promoQty: product.promoQty || '',
      promoPrice: product.promoPrice || '',
      category: product.category || 'dessert',
      image_url: product.image_url || ''
    });
  };

  const saveEdit = () => {
    if (!editItem.name || editItem.price === '') return;
    onManageProduct('edit', { 
      id: editingId, 
      name: editItem.name, 
      price: Number(editItem.price),
      hasPromotion: editItem.hasPromotion,
      promoQty: Number(editItem.promoQty),
      promoPrice: Number(editItem.promoPrice),
      category: editItem.category,
      image_url: editItem.image_url || null
    });
    setEditingId(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
  };

  const handleDelete = (id) => {
    onManageProduct('delete', { id });
  };

  return (
    <div>
      {/* Tabs */}
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', overflowX: 'auto', paddingBottom: '0.5rem', whiteSpace: 'nowrap' }}>
        <button 
          onClick={() => setActiveTab('products')}
          style={{ padding: '0.75rem 1.5rem', borderRadius: '12px', border: 'none', background: activeTab === 'products' ? '#1e3a2b' : '#fff', color: activeTab === 'products' ? '#fff' : '#64748b', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', boxShadow: activeTab === 'products' ? '0 4px 12px rgba(30, 58, 43, 0.2)' : '0 2px 4px rgba(0,0,0,0.02)' }}
        >
          <Package size={18} /> รายการขนม
        </button>
        <button 
          onClick={() => setActiveTab('boxes')}
          style={{ padding: '0.75rem 1.5rem', borderRadius: '12px', border: 'none', background: activeTab === 'boxes' ? '#1e3a2b' : '#fff', color: activeTab === 'boxes' ? '#fff' : '#64748b', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', boxShadow: activeTab === 'boxes' ? '0 4px 12px rgba(30, 58, 43, 0.2)' : '0 2px 4px rgba(0,0,0,0.02)' }}
        >
          <Box size={18} /> รูปแบบกล่อง
        </button>
        <button 
          onClick={() => setActiveTab('sets')}
          style={{ padding: '0.75rem 1.5rem', borderRadius: '12px', border: 'none', background: activeTab === 'sets' ? '#1e3a2b' : '#fff', color: activeTab === 'sets' ? '#fff' : '#64748b', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', boxShadow: activeTab === 'sets' ? '0 4px 12px rgba(30, 58, 43, 0.2)' : '0 2px 4px rgba(0,0,0,0.02)' }}
        >
          <Layers size={18} /> จัดการเซ็ตราคา
        </button>
      </div>

      {activeTab === 'products' && (
        <div className="card" style={{ padding: '1.5rem', marginBottom: '100px' }}>
          {/* Search & Add */}
          <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: '200px', position: 'relative' }}>
              <Search size={16} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
              <input 
                type="text" 
                placeholder="ค้นหาชื่อขนม..." 
                value={searchQuery} 
                onChange={e => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                style={{ width: '100%', padding: '0.6rem 0.75rem 0.6rem 2.25rem', borderRadius: '10px', border: '1px solid #cbd5e1', outline: 'none', fontSize: '0.9rem' }}
              />
            </div>
            {!isAdding && (
              <button className="btn btn-primary" onClick={() => setIsAdding(true)} style={{ whiteSpace: 'nowrap' }}>
                <Plus size={18} /> เพิ่มสินค้าใหม่
              </button>
            )}
          </div>
          {searchQuery && (
            <div style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '1rem' }}>
              พบ {filteredProducts.length} รายการ จากทั้งหมด {products.length} รายการ
            </div>
          )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {isAdding && (
          <div style={{ 
            backgroundColor: '#f8fafc', 
            borderRadius: '16px', 
            padding: '1.25rem', 
            border: '1px solid #e2e8f0',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem'
          }}>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '1rem' }}>
              <div>
                <div style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '0.25rem' }}>ชื่อสินค้า</div>
                <input 
                  type="text" 
                  value={newItem.name} 
                  onChange={e => setNewItem({...newItem, name: e.target.value})}
                  placeholder="ชื่อสินค้า..."
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none' }}
                  autoFocus
                />
              </div>
              <div>
                <div style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '0.25rem' }}>ราคา (บาท)</div>
                <input 
                  type="number" 
                  value={newItem.price} 
                  onChange={e => setNewItem({...newItem, price: e.target.value})}
                  placeholder="0"
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '8px', border: '1px solid #cbd5e1', textAlign: 'center', outline: 'none' }}
                />
              </div>
              <div>
                <div style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '0.25rem' }}>ประเภท</div>
                <select 
                  value={newItem.category} 
                  onChange={e => setNewItem({...newItem, category: e.target.value})}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none' }}
                >
                  <option value="dessert">ขนม</option>
                  <option value="drink">เครื่องดื่ม</option>
                </select>
              </div>
            </div>

            {/* Image Input */}
            <div>
              <div style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '0.25rem' }}>รูปสินค้า (วาง URL หรืออัปโหลด)</div>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <input 
                  type="text" 
                  value={newItem.image_url} 
                  onChange={e => setNewItem({...newItem, image_url: e.target.value})}
                  placeholder="https://... หรือกดอัปโหลด →"
                  style={{ flex: 1, padding: '0.5rem', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none', fontSize: '0.85rem' }}
                />
                <input type="file" accept="image/*" ref={newImageRef} style={{ display: 'none' }} onChange={async (e) => {
                  const file = e.target.files[0];
                  if (!file) return;
                  const url = await uploadImage(file);
                  if (url) setNewItem(prev => ({ ...prev, image_url: url }));
                  e.target.value = '';
                }} />
                <button 
                  onClick={() => newImageRef.current?.click()} 
                  disabled={uploading}
                  style={{ padding: '0.5rem 0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.85rem', color: '#475569', whiteSpace: 'nowrap' }}
                >
                  <Upload size={14} /> {uploading ? 'กำลัง...' : 'อัปโหลด'}
                </button>
              </div>
              {newItem.image_url && (
                <div style={{ marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <img src={newItem.image_url} alt="preview" style={{ width: '48px', height: '48px', borderRadius: '8px', objectFit: 'cover', border: '1px solid #e2e8f0' }} />
                  <button onClick={() => setNewItem({...newItem, image_url: ''})} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '0.8rem' }}>ลบรูป</button>
                </div>
              )}
            </div>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <input 
                type="checkbox" 
                id="newHasPromo"
                checked={newItem.hasPromotion}
                onChange={e => setNewItem({...newItem, hasPromotion: e.target.checked})}
              />
              <label htmlFor="newHasPromo" style={{ fontSize: '0.85rem', color: '#1e293b' }}>จัดโปรโมชั่นเซ็ต (เช่น ซื้อหลายชิ้นราคาพิเศษ)</label>
            </div>
            
            {newItem.hasPromotion && (
              <div style={{ display: 'flex', gap: '1rem', padding: '1rem', backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '0.25rem' }}>จำนวนชิ้น/เซ็ต</div>
                  <input type="number" min="2" placeholder="เช่น 3" value={newItem.promoQty} onChange={e => setNewItem({...newItem, promoQty: e.target.value})} style={{ width: '100%', padding: '0.5rem', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none' }} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '0.25rem' }}>ราคาโปรโมชั่น (บาท)</div>
                  <input type="number" min="0" placeholder="เช่น 100" value={newItem.promoPrice} onChange={e => setNewItem({...newItem, promoPrice: e.target.value})} style={{ width: '100%', padding: '0.5rem', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none' }} />
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <button 
                onClick={() => setIsAdding(false)}
                style={{ padding: '0.5rem 1rem', borderRadius: '8px', border: 'none', backgroundColor: '#f1f5f9', color: '#64748b', fontWeight: '500', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <X size={16} /> ยกเลิก
              </button>
              <button 
                onClick={handleAdd}
                style={{ padding: '0.5rem 1rem', borderRadius: '8px', border: 'none', backgroundColor: 'var(--success)', color: 'white', fontWeight: '500', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <Check size={16} /> บันทึก
              </button>
            </div>
          </div>
        )}

        {products.length === 0 && !isAdding ? (
          <div style={{ textAlign: 'center', padding: '3rem 1rem', color: '#94a3b8', backgroundColor: '#f8fafc', borderRadius: '16px', border: '1px dashed #cbd5e1' }}>
            <Package size={48} style={{ margin: '0 auto 1rem', opacity: 0.5 }} />
            <div style={{ fontSize: '1.1rem', fontWeight: '500', color: '#64748b' }}>ยังไม่มีรายการสินค้า</div>
            <div style={{ fontSize: '0.9rem', marginTop: '0.5rem' }}>กดปุ่ม "เพิ่มสินค้าใหม่" เพื่อเริ่มต้น</div>
          </div>
        ) : (
          paginatedProducts.map(product => (
            <div key={product.id} style={{ 
              backgroundColor: editingId === product.id ? '#f8fafc' : '#ffffff', 
              borderRadius: '16px', 
              padding: '1.25rem', 
              border: '1px solid #e2e8f0',
              boxShadow: editingId === product.id ? 'none' : '0 2px 4px rgba(0,0,0,0.02)',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem'
            }}>
              {editingId === product.id ? (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '1rem' }}>
                    <div>
                      <div style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '0.25rem' }}>ชื่อสินค้า</div>
                      <input 
                        type="text" 
                        value={editItem.name} 
                        onChange={e => setEditItem({...editItem, name: e.target.value})}
                        style={{ width: '100%', padding: '0.5rem', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none' }}
                        autoFocus
                      />
                    </div>
                    <div>
                      <div style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '0.25rem' }}>ราคา (บาท)</div>
                      <input 
                        type="number" 
                        value={editItem.price} 
                        onChange={e => setEditItem({...editItem, price: e.target.value})}
                        style={{ width: '100%', padding: '0.5rem', borderRadius: '8px', border: '1px solid #cbd5e1', textAlign: 'center', outline: 'none' }}
                      />
                    </div>
                    <div>
                      <div style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '0.25rem' }}>ประเภท</div>
                      <select 
                        value={editItem.category} 
                        onChange={e => setEditItem({...editItem, category: e.target.value})}
                        style={{ width: '100%', padding: '0.5rem', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none' }}
                      >
                        <option value="dessert">ขนม</option>
                        <option value="drink">เครื่องดื่ม</option>
                      </select>
                    </div>

                    {/* Image Input for Edit */}
                    <div style={{ gridColumn: '1 / -1' }}>
                      <div style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '0.25rem' }}>รูปสินค้า</div>
                      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        <input 
                          type="text" 
                          value={editItem.image_url} 
                          onChange={e => setEditItem({...editItem, image_url: e.target.value})}
                          placeholder="https://... หรือกดอัปโหลด →"
                          style={{ flex: 1, padding: '0.5rem', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none', fontSize: '0.85rem' }}
                        />
                        <input type="file" accept="image/*" ref={editImageRef} style={{ display: 'none' }} onChange={async (e) => {
                          const file = e.target.files[0];
                          if (!file) return;
                          const url = await uploadImage(file);
                          if (url) setEditItem(prev => ({ ...prev, image_url: url }));
                          e.target.value = '';
                        }} />
                        <button 
                          onClick={() => editImageRef.current?.click()} 
                          disabled={uploading}
                          style={{ padding: '0.5rem 0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.85rem', color: '#475569', whiteSpace: 'nowrap' }}
                        >
                          <Upload size={14} /> {uploading ? 'กำลัง...' : 'อัปโหลด'}
                        </button>
                      </div>
                      {editItem.image_url && (
                        <div style={{ marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <img src={editItem.image_url} alt="preview" style={{ width: '48px', height: '48px', borderRadius: '8px', objectFit: 'cover', border: '1px solid #e2e8f0' }} />
                          <button onClick={() => setEditItem({...editItem, image_url: ''})} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '0.8rem' }}>ลบรูป</button>
                        </div>
                      )}
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <input 
                      type="checkbox" 
                      id={`editHasPromo-${product.id}`}
                      checked={editItem.hasPromotion}
                      onChange={e => setEditItem({...editItem, hasPromotion: e.target.checked})}
                    />
                    <label htmlFor={`editHasPromo-${product.id}`} style={{ fontSize: '0.85rem', color: '#1e293b' }}>จัดโปรโมชั่นเซ็ต</label>
                  </div>

                  {editItem.hasPromotion && (
                    <div style={{ display: 'flex', gap: '1rem', padding: '1rem', backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '0.25rem' }}>จำนวนชิ้น/เซ็ต</div>
                        <input type="number" min="2" placeholder="เช่น 3" value={editItem.promoQty} onChange={e => setEditItem({...editItem, promoQty: e.target.value})} style={{ width: '100%', padding: '0.5rem', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none' }} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '0.25rem' }}>ราคาโปรโมชั่น (บาท)</div>
                        <input type="number" min="0" placeholder="เช่น 100" value={editItem.promoPrice} onChange={e => setEditItem({...editItem, promoPrice: e.target.value})} style={{ width: '100%', padding: '0.5rem', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none' }} />
                      </div>
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                    <button 
                      onClick={cancelEdit}
                      style={{ padding: '0.5rem 1rem', borderRadius: '8px', border: 'none', backgroundColor: '#f1f5f9', color: '#64748b', fontWeight: '500', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      <X size={16} /> ยกเลิก
                    </button>
                    <button 
                      onClick={saveEdit}
                      style={{ padding: '0.5rem 1rem', borderRadius: '8px', border: 'none', backgroundColor: 'var(--success)', color: 'white', fontWeight: '500', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      <Check size={16} /> บันทึก
                    </button>
                  </div>
                </>
              ) : (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div style={{ width: '44px', height: '44px', borderRadius: '10px', backgroundColor: '#f1f5f9', display: 'flex', justifyContent: 'center', alignItems: 'center', flexShrink: 0, overflow: 'hidden' }}>
                      {product.image_url ? (
                        <img src={product.image_url} alt={product.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        <Package size={20} style={{ color: 'var(--primary-color)' }} />
                      )}
                    </div>
                    <div>
                      <div style={{ fontSize: '1.05rem', fontWeight: '700', color: '#1e293b', marginBottom: '2px' }}>
                        {product.name}
                        <span style={{ marginLeft: '8px', fontSize: '0.75rem', backgroundColor: product.category === 'drink' ? '#e0f2fe' : '#f0fdf4', color: product.category === 'drink' ? '#0369a1' : '#15803d', padding: '0.1rem 0.4rem', borderRadius: '12px' }}>
                          {product.category === 'drink' ? 'เครื่องดื่ม' : 'ขนม'}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.85rem', color: 'var(--primary-color)', fontWeight: '600' }}>
                        ฿{product.price}
                        {product.hasPromotion && (
                          <span style={{ marginLeft: '8px', fontSize: '0.75rem', backgroundColor: '#fefce8', color: '#ca8a04', padding: '0.1rem 0.4rem', borderRadius: '12px', border: '1px solid #fef08a' }}>
                            โปรฯ {product.promoQty} กล่อง {product.promoPrice}฿
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button 
                      onClick={() => startEdit(product)}
                      title="แก้ไขสินค้า"
                      style={{ color: '#64748b', background: 'none', border: 'none', cursor: 'pointer', padding: '0.4rem', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '8px', backgroundColor: '#f1f5f9' }}>
                      <Edit2 size={16} />
                    </button>
                    <button 
                      onClick={() => handleDelete(product.id)}
                      title="ลบสินค้า"
                      style={{ color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', padding: '0.4rem', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '8px', backgroundColor: '#fef2f2' }}>
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '1rem', marginTop: '1.5rem' }}>
          <button 
            className="btn btn-outline" 
            style={{ padding: '0.4rem', minHeight: 'unset' }}
            disabled={currentPage === 1}
            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
          >
            <ChevronLeft size={18} />
          </button>
          
          <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
            หน้า {currentPage} จาก {totalPages}
          </span>

          <button 
            className="btn btn-outline" 
            style={{ padding: '0.4rem', minHeight: 'unset' }}
            disabled={currentPage === totalPages}
            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
          >
            <ChevronRight size={18} />
          </button>
        </div>
      )}
        </div>
      )}

      {activeTab === 'boxes' && <BoxManager />}
      {activeTab === 'sets' && <SetManager />}
    </div>
  );
}
