import React, { useState, useEffect } from 'react';
import { Package, Loader2 } from 'lucide-react';
import { supabase } from '../../supabaseClient';
import Step1Price from './Step1Price';
import Step2Package from './Step2Package';
import Step3Desserts from './Step3Desserts';
import OrderSummary from './OrderSummary';

export default function OrderWizard() {
  const [step, setStep] = useState(1);
  const [selectedBudget, setSelectedBudget] = useState(null); // This is now the selected Set
  const [selectedPackage, setSelectedPackage] = useState(null); // The selected Box
  const [selectedDesserts, setSelectedDesserts] = useState([]);
  const [boxQuantity, setBoxQuantity] = useState(1);

  const [loading, setLoading] = useState(true);
  const [dbSets, setDbSets] = useState([]);
  const [dbBoxes, setDbBoxes] = useState([]);
  const [dbProducts, setDbProducts] = useState([]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    const [setsRes, boxesRes, productsRes] = await Promise.all([
      supabase.from('price_sets').select('*').order('set_price', { ascending: true }),
      supabase.from('box_types').select('*'),
      supabase.from('products').select('*').order('name', { ascending: true })
    ]);

    if (!setsRes.error) setDbSets(setsRes.data);
    if (!boxesRes.error) setDbBoxes(boxesRes.data);
    if (!productsRes.error) setDbProducts(productsRes.data);
    
    setLoading(false);
  };

  const handleNextStep = () => setStep(s => s + 1);
  const handlePrevStep = () => setStep(s => s - 1);

  const renderStep = () => {
    if (loading) {
      return <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem', color: '#db2777' }}><Loader2 className="animate-spin" size={32} /></div>;
    }

    switch(step) {
      case 1:
        return <Step1Price 
                 sets={dbSets} 
                 selectedSetId={selectedBudget?.id} 
                 onSelect={(set) => { 
                   setSelectedBudget(set); 
                   setSelectedPackage(null); // Reset downstream selections
                   setSelectedDesserts([]);
                   setBoxQuantity(1);
                   handleNextStep(); 
                 }} 
               />;
      case 2:
        // Filter boxes based on selected Set's allowed_boxes
        const allowedBoxIds = selectedBudget?.allowed_boxes || [];
        const availableBoxes = dbBoxes.filter(b => allowedBoxIds.includes(b.id));

        return <Step2Package 
                 packages={availableBoxes} 
                 selectedPackage={selectedPackage} 
                 onSelect={(p) => { setSelectedPackage(p); handleNextStep(); }} 
                 onBack={handlePrevStep} 
               />;
      case 3:
        // Filter desserts based on allowed_dessert_max_price
        const maxPrice = selectedBudget?.allowed_dessert_max_price || 999;
        const availableDesserts = dbProducts
          .filter(p => (p.category !== 'drink') && p.price <= maxPrice)
          .map(p => ({
            ...p,
            image: p.image_url || 'https://images.unsplash.com/photo-1605807646983-377bc5a76493?auto=format&fit=crop&q=80&w=200&h=200'
          }));

        const availableDrinks = dbProducts
          .filter(p => p.category === 'drink')
          .map(p => ({
            ...p,
            image: p.image_url || 'https://images.unsplash.com/photo-1551024601-bec78aea704b?auto=format&fit=crop&q=80&w=200&h=200'
          }));

        const dessertCapacity = selectedBudget?.dessert_qty || 0;
        const drinkCapacity = selectedBudget?.drink_qty || 0;

        return <Step3Desserts 
                 desserts={availableDesserts} 
                 drinks={availableDrinks}
                 selectedDesserts={selectedDesserts}
                 onChange={setSelectedDesserts}
                 dessertCapacity={dessertCapacity}
                 drinkCapacity={drinkCapacity}
                 onNext={handleNextStep}
                 onBack={handlePrevStep}
               />;
      case 4:
        return <OrderSummary 
                 selectedPackage={selectedPackage}
                 selectedSet={selectedBudget}
                 selectedDesserts={selectedDesserts}
                 boxQuantity={boxQuantity}
                 onUpdateBoxQuantity={setBoxQuantity}
                 onBack={handlePrevStep}
                 onConfirm={() => {
                   // Calculate Total
                   const total = (selectedBudget?.set_price || 0) * boxQuantity;
                   
                   // Format text for Line
                   let text = `สวัสดีค่ะ ต้องการสั่งเซ็ตขนมค่ะ\n\n`;
                   text += `🌟 รูปแบบ: ${selectedBudget?.name} (${selectedBudget?.set_price}฿/กล่อง)\n`;
                   text += `📦 กล่อง: ${selectedPackage?.box_code ? `[${selectedPackage.box_code}] ` : ''}${selectedPackage?.name}\n`;
                   text += `✅ จำนวนที่สั่ง: ${boxQuantity} กล่อง\n`;
                   text += `รายการขนม (ต่อ 1 กล่อง):\n`;
                   selectedDesserts.forEach(d => {
                     text += `- ${d.name} x${d.quantity}\n`;
                   });
                   text += `\n💰 ยอดรวม: ${total} บาท`;
                   
                   const encodedText = encodeURIComponent(text);
                   // Open Line
                   window.open(`https://line.me/R/msg/text/?${encodedText}`, '_blank');
                 }}
               />;
      default:
        return null;
    }
  };

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto', minHeight: '100vh', backgroundColor: '#f8fafc', paddingBottom: '100px' }}>
      {/* Header */}
      <div style={{ 
        backgroundColor: '#fff', 
        padding: '1rem', 
        borderBottom: '1px solid #e2e8f0',
        position: 'sticky',
        top: 0,
        zIndex: 10,
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
        boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
      }}>
        <div style={{ backgroundColor: '#fdf2f8', padding: '0.5rem', borderRadius: '12px', color: '#db2777' }}>
          <Package size={24} />
        </div>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.25rem', color: '#1e293b' }}>สั่งขนมออนไลน์</h1>
          <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b' }}>
            ขั้นตอนที่ {step} จาก 4
          </p>
        </div>
      </div>
      
      {/* Progress Bar */}
      <div style={{ height: '4px', backgroundColor: '#e2e8f0', width: '100%' }}>
        <div style={{ 
          height: '100%', 
          backgroundColor: '#db2777', 
          width: `${(step / 4) * 100}%`,
          transition: 'width 0.3s ease'
        }} />
      </div>

      <div style={{ padding: '1.5rem' }}>
        {renderStep()}
      </div>
    </div>
  );
}
