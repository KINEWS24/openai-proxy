// modules/nexus.js
// All-in-One Nexus Router (v26)

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
    return res.status(400).json({ success: false, error: 'Kein Content zum Verarbeiten übermittelt.' });
  }

  try {
    // 1) Klassifikation
    const meta       = await classifyContent(content, source_url);
    const nextPrompt = meta.NextPrompt;

    let result;

    // 2) Branching auf Basis von NextPrompt
    switch (nextPrompt) {
      // HTML-Fragment behandeln wie Text
      case 'nexus_prompt_html_v1.0':
      case 'nexus_prompt_text_v1.0':
        result = await generateNexusObject({
          archetype:   'text',
          contextUUID: context_uuid || 'default-nexus-context',
          contentRaw:  content,
          sourceUrl:   source_url
        });
        break;

      // Bild-Analyse
      case 'nexus_prompt_image_v1.0':
        result = await new Promise(resolve => {
          const fakeRes = { json: resolve, status: () => fakeRes };
          handleAnalysisRequest(req, fakeRes, 'image', content, source_url || content, 'url');
        });
        break;

      // Link-Analyse
      case 'nexus_prompt_link_v1.0':
        result = await new Promise(resolve => {
          const fakeRes = { json: resolve, status: () => fakeRes };
          handleAnalysisRequest(req, fakeRes, 'link', content, source_url || content, 'url');
        });
        break;

      default:
        return res
          .status(400)
          .json({ success: false, error: `Unbekannter NextPrompt: ${nextPrompt}` });
    }

    // 3) Ergebnis zurückgeben
    return res.json({ success: true, meta, ...result });

  } catch (err) {
    console.error('Fehler im /nexus-Endpoint:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;