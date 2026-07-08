import React, { useMemo, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { DollarSign, FileText, ShoppingBag, TrendingUp, Search, Filter } from 'lucide-react';

const COLORS = ['#1e3a2b', '#c5a880', '#5c8065', '#d4c5b9', '#3e5c46', '#e5dcd3'];

const THAI_MONTH_NAMES = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
];

export default function Dashboard({ invoices = [], items = [] }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedYear, setSelectedYear] = useState('all');
  const [selectedMonth, setSelectedMonth] = useState('all');

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

      return yearMatch && monthMatch;
    });

    const filteredInvoiceIds = new Set(filteredInvoices.map(inv => inv.id));
    const filteredItems = items.filter(item => filteredInvoiceIds.has(item.invoiceId));

    return {
      invoices: filteredInvoices,
      items: filteredItems
    };
  }, [invoices, items, selectedYear, selectedMonth]);

  // Calculate statistics based on filtered data
  const stats = useMemo(() => {
    const totalSales = filteredData.invoices.reduce((sum, inv) => sum + (inv.totalAmount || 0), 0);
    const totalInvoices = filteredData.invoices.length;
    const totalItems = filteredData.items.reduce((sum, item) => sum + (item.quantity || 0), 0);
    
    // Find top selling item
    const itemMap = {};
    filteredData.items.forEach(item => {
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

    return { totalSales, totalInvoices, totalItems, topItem };
  }, [filteredData]);

  // Aggregate sales by date for bar chart
  const salesChartData = useMemo(() => {
    const dailyMap = {};
    filteredData.invoices.forEach(inv => {
      const key = inv.date || 'unknown';
      if (!dailyMap[key]) {
        let dStr = 'ไม่ระบุวันที่';
        if (inv.date) {
          const d = new Date(inv.date);
          dStr = d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' });
        }
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
      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', marginBottom: '1.5rem' }}>
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
    </div>
  );
}
