/**
 * Firebase Sync Service
 * Two-way sync between local SQLite and Firebase Firestore
 * 
 * Strategy:
 * - Local SQLite is the source of truth (desktop app)
 * - Firebase is a mirror for the web dashboard (read-only from web)
 * - Changes made locally are pushed to Firebase via sync queue
 * - Sync runs every 5 minutes when online
 * - If offline, changes queue up and sync when reconnected
 */

let database = null;
let firebase = null;
let syncInterval = null;
let isSyncing = false;
let lastSyncTime = null;
let syncStats = { pushed: 0, failed: 0, pending: 0 };

/**
 * Start the sync service
 */
function start(db, fb) {
  database = db;
  firebase = fb;
  
  if (!firebase.isAvailable()) {
    console.log('[Sync] Firebase not available. Sync service disabled.');
    return;
  }
  
  const syncEnabled = database.getSetting('firebaseSyncEnabled');
  if (syncEnabled !== 'true') {
    console.log('[Sync] Firebase sync is disabled in settings.');
    return;
  }
  
  console.log('[Sync] Starting Firebase sync service (every 5 minutes)');
  
  // Initial sync after 30 seconds
  setTimeout(() => processQueue(), 30000);
  
  // Regular sync every 5 minutes
  syncInterval = setInterval(() => processQueue(), 5 * 60 * 1000);
}

/**
 * Stop the sync service
 */
function stop() {
  if (syncInterval) {
    clearInterval(syncInterval);
    syncInterval = null;
  }
  console.log('[Sync] Stopped');
}

/**
 * Process pending sync items
 */
async function processQueue() {
  if (isSyncing || !firebase.isAvailable()) return;
  
  isSyncing = true;
  
  try {
    const pending = database.getPendingSyncItems(50);
    syncStats.pending = pending.length;
    
    if (pending.length === 0) {
      isSyncing = false;
      return;
    }
    
    console.log(`[Sync] Processing ${pending.length} pending items...`);
    
    const successIds = [];
    
    for (const item of pending) {
      try {
        const data = JSON.parse(item.data);
        const success = await firebase.syncDocument(item.table_name, item.record_id, {
          ...data,
          _operation: item.operation,
          _syncedAt: new Date().toISOString(),
          _source: 'desktop'
        });
        
        if (success) {
          successIds.push(item.id);
          syncStats.pushed++;
        } else {
          syncStats.failed++;
        }
      } catch (err) {
        console.error(`[Sync] Item ${item.id} failed:`, err.message);
        syncStats.failed++;
      }
    }
    
    // Mark successful items as synced
    if (successIds.length > 0) {
      database.markSynced(successIds);
      console.log(`[Sync] Successfully synced ${successIds.length} items`);
    }
    
    lastSyncTime = new Date().toISOString();
    
    // Clean old synced items periodically
    database.cleanSyncQueue(7);
    
  } catch (err) {
    console.error('[Sync] Queue processing error:', err.message);
  } finally {
    isSyncing = false;
  }
}

/**
 * Force an immediate sync
 */
async function forceSync() {
  await processQueue();
  return getStatus();
}

/**
 * Push full daily summary to Firebase (for web dashboard)
 */
async function pushDailySummary(date, entries, metadata) {
  if (!firebase.isAvailable()) return false;
  
  // Calculate summary
  let totalSales = 0, totalPurchase = 0, totalClValue = 0, totalBottles = 0;
  (entries || []).forEach(e => {
    totalSales += e.salesAmt || 0;
    totalPurchase += e.purchaseValue || 0;
    totalClValue += e.clValue || 0;
    if (e.sales > 0) totalBottles += e.sales;
  });
  
  return firebase.syncDailySummary(date, {
    date,
    totalSales,
    totalPurchase,
    totalClValue,
    totalBottles,
    posAmount: metadata?.posAmount || 0,
    entriesCount: (entries || []).length,
    updatedAt: new Date().toISOString()
  });
}

/**
 * Get sync status
 */
function getStatus() {
  return {
    running: syncInterval !== null,
    firebaseAvailable: firebase ? firebase.isAvailable() : false,
    enabled: database ? database.getSetting('firebaseSyncEnabled') === 'true' : false,
    isSyncing,
    lastSyncTime,
    stats: { ...syncStats },
    pendingCount: database ? database.getPendingSyncItems(1).length : 0
  };
}

/**
 * Enable/disable sync
 */
function setEnabled(enabled) {
  if (!database) return;
  database.setSetting('firebaseSyncEnabled', enabled ? 'true' : 'false');
  
  if (enabled && !syncInterval) {
    start(database, firebase);
  } else if (!enabled && syncInterval) {
    stop();
  }
}

module.exports = { start, stop, forceSync, pushDailySummary, getStatus, setEnabled, processQueue };
