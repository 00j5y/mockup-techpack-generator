import { PantoneLibrary } from '@/components/forms/PantoneLibrary';
import { listPantoneColors, listPantoneUsage } from '@/lib/db/queries';

/**
 * Bibliotheque Pantone maison.
 *
 * Ce n'est PAS le catalogue officiel Pantone, qui est sous licence : c'est la
 * liste des couleurs reellement validees avec les fournisseurs, alimentee au fil
 * des lab dips. Elle est globale, pas par produit.
 *
 * Server Component : la lecture part directement d'ici, sans route API
 * intermediaire, comme la liste des produits.
 */

// Les donnees changent a chaque auto-save : pas de cache statique.
export const dynamic = 'force-dynamic';

export default async function PantonesPage() {
  const [colors, usage] = await Promise.all([listPantoneColors(), listPantoneUsage()]);

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold">Bibliotheque Pantone</h1>
        <p className="text-sm text-neutral-500">
          Les couleurs validees avec les fournisseurs. Ce sont la reference et sa bibliotheque
          (19-4052 TCX) qui partent chez le teinturier : le hex n est qu un reperage a l ecran.
        </p>
      </div>

      <PantoneLibrary colors={colors} usage={usage} />
    </div>
  );
}
