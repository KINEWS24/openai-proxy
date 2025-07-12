// modules/exportIcs.js
// Express-Router für iCalendar-Export (Einzel-Event) und Validierung

const express = require('express');
const { uuidv7 } = require('uuidv7');
const ical = require('node-ical');
const router = express.Router();

/**
 * Escape-Funktion für iCalendar-Felder
 */
function escapeText(text = '') {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '');
}

/**
 * POST /export-ics
 * Empfängt JSON mit Termin-Daten und liefert .ics-String zurück
 */
router.post('/export-ics', (req, res) => {
  try {
    const {
      uid: incomingUid,
      start,
      end,
      summary,
      description = '',
      url = '',
      location = ''
    } = req.body;

    if (!start || !summary) {
      return res.status(400).json({ success: false, error: 'Fehlende Pflichtfelder: start und summary.' });
    }

    // Generiere UIDs und Zeitstempel
    const uid     = incomingUid || uuidv7();
    const dtstamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '') + 'Z';
    const dtstart = new Date(start).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '') + 'Z';
    const dtend   = end
      ? new Date(end).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '') + 'Z'
      : null;

    // Baue ICS-String mit CRLF-Zeilenumbrüchen
    let ics = '';
    ics += 'BEGIN:VCALENDAR\r\n';
    ics += 'VERSION:2.0\r\n';
    ics += 'PRODID:-//ThinkAI Nexus//EN\r\n';
    ics += 'CALSCALE:GREGORIAN\r\n';
    ics += 'METHOD:PUBLISH\r\n';
    ics += 'BEGIN:VEVENT\r\n';
    ics += `UID:${uid}\r\n`;
    ics += `DTSTAMP:${dtstamp}\r\n`;
    ics += `DTSTART:${dtstart}\r\n`;
    if (dtend) {
      ics += `DTEND:${dtend}\r\n`;
    }
    ics += `SUMMARY:${escapeText(summary)}\r\n`;
    if (description) {
      ics += `DESCRIPTION:${escapeText(description)}\r\n`;
    }
    if (url) {
      ics += `URL:${escapeText(url)}\r\n`;
    }
    if (location) {
      ics += `LOCATION:${escapeText(location)}\r\n`;
    }
    ics += 'END:VEVENT\r\n';
    ics += 'END:VCALENDAR\r\n';

    // Sende als text/calendar
    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    return res.send(ics);

  } catch (err) {
    console.error('Fehler im /export-ics-Endpoint:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /validate-ics
 * Prüft die Syntax eines ICS-Strings mittels node-ical
 */
router.post('/validate-ics', (req, res) => {
  const { ics } = req.body;
  if (!ics || typeof ics !== 'string') {
    return res.status(400).json({ valid: false, error: 'Fehlender oder ungültiger Parameter: ics' });
  }
  try {
    // Versuch, den ICS-String zu parsen
    ical.parseICS(ics);
    return res.json({ valid: true });
  } catch (err) {
    console.error('ICS-Validation Error:', err);
    return res.status(400).json({ valid: false, error: err.message });
  }
});

module.exports = router;