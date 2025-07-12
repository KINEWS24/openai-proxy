// utils/nexusHelpers.js
// Hilfsfunktionen für Nexus (klassifizieren, Nexus-Objekt generieren, Analyse-Request-Wrapper)

const fs = require('fs').promises;
const path = require('path');
const { uuidv7 } = require('uuidv7');
const { OpenAI } = require('openai');

// Globale Konfigurationen (Pfad-Anpassung relativ zu utils/)
const BASE_DIR                 = path.resolve(__dirname, '..');
const CAPTURE_PROMPT_PATH      = path.join(BASE_DIR, 'nexus_prompt_v5.3.txt');
const CLASSIFIER_PROMPT_PATH   = path.join(BASE_DIR, 'nexus_prompt_classifier_v1.0.txt');
const CLASSIFIER_OUTPUT_DIR    = path.join(BASE_DIR, 'classifier-output');
const OPENAI_API_KEY           = process.env.OPENAI_API_KEY;
const MAX_CONTENT_LENGTH       = 8000;
const COMPLETION_MODEL         = 'gpt-4o';

// OpenAI-Client initialisieren
if (!OPENAI_API_KEY) {
  console.error('FATAL: OPENAI_API_KEY fehlt für Nexus-Utilities');
  process.exit(1);
}
const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

// Verzeichnis für Klassifizierer-Ausgabe sicherstellen
fs.mkdir(CLASSIFIER_OUTPUT_DIR, { recursive: true }).catch(err => {
  console.error('FATAL: Konnte classifier-output nicht erstellen', err);
  process.exit(1);
});

/**
 * Klassifiziert einen Text und gibt Metadaten als JSON zurück.
 * @param {string} contentRaw - Roher Text
 * @param {string} sourceUrl - Ursprungs-URL
 */
async function classifyContent(contentRaw, sourceUrl) {
  const tpl = await fs.readFile(CLASSIFIER_PROMPT_PATH, 'utf8');
  const prompt = tpl.replace('{CONTENT}', contentRaw)
                    .replace('{SOURCEURL}', sourceUrl || 'N/A');
  const res = await openai.chat.completions.create({
    model: COMPLETION_MODEL,
    messages: [{ role: 'user', content: prompt }]
  });
  const jsonStr = res.choices[0]?.message?.content;
  if (!jsonStr) throw new Error('Keine Antwort vom Klassifizierer');
  return JSON.parse(jsonStr);
}

/**
 * Erzeugt Nexus-Markdown und JSON-Tags für ein Objekt.
 * @param {{archetype:string, contextUUID:string, contentRaw:string, sourceUrl:string}} params
 */
async function generateNexusObject({ archetype, contextUUID, contentRaw, sourceUrl }) {
  const id = uuidv7();
  const timestamp = new Date().toISOString();
  const tpl = await fs.readFile(CAPTURE_PROMPT_PATH, 'utf8');
  const finalPrompt = tpl.replace('{CONTENT}', contentRaw)
                         .replace('{SOURCEURL}', sourceUrl || 'N/A')
                         .replace('{UUID}', id)
                         .replace('{TIMESTAMP_ISO}', timestamp);
  const resp = await openai.chat.completions.create({
    model: COMPLETION_MODEL,
    messages: [{ role: 'user', content: finalPrompt }]
  });
  const text = resp.choices[0]?.message?.content;
  if (!text) throw new Error('Keine Antwort von OpenAI API');

  const tagsMatch = text.match(/{[\s\S]*?}/);
  const tagsJson = tagsMatch ? tagsMatch[0] : JSON.stringify({ error: 'Kein JSON-Block' });

  const tsName = timestamp.replace(/[:.]/g, '').substring(0,15)+'Z';
  const base = [ contextUUID, id, archetype.toLowerCase(), tsName ].filter(Boolean).join('_');

  return {
    nexusMd: { filename: `${base}.nexus.md`, content: text },
    tagsJson: { filename: `${base}.tags.json`, content: tagsJson }
  };
}

/**
 * Wrapper: führt generateNexusObject aus und schickt direkt per res.json()
 */
async function handleAnalysisRequest(req, res, archetype, contentRaw, sourceUrl, extension) {
  try {
    const { context_uuid } = req.body;
    const result = await generateNexusObject({
      archetype,
      contextUUID: context_uuid || 'default-nexus-context',
      contentRaw,
      sourceUrl
    });
    result.originalFilename = `${result.nexusMd.filename.replace('.nexus.md','')}.original.${extension}`;
    return res.json({ success: true, ...result });
  } catch (e) {
    console.error(`Fehler /analyze-${archetype}:`, e);
    return res.status(500).json({ success: false, error: e.message });
  }
}

module.exports = { classifyContent, generateNexusObject, handleAnalysisRequest };
