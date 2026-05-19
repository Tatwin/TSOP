/**
 * TASMAC Shop No. 1745 - Complete Product Catalog
 * All 54 products pre-loaded with CODE NO, name, category, case size, and rate
 */

const CATEGORIES = {
  '180ML_BRANDY': { label: '180ml Brandy', bottlesPerCase: 48 },
  '180ML_WHISKEY': { label: '180ml Whiskey', bottlesPerCase: 48 },
  '180ML_RUM': { label: '180ml Rum', bottlesPerCase: 48 },
  '180ML_WINE': { label: '180ml Wine', bottlesPerCase: 48 },
  '180ML_VODKA_GIN': { label: '180ml Vodka & Gin', bottlesPerCase: 48 },
  '375ML_BRANDY': { label: '375ml Brandy', bottlesPerCase: 24 },
  '375ML_WHISKEY': { label: '375ml Whiskey', bottlesPerCase: 24 },
  '375ML_RUM': { label: '375ml Rum', bottlesPerCase: 24 },
  '375ML_WINE': { label: '375ml Wine', bottlesPerCase: 24 },
  '375ML_VODKA_GIN': { label: '375ml Vodka & Gin', bottlesPerCase: 24 },
  '720ML': { label: '720ml (All Items)', bottlesPerCase: 12 },
  '1000ML': { label: '1000ml (All Items)', bottlesPerCase: 9 },
  'BEER_650ML': { label: 'Beer 650ml', bottlesPerCase: 48 },
  'BEER_325ML_500ML': { label: 'Beer 325ml & 500ml', bottlesPerCase: 24 },
  'BEER_500ML_CAN': { label: 'Beer 500ml Can', bottlesPerCase: 24 }
};

const DEFAULT_PRODUCTS = [
  // 180ml Brandy
  { id: '1', sno: 1, codeNo: '1', particular: 'G.G.B', category: '180ML_BRANDY', rate: 120 },
  { id: '2', sno: 2, codeNo: '722', particular: 'OLD CHEFF', category: '180ML_BRANDY', rate: 120 },
  { id: '3', sno: 3, codeNo: '1069', particular: 'SEAMAN', category: '180ML_BRANDY', rate: 120 },
  { id: '4', sno: 4, codeNo: '576', particular: 'HONEY BEE', category: '180ML_BRANDY', rate: 170 },
  { id: '5', sno: 5, codeNo: '714', particular: 'MCDOWELL NO.1', category: '180ML_BRANDY', rate: 170 },
  { id: '6', sno: 6, codeNo: '906', particular: 'MANSION HOUSE', category: '180ML_BRANDY', rate: 200 },

  // 180ml Whiskey
  { id: '7', sno: 7, codeNo: '2', particular: 'ORIGINAL CHOICE', category: '180ML_WHISKEY', rate: 120 },
  { id: '8', sno: 8, codeNo: '723', particular: 'IMPERIAL BLUE', category: '180ML_WHISKEY', rate: 170 },
  { id: '9', sno: 9, codeNo: '1070', particular: 'ROYAL STAG', category: '180ML_WHISKEY', rate: 170 },
  { id: '10', sno: 10, codeNo: '577', particular: 'BLENDERS PRIDE', category: '180ML_WHISKEY', rate: 300 },
  { id: '11', sno: 11, codeNo: '715', particular: 'ANTIQUITY BLUE', category: '180ML_WHISKEY', rate: 300 },

  // 180ml Rum
  { id: '12', sno: 12, codeNo: '3', particular: 'OLD MONK', category: '180ML_RUM', rate: 120 },
  { id: '13', sno: 13, codeNo: '724', particular: 'MCDOWELL RUM', category: '180ML_RUM', rate: 120 },
  { id: '14', sno: 14, codeNo: '1071', particular: 'HERCULES', category: '180ML_RUM', rate: 120 },

  // 180ml Wine
  { id: '15', sno: 15, codeNo: '4', particular: 'PORT WINE', category: '180ML_WINE', rate: 60 },
  { id: '16', sno: 16, codeNo: '725', particular: 'GOLCONDA WINE', category: '180ML_WINE', rate: 60 },

  // 180ml Vodka & Gin
  { id: '17', sno: 17, codeNo: '5', particular: 'MAGIC MOMENTS', category: '180ML_VODKA_GIN', rate: 170 },
  { id: '18', sno: 18, codeNo: '726', particular: 'ROMANOV', category: '180ML_VODKA_GIN', rate: 120 },
  { id: '19', sno: 19, codeNo: '1072', particular: 'BLUE RIBAND GIN', category: '180ML_VODKA_GIN', rate: 100 },

  // 375ml Brandy
  { id: '20', sno: 20, codeNo: '6', particular: 'G.G.B 375', category: '375ML_BRANDY', rate: 240 },
  { id: '21', sno: 21, codeNo: '727', particular: 'OLD CHEFF 375', category: '375ML_BRANDY', rate: 240 },
  { id: '22', sno: 22, codeNo: '1073', particular: 'HONEY BEE 375', category: '375ML_BRANDY', rate: 340 },
  { id: '23', sno: 23, codeNo: '578', particular: 'MCDOWELL NO.1 375', category: '375ML_BRANDY', rate: 340 },
  { id: '24', sno: 24, codeNo: '716', particular: 'MANSION HOUSE 375', category: '375ML_BRANDY', rate: 400 },

  // 375ml Whiskey
  { id: '25', sno: 25, codeNo: '7', particular: 'ORIGINAL CHOICE 375', category: '375ML_WHISKEY', rate: 240 },
  { id: '26', sno: 26, codeNo: '728', particular: 'IMPERIAL BLUE 375', category: '375ML_WHISKEY', rate: 340 },
  { id: '27', sno: 27, codeNo: '1074', particular: 'ROYAL STAG 375', category: '375ML_WHISKEY', rate: 340 },
  { id: '28', sno: 28, codeNo: '579', particular: 'BLENDERS PRIDE 375', category: '375ML_WHISKEY', rate: 600 },

  // 375ml Rum
  { id: '29', sno: 29, codeNo: '8', particular: 'OLD MONK 375', category: '375ML_RUM', rate: 240 },
  { id: '30', sno: 30, codeNo: '729', particular: 'MCDOWELL RUM 375', category: '375ML_RUM', rate: 240 },

  // 375ml Wine
  { id: '31', sno: 31, codeNo: '9', particular: 'PORT WINE 375', category: '375ML_WINE', rate: 120 },

  // 375ml Vodka & Gin
  { id: '32', sno: 32, codeNo: '10', particular: 'MAGIC MOMENTS 375', category: '375ML_VODKA_GIN', rate: 340 },
  { id: '33', sno: 33, codeNo: '730', particular: 'ROMANOV 375', category: '375ML_VODKA_GIN', rate: 240 },

  // 720ml (All Items)
  { id: '34', sno: 34, codeNo: '11', particular: 'G.G.B 720', category: '720ML', rate: 480 },
  { id: '35', sno: 35, codeNo: '731', particular: 'ORIGINAL CHOICE 720', category: '720ML', rate: 480 },
  { id: '36', sno: 36, codeNo: '1075', particular: 'HONEY BEE 720', category: '720ML', rate: 680 },
  { id: '37', sno: 37, codeNo: '580', particular: 'IMPERIAL BLUE 720', category: '720ML', rate: 680 },
  { id: '38', sno: 38, codeNo: '717', particular: 'ROYAL STAG 720', category: '720ML', rate: 680 },
  { id: '39', sno: 39, codeNo: '907', particular: 'BLENDERS PRIDE 720', category: '720ML', rate: 1200 },

  // 1000ml (All Items)
  { id: '40', sno: 40, codeNo: '12', particular: 'G.G.B 1000', category: '1000ML', rate: 640 },
  { id: '41', sno: 41, codeNo: '732', particular: 'ORIGINAL CHOICE 1000', category: '1000ML', rate: 640 },
  { id: '42', sno: 42, codeNo: '1076', particular: 'OLD MONK 1000', category: '1000ML', rate: 640 },
  { id: '43', sno: 43, codeNo: '581', particular: 'MCDOWELL NO.1 1000', category: '1000ML', rate: 900 },

  // Beer 650ml
  { id: '44', sno: 44, codeNo: '13', particular: 'KINGFISHER STRONG', category: 'BEER_650ML', rate: 180 },
  { id: '45', sno: 45, codeNo: '733', particular: 'KINGFISHER PREMIUM', category: 'BEER_650ML', rate: 170 },
  { id: '46', sno: 46, codeNo: '1077', particular: 'KNOCKOUT', category: 'BEER_650ML', rate: 150 },
  { id: '47', sno: 47, codeNo: '582', particular: 'HAYWARDS 5000', category: 'BEER_650ML', rate: 160 },
  { id: '48', sno: 48, codeNo: '718', particular: 'TUBORG STRONG', category: 'BEER_650ML', rate: 170 },

  // Beer 325ml & 500ml
  { id: '49', sno: 49, codeNo: '14', particular: 'KINGFISHER STRONG 500', category: 'BEER_325ML_500ML', rate: 140 },
  { id: '50', sno: 50, codeNo: '734', particular: 'KINGFISHER PREMIUM 325', category: 'BEER_325ML_500ML', rate: 90 },
  { id: '51', sno: 51, codeNo: '1078', particular: 'KNOCKOUT 500', category: 'BEER_325ML_500ML', rate: 120 },

  // Beer 500ml Can
  { id: '52', sno: 52, codeNo: '15', particular: 'KINGFISHER STRONG CAN', category: 'BEER_500ML_CAN', rate: 150 },
  { id: '53', sno: 53, codeNo: '735', particular: 'BUDWEISER CAN', category: 'BEER_500ML_CAN', rate: 160 },
  { id: '54', sno: 54, codeNo: '908', particular: 'HEINEKEN CAN', category: 'BEER_500ML_CAN', rate: 170 }
];

module.exports = { CATEGORIES, DEFAULT_PRODUCTS };
