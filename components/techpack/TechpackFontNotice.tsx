'use client';

import { useEffect, useState } from 'react';
import { TYPO } from './headerLayout';
import { useFontsReady } from './useFontsReady';

/**
 * Bandeau d'alerte quand la police du template n'est pas servie par l'application.
 *
 * Le header est cense etre compose en Myriad Pro Bold, servie depuis un dossier
 * hors depot via `/api/fonts/[...path]`. Ce que ce bandeau constate est donc une
 * seule chose : le fichier n'est pas servi, la face `@font-face` est en `error`.
 *
 * Attention, la consequence n'est PAS un repli visible a l'ecran. Mesure par CDP
 * (`CSS.getPlatformFontsForNode`) sur le Mac de Jay : Myriad Pro Bold y est aussi
 * installee en police systeme, donc quand la route repond 404 Chromium peint
 * quand meme en Myriad, via la police locale (`isCustomFont: false`). Annoncer
 * une substitution a l'ecran serait faux, et un avertissement faux s'apprend a
 * s'ignorer.
 *
 * Le vrai risque est la DIVERGENCE ecran / PDF. Le Chromium du conteneur Docker,
 * lui, n'a aucune Myriad installee : sans la route, le PDF sort en Source Sans 3
 * pendant que l'editeur de Jay affiche du Myriad. Or `measureTextPt` mesure le
 * seuil de debordement de colonne avec la police du navigateur, et cette mesure
 * ne vaut que si le PDF utilise la meme police.
 *
 * `12-pieges.md` designe explicitement cette divergence silencieuse comme un
 * piege. Ce composant la rend bruyante, sans plus : un bandeau discret, pas une
 * page d'erreur.
 */

/**
 * Famille CSS attendue, telle que la declare le `@font-face` de l'application
 * dans `app/globals.css`, servie par `/api/fonts/[...path]`.
 */
const EXPECTED_FAMILY = 'Myriad Pro';

/** Graisse declaree par le `@font-face`. Seul le Bold est disponible aujourd'hui. */
const EXPECTED_WEIGHT = String(TYPO.labelWeight);

/**
 * Nom de fichier attendu dans `assets/fonts/`, tel que documente par le README du
 * dossier et repris par le `src` du `@font-face`. Le donner ici evite d'envoyer
 * Jay chercher le nom exact ailleurs.
 */
const EXPECTED_FILE = 'MyriadPro-Bold.ttf';

/**
 * Etat de chargement reel de la police, lu sur la `FontFace` elle-meme.
 *
 * **Ne pas utiliser `document.fonts.check()` ici.** Mesure faite sur ce projet :
 * `check('700 10pt "Myriad Pro"')` renvoie `true` MEME quand la route repond 404
 * et que le telechargement a echoue. C'est conforme a la spec CSS Font Loading,
 * ou une face en statut `error` compte comme terminee. Un bandeau construit sur
 * `check()` ne se declencherait donc jamais, ce qui est pire que pas de bandeau :
 * une fausse assurance sur le point precis qu'il devait surveiller.
 *
 * Le signal fiable est `FontFace.status` : `loaded` contre `error`.
 */
function readFontStatus(): boolean | null {
  if (typeof document === 'undefined' || !('fonts' in document)) return null;

  let found: FontFaceLoadStatus | null = null;
  document.fonts.forEach((face) => {
    if (face.family.replace(/['"]/g, '') !== EXPECTED_FAMILY) return;
    if (face.weight !== EXPECTED_WEIGHT) return;
    found = face.status;
  });

  // Aucune face declaree : la feuille de style n'a pas ete appliquee, ou le
  // `@font-face` a disparu. Dans les deux cas le header n'est pas dans la bonne
  // police, donc on avertit.
  if (found === null) return false;
  // `loading` ne devrait plus arriver apres `document.fonts.ready`. Si ca arrive,
  // on ne se prononce pas plutot que d'accuser a tort.
  if (found === 'loading') return null;
  return found === 'loaded';
}

export function TechpackFontNotice() {
  const fontsReady = useFontsReady();
  // `null` = pas encore verifie. Ne rien afficher tant qu'on ne sait pas : un
  // faux positif au premier rendu apprendrait a Jay a ignorer ce bandeau.
  const [available, setAvailable] = useState<boolean | null>(null);

  useEffect(() => {
    if (!fontsReady) return;
    setAvailable(readFontStatus());
  }, [fontsReady]);

  if (available !== false) return null;

  return (
    <p className="rounded border border-amber-300 bg-amber-50 px-2 py-1 text-xs text-amber-800">
      <span className="font-medium">
        {EXPECTED_FAMILY} Bold n est pas servie par l application.
      </span>{' '}
      Le PDF genere ne l utilisera pas, alors que cet ecran peut tres bien l afficher si elle est
      installee sur la machine : l apercu et le seuil de debordement de colonne ci-dessous sont
      donc trompeurs. Deposez <code className="font-mono">{EXPECTED_FILE}</code> dans{' '}
      <code className="font-mono">assets/fonts/</code> (voir le README du dossier).
    </p>
  );
}
