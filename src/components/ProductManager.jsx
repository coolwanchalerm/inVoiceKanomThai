import React, { useState, useMemo } from 'react';
import { Package, Plus, Trash2, Edit2, Check, X, ChevronLeft, ChevronRight } from 'lucide-react';

export default function ProductManager({ products = [], onManageProduct }) {
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);
  
  const [newItem, setNewItem] = useState({ name: '', price: '' });
  const [editItem, setEditItem] = useState({ name: '', price: '' });

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  
  const totalPages = Math.ceil(products.length / itemsPerPage);

  const paginatedProducts = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return products.slice(startIndex, startIndex + itemsPerPage);
  }, [products, currentPage]);

  const handleAdd = () => {
    if (!newItem.name || newItem.price === '') return;
    onManageProduct('add', { name: newItem.name, price: Number(newItem.price) });
    setNewItem({ name: '', price: '' });
    setIsAdding(false);
  };

  const startEdit = (product) => {
    setEditingId(product.id);
    setEditItem({ name: product.name, price: product.price });
  };

  const saveEdit = () => {
    if (!editItem.name || editItem.price === '') return;
    onManageProduct('edit', { id: editingId, name: editItem.name, price: Number(editItem.price) });
    setEditingId(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
  };

  const handleDelete = (id) => {
    onManageProduct('delete', { id });
  };

  return (
    <div className="card">
      <h2 className="card-title">
        <Package className="text-primary" /> 
        จัดการรายการสินค้า
      </h2>

      <div style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'flex-end' }}>
        {!isAdding && (
          <button className="btn btn-primary" onClick={() => setIsAdding(true)}>
            <Plus size={18} /> เพิ่มสินค้าใหม่
          </button>
        )}
      </div>

      <div className="recent-table-wrapper" style={{ overflowX: 'auto' }}>
        <table className="recent-table">
          <thead>
            <tr>
              <th style={{ width: '60%' }}>ชื่อสินค้า</th>
              <th style={{ width: '20%', textAlign: 'center' }}>ราคา (บาท)</th>
              <th style={{ width: '20%', textAlign: 'center' }}>จัดการ</th>
            </tr>
          </thead>
          <tbody>
            {isAdding && (
              <tr style={{ backgroundColor: '#f8fafc' }}>
                <td>
                  <input 
                    type="text" 
                    value={newItem.name} 
                    onChange={e => setNewItem({...newItem, name: e.target.value})}
                    placeholder="ชื่อสินค้า..."
                    style={{ width: '100%' }}
                    autoFocus
                  />
                </td>
                <td>
                  <input 
                    type="number" 
                    value={newItem.price} 
                    onChange={e => setNewItem({...newItem, price: e.target.value})}
                    placeholder="0"
                    style={{ width: '100%', textAlign: 'center' }}
                  />
                </td>
                <td style={{ textAlign: 'center' }}>
                  <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                    <button className="btn" style={{ padding: '0.4rem', backgroundColor: 'var(--success)', color: 'white' }} onClick={handleAdd}>
                      <Check size={16} />
                    </button>
                    <button className="btn" style={{ padding: '0.4rem', backgroundColor: '#e2e8f0', color: 'var(--text-main)' }} onClick={() => setIsAdding(false)}>
                      <X size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            )}

            {products.length === 0 && !isAdding ? (
              <tr>
                <td colspan="3" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                  ยังไม่มีรายการสินค้า
                </td>
              </tr>
            ) : (
              paginatedProducts.map(product => (
                <tr key={product.id}>
                  {editingId === product.id ? (
                    <>
                      <td>
                        <input 
                          type="text" 
                          value={editItem.name} 
                          onChange={e => setEditItem({...editItem, name: e.target.value})}
                          style={{ width: '100%' }}
                          autoFocus
                        />
                      </td>
                      <td>
                        <input 
                          type="number" 
                          value={editItem.price} 
                          onChange={e => setEditItem({...editItem, price: e.target.value})}
                          style={{ width: '100%', textAlign: 'center' }}
                        />
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                          <button className="btn" style={{ padding: '0.4rem', backgroundColor: 'var(--success)', color: 'white' }} onClick={saveEdit}>
                            <Check size={16} />
                          </button>
                          <button className="btn" style={{ padding: '0.4rem', backgroundColor: '#e2e8f0', color: 'var(--text-main)' }} onClick={cancelEdit}>
                            <X size={16} />
                          </button>
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
                      <td>{product.name}</td>
                      <td style={{ textAlign: 'center' }}>{product.price}</td>
                      <td style={{ textAlign: 'center' }}>
                        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                          <button className="btn btn-outline" style={{ padding: '0.3rem 0.6rem', color: 'var(--primary-color)', minHeight: 'unset' }} onClick={() => startEdit(product)}>
                            <Edit2 size={14} />
                          </button>
                          <button className="btn btn-outline" style={{ padding: '0.3rem 0.6rem', color: 'var(--danger)', borderColor: 'transparent', minHeight: 'unset' }} onClick={() => handleDelete(product.id)}>
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
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
