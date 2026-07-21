import React, { useState } from 'react';
import { ArrowLeft, Plus, Minus, Info } from 'lucide-react';

export default function Step3Desserts({ 
  desserts, 
  drinks, 
  selectedDesserts, 
  onChange, 
  dessertCapacity, 
  drinkCapacity, 
  onNext, 
  onBack 
}) {
  const [activeSubTab, setActiveSubTab] = useState('dessert'); // 'dessert' or 'drink'

  const selectedDessertsOnly = selectedDesserts.filter(d => d.category !== 'drink');
  const selectedDrinksOnly = selectedDesserts.filter(d => d.category === 'drink');

  const currentDessertCount = selectedDessertsOnly.reduce((sum, item) => sum + item.quantity, 0);
  const currentDrinkCount = selectedDrinksOnly.reduce((sum, item) => sum + item.quantity, 0);

  const remainingDesserts = dessertCapacity - currentDessertCount;
  const remainingDrinks = drinkCapacity - currentDrinkCount;

  const totalCapacity = dessertCapacity + drinkCapacity;
  const totalSelected = currentDessertCount + currentDrinkCount;

  const handleUpdateQuantity = (item, delta) => {
    const isDrink = item.category === 'drink';
    const remaining = isDrink ? remainingDrinks : remainingDesserts;

    const existing = selectedDesserts.find(d => d.id === item.id);
    let currentQty = existing ? existing.quantity : 0;
    
    if (delta > 0 && remaining <= 0) return; // Reached max for this category
    if (delta < 0 && currentQty === 0) return; // Reached min

    const newQty = currentQty + delta;
    
    let newSelection = [...selectedDesserts];
    if (newQty === 0) {
      newSelection = newSelection.filter(d => d.id !== item.id);
    } else if (existing) {
      newSelection = newSelection.map(d => d.id === item.id ? { ...d, quantity: newQty } : d);
    } else {
      newSelection.push({ ...item, quantity: 1 });
    }
    
    onChange(newSelection);
  };

  // Decide what products to show
  const currentItems = activeSubTab === 'drink' ? drinks : desserts;
  const currentRemaining = activeSubTab === 'drink' ? remainingDrinks : remainingDesserts;
  const currentCapacity = activeSubTab === 'drink' ? drinkCapacity : dessertCapacity;
  const currentSelectedCount = activeSubTab === 'drink' ? currentDrinkCount : currentDessertCount;

  return (
    <div style={{ animation: 'fadeIn 0.3s' }}>
      <button 
        onClick={onBack}
        style={{ background: '#f1f5f9', border: '1px solid #e2e8f0', color: '#475569', display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', padding: '0.6rem 1rem', marginBottom: '1rem', borderRadius: '10px', fontWeight: '500', fontSize: '0.9rem' }}
      >
        <ArrowLeft size={18} /> ย้อนกลับ
      </button>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.25rem', color: '#1e293b', margin: '0 0 0.25rem 0' }}>จัดกล่องขนม</h2>
          <p style={{ color: '#64748b', fontSize: '0.9rem', margin: 0 }}>
            เลือกของว่างลงกล่องตามเงื่อนไขเซ็ต
          </p>
        </div>
        <div style={{ 
          backgroundColor: totalSelected === totalCapacity ? '#dcfce7' : '#166534', 
          color: totalSelected === totalCapacity ? '#166534' : '#fff', 
          padding: '0.5rem 1rem', 
          borderRadius: '20px', 
          fontWeight: 'bold',
          fontSize: '0.9rem',
          whiteSpace: 'nowrap'
        }}>
          {totalSelected === totalCapacity ? 'เลือกครบแล้ว ✨' : `เลือกแล้ว ${totalSelected}/${totalCapacity} ชิ้น`}
        </div>
      </div>

      {/* Sub-tabs for Desserts and Drinks if drinkCapacity > 0 */}
      {drinkCapacity > 0 && (
        <div style={{ display: 'flex', borderBottom: '2px solid #e2e8f0', marginBottom: '1.5rem', gap: '1.5rem' }}>
          <button 
            onClick={() => setActiveSubTab('dessert')}
            style={{ 
              padding: '0.75rem 0.5rem', 
              background: 'none', 
              border: 'none', 
              borderBottom: activeSubTab === 'dessert' ? '3px solid #db2777' : '3px solid transparent',
              color: activeSubTab === 'dessert' ? '#db2777' : '#64748b',
              fontWeight: 'bold',
              fontSize: '1rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.25rem'
            }}
          >
            หมวดขนม ({currentDessertCount}/{dessertCapacity})
          </button>
          <button 
            onClick={() => setActiveSubTab('drink')}
            style={{ 
              padding: '0.75rem 0.5rem', 
              background: 'none', 
              border: 'none', 
              borderBottom: activeSubTab === 'drink' ? '3px solid #db2777' : '3px solid transparent',
              color: activeSubTab === 'drink' ? '#db2777' : '#64748b',
              fontWeight: 'bold',
              fontSize: '1rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.25rem'
            }}
          >
            หมวดเครื่องดื่ม ({currentDrinkCount}/{drinkCapacity})
          </button>
        </div>
      )}

      {/* List info */}
      <div style={{ marginBottom: '1rem', fontSize: '0.85rem', color: '#64748b', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>กำลังเลือก: {activeSubTab === 'drink' ? 'เครื่องดื่ม' : 'ขนม'}</span>
        <span style={{ fontWeight: 'bold', color: currentRemaining === 0 ? '#166534' : '#db2777' }}>
          {currentRemaining === 0 ? 'หมวดนี้เลือกครบแล้ว' : `เลือกหมวดนี้ได้อีก ${currentRemaining} ชิ้น`}
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem', paddingBottom: '100px' }}>
        {currentItems.map(item => {
          const selected = selectedDesserts.find(d => d.id === item.id);
          const qty = selected ? selected.quantity : 0;
          
          return (
            <div key={item.id} style={{ 
              backgroundColor: '#fff', 
              borderRadius: '16px', 
              overflow: 'hidden', 
              border: qty > 0 ? '2px solid #db2777' : '1px solid #e2e8f0',
              boxShadow: qty > 0 ? '0 4px 12px rgba(219, 39, 119, 0.15)' : '0 2px 4px rgba(0,0,0,0.02)',
              transition: 'all 0.2s',
              position: 'relative'
            }}>
              <div style={{ width: '100%', aspectRatio: '1', backgroundColor: '#f1f5f9', position: 'relative' }}>
                <img src={item.image} alt={item.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                
                {/* Price Badge */}
                <div style={{ position: 'absolute', bottom: '8px', right: '8px', backgroundColor: 'rgba(255,255,255,0.9)', padding: '2px 8px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 'bold', color: '#db2777' }}>
                  {item.price}฿
                </div>

                {/* Selected Badge */}
                {qty > 0 && (
                  <div style={{ position: 'absolute', top: '8px', right: '8px', backgroundColor: '#db2777', color: '#fff', width: '28px', height: '28px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '0.9rem', boxShadow: '0 2px 4px rgba(0,0,0,0.2)' }}>
                    {qty}
                  </div>
                )}
              </div>
              <div style={{ padding: '0.75rem' }}>
                <h3 style={{ margin: '0 0 0.75rem 0', fontSize: '0.95rem', color: '#1e293b', textAlign: 'center' }}>{item.name}</h3>
                
                {qty === 0 ? (
                  <button 
                    onClick={() => handleUpdateQuantity(item, 1)}
                    disabled={currentRemaining === 0}
                    style={{ 
                      width: '100%', 
                      padding: '0.6rem', 
                      backgroundColor: currentRemaining === 0 ? '#f1f5f9' : '#db2777', 
                      color: currentRemaining === 0 ? '#cbd5e1' : '#fff',
                      border: 'none', 
                      borderRadius: '10px', 
                      fontWeight: 'bold',
                      fontSize: '0.9rem',
                      cursor: currentRemaining === 0 ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.25rem'
                    }}
                  >
                    <Plus size={16} /> เลือก
                  </button>
                ) : (
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button 
                      onClick={() => handleUpdateQuantity(item, -1)}
                      style={{ 
                        flex: '0 0 40px',
                        padding: '0.6rem 0', 
                        backgroundColor: '#fef2f2', 
                        color: '#ef4444',
                        border: 'none', 
                        borderRadius: '10px', 
                        fontWeight: 'bold',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                    >
                      <Minus size={16} />
                    </button>
                    <button 
                      onClick={() => handleUpdateQuantity(item, 1)}
                      disabled={currentRemaining === 0}
                      style={{ 
                        flex: 1,
                        padding: '0.6rem', 
                        backgroundColor: currentRemaining === 0 ? '#f1f5f9' : '#fdf2f8', 
                        color: currentRemaining === 0 ? '#cbd5e1' : '#db2777',
                        border: 'none', 
                        borderRadius: '10px', 
                        fontWeight: 'bold',
                        fontSize: '0.9rem',
                        cursor: currentRemaining === 0 ? 'not-allowed' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.25rem'
                      }}
                    >
                      <Plus size={16} /> เพิ่มอีก
                    </button>
                  </div>
                )}
              </div>
            </div>
          )
        })}
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
            onClick={onNext}
            disabled={totalSelected !== totalCapacity}
            style={{
              width: '100%',
              padding: '1rem',
              backgroundColor: totalSelected !== totalCapacity ? '#cbd5e1' : '#db2777',
              color: '#fff',
              border: 'none',
              borderRadius: '12px',
              fontSize: '1.1rem',
              fontWeight: 'bold',
              cursor: totalSelected !== totalCapacity ? 'not-allowed' : 'pointer',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              gap: '0.5rem'
            }}
          >
            {totalSelected === totalCapacity ? 'ดูสรุปตะกร้าสินค้า' : `เลือกให้ครบก่อน (เลือกแล้ว ${totalSelected}/${totalCapacity})`}
          </button>
          {totalSelected < totalCapacity && totalSelected > 0 && (
             <div style={{ textAlign: 'center', fontSize: '0.8rem', color: '#ef4444', marginTop: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.25rem' }}>
                <Info size={14} />
                {remainingDesserts > 0 && <span>เลือกขนมอีก {remainingDesserts} ชิ้น</span>}
                {remainingDesserts > 0 && remainingDrinks > 0 && <span> / </span>}
                {remainingDrinks > 0 && <span>เลือกเครื่องดื่มอีก {remainingDrinks} ขวด</span>}
             </div>
          )}
        </div>
      </div>
    </div>
  );
}
