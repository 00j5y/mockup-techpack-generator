/**
 * Rendu PRINT du bloc header, present sur les 12 pages du techpack.
 *
 * Composant pur : pas de `'use client'`, pas d'etat, pas de balise `input`.
 * Il est rendu cote serveur pour Puppeteer et reutilise tel quel dans la
 * preview navigateur. La surface de saisie est un fichier separe,
 * `TechpackHeaderEditor.tsx`, qui lit la meme geometrie.
 *
 * Toutes les coordonnees viennent de `headerLayout.ts`. Aucune valeur en dur ici.
 */

import { formatTechpackDate } from '@/lib/format';
import {
  HEADER_BAND,
  HEADER_SLOTS,
  LOGO_DIVIDER,
  LOGO_SLOT,
  SIZE_LIST,
  TP_COLORS,
  TYPO,
  headerSlot,
  sizeListPositions,
  type HeaderSlotKey,
} from './headerLayout';

export interface TechpackHeaderData {
  company: string;
  designer: string;
  /** Alimente `DATE:`. Derivee de `products.created_at`, jamais saisie. */
  date: Date | string;
  mainFabric: string;
  styleNumber: string;
  sizeRange: readonly string[];
  /**
   * Tailles d'echantillon, chacune encadree de rouge dans la liste des tailles.
   * Jamais `null`, possiblement vide sur un brouillon.
   */
  sampleSizes: readonly string[];
  description: string | null;
  styleName: string;
  /** URL servie par `/api/files/...`, donc a la meme origine que l'app. */
  logoUrl: string | null;
}

/** `pt` en CSS est une unite reelle : le navigateur la convertit a 96 dpi. */
const pt = (value: number) => `${value}pt`;

export function TechpackHeader({ data }: { data: TechpackHeaderData }) {
  // Type exhaustif volontaire : ajouter un emplacement dans `headerLayout.ts`
  // sans lui donner de valeur ici devient une erreur de compilation, au lieu de
  // faire disparaitre silencieusement un champ des 12 pages du PDF.
  const values: Record<Exclude<HeaderSlotKey, 'sizeRange'>, string> = {
    company: data.company,
    designer: data.designer,
    date: formatTechpackDate(data.date),
    mainFabric: data.mainFabric,
    styleNumber: data.styleNumber,
    description: data.description ?? '',
    styleName: data.styleName,
  };

  return (
    <div
      style={{
        position: 'absolute',
        left: pt(HEADER_BAND.x),
        top: pt(HEADER_BAND.y),
        width: pt(HEADER_BAND.width),
        height: pt(HEADER_BAND.height),
        background: TP_COLORS.bar,
        color: TP_COLORS.frame,
        fontSize: pt(TYPO.fontSize),
        lineHeight: 1,
      }}
    >
      {/* Slot logo. Le fond gris est celui de la bande : un logo sans canal
          alpha se verra en rectangle blanc sur les 12 pages. */}
      <div
        style={{
          position: 'absolute',
          left: pt(LOGO_SLOT.x - HEADER_BAND.x),
          top: pt(LOGO_SLOT.y - HEADER_BAND.y),
          width: pt(LOGO_SLOT.width),
          height: pt(LOGO_SLOT.height),
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
        }}
      >
        {data.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- Puppeteer rend du HTML brut : pas d'optimiseur Next dans le chemin PDF.
          <img
            src={data.logoUrl}
            alt=""
            style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
          />
        ) : null}
      </div>

      <div
        style={{
          position: 'absolute',
          left: pt(LOGO_DIVIDER.x - HEADER_BAND.x),
          top: pt(LOGO_DIVIDER.y - HEADER_BAND.y),
          width: pt(LOGO_DIVIDER.width),
          height: pt(LOGO_DIVIDER.height),
          background: TP_COLORS.frame,
        }}
      />

      {HEADER_SLOTS.map((s) => (
        <span
          key={`label-${s.key}`}
          style={{
            position: 'absolute',
            left: pt(s.x - HEADER_BAND.x),
            top: pt(s.y - HEADER_BAND.y),
            fontWeight: TYPO.labelWeight,
            whiteSpace: 'nowrap',
          }}
        >
          {s.label}
        </span>
      ))}

      {/* Valeurs saisies : meme police, meme graisse et meme encre que les
          libelles (`TP_COLORS.value`), a la demande de Jay. Le header fait ici
          exception a la regle 10 : le rouge y est reserve a l'encadre des
          tailles d'echantillon.
          Pas de `overflow: hidden` : une valeur trop longue DOIT deborder
          visiblement sur la colonne suivante. Tronquer ferait disparaitre
          l'information sans que personne le voie, ce que 12-pieges.md designe
          comme le pire comportement possible. Le debordement est par ailleurs
          signale a la frappe par `TechpackHeaderEditor`. */}
      {HEADER_SLOTS.filter((s) => s.key !== 'sizeRange').map((s) => (
        <span
          key={`value-${s.key}`}
          style={{
            position: 'absolute',
            left: pt(s.valueX - HEADER_BAND.x),
            top: pt(s.y - HEADER_BAND.y),
            color: TP_COLORS.value,
            fontWeight: TYPO.valueWeight,
            whiteSpace: 'nowrap',
          }}
        >
          {values[s.key as Exclude<HeaderSlotKey, 'sizeRange'>]}
        </span>
      ))}

      <SizeRangeRow sizes={data.sizeRange} sampleSizes={data.sampleSizes} />
    </div>
  );
}

/**
 * Ligne `SIZE RANGE:` : la gamme du produit, avec CHAQUE taille d'echantillon
 * encadree de rouge. C'est l'un des rendus pilotes par `products.sample_sizes`,
 * avec les colonnes remplies page 3.
 *
 * Les cotes de la page 2 n'affichent qu'une valeur par mesure : c'est
 * `primarySampleSize()` qui tranche laquelle des tailles la porte. Le header
 * imprime, lui, ne distingue pas cette taille des autres : le template n'a
 * qu'un seul style d'encadre, en inventer un second serait une infidelite.
 * La convention est rendue visible a la saisie, dans `TechpackHeaderEditor`.
 */
function SizeRangeRow({
  sizes,
  sampleSizes,
}: {
  sizes: readonly string[];
  sampleSizes: readonly string[];
}) {
  const slot = headerSlot('sizeRange');

  return (
    <>
      {sizeListPositions(sizes).map(({ size, x }) => {
        const isSample = sampleSizes.includes(size);
        return (
          <span
            key={size}
            style={{
              position: 'absolute',
              left: pt(x - HEADER_BAND.x - SIZE_LIST.box.paddingX - SIZE_LIST.box.borderWidth),
              top: pt(
                slot.y - HEADER_BAND.y - SIZE_LIST.box.paddingY - SIZE_LIST.box.borderWidth,
              ),
              // Padding et bordure sont appliques a TOUTES les tailles, la
              // bordure des non-selectionnees etant transparente. Sinon la
              // taille encadree se decale de la largeur de sa bordure par
              // rapport aux autres, et le print ne coincide plus avec l'editeur.
              padding: `${pt(SIZE_LIST.box.paddingY)} ${pt(SIZE_LIST.box.paddingX)}`,
              // Seul rouge restant dans le header : l'encadre. Le texte de la
              // taille suit les autres valeurs saisies.
              border: `${pt(SIZE_LIST.box.borderWidth)} solid ${
                isSample ? TP_COLORS.red : 'transparent'
              }`,
              color: TP_COLORS.value,
              fontWeight: TYPO.valueWeight,
              whiteSpace: 'nowrap',
            }}
          >
            {size}
          </span>
        );
      })}
    </>
  );
}
