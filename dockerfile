# Stufe 1: Basis-Image
# Wir nutzen eine 'slim' Debian-Variante von Node.js, die eine bessere Kompatibilität für Browser-Abhängigkeiten bietet.
FROM node:20-slim

# Stufe 2: Arbeitsverzeichnis setzen
WORKDIR /usr/src/app

# Stufe 3: Installation der System-Abhängigkeiten
# Dies ist der entscheidende Block. Wir installieren das komplette "google-chrome-stable"-Paket.
# Der 'apt-get install' Befehl wird automatisch ALLE notwendigen Bibliotheken (wie libnss3, libgtk-3-0 etc.) mitziehen.
# '--no-install-recommends' verhindert unnötige Pakete.
RUN apt-get update \
    && apt-get install -y \
    wget \
    gnupg \
    # === Installation des vollständigen Browsers ===
    google-chrome-stable \
    # ==========================================
    --no-install-recommends \
    # Fügt das Google Chrome Repository hinzu
    && wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | apt-key add - \
    && sh -c 'echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google.list' \
    && apt-get update \
    # Erneute Installation, um sicherzustellen, dass Chrome nach dem Hinzufügen des Repos installiert wird
    && apt-get install -y google-chrome-stable --no-install-recommends \
    # Bereinigung, um das Image klein zu halten
    && apt-get purge -y --auto-remove wget gnupg \
    && rm -rf /var/lib/apt/lists/*

# Stufe 4: Paket-Dateien kopieren und Abhängigkeiten installieren
COPY package*.json ./
# Wir verwenden '--no-optional', da wir den von Puppeteer heruntergeladenen Browser nicht benötigen
RUN npm install --no-optional

# Stufe 5: Restlichen Anwendungs-Code kopieren
COPY . .

# Stufe 6: Port freigeben
EXPOSE 10000

# Stufe 7: Start-Befehl
CMD [ "node", "index.js" ]