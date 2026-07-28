/**
 * Page d'accueil provisoire. Sera remplacee en Phase 1 par une redirection
 * vers /products.
 */
export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-3 p-8">
      <h1 className="text-2xl font-bold tracking-tight">Constitue Studio</h1>
      <p className="text-sm opacity-60">
        Phase 0 : socle en place. Le CRUD produit arrive en Phase 1.
      </p>
    </main>
  );
}
