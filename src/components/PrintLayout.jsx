import React from 'react';
import { getThaiBahtText } from '../utils/thaiBaht';

const THAI_MONTHS = [
  'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
  'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'
];

const formatThaiDate = (dateStr) => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr;
  
  const day = date.getDate();
  const month = THAI_MONTHS[date.getMonth()];
  const yearBE = date.getFullYear() + 543; // Convert to Buddhist Era
  
  return `วันที่ ${day} ${month} ${yearBE}`;
};

export default function PrintLayout({ invoice, items = [] }) {
  if (!invoice) return null;

  // Pads the items table to always have at least 4 rows to match the PDF layout aesthetics
  const minRows = 4;
  const paddedItems = [...items];
  while (paddedItems.length < minRows) {
    paddedItems.push({
      id: `empty-${paddedItems.length}`,
      description: '',
      quantity: '',
      unitPrice: '',
      amount: ''
    });
  }

  return (
    <div className="print-only-container">
      <div className="invoice-box">
        {/* Main Header Table */}
        <table className="invoice-header-table">
          <tbody>
            <tr>
              <td>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '15px' }}>
                  <img src="/logo.jpg" alt="โลโก้" style={{ width: '80px', height: '80px', objectFit: 'cover' }} />
                  <div style={{ textAlign: 'left' }}>
                    <div className="invoice-header-title" style={{ fontWeight: 'bold' }}>ร้านขนมไทยแทนคุณ</div>
                    <div className="invoice-header-subtitle">695 ม.4 ต.ดงมะไฟ อ.เมือง จ.สกลนคร 47000</div>
                    <div className="invoice-header-subtitle">เบอร์โทรศัพท์ 083-1641982 , 080-4628068</div>
                  </div>
                </div>
              </td>
            </tr>
          </tbody>
        </table>

        {/* Customer & Date Info Box */}
        <div className="customer-info-box">
          <div className="customer-info-left">
            <div className="customer-title">ชื่อลูกค้า</div>
            <div className="customer-name">{invoice.customerName || ''}</div>
            {invoice.customerAddress && (
              <div className="customer-address" style={{ fontSize: '14px', textAlign: 'center', marginTop: '5px', padding: '0 10px' }}>
                {invoice.customerAddress}
              </div>
            )}
          </div>
          <div className="customer-info-right" style={{ flexDirection: 'column', gap: '8px' }}>
            <div style={{ fontSize: '16px', fontWeight: 'bold' }}>{formatThaiDate(invoice.date)}</div>
            {invoice.customerTaxId && (
              <div style={{ fontSize: '14px', fontWeight: 'normal' }}>เลขประจำตัวผู้เสียภาษี<br/>{invoice.customerTaxId}</div>
            )}
          </div>
        </div>

        {/* Invoice Items Table */}
        <table className="invoice-items-table">
          <thead>
            <tr>
              <th className="col-qty">จำนวน</th>
              <th className="col-desc">รายการ</th>
              <th className="col-price">หน่วยละ</th>
              <th className="col-amount">จำนวนเงิน</th>
            </tr>
            <tr className="sub-header-row">
              <th className="col-qty">Quantity</th>
              <th className="col-desc">Description</th>
              <th className="col-price">Unit Price</th>
              <th className="col-amount">Amount</th>
            </tr>
          </thead>
          <tbody>
            {paddedItems.map((item, index) => {
              const isEmpty = item.description === '';
              return (
                <tr key={item.id || index} className={isEmpty ? 'empty-row' : ''}>
                  <td className="col-qty">{item.quantity}</td>
                  <td className="col-desc">{item.description}</td>
                  <td className="col-price">
                    {isEmpty ? '' : Number(item.unitPrice).toLocaleString()}
                  </td>
                  <td className="col-amount">
                    {isEmpty ? '' : Number(item.amount).toLocaleString()}
                  </td>
                </tr>
              );
            })}
            {/* Total Row */}
            <tr>
              <td colSpan="2" style={{ textAlign: 'center', fontWeight: 'bold' }}>
                {getThaiBahtText(invoice.totalAmount)}
              </td>
              <td className="total-row-label">รวมเงิน</td>
              <td className="total-row-val">{Number(invoice.totalAmount).toLocaleString()}</td>
            </tr>
          </tbody>
        </table>

        {/* Signature Line */}
        <div style={{ marginTop: '50px', textAlign: 'right', paddingRight: '20px' }}>
          <div style={{ fontSize: '16px' }}>ผู้รับเงิน........................................................</div>
        </div>
      </div>
    </div>
  );
}
