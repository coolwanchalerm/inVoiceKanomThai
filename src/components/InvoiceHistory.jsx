import React, { useState, useMemo } from 'react';
import { Search, Receipt, Calendar, ExternalLink, Trash2, ChevronLeft, ChevronRight, Printer } from 'lucide-react';

export default function InvoiceHistory({ invoices = [], onDelete, onPrint, onTogglePrint }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterYear, setFilterYear] = useState('all');
  const [filterMonth, setFilterMonth] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const availableYears = useMemo(() => {
    const years = new Set(invoices.map(inv => inv.date ? inv.date.split('-')[0] : null).filter(Boolean));
    return Array.from(years).sort().reverse();
  }, [invoices]);

  const months = [
    { value: '01', label: 'มกราคม' },
    { value: '02', label: 'กุมภาพันธ์' },
    { value: '03', label: 'มีนาคม' },
    { value: '04', label: 'เมษายน' },
    { value: '05', label: 'พฤษภาคม' },
    { value: '06', label: 'มิถุนายน' },
    { value: '07', label: 'กรกฎาคม' },
    { value: '08', label: 'สิงหาคม' },
    { value: '09', label: 'กันยายน' },
    { value: '10', label: 'ตุลาคม' },
    { value: '11', label: 'พฤศจิกายน' },
    { value: '12', label: 'ธันวาคม' },
  ];

  const filteredInvoices = useMemo(() => {
    const result = invoices.filter(inv => {
      const name = (inv.customerName || '').toLowerCase();
      const id = (inv.id || '').toLowerCase();
      const q = searchTerm.toLowerCase();
      
      let dateMatch = true;
      if (inv.date) {
        const [year, month] = inv.date.split('-');
        if (filterYear !== 'all' && year !== filterYear) dateMatch = false;
        if (filterMonth !== 'all' && month !== filterMonth) dateMatch = false;
      }
      
      return (name.includes(q) || id.includes(q)) && dateMatch;
    });

    return result.sort((a, b) => {
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();
      if (!isNaN(dateA) && !isNaN(dateB)) {
        return dateB - dateA;
      }
      return (b.id || '').localeCompare(a.id || '');
    });
  }, [invoices, searchTerm, filterYear, filterMonth]);

  const totalPages = Math.ceil(filteredInvoices.length / itemsPerPage);
  
  // Reset to page 1 when searching or filtering
  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterYear, filterMonth]);

  const paginatedInvoices = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredInvoices.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredInvoices, currentPage]);

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '2rem' }}>
        <h3 className="card-title" style={{ marginBottom: 0 }}>
          <Receipt className="logo-icon" /> รายการใบเสร็จทั้งหมด
        </h3>
        
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Filters */}
          <select 
            value={filterMonth} 
            onChange={e => setFilterMonth(e.target.value)}
            style={{ padding: '0.6rem', borderRadius: '4px', border: '1px solid var(--border-color)', backgroundColor: 'var(--card-bg)', color: 'var(--text-main)', outline: 'none' }}
          >
            <option value="all">ทุกเดือน</option>
            {months.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
          <select 
            value={filterYear} 
            onChange={e => setFilterYear(e.target.value)}
            style={{ padding: '0.6rem', borderRadius: '4px', border: '1px solid var(--border-color)', backgroundColor: 'var(--card-bg)', color: 'var(--text-main)', outline: 'none' }}
          >
            <option value="all">ทุกปี</option>
            {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
          </select>

          {/* Search Box */}
          <div style={{ position: 'relative', width: '250px' }}>
            <input
              type="text"
              placeholder="ค้นหาชื่อลูกค้า หรือเลขที่ใบเสร็จ..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ width: '100%', paddingLeft: '2.5rem' }}
            />
            <Search size={18} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          </div>
        </div>
      </div>

      <div className="recent-table-wrapper">
        <table className="recent-table">
          <thead>
            <tr>
              <th>เลขที่ใบเสร็จ</th>
              <th>วันที่ออก</th>
              <th>ชื่อลูกค้า</th>
              <th style={{ textAlign: 'right' }}>ยอดเงินสุทธิ</th>
              <th style={{ textAlign: 'center' }}>สถานะ</th>
              <th style={{ textAlign: 'center' }}>จัดการ</th>
            </tr>
          </thead>
          <tbody>
            {filteredInvoices.length === 0 ? (
              <tr>
                <td colSpan="6" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '3rem' }}>
                  ไม่พบข้อมูลประวัติใบเสร็จในระบบ
                </td>
              </tr>
            ) : (
              paginatedInvoices.map(inv => (
                <tr key={inv.id}>
                  <td style={{ fontFamily: 'var(--font-eng)', fontWeight: '600', color: 'var(--primary-color)' }}>
                    {inv.id}
                  </td>
                  <td>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
                      <Calendar size={14} style={{ color: 'var(--text-muted)' }} />
                      {inv.date ? new Date(inv.date).toLocaleDateString('th-TH') : '-'}
                    </span>
                  </td>
                  <td>
                    {inv.customerName}
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 'bold', fontFamily: 'var(--font-eng)', fontSize: '1.05rem', color: 'var(--primary-color)' }}>
                    {inv.totalAmount ? inv.totalAmount.toLocaleString() : 0} ฿
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <label style={{ display: 'inline-flex', alignItems: 'center', cursor: 'pointer', gap: '0.4rem', userSelect: 'none' }}>
                      <input 
                        type="checkbox" 
                        checked={inv.printedStatus || false} 
                        onChange={() => onTogglePrint && onTogglePrint(inv.id, inv.printedStatus)}
                        style={{ width: '16px', height: '16px', accentColor: 'var(--success, #198754)' }}
                      />
                      <span style={{ fontSize: '0.85rem', color: inv.printedStatus ? 'var(--success, #198754)' : 'var(--text-muted)', fontWeight: inv.printedStatus ? '600' : 'normal' }}>
                        {inv.printedStatus ? 'พิมพ์แล้ว' : 'ยังไม่พิมพ์'}
                      </span>
                    </label>
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', alignItems: 'center' }}>
                      <button 
                        className="btn btn-primary" 
                        style={{ padding: '0.4rem 0.8rem', fontSize: '0.9rem', gap: '0.3rem', display: 'inline-flex', alignItems: 'center', minHeight: 'unset' }}
                        onClick={() => onPrint && onPrint(inv.id)}
                        title="พิมพ์ใบเสร็จ"
                      >
                        <Printer size={16} />
                        พิมพ์
                      </button>


                      
                      <button 
                        className="btn btn-outline" 
                        style={{ padding: '0.3rem 0.6rem', color: 'var(--danger)', borderColor: 'transparent', minHeight: 'unset' }}
                        onClick={() => onDelete && onDelete(inv.id)}
                        title="ลบใบเสร็จ"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
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
