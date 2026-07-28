---
description: Démarre proprement une phase de développement Constitue Studio
---

Démarre la phase suivante (ou la phase `$ARGUMENTS` si un numéro est fourni).

Séquence obligatoire, dans cet ordre :

1. Lis `.claude/PROGRESS.md` pour connaître l'état réel et les bloquants en attente
2. Lis `.claude/docs/10-phasage.md` pour le périmètre et la branche de la phase
3. Lis le doc de module correspondant à la phase :
   - Phase 0 → `13-env-setup.md` + `03-database.md`
   - Phase 1 → `04-module-produit.md`
   - Phase 2 → `05-module-mesures.md`
   - Phase 3 → `06-module-formulaires.md`
   - Phase 4 → `07-module-techpack-pdf.md`
   - Phase 5 → `08-module-visuel-ia.md`
4. Lis `.claude/docs/12-pieges.md` en entier
5. Lis `.claude/docs/02-architecture.md` si tu vas créer des fichiers
6. Vérifie s'il y a un **bloquant en attente d'une décision de Jay** qui concerne cette phase. Si oui, le signaler avant de commencer, pas au milieu.
7. Crée la branche depuis `main` à jour (voir `11-git-workflow.md`)
8. Annonce le plan de travail de la phase, puis attaque

À la fin de la session : mets à jour `.claude/PROGRESS.md` (statut de phase, décisions prises, nouveaux bloquants, idées à ne pas oublier).
