# 🛒 Courses — liste de courses partagée et hors ligne

Une PWA (application web installable) pour faire les courses à deux :

- **Fonctionne hors ligne** : l'application et la liste sont enregistrées sur le téléphone. En magasin, même sans réseau, vous pouvez cocher, ajouter et supprimer des articles. Les modifications sont envoyées automatiquement dès que le réseau revient.
- **Partagée en temps réel** : chacun voit les ajouts et les articles cochés par l'autre (via Firebase Firestore, offre gratuite).
- **Rangée par rayon** : les articles sont classés automatiquement (fruits & légumes, crèmerie, surgelés…) dans l'ordre d'un parcours en magasin.
- **Saisie rapide** : « 2 lait », « farine 500g », « steak haché x4 »… La quantité est reconnue, et plusieurs articles peuvent être saisis d'un coup (« lait, œufs et 2 baguettes »). Les articles fréquents sont proposés en suggestions.
- **À la voix** : bouton 🎤 dans l'application, et raccourci Siri « Dis Siri, ajoute aux courses » (voir plus bas).
- **Design moderne**, mode sombre automatique, installable sur l'écran d'accueil (Android et iPhone).

## Utilisation

| Geste | Action |
|---|---|
| Toucher un article | Le cocher ou le décocher (il passe dans « Dans le caddie ») |
| Glisser vers la gauche | Supprimer (avec « Annuler ») |
| Appui long | Modifier le nom, la quantité, le rayon ou ajouter une note |
| Bouton 👥 en haut | Partager la liste et indiquer votre prénom |

La pastille en haut indique l'état : **Synchronisé**, **Envoi…**, **Hors ligne** (les modifications sont gardées et seront envoyées plus tard) ou **Local** (partage non configuré).

## Mise en route

### 1. Créer le projet Firebase (gratuit, environ 5 minutes)

1. Allez sur <https://console.firebase.google.com> et créez un projet (Google Analytics n'est pas nécessaire).
2. **Authentication** › Commencer › Mode de connexion › activez **Anonyme**.
3. **Firestore Database** › Créer une base de données › choisissez une région en Europe (ex. `europe-west9` Paris) › mode production.
4. Onglet **Règles** de Firestore : collez le contenu de [`firestore.rules`](firestore.rules) puis **Publier**.
5. ⚙️ **Paramètres du projet** › Vos applications › icône **Web** `</>` › enregistrez l'application. Copiez l'objet `firebaseConfig` affiché.
6. Collez-le dans [`public/firebase-config.js`](public/firebase-config.js) à la place de `null`.

> Ces clés ne sont pas secrètes, elles peuvent être publiées. La sécurité est assurée par les règles Firestore : seule une personne qui connaît le code de la liste (aléatoire, 16 caractères) peut la lire ou la modifier.

### 2. Mettre l'application en ligne

Une PWA doit être servie en **HTTPS**. Deux options gratuites :

**Option A — Firebase Hosting** (recommandée, même outil que la base)

```bash
npm install -g firebase-tools
```

```bash
firebase login
```

```bash
firebase deploy
```

L'adresse est affichée à la fin, du type `https://votre-projet.web.app`. Cette commande publie aussi les règles Firestore.

**Option B — GitHub Pages**

Dans le dépôt GitHub : **Settings › Pages › Source : GitHub Actions**. Le workflow [`.github/workflows/pages.yml`](.github/workflows/pages.yml) publie le site à chaque push sur `main`.
Pour un dépôt privé, GitHub Pages nécessite un abonnement payant : utilisez plutôt l'option A.

### 3. Installer sur les téléphones et partager

1. Ouvrez l'adresse sur votre téléphone.
   - **iPhone (Safari)** : bouton Partager › « Sur l'écran d'accueil ».
   - **Android (Chrome)** : menu ⋮ › « Installer l'application ».
2. Touchez 👥 › **Partager le lien** et envoyez-le à votre compagne.
3. Elle ouvre le lien sur son téléphone, puis installe l'application de la même façon. Vous êtes sur la même liste.

Ouvrez l'application au moins une fois avec du réseau sur chaque téléphone : ensuite elle démarre sans réseau.

## Ajouter avec Siri

Dans l'application : 👥 › **Ajouter avec Siri**. L'écran donne les étapes et les valeurs à copier pour créer le raccourci dans l'app **Raccourcis**.

Fonctionnement : le raccourci envoie la phrase dictée dans `lists/{code}/inbox` (API REST Firestore, sans connexion). La première application ouverte qui la reçoit la découpe en articles (`public/js/parse.js`), les ajoute à la liste puis supprime le message. Les règles Firestore n'autorisent dans cette boîte que la création d'un message texte court ; seule l'application connectée peut la lire.

Les phrases dictées à Siri sont traitées dès qu'un des téléphones ouvre l'application.

## Développement

Aucune étape de compilation : HTML, CSS et JavaScript (modules ES) uniquement.

```bash
python3 -m http.server 8080 --directory public
```

Puis ouvrez <http://localhost:8080>. Sans configuration Firebase, l'application fonctionne en mode **local**, avec la liste enregistrée sur l'appareil uniquement.

| Fichier | Rôle |
|---|---|
| `public/index.html`, `public/styles.css` | Interface |
| `public/js/app.js` | Logique : saisie, rendu, gestes, partage |
| `public/js/store.js` | Stockage : local (`localStorage`) ou partagé (Firestore avec cache hors ligne) |
| `public/js/categories.js` | Rayons et classement automatique des articles |
| `public/js/parse.js` | Découpage d'une phrase en articles et quantités |
| `public/sw.js` | Service worker : cache de l'application pour le hors ligne |
| `public/firebase-config.js` | Votre configuration Firebase |
| `firestore.rules` | Règles de sécurité de la base |

**Après chaque modification**, incrémentez `VERSION` dans `public/sw.js` (`v1` › `v2`…) pour que les téléphones récupèrent la nouvelle version.
