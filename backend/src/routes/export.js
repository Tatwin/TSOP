const express = require('express');
const router = express.Router();
const XLSX = require('xlsx-js-style');
const { authMiddleware } = require('../middleware/auth');
const { DEFAULT_PRODUCTS, CATEGORIES } = require('../data/products');

// ===== STYLE DEFINITIONS =====
const STYLES = {
  // Title row - bold, large, green background
  title: { font: { bold: true, sz: 14, color: { rgb: 'FFFFFF' } }, fill: { fgColor: { rgb: '0E6633' } }, alignment: { horizontal: 'center', vertical: 'center' } },
  // Shop info
  shopInfo: { font: { bold: true, sz: 10 }, alignment: { horizontal: 'left' } },
  // Column headers - green bg, white text, bold
  header: { font: { bold: true, sz: 9, color: { rgb: 'FFFFFF' } }, fill: { fgColor: { rgb: '0E6633' } }, alignment: { horizontal: 'center', vertical: 'center', wrapText: true }, border: { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } } },
  // Category header row - dark green bg
  category: { font: { bold: true, sz: 10, color: { rgb: 'FFFFFF' } }, fill: { fgColor: { rgb: '1E291E' } }, alignment: { horizontal: 'left' } },
  // Data cells - normal
  data: { font: { sz: 9 }, alignment: { horizontal: 'center' }, border: { top: { style: 'thin', color: { rgb: 'E0E0E0' } }, bottom: { style: 'thin', color: { rgb: 'E0E0E0' } }, left: { style: 'thin', color: { rgb: 'E0E0E0' } }, right: { style: 'thin', color: { rgb: 'E0E0E0' } } } },
  // Data - left aligned (for product name)
  dataLeft: { font: { sz: 9 }, alignment: { horizontal: 'left' }, border: { top: { style: 'thin', color: { rgb: 'E0E0E0' } }, bottom: { style: 'thin', color: { rgb: 'E0E0E0' } }, left: { style: 'thin', color: { rgb: 'E0E0E0' } }, right: { style: 'thin', color: { rgb: 'E0E0E0' } } } },
  // Totals row - bold, light green bg, red text for amounts
  totals: { font: { bold: true, sz: 10, color: { rgb: 'D92426' } }, fill: { fgColor: { rgb: 'E8F5E9' } }, alignment: { horizontal: 'center' }, border: { top: { style: 'medium' }, bottom: { style: 'medium' } } },
  // Section header (POS, Device, Denomination)
  sectionHeader: { font: { bold: true, sz: 11, color: { rgb: '0E6633' } }, fill: { fgColor: { rgb: 'F4F6F4' } }, alignment: { horizontal: 'left' } },
  // Invoice info
  info: { font: { sz: 9 }, alignment: { horizontal: 'left' } },
  infoBold: { font: { bold: true, sz: 9 }, alignment: { horizontal: 'left' } }
};

function getMonthAbbr(date) {
  return ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'][date.getMonth()];
}

function getDayOfWeek(date) {
  return ['SUNDAY','MONDAY','TUESDAY','WEDNESDAY','THURSDAY','FRIDAY','SATURDAY'][date.getDay()];
}

// POST /api/export/daily - Export daily data as styled Excel
router.post('/daily', authMiddleware, (req, res) => {
  try {
    const { date, entries, metadata, denomination, posAmount, deviceValues, staffSelection } = req.body;
    const dateObj = new Date(date);
    const sheetName = `${getMonthAbbr(dateObj)}-${String(dateObj.getDate()).padStart(2, '0')}`;
    const dayOfWeek = getDayOfWeek(dateObj);
    const totalSalesAmt = entries.reduce((sum, e) => sum + (e.salesAmt || 0), 0);

    const wb = XLSX.utils.book_new();
    const wsData = [];
    const merges = [];
    const rowStyles = []; // Track which rows need special styling

    // === ROW 1: Title ===
    wsData.push(['TAMIL NADU STATE MARKETING CORPORATION LIMITED - COIMBATORE (NORTH)']);
    merges.push({ s: { r: 0, c: 0 }, e: { r: 0, c: 16 } });
    rowStyles.push({ row: 0, style: 'title' });

    // === ROW 2: Blank spacer ===
    wsData.push([]);

    // === ROW 3: Shop Info ===
    wsData.push(['SHOP NO-1745', '', '', 'ADDRESS: SF NO-1101/1A, SIRUVANI MAIN ROAD, NEAR H.P PETROL BUNK, ALANDURAI, COIMBATORE-(NORTH) -641101']);
    merges.push({ s: { r: 2, c: 3 }, e: { r: 2, c: 16 } });
    rowStyles.push({ row: 2, style: 'infoBold' });

    // === ROW 4: Invoice / Date info ===
    const salesmenNames = (staffSelection?.salesmen?.length > 0)
      ? staffSelection.salesmen.map((n, i) => `${i+1}.${n}`).join(', ')
      : '1.SHANMUGASUNDARAM.P, 2.ARUMUGAM.A, 3.RAMESHKUMAR.A, 4.SHANMUGASUNDARAM.M';
    const supervisorNames = (staffSelection?.supervisors?.length > 0)
      ? staffSelection.supervisors.join(', ')
      : 'ANTONYSAMY.A';

    wsData.push([`DATE: ${date}`, '', `DAY: ${dayOfWeek}`, '', `INVOICE AMOUNT: ${totalSalesAmt}`]);
    rowStyles.push({ row: 3, style: 'info' });

    // === ROW 5: Staff ===
    wsData.push([`SALES MAN: ${salesmenNames}`, '', '', '', `SUPERVISOR: ${supervisorNames}`]);
    rowStyles.push({ row: 4, style: 'info' });

    // === ROW 6: Blank spacer before data ===
    wsData.push([]);

    // === ROW 7: Column Headers ===
    const headerRow = ['S.NO', 'CODE NO', 'PARTICULAR', 'CASE', 'BOTTLE', 'OP.ST', 'PURCHASE', 'STK RETURN', 'TOTAL', 'CL.ST', 'SALES', 'RATE', 'SALES AMT', 'CL. VALUE', 'OP VALUE', 'PURCHASE VALUE', 'STK RET VALUE'];
    wsData.push(headerRow);
    rowStyles.push({ row: 6, style: 'header' });

    // === DATA ROWS - grouped by category with spacing ===
    let currentCategory = '';
    const sortedEntries = [...entries].sort((a, b) => (a.sno || 0) - (b.sno || 0));
    const categoryRows = []; // Track category header row indices

    sortedEntries.forEach((entry, idx) => {
      const product = DEFAULT_PRODUCTS.find(p => p.id === entry.productId) || {};
      const category = CATEGORIES[entry.category || product.category];
      const caseSize = category ? category.bottlesPerCase : 48;

      // Add category header with blank row before (spacing)
      if (entry.category !== currentCategory && entry.category) {
        currentCategory = entry.category;
        const catLabel = category ? category.label : entry.category;
        
        // Blank row for spacing between categories
        if (wsData.length > 7) {
          wsData.push([]);
        }
        
        // Category header row
        wsData.push([catLabel, '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '']);
        categoryRows.push(wsData.length - 1);
        merges.push({ s: { r: wsData.length - 1, c: 0 }, e: { r: wsData.length - 1, c: 16 } });
      }

      const cases = entry.cases || 0;
      const bottles = entry.bottles || 0;
      const opst = entry.openingStock || 0;
      const purchase = entry.purchase || 0;
      const stockReturn = entry.stockReturn || 0;
      const rate = entry.rate || product.rate || 0;
      const clst = cases * caseSize + bottles;
      const total = opst + purchase - stockReturn;
      const sales = total - clst;
      const salesAmt = sales * rate;
      const clValue = clst * rate;
      const opValue = opst * rate;
      const purchaseValue = purchase * rate;
      const stockReturnValue = stockReturn * rate;

      wsData.push([
        entry.sno || product.sno || idx + 1,
        entry.codeNo || product.codeNo || '',
        entry.particular || product.particular || '',
        cases, bottles, opst, purchase, stockReturn, total, clst, sales, rate,
        salesAmt, clValue, opValue, purchaseValue, stockReturnValue
      ]);
    });

    // === BLANK ROW + TOTALS ROW ===
    wsData.push([]);
    const totalsRowIdx = wsData.length;
    wsData.push([
      'GRAND TOTAL', '', '', '', '', '', '', '', '',
      '', '', '',
      entries.reduce((s, e) => s + (e.salesAmt || 0), 0),
      entries.reduce((s, e) => s + (e.clValue || 0), 0),
      entries.reduce((s, e) => s + (e.opValue || 0), 0),
      entries.reduce((s, e) => s + (e.purchaseValue || 0), 0),
      entries.reduce((s, e) => s + (e.stockReturnValue || 0), 0)
    ]);
    rowStyles.push({ row: totalsRowIdx, style: 'totals' });

    // === POS SECTION ===
    wsData.push([]);
    wsData.push([]);
    const posHeaderIdx = wsData.length;
    wsData.push(['POS / DIGITAL PAYMENT']);
    rowStyles.push({ row: posHeaderIdx, style: 'sectionHeader' });
    wsData.push(['POS Amount', posAmount || 0]);
    wsData.push(['Cash Sales (Remittance)', totalSalesAmt - (posAmount || 0)]);

    // === DEVICE VS MANUAL ===
    wsData.push([]);
    const deviceHeaderIdx = wsData.length;
    wsData.push(['DEVICE vs MANUAL COMPARISON']);
    rowStyles.push({ row: deviceHeaderIdx, style: 'sectionHeader' });
    wsData.push(['', 'Sales Bottles', 'Closing Bottles', 'Sales Value', 'Closing Value']);

    const manualSalesBottles = entries.reduce((s, e) => {
      const cat = CATEGORIES[e.category];
      const cs = cat ? cat.bottlesPerCase : 48;
      const clst = (e.cases||0)*cs + (e.bottles||0);
      const total = (e.openingStock||0) + (e.purchase||0) - (e.stockReturn||0);
      return s + Math.max(0, total - clst);
    }, 0);
    const manualClosingBottles = entries.reduce((s, e) => {
      const cat = CATEGORIES[e.category];
      const cs = cat ? cat.bottlesPerCase : 48;
      return s + ((e.cases||0)*cs + (e.bottles||0));
    }, 0);

    wsData.push(['Device', deviceValues?.salesBottles||0, deviceValues?.closingBottles||0, deviceValues?.salesValue||0, deviceValues?.closingValue||0]);
    wsData.push(['Manual', manualSalesBottles, manualClosingBottles, totalSalesAmt, entries.reduce((s,e)=>s+(e.clValue||0),0)]);
    wsData.push(['Difference', (deviceValues?.salesBottles||0)-manualSalesBottles, (deviceValues?.closingBottles||0)-manualClosingBottles, (deviceValues?.salesValue||0)-totalSalesAmt, (deviceValues?.closingValue||0)-entries.reduce((s,e)=>s+(e.clValue||0),0)]);

    // === DENOMINATION ===
    wsData.push([]);
    const denomHeaderIdx = wsData.length;
    wsData.push(['DENOMINATION']);
    rowStyles.push({ row: denomHeaderIdx, style: 'sectionHeader' });
    wsData.push(['Note', 'Count', 'Value']);
    if (denomination) {
      [500,200,100,50,20,10].forEach(note => {
        const count = denomination.notes?.[note]?.count || 0;
        wsData.push([`Rs.${note}`, count, count * note]);
      });
      wsData.push(['Coins', '', denomination.coins || 0]);
      wsData.push(['TOTAL CASH', '', denomination.totalCash || 0]);
    }

    // === CREATE WORKSHEET ===
    const ws = XLSX.utils.aoa_to_sheet(wsData);

    // === APPLY STYLES ===
    const range = XLSX.utils.decode_range(ws['!ref']);
    
    // Apply row-level styles
    rowStyles.forEach(({ row, style }) => {
      for (let c = range.s.c; c <= range.e.c; c++) {
        const addr = XLSX.utils.encode_cell({ r: row, c });
        if (!ws[addr]) ws[addr] = { v: '', t: 's' };
        ws[addr].s = STYLES[style];
      }
    });

    // Apply category row styles
    categoryRows.forEach(row => {
      for (let c = range.s.c; c <= range.e.c; c++) {
        const addr = XLSX.utils.encode_cell({ r: row, c });
        if (!ws[addr]) ws[addr] = { v: '', t: 's' };
        ws[addr].s = STYLES.category;
      }
    });

    // Apply data cell styles (rows between header and totals)
    const dataStartRow = 7;
    for (let r = dataStartRow; r < totalsRowIdx; r++) {
      // Skip category rows and blank rows
      if (categoryRows.includes(r)) continue;
      const firstCell = ws[XLSX.utils.encode_cell({ r, c: 0 })];
      if (!firstCell || firstCell.v === '' || firstCell.v === undefined || firstCell.v === null) continue;
      
      for (let c = 0; c <= 16; c++) {
        const addr = XLSX.utils.encode_cell({ r, c });
        if (!ws[addr]) continue;
        ws[addr].s = c === 2 ? STYLES.dataLeft : STYLES.data;
      }
    }

    // === COLUMN WIDTHS ===
    ws['!cols'] = [
      { wch: 5 },  // A - S.NO
      { wch: 8 },  // B - CODE
      { wch: 28 }, // C - PARTICULAR
      { wch: 5 },  // D - CASE
      { wch: 6 },  // E - BOTTLE
      { wch: 6 },  // F - OP.ST
      { wch: 8 },  // G - PURCHASE
      { wch: 9 },  // H - STK RETURN
      { wch: 6 },  // I - TOTAL
      { wch: 6 },  // J - CL.ST
      { wch: 6 },  // K - SALES
      { wch: 7 },  // L - RATE
      { wch: 11 }, // M - SALES AMT
      { wch: 11 }, // N - CL VALUE
      { wch: 10 }, // O - OP VALUE
      { wch: 12 }, // P - PURCHASE VALUE
      { wch: 12 }, // Q - STK RET VALUE
    ];

    // === MERGES ===
    ws['!merges'] = merges;

    // === ROW HEIGHTS ===
    ws['!rows'] = [{ hpt: 24 }]; // Title row height

    XLSX.utils.book_append_sheet(wb, ws, sheetName);

    // Generate buffer
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    
    res.setHeader('Content-Disposition', `attachment; filename=TASMAC_1745_${sheetName}.xlsx`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buf);
  } catch (error) {
    console.error('Export error:', error);
    res.status(500).json({ error: 'Export failed', details: error.message });
  }
});

module.exports = router;
