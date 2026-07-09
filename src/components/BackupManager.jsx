import React, { useState, useMemo } from 'react';
import { Download, Trash2, Save, ArrowLeft, Database } from 'lucide-react';

const THAI_MONTH_NAMES = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
];

export default function BackupManager({ invoices = [], items = [], onDeleteData, onBack }) {
  const [backupYear, setBackupYear] = useState('all');
  const [backupMonth, setBackupMonth] = useState('all');

  const uniqueYears = useMemo(() => {
    const years = new Set();
    invoices.forEach(inv => {
      if (inv.date) {
        const year = new Date(inv.date).getFullYear();
        if (!isNaN(year)) {
          years.add(year);
        }
      }
    });
    return Array.from(years).sort((a, b) => b - a);
  }, [invoices]);

  const handleDownloadCSV = () => {
    const filteredInvoices = invoices.filter(inv => {
      if (!inv.date) return false;
      const d = new Date(inv.date);
      if (isNaN(d.getTime())) return false;
      const y = d.getFullYear().toString();
      const m = d.getMonth().toString();
      return (backupYear === 'all' || y === backupYear) && (backupMonth === 'all' || m === backupMonth);
    });

    if (filteredInvoices.length === 0) {
      alert('ไม่มีข้อมูลในเดือนและปีที่เลือกครับ');
      return;
    }

    const filteredInvoiceIds = new Set(filteredInvoices.map(inv => inv.id));
    const filteredItems = items.filter(item => filteredInvoiceIds.has(item.invoiceId));

    const headers = ['เลขที่บิล', 'วันที่', 'ชื่อลูกค้า', 'รายการสินค้า', 'จำนวน', 'ราคาต่อหน่วย', 'ราคารวม (บาท)', 'ยอดรวมบิล (บาท)'];
    const rows = [];
    
    filteredInvoices.forEach(inv => {
      const invItems = filteredItems.filter(item => item.invoiceId === inv.id);
      if (invItems.length === 0) {
        rows.push([
          inv.id,
          inv.date,
          `"${(inv.customerName || '').replace(/"/g, '""')}"`,
          '-',
          0,
          0,
          0,
          inv.totalAmount || 0
        ]);
      } else {
        invItems.forEach((item, idx) => {
          rows.push([
            idx === 0 ? inv.id : '',
            idx === 0 ? inv.date : '',
            idx === 0 ? `"${(inv.customerName || '').replace(/"/g, '""')}"` : '',
            `"${(item.description || '').replace(/"/g, '""')}"`,
            item.quantity || 0,
            item.unitPrice || 0,
            item.amount || 0,
            idx === 0 ? inv.totalAmount || 0 : ''
          ]);
        });
      }
    });

    const bom = '\uFEFF';
    const csvContent = bom + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    
    const yearStr = backupYear === 'all' ? 'ทุกปี' : (parseInt(backupYear) + 543).toString();
    const monthStr = backupMonth === 'all' ? 'ทุกเดือน' : THAI_MONTH_NAMES[parseInt(backupMonth)];
    const fileName = `สำรองข้อมูล_ขนมไทยแทนคุณ_${monthStr}_${yearStr}.csv`;

    link.setAttribute('href', url);
    link.setAttribute('download', fileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto' }}>
      <button 
        onClick={onBack}
        style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'none', border: 'none', color: 'var(--primary-color)', cursor: 'pointer', marginBottom: '1.5rem', fontWeight: '500', padding: 0 }}
      >
        <ArrowLeft size={20} />
        กลับไปหน้าสถิติ
      </button>

      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
          <div style={{ padding: '0.75rem', backgroundColor: '#f0fdf4', color: '#16a34a', borderRadius: '12px' }}>
            <Database size={24} />
          </div>
          <div>
            <h3 style={{ margin: 0, color: '#1e293b', fontSize: '1.25rem' }}>ระบบจัดการและสำรองข้อมูล</h3>
            <p style={{ margin: 0, fontSize: '0.9rem', color: '#64748b', marginTop: '0.25rem' }}>
              ป้องกันข้อมูลสูญหาย และเคลียร์พื้นที่ฐานข้อมูลให้ว่าง
            </p>
          </div>
        </div>

        <div style={{ padding: '1.5rem', backgroundColor: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0', marginBottom: '2rem' }}>
          <h4 style={{ margin: 0, marginBottom: '1rem', color: '#334155', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ display: 'inline-block', width: '24px', height: '24px', backgroundColor: '#cbd5e1', color: '#fff', borderRadius: '50%', textAlign: 'center', lineHeight: '24px', fontSize: '0.85rem', fontWeight: 'bold' }}>1</span>
            เลือกช่วงเวลาที่ต้องการ
          </h4>
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 200px' }}>
              <div style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '0.25rem', fontWeight: '500' }}>เดือน</div>
              <select
                value={backupMonth}
                onChange={(e) => setBackupMonth(e.target.value)}
                style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1', backgroundColor: '#fff', color: '#1e293b', outline: 'none' }}
              >
                <option value="all">ทุกเดือน</option>
                {THAI_MONTH_NAMES.map((name, idx) => (
                  <option key={idx} value={idx}>{name}</option>
                ))}
              </select>
            </div>
            <div style={{ flex: '1 1 200px' }}>
              <div style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '0.25rem', fontWeight: '500' }}>ปี</div>
              <select
                value={backupYear}
                onChange={(e) => setBackupYear(e.target.value)}
                style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1', backgroundColor: '#fff', color: '#1e293b', outline: 'none' }}
              >
                <option value="all">ทุกปี</option>
                {uniqueYears.map(year => (
                  <option key={year} value={year}>{year + 543}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 300px', padding: '1.5rem', borderRadius: '12px', border: '1px solid #bbf7d0', backgroundColor: '#f0fdf4', display: 'flex', flexDirection: 'column' }}>
            <h4 style={{ margin: 0, marginBottom: '0.5rem', color: '#166534', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Download size={18} /> สำรองข้อมูล (แนะนำ)
            </h4>
            <p style={{ margin: 0, fontSize: '0.85rem', color: '#15803d', marginBottom: '1.5rem', lineHeight: '1.5' }}>
              ดาวน์โหลดข้อมูลใบเสร็จออกมาเป็นไฟล์ Excel (.csv) เพื่อเก็บไว้ในเครื่องของคุณ ปลอดภัยและเรียกดูได้เสมอ
            </p>
            <button
              onClick={handleDownloadCSV}
              style={{ marginTop: 'auto', width: '100%', padding: '0.75rem', borderRadius: '8px', border: 'none', backgroundColor: '#22c55e', color: '#fff', fontWeight: '600', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}
            >
              <Download size={18} />
              ดาวน์โหลดไฟล์ Excel
            </button>
          </div>

          <div style={{ flex: '1 1 300px', padding: '1.5rem', borderRadius: '12px', border: '1px solid #fecaca', backgroundColor: '#fef2f2', display: 'flex', flexDirection: 'column' }}>
            <h4 style={{ margin: 0, marginBottom: '0.5rem', color: '#991b1b', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Trash2 size={18} /> ลบข้อมูลออกจากระบบ
            </h4>
            <p style={{ margin: 0, fontSize: '0.85rem', color: '#b91c1c', marginBottom: '1.5rem', lineHeight: '1.5' }}>
              ลบข้อมูลใบเสร็จตามเดือน/ปีที่เลือก เพื่อคืนพื้นที่ให้ฐานข้อมูล (การกระทำนี้ไม่สามารถย้อนกลับได้ โปรดสำรองข้อมูลก่อนลบ)
            </p>
            <button
              onClick={() => onDeleteData && onDeleteData(backupYear, backupMonth)}
              style={{ marginTop: 'auto', width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #ef4444', backgroundColor: '#fff', color: '#ef4444', fontWeight: '600', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem' }}
            >
              <Trash2 size={18} />
              ลบข้อมูลถาวร
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
