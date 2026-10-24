# Notes personnelles

## Fait dans cette version
- Tests serveur (10) : correction des quiz (simple, multiple, partielle), progression 100 % et certificat unique, accès aux leçons verrouillées, paiement simulé, avis sous 30 %, règles de publication, rôles, certificat public + PDF, notes/favoris, blocage admin.
- Tests client (10) : formatters, composant `Stars`, page de connexion, `Guard`, hook `useDebounce`, carte de cours.
- Smoke test API : 13 vérifications (`npm run smoke`).
- Notes personnelles par leçon, favoris, aperçus gratuits, analytique formateur (Recharts), liste des étudiants, gestion admin des rôles et blocages.
- Seed enrichi : 10 cours publiés (12 leçons chacun), 2 en relecture, 1 brouillon, 25 comptes, 150 inscriptions, 60 avis, 8 certificats.

## Exercices restants
- Passer toute la couche données client à React Query (le projet utilise encore des `useEffect` + état local).
- Découper `server/src/api.js` en modules (`courses`, `lessons`, `studio`, `admin`).
- Sortir les questions/options de quiz du JSON de `lessons` vers des tables dédiées.
- Upload de vraies vidéos (aujourd'hui iframes YouTube) et vrais contenus de cours.
- Page publique formateur côté client (l'API `GET /instructors/:id` existe déjà).
- Réinitialisation de mot de passe et vérification d'email.
- Paiement réel, stockage objet et sauvegardes.

## Concepts à revoir
- Calcul de progression et émission du certificat (`progressOf` dans `api.js`).
- Génération PDF (`/certificates/:code/pdf`).
- Sauvegarde du programme par upsert (`PUT .../curriculum`).
- Alertes personnalisées (`UIProvider` : `useToast` et `useConfirm`).
- Rendu Markdown sécurisé sans `dangerouslySetInnerHTML` (`Md`).
