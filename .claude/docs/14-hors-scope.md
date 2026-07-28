# 14 - Hors scope V1

À lire quand on est tenté d'ajouter quelque chose "parce que ce serait mieux".

## Explicitement hors scope

| Feature | Pourquoi on ne la fait pas | Ce qu'on ne doit pas anticiper |
|---|---|---|
| Multi-utilisateurs, permissions | Usage mono-utilisateur (Jay seul) | Pas de table `users` custom, pas de rôles, pas de `organization_id` |
| Intégration fournisseur (envoi auto du techpack) | Le PDF téléchargé suffit | Pas de couche d'abstraction "canal d'export" |
| Versionnage avancé du techpack | Un compteur de version simple suffit | Pas de diff entre versions, pas de branches de révision |
| Génération de plusieurs variantes IA en parallèle | Une génération à la fois suffit | Pas de système de queue ni de jobs asynchrones |
| Gestion de commandes fournisseurs | Ce n'est pas le problème résolu | Pas de tables de commandes |
| E-commerce, gestion de stock | Idem | Rien |

## Règle générale

Le projet est un outil interne pour une personne. Toute abstraction ajoutée "pour quand on sera plusieurs" ou "pour quand on voudra brancher X" est du coût immédiat contre un bénéfice hypothétique.

Une exception explicite, décidée dans la spec : **la duplication de produit**. Elle n'est pas construite en V1, mais le schéma DB doit rester compatible avec elle (voir `03-database.md`, dernière section). Ça ne coûte rien : il s'agit seulement de ne pas ajouter de contrainte `unique` globale et de ne pas dénormaliser.

## Candidats Phase 6 (optionnel, après le reste)

Pas hors scope définitivement, mais à ne pas commencer avant que les Phases 1 à 5 soient livrées :

- Duplication de produit (l'implémentation, le schéma est déjà prêt)
- Dashboard avec vue d'ensemble des drops et du coût IA cumulé
- Export batch (plusieurs techpacks d'un coup)
- Indicateurs de complétion enrichis, alertes de champs manquants avant génération
- Drag-and-drop de permutation dans la grille BOM
- Conversion hex → Pantone si pas faite en Phase 3

## Comment traiter une idée qui surgit en cours de dev

L'écrire dans `.claude/PROGRESS.md`, section "Idées / backlog". Ne pas l'implémenter dans la branche en cours. Une phase qui déborde de son périmètre produit une PR illisible et retarde le livrable.
