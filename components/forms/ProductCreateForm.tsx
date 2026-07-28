'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { LOGO_SLOT, TP_COLORS } from '@/components/techpack/headerLayout';
import {
  GRADIENT_INTENSITIES,
  PRODUCT_CATEGORIES,
  PRODUCT_STATUSES,
  TECHPACK_SIZE_COLUMNS,
  fileUrl,
  type GradientIntensity,
  type Product,
  type ProductCategory,
  type ProductStatus,
} from '@/types/product';

/**
 * Creation d'un produit.
 *
 * Seuls les champs de la table `products` sont ici. Les flats, mesures et BOM
 * se remplissent apres creation, depuis la vue produit : demander tout d'un
 * coup produirait un formulaire que personne ne remplit en entier.
 *
 * Pas d'auto-save sur cet ecran : il n'y a pas encore de ligne a mettre a jour.
 * L'auto-save prend le relais des la redirection vers `/products/[id]`.
 */

const labelClass = 'block text-xs font-medium uppercase tracking-wide text-neutral-500';
const inputClass =
  'w-full rounded border border-neutral-300 px-2 py-1.5 text-sm focus:border-neutral-900 focus:outline-none';

const DEFAULT_SIZES = ['XS', 'S', 'M', 'L', 'XL', '2XL'];

const pt = (value: number) => `${value}pt`;

export function ProductCreateForm({ prefilledLogoPath }: { prefilledLogoPath: string | null }) {
  const router = useRouter();

  const [dropNumber, setDropNumber] = useState(1);
  const [styleName, setStyleName] = useState('');
  const [styleNumber, setStyleNumber] = useState('');
  const [category, setCategory] = useState<ProductCategory>('shirt');
  const [mainFabric, setMainFabric] = useState('');
  const [description, setDescription] = useState('');
  const [fabricColorHex, setFabricColorHex] = useState('');
  const [gradientEnabled, setGradientEnabled] = useState(false);
  const [gradientIntensity, setGradientIntensity] = useState<GradientIntensity>('medium');
  const [sizeRange, setSizeRange] = useState<string[]>(DEFAULT_SIZES);
  const [sampleSize, setSampleSize] = useState('L');
  const [designer, setDesigner] = useState('Constitue');
  const [company, setCompany] = useState('Constitue');
  const [status, setStatus] = useState<ProductStatus>('draft');
  // Le logo repris du dernier produit est duplique cote serveur a la creation :
  // deux produits ne doivent jamais pointer sur le meme fichier.
  const [keepLogo, setKeepLogo] = useState(prefilledLogoPath !== null);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleSize(size: string) {
    const next = sizeRange.includes(size)
      ? sizeRange.filter((s) => s !== size)
      : TECHPACK_SIZE_COLUMNS.filter((s) => sizeRange.includes(s) || s === size);
    if (next.length === 0) return;
    setSizeRange(next);
    if (!next.includes(sampleSize)) setSampleSize(next[0]);
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dropNumber,
          styleName,
          styleNumber,
          category,
          mainFabric,
          description: description.trim() === '' ? null : description,
          fabricColorHex: fabricColorHex.trim() === '' ? null : fabricColorHex.toUpperCase(),
          fabricGradientEnabled: gradientEnabled,
          fabricGradientIntensity: gradientEnabled ? gradientIntensity : null,
          sizeRange,
          sampleSize,
          designer,
          company,
          status,
          logoStoragePath: keepLogo ? prefilledLogoPath : null,
        }),
      });

      const payload = (await response.json().catch(() => null)) as
        | (Product & { error?: string })
        | null;

      if (!response.ok) {
        throw new Error(payload?.error ?? `Erreur ${response.status}`);
      }
      if (!payload?.id) throw new Error('Reponse inattendue du serveur');

      router.push(`/products/${payload.id}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Creation impossible');
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit} className="max-w-2xl space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <label className={labelClass} htmlFor="dropNumber">
            Drop
          </label>
          <input
            id="dropNumber"
            type="number"
            min={1}
            required
            value={dropNumber}
            onChange={(event) => setDropNumber(Number(event.target.value))}
            className={inputClass}
          />
        </div>
        <div className="space-y-1">
          <label className={labelClass} htmlFor="category">
            Categorie
          </label>
          <select
            id="category"
            value={category}
            onChange={(event) => setCategory(event.target.value as ProductCategory)}
            className={inputClass}
          >
            {PRODUCT_CATEGORIES.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label className={labelClass} htmlFor="styleName">
            Style name
          </label>
          <input
            id="styleName"
            required
            value={styleName}
            onChange={(event) => setStyleName(event.target.value)}
            className={inputClass}
          />
        </div>
        <div className="space-y-1">
          <label className={labelClass} htmlFor="styleNumber">
            Style number
          </label>
          <input
            id="styleNumber"
            required
            value={styleNumber}
            onChange={(event) => setStyleNumber(event.target.value)}
            className={inputClass}
          />
        </div>
      </div>

      <div className="space-y-1">
        <label className={labelClass} htmlFor="mainFabric">
          Main fabric
        </label>
        <input
          id="mainFabric"
          required
          placeholder="270 GSM yarn-dyed cotton interlock"
          value={mainFabric}
          onChange={(event) => setMainFabric(event.target.value)}
          className={inputClass}
        />
      </div>

      <div className="space-y-1">
        <label className={labelClass} htmlFor="description">
          Description
        </label>
        <textarea
          id="description"
          rows={2}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          className={inputClass}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <span className={labelClass}>Couleur du tissu</span>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={/^#[0-9a-fA-F]{6}$/.test(fabricColorHex) ? fabricColorHex : '#000000'}
              onChange={(event) => setFabricColorHex(event.target.value.toUpperCase())}
              className="h-8 w-10 cursor-pointer rounded border border-neutral-300"
            />
            <input
              type="text"
              placeholder="#RRGGBB"
              value={fabricColorHex}
              onChange={(event) => setFabricColorHex(event.target.value.trim().toUpperCase())}
              className={`${inputClass} font-mono`}
            />
          </div>
        </div>
        <div className="space-y-1">
          <span className={labelClass}>Degrade de tissu</span>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={gradientEnabled}
              onChange={(event) => setGradientEnabled(event.target.checked)}
              className="h-4 w-4"
            />
            <span>Active</span>
          </label>
          {gradientEnabled && (
            <select
              value={gradientIntensity}
              onChange={(event) => setGradientIntensity(event.target.value as GradientIntensity)}
              className={`${inputClass} mt-1`}
            >
              {GRADIENT_INTENSITIES.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      <div className="space-y-1">
        <span className={labelClass}>Gamme de tailles</span>
        <div className="flex flex-wrap gap-1">
          {TECHPACK_SIZE_COLUMNS.map((size) => (
            <button
              key={size}
              type="button"
              onClick={() => toggleSize(size)}
              className={`rounded border px-2 py-1 text-xs font-medium ${
                sizeRange.includes(size)
                  ? 'border-neutral-900 bg-neutral-900 text-white'
                  : 'border-neutral-300 text-neutral-600 hover:border-neutral-500'
              }`}
            >
              {size}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-1">
        <label className={labelClass} htmlFor="sampleSize">
          Taille de reference
        </label>
        <select
          id="sampleSize"
          value={sampleSize}
          onChange={(event) => setSampleSize(event.target.value)}
          className={`${inputClass} max-w-40`}
        >
          {sizeRange.map((size) => (
            <option key={size} value={size}>
              {size}
            </option>
          ))}
        </select>
        <p className="text-xs text-neutral-400">
          Pilote l encadre rouge du header, la colonne remplie page 3 et les valeurs des cotes
          page 2.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-1">
          <label className={labelClass} htmlFor="designer">
            Designer
          </label>
          <input
            id="designer"
            required
            value={designer}
            onChange={(event) => setDesigner(event.target.value)}
            className={inputClass}
          />
        </div>
        <div className="space-y-1">
          <label className={labelClass} htmlFor="company">
            Company
          </label>
          <input
            id="company"
            required
            value={company}
            onChange={(event) => setCompany(event.target.value)}
            className={inputClass}
          />
        </div>
        <div className="space-y-1">
          <label className={labelClass} htmlFor="status">
            Statut
          </label>
          <select
            id="status"
            value={status}
            onChange={(event) => setStatus(event.target.value as ProductStatus)}
            className={inputClass}
          >
            {PRODUCT_STATUSES.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="space-y-1">
        <span className={labelClass}>Logo</span>
        {prefilledLogoPath ? (
          <label className="flex items-center gap-3 rounded border border-neutral-200 bg-neutral-50 p-2">
            <input
              type="checkbox"
              checked={keepLogo}
              onChange={(event) => setKeepLogo(event.target.checked)}
              className="h-4 w-4"
            />
            {/* Vignette aux dimensions exactes du slot du techpack, lues dans
                `headerLayout.ts` : elle pretend montrer le logo tel qu'il
                sortira sur les 12 pages, donc une valeur recopiee ici mentirait
                des que `LOGO_SLOT` bougerait (regle dure numero 2). */}
            <span
              className="flex shrink-0 items-center justify-center"
              style={{
                width: pt(LOGO_SLOT.width),
                height: pt(LOGO_SLOT.height),
                background: TP_COLORS.bar,
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- meme rendu que le slot du techpack */}
              <img
                src={fileUrl(prefilledLogoPath)}
                alt=""
                className="max-h-full max-w-full object-contain"
              />
            </span>
            <span className="text-sm text-neutral-600">
              Reprendre le logo du produit le plus recent. Modifiable ensuite dans le header.
            </span>
          </label>
        ) : (
          <p className="text-sm text-neutral-500">
            Aucun produit existant ne porte de logo. Vous le deposerez dans le header apres
            creation.
          </p>
        )}
      </div>

      {error && <p className="rounded bg-red-50 p-2 text-sm text-red-700">{error}</p>}

      <button
        type="submit"
        disabled={submitting}
        className="rounded bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700 disabled:opacity-50"
      >
        {submitting ? 'Creation...' : 'Creer le produit'}
      </button>
    </form>
  );
}
