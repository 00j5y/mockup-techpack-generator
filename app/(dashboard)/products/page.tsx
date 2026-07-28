import Link from 'next/link';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { listProducts } from '@/lib/db/queries';
import { formatUiDate } from '@/lib/format';
import {
  PRODUCT_CATEGORIES,
  PRODUCT_STATUSES,
  type ProductCategory,
  type ProductStatus,
} from '@/types/product';

/**
 * Liste des produits. Server Component : la requete Drizzle part directement
 * d'ici, sans passer par une route API pour une simple lecture.
 */

// Les donnees changent a chaque auto-save : pas de cache statique.
export const dynamic = 'force-dynamic';

type SearchParams = Promise<{ category?: string; status?: string }>;

export default async function ProductsPage({ searchParams }: { searchParams: SearchParams }) {
  const filters = await searchParams;

  const category = PRODUCT_CATEGORIES.includes(filters.category as ProductCategory)
    ? (filters.category as ProductCategory)
    : undefined;
  const status = PRODUCT_STATUSES.includes(filters.status as ProductStatus)
    ? (filters.status as ProductStatus)
    : undefined;

  const products = await listProducts({ category, status });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Produits</h1>
        <Link
          href="/products/new"
          className="rounded bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-neutral-700"
        >
          Nouveau produit
        </Link>
      </div>

      <div className="flex flex-wrap gap-6 text-sm">
        <FilterGroup
          title="Categorie"
          param="category"
          values={PRODUCT_CATEGORIES}
          active={category}
          other={status ? { status } : {}}
        />
        <FilterGroup
          title="Statut"
          param="status"
          values={PRODUCT_STATUSES}
          active={status}
          other={category ? { category } : {}}
        />
      </div>

      {products.length === 0 ? (
        <p className="rounded border border-dashed border-neutral-300 p-8 text-center text-sm text-neutral-500">
          Aucun produit{category || status ? ' pour ces filtres' : ''}.
        </p>
      ) : (
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-neutral-300 text-left text-xs uppercase tracking-wide text-neutral-500">
              <th className="py-2 pr-4">Drop</th>
              <th className="py-2 pr-4">Style</th>
              <th className="py-2 pr-4">Numero</th>
              <th className="py-2 pr-4">Categorie</th>
              <th className="py-2 pr-4">Taille ref.</th>
              <th className="py-2 pr-4">Statut</th>
              <th className="py-2">Cree le</th>
            </tr>
          </thead>
          <tbody>
            {products.map((product) => (
              <tr key={product.id} className="border-b border-neutral-200 hover:bg-white">
                <td className="py-2 pr-4 tabular-nums">{product.dropNumber}</td>
                <td className="py-2 pr-4">
                  <Link href={`/products/${product.id}`} className="font-medium underline">
                    {product.styleName}
                  </Link>
                </td>
                <td className="py-2 pr-4 font-mono text-xs">{product.styleNumber}</td>
                <td className="py-2 pr-4">{product.category}</td>
                <td className="py-2 pr-4">
                  {product.sampleSize ?? <span className="text-red-600">a definir</span>}
                </td>
                <td className="py-2 pr-4">
                  <StatusBadge status={product.status} />
                </td>
                <td className="py-2 text-neutral-500">{formatUiDate(product.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function FilterGroup({
  title,
  param,
  values,
  active,
  other,
}: {
  title: string;
  param: string;
  values: readonly string[];
  active: string | undefined;
  other: Record<string, string>;
}) {
  const href = (value?: string) => {
    const query = new URLSearchParams(other);
    if (value) query.set(param, value);
    const suffix = query.toString();
    return suffix ? `/products?${suffix}` : '/products';
  };

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs uppercase tracking-wide text-neutral-400">{title}</span>
      <Link
        href={href()}
        className={`rounded px-2 py-0.5 text-xs ${
          active === undefined ? 'bg-neutral-900 text-white' : 'text-neutral-600 hover:underline'
        }`}
      >
        tous
      </Link>
      {values.map((value) => (
        <Link
          key={value}
          href={href(value)}
          className={`rounded px-2 py-0.5 text-xs ${
            active === value ? 'bg-neutral-900 text-white' : 'text-neutral-600 hover:underline'
          }`}
        >
          {value}
        </Link>
      ))}
    </div>
  );
}
