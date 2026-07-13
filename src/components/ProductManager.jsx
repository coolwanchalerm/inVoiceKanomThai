import React, { useState, useMemo } from 'react';
import { Package, Plus, Trash2, Edit2, Check, X, ChevronLeft, ChevronRight } from 'lucide-react';

export default function ProductManager({ products = [], onManageProduct }) {
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);
  
  const [newItem, setNewItem] = useState({ name: '', price: '', hasPromotion: false, promoQty: '', promoPrice: '' });
  const [editItem, setEditItem] = useState({ name: '', price: '', hasPromotion: false, promoQty: '', promoPrice: '' });

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  
  const totalPages = Math.ceil(products.length / itemsPerPage);

  const paginatedProducts = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return products.slice(startIndex, startIndex + itemsPerPage);
  }, [products, currentPage]);

  const handleAdd = () => {
    if (!newItem.name || newItem.price === '') return;
    onManageProduct('add', { 
      name: newItem.name, 
      price: Number(newItem.price),
      hasPromotion: newItem.hasPromotion,
      promoQty: Number(newItem.promoQty),
      promoPrice: Number(newItem.promoPrice)
    });
    setNewItem({ name: '', price: '', hasPromotion: false, promoQty: '', promoPrice: '' });
    setIsAdding(false);
  };

  const startEdit = (product) => {
    setEditingId(product.id);
    setEditItem({ 
      name: product.name, 
      price: product.price,
      hasPromotion: product.hasPromotion || false,
      promoQty: product.promoQty || '',
      promoPrice: product.promoPrice || ''
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
      promoPrice: Number(editItem.promoPrice)
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
    <div className="card" style={{ padding: '1.5rem', marginBottom: '100px' }}>
      <div style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'flex-end' }}>
        {!isAdding && (
          <button className="btn btn-primary" onClick={() => setIsAdding(true)}>
            <Plus size={18} /> เพิ่มสินค้าใหม่
          </button>
        )}
      </div>

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
            <div style={{ display: 'flex', gap: '1rem' }}>
              <div style={{ flex: 2 }}>
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
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '0.25rem' }}>ราคา (บาท)</div>
                <input 
                  type="number" 
                  value={newItem.price} 
                  onChange={e => setNewItem({...newItem, price: e.target.value})}
                  placeholder="0"
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '8px', border: '1px solid #cbd5e1', textAlign: 'center', outline: 'none' }}
                />
              </div>
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
                  <div style={{ display: 'flex', gap: '1rem' }}>
                    <div style={{ flex: 2 }}>
                      <div style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '0.25rem' }}>ชื่อสินค้า</div>
                      <input 
                        type="text" 
                        value={editItem.name} 
                        onChange={e => setEditItem({...editItem, name: e.target.value})}
                        style={{ width: '100%', padding: '0.5rem', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none' }}
                        autoFocus
                      />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '0.25rem' }}>ราคา (บาท)</div>
                      <input 
                        type="number" 
                        value={editItem.price} 
                        onChange={e => setEditItem({...editItem, price: e.target.value})}
                        style={{ width: '100%', padding: '0.5rem', borderRadius: '8px', border: '1px solid #cbd5e1', textAlign: 'center', outline: 'none' }}
                      />
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
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: '#ebf2ef', display: 'flex', justifyContent: 'center', alignItems: 'center', color: 'var(--primary-color)', flexShrink: 0 }}>
                      <Package size={20} />
                    </div>
                    <div>
                      <div style={{ fontSize: '1.05rem', fontWeight: '700', color: '#1e293b', marginBottom: '2px' }}>{product.name}</div>
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
  );
}
