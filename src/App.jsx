import React, { useState, useEffect } from 'react';
import { ClipboardCopy, LayoutDashboard, Settings, Receipt, Check, ExternalLink, HelpCircle, Loader2, History, Package } from 'lucide-react';
import InvoiceGenerator from './components/InvoiceGenerator';
import Dashboard from './components/Dashboard';
import InvoiceHistory from './components/InvoiceHistory';
import PrintLayout from './components/PrintLayout';
import Modal from './components/Modal';
import LoadingOverlay from './components/LoadingOverlay';
import ProductManager from './components/ProductManager';

export default function App() {
  const [view, setView] = useState('generator');
  const [scriptUrl, setScriptUrl] = useState(() => localStorage.getItem('invoice_script_url') || '');
  const [localInvoices, setLocalInvoices] = useState(() => JSON.parse(localStorage.getItem('invoices') || '[]'));
  const [localItems, setLocalItems] = useState(() => JSON.parse(localStorage.getItem('invoice_items') || '[]'));
  
  const [dbInvoices, setDbInvoices] = useState([]);
  const [dbItems, setDbItems] = useState([]);
  const [dbProducts, setDbProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [syncStatus, setSyncStatus] = useState('idle'); // 'idle' | 'success' | 'error'

  const [printInvoice, setPrintInvoice] = useState(null);
  const [printItems, setPrintItems] = useState([]);
  const [tempUrl, setTempUrl] = useState(scriptUrl);
  const [copied, setCopied] = useState(false);
  
  // UI States
  const [isOverlayLoading, setIsOverlayLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('กำลังโหลด...');
  const [modalConfig, setModalConfig] = useState({ isOpen: false, title: '', message: '', type: 'info' });

  const showModal = (title, message, type = 'info', onConfirm = null, onCancel = null, confirmText = 'ตกลง', cancelText = 'ยกเลิก') => {
    setModalConfig({ isOpen: true, title, message, type, onConfirm: () => {
      setModalConfig({ ...modalConfig, isOpen: false });
      if (onConfirm) onConfirm();
    }, onCancel: onCancel ? () => {
      setModalConfig({ ...modalConfig, isOpen: false });
      onCancel();
    } : null, confirmText, cancelText });
  };

  // Sync data from Google Sheet if Script URL is set
  const fetchData = async (urlToFetch = scriptUrl) => {
    if (!urlToFetch) return;
    setLoading(true);
    try {
      // Fetch with method=GET as standard query parameter
      const response = await fetch(`${urlToFetch}?method=GET`);
      const data = await response.json();
      if (data.status === 'success') {
        setDbInvoices(data.invoices || []);
        setDbItems(data.items || []);
        setDbProducts(data.products || []);
        setSyncStatus('success');
      } else {
        setSyncStatus('error');
      }
    } catch (error) {
      console.error('Failed to fetch from Google Sheet:', error);
      setSyncStatus('error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [scriptUrl]);

  // Combined Invoices and Items for the dashboard: prioritize DB if sync was successful, fallback to local otherwise
  const invoices = syncStatus === 'success' ? dbInvoices : localInvoices;
  const items = syncStatus === 'success' ? dbItems : localItems;

  // Calculate Top 5 best selling products based on historical frequency in items
  const topProducts = React.useMemo(() => {
    const freq = {};
    items.forEach(item => {
      freq[item.description] = (freq[item.description] || 0) + item.quantity;
    });
    const sortedDesc = Object.keys(freq).sort((a, b) => freq[b] - freq[a]);
    const top5Names = sortedDesc.slice(0, 5);
    
    // Map names back to product objects with prices
    return top5Names.map(name => {
      // Try to find price from DB products first
      const productObj = dbProducts.find(p => p.name === name);
      if (productObj) return { description: name, unitPrice: productObj.price };
      
      // Fallback: look at recent items to guess the price
      const recentItem = items.find(i => i.description === name);
      return { description: name, unitPrice: recentItem ? recentItem.unitPrice : 0 };
    });
  }, [items, dbProducts]);

  const handleSaveSettings = (e) => {
    e.preventDefault();
    localStorage.setItem('invoice_script_url', tempUrl);
    setScriptUrl(tempUrl);
    showModal('สำเร็จ', 'บันทึกการตั้งค่าลิงก์เรียบร้อยแล้ว!', 'success');
    fetchData(tempUrl);
  };

  const handleManageProduct = async (subAction, product) => {
    if (!scriptUrl) {
      showModal('แจ้งเตือน', 'กรุณาตั้งค่า Google Apps Script URL ก่อนจัดการสินค้า', 'error');
      return;
    }
    
    setLoadingMessage('กำลังบันทึกข้อมูลสินค้า...');
    setIsOverlayLoading(true);
    try {
      const payload = { subAction, product };
      const response = await fetch(`${scriptUrl}?method=GET&action=manageProduct&data=${encodeURIComponent(JSON.stringify(payload))}`);
      const data = await response.json();
      if (data.status === 'success') {
        fetchData(scriptUrl); // Refresh data
      } else {
        showModal('เกิดข้อผิดพลาด', data.message, 'error');
      }
    } catch (error) {
      console.error(error);
      showModal('เกิดข้อผิดพลาด', 'ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้', 'error');
    } finally {
      setIsOverlayLoading(false);
    }
  };

  const handleCreateInvoice = async (invoice, invoiceItems) => {
    // 1. Always save to localStorage as safety backup
    const newLocalInvoices = [invoice, ...localInvoices];
    const newLocalItems = [...invoiceItems.map(item => ({ ...item, invoiceId: invoice.id, date: invoice.date })), ...localItems];
    
    localStorage.setItem('invoices', JSON.stringify(newLocalInvoices));
    localStorage.setItem('invoice_items', JSON.stringify(newLocalItems));
    setLocalInvoices(newLocalInvoices);
    setLocalItems(newLocalItems);

    // 2. Prepare state for printing
    setPrintInvoice(invoice);
    setPrintItems(invoiceItems);

    // 3. Attempt to save to Google Apps Script if URL is configured
    if (scriptUrl) {
      setLoadingMessage('กำลังบันทึกและสร้าง PDF ลงระบบ...');
      setIsOverlayLoading(true);
      try {
        const payload = { invoice: invoice, items: invoiceItems };
        const response = await fetch(`${scriptUrl}?method=GET&action=createInvoice&data=${encodeURIComponent(JSON.stringify(payload))}`);
        const data = await response.json();
        
        setIsOverlayLoading(false);
        
        if (data.status === 'success' && data.pdfUrl) {
          // Update the locally stored invoice with the actual pdfUrl returned from Google Drive
          const updatedLocalInvoices = newLocalInvoices.map(inv => {
            if (inv.id === invoice.id) return { ...inv, pdfUrl: data.pdfUrl };
            return inv;
          });
          localStorage.setItem('invoices', JSON.stringify(updatedLocalInvoices));
          setLocalInvoices(updatedLocalInvoices);
        } else if (data.status === 'error') {
          showModal('เกิดข้อผิดพลาดจากฝั่ง Google', data.message, 'error');
        }
        
        // Refresh sales data to update stats
        fetchData();
      } catch (err) {
        setIsOverlayLoading(false);
        console.error('Error uploading to Google Sheet & Drive:', err);
        showModal('เกิดข้อผิดพลาดในการเชื่อมต่อ', err.message, 'error');
      }
    }

    // 4. Trigger browser print UI
    setTimeout(() => {
      window.print();
    }, 500);
  };

  const handleDeleteInvoice = (invoiceId) => {
    showModal(
      'ยืนยันการลบใบเสร็จ',
      `คุณแน่ใจหรือไม่ว่าต้องการลบใบเสร็จเลขที่ ${invoiceId} ? ข้อมูลจะถูกลบออกจากระบบและ Google Drive แบบถาวร`,
      'delete',
      async () => {
        setLoadingMessage('กำลังลบใบเสร็จออกจากระบบและ Google Drive...');
        setIsOverlayLoading(true);

        try {
          // Optimistically update UI
          const newLocalInvoices = localInvoices.filter(inv => inv.id !== invoiceId);
          const newLocalItems = localItems.filter(item => item.invoiceId !== invoiceId);
          localStorage.setItem('invoices', JSON.stringify(newLocalInvoices));
          localStorage.setItem('invoice_items', JSON.stringify(newLocalItems));
          setLocalInvoices(newLocalInvoices);
          setLocalItems(newLocalItems);

          if (scriptUrl) {
            const payload = { action: 'deleteInvoice', invoiceId };
            const response = await fetch(`${scriptUrl}?method=GET&action=deleteInvoice&data=${encodeURIComponent(JSON.stringify(payload))}`);
            const data = await response.json();
            
            setIsOverlayLoading(false);
            
            if (data.status === 'error') {
              showModal('เกิดข้อผิดพลาดในการลบใบเสร็จ', data.message, 'error');
            } else {
              showModal('ลบสำเร็จ', 'ใบเสร็จถูกลบออกจากระบบเรียบร้อยแล้ว', 'success');
            }
            
            // Refresh sales data
            fetchData();
          } else {
            setIsOverlayLoading(false);
            showModal('ลบสำเร็จ', 'ใบเสร็จถูกลบออกจากเครื่องเรียบร้อยแล้ว', 'success');
          }
        } catch (err) {
          setIsOverlayLoading(false);
          console.error('Error deleting invoice:', err);
          showModal('เกิดข้อผิดพลาดในการเชื่อมต่อ', err.message, 'error');
        }
      },
      () => {}, // onCancel do nothing
      'ยืนยันการลบ',
      'ยกเลิก'
    );
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(`// คัดลอกโค้ดจาก google-apps-script.js ไปวางใน Apps Script`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <>
      <LoadingOverlay isVisible={isOverlayLoading} message={loadingMessage} />
      <Modal 
        isOpen={modalConfig.isOpen}
        title={modalConfig.title}
        message={modalConfig.message}
        type={modalConfig.type}
        onConfirm={modalConfig.onConfirm}
        onCancel={modalConfig.onCancel}
        confirmText={modalConfig.confirmText}
        cancelText={modalConfig.cancelText}
      />

      {/* App Layout */}
      <div className="app-container">
        {/* Sidebar */}
        <aside className="sidebar">
          <div className="logo-section">
            <Receipt className="logo-icon" />
            <span className="logo-text">ขนมไทยแทนคุณ</span>
          </div>

          <ul className="menu-list">
            <li 
              className={`menu-item ${view === 'generator' ? 'active' : ''}`}
              onClick={() => setView('generator')}
            >
              <Receipt size={20} />
              ออกใบเสร็จ
            </li>
            <li 
              className={`menu-item ${view === 'history' ? 'active' : ''}`}
              onClick={() => setView('history')}
            >
              <History size={20} />
              ประวัติใบเสร็จ
            </li>
            <li 
              className={`menu-item ${view === 'dashboard' ? 'active' : ''}`}
              onClick={() => setView('dashboard')}
            >
              <LayoutDashboard size={20} />
              สรุปยอดขาย (สถิติ)
            </li>
            <li 
              className={`menu-item ${view === 'products' ? 'active' : ''}`}
              onClick={() => setView('products')}
            >
              <Package size={20} />
              จัดการสินค้า
            </li>
            <li 
              className={`menu-item ${view === 'settings' ? 'active' : ''}`}
              onClick={() => {
                if (view !== 'settings') {
                  const pwd = window.prompt('กรุณาใส่รหัสผ่านเพื่อเข้าสู่เมนูตั้งค่า:');
                  if (pwd === '14709') {
                    setView('settings');
                  } else if (pwd !== null) {
                    showModal('รหัสผ่านไม่ถูกต้อง', 'คุณไม่มีสิทธิ์เข้าถึงเมนูนี้', 'error');
                  }
                }
              }}
            >
              <Settings size={20} />
              ตั้งค่าระบบ
            </li>
          </ul>

          <div className="sidebar-footer">
            <div>ระบบออกใบเสร็จร้านขนมไทย</div>
            <div style={{ marginTop: '4px', opacity: 0.7 }}>v1.0.0</div>
          </div>
        </aside>

        {/* Main Content */}
        <main className="main-content">
          <header className="page-header">
            <div>
              <h1 className="page-title">
                {view === 'generator' && 'ระบบออกใบเสร็จรับเงิน'}
                {view === 'history' && 'ประวัติการออกใบเสร็จ'}
                {view === 'dashboard' && 'แดชบอร์ด & สรุปยอดขาย'}
                {view === 'settings' && 'ตั้งค่าระบบเชื่อมต่อ Google Sheet'}
              </h1>
              <p className="page-subtitle">
                {view === 'generator' && 'กรอกรายละเอียดเพื่อออกใบเสร็จและบันทึกข้อมูล'}
                {view === 'history' && 'ค้นหาและตรวจสอบใบเสร็จทั้งหมดที่บันทึกเข้าระบบ'}
                {view === 'dashboard' && 'วิเคราะห์ยอดขายและดูสินค้าขายดีประจำร้าน'}
                {view === 'settings' && 'เชื่อมโยงข้อมูลเข้ากับบัญชี Google Drive ของคุณ'}
              </p>
            </div>

            {/* Sync Status Badge */}
            {scriptUrl && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', backgroundColor: syncStatus === 'success' ? '#d1e7dd' : '#f8d7da', color: syncStatus === 'success' ? '#0f5132' : '#842029', padding: '0.4rem 0.8rem', borderRadius: '20px', fontWeight: '600' }}>
                {loading ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    <span>กำลังดึงข้อมูล...</span>
                  </>
                ) : (
                  <>
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: syncStatus === 'success' ? '#198754' : '#dc3545' }}></span>
                    <span>{syncStatus === 'success' ? 'เชื่อมต่อ Google Sheet แล้ว' : 'การเชื่อมต่อผิดพลาด'}</span>
                  </>
                )}
              </div>
            )}
          </header>

          {/* Main Views */}
          {view === 'generator' && (
            <InvoiceGenerator 
              onSubmitInvoice={handleCreateInvoice} 
              scriptUrl={scriptUrl} 
              products={dbProducts}
              topProducts={topProducts}
            />
          )}

          {view === 'history' && (
            <InvoiceHistory 
              invoices={invoices} 
              onDelete={handleDeleteInvoice}
            />
          )}

          {view === 'dashboard' && (
            <Dashboard 
              invoices={invoices} 
              items={items}
            />
          )}

          {view === 'products' && (
            <ProductManager 
              products={dbProducts}
              onManageProduct={handleManageProduct}
            />
          )}

          {view === 'settings' && (
            <div className="card">
              <h3 className="card-title">
                <Settings className="logo-icon" /> กำหนดค่า Google Web App URL
              </h3>
              
              <form onSubmit={handleSaveSettings}>
                <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                  <label htmlFor="scriptUrl">Google Apps Script Web App URL</label>
                  <input
                    type="url"
                    id="scriptUrl"
                    placeholder="https://script.google.com/macros/s/.../exec"
                    value={tempUrl}
                    onChange={(e) => setTempUrl(e.target.value)}
                    style={{ width: '100%' }}
                  />
                  <small style={{ color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                    *ลิงก์นี้จะได้จากการนำโค้ดในไฟล์ <strong>google-apps-script.js</strong> ไปติดตั้งในส่วนขยาย Apps Script บน Google Sheets
                  </small>
                </div>

                <div style={{ display: 'flex', gap: '1rem' }}>
                  <button type="submit" className="btn btn-primary">บันทึกการตั้งค่า</button>
                  {scriptUrl && (
                    <button type="button" className="btn btn-outline" onClick={() => fetchData()}>
                      ทดสอบเชื่อมต่อใหม่
                    </button>
                  )}
                </div>
              </form>

              <hr style={{ margin: '2.5rem 0', borderColor: 'var(--border-color)', borderWidth: '0.5px' }} />

              <h4 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', color: 'var(--primary-color)' }}>
                <HelpCircle size={18} /> วิธีการเชื่อมโยงระบบกับ Google Sheets
              </h4>
              
              <ol style={{ paddingLeft: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.95rem' }}>
                <li>สร้าง Google Sheet ขึ้นมาใหม่ 1 ไฟล์</li>
                <li>ไปที่แถบเมนูด้านบน เลือก <strong>ส่วนขยาย (Extensions)</strong> &gt; <strong>Apps Script</strong></li>
                <li>นำโค้ดจากไฟล์ <code>google-apps-script.js</code> ในโปรเจกต์นี้ไปวางแทนที่โค้ดเดิมทั้งหมดในไฟล์ Code.gs</li>
                <li>กดปุ่มบันทึก (แผ่นดิสก์) จากนั้นกดปุ่ม <strong>การทำให้ใช้งานได้ (Deploy)</strong> ด้านขวาบน &gt; <strong>การทำให้ใช้งานได้ใหม่ (New deployment)</strong></li>
                <li>เลือกประเภทเป็น <strong>เว็บแอป (Web app)</strong></li>
                <li>ตั้งค่ารายละเอียด:
                  <ul style={{ paddingLeft: '1.5rem', marginTop: '0.25rem', listStyleType: 'circle' }}>
                    <li>การกำหนดค่าผู้ใช้: เลือก <strong>"ฉัน" (Me)</strong></li>
                    <li>ผู้มีสิทธิ์เข้าถึง: เลือก <strong>"ทุกคน" (Anyone)</strong></li>
                  </ul>
                </li>
                <li>กดปุ่ม <strong>ทำให้ใช้งานได้ (Deploy)</strong> จากนั้นอนุญาตสิทธิ์เข้าถึง และคัดลอกลิงก์ <strong>URL ของเว็บแอป (Web App URL)</strong> มาใส่ในช่องด้านบนนี้</li>
              </ol>
            </div>
          )}
        </main>
      </div>

      {/* Hidden Print Layout (Activated on window.print()) */}
      {printInvoice && (
        <PrintLayout 
          invoice={printInvoice} 
          items={printItems} 
        />
      )}
    </>
  );
}
