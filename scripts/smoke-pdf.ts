/**
 * Test de fumee du pipeline PDF.
 *
 * Objectif : verifier des la Phase 0 que Puppeteer demarre, que Chromium est
 * atteignable, et surtout que le format paysage custom du techpack sort aux
 * bonnes dimensions. Ce test ne rend AUCUNE donnee produit : il valide l'infra,
 * pas le contenu.
 *
 *   bun run smoke:pdf
 *   docker compose run --rm app bun run smoke:pdf
 *
 * Voir .claude/docs/15-template-seaggs.md pour la geometrie.
 */

import puppeteer from 'puppeteer';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

/** Format du techpack Seaggs, mesure sur le PDF source. Ni A4, ni Letter. */
const PAGE_WIDTH_PT = 761.4;
const PAGE_HEIGHT_PT = 581.4;

/**
 * ATTENTION : `page.pdf()` n'accepte PAS l'unite `pt`, seulement px, in, cm, mm.
 * Passer "761.4pt" leve `Failed to parse parameter value`.
 * Le CSS `@page { size: ... }`, lui, accepte les points sans probleme.
 * 1pt = 1/72 in, donc 761.4pt = 10.575in et 581.4pt = 8.075in (valeurs exactes).
 */
const PAGE_WIDTH_IN = PAGE_WIDTH_PT / 72;
const PAGE_HEIGHT_IN = PAGE_HEIGHT_PT / 72;

/**
 * Chromium ne sait pas produire exactement 761.4 x 581.4. Mesure sur deux chemins :
 *
 *   preferCSSPageSize: true   -> tronque au centieme de pouce : 761.04 x 581.04
 *   width/height explicites   -> arrondit au pixel entier superieur : 762 x 582
 *
 * On retient le chemin CSS : erreur de 0.36pt (0.047%) contre 0.6pt, et la
 * troncature tombe dans la bande de cadre exterieure, large de 5pt, ou elle est
 * invisible. Les coordonnees de la doc restent exprimees en 761.4 x 581.4.
 */
const EXPECTED_WIDTH_PT = 761.04;
const EXPECTED_HEIGHT_PT = 581.04;

/** Palette du template. */
const FRAME = '#231F20';
const BAR = '#CCCCCC';
const RED = '#FF0000';

const OUT_DIR = join(process.cwd(), '.smoke');
const OUT_FILE = join(OUT_DIR, 'smoke.pdf');

/**
 * Page minimale reproduisant la structure de bandes commune aux 12 pages :
 * cadre, barre de titre, bloc header, zone de contenu. Sert de controle visuel
 * grossier, pas de rendu fidele.
 */
const HTML = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <style>
      @page { size: ${PAGE_WIDTH_PT}pt ${PAGE_HEIGHT_PT}pt; margin: 0; }
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body { font-family: sans-serif; }
      .page {
        width: ${PAGE_WIDTH_PT}pt;
        height: ${PAGE_HEIGHT_PT}pt;
        position: relative;
        overflow: hidden;
        background: ${FRAME};
      }
      .title-bar {
        position: absolute; left: 5pt; top: 5pt;
        width: 750pt; height: 20pt;
        background: ${BAR};
        font-size: 14pt; font-weight: 700;
        display: flex; align-items: center; justify-content: space-between;
        padding: 0 4pt;
      }
      .header {
        position: absolute; left: 5pt; top: 31pt;
        width: 750pt; height: 70pt;
        background: ${BAR};
      }
      .logo-slot {
        position: absolute; left: 0; top: 0;
        width: 72pt; height: 70pt;
        border-right: 5pt solid ${FRAME};
      }
      .content {
        position: absolute; left: 5pt; top: 107pt;
        width: 750pt; height: 470pt;
        background: #FFFFFF;
        display: flex; align-items: center; justify-content: center;
        color: ${RED}; font-size: 16pt; font-weight: 700;
      }
    </style>
  </head>
  <body>
    <div class="page">
      <div class="title-bar"><span>SMOKE TEST</span><span>PAGE 1</span></div>
      <div class="header"><div class="logo-slot"></div></div>
      <div class="content">Pipeline PDF operationnel</div>
    </div>
  </body>
</html>`;

async function main() {
  await mkdir(OUT_DIR, { recursive: true });

  const executablePath = process.env.PUPPETEER_EXECUTABLE_PATH || undefined;
  console.log(`Chromium : ${executablePath ?? '(telecharge par Puppeteer)'}`);

  const browser = await puppeteer.launch({
    executablePath,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });

  try {
    const page = await browser.newPage();
    // `setContent` n'accepte que 'load' et 'domcontentloaded', contrairement a
    // `goto` qui connait aussi 'networkidle0'.
    await page.setContent(HTML, { waitUntil: 'load' });

    // Les polices doivent etre pretes avant le rendu, sinon la mise en page
    // bascule silencieusement sur une police de repli.
    await page.evaluate(() => document.fonts.ready);

    const pdf = await page.pdf({
      width: `${PAGE_WIDTH_IN}in`,
      height: `${PAGE_HEIGHT_IN}in`,
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: '0', right: '0', bottom: '0', left: '0' },
    });

    await writeFile(OUT_FILE, pdf);
    console.log(`PDF ecrit : ${OUT_FILE} (${pdf.length} octets)`);
    console.log(
      `Attendu : 1 page, ${EXPECTED_WIDTH_PT} x ${EXPECTED_HEIGHT_PT} pts, paysage ` +
        `(cible ${PAGE_WIDTH_PT} x ${PAGE_HEIGHT_PT}, troncature Chromium au centieme de pouce).`,
    );
    console.log('Verifier avec :  pdfinfo .smoke/smoke.pdf');
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error('Test de fumee PDF echoue :', error);
  process.exit(1);
});
