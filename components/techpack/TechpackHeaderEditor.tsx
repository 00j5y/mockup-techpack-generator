'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { SaveIndicator, aggregateSaveState } from '@/components/forms/SaveIndicator';
import { useAutoSavePatch, type SaveState } from '@/components/forms/useAutoSavePatch';
import { formatTechpackDate } from '@/lib/format';
import type { Product } from '@/types/product';
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
  const [fieldStates, setFieldStates] = useState<
    Record<string, { state: SaveState; error: string | null; retry: () => void }>
  >({});
  const [overflowing, setOverflowing] = useState<Record<string, boolean>>({});
  const [logoStatus, setLogoStatus] = useState<LogoStatus | null>(null);

  const report = useCallback(
    (key: string, entry: { state: SaveState; error: string | null; retry: () => void }) => {
      setFieldStates((previous) => ({ ...previous, [key]: entry }));
    },
    [],
  );

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

          {/* `DATE:` derive de created_at : jamais saisie, donc pas de champ. */}
          <span
            style={{
              position: 'absolute',
              left: pt(headerSlot('date').valueX),
              top: pt(headerSlot('date').y),
              color: TP_COLORS.red,
            }}
          >
            {formatTechpackDate(product.createdAt)}
          </span>

          <SizeRangeEditor product={product} onStateChange={report} />
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
    return measureTextPt(field.value) > slot.valueWidth;
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
        color: TP_COLORS.red,
        fontSize: pt(TYPO.fontSize),
        fontFamily: 'inherit',
        outline: 'none',
      }}
    />
  );
}

/**
 * Ligne `SIZE RANGE:` : la gamme du produit, la taille de reference encadree de
 * rouge. Cliquer une taille la designe comme taille de reference.
 *
 * `sample_size` pilote trois rendus a la fois (cet encadre, la colonne remplie
 * page 3, les valeurs des cotes page 2) : le changer ici les change tous.
 */
function SizeRangeEditor({
  product,
  onStateChange,
}: {
  product: Product;
  onStateChange: (
    key: string,
    entry: { state: SaveState; error: string | null; retry: () => void },
  ) => void;
}) {
  const router = useRouter();
  const field = useAutoSavePatch<string | null>({
    url: `/api/products/${product.id}`,
    field: 'sampleSize',
    initial: product.sampleSize,
    delay: 0,
    onSaved: () => router.refresh(),
  });

  const { state, error, retry } = field;
  useEffect(() => {
    onStateChange('sampleSize', { state, error, retry });
  }, [onStateChange, state, error, retry]);

  const slot = headerSlot('sizeRange');
  // `valueWidth` est deja "ce qui reste avant la colonne suivante" : pas de
  // largeur de colonne recopiee ici.
  const listOverflows = sizeListWidth(product.sizeRange) > slot.valueWidth;

  return (
    <>
      {sizeListPositions(product.sizeRange).map(({ size, x }) => {
        const isSample = size === field.value;
        return (
          <button
            key={size}
            type="button"
            onClick={() => field.setValue(size)}
            title={`Definir ${size} comme taille de reference`}
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
              color: TP_COLORS.red,
              fontSize: pt(TYPO.fontSize),
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
