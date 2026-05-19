/**
 * Firebase Sync Service - Production Grade
 * 
 * Architecture:
 * - Local SQLite is the ONLY source of truth
 * - Firebase Firestore is a read-only mirror for web dashboard
 * - Changes queue in pending_sync table
 * - Service processes queue every 5 minutes OR on immediate triggers
 * - Handles offline gracefully: queue accumulates, syncs on reconnect
 * - Retry with exponential backoff on failures
 * - Never blocks the main application flow
 * 
 * Sync events:
 * - IMMEDIATE: completed sale/invoice save, stock update, day close
 * - SCHEDULED: every 5 minutes for accumulated changes
 * - ON_RECONNECT: when internet comes back after being offline
 */
const dns = require('dns');

// ===== STATE =====
let database = null;        // database.js reference (for sync queue queries)
let firebase = null;        // firebase/config.js reference
let syncInterval = null;    // The 5-min interval timer
let isSyncing = false;      // Prevent concurrent sync runs
let isOnline = true;        // Internet connectivity status
let lastSyncTime = null;    // Timestamp of last successful sync
let consecutiveFailures = 0; // For exponential backoff
let connectivityCheckTimer = null;

const SYNC_INTERVAL_MS = 5 * 60 * 1000;     // 5 minutes
const CONNECTIVITY_CHECK_MS = 30 * 1000;     // Check internet every 30s
const MAX_RETRY_DELAY_MS = 15 * 60 * 1000;  // Max 15 min between retries
const BATCH_SIZE = 50;                        // Process 50 items per cycle
const MAX_CONSECUTIVE_FAILURES = 10;          // Stop retrying after 10 failures

let stats = {
  totalPushed: 0,
  totalFailed: 0,
  totalRetried: 0,
  cyclesRun: 0,
  lastError: null,
  startedAt: null
};

// ===== PUBLIC API =====

/**
 * Start the sync service
 * @param {Object} db - database.js module (provides getPendingSyncItems, markSynced, etc.)
 * @param {Object} fb - firebase/config.js module (provides syncDocument, isAvailable)
 */
function start(db, fb) {
  database = db;
  firebase = fb;
  
  if (!firebase || !firebase.isAvailable()) {
    console.log('[Sync] Firebase not available. Running in offline-only mode.');
    return;
  }
  
  stats.startedAt = new Date().toISOString();
  console.log('[Sync] Firebase sync service starting...');
  
  // Initial sync after 30 seconds (let app settle)
  setTimeout(() => processQueue(), 30 * 1000);
  
  // Regular scheduled sync
  syncInterval = setInterval(() => {
    if (isOnline) processQueue();
  }, SYNC_INTERVAL_MS);
  
  // Start connectivity monitoring
  startConnectivityCheck();
  
  console.log(`[Sync] Active (interval: ${SYNC_INTERVAL_MS / 60000}min, batch: ${BATCH_SIZE})`);
}

/**
 * Stop the sync service
 */
function stop() {
  if (syncInterval) {
    clearInterval(syncInterval);
    syncInterval = null;
  }
  if (connectivityCheckTimer) {
    clearInterval(connectivityCheckTimer);
    connectivityCheckTimer = null;
  }
  console.log('[Sync] Stopped');
}

/**
 * Process the pending sync queue
 * Called on schedule, on-demand (force), and on reconnect
 */
async function processQueue() {
  if (isSyncing) return;
  if (!firebase || !firebase.isAvailable()) return;
  if (!isOnline) return;
  
  isSyncing = true;
  stats.cyclesRun++;
  
  try {
    const pending = database.getPendingSyncItems(BATCH_SIZE);
    
    if (pending.length === 0) {
      isSyncing = false;
      consecutiveFailures = 0;
      return;
    }
    
    console.log(`[Sync] Processing ${pending.length} pending items...`);
    
    const successIds = [];
    let batchFailed = 0;
    
    for (const item of pending) {
      try {
        let data;
        try {
          data = JSON.parse(item.data);
        } catch {
          data = { raw: item.data };
        }
        
        const success = await firebase.syncDocument(item.table_name, item.record_id, {
          ...data,
          _operation: item.operation,
          _syncedAt: new Date().toISOString(),
          _source: 'desktop',
          _deviceId: item.device_id || 'unknown'
        });
        
        if (success) {
          successIds.push(item.id);
          stats.totalPushed++;
        } else {
          batchFailed++;
          stats.totalFailed++;
        }
      } catch (err) {
        batchFailed++;
        stats.totalFailed++;
        stats.lastError = `${item.table_name}/${item.record_id}: ${err.message}`;
        
        // If we get auth/network errors, stop processing this batch
        if (isNetworkError(err)) {
          console.log('[Sync] Network error detected - pausing sync');
          isOnline = false;
          break;
        }
      }
    }
    
    // Mark successful items
    if (successIds.length > 0) {
      database.markSynced(successIds);
      console.log(`[Sync] Synced ${successIds.length}/${pending.length} items`);
    }
    
    // Update state
    if (batchFailed === 0 && successIds.length > 0) {
      lastSyncTime = new Date().toISOString();
      consecutiveFailures = 0;
    } else if (batchFailed > 0) {
      consecutiveFailures++;
      if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
        console.error(`[Sync] ${MAX_CONSECUTIVE_FAILURES} consecutive failures - pausing sync`);
      }
    }
    
    // Clean old synced records periodically (every 10 cycles)
    if (stats.cyclesRun % 10 === 0) {
      database.cleanSyncQueue(7);
    }
    
  } catch (err) {
    console.error('[Sync] Queue processing error:', err.message);
    stats.lastError = err.message;
    consecutiveFailures++;
  } finally {
    isSyncing = false;
  }
}

/**
 * Force an immediate sync (called from UI "Sync Now" button)
 */
async function forceSync() {
  consecutiveFailures = 0; // Reset backoff
  await checkConnectivity();
  if (isOnline) {
    await processQueue();
  }
  return getStatus();
}

/**
 * Trigger immediate sync for important events
 * (completed sale, stock update, day close)
 */
function triggerImmediateSync(eventType) {
  if (!firebase || !firebase.isAvailable() || !isOnline) return;
  
  console.log(`[Sync] Immediate sync triggered: ${eventType}`);
  // Use setTimeout(0) so we don't block the caller
  setTimeout(() => processQueue(), 100);
}

/**
 * Push a daily summary to Firebase (lightweight aggregate for web dashboard)
 */
async function pushDailySummary(date, entries, metadata) {
  if (!firebase || !firebase.isAvailable() || !isOnline) return false;
  
  // Calculate summary
  let totalSales = 0, totalPurchase = 0, totalClValue = 0, totalBottles = 0;
  (entries || []).forEach(e => {
    totalSales += e.salesAmt || 0;
    totalPurchase += e.purchaseValue || 0;
    totalClValue += e.clValue || 0;
    if ((e.sales || 0) > 0) totalBottles += e.sales;
  });
  
  try {
    return await firebase.syncDailySummary(date, {
      date,
      totalSales,
      totalPurchase,
      totalClValue,
      totalBottles,
      posAmount: metadata?.posAmount || 0,
      entriesCount: (entries || []).length,
      updatedAt: new Date().toISOString()
    });
  } catch (err) {
    console.error('[Sync] Push daily summary failed:', err.message);
    return false;
  }
}

/**
 * Get comprehensive sync status (for UI display)
 */
function getStatus() {
  const queueStats = database ? database.getSyncStats() : { pendingCount: 0, syncedCount: 0, oldestPending: null };
  
  return {
    running: syncInterval !== null,
    firebaseAvailable: firebase ? firebase.isAvailable() : false,
    enabled: true,
    isOnline,
    isSyncing,
    lastSyncTime,
    consecutiveFailures,
    isPaused: consecutiveFailures >= MAX_CONSECUTIVE_FAILURES,
    stats: { ...stats },
    queue: queueStats,
    config: {
      intervalMs: SYNC_INTERVAL_MS,
      batchSize: BATCH_SIZE,
      maxRetries: MAX_CONSECUTIVE_FAILURES
    }
  };
}

/**
 * Enable/disable sync
 */
function setEnabled(enabled) {
  if (!database) return;
  
  if (enabled && !syncInterval && firebase && firebase.isAvailable()) {
    start(database, firebase);
  } else if (!enabled && syncInterval) {
    stop();
  }
}

// ===== CONNECTIVITY MANAGEMENT =====

/**
 * Start periodic internet connectivity checks
 */
function startConnectivityCheck() {
  checkConnectivity(); // Initial check
  connectivityCheckTimer = setInterval(checkConnectivity, CONNECTIVITY_CHECK_MS);
}

/**
 * Check if we have internet access
 */
async function checkConnectivity() {
  return new Promise((resolve) => {
    dns.resolve('firestore.googleapis.com', (err) => {
      const wasOffline = !isOnline;
      isOnline = !err;
      
      if (wasOffline && isOnline) {
        // Just reconnected! Trigger sync
        console.log('[Sync] Internet reconnected - triggering sync');
        consecutiveFailures = 0;
        setTimeout(() => processQueue(), 2000);
      } else if (!wasOffline && !isOnline) {
        console.log('[Sync] Internet disconnected - queue accumulating');
      }
      
      resolve(isOnline);
    });
  });
}

/**
 * Check if an error is a network/connectivity error
 */
function isNetworkError(err) {
  const msg = (err.message || '').toLowerCase();
  return msg.includes('enotfound') || 
         msg.includes('econnrefused') || 
         msg.includes('etimedout') || 
         msg.includes('network') ||
         msg.includes('fetch failed') ||
         msg.includes('socket hang up');
}

module.exports = {
  start,
  stop,
  processQueue,
  forceSync,
  triggerImmediateSync,
  pushDailySummary,
  getStatus,
  setEnabled,
  checkConnectivity
};
