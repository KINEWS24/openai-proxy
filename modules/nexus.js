// modules/nexus.js
// All-in-One Nexus Router (v27 - Verbesserte Fehlerbehandlung)

// --- SCHRITT 0: Imports & Setup ---
const express = require('express');
const router  = express.Router();

// Nexus-Helpers
const {
  classifyContent,
  generateNexusObject,
  handleAnalysisRequest
} = require('../utils/nexusHelpers');

// --- SCHRITT 1: /nexus POST-Endpoint ---
router.post('/', async (req, res) => {
  const { content, source_url, context_uuid } = req.body;
  
  if (!content) {
    return res.status(400).json({ 
      success: false, 
      error: 'Kein Content zum Verarbeiten übermittelt.' 
    });
  }

  try {
    console.log(`[NEXUS] Processing content (${content.length} chars) from ${source_url || 'unknown'}`);
    
    // 1) Klassifikation
    const meta = await classifyContent(content, source_url);
    
    if (!meta || !meta.NextPrompt) {
      console.warn('[NEXUS] Klassifizierung fehlgeschlagen, verwende Text-Fallback');
      meta.NextPrompt = 'nexus_prompt_text_v1.0';
    }
    
    const nextPrompt = meta.NextPrompt;
    console.log(`[NEXUS] Klassifiziert als: ${nextPrompt}`);

    let result;

    // 2) Branching auf Basis von NextPrompt
    switch (nextPrompt) {
      // HTML-Fragment behandeln wie Text
      case 'nexus_prompt_html_v1.0':
      case 'nexus_prompt_text_v1.0':
        console.log('[NEXUS] Verarbeite als Text');
        result = await generateNexusObject({
          archetype:   'text',
          contextUUID: context_uuid || 'default-nexus-context',
          contentRaw:  content,
          sourceUrl:   source_url
        });
        break;

      // Bild-Analyse
      case 'nexus_prompt_image_v1.0':
        console.log('[NEXUS] Verarbeite als Bild');
        result = await new Promise((resolve, reject) => {
          const fakeRes = { 
            json: resolve, 
            status: (code) => ({ json: (obj) => resolve({ ...obj, statusCode: code }) }) 
          };
          handleAnalysisRequest(req, fakeRes, 'image', content, source_url || content, 'url')
            .catch(reject);
        });
        break;

      // Link-Analyse
      case 'nexus_prompt_link_v1.0':
        console.log('[NEXUS] Verarbeite als Link');
        result = await new Promise((resolve, reject) => {
          const fakeRes = { 
            json: resolve, 
            status: (code) => ({ json: (obj) => resolve({ ...obj, statusCode: code }) }) 
          };
          handleAnalysisRequest(req, fakeRes, 'link', content, source_url || content, 'url')
            .catch(reject);
        });
        break;

      default:
        console.warn(`[NEXUS] Unbekannter NextPrompt: ${nextPrompt}, verwende Text-Fallback`);
        result = await generateNexusObject({
          archetype:   'text',
          contextUUID: context_uuid || 'default-nexus-context',
          contentRaw:  content,
          sourceUrl:   source_url
        });
        break;
    }

    // 3) Validierung des Ergebnisses
    if (!result || !result.nexusMd || !result.tagsJson) {
      throw new Error('Unvollständiges Ergebnis von Nexus-Generator');
    }

    console.log(`[NEXUS] Erfolgreich verarbeitet: ${result.nexusMd.filename}`);

    // 4) Ergebnis zurückgeben
    return res.json({ 
      success: true, 
      meta, 
      ...result,
      processedAt: new Date().toISOString()
    });

  } catch (err) {
    console.error('[NEXUS] Fehler im /nexus-Endpoint:', err);
    return res.status(500).json({ 
      success: false, 
      error: err.message,
      timestamp: new Date().toISOString()
    });
  }
});

// --- SCHRITT 2: Health Check für Nexus ---
router.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    module: 'nexus',
    version: '27',
    timestamp: new Date().toISOString()
  });
});

module.exports = router;