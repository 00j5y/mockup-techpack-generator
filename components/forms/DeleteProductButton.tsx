'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

/**
 * Suppression d'un produit.
 *
 * Tout cascade : flats, points de mesure, valeurs, BOM, callouts, couleurs,
 * packaging, artwork, extra, visuels et revisions. Les fichiers du volume
 * partent aussi. La confirmation demande de retaper le nom du style : un
 * `confirm()` se clique par reflexe, ce geste-la ne se rattrape pas.
 */
export function DeleteProductButton({
  productId,
  styleName,
}: {
  productId: string;
  styleName: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/products/${productId}`, { method: 'DELETE' });
      if (!response.ok) throw new Error(`Erreur ${response.status}`);
      router.push('/products');
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Suppression impossible');
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs text-neutral-400 underline hover:text-red-600"
      >
        Supprimer ce produit
      </button>
    );
  }

  return (
    <div className="space-y-2 rounded border border-red-300 bg-red-50 p-3 text-sm">
      <p className="text-red-800">
        Supprime le produit et tout ce qui en depend : flats, mesures, BOM, callouts, couleurs,
        packaging, artwork, visuels generes et revisions. Les fichiers sont effaces du disque.
      </p>
      <p className="text-red-800">
        Taper <strong>{styleName}</strong> pour confirmer :
      </p>
      <input
        value={typed}
        onChange={(event) => setTyped(event.target.value)}
        className="w-full rounded border border-red-300 px-2 py-1 text-sm"
      />
      {error && <p className="text-red-700">{error}</p>}
      <div className="flex gap-2">
        <button
          type="button"
          disabled={typed !== styleName || busy}
          onClick={() => void remove()}
          className="rounded bg-red-600 px-3 py-1 text-xs font-medium text-white disabled:opacity-40"
        >
          {busy ? 'Suppression...' : 'Supprimer definitivement'}
        </button>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setTyped('');
          }}
          className="rounded border border-neutral-300 bg-white px-3 py-1 text-xs"
        >
          Annuler
        </button>
      </div>
    </div>
  );
}
