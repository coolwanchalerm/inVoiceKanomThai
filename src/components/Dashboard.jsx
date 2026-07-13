import React, { useMemo, useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { DollarSign, FileText, ShoppingBag, TrendingUp, Search, Filter, Database, AlertTriangle, ArrowRight } from 'lucide-react';
import { supabase } from '../supabaseClient';

const COLORS = ['#1e3a2b', '#c5a880', '#5c8065', '#d4c5b9', '#3e5c46', '#e5dcd3'];

const THAI_MONTH_NAMES = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
];

export default function Dashboard({ invoices = [], items = [], onNavigateToBackup }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedYear, setSelectedYear] = useState('all');
  const [selectedMonth, setSelectedMonth] = useState('all');
  const [quickDateFilter, setQuickDateFilter] = useState('all'); // 'all', 'today', 'tomorrow'
  
  
  const [dbSize, setDbSize] = useState(null);

  useEffect(() => {
    async function checkDbSize() {
      try {
        const { data, error } = await supabase.rpc('get_db_size');
        if (error) throw error;
        if (data !== null) {
          setDbSize(data);
        }
      } catch (err) {
        console.error("Error fetching DB size:", err);
      }
    }
    checkDbSize();
  }, []);

  const DB_LIMIT_BYTES = 500 * 1024 * 1024; // 500 MB
  const dbUsagePercent = dbSize !== null ? (dbSize / DB_LIMIT_BYTES) * 100 : 0;
  const isDbWarning = dbUsagePercent > 80;

  // Extract unique years from invoices for the filter dropdown
  const uniqueYears = useMemo(() => {
    const years = new Set();
    invoices.forEach(inv => {
      if (inv.date) {
        const year = new Date(inv.date).getFullYear();
        if (!isNaN(year)) {
          years.add(year);
        }
      }
    });
    return Array.from(years).sort((a, b) => b - a);
  }, [invoices]);

  // Filter invoices and items based on Selected Year and Month
  const filteredData = useMemo(() => {
    const filteredInvoices = invoices.filter(inv => {
      if (!inv.date) return false;
      const dateObj = new Date(inv.date);
      if (isNaN(dateObj.getTime())) return false;

      const invoiceYear = dateObj.getFullYear();
      const invoiceMonth = dateObj.getMonth(); // 0-11

      const yearMatch = selectedYear === 'all' || invoiceYear.toString() === selectedYear;
      const monthMatch = selectedMonth === 'all' || invoiceMonth.toString() === selectedMonth;

      let quickMatch = true;
      if (quickDateFilter === 'today') {
        const today = new Date();
        today.setUTCHours(today.getUTCHours() + 7); // Thai time
        quickMatch = invoiceYear === today.getUTCFullYear() && invoiceMonth === today.getUTCMonth() && dateObj.getDate() === today.getUTCDate();
      } else if (quickDateFilter === 'tomorrow') {
        const tomorrow = new Date();
        tomorrow.setUTCHours(tomorrow.getUTCHours() + 7 + 24); // Thai time tomorrow
        quickMatch = invoiceYear === tomorrow.getUTCFullYear() && invoiceMonth === tomorrow.getUTCMonth() && dateObj.getDate() === tomorrow.getUTCDate();
      }

      return yearMatch && monthMatch && quickMatch;
    });

    const filteredInvoiceIds = new Set(filteredInvoices.map(inv => inv.id));
    const filteredItems = items.filter(item => filteredInvoiceIds.has(item.invoiceId));

    return {
      invoices: filteredInvoices,
      items: filteredItems
    };
  }, [invoices, items, selectedYear, selectedMonth, quickDateFilter]);

  // Calculate statistics based on filtered data
  const stats = useMemo(() => {
    const totalSales = filteredData.invoices.reduce((sum, inv) => sum + (inv.totalAmount || 0), 0);
    const totalInvoices = filteredData.invoices.length;
    const totalItems = filteredData.items.reduce((sum, item) => sum + (item.quantity || 0), 0);
    
    const itemMap = {};
    filteredData.items.forEach(item => {
      // Skip discount lines
      if (item.description.startsWith('ส่วนลดโปรโมชั่น')) return;
      itemMap[item.description] = (itemMap[item.description] || 0) + item.quantity;
    });
    
    let topItem = '-';
    let maxQty = 0;
    Object.entries(itemMap).forEach(([name, qty]) => {
      if (qty > maxQty) {
        maxQty = qty;
        topItem = name;
      }
    });

    const todoList = Object.entries(itemMap).map(([name, qty]) => ({ name, qty })).sort((a, b) => b.qty - a.qty);

    return { totalSales, totalInvoices, totalItems, topItem, todoList };
  }, [filteredData]);

  // Aggregate sales by date for bar chart
  const salesChartData = useMemo(() => {
    const dailyMap = {};
    filteredData.invoices.forEach(inv => {
      let key = 'unknown';
      let dStr = 'ไม่ระบุวันที่';
      
      if (inv.date) {
        const d = new Date(inv.date);
        if (!isNaN(d.getTime())) {
          key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
          dStr = d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' });
        }
      }

      if (!dailyMap[key]) {
        dailyMap[key] = { label: dStr, amount: 0 };
      }
      dailyMap[key].amount += (inv.totalAmount || 0);
    });

    return Object.keys(dailyMap).sort().map(key => ({
      date: dailyMap[key].label,
      'ยอดขาย (บาท)': dailyMap[key].amount
    })).slice(-10); // Show last 10 entries
  }, [filteredData]);

  // Aggregate monthly sales for comparison chart
  const monthlySalesData = useMemo(() => {
    const monthMap = {};
    invoices.forEach(inv => {
      if (!inv.date) return;
      const dateObj = new Date(inv.date);
      if (isNaN(dateObj.getTime())) return;
      
      const year = dateObj.getFullYear();
      if (selectedYear !== 'all' && year.toString() !== selectedYear) return;
      
      const monthIdx = dateObj.getMonth();
      const monthName = THAI_MONTH_NAMES[monthIdx];
      const shortYear = (year + 543).toString().slice(-2);
      const label = selectedYear === 'all' ? `${monthName.substring(0, 3)} ${shortYear}` : monthName;
      
      const sortKey = `${year}-${String(monthIdx).padStart(2, '0')}`;
      
      if (!monthMap[sortKey]) {
        monthMap[sortKey] = { label, amount: 0 };
      }
      monthMap[sortKey].amount += (inv.totalAmount || 0);
    });
    
    return Object.keys(monthMap).sort().map(key => ({
      name: monthMap[key].label,
      'ยอดขาย (บาท)': monthMap[key].amount
    })).slice(-12);
  }, [invoices, selectedYear]);

  return (
    <div>
      {/* Filters Section */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        
        {/* Quick Date Filters */}
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button 
            onClick={() => { setQuickDateFilter('today'); setSelectedYear('all'); setSelectedMonth('all'); }}
            style={{ padding: '0.5rem 1rem', borderRadius: '20px', border: quickDateFilter === 'today' ? 'none' : '1px solid #e2e8f0', backgroundColor: quickDateFilter === 'today' ? 'var(--primary-color)' : '#fff', color: quickDateFilter === 'today' ? '#fff' : '#64748b', fontWeight: '600', fontSize: '0.85rem', cursor: 'pointer' }}
          >
            ออเดอร์วันนี้
          </button>
          <button 
            onClick={() => { setQuickDateFilter('tomorrow'); setSelectedYear('all'); setSelectedMonth('all'); }}
            style={{ padding: '0.5rem 1rem', borderRadius: '20px', border: quickDateFilter === 'tomorrow' ? 'none' : '1px solid #e2e8f0', backgroundColor: quickDateFilter === 'tomorrow' ? 'var(--primary-color)' : '#fff', color: quickDateFilter === 'tomorrow' ? '#fff' : '#64748b', fontWeight: '600', fontSize: '0.85rem', cursor: 'pointer' }}
          >
            พรุ่งนี้
          </button>
          <button 
            onClick={() => setQuickDateFilter('all')}
            style={{ padding: '0.5rem 1rem', borderRadius: '20px', border: quickDateFilter === 'all' ? 'none' : '1px solid #e2e8f0', backgroundColor: quickDateFilter === 'all' ? 'var(--primary-color)' : '#fff', color: quickDateFilter === 'all' ? '#fff' : '#64748b', fontWeight: '600', fontSize: '0.85rem', cursor: 'pointer' }}
          >
            ทั้งหมด
          </button>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            style={{ padding: '0.4rem 0.5rem', borderRadius: '20px', border: '1px solid #e2e8f0', backgroundColor: '#fff', color: 'var(--primary-color)', outline: 'none', fontWeight: '500', fontSize: '0.85rem' }}
          >
            <option value="all">ทุกเดือน</option>
            {THAI_MONTH_NAMES.map((name, idx) => (
              <option key={idx} value={idx}>{name}</option>
            ))}
          </select>

          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(e.target.value)}
            style={{ padding: '0.4rem 0.5rem', borderRadius: '20px', border: '1px solid #e2e8f0', backgroundColor: '#fff', color: 'var(--primary-color)', outline: 'none', fontWeight: '500', fontSize: '0.85rem' }}
          >
            <option value="all">ทุกปี</option>
            {uniqueYears.map(year => (
              <option key={year} value={year}>{year + 543}</option>
            ))}
          </select>
          
          {(selectedYear !== 'all' || selectedMonth !== 'all') && (
            <button
              onClick={() => {
                setSelectedYear('all');
                setSelectedMonth('all');
              }}
              style={{ padding: '0.4rem 0.75rem', borderRadius: '20px', border: '1px solid #ef4444', backgroundColor: '#fef2f2', color: '#ef4444', outline: 'none', fontWeight: '500', fontSize: '0.85rem', cursor: 'pointer' }}
            >
              ล้าง
            </button>
          )}
        </div>
      </div>


      {/* Stats Cards */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-info">
            <span className="stat-label">ยอดขายช่วงที่เลือก</span>
            <span className="stat-value">{stats.totalSales.toLocaleString()} ฿</span>
          </div>
          <div className="stat-icon-wrapper">
            <DollarSign size={24} />
          </div>
        </div>

        <div className="stat-card accent">
          <div className="stat-info">
            <span className="stat-label">จำนวนบิลใบเสร็จ</span>
            <span className="stat-value">{stats.totalInvoices.toLocaleString()} ใบ</span>
          </div>
          <div className="stat-icon-wrapper">
            <FileText size={24} />
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-info">
            <span className="stat-label">จำนวนขนมที่ขายได้</span>
            <span className="stat-value">{stats.totalItems.toLocaleString()} ชิ้น</span>
          </div>
          <div className="stat-icon-wrapper">
            <ShoppingBag size={24} />
          </div>
        </div>

        <div className="stat-card accent">
          <div className="stat-info">
            <span className="stat-label">สินค้าขายดีอันดับหนึ่ง</span>
            <span className="stat-value" style={{ fontSize: '1.2rem', marginTop: '0.5rem', fontFamily: 'var(--font-thai)' }}>
              {stats.topItem}
            </span>
          </div>
          <div className="stat-icon-wrapper">
            <TrendingUp size={24} />
          </div>
        </div>
      </div>



      {/* Charts Grid */}
      <div className="charts-grid">
        {/* Sales Chart */}
        <div className="card" style={{ marginBottom: 0 }}>
          <h3 className="card-title">สรุปยอดขายรายวัน</h3>
          <div style={{ width: '100%', height: '300px' }}>
            {salesChartData.length === 0 ? (
              <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                ไม่มีข้อมูลยอดขายในช่วงเวลาที่เลือก
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={salesChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <XAxis dataKey="date" tick={{ fontFamily: 'var(--font-thai)', fontSize: 11 }} />
                  <YAxis tick={{ fontFamily: 'var(--font-eng)', fontSize: 11 }} />
                  <Tooltip contentStyle={{ fontFamily: 'var(--font-thai)', borderRadius: 10, border: '1px solid var(--border-color)' }} />
                  <Bar dataKey="ยอดขาย (บาท)" fill="var(--primary-color)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Monthly Sales Comparison Chart */}
        <div className="card" style={{ marginBottom: 0 }}>
          <h3 className="card-title">เปรียบเทียบยอดขายรายเดือน</h3>
          <div style={{ width: '100%', height: '300px' }}>
            {monthlySalesData.length === 0 ? (
              <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                ไม่มีข้อมูลยอดขาย
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlySalesData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <XAxis dataKey="name" tick={{ fontFamily: 'var(--font-thai)', fontSize: 11 }} />
                  <YAxis tick={{ fontFamily: 'var(--font-eng)', fontSize: 11 }} />
                  <Tooltip contentStyle={{ fontFamily: 'var(--font-thai)', borderRadius: 10, border: '1px solid var(--border-color)' }} />
                  <Bar dataKey="ยอดขาย (บาท)" fill="#c5a880" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* Database Storage and Backup Section */}
      <div style={{
        backgroundColor: isDbWarning ? '#fef2f2' : '#f8fafc',
        border: `1px solid ${isDbWarning ? '#ef4444' : '#e2e8f0'}`,
        borderRadius: '16px',
        padding: '1rem 1.5rem',
        marginTop: '2rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '1rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flex: '1 1 100%' }}>
          <div style={{ padding: '0.75rem', backgroundColor: isDbWarning ? '#fee2e2' : '#e0f2fe', borderRadius: '12px' }}>
            {isDbWarning ? <AlertTriangle color="#ef4444" size={24} /> : <Database color="#0284c7" size={24} />}
          </div>
          <div>
            <div style={{ fontWeight: '600', color: isDbWarning ? '#ef4444' : '#1e293b', fontSize: '1rem' }}>
              พื้นที่ฐานข้อมูล (Database Storage)
            </div>
            <div style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '0.25rem' }}>
              {dbSize === null 
                ? 'กำลังโหลดข้อมูลความจุ...' 
                : `ใช้ไปแล้ว ${(dbSize / (1024 * 1024)).toFixed(2)} MB จาก 500 MB`}
            </div>
          </div>
        </div>
        
        {dbSize !== null && (
          <div style={{ flex: '1 1 100%', maxWidth: '100%', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <div style={{ width: '100%', height: '8px', backgroundColor: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
              <div style={{
                height: '100%',
                width: `${Math.min(dbUsagePercent, 100)}%`,
                backgroundColor: isDbWarning ? '#ef4444' : '#0284c7',
                transition: 'width 0.5s ease-out'
              }}></div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', fontSize: '0.75rem', color: isDbWarning ? '#ef4444' : '#64748b', fontWeight: '500' }}>
              {dbUsagePercent.toFixed(1)}%
            </div>
          </div>
        )}

        <div style={{ flex: '1 1 100%', marginTop: '0.5rem' }}>
          <button 
            onClick={onNavigateToBackup}
            style={{
              width: '100%',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
              backgroundColor: '#fff', border: '1px solid #cbd5e1', borderRadius: '8px',
              padding: '0.75rem 1rem', fontSize: '0.95rem', fontWeight: '500', color: '#334155', cursor: 'pointer',
              boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
            }}
          >
            จัดการข้อมูล (Backup) <ArrowRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
