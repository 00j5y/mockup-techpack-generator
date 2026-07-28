'use client';

import { useRouter } from 'next/navigation';
import { useState, type ReactNode } from 'react';
import { PantoneCreateForm } from './PantoneCreateForm';
import { SaveIndicator } from './SaveIndicator';
import { useAutoSavePatch, type SaveState } from './useAutoSavePatch';
import {
  PANTONE_LIBRARIES,
  pantoneLabel,
  type PantoneColor,
  type PantoneLibrary as PantoneLibraryName,
} from '@/types/product';

/**
 * Gestion de la bibliotheque Pantone maison : creer, modifier, supprimer.
 *
 * Table GLOBALE, partagee par tous les produits : corriger une reference ici la
 * corrige partout, c'est l'interet meme d'une bibliotheque. Corollaire, la
 * suppression touche tous les produits qui la referencent, d'ou la confirmation
 * chiffree.
 *
 * L'edition se fait champ par champ en auto-save, comme partout ailleurs dans
 * l'application : pas de bouton « Enregistrer ». La seule difference avec les
 * champs de la fiche produit est que l'erreur est ecrite en toutes lettres sous
 * le champ, et pas seulement dans l'infobulle de l'indicateur : le 409 de
 * doublon NOMME la couleur en conflit, information inutile si personne ne la lit.
 */

const labelClass = 'block text-xs font-medium uppercase tracking-wide text-neutral-500';
const inputClass =
  'w-full rounded border border-neutral-300 px-2 py-1.5 text-sm focus:border-neutral-900 focus:outline-none';

/** Meme motif que le CHECK `pantone_colors_hex` et que le schema Zod. */
const HEX_PATTERN = /^#[0-9A-F]{6}$/;

export function PantoneLibrary({
  colors,
  usage,
}: {
  colors: PantoneColor[];
  /** Nombre de produits par identifiant de couleur. Absent vaut zero. */
  usage: Record<string, number>;
}) {
  const router = useRouter();

  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  async function remove(color: PantoneColor) {
    const detached = usage[color.id] ?? 0;
    if (!window.confirm(deletionMessage(color, detached))) return;

    setBusy(true);
    setError(null);
    setFeedback(null);
    try {
      const response = await fetch(`/api/pantones/${color.id}`, { method: 'DELETE' });
      const payload = (await response.json().catch(() => null)) as
        | { detachedProducts?: number; error?: string }
        | null;
      if (!response.ok) throw new Error(payload?.error ?? `Erreur ${response.status}`);

      // Le chiffre affiche est celui RENDU PAR L'API, pas celui de la page :
      // la page peut dater de plusieurs minutes, l'API a compte juste avant de
      // supprimer. Les deux different le jour ou un produit a change entre-temps.
      const count = payload?.detachedProducts ?? 0;
      setFeedback(
        `${pantoneLabel(color)} supprimee. ${count} produit(s) detache(s) : leur couleur de tissu est repassee a « non renseignee ».`,
      );
      if (editingId === color.id) setEditingId(null);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Suppression impossible');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        {creating ? (
          <p className="text-sm text-neutral-500">Nouvelle couleur :</p>
        ) : (
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="rounded bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-neutral-700"
          >
            Nouvelle couleur
          </button>
        )}
      </div>

      {creating && (
        <PantoneCreateForm
          onCancel={() => setCreating(false)}
          onCreated={(created) => {
            setCreating(false);
            setFeedback(`${pantoneLabel(created)} ajoutee a la bibliotheque.`);
            router.refresh();
          }}
        />
      )}

      {feedback && <p className="rounded bg-emerald-50 p-2 text-sm text-emerald-800">{feedback}</p>}
      {error && <p className="rounded bg-red-50 p-2 text-sm text-red-700">{error}</p>}

      {colors.length === 0 ? (
        <p className="rounded border border-dashed border-neutral-300 p-8 text-center text-sm text-neutral-500">
          La bibliotheque est vide. Creez une premiere couleur : elle sera ensuite selectionnable
          sur chaque produit, a la creation comme depuis sa fiche.
        </p>
      ) : (
        <ul className="space-y-2">
          {colors.map((color) => {
            const editing = editingId === color.id;
            const used = usage[color.id] ?? 0;
            return (
              <li key={color.id} className="rounded border border-neutral-200 bg-white p-3">
                <div className="flex flex-wrap items-center gap-3">
                  <span
                    aria-hidden
                    style={{ backgroundColor: color.hex }}
                    className="inline-block h-5 w-5 shrink-0 rounded border border-neutral-300"
                  />
                  <span className="text-sm font-medium">{pantoneLabel(color)}</span>
                  <span className="font-mono text-xs text-neutral-400">{color.hex}</span>
                  <span className="text-xs text-neutral-500">
                    {used === 0 ? 'aucun produit' : `${used} produit(s)`}
                  </span>
                  <span className="ml-auto flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setEditingId(editing ? null : color.id)}
                      className="text-xs text-neutral-600 underline hover:text-neutral-900"
                    >
                      {editing ? 'Terminer' : 'Modifier'}
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void remove(color)}
                      className="text-xs text-neutral-500 underline hover:text-red-600 disabled:opacity-50"
                    >
                      Supprimer
                    </button>
                  </span>
                </div>

                {color.notes && !editing && (
                  <p className="mt-1 text-xs text-neutral-500">{color.notes}</p>
                )}

                {editing && <PantoneEditor color={color} />}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/**
 * Message de confirmation chiffre, calque sur celui de la suppression d'un flat.
 *
 * « Etes-vous sur ? » ne dit pas qu'on s'apprete a vider la couleur de tissu de
 * 4 produits. La suppression ne casse rien (`on delete set null` detache sans
 * supprimer), et c'est justement pour ca qu'elle doit etre annoncee : sans le
 * chiffre, elle passerait totalement inapercue.
 */
function deletionMessage(color: PantoneColor, detached: number): string {
  const parts = [`Supprimer ${pantoneLabel(color)} de la bibliotheque ?`];
  if (detached === 0) {
    parts.push('\nAucun produit ne l utilise actuellement.');
  } else {
    parts.push(
      `\n${detached} produit(s) perdent leur couleur de tissu. Ils ne sont PAS supprimes : leur champ repasse a « non renseignee », et il faudra le renseigner a nouveau.`,
    );
  }
  return parts.join('');
}

/** Champs d'edition d'une couleur, un PATCH par champ. */
function PantoneEditor({ color }: { color: PantoneColor }) {
  const router = useRouter();
  const url = `/api/pantones/${color.id}`;
  const onSaved = () => router.refresh();

  return (
    <div className="mt-3 grid gap-3 border-t border-neutral-200 pt-3 sm:grid-cols-2">
      <AutoSaveText
        url={url}
        field="reference"
        label="Reference"
        initial={color.reference}
        required
        mono
        onSaved={onSaved}
      />
      <AutoSaveLibrary url={url} initial={color.library} onSaved={onSaved} />
      <AutoSaveText
        url={url}
        field="name"
        label="Nom commercial"
        initial={color.name}
        onSaved={onSaved}
      />
      <AutoSaveHex url={url} initial={color.hex} onSaved={onSaved} />
      <div className="sm:col-span-2">
        <AutoSaveText
          url={url}
          field="notes"
          label="Notes"
          initial={color.notes}
          onSaved={onSaved}
        />
      </div>
    </div>
  );
}

/**
 * Ligne de champ auto-sauvegarde.
 *
 * Seule difference avec le `Row` de `AutoSaveFields.tsx` : l'erreur est ecrite
 * en toutes lettres sous le champ, pas seulement dans l'infobulle.
 */
function Field({
  label,
  state,
  error,
  onRetry,
  hint,
  children,
}: {
  label: string;
  state: SaveState;
  error: string | null;
  onRetry: () => void;
  hint?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between gap-2">
        <span className={labelClass}>{label}</span>
        <SaveIndicator state={state} error={error} onRetry={onRetry} />
      </div>
      {children}
      {state === 'error' && error && (
        <p className="text-xs font-medium text-red-600">{error}</p>
      )}
      {hint && <p className="text-xs text-neutral-400">{hint}</p>}
    </div>
  );
}

function AutoSaveText({
  url,
  field,
  label,
  initial,
  required = false,
  mono = false,
  onSaved,
}: {
  url: string;
  field: string;
  label: string;
  /** `null` pour un champ nullable vide (`name`, `notes`). */
  initial: string | null;
  /** Colonne `not null` : vider le champ n'envoie rien plutot que d'echouer. */
  required?: boolean;
  mono?: boolean;
  onSaved: () => void;
}) {
  const auto = useAutoSavePatch<string | null>({ url, field, initial, onSaved });
  const [draft, setDraft] = useState(initial ?? '');

  const missing = required && draft.trim() === '';

  return (
    <Field
      label={label}
      state={auto.state}
      error={auto.error}
      onRetry={auto.retry}
      hint={missing ? 'Champ obligatoire : rien n est envoye tant qu il est vide.' : undefined}
    >
      <input
        value={draft}
        onChange={(event) => {
          const next = event.target.value;
          setDraft(next);
          if (required) {
            // Un champ obligatoire vide n'est pas une valeur a enregistrer :
            // c'est un etat transitoire de la frappe. L'envoyer produirait un
            // 400 au milieu d'une correction parfaitement normale.
            if (next.trim() !== '') auto.setValue(next);
            return;
          }
          // Nullable : la chaine vide part telle quelle, le schema la
          // normalise en `null`. La normalisation ne vit qu'a un seul endroit.
          auto.setValue(next);
        }}
        onBlur={auto.flush}
        className={`${inputClass} ${mono ? 'font-mono' : ''} ${missing ? 'border-amber-400' : ''}`}
      />
    </Field>
  );
}

function AutoSaveLibrary({
  url,
  initial,
  onSaved,
}: {
  url: string;
  initial: string;
  onSaved: () => void;
}) {
  // Un select n'a pas de frappe a amortir : envoyer tout de suite.
  const auto = useAutoSavePatch<string>({ url, field: 'library', initial, delay: 0, onSaved });

  return (
    <Field
      label="Bibliotheque"
      state={auto.state}
      error={auto.error}
      onRetry={auto.retry}
      hint="7545 C et 7545 U ne donnent pas la meme couleur : la bibliotheque fait partie de la reference."
    >
      <select
        value={auto.value}
        onChange={(event) => auto.setValue(event.target.value as PantoneLibraryName)}
        className={inputClass}
      >
        {PANTONE_LIBRARIES.map((value) => (
          <option key={value} value={value}>
            {value}
          </option>
        ))}
      </select>
    </Field>
  );
}

function AutoSaveHex({
  url,
  initial,
  onSaved,
}: {
  url: string;
  initial: string;
  onSaved: () => void;
}) {
  const auto = useAutoSavePatch<string>({ url, field: 'hex', initial, onSaved });

  /**
   * Texte tape caractere par caractere.
   *
   * Tenu a part de `auto.value` : `#1A2B3C` passe par `#1`, `#1A`, `#1A2`, et
   * envoyer ces etats intermediaires produit un 400 des qu'une seconde s'ecoule
   * au milieu de la saisie.
   */
  const [draft, setDraft] = useState(initial);
  const valid = HEX_PATTERN.test(draft);

  return (
    <Field
      label="Hex indicatif"
      state={auto.state}
      error={auto.error}
      onRetry={auto.retry}
      hint="Rendu ecran seulement. La specification reste la reference et sa bibliotheque."
    >
      <div className="flex items-center gap-2">
        <input
          type="color"
          aria-label="Choisir une teinte indicative"
          value={valid ? draft : auto.value}
          onChange={(event) => {
            // Le selecteur natif ne peut produire qu'un hex complet.
            const next = event.target.value.toUpperCase();
            setDraft(next);
            auto.setValue(next);
          }}
          className="h-8 w-10 cursor-pointer rounded border border-neutral-300"
        />
        <input
          value={draft}
          onChange={(event) => {
            const next = event.target.value.trim().toUpperCase();
            setDraft(next);
            // La colonne est `not null` et sous CHECK : rien ne part tant que
            // la valeur n'est pas un hex complet.
            if (HEX_PATTERN.test(next)) auto.setValue(next);
          }}
          onBlur={auto.flush}
          className={`${inputClass} font-mono ${valid ? '' : 'border-amber-400'}`}
        />
      </div>
    </Field>
  );
}
