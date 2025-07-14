// modules/code-search.js - NEXUS PHASE 3: CODE-AWARE SEARCH
// 🎯 MISSION: Oliver fragt "Erklär mir Authentication" → findet alle verwandten Code-Files

console.log('[CODE-SEARCH v3.0] Loading Code-Aware Search Module...');

// =====================================
// 🎯 CODE PATTERN DEFINITIONS (basierend auf Oliver's echtem Code)
// =====================================

// Extension Patterns (Browser/Frontend)
const EXTENSION_PATTERNS = {
    functions: [
        'onInstalled', 'onStartup', 'onMessage', 'createContextMenu',
        'handleChatRequest', 'handleCurrentPageCapture', 'detectICSContent', 
        'isCalendarRelatedContent', 'generateFilenameV62', 'preparePageContentForAnalysis',
        'analyzePageContentWithServer', 'createCurrentPageFallback', 'initializeOptions',
        'getStorageData', 'setStorageData', 'showStatus', 'handleSaveFolder',
        'handleAuth', 'handleTestDrive', 'handleCheckServer', 'handleClearAuth',
        'initializeSidebar', 'handleGlobalClicks', 'captureCurrentPage',
        'extractPageContent', 'handleChatHistoryClicks', 'detectResponseType',
        'hasICSContent', 'extractICSFromSources', 'parseICSContent', 'processICSEvent'
    ],
    imports: ['chrome', 'crypto'],
    files: ['background.js', 'contentScript.js', 'manifest.json', 'options.js', 'sidebar.js'],
    endpoints: [
        'googleapis.com/upload/drive', 'googleapis.com/drive/v3/files', 
        'openai-proxy-qd96.onrender.com'
    ],
    variables: [
        'GOOGLE_API_DRIVE_UPLOAD', 'GOOGLE_API_DRIVE_FILES', 'SERVER_URL',
        'NEXUS_V62_OWNER', 'NEXUS_V62_ENTRY_POINT', 'NEXUS_V62_CLUSTER',
        'WORKSPACE_CODES', 'VALID_ARCHETYPES', 'CONFIG', 'processId',
        'icsDetection', 'calendarDetection', 'settings', 'contentForAnalysis',
        'statusMessage', 'analysisResult', 'fallbackResult', 'currentTab', 'pageContent'
    ]
};

// Server Patterns (Backend/API)
const SERVER_PATTERNS = {
    functions: [
        'escapeText', 'parseNexusUUID', 'getWorkspaceCache', 'detectEntryPoint',
        'analyzeClusterRelations', 'getEnhancedCacheStats', 'buildKnowledgeCache',
        'setupFileWatcher', 'performCachedSearch', 'extractJsonBlock',
        'classifyContent', 'generateNexusObject', 'handleAnalysisRequest'
    ],
    imports: [
        'express', 'cors', 'fs', 'fs/promises', 'path', 'crypto', 'uuidv7',
        'openai', 'googleapis', 'cheerio', 'puppeteer', 'node-fetch', 'node-ical'
    ],
    files: ['exportIcs.js', 'index.js', 'nexus.js', 'nexusHelpers.js'],
    endpoints: ['/export-ics', '/validate-ics', '/nexus', '/nexus/health'],
    variables: [
        'uid', 'start', 'end', 'summary', 'description', 'url', 'location',
        'KNOWLEDGE_DIR', 'CAPTURE_PROMPT_PATH', 'CLASSIFIER_PROMPT_PATH',
        'OPENAI_API_KEY', 'SCRAPER_API_KEY', 'MAX_CONTENT_LENGTH',
        'COMPLETION_MODEL', 'PORT', 'SIMPLIFIED_PROMPT_ENABLED',
        'knowledgeCache', 'searchIndex', 'workspaceCache', 'clusterCache'
    ]
};

// =====================================
// 🧠 SEMANTIC CODE CLUSTERS
// =====================================

const CODE_CLUSTERS = {
    // Authentication & Security
    authentication: {
        keywords: ['auth', 'login', 'token', 'jwt', 'verify', 'session', 'oauth', 'passport', 'bcrypt'],
        functions: ['handleAuth', 'handleClearAuth', 'verifyToken', 'generateToken', 'checkAuth'],
        files: ['*auth*', '*login*', '*token*', '*jwt*', '*oauth*'],
        imports: ['passport', 'jwt', 'bcrypt', 'auth0', 'oauth'],
        endpoints: ['/auth', '/login', '/logout', '/verify', '/token'],
        variables: ['authToken', 'oauthToken', 'isAuthenticated', 'currentUser']
    },

    // API & Backend
    api: {
        keywords: ['api', 'routes', 'endpoints', 'server', 'backend', 'middleware', 'router'],
        functions: ['router.post', 'router.get', 'handleApiRequest', 'middleware', 'cors'],
        files: ['*routes*', '*api*', '*server*', '*backend*', '*middleware*'],
        imports: ['express', 'cors', 'router', 'middleware'],
        endpoints: ['/api/*', '/v1/*', '/routes/*'],
        variables: ['router', 'app', 'server', 'middleware', 'apiUrl', 'baseUrl']
    },

    // Frontend & UI
    frontend: {
        keywords: ['frontend', 'ui', 'component', 'sidebar', 'options', 'page', 'dom', 'html'],
        functions: ['initializeSidebar', 'initializeOptions', 'handleGlobalClicks', 'captureCurrentPage'],
        files: ['*sidebar*', '*options*', '*content*', '*popup*', '*ui*', '*.html', '*.css'],
        imports: ['chrome', 'dom'],
        endpoints: [],
        variables: ['sidebar', 'options', 'currentTab', 'pageContent', 'statusMessage']
    },

    // Google Drive Integration
    google_drive: {
        keywords: ['drive', 'google', 'upload', 'files', 'folder', 'storage'],
        functions: ['handleSaveFolder', 'handleTestDrive', 'uploadToGoogleDrive'],
        files: ['*drive*', '*google*', '*upload*'],
        imports: ['googleapis'],
        endpoints: ['googleapis.com/drive', 'googleapis.com/upload'],
        variables: ['GOOGLE_API_DRIVE_UPLOAD', 'GOOGLE_API_DRIVE_FILES', 'folderId', 'driveApi']
    },

    // Calendar & ICS
    calendar: {
        keywords: ['calendar', 'ics', 'event', 'meeting', 'schedule', 'datetime'],
        functions: ['detectICSContent', 'isCalendarRelatedContent', 'parseICSContent', 'processICSEvent'],
        files: ['*calendar*', '*ics*', '*event*', '*.ics'],
        imports: ['node-ical', 'ical'],
        endpoints: ['/export-ics', '/validate-ics'],
        variables: ['icsDetection', 'calendarDetection', 'dtstart', 'dtend', 'uid']
    },

    // Data Processing & Analysis
    analysis: {
        keywords: ['analyze', 'parse', 'extract', 'process', 'generate', 'classify'],
        functions: ['analyzePageContentWithServer', 'parseCodeContent', 'extractPageContent', 'classifyContent'],
        files: ['*analyze*', '*parse*', '*extract*', '*process*'],
        imports: ['openai', 'cheerio', 'puppeteer'],
        endpoints: ['/analyze', '/classify', '/process'],
        variables: ['analysisResult', 'contentForAnalysis', 'openai', 'analysisVersion']
    },

    // Caching & Performance
    caching: {
        keywords: ['cache', 'performance', 'index', 'search', 'build', 'watcher'],
        functions: ['buildKnowledgeCache', 'performCachedSearch', 'setupFileWatcher', 'getEnhancedCacheStats'],
        files: ['*cache*', '*index*', '*performance*'],
        imports: ['fs', 'path'],
        endpoints: ['/cache/*'],
        variables: ['knowledgeCache', 'searchIndex', 'workspaceCache', 'clusterCache', 'fileWatcher']
    }
};

// =====================================
// 🔍 CORE CODE-AWARE SEARCH FUNCTIONS
// =====================================

/**
 * 🎯 MAIN FUNCTION: Calculate Code Relevance Score
 * @param {string} query - User's search query
 * @param {object} codeInfo - Parsed code information from parseCodeContent()
 * @param {string} filename - Current filename being analyzed
 * @param {object} searchableText - Existing searchable text content
 * @returns {number} Enhanced relevance score (0-2.0, höher = relevanter)
 */
function calculateCodeRelevance(query, codeInfo, filename, searchableText) {
    console.log(`[CODE-SEARCH] Analyzing "${filename}" for query: "${query}"`);
    
    if (!codeInfo || !query) {
        return 0; // Fallback für Non-Code Files
    }
    
    let codeScore = 0;
    const queryLower = query.toLowerCase();
    const queryTokens = queryLower.split(/\s+/).filter(t => t.length > 2);
    
    try {
        // 1. DIRECT MATCHES (Höchste Priorität)
        // Funktionsname-Matches
        if (codeInfo.functions && codeInfo.functions.length > 0) {
            for (const func of codeInfo.functions) {
                if (queryTokens.some(token => func.toLowerCase().includes(token))) {
                    codeScore += 1.5; // Starker Bonus für Function-Matches
                    console.log(`[CODE-SEARCH] Function match: ${func}`);
                }
            }
        }
        
        // Import-Matches  
        if (codeInfo.imports && codeInfo.imports.length > 0) {
            for (const imp of codeInfo.imports) {
                if (queryTokens.some(token => imp.toLowerCase().includes(token))) {
                    codeScore += 1.0; // Bonus für Import-Matches
                    console.log(`[CODE-SEARCH] Import match: ${imp}`);
                }
            }
        }
        
        // API-Endpoint-Matches
        if (codeInfo.apis && codeInfo.apis.length > 0) {
            for (const api of codeInfo.apis) {
                if (queryTokens.some(token => api.toLowerCase().includes(token))) {
                    codeScore += 1.2; // Bonus für API-Matches
                    console.log(`[CODE-SEARCH] API match: ${api}`);
                }
            }
        }
        
        // 2. SEMANTIC CLUSTER MATCHING
        const clusterMatches = findSemanticClusters(queryLower, codeInfo, filename);
        if (clusterMatches.length > 0) {
            codeScore += clusterMatches.length * 0.8; // Pro Cluster-Match
            console.log(`[CODE-SEARCH] Cluster matches: ${clusterMatches.join(', ')}`);
        }
        
        // 3. LANGUAGE/FRAMEWORK BONUS
        if (codeInfo.language && queryLower.includes(codeInfo.language.toLowerCase())) {
            codeScore += 0.5;
        }
        if (codeInfo.framework && queryLower.includes(codeInfo.framework.toLowerCase())) {
            codeScore += 0.5;
        }
        
        // 4. FILENAME PATTERN MATCHING
        const filenameScore = calculateFilenameRelevance(queryLower, filename);
        codeScore += filenameScore;
        
        console.log(`[CODE-SEARCH] Final code score for "${filename}": ${codeScore}`);
        return Math.min(codeScore, 2.0); // Cap bei 2.0 für Balance
        
    } catch (error) {
        console.warn(`[CODE-SEARCH] Error calculating relevance for ${filename}:`, error.message);
        return 0;
    }
}

/**
 * 🧠 Find Semantic Code Clusters
 * @param {string} queryLower - Lowercase query
 * @param {object} codeInfo - Code analysis results  
 * @param {string} filename - Current filename
 * @returns {Array} Matched cluster names
 */
function findSemanticClusters(queryLower, codeInfo, filename) {
    const matchedClusters = [];
    
    for (const [clusterName, cluster] of Object.entries(CODE_CLUSTERS)) {
        let clusterScore = 0;
        
        // Check keywords
        for (const keyword of cluster.keywords) {
            if (queryLower.includes(keyword)) {
                clusterScore += 2;
                break; // Eines reicht pro Cluster
            }
        }
        
        // Check functions
        if (codeInfo.functions) {
            for (const func of codeInfo.functions) {
                if (cluster.functions.some(pattern => 
                    func.toLowerCase().includes(pattern.toLowerCase()) ||
                    pattern.toLowerCase().includes(func.toLowerCase())
                )) {
                    clusterScore += 1;
                    break;
                }
            }
        }
        
        // Check imports
        if (codeInfo.imports) {
            for (const imp of codeInfo.imports) {
                if (cluster.imports.some(pattern => 
                    imp.toLowerCase().includes(pattern.toLowerCase())
                )) {
                    clusterScore += 1;
                    break;
                }
            }
        }
        
        // Check filename patterns
        for (const pattern of cluster.files) {
            const regex = new RegExp(pattern.replace('*', '.*'), 'i');
            if (regex.test(filename)) {
                clusterScore += 1;
                break;
            }
        }
        
        // Cluster matched wenn Score >= 2
        if (clusterScore >= 2) {
            matchedClusters.push(clusterName);
        }
    }
    
    return matchedClusters;
}

/**
 * 📁 Calculate Filename Relevance
 * @param {string} queryLower - Lowercase query
 * @param {string} filename - Current filename
 * @returns {number} Filename relevance score
 */
function calculateFilenameRelevance(queryLower, filename) {
    let score = 0;
    const filenameLower = filename.toLowerCase();
    
    // Direct filename matches
    if (filenameLower.includes(queryLower)) {
        score += 0.8;
    }
    
    // Pattern-based matches
    const queryTokens = queryLower.split(/\s+/).filter(t => t.length > 2);
    for (const token of queryTokens) {
        if (filenameLower.includes(token)) {
            score += 0.3;
        }
    }
    
    return score;
}

/**
 * 🔗 Find Related Code Files
 * @param {string} targetFilename - Current file to find relations for
 * @param {Map} allFiles - All cached files (knowledgeCache)
 * @param {object} targetCodeInfo - Code info for target file
 * @returns {Array} Related filenames with relationship types
 */
function analyzeCodeRelations(targetFilename, allFiles, targetCodeInfo) {
    const relations = [];
    
    if (!targetCodeInfo || !allFiles) {
        return relations;
    }
    
    console.log(`[CODE-SEARCH] Finding relations for: ${targetFilename}`);
    
    try {
        for (const [filename, metadata] of allFiles.entries()) {
            if (filename === targetFilename) continue; // Skip self
            
            // Only analyze Code files
            if (!metadata.Properties || !metadata.Properties.code_info) {
                continue;
            }
            
            const otherCodeInfo = metadata.Properties.code_info;
            const relationTypes = [];
            
            // 1. SHARED IMPORTS (Strong relation)
            if (targetCodeInfo.main_imports && otherCodeInfo.main_imports) {
                const sharedImports = targetCodeInfo.main_imports.filter(imp => 
                    otherCodeInfo.main_imports.includes(imp)
                );
                if (sharedImports.length >= 2) {
                    relationTypes.push(`shared_imports:${sharedImports.length}`);
                }
            }
            
            // 2. COMPLEMENTARY FUNCTIONS (API + Frontend)
            if (targetCodeInfo.main_functions && otherCodeInfo.main_functions) {
                const targetFuncs = targetCodeInfo.main_functions.join(' ').toLowerCase();
                const otherFuncs = otherCodeInfo.main_functions.join(' ').toLowerCase();
                
                // Auth relation patterns
                if ((targetFuncs.includes('auth') || targetFuncs.includes('login')) &&
                    (otherFuncs.includes('auth') || otherFuncs.includes('login'))) {
                    relationTypes.push('auth_chain');
                }
                
                // API relation patterns  
                if ((targetFuncs.includes('api') || targetFuncs.includes('router')) &&
                    (otherFuncs.includes('api') || otherFuncs.includes('router'))) {
                    relationTypes.push('api_chain');
                }
            }
            
            // 3. SAME FRAMEWORK/LANGUAGE
            if (targetCodeInfo.framework === otherCodeInfo.framework && 
                targetCodeInfo.framework !== 'none') {
                relationTypes.push(`same_framework:${targetCodeInfo.framework}`);
            }
            
            // 4. FILENAME PATTERNS
            const targetBase = targetFilename.replace(/\.(js|ts|css|html)$/, '');
            const otherBase = filename.replace(/\.(js|ts|css|html)$/, '');
            
            if (targetBase.includes('auth') && otherBase.includes('auth')) {
                relationTypes.push('naming_pattern:auth');
            }
            if (targetBase.includes('api') && otherBase.includes('api')) {
                relationTypes.push('naming_pattern:api');
            }
            
            // Add relation if any type found
            if (relationTypes.length > 0) {
                relations.push({
                    filename,
                    relationTypes,
                    strength: relationTypes.length,
                    title: metadata.Title || 'Unbekannter Titel'
                });
            }
        }
        
        // Sort by relation strength (descending)
        relations.sort((a, b) => b.strength - a.strength);
        
        console.log(`[CODE-SEARCH] Found ${relations.length} relations for ${targetFilename}`);
        return relations.slice(0, 5); // Top 5 relations only
        
    } catch (error) {
        console.warn(`[CODE-SEARCH] Error analyzing relations for ${targetFilename}:`, error.message);
        return [];
    }
}

/**
 * 🎯 Smart Query Expansion für Code-Begriffe
 * @param {string} query - Original user query
 * @returns {Array} Expanded query terms
 */
function expandCodeQuery(query) {
    const queryLower = query.toLowerCase();
    const expansions = new Set([queryLower]);
    
    // Authentication expansions
    if (queryLower.includes('auth') || queryLower.includes('login')) {
        expansions.add('authentication');
        expansions.add('login');
        expansions.add('auth');
        expansions.add('jwt');
        expansions.add('token');
        expansions.add('verify');
        expansions.add('session');
        expansions.add('oauth');
    }
    
    // API expansions
    if (queryLower.includes('api') || queryLower.includes('endpoint')) {
        expansions.add('api');
        expansions.add('routes');
        expansions.add('endpoints');
        expansions.add('router');
        expansions.add('express');
        expansions.add('backend');
        expansions.add('server');
    }
    
    // Frontend expansions
    if (queryLower.includes('frontend') || queryLower.includes('ui') || queryLower.includes('sidebar')) {
        expansions.add('frontend');
        expansions.add('ui');
        expansions.add('sidebar');
        expansions.add('options');
        expansions.add('content');
        expansions.add('page');
        expansions.add('component');
    }
    
    // Google Drive expansions
    if (queryLower.includes('drive') || queryLower.includes('google') || queryLower.includes('upload')) {
        expansions.add('drive');
        expansions.add('google');
        expansions.add('upload');
        expansions.add('files');
        expansions.add('storage');
        expansions.add('folder');
    }
    
    return Array.from(expansions);
}

/**
 * 📝 Generate Enhanced Code Context for AI
 * @param {Array} results - Search results with code info
 * @param {string} originalQuery - User's original query
 * @returns {string} Enhanced context for AI response
 */
function generateCodeContext(results, originalQuery) {
    console.log(`[CODE-SEARCH] Generating code context for ${results.length} results`);
    
    let context = '';
    const codeFiles = results.filter(r => r.metadata.Properties && r.metadata.Properties.code_info);
    
    if (codeFiles.length === 0) {
        return context; // No code files, return empty
    }
    
    context += `\n🔍 CODE-AWARE ANALYSIS für Query: "${originalQuery}"\n\n`;
    
    // Group by clusters for better structure
    const clusters = {};
    
    codeFiles.forEach((result, index) => {
        const codeInfo = result.metadata.Properties.code_info;
        const filename = result.filename;
        
        // Determine primary cluster
        const queryLower = originalQuery.toLowerCase();
        let primaryCluster = 'other';
        
        if (queryLower.includes('auth') || queryLower.includes('login')) {
            primaryCluster = 'authentication';
        } else if (queryLower.includes('api') || queryLower.includes('router')) {
            primaryCluster = 'api';
        } else if (queryLower.includes('frontend') || queryLower.includes('sidebar') || queryLower.includes('ui')) {
            primaryCluster = 'frontend';
        } else if (queryLower.includes('drive') || queryLower.includes('google')) {
            primaryCluster = 'google_drive';
        } else if (queryLower.includes('calendar') || queryLower.includes('ics')) {
            primaryCluster = 'calendar';
        }
        
        if (!clusters[primaryCluster]) {
            clusters[primaryCluster] = [];
        }
        
        clusters[primaryCluster].push({
            filename,
            title: result.metadata.Title,
            codeInfo,
            score: result.score
        });
    });
    
    // Generate cluster-based context
    for (const [clusterName, files] of Object.entries(clusters)) {
        if (files.length === 0) continue;
        
        context += `📁 ${clusterName.toUpperCase()} BEREICH:\n`;
        
        files.forEach((file, index) => {
            context += `[${index + 1}] ${file.title || file.filename}\n`;
            context += `   • Sprache: ${file.codeInfo.language}\n`;
            
            if (file.codeInfo.framework && file.codeInfo.framework !== 'none') {
                context += `   • Framework: ${file.codeInfo.framework}\n`;
            }
            
            if (file.codeInfo.main_functions && file.codeInfo.main_functions.length > 0) {
                context += `   • Funktionen: ${file.codeInfo.main_functions.slice(0, 3).join(', ')}\n`;
            }
            
            if (file.codeInfo.api_endpoints && file.codeInfo.api_endpoints.length > 0) {
                context += `   • APIs: ${file.codeInfo.api_endpoints.join(', ')}\n`;
            }
            
            if (file.codeInfo.main_imports && file.codeInfo.main_imports.length > 0) {
                context += `   • Imports: ${file.codeInfo.main_imports.slice(0, 3).join(', ')}\n`;
            }
            
            context += `\n`;
        });
        
        context += `---\n\n`;
    }
    
    return context;
}

/**
 * 🚀 MAIN EXPORT: Enhanced Search Function für Code-Awareness
 * @param {string} query - User search query
 * @param {Array} searchResults - Current search results
 * @param {Map} knowledgeCache - All cached files
 * @returns {object} Enhanced search results with code relations
 */
function enhanceSearchWithCodeAwareness(query, searchResults, knowledgeCache) {
    console.log(`[CODE-SEARCH] Enhancing search for: "${query}"`);
    
    try {
        // 1. Expand query für bessere Code-Matches
        const expandedQueries = expandCodeQuery(query);
        console.log(`[CODE-SEARCH] Expanded queries:`, expandedQueries);
        
        // 2. Enhance each result with code relevance
        const enhancedResults = searchResults.map(result => {
            let codeRelevanceBonus = 0;
            let codeRelations = [];
            
            // Check if this is a code file
            if (result.metadata.Properties && result.metadata.Properties.code_info) {
                const codeInfo = result.metadata.Properties.code_info;
                
                // Calculate code-specific relevance
                codeRelevanceBonus = calculateCodeRelevance(
                    query, 
                    codeInfo, 
                    result.filename, 
                    result.searchableText
                );
                
                // Find related code files
                codeRelations = analyzeCodeRelations(
                    result.filename, 
                    knowledgeCache, 
                    codeInfo
                );
            }
            
            return {
                ...result,
                codeRelevanceBonus,
                codeRelations,
                enhancedScore: result.score + codeRelevanceBonus
            };
        });
        
        // 3. Re-sort by enhanced score
        enhancedResults.sort((a, b) => b.enhancedScore - a.enhancedScore);
        
        // 4. Generate enhanced context
        const codeContext = generateCodeContext(enhancedResults, query);
        
        console.log(`[CODE-SEARCH] Enhanced ${enhancedResults.length} results with code awareness`);
        
        return {
            results: enhancedResults,
            codeContext,
            totalCodeFiles: enhancedResults.filter(r => r.codeRelevanceBonus > 0).length,
            expandedQueries,
            codeAwareSearch: true
        };
        
    } catch (error) {
        console.error('[CODE-SEARCH] Error enhancing search:', error.message);
        
        // Fallback: Return original results
        return {
            results: searchResults,
            codeContext: '',
            totalCodeFiles: 0,
            expandedQueries: [query],
            codeAwareSearch: false,
            error: error.message
        };
    }
}

// =====================================
// 🎯 CLUSTER ANALYSIS FUNCTIONS
// =====================================

/**
 * 📊 Analyze Code Ecosystem
 * @param {Map} knowledgeCache - All cached files
 * @returns {object} Code ecosystem analysis
 */
function analyzeCodeEcosystem(knowledgeCache) {
    const ecosystem = {
        totalCodeFiles: 0,
        languages: {},
        frameworks: {},
        clusters: {},
        relations: [],
        topFunctions: {},
        topImports: {}
    };
    
    console.log('[CODE-SEARCH] Analyzing code ecosystem...');
    
    try {
        for (const [filename, metadata] of knowledgeCache.entries()) {
            if (!metadata.Properties || !metadata.Properties.code_info) {
                continue; // Skip non-code files
            }
            
            const codeInfo = metadata.Properties.code_info;
            ecosystem.totalCodeFiles++;
            
            // Language stats
            if (codeInfo.language) {
                ecosystem.languages[codeInfo.language] = (ecosystem.languages[codeInfo.language] || 0) + 1;
            }
            
            // Framework stats
            if (codeInfo.framework && codeInfo.framework !== 'none') {
                ecosystem.frameworks[codeInfo.framework] = (ecosystem.frameworks[codeInfo.framework] || 0) + 1;
            }
            
            // Function frequency
            if (codeInfo.main_functions) {
                for (const func of codeInfo.main_functions) {
                    ecosystem.topFunctions[func] = (ecosystem.topFunctions[func] || 0) + 1;
                }
            }
            
            // Import frequency
            if (codeInfo.main_imports) {
                for (const imp of codeInfo.main_imports) {
                    ecosystem.topImports[imp] = (ecosystem.topImports[imp] || 0) + 1;
                }
            }
        }
        
        // Convert to sorted arrays
        ecosystem.topFunctions = Object.entries(ecosystem.topFunctions)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 10);
            
        ecosystem.topImports = Object.entries(ecosystem.topImports)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 10);
        
        console.log(`[CODE-SEARCH] Ecosystem: ${ecosystem.totalCodeFiles} code files, ${Object.keys(ecosystem.languages).length} languages`);
        
        return ecosystem;
        
    } catch (error) {
        console.error('[CODE-SEARCH] Error analyzing ecosystem:', error.message);
        return ecosystem;
    }
}

// =====================================
// 🚀 MODULE EXPORTS
// =====================================

module.exports = {
    // Core Functions
    calculateCodeRelevance,
    analyzeCodeRelations,
    generateCodeContext,
    enhanceSearchWithCodeAwareness,
    
    // Utility Functions
    expandCodeQuery,
    findSemanticClusters,
    calculateFilenameRelevance,
    analyzeCodeEcosystem,
    
    // Pattern Definitions (for debugging/analysis)
    CODE_CLUSTERS,
    EXTENSION_PATTERNS,
    SERVER_PATTERNS
};

console.log('[CODE-SEARCH v3.0] ✅ Module loaded successfully!');