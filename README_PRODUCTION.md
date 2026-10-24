# Production (plus tard)
Rien n'est encore déployé. Pistes : hébergement du serveur Node et du client statique, Dockerfile, CI/CD, passage de SQLite à PostgreSQL, `JWT_SECRET` fort en variable d'environnement, HTTPS et cookies `secure`, vrai prestataire de paiement, stockage vidéo, sauvegardes.

## Vérifications avant mise en ligne
```bash
npm test
npm run build
npm run smoke   # serveur démarré sur :4000
```
Configurer `JWT_SECRET`, `CLIENT_URL`, `DB_FILE` et le proxy `/api` du client. Le build client est dans `client/dist`.
