import React, { useState } from 'react';
import { Plus, Trash2, Printer, ClipboardCheck, AlertCircle, Package, Tag } from 'lucide-react';
import { getThaiBahtText } from '../utils/thaiBaht';
import { cleanNumberInput, handleNumberFocus } from '../utils/numberInput';

export default function InvoiceGenerator({ onSubmitInvoice, products = [], topProducts = [], customers = [], invoiceToEdit = null, onCancelEdit }) {
  const [customerName, setCustomerName] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  
  // Computed suggestions based on input
  const filteredCustomers = React.useMemo(() => {
    if (!customerName) return [];
    return customers.filter(c => 
      c.name.toLowerCase().includes(customerName.toLowerCase()) && c.name !== customerName
    );
  }, [customerName, customers]);

  // Default date to current local Thai date format
  const getTodayThaiDate = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const [date, setDate] = useState(getTodayThaiDate());
  const [customerAddress, setCustomerAddress] = useState('');
  const [customerTaxId, setCustomerTaxId] = useState('');
  const [items, setItems] = useState([]);

  React.useEffect(() => {
    if (invoiceToEdit) {
      setCustomerName(invoiceToEdit.customerName || '');
      setDate(invoiceToEdit.date || getTodayThaiDate());
      setCustomerAddress(invoiceToEdit.customerAddress || '');
      setCustomerTaxId(invoiceToEdit.customerTaxId || '');
      // Filter out auto-calculated promo discounts so computedDiscounts doesn't duplicate them
      const regularItems = (invoiceToEdit.items || []).filter(item => !item.description?.startsWith('ส่วนลดโปรโมชั่น'));
      setItems(regularItems);
    } else {
      setCustomerName('');
      setDate(getTodayThaiDate());
      setCustomerAddress('');
      setCustomerTaxId('');
      setItems([]);
    }
  }, [invoiceToEdit]);

  const [newItem, setNewItem] = useState({ description: '', quantity: 1, unitPrice: '' });

  const handleItemChange = (id, field, value) => {
    const cleanedValue = (field === 'quantity' || field === 'unitPrice') ? cleanNumberInput(value) : value;
    setItems(items.map(item => {
      if (item.id === id) {
        const updated = { ...item, [field]: cleanedValue };
        if (field === 'quantity' || field === 'unitPrice') {
          const qty = field === 'quantity' ? (Number(cleanedValue) || 0) : (Number(item.quantity) || 0);
          const price = field === 'unitPrice' ? (Number(cleanedValue) || 0) : (Number(item.unitPrice) || 0);
          updated.amount = qty * price;
        }
        return updated;
      }
      return item;
    }));
  };

  const addItem = () => {
    if (!newItem.description || !newItem.description.trim()) {
      alert('กรุณาระบุชื่อสินค้า หรือส่วนลด');
      return;
    }
    const qty = Number(newItem.quantity) || 1;
    let price = Number(newItem.unitPrice) || 0;

    // If description starts with ส่วนลด and price is positive, convert to negative
    if (newItem.description.trim().startsWith('ส่วนลด') && price > 0) {
      price = -Math.abs(price);
    }

    const item = {
      id: Date.now(),
      description: newItem.description.trim(),
      quantity: qty,
      unitPrice: price,
      amount: qty * price
    };
    setItems([...items, item]);
    setNewItem({ description: '', quantity: 1, unitPrice: '' });
  };

  const removeItem = (id) => {
    setItems(items.filter(item => item.id !== id));
  };

  const applyPreset = (preset) => {
    setNewItem({
      description: preset.description,
      quantity: 1,
      unitPrice: preset.unitPrice
    });
  };

  const applyDiscountPreset = () => {
    setNewItem({
      description: 'ส่วนลด',
      quantity: 1,
      unitPrice: ''
    });
    setTimeout(() => {
      const priceInput = document.getElementById('newItemPrice');
      if (priceInput) priceInput.focus();
    }, 50);
  };

  const computedDiscounts = React.useMemo(() => {
    const discounts = [];
    
    // Group items by description
    const itemGroups = {};
    items.forEach(item => {
      // Don't calculate discount for a discount line
      if (item.description?.startsWith('ส่วนลด') || Number(item.amount) < 0 || Number(item.unitPrice) < 0) return;
      
      if (!itemGroups[item.description]) {
        itemGroups[item.description] = { quantity: 0, product: products.find(p => p.name === item.description) };
      }
      itemGroups[item.description].quantity += Number(item.quantity);
    });

    // Calculate discount for each group
    Object.keys(itemGroups).forEach(desc => {
      const { quantity, product } = itemGroups[desc];
      if (product && product.hasPromotion && product.promoQty > 0 && product.promoPrice >= 0) {
        const sets = Math.floor(quantity / product.promoQty);
        if (sets > 0) {
          const normalPriceForSets = sets * product.promoQty * product.price;
          const promoPriceForSets = sets * product.promoPrice;
          const discountAmount = normalPriceForSets - promoPriceForSets;
          
          if (discountAmount > 0) {
            discounts.push({
              description: `ส่วนลดโปรโมชั่น ${desc} (${product.promoQty} ชิ้น ${product.promoPrice}฿)`,
              amount: discountAmount
            });
          }
        }
      }
    });
    
    return discounts;
  }, [items, products]);

  const itemsSum = items.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
  const promoDiscountTotal = computedDiscounts.reduce((sum, d) => sum + d.amount, 0);
  const totalAmount = Math.max(0, itemsSum - promoDiscountTotal);

  const handleSaveAndPrint = async (e) => {
    e.preventDefault();
    if (!customerName) {
      alert('กรุณากรอกชื่อลูกค้า');
      return;
    }
    if (items.length === 0) {
      alert('กรุณาเพิ่มรายการสินค้าอย่างน้อย 1 รายการ');
      return;
    }

    const uniqueId = invoiceToEdit ? invoiceToEdit.id : `TK-${date.replace(/-/g, '')}-${Date.now().toString().slice(-4)}`;

    const invoiceData = {
      id: uniqueId,
      customerName,
      customerAddress,
      customerTaxId,
      date,
      totalAmount,
      totalAmountText: getThaiBahtText(totalAmount),
      printedStatus: invoiceToEdit ? invoiceToEdit.printedStatus : false
    };

    const finalItems = [...items];
    computedDiscounts.forEach((d, idx) => {
      finalItems.push({
        id: Date.now() + idx,
        description: d.description,
        quantity: 1,
        unitPrice: -d.amount,
        amount: -d.amount
      });
    });

    onSubmitInvoice(invoiceData, finalItems);
  };

  return (
    <div style={{ padding: '1rem', paddingBottom: '100px', maxWidth: '800px', margin: '0 auto' }}>
      <form onSubmit={handleSaveAndPrint}>
        
        {/* Customer Details Card */}
        <div className="card" style={{ padding: '1.25rem', marginBottom: '1.5rem', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', boxShadow: 'none' }}>
          <div style={{ fontWeight: '600', color: 'var(--primary-color)', marginBottom: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <ClipboardCheck size={18} /> ข้อมูลลูกค้า
            </div>
            {invoiceToEdit && (
              <span style={{ fontSize: '0.8rem', backgroundColor: '#fefce8', color: '#ca8a04', padding: '0.2rem 0.6rem', borderRadius: '12px', border: '1px solid #fef08a' }}>กำลังแก้ไขใบเสร็จ: {invoiceToEdit.id}</span>
            )}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label htmlFor="invoiceDate" style={{ fontSize: '0.85rem' }}>วันที่ออกใบเสร็จ</label>
              <input type="date" id="invoiceDate" value={date} onChange={(e) => setDate(e.target.value)} required style={{ borderRadius: '8px', border: '1px solid #cbd5e1' }} />
            </div>

            <div className="form-group" style={{ margin: 0, position: 'relative' }}>
              <label htmlFor="customerName" style={{ fontSize: '0.85rem' }}>ชื่อลูกค้า</label>
              <input type="text" id="customerName" placeholder="ร้านขนมไทยแทนคุณ" value={customerName} onChange={(e) => { setCustomerName(e.target.value); setShowSuggestions(true); }} onFocus={() => setShowSuggestions(true)} onBlur={() => setTimeout(() => setShowSuggestions(false), 200)} required style={{ borderRadius: '8px', border: '1px solid #cbd5e1' }} />
              {showSuggestions && filteredCustomers.length > 0 && (
                <ul style={{ position: 'absolute', top: '100%', left: 0, right: 0, backgroundColor: 'white', border: '1px solid #e2e8f0', borderRadius: '12px', marginTop: '4px', padding: '0.5rem', listStyle: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', zIndex: 10, maxHeight: '250px', overflowY: 'auto' }}>
                  {filteredCustomers.map((cust, idx) => (
                    <li key={idx} style={{ padding: '0.75rem 1rem', cursor: 'pointer', borderRadius: '8px', marginBottom: idx !== filteredCustomers.length - 1 ? '4px' : '0' }} onMouseDown={() => { setCustomerName(cust.name); setCustomerAddress(cust.address); setCustomerTaxId(cust.taxId); setShowSuggestions(false); }} onMouseEnter={(e) => e.target.style.backgroundColor = '#f1f5f9'} onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}>
                      <div style={{ fontWeight: '600', color: '#1e293b' }}>{cust.name}</div>
                      {(cust.address || cust.taxId) && (
                        <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '2px' }}>
                          {cust.address} {cust.taxId ? `(Tax ID: ${cust.taxId})` : ''}
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="form-group" style={{ margin: 0 }}>
              <label htmlFor="customerTaxId" style={{ fontSize: '0.85rem' }}>เลขประจำตัวผู้เสียภาษี (ถ้ามี)</label>
              <input type="text" id="customerTaxId" placeholder="เช่น 0123456789012" value={customerTaxId} onChange={(e) => setCustomerTaxId(e.target.value)} style={{ borderRadius: '8px', border: '1px solid #cbd5e1' }} />
            </div>
            
            <div className="form-group" style={{ margin: 0, gridColumn: '1 / -1' }}>
              <label htmlFor="customerAddress" style={{ fontSize: '0.85rem' }}>ที่อยู่ลูกค้า</label>
              <textarea id="customerAddress" placeholder="เช่น 123/4 ม.5 ต.ดงมะไฟ..." value={customerAddress} onChange={(e) => setCustomerAddress(e.target.value)} rows="2" style={{ borderRadius: '8px', border: '1px solid #cbd5e1', resize: 'vertical' }} />
            </div>
          </div>
        </div>

        {/* Add New Item Form */}
        <div className="card" style={{ padding: '1.25rem', marginBottom: '1.5rem', border: '1px solid #e2e8f0', boxShadow: 'none' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            
            {/* Presets & Quick Discount Button */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div style={{ fontSize: '0.85rem', color: '#64748b' }}>
                  {topProducts.length > 0 ? 'แนะนำด่วน (คลิกเพื่อเพิ่ม)' : 'ทางลัด'}
                </div>
                <button 
                  type="button" 
                  onClick={applyDiscountPreset} 
                  style={{ 
                    padding: '0.35rem 0.75rem', 
                    borderRadius: '20px', 
                    border: '1px solid #86efac', 
                    backgroundColor: '#f0fdf4', 
                    color: '#166534', 
                    fontSize: '0.85rem', 
                    fontWeight: '600', 
                    cursor: 'pointer', 
                    display: 'inline-flex', 
                    alignItems: 'center', 
                    gap: '0.35rem',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.05)' 
                  }}
                >
                  <Tag size={13} color="#16a34a" />
                  + เพิ่มส่วนลด
                </button>
              </div>

              {topProducts.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'nowrap', gap: '0.5rem', overflowX: 'auto', paddingBottom: '0.25rem', msOverflowStyle: 'none', scrollbarWidth: 'none' }} className="hide-scrollbar">
                  {topProducts.map((preset, idx) => (
                    <button key={idx} type="button" onClick={() => applyPreset(preset)} style={{ padding: '0.4rem 0.75rem', borderRadius: '20px', border: '1px solid #e2e8f0', backgroundColor: '#fff', color: '#1e293b', fontSize: '0.85rem', whiteSpace: 'nowrap', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem', flexShrink: 0 }}>
                      <Plus size={12} color="var(--primary-color)" />
                      {preset.description} <span style={{ color: '#94a3b8' }}>฿{preset.unitPrice}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
              <div style={{ flex: '1 1 100%' }}>
                <div style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '0.25rem' }}>เพิ่มรายการใหม่ / ส่วนลด</div>
                <input type="text" list="products-list" placeholder="ชื่อขนม หรือ ส่วนลด..." value={newItem.description} onChange={(e) => { const val = e.target.value; setNewItem(prev => { const updated = { ...prev, description: val }; const matchedProduct = products.find(p => p.name === val); if (matchedProduct) { updated.unitPrice = matchedProduct.price; } return updated; }); }} style={{ width: '100%', padding: '0.8rem', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none', fontSize: '1rem' }} />
                <datalist id="products-list">
                  {products.map(p => (
                    <option key={p.id} value={p.name} />
                  ))}
                </datalist>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '0.25rem' }}>จำนวน</div>
                <input 
                  type="number"
                  min="1"
                  value={newItem.quantity} 
                  onChange={(e) => setNewItem({ ...newItem, quantity: cleanNumberInput(e.target.value) })}
                  onFocus={handleNumberFocus}
                  onBlur={() => {
                    if (!newItem.quantity || Number(newItem.quantity) < 1) {
                      setNewItem(prev => ({ ...prev, quantity: 1 }));
                    }
                  }}
                  style={{ width: '100%', padding: '0.8rem', borderRadius: '8px', border: '1px solid #cbd5e1', textAlign: 'center', outline: 'none', fontSize: '1rem', backgroundColor: '#fff', color: '#1e293b', height: '47px' }}
                />
              </div>
              <div style={{ flex: 1.5 }}>
                <div style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '0.25rem' }}>ราคา (หรือยอดส่วนลด)</div>
                <input 
                  id="newItemPrice"
                  type="number" 
                  placeholder="0"
                  value={newItem.unitPrice} 
                  onChange={(e) => setNewItem({ ...newItem, unitPrice: cleanNumberInput(e.target.value) })} 
                  onFocus={handleNumberFocus}
                  onBlur={() => {
                    if (newItem.unitPrice === '') {
                      setNewItem(prev => ({ ...prev, unitPrice: 0 }));
                    } else if (newItem.description?.trim().startsWith('ส่วนลด') && Number(newItem.unitPrice) > 0) {
                      setNewItem(prev => ({ ...prev, unitPrice: -Math.abs(Number(prev.unitPrice)) }));
                    }
                  }}
                  style={{ width: '100%', padding: '0.8rem', borderRadius: '8px', border: '1px solid #cbd5e1', textAlign: 'center', outline: 'none', fontSize: '1rem' }} 
                />
              </div>
              <button type="button" onClick={addItem} className="btn btn-primary" style={{ flex: '1 1 100%', height: '47px', marginTop: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                <Plus size={18} />
                เพิ่มรายการ
              </button>
            </div>
          </div>
        </div>

        {/* Selected Items Card List */}
        <div style={{ marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 style={{ fontSize: '1.1rem', color: '#1e293b', margin: 0 }}>รายการสินค้า</h3>
            <span style={{ fontSize: '0.85rem', color: '#64748b', backgroundColor: '#f1f5f9', padding: '0.2rem 0.6rem', borderRadius: '12px' }}>{items.length} รายการ</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {items.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '3rem 1rem', color: '#94a3b8', backgroundColor: '#f8fafc', borderRadius: '16px', border: '1px dashed #cbd5e1' }}>
                <Package size={48} style={{ margin: '0 auto 1rem', opacity: 0.5 }} />
                <div style={{ fontSize: '1.1rem', fontWeight: '500', color: '#64748b' }}>ยังไม่มีรายการสินค้า</div>
                <div style={{ fontSize: '0.9rem', marginTop: '0.5rem' }}>เพิ่มรายการด้านบนเพื่อเริ่มต้น</div>
              </div>
            ) : (
              items.map((item) => {
                const isDiscount = (item.description && item.description.startsWith('ส่วนลด')) || Number(item.amount) < 0 || Number(item.unitPrice) < 0;
                return (
                  <div 
                    key={item.id} 
                    className="card" 
                    style={{ 
                      padding: '1rem', 
                      border: isDiscount ? '1px solid #bbf7d0' : '1px solid #e2e8f0', 
                      backgroundColor: isDiscount ? '#f0fdf4' : '#fff',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.05)', 
                      position: 'relative' 
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                      <div style={{ flex: 1, paddingRight: '2.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        {isDiscount && <Tag size={16} color="#16a34a" style={{ flexShrink: 0 }} />}
                        <input 
                          type="text" 
                          value={item.description} 
                          onChange={(e) => handleItemChange(item.id, 'description', e.target.value)} 
                          style={{ width: '100%', border: 'none', background: 'transparent', fontWeight: '600', fontSize: '1.05rem', color: isDiscount ? '#166534' : '#1e293b', outline: 'none', padding: 0 }} 
                        />
                      </div>
                      <button type="button" onClick={() => removeItem(item.id)} title="ลบรายการ" style={{ position: 'absolute', top: '1rem', right: '1rem', color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', padding: '0.4rem', borderRadius: '8px', backgroundColor: '#fef2f2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                    
                    <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '0.25rem' }}>จำนวน</div>
                        <input 
                          type="number"
                          min="1"
                          value={item.quantity} 
                          onChange={(e) => handleItemChange(item.id, 'quantity', e.target.value)}
                          onFocus={handleNumberFocus}
                          onBlur={() => {
                            if (!item.quantity || Number(item.quantity) < 1) {
                              handleItemChange(item.id, 'quantity', 1);
                            }
                          }}
                          style={{ width: '100%', padding: '0.8rem', borderRadius: '8px', border: '1px solid #cbd5e1', textAlign: 'center', outline: 'none', fontSize: '1rem', backgroundColor: '#fff', color: '#1e293b', height: '47px' }}
                        />
                      </div>
                      
                      <div style={{ flex: 1.5 }}>
                        <div style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '0.25rem' }}>ราคา/หน่วย</div>
                        <input 
                          type="number" 
                          placeholder="0"
                          value={item.unitPrice} 
                          onChange={(e) => handleItemChange(item.id, 'unitPrice', e.target.value)} 
                          onFocus={handleNumberFocus}
                          onBlur={() => {
                            if (item.unitPrice === '') {
                              handleItemChange(item.id, 'unitPrice', 0);
                            } else if (item.description?.trim().startsWith('ส่วนลด') && Number(item.unitPrice) > 0) {
                              handleItemChange(item.id, 'unitPrice', -Math.abs(Number(item.unitPrice)));
                            }
                          }}
                          style={{ width: '100%', padding: '0.8rem', borderRadius: '8px', border: '1px solid #cbd5e1', textAlign: 'center', outline: 'none', fontSize: '1rem', backgroundColor: '#fff', color: Number(item.unitPrice) < 0 ? '#16a34a' : '#1e293b' }} 
                        />
                      </div>
                    </div>
                    
                    <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px dashed #e2e8f0', display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
                      <div style={{ fontSize: '0.85rem', color: '#64748b', marginRight: '0.5rem' }}>รวม:</div>
                      <div style={{ fontWeight: '700', color: Number(item.amount) < 0 ? '#16a34a' : 'var(--primary-color)', fontSize: '1.1rem' }}>
                        {Number(item.amount) < 0 ? `-฿${Math.abs(Number(item.amount)).toLocaleString()}` : `฿${Number(item.amount).toLocaleString()}`}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Discounts */}
        {computedDiscounts.length > 0 && (
          <div style={{ marginBottom: '1.5rem', backgroundColor: '#f0fdf4', padding: '1rem', borderRadius: '12px', border: '1px solid #bbf7d0' }}>
            <div style={{ fontWeight: '600', color: '#166534', marginBottom: '0.5rem' }}>ส่วนลดจากโปรโมชั่น</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {computedDiscounts.map((discount, idx) => (
                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', color: '#15803d' }}>
                  <span>{discount.description}</span>
                  <span style={{ fontWeight: '600' }}>-฿{discount.amount.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Total & Submit */}
        <div className="card" style={{ padding: '1.5rem', backgroundColor: 'var(--primary-color)', color: 'white', borderRadius: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <div style={{ fontSize: '1.1rem', opacity: 0.9 }}>ยอดรวมทั้งสิ้น</div>
            <div style={{ fontSize: '1.8rem', fontWeight: '700' }}>฿{totalAmount.toLocaleString()}</div>
          </div>
          {invoiceToEdit ? (
            <div style={{ display: 'flex', gap: '1rem' }}>
              <button type="button" onClick={onCancelEdit} style={{ flex: 1, padding: '1rem', borderRadius: '12px', border: 'none', backgroundColor: '#f1f5f9', color: '#64748b', fontWeight: '700', fontSize: '1.05rem', cursor: 'pointer', transition: 'background 0.2s' }}>
                ยกเลิกแก้ไข
              </button>
              <button type="submit" style={{ flex: 2, padding: '1rem', borderRadius: '12px', border: 'none', backgroundColor: '#fff', color: 'var(--primary-color)', fontWeight: '700', fontSize: '1.05rem', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
                บันทึกการแก้ไข
              </button>
            </div>
          ) : (
            <button type="submit" style={{ width: '100%', padding: '1rem', borderRadius: '12px', border: 'none', backgroundColor: '#fff', color: 'var(--primary-color)', fontWeight: '700', fontSize: '1.05rem', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
              <Printer size={20} /> ออกใบเสร็จ (Print PDF)
            </button>
          )}
        </div>

      </form>
      
      <style>{`
        .hide-scrollbar::-webkit-scrollbar {
          display: none;
        }
      `}</style>
    </div>
  );
}
