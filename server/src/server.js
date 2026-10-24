import app from "./app.js";import {db} from "./db.js";import {seed} from "./seed.js";
if(!db.prepare("SELECT COUNT(*) n FROM users").get().n){seed();console.log("Base vide : données de démonstration créées (mot de passe : Learnly2026!)")}
const PORT=process.env.PORT||4000;app.listen(PORT,()=>console.log(`API Learnly sur http://localhost:${PORT}`));
