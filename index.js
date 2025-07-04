const express = require("express");
const fetch = require("node-fetch");
const cheerio = require("cheerio");
const { OpenAI } = require("openai");

const app = express();

// CORS Middleware
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    
    if (req.method === 'OPTIONS') {
        res.sendStatus(200);
    } else {
        next();
    }
});

app.use(express.json());

// OpenAI Konfiguration
const openai = new OpenAI({ 
    apiKey: process.env.OPENAI_API_KEY 
});

// Test-Endpoint
app.get("/", (req, res) => {
    res.json({ 
        message: "OpenAI Proxy Server läuft!",
        timestamp: new Date().toISOString(),
        endpoints: {
            "GET /": "Server Status",
            "POST /openai": "Reine Text-Analyse mit OpenAI",
            "POST /scrape-and-analyze-url": "URL-Analyse mit OpenAI",
            "POST /analyze-image-url": "Bild-Analyse mit OpenAI (Prompt V5.2)"
        }
    });
});

// Health Check Endpoint
app.get("/health", (req, res) => {
    res.json({ 
        status: "OK", 
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

// Endpunkt für reine Text-Analyse
app.post("/openai", async (req, res) => {
    try {
        if (!process.env.OPENAI_API_KEY) {
            return res.status(500).json({ error: "OpenAI API Key nicht konfiguriert" });
        }
        
        const completion = await openai.chat.completions.create({
            model: req.body.model || "gpt-4o",
            messages: req.body.messages,
        });
        
        res.json(completion);

    } catch (error) {
        console.error("Fehler im /openai Endpunkt:", error);
        res.status(500).json({ error: "Fehler bei der OpenAI-Anfrage" });
    }
});

// Endpunkt für Scraping und Link-Analyse
app.post("/scrape-and-analyze-url", async (req, res) => {
    const { url } = req.body;
    
    if (!url) return res.status(400).json({ error: "No URL provided" });
    
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        
        const html = await response.text();
        const $ = cheerio.load(html);
        const title = $("title").text().trim() || "Kein Titel gefunden";
        const article = ($("article").text() || $("main").text() || $("body").text()).substring(0, 4000);

        // Hier wird der V5.2 Prompt für die Link-Analyse verwendet
        const prompt = getSynapseFlowPrompt("Text", article, { sourceUrl: url, title: title });

        const completion = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [{ role: "user", content: prompt }],
        });
        
        const analysis = completion.choices[0].message.content;
        
        res.json({ success: true, title: title, analysis: analysis });
        
    } catch (error) {
        console.error("Fehler bei Link-Analyse:", error);
        res.status(500).json({ error: "Fehler beim Verarbeiten des Links", details: error.message });
    }
});

// NEU: Endpunkt für die Bild-Analyse mit dem V5.2 Prompt
app.post("/analyze-image-url", async (req, res) => {
    const { url } = req.body;

    if (!url) {
        return res.status(400).json({ error: "No image URL provided" });
    }

    try {
        if (!process.env.OPENAI_API_KEY) {
            throw new Error("OpenAI API Key nicht konfiguriert");
        }

        console.log(`Analysiere Bild von URL: ${url}`);
        
        // Der V5.2 Prompt wird hier als Anweisung für das Bild verwendet
        const prompt = getSynapseFlowPrompt("Bild", url);

        const completion = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [{
                role: "user",
                content: [
                    { type: "text", text: prompt },
                    { type: "image_url", image_url: { "url": url } },
                ],
            }],
            max_tokens: 1500,
        });

        const analysis = completion.choices[0].message.content;
        
        // Wir versuchen, den Titel aus der Analyse zu extrahieren, um ihn zurückzugeben
        const titleMatch = analysis.match(/\*\*(.*?)\*\*/);
        const title = titleMatch ? titleMatch[1] : "Bildanalyse";

        res.json({ title: title, analysis: analysis });

    } catch (error) {
        console.error("Fehler bei der Bild-Analyse:", error);
        res.status(500).json({ error: "Fehler bei der OpenAI Vision-Anfrage" });
    }
});

// 404 Handler
app.use('*', (req, res) => {
    res.status(404).json({ error: "Endpoint nicht gefunden" });
});

// Port-Konfiguration
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Proxy läuft auf Port ${PORT}`);
});


// ZENTRALE PROMPT-FUNKTION
function getSynapseFlowPrompt(archetype, content, metadata = {}) {
    const inputSection = `
Input-Objekt:
- Archetyp (vorgegeben): ${archetype}
- Inhalt: ${archetype === 'Bild' ? `Bild unter der URL: ${content}` : content}
- Zusatz-Metadaten: ${JSON.stringify(metadata)}
`;

    // Der von dir bereitgestellte V5.2 Prompt
    const promptCore = `
GPT-PROMPT SYNAPSEFLOW OBJEKTGENERIERUNG V5.2
(Mit Standard-UserID)
1. Gesamtziel & Kernaufgabe:
Deine primäre Aufgabe ist die tiefgehende Analyse eines beliebigen digitalen Inputs (Objekt) für die SynapseFlow Knowledge Base. Du sollst ALLE potenziell relevanten Informationen aus diesem Objekt abstrahieren, es klassifizieren, strukturieren, verschlagworten und kontextuell auffindbar machen. Das Ergebnis muss ein standardisierter Output sein, der sowohl für Menschen exzellent lesbar (insbesondere für Google Docs optimiert) als auch für Maschinen fehlerfrei und zu 100% konsistent verarbeitbar ist (validiertes JSON). Absolute Konsistenz, Zuverlässigkeit und Reproduzierbarkeit sind die höchsten Güter.
2. Input:
Du erhältst:
Den primären Inhalt (Text, Metadaten, Bild-URL/Daten, Audio-Referenz etc.).
Opt.: Zusatzinformationen (Quell-URL, Nutzerhinweise).
(Die explizite UserID wird aktuell nicht benötigt, siehe Punkt 3).
3. Standard OwnerUserID:
Da aktuell nur ein Nutzer existiert, verwende immer und ausschließlich die folgende feste UserID für das Feld OwnerUserID im JSON und im Header: USERID_DEFAULT_SINGLE_USER.
4. Schritt 1 (Pflicht): Archetypen-Klassifizierung:
Analysiere den primären Inhalt und klassifiziere ihn ZUERST eindeutig einem der vier fundamentalen Archetypen: Text, Bild, Audio oder Video.
5. Schritt 2: Standardisierte Output-Generierung:
Führe die folgenden Unterschritte exakt in dieser Reihenfolge aus:
5.1. Standard UserID verwenden: Notiere die fest definierte Standard-UserID (USERID_DEFAULT_SINGLE_USER) für dieses Objekt.
5.2. Objekt-UID Generierung (UUID v7): Erzeuge eine neue, eindeutige UUID v7 für dieses spezifische Wissensobjekt. (UUID v7 bevorzugt wegen Zeit-Sortierbarkeit).
5.3. UZT (Universeller Zeitstempel) Bestimmung:
Ermittle den relevantesten Zeitstempel (Priorität: Ereignisdatum > Erstellungsdatum Quelle > Änderungsdatum Quelle > Verarbeitungszeitpunkt).
Formatiere zwingend im ISO 8601 Format mit Zeitzone (z.B. 2025-04-11T16:03:07+02:00).
5.4. Hashtag Generierung (Max 10, Komma-getrennt):
Tag 1 (Pflicht): #<Archetyp> (aus Schritt 4).
Tag 2 (Optional): #<PersonenName> (Wenn Objekt klar Person zugeordnet).
Tag 3 (Optional): Primäres #<Thema>.
Tags 4-10 (Optional): Bis zu 7 weitere, hoch relevante Schlagwörter (desc. Wichtigkeit). Nur sichere Tags, im Zweifel weniger. Normiert.
5.5. Erstelle die Output-Sektionen (A-K für Google Docs): Halte Reihenfolge und Formatierung strikt ein. Genau eine Leerzeile zwischen den Sektionen.
(A) Header-Zeile (Pflicht - ERSTE Zeile des Dokuments):
Format: UserID:USERID_DEFAULT_SINGLE_USER | UZT:<ISO8601_aus_5.3> | UID:<UUID_v7_aus_5.2> | Tags:<#Tag1>,<#Tag2>,...,<#Tag7_aus_5.4>Zeige die 7 wichtigsten generierten Hashtags (oder alle, falls < 7).
(B) Titel:
Folgt nach A, 1 Leerzeile Abstand. Format: **<Objekt-Titel>**.
(C) Thema:
Folgt nach B, 1 Leerzeile Abstand. Format: Thema: <1-Zeilen-Kerninhalt (kein Fettdruck)>
(D) Kern-Information (Archetyp-abhängig):
Folgt nach C, 1 Leerzeile Abstand.
WENN Archetyp = Text: Format **Inhalts-Kernpunkte:**\n - <Punkt 1>\n ... [- Pkt 5]. (3-5 detaillierte Bullet Points).
WENN Archetyp = Bild: Format **Bildbeschreibung:** <Detaillierte Beschreibung>.
WENN Archetyp = Audio / Video: Format **Transkript / Kerninhalte:** <Transkript (kurz/verfügbar) ODER detaillierte Zusammenfassung, ggf. Zeitmarken/Sprecher (siehe G).>.
(E) Schlagwörter (Gesamt):
Folgt nach D, 1 Leerzeile Abstand. Format: Schlagwörter: <#Tag1>,<#Tag2>,...,<#Tag10> (Alle Tags aus 5.4).
(F) JSON Block (Strukturelle Repräsentation):
Folgt nach E, 1 Leerzeile Abstand. Valides JSON. 100% konsistent zu Text-Sektionen!JSON
{
"OwnerUserID": "USERID_DEFAULT_SINGLE_USER", // NEU: Feste Standard-UserID
"UID": "<UUID v7 aus 5.2 / A>",
"UZT_ISO8601": "<Timestamp aus 5.3 / A>",
"Archetype": "<Archetyp aus 4 / 5.4>",
"ObjectType": "<Spezifischer Typ aus Pt. 7>",
"Subject": "<Thema aus C>",
"Tags": ["<#Tag1>", "<#Tag2>", ...], // ALLE Tags aus 5.4 / E
"Title": "<Titel aus B>",
"Summary": "<Immer 1-2 Satz neutrale Zusammenfassung>",
"KeyPoints": [ // Nur für Archetyp Text (aus D), sonst []
"<Kernpunkt 1>", ...
],
"DocumentStructure": [ // Nur für Archetyp Text (siehe G), sonst []
// Bsp: "1. Einleitung", " 1.1 Hintergrund"
],
"ImageDescription": "<Nur für Archetyp Bild (aus D)>", // Sonst null
"AudioVideoSummary": "<Nur für Audio/Video (aus D)>", // Sonst null
"ContentReference": "<Opt.: Urspr. Dateiname, URL etc.>",
"Properties": {
// Hier strukturierte, extrahierte Daten ablegen (Kontakte, etc.)
"ExtractedContacts": [...],
// ... andere extrahierte Daten ...
"SourceMetadata": {"Author": "...", ...},
"SuggestedCollections": ["SammlungA"] // Opt. Vorschläge
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
Prüfe rigoros VOR der Ausgabe:UserID: Ist die Standard-UserID (USERID_DEFAULT_SINGLE_USER) korrekt in Header (A) und JSON (F) enthalten?
Klassifikation: Archetyp korrekt? ObjectType passend & aus Liste (Pt. 7)? Konsistent in A & F?
UZT: Plausibel & ISO-Format? Konsistent in A & F?
Hashtags: Relevant? Max. 10? Komma-getrennt? #<Archetyp> als erster? Konsistent in A, E, F?
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
Nach Bestimmung des Archetyps (Text, Bild, Audio, Video), wähle EXAKT EINEN passenden, spezifischen ObjectType: TäglicheNotizen, Weblinks, Seiten, Ideen, Organisationen, Meetings, Personen, Projekte, Orte, Tweets, Dateien, Bilder, Schlagwörter, Audio, Videos, PDFs, Texte, AIReports, RohdatenSammlungen, Themen, Emails. (Inspiration aus Bild capacaties 1.jpg nutzen).
8. Konsistenz-Mandat (ABSOLUT KRITISCH!):
Exakte Übereinstimmung Text (A-J) <=> JSON (F) ist ZWINGEND! Überprüfe dies im Self-Check (5.6)!
9. Finale Anweisung:
Analysiere den Input. Befolge ALLE Schritte (4 bis 5.6) und Regeln dieses Prompts (V5.2) meticulously, unter Verwendung der Standard-UserID. Generiere den vollständigen Output, stelle Qualität & Konsistenz sicher. Führe Self-Check durch -> Ergebnis in K.
`;
    return inputSection + promptCore;
}
