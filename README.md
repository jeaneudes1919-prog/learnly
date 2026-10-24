# Learnly

Plateforme e-learning (LMS) : catalogue, lecteur de cours, progression, quiz corrigés automatiquement, notes personnelles, favoris, avis, certificats PDF vérifiables, studio formateur avec analytique et administration.

**Stack** : React 18 + Vite + Tailwind + Framer Motion + Recharts, Node.js + Express, SQLite (better-sqlite3), PDFKit, JWT (access token + refresh token httpOnly avec rotation).

```bash
npm run setup   # installe racine, serveur et client
npm run seed    # réinitialise la base de démonstration
npm run dev     # API sur :4000, client sur :5173
npm test        # tests serveur + client
npm run smoke   # vérifie les parcours API (serveur démarré)
npm run build   # build production du client
```

Au premier lancement, la base est remplie automatiquement. Mot de passe de tous les comptes : `Learnly2026!`
Comptes : `student@learnly.dev` (3 cours, dont un terminé avec certificat), `prof@learnly.dev` (formateur), `admin@learnly.dev`.

## Fonctionnement
Un cours gratuit s'ouvre en un clic ; un cours payant passe par un paiement simulé (un numéro Mobile Money finissant par 00 est refusé). La progression se calcule sur les leçons terminées ; un quiz est réussi à partir du score défini et valide la leçon. À 100 %, un certificat unique est émis (code `LRN-XXXXXXXX`), consultable sur `/certificat/<code>` et téléchargeable en PDF. Le formateur soumet son cours (1 section et 3 leçons minimum), l'administrateur le publie.

## Fonctionnalités
- Catalogue filtrable (catégorie, niveau, prix, recherche instantanée), favoris et aperçus gratuits.
- Lecteur plein écran : programme repliable, progression, notes par leçon, ressources, avis, mode focus, raccourcis clavier, confettis.
- Espace apprenant : mes cours, certificats, profil éditable, favoris, avis.
- Studio formateur : création/édition de cours, sections, leçons, quiz, soumission, analytique (inscriptions, complétion, revenus, avis) et liste des étudiants.
- Administration : validation des cours, statistiques, gestion des rôles et blocage des comptes.
- Seed riche : 10 cours publiés, 2 en relecture, 1 brouillon, 25 comptes, 150 inscriptions, 60 avis, 8 certificats.

## API principale (préfixe /api)
Public : `GET /courses`, `GET /courses/:slug`, `GET /courses/:id/reviews`, `GET /categories`, `GET /instructors/:id`, `GET /preview/lessons/:id`, `GET /certificates/:code`, `GET /certificates/:code/pdf`.

Apprenant : `POST /enroll`, `POST /payments/checkout`, `GET /me/learning`, `GET /me/certificates`, `GET /courses/:id/learn`, `GET /lessons/:id`, `POST|DELETE /lessons/:id/complete`, `POST /lessons/:id/quiz`, `POST /quizzes/:id/attempt`, `GET /quizzes/:id/attempts`, `GET|POST /lessons/:id/notes`, `DELETE /notes/:id`, `GET|POST|DELETE /wishlist/:courseId`, `POST /courses/:id/reviews`.

Formateur : `/studio/courses`, `PUT /studio/courses/:id/curriculum`, `POST /studio/courses/:id/submit`, `/studio/analytics`, `/studio/students` (alias `/instructor/...`).

Admin : `/admin/stats`, `/admin/courses`, `PATCH /admin/courses/:id/status`, `/admin/users`, `PATCH /admin/users/:id`.
