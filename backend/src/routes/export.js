const express = require('express');
const router = express.Router();
const XLSX = require('xlsx-js-style');
const { authMiddleware } = require('../middleware/auth');
const { DEFAULT_PRODUCTS, CATEGORIES } = require('../data/products');

// Color palette
const COLORS = {
  green: '0E6633',
  darkGreen: '1E291E',
  red: 'D92426',
  white: 'FFFFFF',
  lightGray: 'F4F6F4',
  headerBg: '0E6633',
  categoryBg: '1E291E',
  totalBg: 'D92426',
  denomBg: '2E5339',
  summaryBg: 'E8F5E9',
  inputColBg: 'FFF3E0',
  borderColor: '333333'
};

// Shared border style
const thinBorder = {
  top: { style: 'thin', color: { rgb: COLORS.borderColor } },
  bottom: { style: 'thin', color: { rgb: COLORS.borderColor } },
  left: { style: 'thin', color: { rgb: COLORS.borderColor } },
  right: { style: 'thin', color: { rgb: COLORS.borderColor } }
};

const thickBorder = {
  top: { style: 'medium', color: { rgb: COLORS.darkGreen } },
  bottom: { style: 'medium', color: { rgb: COLORS.darkGreen } },
  left: { style: 'medium', color: { rgb: COLORS.darkGreen } },
  right: { style: 'medium', color: { rgb: COLORS.darkGreen } }
};

const sectionBorder = {
  top: { style: 'thick', color: { rgb: COLORS.green } },
  bottom: { style: 'thick', color: { rgb: COLORS.green } },
  left: { style: 'thick', color: { rgb: COLORS.green } },
  right: { style: 'thick', color: { rgb: COLORS.green } }
};

// Helper to get month abbreviation
function getMonthAbbr(date) {
  const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  return months[date.getMonth()];
}

function getDayOfWeek(date) {
  const days = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
  return days[date.getDay()];
}

// Create a styled cell
function cell(value, style = {}) {
  const c = { v: value, t: typeof value === 'number' ? 'n' : 's' };
  if (style) c.s = style;
  return c;
}

// POST /api/export/daily - Export daily data as styled Excel
router.post('/daily', authMiddleware, (req, res) => {
  try {
    const { date, entries, metadata, denomination, posAmount, deviceValues, staffSelection } = req.body;
    const dateObj = new Date(date);
    const sheetName = `${getMonthAbbr(dateObj)}-${String(dateObj.getDate()).padStart(2, '0')}`;
    const dayOfWeek = getDayOfWeek(dateObj);

    const wb = XLSX.utils.book_new();
    const wsData = [];

    // === STYLES ===
    const titleStyle = {
      font: { bold: true, sz: 14, color: { rgb: COLORS.white } },
      fill: { fgColor: { rgb: COLORS.green } },
      alignment: { horizontal: 'center', vertical: 'center' },
      border: thickBorder
    };

    const shopStyle = {
      font: { bold: true, sz: 11, color: { rgb: COLORS.darkGreen } },
      fill: { fgColor: { rgb: COLORS.lightGray } },
      alignment: { horizontal: 'left' },
      border: thinBorder
    };

    const infoStyle = {
      font: { sz: 10, color: { rgb: COLORS.darkGreen } },
      fill: { fgColor: { rgb: COLORS.white } },
      border: thinBorder
    };

    const colHeaderStyle = {
      font: { bold: true, sz: 9, color: { rgb: COLORS.white } },
      fill: { fgColor: { rgb: COLORS.headerBg } },
      alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
      border: thickBorder
    };

    const categoryHeaderStyle = {
      font: { bold: true, sz: 10, color: { rgb: COLORS.white } },
      fill: { fgColor: { rgb: COLORS.categoryBg } },
      alignment: { horizontal: 'left' },
      border: sectionBorder
    };

    const dataStyle = {
      font: { sz: 9 },
      border: thinBorder,
      alignment: { horizontal: 'center' }
    };

    const dataLeftStyle = {
      font: { sz: 9 },
      border: thinBorder,
      alignment: { horizontal: 'left' }
    };

    const inputStyle = {
      font: { sz: 9, bold: true },
      fill: { fgColor: { rgb: COLORS.inputColBg } },
      border: thinBorder,
      alignment: { horizontal: 'center' }
    };

    const salesAmtStyle = {
      font: { sz: 9, bold: true, color: { rgb: COLORS.green } },
      border: thinBorder,
      alignment: { horizontal: 'right' },
      numFmt: '#,##0'
    };

    const negativeSalesStyle = {
      font: { sz: 9, bold: true, color: { rgb: COLORS.red } },
      border: thinBorder,
      alignment: { horizontal: 'right' },
      numFmt: '#,##0'
    };

    const totalRowStyle = {
      font: { bold: true, sz: 10, color: { rgb: COLORS.white } },
      fill: { fgColor: { rgb: COLORS.totalBg } },
      alignment: { horizontal: 'center' },
      border: thickBorder,
      numFmt: '#,##0'
    };

    const denomHeaderStyle = {
      font: { bold: true, sz: 11, color: { rgb: COLORS.white } },
      fill: { fgColor: { rgb: COLORS.denomBg } },
      alignment: { horizontal: 'center' },
      border: sectionBorder
    };

    const denomStyle = {
      font: { sz: 10 },
      border: thinBorder,
      alignment: { horizontal: 'center' }
    };

    const denomTotalStyle = {
      font: { bold: true, sz: 11, color: { rgb: COLORS.green } },
      fill: { fgColor: { rgb: COLORS.summaryBg } },
      border: thickBorder,
      alignment: { horizontal: 'center' },
      numFmt: '#,##0'
    };

    const summaryHeaderStyle = {
      font: { bold: true, sz: 11, color: { rgb: COLORS.white } },
      fill: { fgColor: { rgb: COLORS.green } },
      alignment: { horizontal: 'center' },
      border: sectionBorder
    };

    // === ROW 1: Title ===
    wsData.push([
      cell('TAMIL NADU STATE MARKETING CORPORATION LIMITED - COIMBATORE (NORTH)', titleStyle)
    ]);

    // === ROW 2: Blank ===
    wsData.push([]);

    // === ROW 3: Shop details ===
    wsData.push([
      cell('SHOP NO - 1745', shopStyle),
      cell('', shopStyle),
      cell('ADDRESS: SF NO-1101/1A, SIRUVANI MAIN ROAD, NEAR H.P PETROL BUNK, ALANDURAI, COIMBATORE-(NORTH) -641101', shopStyle)
    ]);

    // === ROW 4: Invoice info ===
    const invoiceNo = metadata?.invoiceNo || '';
    const invoiceDate = metadata?.invoiceDate || date;
    wsData.push([
      cell(`INVOICE NO: ${invoiceNo}`, infoStyle),
      cell('', infoStyle),
      cell(`INVOICE DATE: ${invoiceDate}`, infoStyle),
      cell('', infoStyle),
      cell(`DATE: ${date}`, infoStyle),
      cell('', infoStyle),
      cell(dayOfWeek, { ...infoStyle, font: { ...infoStyle.font, bold: true } })
    ]);

    // === ROW 5: Staff ===
    const salesmenNames = (staffSelection?.salesmen?.length > 0)
      ? staffSelection.salesmen.map((n, i) => `${i + 1}.${n}`).join(', ')
      : '1.SHANMUGASUNDARAM.P, 2.ARUMUGAM.A, 3.RAMESHKUMAR.A, 4.SHANMUGASUNDARAM.M';
    const supervisorNames = (staffSelection?.supervisors?.length > 0)
      ? staffSelection.supervisors.join(', ')
      : 'ANTONYSAMY.A';

    const totalSalesAmt = entries.reduce((sum, e) => sum + (e.salesAmt || 0), 0);
    wsData.push([
      cell(`INVOICE AMOUNT: ${totalSalesAmt}`, infoStyle),
      cell('', infoStyle),
      cell(`SALES MAN: ${salesmenNames}`, infoStyle)
    ]);

    // === ROW 6: Supervisor ===
    wsData.push([
      cell('', infoStyle),
      cell('', infoStyle),
      cell(`SUPERVISOR: ${supervisorNames}`, infoStyle),
      cell('', infoStyle),
      cell('MOBILE: 99429 10707, 99422 10707', infoStyle)
    ]);

    // === ROW 7: Column Headers ===
    const headers = ['S.NO', 'CODE NO', 'PARTICULAR', 'CASE', 'BOTTLE', 'OP.ST', 'PURCHASE',
      'ST.RETURN', 'TOTAL', 'CL.ST', 'SALES', 'RATE', 'SALES AMT', 'CL.VALUE',
      'OP VALUE', 'PUR VALUE', 'ST.RET VALUE'];
    wsData.push(headers.map(h => cell(h, colHeaderStyle)));

    // === DATA ROWS - grouped by category ===
    let currentCategory = '';
    const sortedEntries = [...entries].sort((a, b) => (a.sno || 0) - (b.sno || 0));

    let grandTotalSales = 0, grandTotalClValue = 0, grandTotalOpValue = 0, grandTotalPurValue = 0, grandTotalStRetValue = 0;

    sortedEntries.forEach((entry) => {
      const product = DEFAULT_PRODUCTS.find(p => p.id === entry.productId) || {};
      const category = CATEGORIES[entry.category || product.category];
      const caseSize = category ? category.bottlesPerCase : 48;

      // Category separator row
      if (entry.category !== currentCategory && entry.category) {
        currentCategory = entry.category;
        const catLabel = category ? category.label : entry.category;
        const catRow = Array(17).fill(cell('', categoryHeaderStyle));
        catRow[0] = cell(catLabel, categoryHeaderStyle);
        wsData.push(catRow);
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

      grandTotalSales += salesAmt;
      grandTotalClValue += clValue;
      grandTotalOpValue += opValue;
      grandTotalPurValue += purchaseValue;
      grandTotalStRetValue += stockReturnValue;

      const salesStyle = salesAmt < 0 ? negativeSalesStyle : salesAmtStyle;

      wsData.push([
        cell(entry.sno || product.sno || '', dataStyle),
        cell(entry.codeNo || product.codeNo || '', dataStyle),
        cell(entry.particular || product.particular || '', dataLeftStyle),
        cell(cases, inputStyle),
        cell(bottles, inputStyle),
        cell(opst, dataStyle),
        cell(purchase, inputStyle),
        cell(stockReturn, inputStyle),
        cell(total, dataStyle),
        cell(clst, { ...dataStyle, font: { sz: 9, bold: true } }),
        cell(sales, sales < 0 ? { ...dataStyle, font: { sz: 9, bold: true, color: { rgb: COLORS.red } } } : { ...dataStyle, font: { sz: 9, bold: true, color: { rgb: COLORS.green } } }),
        cell(rate, dataStyle),
        cell(salesAmt, salesStyle),
        cell(clValue, dataStyle),
        cell(opValue, dataStyle),
        cell(purchaseValue, dataStyle),
        cell(stockReturnValue, dataStyle)
      ]);
    });

    // === TOTALS ROW ===
    wsData.push([]);
    wsData.push([
      cell('TOTAL', totalRowStyle), cell('', totalRowStyle), cell('', totalRowStyle),
      cell('', totalRowStyle), cell('', totalRowStyle), cell('', totalRowStyle),
      cell('', totalRowStyle), cell('', totalRowStyle), cell('', totalRowStyle),
      cell('', totalRowStyle), cell('', totalRowStyle), cell('', totalRowStyle),
      cell(grandTotalSales, totalRowStyle),
      cell(grandTotalClValue, totalRowStyle),
      cell(grandTotalOpValue, totalRowStyle),
      cell(grandTotalPurValue, totalRowStyle),
      cell(grandTotalStRetValue, totalRowStyle)
    ]);

    // === POS / DIGITAL PAYMENT SECTION ===
    wsData.push([]);
    wsData.push([
      cell('POS / DIGITAL PAYMENT', summaryHeaderStyle),
      cell('', summaryHeaderStyle), cell('', summaryHeaderStyle)
    ]);
    wsData.push([
      cell('POS Amount', { ...denomStyle, font: { sz: 10, bold: true } }),
      cell('', denomStyle),
      cell(posAmount || 0, { ...denomTotalStyle })
    ]);
    wsData.push([
      cell('Cash Sales (Remittance)', { ...denomStyle, font: { sz: 10, bold: true } }),
      cell('', denomStyle),
      cell(totalSalesAmt - (posAmount || 0), { ...denomTotalStyle })
    ]);

    // === DEVICE vs MANUAL SECTION ===
    if (deviceValues && (deviceValues.salesBottles > 0 || deviceValues.salesValue > 0)) {
      wsData.push([]);
      wsData.push([
        cell('DEVICE vs MANUAL', summaryHeaderStyle),
        cell('Sales Btl', summaryHeaderStyle),
        cell('Closing Btl', summaryHeaderStyle),
        cell('Sales Val', summaryHeaderStyle),
        cell('Closing Val', summaryHeaderStyle)
      ]);

      const manualSalesBottles = entries.reduce((s, e) => {
        const cat = CATEGORIES[e.category];
        const cs = cat ? cat.bottlesPerCase : 48;
        const clst = (e.cases || 0) * cs + (e.bottles || 0);
        const total = (e.openingStock || 0) + (e.purchase || 0) - (e.stockReturn || 0);
        const sales = total - clst;
        return s + (sales > 0 ? sales : 0);
      }, 0);
      const manualClosingBottles = entries.reduce((s, e) => {
        const cat = CATEGORIES[e.category];
        const cs = cat ? cat.bottlesPerCase : 48;
        return s + ((e.cases || 0) * cs + (e.bottles || 0));
      }, 0);

      wsData.push([
        cell('Device', denomStyle),
        cell(deviceValues.salesBottles || 0, denomStyle),
        cell(deviceValues.closingBottles || 0, denomStyle),
        cell(deviceValues.salesValue || 0, denomStyle),
        cell(deviceValues.closingValue || 0, denomStyle)
      ]);
      wsData.push([
        cell('Manual', denomStyle),
        cell(manualSalesBottles, denomStyle),
        cell(manualClosingBottles, denomStyle),
        cell(totalSalesAmt, denomStyle),
        cell(grandTotalClValue, denomStyle)
      ]);
      wsData.push([
        cell('Difference', { ...denomTotalStyle, font: { bold: true, sz: 10, color: { rgb: COLORS.red } } }),
        cell((deviceValues.salesBottles || 0) - manualSalesBottles, denomStyle),
        cell((deviceValues.closingBottles || 0) - manualClosingBottles, denomStyle),
        cell((deviceValues.salesValue || 0) - totalSalesAmt, denomStyle),
        cell((deviceValues.closingValue || 0) - grandTotalClValue, denomStyle)
      ]);
    }

    // === DENOMINATION SECTION ===
    wsData.push([]);
    wsData.push([
      cell('DENOMINATION', denomHeaderStyle),
      cell('COUNT', denomHeaderStyle),
      cell('VALUE', denomHeaderStyle)
    ]);

    if (denomination) {
      const notes = [500, 200, 100, 50, 20, 10];
      notes.forEach(note => {
        const count = denomination.notes?.[note]?.count || 0;
        const noteColor = note >= 200 ? 'E8F5E9' : note >= 50 ? 'FFF3E0' : 'FFFFFF';
        const noteStyle = {
          font: { sz: 10, bold: count > 0 },
          fill: { fgColor: { rgb: noteColor } },
          border: thinBorder,
          alignment: { horizontal: 'center' }
        };
        wsData.push([
          cell(`Rs.${note}`, noteStyle),
          cell(count, noteStyle),
          cell(count * note, { ...noteStyle, numFmt: '#,##0' })
        ]);
      });
      wsData.push([
        cell('Coins', denomStyle),
        cell('', denomStyle),
        cell(denomination.coins || 0, denomStyle)
      ]);
      wsData.push([
        cell('TOTAL CASH', denomTotalStyle),
        cell('', denomTotalStyle),
        cell(denomination.totalCash || 0, denomTotalStyle)
      ]);
    }

    // === SUMMARY SECTION ===
    wsData.push([]);
    wsData.push([
      cell('DAILY SUMMARY', summaryHeaderStyle),
      cell('', summaryHeaderStyle),
      cell('', summaryHeaderStyle)
    ]);
    const summaryItems = [
      ['Total Sales (Grand Total)', grandTotalSales],
      ['POS / Digital', posAmount || 0],
      ['Cash Remittance', totalSalesAmt - (posAmount || 0)],
      ['Total Closing Stock Value', grandTotalClValue],
      ['Total Opening Stock Value', grandTotalOpValue],
      ['Total Purchase Value', grandTotalPurValue]
    ];
    summaryItems.forEach(([label, value]) => {
      wsData.push([
        cell(label, { ...denomStyle, alignment: { horizontal: 'left' } }),
        cell('', denomStyle),
        cell(value, { ...denomTotalStyle, numFmt: '#,##0' })
      ]);
    });

    // === Build worksheet from cell objects ===
    const ws = {};
    const range = { s: { c: 0, r: 0 }, e: { c: 0, r: 0 } };

    wsData.forEach((row, r) => {
      if (!row) return;
      row.forEach((cellObj, c) => {
        if (cellObj === undefined || cellObj === null) return;
        const cellRef = XLSX.utils.encode_cell({ r, c });
        if (typeof cellObj === 'object' && cellObj.v !== undefined) {
          ws[cellRef] = cellObj;
        } else {
          ws[cellRef] = { v: cellObj, t: typeof cellObj === 'number' ? 'n' : 's' };
        }
        if (r > range.e.r) range.e.r = r;
        if (c > range.e.c) range.e.c = c;
      });
    });

    ws['!ref'] = XLSX.utils.encode_range(range);

    // Column widths
    ws['!cols'] = [
      { wch: 7 },   // A - S.NO
      { wch: 10 },  // B - CODE NO
      { wch: 26 },  // C - PARTICULAR
      { wch: 7 },   // D - CASE
      { wch: 8 },   // E - BOTTLE
      { wch: 8 },   // F - OP.ST
      { wch: 10 },  // G - PURCHASE
      { wch: 10 },  // H - ST.RETURN
      { wch: 8 },   // I - TOTAL
      { wch: 8 },   // J - CL.ST
      { wch: 8 },   // K - SALES
      { wch: 8 },   // L - RATE
      { wch: 12 },  // M - SALES AMT
      { wch: 12 },  // N - CL.VALUE
      { wch: 12 },  // O - OP VALUE
      { wch: 12 },  // P - PUR VALUE
      { wch: 12 }   // Q - ST.RET VALUE
    ];

    // Merge cells for title row
    ws['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 16 } },   // Title
      { s: { r: 2, c: 2 }, e: { r: 2, c: 16 } },   // Address
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
