'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { fileUrl } from '@/types/product';
import { hasAlphaChannel } from './hasAlphaChannel';
import { LOGO_SLOT, TP_COLORS } from './headerLayout';

const pt = (value: number) => `${value}pt`;

/**
 * Etat remonte au parent.
 *
 * Les messages ne sont PAS rendus ici : le slot vit dans un conteneur a
 * geometrie fixe (hauteur du header, 101pt) et a defilement horizontal. Un
 * message pose en dessous y serait rogne, ce qui ferait disparaitre a la fois
 * l'avertissement d'absence de canal alpha et le bouton de suppression, deux
 * points de la definition of done. Le parent les rend hors du cadre.
 */
export interface LogoStatus {
  busy: boolean;
  error: string | null;
  /** Vrai quand l'image deposee est certainement opaque. */
  alphaWarning: boolean;
  hasLogo: boolean;
  remove: () => void;
}

/**
 * Zone de depot du logo, aux dimensions exactes du slot du techpack.
 *
 * Le slot fait 72 x 70 pt et apparait sur les 12 pages. La cible de depot est a
 * cette taille exacte, pas a une taille confortable : c'est ce qui permet de
 * voir tout de suite si le logo tient, avant de generer le PDF.
 */
export function LogoDropZone({
  productId,
  logoStoragePath,
  onStatus,
}: {
  productId: string;
  logoStoragePath: string | null;
  onStatus: (status: LogoStatus) => void;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [isOver, setIsOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [alphaWarning, setAlphaWarning] = useState(false);

  const upload = useCallback(
    async (file: File) => {
      setBusy(true);
      setError(null);

      // Avertissement avant l'envoi : le fichier est accepte quand meme, c'est
      // peut-etre volontaire. On informe, on ne bloque pas.
      setAlphaWarning((await hasAlphaChannel(file)) === false);

      try {
        const body = new FormData();
        body.append('file', file);
        const response = await fetch(`/api/products/${productId}/logo`, {
          method: 'POST',
          body,
        });
        if (!response.ok) {
          const payload = (await response.json().catch(() => null)) as { error?: string } | null;
          throw new Error(payload?.error ?? `Erreur ${response.status}`);
        }
        router.refresh();
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : 'Upload impossible');
      } finally {
        setBusy(false);
      }
    },
    [productId, router],
  );

  const remove = useCallback(async () => {
    setBusy(true);
    setError(null);
    setAlphaWarning(false);
    try {
      const response = await fetch(`/api/products/${productId}/logo`, { method: 'DELETE' });
      if (!response.ok) throw new Error(`Erreur ${response.status}`);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Suppression impossible');
    } finally {
      setBusy(false);
    }
  }, [productId, router]);

  const hasLogo = logoStoragePath !== null;
  useEffect(() => {
    onStatus({ busy, error, alphaWarning, hasLogo, remove: () => void remove() });
  }, [onStatus, busy, error, alphaWarning, hasLogo, remove]);

  return (
    <div
      onDragOver={(event) => {
        event.preventDefault();
        setIsOver(true);
      }}
      onDragLeave={() => setIsOver(false)}
      onDrop={(event) => {
        event.preventDefault();
        setIsOver(false);
        const file = event.dataTransfer.files[0];
        if (file) void upload(file);
      }}
      onClick={() => inputRef.current?.click()}
      role="button"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') inputRef.current?.click();
      }}
      title={hasLogo ? 'Remplacer le logo' : 'Deposer un logo (PNG transparent ou SVG)'}
      style={{
        position: 'absolute',
        left: pt(LOGO_SLOT.x),
        top: pt(LOGO_SLOT.y),
        width: pt(LOGO_SLOT.width),
        height: pt(LOGO_SLOT.height),
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        cursor: busy ? 'wait' : 'pointer',
        outline: isOver ? `2px solid ${TP_COLORS.red}` : hasLogo ? 'none' : '1px dashed #8a8a8a',
        outlineOffset: '-1px',
      }}
    >
      {logoStoragePath ? (
        // eslint-disable-next-line @next/next/no-img-element -- meme rendu que TechpackHeader : `contain` brut, sans optimiseur.
        <img
          src={fileUrl(logoStoragePath)}
          alt="Logo du produit"
          style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
        />
      ) : (
        <span style={{ fontSize: '6pt', color: '#555', textAlign: 'center', padding: '2pt' }}>
          {busy ? 'Envoi...' : 'Deposer le logo'}
        </span>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/svg+xml,image/jpeg,image/webp"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void upload(file);
          event.target.value = '';
        }}
      />
    </div>
  );
}
