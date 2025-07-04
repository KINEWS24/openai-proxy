const express = require("express");
const fetch = require("node-fetch");
const cheerio = require("cheerio");
const { Configuration, OpenAIApi } = require("openai");

const app = express();
app.use(express.json());

const configuration = new Configuration({
    apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);

// Bestehender Proxy-Endpunkt (z. B. POST /openai ...)
// ...dein existierender Code...

// NEUER ENDPOINT:
app.post("/scrape-and-analyze-url", async (req, res) => {
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: "No URL provided" });

    try {
        const response = await fetch(url);
        const html = await response.text();
        const $ = cheerio.load(html);
        const title = $("title").text() || "";
        // Ganz einfachen Artikeltext-Extractor:
        const article = $("article").text() || $("body").text();
        const shortText = article.substring(0, 3000); // OpenAI-Input begrenzen

        // Prompt an OpenAI
        const prompt = `
Analysiere diesen Webartikel und fasse ihn als Bulletpoints zusammen. Gib eine Überschrift und die wichtigsten Punkte (3-7) an.
Titel: ${title}
Text: ${shortText}
Original-URL: ${url}
`;

        const completion = await openai.createChatCompletion({
            model: "gpt-4o", // oder dein Modell
            messages: [
                { role: "system", content: "Du bist ein deutschsprachiger Webartikel-Analyst." },
                { role: "user", content: prompt }
            ]
        });

        const result = completion.data.choices[0].message.content;
        res.json({
            url,
            title,
            summary: result
        });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: "Fehler beim Scraping oder bei der Analyse." });
    }
});

// Start
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Proxy läuft auf Port ${PORT}`);
});
