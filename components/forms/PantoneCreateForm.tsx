'use client';

import { useState } from 'react';
import {
  PANTONE_LIBRARIES,
  type PantoneColor,
  type PantoneLibrary,
} from '@/types/product';

/**
 * Creation d'une couleur dans la bibliotheque maison.
 *
 * Un seul formulaire pour les deux points d'entree : la page de gestion
 * (`/pantones`) et la creation a la volee depuis le selecteur. Le cas reel est
 * le second : Jay recoit un nuancier fournisseur et saisit la reference sans
 * quitter la fiche produit qu'il est en train de remplir.
 *
 * PAS DE BALISE `<form>` ICI, VOLONTAIREMENT. Le selecteur vit a l'interieur du
 * `<form>` de creation de produit : un `<form>` imbrique est invalide en HTML.
 * L'envoi passe donc par un bouton `type="button"`, et la touche Entree est
 * interceptee sur les champs pour qu'elle cree la couleur au lieu de soumettre
 * le formulaire produit qui l'entoure.
 */

const labelClass = 'block text-xs font-medium uppercase tracking-wide text-neutral-500';
const inputClass =
  'w-full rounded border border-neutral-300 px-2 py-1.5 text-sm focus:border-neutral-900 focus:outline-none';

/** Meme motif que le CHECK `pantone_colors_hex` et que le schema Zod. */
const HEX_PATTERN = /^#[0-9A-F]{6}$/;

/**
 * Couleur affichee par le selecteur natif tant que rien n'est saisi.
 *
 * Ce n'est PAS une valeur par defaut : elle n'est jamais envoyee, l'envoi exige
 * un hex explicitement saisi. Un noir pre-rempli ferait croire a une couleur
 * validee alors que personne ne l'a choisie.
 */
const PICKER_PLACEHOLDER = '#000000';

export function PantoneCreateForm({
  onCreated,
  onCancel,
}: {
  /** Recoit la ligne creee par l'API, deja porteuse de son uuid. */
  onCreated: (color: PantoneColor) => void;
  onCancel?: () => void;
}) {
  const [reference, setReference] = useState('');
  const [library, setLibrary] = useState<PantoneLibrary>('TCX');
  const [name, setName] = useState('');
  const [hex, setHex] = useState('');
  const [notes, setNotes] = useState('');

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hexValid = HEX_PATTERN.test(hex);
  const canSubmit = reference.trim() !== '' && hexValid && !busy;

  async function submit() {
    if (!canSubmit) return;
    setBusy(true);
    setError(null);

    try {
      const response = await fetch('/api/pantones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reference: reference.trim(),
          library,
          // Chaine vide plutot que `null` : le schema la normalise en `null`,
          // et la normalisation ne doit exister qu'a un seul endroit.
          name,
          hex,
          notes,
        }),
      });

      const payload = (await response.json().catch(() => null)) as
        | (PantoneColor & { error?: string })
        | null;

      if (!response.ok) {
        // Le 409 de doublon est affiche TEL QUEL : le message de l'API nomme
        // deja la couleur en conflit (« Pantone 19-4052 TCX Classic Blue est
        // deja dans la bibliotheque »), et c'est la seule information qui
        // permette de choisir entre corriger la saisie et reutiliser la couleur
        // existante. Le remplacer par « creation impossible » ferait perdre
        // exactement ce que la route s'est donne du mal a construire.
        throw new Error(payload?.error ?? `Erreur ${response.status}`);
      }
      if (!payload?.id) throw new Error('Reponse inattendue du serveur');

      onCreated(payload);
      setReference('');
      setName('');
      setHex('');
      setNotes('');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Creation impossible');
    } finally {
      setBusy(false);
    }
  }

  /**
   * Entree cree la couleur, jamais le produit qui entoure ce bloc.
   *
   * Sans cette interception, taper une reference puis Entree soumettrait le
   * `<form>` de creation de produit et creerait un produit sans sa couleur.
   */
  function onKeyDown(event: React.KeyboardEvent) {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    void submit();
  }

  return (
    <div className="space-y-3 rounded border border-neutral-200 bg-neutral-50 p-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <span className={labelClass}>Reference</span>
          <input
            autoFocus
            value={reference}
            onChange={(event) => setReference(event.target.value)}
            onKeyDown={onKeyDown}
            placeholder="19-4052"
            className={`${inputClass} font-mono`}
          />
          <p className="text-xs text-neutral-400">
            Sans le suffixe de bibliotheque : 19-4052, pas 19-4052 TCX.
          </p>
        </div>

        <div className="space-y-1">
          <span className={labelClass}>Bibliotheque</span>
          <select
            value={library}
            onChange={(event) => setLibrary(event.target.value as PantoneLibrary)}
            className={inputClass}
          >
            {PANTONE_LIBRARIES.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
          <p className="text-xs text-neutral-400">
            TCX pour teindre un tissu, C ou U pour une encre imprimee.
          </p>
        </div>

        <div className="space-y-1">
          <span className={labelClass}>Nom commercial (optionnel)</span>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Classic Blue"
            className={inputClass}
          />
        </div>

        <div className="space-y-1">
          <span className={labelClass}>Hex indicatif</span>
          <div className="flex items-center gap-2">
            <input
              type="color"
              aria-label="Choisir une teinte indicative"
              value={hexValid ? hex : PICKER_PLACEHOLDER}
              onChange={(event) => setHex(event.target.value.toUpperCase())}
              className="h-8 w-10 cursor-pointer rounded border border-neutral-300"
            />
            <input
              value={hex}
              onChange={(event) => setHex(event.target.value.trim().toUpperCase())}
              onKeyDown={onKeyDown}
              placeholder="#RRGGBB"
              className={`${inputClass} font-mono ${
                hex === '' || hexValid ? '' : 'border-red-400'
              }`}
            />
          </div>
          <p className="text-xs text-neutral-400">
            Rendu ecran seulement. La specification qui part chez le teinturier reste la
            reference et sa bibliotheque.
          </p>
        </div>
      </div>

      <div className="space-y-1">
        <span className={labelClass}>Notes (optionnel)</span>
        <input
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Lab dip valide le 12/03, ecart tolere 1 point"
          className={inputClass}
        />
      </div>

      {error && <p className="rounded bg-red-50 p-2 text-sm text-red-700">{error}</p>}

      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={!canSubmit}
          onClick={() => void submit()}
          title={
            reference.trim() === ''
              ? 'La reference est obligatoire'
              : hexValid
                ? undefined
                : 'Saisissez un hex indicatif au format #RRGGBB'
          }
          className="rounded bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-neutral-700 disabled:opacity-50"
        >
          {busy ? 'Creation...' : 'Creer la couleur'}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="text-sm text-neutral-500 underline hover:text-neutral-900"
          >
            Annuler
          </button>
        )}
      </div>
    </div>
  );
}
