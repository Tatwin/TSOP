import React, { useMemo } from 'react';
import { CATEGORIES, DEFAULT_PRODUCTS } from '../data/products';

/**
 * Range definitions for price-based classification
 * 180ml: Low=0-169, Medium=170-180, Premium=>180
 * 375ml: Low=0-340, Medium=400-440, Premium=>440 (anything below 280 in 375ml also counts as low)
 * 750ml: Low=<600, Medium=600-740, Premium=>740
 * 1000ml: Low=<800, Premium=>800, no medium
 * Beer: All as "STRONG BEER" for now, LAGER=0
 */
function classifyRange(category, rate) {
  if (category.startsWith('180ML')) {
    if (rate <= 169) return 'LOW';
    if (rate <= 180) return 'MEDIUM';
    return 'PREMIUM';
  }
  if (category.startsWith('375ML')) {
    if (rate < 280 || (rate >= 0 && rate <= 340)) return 'LOW';
    if (rate >= 400 && rate <= 440) return 'MEDIUM';
    if (rate > 440) return 'PREMIUM';
    return 'LOW';
  }
  if (category === '750ML') {
    if (rate < 600) return 'LOW';
    if (rate <= 740) return 'MEDIUM';
    return 'PREMIUM';
  }
  if (category === '1000ML') {
    if (rate < 800) return 'LOW';
    return 'PREMIUM';
  }
  // Beer
  return 'STRONG';
}

function isIMFS(category) {
  return category.startsWith('180ML') || category.startsWith('375ML') || category === '750ML' || category === '1000ML';
}

function isBeer(category) {
  return category.startsWith('BEER');
}

export default function CaseAbstract({ entries, calcEntry }) {
  const caseAbstract = useMemo(() => {
    let imfsOpening = 0, imfsPurchase = 0, imfsSales = 0, imfsClosing = 0;
    let beerOpening = 0, beerPurchase = 0, beerSales = 0, beerClosing = 0;

    entries.forEach(entry => {
      const caseSize = CATEGORIES[entry.category]?.bottlesPerCase || 48;
      const calc = calcEntry(entry);
      const opening = (entry.openingStock || 0) / caseSize;
      const purchase = (entry.purchase || 0) / caseSize;
      const sales = calc.sales > 0 ? calc.sales / caseSize : 0;
      const closing = calc.clst / caseSize;

      if (isIMFS(entry.category)) {
        imfsOpening += opening;
        imfsPurchase += purchase;
        imfsSales += sales;
        imfsClosing += closing;
      } else if (isBeer(entry.category)) {
        beerOpening += opening;
        beerPurchase += purchase;
        beerSales += sales;
        beerClosing += closing;
      }
    });

    return {
      imfs: {
        opening: Math.ceil(imfsOpening),
        purchase: Math.ceil(imfsPurchase),
        total: Math.ceil(imfsOpening + imfsPurchase),
        sales: Math.ceil(imfsSales),
        closing: Math.ceil(imfsClosing)
      },
      beer: {
        opening: Math.ceil(beerOpening),
        purchase: Math.ceil(beerPurchase),
        total: Math.ceil(beerOpening + beerPurchase),
        sales: Math.ceil(beerSales),
        closing: Math.ceil(beerClosing)
      }
    };
  }, [entries, calcEntry]);

  const total = {
    opening: caseAbstract.imfs.opening + caseAbstract.beer.opening,
    purchase: caseAbstract.imfs.purchase + caseAbstract.beer.purchase,
    total: caseAbstract.imfs.total + caseAbstract.beer.total,
    sales: caseAbstract.imfs.sales + caseAbstract.beer.sales,
    closing: caseAbstract.imfs.closing + caseAbstract.beer.closing
  };

  // Closing Stock Cases Abstract by range
  const rangeAbstract = useMemo(() => {
    const result = {
      opening: { imfs: { low: 0, medium: 0, premium: 0 }, beer: { strong: 0, lager: 0 } },
      purchase: { imfs: { low: 0, medium: 0, premium: 0 }, beer: { strong: 0, lager: 0 } },
      sales: { imfs: { low: 0, medium: 0, premium: 0 }, beer: { strong: 0, lager: 0 } },
      closing: { imfs: { low: 0, medium: 0, premium: 0 }, beer: { strong: 0, lager: 0 } }
    };

    entries.forEach(entry => {
      const caseSize = CATEGORIES[entry.category]?.bottlesPerCase || 48;
      const calc = calcEntry(entry);
      const rate = entry.rate || 0;
      const range = classifyRange(entry.category, rate);

      const opening = (entry.openingStock || 0) / caseSize;
      const purchase = (entry.purchase || 0) / caseSize;
      const sales = calc.sales > 0 ? calc.sales / caseSize : 0;
      const closing = calc.clst / caseSize;

      if (isIMFS(entry.category)) {
        if (range === 'LOW') {
          result.opening.imfs.low += opening;
          result.purchase.imfs.low += purchase;
          result.sales.imfs.low += sales;
          result.closing.imfs.low += closing;
        } else if (range === 'MEDIUM') {
          result.opening.imfs.medium += opening;
          result.purchase.imfs.medium += purchase;
          result.sales.imfs.medium += sales;
          result.closing.imfs.medium += closing;
        } else {
          result.opening.imfs.premium += opening;
          result.purchase.imfs.premium += purchase;
          result.sales.imfs.premium += sales;
          result.closing.imfs.premium += closing;
        }
      } else if (isBeer(entry.category)) {
        result.opening.beer.strong += opening;
        result.purchase.beer.strong += purchase;
        result.sales.beer.strong += sales;
        result.closing.beer.strong += closing;
      }
    });

    // Ceil all values
    Object.keys(result).forEach(type => {
      result[type].imfs.low = Math.ceil(result[type].imfs.low);
      result[type].imfs.medium = Math.ceil(result[type].imfs.medium);
      result[type].imfs.premium = Math.ceil(result[type].imfs.premium);
      result[type].beer.strong = Math.ceil(result[type].beer.strong);
      result[type].beer.lager = 0; // always 0 for now
    });

    return result;
  }, [entries, calcEntry]);

  const tableStyle = {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '0.85rem'
  };

  const thStyle = {
    padding: '8px 10px',
    background: '#1a237e',
    color: 'white',
    fontWeight: '600',
    textAlign: 'center',
    border: '1px solid #283593'
  };

  const tdStyle = {
    padding: '8px 10px',
    textAlign: 'center',
    border: '1px solid #e0e0e0',
    fontWeight: '600'
  };

  const renderRangeTable = (label, data) => (
    <div style={{ marginBottom: '16px' }}>
      <h4 style={{ fontSize: '0.95rem', color: '#1a237e', marginBottom: '8px', borderBottom: '2px solid #1a237e', paddingBottom: '4px' }}>
        {label} STOCK CASES ABSTRACT
      </h4>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
        {/* IMFS */}
        <div>
          <h5 style={{ fontSize: '0.85rem', marginBottom: '6px', color: '#333' }}>IMFS</h5>
          <table style={tableStyle}>
            <tbody>
              <tr style={{ background: '#e8f5e9' }}>
                <td style={{ ...tdStyle, textAlign: 'left' }}>LOW RANGE CASES</td>
                <td style={tdStyle}>{data.imfs.low}</td>
              </tr>
              <tr>
                <td style={{ ...tdStyle, textAlign: 'left' }}>MEDIUM RANGE CASES</td>
                <td style={tdStyle}>{data.imfs.medium}</td>
              </tr>
              <tr style={{ background: '#fff3e0' }}>
                <td style={{ ...tdStyle, textAlign: 'left' }}>PREMIUM RANGE CASES</td>
                <td style={tdStyle}>{data.imfs.premium}</td>
              </tr>
              <tr style={{ background: '#e3f2fd', fontWeight: '700' }}>
                <td style={{ ...tdStyle, textAlign: 'left' }}>TOTAL IMFS CASES</td>
                <td style={tdStyle}>{data.imfs.low + data.imfs.medium + data.imfs.premium}</td>
              </tr>
            </tbody>
          </table>
        </div>
        {/* BEER */}
        <div>
          <h5 style={{ fontSize: '0.85rem', marginBottom: '6px', color: '#333' }}>BEER</h5>
          <table style={tableStyle}>
            <tbody>
              <tr style={{ background: '#e8f5e9' }}>
                <td style={{ ...tdStyle, textAlign: 'left' }}>STRONG BEER CASES</td>
                <td style={tdStyle}>{data.beer.strong}</td>
              </tr>
              <tr>
                <td style={{ ...tdStyle, textAlign: 'left' }}>LAGER BEER CASES</td>
                <td style={tdStyle}>{data.beer.lager}</td>
              </tr>
              <tr style={{ background: '#e3f2fd', fontWeight: '700' }}>
                <td style={{ ...tdStyle, textAlign: 'left' }}>TOTAL BEER CASES</td>
                <td style={tdStyle}>{data.beer.strong + data.beer.lager}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  return (
    <div className="card">
      <h3 style={{ marginBottom: '12px', fontSize: '1.1rem', color: '#1a237e' }}>
        📦 CASE ABSTRACT
      </h3>

      {/* Main Case Abstract Table */}
      <div style={{ overflowX: 'auto', marginBottom: '20px' }}>
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={thStyle}></th>
              <th style={thStyle}>OPENING CASE</th>
              <th style={thStyle}>PURCHASE CASE</th>
              <th style={thStyle}>TOTAL CASE</th>
              <th style={thStyle}>SALES CASE</th>
              <th style={thStyle}>CLOSING CASE</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={{ ...tdStyle, fontWeight: '700', textAlign: 'left', background: '#e3f2fd' }}>IMFS</td>
              <td style={tdStyle}>{caseAbstract.imfs.opening}</td>
              <td style={tdStyle}>{caseAbstract.imfs.purchase}</td>
              <td style={tdStyle}>{caseAbstract.imfs.total}</td>
              <td style={tdStyle}>{caseAbstract.imfs.sales}</td>
              <td style={tdStyle}>{caseAbstract.imfs.closing}</td>
            </tr>
            <tr>
              <td style={{ ...tdStyle, fontWeight: '700', textAlign: 'left', background: '#fff3e0' }}>BEER</td>
              <td style={tdStyle}>{caseAbstract.beer.opening}</td>
              <td style={tdStyle}>{caseAbstract.beer.purchase}</td>
              <td style={tdStyle}>{caseAbstract.beer.total}</td>
              <td style={tdStyle}>{caseAbstract.beer.sales}</td>
              <td style={tdStyle}>{caseAbstract.beer.closing}</td>
            </tr>
            <tr style={{ background: '#e8eaf6' }}>
              <td style={{ ...tdStyle, fontWeight: '700', textAlign: 'left' }}>TOTAL</td>
              <td style={{ ...tdStyle, fontWeight: '700' }}>{total.opening}</td>
              <td style={{ ...tdStyle, fontWeight: '700' }}>{total.purchase}</td>
              <td style={{ ...tdStyle, fontWeight: '700' }}>{total.total}</td>
              <td style={{ ...tdStyle, fontWeight: '700' }}>{total.sales}</td>
              <td style={{ ...tdStyle, fontWeight: '700' }}>{total.closing}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Range-wise Abstract for all types */}
      {renderRangeTable('OPENING', rangeAbstract.opening)}
      {renderRangeTable('PURCHASE', rangeAbstract.purchase)}
      {renderRangeTable('SALES', rangeAbstract.sales)}
      {renderRangeTable('CLOSING', rangeAbstract.closing)}
    </div>
  );
}
