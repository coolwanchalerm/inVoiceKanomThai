import React from 'react';
import { ArrowLeft, Package } from 'lucide-react';

export default function Step2Package({ packages, selectedPackage, onSelect, onBack }) {
  return (
    <div style={{ animation: 'fadeIn 0.3s' }}>
      <button 
        onClick={onBack}
        style={{ background: '#f1f5f9', border: '1px solid #e2e8f0', color: '#475569', display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', padding: '0.6rem 1rem', marginBottom: '1rem', borderRadius: '10px', fontWeight: '500', fontSize: '0.9rem' }}
      >
        <ArrowLeft size={18} /> ย้อนกลับ
      </button>

      <h2 style={{ fontSize: '1.25rem', color: '#1e293b', marginBottom: '0.5rem' }}>เลือกรูปแบบกล่อง</h2>
      <p style={{ color: '#64748b', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
        เลือกรูปแบบกล่องที่ต้องการจัดขนม
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {packages.map(pkg => (
          <div
            key={pkg.id}
            onClick={() => onSelect(pkg)}
            style={{
              backgroundColor: '#fff',
              border: selectedPackage?.id === pkg.id ? '2px solid #db2777' : '1px solid #e2e8f0',
              borderRadius: '16px',
              overflow: 'hidden',
              display: 'flex',
              cursor: 'pointer',
              transition: 'all 0.2s',
              boxShadow: selectedPackage?.id === pkg.id ? '0 4px 12px rgba(219, 39, 119, 0.1)' : '0 2px 4px rgba(0,0,0,0.02)'
            }}
          >
            <div style={{ width: '120px', height: '120px', backgroundColor: '#fdf2f8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {pkg.image_url ? (
                <img src={pkg.image_url} alt={pkg.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <Package size={40} style={{ color: '#db2777', opacity: 0.5 }} />
              )}
            </div>
            <div style={{ padding: '1rem', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <h3 style={{ margin: '0 0 0.25rem 0', fontSize: '1.1rem', color: '#1e293b' }}>
                {pkg.box_code ? <span style={{ color: '#db2777', marginRight: '0.5rem' }}>[{pkg.box_code}]</span> : ''}
                {pkg.name}
              </h3>
              <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b' }}>ความจุ {pkg.capacity} ชิ้น</p>
            </div>
          </div>
        ))}
        {packages.length === 0 && (
          <div style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8', backgroundColor: '#f8fafc', borderRadius: '16px', border: '1px dashed #cbd5e1' }}>
            ไม่มีกล่องที่ตรงกับเซ็ตที่เลือก กรุณาย้อนกลับเลือกเซ็ตอื่น
          </div>
        )}
      </div>
    </div>
  );
}

