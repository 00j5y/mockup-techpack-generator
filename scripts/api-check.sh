#!/usr/bin/env zsh
#
# Recette API des routes produit : creation, PATCH, logo, flats, suppression.
#
# ATTENTION : ce script ne simule rien. Il exige une base Postgres LANCEE
# (`docker compose up -d db`) et il CREE PUIS SUPPRIME de vraies donnees, en
# base comme sur le disque de stockage. Toutes les lignes qu'il ecrit portent un
# `style_number` prefixe `APICHK-<horodatage>`, et il verifie en fin de course
# qu'il ne reste ni ligne ni fichier de test.
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

trap 'delete_test_products; cleanup' EXIT INT TERM

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
  print -r -- "{\"dropNumber\":1,\"styleName\":\"API check $suffix\",\"styleNumber\":\"$MARKER-$suffix\",\"category\":\"shirt\",\"description\":null,\"mainFabric\":\"270 GSM cotton interlock\",\"fabricColorHex\":\"#112233\",\"fabricGradientEnabled\":false,\"fabricGradientIntensity\":null,\"sizeRange\":[\"XS\",\"S\",\"M\",\"L\",\"XL\",\"2XL\"],\"sampleSize\":\"M\",\"designer\":\"Constitue\",\"company\":\"Constitue\",\"status\":\"draft\",\"logoStoragePath\":$logo_field}"
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
# 2. sampleSize hors de sizeRange
# ---------------------------------------------------------------------------

body=$(product_json B | jq -c '.sizeRange = ["XS","S"] | .sampleSize = "XL"')
code=$(api_json POST /api/products "$body")
if [[ $code == 400 ]] && grep -q 'sampleSize' "$BODY"; then
  ok '2.  sampleSize hors gamme a la creation : 400 mentionnant sampleSize'
else
  fail '2.  sampleSize hors gamme a la creation' "HTTP $code, attendu 400 citant sampleSize : $(snippet)"
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
# 6. PATCH qui sortirait la taille de reference de la gamme
# ---------------------------------------------------------------------------

code=$(api_json PATCH "/api/products/$PRODUCT_A" '{"sizeRange":["XS","S"]}')
message=$(json_field '.error')
if [[ $code == 400 && -n $message ]]; then
  ok "6.  PATCH sortant la taille de reference de la gamme : 400 - $message"
else
  fail '6.  PATCH sortant la taille de reference de la gamme' "HTTP $code, attendu 400 lisible : $(snippet)"
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
# Nettoyage et verification qu il ne reste rien
# ---------------------------------------------------------------------------

print -r -- ''
delete_test_products

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
