import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import { db } from "./db.js";

const CATS = [
  ["Développement web", "dev", "💻"],
  ["Réseaux et cybersécurité", "reseaux", "🛡️"],
  ["Data et IA", "data", "🤖"],
  ["Design", "design", "🎨"],
  ["Business", "business", "📈"],
  ["Langues", "langues", "🌍"],
];

const VIDEOS = [
  "https://www.youtube.com/embed/M7lc1UVf-VE",
  "https://www.youtube.com/embed/Ke90Tje7VS0",
  "https://www.youtube.com/embed/rfscVS0vtbw",
  "https://www.youtube.com/embed/PkZNo7MFNFg",
  "https://www.youtube.com/embed/aircAruvnKk",
];

const body = (t, c) => `## ${t}

Cette leçon du cours **${c}** vous aide à transformer une notion théorique en compétence utilisable. Prenez quelques minutes pour lire l'ensemble avant de passer à la pratique : l'objectif n'est pas de tout mémoriser, mais de comprendre le raisonnement.

### Pourquoi cette étape compte

Dans un parcours d'apprentissage, chaque notion prépare la suivante. Si vous sautez les fondations, les exercices avancés deviennent difficiles à interpréter. Ici, nous ralentissons volontairement pour clarifier le vocabulaire, les cas d'usage et les erreurs fréquentes.

### Les points clés

- Identifiez le problème concret que la notion permet de résoudre.
- Repérez les trois termes essentiels et reformulez-les avec vos propres mots.
- Comparez un exemple simple avec un cas réel de votre quotidien professionnel.
- Notez les questions qui restent ouvertes : elles deviendront votre prochaine session de révision.

### Mise en pratique

1. Lisez l'exemple proposé et expliquez-le à voix haute, comme si vous formiez un collègue.
2. Modifiez un paramètre ou une donnée, puis observez ce qui change.
3. Écrivez une courte synthèse de trois lignes dans vos notes.
4. Refaites l'exercice sans regarder la correction, puis comparez.

### À retenir

> Une compétence se construit par répétitions espacées. Pratiquez peu mais régulièrement, testez-vous souvent et revenez sur les notions fragiles. La régularité vaut mieux qu'une longue session isolée.`;

const Q = (text, opts, good, explanation, type = "single") => ({
  text,
  type,
  explanation,
  options: opts.map((o, i) => ({ text: o, correct: good.includes(i) })),
});

const GEN_QUIZ = [
  Q(
    "Quelle pratique aide le plus à ancrer une nouvelle compétence ?",
    ["Relire passivement", "Pratiquer régulièrement et se tester", "Regarder sans prendre de notes"],
    [1],
    "La récupération active et la répétition espacée sont plus efficaces que la relecture passive."
  ),
  Q(
    "Quelles habitudes favorisent une progression durable ?",
    ["Planifier des sessions courtes et régulières", "Travailler sans pause", "Se comparer aux autres", "Prendre des notes et reformuler"],
    [0, 3],
    "La régularité et la reformulation personnelle renforcent la mémorisation.",
    "multiple"
  ),
  Q(
    "Que faire lorsqu'une notion reste floue ?",
    ["Passer à la suite", "Chercher un exemple concret et poser une question", "Mémoriser sans comprendre"],
    [1],
    "Un exemple concret et une question ciblée permettent de débloquer la compréhension."
  ),
];

const COURSES = [
  {
    t: "Maîtriser React de zéro",
    s: "Composants, hooks, routage et bonnes pratiques pour créer de vraies applications",
    cat: 1,
    lvl: "debutant",
    price: 0,
    color: "#1E3A8A",
    ins: 0,
    secs: [
      ["Les bases", [["Pourquoi React ?", "text"], ["Votre premier composant", "video"], ["JSX et props", "text"]]],
      ["Les hooks", [["useState en pratique", "text"], ["useEffect sans piège", "text"], ["Quiz : les hooks", "quiz"]]],
      ["Aller plus loin", [["Routage avec React Router", "text"], ["Gérer les formulaires", "text"], ["Projet final", "text"]]],
      ["Pratique guidée", [["Atelier : une liste de tâches", "text"], ["Étude de cas : un tableau de bord", "video"], ["Récapitulatif et prochaines étapes", "text"]]],
    ],
    quiz: [
      Q("Quel hook gère un état local dans un composant ?", ["useState", "useRoute", "useStyle"], [0], "useState retourne la valeur courante et une fonction pour la modifier."),
      Q("Quand useEffect s'exécute-t-il avec un tableau de dépendances vide ?", ["À chaque rendu", "Une seule fois, après le premier rendu", "Jamais"], [1], "Avec [], l'effet ne s'exécute qu'au montage du composant."),
    ],
  },
  {
    t: "Node.js et API REST professionnelles",
    s: "Construisez une API sécurisée avec Express, JWT et SQLite",
    cat: 1,
    lvl: "intermediaire",
    price: 15000,
    color: "#16A34A",
    ins: 0,
    secs: [
      ["Fondations", [["Comprendre Node.js", "text"], ["Créer un serveur Express", "video"], ["Routes et middlewares", "text"]]],
      ["Données et sécurité", [["Base de données SQLite", "text"], ["Authentification JWT", "text"], ["Quiz : sécurité d'API", "quiz"]]],
      ["Mise en pratique", [["Validation avec Zod", "text"], ["Tests d'API", "text"], ["Déployer plus tard", "text"]]],
      ["Pratique guidée", [["Atelier : API de réservation", "text"], ["Étude de cas : gestion des rôles", "video"], ["Checklist de mise en production", "text"]]],
    ],
    quiz: [
      Q("Où stocker un mot de passe utilisateur ?", ["En clair", "Haché avec bcrypt", "Dans le JWT"], [1], "On ne stocke jamais un mot de passe en clair : on stocke son hachage."),
      Q("Un JWT d'accès doit idéalement avoir…", ["Une durée de vie courte", "Une durée infinie", "Aucune signature"], [0], "Un jeton court limite les dégâts en cas de vol."),
    ],
  },
  {
    t: "Réseaux : les fondamentaux",
    s: "Modèle OSI, adressage IP, routage et services réseau expliqués simplement",
    cat: 2,
    lvl: "debutant",
    price: 0,
    color: "#DB2777",
    ins: 1,
    secs: [
      ["Les modèles", [["Le modèle OSI", "text"], ["TCP/IP en pratique", "video"], ["Adressage IPv4", "text"]]],
      ["Services réseau", [["DNS et DHCP", "text"], ["Routage et sous-réseaux", "text"], ["Quiz : adressage", "quiz"]]],
      ["Sécuriser", [["Pare-feu et filtrage", "text"], ["VLAN et segmentation", "text"], ["Étude de cas", "text"]]],
      ["Pratique guidée", [["Atelier : plan d'adressage", "text"], ["Observer le trafic avec Wireshark", "video"], ["Récapitulatif réseau", "text"]]],
    ],
    quiz: [
      Q("Combien de couches compte le modèle OSI ?", ["4", "7", "5"], [1], "Le modèle OSI comporte 7 couches, de la physique à l'application."),
      Q("Quel service traduit un nom de domaine en adresse IP ?", ["DHCP", "DNS", "NAT"], [1], "Le DNS associe les noms de domaine aux adresses IP."),
    ],
  },
  {
    t: "Cybersécurité pour développeurs",
    s: "Les vulnérabilités courantes (OWASP) et comment les éviter dans votre code",
    cat: 2,
    lvl: "avance",
    price: 20000,
    color: "#7C3AED",
    ins: 1,
    secs: [
      ["Menaces", [["Panorama de l'OWASP Top 10", "text"], ["Injection SQL en direct", "video"], ["XSS et CSRF", "text"]]],
      ["Défendre", [["Validation des entrées", "text"], ["Gestion des secrets", "text"], ["Quiz : injections", "quiz"]]],
      ["Aller plus loin", [["Journalisation et détection", "text"], ["Réagir à un incident", "text"], ["Checklist finale", "text"]]],
      ["Pratique guidée", [["Atelier : audit d'une API", "text"], ["Étude de cas : fuite de données", "video"], ["Plan de remédiation", "text"]]],
    ],
    quiz: [
      Q("Quelle pratique protège le mieux contre l'injection SQL ?", ["Concaténer les chaînes", "Requêtes préparées paramétrées", "Masquer les erreurs"], [1], "Les requêtes paramétrées séparent le code SQL des données."),
      Q("Que signifie XSS ?", ["Cross-Site Scripting", "Extra Secure System", "XML Style Sheet"], [0], "XSS : injection de scripts dans une page vue par d'autres utilisateurs."),
    ],
  },
  {
    t: "Introduction à l'IA et au Machine Learning",
    s: "Comprendre les concepts clés, les types d'apprentissage et vos premiers modèles",
    cat: 3,
    lvl: "debutant",
    price: 12000,
    color: "#0891B2",
    ins: 2,
    secs: [
      ["Concepts", [["Qu'est-ce que l'IA ?", "text"], ["Apprentissage supervisé", "video"], ["Données et features", "text"]]],
      ["Pratique", [["Régression linéaire", "text"], ["Classification", "text"], ["Quiz : types d'apprentissage", "quiz"]]],
      ["Responsabilité", [["Biais et éthique", "text"], ["Évaluer un modèle", "text"], ["Et maintenant ?", "text"]]],
      ["Pratique guidée", [["Atelier : prédire un prix", "text"], ["Étude de cas : détection de fraude", "video"], ["Récapitulatif IA", "text"]]],
    ],
    quiz: [
      Q("Dans l'apprentissage supervisé, les données d'entraînement sont…", ["Étiquetées", "Toujours vides", "Chiffrées"], [0], "Chaque exemple est associé à la bonne réponse (étiquette)."),
      Q("Un modèle qui mémorise ses données sans généraliser souffre de…", ["Sous-apprentissage", "Sur-apprentissage", "Normalisation"], [1], "C'est le sur-apprentissage (overfitting)."),
    ],
  },
  {
    t: "UI Design : créer des interfaces premium",
    s: "Typographie, couleur, espacement et micro-interactions pour des produits mémorables",
    cat: 4,
    lvl: "intermediaire",
    price: 0,
    color: "#EA580C",
    ins: 2,
    secs: [
      ["Fondamentaux", [["Hiérarchie visuelle", "text"], ["Couleur et contraste", "video"], ["Typographie moderne", "text"]]],
      ["Composants", [["Espacements et grilles", "text"], ["Boutons et formulaires", "text"], ["Quiz : accessibilité", "quiz"]]],
      ["Vie et mouvement", [["Micro-interactions", "text"], ["Animations utiles", "text"], ["Présenter son travail", "text"]]],
      ["Pratique guidée", [["Atelier : refonte d'une carte", "text"], ["Étude de cas : design system", "video"], ["Checklist de finition", "text"]]],
    ],
    quiz: [
      Q("Quel ratio de contraste minimum vise le niveau AA pour le texte normal ?", ["2:1", "4,5:1", "10:1"], [1], "Le niveau AA des WCAG demande 4,5:1 pour le texte courant."),
      Q("Une bonne hiérarchie visuelle sert à…", ["Décorer", "Guider l'œil vers l'essentiel", "Ajouter des couleurs"], [1], "Elle indique ce qui est important en premier."),
    ],
  },
  {
    t: "Marketing digital et croissance",
    s: "Construire un tunnel d'acquisition, mesurer et fidéliser ses clients",
    cat: 5,
    lvl: "intermediaire",
    price: 18000,
    color: "#EA580C",
    ins: 3,
    secs: [
      ["Comprendre son marché", [["Le client idéal", "text"], ["Étude de marché express", "video"], ["Proposition de valeur", "text"]]],
      ["Acquisition", [["SEO et contenu", "text"], ["Réseaux sociaux", "text"], ["Quiz : tunnel d'acquisition", "quiz"]]],
      ["Fidélisation", [["Email marketing", "text"], ["Mesurer la rétention", "text"], ["Tableau de bord growth", "video"]]],
      ["Pratique", [["Audit d'une marque", "text"], ["Plan de lancement", "text"], ["Restitution client", "video"]]],
    ],
    quiz: [
      Q("Quel indicateur mesure le mieux la fidélité sur la durée ?", ["Le nombre de likes", "Le taux de rétention", "Le budget publicitaire"], [1], "La rétention montre combien de clients restent actifs dans le temps."),
      Q("Un tunnel d'acquisition sert à…", ["Comprendre le parcours du prospect", "Remplacer le produit", "Supprimer le support client"], [0], "Il décrit les étapes entre la découverte et la conversion."),
    ],
  },
  {
    t: "Anglais professionnel : gagner en confiance",
    s: "Se présenter, participer à une réunion et écrire des emails efficaces",
    cat: 6,
    lvl: "debutant",
    price: 9000,
    color: "#0891B2",
    ins: 3,
    secs: [
      ["Se présenter", [["Introduce yourself", "text"], ["Vocabulaire du travail", "text"], ["Prononciation", "video"]]],
      ["Réunions", [["Préparer une réunion", "text"], ["Prendre la parole", "text"], ["Quiz : expressions utiles", "quiz"]]],
      ["Écrire", [["Emails professionnels", "text"], ["Comptes rendus", "text"], ["Négociation", "video"]]],
      ["Pratique", [["Simulation d'entretien", "text"], ["Jeu de rôle", "text"], ["Plan de progression", "text"]]],
    ],
    quiz: [
      Q("Quelle formule ouvre poliment un email professionnel ?", ["Hey, listen!", "I hope this email finds you well.", "Give me that now."], [1], "Cette formule est courante et polie dans un contexte professionnel."),
      Q("Pour prendre la parole en réunion, on peut dire…", ["Could I add something?", "Shut up please.", "I am boring."], [0], "Cette formulation invite poliment à intervenir."),
    ],
  },
  {
    t: "SQL et bases de données pour analystes",
    s: "Interroger, agréger et optimiser des données avec SQL",
    cat: 3,
    lvl: "intermediaire",
    price: 14000,
    color: "#1E3A8A",
    ins: 2,
    secs: [
      ["Fondations", [["Modèle relationnel", "text"], ["SELECT et filtres", "text"], ["Jointures", "video"]]],
      ["Analyse", [["Agrégations", "text"], ["Sous-requêtes", "text"], ["Quiz : SQL", "quiz"]]],
      ["Performance", [["Index", "text"], ["Expliquer un plan", "text"], ["Bonnes pratiques", "video"]]],
      ["Projet", [["Base de données e-commerce", "text"], ["Requêtes de reporting", "text"], ["Restitution", "text"]]],
    ],
    quiz: [
      Q("Quelle clause filtre les lignes avant l'agrégation ?", ["WHERE", "ORDER BY", "LIMIT"], [0], "WHERE filtre les lignes ; HAVING filtre après agrégation."),
      Q("Une jointure INNER JOIN retourne…", ["Toutes les lignes des deux tables", "Les lignes qui correspondent dans les deux tables", "Uniquement la première table"], [1], "INNER JOIN conserve les correspondances présentes des deux côtés."),
    ],
  },
  {
    t: "Figma : prototyper des produits modernes",
    s: "Composants, auto layout et prototypes interactifs prêts à tester",
    cat: 4,
    lvl: "debutant",
    price: 0,
    color: "#DB2777",
    ins: 2,
    secs: [
      ["Bases", [["Interface Figma", "video"], ["Grilles et contraintes", "text"], ["Composants", "text"]]],
      ["Design system", [["Variables", "text"], ["Auto layout", "text"], ["Quiz : design system", "quiz"]]],
      ["Prototype", [["Interactions", "text"], ["Tester son prototype", "text"], ["Handoff développeur", "video"]]],
      ["Projet", [["Refonte d'une app", "text"], ["Présenter son travail", "text"], ["Checklist finale", "text"]]],
    ],
    quiz: [
      Q("À quoi sert un composant dans Figma ?", ["À réutiliser un élément cohérent", "À exporter une vidéo", "À écrire du SQL"], [0], "Un composant centralise les variantes et facilite les mises à jour."),
      Q("Auto layout permet de…", ["Créer des mises en page qui s'adaptent au contenu", "Supprimer les calques", "Changer la police du système"], [0], "Auto layout gère automatiquement l'espacement et le redimensionnement."),
    ],
  },
];

const PENDING = [
  {
    t: "Python pour l'analyse de données",
    s: "Pandas, visualisation et analyse pas à pas",
    cat: 3,
    lvl: "intermediaire",
    price: 10000,
    color: "#0891B2",
    ins: 2,
    secs: [
      ["Prise en main", [["Installer l'environnement", "text"], ["Premiers DataFrames", "text"], ["Visualiser avec Matplotlib", "video"]]],
      ["Analyser", [["Nettoyer les données", "text"], ["Agréger et croiser", "text"], ["Quiz : Pandas", "quiz"]]],
      ["Restituer", [["Construire un rapport", "text"], ["Présenter ses résultats", "text"], ["Aller plus loin", "text"]]],
    ],
    quiz: [
      Q("Quelle bibliothèque est centrale pour les DataFrames ?", ["Pandas", "Express", "Figma"], [0], "Pandas fournit les structures Series et DataFrame."),
      Q("Que fait dropna() ?", ["Supprime les valeurs manquantes", "Double les lignes", "Change la couleur du tableau"], [0], "dropna retire les lignes ou colonnes contenant des valeurs manquantes."),
    ],
  },
  {
    t: "Gestion de projet agile",
    s: "Scrum, Kanban et rituels pour livrer avec sérénité",
    cat: 5,
    lvl: "debutant",
    price: 11000,
    color: "#16A34A",
    ins: 3,
    secs: [
      ["Principes", [["Pourquoi l'agilité ?", "text"], ["Valeurs et principes", "text"], ["Scrum vs Kanban", "video"]]],
      ["Rituels", [["Le sprint planning", "text"], ["Daily et revue", "text"], ["Quiz : rituels agiles", "quiz"]]],
      ["Pratique", [["Prioriser un backlog", "text"], ["Mesurer la vélocité", "text"], ["Amélioration continue", "text"]]],
    ],
    quiz: [
      Q("Quel rituel sert à synchroniser l'équipe au quotidien ?", ["Le daily", "La revue de presse", "Le bilan comptable"], [0], "Le daily permet de partager avancements et blocages."),
      Q("Un backlog est…", ["Une liste priorisée de besoins", "Un serveur de production", "Un type de contrat"], [0], "Le backlog regroupe les éléments à réaliser, ordonnés par valeur."),
    ],
  },
];

const DRAFT = {
  t: "Photographie mobile créative",
  s: "Composer, exposer et retoucher ses photos avec un smartphone",
  cat: 4,
  lvl: "debutant",
  price: 0,
  color: "#7C3AED",
  ins: 2,
  secs: [["Composer", [["Règles de composition", "text"], ["Lumière et exposition", "video"]]]],
  quiz: [],
};

export function seed() {
  const h = bcrypt.hashSync("Learnly2026!", 10);
  const COL = ["#1E3A8A", "#DB2777", "#16A34A", "#7C3AED", "#0891B2", "#EA580C"];
  const COM = [
    "Cours très clair, les exemples sont parlants. Je recommande !",
    "Excellent rapport qualité-prix, j'ai enfin compris les bases.",
    "Bien structuré, les quiz m'ont aidé à valider mes acquis.",
    "Un formateur pédagogue et des explications simples.",
    "Les mises en pratique font vraiment la différence.",
    "Contenu à jour, progressif et agréable à suivre.",
  ];

  db.transaction(() => {
    db.exec(`DELETE FROM notes;DELETE FROM wishlist;DELETE FROM certificates;DELETE FROM reviews;DELETE FROM quiz_attempts;
      DELETE FROM lesson_progress;DELETE FROM payments;DELETE FROM enrollments;DELETE FROM lessons;DELETE FROM sections;
      DELETE FROM courses;DELETE FROM categories;DELETE FROM refresh_tokens;DELETE FROM users;`);
    try {
      db.prepare("DELETE FROM sqlite_sequence").run();
    } catch {}

    let ci = 0;
    const iu = db.prepare("INSERT INTO users(name,email,password_hash,role,headline,bio,avatar_color) VALUES(?,?,?,?,?,?,?)");
    const U = (n, e, role, headline = "", bio = "") =>
      Number(iu.run(n, e, h, role, headline, bio, COL[ci++ % COL.length]).lastInsertRowid);

    U("Administrateur Learnly", "admin@learnly.dev", "admin", "Responsable pédagogique", "Je veille à la qualité des cours publiés sur Learnly.");
    const ins = [
      U("Prof. Armand Kiki", "prof@learnly.dev", "instructor", "Ingénieur logiciel et formateur", "Je forme des développeurs depuis dix ans, avec une obsession : rendre le complexe accessible."),
      U("Dr Carine Adjaho", "carine@learnly.dev", "instructor", "Experte réseaux et cybersécurité", "Docteure en sécurité des systèmes, je partage des cas concrets et des bonnes pratiques."),
      U("Marius Tokpa", "marius@learnly.dev", "instructor", "Data scientist et designer produit", "Je relie la donnée, le design et l'impact utilisateur."),
      U("Sylvie Dossou", "sylvie@learnly.dev", "instructor", "Consultante marketing et communication", "J'accompagne les équipes dans leur croissance et leur communication en français et en anglais."),
    ];

    const students = [
      ["Ama Kpossou", "student@learnly.dev"], ["Yves Hounkpè", "yves@learnly.dev"],
      ["Chantal Ahouansou", "chantal@learnly.dev"], ["Marcel Zinsou", "marcel@learnly.dev"],
      ["Rita Adjovi", "rita@learnly.dev"], ["Eric Sossou", "eric@learnly.dev"],
      ["Nadia Fassinou", "nadia@learnly.dev"], ["Boris Dansou", "boris@learnly.dev"],
      ["Sandra Gbèdo", "sandra@learnly.dev"], ["Ghislain Kpadonou", "ghislain@learnly.dev"],
      ["Laure Tossou", "laure@learnly.dev"], ["Fabrice Akakpo", "fabrice@learnly.dev"],
      ["Estelle Dossou", "estelle@learnly.dev"], ["Romuald Sossou", "romuald@learnly.dev"],
      ["Carelle Hounkpatin", "carelle@learnly.dev"], ["Joël Agossou", "joel@learnly.dev"],
      ["Mireille Kiki", "mireille@learnly.dev"], ["Stéphane Adjovi", "stephane@learnly.dev"],
      ["Clarisse Zinsou", "clarisse@learnly.dev"], ["Wilfried Dansou", "wilfried@learnly.dev"],
    ].map(([n, e]) => U(n, e, "student"));

    const cat = CATS.map(([n, s, i]) =>
      Number(db.prepare("INSERT INTO categories(name,slug,icon) VALUES(?,?,?)").run(n, s, i).lastInsertRowid)
    );
    const ic = db.prepare(
      "INSERT INTO courses(instructor_id,category_id,title,slug,subtitle,description,level,language,price,color,status) VALUES(?,?,?,?,?,?,?,?,?,?,?)"
    );
    const is = db.prepare("INSERT INTO sections(course_id,title,position) VALUES(?,?,?)");
    const il = db.prepare(
      "INSERT INTO lessons(section_id,title,type,content,video_url,duration_min,position,free_preview,quiz) VALUES(?,?,?,?,?,?,?,?,?)"
    );

    const all = [];
    const addCourse = (C, status = "published") => {
      const s = C.t.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      const cid = Number(
        ic.run(
          ins[C.ins],
          cat[C.cat - 1],
          C.t,
          s,
          C.s,
          `${C.s}.\n\nCe cours vous guide pas à pas avec des explications concrètes, des démonstrations et des quiz. Les leçons sont conçues pour être suivies dans l'ordre, puis revues à votre rythme. À la fin, vous repartez avec une méthode réutilisable et un certificat vérifiable.`,
          C.lvl,
          "fr",
          C.price,
          C.color,
          status
        ).lastInsertRowid
      );
      const lessons = [];
      C.secs.forEach(([title, items], si) => {
        const sid = Number(is.run(cid, title, si).lastInsertRowid);
        items.forEach(([lt, type], li) => {
          const quiz = type === "quiz" ? JSON.stringify({ passScore: 70, questions: [...C.quiz, ...GEN_QUIZ] }) : null;
          const content = type === "quiz" ? "Testez vos connaissances avec ce quiz de cinq questions. Vous pouvez réessayer autant de fois que nécessaire ; seul le meilleur score est conservé." : body(lt, C.t);
          const lid = Number(
            il.run(
              sid,
              lt,
              type,
              content,
              type === "video" ? VIDEOS[(si + li) % VIDEOS.length] : "",
              type === "video" ? 9 : type === "quiz" ? 5 : 7,
              li,
              si === 0 && li === 0 ? 1 : 0,
              quiz
            ).lastInsertRowid
          );
          lessons.push({ id: lid, type });
        });
      });
      const course = { id: cid, lessons, price: C.price, title: C.t, status, category: cat[C.cat - 1] };
      all.push(course);
      return course;
    };

    COURSES.forEach((C) => addCourse(C));
    PENDING.forEach((C) => addCourse(C, "pending"));
    addCourse(DRAFT, "draft");

    const published = all.filter((c) => c.status === "published");
    const ie = db.prepare("INSERT OR IGNORE INTO enrollments(user_id,course_id,completed_at) VALUES(?,?,?)");
    const ip = db.prepare("INSERT OR IGNORE INTO lesson_progress(user_id,lesson_id,completed_at) VALUES(?,?,?)");
    const ipay = db.prepare("INSERT INTO payments(user_id,course_id,amount,method,status,reference) VALUES(?,?,?,?,?,?)");
    const rows = [];
    const enroll = (u, c, frac) => {
      const done = frac >= 1;
      const at = new Date(Date.now() - Math.round((1 - frac) * 20 + 2) * 864e5).toISOString();
      const r = ie.run(u, c.id, done ? at : null);
      if (!r.changes) return null;
      const n = Math.max(0, Math.round(c.lessons.length * frac));
      c.lessons.slice(0, n).forEach((l) => ip.run(u, l.id, at));
      if (c.price > 0)
        ipay.run(u, c.id, c.price, "mobile_money", "paid", "PAY-" + crypto.randomBytes(5).toString("hex").toUpperCase());
      const row = { u, c, frac };
      rows.push(row);
      return row;
    };

    enroll(students[0], published[0], 1);
    enroll(students[0], published[1], 0.5);
    enroll(students[0], published[5], 0.25);

    const pairs = [];
    for (const u of students) {
      if (u === students[0]) continue;
      for (const c of published) pairs.push([u, c]);
    }
    let k = 7;
    const rnd = (n) => {
      k = (k * 9301 + 49297) % 233280;
      return Math.floor((k / 233280) * n);
    };
    for (let i = pairs.length - 1; i > 0; i--) {
      const j = rnd(i + 1);
      [pairs[i], pairs[j]] = [pairs[j], pairs[i]];
    }
    const fracs = [0.15, 0.3, 0.45, 0.6, 0.75, 0.9, 1];
    for (const [u, c] of pairs) {
      if (rows.length >= 150) break;
      enroll(u, c, fracs[rnd(fracs.length)]);
    }

    const completed = rows.filter((r) => r.frac >= 1);
    const icert = db.prepare("INSERT INTO certificates(user_id,course_id,code) VALUES(?,?,?)");
    completed.slice(0, 8).forEach((r) => icert.run(r.u, r.c.id, "LRN-" + crypto.randomBytes(4).toString("hex").toUpperCase()));

    const irv = db.prepare("INSERT OR IGNORE INTO reviews(user_id,course_id,rating,comment) VALUES(?,?,?,?)");
    let reviews = 0;
    for (const r of rows) {
      if (reviews >= 60) break;
      if (r.frac >= 0.3) {
        irv.run(r.u, r.c.id, 4 + rnd(2), COM[rnd(COM.length)]);
        reviews++;
      }
    }

    const iq = db.prepare("INSERT INTO quiz_attempts(user_id,lesson_id,score,passed,answers_json) VALUES(?,?,?,?,?)");
    for (const course of [published[0], published[1]]) {
      const quiz = course.lessons.find((l) => l.type === "quiz");
      if (quiz) iq.run(students[0], quiz.id, course === published[0] ? 100 : 80, 1, "{}");
    }

    const notes = db.prepare("INSERT INTO notes(user_id,lesson_id,content) VALUES(?,?,?)");
    const mainLessons = published[0].lessons.slice(0, 3);
    notes.run(students[0], mainLessons[0].id, "Retenir : un composant React est une fonction qui retourne du JSX.");
    notes.run(students[0], mainLessons[1].id, "À revoir : le cycle de rendu et la différence entre props et state.");
    notes.run(students[0], mainLessons[2].id, "Idée de projet : une petite bibliothèque de films avec recherche et favoris.");

    const iw = db.prepare("INSERT OR IGNORE INTO wishlist(user_id,course_id) VALUES(?,?)");
    [published[1], published[4], published[7], published[9]].forEach((c) => iw.run(students[0], c.id));

    db.prepare(
      `UPDATE courses SET
        students_count=(SELECT COUNT(*) FROM enrollments e WHERE e.course_id=courses.id),
        duration_min=(SELECT COALESCE(SUM(l.duration_min),0) FROM lessons l JOIN sections s ON s.id=l.section_id WHERE s.course_id=courses.id),
        rating_avg=(SELECT COALESCE(AVG(r.rating),0) FROM reviews r WHERE r.course_id=courses.id),
        rating_count=(SELECT COUNT(*) FROM reviews r WHERE r.course_id=courses.id)`
    ).run();
  })();
}
