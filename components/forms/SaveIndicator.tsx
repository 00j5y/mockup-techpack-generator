'use client';

import type { SaveState } from './useAutoSavePatch';

/**
 * Etat de l'auto-save. Il n'y a pas de bouton "Enregistrer" dans cette
 * application : cet indicateur est le seul retour que la saisie est partie.
 */
export function SaveIndicator({
  state,
  error,
  onRetry,
}: {
  state: SaveState;
  error: string | null;
  onRetry: () => void;
}) {
  if (state === 'idle') return null;

  if (state === 'error') {
    return (
      <span className="inline-flex items-center gap-2 text-xs text-red-600">
        <span title={error ?? undefined}>Non enregistre</span>
        <button
          type="button"
          onClick={onRetry}
          className="rounded border border-red-300 px-1.5 py-0.5 font-medium hover:bg-red-50"
        >
          Reessayer
        </button>
      </span>
    );
  }

  // `idle` et `error` sont deja traites au-dessus : TypeScript a reduit `state`
  // aux trois cas restants tout seul, donc aucun cast n'est necessaire ici.
  switch (state) {
    case 'pending':
      return <span className="text-xs text-neutral-500">Modifie</span>;
    case 'saving':
      return <span className="text-xs text-neutral-500">Enregistrement...</span>;
    case 'saved':
      return <span className="text-xs text-neutral-500">Enregistre</span>;
  }
}

/**
 * Agrege plusieurs champs auto-sauvegardes en un seul indicateur.
 *
 * Un formulaire de 12 champs afficherait sinon 12 pastilles clignotantes.
 * Priorite : une erreur l'emporte sur tout, puis un envoi en cours, puis un
 * enregistrement recent.
 */
export function aggregateSaveState(states: SaveState[]): SaveState {
  if (states.includes('error')) return 'error';
  if (states.includes('saving')) return 'saving';
  if (states.includes('pending')) return 'pending';
  if (states.includes('saved')) return 'saved';
  return 'idle';
}
