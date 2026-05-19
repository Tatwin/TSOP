/**
 * In-memory database for development/testing when Firebase is not configured.
 * This simulates Firestore's basic operations.
 */

const store = {
  products: [],
  dailyEntries: {}, // key: "YYYY-MM-DD", value: array of product entries
  denominations: {}, // key: "YYYY-MM-DD", value: denomination data
  metadata: {}, // key: "YYYY-MM-DD", value: invoice info
  users: []
};

// Initialize with default products
const { DEFAULT_PRODUCTS } = require('../data/products');
store.products = [...DEFAULT_PRODUCTS];

const inMemoryDb = {
  collection(name) {
    return {
      doc(id) {
        return {
          async get() {
            const data = store[name]?.[id] || store[name]?.find?.(p => p.id === id);
            return {
              exists: !!data,
              data: () => data,
              id
            };
          },
          async set(data, options = {}) {
            if (Array.isArray(store[name])) {
              const idx = store[name].findIndex(p => p.id === id);
              if (idx >= 0) {
                store[name][idx] = options.merge ? { ...store[name][idx], ...data } : { ...data, id };
              } else {
                store[name].push({ ...data, id });
              }
            } else {
              store[name][id] = options.merge ? { ...store[name][id], ...data } : data;
            }
          },
          async update(data) {
            if (Array.isArray(store[name])) {
              const idx = store[name].findIndex(p => p.id === id);
              if (idx >= 0) {
                store[name][idx] = { ...store[name][idx], ...data };
              }
            } else {
              store[name][id] = { ...store[name][id], ...data };
            }
          },
          async delete() {
            if (Array.isArray(store[name])) {
              store[name] = store[name].filter(p => p.id !== id);
            } else {
              delete store[name][id];
            }
          }
        };
      },
      async get() {
        const items = Array.isArray(store[name]) ? store[name] : Object.entries(store[name]).map(([id, data]) => ({ id, data: () => data, exists: true }));
        return {
          docs: items.map(item => ({
            id: item.id || item,
            data: () => item.data ? item.data() : item,
            exists: true
          })),
          empty: items.length === 0
        };
      },
      where(field, op, value) {
        return {
          async get() {
            let items = Array.isArray(store[name]) ? store[name] : Object.entries(store[name]).map(([id, data]) => ({ ...data, id }));
            items = items.filter(item => {
              const fieldValue = item[field];
              switch (op) {
                case '==': return fieldValue === value;
                case '>=': return fieldValue >= value;
                case '<=': return fieldValue <= value;
                case '>': return fieldValue > value;
                case '<': return fieldValue < value;
                default: return true;
              }
            });
            return {
              docs: items.map(item => ({
                id: item.id,
                data: () => item,
                exists: true
              })),
              empty: items.length === 0
            };
          },
          where(field2, op2, value2) {
            return {
              async get() {
                let items = Array.isArray(store[name]) ? store[name] : Object.entries(store[name]).map(([id, data]) => ({ ...data, id }));
                items = items.filter(item => {
                  const fv1 = item[field];
                  const fv2 = item[field2];
                  let pass1, pass2;
                  switch (op) {
                    case '==': pass1 = fv1 === value; break;
                    case '>=': pass1 = fv1 >= value; break;
                    case '<=': pass1 = fv1 <= value; break;
                    default: pass1 = true;
                  }
                  switch (op2) {
                    case '==': pass2 = fv2 === value2; break;
                    case '>=': pass2 = fv2 >= value2; break;
                    case '<=': pass2 = fv2 <= value2; break;
                    default: pass2 = true;
                  }
                  return pass1 && pass2;
                });
                return {
                  docs: items.map(item => ({
                    id: item.id,
                    data: () => item,
                    exists: true
                  })),
                  empty: items.length === 0
                };
              }
            };
          }
        };
      }
    };
  },
  getStore() {
    return store;
  }
};

module.exports = inMemoryDb;
