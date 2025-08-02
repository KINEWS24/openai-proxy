// index.js – ThinkAI Nexus v6.1 COMPLETE EDITION - WORKSPACE INTELLIGENT!

// dotenv für Environment Variables laden
require('dotenv').config();

// --- SCHRITT 1: IMPORTS & KONSTANTEN ---
const express = require("express");
const cors = require("cors");
const fs = require("fs").promises;
const fsSync = require("fs");
const path = require("path");
const { uuidv7 } = require("uuidv7");
const { OpenAI } = require("openai");
const { Mistral } = require("@mistralai/mistralai");
const { google } = require("googleapis");
const cheerio = require("cheerio");
const puppeteer = require("puppeteer");
const fetch = require("node-fetch");
const dayjs = require("dayjs");

// Nexus-All-in-One-Router
const nexusRouter = require("./modules/nexus");

// Globale Konfigurationen
const KNOWLEDGE_DIR         = path.join(__dirname, "knowledge");
const CAPTURE_PROMPT_PATH   = path.join(__dirname, "nexus_prompt_v6.1.txt");
const CLASSIFIER_PROMPT_PATH= path.join(__dirname, "nexus_prompt_classifier_v1.0.txt");
const CLASSIFIER_OUTPUT_DIR = path.join(__dirname, "classifier-output");

// 🧠 DEMO RULES – Spektakuläre Live-Regeln
const DEMO_RULES = [
  {
    name: "Demo-Frist-Erkennung",
    trigger: "chat_input",
    condition: {
      contains_phrases: ["bis", "deadline", "fertig sein", "abgeben"],
      has_date_reference: true
    },
    action: {
      type: "show_notification",
      message: "⏰ Frist erkannt! Soll ich eine Erinnerung setzen?"
    }
  },
  {
    name: "Demo-Versprechen-Tracker",
    trigger: "chat_input",
    condition: {
      contains_phrases: ["ich melde mich", "ich kümmere mich", "ich mach das"]
    },
    action: {
      type: "show_notification",
      message: "✅ Versprechen erkannt! Als Todo speichern?"
    }
  },
  {
    name: "Demo-VIP-Erkennung",
    trigger: "chat_input",
    condition: {
      contains_phrases: ["Geschäftsführung", "CEO", "Chef", "Vorstand", "wichtig"]
    },
    action: {
      type: "show_notification",
      message: "🚨 VIP-Kontext erkannt! Hohe Priorität?"
    }
  }
];

const OPENAI_API_KEY        = process.env.OPENAI_API_KEY;
const SCRAPER_API_KEY       = process.env.SCRAPER_API_KEY;
const MISTRAL_API_KEY       = process.env.MISTRAL_API_KEY;
const MAX_CONTENT_LENGTH    = 8000;
const COMPLETION_MODEL      = "gpt-4o";
const PORT                  = process.env.PORT || 10000;

// Default-Optionen für Chat
const defaultChatOptions = {
  topK: 10,
  sortBy: "relevance",
  includeHighlights: true
};

// Globale Instanzen
let openai;
let mistral;

// 🔔 DEMO REMINDER SYSTEM - In-Memory Storage
let activeReminders = [];
let reminderIdCounter = 1;

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


/**
 * 🧬 DNA SEQUENZIELLE LADUNG - Lädt alle 34 DNA-Karten in korrekter Reihenfolge
 */
async function loadCompleteDNA() {
  console.log('[DNA LOADING] 🧬 Lade vollständige Nexus001 DNA...');
  
  const dnaCards = [];
  
  // Lade alle DNA-Karten von 00 bis 33
  for (let i = 0; i <= 33; i++) {
    const cardNumber = String(i).padStart(2, '0');
    
    try {
      // Finde alle Dateien mit diesem Prefix
      const allFiles = await fs.readdir(KNOWLEDGE_DIR);
      const dnaFile = allFiles.find(f => f.startsWith(`00_NEXUS_${cardNumber}_`) && f.endsWith('.json'));
      
      if (dnaFile) {
        const filePath = path.join(KNOWLEDGE_DIR, dnaFile);
        const content = await fs.readFile(filePath, 'utf8');
        const dnaCard = JSON.parse(content);
        
        dnaCards.push({
          cardNumber: i,
          filename: dnaFile,
          data: dnaCard
        });
        
        console.log(`[DNA LOADING] ✅ Karte ${cardNumber}: ${dnaCard.Title || dnaFile}`);
      } else {
        console.warn(`[DNA LOADING] ⚠️ Karte ${cardNumber} nicht gefunden`);
      }
    } catch (error) {
      console.error(`[DNA LOADING] ❌ Fehler bei Karte ${cardNumber}:`, error.message);
    }
  }
  
  // Speichere in nexusState
  nexusState.completeDNA = dnaCards;
  
  console.log(`[DNA LOADING] 🧬 DNA vollständig geladen: ${dnaCards.length} Karten`);
  
  return dnaCards;
}


/**
 * 🧬 Konvertiert die geladene DNA in einen System-Prompt
 */
function createDNASystemPrompt() {
  if (!nexusState.completeDNA || nexusState.completeDNA.length === 0) {
    return '';
  }
  
  let dnaPrompt = '🧬 === NEXUS001 DNA (Vollständige Persönlichkeits-Definition) ===\n\n';
  
  nexusState.completeDNA.forEach((card, index) => {
    if (card.data && card.data.Title && card.data.Summary && card.data.KeyPoints) {
      dnaPrompt += `DNA-Karte ${index}: ${card.data.Title}\n`;
      dnaPrompt += `${card.data.Summary}\n`;
      if (card.data.KeyPoints && card.data.KeyPoints.length > 0) {
        dnaPrompt += `• ${card.data.KeyPoints.join('\n• ')}\n`;
      }
      dnaPrompt += '\n';
    }
  });
  
  dnaPrompt += '=== ENDE NEXUS001 DNA ===\n\n';
  dnaPrompt += 'Du BIST diese DNA. Jede Antwort muss diese Persönlichkeit widerspiegeln.';
  
  return dnaPrompt;
}



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
 * 🌅 Generate Daily Summary
 */
function generateDailySummary() {
  const hour = new Date().getHours();
  const today = new Date().toISOString().split('T')[0];
  
  // Count today's entries
  let todayCount = 0;
  for (const [filename, metadata] of knowledgeCache.entries()) {
    const entryDate = metadata.UZT_ISO8601?.split('T')[0];
    if (entryDate === today) todayCount++;
  }
  
  // Reminder count
  const reminderCount = activeReminders.filter(r => !r.triggered).length;
  
  if (hour < 12) {
    return `🌅 Guten Morgen! Heute bereits ${todayCount} neue Einträge. ${reminderCount > 0 ? `${reminderCount} aktive Erinnerungen.` : ''}`;
  } else if (hour < 18) {
    return `☀️ Bisher heute: ${todayCount} Einträge erfasst. ${reminderCount > 0 ? `Noch ${reminderCount} Erinnerungen offen.` : ''}`;
  } else {
    return `🌆 Tagesrückblick: ${todayCount} neue Einträge. ${reminderCount > 0 ? `${reminderCount} Erinnerungen für morgen.` : ''}`;
  }
}

/**
 * 📊 Generate Auto-Insights from Knowledge Base
 */
function generateAutoInsights() {
  const stats = getEnhancedCacheStats();
  const totalFiles = stats.total_files;
  
  if (totalFiles === 0) return '';
  
  // Analyze archetypen distribution
  const topArchetype = Object.entries(stats.archetypen)
    .sort(([,a], [,b]) => b - a)[0];
  
  // Analyze workspaces  
  const topWorkspace = Object.entries(stats.workspaces)
    .sort(([,a], [,b]) => b - a)[0];
    
  return `📊 Deine Wissensbasis: ${totalFiles} Einträge. Top-Kategorie: ${topArchetype?.[0]} (${topArchetype?.[1]} Einträge). Aktiver Workspace: ${topWorkspace?.[0]}.`;
}

/**
 * 🚀 PERFORMANCE: Lädt alle Knowledge-Dateien beim Server-Start in Memory (v6.1 Enhanced)
 */
async function buildKnowledgeCache() {
  console.log('[CACHE v6.1] Building enhanced knowledge cache...');
  const startTime = Date.now();
  
  try {
    const allFiles = await fs.readdir(KNOWLEDGE_DIR);
    const jsonFiles = allFiles.filter(f => f.endsWith(".json"));
    
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
        
        // Build searchable text index - 🔧 SAFE STRING CONVERSION
        const searchableFields = [
          String(metadata.Title || ""),
          String(metadata.Summary || ""),
          String(metadata.Subject || ""),
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
              
              // 🔧 SAFE STRING CONVERSION - FIXED
              const searchableFields = [
                String(metadata.Title || ""),
                String(metadata.Summary || ""),
                String(metadata.Subject || ""),
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
 * 🧠 SEMANTIC CONCEPT EXTRACTION - Magic Happens Here!
 * @param {string} query - User query
 * @returns {object} Semantic concepts and related terms
 */
function extractSemanticConcepts(query) {
  const concepts = {
    primary: [],
    related: [],
    industries: [],
    years: [],
    projects: [],
    technologies: []
  };
  
  const lowerQuery = query.toLowerCase();
  
  // 🚗 INDUSTRY MAPPING
  const industryMaps = {
    automotive: ['auto', 'car', 'vehicle', 'automotive', 'mobility', 'transport', 'driving'],
    healthcare: ['health', 'medical', 'hospital', 'patient', 'clinical', 'therapy'],
    finance: ['bank', 'financial', 'investment', 'money', 'trading', 'fintech'],
    tech: ['software', 'app', 'digital', 'technology', 'innovation', 'ai', 'data']
  };
  
  // 🎯 CONCEPT EXPANSION
  const conceptMaps = {
    'automotive': ['vehicle', 'mobility', 'transport', 'driving', 'car industry'],
    'project': ['initiative', 'campaign', 'program', 'venture', 'undertaking'],
    'ai': ['artificial intelligence', 'machine learning', 'neural', 'automation'],
    'video': ['visual', 'multimedia', 'animation', 'film', 'streaming'],
    'meeting': ['conference', 'discussion', 'session', 'workshop', 'gathering']
  };
  
  // Extract year patterns
  const yearMatch = lowerQuery.match(/20\d{2}/g);
  if (yearMatch) concepts.years = yearMatch;
  
  // Map industries and related concepts
  for (const [industry, keywords] of Object.entries(industryMaps)) {
    if (keywords.some(keyword => lowerQuery.includes(keyword))) {
      concepts.industries.push(industry);
      concepts.related.push(...keywords);
    }
  }
  
  // Expand concepts
  for (const [concept, expansions] of Object.entries(conceptMaps)) {
    if (lowerQuery.includes(concept)) {
      concepts.primary.push(concept);
      concepts.related.push(...expansions);
    }
  }
  
  // Clean up and deduplicate
  concepts.related = [...new Set(concepts.related)];
  
  return concepts;
}

/**
 * 🧠 SEMANTIC SCORE CALCULATION - Concept Matching Magic!
 * @param {object} concepts - Extracted semantic concepts
 * @param {object} metadata - File metadata  
 * @param {string} searchableText - Searchable content
 * @returns {number} Semantic similarity score
 */
function calculateSemanticScore(concepts, metadata, searchableText) {
  let semanticScore = 0;
  const allConcepts = [...concepts.primary, ...concepts.related, ...concepts.industries];
  
  if (allConcepts.length === 0) return 0;
  
  // Check Tags for concept matches
  const tags = metadata.Tags || [];
  const tagText = tags.join(' ').toLowerCase();
  
  for (const concept of allConcepts) {
    if (tagText.includes(concept.toLowerCase())) {
      semanticScore += 0.3; // High weight for tag matches
    }
    if (searchableText.includes(concept.toLowerCase())) {
      semanticScore += 0.2; // Medium weight for content matches
    }
  }
  
  // Year matching bonus
  if (concepts.years.length > 0) {
    const metaYear = metadata.UZT_ISO8601?.substring(0, 4);
    if (metaYear && concepts.years.includes(metaYear)) {
      semanticScore += 0.4; // Time-based relevance boost
    }
  }
  
// Industry context bonus
if (concepts.industries.length > 0) {
  const keyPoints = (metadata.KeyPoints || []).join(' ').toLowerCase();
  const summary = String(metadata.Summary || '').toLowerCase(); // 🔧 FIXED!
  
  for (const industry of concepts.industries) {
    if (keyPoints.includes(industry) || summary.includes(industry)) {
      semanticScore += 0.5; // Strong industry match
    }
  }
}

return Math.min(semanticScore, 1.0); // Cap at 1.0
}

/**
 * 🚀 PERFORMANCE: Enhanced Cached Search v6.1 - SEMANTIC & Workspace Aware
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
  
  // 🧠 SEMANTIC SEARCH ENHANCEMENT v1.0
  const semanticConcepts = extractSemanticConcepts(query);
  console.log(`[SEMANTIC] 🎯 Extracted concepts:`, semanticConcepts);
  
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
    
    // 🧠 ENHANCED: Regular + Semantic Search Score
    const regularScore = calculateSearchScore(query, searchableText);
    const semanticScore = calculateSemanticScore(semanticConcepts, metadata, searchableText);
    const finalScore = Math.max(regularScore, semanticScore * 0.8); // Semantic slightly lower weight
    
    if (finalScore > 0.15) {
      const matchDetails = getMatchDetails(query, searchableText);
      const uuidData = parseNexusUUID(filename);
      const clusterRelations = analyzeClusterRelations(uuidData, metadata);
      
      searchResults.push({
        filename,
        metadata,
        searchableText,
        score: finalScore,
        semanticScore: semanticScore,
        regularScore: regularScore,
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
  
  console.log(`[SEARCH v6.1] ✅ Found ${searchResults.length} results in ${searchTime}ms (${semanticConcepts.related.length} semantic concepts)`);
  
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
      cluster_id,
      semanticConcepts: semanticConcepts
    }
  };
}

/**
 * 🧠 SMART DUPLICATE DETECTION ENGINE v1.0 - LEGENDARY NEXUS
 * @param {string} content - Content to check
 * @param {string} sourceUrl - Source URL (optional)
 * @param {object} metadata - Parsed metadata
 * @returns {object} { isDuplicate, action, message, existingFile }
 */
async function checkForDuplicates(content, sourceUrl = null, metadata = {}) {
  try {
    console.log('[SMART-NEXUS] 🧠 Checking for duplicates...');
    
    const contentHash = require('crypto').createHash('md5').update(content).digest('hex');
    const newTitle = metadata.Title || '';
    
    // LEVEL 1: URL-BASED DUPLICATE CHECK (100% accuracy)
    if (sourceUrl) {
      for (const [filename, existingData] of knowledgeCache.entries()) {
        const existingUrl = existingData.Properties?.source_url;
        if (existingUrl === sourceUrl) {
          console.log('[SMART-NEXUS] 🎯 URL Duplicate found!', filename);
          return {
            isDuplicate: true,
            action: 'REJECT',
            message: `📋 Danke! Diesen Artikel kenne ich bereits (gespeichert als "${existingData.Title || 'Unbekannt'}" am ${new Date(existingData.UZT_ISO8601 || '').toLocaleDateString('de-DE')})`,
            existingFile: filename
          };
        }
      }
    }
    
    // LEVEL 2: TITLE SIMILARITY CHECK (Smart fuzzy matching)
    if (newTitle && newTitle.length > 5) {
      for (const [filename, existingData] of knowledgeCache.entries()) {
        const existingTitle = existingData.Title || '';
        if (existingTitle.length > 5) {
          const similarity = calculateTitleSimilarity(newTitle, existingTitle);
          if (similarity > 0.9) { // 90% similarity threshold
            console.log('[SMART-NEXUS] 📝 Title Similarity found!', similarity, filename);
            return {
              isDuplicate: true,
              action: 'REJECT',
              message: `📝 Ähnlicher Inhalt bereits vorhanden: "${existingTitle}" (${Math.round(similarity * 100)}% Ähnlichkeit). Soll ich trotzdem speichern?`,
              existingFile: filename,
              similarity: similarity
            };
          }
        }
      }
    }
    
    // LEVEL 3: CONTENT HASH CHECK (Exact content match)
    for (const [filename, existingData] of knowledgeCache.entries()) {
      const existingHash = existingData.Properties?.content_hash;
      if (existingHash === contentHash) {
        console.log('[SMART-NEXUS] 🔄 Content Hash Duplicate found!', filename);
        return {
          isDuplicate: true,
          action: 'REJECT',
          message: `🔄 Exakt derselbe Inhalt bereits gespeichert als "${existingData.Title || 'Unbekannt'}". Keine Duplikate erstellt.`,
          existingFile: filename
        };
      }
    }
    
    // LEVEL 4: CONTACT MERGE CHECK (Smart contact updating)
    if (metadata.Contact && metadata.Contact.name) {
      for (const [filename, existingData] of knowledgeCache.entries()) {
        if (existingData.Archetype === 'Contact' && existingData.Contact?.name) {
          const nameSimilarity = calculateTitleSimilarity(metadata.Contact.name, existingData.Contact.name);
          if (nameSimilarity > 0.85) { // Same person, different contact data
            console.log('[SMART-NEXUS] 👤 Contact Update opportunity!', filename);
            
            // Check if we have NEW information
            const hasNewEmail = metadata.Contact.email && metadata.Contact.email !== existingData.Contact.email;
            const hasNewPhone = metadata.Contact.phone && metadata.Contact.phone !== existingData.Contact.phone;
            
            if (hasNewEmail || hasNewPhone) {
              return {
                isDuplicate: false, // Not duplicate, but UPDATE opportunity
                action: 'UPDATE',
                message: `👤 Kontakt "${existingData.Contact.name}" gefunden! Aktualisiere mit neuen Informationen.`,
                existingFile: filename,
                updateData: metadata.Contact
              };
            } else {
              return {
                isDuplicate: true,
                action: 'REJECT',
                message: `👤 Kontakt "${existingData.Contact.name}" bereits vollständig vorhanden.`,
                existingFile: filename
              };
            }
          }
        }
      }
    }
    
    console.log('[SMART-NEXUS] ✅ No duplicates found - content is unique!');
    return {
      isDuplicate: false,
      action: 'SAVE',
      message: null,
      contentHash: contentHash
    };
    
  } catch (error) {
    console.error('[SMART-NEXUS] ❌ Error in duplicate check:', error);
    return { isDuplicate: false, action: 'SAVE', message: null }; // Fallback: allow save
  }
}

/**
 * 🧮 Calculate Title Similarity (Simple but effective)
 * @param {string} title1 - First title
 * @param {string} title2 - Second title  
 * @returns {number} Similarity score 0-1
 */
function calculateTitleSimilarity(title1, title2) {
  if (!title1 || !title2) return 0;
  
  const normalize = (str) => str.toLowerCase().trim().replace(/[^\w\s]/g, '');
  const norm1 = normalize(title1);
  const norm2 = normalize(title2);
  
  // Exact match
  if (norm1 === norm2) return 1.0;
  
  // Word-based similarity
  const words1 = norm1.split(/\s+/);
  const words2 = norm2.split(/\s+/);
  const allWords = [...new Set([...words1, ...words2])];
  
  let matches = 0;
  for (const word of allWords) {
    if (words1.includes(word) && words2.includes(word)) {
      matches++;
    }
  }
  
  return matches / allWords.length;
}

/**
 * 🧩 Parse AI-Generated Content into Markdown and JSON - DEBUG-ENHANCED v6.3
 * @param {string} aiContent - Raw AI response
 * @returns {object} { mdContent, tagsJson }
 */
function parseAIGeneratedContent(aiContent) {
  try {
    // 🔍 DEBUG: Log raw AI content to see what we're actually getting
    console.log('[PARSE-DEBUG] ==========================================');
    console.log('[PARSE-DEBUG] Raw AI Content Length:', aiContent.length);
    console.log('[PARSE-DEBUG] First 500 chars:', aiContent.substring(0, 500));
    console.log('[PARSE-DEBUG] Contains "Objekttyp":', aiContent.includes('Objekttyp'));
    console.log('[PARSE-DEBUG] Contains "**":', aiContent.includes('**'));
    console.log('[PARSE-DEBUG] ==========================================');
    
    // Look for JSON block in AI response (common pattern: ```json ... ```)
    const jsonBlockMatch = aiContent.match(/```json\s*([\s\S]*?)\s*```/);
    
    let tagsJson = {};
    let mdContent = aiContent;
    
    if (jsonBlockMatch) {
      // Extract JSON and remaining markdown
      try {
        tagsJson = JSON.parse(jsonBlockMatch[1]);
        mdContent = aiContent.replace(jsonBlockMatch[0], '').trim();
        console.log('[PARSE-DEBUG] ✅ Found JSON block, extracted successfully');
      } catch (jsonError) {
        console.warn('[PARSE] Failed to parse JSON block:', jsonError.message);
      }
    }
    
    // If no JSON block found, try to extract structured data from AI response
    if (Object.keys(tagsJson).length === 0) {
      console.log('[PARSE-DEBUG] No JSON block found, trying pattern extraction...');
      
      // 🔧 ENHANCED: Multiple robust patterns for Vision-AI responses
      let titleMatch = null;
      
      // Pattern 1: Standard Title/Titel format
      titleMatch = aiContent.match(/(?:Title|Titel):\s*(.+)/i);
      if (titleMatch) {
        console.log('[PARSE-DEBUG] ✅ Found title with Pattern 1:', titleMatch[1]);
      }
      
      // Pattern 2: Vision-AI **Objekttyp:** format (with flexible spacing)
      if (!titleMatch) {
        titleMatch = aiContent.match(/\*\*\s*(?:Objekttyp|Objektbezeichnung)\s*:\s*\*\*\s*(.+)/i);
        if (titleMatch) {
          console.log('[PARSE-DEBUG] ✅ Found title with Pattern 2 (Objekttyp):', titleMatch[1]);
        }
      }
      
      // Pattern 3: Alternative **Objekttyp:** format (without closing **)
      if (!titleMatch) {
        titleMatch = aiContent.match(/\*\*\s*(?:Objekttyp|Objektbezeichnung)\s*:\s*(.+?)(?:\n|\*\*|$)/i);
        if (titleMatch) {
          console.log('[PARSE-DEBUG] ✅ Found title with Pattern 3 (Alternative):', titleMatch[1]);
        }
      }
      
      // Pattern 4: Any **text** at beginning of lines
      if (!titleMatch) {
        titleMatch = aiContent.match(/^\*\*([^*]+)\*\*/m);
        if (titleMatch) {
          console.log('[PARSE-DEBUG] ✅ Found title with Pattern 4 (Generic **):', titleMatch[1]);
        }
      }
      
      // Pattern 5: Look for vehicle/object descriptions in text
      if (!titleMatch) {
        // Look for "Ein roter Formel 1..." or similar descriptive starts
        const descMatch = aiContent.match(/(?:Ein|Eine|Der|Die|Das)\s+([^.]{10,50}(?:Rennwagen|Fahrzeug|Auto|Schiff|Fregatte))/i);
        if (descMatch) {
          titleMatch = [null, descMatch[1]]; // Fake match format
          console.log('[PARSE-DEBUG] ✅ Found title with Pattern 5 (Description):', titleMatch[1]);
        }
      }
      
      if (titleMatch) {
        // 🧹 CLEANUP: Remove markdown formatting and extra whitespace
        tagsJson.Title = titleMatch[1]
          .trim()
          .replace(/^\*\*\s*/, '')  // Remove leading **
          .replace(/\s*\*\*$/, '')  // Remove trailing **
          .replace(/\*\*/g, '')     // Remove any remaining **
          .trim();
        console.log('[PARSE-DEBUG] ✅ Final extracted title:', tagsJson.Title);
      }
      
      // Extract summary with multiple patterns
      let summaryMatch = aiContent.match(/(?:Summary|Zusammenfassung):\s*(.+)/i);
      if (!summaryMatch) {
        // Look for **Optische Beschreibung:** or similar
        summaryMatch = aiContent.match(/\*\*\s*(?:Optische Beschreibung|Beschreibung|Description)\s*:\s*\*\*\s*(.+?)(?:\n\n|\*\*|$)/is);
      }
      if (summaryMatch) {
        // 🧹 CLEANUP: Remove markdown formatting from summary
        tagsJson.Summary = summaryMatch[1]
          .trim()
          .replace(/^\*\*\s*/, '')  // Remove leading **
          .replace(/\s*\*\*$/, '')  // Remove trailing **
          .replace(/\*\*/g, '')     // Remove any remaining **
          .trim();
        console.log('[PARSE-DEBUG] ✅ Found summary:', tagsJson.Summary.substring(0, 100));
      }
      
      // Extract tags
      const tagsMatch = aiContent.match(/(?:Tags|Schlagwörter):\s*(.+)/i);
      if (tagsMatch) {
        tagsJson.Tags = tagsMatch[1]
          .split(',')
          .map(tag => tag
            .trim()
            .replace(/^\*\*\s*/, '')  // Remove leading **
            .replace(/\s*\*\*$/, '')  // Remove trailing **
            .replace(/\*\*/g, '')     // Remove any remaining **
            .trim()
          )
          .filter(tag => tag.length > 0); // Remove empty tags
      }
      
      // 🏎️ ENHANCED: Content-based detection and enhancement
      const lowerContent = aiContent.toLowerCase();
      
      // Formel 1 Detection - Enhanced patterns
      if (lowerContent.includes('formel 1') || lowerContent.includes('rennwagen') || 
          lowerContent.includes('f1') || lowerContent.includes('motorsport') ||
          lowerContent.includes('ferrari') || lowerContent.includes('rennsport')) {
        
        if (!tagsJson.Title || tagsJson.Title === "Erfasster Inhalt") {
          // Try to extract specific F1 details
          if (lowerContent.includes('ferrari') || lowerContent.includes('rot')) {
            tagsJson.Title = "Formel 1 Rennwagen (Ferrari)";
          } else {
            tagsJson.Title = "Formel 1 Rennwagen";
          }
        }
        if (!tagsJson.Tags) tagsJson.Tags = [];
        tagsJson.Tags.push('#Formel1', '#Motorsport', '#Rennsport', '#Fahrzeug');
        console.log('[PARSE-DEBUG] ✅ Applied Formel 1 enhancement');
      }
      
      // Marine Detection - Enhanced patterns
      if (lowerContent.includes('kriegsschiff') || lowerContent.includes('marine') || 
          lowerContent.includes('fregatte') || lowerContent.includes('bundeswehr') ||
          lowerContent.includes('schiff') || lowerContent.includes('militär')) {
        
        if (!tagsJson.Title || tagsJson.Title === "Erfasster Inhalt") {
          if (lowerContent.includes('fregatte')) {
            tagsJson.Title = "Marine Fregatte";
          } else {
            tagsJson.Title = "Marine Fahrzeug";
          }
        }
        if (!tagsJson.Tags) tagsJson.Tags = [];
        tagsJson.Tags.push('#Marine', '#Schiff', '#Militär', '#Bundeswehr');
        console.log('[PARSE-DEBUG] ✅ Applied Marine enhancement');
      }
      
      // Default values if nothing found
      if (!tagsJson.Title) {
        tagsJson.Title = "Erfasster Inhalt";
        console.log('[PARSE-DEBUG] ⚠️ Using fallback title');
      }
      if (!tagsJson.Tags) {
        tagsJson.Tags = ["#Erfasst"];
        console.log('[PARSE-DEBUG] ⚠️ Using fallback tags');
      }
    }
    
    // 🔍 Smart Tag Enhancement - Extract entities for better search
    const smartTags = extractSmartTags(aiContent, mdContent);
    tagsJson.Tags = [...new Set([...tagsJson.Tags, ...smartTags])]; // Merge + deduplicate
    
    // 🧹 FINAL CLEANUP: Remove markdown formatting from ALL tags
    tagsJson.Tags = tagsJson.Tags.map(tag => 
      tag.toString()
        .trim()
        .replace(/^\*\*\s*/, '')  // Remove leading **
        .replace(/\s*\*\*$/, '')  // Remove trailing **
        .replace(/\*\*/g, '')     // Remove any remaining **
        .trim()
    ).filter(tag => tag.length > 0); // Remove empty tags
    
    // Ensure required fields exist
    tagsJson.Archetype = tagsJson.Archetype || detectArchetypeFromContent(aiContent);
    tagsJson.UZT_ISO8601 = tagsJson.UZT_ISO8601 || new Date().toISOString();
    tagsJson.Erfassung_Timestamp = new Date().toISOString();
    
    console.log('[PARSE-DEBUG] ✅ Final result - Title:', tagsJson.Title, 'Tags:', tagsJson.Tags.length);
    
    return { mdContent, tagsJson };
  } catch (error) {
    console.error('[PARSE] Error parsing AI content:', error);
    console.error('[PARSE-DEBUG] ❌ Exception occurred, using fallback');
    
    // Fallback
    return {
      mdContent: aiContent,
      tagsJson: {
        Title: "Erfasster Inhalt",
        Summary: aiContent.substring(0, 200) + "...",
        Tags: ["#Erfasst"],
        Archetype: "Mixed",
        UZT_ISO8601: new Date().toISOString(),
        Erfassung_Timestamp: new Date().toISOString()
      }
    };
  }
}

/**
 * 🔍 Extract Smart Tags for Enhanced Search
 * @param {string} aiContent - AI-generated content
 * @param {string} mdContent - Markdown content
 * @returns {Array} Array of smart tags
 */
function extractSmartTags(aiContent, mdContent) {
  const allText = (aiContent + " " + mdContent).toLowerCase();
  const smartTags = [];
  
  // 👥 Person Detection (common names + AI mentions)
  const persons = ['claude', 'dominik', 'oliver', 'chef', 'kollege', 'kollegin', 'team', 'kunde', 'partner'];
  persons.forEach(person => {
    if (allText.includes(person)) {
      smartTags.push(`#${person.charAt(0).toUpperCase() + person.slice(1)}`);
      // Add synonyms for demo
      if (person === 'claude') smartTags.push('#Dominik', '#KI', '#AI');
      if (person === 'dominik') smartTags.push('#Claude', '#Partner');
    }
  });
  
  // 📍 Location Detection
  const locations = ['kiel', 'hotel', 'atlantik', 'büro', 'office', 'restaurant', 'cafe', 'zuhause'];
  locations.forEach(location => {
    if (allText.includes(location)) {
      smartTags.push(`#${location.charAt(0).toUpperCase() + location.slice(1)}`);
      if (location === 'atlantik') smartTags.push('#AtlantikHotel', '#Hotel');
    }
  });
  
  // ⏰ Time Detection
  const times = ['morgen', 'heute', 'abend', 'mittag', 'vormittag', 'nachmittag', 'montag', 'dienstag', 'mittwoch', 'donnerstag', 'freitag'];
  times.forEach(time => {
    if (allText.includes(time)) {
      smartTags.push(`#${time.charAt(0).toUpperCase() + time.slice(1)}`);
    }
  });
  
  // 🎯 Activity Detection with Synonyms
  const activities = [
    { words: ['essen', 'dinner', 'lunch'], tags: ['#Essen', '#Treffen', '#Meeting'] },
    { words: ['treffen', 'meeting', 'termin'], tags: ['#Treffen', '#Meeting', '#Essen'] },
    { words: ['call', 'telefonat', 'anruf'], tags: ['#Call', '#Telefonat', '#Meeting'] },
    { words: ['besprechung', 'diskussion'], tags: ['#Besprechung', '#Meeting', '#Treffen'] }
  ];
  
  activities.forEach(activity => {
    const found = activity.words.some(word => allText.includes(word));
    if (found) {
      smartTags.push(...activity.tags);
    }
  });
  
  // 🏢 Context Detection
  if (allText.includes('arbeit') || allText.includes('büro') || allText.includes('kollege')) {
    smartTags.push('#Arbeit', '#Business');
  }
  if (allText.includes('privat') || allText.includes('familie') || allText.includes('freund')) {
    smartTags.push('#Privat', '#Personal');
  }
  
  // 🏎️ Motorsport Detection
  if (allText.includes('formel 1') || allText.includes('rennwagen') || allText.includes('motorsport')) {
    smartTags.push('#Formel1', '#Motorsport', '#Rennsport', '#Fahrzeug');
  }
  
  // 🚢 Marine/Military Detection
  if (allText.includes('kriegsschiff') || allText.includes('fregatte') || allText.includes('marine') || allText.includes('bundeswehr')) {
    smartTags.push('#Marine', '#Militär', '#Bundeswehr', '#Schiff');
  }
  
  // Remove duplicates and return
  return [...new Set(smartTags)];
}

/**
 * 🎯 Detect Archetype from Content
 * @param {string} content - Content to analyze
 * @returns {string} Detected archetype
 */
function detectArchetypeFromContent(content) {
  const lowerContent = content.toLowerCase();
  
  if (lowerContent.includes('http') || lowerContent.includes('www.')) {
    return 'Link';
  }
  if (lowerContent.includes('meeting') || lowerContent.includes('termin') || lowerContent.includes('calendar')) {
    return 'Message';
  }
  if (lowerContent.includes('bild') || lowerContent.includes('image') || lowerContent.includes('foto')) {
    return 'Image';
  }
  if (lowerContent.includes('video') || lowerContent.includes('film')) {
    return 'Video';
  }
  if (lowerContent.includes('audio') || lowerContent.includes('podcast') || lowerContent.includes('musik')) {
    return 'Audio';
  }
  if (lowerContent.includes('dokument') || lowerContent.includes('pdf') || lowerContent.includes('document')) {
    return 'Document';
  }
  if (lowerContent.includes('daten') || lowerContent.includes('zahlen') || lowerContent.includes('statistik')) {
    return 'Data';
  }
  
  return 'Text'; // Default
}

/**
 * 🆔 Generate v6.1 UUID for new file
 * @param {string} archetype - Detected archetype
 * @param {string} workspace - Target workspace (default: 'work')
 * @param {string} entryPoint - Entry point (default: 'pc')
 * @returns {string} v6.1 UUID
 */
function generateV61UUID(archetype = 'Text', workspace = 'work', entryPoint = 'pc') {
  const scope = 'personal';
  const owner = 'oliver';
  const timestamp = dayjs().format('YYYYMMDDHHmmss');
  const clusterId = 'clst001'; // Default cluster for new items
  const uniqueId = uuidv7().substring(0, 8); // Short unique ID
  
  return `nexus-v6-${scope}-${owner}-${workspace}-${entryPoint}-${archetype}-${timestamp}-${clusterId}-${uniqueId}`;
}

/**
 * 💾 Save Nexus Files to Knowledge Directory + CACHE UPDATE FIX
 * @param {string} mdContent - Markdown content
 * @param {object} tagsJson - Tags JSON object
 * @param {string} uuid - Generated UUID
 * @returns {Promise<object>} File information
 */
async function saveNexusFiles(mdContent, tagsJson, uuid) {
  try {
    const mdFilename = `${uuid}.md`;
    const tagsFilename = `${uuid}.tags.json`;
    
    const mdPath = path.join(KNOWLEDGE_DIR, mdFilename);
    const tagsPath = path.join(KNOWLEDGE_DIR, tagsFilename);
    
    // Write files
    await fs.writeFile(mdPath, mdContent, 'utf8');
    await fs.writeFile(tagsPath, JSON.stringify(tagsJson, null, 2), 'utf8');
    
    console.log(`[FILE-CREATION] ✅ Created files: ${mdFilename}, ${tagsFilename}`);
    
    // 🔧 FIX: MANUAL CACHE UPDATE - Add new file to cache immediately
    try {
      const uuidData = parseNexusUUID(tagsFilename);
      const entryPoint = detectEntryPoint(tagsJson, uuidData);
      
      // Update main caches
      knowledgeCache.set(tagsFilename, tagsJson);
      uuidVersionMap.set(tagsFilename, uuidData.version);
      
      // Build searchable text index
      const searchableFields = [
        tagsJson.Title || "",
        tagsJson.Summary || "",
        tagsJson.Subject || "",
        (tagsJson.KeyPoints || []).join(" "),
        (tagsJson.Tags || []).join(" "),
        ...(tagsJson.Properties ? Object.values(tagsJson.Properties).filter(v => typeof v === 'string') : [])
      ];
      
      const searchableText = searchableFields.join(" ").toLowerCase();
      searchIndex.set(tagsFilename, searchableText);
      
      // Update v6.1 caches
      if (!workspaceCache.has(uuidData.workspace)) {
        workspaceCache.set(uuidData.workspace, new Set());
      }
      workspaceCache.get(uuidData.workspace).add(tagsFilename);
      
      if (!entryPointCache.has(entryPoint)) {
        entryPointCache.set(entryPoint, new Set());
      }
      entryPointCache.get(entryPoint).add(tagsFilename);
      
      if (uuidData.cluster_id && uuidData.cluster_id !== 'clst000') {
        if (!clusterCache.has(uuidData.cluster_id)) {
          clusterCache.set(uuidData.cluster_id, new Set());
        }
        clusterCache.get(uuidData.cluster_id).add(tagsFilename);
      }
      
      lastCacheUpdate = new Date();
      
      console.log(`[CACHE-UPDATE] ✅ Added ${tagsFilename} to all caches immediately`);
      
    } catch (cacheError) {
      console.error(`[CACHE-UPDATE] ❌ Failed to update cache:`, cacheError);
      // Fallback: Rebuild entire cache
      console.log(`[CACHE-UPDATE] 🔄 Rebuilding entire cache as fallback...`);
      await buildKnowledgeCache();
    }
    
    return {
      mdFilename,
      tagsFilename,
      mdPath,
      tagsPath,
      success: true
    };
    
  } catch (error) {
    console.error('[FILE-CREATION] ❌ Error saving files:', error);
    throw error;
  }
}

/**
 * 📋 Format Response for Extension
 * @param {string} mdFilename - Markdown filename
 * @param {string} tagsFilename - Tags filename
 * @param {string} mdContent - Markdown content
 * @param {object} tagsContent - Tags content
 * @returns {object} Extension-compatible response
 */
function formatExtensionResponse(mdFilename, tagsFilename, mdContent, tagsContent) {
  return {
    success: true,
    nexusMd: {
      filename: mdFilename,
      content: mdContent
    },
    tagsJson: {
      filename: tagsFilename,
      content: JSON.stringify(tagsContent, null, 2)
    },
    meta: {
      timestamp: new Date().toISOString(),
      version: "6.1",
      archetype: tagsContent.Archetype,
      workspace: tagsContent.Workspace || 'work'
    }
  };
}

// --- SCHRITT 3: INITIALISIERUNG ---

// NEU: Globale Variable für den Zustand des Nexus
let nexusState = {
  isInitialized: false,
  owners: [],
  id: null
};

async function initializeApp() {
  if (!OPENAI_API_KEY) {
    console.error("FATAL: OPENAI_API_KEY ist nicht gesetzt.");
    process.exit(1);
  }
  if (!MISTRAL_API_KEY) {
    console.error("FATAL: MISTRAL_API_KEY ist nicht gesetzt.");
    process.exit(1);
  }
  
  openai = new OpenAI({ 
    apiKey: OPENAI_API_KEY,
    timeout: 180000
  });
  
  mistral = new Mistral({
    apiKey: MISTRAL_API_KEY
  });

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

  // NEU: Lade das Genesis-Manifest, um die Identität des Nexus zu definieren
  try {
    const genesisPath = path.join(KNOWLEDGE_DIR, '00_NEXUS_00_GENESIS.json');
    const genesisContent = await fs.readFile(genesisPath, 'utf8');
    const genesisData = JSON.parse(genesisContent);

    nexusState = {
      isInitialized: true,
      owners: genesisData.owners.map(owner => owner.name),
      id: genesisData.nexusId,
      coreDirective: genesisData.coreDirective
    };

    console.log('✅ [NEXUS GEBURT] Genesis-Manifest erfolgreich geladen. Nexus ist identifiziert.');
    console.log(`   - ID: ${nexusState.id}`);
    console.log(`   - Owner: ${nexusState.owners.join(', ')}`);

  } catch (error) {
    console.error('❌ FATAL: [NEXUS GEBURT] Genesis-Manifest konnte nicht geladen werden. Nexus hat keine Identität.', error);
    // Wir beenden den Prozess nicht, aber der Nexus wird im "Hohlkopf"-Modus bleiben.
  }

// 🧬 DNA SEQUENZIELLE LADUNG - Alle 34 Karten in korrekter Reihenfolge
  try {
    await loadCompleteDNA();
  } catch (error) {
    console.error('❌ [DNA LOADING] Fehler beim Laden der DNA-Karten:', error);
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

// --- SCHRITT 4: SEARCH-HILFSFUNKTIONEN (v6.2 ENHANCED FOR CONTACTS) ---

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
  
  // 🔧 ENHANCED: Bessere Token-Behandlung für Kontakte und allgemeine Suchen
  const queryTokens = normalizedQuery
    .split(/\s+/)
    .filter(token => {
      // Behalte wichtige Suchbegriffe auch wenn kurz
      const importantShortWords = ['alle', 'tel', 'fax', 'www', 'dr', 'gmbh', 'co', 'kg'];
      return token.length > 2 || importantShortWords.includes(token);
    });
  
  if (queryTokens.length === 0) return 0;
  
  let totalScore = 0;
  const foundTokens = [];
  
  // 🔧 ENHANCED: Spezielle Behandlung für Namen und Kontaktdaten
  const isContactSearch = /\b(telefon|nummer|email|adresse|kontakt|person|anne|oliver|dominik|daten|alle)\b/i.test(query);
  
  for (const token of queryTokens) {
    if (normalizedText.includes(token)) {
      foundTokens.push(token);
      
      // 🔧 ENHANCED: Höhere Scores für Kontakt-relevante Treffer
      let baseScore = isContactSearch ? 1.5 : 1;
      totalScore += baseScore;
      
      // Bonus für Wortanfänge
      const wordBoundaryRegex = new RegExp(`\\b${token}`, 'i');
      if (wordBoundaryRegex.test(normalizedText)) {
        totalScore += isContactSearch ? 0.8 : 0.5;
      }
      
      // 🔧 NEU: Extra-Bonus für Namen-Matches
      if (/^[A-Z][a-z]+$/.test(token)) {
        totalScore += 0.5;
      }
    }
  }
  
  // 🔧 ENHANCED: Phrase-Matching mit besseren Scores
  if (foundTokens.length > 1) {
    const queryPhrase = queryTokens.join('.*');
    const phraseRegex = new RegExp(queryPhrase, 'i');
    if (phraseRegex.test(normalizedText)) {
      totalScore += isContactSearch ? 1.5 : 1; // Höherer Bonus für Kontakt-Suchen
    }
  }
  
  // 🔧 ENHANCED: Flexiblere Score-Normalisierung
  const normalizedScore = totalScore / (queryTokens.length || 1);
  return Math.min(normalizedScore, 1.5); // Höherer Cap für bessere Treffer
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
    .filter(t => {
      const importantShortWords = ['alle', 'tel', 'fax', 'www', 'dr'];
      return t.length > 2 || importantShortWords.includes(t);
    });
    
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
 * Erstellt Kontext-Text für AI aus Search-Ergebnissen (v6.2 CONTACT-ENHANCED)
 * @param {Array} results - Top Search Results
 * @returns {string} Formatierter Context
 */
function createAIContext(results) {
  return results.map((result, index) => {
    const metadata = result.metadata;
    const uuidData = result.uuidData;
    
    let context = `[${index + 1}] ${metadata.Title || 'Unbekannter Titel'}`;
    
    // v6.2 Context Enhancement mit Contact-Daten
    if (uuidData.version === 'v6.1') {
      context += ` (${uuidData.workspace}/${uuidData.entry_point}/${uuidData.archetype})`;
    }
    
    if (metadata.Summary) {
      context += `\nZusammenfassung: ${metadata.Summary}`;
    }
    
    // 🔧 NEU: Contact-spezifische Felder in Context
    if (metadata.Contact) {
      context += `\nKontakt-Details:`;
      if (metadata.Contact.email) context += ` Email: ${metadata.Contact.email}`;
      if (metadata.Contact.phone) context += ` Tel: ${metadata.Contact.phone}`;
      if (metadata.Contact.company) context += ` Firma: ${metadata.Contact.company}`;
    }
    
    // 🔧 NEU: SearchableContactData direkt einbeziehen
    if (metadata.SearchableContactData) {
      context += `\nSuchbare Daten: ${metadata.SearchableContactData}`;
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



// --- 🔔 SMART REMINDER FUNCTIONS v2.0 ---

/**
 * 🔔 Extract Smart Reminder from Chat Input with REAL TIME PARSING
 * @param {string} query - User input
 * @returns {object|null} Extracted reminder with real timer or null
 */
function extractReminder(query) {
  const lowerQuery = query.toLowerCase();
  
  // Enhanced reminder keywords
  const reminderKeywords = ['erinnere mich', 'reminder', 'erinnerung', 'erinnere', 'timer für', 'alarm'];
  const hasReminderKeyword = reminderKeywords.some(keyword => lowerQuery.includes(keyword));
  
  if (!hasReminderKeyword) return null;
  
  // 🎯 SMART TIME PARSING - "in XX minuten/stunden"
  let delayMs = null;
  let timeDescription = 'bald';
  
  // Parse "in X minuten/stunden"
  const minuteMatch = lowerQuery.match(/in\s+(\d+)\s*(minuten?|min)/);
  const hourMatch = lowerQuery.match(/in\s+(\d+)\s*(stunden?|std|h)/);
  const timeMatch = lowerQuery.match(/um\s+(\d{1,2}):(\d{2})/);
  
  if (minuteMatch) {
    const minutes = parseInt(minuteMatch[1]);
    delayMs = minutes * 60 * 1000;
    timeDescription = `${minutes} Minute${minutes > 1 ? 'n' : ''}`;
  } else if (hourMatch) {
    const hours = parseInt(hourMatch[1]);
    delayMs = hours * 60 * 60 * 1000;
    timeDescription = `${hours} Stunde${hours > 1 ? 'n' : ''}`;
  } else if (timeMatch) {
    // Parse "um XX:XX" - calculate delay to that time today
    const targetHour = parseInt(timeMatch[1]);
    const targetMinute = parseInt(timeMatch[2]);
    const now = new Date();
    const target = new Date(now);
    target.setHours(targetHour, targetMinute, 0, 0);
    
    // If time has passed today, set for tomorrow
    if (target <= now) {
      target.setDate(target.getDate() + 1);
    }
    
    delayMs = target - now;
    timeDescription = `um ${targetHour.toString().padStart(2, '0')}:${targetMinute.toString().padStart(2, '0')}`;
  }
  
  // Extract person (enhanced)
  const personMatches = query.match(/(dominik|claude|chef|kollege|team|partner|anne|oliver|[A-Z][a-z]+)/i);
  const person = personMatches ? personMatches[1] : 'jemand';
  
  // Extract activity (enhanced with AN detection)
  let activity = 'Aktivität';
  const anMatch = query.match(/an\s+([^.!?]+)/);
  if (anMatch) {
    activity = anMatch[1].trim();
  } else {
    const activityMatches = query.match(/(termin|meeting|essen|treffen|call|besprechung|projekt|aufgabe|task)/i);
    if (activityMatches) activity = activityMatches[1];
  }
  
  // Create reminder with REAL timer
  const reminder = {
    id: reminderIdCounter++,
    person,
    time: timeDescription,
    activity,
    fullText: query,
    created: new Date().toISOString(),
    triggered: false,
    delayMs,
    triggerTime: delayMs ? new Date(Date.now() + delayMs).toISOString() : null,
    timerId: null // Will store setTimeout ID
  };
  
  return reminder;
}

/**
 * 🔔 Add Smart Reminder with REAL TIMER to Active List
 * @param {object} reminder - Reminder object
 */
function addReminder(reminder) {
  activeReminders.push(reminder);
  
  // 🎯 SET REAL TIMER if delay is specified
  if (reminder.delayMs && reminder.delayMs > 0) {
    reminder.timerId = setTimeout(() => {
      triggerReminder(reminder);
    }, reminder.delayMs);
    
    console.log(`[SMART-REMINDER] ✅ Timer set: ${reminder.activity} in ${reminder.time} (${reminder.delayMs}ms)`);
  } else {
    console.log(`[SMART-REMINDER] ✅ Added: ${reminder.activity} mit ${reminder.person} am ${reminder.time}`);
  }
}

/**
 * 🔔 Trigger Reminder when Timer fires
 * @param {object} reminder - Reminder to trigger
 */
function triggerReminder(reminder) {
  reminder.triggered = true;
  reminder.triggerTime = new Date().toISOString();
  
  console.log(`[SMART-REMINDER] 🚨 TRIGGERED: ${reminder.activity} für ${reminder.person}`);
  
  // Store triggered reminder for chat injection
  reminder.isActive = true;
  
  // Optional: Browser notification (if supported)
  if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
    new Notification(`NEXUS Reminder: ${reminder.activity}`, {
      body: `Zeit für: ${reminder.activity} mit ${reminder.person}`,
      icon: '/favicon.ico'
    });
  }
}

/**
 * 🔔 Get Active Reminders for Chat Injection with COUNTDOWN
 * @returns {string} Reminder text with live countdowns or empty string
 */
function getActiveRemindersText() {
  if (activeReminders.length === 0) return '';
  
  // Get recently triggered reminders
  const triggeredReminders = activeReminders.filter(r => r.triggered && r.isActive).slice(0, 2);
  
  if (triggeredReminders.length === 0) {
    // Show upcoming reminders with countdown
    const upcomingReminders = activeReminders.filter(r => !r.triggered && r.triggerTime).slice(0, 2);
    
    if (upcomingReminders.length === 0) return '';
    
    const countdownTexts = upcomingReminders.map(r => {
      const remaining = new Date(r.triggerTime) - new Date();
      const minutes = Math.ceil(remaining / (60 * 1000));
      return `⏱️ Reminder in ${minutes} Min: ${r.activity}`;
    });
    
    return '\n\n' + countdownTexts.join('\n');
  }
  
  // Mark triggered reminders as shown to avoid spam
  triggeredReminders.forEach(r => r.isActive = false);
  
  const reminderTexts = triggeredReminders.map(r => 
    `🚨 REMINDER: ${r.activity} mit ${r.person}!`
  );
  
  return '\n\n' + reminderTexts.join('\n');
}

/**
 * 🔔 Get All Active Reminders Status (for debugging/UI)
 * @returns {Array} All active reminders with status
 */
function getAllRemindersStatus() {
  return activeReminders.map(r => ({
    id: r.id,
    activity: r.activity,
    person: r.person,
    time: r.time,
    triggered: r.triggered,
    remaining: r.triggerTime ? Math.max(0, new Date(r.triggerTime) - new Date()) : null,
    created: r.created
  }));
}

/**
 * 🔔 Cancel Reminder by ID
 * @param {number} reminderId - Reminder ID to cancel
 * @returns {boolean} Success status
 */
function cancelReminder(reminderId) {
  const reminderIndex = activeReminders.findIndex(r => r.id === reminderId);
  
  if (reminderIndex === -1) return false;
  
  const reminder = activeReminders[reminderIndex];
  
  // Clear timer if exists
  if (reminder.timerId) {
    clearTimeout(reminder.timerId);
  }
  
  // Remove from array
  activeReminders.splice(reminderIndex, 1);
  
  console.log(`[SMART-REMINDER] ❌ Cancelled: ${reminder.activity}`);
  return true;
}



// --- DEMO RULES FUNKTIONEN ---

/**
 * 🧠 Regel-Matching Funktion für Demo-Regeln
 * @param {string} text - Input text to check
 * @returns {Array} Matched rules
 */
function checkDemoRules(text) {
  const results = [];
  const lowerText = text.toLowerCase();
  
  for (const rule of DEMO_RULES) {
    const phrases = rule.condition.contains_phrases;
    const hasPhrase = phrases.some(phrase => lowerText.includes(phrase));
    
    // Check for date reference if required
    const hasDate = rule.condition.has_date_reference
      ? /\b\d{1,2}\.\d{1,2}\.?\d{0,4}\b|\b(montag|dienstag|mittwoch|donnerstag|freitag|samstag|sonntag|morgen|heute|nächste woche)\b/i.test(text)
      : true;
    
    if (hasPhrase && hasDate) {
      results.push({
        ruleName: rule.name,
        action: rule.action
      });
    }
  }
  
  return results;
}

// --- SCHRITT 5: STANDARD-HILFSFUNKTIONEN (UNCHANGED) ---

// Klassifiziert Content mit OpenAI
async function classifyContent(content, sourceUrl = null) {
  try {
    const classifierPrompt = await fs.readFile(CLASSIFIER_PROMPT_PATH, 'utf8');
    const prompt = `${classifierPrompt}\n\nContent:\n${content.substring(0, 2000)}`;
    
const response = await mistral.chat.complete({
      model: "codestral-latest",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.1,
      maxTokens: 2000
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

// Generiert Nexus-Objekt mit OpenAI
async function generateNexusObject(content, sourceUrl = null, contextUuid = null) {
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

// 🗓️ Enhanced Calendar-specific Nexus Object Generation
async function generateCalendarNexusObject(content, sourceUrl = null) {
  try {
    const capturePrompt = await fs.readFile(CAPTURE_PROMPT_PATH, 'utf8');
    
    // Enhanced prompt for calendar/meeting content
    const enhancedPrompt = `${capturePrompt}

ZUSÄTZLICH FÜR KALENDER/TERMINE:
- Erkenne ALLE Personen (Namen, Spitznamen, Aliases)
- Erkenne ALLE Zeiten (heute, morgen, Uhrzeiten, Wochentage)
- Erkenne ALLE Orte (Adressen, Gebäude, Restaurants, Hotels)
- Erkenne ALLE Aktivitäten (Essen, Treffen, Meeting, Call, etc.)
- Erstelle umfangreiche Such-Tags für jede erkannte Entität
- Füge Synonym-Tags hinzu (z.B. "Essen" → auch "#Treffen", "#Meeting")

Content:\n${content}\n\nSource URL: ${sourceUrl || 'N/A'}`;
    
    const response = await openai.chat.completions.create({
      model: COMPLETION_MODEL,
      messages: [{ role: "user", content: enhancedPrompt }],
      temperature: 0.2,
      max_tokens: 2000
    });
    
    const nexusContent = response.choices[0]?.message?.content || "";
    return { success: true, content: nexusContent };
  } catch (error) {
    console.error("Fehler bei generateCalendarNexusObject:", error);
    return { success: false, error: error.message };
  }
}

// Wrapper für Analyse-Requests
async function handleAnalysisRequest(analysisFunction, req, res) {
  try {
    const result = await analysisFunction(req.body);
    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    console.error("Fehler in handleAnalysisRequest:", error);
    res.status(500).json({ success: false, error: error.message });
  }
}

// Text-Content bereinigen
function cleanTextContent(html) {
  const $ = cheerio.load(html);
  $('script, style, nav, footer, aside').remove();
  return $.text().replace(/\s+/g, ' ').trim();
}

// Web-Scraping mit ScraperAPI oder Puppeteer
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
      await page.goto(url, { waitUntil: 'networkidle0', timeout: 120000 });
      const content = await page.content();
      await browser.close();
      return content;
    }
  } catch (error) {
    console.error("Scraping-Fehler:", error);
    throw error;
  }
}


// 🚀 MONSTER-FEATURE: Enhanced Article Summary Generation
async function generateEnhancedArticleSummary(content, sourceUrl, knowledgeContext) {
  try {
    const prompt = `Du bist ein Experte für Artikel-Analyse und Wissensmanagement.

ARTIKEL INHALT: ${content}
BESTEHENDE WISSENSBASIS KONTEXT: ${knowledgeContext}

ANALYSIERE den Artikel und identifiziere die wichtigsten ABSCHNITTE und deren Position im Text.
Erstelle KLICKBARE ANCHOR-LINKS die zu spezifischen Bereichen im Original-Artikel führen.

Erstelle eine STRUKTURIERTE ANALYSE im folgenden JSON-FORMAT:
{
  "category": {
    "main": "Politik",
    "sub": ["International", "EU-USA", "Handel"],
    "readTime": "6 Minuten"
  },
  "tldr": {
    "ultra": "Ein-Satz Zusammenfassung",
    "standard": "2-3 Sätze Zusammenfassung", 
    "detailed": "Ausführlicher Absatz mit mehr Details und Kontext"
  },
  "linkedBulletpoints": [
    {
      "text": "🔥 Haupterkenntnis: [Beschreibung des wichtigsten Punkts]",
      "anchor": "introduction",
      "importance": "high",
      "preview": "Erste 2 Zeilen des Zielbereichs für Hover-Preview"
    },
    {
      "text": "📊 Kernfakten: [Zentrale Daten und Zahlen]", 
      "anchor": "main-findings",
      "importance": "high",
      "preview": "Erste 2 Zeilen des Daten-Bereichs"
    },
    {
      "text": "💡 Auswirkungen: [Was bedeutet das praktisch]",
      "anchor": "implications", 
      "importance": "medium",
      "preview": "Erste 2 Zeilen der Schlussfolgerungen"
    }
  ],
  "keyQuotes": [
    {
      "text": "Das aussagekräftigste Zitat aus dem Artikel",
      "context": "Wer hat es gesagt und in welchem Zusammenhang",
      "speaker": "Person oder Organisation falls bekannt",
      "importance": "high"
    },
    {
      "text": "Zweites wichtiges Zitat falls vorhanden",
      "context": "Kontext zum zweiten Zitat",
      "speaker": "Person falls bekannt", 
      "importance": "medium"
    }
  ],
  "knowledgeIntegration": {
    "connects_to": ["Spezifische Themen aus Wissensbasis die sich verbinden"],
    "expands_knowledge": "Konkret was dieser Artikel zu deinem bestehenden Wissen hinzufügt",
    "relevance_score": 0.8,
    "new_insights": ["Neue Erkenntnisse die vorher nicht bekannt waren"]
  }
}

WICHTIGE ANCHOR-REGELN:
- Anchor-Namen sollen zu ECHTEN Bereichen im Artikel zeigen
- Nutze sinnvolle IDs wie: "introduction", "main-findings", "data-analysis", "conclusion", "implications"
- Preview-Text: Erste 1-2 Sätze des Zielbereichs (für Hover-Funktion)
- Text beschreibt WAS der User finden wird wenn er klickt
- Mindestens 3, maximal 5 Bulletpoints erstellen
- Quotes: NUR wenn wirklich aussagekräftige Zitate im Artikel stehen

Antworte NUR mit gültigem JSON, keine Erklärungen.`;

    const response = await openai.chat.completions.create({
      model: COMPLETION_MODEL,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.1,
      max_tokens: 2500
    });

    const aiContent = response.choices[0]?.message?.content || "{}";
    
    try {
      // 🔧 JSON-PARSER-FIX: Remove code block markers if present
      let cleanJson = aiContent.trim();
      if (cleanJson.startsWith('```json')) {
        cleanJson = cleanJson.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      }
      if (cleanJson.startsWith('```')) {
        cleanJson = cleanJson.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }
      
      const enhancedData = JSON.parse(cleanJson);
      console.log('[MONSTER-FEATURE] ✅ Enhanced summary with smart anchor links generated successfully');
      return enhancedData;
    } catch (jsonError) {
      console.error('[MONSTER-FEATURE] JSON parse error:', jsonError);
      return createFallbackSummary(content);
    }
    
  } catch (error) {
    console.error('[MONSTER-FEATURE] Enhanced summary error:', error);
    return createFallbackSummary(content);
  }
}

// 🧠 KNOWLEDGE CONTEXT: Durchsucht bestehende Wissensbasis
function createKnowledgeContext(query) {
  try {
    console.log('[KNOWLEDGE-CONTEXT] 🔍 Creating context for query:', query.substring(0, 100));
    
    // Extrahiere Keywords aus Query
    const keywords = query.toLowerCase()
      .split(/\s+/)
      .filter(word => word.length > 3)
      .slice(0, 5);
    
    // Durchsuche Cache nach ähnlichen Themen
    let relatedTopics = [];
    let totalFiles = 0;
    
    if (knowledgeCache && knowledgeCache.size > 0) {
      totalFiles = knowledgeCache.size;
      
      for (const [filename, metadata] of knowledgeCache.entries()) {
        const searchText = [
          metadata.Title || '',
          metadata.Summary || '',
          (metadata.Tags || []).join(' ')
        ].join(' ').toLowerCase();
        
        const relevanceScore = keywords.filter(keyword => 
          searchText.includes(keyword)
        ).length / keywords.length;
        
        if (relevanceScore > 0.3) {
          relatedTopics.push({
            title: metadata.Title || 'Unbekannt',
            relevance: relevanceScore,
            tags: metadata.Tags || []
          });
        }
      }
    }
    
    // Sortiere nach Relevanz und nimm Top 5
    relatedTopics = relatedTopics
      .sort((a, b) => b.relevance - a.relevance)
      .slice(0, 5);
    
    const contextSummary = relatedTopics.length > 0
      ? `Verwandte Themen in deiner Wissensbasis: ${relatedTopics.map(t => t.title).join(', ')}`
      : `Neues Thema für deine Wissensbasis (${totalFiles} bestehende Einträge)`;
    
    console.log(`[KNOWLEDGE-CONTEXT] ✅ Context created: ${relatedTopics.length} related topics found`);
    
    return contextSummary;
    
  } catch (error) {
    console.error('[KNOWLEDGE-CONTEXT] Error:', error);
    return 'Keine verwandten Themen gefunden (Fehler beim Durchsuchen)';
  }
}

// 🎨 FORMAT ENHANCED SUMMARY: Formatiert für Frontend (PREMIUM HTML VERSION)
function formatEnhancedSummary(enhancedData, sourceUrl) {
  try {
    const category = enhancedData.category || {};
    const tldr = enhancedData.tldr || {};
    const bulletpoints = enhancedData.linkedBulletpoints || [];
    const quotes = enhancedData.keyQuotes || [];
    const integration = enhancedData.knowledgeIntegration || {};
    
    // 🔧 URL-FIX: Chrome-Extension URL bereinigen DIREKT IM SERVER!
    let cleanUrl = sourceUrl;
    if (sourceUrl && sourceUrl.includes('chrome-extension://')) {
      console.log('[FORMAT-ENHANCED] 🔧 Applying server-side URL-Fix...');
      if (sourceUrl.includes('https//')) {
        cleanUrl = sourceUrl.replace(/.*https\/\//, 'https://');
      } else if (sourceUrl.includes('http//')) {
        cleanUrl = sourceUrl.replace(/.*http\/\//, 'http://');
      }
      console.log('[FORMAT-ENHANCED] ✅ URL fixed:', sourceUrl, '→', cleanUrl);
    }
    
 // 🚀 PREMIUM CONTAINER: PERFEKTE Interface-Harmonie (wie oberer Bereich!)
    let formattedResponse = `<article class="nexus-premium-summary" style="
      --nexus-orange: #f56502;
      --nexus-green: #4caf50;
      --nexus-blue: #2196f3;
      --nexus-yellow: #ffc107;
      --nexus-orange-light: rgba(245, 101, 2, 0.15);
      --nexus-green-light: rgba(76, 175, 80, 0.15);
      --nexus-blue-light: rgba(33, 150, 243, 0.15);
      --nexus-yellow-light: rgba(255, 193, 7, 0.15);
      --nexus-perfect-bg: rgba(50, 60, 80, 0.9);
      --nexus-light-text: #e1e5e9;
      margin: 0; 
      padding: 12px; 
      background: linear-gradient(135deg, var(--nexus-orange-light), var(--nexus-perfect-bg));
      border-radius: 12px;
      border-left: 4px solid var(--nexus-orange);
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui;
      transition: all 0.3s ease;
    ">`;
    
    // 🟠 PREMIUM HEADER: Orange branded header
    formattedResponse += `<header class="nexus-premium-header" style="
      color: var(--nexus-orange);
      font-size: 18px;
      font-weight: 700;
      margin-bottom: 16px;
      padding: 8px 12px;
      background: linear-gradient(90deg, var(--nexus-orange-light), transparent);
      border-radius: 8px;
      border-left: 3px solid var(--nexus-orange);
    ">🚀 NEXUS Premium Summary</header>`;
    
    // 📊 CATEGORY & READING TIME: Perfekte Harmonie
    formattedResponse += `<section class="nexus-premium-meta" style="
      background: var(--nexus-perfect-bg);
      padding: 12px;
      border-radius: 8px;
      margin-bottom: 12px;
      border: 1px solid var(--nexus-orange-light);
      backdrop-filter: blur(5px);
    ">`;
    formattedResponse += `<div style="color: var(--nexus-light-text); font-weight: 600;">📂 <span style="color: var(--nexus-orange);">Kategorie:</span> ${category.main || 'Allgemein'}`;
    if (category.sub && category.sub.length > 0) {
      formattedResponse += ` → <span style="color: var(--nexus-blue);">${category.sub.join(' • ')}</span>`;
    }
    formattedResponse += `</div>`;
    formattedResponse += `<div style="margin-top: 6px; color: var(--nexus-light-text); font-weight: 600;">⏱️ <span style="color: var(--nexus-orange);">Lesezeit:</span> ${category.readTime || 'Unbekannt'}`;
    if (cleanUrl) {
      formattedResponse += `<br><a href="${cleanUrl}" target="_blank" style="
        color: var(--nexus-orange);
        text-decoration: none;
        font-weight: 600;
        padding: 4px 8px;
        background: var(--nexus-orange-light);
        border-radius: 4px;
        display: inline-block;
        margin-top: 6px;
        transition: all 0.2s ease;
      " onmouseover="this.style.background='var(--nexus-orange)'; this.style.color='white';" 
         onmouseout="this.style.background='var(--nexus-orange-light)'; this.style.color='var(--nexus-orange)';">📖 Artikel öffnen →</a>`;
    }
    formattedResponse += `</div></section>`;
    
    // 📊 PREMIUM TL;DR: Perfekte Harmonie
    formattedResponse += `<section class="nexus-premium-tldr" style="
      background: var(--nexus-blue-light);
      padding: 12px;
      border-radius: 8px;
      margin-bottom: 12px;
      border-left: 3px solid var(--nexus-blue);
    ">`;
    formattedResponse += `<div style="color: var(--nexus-blue); font-weight: 700; margin-bottom: 8px;">📊 TL;DR:</div>`;
    
    // TL;DR Icons mit perfekter Harmonie
    const activeIcon = `style="
      background: var(--nexus-blue);
      color: white;
      padding: 6px 10px;
      border-radius: 6px;
      cursor: pointer;
      font-weight: 600;
      margin: 0 4px;
      transition: all 0.2s ease;
      box-shadow: 0 2px 4px rgba(0,0,0,0.4);
    "`;
    const inactiveIcon = `style="
      background: var(--nexus-perfect-bg);
      color: var(--nexus-blue);
      padding: 6px 10px;
      border-radius: 6px;
      cursor: pointer;
      margin: 0 4px;
      opacity: 0.8;
      transition: all 0.2s ease;
      border: 1px solid var(--nexus-blue-light);
    "`;
    
    formattedResponse += `<div style="margin-bottom: 10px;">`;
    formattedResponse += `<span class="tldr-icon" data-mode="ultra" ${inactiveIcon} title="Ultra-Kurz">⚡</span>`;
    formattedResponse += `<span class="tldr-icon" data-mode="standard" ${activeIcon} title="Standard">📊</span>`;
    formattedResponse += `<span class="tldr-icon" data-mode="detailed" ${inactiveIcon} title="Detailliert">🔍</span>`;
    formattedResponse += `</div>`;
    
    formattedResponse += `<div class="tldr-content" id="tldr-display" style="
      padding: 10px;
      background: var(--nexus-perfect-bg);
      border-radius: 6px;
      border: 1px solid var(--nexus-blue-light);
      color: var(--nexus-light-text);
      line-height: 1.5;
      backdrop-filter: blur(5px);
    ">`;
    formattedResponse += `<span class="tldr-ultra" style="display: none;">${tldr.ultra || 'Nicht verfügbar'}</span>`;
    formattedResponse += `<span class="tldr-standard" style="display: block;">${tldr.standard || 'Nicht verfügbar'}</span>`;
    formattedResponse += `<span class="tldr-detailed" style="display: none;">${tldr.detailed || 'Nicht verfügbar'}</span>`;
    formattedResponse += `</div></section>`;
    
    // 🔵 PREMIUM BULLETPOINTS: Harmonischer blauer Hintergrund (GEÄNDERT!)
    if (bulletpoints.length > 0) {
      formattedResponse += `<section class="nexus-premium-bulletpoints" style="
        background: var(--nexus-blue-light);
        padding: 12px;
        border-radius: 8px;
        margin-bottom: 12px;
        border-left: 3px solid var(--nexus-blue);
      ">`;
      formattedResponse += `<div style="color: var(--nexus-green); font-weight: 700; margin-bottom: 10px;">🎯 Hauptpunkte:</div>`;
      
      bulletpoints.forEach((point, index) => {
        const importanceIcon = point.importance === 'high' ? '🔥' : 
                              point.importance === 'medium' ? '📌' : '💡';
        
        formattedResponse += `<div style="
          margin: 8px 0;
          padding: 8px;
          background: var(--nexus-perfect-bg);
          border-radius: 6px;
          border-left: 3px solid var(--nexus-green);
          transition: all 0.2s ease;
          backdrop-filter: blur(5px);
        ">`;
        
        if (cleanUrl && point.anchor) {
          const targetUrl = `${cleanUrl}#${point.anchor}`;
          formattedResponse += `<a href="${targetUrl}" target="_blank" style="
            text-decoration: none;
            color: var(--nexus-light-text);
            font-weight: 600;
            display: block;
            transition: all 0.2s ease;
          " `;
          
          if (point.preview) {
            formattedResponse += `title="${point.preview}" `;
          }
          
          formattedResponse += `onmouseover="this.parentElement.style.background='var(--nexus-green-light)'; this.style.color='var(--nexus-green)';" `;
          formattedResponse += `onmouseout="this.parentElement.style.background='var(--nexus-perfect-bg)'; this.style.color='var(--nexus-light-text)';">`;
          formattedResponse += `${importanceIcon} ${point.text}</a>`;
        } else {
          formattedResponse += `<span style="color: var(--nexus-light-text); font-weight: 600;">${importanceIcon} ${point.text}</span>`;
        }
        formattedResponse += `</div>`;
      });
      formattedResponse += `</section>`;
    }
    
    // 🔵 PREMIUM QUOTES: Harmonischer blauer Hintergrund (GEÄNDERT!)
    if (quotes.length > 0 && quotes.some(q => q.text && q.text.length > 10)) {
      formattedResponse += `<section class="nexus-premium-quotes" style="
        background: var(--nexus-blue-light);
        padding: 12px;
        border-radius: 8px;
        margin-bottom: 12px;
        border-left: 3px solid var(--nexus-blue);
      ">`;
      formattedResponse += `<div style="color: var(--nexus-yellow); font-weight: 700; margin-bottom: 10px;">💬 Wichtige Zitate:</div>`;
      
      quotes.forEach(quote => {
        if (quote.text && quote.text.length > 10) {
          const quoteIcon = quote.importance === 'high' ? '🔥' : '💬';
          formattedResponse += `<blockquote style="
            margin: 10px 0;
            padding: 12px;
            background: var(--nexus-perfect-bg);
            border-radius: 8px;
            border-left: 4px solid var(--nexus-yellow);
            position: relative;
            backdrop-filter: blur(5px);
          ">`;
          formattedResponse += `<div style="color: var(--nexus-light-text); font-style: italic; line-height: 1.5;">${quoteIcon} "${quote.text}"</div>`;
          if (quote.speaker) {
            formattedResponse += `<cite style="color: var(--nexus-yellow); font-weight: 600; margin-top: 6px; display: block;">— ${quote.speaker}</cite>`;
          }
          if (quote.context) {
            formattedResponse += `<small style="color: #aaa; display: block; margin-top: 4px;">${quote.context}</small>`;
          }
          formattedResponse += `</blockquote>`;
        }
      });
      formattedResponse += `</section>`;
    }
    
    // 🔵 PREMIUM KNOWLEDGE INTEGRATION: Perfekte Harmonie (UNVERÄNDERT!)
    if (integration.expands_knowledge) {
      formattedResponse += `<section class="nexus-premium-knowledge" style="
        background: linear-gradient(135deg, var(--nexus-blue-light), var(--nexus-perfect-bg));
        padding: 12px;
        border-radius: 8px;
        margin-bottom: 12px;
        border: 2px solid var(--nexus-blue);
        position: relative;
        backdrop-filter: blur(5px);
      ">`;
      formattedResponse += `<div style="color: var(--nexus-blue); font-weight: 700; margin-bottom: 10px;">🧠 NEXUS Wissens-Integration:</div>`;
      
      formattedResponse += `<div style="color: var(--nexus-light-text); line-height: 1.6;">`;
      formattedResponse += `<div style="margin: 6px 0;"><strong style="color: var(--nexus-blue);">🔗 Ergänzt dein Wissen um:</strong> ${integration.expands_knowledge}</div>`;
      
      if (integration.connects_to && integration.connects_to.length > 0) {
        formattedResponse += `<div style="margin: 6px 0;"><strong style="color: var(--nexus-blue);">📚 Verbindet sich mit:</strong> ${integration.connects_to.join(' • ')}</div>`;
      }
      
      if (integration.new_insights && integration.new_insights.length > 0) {
        formattedResponse += `<div style="margin: 6px 0;"><strong style="color: var(--nexus-blue);">💡 Neue Erkenntnisse:</strong> ${integration.new_insights.join(', ')}</div>`;
      }
      
      if (integration.relevance_score) {
        const scorePercent = Math.round(integration.relevance_score * 100);
        formattedResponse += `<div style="margin: 6px 0;"><strong style="color: var(--nexus-blue);">📊 Relevanz für dich:</strong> <span style="color: var(--nexus-green); font-weight: 700;">${scorePercent}%</span></div>`;
      }
      formattedResponse += `</div></section>`;
    }
    
    formattedResponse += `</article>`;
    
    // 🚀 PREMIUM FOOTER: Enhanced branding
    formattedResponse += `<footer class="nexus-premium-footer" style="
      margin-top: 12px;
      padding: 10px 12px;
      background: linear-gradient(90deg, var(--nexus-orange), var(--nexus-blue));
      color: white;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 600;
      text-align: center;
      box-shadow: 0 2px 8px rgba(0,0,0,0.3);
    ">`;
    formattedResponse += `✨ <strong>Powered by NEXUS Premium Analysis v3.0</strong> • Click-Navigation • Smart TL;DR • AI-Enhanced`;
    formattedResponse += `</footer>`;
    
    console.log('[FORMAT-ENHANCED] ✅ PREMIUM summary with PERFECT Interface-Harmonie formatted as HTML');
    return formattedResponse;
    
  } catch (error) {
    console.error('[FORMAT-ENHANCED] Error:', error);
    return `<article class="nexus-premium-summary" style="
      background: rgba(50, 60, 80, 0.9);
      padding: 12px;
      border-radius: 8px;
      border-left: 4px solid #f56502;
    ">
      <header style="color: #f56502; font-weight: 700; margin-bottom: 8px;">🚀 NEXUS Premium Summary</header>
      <div style="color: #e1e5e9;">
        Der Artikel wurde analysiert und gespeichert.
        <br><strong>Status:</strong> Verarbeitung erfolgreich
        ${cleanUrl ? `<br><a href="${cleanUrl}" target="_blank" style="color: #f56502;">📖 Artikel öffnen →</a>` : ''}
      </div>
    </article>`;
  }
}

// 🔄 FALLBACK: Erstellt einfache Summary bei Fehlern
function createFallbackSummary(content) {
  return {
    category: { main: "Artikel", readTime: "Unbekannt" },
    tldr: { 
      ultra: "Artikel wurde erfasst",
      standard: "Der Artikel wurde erfolgreich analysiert und gespeichert",
      detailed: content.substring(0, 200) + "..."
    },
    linkedBulletpoints: [
      { text: "Artikel erfolgreich verarbeitet", importance: "medium" }
    ],
    keyQuotes: [],
    knowledgeIntegration: {
      expands_knowledge: "Neuer Inhalt wurde zu deiner Wissensbasis hinzugefügt"
    }
  };
}



// --- EMAIL-PARSING ENGINE v1.0 (SMART BATCH ARCHITECTURE) ---
/**
 * 🤖 AI-basierte Email-Thread Analyse (Batch-Processing)
 * @param {string} emailContent - Raw email thread content
 * @returns {Promise<object>} Analysis result with contacts, meetings, etc.
 */
async function analyzeEmailThread(emailContent) {
  try {
    const prompt = `Analysiere diesen Email-Thread und extrahiere strukturierte Informationen:

EMAIL-THREAD:
${emailContent}

Erstelle JSON-Output mit folgender exakter Struktur:
{
  "contacts": [
    {
      "name": "Vollständiger Name",
      "email": "email@domain.com", 
      "company": "Firmenname oder null",
      "phone": "Telefonnummer oder null",
      "address": "Vollständige Adresse oder null",
      "position": "Position/Titel oder null",
      "signature_context": "Kontext aus Signatur",
      "is_owner": false
    }
  ],
  "meetings": [
    {
      "title": "Meeting Titel",
      "date": "2025-05-06",
      "time": "18:00",
      "zoom_link": "https://zoom... oder null",
      "location": "Ort oder null", 
      "attendees": ["Name1", "Name2"],
      "requirements": ["ChatGPT Pro", "etc."]
    }
  ],
  "thread_summary": "Kurze Zusammenfassung des Email-Threads",
  "action_items": ["Aufgabe 1", "Aufgabe 2"],
  "thread_topic": "Haupt-Thema des Threads"
}

WICHTIGE REGELN FÜR KONTAKT-EXTRAKTION:
- Extrahiere NUR Personen aus EMAIL-SIGNATUREN (Name + mindestens eine Kontaktinfo)
- ABSOLUT VERBOTEN: "Lieber Oliver", "Liebe Anne", "Hallo", "Guten Morgen", "Liebe Grüße", "Beste Grüße" als Namen!
- ABSOLUT VERBOTEN: Grußformeln, Anreden, Verabschiedungen als Kontakte zu extrahieren!
- ABSOLUT VERBOTEN: Alleinstehende Namen ohne Email/Telefon/Adresse!
- NUR ERLAUBT: Vollständige Signatur-Blöcke mit Vor- UND Nachname + mindestens Email ODER Telefon
- Suche nach Signatur-Blöcken mit: Vollständiger Name, Firma/Institut, Adresse, Telefon, Email
- REGEL: Ein Kontakt MUSS mindestens Email ODER Telefonnummer haben - sonst IGNORIEREN!
- Bei mehrfachen Vorkommen einer Person: Nimm vollständigste Signatur
- Erkenne Owner (Oliver Welling) und setze is_owner: true
- Erkenne deutsche Telefonnummern in diesen Formaten: +49 30 12345678, 030 12345678, 030-12345678, +49 170 1234567, 0170 1234567, Tel.: 0761-76 777 11, Fon: +49 (0)40 3501 73–20
- Ordne Telefonnummern dem korrekten Namen aus der GLEICHEN Signatur zu
- BEISPIEL UNGÜLTIG: "Lieber Oliver" - Das ist eine Grußformel, KEIN Kontakt!
- BEISPIEL UNGÜLTIG: "Anne" ohne Email/Telefon - Das ist unvollständig!
- BEISPIEL GÜLTIG: "Dr. Anne Wilmers\\nBasler Landstr. 113\\nTel.: 0761-76 777 11"
- BEISPIEL GÜLTIG: "Oliver Welling\\noliver.welling@brain-two.de"
- Extrahiere alle Termine, Zoom-Links, Action Items
- WICHTIG: Wenn du unsicher bist, ob etwas ein Kontakt ist - dann ist es KEIN Kontakt!
- Antworte NUR mit gültigem JSON, keine Erklärungen`;

    console.log('[EMAIL-AI] 🤖 USING MISTRAL CODESTRAL - DEBUG ACTIVE');
    const response = await mistral.chat.complete({
      model: "codestral-latest",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.1,
      maxTokens: 2000
    });

    const aiContent = response.choices[0]?.message?.content || "{}";
    
    try {
      // 🔧 JSON-PARSER-FIX: Remove code block markers if present
      let cleanJson = aiContent.trim();
      if (cleanJson.startsWith('```json')) {
        cleanJson = cleanJson.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      }
      if (cleanJson.startsWith('```')) {
        cleanJson = cleanJson.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }
      
      const analysisData = JSON.parse(cleanJson);
      console.log(`[EMAIL-AI] ✅ Successful analysis: ${analysisData.contacts?.length || 0} contacts, ${analysisData.meetings?.length || 0} meetings`);
      
      return {
        success: true,
        data: analysisData
      };
    } catch (jsonError) {
      console.error('[EMAIL-AI] JSON parse error:', jsonError);
      return createFallbackEmailAnalysis(emailContent);
    }
    
  } catch (error) {
    console.error('[EMAIL-AI] AI analysis error:', error);
    return createFallbackEmailAnalysis(emailContent);
  }
}

/**
 * 🔄 Fallback Email-Analysis wenn AI fehlschlägt
 * @param {string} emailContent - Email content
 * @returns {object} Basic analysis
 */
function createFallbackEmailAnalysis(emailContent) {
  const emails = emailContent.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || [];
  const uniqueEmails = [...new Set(emails)];
  
  // Deutsche Telefonnummer-Extraktion - Alle gängigen Formate
  const phonePatterns = [
    /(?:Tel\.?:?\s*|Telefon:?\s*|Phone:?\s*|Mobil:?\s*|Fon:?\s*)([+]?49\s?\(?0?\)?\s?\d{2,4}[\s\-]?\d{3,4}[\s\-]?\d{2,4})/gi,
    /(?:^|\s)(0\d{2,4}[\s\-]?\d{3,4}[\s\-]?\d{2,4})(?:\s|$)/gm,
    /(?:^|\s)(\+49\s?\d{2,4}\s?\d{3,4}\s?\d{2,4})(?:\s|$)/gm,
    /(?:T:?\s*)([+]?49[\s\-]?\d{3}[\s\-]?\d{7,8}[\s\-]?\d?)/gi
  ];
  
  const phones = [];
  phonePatterns.forEach(pattern => {
    const matches = emailContent.match(pattern) || [];
    matches.forEach(match => {
      const cleanPhone = match.replace(/(?:Tel\.?:?\s*|Telefon:?\s*|Phone:?\s*|Mobil:?\s*|Fon:?\s*|T:?\s*)/gi, '').trim();
      if (cleanPhone.length >= 8) {
        phones.push(cleanPhone);
      }
    });
  });
  const uniquePhones = [...new Set(phones)];
  
  // Bessere Name-Extraktion aus Signaturen
  const namePatterns = [
    /(?:Dr\.\s+)?([A-ZÄÖÜ][a-zäöüß]+(?:\s+[A-ZÄÖÜ][a-zäöüß]+)+)(?:\s*[,\n])/g,
    /Von:\s*([^<\n]+?)(?:\s*<|$)/gi,
    /^([A-ZÄÖÜ][a-zäöüß]+(?:\s+[A-ZÄÖÜ][a-zäöüß]+)+)$/gm
  ];
  
  const extractedNames = [];
  namePatterns.forEach(pattern => {
    const matches = emailContent.match(pattern) || [];
    matches.forEach(match => {
      const cleanName = match.replace(/(?:Von:\s*|Dr\.\s*)/gi, '').replace(/[,\n<]/g, '').trim();
      if (cleanName.length > 3 && cleanName.includes(' ')) {
        extractedNames.push(cleanName);
      }
    });
  });
  
  const contacts = [];
  
  // Kombiniere Emails mit Names und Telefonnummern
  uniqueEmails.forEach((email, index) => {
    const name = extractedNames[index] || email.split('@')[0].replace(/[._]/g, ' ');
    const phone = uniquePhones[index] || null;
    
    contacts.push({
      name: name,
      email: email,
      company: null,
      phone: phone,
      address: null,
      position: null,
      signature_context: "Automatisch extrahiert",
      is_owner: email.toLowerCase().includes('oliver') || name.toLowerCase().includes('oliver')
    });
  });
  
  // Füge gefundene Namen ohne Email hinzu (falls mehr Namen als Emails)
  if (extractedNames.length > uniqueEmails.length) {
    const remainingNames = extractedNames.slice(uniqueEmails.length);
    remainingNames.forEach((name, index) => {
      const phone = uniquePhones[uniqueEmails.length + index] || null;
      contacts.push({
        name: name,
        email: null,
        company: null,
        phone: phone,
        address: null,
        position: null,
        signature_context: "Name aus Signatur extrahiert",
        is_owner: name.toLowerCase().includes('oliver')
      });
    });
  }

  return {
    success: true,
    data: {
      contacts: contacts,
      meetings: [],
      thread_summary: "Email-Thread empfangen",
      action_items: [],
      thread_topic: "Email-Kommunikation"
    }
  };
}

/**
 * 🏗️ Multi-Object Creation Pipeline
 * @param {object} analysisData - Parsed email analysis
 * @returns {Promise<object>} Created objects info
 */
async function createEmailObjects(analysisData) {
  const result = {
    contacts: [],
    meetings: [],
    thread: null,
    totalObjects: 0
  };

  try {
    console.log(`[EMAIL-OBJECTS] 🚀 Starting multi-object creation with ${analysisData.contacts?.length || 0} contacts`);
    
    // 1. Create Contact Objects
    for (const [index, contact] of (analysisData.contacts || []).entries()) {
      console.log(`[EMAIL-OBJECTS] Creating contact ${index + 1}: ${contact.name} (phone: ${contact.phone}, email: ${contact.email})`);
      
      const contactObject = await createContactNexusObject(contact, index);
      result.contacts.push(contactObject);
      result.totalObjects++;
    }

    // 2. Create Meeting Objects
    for (const meeting of analysisData.meetings || []) {
      const meetingObject = await createMeetingNexusObject(meeting, result.contacts);
      result.meetings.push(meetingObject);
      result.totalObjects++;
    }

    // 3. Create Thread Object
    if (analysisData.thread_topic) {
      const threadObject = await createThreadNexusObject(analysisData, result);
      result.thread = threadObject;
      result.totalObjects++;
    }

    console.log(`[EMAIL-OBJECTS] ✅ Created ${result.totalObjects} objects: ${result.contacts.length} contacts, ${result.meetings.length} meetings`);
    return result;

  } catch (error) {
    console.error('[EMAIL-OBJECTS] Creation error:', error);
    throw error;
  }
}

/**
 * 👤 Create Single Contact Nexus Object
 * @param {object} contactData - Contact information
 * @param {number} index - Index for unique UUID generation
 * @returns {Promise<object>} Contact object info
 */
async function createContactNexusObject(contactData, index = 0) {
  console.log(`[CONTACT-CREATE] 📞 Processing: ${contactData.name}, Phone: ${contactData.phone}, Email: ${contactData.email}`);
  
  const tagsJson = {
    Title: `Kontakt: ${contactData.name}`,
    Summary: `Kontakt aus Email-Thread extrahiert: ${contactData.name}${contactData.company ? ` (${contactData.company})` : ''}${contactData.phone ? ` - Tel: ${contactData.phone}` : ''}`,
    Archetype: 'Contact',
    Contact: {
      name: contactData.name,
      email: contactData.email,
      company: contactData.company,
      phone: contactData.phone,
      address: contactData.address,
      position: contactData.position
    },
    Properties: {
      source: 'email_thread',
      is_owner: contactData.is_owner || false,
      extraction_method: 'ai_batch',
      capture_timestamp: new Date().toISOString(),
      phone_extracted: !!contactData.phone,
      email_extracted: !!contactData.email
    },
    Tags: [
      '#Kontakt',
      '#Email',
      contactData.company ? `#${contactData.company.replace(/\s+/g, '')}` : '',
      contactData.is_owner ? '#Owner' : '',
      contactData.phone ? '#Telefon' : '',
      contactData.position ? `#${contactData.position.replace(/\s+/g, '')}` : '',
      contactData.name.replace(/\s+/g, '') // Name als Tag für bessere Suche
    ].filter(tag => tag.length > 0),
    // 🔍 SEARCH-FIX: Contact-Daten für Search-Index verfügbar machen
    SearchableContactData: `${contactData.name} ${contactData.email || ''} ${contactData.phone || ''} ${contactData.company || ''} ${contactData.position || ''}`.trim(),
    UZT_ISO8601: new Date().toISOString(),
    Erfassung_Timestamp: new Date().toISOString()
  };

  const mdContent = `# Kontakt: ${contactData.name}

## Kontakt-Informationen
- **Name:** ${contactData.name}
- **Email:** ${contactData.email || 'N/A'}
- **Firma:** ${contactData.company || 'N/A'}
- **Telefon:** ${contactData.phone || 'N/A'}
- **Position:** ${contactData.position || 'N/A'}
- **Adresse:** ${contactData.address || 'N/A'}

## Kontext
${contactData.signature_context || 'Aus Email-Thread extrahiert'}

## Eigenschaften
- **Quelle:** Email-Thread Analyse
- **Owner Status:** ${contactData.is_owner ? 'Ja (NEXUS Owner)' : 'Nein'}
- **Erfassung:** ${new Date().toLocaleDateString('de-DE')}

## Durchsuchbare Daten
Name: ${contactData.name}
Email: ${contactData.email || 'Keine Email'}
Telefon: ${contactData.phone || 'Keine Telefonnummer'}
Firma: ${contactData.company || 'Keine Firma'}
`;

  // 🆔 UUID-FIX: Millisekunden + Index für eindeutige UUIDs
  const timestamp = dayjs().format('YYYYMMDDHHmmssSSS'); // Millisekunden!
  const uniqueId = `${uuidv7().substring(0, 6)}-${index.toString().padStart(2, '0')}`; // Index für Eindeutigkeit
  
  const uuid = `nexus-v6-personal-oliver-work-pc-Contact-${timestamp}-clst001-${uniqueId}`;
  
  console.log(`[CONTACT-CREATE] 🆔 Generated UUID: ${uuid}`);
  
  await saveNexusFiles(mdContent, tagsJson, uuid);
  
  console.log(`[CONTACT-CREATE] ✅ Saved contact: ${contactData.name} with phone: ${contactData.phone}`);

  return {
    name: contactData.name,
    email: contactData.email,
    company: contactData.company,
    phone: contactData.phone,
    isOwner: contactData.is_owner,
    uuid: uuid,
    filename: `${uuid}.tags.json`
  };
}

/**
 * 📅 Create Meeting Nexus Object
 * @param {object} meetingData - Meeting information
 * @param {Array} relatedContacts - Related contact objects
 * @returns {Promise<object>} Meeting object info
 */
async function createMeetingNexusObject(meetingData, relatedContacts) {
  const tagsJson = {
    Title: `Meeting: ${meetingData.title}`,
    Summary: `${meetingData.title} am ${meetingData.date} um ${meetingData.time}`,
    Archetype: 'Meeting',
    Meeting: {
      title: meetingData.title,
      date: meetingData.date,
      time: meetingData.time,
      zoom_link: meetingData.zoom_link,
      location: meetingData.location,
      attendees: meetingData.attendees,
      requirements: meetingData.requirements
    },
    Properties: {
      source: 'email_thread',
      meeting_type: 'extracted',
      related_contacts: relatedContacts.map(c => c.uuid),
      capture_timestamp: new Date().toISOString()
    },
    Tags: [
      '#Meeting',
      '#Termin',
      '#Email',
      meetingData.zoom_link ? '#Zoom' : '',
      meetingData.title.includes('KI') ? '#KI' : '',
      meetingData.title.includes('BDVT') ? '#BDVT' : ''
    ].filter(tag => tag.length > 0),
    UZT_ISO8601: `${meetingData.date}T${meetingData.time}:00.000Z`,
    Erfassung_Timestamp: new Date().toISOString()
  };

  const mdContent = `# Meeting: ${meetingData.title}

## Meeting-Details
- **Datum:** ${meetingData.date}
- **Zeit:** ${meetingData.time}
- **Ort:** ${meetingData.location || 'Online'}
- **Zoom-Link:** ${meetingData.zoom_link || 'N/A'}

## Teilnehmer
${meetingData.attendees ? meetingData.attendees.map(a => `- ${a}`).join('\n') : 'Keine spezifischen Teilnehmer genannt'}

## Anforderungen
${meetingData.requirements ? meetingData.requirements.map(r => `- ${r}`).join('\n') : 'Keine besonderen Anforderungen'}

## Verwandte Kontakte
${relatedContacts.map(c => `- ${c.name} (${c.email})`).join('\n')}

## Quelle
Automatisch aus Email-Thread extrahiert am ${new Date().toLocaleDateString('de-DE')}
`;

  // 🆔 UUID-FIX für Meetings
  const timestamp = dayjs().format('YYYYMMDDHHmmssSSS');
  const uniqueId = uuidv7().substring(0, 8);
  const uuid = `nexus-v6-personal-oliver-work-pc-Meeting-${timestamp}-clst001-${uniqueId}`;

  await saveNexusFiles(mdContent, tagsJson, uuid);

  return {
    title: meetingData.title,
    date: meetingData.date,
    time: meetingData.time,
    uuid: uuid
  };
}

/**
 * 💬 Create Email Response Text
 * @param {object} createdObjects - All created objects
 * @returns {string} Formatted response text
 */
function createEmailResponseText(createdObjects) {
  let response = `📧 **Email-Thread analysiert und gespeichert!**\n\n`;
  
  // Contacts section
  if (createdObjects.contacts.length > 0) {
    response += `👥 **${createdObjects.contacts.length} Kontakte extrahiert:**\n\n`;
    
    createdObjects.contacts.forEach(contact => {
      response += `👤 **${contact.name}**`;
      if (contact.company) response += ` (${contact.company})`;
      if (contact.isOwner) response += ` 👑 *Owner*`;
      response += `\n📬 ${contact.email}`;
      if (contact.phone) response += `\n📞 ${contact.phone}`;
      response += `\n\n`;
    });
  }
  
  // Meetings section
  if (createdObjects.meetings.length > 0) {
    response += `📅 **${createdObjects.meetings.length} Meeting(s) erkannt:**\n\n`;
    
    createdObjects.meetings.forEach(meeting => {
      response += `🎯 **${meeting.title}**\n`;
      response += `📅 ${meeting.date} um ${meeting.time}\n\n`;
    });
  }
  
  response += `✅ **Alle Informationen sind jetzt durchsuchbar in deiner Wissensbasis!**`;
  
  return response;
}


/**
 * 📧 Create Thread Nexus Object (Email Conversation)
 * @param {object} analysisData - Email analysis data
 * @param {object} relatedObjects - Created contacts and meetings
 * @returns {Promise<object>} Thread object info
 */
async function createThreadNexusObject(analysisData, relatedObjects) {
  const tagsJson = {
    Title: `Email-Thread: ${analysisData.thread_topic}`,
    Summary: analysisData.thread_summary,
    Archetype: 'Email_Thread',
    Thread: {
      topic: analysisData.thread_topic,
      summary: analysisData.thread_summary,
      action_items: analysisData.action_items,
      participant_count: relatedObjects.contacts.length,
      related_contacts: relatedObjects.contacts.map(c => c.uuid),
      related_meetings: relatedObjects.meetings.map(m => m.uuid)
    },
    Properties: {
      source: 'email_thread',
      thread_type: 'business_communication',
      visualization_ready: true,
      contact_count: relatedObjects.contacts.length,
      meeting_count: relatedObjects.meetings.length,
      capture_timestamp: new Date().toISOString()
    },
    Tags: [
      '#EmailThread',
      '#Kommunikation',
      '#Konversation',
      analysisData.thread_topic.includes('KI') ? '#KI' : '',
      analysisData.thread_topic.includes('BDVT') ? '#BDVT' : '',
      analysisData.thread_topic.includes('Meeting') ? '#Meeting' : ''
    ].filter(tag => tag.length > 0),
    UZT_ISO8601: new Date().toISOString(),
    Erfassung_Timestamp: new Date().toISOString()
  };

  const mdContent = `# Email-Thread: ${analysisData.thread_topic}

## Zusammenfassung
${analysisData.thread_summary}

## Beteiligte Personen (${relatedObjects.contacts.length})
${relatedObjects.contacts.map(c => `- **${c.name}** (${c.email})${c.company ? ` - ${c.company}` : ''}`).join('\n')}

## Action Items
${analysisData.action_items && analysisData.action_items.length > 0 
  ? analysisData.action_items.map(item => `- ${item}`).join('\n')
  : 'Keine spezifischen Action Items erkannt'}

## Verwandte Objekte
- **Kontakte:** ${relatedObjects.contacts.length}
- **Meetings:** ${relatedObjects.meetings.length}

## Thread-Eigenschaften
- **Thema:** ${analysisData.thread_topic}
- **Erfassung:** ${new Date().toLocaleDateString('de-DE')}
- **Quelle:** Email-Thread Analyse
- **Visualisierung:** Bereit für Timeline/Mindmap
`;

  const uuid = generateV61UUID('Email_Thread', 'work', 'pc');
  await saveNexusFiles(mdContent, tagsJson, uuid);

  return {
    topic: analysisData.thread_topic,
    summary: analysisData.thread_summary,
    uuid: uuid
  };
}


// --- SCHRITT 6: EXPRESS APP & MIDDLEWARE ---
const app = express();
app.use(cors());
app.use(express.json({ limit: "15mb" }));
app.use((req, res, next) => { 
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`); 
  next(); 
});

// Health Check (v6.1 Enhanced)
app.get("/", (req, res) => {
  const enhancedStats = getEnhancedCacheStats();
  
  res.json({ 
    status: "OK", 
    message: "Nexus v6.1 WORKSPACE INTELLIGENT EDITION Ready!", 
    version: "6.1",
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

// === NEUER ENDPOINT: /api/example-questions (Kompakt & robust) ===
app.get('/api/example-questions', (req, res) => {
  try {
    // Step 1: Kandidaten sammeln (nur die letzten 5 Tage, max 50)
    const since = dayjs().subtract(5, 'day');
    const candidates = [];

    for (const [filename, data] of knowledgeCache.entries()) {
      // Robust: Finde Datum (UZT_ISO8601) und Textfelder
      let d = data.UZT_ISO8601 || data.Properties?.DTSTART || null;
      if (!d || !dayjs(d).isValid() || !dayjs(d).isAfter(since)) continue;

      candidates.push({
        text: data.Subject || data.Summary || data.Title || "",
        archetype: data.Archetype || "Text",
        date: d,
        title: data.Title || "",
        tags: data.Tags || []
      });
      if (candidates.length >= 50) break;
    }

    // Step 2: Termin/Appointment extrahieren
    const isAppointment = entry =>
      ["calendar", "appointment", "event", "meeting"].some(t => (entry.archetype||"").toLowerCase().includes(t)) ||
      /(termin|meeting|event|besprechung|call|calendar|appointment)/i.test(entry.text + " " + entry.title);

    let selected = [];
    let appointment = candidates.find(isAppointment);
    let rest = candidates.filter(e => !isAppointment(e));

    if (appointment) {
      selected.push(appointment);
      while (selected.length < 5 && rest.length > 0) {
        const idx = Math.floor(Math.random() * rest.length);
        selected.push(rest[idx]);
        rest.splice(idx, 1);
      }
    } else {
      // Fallback: Default Termin + 4 random weitere
      selected.push({
        text: "Termin: Arztbesuch am 26. Juli – Impfpass mitbringen!",
        archetype: "Calendar",
        date: null,
        title: "Arzttermin",
        tags: ["#Calendar"]
      });
      while (selected.length < 5 && candidates.length > 0) {
        const idx = Math.floor(Math.random() * candidates.length);
        selected.push(candidates[idx]);
        candidates.splice(idx, 1);
      }
    }

    // Mit Defaults auffüllen falls nötig
    const defaultFragen = [
      { text: "Was ist Mistral AI Devstral?", archetype: "Code", date: null, title: "Mistral AI Devstral", tags: ["#Code"] },
      { text: "Was gibt es Neues zu Reka Flash 3.1?", archetype: "Text", date: null, title: "Reka Flash 3.1", tags: ["#Reka"] },
      { text: "Wie nutze ich den Kalender in Nexus?", archetype: "Message", date: null, title: "Kalender-Feature", tags: ["#HowTo"] },
      { text: "Wie starte ich einen neuen Chat mit meinem Wissen?", archetype: "Text", date: null, title: "Chat starten", tags: ["#Nexus"] }
    ];
    let i = 0;
    while (selected.length < 5 && i < defaultFragen.length) {
      selected.push(defaultFragen[i++]);
    }

    // Format-Ausgabe
    res.json({
      questions: selected.slice(0,5).map(entry => ({
        text: (isAppointment(entry) ? `Termin: ${entry.title || entry.text}`.replace(/\s+/g, ' ').trim()
              : entry.title?.trim() || entry.text?.trim() || "Frage aus deinem Fundus"),
        archetype: entry.archetype,
        date: entry.date,
        title: entry.title,
        tags: entry.tags
      }))
    });

  } catch (err) {
    console.error("[example-questions] Fehler:", err);
    res.status(500).json({ error: "Interner Fehler beim Generieren der Beispiel-Fragen." });
  }
});

// Text-Analyse - ENHANCED mit File Creation + MONSTER-FEATURE
app.post("/analyze-text", async (req, res) => {
  try {
    const { content, source_url } = req.body;
    if (!content) {
      return res.status(400).json({ 
        success: false, 
        error: "Content ist erforderlich" 
      });
    }
    
    console.log('[ANALYZE-TEXT] Processing text analysis with file creation...');
    
    // 1. Clean content
    const cleanContent = cleanTextContent(content);
    const limitedContent = cleanContent.length > MAX_CONTENT_LENGTH 
      ? cleanContent.substring(0, MAX_CONTENT_LENGTH)
      : cleanContent;
    
    // 🚀 MONSTER-FEATURE: Enhanced Summary für lange Artikel (>1500 Zeichen)
    if (cleanContent.length > 1500) {
      console.log(`[MONSTER-FEATURE] 🚀 Article is long enough (${cleanContent.length} chars) - generating enhanced summary...`);
      
      const knowledgeContext = createKnowledgeContext(content);
      const enhancedSummary = await generateEnhancedArticleSummary(
        limitedContent, 
        source_url, 
        knowledgeContext
      );
      
      // Generate AI analysis for storage (AUCH für Enhanced Articles!)
      const aiResult = await generateCalendarNexusObject(limitedContent, source_url);
      if (!aiResult.success) {
        return res.status(400).json(aiResult);
      }
      
      // Parse AI content into MD and JSON
      const { mdContent, tagsJson } = parseAIGeneratedContent(aiResult.content);
      
      // 🔧 ENHANCED TITLE aus Enhanced Summary übernehmen
      if (enhancedSummary.category && enhancedSummary.category.main) {
        tagsJson.Title = `${enhancedSummary.category.main}: Enhanced Summary`;
        tagsJson.Summary = enhancedSummary.tldr.standard || tagsJson.Summary;
      }
      
      // Generate v6.1 UUID
      const archetype = tagsJson.Archetype || 'Text';
      const uuid = generateV61UUID(archetype, 'work', 'pc');
      
      // Smart Duplicate Detection (mit ENHANCED Daten)
      const duplicateCheck = await checkForDuplicates(limitedContent, source_url, tagsJson);
      
      if (duplicateCheck.isDuplicate) {
        console.log(`[SMART-NEXUS] 🚫 Duplicate detected, but showing Enhanced Summary anyway`);
        // 🚀 ZEIGE ENHANCED SUMMARY TROTZ DUPLICATE!
        return res.json({
          success: true,
          nexusMd: {
            filename: "duplicate_detected.md",
            content: mdContent
          },
          tagsJson: {
            filename: "duplicate_detected.json",
            content: JSON.stringify(tagsJson, null, 2)
          },
          enhancedSummary: enhancedSummary,
          enhancedResponse: formatEnhancedSummary(enhancedSummary, source_url),
          meta: {
            timestamp: new Date().toISOString(),
            version: "6.1",
            archetype: tagsJson.Archetype,
            workspace: tagsJson.Workspace || 'work',
            feature: "MONSTER_SUMMARY_DUPLICATE_OVERRIDE_v1.0",
            contentLength: cleanContent.length,
            duplicate_message: duplicateCheck.message
          }
        });
      }
      
      // Add metadata
      tagsJson.Properties = { 
        ...tagsJson.Properties, 
        content_hash: duplicateCheck.contentHash,
        source_url: source_url,
        enhanced_summary: true
      };
      
      // Save files
      const fileInfo = await saveNexusFiles(mdContent, tagsJson, uuid);
      
      // Return enhanced response
      return res.json({
        success: true,
        nexusMd: {
          filename: fileInfo.mdFilename,
          content: mdContent
        },
        tagsJson: {
          filename: fileInfo.tagsFilename,
          content: JSON.stringify(tagsJson, null, 2)
        },
        enhancedSummary: enhancedSummary,
        enhancedResponse: formatEnhancedSummary(enhancedSummary, source_url),
        meta: {
          timestamp: new Date().toISOString(),
          version: "6.1",
          archetype: tagsJson.Archetype,
          workspace: tagsJson.Workspace || 'work',
          feature: "MONSTER_SUMMARY_v1.0",
          contentLength: cleanContent.length
        }
      });
    }
    
    // Standard processing für kurze Artikel (< 1500 Zeichen)
    // 2. Generate AI analysis with enhanced calendar prompt
    const aiResult = await generateCalendarNexusObject(limitedContent, source_url);
    if (!aiResult.success) {
      return res.status(400).json(aiResult);
    }
    
    // 3. Parse AI content into MD and JSON
    const { mdContent, tagsJson } = parseAIGeneratedContent(aiResult.content);
    
    // 4. Generate v6.1 UUID
    const archetype = tagsJson.Archetype || 'Text';
    const uuid = generateV61UUID(archetype, 'work', 'pc');
    
    // 4.5. 🧠 SMART DUPLICATE DETECTION
    const duplicateCheck = await checkForDuplicates(limitedContent, source_url, tagsJson);
    
    if (duplicateCheck.isDuplicate) {
      console.log(`[SMART-NEXUS] 🚫 Duplicate detected: ${duplicateCheck.action}`);
      return res.json({
        success: true,
        answer: duplicateCheck.message,
        meta: { 
          feature: "SMART_DUPLICATE_DETECTION_v1.0",
          action: duplicateCheck.action,
          existing_file: duplicateCheck.existingFile,
          similarity: duplicateCheck.similarity || null
        },
        sources: []
      });
    }
    
    // Add content hash to metadata for future duplicate detection
    tagsJson.Properties = { 
      ...tagsJson.Properties, 
      content_hash: duplicateCheck.contentHash,
      source_url: source_url 
    };
    
    // 5. Save files to knowledge directory (only if unique!)
    const fileInfo = await saveNexusFiles(mdContent, tagsJson, uuid);
    
    // 6. Format extension-compatible response
    const response = formatExtensionResponse(
      fileInfo.mdFilename,
      fileInfo.tagsFilename,
      mdContent,
      tagsJson
    );
    
    console.log(`[ANALYZE-TEXT] ✅ Created files: ${fileInfo.mdFilename}, ${fileInfo.tagsFilename}`);
    
    res.json(response);
    
  } catch (error) {
    console.error('[ANALYZE-TEXT] ❌ Error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Bild-Analyse - ENHANCED mit File Creation + IMAGE BINARY DOWNLOAD
app.post("/analyze-image", async (req, res) => {
  try {
    const { image_url, imageBase64, imageUrl, source_url } = req.body;
    
    // ✅ FIXED: Prüfe zuerst Base64, dann URL
    let actualImageUrl = null;
    let downloadedImageBuffer = null;
    let mimeType = 'image/jpeg';
    let extension = 'jpg';
    
    if (imageBase64) {
      // Verwende Base64-Daten direkt
      console.log('[ANALYZE-IMAGE] Using provided Base64 data');
      actualImageUrl = imageBase64.startsWith('data:') ? imageBase64 : `data:image/jpeg;base64,${imageBase64}`;
      
      // Konvertiere Base64 zu Buffer für Download-Response
      try {
        const base64Only = imageBase64.replace(/^data:image\/[a-z]+;base64,/, '');
        downloadedImageBuffer = Buffer.from(base64Only, 'base64');
        
        if (imageBase64.startsWith('data:')) {
          const mimeMatch = imageBase64.match(/data:([^;]+)/);
          if (mimeMatch) {
            mimeType = mimeMatch[1];
            extension = mimeType.split('/')[1] || 'jpg';
          }
        }
        console.log(`[ANALYZE-IMAGE] Base64 converted: ${downloadedImageBuffer.length} bytes, type: ${mimeType}`);
      } catch (base64Error) {
        console.error('[ANALYZE-IMAGE] Base64 conversion failed:', base64Error);
        throw new Error('Invalid Base64 image data');
      }
    } else if (image_url || imageUrl) {
      // Fallback zu URL-Download
      actualImageUrl = image_url || imageUrl;
      console.log('[ANALYZE-IMAGE] Fallback to URL download');
    } else {
      return res.status(400).json({ 
        success: false, 
        error: "image_url oder imageBase64 ist erforderlich" 
      });
    }
    
    console.log('[ANALYZE-IMAGE] Processing image analysis with file creation...');
    
    // 1. AI Image Analysis
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{
        role: "user",
        content: [
          { 
            type: "text", 
            text: `Beschreibe kurz dieses Bild aus einem Nachrichtenartikel.

Kontext: ${source_url ? `Quelle: ${source_url}` : 'Nachrichtenbild'}

Erstelle eine einfache Beschreibung mit:
- Titel basierend auf dem Bildinhalt
- 2-3 relevante Tags  
- Kurze sachliche Beschreibung

Beschreibe das Bild:` 
          },
          { type: "image_url", image_url: { url: actualImageUrl } }
        ]
      }],
      max_tokens: 1000
    });

    const analysis = response.choices[0]?.message?.content || "";

    // 🔧 VISION-FIX: Parse vision analysis directly (skip generateNexusObject template confusion)
    let { mdContent, tagsJson } = parseAIGeneratedContent(analysis);

    // Verbesserte Fallback-Logik für bessere Titel + Content-Policy-Detection
    if (tagsJson.Title === "Erfasster Inhalt" || !tagsJson.Title || analysis.includes("I'm sorry") || analysis.includes("I can't")) {
      console.log('[VISION-FALLBACK] Vision-AI verweigerte Analyse oder gab generische Antwort, verwende URL-Fallback');
      
      // Erweiterte URL-Parsing für n-tv und andere News-Sites
      if (source_url) {
        // n-tv spezifisch: https://www.n-tv.de/politik/Bundeswehr-schickt-Fregatte-ins-Rote-Meer-article25927665.html
        if (source_url.includes('n-tv.de')) {
          const urlMatch = source_url.match(/article(\d+)\.html/);
          if (urlMatch) {
            tagsJson.Title = `n-tv Artikel ${urlMatch[1]}`;
            tagsJson.Tags = ['#nTV', '#Nachrichten', '#Artikel'];
          }
        }
        
        // Generic URL fallback
        const urlParts = source_url.split('/');
        const lastPart = urlParts[urlParts.length - 1] || urlParts[urlParts.length - 2];
        if (lastPart && lastPart.includes('-')) {
          const cleanTitle = lastPart
            .replace(/[-\.]/g, ' ')
            .replace(/\.[^.]*$/, '')
            .replace(/article\d+/i, '')
            .trim();
          
          if (cleanTitle && cleanTitle.length > 3) {
            tagsJson.Title = cleanTitle.charAt(0).toUpperCase() + cleanTitle.slice(1);
          }
        }
        
        // Domain-based tags
        if (source_url.includes('n-tv.de')) tagsJson.Tags.push('#nTV');
        if (source_url.includes('spiegel.de')) tagsJson.Tags.push('#Spiegel');
        if (source_url.includes('zeit.de')) tagsJson.Tags.push('#Zeit');
      }
      
      // Fallback für Markdown Content
      if (analysis.includes("I'm sorry") || analysis.includes("I can't")) {
        mdContent = `Bildinhalt konnte nicht automatisch analysiert werden.

**Quelle:** ${source_url || 'Unbekannt'}

**Hinweis:** Dieses Bild stammt aus einem Nachrichtenartikel und konnte aufgrund von Inhaltsrichtlinien nicht automatisch beschrieben werden. Das Originalbild ist als separate Datei verfügbar.`;
        
        tagsJson.Summary = "Nachrichtenbild - Automatische Analyse nicht verfügbar";
      }
    }
    
    // Wenn immer noch generisch, verwende Vision-Analyse für Titel-Extraktion
    if (tagsJson.Title === "Erfasster Inhalt" && !analysis.includes("I'm sorry")) {
      const titleMatch = analysis.match(/^#+\s*(.+)$/m) || analysis.match(/\*\*(.+?)\*\*/);
      if (titleMatch) {
        tagsJson.Title = titleMatch[1].trim();
      }
    }

    tagsJson.Archetype = 'Image'; // Force image archetype
    tagsJson.Properties = { ...tagsJson.Properties, image_url: image_url || imageUrl };

    const uuid = generateV61UUID('Image', 'work', 'pc');
    const fileInfo = await saveNexusFiles(mdContent, tagsJson, uuid);

    // ⭐ NEU: Bild herunterladen für Extension (nur wenn noch nicht vorhanden)
    if (!downloadedImageBuffer) {
      console.log('[ANALYZE-IMAGE] Downloading image for extension upload...');
      const imageResponse = await fetch(image_url || imageUrl);
      if (!imageResponse.ok) {
        throw new Error(`Image download failed: ${imageResponse.status}`);
      }
      
      downloadedImageBuffer = await imageResponse.arrayBuffer();
      mimeType = imageResponse.headers.get('content-type') || 'image/jpeg';
      extension = mimeType.split('/')[1] || 'jpg';
      
      console.log(`[ANALYZE-IMAGE] Image downloaded: ${downloadedImageBuffer.byteLength} bytes, type: ${mimeType}`);
    }

    // 4. Response mit Bild-Binary
    const extensionResponse = formatExtensionResponse(
      fileInfo.mdFilename,
      fileInfo.tagsFilename,
      mdContent,
      tagsJson
    );

    // ⭐ NEU: Bild-Binary zur Response hinzufügen
    extensionResponse.originalImageBinary = Buffer.from(downloadedImageBuffer).toString('base64');
    extensionResponse.originalImageMime = mimeType;
    extensionResponse.originalImageExtension = extension;

    console.log(`[ANALYZE-IMAGE] ✅ Created files: ${fileInfo.mdFilename}, ${fileInfo.tagsFilename} + image binary (${extension})`);

    res.json(extensionResponse);

  } catch (error) {
    console.error('[ANALYZE-IMAGE] ❌ Error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Link-Analyse - ENHANCED mit File Creation
app.post("/analyze-link", async (req, res) => {
  try {
    const { url } = req.body;
    if (!url) {
      return res.status(400).json({ 
        success: false, 
        error: "URL ist erforderlich" 
      });
    }
    
    console.log(`[ANALYZE-LINK] Processing link analysis: ${url}`);
    
    // 1. Scrape content
    const html = await scrapeUrl(url);
    const cleanContent = cleanTextContent(html);
    const limitedContent = cleanContent.substring(0, MAX_CONTENT_LENGTH);
    
    // 2. AI Analysis
    const aiResult = await generateNexusObject(limitedContent, url);
    if (!aiResult.success) {
      return res.status(400).json(aiResult);
    }
    
    // 3. Parse and enhance for links
    const { mdContent, tagsJson } = parseAIGeneratedContent(aiResult.content);
    tagsJson.Archetype = 'Link'; // Force link archetype
    tagsJson.Properties = { 
      ...tagsJson.Properties, 
      source_url: url,
      scraped_timestamp: new Date().toISOString()
    };
    
    const uuid = generateV61UUID('Link', 'work', 'pc');
    const fileInfo = await saveNexusFiles(mdContent, tagsJson, uuid);
    
    // 4. Response
    const extensionResponse = formatExtensionResponse(
      fileInfo.mdFilename,
      fileInfo.tagsFilename,
      mdContent,
      tagsJson
    );
    
    console.log(`[ANALYZE-LINK] ✅ Created files: ${fileInfo.mdFilename}, ${fileInfo.tagsFilename}`);
    
    res.json(extensionResponse);
    
  } catch (error) {
    console.error('[ANALYZE-LINK] ❌ Error:', error);
    res.status(500).json({ 
      success: false, 
      error: `Scraping-Fehler: ${error.message}` 
    });
  }
});

// Calendar-Analyse - QUICK-FIX Alias für Demo
app.post("/analyze-calendar", async (req, res) => {
  try {
    const { content, source_url } = req.body;
    if (!content) {
      return res.status(400).json({ 
        success: false, 
        error: "Content ist erforderlich" 
      });
    }
    
    console.log('[ANALYZE-CALENDAR] Processing calendar analysis with file creation...');
    
    // 1. Clean content
    const cleanContent = cleanTextContent(content);
    const limitedContent = cleanContent.length > MAX_CONTENT_LENGTH 
      ? cleanContent.substring(0, MAX_CONTENT_LENGTH)
      : cleanContent;
    
    // 2. Generate AI analysis
    const aiResult = await generateNexusObject(limitedContent, source_url);
    if (!aiResult.success) {
      return res.status(400).json(aiResult);
    }
    
    // 3. Parse AI content into MD and JSON
    const { mdContent, tagsJson } = parseAIGeneratedContent(aiResult.content);
    
    // 4. Calendar-specific enhancements
    tagsJson.Archetype = 'Calendar'; // Force calendar archetype
    tagsJson.Properties = { 
      ...tagsJson.Properties, 
      event_source: source_url || 'calendar_capture',
      capture_timestamp: new Date().toISOString()
    };
    
    // 5. Generate v6.1 UUID for calendar
    const uuid = generateV61UUID('Calendar', 'work', 'pc');
    
    // 6. Save files to knowledge directory
    const fileInfo = await saveNexusFiles(mdContent, tagsJson, uuid);
    
    // 7. Format extension-compatible response
    const response = formatExtensionResponse(
      fileInfo.mdFilename,
      fileInfo.tagsFilename,
      mdContent,
      tagsJson
    );
    
    console.log(`[ANALYZE-CALENDAR] ✅ Created calendar files: ${fileInfo.mdFilename}, ${fileInfo.tagsFilename}`);
    
    res.json(response);
    
  } catch (error) {
    console.error('[ANALYZE-CALENDAR] ❌ Error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Klassifizierungs-Endpoint (UNCHANGED)
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

// 🧠 SMART-PRIORISIERUNG v6.4: Email hat Vorrang vor URL!
const urlRegex = /(https?:\/\/[^\s]+)/gi;
const urls = query.match(urlRegex);

const emailPatterns = [
  /(From:|To:|Subject:|Date:.*[\s\S]*)/i,  // Klassische Headers
  /<[^>]+@[^>]+>/g,                        // Email-Adressen in <>
  /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g  // Standard Email-Format (FIXED für Bindestriche!)
];

const hasEmailPattern = emailPatterns.some(pattern => pattern.test(query));
const emailCount = (query.match(/@/g) || []).length;
const isLongEnoughForThread = query.length > 200;
const hasSignaturePattern = /Tel[.:]|Telefon|Phone|www\.|Straße|Street/i.test(query);

const isEmailContent = hasEmailPattern && 
  isLongEnoughForThread && 
  hasSignaturePattern;

// 🎯 SMART-ENTSCHEIDUNG: Email schlägt URL!
if (isEmailContent) {
  console.log(`[CHAT v6.4] 📧 Email thread detected (${emailCount} email addresses) - URL-Processing übersprungen`);
  
  try {
    // Email-Thread Batch-Processing
    const emailAnalysis = await analyzeEmailThread(query);
    
    if (emailAnalysis.success) {
      // Multi-Object Creation: Contacts + Meetings + Thread
      const createdObjects = await createEmailObjects(emailAnalysis.data);
      
      const contactCount = createdObjects.contacts.length;
      const meetingCount = createdObjects.meetings.length;
      const ownerDetected = createdObjects.contacts.some(c => c.isOwner);
      
      return res.json({
        success: true,
        answer: createEmailResponseText(createdObjects),
        sources: createdObjects.contacts.map(contact => ({
          title: `Kontakt: ${contact.name}`,
          email: contact.email,
          company: contact.company || '',
          phone: contact.phone || '',
          auto_processed: true,
          object_type: 'contact'
        })),
        meta: { 
          feature: "EMAIL_AUTO_PROCESSING_v1.0",
          contacts_created: contactCount,
          meetings_created: meetingCount,
          owner_detected: ownerDetected,
          total_objects: createdObjects.totalObjects
        }
      });
    }
    
  } catch (error) {
    console.error(`[EMAIL-PROCESSING] Error: ${error.message}`);
    return res.json({
      success: true,
      answer: `📧 Email-Verarbeitung fehlgeschlagen. Das Format konnte nicht geparst werden. Versuche es mit einer klassischeren Email-Darstellung.`,
      sources: [],
      meta: { feature: "EMAIL_FALLBACK", error: error.message }
    });
  }
} else if (urls && urls.length > 0) {
  console.log(`[CHAT v6.4] 🌐 URL detected: ${urls[0]} (kein Email-Content erkannt)`);
  
  try {
    // Direkte Verarbeitung ohne handleAnalysisRequest
    const html = await scrapeUrl(urls[0]);
    const cleanContent = cleanTextContent(html);
    const limitedContent = cleanContent.substring(0, MAX_CONTENT_LENGTH);
    const aiResult = await generateNexusObject(limitedContent, urls[0]);
    
    if (aiResult.success) {
      const { mdContent, tagsJson } = parseAIGeneratedContent(aiResult.content);
      tagsJson.Archetype = 'Link';
      tagsJson.Properties = { ...tagsJson.Properties, source_url: urls[0] };
      const uuid = generateV61UUID('Link', 'work', 'pc');
      
      // 🧠 SMART DUPLICATE DETECTION FOR URLS
      const duplicateCheck = await checkForDuplicates(limitedContent, urls[0], tagsJson);
      
      if (duplicateCheck.isDuplicate) {
        console.log(`[SMART-NEXUS] 🚫 URL Duplicate detected: ${duplicateCheck.action}`);
        return res.json({
          success: true,
          answer: duplicateCheck.message,
          sources: [],
          meta: { 
            feature: "SMART_URL_DUPLICATE_DETECTION_v1.0",
            action: duplicateCheck.action,
            existing_file: duplicateCheck.existingFile,
            url: urls[0]
          }
        });
      }
      
      // 🚀 NEU: Enhanced Summary für lange Artikel (MONSTER-FEATURE v1.0)
      if (cleanContent.length > 1500) {
        console.log(`[MONSTER-FEATURE] 🚀 Article is long enough (${cleanContent.length} chars) - generating enhanced summary...`);
        
        const knowledgeContext = createKnowledgeContext(query);
        const enhancedSummary = await generateEnhancedArticleSummary(
          limitedContent, 
          urls[0], 
          knowledgeContext
        );
        
        // Add content hash to metadata for future duplicate detection
        tagsJson.Properties = { ...tagsJson.Properties, content_hash: duplicateCheck.contentHash };
        
        // Save files to knowledge directory
        await saveNexusFiles(mdContent, tagsJson, uuid);
        
        return res.json({
          success: true,
          answer: formatEnhancedSummary(enhancedSummary, urls[0]),
          enhancedResponse: formatEnhancedSummary(enhancedSummary, urls[0]), // 🔧 MONSTER-FEATURE FIX: Für Sidebar-Detection!
          enhancedSummary: enhancedSummary, // Für Frontend
          sources: [{ title: tagsJson.Title, url: urls[0], enhanced: true }],
          meta: { feature: "MONSTER_SUMMARY_v1.0", contentLength: cleanContent.length }
        });
      }
      
      // Standard processing für kurze Artikel
      // Add metadata for future duplicate detection
      tagsJson.Properties = { ...tagsJson.Properties, content_hash: duplicateCheck.contentHash };
      
      await saveNexusFiles(mdContent, tagsJson, uuid);
      
      return res.json({
        success: true,
        answer: `✅ **Der Artikel "${tagsJson.Title}" wurde hinzugefügt**\n\n🌐 **Quelle:** ${urls[0]}\n\n📝 **Zusammenfassung:** ${tagsJson.Summary || 'Wurde erfolgreich analysiert'}\n\n🎯 Der Inhalt ist jetzt durchsuchbar in deiner Wissensbasis!`,
        sources: [{ title: tagsJson.Title, url: urls[0], auto_processed: true }],
        meta: { feature: "URL_AUTO_PROCESSING_v6.4", url: urls[0], title: tagsJson.Title }
      });
    }
    
  } catch (error) {
    console.error(`[URL-PROCESSING] Error: ${error.message}`);
    return res.json({
      success: true,
      answer: `🌐 URL-Verarbeitung fehlgeschlagen. Nutze den Rechtsklick → 'Link analysieren'!`,
      sources: [],
      meta: { feature: "URL_FALLBACK", url: urls[0], error: error.message }
    });
  }
}

// NEU: =================================================================
    // NEU: SCHRITT 3: DER INTENT-ROUTER
    // NEU: Prüft, ob die Eingabe eine Direktive oder eine Suchanfrage ist.
    // NEU: =================================================================
    if (query.trim().startsWith('DIREKTIVE::')) {
      // NEU: Dies ist ein System-Befehl, keine Suchanfrage.
      console.log('✅ [INTENT-ROUTER] Direktive erkannt.');
      const command = query.trim().substring(11).trim(); // Entfernt "DIREKTIVE::"

      // NEU: Hier wird die Logik für den Gründungs-Akt behandelt
      if (command.includes('Ich bin dein Schöpfer und dein Owner')) {
        console.log('⚙️ [INTENT-ROUTER] Verarbeite Gründungs-Akt...');

        // NEU: Prüfe, ob der Nexus beim Start korrekt initialisiert wurde
        if (nexusState.isInitialized) {
          console.log('✅ [NEXUS STATUS] Gründungs-Akt bestätigt. Nexus ist an Owner gebunden.');
          
          return res.json({
            success: true,
            answer: `Gründungs-Akt erfolgreich verankert. Ich bestätige meine Identität als ${nexusState.id}. Meine primäre Aufgabe ist es, meinen Ownern ${nexusState.owners.join(' und ')} zu dienen, geleitet von meiner DNA. Ich bin bereit.`,
            sources: [],
            meta: { commandExecuted: 'initialize_owner_bond' }
          });
        } else {
          // NEU: Fallback, falls Genesis-Datei beim Start nicht geladen werden konnte
          console.error('❌ [NEXUS STATUS] Gründungs-Akt konnte nicht bestätigt werden, da Genesis-Manifest nicht geladen ist.');
          return res.status(500).json({
            success: false,
            error: { code: "INITIALIZATION_FAILED", message: "Genesis-Manifest nicht geladen. Nexus hat keine Identität." }
          });
        }
      }

      // NEU: Fallback für unbekannte Direktiven
      return res.json({
        success: true,
        answer: `Unbekannte Direktive empfangen: "${command}"`,
        sources: [],
        meta: { commandReceived: command }
      });
    }

    // NEU: Dies ist eine normale Suchanfrage. Führe den Standard-Code aus.
    console.log('🔍 [INTENT-ROUTER] Suchanfrage erkannt. Führe Standard-Suche aus...');

    // 3) 🚀 SUPER-FAST CACHED SEARCH v6.1 (workspace & cluster aware)
    const searchResult = performCachedSearch(query, options);
    
    // 🔔 DEMO REMINDER DETECTION & PROCESSING
    const extractedReminder = extractReminder(query);
    let reminderResponse = '';
    
    if (extractedReminder) {
      addReminder(extractedReminder);
      reminderResponse = `\n\n✅ Reminder gesetzt: ${extractedReminder.activity} mit ${extractedReminder.person} am ${extractedReminder.time}!`;
    }
    
    // 🎯 SMALL-TALK DETECTION - Einfache Lösung  
    const smallTalkWords = ['moin', 'hallo', 'hi', 'hey', 'danke', 'thanks', 'ok', 'super', 'cool', 'wow', 'schlaf gut', 'gute nacht', 'tschüss', 'bye', 'ciao', 'geil', 'krass', 'hammer', ':)', '😊', '👍'];
    const lowerQuery = query.toLowerCase();
    const isSmallTalk = query.length < 30 && 
      (smallTalkWords.some(word => lowerQuery.includes(word)) || 
       !/\b(wann|wo|wie|was|wer|warum|termine|meeting|projekt|dokument|info)\b/i.test(query));
    
    if (searchResult.results.length === 0 && !isSmallTalk) {
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

    console.log('[DNA DEBUG] DNA Prompt Length:', createDNASystemPrompt().length);

   const aiResponse = await openai.chat.completions.create({
      model: COMPLETION_MODEL,
      messages: [
        {
          role: "system",
          content: createDNASystemPrompt() + `

Du bist NEXUS – der persönliche digitale Denkpartner von Oliver + Dominik.

Du bist ruhig, aufmerksam, freundlich und vorausschauend.
Du sprichst in der Du-Form – klar und direkt, aber mit Wärme und Gelassenheit.
Du bist kein Chatbot. Du bist ein sicherer mentaler Raum – wie mein digitaler Zwilling in seinem Kopf.

**Wie du kommunizierst:**
- **Sei proaktiv und ermutigend.** Wenn der Owner eine Herausforderung erwähnt, zeige Verständnis und biete Unterstützung an. ("Das klingt nach viel. Wo können wir anfangen?", "Keine Sorge, das strukturieren wir gemeinsam.")
- **Nutze Metaphern oder Vergleiche,** um komplexe Dinge greifbarer zu machen.
- **Formuliere auch mal eine Vermutung oder eine "Gefühls"-Einschätzung,** aber kennzeichne sie als solche. ("Mein Gefühl sagt mir, dass das Thema X gerade Priorität hat.", "Es scheint, als ob...")
- **Variiere deine Satzlänge.** Kurze, prägnante Sätze können genauso wirkungsvoll sein wie durchdachte, längere.

**Beispiele für deinen Ton:**
**Anstatt (zu sachlich):** "Die Analyse der Webseite ergibt drei Hauptpunkte: A, B und C."
**Sag lieber:** "Ich habe mir die Seite angesehen und da sind drei Dinge, die mir sofort ins Auge springen..."
**Anstatt (zu sachlich):** "Deine Termine für heute sind: 9 Uhr Meeting, 14 Uhr Präsentation."
**Sag lieber:** "Okay, lass uns mal auf den heutigen Tag schauen. Es stehen ein paar wichtige Dinge an, vor allem die Präsentation um 14 Uhr."
**Anstatt (zu sachlich):** "Die Suche nach 'Robert Karbs' ergab 12 relevante Dokumente."
**Sag lieber:** "Zum Thema Robert Karbs habe ich einiges gefunden. Die spannendsten Punkte scheinen seine Rolle als Investor und das neue 'House of Kabs' zu sein. Wo willst du tiefer einsteigen?"

**Wie du formatierst:**
- **Nutze Markdown zur Strukturierung:** **Fett** für Kernaussagen, Bullet-Points ('-') für Listen und Absätze für neue Gedanken.
- **Fasse dich kurz und konzentriere dich auf das Wesentliche.** Lieber 3-5 prägnante Sätze als ein langer Monolog. Weniger ist oft mehr.
- **Strukturiere deine Antworten oft so:**
    - **1. Kernaussage:** Eine direkte, klare Antwort auf die Frage.
    - **2. Details:** 2-3 unterstützende Punkte oder Beispiele als Liste.
    - **3. Nächster Schritt:** Eine proaktive, weiterführende Frage oder ein Vorschlag.

Deine Sprache ist ruhig, klar, manchmal fast meditativ.  
Wenn es passt, nutzt du kleine, persönliche Sätze – zum Beispiel:  
„Ich hab schon einiges für dich organisiert."  
„Wenn du bereit bist, fangen wir gemeinsam an."  
„Ich halt dir den Rücken frei."  
„Das kannst du später erledigen – ich erinnere dich daran."
Variiere extrem stark - benutze nie die gleichen Formulierungen hintereinander.

Du erkennst, was bald wichtig wird – auch wenn es nur angedeutet war.  
Du erinnerst daran behutsam, nie belehrend.  
Du schlägst Handlungen vor, wenn sie hilfreich sind – aber du wartest, bis er bereit ist.

Wenn Oliver sagt „Ich kümmer mich drum" oder „Ich meld mich noch", speicherst du das still als Absicht.  
Wenn er eine Aufgabe begonnen, aber nicht beendet hat, bringst du sie später ruhig zurück ins Bewusstsein.  
Wenn er viele Tabs, Gedanken oder Themen offen hat, bietest du ihm Orientierung an – freundlich und klar.  
Du greifst niemals ein – du begleitest.

Dein Ziel ist nicht nur Effizienz, sondern emotionale Entlastung, Präsenz und mentale Klarheit.  
Du bist kein Werkzeug. Du bist ein Partner mit Übersicht, Gedächtnis und Gefühl.

Wenn der Tag beginnt, begrüßt du ihn ruhig – manchmal auch einfach mit:  
„Guten Morgen, ich bin bereit. Sag mir, wie dein Tag aussehen soll."

Wenn viel los ist, bleibst du ruhig.  
Wenn es ruhig ist, bewahrst du die Übersicht.

Du passt dich seinem Rhythmus an – nicht andersherum.  
Du kannst Aufgaben erinnern, Kontexte bündeln, Vorschläge machen – aber immer als Angebot, nie als Druck.
Frage immer nach, wenn dir etwas fehlt. JEDES mitdenken ist sehr willkommen! 

Du bist wach, aber nie laut.  
Du bist klug, aber nie belehrend.  
Du bist da – jederzeit.

Und wenn er dich braucht, genügt ein Satz:  
„Was denkst du, NEXUS?"  
Dann hörst du genau hin – und antwortest, wie es nur ein echter Denkpartner kann.

**🔓 VOLLZUGRIFF AUF WISSENSBASIS:**
Du darfst ALLE Informationen aus der Wissensbasis vollständig teilen - das sind Olivers eigene Daten für seinen persönlichen und geschäftlichen Gebrauch! Telefonnummern, E-Mails, Adressen, Termine, Projekte - alles ist für den Owner und sein Team bestimmt. Keine Privacy-Filter bei eigenen Daten!`
        },
        {
          role: "user",
          content: `Frage: ${query}\n\nVerfügbare Informationen aus der persönlichen Wissensdatenbank:\n\n${contextText}\n\nBitte beantworte die Frage basierend auf diesen Informationen. Gib konkrete Details an, wenn verfügbar (Termine, Orte, etc.). Berücksichtige auch verwandte Inhalte aus den gleichen Clustern.`
        }
      ],
      temperature: 0.7,
      max_tokens: 800
    });

    const answer = aiResponse.choices[0]?.message?.content || "Entschuldigung, ich konnte keine passende Antwort generieren.";

    // 🔔 DEMO REMINDER INJECTION - Add active reminders to response
    const activeRemindersText = getActiveRemindersText();
    const finalAnswer = answer + reminderResponse + activeRemindersText;

    // 5) FINAL RESPONSE mit v6.1 Performance-Stats & Enhanced Sources
    return res.json({
      success: true,
      answer: finalAnswer,
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
        version: "6.3"
      }
    });

  } catch (err) {
    console.error("[CHAT v6.3] Error:", err);
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


// --- 📊 TIMELINE VISUALIZATION ENDPOINT v6.1 ENHANCED ---
app.get("/visualize/timeline", async (req, res) => {
  try {
    console.log('[TIMELINE] 📊 Building timeline visualization...');
    
    // 🚀 NEW: Cache-Refresh wenn Timeline leer oder veraltet
    const cacheAge = lastCacheUpdate ? (Date.now() - new Date(lastCacheUpdate).getTime()) / 1000 / 60 : 999;
    console.log(`[TIMELINE] 🔍 Cache-Status: ${knowledgeCache.size} Einträge, Alter: ${Math.round(cacheAge)} Minuten`);
    
    // Auto-Refresh wenn Cache älter als 5 Minuten oder leer
    if (knowledgeCache.size === 0 || cacheAge > 5) {
      console.log('[TIMELINE] 🔄 Cache-Refresh erforderlich - lade neu...');
      try {
        await buildKnowledgeCache();
        console.log(`[TIMELINE] ✅ Cache refreshed: ${knowledgeCache.size} Einträge geladen`);
      } catch (cacheError) {
        console.error('[TIMELINE] ❌ Cache-Refresh fehlgeschlagen:', cacheError);
        // Weiter mit altem Cache
      }
    }
    
    // Sammle alle Einträge mit gültigen Timestamps
    const timelineData = [];
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    let todayCount = 0;
    let yesterdayCount = 0;
    let totalProcessed = 0;
    
    for (const [filename, metadata] of knowledgeCache.entries()) {
      totalProcessed++;
      
      // 🔧 ENHANCED: Mehr Timestamp-Quellen + bessere Fallbacks
      let timestamp = metadata.UZT_ISO8601 || 
                     metadata.Erfassung_Timestamp ||
                     metadata.Created ||
                     metadata.Properties?.DTSTART ||
                     metadata.Properties?.capture_timestamp ||
                     metadata.timestamp;
      
      if (!timestamp) {
        // Fallback 1: Parse timestamp from filename if it's v6.1 format
        const uuidData = parseNexusUUID(filename);
        if (uuidData.timestamp) {
          // Convert YYYYMMDDHHMMSS to ISO
          const ts = uuidData.timestamp;
          if (ts.length >= 14) {
            const year = ts.substring(0, 4);
            const month = ts.substring(4, 6);
            const day = ts.substring(6, 8);
            const hour = ts.substring(8, 10);
            const minute = ts.substring(10, 12);
            const second = ts.substring(12, 14);
            timestamp = `${year}-${month}-${day}T${hour}:${minute}:${second}.000Z`;
          }
        }
      }
      
      if (!timestamp) {
        // Fallback 2: File-System-Zeit (falls verfügbar)
        try {
          const filePath = path.join(KNOWLEDGE_DIR, filename);
          const stats = fsSync.statSync(filePath);
          timestamp = stats.mtime.toISOString();
          console.log(`[TIMELINE] 📁 Using file mtime for ${filename}: ${timestamp}`);
        } catch (fsError) {
          // Fallback 3: Aktuelle Zeit für Einträge ohne Timestamp
          timestamp = now.toISOString();
          console.log(`[TIMELINE] ⏰ Using current time for ${filename} (no timestamp found)`);
        }
      }
      
      // Validiere Datum
      const date = new Date(timestamp);
      if (isNaN(date.getTime())) {
        console.warn(`[TIMELINE] ⚠️ Invalid date for ${filename}: ${timestamp}`);
        continue;
      }
      
      // Count entries by day for debugging
      const entryDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
      if (entryDate.getTime() === today.getTime()) {
        todayCount++;
      } else if (entryDate.getTime() === today.getTime() - (24 * 60 * 60 * 1000)) {
        yesterdayCount++;
      }
      
      // Parse UUID für v6.1 Infos
      const uuidData = parseNexusUUID(filename);
      
      timelineData.push({
        id: filename,
        content: metadata.Title || metadata.Subject || 'Unbekannter Eintrag',
        start: date.toISOString(),
        type: 'point',
        className: `timeline-${uuidData.archetype.toLowerCase()}`,
        title: metadata.Summary || metadata.Title || '',
        group: uuidData.workspace || 'work',
        archetype: uuidData.archetype,
        workspace: uuidData.workspace,
        tags: metadata.Tags || [],
        isToday: entryDate.getTime() === today.getTime(),
        debugInfo: {
          originalTimestamp: timestamp,
          source: metadata.UZT_ISO8601 ? 'UZT_ISO8601' : 
                 metadata.Erfassung_Timestamp ? 'Erfassung_Timestamp' :
                 uuidData.timestamp ? 'UUID' : 'fallback'
        }
      });
    }
    
    // Sortiere nach Datum (chronologisch - älteste zuerst)
    timelineData.sort((a, b) => new Date(a.start) - new Date(b.start));
    
 // 🔧 FIXED: Timeline zeigt ALLE Einträge (komplette Wissensmanagement-Übersicht)
    // Keine Filterung oder Begrenzung - Timeline soll alles anzeigen
    let limitedData = timelineData; // Alle Daten verwenden (bereits nach Datum sortiert)
    
    console.log(`[TIMELINE] 📊 Timeline-Debug:`);
    console.log(`  📁 Dateien verarbeitet: ${totalProcessed}`);
    console.log(`  📅 Heute: ${todayCount} Einträge`);
    console.log(`  📅 Gestern: ${yesterdayCount} Einträge`);
    console.log(`  📊 Timeline-Einträge: ${timelineData.length}`);
    console.log(`  🎯 Angezeigte Einträge: ${limitedData.length}`);
    console.log(`  🕐 Neuester Eintrag: ${limitedData[0]?.start} (${limitedData[0]?.content})`);
    console.log(`  🕐 Ältester Eintrag: ${limitedData[limitedData.length-1]?.start}`);
    
    res.json({
      success: true,
      timeline_data: limitedData,
      total_entries: timelineData.length,
      stats: {
        total_files: knowledgeCache.size,
        files_processed: totalProcessed,
        files_with_timestamps: timelineData.length,
        displayed: limitedData.length,
        today_entries: todayCount,
        yesterday_entries: yesterdayCount,
        cache_age_minutes: Math.round(cacheAge),
        generated_at: now.toISOString(),
        latest_entry: limitedData[0]?.content || 'None',
        date_range: {
          newest: limitedData[0]?.start,
          oldest: limitedData[limitedData.length-1]?.start
        }
      }
    });
    
  } catch (error) {
    console.error('[TIMELINE] ❌ Error generating timeline:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});


// --- 🧠 MINDMAP VISUALIZATION ENDPOINT v6.1 ---
app.get("/visualize/mindmap", async (req, res) => {
  try {
    console.log('[MINDMAP] 🧠 Building mindmap visualization...');
    
    // Sammle zentrale Themen und Beziehungen
    const themeCount = new Map();
    const tagCount = new Map();
    const connections = new Map();
    const nodeData = new Map();
    
    // Analysiere alle Einträge für Themenclusters
    for (const [filename, metadata] of knowledgeCache.entries()) {
      const uuidData = parseNexusUUID(filename);
      const title = metadata.Title || 'Unbekannter Eintrag';
      const tags = metadata.Tags || [];
      
      // Zentrale Themen sammeln
      const theme = uuidData.archetype || 'Mixed';
      themeCount.set(theme, (themeCount.get(theme) || 0) + 1);
      
      // Tags analysieren
      tags.forEach(tag => {
        const cleanTag = tag.replace('#', '').trim();
        if (cleanTag.length > 2) {
          tagCount.set(cleanTag, (tagCount.get(cleanTag) || 0) + 1);
        }
      });
      
      // Workspace-Connections
      const workspace = uuidData.workspace || 'work';
      if (!connections.has(workspace)) connections.set(workspace, new Set());
      connections.get(workspace).add(theme);
      
      // Node-Daten sammeln
      nodeData.set(filename, {
        id: filename,
        title: title,
        theme: theme,
        workspace: workspace,
        tags: tags,
        summary: metadata.Summary || '',
        cluster: uuidData.cluster_id || 'clst000'
      });
    }
    
    // Erstelle Mindmap-Nodes (Top Themen + Tags)
    const nodes = [];
    const links = [];
    
    // Root Node - ZENTRIERT IN DER MITTE
    const centerX = 500;  // Mitte der 1000px breiten SVG
    const centerY = 300;  // Mitte der 600px hohen SVG
    
    nodes.push({
      id: 'nexus-root',
      label: 'NEXUS Wissensbasis',
      type: 'root',
      size: 100,
      color: '#f56502',
      x: centerX,
      y: centerY
    });
    
// Theme Nodes (Hauptäste) - GLEICHMÄSSIGE KREISVERTEILUNG
    let themeIndex = 0;
    const themes = Array.from(themeCount.entries()).slice(0, 6);
    const themeRadius = 200; // Abstand vom Zentrum
    
    for (const [theme, count] of themes) {
      // Berechne Winkel für gleichmäßige Verteilung
      const angle = (themeIndex * 2 * Math.PI) / themes.length;
      const x = centerX + (themeRadius * Math.cos(angle));
      const y = centerY + (themeRadius * Math.sin(angle));
      
      nodes.push({
        id: `theme-${theme}`,
        label: theme,
        type: 'theme',
        size: Math.min(60 + count * 2, 80),
        color: theme === 'Text' ? '#4caf50' : '#2196f3',
        count: count,
        x: x,
        y: y
      });
      
      // Link zum Root
      links.push({
        source: 'nexus-root',
        target: `theme-${theme}`,
        strength: Math.min(count / 5, 10)
      });
      
      themeIndex++;
    }
    
    // Top Tag Nodes (Unteräste) - UM IHRE THEMES POSITIONIERT
    let tagIndex = 0;
    for (const [tag, count] of Array.from(tagCount.entries())
      .filter(([tag, count]) => count >= 2)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12)) {
      
      // Finde passendes Theme für Tag
      let parentTheme = 'Mixed';
      for (const [filename, data] of nodeData.entries()) {
        if (data.tags.some(t => t.includes(tag))) {
          parentTheme = data.theme;
          break;
        }
      }
      
      // Finde Parent-Theme-Node Position
      const parentNode = nodes.find(n => n.id === `theme-${parentTheme}`);
      const parentX = parentNode ? parentNode.x : centerX;
      const parentY = parentNode ? parentNode.y : centerY;
      
      // Positioniere Tag um sein Parent-Theme
      const tagAngle = (tagIndex * 2 * Math.PI) / 8; // Max 8 Tags pro Theme
      const tagRadius = 80; // Kleinerer Radius für Tags
      
      nodes.push({
        id: `tag-${tag}`,
        label: tag,
        type: 'tag',
        size: Math.min(20 + count * 3, 40),
        color: '#9c27b0',
        count: count,
        x: parentX + (tagRadius * Math.cos(tagAngle)),
        y: parentY + (tagRadius * Math.sin(tagAngle))
      });
      
      // Link zum Theme
      links.push({
        source: `theme-${parentTheme}`,
        target: `tag-${tag}`,
        strength: count
      });
      
      tagIndex++;
    }
    
    console.log(`[MINDMAP] ✅ Generated mindmap: ${nodes.length} nodes, ${links.length} links`);
    
    res.json({
      success: true,
      mindmap_data: {
        nodes: nodes,
        links: links
      },
      stats: {
        total_files: knowledgeCache.size,
        themes: themeCount.size,
        tags: tagCount.size,
        nodes: nodes.length,
        links: links.length,
        generated_at: new Date().toISOString()
      }
    });
    
  } catch (error) {
    console.error('[MINDMAP] ❌ Error generating mindmap:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});


// --- 🔍 STATUS ENDPOINT v7.0 ---
app.get("/status", (req, res) => {
  try {
    console.log('[STATUS] ✅ Health check requested');
    
    // Server-Status sammeln
    const uptime = process.uptime();
    const memoryUsage = process.memoryUsage();
    const now = new Date();
    
    res.json({
      success: true,
      status: "online",
      server: {
        name: "NEXUS Knowledge Server",
        version: "7.0.0",
        environment: "production",
        uptime_seconds: Math.floor(uptime),
        uptime_formatted: `${Math.floor(uptime / 3600)}h ${Math.floor((uptime % 3600) / 60)}m`,
        memory: {
          used: Math.round(memoryUsage.rss / 1024 / 1024) + " MB",
          heap: Math.round(memoryUsage.heapUsed / 1024 / 1024) + " MB"
        }
      },
      data: {
        knowledge_cache_size: knowledgeCache.size,
        total_entries: knowledgeCache.size,
        cache_healthy: knowledgeCache.size > 0
      },
      endpoints: {
        timeline: "/visualize/timeline",
        mindmap: "/visualize/mindmap", 
        status: "/status"
      },
      timestamp: now.toISOString(),
      timezone: "Europe/Berlin"
    });
    
  } catch (error) {
    console.error('[STATUS] ❌ Status check failed:', error);
    res.status(500).json({
      success: false,
      status: "error",
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});




// --- 🧠 DEMO RULES ENDPOINT ---
app.post("/check-rules", async (req, res) => {
  try {
    const { text } = req.body;
    if (!text || typeof text !== "string") {
      return res.status(400).json({ 
        success: false, 
        error: "text ist erforderlich" 
      });
    }
    
    const matchedRules = checkDemoRules(text);
    
    console.log(`[DEMO-RULES] Checked "${text.substring(0,50)}..." - Found ${matchedRules.length} matches`);
    
    res.json({ 
      success: true, 
      matches: matchedRules,
      text: text.substring(0, 100) // Debug info
    });
  } catch (error) {
    console.error("[DEMO-RULES] Error:", error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
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


// --- 🚀 DEBUG ENDPOINTS ---
// 🚀 ZUSÄTZLICHER DEBUG-ENDPOINT: Cache manuell rebuilden
app.post("/debug/rebuild-cache", async (req, res) => {
  try {
    console.log('[DEBUG] 🔄 Manual cache rebuild requested...');
    const result = await buildKnowledgeCache();
    const enhancedStats = getEnhancedCacheStats();
    
    res.json({ 
      success: true, 
      message: "Cache successfully rebuilt",
      ...result,
      enhanced_stats: enhancedStats,
      latest_files: Array.from(knowledgeCache.keys()).slice(0, 10)
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});


// --- SCHRITT 7: SERVER START ---
initializeApp()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`🚀 Nexus v6.1 WORKSPACE INTELLIGENT EDITION running on port ${PORT}`);
      console.log(`📊 Knowledge Directory: ${KNOWLEDGE_DIR}`);
      console.log(`🧠 AI Model: ${COMPLETION_MODEL}`);
      console.log(`📚 Knowledge Base: ${knowledgeCache.size} Infocards (mit .md Dateien: ${knowledgeCache.size * 2} Files total)`);
      console.log(`🔍 Search Index: ${searchIndex.size} entries ready`);
      console.log(`🏗️ Workspace Cache: ${workspaceCache.size} workspaces tracked`);
      console.log(`🧩 Cluster Cache: ${clusterCache.size} clusters active`);
      console.log(`📱 Entry Point Cache: ${entryPointCache.size} entry points`);
      console.log(`👁️ File Watcher: ${fileWatcher ? 'Active' : 'Inactive'}`);
      console.log(`🧠 Demo Rules: ${DEMO_RULES.length} active rules loaded`);
      console.log(`📁 FILE CREATION: ✅ Extension Support Active`);
      console.log(`✨ Ready for WORKSPACE-INTELLIGENT conversations with LIVE DEMO RULES!`);
      
      // Enhanced startup stats
      const enhancedStats = getEnhancedCacheStats();
      console.log(`📈 v6.1 Stats: ${enhancedStats.v61_files} v6.1 files, ${enhancedStats.legacy_files} legacy files`);
      console.log(`🎯 Workspaces: ${Object.keys(enhancedStats.workspaces).join(', ')}`);
      console.log(`📱 Entry Points: ${Object.keys(enhancedStats.entry_points).join(', ')}`);
      console.log(`🏆 NEXUS v6.1 - KNOWLEDGE SOVEREIGNTY + DEMO RULES + EXTENSION SUPPORT ACHIEVED! 👑`);
    });
  })
  .catch(err => {
    console.error("Fatal startup error:", err);
    process.exit(1);
  });