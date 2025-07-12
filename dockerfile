# Stufe 1: Basis-Image
# Wir nutzen eine 'slim' Debian-Variante von Node.js für beste Kompatibilität.
FROM node:20-slim

# Stufe 2: Arbeitsverzeichnis setzen
WORKDIR /usr/src/app

# Stufe 3: Installation der System-Abhängigkeiten in der korrekten Reihenfolge
RUN apt-get update \
    # SCHRITT 1: Installiere ZUERST die Basis-Werkzeuge für sichere Verbindungen
    && apt-get install -y \
    wget \
    gnupg \
    curl \
    --no-install-recommends \
    # SCHRITT 2: Füge jetzt die Google-Paketquelle hinzu
    && wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | apt-key add - \
    && sh -c 'echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google.list' \
    # SCHRITT 3: Aktualisiere die Paketliste erneut, damit die neue Quelle bekannt ist
    && apt-get update \
    # SCHRITT 4: Installiere jetzt den Browser und alle seine Abhängigkeiten
    && apt-get install -y \
    google-chrome-stable \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcairo2 \
    libcups2 \
    libdbus-1-3 \
    libexpat1 \
    libfontconfig1 \
    libgbm1 \
    libgconf-2-4 \
    libgdk-pixbuf2.0-0 \
    libglib2.0-0 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libstdc++6 \
    libx11-6 \
    libx11-xcb1 \
    libxcb1 \
    libxcomposite1 \
    libxcursor1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxi6 \
    libxrandr2 \
    libxrender1 \
    libxss1 \
    libxtst6 \
    lsb-release \
    --no-install-recommends \
    # SCHRITT 5: Bereinigung, um das Image klein zu halten
    && apt-get purge -y --auto-remove wget gnupg \
    && rm -rf /var/lib/apt/lists/*

# Stufe 4: Paket-Dateien kopieren und NPM-Abhängigkeiten installieren
COPY package*.json ./
# Wir überspringen den optionalen Puppeteer-Download, da wir den system-installierten Browser nutzen
RUN npm install --no-optional

# Stufe 5: Restlichen Anwendungs-Code kopieren
COPY . .

# Stufe 6: Port freigeben
EXPOSE 10000

# Stufe 7: Start-Befehl
CMD [ "node", "index.js" ]