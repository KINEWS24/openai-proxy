// =====================================
// NEXUS v6.2 - SIMPLIFIED PROMPT SYSTEM INTEGRATION
// Replace in index.js after line ~485 (SCHRITT 5: STANDARD-HILFSFUNKTIONEN)
// =====================================

// ===== ADD AFTER EXISTING IMPORTS (around line 10) =====
// v6.2 Enhanced Constants
const SIMPLIFIED_PROMPT_ENABLED = true; // Feature flag for gradual rollout

// ===== REPLACE ENTIRE "SCHRITT 5: STANDARD-HILFSFUNKTIONEN" SECTION =====

// --- SCHRITT 5: v6.2 SIMPLIFIED ANALYSIS SYSTEM ---

// =====================================
// v6.2 SIMPLIFIED PROMPT DEFINITION
// =====================================

const SIMPLIFIED_ANALYSIS_PROMPT = `
Analysiere diesen Content und antworte NUR im JSON-Format:

{
  "filename": "[YYYY-MM-DD]_[Archetyp]_[Hauptthema]_[Person/Kunde]",
  "archetype": "[Email|Calendar|Contact|Project|Link|Document|Text]", 
  "hashtags": ["#tag1", "#tag2", "#tag3", "#tag4", "#tag5"],
  "summary": "1-3 kurze Sätze was das ist und warum wichtig."
}

REGELN:
- Filename: Datum_Typ_Thema_Person/Quelle (keine Sonderzeichen, max 60 Zeichen)
- Archetype: Einen der 7 Haupttypen wählen  
- Hashtags: Genau 5 Tags - PERSONEN haben HÖCHSTE PRIORITÄT, dann Archetyp, Kunde, Projekt, Wichtigkeit, Thema
- Summary: Maximal 3 Sätze, faktisch, präzise

PERSON/KONTAKT PRIORITY (WICHTIGSTE HASHTAGS):
- Anna Müller → #AnnaMueller
- Lukas Schmidt → #LukasSchmidt  
- Claudia Becker → #ClaudiaBecker
- Maria Müller → #MariaMueller
- Stefan → #Stefan
- Jens → #Jens
- Telefonnummern → #Telefon
- Ansprechpartner → #Ansprechpartner

BEISPIELE:
Filename: "2025-07-13_Contact_Telefonnummer_LukasSchmidt"
Archetype: "Contact"  
Hashtags: ["#LukasSchmidt", "#Telefon", "#BetaSolutions", "#Ansprechpartner", "#Contact"]
Summary: "Lukas Schmidt von Beta Solutions, Telefon +49 30 12345678. Ansprechpartner für Projekt B mit API-Dokumentation Link."

Filename: "2025-07-13_Email_ProjektUpdate_AnnaMueller"
Archetype: "Email"
Hashtags: ["#AnnaMueller", "#Email", "#AlphaGmbH", "#ProjektAlpha", "#Wichtig2"]
Summary: "Anna Müller meldet Meilenstein erreicht bei Projekt Alpha. QA-Test startet nächste Woche. Design-Review bis Freitag erforderlich."

Filename: "2025-07-13_Calendar_KickoffMeeting_ClaudiaBecker"
Archetype: "Calendar"
Hashtags: ["#ClaudiaBecker", "#Calendar", "#CaesarAG", "#Kickoff", "#Meeting"]
Summary: "Kickoff-Meeting für Projekt Cäsar am 15. Juli 2025, 10:00-11:00 Uhr. Online-Meeting mit Claudia Becker von Cäsar AG."
`;

// =====================================
// v6.2 ENHANCED ARCHETYP-ERKENNUNG 
// =====================================

function detectArchetypeV62(content) {
    const contentLower = content.toLowerCase();
    
    // ICS Calendar Detection - HÖCHSTE PRIORITÄT
    if (contentLower.includes('begin:vcalendar') || 
        contentLower.includes('begin:vevent') ||
        contentLower.includes('dtstart:') ||
        contentLower.includes('dtend:')) {
        return 'Calendar';
    }
    
    // Contact Detection - ERWEITERT für bessere Erkennung
    if (contentLower.includes('telefon') || 
        contentLower.includes('+49') ||
        contentLower.includes('ansprechpartner:') ||
        contentLower.includes('kontakt:') ||
        (contentLower.includes('anna müller') || contentLower.includes('lukas schmidt') || contentLower.includes('claudia becker')) ||
        contentLower.match(/\+\d{1,3}\s?\d{1,4}\s?\d{4,}/)) { // International phone patterns
        return 'Contact';  
    }
    
    // Email/Message Detection - ERWEITERT
    if (contentLower.includes('betreff:') || 
        contentLower.includes('von:') ||
        contentLower.includes('subject:') ||
        contentLower.includes('kunde:') ||
        contentLower.match(/\b[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}\b/)) {
        return 'Email';
    }
    
    // Project Detection - ERWEITERT  
    if (contentLower.includes('projekt') ||
        contentLower.includes('meilenstein') ||
        contentLower.includes('status') ||
        contentLower.includes('wichtig') ||
        contentLower.includes('team') ||
        contentLower.includes('qa-test') ||
        contentLower.includes('freigabe')) {
        return 'Project';
    }
    
    // Link Detection
    if (contentLower.includes('http://') || 
        contentLower.includes('https://')) {
        return 'Link';
    }
    
    // Document Detection
    if (contentLower.includes('.pdf') ||
        contentLower.includes('.doc') ||
        contentLower.includes('dokument') ||
        contentLower.includes('api-doku')) {
        return 'Document';
    }
    
    // Text Detection (fallback für alles andere)
    return 'Text';
}

// =====================================
// v6.2 ENHANCED HASHTAG GENERATION 
// =====================================

function generateHashtagsV62(content, archetype) {
    const hashtags = [];
    const contentLower = content.toLowerCase();
    
    // 1. ARCHETYP TAG (immer)
    hashtags.push(`#${archetype}`);
    
    // 2. PERSONEN TAGS - HÖCHSTE PRIORITÄT! 
    if (contentLower.includes('anna müller') || contentLower.includes('anna mueller')) hashtags.push('#AnnaMueller');
    if (contentLower.includes('lukas schmidt')) hashtags.push('#LukasSchmidt');
    if (contentLower.includes('claudia becker')) hashtags.push('#ClaudiaBecker');
    if (contentLower.includes('maria müller') || contentLower.includes('maria mueller')) hashtags.push('#MariaMueller');
    if (contentLower.includes('stefan')) hashtags.push('#Stefan');
    if (contentLower.includes('jens')) hashtags.push('#Jens');
    
    // 3. KONTAKT TAGS
    if (contentLower.includes('telefon') || contentLower.includes('+49') || contentLower.includes('tel:')) hashtags.push('#Telefon');
    if (contentLower.includes('ansprechpartner') || contentLower.includes('kontakt')) hashtags.push('#Ansprechpartner');
    if (contentLower.includes('@') || contentLower.includes('email') || contentLower.includes('mail')) hashtags.push('#Email');
    if (contentLower.includes('https://') || contentLower.includes('http://')) hashtags.push('#Link');
    
    // 4. KUNDEN TAG  
    if (contentLower.includes('alpha')) hashtags.push('#AlphaGmbH');
    if (contentLower.includes('beta')) hashtags.push('#BetaSolutions');  
    if (contentLower.includes('cäsar') || contentLower.includes('caesar')) hashtags.push('#CaesarAG');
    
    // 5. PROJEKT TAG
    if (contentLower.includes('projekt alpha')) hashtags.push('#ProjektAlpha');
    if (contentLower.includes('projekt b')) hashtags.push('#ProjektB');
    if (contentLower.includes('projekt cäsar')) hashtags.push('#ProjektCaesar');
    
    // 6. WICHTIGKEIT TAG
    if (contentLower.includes('wichtig 1')) hashtags.push('#Wichtig1');
    if (contentLower.includes('wichtig 2')) hashtags.push('#Wichtig2');
    if (contentLower.includes('wichtig 3')) hashtags.push('#Wichtig3');
    if (contentLower.includes('dringend') || contentLower.includes('urgent')) hashtags.push('#Dringend');
    
    // 7. THEMEN TAGS
    if (contentLower.includes('meeting') || contentLower.includes('termin')) hashtags.push('#Meeting');
    if (contentLower.includes('update') || contentLower.includes('status')) hashtags.push('#Update');
    if (contentLower.includes('kickoff')) hashtags.push('#Kickoff');
    if (contentLower.includes('design') || contentLower.includes('review')) hashtags.push('#DesignReview');
    if (contentLower.includes('api')) hashtags.push('#API');
    if (contentLower.includes('test') || contentLower.includes('qa')) hashtags.push('#Testing');
    if (contentLower.includes('freigabe')) hashtags.push('#Freigabe');
    if (contentLower.includes('meilenstein')) hashtags.push('#Meilenstein');
    if (contentLower.includes('daily') || contentLower.includes('stand-up')) hashtags.push('#Daily');
    if (contentLower.includes('workshop')) hashtags.push('#Workshop');
    
    // 8. SMART DEDUPLICATION - Remove duplicates, keep most important
    const uniqueHashtags = [...new Set(hashtags)];
    
    // 9. PRIORITY ORDERING - Personen und Kontakte zuerst
    const priorityOrder = ['#AnnaMueller', '#LukasSchmidt', '#ClaudiaBecker', '#Telefon', '#Ansprechpartner'];
    const orderedHashtags = [];
    
    // Add priority tags first
    for (const priority of priorityOrder) {
        if (uniqueHashtags.includes(priority)) {
            orderedHashtags.push(priority);
        }
    }
    
    // Add remaining tags
    for (const tag of uniqueHashtags) {
        if (!orderedHashtags.includes(tag)) {
            orderedHashtags.push(tag);
        }
    }
    
    // Fill up to 5 tags if needed
    while (orderedHashtags.length < 5) {
        if (!orderedHashtags.includes('#Content')) orderedHashtags.push('#Content');
        else if (!orderedHashtags.includes('#Business')) orderedHashtags.push('#Business');
        else if (!orderedHashtags.includes('#Communication')) orderedHashtags.push('#Communication');
        else break;
    }
    
    return orderedHashtags.slice(0, 5); // Maximum 5 tags, priority ordered
}

// =====================================
// v6.2 ENHANCED FILENAME GENERATION
// =====================================

function generateFilenameV62(archetype, content) {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const contentLower = content.toLowerCase();
    
    // Hauptthema extrahieren - ERWEITERT
    let topic = 'Content';
    if (contentLower.includes('projekt-update')) topic = 'ProjektUpdate';
    else if (contentLower.includes('status')) topic = 'StatusUpdate'; 
    else if (contentLower.includes('kickoff')) topic = 'KickoffMeeting';
    else if (contentLower.includes('design review')) topic = 'DesignReview';
    else if (contentLower.includes('stand-up')) topic = 'StandUp';
    else if (contentLower.includes('testplanung')) topic = 'Testplanung';
    else if (contentLower.includes('freigabe')) topic = 'Freigabe';
    else if (contentLower.includes('daily')) topic = 'DailyStandUp';
    else if (contentLower.includes('workshop')) topic = 'Workshop';
    else if (contentLower.includes('telefon') || contentLower.includes('+49')) topic = 'Kontaktdaten';
    else if (contentLower.includes('api-dok')) topic = 'APIDoc';
    else if (contentLower.includes('meeting') || contentLower.includes('termin')) topic = 'Meeting';
    
    // Kunde/Quelle extrahieren - ERWEITERT für PERSONEN
    let source = 'Unknown';
    
    // PERSONEN haben HÖCHSTE PRIORITÄT für Source
    if (contentLower.includes('anna müller') || contentLower.includes('anna mueller')) source = 'AnnaMueller';
    else if (contentLower.includes('lukas schmidt')) source = 'LukasSchmidt';
    else if (contentLower.includes('claudia becker')) source = 'ClaudiaBecker';
    else if (contentLower.includes('maria müller') || contentLower.includes('maria mueller')) source = 'MariaMueller';
    else if (contentLower.includes('stefan')) source = 'Stefan';
    else if (contentLower.includes('jens')) source = 'Jens';
    // FIRMEN als Fallback
    else if (contentLower.includes('alpha')) source = 'AlphaGmbH';
    else if (contentLower.includes('beta')) source = 'BetaSolutions';
    else if (contentLower.includes('cäsar') || contentLower.includes('caesar')) source = 'CaesarAG';
    
    // Spezielle Filename-Patterns für bessere Auffindbarkeit
    if (archetype === 'Contact' && (contentLower.includes('telefon') || contentLower.includes('+'))) {
        topic = 'Telefonnummer';
    }
    
    if (archetype === 'Calendar') {
        topic = 'Termin';
    }
    
    if (archetype === 'Email' && contentLower.includes('wichtig')) {
        const wichtigLevel = contentLower.includes('wichtig 1') ? 'Wichtig1' : 
                           contentLower.includes('wichtig 2') ? 'Wichtig2' : 
                           contentLower.includes('wichtig 3') ? 'Wichtig3' : 'Wichtig';
        topic = `${topic}_${wichtigLevel}`;
    }
    
    // Filename zusammenbauen - PERSON_TOPIC Pattern für bessere Search
    let filename;
    if (source !== 'Unknown' && (source.includes('Muller') || source.includes('Schmidt') || source.includes('Becker') || source.includes('Stefan') || source.includes('Jens'))) {
        // Person zuerst für Namen-Suche
        filename = `${today}_${archetype}_${source}_${topic}`;
    } else {
        // Standard Pattern
        filename = `${today}_${archetype}_${topic}_${source}`;
    }
    
    // Sonderzeichen entfernen und Länge begrenzen
    return filename
        .replace(/[^a-zA-Z0-9_-]/g, '')
        .substring(0, 60);
}

// =====================================
// v6.2 MAIN SIMPLIFIED ANALYSIS FUNCTION
// =====================================

async function analyzeContentSimplified(content, sourceUrl = null, contextUuid = null) {
    console.log('[ANALYSIS v6.2] Starting simplified analysis...');
    
    try {
        // 1. Pre-Analysis für bessere Prompts
        const archetype = detectArchetypeV62(content);
        const hashtags = generateHashtagsV62(content, archetype);
        const filename = generateFilenameV62(archetype, content);
        
        console.log(`[ANALYSIS v6.2] Pre-detected: ${archetype}, ${hashtags.length} hashtags`);
        
        // 2. Ultra-Simple Prompt an GPT-4o
        const prompt = `${SIMPLIFIED_ANALYSIS_PROMPT}

CONTENT TO ANALYZE:
${content.substring(0, 2000)}

PRE-DETECTED INFO:
Archetype: ${archetype}
Suggested Hashtags: ${hashtags.join(', ')}
Suggested Filename: ${filename}

Verwende diese Infos als Basis aber verbessere sie wenn nötig.`;

        // 3. API Call mit kurzen Timeouts
        console.log('[ANALYSIS v6.2] Calling OpenAI with simplified prompt...');
        
        const response = await openai.chat.completions.create({
            model: COMPLETION_MODEL,
            messages: [{ role: "user", content: prompt }],
            max_tokens: 300,  // Drastisch reduziert!
            temperature: 0.1,
            timeout: 10000    // 10s statt 30s
        });
        
        console.log('[ANALYSIS v6.2] OpenAI response received');
        
        // 4. Parse JSON Response
        const aiContent = response.choices[0]?.message?.content || "";
        let analysis;
        
        try {
            analysis = JSON.parse(aiContent);
        } catch (parseError) {
            console.warn('[ANALYSIS v6.2] JSON parse failed, using fallback:', parseError.message);
            analysis = {
                filename: filename,
                archetype: archetype,
                hashtags: hashtags,
                summary: "Content wurde analysiert (AI-JSON-Parse-Fehler)."
            };
        }
        
        // 5. Validate and enhance analysis
        const finalResult = {
            filename: analysis.filename || filename,
            archetype: analysis.archetype || archetype,
            hashtags: analysis.hashtags || hashtags,
            summary: analysis.summary || "Content erfolgreich analysiert.",
            source_url: sourceUrl,
            tokens_used: response.usage?.total_tokens || 0,
            analysis_version: 'v6.2-simplified'
        };
        
        console.log(`[ANALYSIS v6.2] ✅ Success: ${finalResult.archetype}, ${finalResult.hashtags?.length || 0} hashtags, ${finalResult.tokens_used} tokens`);
        
        return {
            success: true,
            content: JSON.stringify(finalResult, null, 2),
            metadata: finalResult
        };
        
    } catch (error) {
        console.error('[ANALYSIS v6.2] ❌ Error:', error.message);
        
        // FALLBACK: Pre-detected Werte verwenden
        const fallbackResult = {
            filename: generateFilenameV62(detectArchetypeV62(content), content),
            archetype: detectArchetypeV62(content),
            hashtags: generateHashtagsV62(content, detectArchetypeV62(content)),
            summary: "Content wurde lokal analysiert (Server-Timeout).",
            source_url: sourceUrl,
            error_reason: error.message,
            analysis_version: 'v6.2-fallback'
        };
        
        console.log(`[ANALYSIS v6.2] 🛡️ Fallback used: ${fallbackResult.archetype}`);
        
        return {
            success: false,
            content: JSON.stringify(fallbackResult, null, 2),
            metadata: fallbackResult,
            error: error.message,
            fallback_used: true
        };
    }
}

// =====================================
// v6.2 LEGACY FUNCTION WRAPPER
// =====================================

// Wrapper für Backwards Compatibility
async function generateNexusObject(content, sourceUrl = null, contextUuid = null) {
    if (SIMPLIFIED_PROMPT_ENABLED) {
        console.log('[LEGACY] Redirecting to v6.2 simplified analysis...');
        return await analyzeContentSimplified(content, sourceUrl, contextUuid);
    } else {
        // Original v6.1 function (fallback)
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
}

// =====================================
// v6.2 ENHANCED ERROR HANDLING
// =====================================

// Enhanced Wrapper für Analyse-Requests mit besseren Status Messages
async function handleAnalysisRequestV62(analysisFunction, req, res) {
    try {
        // Status Message statt "Achtung"
        console.log('[ANALYSIS v6.2] 🔄 Processing request...');
        
        const result = await analysisFunction(req.body);
        
        if (result.success) {
            console.log('[ANALYSIS v6.2] ✅ Request successful');
            res.json({
                ...result,
                status_message: "✅ Content erfolgreich analysiert und zu Nexus hinzugefügt!",
                version: "6.2"
            });
        } else {
            console.log('[ANALYSIS v6.2] ⚠️ Request failed but handled gracefully');
            
            // Auch bei "Fehlern" positive Response wenn Fallback verwendet wurde
            if (result.fallback_used) {
                res.json({
                    ...result,
                    success: true, // Override für UX
                    status_message: "⚡ Content analysiert (Offline-Modus) und zu Nexus hinzugefügt!",
                    version: "6.2"
                });
            } else {
                res.status(400).json({
                    ...result,
                    status_message: "❌ Analyse fehlgeschlagen. Bitte versuchen Sie es erneut.",
                    version: "6.2"
                });
            }
        }
    } catch (error) {
        console.error('[ANALYSIS v6.2] ❌ Unexpected error:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message,
            status_message: "❌ Unerwarteter Server-Fehler. Bitte kontaktieren Sie den Support.",
            version: "6.2"
        });
    }
}

// Legacy wrapper for backwards compatibility
const handleAnalysisRequest = handleAnalysisRequestV62;

// ===== REST OF THE FUNCTIONS STAY THE SAME =====

// Klassifiziert Content mit OpenAI (UNCHANGED)
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

// Text-Content bereinigen (UNCHANGED)
function cleanTextContent(html) {
  const $ = cheerio.load(html);
  $('script, style, nav, footer, aside').remove();
  return $.text().replace(/\s+/g, ' ').trim();
}

// Web-Scraping mit ScraperAPI oder Puppeteer (UNCHANGED)
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