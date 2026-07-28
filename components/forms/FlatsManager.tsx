'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import type { FlatWithImpact } from '@/lib/db/queries';
import { FLAT_TYPES, fileUrl, oneOf, type FlatType } from '@/types/product';

/**
 * Upload et gestion des flats du produit.
 *
 * Les flats sont la matiere premiere de la Phase 2 (points de mesure) et de la
 * Phase 5 (generation du visuel). Ils sont servis par `/api/files`, donc a la
 * meme origine que l'application : c'est ce qui evite le canvas "tainted" a
 * l'export du canvas d'annotation.
 */

const TYPE_LABELS: Record<FlatType, string> = {
  flat_front: 'Flat FRONT',
  flat_back: 'Flat BACK',
  flat_detail: 'Detail',
  inspo_reference: 'Reference / inspiration',
};

/**
 * Repli quand la valeur stockee sort de l'union.
 *
 * `flat_detail` et non `flat_front` ou `flat_back` : ces deux-la pilotent des
 * emplacements uniques de la page 2 du techpack, y ranger une valeur inconnue
 * serait pire qu'un libelle generique.
 */
const FALLBACK_FLAT_TYPE: FlatType = 'flat_detail';

/** Les deux types dont le techpack n'a qu'un seul emplacement (page 2). */
const UNIQUE_FLAT_TYPES: readonly FlatType[] = ['flat_front', 'flat_back'];

export function FlatsManager({
  productId,
  flats,
}: {
  productId: string;
  flats: FlatWithImpact[];
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  const [type, setType] = useState<FlatType>('flat_front');
  const [label, setLabel] = useState('');
  const [isOver, setIsOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const labelRequired = type === 'flat_detail';
  const labelMissing = labelRequired && label.trim() === '';

  // Avertissement a la saisie, pas troncature silencieuse a la generation : la
  // page 2 n'a qu'un emplacement FRONT et un BACK, un doublon obligerait la
  // Phase 4 a en choisir un arbitrairement. Voir .claude/docs/12-pieges.md.
  const duplicateType = UNIQUE_FLAT_TYPES.includes(type) && flats.some((f) => f.type === type);

  async function upload(file: File) {
    // Deux causes de refus distinctes, deux messages distincts : les melanger
    // affichait « libelle manquant » pendant un simple upload concurrent.
    if (busy) {
      setError('Un upload est deja en cours, attendez la fin avant d en deposer un autre');
      return;
    }
    if (labelMissing) {
      setError('Un flat de detail doit porter un libelle');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const body = new FormData();
      body.append('file', file);
      body.append('type', type);
      if (label.trim() !== '') body.append('label', label.trim());

      const response = await fetch(`/api/products/${productId}/flats`, {
        method: 'POST',
        body,
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error ?? `Erreur ${response.status}`);
      }
      setLabel('');
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Upload impossible');
    } finally {
      setBusy(false);
    }
  }

  async function remove(flat: FlatWithImpact) {
    if (!window.confirm(deletionMessage(flat))) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/products/${productId}/flats/${flat.id}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error(`Erreur ${response.status}`);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Suppression impossible');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold text-neutral-700">Flats</h2>

      <div className="flex flex-wrap items-end gap-3">
        <label className="space-y-1">
          <span className="block text-xs font-medium uppercase tracking-wide text-neutral-500">
            Type
          </span>
          <select
            value={type}
            onChange={(event) => setType(event.target.value as FlatType)}
            className="rounded border border-neutral-300 px-2 py-1.5 text-sm"
          >
            {FLAT_TYPES.map((value) => (
              <option key={value} value={value}>
                {TYPE_LABELS[value]}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-1">
          <span className="block text-xs font-medium uppercase tracking-wide text-neutral-500">
            Libelle {labelRequired ? '(obligatoire)' : '(optionnel)'}
          </span>
          <input
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            placeholder={labelRequired ? 'Detail capuche' : ''}
            className={`rounded border px-2 py-1.5 text-sm ${
              labelRequired && label.trim() === '' ? 'border-amber-400' : 'border-neutral-300'
            }`}
          />
        </label>
      </div>

      {duplicateType && (
        <p className="rounded bg-amber-50 p-2 text-sm text-amber-800">
          Un flat {TYPE_LABELS[type]} existe deja. La page 2 du techpack n a qu un emplacement
          FRONT et un BACK : si vous en deposez un second, un seul des deux sera imprime.
        </p>
      )}

      <div
        onDragOver={(event) => {
          event.preventDefault();
          setIsOver(true);
        }}
        onDragLeave={() => setIsOver(false)}
        onDrop={(event) => {
          event.preventDefault();
          setIsOver(false);
          const file = event.dataTransfer.files[0];
          if (file) void upload(file);
        }}
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') inputRef.current?.click();
        }}
        className={`cursor-pointer rounded border-2 border-dashed p-6 text-center text-sm ${
          isOver ? 'border-neutral-900 bg-neutral-50' : 'border-neutral-300 text-neutral-500'
        } ${busy ? 'opacity-60' : ''}`}
      >
        {busy ? 'Envoi en cours...' : 'Deposer un fichier ici, ou cliquer pour choisir'}
        <p className="mt-1 text-xs text-neutral-400">PNG, JPG, WebP ou SVG. 25 Mo maximum.</p>
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/svg+xml"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void upload(file);
            event.target.value = '';
          }}
        />
      </div>

      {error && <p className="rounded bg-red-50 p-2 text-sm text-red-700">{error}</p>}

      {flats.length === 0 ? (
        <p className="text-sm text-neutral-500">Aucun flat. Le techpack en a besoin d au moins deux : FRONT et BACK.</p>
      ) : (
        <ul className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {flats.map((flat) => {
            // Repli explicite plutot qu'un cast : une valeur hors union donnait
            // un libelle et un `alt` `undefined`, sans la moindre erreur.
            const typeLabel = TYPE_LABELS[oneOf(FLAT_TYPES, flat.type, FALLBACK_FLAT_TYPE)];
            return (
              <li key={flat.id} className="space-y-1 rounded border border-neutral-200 p-2">
                <div className="flex h-32 items-center justify-center overflow-hidden bg-neutral-100">
                  {/* eslint-disable-next-line @next/next/no-img-element -- fichier local servi par /api/files, pas d'optimiseur a intercaler */}
                  <img
                    src={fileUrl(flat.storagePath)}
                    alt={flat.label ?? typeLabel}
                    className="max-h-full max-w-full object-contain"
                  />
                </div>
                <p className="text-xs font-medium">{typeLabel}</p>
                {flat.label && <p className="text-xs text-neutral-500">{flat.label}</p>}
                {(flat.impact.measurementPoints > 0 || flat.impact.callouts > 0) && (
                  <p className="text-xs text-neutral-400">
                    {flat.impact.measurementPoints} point(s), {flat.impact.callouts} callout(s)
                  </p>
                )}
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void remove(flat)}
                  className="text-xs text-neutral-500 underline hover:text-red-600 disabled:opacity-50"
                >
                  Supprimer
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

/**
 * Message de confirmation chiffre.
 *
 * « Etes-vous sur ? » ne dit pas qu'on s'apprete a perdre 8 points de mesure.
 * Les cascades sont annoncees, les mises a null aussi : ce ne sont pas les
 * memes consequences.
 */
function deletionMessage(flat: FlatWithImpact): string {
  const lost: string[] = [];
  if (flat.impact.measurementPoints > 0) {
    lost.push(`${flat.impact.measurementPoints} point(s) de mesure et leurs valeurs`);
  }
  if (flat.impact.callouts > 0) lost.push(`${flat.impact.callouts} callout(s)`);

  const unanchored: string[] = [];
  if (flat.impact.colorSpecs > 0) unanchored.push(`${flat.impact.colorSpecs} couleur(s)`);
  if (flat.impact.artworkSpecs > 0) unanchored.push(`${flat.impact.artworkSpecs} artwork(s)`);

  const parts = [`Supprimer ce flat ?`];
  if (lost.length > 0) parts.push(`\nSupprime definitivement : ${lost.join(', ')}.`);
  if (unanchored.length > 0) {
    parts.push(`\nConserve mais perd son ancrage sur ce flat : ${unanchored.join(', ')}.`);
  }
  if (lost.length === 0 && unanchored.length === 0) {
    parts.push('\nAucun autre element n y est rattache.');
  }
  return parts.join('');
}
