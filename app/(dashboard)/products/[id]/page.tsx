import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  AutoSaveNumber,
  AutoSaveSelect,
  AutoSaveSizeRange,
  AutoSaveToggle,
} from '@/components/forms/AutoSaveFields';
import { DeleteProductButton } from '@/components/forms/DeleteProductButton';
import { FabricPantoneField } from '@/components/forms/FabricPantoneField';
import { FlatsManager } from '@/components/forms/FlatsManager';
import { TechpackHeaderEditor } from '@/components/techpack/TechpackHeaderEditor';
import { StatusBadge } from '@/components/ui/StatusBadge';
import {
  getPantoneColor,
  getProduct,
  getProductCompletion,
  listFlatsWithImpact,
  techpackBlockers,
  type ProductCompletion,
} from '@/lib/db/queries';
import {
  GRADIENT_INTENSITIES,
  oneOf,
  PRODUCT_CATEGORIES,
  PRODUCT_STATUSES,
  TECHPACK_SIZE_COLUMNS,
  TEMPLATE_LIMITS,
  type GradientIntensity,
  type ProductCategory,
  type ProductStatus,
} from '@/types/product';

export const dynamic = 'force-dynamic';

/**
 * Hub du produit.
 *
 * Server Component : les trois requetes partent d'ici, les enfants clients ne
 * font que patcher. `router.refresh()` apres chaque enregistrement remonte les
 * indicateurs de completion sans rechargement complet.
 */
export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const product = await getProduct(id);
  if (!product) notFound();

  const [flats, completion, fabricPantone] = await Promise.all([
    listFlatsWithImpact(id),
    getProductCompletion(product),
    // Couleur de tissu par REFERENCE : la ligne Pantone porte le libelle et le
    // hex, le produit ne stocke que l'identifiant. Une seule source.
    product.fabricPantoneId ? getPantoneColor(product.fabricPantoneId) : null,
  ]);
  const blockers = techpackBlockers(product, completion);
  const url = `/api/products/${id}`;

  /**
   * Intensite du degrade telle qu'elle est REELLEMENT en base.
   *
   * `null` est conserve au lieu d'etre replie sur 'medium' : replier affichait
   * une intensite que la colonne ne contient pas, sans qu'aucun PATCH ne parte
   * pour la rendre vraie. Le prompt de la Phase 5 aurait alors ete construit
   * avec une intensite nulle pendant que l'ecran en annoncait une.
   */
  const gradientIntensity =
    product.fabricGradientIntensity === null
      ? null
      : oneOf(GRADIENT_INTENSITIES, product.fabricGradientIntensity, 'medium');

  // Degrade actif sans intensite : incoherence a rendre visible, pas a corriger
  // dans le dos de Jay. Le choix doit rester le sien, il alimente le prompt.
  const gradientHint = !product.fabricGradientEnabled ? (
    'Sans effet : degrade desactive.'
  ) : gradientIntensity === null ? (
    <span className="font-medium text-amber-700">
      Degrade active sans intensite definie : la generation du visuel (Phase 5) en aura besoin.
    </span>
  ) : undefined;

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <Link href="/products" className="text-xs text-neutral-500 hover:underline">
            Produits
          </Link>
          <h1 className="flex items-center gap-3 text-xl font-semibold">
            {product.styleName}
            <StatusBadge status={product.status} />
          </h1>
          <p className="font-mono text-xs text-neutral-500">
            Drop {product.dropNumber} / {product.styleNumber}
          </p>
        </div>
      </div>

      <TechpackHeaderEditor product={product} />

      <section className="space-y-4">
        <h2 className="text-sm font-semibold text-neutral-700">
          Informations generales
          <span className="ml-2 font-normal text-neutral-400">
            hors header : ce qui n apparait pas sur les 12 pages
          </span>
        </h2>
        <div className="grid gap-5 md:grid-cols-3">
          <AutoSaveNumber url={url} field="dropNumber" label="Drop" initial={product.dropNumber} />
          <AutoSaveSelect<ProductCategory>
            url={url}
            field="category"
            label="Categorie"
            initial={oneOf(PRODUCT_CATEGORIES, product.category, 'other')}
            options={PRODUCT_CATEGORIES.map((value) => ({ value, label: value }))}
          />
          <AutoSaveSelect<ProductStatus>
            url={url}
            field="status"
            label="Statut"
            initial={oneOf(PRODUCT_STATUSES, product.status, 'draft')}
            options={PRODUCT_STATUSES.map((value) => ({ value, label: value }))}
          />
          <FabricPantoneField url={url} initial={fabricPantone} />
          <AutoSaveToggle
            url={url}
            field="fabricGradientEnabled"
            label="Degrade de tissu"
            initial={product.fabricGradientEnabled}
          />
          <AutoSaveSelect<GradientIntensity>
            url={url}
            field="fabricGradientIntensity"
            label="Intensite du degrade"
            initial={gradientIntensity}
            options={GRADIENT_INTENSITIES.map((value) => ({ value, label: value }))}
            emptyLabel="non renseignee"
            hint={gradientHint}
          />
          <div className="md:col-span-3">
            <AutoSaveSizeRange
              url={url}
              label="Gamme de tailles"
              initial={[...product.sizeRange]}
              sampleSizes={product.sampleSizes}
              options={TECHPACK_SIZE_COLUMNS}
            />
          </div>
        </div>
      </section>

      <FlatsManager productId={id} flats={flats} />

      <CompletionGrid completion={completion} />

      <section className="space-y-2 rounded border border-neutral-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-neutral-700">Techpack</h2>
        <button
          type="button"
          disabled
          title={blockers.length > 0 ? blockers.join(', ') : 'Disponible en Phase 4'}
          className="rounded bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white opacity-40"
        >
          Generer le techpack
        </button>
        {blockers.length > 0 ? (
          <ul className="list-inside list-disc text-xs text-amber-700">
            {blockers.map((blocker) => (
              <li key={blocker}>{blocker}</li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-neutral-500">
            Donnees minimales reunies. La generation arrive en Phase 4.
          </p>
        )}
      </section>

      <DeleteProductButton productId={id} styleName={product.styleName} />
    </div>
  );
}

/**
 * Indicateurs de completion par sous-module.
 *
 * Vraie fonctionnalite de confort : c'est ce qui evite d'envoyer un techpack
 * incomplet au fournisseur. Les denominateurs sont les plafonds du template.
 */
function CompletionGrid({ completion }: { completion: ProductCompletion }) {
  const cards = [
    {
      title: 'Flats',
      value: `${completion.flats.total} uploade(s)`,
      detail: [
        completion.flats.hasFront ? 'front' : 'front manquant',
        completion.flats.hasBack ? 'back' : 'back manquant',
      ].join(', '),
      ok: completion.flats.hasFront && completion.flats.hasBack,
    },
    {
      title: 'Mesures',
      value: `${completion.measurements.points} / ${TEMPLATE_LIMITS.measurementPoints} points`,
      detail: `${completion.measurements.complete} avec valeurs completes`,
      ok: completion.measurements.points > 0,
    },
    {
      title: 'BOM',
      value: `${completion.bom} / ${TEMPLATE_LIMITS.bomCells} cellules`,
      detail: 'Phase 3',
      ok: completion.bom > 0,
    },
    {
      title: 'Couleurs',
      value: `${completion.colors} / ${TEMPLATE_LIMITS.colors}`,
      detail: 'Phase 3',
      ok: completion.colors > 0,
    },
    {
      title: 'Packaging',
      value: `${completion.packaging} bloc(s)`,
      detail: 'Phase 3',
      ok: completion.packaging > 0,
    },
    {
      title: 'Artwork',
      value: `${completion.artwork} element(s)`,
      detail: 'Phase 3',
      ok: completion.artwork > 0,
    },
    {
      title: 'Extra',
      value: `${completion.extra} / ${TEMPLATE_LIMITS.extraReferences}`,
      detail: 'Phase 3',
      ok: completion.extra > 0,
    },
  ];

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold text-neutral-700">Completion</h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => (
          <div
            key={card.title}
            className={`rounded border p-3 ${
              card.ok ? 'border-emerald-300 bg-emerald-50' : 'border-neutral-200 bg-white'
            }`}
          >
            <p className="text-xs uppercase tracking-wide text-neutral-500">{card.title}</p>
            <p className="text-sm font-medium">{card.value}</p>
            <p className="text-xs text-neutral-500">{card.detail}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
