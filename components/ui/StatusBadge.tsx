import type { ProductStatus } from '@/types/product';

/**
 * Badge de statut. Les quatre statuts doivent etre distinguables d'un coup
 * d'oeil dans la liste : un `archived` qui ressemble a un `production` est une
 * source d'erreur reelle quand on cherche quel techpack envoyer.
 */
const STYLES: Record<ProductStatus, string> = {
  draft: 'bg-neutral-100 text-neutral-600 border-neutral-300',
  sample: 'bg-amber-50 text-amber-800 border-amber-300',
  production: 'bg-emerald-50 text-emerald-800 border-emerald-300',
  archived: 'bg-neutral-800 text-neutral-100 border-neutral-800',
};

export function StatusBadge({ status }: { status: string }) {
  const style = STYLES[status as ProductStatus] ?? STYLES.draft;
  return (
    <span
      className={`inline-block rounded border px-1.5 py-0.5 text-xs font-medium uppercase tracking-wide ${style}`}
    >
      {status}
    </span>
  );
}
