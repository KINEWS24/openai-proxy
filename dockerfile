# Stufe 1: Basis-Image
# Wir nutzen eine 'slim' Debian-Variante von Node.js für beste Kompatibilität.
FROM node:20-slim

# Stufe 2: Arbeitsverzeichnis setzen
WORKDIR /usr/src/app

# Stufe 3: System-Abhängigkeiten und Google Chrome nach modernem, sicherem Standard installieren
# Wir trennen die Installation in logische Blöcke für mehr Stabilität.
RUN apt-get update \
    # SCHRITT A: Installiere ZUERST die Basis-Werkzeuge für sichere Verbindungen.
    && apt-get install -y \
    curl \
    gnupg \
    ca-certificates \
    --no-install-recommends \
    \
    # SCHRITT B: Füge jetzt die Google-Paketquelle hinzu, da die Werkzeuge vorhanden sind.
    && curl -fsSL https://dl.google.com/linux/linux_signing_key.pub | gpg --dearmor -o /usr/share/keyrings/google-chrome-stable.gpg \
    && echo "deb [arch=amd64 signed-by=/usr/share/keyrings/google-chrome-stable.gpg] http://dl.google.com/linux/chrome/deb/ stable main" > /etc/apt/sources.list.d/google.list \
    \
    # SCHRITT C: Aktualisiere die Paketliste erneut, damit die neue Quelle bekannt ist.
    && apt-get update \
    \
    # SCHRITT D: Installiere jetzt den Browser. Alle weiteren Abhängigkeiten werden automatisch mitgezogen.
    && apt-get install -y \
    google-chrome-stable \
    --no-install-recommends \
    \
    # SCHRITT E: Bereinigung, um das Image klein zu halten.
    && rm -rf /var/lib/apt/lists/* \
    && apt-get purge -y --auto-remove curl gnupg

# Stufe 4: Paket-Dateien kopieren und NPM-Abhängigkeiten installieren
COPY package*.json ./
# Wir überspringen den optionalen Puppeteer-Download, da wir den system-installierten Browser nutzen.
# Die '--no-optional' Flag wurde entfernt, um Kompatibilitätsprobleme zu vermeiden.
RUN npm install

# Stufe 5: Einen neuen .puppeteerrc.cjs Konfigurationsfile erstellen,
# um Puppeteer explizit anzuweisen, den system-installierten Chrome zu verwenden.
RUN echo "/** @type {import('puppeteer').Configuration} */ module.exports = { executablePath: '/usr/bin/google-chrome-stable' };" > .puppeteerrc.cjs

# Stufe 6: Restlichen Anwendungs-Code kopieren
COPY . .

# Stufe 7: Port freigeben
EXPOSE 10000

# Stufe 8: Start-Befehl
CMD [ "node", "index.js" ]