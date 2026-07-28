'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { SaveIndicator, aggregateSaveState } from '@/components/forms/SaveIndicator';
import { useAutoSavePatch, type SaveState } from '@/components/forms/useAutoSavePatch';
import { formatTechpackDate } from '@/lib/format';
import { primarySampleSize, sortSizes, type Product } from '@/types/product';
import {
  FIELD_INSET,
  HEADER_BAND,
  HEADER_SLOTS,
  HEADER_TEXT_SLOTS,
  LOGO_DIVIDER,
  PAGE,
  SIZE_LIST,
  TP_COLORS,
  TYPO,
  headerSlot,
  sizeListPositions,
  sizeListWidth,
  type HeaderTextSlot,
} from './headerLayout';
import { LogoDropZone, type LogoStatus } from './LogoDropZone';
import { measureTextPt } from './measureTextPt';
import { TechpackFontNotice } from './TechpackFontNotice';
import { useFontsReady } from './useFontsReady';

const pt = (value: number) => `${value}pt`;

/**
 * Rendu EDITION du bloc header, a sa geometrie reelle.
 *
 * Ce bloc apparait sur les 12 pages du techpack. Le saisir a sa vraie taille
 * plutot que dans un formulaire separe evite de decouvrir un debordement de
 * texte au moment de la generation du PDF.
 *
 * Toute la geometrie vient de `headerLayout.ts`, le meme fichier que le rendu
 * print `TechpackHeader.tsx`. Changer une largeur de colonne la-bas deplace le
 * texte imprime ET redimensionne les champs de saisie ci-dessous.
 */
export function TechpackHeaderEditor({ product }: { product: Product }) {
  const router = useRouter();
  const [fieldStates, setFieldStates] = useState<
    Record<string, { state: SaveState; error: string | null; retry: () => void }>
  >({});
  const [overflowing, setOverflowing] = useState<Record<string, boolean>>({});
  const [logoStatus, setLogoStatus] = useState<LogoStatus | null>(null);

  /**
   * Tailles d'echantillon, tenues ICI et non dans `SizeRangeEditor`.
   *
   * La note qui designe la taille portant les cotes de la page 2 se lit SOUS le
   * cadre, hors de la geometrie fixe, et doit suivre la selection en cours et
   * non la valeur serveur : elle a donc besoin de la meme source que les
   * encadres rouges.
   *
   * Le tri local reproduit celui du serveur (`sortSizes`, ordre XS -> 6XL) : la
   * reponse du PATCH est triee, une liste locale dans l'ordre des clics
   * afficherait un `primarySampleSize` different de celui du techpack.
   */
  const sampleSizes = useAutoSavePatch<string[]>({
    url: `/api/products/${product.id}`,
    field: 'sampleSizes',
    initial: sortSizes(product.sampleSizes),
    // Un clic n'a pas de frappe a amortir.
    delay: 0,
    onSaved: () => router.refresh(),
  });

  const report = useCallback(
    (key: string, entry: { state: SaveState; error: string | null; retry: () => void }) => {
      setFieldStates((previous) => ({ ...previous, [key]: entry }));
    },
    [],
  );

  const {
    state: sampleState,
    error: sampleError,
    retry: sampleRetry,
    value: selectedSizes,
  } = sampleSizes;
  useEffect(() => {
    report('sampleSizes', { state: sampleState, error: sampleError, retry: sampleRetry });
  }, [report, sampleState, sampleError, sampleRetry]);

  /**
   * Bascule : cliquer une taille l'ajoute a l'ensemble ou l'en retire.
   *
   * Retirer la derniere est autorise, l'API accepte le tableau vide (brouillon).
   * Ce qui serait fautif, c'est de le laisser passer sans rien dire : la note
   * sous le cadre prend le relais.
   */
  function toggleSampleSize(size: string) {
    sampleSizes.setValue(
      selectedSizes.includes(size)
        ? selectedSizes.filter((s) => s !== size)
        : sortSizes([...selectedSizes, size]),
    );
  }

  /** LA taille dont les valeurs s'afficheront sur les cotes de la page 2. */
  const primary = primarySampleSize({ sampleSizes: selectedSizes });

  const reportOverflow = useCallback((key: string, isOverflowing: boolean) => {
    setOverflowing((previous) =>
      previous[key] === isOverflowing ? previous : { ...previous, [key]: isOverflowing },
    );
  }, []);

  const entries = Object.values(fieldStates);
  const globalState = aggregateSaveState(entries.map((e) => e.state));
  const failed = entries.filter((e) => e.state === 'error');

  // Une coupure reseau met plusieurs champs en erreur d'un coup : le bouton
  // doit tous les relancer, pas seulement le premier de la liste.
  const retryAll = () => failed.forEach((entry) => entry.retry());
  const retryLabel =
    failed.length > 1
      ? `${failed.length} champs non enregistres`
      : (failed[0]?.error ?? null);

  const overflowLabels = HEADER_SLOTS.filter((s) => overflowing[s.key]).map((s) =>
    s.label.replace(':', ''),
  );

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-neutral-700">
          Header du techpack
          <span className="ml-2 font-normal text-neutral-400">
            tel qu il apparaitra sur les 12 pages
          </span>
        </h2>
        <SaveIndicator state={globalState} error={retryLabel} onRetry={retryAll} />
      </div>

      {/* Au-dessus du cadre : ce qui invalide la lecture du cadre lui-meme. */}
      <TechpackFontNotice />

      <div className="overflow-x-auto rounded border border-neutral-300 bg-white p-4">
        <div
          style={{
            position: 'relative',
            width: pt(PAGE.width),
            height: pt(HEADER_BAND.y + HEADER_BAND.height),
            fontSize: pt(TYPO.fontSize),
            lineHeight: 1,
            color: TP_COLORS.frame,
          }}
        >
          <div
            style={{
              position: 'absolute',
              left: pt(HEADER_BAND.x),
              top: pt(HEADER_BAND.y),
              width: pt(HEADER_BAND.width),
              height: pt(HEADER_BAND.height),
              background: TP_COLORS.bar,
            }}
          />
          <div
            style={{
              position: 'absolute',
              left: pt(LOGO_DIVIDER.x),
              top: pt(LOGO_DIVIDER.y),
              width: pt(LOGO_DIVIDER.width),
              height: pt(LOGO_DIVIDER.height),
              background: TP_COLORS.frame,
            }}
          />

          <LogoDropZone
            productId={product.id}
            logoStoragePath={product.logoStoragePath}
            onStatus={setLogoStatus}
          />

          {HEADER_SLOTS.map((slot) => (
            <span
              key={`label-${slot.key}`}
              style={{
                position: 'absolute',
                left: pt(slot.x),
                top: pt(slot.y),
                fontWeight: TYPO.labelWeight,
                whiteSpace: 'nowrap',
              }}
            >
              {slot.label}
            </span>
          ))}

          {HEADER_TEXT_SLOTS.map((slot) => (
            <HeaderTextField
              key={slot.key}
              slot={slot}
              productId={product.id}
              initial={(product[slot.key] as string | null) ?? ''}
              onStateChange={report}
              onOverflowChange={reportOverflow}
            />
          ))}

          {/* `DATE:` derive de created_at : jamais saisie, donc pas de champ.
              Rendue comme les autres valeurs : meme encre, meme graisse. */}
          <span
            style={{
              position: 'absolute',
              left: pt(headerSlot('date').valueX),
              top: pt(headerSlot('date').y),
              color: TP_COLORS.value,
              fontWeight: TYPO.valueWeight,
            }}
          >
            {formatTechpackDate(product.createdAt)}
          </span>

          <SizeRangeEditor
            sizeRange={product.sizeRange}
            selected={selectedSizes}
            primary={primary}
            onToggle={toggleSampleSize}
          />
        </div>
      </div>

      {/* Messages du slot logo, rendus HORS du cadre a geometrie fixe : dedans
          ils seraient rognes par la hauteur du header. */}
      {logoStatus?.hasLogo && (
        <button
          type="button"
          onClick={logoStatus.remove}
          disabled={logoStatus.busy}
          className="text-xs text-neutral-500 underline hover:text-red-600 disabled:opacity-50"
        >
          Supprimer le logo
        </button>
      )}
      {logoStatus?.alphaWarning && (
        <p className="text-xs text-amber-700">
          Cette image n a pas de canal alpha. Le fond du slot est le gris{' '}
          <code>{TP_COLORS.bar}</code> du header : un fond blanc se verra en rectangle sur les 12
          pages.
        </p>
      )}
      {logoStatus?.error && <p className="text-xs text-red-600">{logoStatus.error}</p>}

      {overflowLabels.length > 0 && (
        <p className="text-xs text-amber-700">
          Debordement de colonne : {overflowLabels.join(', ')}. Dans le PDF, le texte passera
          par-dessus la colonne suivante.
        </p>
      )}

      {/* Convention de la page 2, rendue sous le cadre et pas dedans : le cadre
          ne vaut que parce qu'il ressemble au template, et le template n'a
          qu'un seul style d'encadre. */}
      {selectedSizes.length === 0 ? (
        <p className="text-xs text-amber-700">
          Aucune taille d echantillon : cliquez une taille de la ligne SIZE RANGE. Sans elle, le
          techpack ne pourra pas etre genere.
        </p>
      ) : selectedSizes.length > 1 ? (
        <p className="text-xs text-neutral-500">
          {selectedSizes.length} tailles d echantillon. Les cotes de la page 2 n affichent qu une
          valeur par mesure : ce sont celles de la taille{' '}
          <span className="font-semibold text-neutral-700">{primary}</span>, la premiere de la
          gamme.
        </p>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------

/**
 * Un champ de header : positionne a la place exacte de sa valeur imprimee, et
 * large de l espace reellement disponible avant la colonne suivante.
 */
function HeaderTextField({
  slot,
  productId,
  initial,
  onStateChange,
  onOverflowChange,
}: {
  slot: HeaderTextSlot;
  productId: string;
  initial: string;
  onStateChange: (
    key: string,
    entry: { state: SaveState; error: string | null; retry: () => void },
  ) => void;
  onOverflowChange: (key: string, isOverflowing: boolean) => void;
}) {
  const router = useRouter();
  const field = useAutoSavePatch<string>({
    url: `/api/products/${productId}`,
    field: slot.key,
    initial,
    onSaved: () => router.refresh(),
  });

  const fontsReady = useFontsReady();

  // Mesure a la frappe, avec la police reelle : c'est la seule facon de savoir
  // si la valeur tiendra dans la colonne du PDF.
  const isOverflowing = useMemo(() => {
    // `fontsReady` est lu ici uniquement pour rejouer la mesure apres le swap de
    // police : sans ca, une valeur saisie avant le chargement de Source Sans 3
    // resterait evaluee avec la police de repli, plus large.
    void fontsReady;
    // Graisse passee explicitement : les valeurs sont en bold depuis que le
    // header imite le template, donc plus larges qu'en 400. Mesurer avec une
    // graisse plus fine ferait sonner l'avertissement trop tard, quand le
    // debordement est deja imprime.
    return measureTextPt(field.value, TYPO.valueWeight) > slot.valueWidth;
  }, [field.value, slot.valueWidth, fontsReady]);

  // Remontee au parent dans un effet, jamais pendant le rendu : modifier l etat
  // d un autre composant en cours de rendu est une erreur React.
  const { state, error, retry } = field;
  useEffect(() => {
    onStateChange(slot.key, { state, error, retry });
  }, [onStateChange, slot.key, state, error, retry]);

  useEffect(() => {
    onOverflowChange(slot.key, isOverflowing);
  }, [onOverflowChange, slot.key, isOverflowing]);

  return (
    <input
      value={field.value}
      onChange={(event) => field.setValue(event.target.value)}
      onBlur={field.flush}
      aria-label={slot.label}
      spellCheck={false}
      style={{
        position: 'absolute',
        left: pt(slot.valueX),
        top: pt(slot.y + FIELD_INSET.offsetY),
        width: pt(slot.valueWidth),
        height: pt(TYPO.fontSize + FIELD_INSET.extraHeight),
        padding: `0 ${pt(FIELD_INSET.paddingX)}`,
        border: 'none',
        borderBottom: `0.5pt solid ${isOverflowing ? '#b45309' : 'rgba(0,0,0,0.25)'}`,
        background: isOverflowing ? 'rgba(180,83,9,0.12)' : 'transparent',
        // Meme encre et meme graisse que le rendu print : sans ca, la saisie ne
        // montrerait plus ce que le PDF imprimera, ce qui est tout l'interet de
        // saisir dans le cadre a sa geometrie reelle.
        color: TP_COLORS.value,
        fontSize: pt(TYPO.fontSize),
        fontWeight: TYPO.valueWeight,
        fontFamily: 'inherit',
        outline: 'none',
      }}
    />
  );
}

/**
 * Ligne `SIZE RANGE:` : la gamme du produit, chaque taille d'echantillon
 * encadree de rouge. Cliquer une taille l'ajoute a l'ensemble ou l'en retire :
 * on peut vouloir produire un sample en M et un en L.
 *
 * `sample_sizes` pilote plusieurs rendus a la fois (ces encadres, les colonnes
 * remplies page 3, et via `primarySampleSize` les cotes de la page 2) : ce qui
 * se coche ici les change tous.
 *
 * Composant purement presentationnel : la valeur et son auto-save vivent dans
 * `TechpackHeaderEditor`, qui en a besoin pour la note sous le cadre.
 */
function SizeRangeEditor({
  sizeRange,
  selected,
  primary,
  onToggle,
}: {
  sizeRange: readonly string[];
  selected: readonly string[];
  /** Taille dont les cotes s'affichent page 2. Sert au libelle de survol. */
  primary: string | null;
  onToggle: (size: string) => void;
}) {
  const slot = headerSlot('sizeRange');
  // `valueWidth` est deja "ce qui reste avant la colonne suivante" : pas de
  // largeur de colonne recopiee ici.
  const listOverflows = sizeListWidth(sizeRange) > slot.valueWidth;

  return (
    <>
      {sizeListPositions(sizeRange).map(({ size, x }) => {
        const isSample = selected.includes(size);
        // Le survol dit la consequence du clic, et pour la taille qui porte les
        // cotes de la page 2, ce qu'elle a de particulier. Le cadre, lui, reste
        // fidele au template : un seul style d'encadre.
        const title = !isSample
          ? `Ajouter ${size} aux tailles d echantillon`
          : selected.length > 1 && size === primary
            ? `${size} : taille d echantillon, et celle dont les valeurs s affichent sur les cotes de la page 2. Cliquer pour la retirer`
            : `${size} : taille d echantillon. Cliquer pour la retirer`;
        return (
          <button
            key={size}
            type="button"
            onClick={() => onToggle(size)}
            title={title}
            style={{
              position: 'absolute',
              // Exactement le meme calcul que `TechpackHeader.tsx` : padding et
              // bordure sur toutes les tailles, compensation de l'un et de
              // l'autre sur la position. Un ecart ici et l'editeur ne montre
              // plus ce que le PDF imprimera.
              left: pt(x - SIZE_LIST.box.paddingX - SIZE_LIST.box.borderWidth),
              top: pt(slot.y - SIZE_LIST.box.paddingY - SIZE_LIST.box.borderWidth),
              padding: `${pt(SIZE_LIST.box.paddingY)} ${pt(SIZE_LIST.box.paddingX)}`,
              border: `${pt(SIZE_LIST.box.borderWidth)} solid ${
                isSample ? TP_COLORS.red : 'transparent'
              }`,
              background: 'transparent',
              color: TP_COLORS.value,
              fontSize: pt(TYPO.fontSize),
              fontWeight: TYPO.valueWeight,
              fontFamily: 'inherit',
              lineHeight: 1,
              cursor: 'pointer',
            }}
          >
            {size}
          </button>
        );
      })}
      {listOverflows && (
        <span
          style={{
            position: 'absolute',
            left: pt(slot.x),
            top: pt(slot.y + 12),
            fontSize: '6pt',
            color: '#b45309',
          }}
        >
          gamme trop large pour la colonne
        </span>
      )}
    </>
  );
}
