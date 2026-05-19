const express = require('express');
const router = express.Router();
const XLSX = require('xlsx');
const { authMiddleware } = require('../middleware/auth');
const { DEFAULT_PRODUCTS, CATEGORIES } = require('../data/products');

// Helper to get month abbreviation
function getMonthAbbr(date) {
  const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  return months[date.getMonth()];
}

// Helper to get day of week
function getDayOfWeek(date) {
  const days = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
  return days[date.getDay()];
}

// POST /api/export/daily - Export daily data as Excel
router.post('/daily', authMiddleware, (req, res) => {
  try {
    const { date, entries, metadata, denomination } = req.body;
    const dateObj = new Date(date);
    const sheetName = `${getMonthAbbr(dateObj)}-${String(dateObj.getDate()).padStart(2, '0')}`;
    const dayOfWeek = getDayOfWeek(dateObj);

    // Create workbook
    const wb = XLSX.utils.book_new();
    
    // Build the sheet data
    const wsData = [];
    
    // Row 1: Header
    wsData.push(['TAMIL NADU STATE MARKETTING CORPORATION LIMITED-COIMBATORE - NORTH']);
    
    // Row 2: Blank
    wsData.push([]);
    
    // Row 3: Shop details
    wsData.push(['SHOP NO-1745', '', 'ADDRESS: SF NO-1101/1A, SIRUVANI MAIN ROAD, NEAR H.P PETROL BUNK, ALANDURAI, COIMBATORE-(NORTH) -641101']);
    
    // Row 4: Invoice info
    const invoiceNo = metadata?.invoiceNo || '';
    const invoiceDate = metadata?.invoiceDate || date;
    wsData.push([
      `INVOICE NO: ${invoiceNo}`, '',
      `INVOICE DATE: ${invoiceDate}`, '',
      `DATE: ${date}`, '',
      dayOfWeek
    ]);
    
    // Row 5: Invoice amount & salesmen
    const totalSalesAmt = entries.reduce((sum, e) => sum + (e.salesAmt || 0), 0);
    wsData.push([
      `INVOICE AMOUNT: ${totalSalesAmt}`, '',
      'SALES MAN: 1.SHANMUGASUNDARAM.P, 2.ARUMUGAM.A, 3.RAMESHKUMAR.A, 4.SHANMUGASUNDARAM.M'
    ]);
    
    // Row 6: Category & Owner
    wsData.push([
      '', '',
      'OWNER: ANTONYSAMY.A', '',
      'MOBILE NO-99429 10707, 99422 10707'
    ]);
    
    // Row 7: Column headers
    wsData.push([
      'S.NO', 'CODE NO-', 'PARTICULAR', 'CASE', 'BOTTLE',
      'OP.ST', 'PURCHASE', 'STOCK RETURN TO DEPO', 'TOTAL',
      'CL.ST', 'SALES', 'RATE', 'SALES AMT', 'CL. VALUE',
      'OP VALUE', 'PURCHASE VALUE', 'STOCK RETURN TO DEPO VALUE'
    ]);

    // Data rows - group by category
    let currentCategory = '';
    const sortedEntries = [...entries].sort((a, b) => (a.sno || 0) - (b.sno || 0));
    
    sortedEntries.forEach((entry, idx) => {
      const product = DEFAULT_PRODUCTS.find(p => p.id === entry.productId) || {};
      const category = CATEGORIES[entry.category || product.category];
      const caseSize = category ? category.bottlesPerCase : 48;
      
      // Add category header if category changed
      if (entry.category !== currentCategory && entry.category) {
        currentCategory = entry.category;
        const catLabel = category ? category.label : entry.category;
        wsData.push([catLabel]);
      }

      const rowNum = wsData.length + 1; // 1-indexed for Excel formulas
      const cases = entry.cases || 0;
      const bottles = entry.bottles || 0;
      const opst = entry.openingStock || 0;
      const purchase = entry.purchase || 0;
      const stockReturn = entry.stockReturn || 0;
      const rate = entry.rate || product.rate || 0;
      
      // Calculate values
      const clst = cases * caseSize + bottles; // J = D*caseSize + E
      const total = opst + purchase - stockReturn; // I = F + G - H
      const sales = total - clst; // K = I - J
      const salesAmt = sales * rate; // M = K * L
      const clValue = clst * rate; // N = J * L
      const opValue = opst * rate; // O = F * L
      const purchaseValue = purchase * rate; // P = G * L
      const stockReturnValue = stockReturn * rate; // Q = H * L

      wsData.push([
        entry.sno || product.sno || idx + 1,
        entry.codeNo || product.codeNo || '',
        entry.particular || product.particular || '',
        cases,
        bottles,
        opst,
        purchase,
        stockReturn,
        total,
        clst,
        sales,
        rate,
        salesAmt,
        clValue,
        opValue,
        purchaseValue,
        stockReturnValue
      ]);
    });

    // Add totals row
    wsData.push([]);
    const dataStartRow = 9; // Row where data starts (after headers)
    const dataEndRow = wsData.length - 1;
    wsData.push([
      'TOTAL', '', '', '', '', '', '', '', '',
      '', '',  '',
      entries.reduce((s, e) => s + (e.salesAmt || 0), 0),
      entries.reduce((s, e) => s + (e.clValue || 0), 0),
      entries.reduce((s, e) => s + (e.opValue || 0), 0),
      entries.reduce((s, e) => s + (e.purchaseValue || 0), 0),
      entries.reduce((s, e) => s + (e.stockReturnValue || 0), 0)
    ]);

    // Add denomination section
    wsData.push([]);
    wsData.push(['DENOMINATION']);
    wsData.push(['Note', 'Count', 'Value']);
    
    if (denomination) {
      const notes = [500, 200, 100, 50, 20, 10];
      notes.forEach(note => {
        const count = denomination.notes?.[note]?.count || 0;
        wsData.push([`₹${note}`, count, count * note]);
      });
      wsData.push(['Coins', '', denomination.coins || 0]);
      wsData.push(['TOTAL CASH', '', denomination.totalCash || 0]);
    }

    // Create worksheet
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    
    // Set column widths
    ws['!cols'] = [
      { wch: 6 },  // A - S.NO
      { wch: 10 }, // B - CODE NO
      { wch: 25 }, // C - PARTICULAR
      { wch: 6 },  // D - CASE
      { wch: 8 },  // E - BOTTLE
      { wch: 8 },  // F - OP.ST
      { wch: 10 }, // G - PURCHASE
      { wch: 12 }, // H - STOCK RETURN
      { wch: 8 },  // I - TOTAL
      { wch: 8 },  // J - CL.ST
      { wch: 8 },  // K - SALES
      { wch: 8 },  // L - RATE
      { wch: 12 }, // M - SALES AMT
      { wch: 12 }, // N - CL. VALUE
      { wch: 12 }, // O - OP VALUE
      { wch: 14 }, // P - PURCHASE VALUE
      { wch: 18 }, // Q - STOCK RETURN VALUE
    ];

    // Merge header cells
    ws['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 16 } }, // Row 1 merge
      { s: { r: 2, c: 2 }, e: { r: 2, c: 16 } }, // Row 3 address merge
    ];

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
