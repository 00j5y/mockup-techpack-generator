/**
 * Formatage de dates partage entre le rendu print et l'interface (`lib/format.ts`).
 *
 * L'enjeu n'est pas le format en lui-meme mais son INVARIANCE : le serveur et le
 * client doivent produire la meme chaine, sinon React signale un ecart
 * d'hydratation et, pire, le PDF ne montre pas ce que Jay a vu a l'ecran. D'ou
 * les accesseurs UTC dans l'implementation, et les tests de verrouillage
 * ci-dessous.
 */

import { describe, expect, test } from 'bun:test';
import { formatTechpackDate, formatUiDate } from '@/lib/format';

/** Meme journee UTC, aux deux extremites : 00h30 et 23h30. */
const EARLY_UTC = new Date(Date.UTC(2026, 2, 14, 0, 30));
const LATE_UTC = new Date(Date.UTC(2026, 2, 14, 23, 30));

describe('formatTechpackDate', () => {
  test('rend la date americaine MM/DD/YYYY du document source', () => {
    expect(formatTechpackDate(new Date(Date.UTC(2026, 2, 14, 12)))).toBe('03/14/2026');
  });

  test('complete le mois et le jour a deux chiffres', () => {
    expect(formatTechpackDate(new Date(Date.UTC(2026, 0, 5, 12)))).toBe('01/05/2026');
  });

  test('accepte une chaine ISO comme une instance Date', () => {
    expect(formatTechpackDate('2026-03-14T12:00:00.000Z')).toBe(
      formatTechpackDate(new Date(Date.UTC(2026, 2, 14, 12))),
    );
  });

  test('rend une chaine vide sur une date invalide', () => {
    expect(formatTechpackDate('pas une date')).toBe('');
    expect(formatTechpackDate(new Date(Number.NaN))).toBe('');
  });
});

describe('formatUiDate', () => {
  test('rend la date francaise JJ/MM/AAAA', () => {
    expect(formatUiDate(new Date(Date.UTC(2026, 2, 14, 12)))).toBe('14/03/2026');
  });

  test('complete le jour et le mois a deux chiffres', () => {
    expect(formatUiDate(new Date(Date.UTC(2026, 0, 5, 12)))).toBe('05/01/2026');
  });

  test('accepte une chaine ISO comme une instance Date', () => {
    expect(formatUiDate('2026-03-14T12:00:00.000Z')).toBe('14/03/2026');
  });

  test('rend une chaine vide sur une date invalide', () => {
    expect(formatUiDate('pas une date')).toBe('');
    expect(formatUiDate(new Date(Number.NaN))).toBe('');
  });

  test('inverse jour et mois par rapport au format techpack', () => {
    // Le meme instant ne doit pas donner la meme chaine dans les deux formats :
    // c'est ce qui garantit qu'on n'a pas branche le mauvais formateur quelque
    // part. Le 14/03 est volontairement ambigu-proof (14 > 12).
    const instant = new Date(Date.UTC(2026, 2, 14, 12));
    expect(formatUiDate(instant)).toBe('14/03/2026');
    expect(formatTechpackDate(instant)).toBe('03/14/2026');
  });
});

/**
 * Verrou d'independance a la machine.
 *
 * Les deux instants testes appartiennent a la meme journee UTC mais tombent de
 * part et d'autre de minuit local des que la machine n'est pas en UTC :
 * a UTC+2 le tardif est deja le 15 mars, a UTC-2 le matinal est encore le 13.
 * Une implementation qui repasserait sur `getDate()` / `getMonth()` locaux
 * casserait donc au moins l'un des deux cas sur toute machine decalee.
 *
 * Meme logique pour la locale : les chaines attendues sont ecrites en dur, un
 * passage a `toLocaleDateString()` rendrait « 14/03/2026 » en `fr-FR` et
 * « 3/14/2026 » en `en-US`, donc au moins un des deux formats casserait.
 */
describe('independance a la locale et au fuseau de la machine', () => {
  test('formatTechpackDate rend la meme journee aux deux bouts de la journee UTC', () => {
    expect(formatTechpackDate(EARLY_UTC)).toBe('03/14/2026');
    expect(formatTechpackDate(LATE_UTC)).toBe('03/14/2026');
  });

  test('formatUiDate rend la meme journee aux deux bouts de la journee UTC', () => {
    expect(formatUiDate(EARLY_UTC)).toBe('14/03/2026');
    expect(formatUiDate(LATE_UTC)).toBe('14/03/2026');
  });

  test('la sortie ne suit pas les accesseurs locaux sur une machine decalee', () => {
    // Comparaison directe a ce que produirait une implementation locale. Sur une
    // machine en UTC les deux coincident et le test est neutre ; sur toute autre
    // machine il attrape le retour aux accesseurs locaux.
    const localRendering = (date: Date) =>
      `${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')}/${date.getFullYear()}`;
    const offsetMinutes = LATE_UTC.getTimezoneOffset();

    if (offsetMinutes === 0) {
      expect(formatTechpackDate(LATE_UTC)).toBe(localRendering(LATE_UTC));
      return;
    }
    const shifted = offsetMinutes < 0 ? LATE_UTC : EARLY_UTC;
    expect(formatTechpackDate(shifted)).not.toBe(localRendering(shifted));
  });

  test('une date ISO sans heure est lue en UTC, pas en heure locale', () => {
    // `new Date('2026-03-14')` est specifie comme minuit UTC. Une lecture locale
    // ferait basculer la date d'un jour sur les fuseaux negatifs.
    expect(formatTechpackDate('2026-03-14')).toBe('03/14/2026');
    expect(formatUiDate('2026-03-14')).toBe('14/03/2026');
  });
});
