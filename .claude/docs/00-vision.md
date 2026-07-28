# 00 - Vision et périmètre

## Le problème actuel

Le workflow de création d'une pièce Constitue est aujourd'hui entièrement manuel :

1. Dessin du flat technique dans Illustrator
2. Rédaction manuelle d'un prompt vers ChatGPT Image Gen pour obtenir un rendu photoréaliste
3. Remplissage du techpack page par page, à la main

Trois problèmes : c'est répétitif, c'est source d'erreurs (une mesure recopiée de travers), et **aucune donnée saisie n'est capitalisée** d'une pièce à l'autre.

## Objectif V1

Une webapp interne où, pour chaque produit, on :

1. Saisit **une seule fois** les données structurées (fabrication, mesures, BOM, couleurs, packaging)
2. Place les points de mesure directement sur les flats via un éditeur visuel interactif
3. Génère automatiquement le techpack PDF fidèle au template Seaggs
4. Génère un visuel photoréaliste à partir des flats + inspo, via l'API OpenAI

La règle qui sous-tend tout : **une donnée saisie une fois est réutilisée partout**. Le header du techpack, le tableau de specs page 3, le prompt IA : tout dérive des mêmes tables.

## Non-objectifs V1

À ne pas construire, et à ne pas anticiper par de l'abstraction préventive :

- Gestion de commandes fournisseurs
- E-commerce, gestion de stock
- Multi-utilisateurs, permissions avancées, multi-tenant

## Utilisateur

Jay, seul, en usage interne Constitue. Conséquences concrètes :

- Pas d'auth pour l'instant : outil personnel qui tourne en local. Bloquant avant tout déploiement public.
- Pas de `organization_id` ni de scoping multi-tenant dans le schéma
- Pas besoin de gérer les conflits d'édition concurrente
- L'UX peut être dense et technique, l'utilisateur connaît son domaine

## Critère de succès global

Créer un produit complet et sortir son techpack PDF prêt à envoyer au fournisseur doit prendre **moins de temps que le workflow manuel actuel**, et le PDF doit être visuellement indiscernable d'un techpack rempli à la main sur le template Seaggs.
