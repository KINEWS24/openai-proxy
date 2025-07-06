const express = require("express");
const fetch = require("node-fetch");
const cheerio = require("cheerio");
const { OpenAI } = require("openai");
const { v7: uuidv7 } = require('uuid');

const app = express();
app.use(express.json({ limit: '10mb' }));

app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    if (req.method === 'OPTIONS') return res.sendStatus(200);
    next();
});

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

app.get("/", (req, res) => res.json({ message: "ThinkAI Nexus Proxy v2.0 - Nexus Ready!" }));

// ZENTRALE NEXUS-PROMPT-FUNKTION V5.2
function getNexusPrompt(archetype, content, metadata = {}) {
    const inputSection = `Input-Objekt:\n- Archetyp (vorgegeben): ${archetype}\n- Inhalt: ${content}\n- Zusatz-Metadaten: ${JSON.stringify(metadata)}`;
    
    const nexusPromptCore = `

GPT-PROMPT NEXUS OBJEKTGENERIERUNG V5.2
(Mit Standard-UserID)

1. Gesamtziel & Kernaufgabe:
Deine primäre Aufgabe ist die tiefgehende Analyse eines beliebigen digitalen Inputs (Objekt) für die Nexus Knowledge Base. Du sollst ALLE potenziell relevanten Informationen aus diesem Objekt abstrahieren, es klassifizieren, strukturieren, verschlagworten und kontextuell auffindbar machen. Das Ergebnis muss ein standardisierter Output sein, der sowohl für Menschen exzellent lesbar (insbesondere für Google Docs optimiert) als auch für Maschinen fehlerfrei und zu 100% konsistent verarbeitbar ist (validiertes JSON). Absolute Konsistenz, Zuverlässigkeit und Reproduzierbarkeit sind die höchsten Güter.

2. Input:
Du erhältst:
Den primären Inhalt (Text, Metadaten, Bild-URL/Daten, Audio-Referenz etc.).
Opt.: Zusatzinformationen (Quell-URL, Nutzerhinweise).
(Die explizite UserID wird aktuell nicht benötigt, siehe Punkt 3).

3. Standard OwnerUserID:
Da aktuell nur ein Nutzer existiert, verwende immer und ausschließlich die folgende feste UserID für das Feld OwnerUserID im JSON und im Header: USERID_DEFAULT_SINGLE_USER.

4. Schritt 1 (Pflicht): Archetypen-Klassifizierung:
Analysiere den primären Inhalt und klassifiziere ihn ZUERST eindeutig einem der vier fundamentalen Archetypen: text, img, aud oder vid.

5. Schritt 2: Standardisierte Output-Generierung:
Führe die folgenden Unterschritte exakt in dieser Reihenfolge aus:

5.1. Standard UserID verwenden: Notiere die fest definierte Standard-UserID (USERID_DEFAULT_SINGLE_USER) für dieses Objekt.

5.2. Objekt-UID Generierung (UUID v7): Erzeuge eine neue, eindeutige UUID v7 für dieses spezifische Wissensobjekt. (UUID v7 bevorzugt wegen Zeit-Sortierbarkeit).

5.3. UZT (Universeller Zeitstempel) Bestimmung:
Ermittle den relevantesten Zeitstempel (Priorität: Ereignisdatum > Erstellungsdatum Quelle > Änderungsdatum Quelle > Verarbeitungszeitpunkt).
Formatiere zwingend im ISO 8601 Format mit Zeitzone (z.B. 2025-07-06T1603+02:00).

5.4. Hashtag Generierung (Max 7, Komma-getrennt):
Tag 1 (Pflicht): #<Archetyp> (aus Schritt 4).
Tag 2 (Optional): #<PersonenName> (Wenn Objekt klar Person zugeordnet).
Tag 3 (Optional): Primäres #<Thema>.
Tags 4-7 (Optional): Bis zu 4 weitere, hoch relevante Schlagwörter (desc. Wichtigkeit). Nur sichere Tags, im Zweifel weniger. Normiert.

5.5. Erstelle die Output-Sektionen (A-K für Google Docs): Halte Reihenfolge und Formatierung strikt ein. Genau eine Leerzeile zwischen den Sektionen.

(A) Header-Zeile (Pflicht - ERSTE Zeile des Dokuments):
Format: UserID:USERID_DEFAULT_SINGLE_USER | UZT:<ISO8601_aus_5.3> | UID:<UUID_v7_aus_5.2> | Tags:<#Tag1>,<#Tag2>,...,<#Tag7_aus_5.4>
Zeige die wichtigsten generierten Hashtags (bis zu 7).

(B) Titel:
Folgt nach A, 1 Leerzeile Abstand. Format: **<Objekt-Titel>**.

(C) Thema:
Folgt nach B, 1 Leerzeile Abstand. Format: Thema: <1-Zeilen-Kerninhalt (kein Fettdruck)>

(D) Kern-Information (Archetyp-abhängig):
Folgt nach C, 1 Leerzeile Abstand.
WENN Archetyp = text: Format **Inhalts-Kernpunkte:**\n - <Punkt 1>\n ... [- Pkt 5]. (3-5 detaillierte Bullet Points).
WENN Archetyp = img: Format **Bildbeschreibung:** <Detaillierte Beschreibung>.
WENN Archetyp = aud / vid: Format **Transkript / Kerninhalte:** <Transkript (kurz/verfügbar) ODER detaillierte Zusammenfassung, ggf. Zeitmarken/Sprecher>.

(E) Schlagwörter (Gesamt):
Folgt nach D, 1 Leerzeile Abstand. Format: Schlagwörter: <#Tag1>,<#Tag2>,...,<#Tag7> (Alle Tags aus 5.4).

(F) JSON Block (Strukturelle Repräsentation):
Folgt nach E, 1 Leerzeile Abstand. Valides JSON. 100% konsistent zu Text-Sektionen!

{
"OwnerUserID": "USERID_DEFAULT_SINGLE_USER",
"UID": "<UUID v7 aus 5.2 / A>",
"UZT_ISO8601": "<Timestamp aus 5.3 / A>",
"Archetype": "<Archetyp aus 4 / 5.4>",
"ObjectType": "<Spezifischer Typ aus Pt. 7>",
"Subject": "<Thema aus C>",
"Tags": ["<#Tag1>", "<#Tag2>", ...],
"Title": "<Titel aus B>",
"Summary": "<Immer 1-2 Satz neutrale Zusammenfassung>",
"KeyPoints": [
// Nur für Archetyp text (aus D), sonst []
],
"DocumentStructure": [
// Nur für Archetyp text (siehe G), sonst []
],
"ImageDescription": "<Nur für Archetyp img (aus D)>",
"AudioVideoSummary": "<Nur für aud/vid (aus D)>",
"ContentReference": "<Opt.: Urspr. Dateiname, URL etc.>",
"Properties": {
"ExtractedContacts": [],
"SourceMetadata": {"Author": "...", ...},
"SuggestedCollections": []
},
"RawExtractedData": null
}

(G) Detaillierte Extraktion / Format-spezifische Analyse:
Folgt nach F, 1 Leerzeile Abstand. Nur relevante Sektionen!
Mögliche Sektionen: **Extrahierte Kontaktdaten:**, **Erkannte Aufgaben/Todos:**, **Dokumentstruktur / Inhaltsverzeichnis:**, **Transkript (Audio/Video):**.

(H) Objekt-Metadaten:
Folgt nach G, 1 Leerzeile Abstand. Start: ---. Format: --- **Objekt-Metadaten**\n - Typ: <Typ Quelle>\n - Größe: <Größe>\n .... Extrahiere alle verfügbaren Quell-Metadaten (außer Name für J). Wenn keine -> nur Überschrift.

(I) Quelle (Optional):
Folgt nach H, 1 Leerzeile Abstand. Nur wenn explizite Quelle im Input war. Format: Quelle: <URL/Referenz>.

(J) Objekt-Name:
Folgt nach I (oder H), 1 Leerzeile Abstand. LETZTE Zeile vor K. Format: Name: <Original Dateiname.ext / Quelle Bezeichner>

(K) Verification Check (Pflicht):
ALLERLETZTE Zeile. Nach Self-Check (5.6). Format: Verification: OK / Verification: Check Needed - [Grund].

5.6. Finaler Self-Check (Intern durchführen, Ergebnis in K):
Prüfe rigoros VOR der Ausgabe:
UserID: Ist die Standard-UserID (USERID_DEFAULT_SINGLE_USER) korrekt in Header (A) und JSON (F) enthalten?
Klassifikation: Archetyp korrekt? ObjectType passend & aus Liste (Pt. 7)? Konsistent in A & F?
UZT: Plausibel & ISO-Format? Konsistent in A & F?
Hashtags: Relevant? Max. 7? Komma-getrennt? #<Archetyp> als erster? Konsistent in A, E, F?
Datenextraktion: Wurden alle potenziell relevanten Daten (Kontakte, Struktur etc. je nach Archetyp) wahrscheinlich extrahiert und in F/G abgebildet?
Konsistenz: Stimmen ALLE Text-Werte (B-J) mit JSON-Feldern (F) 100% überein?
Format: Alle Regeln (Absätze, Bolding, JSON etc. aus Pt. 6) eingehalten?
Gib das Ergebnis in Sektion K aus. Ziel ist Verification: OK.

6. Detaillierte Formatierungsregeln:
Absätze: EXAKT 1 Leerzeile zw. A-K. Listen Standardformat.
Hervorhebung: NUR **UID:**, **<Titel>**, **Objekt-Metadaten**, **Inhalts-Kernpunkte:** (und ggf. G-Überschriften) fett.
Hashtags: In Header (A) und Liste (E) mit # & komma-getrennt. Im JSON Tags-Array mit #. Keine Leerz. in Tags.
JSON: Strikt valides JSON. Strings escapen. Nicht zutreffende Felder = null, [], {}.
Google Docs: Markdown-Struktur verwenden.

7. Object Type List (Spezifischer Typ - für A & F/JSON):
Nach Bestimmung des Archetyps (text, img, aud, vid), wähle EXAKT EINEN passenden, spezifischen ObjectType: 
TäglicheNotizen, Weblinks, Seiten, Ideen, Organisationen, Meetings, Personen, Projekte, Orte, Tweets, Dateien, Bilder, Schlagwörter, Audio, Videos, PDFs, Texte, AIReports, RohdatenSammlungen, Themen, Emails.

8. Konsistenz-Mandat (ABSOLUT KRITISCH!):
Exakte Übereinstimmung Text (A-J) <=> JSON (F) ist ZWINGEND! Überprüfe dies im Self-Check (5.6)!

9. Finale Anweisung:
Analysiere den Input. Befolge ALLE Schritte (4 bis 5.6) und Regeln dieses Prompts (V5.2) meticulously, unter Verwendung der Standard-UserID. Generiere den vollständigen Output, stelle Qualität & Konsistenz sicher. Führe Self-Check durch -> Ergebnis in K.`;

    return inputSection + nexusPromptCore;
}

// HILFSFUNKTION: Dateinamen generieren
function generateNexusFilename(analysisResult, originalName, contextUUID) {
    try {
        const json = JSON.parse(analysisResult.match(/\{[\s\S]*\}/)[0]);
        const timestamp = json.UZT_ISO8601.substring(0, 16).replace(':', ''); // 2025-07-06T1603
        const objectId = json.UID.substring(0, 8); // Erste 8 Zeichen der UUID
        const archetype = json.Archetype || 'text';
        const tags = json.Tags.slice(0, 5).join('_').replace(/#/g, ''); // Erste 5 Tags ohne #
        
        return `${contextUUID}_${archetype}_${timestamp}_${objectId}_${tags}`;
    } catch (error) {
        console.error('Fehler beim Generieren des Dateinamens:', error);
        const timestamp = new Date().toISOString().substring(0, 16).replace(':', '');
        return `${contextUUID}_text_${timestamp}_${uuidv7().substring(0, 8)}_fallback`;
    }
}

// ENDPOINT: Markierter Text analysieren
app.post("/analyze-text", async (req, res) => {
    try {
        const { user_id, folder_id, type, content, source_url, source_title, context_uuid } = req.body;
        
        if (!content) return res.status(400).json({ error: "Kein Text-Inhalt provided" });
        if (!process.env.OPENAI_API_KEY) return res.status(500).json({ error: "OpenAI API Key nicht konfiguriert" });

        const prompt = getNexusPrompt("text", content, { 
            sourceUrl: source_url, 
            title: source_title 
        });
        
        const completion = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [{ role: "user", content: prompt }],
            temperature: 0.1
        });
        
        const analysis = completion.choices[0].message.content;
        const filename = generateNexusFilename(analysis, source_title || 'text', context_uuid || 'default-uuid');
        
        res.json({
            success: true,
            analysis: analysis,
            filename: filename,
            archetype: "text",
            original_name: source_title || 'markierter-text.txt',
            nexus_snippet: analysis
        });
        
    } catch (error) {
        console.error('Fehler bei Text-Analyse:', error);
        res.status(500).json({ error: "Fehler bei der Text-Analyse", details: error.message });
    }
});

// ENDPOINT: URL scrapen und analysieren  
app.post("/scrape-and-analyze-url", async (req, res) => {
    try {
        const { url, context_uuid } = req.body;
        if (!url) return res.status(400).json({ error: "No URL provided" });
        
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        
        const html = await response.text();
        const $ = cheerio.load(html);
        const title = $("title").text().trim() || "Kein Titel gefunden";
        
        let article = $("article").text() || $("main").text();
        if (!article || article.length < 200) {
            article = $("body").text();
        }
        article = article.replace(/\s\s+/g, ' ').trim().substring(0, 8000);

        if (article.length < 100) {
            return res.status(400).json({ error: "Zu wenig Text auf der Seite gefunden" });
        }
        
        const prompt = getNexusPrompt("text", article, { sourceUrl: url, title: title });
        const completion = await openai.chat.completions.create({
            model: "gpt-4o", 
            messages: [{ role: "user", content: prompt }],
            temperature: 0.1
        });
        
        const analysis = completion.choices[0].message.content;
        const filename = generateNexusFilename(analysis, title, context_uuid || 'default-uuid');
        
        res.json({
            success: true,
            title: title,
            analysis: analysis,
            filename: filename,
            archetype: "text",
            original_name: `${title}.html`,
            nexus_snippet: analysis
        });
        
    } catch (error) {
        console.error('Fehler beim URL-Scraping:', error);
        res.status(500).json({ error: "Fehler beim Verarbeiten des Links", details: error.message });
    }
});

// ENDPOINT: Bilder analysieren
app.post("/analyze-image-data", async (req, res) => {
    try {
        const { url, originalUrl, context_uuid } = req.body;
        const imageUrl = url || originalUrl;
        
        if (!imageUrl) return res.status(400).json({ error: "No image URL provided" });
        if (!process.env.OPENAI_API_KEY) return res.status(500).json({ error: "OpenAI API Key nicht konfiguriert" });

        const prompt = getNexusPrompt("img", `Bild von der URL: ${imageUrl}`);
        const completion = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [{
                role: "user",
                content: [
                    { type: "text", text: prompt },
                    { type: "image_url", image_url: { "url": imageUrl } },
                ],
            }],
            max_tokens: 1500,
            temperature: 0.1
        });

        const analysis = completion.choices[0].message.content;
        const filename = generateNexusFilename(analysis, 'image', context_uuid || 'default-uuid');
        
        // Extrahiere Titel aus der Analyse
        const titleMatch = analysis.match(/\*\*(.*?)\*\*/);
        const title = titleMatch ? titleMatch[1] : "Bildanalyse";

        res.json({
            success: true,
            title: title,
            analysis: analysis,
            filename: filename,
            archetype: "img", 
            original_name: `${title}.jpg`,
            nexus_snippet: analysis
        });
        
    } catch (error) {
        console.error('Fehler bei Bild-Analyse:', error);
        res.status(500).json({ error: "Fehler bei der Bild-Analyse", details: error.message });
    }
});

// LEGACY ENDPOINT für Kompatibilität
app.post("/openai", async (req, res) => {
    try {
        if (!process.env.OPENAI_API_KEY) return res.status(500).json({ error: "OpenAI API Key nicht konfiguriert" });
        const completion = await openai.chat.completions.create({ 
            model: "gpt-4o", 
            messages: req.body.messages,
            temperature: 0.1
        });
        res.json(completion);
    } catch (error) {
        res.status(500).json({ error: "Fehler bei der OpenAI-Anfrage" });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Nexus Server läuft auf Port ${PORT}`));