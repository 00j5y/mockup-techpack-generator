'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { fileUrl } from '@/types/product';
import { hasAlphaChannel } from './hasAlphaChannel';
import { removeUniformBackground, rgbToHex } from './removeUniformBackground';
import { LOGO_SLOT, TP_COLORS } from './headerLayout';

const pt = (value: number) => `${value}pt`;

/**
 * Detourage applique au dernier fichier depose.
 *
 * `restore` est la porte de sortie : le detourage automatique peut se tromper
 * sur un logo dont le fond fait partie du design, et l'operation ne doit etre ni
 * irreversible ni silencieuse. Elle renvoie le fichier d'origine tel quel, donc
 * elle n'est disponible que tant que la page n'a pas ete rechargee : passe ce
 * point, il reste le remplacement du logo.
 */
export interface LogoBackgroundNotice {
  /** Couleur du fond retire, `#RRGGBB`, a afficher dans le message. */
  colorHex: string;
  /** Reenvoie le fichier d'origine, sans detourage. */
  restore: () => void;
}

/**
 * Etat remonte au parent.
 *
 * Les messages ne sont PAS rendus ici : le slot vit dans un conteneur a
 * geometrie fixe (hauteur du header, 101pt) et a defilement horizontal. Un
 * message pose en dessous y serait rogne, ce qui ferait disparaitre a la fois
 * l'avertissement d'absence de canal alpha et le bouton de suppression, deux
 * points de la definition of done. Le parent les rend hors du cadre.
 *
 * `background` suit la meme regle et attend son rendu chez le parent, a cote de
 * `alphaWarning` :
 *
 *   {logoStatus?.background && (
 *     <p className="text-xs text-neutral-600">
 *       Fond uni <code>{logoStatus.background.colorHex}</code> retire.{' '}
 *       <button type="button" onClick={logoStatus.background.restore} className="underline">
 *         Garder le fond
 *       </button>
 *     </p>
 *   )}
 */
export interface LogoStatus {
  busy: boolean;
  error: string | null;
  /** Vrai quand l'image deposee est certainement opaque. */
  alphaWarning: boolean;
  hasLogo: boolean;
  remove: () => void;
  /** Non nul uniquement quand un fond uni vient d'etre retire. */
  background: LogoBackgroundNotice | null;
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
  const [background, setBackground] = useState<LogoBackgroundNotice | null>(null);

  /** Envoi seul : ne decide de rien, ne gere ni `busy` ni les avertissements. */
  const send = useCallback(
    async (file: File) => {
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
    },
    [productId, router],
  );

  /** Porte de sortie : renvoyer le fichier d'origine, fond compris. */
  const restore = useCallback(
    async (original: File) => {
      setBusy(true);
      setError(null);
      setBackground(null);
      try {
        // Le fond etait uni, donc l'image est opaque : l'avertissement d'origine
        // reprend son sens des lors que le detourage est annule.
        setAlphaWarning((await hasAlphaChannel(original)) === false);
        await send(original);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : 'Upload impossible');
      } finally {
        setBusy(false);
      }
    },
    [send],
  );

  const upload = useCallback(
    async (file: File) => {
      setBusy(true);
      setError(null);
      setBackground(null);

      try {
        // Le fond uni est retire avant l'envoi : le slot logo est sur le gris de
        // la bande de header, sur les 12 pages. C'est le detoure qui part au
        // serveur, pas l'original.
        const detoured = await removeUniformBackground(file);

        if (detoured.outcome === 'removed') {
          // Le detourage a produit de la transparence : l'avertissement d'absence
          // de canal alpha n'a plus lieu d'etre.
          setAlphaWarning(false);
          if (detoured.backgroundColor) {
            setBackground({
              colorHex: rgbToHex(detoured.backgroundColor),
              restore: () => void restore(file),
            });
          }
        } else if (
          detoured.outcome === 'no-uniform-background' ||
          detoured.outcome === 'background-covers-image'
        ) {
          // L'image a ete lue et n'avait aucun pixel transparent, sinon le
          // detourage se serait arrete sur `already-transparent`. L'avertissement
          // garde tout son sens ici : il n'y a pas de fond uni a retirer et le
          // rectangle opaque, lui, sera bien la.
          setAlphaWarning(true);
        } else {
          // SVG, image deja transparente, ou lecture impossible : on retombe sur
          // la detection d'avant, qui sait aussi repondre « je ne sais pas ».
          setAlphaWarning((await hasAlphaChannel(file)) === false);
        }

        // Avertissement, pas blocage : le fichier part dans tous les cas.
        await send(detoured.file);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : 'Upload impossible');
      } finally {
        setBusy(false);
      }
    },
    [restore, send],
  );

  const remove = useCallback(async () => {
    setBusy(true);
    setError(null);
    setAlphaWarning(false);
    setBackground(null);
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
    onStatus({ busy, error, alphaWarning, hasLogo, background, remove: () => void remove() });
  }, [onStatus, busy, error, alphaWarning, hasLogo, background, remove]);

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
      title={
        hasLogo
          ? 'Remplacer le logo'
          : 'Deposer un logo (PNG transparent ou SVG). Un fond de couleur uni est retire automatiquement.'
      }
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
