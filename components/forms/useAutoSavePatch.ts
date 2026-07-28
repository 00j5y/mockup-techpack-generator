'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Auto-save d'un champ unique, par PATCH JSON.
 *
 * Primitive partagee par le formulaire general et par le header editable : la
 * logique de debounce n'est ecrite qu'ici, jamais recopiee dans une page.
 *
 * Garanties, dans l'ordre d'importance :
 *
 * 1. **Aucune saisie perdue.** En cas d'echec reseau, la valeur locale reste
 *    affichee, l'erreur est visible, et un retry est possible. On ne revient
 *    jamais a la valeur serveur dans le dos de l'utilisateur.
 * 2. **Un seul PATCH en vol a la fois, par champ.** Deux requetes concurrentes
 *    sur le meme champ peuvent arriver au serveur dans le desordre : la base
 *    garderait alors l'ancienne valeur pendant que l'ecran affiche la nouvelle
 *    et annonce "Enregistre". Les envois sont donc serialises, avec une file
 *    d'un seul element (seule la derniere valeur compte).
 * 3. **Un debounce par champ**, pas un debounce global : un PATCH global
 *    reecrirait des champs que l'utilisateur n'a pas touches.
 * 4. **Flush au demontage et a la fermeture d'onglet.** Un PATCH en vol quand
 *    on change de page est annule par le navigateur ; sans ce flush, la
 *    derniere seconde de frappe disparait. Voir .claude/docs/12-pieges.md.
 */

export type SaveState = 'idle' | 'pending' | 'saving' | 'saved' | 'error';

/** Duree d'affichage de "Enregistre" avant retour a l'etat neutre. */
const SAVED_LINGER_MS = 2000;

/**
 * Egalite de valeur de champ.
 *
 * `Object.is` ne suffit pas : `size_range` est un tableau, et un nouveau
 * tableau de contenu identique serait vu comme une modification. Le flush au
 * demontage renverrait alors un PATCH inutile a chaque changement de page.
 */
function sameValue(a: unknown, b: unknown): boolean {
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((item, index) => Object.is(item, b[index]));
  }
  return Object.is(a, b);
}

interface Options<T> {
  /** Route a patcher, par exemple `/api/products/<id>`. */
  url: string;
  /** Nom du champ envoye dans le corps : `{ [field]: value }`. */
  field: string;
  initial: T;
  /** Debounce, en millisecondes. 1s par convention du projet. */
  delay?: number;
  /** Appele apres un enregistrement reussi, pour rafraichir les donnees serveur. */
  onSaved?: (value: T) => void;
}

export interface AutoSaveField<T> {
  value: T;
  setValue: (next: T) => void;
  state: SaveState;
  error: string | null;
  /** Renvoie la valeur locale au serveur apres un echec. */
  retry: () => void;
  /** Envoie immediatement sans attendre le debounce (blur, submit). */
  flush: () => void;
}

export function useAutoSavePatch<T>({
  url,
  field,
  initial,
  delay = 1000,
  onSaved,
}: Options<T>): AutoSaveField<T> {
  const [value, setValueState] = useState<T>(initial);
  const [state, setState] = useState<SaveState>('idle');
  const [error, setError] = useState<string | null>(null);

  /** Derniere valeur confirmee par le serveur. */
  const savedRef = useRef<T>(initial);
  /** Derniere valeur saisie, potentiellement pas encore envoyee. */
  const pendingRef = useRef<T>(initial);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lingerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Serialisation : une requete en vol, et au plus une en attente. */
  const inFlightRef = useRef(false);
  const queuedRef = useRef(false);
  const onSavedRef = useRef(onSaved);
  onSavedRef.current = onSaved;

  /** Envoi brut, sans passer par la file. Reserve au chemin `beforeunload`. */
  const rawSend = useCallback(
    async (next: T, keepalive: boolean) => {
      const response = await fetch(url, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: next }),
        keepalive,
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? `Erreur ${response.status}`);
      }
    },
    [url, field],
  );

  /**
   * Envoie la valeur en attente, en garantissant qu'une seule requete est en
   * vol. Si un envoi est deja parti, on note qu'il faudra recommencer : la
   * valeur envoyee sera relue au moment ou la file se vide, donc c'est bien la
   * derniere frappe qui gagne.
   */
  const send = useCallback(async () => {
    if (inFlightRef.current) {
      queuedRef.current = true;
      return;
    }
    inFlightRef.current = true;

    if (lingerRef.current) {
      clearTimeout(lingerRef.current);
      lingerRef.current = null;
    }

    const next = pendingRef.current;
    setState('saving');
    setError(null);

    try {
      await rawSend(next, false);
      savedRef.current = next;

      if (sameValue(pendingRef.current, next)) {
        setState('saved');
        onSavedRef.current?.(next);
        lingerRef.current = setTimeout(() => {
          lingerRef.current = null;
          // Ne pas ecraser un etat plus recent (nouvelle frappe, nouvelle erreur).
          setState((current) => (current === 'saved' ? 'idle' : current));
        }, SAVED_LINGER_MS);
      } else {
        // Une frappe est arrivee pendant la requete : il reste du retard.
        setState('pending');
      }
    } catch (caught) {
      // La valeur locale n'est pas touchee : c'est la garantie n.1.
      setError(caught instanceof Error ? caught.message : 'Echec de l enregistrement');
      setState('error');
      // Ne pas relancer automatiquement apres un echec : une boucle de retry
      // sur une erreur de validation tournerait indefiniment. Le bouton
      // "Reessayer" rend la decision a l'utilisateur.
      queuedRef.current = false;
      inFlightRef.current = false;
      return;
    }

    inFlightRef.current = false;

    if (queuedRef.current) {
      queuedRef.current = false;
      if (!sameValue(pendingRef.current, savedRef.current)) {
        void send();
      }
    }
  }, [rawSend]);

  const setValue = useCallback(
    (next: T) => {
      setValueState(next);
      pendingRef.current = next;
      setState('pending');
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        void send();
      }, delay);
    },
    [delay, send],
  );

  const flush = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (!sameValue(pendingRef.current, savedRef.current)) {
      void send();
    }
  }, [send]);

  const retry = useCallback(() => {
    if (inFlightRef.current) return;
    void send();
  }, [send]);

  /**
   * Renvoi de derniere chance, appele a la fermeture d'onglet et au demontage.
   *
   * Ne depend PAS de la presence d'un timer arme : apres un echec le timer a
   * deja ete consomme, et conditionner le renvoi a son existence perdait la
   * saisie des que l'utilisateur quittait la page. `keepalive` laisse la
   * requete partir meme si le document est detruit.
   */
  const flushOnLeave = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (sameValue(pendingRef.current, savedRef.current)) return;
    // Envoi direct, sans la file : le document peut disparaitre avant qu'elle
    // se vide. C'est la derniere valeur saisie qui part.
    void rawSend(pendingRef.current, true).catch(() => undefined);
  }, [rawSend]);

  useEffect(() => {
    window.addEventListener('beforeunload', flushOnLeave);
    return () => window.removeEventListener('beforeunload', flushOnLeave);
  }, [flushOnLeave]);

  useEffect(
    () => () => {
      if (lingerRef.current) clearTimeout(lingerRef.current);
      flushOnLeave();
    },
    [flushOnLeave],
  );

  return { value, setValue, state, error, retry, flush };
}
