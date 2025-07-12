// modules/nexus.js
// All-in-One Nexus Router

const express = require('express');
const router = express.Router();

// Import helper functions from index.js
const {
  classifyContent,
  generateNexusObject,
  handleAnalysisRequest
} = require('../index');

/**
 * POST /nexus
 * Classify content, then route to the appropriate analyzer
 */
router.post('/', async (req, res) => {
  const { content, source_url, context_uuid } = req.body;

  if (!content) {
    return res.status(400).json({ success: false, error: 'Kein Content zum Verarbeiten übermittelt.' });
  }

  try {
    // 1. Klassifizieren
    const meta = await classifyContent(content, source_url);
    const next = meta.NextPrompt; // e.g. 'nexus_prompt_text_v1.0'

    // 2. Analysieren je nach NextPrompt
    let result;
    switch (next) {
      case 'nexus_prompt_text_v1.0':
        // Text analysieren
        result = await generateNexusObject({
          archetype: 'text',
          contextUUID: context_uuid || 'default-nexus-context',
          contentRaw: content,
          sourceUrl: source_url
        });
        break;

      case 'nexus_prompt_image_v1.0':
        // Bild analysieren
        result = await new Promise(resolve => {
          // reuse handleAnalysisRequest logic by faking res.json
          const fakeRes = { json: resolve, status: () => fakeRes };
          handleAnalysisRequest(req, fakeRes, 'image', content, source_url || content, 'url');
        });
        break;

      case 'nexus_prompt_link_v1.0':
        // Link analysieren
        result = await new Promise(resolve => {
          const fakeRes = { json: resolve, status: () => fakeRes };
          handleAnalysisRequest(req, fakeRes, 'link', content, source_url || content, 'url');
        });
        break;

      default:
        return res.status(400).json({ success: false, error: `Unbekannter NextPrompt: ${next}` });
    }

    // 3. Rückgabe
    return res.json({ success: true, meta, ...result });
  } catch (err) {
    console.error('Fehler im /nexus-Endpoint:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;