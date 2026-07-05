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
      let dStr = 'ไม่ระบุวันที่';
      if (inv.date) {
        const d = new Date(inv.date);
        dStr = d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' });
      }
      dailyMap[dStr] = (dailyMap[dStr] || 0) + inv.totalAmount;
    });

    return Object.entries(dailyMap).map(([date, amount]) => ({
      date,
      'ยอดขาย (บาท)': amount
    })).slice(-10); // Show last 10 entries for filtered range
  }, [filteredData]);

  // Aggregate items for distribution pie chart
  const itemPieData = useMemo(() => {
    const itemMap = {};
    filteredData.items.forEach(item => {
      itemMap[item.description] = (itemMap[item.description] || 0) + item.quantity;
    });

    return Object.entries(itemMap).map(([name, value]) => ({
      name,
      value
    })).sort((a, b) => b.value - a.value).slice(0, 5); // Top 5 items
  }, [filteredData]);

  return (
    <div>
      {/* Filters Section */}
      <div className="card" style={{ padding: '1.25rem 2rem', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: '600', color: 'var(--primary-color)' }}>
            <Filter size={18} />
            <span>กรองข้อมูลสถิติ:</span>
          </div>

          <div style={{ display: 'flex', gap: '1rem', flex: 1, flexWrap: 'wrap' }}>
            {/* Year Filter */}
            <div className="form-group" style={{ flexDirection: 'row', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
              <label htmlFor="yearFilter" style={{ whiteSpace: 'nowrap' }}>ปี พ.ศ.</label>
              <select
                id="yearFilter"
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
                style={{ padding: '0.4rem 1.5rem 0.4rem 0.75rem', borderRadius: '8px' }}
              >
                <option value="all">ทั้งหมด</option>
                {uniqueYears.map(year => (
                  <option key={year} value={year}>{year + 543}</option>
                ))}
              </select>
            </div>

            {/* Month Filter */}
            <div className="form-group" style={{ flexDirection: 'row', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
              <label htmlFor="monthFilter" style={{ whiteSpace: 'nowrap' }}>เดือน</label>
              <select
                id="monthFilter"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                style={{ padding: '0.4rem 1.5rem 0.4rem 0.75rem', borderRadius: '8px' }}
              >
                <option value="all">ทั้งหมด</option>
                {THAI_MONTH_NAMES.map((name, idx) => (
                  <option key={idx} value={idx}>{name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Reset Filters Option */}
          {(selectedYear !== 'all' || selectedMonth !== 'all') && (
            <button
              className="btn btn-outline"
              onClick={() => {
                setSelectedYear('all');
                setSelectedMonth('all');
              }}
              style={{ padding: '0.4rem 1rem', fontSize: '0.85rem' }}
            >
              ล้างการกรอง
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

        {/* Item Distribution Pie Chart */}
        <div className="card" style={{ marginBottom: 0 }}>
          <h3 className="card-title">สัดส่วนยอดขายขนม</h3>
          <div style={{ width: '100%', height: '300px' }}>
            {itemPieData.length === 0 ? (
              <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                ไม่มีข้อมูลสถิติขนมในช่วงเวลาที่เลือก
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={itemPieData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                    label={({ name, percent }) => `${name.substring(0, 8)}... (${(percent * 100).toFixed(0)}%)`}
                    style={{ fontSize: '10px', fontFamily: 'var(--font-thai)' }}
                  >
                    {itemPieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ fontFamily: 'var(--font-thai)', borderRadius: 10 }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
