import Link from 'next/link';
import { ProductCreateForm } from '@/components/forms/ProductCreateForm';
import { getMostRecentLogoPath } from '@/lib/db/queries';

export const dynamic = 'force-dynamic';

export default async function NewProductPage() {
  // Pre-remplissage du logo depuis le produit le plus recent : evite de
  // redeposer le meme fichier a chaque piece, sans introduire de table de
  // reglages globaux.
  const prefilledLogoPath = await getMostRecentLogoPath();

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <Link href="/products" className="text-xs text-neutral-500 hover:underline">
          Produits
        </Link>
        <h1 className="text-xl font-semibold">Nouveau produit</h1>
        <p className="text-sm text-neutral-500">
          Les flats, mesures et BOM se remplissent apres creation, depuis la vue produit.
        </p>
      </div>

      <ProductCreateForm prefilledLogoPath={prefilledLogoPath} />
    </div>
  );
}
