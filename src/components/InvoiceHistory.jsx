import React, { useState, useMemo } from 'react';
import { Search, Receipt, Calendar, ExternalLink, Trash2, ChevronLeft, ChevronRight } from 'lucide-react';

export default function InvoiceHistory({ invoices = [], onDelete }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const filteredInvoices = useMemo(() => {
    return invoices.filter(inv => {
      const name = (inv.customerName || '').toLowerCase();
      const id = (inv.id || '').toLowerCase();
      const q = searchTerm.toLowerCase();
      return name.includes(q) || id.includes(q);
    });
  }, [invoices, searchTerm]);

  const totalPages = Math.ceil(filteredInvoices.length / itemsPerPage);
  
  // Reset to page 1 when searching
  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

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
        
        {/* Search Box */}
        <div style={{ position: 'relative', width: '300px' }}>
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

      <div className="recent-table-wrapper">
        <table className="recent-table">
          <thead>
            <tr>
              <th>เลขที่ใบเสร็จ</th>
              <th>วันที่ออก</th>
              <th>ชื่อลูกค้า</th>
              <th style={{ textAlign: 'right' }}>ยอดเงินสุทธิ</th>
              <th style={{ textAlign: 'center' }}>ลิงก์ PDF (Google Drive)</th>
            </tr>
          </thead>
          <tbody>
            {filteredInvoices.length === 0 ? (
              <tr>
                <td colSpan="5" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '3rem' }}>
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
                    <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', alignItems: 'center' }}>
                      {inv.pdfUrl ? (
                        <a 
                          href={inv.pdfUrl} 
                          target="_blank" 
                          rel="noopener noreferrer" 
                          className="btn btn-outline" 
                          style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem', gap: '0.3rem', display: 'inline-flex', minHeight: 'unset' }}
                        >
                          <ExternalLink size={12} />
                          เปิดไฟล์ PDF
                        </a>
                      ) : (
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>-</span>
                      )}
                      
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
