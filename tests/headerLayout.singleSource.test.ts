/**
 * Detection de geometrie de header recopiee hors de sa source unique.
 *
 * Regle dure numero 2 du CLAUDE.md : « La geometrie du header est definie a un
 * seul endroit (`headerLayout.ts`), consommee par le rendu print et par le
 * rendu edition. Toute coordonnee de header copiee-collee dans un second
 * fichier est un bug d'architecture a corriger immediatement. »
 *
 * Une revue a deja trouve une violation de cette regle : les coordonnees du
 * slot logo recopiees en dur dans un formulaire. Rien ne l'avait signalee. Ce
 * test scanne les sources de `components/` et echoue si une valeur de geometrie
 * du header y reapparait en dur.
 *
 * CE QUE CE TEST ATTRAPE
 *   - un litteral CSS `72pt` ou `70pt` : les dimensions du slot logo et de la
 *     bande du header, exactement ce qui avait ete recopie,
 *   - la couleur `#CCCCCC` (toutes casses) : le fond de la bande de header,
 *     expose par `TP_COLORS.bar`,
 *   - dans n importe quel `.ts` / `.tsx` de `components/`, y compris dans les
 *     commentaires : un commentaire qui fige une valeur derive lui aussi.
 *
 * CE QUE CE TEST N ATTRAPE PAS, ET C EST ASSUME
 *   - les nombres nus (`left: 72`, `width: 70`) : trop courants pour etre
 *     distingues d une marge ou d un z-index sans faux positifs a repetition,
 *   - les valeurs de geometrie du header autres que celles listees ici
 *     (`86`, `290`, `528`, `359`...) : meme raison,
 *   - la prose qui cite une dimension (`« Le slot fait 72 x 70 pt »` dans
 *     `LogoDropZone.tsx`) : les motifs exigent le `pt` colle au nombre,
 *   - `app/globals.css`, qui declare legitimement `--tp-bar: #cccccc`. La
 *     duplication entre le token CSS et `TP_COLORS` est documentee et voulue :
 *     le rendu print est traverse par Puppeteer, une `var()` non resolue y
 *     donnerait du noir. Le scan se limite donc a `components/`.
 *
 * C est un filet, pas une preuve. Il couvre le mode de defaillance reellement
 * observe, au prix de zero faux positif sur l etat actuel du depot.
 */

import { describe, expect, test } from 'bun:test';
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const PROJECT_ROOT = fileURLToPath(new URL('..', import.meta.url));
const COMPONENTS_DIR = join(PROJECT_ROOT, 'components');

/** La source unique, seul fichier autorise a porter ces valeurs. */
const SINGLE_SOURCE = join('components', 'techpack', 'headerLayout.ts');

interface GeometryLiteral {
  /** Nom lisible dans le message d echec. */
  readonly literal: string;
  /** Constante de `headerLayout.ts` a utiliser a la place. */
  readonly source: string;
  /**
   * Motif global. Les `lookbehind` evitent de matcher `172pt` ou `0.72pt`, qui
   * ne sont pas la valeur du header.
   */
  readonly pattern: RegExp;
}

const HEADER_GEOMETRY_LITERALS: readonly GeometryLiteral[] = [
  {
    literal: '72pt',
    source: 'LOGO_SLOT.width',
    pattern: /(?<![\w.])72pt\b/gi,
  },
  {
    literal: '70pt',
    source: 'HEADER_BAND.height / LOGO_SLOT.height / LOGO_DIVIDER.height',
    pattern: /(?<![\w.])70pt\b/gi,
  },
  {
    literal: '#CCCCCC',
    source: 'TP_COLORS.bar',
    pattern: /#c{6}\b/gi,
  },
];

interface Violation {
  readonly file: string;
  readonly line: number;
  readonly literal: string;
  readonly source: string;
  readonly text: string;
}

/** Recherche les litteraux de geometrie du header dans un contenu de fichier. */
function findHardcodedGeometry(file: string, content: string): Violation[] {
  const lines = content.split('\n');
  const violations: Violation[] = [];

  for (const { literal, source, pattern } of HEADER_GEOMETRY_LITERALS) {
    lines.forEach((text, index) => {
      // `RegExp` global : on repart de zero a chaque ligne pour ne pas trainer
      // un `lastIndex` d une ligne sur l autre.
      pattern.lastIndex = 0;
      if (pattern.test(text)) {
        violations.push({ file, line: index + 1, literal, source, text: text.trim() });
      }
    });
  }

  return violations.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line);
}

/** Tous les `.ts` / `.tsx` de `components/`, chemins relatifs a la racine du projet. */
function collectComponentSources(directory: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const absolute = join(directory, entry.name);
    if (entry.isDirectory()) {
      found.push(...collectComponentSources(absolute));
      continue;
    }
    if (!/\.tsx?$/.test(entry.name)) continue;
    // Defensif : un fichier de test pose dans `components/` porterait ces
    // litteraux par nature et se signalerait lui-meme.
    if (/\.test\.tsx?$/.test(entry.name)) continue;
    found.push(relative(PROJECT_ROOT, absolute));
  }
  return found.sort();
}

function buildFailureMessage(violations: readonly Violation[]): string {
  const details = violations
    .map((v) => `  ${v.file}:${v.line}  ${v.literal}  ->  ${v.text}`)
    .join('\n');
  const fixes = [...new Set(violations.map((v) => `  ${v.literal} : importer ${v.source}`))].join(
    '\n',
  );

  return [
    'Regle dure numero 2 violee : de la geometrie du header est ecrite en dur hors de sa source unique.',
    '',
    'Occurrences :',
    details,
    '',
    `Correction attendue, dans chaque fichier ci-dessus : supprimer le litteral et lire la valeur depuis \`${SINGLE_SOURCE}\`.`,
    fixes,
    '',
    "Ce n'est pas un test a assouplir : une coordonnee de header dupliquee cesse de suivre",
    'la source unique des la premiere recalibration, et le rendu edition se desaligne du rendu print.',
  ].join('\n');
}

describe('regle 2 : la geometrie du header n existe qu a un seul endroit', () => {
  const files = collectComponentSources(COMPONENTS_DIR);

  test('le scan atteint bien les fichiers de components/', () => {
    // Garde-fou anti-test-vide : si le parcours de repertoire cassait, le test
    // principal passerait en ne lisant rien du tout.
    expect(files.length).toBeGreaterThan(5);
    expect(files).toContain(join('components', 'techpack', 'TechpackHeader.tsx'));
    expect(files).toContain(join('components', 'techpack', 'TechpackHeaderEditor.tsx'));
    expect(files).toContain(join('components', 'forms', 'ProductCreateForm.tsx'));
  });

  test('aucun fichier de components/ ne recopie une valeur de geometrie du header', () => {
    const violations = files
      .filter((file) => file !== SINGLE_SOURCE)
      .flatMap((file) => findHardcodedGeometry(file, readFileSync(join(PROJECT_ROOT, file), 'utf8')));

    if (violations.length > 0) {
      throw new Error(buildFailureMessage(violations));
    }

    expect(violations).toHaveLength(0);
  });
});

/**
 * Le detecteur lui-meme, verifie sur des sources synthetiques.
 *
 * Sans ces cas, un motif casse rendrait le test precedent silencieusement vert.
 */
describe('regle 2 : le detecteur de geometrie recopiee est fonctionnel', () => {
  test('il signale une dimension de slot logo ecrite en dur', () => {
    const found = findHardcodedGeometry('faux.tsx', "  style={{ width: '72pt', height: '70pt' }}");
    expect(found.map((v) => v.literal).sort()).toEqual(['70pt', '72pt']);
  });

  test('il signale le gris du header quelle que soit la casse', () => {
    expect(findHardcodedGeometry('faux.tsx', "background: '#cccccc',")).toHaveLength(1);
    expect(findHardcodedGeometry('faux.tsx', "background: '#CCCCCC',")).toHaveLength(1);
  });

  test('il donne le fichier, la ligne et la constante de remplacement', () => {
    const [violation] = findHardcodedGeometry('faux.tsx', ['const a = 1;', "left: '72pt',"].join('\n'));
    expect(violation.file).toBe('faux.tsx');
    expect(violation.line).toBe(2);
    expect(violation.source).toBe('LOGO_SLOT.width');
  });

  test('le message d echec nomme la regle, le fichier et la correction', () => {
    const message = buildFailureMessage(findHardcodedGeometry('faux.tsx', "left: '72pt',"));
    expect(message).toContain('Regle dure numero 2');
    expect(message).toContain('faux.tsx:1');
    expect(message).toContain('LOGO_SLOT.width');
  });

  test('il ne signale pas un nombre qui contient la valeur sans etre la valeur', () => {
    expect(findHardcodedGeometry('faux.tsx', "left: '172pt', top: '0.72pt', gap: '270pt'")).toEqual(
      [],
    );
  });

  test('il ne signale pas la lecture normale de la source unique', () => {
    expect(findHardcodedGeometry('faux.tsx', 'left: pt(LOGO_SLOT.x), width: pt(LOGO_SLOT.width)')).toEqual(
      [],
    );
  });

  test('il ne signale pas une dimension citee en prose dans un commentaire', () => {
    // `LogoDropZone.tsx` contient exactement cette phrase : le motif ne doit pas
    // la confondre avec un litteral CSS.
    expect(findHardcodedGeometry('faux.tsx', ' * Le slot fait 72 x 70 pt et apparait sur les 12 pages.')).toEqual(
      [],
    );
  });
});
