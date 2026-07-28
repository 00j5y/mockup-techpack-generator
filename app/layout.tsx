import type { Metadata } from 'next';
import { Source_Sans_3 } from 'next/font/google';
import './globals.css';

/**
 * Source Sans 3 : la seule police disponible en Regular, et le repli de Myriad Pro.
 *
 * Depuis que Jay dispose d'un vrai fichier `MyriadPro-Bold`, Myriad Pro couvre le
 * BOLD (voir le `@font-face` de `app/globals.css`) et Source Sans 3 couvre tout
 * le reste. Source Sans 3 reste indispensable : pas de Myriad Pro Regular, et
 * rien du tout si le fichier n'a pas ete depose dans `assets/fonts/`.
 *
 * `next/font` telecharge la police au BUILD et la sert depuis l'application :
 * aucun appel CDN a l'execution, ce qui est la contrainte reelle pour le rendu
 * Puppeteer en conteneur.
 *
 * La variable s'appelle `--font-source-sans` et non `--font-techpack` : ce
 * dernier nom designe la PILE complete (Myriad Pro puis Source Sans 3), assemblee
 * une seule fois dans `app/globals.css`. `next/font` la poserait via une classe,
 * dont la specificite ecraserait la pile.
 *
 * Voir .claude/docs/15-template-seaggs.md, section Typographie.
 */
const sourceSans = Source_Sans_3({
  variable: '--font-source-sans',
  subsets: ['latin'],
  weight: ['400', '600', '700'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Constitue Studio',
  description: 'Donnees produit, techpacks et visuels pour Constitue',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <body className={`${sourceSans.variable} antialiased`}>{children}</body>
    </html>
  );
}
