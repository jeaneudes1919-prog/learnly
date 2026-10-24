#!/usr/bin/env bash
set -euo pipefail

BASE="${BASE:-http://127.0.0.1:4000/api}"
PASS=0
FAIL=0

ok() { echo "✓ $1"; PASS=$((PASS + 1)); }
bad() { echo "✗ $1"; FAIL=$((FAIL + 1)); }
json() {
  node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{let j=JSON.parse(s);for(const k of process.argv[1].split("."))j=j?.[k];process.stdout.write(typeof j==="string"?j:j===undefined?"undefined":JSON.stringify(j))})' "$1"
}
check() {
  if [ "$2" = "$3" ]; then ok "$1"; else bad "$1 (attendu: $3, reçu: $2)"; fi
}

health=$(curl -sS "$BASE/health")
check "API en ligne" "$(printf '%s' "$health" | json data.ok)" "true"

login=$(curl -sS -H 'Content-Type: application/json' -d '{"email":"student@learnly.dev","password":"Learnly2026!"}' "$BASE/auth/login")
token=$(printf '%s' "$login" | json data.accessToken)
[ -n "$token" ] && ok "Connexion étudiant" || bad "Connexion étudiant"
auth="Authorization: Bearer $token"

courses=$(curl -sS "$BASE/courses?limit=1")
check "Catalogue publié" "$(printf '%s' "$courses" | json meta.total)" "10"
slug=$(printf '%s' "$courses" | json data.0.slug)
[ -n "$slug" ] && ok "Premier cours récupéré" || bad "Premier cours récupéré"

detail=$(curl -sS -H "$auth" "$BASE/courses/$slug")
[ "$(printf '%s' "$detail" | json data.title)" != "" ] && ok "Détail du cours" || bad "Détail du cours"

learning=$(curl -sS -H "$auth" "$BASE/me/learning")
check "Mes cours (3 inscriptions)" "$(printf '%s' "$learning" | json data.length)" "3"

certs=$(curl -sS -H "$auth" "$BASE/me/certificates")
code=$(printf '%s' "$certs" | json data.0.code)
[ -n "$code" ] && ok "Certificats de l'étudiant" || bad "Certificats de l'étudiant"

public=$(curl -sS "$BASE/certificates/$code")
check "Vérification publique du certificat" "$(printf '%s' "$public" | json data.code)" "$code"

pdf=$(mktemp /tmp/learnly-cert-XXXXXX.pdf)
curl -sS "$BASE/certificates/$code/pdf" -o "$pdf"
check "PDF téléchargeable" "$(head -c 4 "$pdf")" "%PDF"
rm -f "$pdf"

wishlist=$(curl -sS -H "$auth" "$BASE/wishlist")
check "Favoris" "$(printf '%s' "$wishlist" | json data.length)" "4"

lesson=$(printf '%s' "$detail" | json data.curriculum.0.lessons.0.id)
notes=$(curl -sS -H "$auth" "$BASE/lessons/$lesson/notes")
[ "$(printf '%s' "$notes" | json data.length)" != "" ] && ok "Notes de leçon" || bad "Notes de leçon"

plogin=$(curl -sS -H 'Content-Type: application/json' -d '{"email":"prof@learnly.dev","password":"Learnly2026!"}' "$BASE/auth/login")
ptoken=$(printf '%s' "$plogin" | json data.accessToken)
analytics=$(curl -sS -H "Authorization: Bearer $ptoken" "$BASE/instructor/analytics")
[ "$(printf '%s' "$analytics" | json data.summary.students)" -gt 0 ] 2>/dev/null && ok "Analytique formateur" || bad "Analytique formateur"

alogin=$(curl -sS -H 'Content-Type: application/json' -d '{"email":"admin@learnly.dev","password":"Learnly2026!"}' "$BASE/auth/login")
atoken=$(printf '%s' "$alogin" | json data.accessToken)
stats=$(curl -sS -H "Authorization: Bearer $atoken" "$BASE/admin/stats")
[ "$(printf '%s' "$stats" | json data.users)" -ge 25 ] 2>/dev/null && ok "Administration" || bad "Administration"

echo
echo "Smoke test : $PASS réussite(s), $FAIL échec(s)"
[ "$FAIL" -eq 0 ]
