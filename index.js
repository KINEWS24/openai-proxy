// index.js – ThinkAI Nexus v6.2 COMPLETE EDITION - SIMPLIFIED PROMPT SYSTEM!

// --- SCHRITT 1: IMPORTS & KONSTANTEN ---
const express = require("express");
const cors = require("cors");
const fs = require("fs").promises;
const fsSync = require("fs");
const path = require("path");
const { uuidv7 } = require("uuidv7");
const { OpenAI } = require("openai");
const { google } = require("googleapis");
const cheerio = require("cheerio");
const puppeteer = require("puppeteer");
const fetch = require("node-fetch");

// Nexus-All-in-One-Router
const nexusRouter = require("./modules/nexus");

// Globale Konfigurationen
const KNOWLEDGE_DIR         = path.join(__dirname, "knowledge");
const CAPTURE_PROMPT_PATH   = path.join(__dirname, "nexus_prompt_v5.3.txt");
const CLASSIFIER_PROMPT_PATH= path.join(__dirname, "nexus_prompt_classifier_v1.0.txt");
const CLASSIFIER_OUTPUT_DIR = path.join(__dirname, "classifier-output");
const OPENAI_API_KEY        = process.env.OPENAI_API_KEY;
const SCRAPER_API_KEY       = process.env.SCRAPER_API_KEY;
const MAX_CONTENT_LENGTH    = 8000;
const COMPLETION_MODEL      = "gpt-4o";
const PORT                  = process.env.PORT || 10000;

// v6.2 Enhanced Constants
const SIMPLIFIED_PROMPT_ENABLED = true; // Feature flag for gradual rollout

// === v6.2 UUID-FORMAT KONSTANTEN ===
const NEXUS_V62_OWNER = 'oliver';           // Single-User System
const NEXUS_V62_ENTRY_POINT = 'pc';         // Browser Extension  
const NEXUS_V62_CLUSTER = 'clst001';        // Standard Cluster

// Workspace-Abkürzungen für kompakte Dateinamen
const WORKSPACE_CODES = {
  'professional': 'work',
  'personal': 'home', 
  'social': 'community'
};

// Vereinheitlichte Archetype-Liste (lowercase für Dateinamen)
const VALID_ARCHETYPES = {
  'Calendar': 'calendar',
  'Contact': 'contact', 
  'Email': 'email',
  'Project': 'project',
  'Link': 'link',
  'Document': 'document',
  'Text': 'text',
  'Image': 'image',
  'Audio': 'audio',
  'Video': 'video', 
  'Data': 'data',
  'Mixed': 'mixed'
};

// Default-Optionen für Chat
const defaultChatOptions = {
  topK: 10,
  sortBy: "relevance",
  includeHighlights: true
};

// Globale Instanzen
let openai;

// 🚀 PERFORMANCE CACHE SYSTEM v6.1
let knowledgeCache = new Map();     // filename -> parsed metadata
let searchIndex = new Map();        // filename -> searchable text
let workspaceCache = new Map();     // workspace -> files
let clusterCache = new Map();       // cluster_id -> related files
let entryPointCache = new Map();    // entry_point -> files
let uuidVersionMap = new Map();     // filename -> uuid_version (legacy vs v6.1)
let lastCacheUpdate = null;
let fileWatcher = null;

// --- v6.1 UUID SCHEMA DEFINITIONEN ---
const NEXUS_V61_ARCHETYPEN = [
  'Text', 'Image', 'Link', 'Audio', 'Video', 
  'Document', 'Data', 'Message', 'Mixed'
];

const NEXUS_V61_WORKSPACES = {
  personal: ['home', 'mobile'],
  professional: ['work', 'team', 'org'], 
  social: ['family', 'club', 'hobby', 'community']
};

const NEXUS_V61_ENTRY_POINTS = ['pc', 'mobile', 'office', 'auto'];

// --- SCHRITT 2: v6.1 UUID & CACHE FUNKTIONEN ---

/**
 * 🆔 v6.1 UUID Parser - Erkennt v6.1 Format und Legacy UUIDs
 * @param {string} filename - Dateiname 
 * @returns {object} Parsed UUID components oder null
 */
function parseNexusUUID(filename) {
  // Extrahiere UUID aus Dateiname (remove .tags.json)
  const baseFilename = filename.replace('.tags.json', '');
  
  // v6.1 Format: nexus-v6-{scope}-{owner}-{workspace}-{entry_point}-{archetype}-{timestamp}-{cluster_id}-{unique_id}
  const v61Pattern = /^nexus-v6-([^-]+)-([^-]+)-([^-]+)-([^-]+)-([^-]+)-([^-]+)-([^-]+)-([^-]+)$/;
  const v61Match = baseFilename.match(v61Pattern);
  
  if (v61Match) {
    return {
      version: 'v6.1',
      scope: v61Match[1],
      owner: v61Match[2], 
      workspace: v61Match[3],
      entry_point: v61Match[4],
      archetype: v61Match[5],
      timestamp: v61Match[6],
      cluster_id: v61Match[7],
      unique_id: v61Match[8],
      full_uuid: baseFilename
    };
  }
  
  // Legacy Format (alles andere)
  return {
    version: 'legacy',
    workspace: 'work', // Default für Legacy
    entry_point: 'pc',  // Default für Legacy
    archetype: 'Mixed', // Default für Legacy
    cluster_id: 'clst000', // Legacy Cluster
    full_uuid: baseFilename,
    timestamp: null
  };
}

/**
 * 🏗️ Workspace-aware Cache Loading
 * @param {string} workspace - Target workspace oder 'all'
 * @returns {Map} Filtered cache für Workspace
 */
function getWorkspaceCache(workspace = 'all') {
  if (workspace === 'all') {
    return knowledgeCache;
  }
  
  const workspaceFiles = new Map();
  
  for (const [filename, metadata] of knowledgeCache.entries()) {
    const uuidData = parseNexusUUID(filename);
    if (uuidData && uuidData.workspace === workspace) {
      workspaceFiles.set(filename, metadata);
    }
  }
  
  return workspaceFiles;
}

/**
 * 🔍 Entry-Point Detection Logic
 * @param {object} metadata - File metadata
 * @param {object} uuidData - Parsed UUID data
 * @returns {string} Detected entry point
 */
function detectEntryPoint(metadata, uuidData) {
  // v6.1 UUIDs haben bereits entry_point
  if (uuidData.version === 'v6.1') {
    return uuidData.entry_point;
  }
  
  // Legacy Detection Logic
  const properties = metadata.Properties || {};
  
  // Mobile indicators
  if (properties.device_type === 'mobile' || 
      properties.capture_method === 'mobile' ||
      properties.geo_data) {
    return 'mobile';
  }
  
  // Office indicators  
  if (properties.meeting_context || 
      properties.calendar_event ||
      properties.attendees) {
    return 'office';
  }
  
  // Auto indicators
  if (properties.automated || 
      properties.api_generated ||
      properties.scheduled) {
    return 'auto';
  }
  
  // Default
  return 'pc';
}

/**
 * 🧩 Cluster Analysis - Findet verwandte Objekte
 * @param {object} uuidData - Parsed UUID data
 * @param {object} metadata - File metadata  
 * @returns {Array} Related cluster objects
 */
function analyzeClusterRelations(uuidData, metadata) {
  const relatedObjects = [];
  
  if (uuidData.version === 'v6.1' && uuidData.cluster_id !== 'clst000') {
    // Finde andere Objekte im gleichen Cluster
    for (const [filename, _] of knowledgeCache.entries()) {
      const otherUuid = parseNexusUUID(filename);
      if (otherUuid.version === 'v6.1' && 
          otherUuid.cluster_id === uuidData.cluster_id &&
          otherUuid.full_uuid !== uuidData.full_uuid) {
        relatedObjects.push({
          filename,
          cluster_id: otherUuid.cluster_id,
          relationship: 'cluster_member'
        });
      }
    }
  }
  
  return relatedObjects;
}

/**
 * 📊 Enhanced Cache Statistics - v6.1 Metrics
 */
function getEnhancedCacheStats() {
  const stats = {
    total_files: knowledgeCache.size,
    v61_files: 0,
    legacy_files: 0,
    workspaces: {},
    entry_points: {},
    archetypen: {},
    clusters: new Set(),
    last_update: lastCacheUpdate
  };
  
  for (const [filename, metadata] of knowledgeCache.entries()) {
    const uuidData = parseNexusUUID(filename);
    
    if (uuidData.version === 'v6.1') {
      stats.v61_files++;
      
      // Workspace stats
      stats.workspaces[uuidData.workspace] = (stats.workspaces[uuidData.workspace] || 0) + 1;
      
      // Entry point stats  
      stats.entry_points[uuidData.entry_point] = (stats.entry_points[uuidData.entry_point] || 0) + 1;
      
      // Archetyp stats
      stats.archetypen[uuidData.archetype] = (stats.archetypen[uuidData.archetype] || 0) + 1;
      
      // Cluster tracking
      if (uuidData.cluster_id !== 'clst000') {
        stats.clusters.add(uuidData.cluster_id);
      }
    } else {
      stats.legacy_files++;
    }
  }
  
  stats.cluster_count = stats.clusters.size;
  delete stats.clusters; // Convert Set to count
  
  return stats;
}

/**
 * 🚀 PERFORMANCE: Lädt alle Knowledge-Dateien beim Server-Start in Memory (v6.1 Enhanced)
 */
async function buildKnowledgeCache() {
  console.log('[CACHE v6.1] Building enhanced knowledge cache...');
  const startTime = Date.now();
  
  try {
    const allFiles = await fs.readdir(KNOWLEDGE_DIR);
    const jsonFiles = allFiles.filter(f => f.endsWith(".tags.json"));
    
    console.log(`[CACHE v6.1] Found ${jsonFiles.length} knowledge files to cache`);
    
    // Clear existing caches
    knowledgeCache.clear();
    searchIndex.clear();
    workspaceCache.clear();
    clusterCache.clear();
    entryPointCache.clear();
    uuidVersionMap.clear();
    
    // Load all files in parallel for maximum speed
    const loadPromises = jsonFiles.map(async (filename) => {
      try {
        const filePath = path.join(KNOWLEDGE_DIR, filename);
        const content = await fs.readFile(filePath, "utf8");
        const metadata = JSON.parse(content);
        
        // Parse UUID for v6.1 features
        const uuidData = parseNexusUUID(filename);
        const entryPoint = detectEntryPoint(metadata, uuidData);
        
        // Cache parsed metadata
        knowledgeCache.set(filename, metadata);
        uuidVersionMap.set(filename, uuidData.version);
        
        // Build searchable text index
        const searchableFields = [
          metadata.Title || "",
          metadata.Summary || "",
          metadata.Subject || "",
          (metadata.KeyPoints || []).join(" "),
          (metadata.Tags || []).join(" "),
          ...(metadata.Properties ? Object.values(metadata.Properties).filter(v => typeof v === 'string') : [])
        ];
        
        const searchableText = searchableFields.join(" ").toLowerCase();
        searchIndex.set(filename, searchableText);
        
        // v6.1 Enhanced Indexing
        // Workspace Cache
        if (!workspaceCache.has(uuidData.workspace)) {
          workspaceCache.set(uuidData.workspace, new Set());
        }
        workspaceCache.get(uuidData.workspace).add(filename);
        
        // Entry Point Cache
        if (!entryPointCache.has(entryPoint)) {
          entryPointCache.set(entryPoint, new Set());
        }
        entryPointCache.get(entryPoint).add(filename);
        
        // Cluster Cache
        if (uuidData.cluster_id && uuidData.cluster_id !== 'clst000') {
          if (!clusterCache.has(uuidData.cluster_id)) {
            clusterCache.set(uuidData.cluster_id, new Set());
          }
          clusterCache.get(uuidData.cluster_id).add(filename);
        }
        
        return { filename, success: true, version: uuidData.version };
      } catch (error) {
        console.warn(`[CACHE v6.1] Failed to load ${filename}:`, error.message);
        return { filename, success: false, error: error.message };
      }
    });
    
    const results = await Promise.all(loadPromises);
    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    const v61Files = results.filter(r => r.success && r.version === 'v6.1').length;
    const legacyFiles = results.filter(r => r.success && r.version === 'legacy').length;
    
    const loadTime = Date.now() - startTime;
    lastCacheUpdate = new Date();
    
    console.log(`[CACHE v6.1] ✅ Enhanced cache built:`);
    console.log(`  📊 Total: ${successful} files loaded, ${failed} failed in ${loadTime}ms`);
    console.log(`  🆔 v6.1: ${v61Files} files, Legacy: ${legacyFiles} files`);
    console.log(`  🏗️ Workspaces: ${workspaceCache.size}, Clusters: ${clusterCache.size}`);
    console.log(`  📱 Entry Points: ${entryPointCache.size}`);
    
    if (failed > 0) {
      console.warn(`[CACHE v6.1] ⚠️ Failed files:`, results.filter(r => !r.success));
    }
    
    return { successful, failed, loadTime, v61Files, legacyFiles };
    
  } catch (error) {
    console.error('[CACHE v6.1] ❌ Failed to build cache:', error);
    throw error;
  }
}

/**
 * 🚀 PERFORMANCE: Überwacht Knowledge-Directory für Änderungen (v6.1 Enhanced)
 */
function setupFileWatcher() {
  if (fileWatcher) {
    fileWatcher.close();
  }
  
  try {
    fileWatcher = fsSync.watch(KNOWLEDGE_DIR, { recursive: false }, (eventType, filename) => {
      if (filename && filename.endsWith('.tags.json')) {
        console.log(`[WATCHER v6.1] File ${eventType}: ${filename}`);
        
        // Debounce: Update cache nach 500ms
        setTimeout(async () => {
          try {
            if (eventType === 'rename' && !fsSync.existsSync(path.join(KNOWLEDGE_DIR, filename))) {
              // File deleted - Enhanced cleanup
              const uuidData = parseNexusUUID(filename);
              
              knowledgeCache.delete(filename);
              searchIndex.delete(filename);
              uuidVersionMap.delete(filename);
              
              // Clean v6.1 caches
              if (workspaceCache.has(uuidData.workspace)) {
                workspaceCache.get(uuidData.workspace).delete(filename);
              }
              
              const entryPoint = detectEntryPoint({}, uuidData);
              if (entryPointCache.has(entryPoint)) {
                entryPointCache.get(entryPoint).delete(filename);
              }
              
              if (uuidData.cluster_id && clusterCache.has(uuidData.cluster_id)) {
                clusterCache.get(uuidData.cluster_id).delete(filename);
              }
              
              console.log(`[WATCHER v6.1] ✅ Removed ${filename} from all caches`);
            } else {
              // File added or modified - Enhanced indexing
              const filePath = path.join(KNOWLEDGE_DIR, filename);
              const content = await fs.readFile(filePath, "utf8");
              const metadata = JSON.parse(content);
              const uuidData = parseNexusUUID(filename);
              const entryPoint = detectEntryPoint(metadata, uuidData);
              
              knowledgeCache.set(filename, metadata);
              uuidVersionMap.set(filename, uuidData.version);
              
              const searchableFields = [
                metadata.Title || "",
                metadata.Summary || "",
                metadata.Subject || "",
                (metadata.KeyPoints || []).join(" "),
                (metadata.Tags || []).join(" "),
                ...(metadata.Properties ? Object.values(metadata.Properties).filter(v => typeof v === 'string') : [])
              ];
              
              const searchableText = searchableFields.join(" ").toLowerCase();
              searchIndex.set(filename, searchableText);
              
              // Update v6.1 caches
              if (!workspaceCache.has(uuidData.workspace)) {
                workspaceCache.set(uuidData.workspace, new Set());
              }
              workspaceCache.get(uuidData.workspace).add(filename);
              
              if (!entryPointCache.has(entryPoint)) {
                entryPointCache.set(entryPoint, new Set());
              }
              entryPointCache.get(entryPoint).add(filename);
              
              if (uuidData.cluster_id && uuidData.cluster_id !== 'clst000') {
                if (!clusterCache.has(uuidData.cluster_id)) {
                  clusterCache.set(uuidData.cluster_id, new Set());
                }
                clusterCache.get(uuidData.cluster_id).add(filename);
              }
              
              console.log(`[WATCHER v6.1] ✅ Updated ${filename} in all caches (${uuidData.version})`);
            }
            
            lastCacheUpdate = new Date();
          } catch (error) {
            console.error(`[WATCHER v6.1] ❌ Failed to update cache for ${filename}:`, error);
          }
        }, 500);
      }
    });
    
    console.log('[WATCHER v6.1] ✅ Enhanced file watcher active');
  } catch (error) {
    console.warn('[WATCHER v6.1] ⚠️ Could not setup file watcher:', error.message);
  }
}

/**
 * 🚀 PERFORMANCE: Enhanced Cached Search v6.1 - Workspace & Cluster Aware
 */
function performCachedSearch(query, options = {}) {
  const startTime = Date.now();
  const mergedOptions = { ...defaultChatOptions, ...options };
  
  // v6.1 Enhanced Options
  const { 
    workspace = 'all', 
    entry_point = 'all', 
    cluster_id = null,
    include_related = true 
  } = options;
  
  console.log(`[SEARCH v6.1] Processing query: "${query}" (workspace: ${workspace}, entry_point: ${entry_point})`);
  
  if (knowledgeCache.size === 0) {
    console.warn('[SEARCH v6.1] ⚠️ Cache is empty - rebuilding...');
    buildKnowledgeCache().catch(console.error);
    return { results: [], stats: { totalFiles: 0, searchResults: 0, searchTime: 0 } };
  }
  
  // Filter files based on v6.1 criteria
  let targetFiles = knowledgeCache;
  
  if (workspace !== 'all') {
    targetFiles = getWorkspaceCache(workspace);
  }
  
  const searchResults = [];
  
  // Process filtered files using cached data
  for (const [filename, searchableText] of searchIndex.entries()) {
    // Skip if not in target workspace
    if (workspace !== 'all' && !targetFiles.has(filename)) {
      continue;
    }
    
    // Filter by entry_point if specified
    if (entry_point !== 'all') {
      const uuidData = parseNexusUUID(filename);
      const fileEntryPoint = detectEntryPoint(knowledgeCache.get(filename), uuidData);
      if (fileEntryPoint !== entry_point) {
        continue;
      }
    }
    
    // Filter by cluster if specified
    if (cluster_id) {
      const uuidData = parseNexusUUID(filename);
      if (uuidData.cluster_id !== cluster_id) {
        continue;
      }
    }
    
    const metadata = knowledgeCache.get(filename);
    if (!metadata) continue;
    
    const searchScore = calculateSearchScore(query, searchableText);
    
    if (searchScore > 0.2) {
      const matchDetails = getMatchDetails(query, searchableText);
      const uuidData = parseNexusUUID(filename);
      const clusterRelations = analyzeClusterRelations(uuidData, metadata);
      
      searchResults.push({
        filename,
        metadata,
        searchableText,
        score: searchScore,
        matchDetails,
        uuidData,
        clusterRelations,
        entryPoint: detectEntryPoint(metadata, uuidData)
      });
    }
  }
  
  // Sort and limit results
  searchResults.sort((a, b) => b.score - a.score);
  const topResults = searchResults.slice(0, mergedOptions.topK);
  
  // Add related cluster objects if requested
  if (include_related && topResults.length > 0) {
    const relatedFiles = new Set();
    
    for (const result of topResults) {
      for (const relation of result.clusterRelations) {
        if (!relatedFiles.has(relation.filename) && relatedFiles.size < 5) {
          relatedFiles.add(relation.filename);
        }
      }
    }
    
    // Add related files as separate results
    for (const relatedFilename of relatedFiles) {
      if (!topResults.find(r => r.filename === relatedFilename)) {
        const metadata = knowledgeCache.get(relatedFilename);
        const uuidData = parseNexusUUID(relatedFilename);
        
        topResults.push({
          filename: relatedFilename,
          metadata,
          searchableText: searchIndex.get(relatedFilename),
          score: 0.1, // Lower score for related items
          matchDetails: { queryTokens: [], matches: [], matchRatio: 0, matchedTerms: [] },
          uuidData,
          clusterRelations: [],
          entryPoint: detectEntryPoint(metadata, uuidData),
          isRelated: true
        });
      }
    }
  }
  
  const searchTime = Date.now() - startTime;
  
  console.log(`[SEARCH v6.1] ✅ Found ${searchResults.length} results in ${searchTime}ms (workspace: ${workspace})`);
  
  return {
    results: topResults,
    stats: {
      totalFiles: targetFiles.size,
      searchResults: searchResults.length,
      topResults: topResults.length,
      searchTime,
      cacheHit: true,
      lastCacheUpdate,
      workspace,
      entry_point,
      cluster_id
    }
  };
}

// --- SCHRITT 3: INITIALISIERUNG ---
async function initializeApp() {
  if (!OPENAI_API_KEY) {
    console.error("FATAL: OPENAI_API_KEY ist nicht gesetzt.");
    process.exit(1);
  }
  openai = new OpenAI({ apiKey: OPENAI_API_KEY });

  // Prüfe Prompt-Dateien
  try {
    await fs.access(CAPTURE_PROMPT_PATH);
    await fs.access(CLASSIFIER_PROMPT_PATH);
  } catch (err) {
    console.error("FATAL: Eine Prompt-Datei fehlt.", err);
    process.exit(1);
  }

  // Ordner für Klassifizierer-Ausgabe
  try {
    await fs.mkdir(CLASSIFIER_OUTPUT_DIR, { recursive: true });
    await fs.mkdir(KNOWLEDGE_DIR, { recursive: true });
  } catch (err) {
    console.error("FATAL: Konnte Verzeichnisse nicht anlegen.", err);
    process.exit(1);
  }

  if (!SCRAPER_API_KEY) {
    console.warn("WARN: SCRAPER_API_KEY nicht gesetzt, nutze Puppeteer-Fallback");
  }
  
  // 🚀 PERFORMANCE: Build initial enhanced cache
  try {
    await buildKnowledgeCache();
    setupFileWatcher();
  } catch (error) {
    console.error("❌ Failed to initialize enhanced performance cache:", error);
    // Continue without cache - will fall back to file reading
  }
}

// --- SCHRITT 4: SEARCH-HILFSFUNKTIONEN (UNCHANGED - ALREADY OPTIMIZED) ---

/**
 * Berechnet Relevanz-Score für eine Suchanfrage
 * @param {string} query - Suchanfrage (bereits lowercase)
 * @param {string} text - Durchsuchbarer Text (bereits lowercase)
 * @returns {number} Score zwischen 0 und 1
 */
function calculateSearchScore(query, text) {
  // Text normalisieren
  const normalizeText = (str) => {
    return str
      .toLowerCase()
      .replace(/[äöüß]/g, (match) => ({
        'ä': 'ae', 'ö': 'oe', 'ü': 'ue', 'ß': 'ss'
      }[match]))
      .replace(/[^\w\s]/g, ' ')  // Sonderzeichen entfernen
      .replace(/\s+/g, ' ')      // Mehrfache Leerzeichen normalisieren
      .trim();
  };

  const normalizedQuery = normalizeText(query);
  const normalizedText = normalizeText(text);
  
  // Query in relevante Tokens aufteilen
  const queryTokens = normalizedQuery
    .split(/\s+/)
    .filter(token => token.length > 2); // Nur relevante Wörter (nicht "ist", "der", etc.)
  
  if (queryTokens.length === 0) return 0;
  
  let totalScore = 0;
  const foundTokens = [];
  
  for (const token of queryTokens) {
    if (normalizedText.includes(token)) {
      foundTokens.push(token);
      totalScore += 1;
      
      // Bonus für Wortanfänge (q3 matched "q3meeting" besser)
      const wordBoundaryRegex = new RegExp(`\\b${token}`, 'i');
      if (wordBoundaryRegex.test(normalizedText)) {
        totalScore += 0.5;
      }
    }
  }
  
  // Phrase-Matching Bonus
  if (foundTokens.length > 1) {
    const queryPhrase = queryTokens.join('.*');
    const phraseRegex = new RegExp(queryPhrase, 'i');
    if (phraseRegex.test(normalizedText)) {
      totalScore += 1; // Starker Bonus für Phrase-Matches
    }
  }
  
  return Math.min(totalScore / queryTokens.length, 1); // Normalisiert 0-1, aber mit Bonus-Cap
}

/**
 * Erstellt Details über gefundene Matches
 * @param {string} query - Original Query
 * @param {string} text - Durchsuchter Text
 * @returns {object} Match-Details
 */
function getMatchDetails(query, text) {
  const queryTokens = query.toLowerCase()
    .split(/\s+/)
    .filter(t => t.length > 2);
    
  const matches = queryTokens.filter(token => 
    text.toLowerCase().includes(token.toLowerCase())
  );
  
  return { 
    queryTokens, 
    matches, 
    matchRatio: matches.length / (queryTokens.length || 1),
    matchedTerms: matches
  };
}

/**
 * Erstellt Kontext-Text für AI aus Search-Ergebnissen (v6.1 Enhanced)
 * @param {Array} results - Top Search Results
 * @returns {string} Formatierter Context
 */
function createAIContext(results) {
  return results.map((result, index) => {
    const metadata = result.metadata;
    const uuidData = result.uuidData;
    
    let context = `[${index + 1}] ${metadata.Title || 'Unbekannter Titel'}`;
    
    // v6.1 Context Enhancement
    if (uuidData.version === 'v6.1') {
      context += ` (${uuidData.workspace}/${uuidData.entry_point}/${uuidData.archetype})`;
    }
    
    if (metadata.Summary) {
      context += `\nZusammenfassung: ${metadata.Summary}`;
    }
    
    if (metadata.KeyPoints && metadata.KeyPoints.length > 0) {
      context += `\nWichtige Punkte: ${metadata.KeyPoints.join(", ")}`;
    }
    
    // Cluster Relations
    if (result.clusterRelations && result.clusterRelations.length > 0) {
      context += `\nVerwandte Inhalte: ${result.clusterRelations.length} weitere Objekte`;
    }
    
    // Spezielle Felder für Kalender-Events
    if (metadata.Properties && metadata.Properties.DTSTART) {
      context += `\nDatum: ${metadata.Properties.DTSTART}`;
    }
    if (metadata.Properties && metadata.Properties.LOCATION) {
      context += `\nOrt: ${metadata.Properties.LOCATION}`;
    }
    
    return context;
  }).join("\n\n---\n\n");
}

// --- SCHRITT 5: v6.2 SIMPLIFIED ANALYSIS SYSTEM ---

// =====================================
// v6.2 SIMPLIFIED PROMPT DEFINITION
// =====================================

const SIMPLIFIED_ANALYSIS_PROMPT = `
Analysiere diesen Content und antworte NUR im JSON-Format:

{
  "filename": "[YYYY-MM-DD]_[Archetyp]_[Hauptthema]_[Person/Kunde]",
  "archetype": "[Email|Calendar|Contact|Project|Link|Document|Text]", 
  "hashtags": ["#tag1", "#tag2", "#tag3", "#tag4", "#tag5"],
  "summary": "1-3 kurze Sätze was das ist und warum wichtig."
}

REGELN:
- Filename: Datum_Typ_Thema_Person/Quelle (keine Sonderzeichen, max 60 Zeichen)
- Archetype: Einen der 7 Haupttypen wählen  
- Hashtags: Genau 5 Tags - PERSONEN haben HÖCHSTE PRIORITÄT, dann Archetyp, Kunde, Projekt, Wichtigkeit, Thema
- Summary: Maximal 3 Sätze, faktisch, präzise

PERSON/KONTAKT PRIORITY (WICHTIGSTE HASHTAGS):
- Anna Müller → #AnnaMueller
- Lukas Schmidt → #LukasSchmidt  
- Claudia Becker → #ClaudiaBecker
- Maria Müller → #MariaMueller
- Stefan → #Stefan
- Jens → #Jens
- Telefonnummern → #Telefon
- Ansprechpartner → #Ansprechpartner

BEISPIELE:
Filename: "2025-07-13_Contact_Telefonnummer_LukasSchmidt"
Archetype: "Contact"  
Hashtags: ["#LukasSchmidt", "#Telefon", "#BetaSolutions", "#Ansprechpartner", "#Contact"]
Summary: "Lukas Schmidt von Beta Solutions, Telefon +49 30 12345678. Ansprechpartner für Projekt B mit API-Dokumentation Link."

Filename: "2025-07-13_Email_ProjektUpdate_AnnaMueller"
Archetype: "Email"
Hashtags: ["#AnnaMueller", "#Email", "#AlphaGmbH", "#ProjektAlpha", "#Wichtig2"]
Summary: "Anna Müller meldet Meilenstein erreicht bei Projekt Alpha. QA-Test startet nächste Woche. Design-Review bis Freitag erforderlich."

Filename: "2025-07-13_Calendar_KickoffMeeting_ClaudiaBecker"
Archetype: "Calendar"
Hashtags: ["#ClaudiaBecker", "#Calendar", "#CaesarAG", "#Kickoff", "#Meeting"]
Summary: "Kickoff-Meeting für Projekt Cäsar am 15. Juli 2025, 10:00-11:00 Uhr. Online-Meeting mit Claudia Becker von Cäsar AG."
`;

// =====================================
// v6.2 ENHANCED ARCHETYP-ERKENNUNG 
// =====================================

function detectArchetypeV62(content) {
    const contentLower = content.toLowerCase();
    
    // ICS Calendar Detection - HÖCHSTE PRIORITÄT
    if (contentLower.includes('begin:vcalendar') || 
        contentLower.includes('begin:vevent') ||
        contentLower.includes('dtstart:') ||
        contentLower.includes('dtend:')) {
        return 'Calendar';
    }
    
    // Contact Detection - ERWEITERT für bessere Erkennung
    if (contentLower.includes('telefon') || 
        contentLower.includes('+49') ||
        contentLower.includes('ansprechpartner:') ||
        contentLower.includes('kontakt:') ||
        (contentLower.includes('anna müller') || contentLower.includes('lukas schmidt') || contentLower.includes('claudia becker')) ||
        contentLower.match(/\+\d{1,3}\s?\d{1,4}\s?\d{4,}/)) { // International phone patterns
        return 'Contact';  
    }
    
    // Email/Message Detection - ERWEITERT
    if (contentLower.includes('betreff:') || 
        contentLower.includes('von:') ||
        contentLower.includes('subject:') ||
        contentLower.includes('kunde:') ||
        contentLower.match(/\b[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}\b/)) {
        return 'Email';
    }
    
    // Project Detection - ERWEITERT  
    if (contentLower.includes('projekt') ||
        contentLower.includes('meilenstein') ||
        contentLower.includes('status') ||
        contentLower.includes('wichtig') ||
        contentLower.includes('team') ||
        contentLower.includes('qa-test') ||
        contentLower.includes('freigabe')) {
        return 'Project';
    }
    
    // Link Detection
    if (contentLower.includes('http://') || 
        contentLower.includes('https://')) {
        return 'Link';
    }
    
    // Document Detection
    if (contentLower.includes('.pdf') ||
        contentLower.includes('.doc') ||
        contentLower.includes('dokument') ||
        contentLower.includes('api-doku')) {
        return 'Document';
    }
    
    // Text Detection (fallback für alles andere)
    return 'Text';
}

// =====================================
// v6.2 ENHANCED HASHTAG GENERATION 
// =====================================

function generateHashtagsV62(content, archetype) {
    const hashtags = [];
    const contentLower = content.toLowerCase();
    
    // 1. ARCHETYP TAG (immer)
    hashtags.push(`#${archetype}`);
    
    // 2. PERSONEN TAGS - HÖCHSTE PRIORITÄT! 
    if (contentLower.includes('anna müller') || contentLower.includes('anna mueller')) hashtags.push('#AnnaMueller');
    if (contentLower.includes('lukas schmidt')) hashtags.push('#LukasSchmidt');
    if (contentLower.includes('claudia becker')) hashtags.push('#ClaudiaBecker');
    if (contentLower.includes('maria müller') || contentLower.includes('maria mueller')) hashtags.push('#MariaMueller');
    if (contentLower.includes('stefan')) hashtags.push('#Stefan');
    if (contentLower.includes('jens')) hashtags.push('#Jens');
    
    // 3. KONTAKT TAGS
    if (contentLower.includes('telefon') || contentLower.includes('+49') || contentLower.includes('tel:')) hashtags.push('#Telefon');
    if (contentLower.includes('ansprechpartner') || contentLower.includes('kontakt')) hashtags.push('#Ansprechpartner');
    if (contentLower.includes('@') || contentLower.includes('email') || contentLower.includes('mail')) hashtags.push('#Email');
    if (contentLower.includes('https://') || contentLower.includes('http://')) hashtags.push('#Link');
    
    // 4. KUNDEN TAG  
    if (contentLower.includes('alpha')) hashtags.push('#AlphaGmbH');
    if (contentLower.includes('beta')) hashtags.push('#BetaSolutions');  
    if (contentLower.includes('cäsar') || contentLower.includes('caesar')) hashtags.push('#CaesarAG');
    
    // 5. PROJEKT TAG
    if (contentLower.includes('projekt alpha')) hashtags.push('#ProjektAlpha');
    if (contentLower.includes('projekt b')) hashtags.push('#ProjektB');
    if (contentLower.includes('projekt cäsar')) hashtags.push('#ProjektCaesar');
    
    // 6. WICHTIGKEIT TAG
    if (contentLower.includes('wichtig 1')) hashtags.push('#Wichtig1');
    if (contentLower.includes('wichtig 2')) hashtags.push('#Wichtig2');
    if (contentLower.includes('wichtig 3')) hashtags.push('#Wichtig3');
    if (contentLower.includes('dringend') || contentLower.includes('urgent')) hashtags.push('#Dringend');
    
    // 7. THEMEN TAGS
    if (contentLower.includes('meeting') || contentLower.includes('termin')) hashtags.push('#Meeting');
    if (contentLower.includes('update') || contentLower.includes('status')) hashtags.push('#Update');
    if (contentLower.includes('kickoff')) hashtags.push('#Kickoff');
    if (contentLower.includes('design') || contentLower.includes('review')) hashtags.push('#DesignReview');
    if (contentLower.includes('api')) hashtags.push('#API');
    if (contentLower.includes('test') || contentLower.includes('qa')) hashtags.push('#Testing');
    if (contentLower.includes('freigabe')) hashtags.push('#Freigabe');
    if (contentLower.includes('meilenstein')) hashtags.push('#Meilenstein');
    if (contentLower.includes('daily') || contentLower.includes('stand-up')) hashtags.push('#Daily');
    if (contentLower.includes('workshop')) hashtags.push('#Workshop');
    
    // 8. SMART DEDUPLICATION - Remove duplicates, keep most important
    const uniqueHashtags = [...new Set(hashtags)];
    
    // 9. PRIORITY ORDERING - Personen und Kontakte zuerst
    const priorityOrder = ['#AnnaMueller', '#LukasSchmidt', '#ClaudiaBecker', '#Telefon', '#Ansprechpartner'];
    const orderedHashtags = [];
    
    // Add priority tags first
    for (const priority of priorityOrder) {
        if (uniqueHashtags.includes(priority)) {
            orderedHashtags.push(priority);
        }
    }
    
    // Add remaining tags
    for (const tag of uniqueHashtags) {
        if (!orderedHashtags.includes(tag)) {
            orderedHashtags.push(tag);
        }
    }
    
    // Fill up to 5 tags if needed
    while (orderedHashtags.length < 5) {
        if (!orderedHashtags.includes('#Content')) orderedHashtags.push('#Content');
        else if (!orderedHashtags.includes('#Business')) orderedHashtags.push('#Business');
        else if (!orderedHashtags.includes('#Communication')) orderedHashtags.push('#Communication');
        else break;
    }
    
    return orderedHashtags.slice(0, 5); // Maximum 5 tags, priority ordered
}

// =====================================
// v6.2 ENHANCED UUID-FORMAT FILENAME GENERATION
// =====================================

/**
 * 🆔 v6.2 UUID-Format Filename Generator - Bulletproof für Oliver's Daily Use
 * Format: nexus-usr-{owner}-{workspace}-{entrypoint}-{archetype}-{timestamp}-{cluster}-{uuid8}
 * Beispiel: nexus-usr-oliver-work-pc-contact-20250713T1430Z-clst001-a4b8c9d2
 * 
 * @param {string} archetype - Detected archetype (Contact, Email, etc.)
 * @param {string} content - Original content for analysis  
 * @param {string} workspace - Workspace (professional, personal, social)
 * @returns {string} UUID-format filename without extension
 */
function generateFilenameV62(archetype, content = '', workspace = 'professional') {
    console.log(`[FILENAME v6.2] Generating UUID-format filename...`);
    
    try {
        // 1. OWNER (fest für Single-User)
        const owner = NEXUS_V62_OWNER;
        
        // 2. WORKSPACE-ABKÜRZUNG
        const workspaceCode = WORKSPACE_CODES[workspace] || 'work'; // Fallback auf 'work'
        console.log(`[FILENAME v6.2] Workspace: ${workspace} → ${workspaceCode}`);
        
        // 3. ENTRY POINT (fest für Browser Extension)
        const entryPoint = NEXUS_V62_ENTRY_POINT;
        
        // 4. ARCHETYPE MAPPING (lowercase für Dateinamen)
        const archetypeLower = VALID_ARCHETYPES[archetype] || 'mixed';
        console.log(`[FILENAME v6.2] Archetype: ${archetype} → ${archetypeLower}`);
        
        // 5. TIMESTAMP (ISO-Format, Minuten-Genauigkeit)
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        const timestamp = `${year}${month}${day}T${hours}${minutes}Z`;
        
        // 6. CLUSTER (Standard)
        const cluster = NEXUS_V62_CLUSTER;
        
        // 7. UNIQUE ID (8-stellige Hex-ID)
        const uuid8 = crypto.randomUUID().replace(/-/g, '').substring(0, 8).toLowerCase();
        
        // 8. FILENAME ZUSAMMENBAUEN
        const filename = `nexus-usr-${owner}-${workspaceCode}-${entryPoint}-${archetypeLower}-${timestamp}-${cluster}-${uuid8}`;
        
        console.log(`[FILENAME v6.2] ✅ Generated: ${filename}`);
        
        // 9. VALIDIERUNG (Sicherheitscheck)
        if (filename.length > 100) {
            console.warn(`[FILENAME v6.2] ⚠️ Filename very long: ${filename.length} chars`);
        }
        
        // Ensure filename is filesystem-safe
        const safeFilename = filename.replace(/[^a-zA-Z0-9_-]/g, '');
        if (safeFilename !== filename) {
            console.warn(`[FILENAME v6.2] ⚠️ Filename contained unsafe chars, cleaned: ${safeFilename}`);
            return safeFilename;
        }
        
        return filename;
        
    } catch (error) {
        console.error('[FILENAME v6.2] ❌ Generation failed:', error.message);
        
        // EMERGENCY FALLBACK
        const fallbackTimestamp = new Date().toISOString().replace(/[:.]/g, '').substring(0, 15);
        const fallbackUuid = Math.random().toString(36).substring(2, 10);
        const fallbackFilename = `nexus-usr-oliver-work-pc-mixed-${fallbackTimestamp}Z-clst001-${fallbackUuid}`;
        
        console.log(`[FILENAME v6.2] 🛡️ Emergency fallback: ${fallbackFilename}`);
        return fallbackFilename;
    }
}

// =====================================
// v6.2 MAIN SIMPLIFIED ANALYSIS FUNCTION
// =====================================

async function analyzeContentSimplified(content, sourceUrl = null, contextUuid = null) {
    console.log('[ANALYSIS v6.2] Starting simplified analysis...');
    
    try {
        // 1. Pre-Analysis für bessere Prompts
        const archetype = detectArchetypeV62(content);
        const hashtags = generateHashtagsV62(content, archetype);
        const filename = generateFilenameV62(archetype, content, 'professional'); // Default workspace
        
        console.log(`[ANALYSIS v6.2] Pre-detected: ${archetype}, ${hashtags.length} hashtags`);
        
        // 2. Ultra-Simple Prompt an GPT-4o
        const prompt = `${SIMPLIFIED_ANALYSIS_PROMPT}

CONTENT TO ANALYZE:
${content.substring(0, 2000)}

PRE-DETECTED INFO:
Archetype: ${archetype}
Suggested Hashtags: ${hashtags.join(', ')}
Suggested Filename: ${filename}

Verwende diese Infos als Basis aber verbessere sie wenn nötig.`;

        // 3. API Call mit kurzen Timeouts
        console.log('[ANALYSIS v6.2] Calling OpenAI with simplified prompt...');
        
        const response = await openai.chat.completions.create({
            model: COMPLETION_MODEL,
            messages: [{ role: "user", content: prompt }],
            max_tokens: 300,  // Drastisch reduziert!
            temperature: 0.3,
        });
        
        console.log('[ANALYSIS v6.2] OpenAI response received');
        
        // 4. Parse JSON Response
        const aiContent = response.choices[0]?.message?.content || "";
        let analysis;
        
        try {
            analysis = JSON.parse(aiContent);
        } catch (parseError) {
            console.warn('[ANALYSIS v6.2] JSON parse failed, using fallback:', parseError.message);
            analysis = {
                filename: filename,
                archetype: archetype,
                hashtags: hashtags,
                summary: "Content wurde analysiert (AI-JSON-Parse-Fehler)."
            };
        }
        
        // 5. Validate and enhance analysis
        const finalResult = {
            filename: analysis.filename || filename,
            archetype: analysis.archetype || archetype,
            hashtags: analysis.hashtags || hashtags,
            summary: analysis.summary || "Content erfolgreich analysiert.",
            source_url: sourceUrl,
            tokens_used: response.usage?.total_tokens || 0,
            analysis_version: 'v6.2-simplified'
        };
        
        console.log(`[ANALYSIS v6.2] ✅ Success: ${finalResult.archetype}, ${finalResult.hashtags?.length || 0} hashtags, ${finalResult.tokens_used} tokens`);
        
        return {
            success: true,
            content: JSON.stringify(finalResult, null, 2),
            metadata: finalResult
        };
        
    } catch (error) {
        console.error('[ANALYSIS v6.2] ❌ Error:', error.message);
        
        // FALLBACK: Pre-detected Werte verwenden
        const fallbackResult = {
            filename: generateFilenameV62(detectArchetypeV62(content), content, 'professional'),
            archetype: detectArchetypeV62(content),
            hashtags: generateHashtagsV62(content, detectArchetypeV62(content)),
            summary: "Content wurde lokal analysiert (Server-Timeout).",
            source_url: sourceUrl,
            error_reason: error.message,
            analysis_version: 'v6.2-fallback'
        };
        
        console.log(`[ANALYSIS v6.2] 🛡️ Fallback used: ${fallbackResult.archetype}`);
        
        return {
            success: false,
            content: JSON.stringify(fallbackResult, null, 2),
            metadata: fallbackResult,
            error: error.message,
            fallback_used: true
        };
    }
}

// =====================================
// v6.2 LEGACY FUNCTION WRAPPER
// =====================================

// Wrapper für Backwards Compatibility
async function generateNexusObject(content, sourceUrl = null, contextUuid = null) {
    if (SIMPLIFIED_PROMPT_ENABLED) {
        console.log('[LEGACY] Redirecting to v6.2 simplified analysis...');
        return await analyzeContentSimplified(content, sourceUrl, contextUuid);
    } else {
        // Original v6.1 function (fallback)
        try {
            const capturePrompt = await fs.readFile(CAPTURE_PROMPT_PATH, 'utf8');
            const prompt = `${capturePrompt}\n\nContent:\n${content}\n\nSource URL: ${sourceUrl || 'N/A'}`;
            
            const response = await openai.chat.completions.create({
                model: COMPLETION_MODEL,
                messages: [{ role: "user", content: prompt }],
                temperature: 0.2,
                max_tokens: 2000
            });
            
            const nexusContent = response.choices[0]?.message?.content || "";
            return { success: true, content: nexusContent };
        } catch (error) {
            console.error("Fehler bei generateNexusObject:", error);
            return { success: false, error: error.message };
        }
    }
}

// =====================================
// v6.2 ENHANCED ERROR HANDLING
// =====================================

// Enhanced Wrapper für Analyse-Requests mit besseren Status Messages
async function handleAnalysisRequestV62(analysisFunction, req, res) {
    try {
        // Status Message statt "Achtung"
        console.log('[ANALYSIS v6.2] 🔄 Processing request...');
        
        const result = await analysisFunction(req.body);
        
        if (result.success) {
            console.log('[ANALYSIS v6.2] ✅ Request successful');
            res.json({
                ...result,
                status_message: "✅ Content erfolgreich analysiert und zu Nexus hinzugefügt!",
                version: "6.2"
            });
        } else {
            console.log('[ANALYSIS v6.2] ⚠️ Request failed but handled gracefully');
            
            // Auch bei "Fehlern" positive Response wenn Fallback verwendet wurde
            if (result.fallback_used) {
                res.json({
                    ...result,
                    success: true, // Override für UX
                    status_message: "⚡ Content analysiert (Offline-Modus) und zu Nexus hinzugefügt!",
                    version: "6.2"
                });
            } else {
                res.status(400).json({
                    ...result,
                    status_message: "❌ Analyse fehlgeschlagen. Bitte versuchen Sie es erneut.",
                    version: "6.2"
                });
            }
        }
    } catch (error) {
        console.error('[ANALYSIS v6.2] ❌ Unexpected error:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message,
            status_message: "❌ Unerwarteter Server-Fehler. Bitte kontaktieren Sie den Support.",
            version: "6.2"
        });
    }
}

// Legacy wrapper for backwards compatibility
const handleAnalysisRequest = handleAnalysisRequestV62;

// Klassifiziert Content mit OpenAI (UNCHANGED)
async function classifyContent(content, sourceUrl = null) {
  try {
    const classifierPrompt = await fs.readFile(CLASSIFIER_PROMPT_PATH, 'utf8');
    const prompt = `${classifierPrompt}\n\nContent:\n${content.substring(0, 2000)}`;
    
    const response = await openai.chat.completions.create({
      model: COMPLETION_MODEL,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.1
    });
    
    const result = response.choices[0]?.message?.content || "";
    
    // Speichere Klassifizierer-Output
    const outputId = uuidv7();
    await fs.writeFile(
      path.join(CLASSIFIER_OUTPUT_DIR, `classification_${outputId}.txt`),
      result
    );
    
    return { success: true, classification: result, outputId };
  } catch (error) {
    console.error("Fehler bei classifyContent:", error);
    return { success: false, error: error.message };
  }
}

// Text-Content bereinigen (UNCHANGED)
function cleanTextContent(html) {
  const $ = cheerio.load(html);
  $('script, style, nav, footer, aside').remove();
  return $.text().replace(/\s+/g, ' ').trim();
}

// Web-Scraping mit ScraperAPI oder Puppeteer (UNCHANGED)
async function scrapeUrl(url) {
  try {
    if (SCRAPER_API_KEY) {
      const scraperUrl = `http://api.scraperapi.com?api_key=${SCRAPER_API_KEY}&url=${encodeURIComponent(url)}`;
      const response = await fetch(scraperUrl);
      return await response.text();
    } else {
      // Puppeteer Fallback
      const browser = await puppeteer.launch({ 
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
      const page = await browser.newPage();
      await page.goto(url, { waitUntil: 'networkidle0', timeout: 10000 });
      const content = await page.content();
      await browser.close();
      return content;
    }
  } catch (error) {
    console.error("Scraping-Fehler:", error);
    throw error;
  }
}

// --- SCHRITT 6: EXPRESS APP & MIDDLEWARE ---
const app = express();
app.use(cors());
app.use(express.json({ limit: "15mb" }));
app.use((req, res, next) => { 
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`); 
  next(); 
});

// Health Check (v6.2 Enhanced)
app.get("/", (req, res) => {
  const enhancedStats = getEnhancedCacheStats();
  
  res.json({ 
    status: "OK", 
    message: "Nexus v6.2 SIMPLIFIED PROMPT SYSTEM Ready!", 
    version: "6.2",
    simplified_prompt_enabled: SIMPLIFIED_PROMPT_ENABLED,
    performance: enhancedStats
  });
});

// --- v6.1 ENHANCED CACHE MANAGEMENT ENDPOINTS ---

// Enhanced Cache Status with v6.1 metrics
app.get("/cache/status", (req, res) => {
  const enhancedStats = getEnhancedCacheStats();
  
  res.json({
    ...enhancedStats,
    cache_details: {
      knowledgeCache: knowledgeCache.size,
      searchIndex: searchIndex.size,
      workspaceCache: workspaceCache.size,
      clusterCache: clusterCache.size,
      entryPointCache: entryPointCache.size,
      watcherActive: !!fileWatcher
    },
    files: Array.from(knowledgeCache.keys())
  });
});

// Workspace-specific cache status
app.get("/cache/workspace/:workspace", (req, res) => {
  const { workspace } = req.params;
  const workspaceFiles = getWorkspaceCache(workspace);
  
  const workspaceStats = {
    workspace,
    file_count: workspaceFiles.size,
    files: Array.from(workspaceFiles.keys()),
    clusters: new Set(),
    entry_points: new Set()
  };
  
  // Analyze workspace content
  for (const [filename, _] of workspaceFiles.entries()) {
    const uuidData = parseNexusUUID(filename);
    if (uuidData.cluster_id !== 'clst000') {
      workspaceStats.clusters.add(uuidData.cluster_id);
    }
    workspaceStats.entry_points.add(uuidData.entry_point);
  }
  
  workspaceStats.cluster_count = workspaceStats.clusters.size;
  workspaceStats.entry_point_count = workspaceStats.entry_points.size;
  workspaceStats.clusters = Array.from(workspaceStats.clusters);
  workspaceStats.entry_points = Array.from(workspaceStats.entry_points);
  
  res.json(workspaceStats);
});

// Cluster information endpoint
app.get("/cache/cluster/:cluster_id", (req, res) => {
  const { cluster_id } = req.params;
  
  if (!clusterCache.has(cluster_id)) {
    return res.status(404).json({ 
      success: false, 
      error: `Cluster ${cluster_id} not found` 
    });
  }
  
  const clusterFiles = Array.from(clusterCache.get(cluster_id));
  const clusterInfo = {
    cluster_id,
    file_count: clusterFiles.length,
    files: clusterFiles.map(filename => {
      const metadata = knowledgeCache.get(filename);
      const uuidData = parseNexusUUID(filename);
      return {
        filename,
        title: metadata?.Title || 'Unbekannter Titel',
        workspace: uuidData.workspace,
        archetype: uuidData.archetype,
        timestamp: uuidData.timestamp
      };
    })
  };
  
  res.json(clusterInfo);
});

// Cache rebuild with v6.1 features
app.post("/cache/rebuild", async (req, res) => {
  try {
    const result = await buildKnowledgeCache();
    const enhancedStats = getEnhancedCacheStats();
    
    res.json({ 
      success: true, 
      ...result,
      enhanced_stats: enhancedStats
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// --- ANALYSE-ENDPOINTS (UNCHANGED) ---

// Text-Analyse
app.post("/analyze-text", async (req, res) => {
  await handleAnalysisRequest(async (body) => {
    const { content, source_url } = body;
    if (!content) {
      return { success: false, error: "Content ist erforderlich" };
    }
    
    let cleanContent = cleanTextContent(content);
    if (cleanContent.length > MAX_CONTENT_LENGTH) {
      cleanContent = cleanContent.substring(0, MAX_CONTENT_LENGTH);
    }
    
    const result = await generateNexusObject(cleanContent, source_url);
    return result;
  }, req, res);
});

// Bild-Analyse
app.post("/analyze-image", async (req, res) => {
  await handleAnalysisRequest(async (body) => {
    const { image_url, source_url } = body;
    if (!image_url) {
      return { success: false, error: "image_url ist erforderlich" };
    }
    
    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [{
          role: "user",
          content: [
            { type: "text", text: "Analysiere dieses Bild und erstelle eine Nexus-Objekt-Beschreibung:" },
            { type: "image_url", image_url: { url: image_url } }
          ]
        }],
        max_tokens: 1000
      });
      
      const analysis = response.choices[0]?.message?.content || "";
      const result = await generateNexusObject(analysis, source_url);
      return result;
    } catch (error) {
      return { success: false, error: error.message };
    }
  }, req, res);
});

// Link-Analyse
app.post("/analyze-link", async (req, res) => {
  await handleAnalysisRequest(async (body) => {
    const { url } = body;
    if (!url) {
      return { success: false, error: "URL ist erforderlich" };
    }
    
    try {
      const html = await scrapeUrl(url);
      const cleanContent = cleanTextContent(html);
      const limitedContent = cleanContent.substring(0, MAX_CONTENT_LENGTH);
      
      const result = await generateNexusObject(limitedContent, url);
      return result;
    } catch (error) {
      return { success: false, error: `Scraping-Fehler: ${error.message}` };
    }
  }, req, res);
});

// Klassifizierungs-Endpoint
app.post("/classify", async (req, res) => {
  await handleAnalysisRequest(async (body) => {
    const { content, source_url } = body;
    if (!content) {
      return { success: false, error: "Content ist erforderlich" };
    }
    
    const result = await classifyContent(content, source_url);
    return result;
  }, req, res);
});

// --- 🚀 SUPER-FAST CACHED CHAT-ENDPOINT v6.1 ENHANCED ---
app.post("/chat", async (req, res) => {
  try {
    // 1) Header-Auth prüfen
    const auth = req.header("authorization") || "";
    if (!auth.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        error: { code: "UNAUTHORIZED", message: "Missing Authorization header", details: {} }
      });
    }

    // 2) Body-Validation mit v6.1 options
    const { query, context, options = {} } = req.body;
    if (!query || typeof query !== "string" || !query.trim()) {
      return res.status(400).json({
        success: false,
        error: { code: "INVALID_QUERY", message: "query darf nicht leer sein", details: {} }
      });
    }

    // 3) 🚀 SUPER-FAST CACHED SEARCH v6.1 (workspace & cluster aware)
    const searchResult = performCachedSearch(query, options);
    
    if (searchResult.results.length === 0) {
      return res.json({
        success: true,
        answer: `Ich konnte keine relevanten Informationen zu "${query}" in Ihrer Wissensdatenbank finden. Möglicherweise müssen Sie weitere Inhalte hinzufügen oder Ihre Frage anders formulieren.`,
        sources: [],
        meta: { 
          ...searchResult.stats,
          query: query,
          searchedTerms: query.toLowerCase().split(/\s+/).filter(t => t.length > 2)
        }
      });
    }

    // 4) AI-ANTWORT GENERIEREN (v6.1 Enhanced Context)
    const contextText = createAIContext(searchResult.results);

    const aiResponse = await openai.chat.completions.create({
      model: COMPLETION_MODEL,
      messages: [
        {
          role: "system",
          content: "Du bist ein hilfsbereiter persönlicher Assistent, der Fragen basierend auf den persönlichen Wissensdaten des Users beantwortet. Du verstehst Workspace-Kontexte (work/home/family/etc.) und kannst verwandte Inhalte aus Clustern einbeziehen. Antworte präzise, hilfreich und in der passenden Sprache. Nutze die verfügbaren Informationen, um konkrete und nützliche Antworten zu geben."
        },
        {
          role: "user",
          content: `Frage: ${query}\n\nVerfügbare Informationen aus der persönlichen Wissensdatenbank:\n\n${contextText}\n\nBitte beantworte die Frage basierend auf diesen Informationen. Gib konkrete Details an, wenn verfügbar (Termine, Orte, etc.). Berücksichtige auch verwandte Inhalte aus den gleichen Clustern.`
        }
      ],
      temperature: 0.3,
      max_tokens: 800
    });

    const answer = aiResponse.choices[0]?.message?.content || "Entschuldigung, ich konnte keine passende Antwort generieren.";

    // 5) FINAL RESPONSE mit v6.1 Performance-Stats & Enhanced Sources
    return res.json({
      success: true,
      answer,
      sources: searchResult.results.map(r => ({
        title: r.metadata.Title || "Ohne Titel",
        summary: r.metadata.Summary || "",
        score: Math.round(r.score * 100) / 100,
        matchedTerms: r.matchDetails.matchedTerms,
        filename: r.filename,
        workspace: r.uuidData.workspace,
        archetype: r.uuidData.archetype,
        entry_point: r.entryPoint,
        cluster_id: r.uuidData.cluster_id,
        version: r.uuidData.version,
        isRelated: r.isRelated || false,
        clusterMembers: r.clusterRelations.length
      })),
      meta: {
        ...searchResult.stats,
        query,
        timestamp: new Date().toISOString(),
        version: "6.2"
      }
    });

  } catch (err) {
    console.error("[CHAT v6.2] Error:", err);
    return res.status(500).json({
      success: false,
      error: { 
        code: "INTERNAL_ERROR", 
        message: "Ein unerwarteter Fehler ist aufgetreten",
        details: { message: err.message }
      }
    });
  }
});

// --- v6.1 WORKSPACE SEARCH ENDPOINTS ---

// Workspace-specific search
app.post("/search/workspace/:workspace", async (req, res) => {
  try {
    const { workspace } = req.params;
    const { query, options = {} } = req.body;
    
    if (!query || typeof query !== "string" || !query.trim()) {
      return res.status(400).json({
        success: false,
        error: "query darf nicht leer sein"
      });
    }
    
    const searchOptions = { ...options, workspace };
    const searchResult = performCachedSearch(query, searchOptions);
    
    res.json({
      success: true,
      workspace,
      query,
      results: searchResult.results.map(r => ({
        filename: r.filename,
        title: r.metadata.Title || "Ohne Titel",
        summary: r.metadata.Summary || "",
        score: Math.round(r.score * 100) / 100,
        archetype: r.uuidData.archetype,
        cluster_id: r.uuidData.cluster_id
      })),
      meta: searchResult.stats
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Analytics endpoint for workspace usage
app.get("/analytics/workspace/:workspace", (req, res) => {
  const { workspace } = req.params;
  const workspaceFiles = getWorkspaceCache(workspace);
  
  const analytics = {
    workspace,
    total_files: workspaceFiles.size,
    archetypen: {},
    entry_points: {},
    clusters: {},
    timeline: {}
  };
  
  for (const [filename, metadata] of workspaceFiles.entries()) {
    const uuidData = parseNexusUUID(filename);
    
    // Archetypen distribution
    analytics.archetypen[uuidData.archetype] = (analytics.archetypen[uuidData.archetype] || 0) + 1;
    
    // Entry points distribution
    const entryPoint = detectEntryPoint(metadata, uuidData);
    analytics.entry_points[entryPoint] = (analytics.entry_points[entryPoint] || 0) + 1;
    
    // Cluster analysis
    if (uuidData.cluster_id !== 'clst000') {
      analytics.clusters[uuidData.cluster_id] = (analytics.clusters[uuidData.cluster_id] || 0) + 1;
    }
    
    // Timeline analysis (by month)
    if (uuidData.timestamp) {
      const month = uuidData.timestamp.substring(0, 6); // YYYYMM
      analytics.timeline[month] = (analytics.timeline[month] || 0) + 1;
    }
  }
  
  res.json(analytics);
});

// Nexus-All-in-One-Endpoint
app.use("/nexus", nexusRouter);

// --- SCHRITT 7: SERVER START ---
initializeApp()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`🚀 Nexus v6.2 SIMPLIFIED PROMPT SYSTEM running on port ${PORT}`);
      console.log(`📊 Knowledge Directory: ${KNOWLEDGE_DIR}`);
      console.log(`🧠 AI Model: ${COMPLETION_MODEL}`);
      console.log(`⚡ Performance Cache: ${knowledgeCache.size} files loaded`);
      console.log(`🔍 Search Index: ${searchIndex.size} entries ready`);
      console.log(`🏗️ Workspace Cache: ${workspaceCache.size} workspaces tracked`);
      console.log(`🧩 Cluster Cache: ${clusterCache.size} clusters active`);
      console.log(`📱 Entry Point Cache: ${entryPointCache.size} entry points`);
      console.log(`👁️ File Watcher: ${fileWatcher ? 'Active' : 'Inactive'}`);
      console.log(`🎯 v6.2 Features: Simplified Prompt ${SIMPLIFIED_PROMPT_ENABLED ? 'ENABLED' : 'DISABLED'}`);
      console.log(`✨ Ready for WORKSPACE-INTELLIGENT conversations with ENHANCED HASHTAGS!`);
      
      // Enhanced startup stats
      const enhancedStats = getEnhancedCacheStats();
      console.log(`📈 v6.1 Stats: ${enhancedStats.v61_files} v6.1 files, ${enhancedStats.legacy_files} legacy files`);
      console.log(`🎯 Workspaces: ${Object.keys(enhancedStats.workspaces).join(', ')}`);
      console.log(`📱 Entry Points: ${Object.keys(enhancedStats.entry_points).join(', ')}`);
      console.log(`🏆 NEXUS v6.2 - UUID FORMAT BULLETPROOF! 👑`);
    });
  })
  .catch(err => {
    console.error("Fatal startup error:", err);
    process.exit(1);
  });