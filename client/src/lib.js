export const fcfa=n=>n?new Intl.NumberFormat("fr-FR").format(n)+" FCFA":"Gratuit";
export const LEVEL={debutant:"Débutant",intermediaire:"Intermédiaire",avance:"Avancé"};
export const dur=m=>m>=60?`${Math.floor(m/60)} h ${String(m%60).padStart(2,"0")}`:`${m} min`;
export const dateFr=d=>new Date(d).toLocaleDateString("fr-FR",{day:"numeric",month:"long",year:"numeric"});
export const TYPE_ICON={video:"▶",text:"📄",quiz:"❓"};
