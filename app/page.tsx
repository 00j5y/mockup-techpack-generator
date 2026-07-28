import { redirect } from 'next/navigation';

/** L'application n'a qu'une porte d'entree : la liste des produits. */
export default function Home() {
  redirect('/products');
}
