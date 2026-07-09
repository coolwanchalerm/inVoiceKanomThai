import React, { useState, useEffect } from 'react';
import { LayoutDashboard, Receipt, Loader2, History, Package, Plus, Home, BarChart2 } from 'lucide-react';
import { supabase } from './supabaseClient';
import InvoiceGenerator from './components/InvoiceGenerator';
import Dashboard from './components/Dashboard';
import InvoiceHistory from './components/InvoiceHistory';
import PrintLayout from './components/PrintLayout';
import Modal from './components/Modal';
import LoadingOverlay from './components/LoadingOverlay';
import ProductManager from './components/ProductManager';
import BackupManager from './components/BackupManager';

export default function App() {
  const [view, setView] = useState('generator');
  
  const [dbInvoices, setDbInvoices] = useState([]);
  const [dbItems, setDbItems] = useState([]);
  const [dbProducts, setDbProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncStatus, setSyncStatus] = useState('idle'); // 'idle' | 'success' | 'error'

  const [printInvoice, setPrintInvoice] = useState(null);
  const [printItems, setPrintItems] = useState([]);
  
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

  // Sync data from Supabase
  const fetchData = async () => {
    setLoading(true);
    try {
      const [invoicesRes, itemsRes, productsRes] = await Promise.all([
        supabase.from('invoices').select('*').order('created_at', { ascending: false }),
        supabase.from('invoice_items').select('*'),
        supabase.from('products').select('*').order('created_at', { ascending: false })
      ]);

      if (invoicesRes.error) throw invoicesRes.error;
      if (itemsRes.error) throw itemsRes.error;
      if (productsRes.error) throw productsRes.error;

      // Map Supabase snake_case to camelCase where necessary
      const formattedInvoices = invoicesRes.data.map(inv => ({
        id: inv.id,
        date: inv.date,
        customerName: inv.customer_name,
        customerAddress: inv.customer_address,
        customerTaxId: inv.customer_tax_id,
        totalAmount: inv.total_amount,
        printedStatus: inv.printed_status,
        createdAt: inv.created_at
      }));

      const formattedItems = itemsRes.data.map(item => ({
        id: item.id,
        invoiceId: item.invoice_id,
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unit_price,
        amount: item.amount
      }));

      setDbInvoices(formattedInvoices);
      setDbItems(formattedItems);
      setDbProducts(productsRes.data || []);
      setSyncStatus('success');
    } catch (error) {
      console.error('Failed to fetch from Supabase:', error);
      setSyncStatus('error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const invoices = dbInvoices;
  const items = dbItems;

  const topProducts = React.useMemo(() => {
    const freq = {};
    items.forEach(item => {
      freq[item.description] = (freq[item.description] || 0) + item.quantity;
    });
    const sortedDesc = Object.keys(freq).sort((a, b) => freq[b] - freq[a]);
    const top5Names = sortedDesc.slice(0, 5);
    
    return top5Names.map(name => {
      const productObj = dbProducts.find(p => p.name === name);
      if (productObj) return { description: name, unitPrice: productObj.price };
      const recentItem = items.find(i => i.description === name);
      return { description: name, unitPrice: recentItem ? recentItem.unitPrice : 0 };
    });
  }, [items, dbProducts]);

  const uniqueCustomers = React.useMemo(() => {
    const custMap = {};
    invoices.forEach(inv => {
      if (inv.customerName && !custMap[inv.customerName]) {
        custMap[inv.customerName] = {
          name: inv.customerName,
          address: inv.customerAddress || '',
          taxId: inv.customerTaxId || ''
        };
      }
    });
    return Object.values(custMap);
  }, [invoices]);

  const handleManageProduct = async (subAction, product) => {
    setLoadingMessage('กำลังบันทึกข้อมูลสินค้า...');
    setIsOverlayLoading(true);
    try {
      if (subAction === 'add') {
        const { error } = await supabase.from('products').insert([
          { name: product.name, price: product.price }
        ]);
        if (error) throw error;
      } else if (subAction === 'edit') {
        const { error } = await supabase.from('products').update({ name: product.name, price: product.price }).eq('id', product.id);
        if (error) throw error;
      } else if (subAction === 'delete') {
        const { error } = await supabase.from('products').delete().eq('id', product.id);
        if (error) throw error;
      }
      await fetchData(); 
    } catch (error) {
      console.error(error);
      showModal('เกิดข้อผิดพลาด', 'ไม่สามารถจัดการสินค้าได้: ' + error.message, 'error');
    } finally {
      setIsOverlayLoading(false);
    }
  };

  const handleCreateInvoice = async (invoice, invoiceItems) => {
    setLoadingMessage('กำลังบันทึกลงระบบฐานข้อมูล...');
    setIsOverlayLoading(true);
    try {
      // 1. Insert Invoice
      const { error: invError } = await supabase.from('invoices').insert([{
        id: invoice.id,
        date: invoice.date,
        customer_name: invoice.customerName,
        customer_address: invoice.customerAddress || "",
        customer_tax_id: invoice.customerTaxId || "",
        total_amount: invoice.totalAmount,
        printed_status: false
      }]);
      if (invError) throw invError;

      // 2. Insert Items
      const itemsToInsert = invoiceItems.map(item => ({
        invoice_id: invoice.id,
        description: item.description,
        quantity: item.quantity,
        unit_price: item.unitPrice,
        amount: item.amount
      }));

      const { error: itemsError } = await supabase.from('invoice_items').insert(itemsToInsert);
      if (itemsError) throw itemsError;
      
      await fetchData();
      
      // Prepare state for printing
      setPrintInvoice(invoice);
      setPrintItems(invoiceItems);
      
      setTimeout(() => {
        window.print();
      }, 500);
      
    } catch (err) {
      console.error('Error saving to Supabase:', err);
      showModal('เกิดข้อผิดพลาดในการบันทึกข้อมูล', err.message, 'error');
    } finally {
      setIsOverlayLoading(false);
    }
  };

  const handlePrintInvoice = (invoiceId) => {
    const invoice = invoices.find(inv => inv.id === invoiceId);
    if (!invoice) return;
    const invoiceItems = items.filter(item => item.invoiceId === invoiceId);
    setPrintInvoice(invoice);
    setPrintItems(invoiceItems);
    setTimeout(() => {
      window.print();
    }, 100);
  };

  const handleDeleteInvoice = (invoiceId) => {
    showModal(
      'ยืนยันการลบใบเสร็จ',
      `คุณแน่ใจหรือไม่ว่าต้องการลบใบเสร็จเลขที่ ${invoiceId} ? ข้อมูลจะถูกลบออกจากระบบแบบถาวร`,
      'delete',
      async () => {
        setLoadingMessage('กำลังลบใบเสร็จออกจากระบบ...');
        setIsOverlayLoading(true);

        try {
          const { error } = await supabase.from('invoices').delete().eq('id', invoiceId);
          if (error) throw error;
          
          await fetchData();
          showModal('ลบสำเร็จ', 'ใบเสร็จถูกลบออกจากระบบเรียบร้อยแล้ว', 'success');
        } catch (err) {
          console.error('Error deleting invoice:', err);
          showModal('เกิดข้อผิดพลาดในการลบข้อมูล', err.message, 'error');
        } finally {
          setIsOverlayLoading(false);
        }
      },
      () => {}, // onCancel do nothing
      'ยืนยันการลบ',
      'ยกเลิก'
    );
  };

  const handleTogglePrintStatus = async (invoiceId, currentStatus) => {
    const newStatus = !currentStatus;
    
    // Optimistic UI update
    setDbInvoices(prev => prev.map(inv => 
      inv.id === invoiceId ? { ...inv, printedStatus: newStatus } : inv
    ));

    try {
      const { error } = await supabase
        .from('invoices')
        .update({ printed_status: newStatus })
        .eq('id', invoiceId);
        
      if (error) throw error;
    } catch (err) {
      // Revert on error
      setDbInvoices(prev => prev.map(inv => 
        inv.id === invoiceId ? { ...inv, printedStatus: currentStatus } : inv
      ));
      console.error('Error toggling print status:', err);
    }
  };

  const handleDeleteDataByPeriod = (year, month) => {
    const THAI_MONTH_NAMES = [
      'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
      'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
    ];
    const monthName = month === 'all' ? 'ทุกเดือน' : THAI_MONTH_NAMES[parseInt(month)];
    const yearStr = year === 'all' ? 'ทุกปี' : parseInt(year) + 543;
    
    showModal(
      'ยืนยันการลบข้อมูล',
      `คุณแน่ใจหรือไม่ว่าต้องการลบข้อมูลใบเสร็จของ "${monthName} ปี ${yearStr}" ? ข้อมูลจะถูกลบออกจากฐานข้อมูลแบบถาวรและไม่สามารถกู้คืนได้ (กรุณาดาวน์โหลดสำรองข้อมูลก่อนลบ)`,
      'delete',
      async () => {
        setLoadingMessage('กำลังลบข้อมูล...');
        setIsOverlayLoading(true);
        try {
          const invoicesToDelete = dbInvoices.filter(inv => {
            if (!inv.date) return false;
            const d = new Date(inv.date);
            if (isNaN(d.getTime())) return false;
            const invYear = d.getFullYear().toString();
            const invMonth = d.getMonth().toString();
            const matchYear = year === 'all' || invYear === year;
            const matchMonth = month === 'all' || invMonth === month;
            return matchYear && matchMonth;
          });

          if (invoicesToDelete.length === 0) {
            showModal('แจ้งเตือน', 'ไม่มีข้อมูลในเดือน/ปี ที่ระบุ', 'info');
            return;
          }

          const invoiceIds = invoicesToDelete.map(inv => inv.id);

          const { error: itemsError } = await supabase.from('invoice_items').delete().in('invoice_id', invoiceIds);
          if (itemsError) throw itemsError;

          const { error: invError } = await supabase.from('invoices').delete().in('id', invoiceIds);
          if (invError) throw invError;

          await fetchData();
          showModal('ลบสำเร็จ', `ลบข้อมูล ${invoicesToDelete.length} รายการ เรียบร้อยแล้ว`, 'success');
        } catch (err) {
          console.error('Error deleting data:', err);
          showModal('เกิดข้อผิดพลาด', err.message, 'error');
        } finally {
          setIsOverlayLoading(false);
        }
      },
      () => {},
      'ยืนยันการลบ',
      'ยกเลิก'
    );
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
            <img src="/logo.jpg" alt="โลโก้ร้าน" style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover' }} />
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
              <BarChart2 size={20} />
              สรุปยอดขาย
            </li>
            <li 
              className={`menu-item ${view === 'products' ? 'active' : ''}`}
              onClick={() => setView('products')}
            >
              <Package size={20} />
              รายการขนม
            </li>
          </ul>

          <div className="sidebar-footer">
            <div>ระบบออกใบเสร็จ (Supabase)</div>
            <div style={{ marginTop: '4px', opacity: 0.7 }}>v2.0.0</div>
          </div>
        </aside>

        {/* Main Content */}
        <main className="main-content">
          <header className="page-header">
            <div>
              <h1 className="page-title">
                {view === 'generator' && 'ออกใบเสร็จรับเงิน'}
                {view === 'history' && 'ประวัติการออกใบเสร็จ'}
                {view === 'dashboard' && 'สรุปยอดขาย'}
                {view === 'products' && 'รายการขนม'}
                {view === 'backup' && 'จัดการข้อมูล (Backup)'}
              </h1>
            </div>

            {/* Sync Status Badge - Show only on loading or error */}
            {(loading || syncStatus !== 'success') && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', backgroundColor: '#f8d7da', color: '#842029', padding: '0.4rem 0.8rem', borderRadius: '20px', fontWeight: '600' }}>
                {loading ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    <span>กำลังดึงข้อมูลฐานข้อมูล...</span>
                  </>
                ) : (
                  <>
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#dc3545' }}></span>
                    <span>การเชื่อมต่อผิดพลาด</span>
                  </>
                )}
              </div>
            )}
          </header>

          {/* Main Views */}
          {view === 'generator' && (
            <InvoiceGenerator 
              onSubmitInvoice={handleCreateInvoice} 
              products={dbProducts}
              topProducts={topProducts}
              customers={uniqueCustomers}
            />
          )}

          {view === 'history' && (
            <InvoiceHistory 
              invoices={invoices} 
              onDelete={handleDeleteInvoice}
              onPrint={handlePrintInvoice}
              onTogglePrint={handleTogglePrintStatus}
            />
          )}

          {view === 'dashboard' && (
            <Dashboard 
              invoices={invoices} 
              items={items}
              onNavigateToBackup={() => setView('backup')}
            />
          )}

          {view === 'backup' && (
            <BackupManager
              invoices={invoices}
              items={items}
              onDeleteData={handleDeleteDataByPeriod}
              onBack={() => setView('dashboard')}
            />
          )}

          {view === 'products' && (
            <ProductManager 
              products={dbProducts}
              onManageProduct={handleManageProduct}
            />
          )}

        </main>
        
        {/* Bottom Navigation for Mobile */}
        <nav className="bottom-nav">
          <button 
            className={`bottom-nav-item ${view === 'generator' ? 'active' : ''}`}
            onClick={() => setView('generator')}
          >
            <Home className="icon" />
            <span>หน้าหลัก</span>
          </button>
          
          <button 
            className={`bottom-nav-item ${view === 'products' ? 'active' : ''}`}
            onClick={() => setView('products')}
          >
            <Package className="icon" />
            <span>รายการขนม</span>
          </button>

          <div className="bottom-nav-fab-wrapper">
            <button 
              className="bottom-nav-fab"
              onClick={() => setView('generator')}
            >
              <Plus className="icon" />
            </button>
          </div>

          <button 
            className={`bottom-nav-item ${view === 'history' ? 'active' : ''}`}
            onClick={() => setView('history')}
          >
            <History className="icon" />
            <span>ประวัติ</span>
          </button>

          <button 
            className={`bottom-nav-item ${view === 'dashboard' ? 'active' : ''}`}
            onClick={() => setView('dashboard')}
          >
            <LayoutDashboard className="icon" />
            <span>สถิติ</span>
          </button>
        </nav>
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
