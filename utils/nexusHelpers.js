// utils/nexusHelpers.js
// Hilfsfunktionen für Nexus (REPARIERT - robuste JSON-Extraktion)

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
 * ROBUSTE JSON-EXTRAKTION - findet komplette JSON-Objekte
 * @param {string} text - Text mit JSON-Block
 * @returns {string} Extrahiertes JSON oder Fehler-JSON
 */
function extractJsonBlock(text) {
  // Methode 1: JSON in ```json Code-Block
  const codeBlockMatch = text.match(/```json\s*([\s\S]*?)\s*```/);
  if (codeBlockMatch) {
    try {
      const jsonStr = codeBlockMatch[1].trim();
      JSON.parse(jsonStr); // Validierung
      return jsonStr;
    } catch (e) {
      console.warn('JSON in Code-Block ungültig:', e.message);
    }
  }

  // Methode 2: Erstes vollständiges JSON-Objekt finden
  let braceCount = 0;
  let startIndex = -1;
  let endIndex = -1;
  
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '{') {
      if (braceCount === 0) {
        startIndex = i; // Start des JSON-Objekts
      }
      braceCount++;
    } else if (text[i] === '}') {
      braceCount--;
      if (braceCount === 0 && startIndex !== -1) {
        endIndex = i; // Ende des JSON-Objekts
        break;
      }
    }
  }

  if (startIndex !== -1 && endIndex !== -1) {
    try {
      const jsonStr = text.substring(startIndex, endIndex + 1);
      JSON.parse(jsonStr); // Validierung
      return jsonStr;
    } catch (e) {
      console.warn('Extrahiertes JSON ungültig:', e.message);
    }
  }

  // Fallback: Fehler-JSON
  console.error('Kein gültiges JSON gefunden in Text:', text.substring(0, 200) + '...');
  return JSON.stringify({ error: 'Kein JSON-Block gefunden oder ungültig' });
}

/**
 * Klassifiziert einen Text und gibt Metadaten als JSON zurück.
 * @param {string} contentRaw - Roher Text
 * @param {string} sourceUrl - Ursprungs-URL
 */
async function classifyContent(contentRaw, sourceUrl) {
  try {
    const tpl = await fs.readFile(CLASSIFIER_PROMPT_PATH, 'utf8');
    const prompt = tpl.replace('{CONTENT}', contentRaw)
                      .replace('{SOURCEURL}', sourceUrl || 'N/A');
    
    const res = await openai.chat.completions.create({
      model: COMPLETION_MODEL,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.1,
      max_tokens: 2000 // Ausreichend für Klassifizierung
    });
    
    const jsonStr = res.choices[0]?.message?.content;
    if (!jsonStr) throw new Error('Keine Antwort vom Klassifizierer');
    
    return JSON.parse(jsonStr);
  } catch (error) {
    console.error('Fehler bei classifyContent:', error);
    return { 
      NextPrompt: 'nexus_prompt_text_v1.0', 
      error: error.message 
    };
  }
}

/**
 * Erzeugt Nexus-Markdown und JSON-Tags für ein Objekt.
 * @param {{archetype:string, contextUUID:string, contentRaw:string, sourceUrl:string}} params
 */
async function generateNexusObject({ archetype, contextUUID, contentRaw, sourceUrl }) {
  try {
    const id = uuidv7();
    const timestamp = new Date().toISOString();
    const tpl = await fs.readFile(CAPTURE_PROMPT_PATH, 'utf8');
    
    const finalPrompt = tpl.replace('{CONTENT}', contentRaw)
                           .replace('{SOURCEURL}', sourceUrl || 'N/A')
                           .replace('{UUID}', id)
                           .replace('{TIMESTAMP_ISO}', timestamp);
    
    const resp = await openai.chat.completions.create({
      model: COMPLETION_MODEL,
      messages: [{ role: 'user', content: finalPrompt }],
      temperature: 0.2,
      max_tokens: 4000 // ERHÖHT! War 2000, jetzt 4000
    });
    
    const text = resp.choices[0]?.message?.content;
    if (!text) throw new Error('Keine Antwort von OpenAI API');

    // REPARIERT: Robuste JSON-Extraktion statt kaputtem Regex
    const tagsJson = extractJsonBlock(text);

    const tsName = timestamp.replace(/[:.]/g, '').substring(0,15)+'Z';
    const base = [ contextUUID, id, archetype.toLowerCase(), tsName ].filter(Boolean).join('_');

    return {
      nexusMd: { filename: `${base}.nexus.md`, content: text },
      tagsJson: { filename: `${base}.tags.json`, content: tagsJson }
    };
  } catch (error) {
    console.error('Fehler bei generateNexusObject:', error);
    
    // Fallback-Objekt im Fehlerfall
    const id = uuidv7();
    const timestamp = new Date().toISOString();
    const tsName = timestamp.replace(/[:.]/g, '').substring(0,15)+'Z';
    const base = [ contextUUID, id, archetype.toLowerCase(), tsName ].filter(Boolean).join('_');
    
    return {
      nexusMd: { filename: `${base}.nexus.md`, content: `# Fehler bei Generierung\n\n${error.message}` },
      tagsJson: { filename: `${base}.tags.json`, content: JSON.stringify({ error: error.message }) }
    };
  }
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