'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { PantoneSelect } from './PantoneSelect';
import { SaveIndicator } from './SaveIndicator';
import { useAutoSavePatch } from './useAutoSavePatch';
import type { PantoneColor } from '@/types/product';

/**
 * Couleur du tissu principal de la fiche produit, auto-sauvegardee.
 *
 * Le produit ne stocke QUE l'identifiant (`fabricPantoneId`) : c'est lui qui
 * part sur le reseau. L'objet couleur n'est garde ici que pour l'affichage du
 * libelle, et n'est jamais recopie dans la table des produits (ce serait la
 * seconde source que la suppression de `fabric_color_hex` a fait disparaitre).
 *
 * `delay: 0` comme pour les autres selects : choisir dans une liste n'est pas
 * une frappe, il n'y a rien a amortir.
 */
export function FabricPantoneField({
  url,
  initial,
}: {
  /** Route a patcher, `/api/products/<id>`. */
  url: string;
  initial: PantoneColor | null;
}) {
  const router = useRouter();

  const auto = useAutoSavePatch<string | null>({
    url,
    field: 'fabricPantoneId',
    initial: initial?.id ?? null,
    delay: 0,
    onSaved: () => router.refresh(),
  });

  /**
   * Couleur affichee.
   *
   * Etat local et non prop derivee : apres un enregistrement echoue, l'ecran
   * doit continuer a montrer ce que Jay a choisi, avec l'erreur a cote, jamais
   * revenir en douce a la valeur serveur. C'est la garantie n.1 de
   * `useAutoSavePatch`, appliquee ici au libelle.
   */
  const [color, setColor] = useState<PantoneColor | null>(initial);

  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between gap-2">
        <span className="block text-xs font-medium uppercase tracking-wide text-neutral-500">
          Couleur du tissu
        </span>
        <SaveIndicator state={auto.state} error={auto.error} onRetry={auto.retry} />
      </div>

      <PantoneSelect
        value={color}
        onChange={(next) => {
          setColor(next);
          auto.setValue(next?.id ?? null);
        }}
      />

      <p className="text-xs text-neutral-400">Alimente le prompt du visuel IA (Phase 5).</p>
    </div>
  );
}
