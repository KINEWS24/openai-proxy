# Stufe 1: Basis-Image
# Wir nutzen eine 'slim' Debian-Variante von Node.js, die eine bessere Kompatibilität für Browser-Abhängigkeiten bietet.
FROM node:20-slim

# Stufe 2: Arbeitsverzeichnis setzen
WORKDIR /usr/src/app

# Stufe 3: Installation der System-Abhängigkeiten
# Die Reihenfolge ist jetzt korrekt:
# 1. Google's Paket-Quellen hinzufügen
# 2. Paketliste aktualisieren, damit das System die neue Quelle kennt
# 3. Das vollständige Browser-Paket installieren
RUN apt-get update \
    && apt-get install -y \
    wget \
    gnupg \
    --no-install-recommends \
    && wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | apt-key add - \
    && sh -c 'echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google.list' \
    && apt-get update \
    && apt-get install -y \
    google-chrome-stable \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libc6 \
    libcairo2 \
    libcups2 \
    libdbus-1-3 \
    libexpat1 \
    libfontconfig1 \
    libgbm1 \
    libgcc1 \
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
    # Bereinigung, um das Image klein zu halten
    && apt-get purge -y --auto-remove wget gnupg \
    && rm -rf /var/lib/apt/lists/*

# Stufe 4: Paket-Dateien kopieren und Abhängigkeiten installieren
COPY package*.json ./
# Wir verwenden '--no-optional', da wir den von Puppeteer heruntergeladenen Browser nicht benötigen, sondern den system-installierten.
RUN npm install --no-optional

# Stufe 5: Restlichen Anwendungs-Code kopieren
COPY . .

# Stufe 6: Port freigeben
EXPOSE 10000

# Stufe 7: Start-Befehl
CMD [ "node", "index.js" ]