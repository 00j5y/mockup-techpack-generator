import Link from 'next/link';

/**
 * Coque de l'application.
 *
 * Pas d'authentification : outil mono-utilisateur en local. C'est une decision
 * explicite de Jay, tracee comme bloquante avant tout deploiement public
 * (`/api/generate-image` coute de l'argent reel). Voir .claude/PROGRESS.md.
 */
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900">
      <header className="border-b border-neutral-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
          <Link href="/products" className="text-sm font-semibold tracking-tight">
            Constitue Studio
          </Link>
          <nav className="flex items-center gap-4 text-sm">
            <Link href="/products" className="text-neutral-600 hover:text-neutral-900">
              Produits
            </Link>
            <Link href="/pantones" className="text-neutral-600 hover:text-neutral-900">
              Bibliotheque Pantone
            </Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
    </div>
  );
}
