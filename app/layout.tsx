import type { Metadata } from 'next';
import { Source_Sans_3 } from 'next/font/google';
import './globals.css';

/**
 * Source Sans 3 : substitut retenu pour Myriad Pro, la police du template Seaggs.
 * Myriad Pro n'existe sur la machine que dans le cache obfusque Adobe Fonts et
 * sa licence ne couvre pas l'installation sur un serveur de generation.
 *
 * `next/font` telecharge la police au BUILD et la sert depuis l'application :
 * aucun appel CDN a l'execution, ce qui est la contrainte reelle pour le rendu
 * Puppeteer en conteneur.
 *
 * Voir .claude/docs/15-template-seaggs.md, section Typographie.
 */
const sourceSans = Source_Sans_3({
  variable: '--font-techpack',
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
