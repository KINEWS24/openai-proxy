// modules/nexus.js
// All-in-One Nexus Router (v26)

const express = require('express');
const router = express.Router();

// Nexus-Helpers (müssen in utils/nexusHelpers.js liegen)
const {
  classifyContent,
  generateNexusObject,
  handleAnalysisRequest
} = require('../utils/nexusHelpers');

/**
 * POST /nexus
 * 1) Klassifizieren mittels classifyContent
 * 2) Je nach meta.NextPrompt Text-, Bild- oder Link‐Analyse aufrufen
 * 3) nexusMd + tagsJson gemeinsam mit meta zurückliefern
 */
router.post('/', async (req, res) => {
  const { content, source_url, context_uuid } = req.body;
  if (!content) {
    return res.status(400).json({
      success: false,
      error: 'Kein Content zum Verarbeiten übermittelt.'
    });
  }

  try {
    // 1) Klassifikation
    const meta = await classifyContent(content, source_url);
    const nextPrompt = meta.NextPrompt;

    let result;

    // 2) Je nach NextPrompt die richtige Analyse ausführen
    switch (nextPrompt) {
      case 'nexus_prompt_text_v1.0':
        result = await generateNexusObject({
          archetype: 'text',
          contextUUID: context_uuid || 'default-nexus-context',
          contentRaw: content,
          sourceUrl: source_url
        });
        break;

      case 'nexus_prompt_image_v1.0':
        result = await new Promise(resolve => {
          const fakeRes = { json: resolve, status: () => fakeRes };
          handleAnalysisRequest(req, fakeRes, 'image', content, source_url || content, 'url');
        });
        break;

      case 'nexus_prompt_link_v1.0':
        result = await new Promise(resolve => {
          const fakeRes = { json: resolve, status: () => fakeRes };
          handleAnalysisRequest(req, fakeRes, 'link', content, source_url || content, 'url');
        });
        break;

      default:
        return res.status(400).json({
          success: false,
          error: `Unbekannter NextPrompt: ${nextPrompt}`
        });
    }

    // 3) Ergebnis zurückgeben
    return res.json({ success: true, meta, ...result });

  } catch (err) {
    console.error('Fehler im /nexus-Endpoint:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;