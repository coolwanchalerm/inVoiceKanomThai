import React from 'react';
import { ArrowLeft, MessageCircle } from 'lucide-react';

export default function OrderSummary({ selectedPackage, selectedSet, selectedDesserts, boxQuantity, onUpdateBoxQuantity, onBack, onConfirm }) {
  const setPrice = selectedSet?.set_price || 0;
  const total = setPrice * boxQuantity;
  const totalPieces = selectedDesserts.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <div style={{ animation: 'fadeIn 0.3s', paddingBottom: '100px' }}>
      <button 
        onClick={onBack}
        style={{ background: '#f1f5f9', border: '1px solid #e2e8f0', color: '#475569', display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', padding: '0.6rem 1rem', marginBottom: '1.5rem', borderRadius: '10px', fontWeight: '500', fontSize: '0.9rem' }}
      >
        <ArrowLeft size={18} /> กลับไปแก้รายการ
      </button>

      <div style={{ backgroundColor: '#fff', borderRadius: '16px', padding: '1.5rem', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '1.25rem', color: '#1e293b', margin: '0 0 1rem 0', borderBottom: '1px dashed #e2e8f0', paddingBottom: '0.75rem' }}>
          สรุปรายการสั่งซื้อ
        </h2>
        
        {/* Package details */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', color: '#334155' }}>
          <div>
            <span style={{ fontWeight: '500' }}>เซ็ต: {selectedSet?.name}</span>
          </div>
          <div>{total}฿</div>
        </div>
        
        <div style={{ color: '#64748b', fontSize: '0.85rem', marginBottom: '1rem', paddingBottom: '1rem', borderBottom: '1px solid #f1f5f9' }}>
          กล่องที่ใช้: {selectedPackage?.box_code ? `[${selectedPackage.box_code}] ` : ''}{selectedPackage?.name} <br/>
          ความจุที่ได้: {selectedSet?.dessert_qty} ชิ้น (เลือกแล้ว {totalPieces} ชิ้น)
        </div>

        {/* Desserts List */}
        <h3 style={{ fontSize: '0.95rem', color: '#475569', margin: '0 0 0.5rem 0' }}>รายการขนม:</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.5rem' }}>
          {selectedDesserts.map(d => (
            <div key={d.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.95rem', color: '#334155' }}>
              <div>
                <span>{d.name}</span>
                <span style={{ color: '#94a3b8', marginLeft: '0.5rem' }}>x{d.quantity}</span>
              </div>
              <div style={{ color: '#94a3b8', fontSize: '0.85rem' }}>รวมในเซ็ต</div>
            </div>
          ))}
          {selectedDesserts.length === 0 && (
            <div style={{ color: '#94a3b8', fontStyle: 'italic', fontSize: '0.9rem' }}>ไม่ได้เลือกขนม</div>
          )}
        </div>

        {/* Box Quantity Selector */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.5rem', marginBottom: '1.5rem', padding: '1rem', backgroundColor: '#fdf2f8', borderRadius: '12px' }}>
          <div style={{ fontSize: '1rem', fontWeight: 'bold', color: '#db2777' }}>จำนวนที่สั่ง (กล่อง)</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', backgroundColor: '#fff', borderRadius: '8px', padding: '0.25rem', border: '1px solid #fbcfe8' }}>
            <button 
              onClick={() => onUpdateBoxQuantity(Math.max(1, boxQuantity - 1))}
              style={{ background: 'none', border: 'none', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#db2777' }}
            >
              -
            </button>
            <span style={{ fontWeight: 'bold', color: '#db2777', fontSize: '1.1rem', minWidth: '30px', textAlign: 'center' }}>{boxQuantity}</span>
            <button 
              onClick={() => onUpdateBoxQuantity(boxQuantity + 1)}
              style={{ background: 'none', border: 'none', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#db2777' }}
            >
              +
            </button>
          </div>
        </div>

        {/* Total */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '1rem', borderTop: '2px solid #f1f5f9' }}>
          <div>
            <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#1e293b' }}>ยอดรวมสุทธิ</div>
            <div style={{ fontSize: '0.85rem', color: '#64748b' }}>{setPrice}฿ x {boxQuantity} กล่อง</div>
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#db2777' }}>{total}฿</div>
        </div>
      </div>

      <div style={{ 
        position: 'fixed', 
        bottom: 0, 
        left: 0, 
        right: 0, 
        padding: '1rem', 
        backgroundColor: '#fff', 
        boxShadow: '0 -4px 12px rgba(0,0,0,0.05)',
        display: 'flex',
        justifyContent: 'center',
        zIndex: 50
      }}>
        <div style={{ width: '100%', maxWidth: '600px' }}>
          <button 
            onClick={onConfirm}
            style={{
              width: '100%',
              padding: '1rem',
              backgroundColor: '#06c755', // Line green color
              color: '#fff',
              border: 'none',
              borderRadius: '12px',
              fontSize: '1.1rem',
              fontWeight: 'bold',
              cursor: 'pointer',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              gap: '0.5rem'
            }}
          >
            <MessageCircle size={20} />
            สั่งซื้อผ่าน LINE
          </button>
        </div>
      </div>
    </div>
  );
}
