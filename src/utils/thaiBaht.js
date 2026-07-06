export function getThaiBahtText(number) {
  if (isNaN(number) || number === null || number === undefined) return '';
  const THAI_NUMBERS = ['ศูนย์', 'หนึ่ง', 'สอง', 'สาม', 'สี่', 'ห้า', 'หก', 'เจ็ด', 'แปด', 'เก้า'];
  const THAI_UNITS = ['', 'สิบ', 'ร้อย', 'พัน', 'หมื่น', 'แสน', 'ล้าน'];

  const numString = Number(number).toFixed(2);
  const parts = numString.split('.');
  let baht = parts[0];
  const satang = parts[1];

  while (baht.length > 1 && baht[0] === '0') {
    baht = baht.slice(1);
  }

  const processInteger = (intStr) => {
    let res = '';
    const len = intStr.length;
    for (let i = 0; i < len; i++) {
      const digit = parseInt(intStr[i], 10);
      const pos = len - i - 1;
      
      if (digit !== 0) {
        if (pos % 6 === 1 && digit === 1) {
          res += 'สิบ';
        } else if (pos % 6 === 1 && digit === 2) {
          res += 'ยี่สิบ';
        } else if (pos % 6 === 0 && digit === 1 && len > 1 && intStr[i-1] !== '0') {
          res += 'เอ็ด';
        } else {
          res += THAI_NUMBERS[digit] + THAI_UNITS[pos % 6];
        }
      }
      
      if (pos > 0 && pos % 6 === 0) {
        res += 'ล้าน';
      }
    }
    return res;
  };

  let result = '';
  if (baht === '0' || baht === '') {
    result = '';
  } else {
    result = processInteger(baht) + 'บาท';
  }

  if (satang === '00') {
    if (result !== '') {
      result += 'ถ้วน';
    } else {
      result = 'ศูนย์บาทถ้วน';
    }
  } else {
    result += processInteger(satang) + 'สตางค์';
  }

  return result;
}
