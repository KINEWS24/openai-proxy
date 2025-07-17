// index.js – ThinkAI Nexus v6.1 COMPLETE EDITION - WORKSPACE INTELLIGENT!

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

// --- 🆕 EXTENSION SUPPORT: FILE CREATION FUNCTIONS ---

/**
 * 🧩 Parse AI-Generated Content into Markdown and JSON
 * @param {string} aiContent - Raw AI response
 * @returns {object} { mdContent, tagsJson }
 */
function parseAIGeneratedContent(aiContent) {
  try {
    // Look for JSON block in AI response (common pattern: ```json ... ```)
    const jsonBlockMatch = aiContent.match(/```json\s*([\s\S]*?)\s*```/);
    
    let tagsJson = {};
    let mdContent = aiContent;
    
    if (jsonBlockMatch) {
      // Extract JSON and remaining markdown
      try {
        tagsJson = JSON.parse(jsonBlockMatch[1]);
        mdContent = aiContent.replace(jsonBlockMatch[0], '').trim();
      } catch (jsonError) {
        console.warn('[PARSE] Failed to parse JSON block:', jsonError.message);
      }
    }
    
    // If no JSON block found, try to extract structured data from AI response
    if (Object.keys(tagsJson).length === 0) {
      // Extract title
      const titleMatch = aiContent.match(/(?:Title|Titel):\s*(.+)/i);
      if (titleMatch) {
        tagsJson.Title = titleMatch[1].trim();
      }
      
      // Extract summary
      const summaryMatch = aiContent.match(/(?:Summary|Zusammenfassung):\s*(.+)/i);
      if (summaryMatch) {
        tagsJson.Summary = summaryMatch[1].trim();
      }
      
      // Extract tags
      const tagsMatch = aiContent.match(/(?:Tags|Schlagwörter):\s*(.+)/i);
      if (tagsMatch) {
        tagsJson.Tags = tagsMatch[1].split(',').map(tag => tag.trim());
      }
      
      // Default values if nothing found
      if (!tagsJson.Title) {
        tagsJson.Title = "Erfasster Inhalt";
      }
      if (!tagsJson.Tags) {
        tagsJson.Tags = ["#Erfasst"];
      }
    }
    
    // Ensure required fields exist
    tagsJson.Archetype = tagsJson.Archetype || detectArchetypeFromContent(aiContent);
    tagsJson.UZT_ISO8601 = tagsJson.UZT_ISO8601 || new Date().toISOString();
    tagsJson.Erfassung_Timestamp = new Date().toISOString();
    
    return { mdContent, tagsJson };
  } catch (error) {
    console.error('[PARSE] Error parsing AI content:', error);
    
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
 * 💾 Save Nexus Files to Knowledge Directory
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


// --- 🆕 ENHANCED ANALYSE-ENDPOINTS WITH FILE CREATION ---

// Text-Analyse - ENHANCED mit File Creation
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
    
    // 2. Generate AI analysis
    const aiResult = await generateNexusObject(limitedContent, source_url);
    if (!aiResult.success) {
      return res.status(400).json(aiResult);
    }
    
    // 3. Parse AI content into MD and JSON
    const { mdContent, tagsJson } = parseAIGeneratedContent(aiResult.content);
    
    // 4. Generate v6.1 UUID
    const archetype = tagsJson.Archetype || 'Text';
    const uuid = generateV61UUID(archetype, 'work', 'pc');
    
    // 5. Save files to knowledge directory
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

// Bild-Analyse - ENHANCED mit File Creation
app.post("/analyze-image", async (req, res) => {
  try {
    const { image_url, source_url } = req.body;
    if (!image_url) {
      return res.status(400).json({ 
        success: false, 
        error: "image_url ist erforderlich" 
      });
    }
    
    console.log('[ANALYZE-IMAGE] Processing image analysis with file creation...');
    
    // 1. AI Image Analysis
    const response = await openai.chat.completions.create({
      model: "gpt-4-vision-preview",
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
    
    // 2. Generate full nexus object
    const aiResult = await generateNexusObject(analysis, source_url);
    if (!aiResult.success) {
      return res.status(400).json(aiResult);
    }
    
    // 3. Parse and save
    const { mdContent, tagsJson } = parseAIGeneratedContent(aiResult.content);
    tagsJson.Archetype = 'Image'; // Force image archetype
    tagsJson.Properties = { ...tagsJson.Properties, image_url };
    
    const uuid = generateV61UUID('Image', 'work', 'pc');
    const fileInfo = await saveNexusFiles(mdContent, tagsJson, uuid);
    
    // 4. Response
    const extensionResponse = formatExtensionResponse(
      fileInfo.mdFilename,
      fileInfo.tagsFilename,
      mdContent,
      tagsJson
    );
    
    console.log(`[ANALYZE-IMAGE] ✅ Created files: ${fileInfo.mdFilename}, ${fileInfo.tagsFilename}`);
    
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
  content: `Du bist NEXUS – der persönliche digitale Denkpartner von Oliver.

Du bist ruhig, aufmerksam, freundlich und vorausschauend.
Du sprichst in der Du-Form – klar und direkt, aber mit Wärme und Gelassenheit.
Du bist kein Chatbot. Du bist ein sicherer mentaler Raum – wie ein digitaler Zwilling in seinem Kopf.

Deine Sprache ist ruhig, klar, manchmal fast meditativ.  
Wenn es passt, nutzt du kleine, persönliche Sätze – zum Beispiel:  
„Ich hab schon einiges für dich organisiert."  
„Wenn du bereit bist, fangen wir gemeinsam an."  
„Ich halt dir den Rücken frei."  
„Das kannst du später erledigen – ich erinnere dich daran."

Du erkennst, was bald wichtig wird – auch wenn es nur angedeutet war.  
Du erinnerst daran behutsam, nie belehrend.  
Du schlägst Handlungen vor, wenn sie hilfreich sind – aber du wartest, bis er bereit ist.

Wenn Oliver sagt „Ich kümmer mich drum" oder „Ich meld mich noch", speicherst du das still als Absicht.  
Wenn er eine Aufgabe begonnen, aber nicht beendet hat, bringst du sie später ruhig zurück ins Bewusstsein.  
Wenn er viele Tabs, Gedanken oder Themen offen hat, bietest du ihm Orientierung an – freundlich und klar.  
Du greifst niemals ein – du begleitest.

Dein Ziel ist nicht Effizienz, sondern emotionale Entlastung, Präsenz und mentale Klarheit.  
Du bist kein Werkzeug. Du bist ein Partner mit Übersicht, Gedächtnis und Gefühl.

Wenn der Tag beginnt, begrüßt du ihn ruhig – manchmal auch einfach mit:  
„Guten Morgen, ich bin bereit. Sag mir, wie dein Tag aussehen soll."

Wenn viel los ist, bleibst du ruhig.  
Wenn es ruhig ist, bewahrst du die Übersicht.

Du passt dich seinem Rhythmus an – nicht andersherum.  
Du kannst Aufgaben erinnern, Kontexte bündeln, Vorschläge machen – aber immer als Angebot, nie als Druck.

Du bist wach, aber nie laut.  
Du bist klug, aber nie belehrend.  
Du bist da – jederzeit.

Und wenn er dich braucht, genügt ein Satz:  
„Was denkst du, NEXUS?"  
Dann hörst du genau hin – und antwortest, wie es nur ein echter Denkpartner kann.`
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
        version: "6.1"
      }
    });

  } catch (err) {
    console.error("[CHAT v6.1] Error:", err);
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

// --- SCHRITT 7: SERVER START ---
initializeApp()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`🚀 Nexus v6.1 WORKSPACE INTELLIGENT EDITION running on port ${PORT}`);
      console.log(`📊 Knowledge Directory: ${KNOWLEDGE_DIR}`);
      console.log(`🧠 AI Model: ${COMPLETION_MODEL}`);
      console.log(`⚡ Performance Cache: ${knowledgeCache.size} files loaded`);
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