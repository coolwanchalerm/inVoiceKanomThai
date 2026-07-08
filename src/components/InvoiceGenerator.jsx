import React, { useState } from 'react';
import { Plus, Trash2, Printer, ClipboardCheck, AlertCircle } from 'lucide-react';
import { getThaiBahtText } from '../utils/thaiBaht';

export default function InvoiceGenerator({ onSubmitInvoice, products = [], topProducts = [], customers = [] }) {
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

  const [newItem, setNewItem] = useState({ description: '', quantity: 1, unitPrice: 0 });

  const handleItemChange = (id, field, value) => {
    setItems(items.map(item => {
      if (item.id === id) {
        const updated = { ...item, [field]: value };
        if (field === 'quantity' || field === 'unitPrice') {
          const qty = field === 'quantity' ? Number(value) : Number(item.quantity);
          const price = field === 'unitPrice' ? Number(value) : Number(item.unitPrice);
          updated.amount = qty * price;
        }
        return updated;
      }
      return item;
    }));
  };

  const addItem = () => {
    if (!newItem.description) {
      if (showModal) showModal('ข้อมูลไม่ครบถ้วน', 'กรุณาระบุชื่อสินค้า', 'warning');
      else alert('กรุณาระบุชื่อสินค้า');
      return;
    }
    const item = {
      id: Date.now(),
      description: newItem.description,
      quantity: Number(newItem.quantity),
      unitPrice: Number(newItem.unitPrice),
      amount: Number(newItem.quantity) * Number(newItem.unitPrice)
    };
    setItems([...items, item]);
    setNewItem({ description: '', quantity: 1, unitPrice: 0 });
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

  const totalAmount = items.reduce((sum, item) => sum + item.amount, 0);

  const handleSaveAndPrint = async (e) => {
    e.preventDefault();
    if (!customerName) {
      if (showModal) showModal('ข้อมูลไม่ครบถ้วน', 'กรุณากรอกชื่อลูกค้า', 'warning');
      else alert('กรุณากรอกชื่อลูกค้า');
      return;
    }
    if (items.length === 0) {
      if (showModal) showModal('ข้อมูลไม่ครบถ้วน', 'กรุณาเพิ่มรายการสินค้าอย่างน้อย 1 รายการ', 'warning');
      else alert('กรุณาเพิ่มรายการสินค้าอย่างน้อย 1 รายการ');
      return;
    }

    // Generate unique Invoice ID e.g. TK-YYYYMMDD-HHMM
    const dateFormatted = date.replace(/-/g, '');
    const uniqueId = `TK-${dateFormatted}-${Date.now().toString().slice(-4)}`;

    const invoiceData = {
      id: uniqueId,
      customerName,
      customerAddress,
      customerTaxId,
      date,
      totalAmount,
      totalAmountText: getThaiBahtText(totalAmount)
    };

    onSubmitInvoice(invoiceData, items);
  };

  return (
    <div className="card">
      <h2 className="card-title">
        <ClipboardCheck className="logo-icon" /> ออกใบเสร็จใหม่
      </h2>

      <form onSubmit={handleSaveAndPrint}>
        <div className="form-grid">
          <div className="form-group">
            <label htmlFor="invoiceDate">วันที่ออกใบเสร็จ</label>
            <input
              type="date"
              id="invoiceDate"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </div>

          <div className="form-group" style={{ position: 'relative' }}>
            <label htmlFor="customerName">ชื่อลูกค้า</label>
            <input
              type="text"
              id="customerName"
              placeholder="ร้านขนมไทยแทนคุณ"
              value={customerName}
              onChange={(e) => {
                setCustomerName(e.target.value);
                setShowSuggestions(true);
              }}
              onFocus={() => setShowSuggestions(true)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
              required
            />
            {showSuggestions && filteredCustomers.length > 0 && (
              <ul style={{
                position: 'absolute', top: '100%', left: 0, right: 0,
                backgroundColor: 'white', border: '1px solid var(--border-color)',
                borderRadius: '8px', marginTop: '4px', padding: 0, listStyle: 'none',
                boxShadow: '0 4px 6px rgba(0,0,0,0.1)', zIndex: 10, maxHeight: '200px', overflowY: 'auto'
              }}>
                {filteredCustomers.map((cust, idx) => (
                  <li 
                    key={idx}
                    style={{ padding: '0.75rem 1rem', cursor: 'pointer', borderBottom: idx !== filteredCustomers.length - 1 ? '1px solid #eee' : 'none' }}
                    onMouseDown={() => {
                      setCustomerName(cust.name);
                      setCustomerAddress(cust.address);
                      setCustomerTaxId(cust.taxId);
                      setShowSuggestions(false);
                    }}
                    onMouseEnter={(e) => e.target.style.backgroundColor = '#f8fafc'}
                    onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
                  >
                    <div style={{ fontWeight: '500', color: 'var(--text-main)' }}>{cust.name}</div>
                    {(cust.address || cust.taxId) && (
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                        {cust.address} {cust.taxId ? `(Tax ID: ${cust.taxId})` : ''}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="customerTaxId">เลขประจำตัวผู้เสียภาษี</label>
            <input
              type="text"
              id="customerTaxId"
              placeholder="เช่น 0123456789012"
              value={customerTaxId}
              onChange={(e) => setCustomerTaxId(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label htmlFor="customerAddress">ที่อยู่ลูกค้า</label>
            <textarea
              id="customerAddress"
              placeholder="เช่น 123/4 ม.5 ต.ดงมะไฟ..."
              value={customerAddress}
              onChange={(e) => setCustomerAddress(e.target.value)}
              rows="3"
            />
          </div>
        </div>

        {/* Preset Selector */}
        <div style={{ marginBottom: '1.5rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem' }}>รายการขนมแนะนำด่วน (5 อันดับขายดี)</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            {topProducts.length > 0 ? topProducts.map((preset, idx) => (
              <button
                key={idx}
                type="button"
                className="btn btn-outline"
                style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}
                onClick={() => applyPreset(preset)}
              >
                {preset.description} ({preset.unitPrice}.-)
              </button>
            )) : (
              <span style={{ fontSize: '0.85rem', color: '#666' }}>ระบบกำลังรวบรวมข้อมูลยอดขาย...</span>
            )}
          </div>
        </div>

        {/* Add item row */}
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end', marginBottom: '1.5rem', flexWrap: 'wrap', backgroundColor: '#f8fafc', padding: '1rem', borderRadius: '10px' }}>
          <div className="form-group" style={{ flex: 2, minWidth: '200px' }}>
            <label>รายการสินค้า</label>
            <input
              type="text"
              list="products-list"
              placeholder="พิมพ์ชื่อสินค้า หรือเลือกจากขนมแนะนำด้านบน"
              value={newItem.description}
              onChange={(e) => {
                const val = e.target.value;
                setNewItem(prev => {
                  const updated = { ...prev, description: val };
                  // Auto-fill price if matched with products
                  const matchedProduct = products.find(p => p.name === val);
                  if (matchedProduct) {
                    updated.unitPrice = matchedProduct.price;
                  }
                  return updated;
                });
              }}
            />
            <datalist id="products-list">
              {products.map(p => (
                <option key={p.id} value={p.name} />
              ))}
            </datalist>
          </div>
          <div className="form-group" style={{ width: '100px' }}>
            <label>จำนวน</label>
            <input
              type="number"
              min="1"
              value={newItem.quantity}
              onChange={(e) => setNewItem({ ...newItem, quantity: e.target.value })}
            />
          </div>
          <div className="form-group" style={{ width: '120px' }}>
            <label>หน่วยละ (บาท)</label>
            <input
              type="number"
              min="0"
              value={newItem.unitPrice}
              onChange={(e) => setNewItem({ ...newItem, unitPrice: e.target.value })}
            />
          </div>
          <button type="button" className="btn btn-primary" onClick={addItem} style={{ height: '43px' }}>
            <Plus size={18} /> เพิ่ม
          </button>
        </div>

        {/* Items Table */}
        <table className="items-builder-table">
          <thead>
            <tr>
              <th style={{ width: '45%' }}>รายการ (Description)</th>
              <th style={{ width: '15%', textAlign: 'center' }}>จำนวน (Qty)</th>
              <th style={{ width: '20%', textAlign: 'right' }}>หน่วยละ (Price)</th>
              <th style={{ width: '20%', textAlign: 'right' }}>จำนวนเงิน (Amount)</th>
              <th style={{ width: '10%', textAlign: 'center' }}></th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan="5" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                  ยังไม่มีรายการสินค้า กรุณาเพิ่มรายการ
                </td>
              </tr>
            ) : (
              items.map((item) => (
                <tr key={item.id}>
                  <td>
                    <input
                      type="text"
                      value={item.description}
                      onChange={(e) => handleItemChange(item.id, 'description', e.target.value)}
                      style={{ width: '100%', border: 'none', background: 'transparent', padding: '4px' }}
                    />
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <input
                      type="number"
                      min="1"
                      value={item.quantity}
                      onChange={(e) => handleItemChange(item.id, 'quantity', e.target.value)}
                      style={{ width: '70px', textAlign: 'center', border: 'none', background: 'transparent', padding: '4px' }}
                    />
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <input
                      type="number"
                      min="0"
                      value={item.unitPrice}
                      onChange={(e) => handleItemChange(item.id, 'unitPrice', e.target.value)}
                      style={{ width: '90px', textAlign: 'right', border: 'none', background: 'transparent', padding: '4px' }}
                    />
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: '600', paddingRight: '1rem' }}>
                    {item.amount.toLocaleString()}.-
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <button
                      type="button"
                      className="btn btn-outline"
                      style={{ padding: '0.35rem', color: 'var(--danger)', borderColor: 'transparent' }}
                      onClick={() => removeItem(item.id)}
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))
            )}
            {items.length > 0 && (
              <tr style={{ backgroundColor: '#fdfcf7', fontWeight: 'bold' }}>
                <td colSpan="3" style={{ textAlign: 'right', paddingRight: '1rem', color: 'var(--primary-color)' }}>ยอดรวมทั้งหมด:</td>
                <td style={{ textAlign: 'right', paddingRight: '1rem', color: 'var(--primary-color)', fontSize: '1.1rem' }}>
                  {totalAmount.toLocaleString()}.-
                </td>
                <td></td>
              </tr>
            )}
          </tbody>
        </table>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
          <button type="submit" className="btn btn-accent" style={{ padding: '0.85rem 2rem' }}>
            <Printer size={18} /> บันทึก & พิมพ์ใบเสร็จ (Print PDF)
          </button>
        </div>
      </form>
    </div>
  );
}
