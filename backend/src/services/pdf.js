/**
 * PDF generation service using pdfkit.
 * Produces a DDD-branded interpretation report.
 *
 * Usage:
 *   const buffer = await generateDreamPdf(dream, user, { therapistMode: false });
 *   res.end(buffer);
 */

import { createRequire } from 'module';
const require = createRequire(import.meta.url);

let PDFDocument;
try {
  PDFDocument = require('pdfkit');
} catch {
  PDFDocument = null;
}

function escapeText(str) {
  return typeof str === 'string' ? str.replace(/[^\x09\x0A\x0D\x20-\x7E\xA0-\xFF]/g, '') : '';
}

/**
 * Generate a PDF buffer for a dream interpretation.
 *
 * @param {object} dream   MongoDB dream document
 * @param {object} user    Authenticated user document
 * @param {object} opts    { therapistMode: boolean }
 * @returns {Promise<Buffer>}
 */
export async function generateDreamPdf(dream, user, opts = {}) {
  if (!PDFDocument) {
    throw new Error('pdfkit is not installed. Run: npm install pdfkit');
  }

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 56, size: 'A4' });
    const chunks = [];

    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const { interpretation } = dream;
    const date = new Date(dream.createdAt).toLocaleDateString('en-US', {
      year: 'numeric', month: 'long', day: 'numeric',
    });

    const PURPLE = '#764ba2';
    const BLUE   = '#667eea';
    const GRAY   = '#555555';
    const LIGHT  = '#888888';

    // ── Header ──────────────────────────────────────────────────────────────
    if (opts.therapistMode) {
      doc.fontSize(20).fillColor(PURPLE).text('Dream Analysis Report', { align: 'center' });
      doc.fontSize(11).fillColor(LIGHT).text('For Professional Use Only — Not Medical Advice', { align: 'center' });
    } else {
      doc.fontSize(22).fillColor(PURPLE).text('Day Dream Dictionary', { align: 'center' });
      doc.fontSize(11).fillColor(LIGHT).text('daydreamdictionary.com', { align: 'center' });
    }

    doc.moveDown(0.3);
    doc.fontSize(10).fillColor(LIGHT)
      .text(`${date}  |  ${escapeText(user.displayName || user.email)}`, { align: 'center' });

    doc.moveDown(0.5);
    doc.moveTo(56, doc.y).lineTo(doc.page.width - 56, doc.y).strokeColor(BLUE).lineWidth(1.5).stroke();
    doc.moveDown(0.8);

    // ── Dream Text ──────────────────────────────────────────────────────────
    section(doc, 'Your Dream', PURPLE);
    doc.fontSize(11).fillColor(GRAY).font('Helvetica-Oblique')
      .text(escapeText(dream.dreamText), { lineGap: 3 });
    doc.font('Helvetica');
    doc.moveDown(0.8);

    // ── Main Themes ─────────────────────────────────────────────────────────
    section(doc, 'Main Themes', PURPLE);
    const themes = (interpretation.mainThemes || []).join('  ·  ');
    doc.fontSize(11).fillColor(GRAY).text(escapeText(themes));
    doc.moveDown(0.8);

    // ── Emotional Tone ──────────────────────────────────────────────────────
    section(doc, 'Emotional Tone', PURPLE);
    doc.fontSize(11).fillColor(GRAY).text(escapeText(interpretation.emotionalTone));
    doc.moveDown(0.8);

    // ── Symbols ─────────────────────────────────────────────────────────────
    section(doc, 'Symbols & Meanings', PURPLE);
    (interpretation.symbols || []).forEach((s) => {
      doc.fontSize(11).fillColor('#333333').font('Helvetica-Bold')
        .text(escapeText(s.symbol), { continued: true });
      doc.font('Helvetica').fillColor(GRAY)
        .text(`  —  ${escapeText(s.meaning)}`);
      doc.moveDown(0.2);
    });
    doc.moveDown(0.6);

    // ── Personal Insight ────────────────────────────────────────────────────
    section(doc, 'Personal Insight', PURPLE);
    doc.fontSize(11).fillColor(GRAY).text(escapeText(interpretation.personalInsight), { lineGap: 3 });
    doc.moveDown(0.8);

    // ── Guidance ────────────────────────────────────────────────────────────
    section(doc, 'Guidance', PURPLE);
    doc.fontSize(11).fillColor(GRAY).text(escapeText(interpretation.guidance), { lineGap: 3 });
    doc.moveDown(0.8);

    // ── Add-on: Life Season ─────────────────────────────────────────────────
    if (interpretation.lifeSeason) {
      section(doc, 'Life Season Insight', PURPLE);
      doc.fontSize(11).fillColor(GRAY).text(escapeText(interpretation.lifeSeason), { lineGap: 3 });
      doc.moveDown(0.8);
    }

    // ── Add-on: Recurring Patterns ──────────────────────────────────────────
    if (interpretation.recurringPatterns) {
      section(doc, 'Recurring Dream Patterns', PURPLE);
      doc.fontSize(11).fillColor(GRAY).text(escapeText(interpretation.recurringPatterns), { lineGap: 3 });
      doc.moveDown(0.8);
    }

    // ── Add-on: Relationship Insight ────────────────────────────────────────
    if (interpretation.relationshipInsight) {
      section(doc, 'Relationship Insight', PURPLE);
      doc.fontSize(11).fillColor(GRAY).text(escapeText(interpretation.relationshipInsight), { lineGap: 3 });
      doc.moveDown(0.8);
    }

    // ── Add-on: Therapeutic Focal Points ────────────────────────────────────
    if (opts.therapistMode && interpretation.therapeuticFocalPoints?.length) {
      section(doc, 'Therapeutic Focal Points', PURPLE);
      interpretation.therapeuticFocalPoints.forEach((point, i) => {
        doc.fontSize(11).fillColor(GRAY).text(`${i + 1}. ${escapeText(point)}`, { lineGap: 3 });
        doc.moveDown(0.2);
      });
      doc.moveDown(0.6);
    }

    // ── Footer ───────────────────────────────────────────────────────────────
    doc.moveDown(1);
    doc.moveTo(56, doc.y).lineTo(doc.page.width - 56, doc.y).strokeColor('#dddddd').lineWidth(0.5).stroke();
    doc.moveDown(0.4);
    doc.fontSize(9).fillColor(LIGHT).text(
      opts.therapistMode
        ? 'Generated by Day Dream Dictionary  |  This report is not a clinical diagnosis or medical advice.'
        : 'Generated by Day Dream Dictionary  |  daydreamdictionary.com  |  Not medical advice.',
      { align: 'center' },
    );

    doc.end();
  });
}

function section(doc, title, color) {
  doc.fontSize(12).fillColor(color).font('Helvetica-Bold').text(title.toUpperCase(), { characterSpacing: 0.5 });
  doc.font('Helvetica');
  doc.moveDown(0.2);
}
