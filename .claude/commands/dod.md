---
description: Vérifie la definition of done de la phase en cours avant merge
---

Vérifie que la phase en cours est réellement terminée.

1. Identifie la phase en cours via `.claude/PROGRESS.md`
2. Ouvre la checklist "Definition of done" en fin du doc de module correspondant
3. **Vérifie chaque item en l'exécutant réellement**, pas en le supposant. Une case ne se coche que sur preuve : commande lancée et sortie lue, page ouverte et regardée, PDF généré et inspecté.
4. Lance ensuite les vérifications transverses de `.claude/docs/11-git-workflow.md` :
   - `bun run build`
   - `bun run typecheck`
   - `bun run lint`
   - aucun secret ni `.env` committé
   - aucun `console.log` de debug oublié
5. Relis `.claude/docs/12-pieges.md`, section "Les 5 signaux d'alarme architecturaux", et vérifie qu'aucun ne s'applique au code produit dans cette phase
6. Rapporte honnêtement : ce qui passe, ce qui échoue avec la sortie réelle, ce qui n'a pas pu être vérifié et pourquoi. Ne déclare pas la phase terminée si un item reste non vérifié.
7. Mets à jour `.claude/PROGRESS.md`
8. **Remets à Jay sa recette de test manuel** : une case à cocher par test, la commande à copier-coller, et ce qu'il doit voir. Uniquement ce que lui seul peut juger ou ce que je n'ai pas pu exécuter. Pas de `typecheck`/`lint`/`build`, c'est déjà fait. Format et critères dans `.claude/docs/11-git-workflow.md`, section "Fin de phase".
9. **Attends sa confirmation.** Push et PR seulement après un accord explicite de sa part.
