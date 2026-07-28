#!/usr/bin/env zsh
#
# Recette API des routes produit (creation, PATCH, logo, flats, suppression) et
# de la bibliotheque Pantone (creation, unicite, recherche, PATCH, suppression).
#
# ATTENTION : ce script ne simule rien. Il exige une base Postgres LANCEE
# (`docker compose up -d db`) et il CREE PUIS SUPPRIME de vraies donnees, en
# base comme sur le disque de stockage. Toutes les lignes qu'il ecrit portent un
# `style_number` (ou une `reference` Pantone) prefixe `APICHK-<horodatage>`, et
# il verifie en fin de course qu'il ne reste ni ligne ni fichier de test.
#
# Il lance lui-meme un serveur de dev sur le port 3100 (pas 3000, souvent pris)
# et l'arrete en sortant. Passer BASE_URL=... pour viser un serveur deja demarre.
#
# Usage : zsh scripts/api-check.sh
# Sortie : une ligne OK ou ECHEC par point verifie, code de sortie non nul si un
# point echoue.

set -u
setopt pipefail

ROOT=${0:A:h}/..
ROOT=${ROOT:A}
cd "$ROOT" || exit 2

PORT=${PORT:-3100}
BASE=${BASE_URL:-http://127.0.0.1:$PORT}
MARKER="APICHK-$(date +%Y%m%d%H%M%S)"

# Racine de stockage, alignee sur `lib/storage/index.ts` : variable vide ou
# absente vaut `./.storage`.
STORAGE_ROOT=${STORAGE_DIR:-}
[[ -z ${STORAGE_ROOT// /} ]] && STORAGE_ROOT="$ROOT/.storage"

WORK=$(mktemp -d -t api-check)
BODY="$WORK/body.json"
DEV_LOG="$WORK/dev-server.log"
DEV_PID=""
STARTED_SERVER=0

# Identifiants des produits crees, pour le nettoyage et la verification finale.
typeset -a CREATED_IDS
CREATED_IDS=()

# Idem pour la bibliotheque Pantone. Table GLOBALE, non rattachee a un produit :
# supprimer les produits ne suffit donc pas a la nettoyer.
typeset -a CREATED_PANTONES
CREATED_PANTONES=()

typeset -i FAILURES=0

# ---------------------------------------------------------------------------
# Affichage
# ---------------------------------------------------------------------------

ok() {
  print -r -- "OK     $1"
  return 0
}

fail() {
  print -r -- "ECHEC  $1"
  [[ -n ${2-} ]] && print -r -- "       $2"
  FAILURES=$((FAILURES + 1))
  return 0
}

# Extrait court du dernier corps de reponse, pour rendre un echec exploitable.
snippet() {
  [[ -s $BODY ]] || { print -r -- '(corps vide)'; return 0 }
  tr -d '\n' < "$BODY" | cut -c1-300
}

# ---------------------------------------------------------------------------
# Appels HTTP. Le corps de la reponse atterrit toujours dans $BODY, le code de
# retour est ecrit sur la sortie standard.
# ---------------------------------------------------------------------------

api_json() {
  local method=$1 route=$2 data=${3-}
  local -a args
  args=(-sS --max-time 90 -o "$BODY" -w '%{http_code}' -X "$method"
        -H 'Content-Type: application/json')
  [[ -n $data ]] && args+=(-d "$data")
  curl "${args[@]}" "$BASE$route"
}

api_form() {
  local route=$1; shift
  curl -sS --max-time 90 -o "$BODY" -w '%{http_code}' -X POST "${@}" "$BASE$route"
}

# Code HTTP et type MIME d'un fichier servi, sur une seule ligne.
file_status_type() {
  curl -sS --max-time 90 -o /dev/null -w '%{http_code} %{content_type}' "$BASE/api/files/$1"
}

json_field() {
  # Corps absent (echec reseau) : rendre une chaine vide, pas une erreur de
  # redirection qui polluerait le compte rendu.
  [[ -s $BODY ]] || return 0
  jq -r "$1 // empty" < "$BODY" 2>/dev/null
}

# `psql` du conteneur : la seule facon de constater qu'une LIGNE a disparu,
# aucune route n'expose la liste des flats.
sql_scalar() {
  docker compose exec -T db psql -U constitue -d constitue_studio -tAc "$1" 2>/dev/null | tr -d '[:space:]'
}

# ---------------------------------------------------------------------------
# Mise en route et nettoyage
# ---------------------------------------------------------------------------

delete_test_products() {
  (( ${#CREATED_IDS} )) || return 0
  local id
  for id in ${CREATED_IDS[@]}; do
    curl -sS --max-time 30 -o /dev/null -X DELETE "$BASE/api/products/$id" 2>/dev/null
  done
  return 0
}

delete_test_pantones() {
  (( ${#CREATED_PANTONES} )) || return 0
  local id
  for id in ${CREATED_PANTONES[@]}; do
    curl -sS --max-time 30 -o /dev/null -X DELETE "$BASE/api/pantones/$id" 2>/dev/null
  done
  return 0
}

cleanup() {
  if (( STARTED_SERVER )); then
    [[ -n $DEV_PID ]] && kill "$DEV_PID" 2>/dev/null
    # `bun run dev` engendre le processus Next : tuer le parent ne suffit pas,
    # l'enfant garderait le port. On balaye ce qui ecoute encore.
    local -a stragglers
    stragglers=(${(f)"$(lsof -ti "tcp:$PORT" 2>/dev/null)"})
    (( ${#stragglers} )) && kill -9 ${stragglers[@]} 2>/dev/null
  fi
  rm -rf "$WORK"
  return 0
}

# Les produits d'abord : `on delete set null` les detacherait sans les casser,
# mais supprimer d'abord les couleurs rendrait le compte d'usage du point 28
# dependant de l'ordre de nettoyage.
trap 'delete_test_products; delete_test_pantones; cleanup' EXIT INT TERM

print -r -- "Recette API : $BASE (marqueur $MARKER)"
print -r -- "Stockage : $STORAGE_ROOT"
print -r -- ''

if ! docker compose exec -T db pg_isready -U constitue -d constitue_studio >/dev/null 2>&1; then
  print -r -- "ECHEC  base indisponible : lancer 'docker compose up -d db' et reessayer"
  exit 2
fi

if [[ -z ${BASE_URL-} ]]; then
  if lsof -ti "tcp:$PORT" >/dev/null 2>&1; then
    print -r -- "ECHEC  le port $PORT est deja occupe : liberer le port ou passer BASE_URL"
    exit 2
  fi

  bun run dev --port "$PORT" > "$DEV_LOG" 2>&1 &
  DEV_PID=$!
  STARTED_SERVER=1

  # La premiere requete declenche la compilation de la route : la fenetre
  # d'attente doit tenir compte d'un demarrage a froid.
  ready=0
  for attempt in {1..90}; do
    if [[ $(curl -sS --max-time 20 -o /dev/null -w '%{http_code}' "$BASE/api/products" 2>/dev/null) == 200 ]]; then
      ready=1
      break
    fi
    kill -0 "$DEV_PID" 2>/dev/null || break
    sleep 1
  done

  if (( ! ready )); then
    print -r -- "ECHEC  le serveur de dev n a pas repondu sur $BASE"
    print -r -- '--- journal du serveur ---'
    tail -30 "$DEV_LOG"
    exit 2
  fi
fi

# ---------------------------------------------------------------------------
# Fixtures, generees ici : le script ne depend d aucun fichier exterieur.
# ---------------------------------------------------------------------------

PNG="$WORK/pixel.png"
BAD="$WORK/not-an-image.txt"
print -r -- 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==' \
  | base64 --decode > "$PNG"
print -r -- 'ceci n est pas une image' > "$BAD"

# Corps de creation. $1 = suffixe de reference, $2 = logoStoragePath (optionnel).
product_json() {
  local suffix=$1 logo=${2-}
  local logo_field='null'
  [[ -n $logo ]] && logo_field="\"$logo\""
  print -r -- "{\"dropNumber\":1,\"styleName\":\"API check $suffix\",\"styleNumber\":\"$MARKER-$suffix\",\"category\":\"shirt\",\"description\":null,\"mainFabric\":\"270 GSM cotton interlock\",\"fabricPantoneId\":null,\"fabricGradientEnabled\":false,\"fabricGradientIntensity\":null,\"sizeRange\":[\"XS\",\"S\",\"M\",\"L\",\"XL\",\"2XL\"],\"sampleSizes\":[\"M\"],\"designer\":\"Constitue\",\"company\":\"Constitue\",\"status\":\"draft\",\"logoStoragePath\":$logo_field}"
}

# ---------------------------------------------------------------------------
# 1. Creation valide
# ---------------------------------------------------------------------------

code=$(api_json POST /api/products "$(product_json A)")
PRODUCT_A=$(json_field '.id')
if [[ $code == 201 && -n $PRODUCT_A ]]; then
  CREATED_IDS+=("$PRODUCT_A")
  ok "1.  Creation valide : 201, id $PRODUCT_A"
else
  fail '1.  Creation valide' "HTTP $code, attendu 201 avec un id : $(snippet)"
  print -r -- 'Impossible de continuer sans produit de reference.'
  exit 1
fi

# ---------------------------------------------------------------------------
# 2. sampleSizes hors de sizeRange
# ---------------------------------------------------------------------------

body=$(product_json B | jq -c '.sizeRange = ["XS","S"] | .sampleSizes = ["XL"]')
code=$(api_json POST /api/products "$body")
if [[ $code == 400 ]] && grep -q 'sampleSizes' "$BODY"; then
  ok '2.  sampleSizes hors gamme a la creation : 400 mentionnant sampleSizes'
else
  fail '2.  sampleSizes hors gamme a la creation' "HTTP $code, attendu 400 citant sampleSizes : $(snippet)"
fi

# ---------------------------------------------------------------------------
# 3. Categorie inconnue
# ---------------------------------------------------------------------------

body=$(product_json C | jq -c '.category = "sorcellerie"')
code=$(api_json POST /api/products "$body")
if [[ $code == 400 ]]; then
  ok '3.  Categorie inconnue : 400'
else
  fail '3.  Categorie inconnue' "HTTP $code, attendu 400 : $(snippet)"
fi

# ---------------------------------------------------------------------------
# 4. Taille hors des 10 colonnes du template
# ---------------------------------------------------------------------------

body=$(product_json D | jq -c '.sizeRange = ["S","9XL"]')
code=$(api_json POST /api/products "$body")
if [[ $code == 400 ]]; then
  ok '4.  Taille 9XL hors des 10 colonnes : 400'
else
  fail '4.  Taille 9XL hors des 10 colonnes' "HTTP $code, attendu 400 : $(snippet)"
fi

# ---------------------------------------------------------------------------
# 5. PATCH d un champ puis relecture
# ---------------------------------------------------------------------------

code=$(api_json PATCH "/api/products/$PRODUCT_A" '{"mainFabric":"320 GSM molleton gratte"}')
if [[ $code == 200 ]]; then
  reread=$(api_json GET "/api/products/$PRODUCT_A")
  value=$(json_field '.mainFabric')
  if [[ $reread == 200 && $value == '320 GSM molleton gratte' ]]; then
    ok '5.  PATCH puis relecture : valeur persistee'
  else
    fail '5.  PATCH puis relecture' "relecture HTTP $reread, mainFabric = '$value'"
  fi
else
  fail '5.  PATCH puis relecture' "PATCH HTTP $code, attendu 200 : $(snippet)"
fi

# ---------------------------------------------------------------------------
# 6. PATCH qui sortirait une taille d echantillon de la gamme
# ---------------------------------------------------------------------------
#
# Le PATCH ne touche qu a `sizeRange` : la verification d inclusion a besoin de
# la ligne existante, elle vit donc dans la route et pas dans le schema Zod.

code=$(api_json PATCH "/api/products/$PRODUCT_A" '{"sizeRange":["XS","S"]}')
message=$(json_field '.error')
if [[ $code == 400 && -n $message ]]; then
  ok "6.  PATCH sortant une taille d echantillon de la gamme : 400 - $message"
else
  fail '6.  PATCH sortant une taille d echantillon de la gamme' "HTTP $code, attendu 400 lisible : $(snippet)"
fi

# ---------------------------------------------------------------------------
# 7. PATCH d un champ inconnu
# ---------------------------------------------------------------------------

code=$(api_json PATCH "/api/products/$PRODUCT_A" '{"champInexistant":"x"}')
if [[ $code == 400 ]]; then
  ok '7.  PATCH d un champ inconnu : 400'
else
  fail '7.  PATCH d un champ inconnu' "HTTP $code, attendu 400 : $(snippet)"
fi

# ---------------------------------------------------------------------------
# 8. PATCH vide
# ---------------------------------------------------------------------------

code=$(api_json PATCH "/api/products/$PRODUCT_A" '{}')
if [[ $code == 400 ]]; then
  ok '8.  PATCH vide : 400'
else
  fail '8.  PATCH vide' "HTTP $code, attendu 400 : $(snippet)"
fi

# ---------------------------------------------------------------------------
# 9. PATCH de logoStoragePath : refuse (correction de securite)
# ---------------------------------------------------------------------------

code=$(api_json PATCH "/api/products/$PRODUCT_A" '{"logoStoragePath":"products/autre/logo/vole.png"}')
if [[ $code == 400 ]]; then
  ok '9.  PATCH de logoStoragePath : 400'
else
  fail '9.  PATCH de logoStoragePath' "HTTP $code, attendu 400 : $(snippet)"
fi

# ---------------------------------------------------------------------------
# 10. Upload du logo
# ---------------------------------------------------------------------------

code=$(api_form "/api/products/$PRODUCT_A/logo" -F "file=@$PNG;type=image/png")
LOGO_1=$(json_field '.logoStoragePath')
if [[ $code == 201 && $LOGO_1 == products/$PRODUCT_A/logo/* ]]; then
  ok "10. Upload du logo : 201, $LOGO_1"
else
  fail '10. Upload du logo' "HTTP $code, chemin '$LOGO_1' : $(snippet)"
fi

# ---------------------------------------------------------------------------
# 11. Le logo est servi par /api/files
# ---------------------------------------------------------------------------

if [[ -n $LOGO_1 ]]; then
  served=$(file_status_type "$LOGO_1")
  if [[ $served == '200 image/png' ]]; then
    ok '11. Logo servi par /api/files : 200 image/png'
  else
    fail '11. Logo servi par /api/files' "obtenu '$served', attendu '200 image/png'"
  fi
else
  fail '11. Logo servi par /api/files' 'aucun chemin de logo a verifier'
fi

# ---------------------------------------------------------------------------
# 12. Type MIME refuse
# ---------------------------------------------------------------------------

code=$(api_form "/api/products/$PRODUCT_A/logo" -F "file=@$BAD;type=text/plain")
if [[ $code == 400 ]]; then
  ok '12. Upload d un .txt : 400'
else
  fail '12. Upload d un .txt' "HTTP $code, attendu 400 : $(snippet)"
fi

# ---------------------------------------------------------------------------
# 13. Remplacement du logo : l ancien fichier n est plus servi
# ---------------------------------------------------------------------------

code=$(api_form "/api/products/$PRODUCT_A/logo" -F "file=@$PNG;type=image/png")
LOGO_2=$(json_field '.logoStoragePath')
old_served=$(file_status_type "$LOGO_1")
new_served=$(file_status_type "$LOGO_2")
if [[ $code == 201 && $LOGO_2 != $LOGO_1 && ${old_served%% *} == 404 && ${new_served%% *} == 200 ]]; then
  ok '13. Remplacement du logo : ancien 404, nouveau 200'
else
  fail '13. Remplacement du logo' "HTTP $code, ancien '$old_served', nouveau '$new_served' ($LOGO_2)"
fi

# ---------------------------------------------------------------------------
# 14. Upload d un flat flat_front
# ---------------------------------------------------------------------------

code=$(api_form "/api/products/$PRODUCT_A/flats" -F "file=@$PNG;type=image/png" -F 'type=flat_front')
FLAT_1=$(json_field '.id')
FLAT_1_PATH=$(json_field '.storagePath')
if [[ $code == 201 && -n $FLAT_1 ]]; then
  ok "14. Upload d un flat_front : 201, $FLAT_1_PATH"
else
  fail '14. Upload d un flat_front' "HTTP $code, attendu 201 : $(snippet)"
fi

# ---------------------------------------------------------------------------
# 15. flat_detail sans libelle
# ---------------------------------------------------------------------------

code=$(api_form "/api/products/$PRODUCT_A/flats" -F "file=@$PNG;type=image/png" -F 'type=flat_detail')
if [[ $code == 400 ]]; then
  ok '15. flat_detail sans libelle : 400'
else
  fail '15. flat_detail sans libelle' "HTTP $code, attendu 400 : $(snippet)"
fi

# ---------------------------------------------------------------------------
# 16. Suppression d un flat : la ligne ET le fichier disparaissent
# ---------------------------------------------------------------------------

if [[ -n $FLAT_1 ]]; then
  code=$(api_json DELETE "/api/products/$PRODUCT_A/flats/$FLAT_1")
  rows=$(sql_scalar "select count(*) from product_flats where id = '$FLAT_1'")
  served=$(file_status_type "$FLAT_1_PATH")
  on_disk='non'
  [[ -e "$STORAGE_ROOT/$FLAT_1_PATH" ]] && on_disk='oui'
  if [[ $code == 200 && $rows == 0 && ${served%% *} == 404 && $on_disk == 'non' ]]; then
    ok '16. Suppression d un flat : ligne supprimee, fichier absent (404)'
  else
    fail '16. Suppression d un flat' "HTTP $code, lignes restantes '$rows', service '$served', sur disque : $on_disk"
  fi
else
  fail '16. Suppression d un flat' 'aucun flat a supprimer'
fi

# ---------------------------------------------------------------------------
# 17. Pre-remplissage du logo : le fichier est duplique, pas partage
# ---------------------------------------------------------------------------

code=$(api_json POST /api/products "$(product_json E "$LOGO_2")")
PRODUCT_B=$(json_field '.id')
LOGO_B=$(json_field '.logoStoragePath')
if [[ $code == 201 && -n $PRODUCT_B ]]; then
  CREATED_IDS+=("$PRODUCT_B")
fi

if [[ $code == 201 && $LOGO_B == products/$PRODUCT_B/logo/* && $LOGO_B != $LOGO_2 ]]; then
  del=$(api_json DELETE "/api/products/$PRODUCT_B")
  a_served=$(file_status_type "$LOGO_2")
  b_served=$(file_status_type "$LOGO_B")
  b_dir='absent'
  [[ -e "$STORAGE_ROOT/products/$PRODUCT_B" ]] && b_dir='present'
  if [[ $del == 200 && ${a_served%% *} == 200 && ${b_served%% *} == 404 && $b_dir == 'absent' ]]; then
    ok '17. Logo duplique : B a son propre fichier, sa suppression laisse celui de A intact'
  else
    fail '17. Logo duplique' "DELETE HTTP $del, logo de A '$a_served' (attendu 200), logo de B '$b_served' (attendu 404), dossier de B $b_dir"
  fi
else
  fail '17. Logo duplique' "HTTP $code, logo de B '$LOGO_B', logo de A '$LOGO_2' : $(snippet)"
fi

# ---------------------------------------------------------------------------
# 18. Suppression du produit : relecture en 404
# ---------------------------------------------------------------------------

code=$(api_json POST /api/products "$(product_json F)")
PRODUCT_C=$(json_field '.id')
if [[ $code == 201 && -n $PRODUCT_C ]]; then
  CREATED_IDS+=("$PRODUCT_C")
  del=$(api_json DELETE "/api/products/$PRODUCT_C")
  reread=$(api_json GET "/api/products/$PRODUCT_C")
  if [[ $del == 200 && $reread == 404 ]]; then
    ok '18. Suppression du produit : relecture en 404'
  else
    fail '18. Suppression du produit' "DELETE HTTP $del, relecture HTTP $reread"
  fi
else
  fail '18. Suppression du produit' "creation prealable HTTP $code : $(snippet)"
fi

# ---------------------------------------------------------------------------
# 19. updated_at du produit rafraichi par un upload de flat
# ---------------------------------------------------------------------------

api_json GET "/api/products/$PRODUCT_A" >/dev/null
before=$(json_field '.updatedAt')
code=$(api_form "/api/products/$PRODUCT_A/flats" -F "file=@$PNG;type=image/png" -F 'type=flat_back')
api_json GET "/api/products/$PRODUCT_A" >/dev/null
after=$(json_field '.updatedAt')

# Comparaison lexicographique : les deux dates sont des ISO 8601 en UTC, de
# meme format, donc l ordre des chaines est l ordre chronologique.
if [[ $code == 201 && -n $before && -n $after && $after > $before ]]; then
  ok "19. updated_at rafraichi par l upload d un flat : $before -> $after"
else
  fail '19. updated_at rafraichi par l upload d un flat' "upload HTTP $code, avant '$before', apres '$after'"
fi

# ---------------------------------------------------------------------------
# 20. Plusieurs tailles d echantillon, stockees dans l ordre canonique
# ---------------------------------------------------------------------------
#
# La demande d origine : produire un sample en M ET en L. Le corps est envoye
# dans le desordre (L puis M) pour verifier du meme coup la normalisation :
# c est le PREMIER element du tableau stocke qui porte les valeurs des cotes de
# la page 2 (`primarySampleSize`), il ne peut pas dependre de l ordre de saisie.

body=$(product_json G | jq -c '.sampleSizes = ["L","M"]')
code=$(api_json POST /api/products "$body")
PRODUCT_D=$(json_field '.id')
returned=$(json_field '.sampleSizes | join(",")')
if [[ $code == 201 && -n $PRODUCT_D ]]; then
  CREATED_IDS+=("$PRODUCT_D")
  stored=$(sql_scalar "select array_to_string(sample_sizes, ',') from products where id = '$PRODUCT_D'")
  if [[ $returned == 'M,L' && $stored == 'M,L' ]]; then
    ok '20. Deux tailles d echantillon : 201, stockees {M,L} dans l ordre canonique'
  else
    fail '20. Deux tailles d echantillon' "reponse '$returned', base '$stored', attendu 'M,L' des deux cotes"
  fi
else
  fail '20. Deux tailles d echantillon' "HTTP $code, attendu 201 : $(snippet)"
fi

# ---------------------------------------------------------------------------
# 21. Une seule taille du tableau hors de sizeRange suffit a faire echouer
# ---------------------------------------------------------------------------
#
# Reproduit le CHECK `products_sample_sizes_in_range` (`sample_sizes <@
# size_range`) au niveau du contrat d API : le tableau est valide comme un
# ENSEMBLE, une taille valide a cote d une invalide ne rattrape rien.

body=$(product_json H | jq -c '.sizeRange = ["XS","S","M"] | .sampleSizes = ["M","XL"]')
code=$(api_json POST /api/products "$body")
if [[ $code == 400 ]] && grep -q 'XL' "$BODY"; then
  ok '21. Taille hors gamme melee a une taille valide : 400 nommant la fautive'
else
  fail '21. Taille hors gamme melee a une taille valide' "HTTP $code, attendu 400 citant XL : $(snippet)"
fi

# ---------------------------------------------------------------------------
# 22. PATCH multi-tailles puis relecture, et tableau vide accepte
# ---------------------------------------------------------------------------
#
# Le tableau vide est l etat du brouillon : refuse a la creation, accepte au
# PATCH, bloquant seulement pour la generation du techpack.

code=$(api_json PATCH "/api/products/$PRODUCT_A" '{"sampleSizes":["XL","S"]}')
patched=$(json_field '.sampleSizes | join(",")')
empty_code=$(api_json PATCH "/api/products/$PRODUCT_A" '{"sampleSizes":[]}')
empty_value=$(json_field '.sampleSizes | length')
if [[ $code == 200 && $patched == 'S,XL' && $empty_code == 200 && $empty_value == 0 ]]; then
  ok '22. PATCH multi-tailles : ordre canonique S,XL, puis tableau vide accepte'
else
  fail '22. PATCH multi-tailles' "PATCH HTTP $code valeur '$patched' (attendu 'S,XL'), vide HTTP $empty_code longueur '$empty_value'"
fi

# ---------------------------------------------------------------------------
# 23. Creation d une couleur dans la bibliotheque Pantone
# ---------------------------------------------------------------------------
#
# Corps de creation Pantone. $1 = suffixe de reference, $2 = bibliotheque.
pantone_json() {
  local suffix=$1 lib=${2:-TCX}
  print -r -- "{\"reference\":\"$MARKER-$suffix\",\"library\":\"$lib\",\"name\":\"API check $suffix\",\"hex\":\"#0F4C81\",\"notes\":null}"
}

code=$(api_json POST /api/pantones "$(pantone_json P1)")
PANTONE_1=$(json_field '.id')
if [[ $code == 201 && -n $PANTONE_1 ]]; then
  CREATED_PANTONES+=("$PANTONE_1")
  ok "23. Creation d une couleur Pantone : 201, id $PANTONE_1"
else
  fail '23. Creation d une couleur Pantone' "HTTP $code, attendu 201 avec un id : $(snippet)"
fi

# ---------------------------------------------------------------------------
# 24. Meme couple (reference, library) : 409 qui NOMME la couleur en conflit
# ---------------------------------------------------------------------------
#
# Le cas d usage reel : ressaisir une couleur deja validee des mois plus tard.
# Un 409 nu ne dirait pas laquelle, seule la nommer permet de choisir entre
# corriger la saisie et reutiliser la ligne existante.

code=$(api_json POST /api/pantones "$(pantone_json P1)")
message=$(json_field '.error')
if [[ $code == 409 && $message == *"$MARKER-P1"* ]]; then
  ok "24. Doublon (reference, library) : 409 - $message"
else
  fail '24. Doublon (reference, library)' "HTTP $code, attendu 409 nommant $MARKER-P1 : $(snippet)"
fi

# ---------------------------------------------------------------------------
# 25. Le meme numero dans une AUTRE bibliotheque reste une couleur distincte
# ---------------------------------------------------------------------------
#
# `7545 C` et `7545 U` ne donnent pas la meme couleur : l unicite porte sur le
# COUPLE, pas sur la seule reference.

code=$(api_json POST /api/pantones "$(pantone_json P1 C)")
PANTONE_1C=$(json_field '.id')
if [[ $code == 201 && -n $PANTONE_1C ]]; then
  CREATED_PANTONES+=("$PANTONE_1C")
  ok '25. Meme reference en bibliotheque C : 201, couleur distincte'
else
  fail '25. Meme reference en bibliotheque C' "HTTP $code, attendu 201 : $(snippet)"
fi

# ---------------------------------------------------------------------------
# 26. Liste et recherche
# ---------------------------------------------------------------------------
#
# La recherche porte sur `reference` ET `name`, en « contient » : chercher un
# fragment doit ramener les deux couleurs du marqueur. Une recherche sans
# resultat rend une liste vide, jamais une erreur.

code=$(api_json GET '/api/pantones')
total=$(json_field 'length')
listed=$(json_field "[.[] | select(.reference == \"$MARKER-P1\")] | length")

search=$(api_json GET "/api/pantones?q=$MARKER-P1")
found=$(json_field 'length')

empty=$(api_json GET '/api/pantones?q=zzz-aucune-couleur-zzz')
none=$(json_field 'length')

if [[ $code == 200 && $listed == 2 && $search == 200 && $found == 2 && $empty == 200 && $none == 0 ]]; then
  ok "26. Liste ($total au total) et recherche : 2 resultats sur $MARKER-P1, 0 sur un terme absent"
else
  fail '26. Liste et recherche' "liste HTTP $code ($listed occurrence(s)), recherche HTTP $search ($found), vide HTTP $empty ($none)"
fi

# ---------------------------------------------------------------------------
# 27. PATCH d une couleur puis relecture
# ---------------------------------------------------------------------------

code=$(api_json PATCH "/api/pantones/$PANTONE_1" '{"name":"Classic Blue","hex":"#0F4C81"}')
patched=$(json_field '.name')
reread=$(api_json GET "/api/pantones?q=$MARKER-P1")
stored=$(json_field "[.[] | select(.id == \"$PANTONE_1\")][0].name")
if [[ $code == 200 && $patched == 'Classic Blue' && $stored == 'Classic Blue' ]]; then
  ok '27. PATCH d une couleur puis relecture : valeur persistee'
else
  fail '27. PATCH d une couleur' "PATCH HTTP $code nom '$patched', relecture HTTP $reread nom '$stored'"
fi

# ---------------------------------------------------------------------------
# 28. PATCH qui entre en collision avec une autre ligne : 409
# ---------------------------------------------------------------------------
#
# Renommer une couleur vers un couple deja pris. Le PATCH ne porte que sur
# `reference` : la `library` vient de la ligne existante, sans quoi le message
# ne pourrait pas nommer la couleur en conflit.

code=$(api_json POST /api/pantones "$(pantone_json P2)")
PANTONE_2=$(json_field '.id')
if [[ $code == 201 && -n $PANTONE_2 ]]; then
  CREATED_PANTONES+=("$PANTONE_2")
  code=$(api_json PATCH "/api/pantones/$PANTONE_2" "{\"reference\":\"$MARKER-P1\"}")
  message=$(json_field '.error')
  if [[ $code == 409 && $message == *"$MARKER-P1"* ]]; then
    ok "28. PATCH en collision : 409 - $message"
  else
    fail '28. PATCH en collision' "HTTP $code, attendu 409 nommant $MARKER-P1 : $(snippet)"
  fi
else
  fail '28. PATCH en collision' "creation prealable HTTP $code : $(snippet)"
fi

# ---------------------------------------------------------------------------
# 29. PATCH produit avec un uuid de couleur inconnu : 400, pas 500
# ---------------------------------------------------------------------------
#
# Zod ne peut pas verifier l EXISTENCE : il ne voit que le corps de la requete.
# Sans le controle dans la route, la cle etrangere remonterait en 500 illisible.

code=$(api_json PATCH "/api/products/$PRODUCT_A" '{"fabricPantoneId":"6f1c2f7e-0000-4000-8000-000000000000"}')
message=$(json_field '.error')
if [[ $code == 400 && $message == *fabricPantoneId* ]]; then
  ok "29. PATCH produit avec un uuid de couleur inconnu : 400 - $message"
else
  fail '29. PATCH produit avec un uuid de couleur inconnu' "HTTP $code, attendu 400 citant fabricPantoneId : $(snippet)"
fi

# ---------------------------------------------------------------------------
# 30. DELETE d une couleur : compte d usage et detachement du produit
# ---------------------------------------------------------------------------
#
# `on delete set null` : la suppression ne casse rien, mais elle vide la couleur
# de tissu des produits concernes. Le compte rendu par la route est la seule
# facon de savoir ce qu on vient de detacher.

attach=$(api_json PATCH "/api/products/$PRODUCT_A" "{\"fabricPantoneId\":\"$PANTONE_1\"}")
attached=$(json_field '.fabricPantoneId')
code=$(api_json DELETE "/api/pantones/$PANTONE_1")
detached=$(json_field '.detachedProducts')
api_json GET "/api/products/$PRODUCT_A" >/dev/null
after=$(json_field '.fabricPantoneId')
gone=$(api_json GET "/api/pantones?q=$MARKER-P1")
remaining=$(json_field "[.[] | select(.id == \"$PANTONE_1\")] | length")

if [[ $attach == 200 && $attached == $PANTONE_1 && $code == 200 && $detached == 1 \
      && -z $after && $remaining == 0 ]]; then
  ok '30. DELETE d une couleur : 1 produit detache, produit conserve, couleur absente de la liste'
else
  fail '30. DELETE d une couleur' "rattachement HTTP $attach ('$attached'), DELETE HTTP $code, detachedProducts '$detached' (attendu 1), couleur du produit apres '$after' (attendu vide), occurrences restantes '$remaining'"
fi

# ---------------------------------------------------------------------------
# 31. DELETE et PATCH sur une couleur inexistante : 404
# ---------------------------------------------------------------------------

del=$(api_json DELETE "/api/pantones/$PANTONE_1")
patch=$(api_json PATCH "/api/pantones/$PANTONE_1" '{"name":"x"}')
if [[ $del == 404 && $patch == 404 ]]; then
  ok '31. DELETE et PATCH sur une couleur supprimee : 404'
else
  fail '31. DELETE et PATCH sur une couleur supprimee' "DELETE HTTP $del, PATCH HTTP $patch, attendu 404 des deux cotes"
fi

# ---------------------------------------------------------------------------
# Nettoyage et verification qu il ne reste rien
# ---------------------------------------------------------------------------

print -r -- ''
delete_test_products
delete_test_pantones

remaining_products=$(sql_scalar "select count(*) from products where style_number like '$MARKER-%'")
if [[ $remaining_products == 0 ]]; then
  ok 'Nettoyage base : aucune ligne products de test restante'
else
  fail 'Nettoyage base' "$remaining_products ligne(s) products '$MARKER-%' encore presentes"
fi

id_list=''
if (( ${#CREATED_IDS} )); then
  for id in ${CREATED_IDS[@]}; do
    [[ -n $id_list ]] && id_list+=','
    id_list+="'$id'"
  done
fi
if [[ -n $id_list ]]; then
  remaining_flats=$(sql_scalar "select count(*) from product_flats where product_id in ($id_list)")
else
  remaining_flats=0
fi
if [[ $remaining_flats == 0 ]]; then
  ok 'Nettoyage base : aucune ligne product_flats de test restante'
else
  fail 'Nettoyage base' "$remaining_flats ligne(s) product_flats encore presentes"
fi

remaining_pantones=$(sql_scalar "select count(*) from pantone_colors where reference like '$MARKER-%'")
if [[ $remaining_pantones == 0 ]]; then
  ok 'Nettoyage base : aucune ligne pantone_colors de test restante'
else
  fail 'Nettoyage base' "$remaining_pantones ligne(s) pantone_colors '$MARKER-%' encore presentes"
fi

orphan_dirs=''
if (( ${#CREATED_IDS} )); then
  for id in ${CREATED_IDS[@]}; do
    [[ -e "$STORAGE_ROOT/products/$id" ]] && orphan_dirs+=" products/$id"
  done
fi
if [[ -z $orphan_dirs ]]; then
  ok 'Nettoyage disque : aucun dossier de test restant'
else
  fail 'Nettoyage disque' "dossier(s) orphelin(s) :$orphan_dirs"
fi

# ---------------------------------------------------------------------------

print -r -- ''
if (( FAILURES )); then
  print -r -- "$FAILURES point(s) en echec."
  exit 1
fi
print -r -- 'Tous les points sont au vert.'
exit 0
