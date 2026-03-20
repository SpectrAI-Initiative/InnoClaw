# InnoClaw

<p align="center">
  <img src="../site/logos/20260316-112548.png" alt="InnoClaw Logo" width="200" />
</p>

<p align="center">
  <b>Un espace de travail de recherche IA auto-heberge pour le chat ancre dans les documents, l'etude d'articles, les workflows scientifiques et l'execution de recherche.</b>
</p>

<p align="center">
  <i>Ancre dans vos fichiers, organise autour des articles, et pret a aller jusqu'a l'execution.</i>
</p>

<p align="center">
  <a href="../LICENSE"><img src="https://img.shields.io/badge/License-Apache%202.0-blue.svg" alt="Apache 2.0 License"></a>
  <a href="../package.json"><img src="https://img.shields.io/badge/Node.js-20%2B-339933?logo=node.js&logoColor=white" alt="Node.js 20+"></a>
  <a href="https://github.com/SpectrAI-Initiative/InnoClaw/actions/workflows/ci.yml"><img src="https://github.com/SpectrAI-Initiative/InnoClaw/actions/workflows/ci.yml/badge.svg" alt="CI Status"></a>
  <a href="https://SpectrAI-Initiative.github.io/InnoClaw/"><img src="https://img.shields.io/badge/Docs-Online-blue?logo=gitbook&logoColor=white" alt="Online Docs"></a>
  <a href="https://github.com/SpectrAI-Initiative/InnoClaw/stargazers"><img src="https://img.shields.io/github/stars/SpectrAI-Initiative/InnoClaw?style=flat&logo=github" alt="GitHub Stars"></a>
  <a href="https://github.com/SpectrAI-Initiative/InnoClaw/issues"><img src="https://img.shields.io/github/issues/SpectrAI-Initiative/InnoClaw" alt="GitHub Issues"></a>
</p>

<p align="center">
  <a href="../README.md">English</a> · <a href="README_CN.md">简体中文</a> · <a href="README_JA.md">日本語</a> · <b>Francais</b> · <a href="README_DE.md">Deutsch</a>
</p>

<p align="center">
  <a href="https://SpectrAI-Initiative.github.io/InnoClaw/">Documentation</a> · <a href="#fr-quick-start">Demarrage rapide</a> · <a href="#fr-community-support">Communaute</a>
</p>

> Cette traduction peut etre mise a jour plus lentement que la page d'accueil anglaise `../README.md`. Pour les toutes dernieres nouveautes, consultez d'abord les pages anglaise et chinoise.

InnoClaw transforme les dossiers cote serveur en espaces de travail IA natifs pour le chat ancre dans les documents, l'etude d'articles, les workflows scientifiques et l'execution de recherche.

Il s'adresse aux chercheurs, developpeurs, laboratoires et adeptes du self-hosting qui veulent plus qu'une simple interface de chat : des reponses citees sur de vrais fichiers, des competences reutilisables, et un chemin clair de la lecture a l'execution.

> Workflow : Ouvrir un workspace -> Synchroniser les fichiers dans le RAG -> Poser des questions avec sources -> Etudier des articles -> Lancer une discussion multi-agent -> Generer des notes et des idees -> Executer des taches de recherche a distance

---

## 🔥 Nouveautes

### Dernieres mises a jour

*Cette section est synchronisee automatiquement sous forme de resume traduit leger. Pour les mises a jour les plus rapides, consultez `../README.md` et `README_CN.md`.*

<!-- whats-new-start -->

#### 2026-03-20
- **Module de recherche approfondie**: Pipeline de recherche scientifique entierement pilote par IA avec orchestration multi-phases, deliberation des evaluateurs, planification d'execution et interface graphique de flux de travail
- **Pipeline d'execution**: Systeme d'execution d'experiences automatise avec soumission de jobs Slurm, gestion de jeux de donnees, preprocessement et support d'executeurs distants


#### 2026-03-19
- **Importation de competences ClawHub**: Nouvelle integration pour importer des competences directement depuis ClawHub via un point d'API dedie et une boite de dialogue d'importation
- **Panneau de previsualisation du code**: Nouveau composant de previsualisation de code integre a l'editeur, avec coloration syntaxique et suivi de l'etat de sauvegarde
- **Cache de session d'etude**: Couche de mise en cache persistante pour les sessions d'etude de documents, ameliorant les performances de rechargement et la continuite d'etat



#### 2026-03-18
- **Vision Multimodale pour l'Analyse d'Articles**: Les images PDF sont desormais extraites et analysees visuellement lors des sessions de discussion et d'ideation de recherche
- **Integration des Competences Claude Code**: Importez des competences directement depuis des dossiers locaux ou des projets Claude Code via un nouveau flux d'importation dedie




#### 2026-03-18
- **Vision multimodale pour discussion et ideation d'articles** : les fournisseurs compatibles vision recoivent maintenant les images de pages PDF extraites en plus du texte afin d'analyser figures, tableaux et schemas.
- **UI de galerie des pages d'article** : les panneaux Discussion et Ideation affichent maintenant une galerie repliable de miniatures de pages avec apercu en grand format.
- **Detection de la capacite vision des fournisseurs** : la configuration des fournisseurs expose maintenant la prise en charge vision pour basculer automatiquement entre contexte multimodal et texte seul.




#### 2026-03-17
- **Gestion des profils de jobs distants et durcissement SSH** : prise en charge de la creation, de l'edition et de l'envoi securise de jobs de recherche via SSH
- **Rendu Markdown riche dans le panneau Agent** : les messages Agent affichent maintenant tableaux, formules LaTeX et blocs de code avec coloration syntaxique
- **UI de configuration des fournisseurs API** : configuration directe des cles API et endpoints des fournisseurs IA depuis la page Settings




#### 2026-03-17
- **Durcissement de la configuration et de la soumission rjob** : les profils distants peuvent stocker les valeurs par defaut rjob completes (image, GPU, CPU, memory, mounts, charged-group, private-machine, env vars, host-network, example commands). `submitRemoteJob` construit la commande rjob a partir de la configuration stockee, ce qui empeche l'Agent de modifier des drapeaux critiques comme `--charged-group` ou `--image`. Le transport SSH a aussi ete fiabilise avec `-o StrictHostKeyChecking=no -tt`, le chargement du script d'init et le bon quoting.
- **Edition des profils** : le bouton d'edition dans l'onglet Remotes recharge le profil existant dans le formulaire, y compris tous les champs rjob.
- **Raccourci de soumission directe** : en mode Agent-Long, les soumissions simples peuvent sauter inspect/patch/sync et suivre `listRemoteProfiles -> prepareJobSubmission -> approval -> submitRemoteJob`.




#### 2026-03-16
- **Robustesse des discussions d'articles et de l'ideation** : budget de tokens par role augmente de 2 a 2.5x, reessai automatique sur reponses vides ou trop courtes, et erreurs visibles dans l'UI
- **Contexte article complet** : les agents de discussion et d'ideation recoivent jusqu'a 30k caracteres du texte complet local de l'article, et pas seulement le resume
- **Correction de l'extraction d'abstract** : extraction heuristique via regex et meilleur prompt IA pour eviter de prendre les noms d'auteurs pour le resume




#### 2026-03-14
- **Research Execution Engine** : nouveau systeme d'orchestration de recherche pilote par IA avec profils distants, toggles de capacites, historique d'execution et outils Agent
- **Section README "What's New" mise a jour automatiquement** : workflow GitHub Actions qui genere et met a jour chaque jour les nouvelles fonctionnalites importantes







<!-- whats-new-end -->

---

## 🧭 Qu'est-ce qu'InnoClaw ?

InnoClaw est une application web auto-hebergee pour le travail de connaissance oriente recherche. Elle combine la gestion de workspaces, le chat RAG, la recherche et la revue d'articles, des competences scientifiques reutilisables, et l'execution pilotee par Agent au meme endroit.

Au lieu de jongler entre un navigateur de fichiers, un outil de notes, un lecteur d'articles et une console d'automatisation, vous gardez tout dans un seul workspace : ouvrir un dossier, synchroniser le contenu, poser des questions ancrees, etudier des articles, et lancer des taches de recherche multi-etapes.

## ✨ Pourquoi InnoClaw

- **Workspace d'abord** - Traitez les dossiers serveur comme des workspaces de recherche persistants avec fichiers, notes, historique de chat et contexte d'execution
- **Reponses IA ancrees** - Obtenez des reponses RAG avec citations sur vos propres documents et votre code
- **Workflows natifs pour la recherche** - Etudiez des articles, lancez des discussions multi-agent structurees et derivez de nouvelles directions depuis la litterature
- **Competences scientifiques integrees** - Importez et utilisez 206 competences scientifiques SCP couvrant notamment la decouverte de medicaments, la genomique et les proteines
- **Execution, pas seulement conversation** - Passez de la lecture et de la planification a la soumission de jobs, la supervision, la collecte de resultats et les recommandations suivantes
- **Auto-heberge et multi-modeles** - Fonctionne avec OpenAI, Anthropic, Gemini et des endpoints compatibles

<a id="fr-quick-start"></a>

## 🚀 Demarrage rapide

```bash
git clone https://github.com/SpectrAI-Initiative/InnoClaw.git
cd InnoClaw
npm install
npm run dev
```

- Ouvrez `http://localhost:3000`
- Configurez un fournisseur IA dans la page Settings
- Ouvrez ou clonez un workspace, puis cliquez sur `Sync` pour construire l'index RAG
- Pour les prerequis par OS et le deploiement en production, voir `getting-started/installation.md`

## 🛠️ Ce que vous pouvez faire

- Dialoguer avec des fichiers et du code locaux avec citations
- Rechercher, resumer et relire des articles dans un seul workspace
- Lancer des discussions structurees a 5 roles pour la critique et la reproductibilite
- Generer resumes, FAQ, briefs, timelines et idees de recherche
- Importer des competences scientifiques et declencher des workflows reutilisables
- Gerer des taches de recherche distantes avec gates d'approbation, supervision et analyse des resultats

## 🗺️ Choisissez votre point d'entree

| Si vous voulez... | Commencer ici | Et ensuite |
|-------------------|---------------|------------|
| Dialoguer avec vos propres fichiers | **Workspace + chat RAG** | Ouvrez un dossier, cliquez sur `Sync` et posez des questions citees |
| Lire et deconstruire des articles | **Etude d'articles** | Recherchez des articles, resumez-les, puis passez a la discussion ou aux notes |
| Tester des idees sous plusieurs angles | **Discussion multi-agent** | Lancez des revues par roles pour la critique, la collecte de preuves et la reproductibilite |
| Transformer la lecture en nouvelles directions | **Ideation de recherche** | Generez des pistes, comparez des options et sauvegardez les sorties dans les notes |
| Executer le travail de recherche sur une infrastructure distante | **Espace d'execution de recherche** | Revoyez le code, approuvez les changements, soumettez des jobs, surveillez et collectez les resultats |

## 🧩 Comment tout s'articule

| Couche | Role dans le workflow |
|--------|-----------------------|
| **Workspace** | Conserve les fichiers, notes, contexte de session et etat du projet |
| **Connaissance** | Synchronise les fichiers dans l'index RAG pour garder les reponses ancrees |
| **Atelier articles** | Gere la recherche, le resume, la discussion et l'ideation autour de la litterature |
| **Skills** | Ajoute des workflows de domaine reutilisables et des capacites guidees par outils |
| **Execution** | Etend le workflow vers les jobs distants et les boucles d'experimentation |

## 🔄 Workflows cles

### 📄 Etude d'articles

Recherchez la litterature, previsualisez des articles, resumez-les, puis passez directement a la discussion ou a l'ideation.

- Recherche multi-source dans une seule UI
- Expansion de requete assistee par IA pour une couverture plus large
- Previsualisation des articles sans quitter le contexte du workspace
- Sauvegarde des sorties dans les notes pour reutilisation

### 🧠 Discussion multi-agent

Lancez une revue structuree d'article avec des roles tels que moderateur, bibliographe, sceptique, reproducer et scribe.

- Flux de discussion deterministe par etapes
- Comparaison des preuves, methodes, limites et questions de reproductibilite
- Production de traces de revue plus faciles a relire qu'un chat libre
- Utilisation du texte complet pour une analyse plus profonde

### 🧪 Espace d'execution de recherche

Passez de l'inspection du code a la soumission de jobs et a l'analyse des resultats dans un workflow guide.

- Revue de depots et proposition de patches avec l'aide d'Agent
- Checkpoints d'approbation explicites pour les etapes a risque
- Soumission de jobs via Shell, Slurm ou `rjob`
- Supervision des statuts, collecte des artefacts et recommandations pour la suite

## 📦 Apercu des fonctionnalites

| Fonction | Ce qu'elle permet |
|----------|-------------------|
| Gestion des workspaces | Mapper des dossiers serveur en workspaces IA persistants |
| Navigateur de fichiers | Parcourir, uploader, creer, modifier, previsualiser et synchroniser des fichiers |
| Chat RAG | Poser des questions ancrees sur les fichiers indexes avec citations |
| Etude d'articles | Rechercher, resumer et inspecter des articles au meme endroit |
| Mode discussion | Executer des discussions d'articles structurees a plusieurs roles |
| Ideation de recherche | Generer de nouvelles directions et des idees transdisciplinaires |
| Systeme de skills | Importer des competences scientifiques et workflows reutilisables |
| Execution de recherche | Orchestrer des boucles experimentales distantes avec supervision et approbations |
| Sessions multi-agent | Garder des contextes d'execution distincts selon les onglets et projets |
| Support multi-LLM | Utiliser OpenAI, Anthropic, Gemini et des endpoints compatibles |

## 📚 Documentation

- **Commencer ici** - [Overview](getting-started/overview.md), [Installation](getting-started/installation.md)
- **Configurer et deployer** - [Deployment](getting-started/deployment.md), [Environment Variables](getting-started/environment-variables.md), [Configuration](usage/configuration.md)
- **Utiliser le produit** - [Features](usage/features.md), [API Reference](usage/api-reference.md)
- **Depanner et contribuer** - [Troubleshooting](troubleshooting/faq.md), [Development Guide](development/contributing.md)

<a id="fr-community-support"></a>

## 💬 Communaute et support

- **Besoin d'aide pour l'installation ou l'usage ?** Commencez par la documentation : https://SpectrAI-Initiative.github.io/InnoClaw/
- **Vous avez trouve un bug ou voulez proposer une fonctionnalite ?** Ouvrez une issue : https://github.com/SpectrAI-Initiative/InnoClaw/issues
- **Vous voulez echanger directement ?** Rejoignez la communaute Feishu depuis `README_CN.md`

## ℹ️ Infos projet

- **Licence** - Apache-2.0, voir `../LICENSE`
- **Depot** - https://github.com/SpectrAI-Initiative/InnoClaw
- **Documentation** - https://SpectrAI-Initiative.github.io/InnoClaw/

## ⭐ Historique des etoiles

[![Star History Chart](https://api.star-history.com/svg?repos=SpectrAI-Initiative/InnoClaw&type=Date)](https://star-history.com/#SpectrAI-Initiative/InnoClaw&Date)
