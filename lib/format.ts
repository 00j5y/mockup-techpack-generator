/**
 * Formatage partage entre le rendu print du techpack et l'interface d'edition.
 *
 * Aucune dependance a la locale du navigateur : le serveur et le client doivent
 * produire exactement la meme chaine, sinon React signale un ecart d'hydratation
 * et, pire, le PDF ne montre pas ce que Jay a vu a l'ecran.
 */

/**
 * Date du techpack, format `MM/DD/YYYY`.
 *
 * Format americain assume : le techpack part chez un fournisseur, c'est la
 * convention du document source.
 */
export function formatTechpackDate(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${month}/${day}/${date.getUTCFullYear()}`;
}

/** Date lisible dans l'interface, format `JJ/MM/AAAA`. */
export function formatUiDate(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const day = String(date.getUTCDate()).padStart(2, '0');
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${day}/${month}/${date.getUTCFullYear()}`;
}
