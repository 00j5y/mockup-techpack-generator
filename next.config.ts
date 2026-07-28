import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Sortie autonome : reduit fortement la taille de l'image Docker en n'embarquant
  // que les dependances reellement atteintes par le build.
  output: 'standalone',

  // Puppeteer ne doit jamais etre bundle par Next : il est charge a l'execution,
  // cote serveur, et embarque des binaires.
  serverExternalPackages: ['puppeteer', 'puppeteer-core'],
};

export default nextConfig;
