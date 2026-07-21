import React from 'react';

export default function Step1Price({ sets, selectedSetId, onSelect }) {
  return (
    <div style={{ animation: 'fadeIn 0.3s' }}>
      <h2 style={{ fontSize: '1.25rem', color: '#1e293b', marginBottom: '0.5rem' }}>เลือกเซ็ตที่ต้องการ</h2>
      <p style={{ color: '#64748b', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
        เราจะแนะนำกล่องและขนมที่เหมาะสมกับเซ็ตที่คุณเลือก
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {sets.map(set => (
          <button
            key={set.id}
            onClick={() => onSelect(set)}
            style={{
              backgroundColor: '#fff',
              border: selectedSetId === set.id ? '2px solid #db2777' : '1px solid #e2e8f0',
              borderRadius: '16px',
              padding: '1.25rem',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              cursor: 'pointer',
              transition: 'all 0.2s',
              boxShadow: selectedSetId === set.id ? '0 4px 12px rgba(219, 39, 119, 0.1)' : '0 2px 4px rgba(0,0,0,0.02)',
              textAlign: 'left',
              width: '100%'
            }}
          >
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#1e293b', marginBottom: '0.25rem' }}>
                {set.name}
              </div>
              <div style={{ fontSize: '0.85rem', color: '#64748b' }}>
                ขนม {set.dessert_qty} ชิ้น{set.drink_qty > 0 ? ` + เครื่องดื่ม ${set.drink_qty} ขวด` : ''}
              </div>
            </div>
            <div style={{ 
              backgroundColor: selectedSetId === set.id ? '#db2777' : '#fdf2f8', 
              color: selectedSetId === set.id ? '#fff' : '#db2777', 
              padding: '0.75rem 1.25rem', 
              borderRadius: '12px', 
              fontWeight: 'bold', 
              fontSize: '1.25rem',
              whiteSpace: 'nowrap'
            }}>
              {set.set_price}฿
            </div>
          </button>
        ))}
        {sets.length === 0 && (
          <div style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8', backgroundColor: '#f8fafc', borderRadius: '16px', border: '1px dashed #cbd5e1' }}>
            ยังไม่มีเซ็ตราคาในระบบ กรุณาติดต่อร้านค้า
          </div>
        )}
      </div>
    </div>
  );
}

