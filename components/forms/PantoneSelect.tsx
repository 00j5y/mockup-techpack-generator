'use client';

import { useEffect, useState } from 'react';
import { PantoneCreateForm } from './PantoneCreateForm';
import { pantoneLabel, type PantoneColor } from '@/types/product';

/**
 * Selection d'une couleur dans la bibliotheque Pantone maison.
 *
 * Composant CONTROLE sur l'objet couleur entier, pas sur son seul identifiant :
 * l'appelant a besoin du libelle pour l'afficher, et le lui faire retrouver
 * dans une liste chargee ici l'obligerait a refaire une requete.
 *
 * LE HEX N'EST PAS LA SPECIFICATION. La pastille reste petite et le libelle
 * (`pantoneLabel()`) porte le rendu : c'est le couple reference + bibliotheque
 * qui part chez le teinturier, le hex n'est qu'un reperage a l'ecran, sur un
 * ecran non calibre, pour une teinture physique. Une grille de pastilles facon
 * nuancier laisserait croire qu'on choisit une couleur d'ecran.
 *
 * La liste n'est chargee qu'a l'ouverture du panneau : une fiche produit qui ne
 * touche pas a la couleur ne declenche aucune requete.
 */

const inputClass =
  'w-full rounded border border-neutral-300 px-2 py-1.5 text-sm focus:border-neutral-900 focus:outline-none';

/**
 * Amorti de la recherche.
 *
 * Plus court que la seconde de l'auto-save : ici rien n'est ecrit, seule une
 * lecture part, et l'attente se voit directement dans la liste.
 */
const SEARCH_DEBOUNCE_MS = 250;

export function PantoneSelect({
  value,
  onChange,
}: {
  /** Couleur actuellement choisie, `null` si le produit n'en porte pas. */
  value: PantoneColor | null;
  onChange: (color: PantoneColor | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState(false);

  /** `null` tant que rien n'a ete charge : distinct d'une bibliotheque vide. */
  const [colors, setColors] = useState<PantoneColor[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  /** Incremente pour forcer un rechargement (retry, creation a la volee). */
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    if (!open) return;

    const controller = new AbortController();
    const timer = setTimeout(
      () => {
        setLoading(true);
        setLoadError(null);
        // La recherche est faite par la route, pas ici : elle porte sur
        // `reference` ET `name`, jamais sur le hex ni les notes, et cette
        // definition ne doit exister qu'a un seul endroit.
        const query = search.trim() === '' ? '' : `?q=${encodeURIComponent(search.trim())}`;
        fetch(`/api/pantones${query}`, { signal: controller.signal })
          .then(async (response) => {
            if (!response.ok) {
              const payload = (await response.json().catch(() => null)) as
                | { error?: string }
                | null;
              throw new Error(payload?.error ?? `Erreur ${response.status}`);
            }
            return (await response.json()) as PantoneColor[];
          })
          .then((rows) => {
            setColors(rows);
            setLoading(false);
          })
          .catch((caught: unknown) => {
            // Une requete annulee (frappe suivante, fermeture du panneau) n'est
            // pas un echec reseau : l'afficher comme tel ferait clignoter une
            // erreur a chaque caractere tape.
            if (controller.signal.aborted) return;
            setLoadError(caught instanceof Error ? caught.message : 'Chargement impossible');
            setLoading(false);
          });
      },
      // Premiere ouverture sans recherche : pas d'attente artificielle.
      search.trim() === '' ? 0 : SEARCH_DEBOUNCE_MS,
    );

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [open, search, reloadToken]);

  function choose(color: PantoneColor | null) {
    onChange(color);
    setOpen(false);
    setCreating(false);
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        {value ? (
          <span className="flex items-center gap-2 text-sm">
            <Swatch hex={value.hex} />
            <span className="font-medium">{pantoneLabel(value)}</span>
          </span>
        ) : (
          // `null` est un etat reel de la colonne, pas un cas d'erreur : le dire
          // plutot que d'afficher une pastille noire qui ferait croire a du noir.
          <span className="text-sm text-neutral-400">non renseignee</span>
        )}
        <button
          type="button"
          onClick={() => setOpen((previous) => !previous)}
          aria-expanded={open}
          className="rounded border border-neutral-300 px-2 py-0.5 text-xs font-medium text-neutral-600 hover:border-neutral-500"
        >
          {open ? 'Fermer' : value ? 'Changer' : 'Choisir'}
        </button>
      </div>

      {open && (
        <div className="space-y-3 rounded border border-neutral-200 bg-white p-3">
          <input
            autoFocus
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            onKeyDown={(event) => {
              // Ce panneau peut vivre a l'interieur du formulaire de creation de
              // produit : Entree y soumettrait le produit en cours de saisie.
              if (event.key === 'Enter') event.preventDefault();
            }}
            placeholder="Chercher une reference ou un nom"
            className={inputClass}
          />

          {loading && <p className="text-sm text-neutral-500">Chargement de la bibliotheque...</p>}

          {loadError && (
            <div className="space-y-2 rounded bg-red-50 p-2 text-sm text-red-700">
              <p>{loadError}</p>
              <button
                type="button"
                onClick={() => setReloadToken((token) => token + 1)}
                className="rounded border border-red-300 px-2 py-0.5 text-xs font-medium hover:bg-red-100"
              >
                Reessayer
              </button>
            </div>
          )}

          {!loading && !loadError && colors !== null && colors.length === 0 && (
            <p className="rounded border border-dashed border-neutral-300 p-3 text-sm text-neutral-500">
              {search.trim() === ''
                ? 'La bibliotheque est vide. Creez votre premiere couleur ci-dessous : elle sera ensuite reutilisable sur tous les produits.'
                : `Aucune couleur ne correspond a "${search.trim()}". Vous pouvez la creer ci-dessous.`}
            </p>
          )}

          {!loadError && colors !== null && colors.length > 0 && (
            <ul className="max-h-64 space-y-1 overflow-y-auto">
              {colors.map((color) => {
                const selected = color.id === value?.id;
                return (
                  <li key={color.id}>
                    <button
                      type="button"
                      onClick={() => choose(color)}
                      aria-pressed={selected}
                      className={`flex w-full items-center gap-2 rounded border px-2 py-1.5 text-left text-sm ${
                        selected
                          ? 'border-neutral-900 bg-neutral-50'
                          : 'border-transparent hover:border-neutral-300'
                      }`}
                    >
                      <Swatch hex={color.hex} />
                      <span className="font-medium">{pantoneLabel(color)}</span>
                      {color.notes && (
                        <span className="truncate text-xs text-neutral-400">{color.notes}</span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          <p className="text-xs text-neutral-400">
            La pastille n est qu un reperage a l ecran. La reference et sa bibliotheque sont la
            seule specification.
          </p>

          <div className="flex flex-wrap items-center gap-3 border-t border-neutral-200 pt-2">
            {value && (
              <button
                type="button"
                onClick={() => choose(null)}
                className="text-sm text-neutral-500 underline hover:text-neutral-900"
              >
                Detacher la couleur
              </button>
            )}
            {!creating && (
              <button
                type="button"
                onClick={() => setCreating(true)}
                className="text-sm text-neutral-500 underline hover:text-neutral-900"
              >
                Nouvelle couleur
              </button>
            )}
          </div>

          {creating && (
            <PantoneCreateForm
              onCancel={() => setCreating(false)}
              onCreated={(created) => {
                // Selectionnee tout de suite : on ne cree une couleur a la volee
                // que parce qu'on en a besoin maintenant. Le jeton de
                // rechargement remet la liste a jour pour la prochaine ouverture.
                setReloadToken((token) => token + 1);
                choose(created);
              }}
            />
          )}
        </div>
      )}
    </div>
  );
}

/** Pastille indicative. Petite et secondaire, par construction. */
function Swatch({ hex }: { hex: string }) {
  return (
    <span
      aria-hidden
      style={{ backgroundColor: hex }}
      className="inline-block h-4 w-4 shrink-0 rounded border border-neutral-300"
    />
  );
}
