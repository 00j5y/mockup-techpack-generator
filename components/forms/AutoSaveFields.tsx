'use client';

import { useRouter } from 'next/navigation';
import { useState, type ReactNode } from 'react';
import { SaveIndicator } from './SaveIndicator';
import { useAutoSavePatch } from './useAutoSavePatch';

/**
 * Champs auto-sauvegardes du formulaire general.
 *
 * Tous s'appuient sur `useAutoSavePatch` : la logique de debounce, de flush et
 * de retry n'est ecrite qu'une fois. Ces composants n'ajoutent que le rendu.
 */

const labelClass = 'block text-xs font-medium uppercase tracking-wide text-neutral-500';
const inputClass =
  'w-full rounded border border-neutral-300 px-2 py-1.5 text-sm focus:border-neutral-900 focus:outline-none';

function Row({
  label,
  children,
  indicator,
  hint,
}: {
  label: string;
  children: ReactNode;
  indicator: ReactNode;
  // `ReactNode` et pas `string` : une incoherence a signaler doit pouvoir etre
  // rendue plus visible que le gris discret par defaut, sans que ce composant
  // ait a connaitre les cas metier qui la declenchent.
  hint?: ReactNode;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between gap-2">
        <span className={labelClass}>{label}</span>
        {indicator}
      </div>
      {children}
      {hint && <p className="text-xs text-neutral-400">{hint}</p>}
    </div>
  );
}

export function AutoSaveNumber({
  url,
  field,
  label,
  initial,
  min = 1,
}: {
  url: string;
  field: string;
  label: string;
  initial: number;
  min?: number;
}) {
  const router = useRouter();
  const auto = useAutoSavePatch<number>({
    url,
    field,
    initial,
    onSaved: () => router.refresh(),
  });

  /**
   * Texte reellement affiche dans l'input.
   *
   * L'input reste controle, mais par ce brouillon et non par `auto.value` :
   * effacer le champ pour retaper une valeur doit laisser voir le champ vide.
   * Envoyer `Number('')` a la place enverrait `0`, que `Number.isFinite` accepte
   * et que l'API rejette en 400 (minimum 1), pendant une frappe normale.
   */
  const [draft, setDraft] = useState(() => String(initial));

  return (
    <Row
      label={label}
      indicator={
        <SaveIndicator state={auto.state} error={auto.error} onRetry={auto.retry} />
      }
    >
      <input
        type="number"
        min={min}
        value={draft}
        onChange={(event) => {
          const raw = event.target.value;
          setDraft(raw);
          // Champ vide ou illisible : rien a envoyer, on attend la suite de la
          // frappe. La derniere valeur enregistree reste celle de la base.
          if (raw.trim() === '') return;
          const parsed = Number(raw);
          if (Number.isFinite(parsed)) auto.setValue(parsed);
        }}
        onBlur={() => {
          // A la sortie du champ, reafficher la derniere valeur envoyee :
          // l'input ne reste jamais sur un brouillon qui ne correspond a rien.
          setDraft(String(auto.value));
          auto.flush();
        }}
        className={inputClass}
      />
    </Row>
  );
}

/**
 * Valeur de l'option qui represente `null`.
 *
 * Un `<option value="">` serait indistinguable d'une chaine vide reellement
 * saisissable ; ce sentinelle ne peut appartenir a aucune union litterale du
 * domaine, il n'est donc jamais confondu avec une valeur metier. Il ne quitte
 * jamais ce composant : `null` part sur le reseau.
 */
const EMPTY_OPTION = '__none__';

export function AutoSaveSelect<T extends string>({
  url,
  field,
  label,
  initial,
  options,
  hint,
  emptyLabel,
}: {
  url: string;
  field: string;
  label: string;
  /**
   * `null` vaut « colonne non renseignee ». Le select l'affiche tel quel : un
   * repli sur la premiere option montrerait une valeur que la base ne contient
   * pas, et aucun PATCH ne partirait pour la rendre vraie.
   */
  initial: T | null;
  options: readonly { value: T; label: string }[];
  hint?: ReactNode;
  /** Libelle de l'option `null`. Ne pas la proposer interdit de revenir au vide. */
  emptyLabel?: string;
}) {
  const router = useRouter();
  const auto = useAutoSavePatch<T | null>({
    url,
    field,
    initial,
    // Un select n'a pas de frappe a amortir : envoyer tout de suite.
    delay: 0,
    onSaved: () => router.refresh(),
  });

  // L'option vide est rendue aussi quand l'appelant ne l'a pas demandee mais que
  // la valeur est nulle : sans elle, le navigateur selectionnerait d'office la
  // premiere option et reintroduirait l'ecart entre l'affiche et le stocke.
  const showEmpty = emptyLabel !== undefined || auto.value === null;

  return (
    <Row
      label={label}
      hint={hint}
      indicator={
        <SaveIndicator state={auto.state} error={auto.error} onRetry={auto.retry} />
      }
    >
      <select
        value={auto.value ?? EMPTY_OPTION}
        onChange={(event) => {
          const next = event.target.value;
          auto.setValue(next === EMPTY_OPTION ? null : (next as T));
        }}
        className={inputClass}
      >
        {showEmpty && <option value={EMPTY_OPTION}>{emptyLabel ?? 'non renseignee'}</option>}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </Row>
  );
}

/**
 * Il n'y a volontairement PAS de champ de couleur libre ici.
 *
 * Un `AutoSaveColor` generique a existe dans ce fichier, sans appelant. Il est
 * supprime avec l'arrivee du selecteur Pantone : une couleur de ce domaine est
 * une REFERENCE de bibliotheque (`PantoneSelect`), pas un hex saisi a la main.
 * Garder le composant aurait entretenu la possibilite de reintroduire la
 * seconde source que la suppression de `products.fabric_color_hex` a fait
 * disparaitre. Le seul endroit ou un hex se saisit est la fiche d'une couleur
 * de la bibliotheque, et il y est explicitement indicatif.
 */

export function AutoSaveToggle({
  url,
  field,
  label,
  initial,
  hint,
}: {
  url: string;
  field: string;
  label: string;
  initial: boolean;
  hint?: string;
}) {
  const router = useRouter();
  const auto = useAutoSavePatch<boolean>({
    url,
    field,
    initial,
    delay: 0,
    onSaved: () => router.refresh(),
  });

  return (
    <Row
      label={label}
      hint={hint}
      indicator={
        <SaveIndicator state={auto.state} error={auto.error} onRetry={auto.retry} />
      }
    >
      <label className="flex cursor-pointer items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={auto.value}
          onChange={(event) => auto.setValue(event.target.checked)}
          className="h-4 w-4"
        />
        <span>{auto.value ? 'Active' : 'Desactive'}</span>
      </label>
    </Row>
  );
}

/**
 * Gamme de tailles.
 *
 * Une taille utilisee comme taille d'echantillon ne peut pas etre decochee
 * ici : la base impose `sample_sizes <@ size_range`, et laisser decocher
 * produirait un 400 sans issue evidente. Le choix des tailles d'echantillon se
 * fait dans le header, la ou les encadres rouges sont visibles.
 */
export function AutoSaveSizeRange({
  url,
  label,
  initial,
  sampleSizes,
  options,
}: {
  url: string;
  label: string;
  initial: string[];
  /** Tailles verrouillees parce qu'elles servent d'echantillon. Jamais `null`. */
  sampleSizes: readonly string[];
  options: readonly string[];
}) {
  const router = useRouter();
  const auto = useAutoSavePatch<string[]>({
    url,
    field: 'sizeRange',
    initial,
    delay: 0,
    onSaved: () => router.refresh(),
  });

  function toggle(size: string) {
    const next = auto.value.includes(size)
      ? auto.value.filter((s) => s !== size)
      : options.filter((s) => auto.value.includes(s) || s === size);
    if (next.length === 0) return;
    auto.setValue(next);
  }

  return (
    <Row
      label={label}
      hint="Les 10 colonnes du tableau page 3 s affichent toujours ; la gamme determine lesquelles peuvent recevoir une valeur."
      indicator={
        <SaveIndicator state={auto.state} error={auto.error} onRetry={auto.retry} />
      }
    >
      <div className="flex flex-wrap gap-1">
        {options.map((size) => {
          const checked = auto.value.includes(size);
          const locked = sampleSizes.includes(size);
          return (
            <button
              key={size}
              type="button"
              disabled={locked}
              onClick={() => toggle(size)}
              title={
                locked
                  ? 'Taille d echantillon : la retirer dans le header d abord'
                  : undefined
              }
              className={`rounded border px-2 py-1 text-xs font-medium ${
                checked
                  ? 'border-neutral-900 bg-neutral-900 text-white'
                  : 'border-neutral-300 text-neutral-600 hover:border-neutral-500'
              } ${locked ? 'cursor-not-allowed opacity-70 ring-1 ring-red-400' : ''}`}
            >
              {size}
            </button>
          );
        })}
      </div>
    </Row>
  );
}
