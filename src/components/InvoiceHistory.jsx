import React, { useState, useMemo } from 'react';
import { Search, Receipt, Calendar, ExternalLink, Trash2, ChevronLeft, ChevronRight, Printer, Edit, Copy, CheckCircle, Clock, Package } from 'lucide-react';

export default function InvoiceHistory({ invoices = [], onDelete, onPrint, onTogglePrint, onEdit, onUpdateStatus, items = [] }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterYear, setFilterYear] = useState('all');
  const [filterMonth, setFilterMonth] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all'); // 'all', 'printed', 'unprinted'
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
      
      let statusMatch = true;
      if (filterStatus !== 'all') {
        const invStatus = inv.status || 'pending';
        if (invStatus !== filterStatus) statusMatch = false;
      }
      
      return (name.includes(q) || id.includes(q)) && dateMatch && statusMatch;
    });

    return result.sort((a, b) => {
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();
      if (!isNaN(dateA) && !isNaN(dateB)) {
        return dateB - dateA;
      }
      return (b.id || '').localeCompare(a.id || '');
    });
  }, [invoices, searchTerm, filterYear, filterMonth, filterStatus]);

  const totalPages = Math.ceil(filteredInvoices.length / itemsPerPage);
  
  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterYear, filterMonth, filterStatus]);

  const paginatedInvoices = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredInvoices.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredInvoices, currentPage]);

  return (
    <div className="card" style={{ padding: '1.5rem', marginBottom: '100px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        
        <div style={{ display: 'flex', gap: '0.5rem', overflowX: 'auto' }}>
          <button 
            onClick={() => setFilterStatus('all')}
            style={{ padding: '0.4rem 1rem', borderRadius: '20px', border: filterStatus === 'all' ? 'none' : '1px solid #e2e8f0', backgroundColor: filterStatus === 'all' ? 'var(--primary-color)' : '#fff', color: filterStatus === 'all' ? '#fff' : '#64748b', fontWeight: '500', fontSize: '0.85rem', cursor: 'pointer', whiteSpace: 'nowrap' }}
          >ทั้งหมด</button>
          <button 
            onClick={() => setFilterStatus('pending')}
            style={{ padding: '0.4rem 1rem', borderRadius: '20px', border: filterStatus === 'pending' ? 'none' : '1px solid #e2e8f0', backgroundColor: filterStatus === 'pending' ? '#eab308' : '#fff', color: filterStatus === 'pending' ? '#fff' : '#64748b', fontWeight: '500', fontSize: '0.85rem', cursor: 'pointer', whiteSpace: 'nowrap' }}
          >รอโอน</button>
          <button 
            onClick={() => setFilterStatus('shipped')}
            style={{ padding: '0.4rem 1rem', borderRadius: '20px', border: filterStatus === 'shipped' ? 'none' : '1px solid #e2e8f0', backgroundColor: filterStatus === 'shipped' ? '#3b82f6' : '#fff', color: filterStatus === 'shipped' ? '#fff' : '#64748b', fontWeight: '500', fontSize: '0.85rem', cursor: 'pointer', whiteSpace: 'nowrap' }}
          >ส่งแล้ว</button>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <select 
            value={filterMonth} 
            onChange={e => setFilterMonth(e.target.value)}
            style={{ padding: '0.4rem 0.5rem', borderRadius: '20px', border: '1px solid #e2e8f0', backgroundColor: '#fff', color: 'var(--primary-color)', outline: 'none', fontWeight: '500', fontSize: '0.85rem' }}
          >
            <option value="all">ทุกเดือน</option>
            {months.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
          <select 
            value={filterYear} 
            onChange={e => setFilterYear(e.target.value)}
            style={{ padding: '0.4rem 0.5rem', borderRadius: '20px', border: '1px solid #e2e8f0', backgroundColor: '#fff', color: 'var(--primary-color)', outline: 'none', fontWeight: '500', fontSize: '0.85rem' }}
          >
            <option value="all">ทุกปี</option>
            {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      <div style={{ position: 'relative', width: '100%', marginBottom: '1.5rem' }}>
        <input
          type="text"
          placeholder="ค้นหาชื่อลูกค้า หรือเลขที่ใบเสร็จ..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{ width: '100%', padding: '0.75rem', paddingLeft: '2.5rem', borderRadius: '12px', border: '1px solid #e2e8f0', backgroundColor: '#fff' }}
        />
        <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
        {filteredInvoices.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#94a3b8', padding: '3rem 0' }}>
            ไม่พบข้อมูลประวัติใบเสร็จในระบบ
          </div>
        ) : (
          paginatedInvoices.map(inv => (
            <div key={inv.id} id={`receipt-card-${inv.id}`} style={{ 
              backgroundColor: '#fff', 
              padding: '1.25rem 0',
              borderBottom: '1px solid #f1f5f9',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem'
            }}>
              <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: '#ebf2ef', display: 'flex', justifyContent: 'center', alignItems: 'center', color: 'var(--primary-color)', flexShrink: 0 }}>
                  <Receipt size={20} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '1.05rem', fontWeight: '700', color: '#1e293b', marginBottom: '2px' }}>{inv.customerName || 'ลูกค้าทั่วไป'}</div>
                  <div style={{ fontSize: '0.85rem', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span>ใบเสร็จ {inv.id}</span>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
                  <button 
                    onClick={() => onPrint && onPrint(inv.id)}
                    title="พิมพ์ใบเสร็จ"
                    style={{ color: 'var(--primary-color)', background: 'none', border: 'none', cursor: 'pointer', padding: '0.4rem', borderRadius: '8px', backgroundColor: '#ebf2ef' }}>
                    <Printer size={18} />
                  </button>
                  <button 
                    onClick={() => onEdit && onEdit(inv.id)}
                    title="แก้ไขใบเสร็จ"
                    style={{ 
                      color: '#eab308', 
                      background: 'none', 
                      border: 'none', 
                      cursor: 'pointer', 
                      padding: '0.4rem', 
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: '8px',
                      backgroundColor: '#fefce8'
                    }}>
                    <Edit size={18} />
                  </button>
                  <button 
                    onClick={() => onDelete && onDelete(inv.id)}
                    title="ลบใบเสร็จ"
                    style={{ 
                      color: '#ef4444', 
                      background: 'none', 
                      border: 'none', 
                      cursor: 'pointer', 
                      padding: '0.4rem', 
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: '8px',
                      backgroundColor: '#fef2f2'
                    }}>
                    <Trash2 size={18} />
                  </button>

                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginLeft: '56px' }}>
                <div style={{ fontSize: '0.85rem', color: '#475569' }}>
                  เวลาสร้างรายการ: <span style={{ marginLeft: '4px' }}>{inv.date ? new Date(inv.date).toLocaleDateString('th-TH', { year: '2-digit', month: 'short', day: 'numeric' }) : '-'}</span>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginLeft: '56px' }}>
                <div>
                  <select 
                    value={inv.status || 'pending'}
                    onChange={(e) => onUpdateStatus && onUpdateStatus(inv.id, e.target.value)}
                    style={{ 
                      padding: '0.25rem 1.5rem 0.25rem 0.75rem', 
                      borderRadius: '4px', 
                      border: '1px solid #e2e8f0',
                      backgroundColor: inv.status === 'shipped' ? '#dbeafe' : '#fefce8', 
                      color: inv.status === 'shipped' ? '#1e40af' : '#854d0e', 
                      fontSize: '0.8rem', 
                      fontWeight: '700',
                      cursor: 'pointer',
                      outline: 'none',
                      appearance: 'none',
                      backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`,
                      backgroundRepeat: 'no-repeat',
                      backgroundPosition: 'right 0.5rem center',
                      backgroundSize: '12px'
                    }}>
                    <option value="pending">🟡 รอโอน</option>
                    <option value="shipped">📦 ส่งแล้ว</option>
                  </select>
                </div>
                
                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontSize: '1.25rem', fontWeight: '700', color: '#0f172a' }}>
                    {inv.totalAmount ? Number(inv.totalAmount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}
                  </span>
                  <span style={{ fontSize: '0.9rem', color: '#94a3b8', marginLeft: '4px' }}>บาท</span>
                </div>
              </div>

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
