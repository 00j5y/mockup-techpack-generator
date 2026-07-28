'use client';

import { useEffect, useState } from 'react';

/**
 * Passe a `true` une fois les polices web reellement chargees.
 *
 * `next/font` est en `display: 'swap'` : le premier rendu utilise la police de
 * repli du navigateur, plus large que Source Sans 3. Une mesure de debordement
 * faite a ce moment-la reste fausse tant que l'utilisateur ne retape rien, donc
 * tant que le `useMemo` qui la porte n'est pas invalide.
 *
 * Ce booleen sert de dependance de recalcul : une seule bascule, au moment ou
 * la vraie police est en place. Voir `measureTextPt.ts`.
 */
export function useFontsReady(): boolean {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Rendu serveur, ou navigateur sans `FontFaceSet` : il n'y a rien a
    // attendre, on considere la police en place tout de suite.
    if (typeof document === 'undefined' || !('fonts' in document)) {
      setReady(true);
      return;
    }

    let cancelled = false;
    void document.fonts.ready.then(() => {
      if (!cancelled) setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return ready;
}
