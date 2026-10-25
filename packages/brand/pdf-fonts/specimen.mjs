/* global process, console, Buffer, URL */
// Specimen of the PDF fonts rendered with pdfkit (the engine under pdfmake), fixed dates: same fonts, same bytes.
// Usage: PDFKIT_FROM=<folder whose node_modules has pdfkit 0.20.2> node specimen.mjs <fonts folder> <out.pdf> [web.ttf]
// The optional third argument is the site font converted as is (WOFF2 to TTF), to show the glyphs it lacks.
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';

const require = createRequire(join(process.env.PDFKIT_FROM ?? process.cwd(), 'package.json'));
const PDFDocument = require('pdfkit');

const [, , fontDir, outFile, webTtf] = process.argv;
if (!fontDir || !outFile) throw new Error('usage: node render-test.mjs <fonts> <out.pdf> [web.ttf]');

const NB = '\u00a0';
const NNB = '\u202f';
const PHRASE = `Œuvre, cœur, déjà, «${NNB}guillemets${NNB}», 1${NNB}250,00${NB}EUR, €`;
const NAMES = `Łukasz Wójcik, Ștefan Țurcanu, Nguyễn Thị Hằng, Çağrı Yılmaz, Antonín Dvořák, L’HAŸ-LES-ROSES`;
const BODY = `Le Prestataire réalise la mission décrite à l’article 2 et remet les livrables dans le délai convenu. ` +
  `Le Client dispose de 15${NB}jours pour formuler des réserves motivées${NNB}; à défaut, la recette est réputée acquise.`;
const FIXED = new Date('2026-10-24T00:00:00Z');

const FONTS = {
  d400: 'ps-display-400.ttf', d600: 'ps-display-600.ttf', d700: 'ps-display-700.ttf',
  t400: 'ps-text-400.ttf', t700: 'ps-text-700.ttf', m500: 'ps-mono-500.ttf',
};

function render() {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4', margins: { top: 48, bottom: 48, left: 52, right: 52 }, pdfVersion: '1.7', lang: 'fr-FR',
      info: { Title: 'Polices PDF de la marque, contrôle', Producer: 'Proofseen', Creator: 'Proofseen', CreationDate: FIXED, ModDate: FIXED },
    });
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    for (const [key, file] of Object.entries(FONTS)) doc.registerFont(key, readFileSync(join(fontDir, file)));
    if (webTtf) doc.registerFont('web', readFileSync(webTtf));

    const W = doc.page.width - 104;
    const label = (t) => doc.font('m500').fontSize(7.5).fillColor('#6b6658').text(t.toUpperCase(), { characterSpacing: 0.5 }).moveDown(0.2);
    const ink = '#16140f';

    doc.font('d700').fontSize(26).fillColor(ink).text('Polices PDF de la marque', { width: W });
    doc.font('t400').fontSize(10).fillColor('#3b382f').text('pdfkit 0.20.2, fontkit 2, instances TTF statiques, sous-ensembles embarqués.', { width: W }).moveDown(0.9);

    for (const [key, name] of [['d400', 'PS Display 400, opsz 48'], ['d600', 'PS Display 600, opsz 48'], ['d700', 'PS Display 700, opsz 48'],
      ['t400', 'PS Text 400, opsz 10'], ['t700', 'PS Text 700, opsz 10'], ['m500', 'PS Mono 500']]) {
      label(name);
      doc.font(key).fontSize(15).fillColor(ink).text(PHRASE, { width: W }).moveDown(0.55);
    }

    doc.moveDown(0.3);
    label('Corps de contrat à 10 pt : à gauche Display opsz 48, à droite Text opsz 10');
    const y = doc.y; const col = (W - 20) / 2;
    doc.font('d400').fontSize(10).fillColor(ink).text(BODY, 52, y, { width: col, lineGap: 2 });
    const yl = doc.y;
    doc.font('t400').fontSize(10).fillColor(ink).text(BODY, 52 + col + 20, y, { width: col, lineGap: 2 });
    doc.x = 52; doc.y = Math.max(yl, doc.y) + 12;

    label('Noms de personnes en France : PS Text 400');
    doc.font('t400').fontSize(11).fillColor(ink).text(NAMES, { width: W }).moveDown(0.3);
    if (webTtf) {
      label('La même ligne avec la police du site convertie telle quelle (ps-display-v1.woff2 vers TTF)');
      doc.font('web').fontSize(11).fillColor(ink).text(NAMES, { width: W }).moveDown(0.3);
    }

    doc.moveDown(0.3);
    label('Chiffres alignés à droite : à gauche pnum (proportionnels), à droite par défaut (déjà tabulaires)');
    const yy = doc.y;
    for (const [i, feat] of [[0, ['pnum']], [1, []]]) {
      let yr = yy;
      for (const v of [`1${NNB}250,00${NB}EUR`, `111,11${NB}EUR`, `10${NNB}000,00${NB}EUR`, `7,07${NB}EUR`]) {
        doc.font('t400').fontSize(11).text(v, 52 + i * 170, yr, { width: 140, align: 'right', features: feat });
        yr += 15;
      }
    }
    doc.x = 52; doc.y = yy + 70;
    label('La trace : PS Mono 500, sans puis avec zéro barré (zero)');
    doc.font('m500').fontSize(9).fillColor(ink).text('SHA-256 0f3a90c1e7d0b8a2 · 2026-10-24 14:03:07 UTC · réf. PS-2026-0001', { width: W });
    doc.font('m500').fontSize(9).fillColor(ink)
      .text('SHA-256 0f3a90c1e7d0b8a2 · 2026-10-24 14:03:07 UTC · réf. PS-2026-0001', { width: W, features: ['zero'] });
    doc.end();
  });
}

const buf = await render();
writeFileSync(outFile, buf);
console.log(outFile, buf.length, 'o', createHash('sha256').update(buf).digest('hex'));
