---
orphan: true
---

# InnoClaw

<p align="center">
  <img src="../site/logos/20260316-112548.png" alt="InnoClaw Logo" width="200" />
</p>

<p align="center">
  <b>Eine selbst hostbare KI-Forschungsumgebung fuer dokumentenbasierten Chat, Paper-Studium, wissenschaftliche Workflows und Research Execution.</b>
</p>

<p align="center">
  <i>Auf Ihren Dateien verankert, rund um Papers organisiert und bereit fuer den Schritt zur Ausfuehrung.</i>
</p>

<p align="center">
  <a href="../LICENSE"><img src="https://img.shields.io/badge/License-Apache%202.0-blue.svg" alt="Apache 2.0 License"></a>
  <a href="../package.json"><img src="https://img.shields.io/badge/Node.js-24%2B%20(LTS)%20%7C%2025%20Current-339933?logo=node.js&logoColor=white" alt="Node.js 24+ LTS or 25 Current"></a>
  <a href="https://github.com/SpectrAI-Initiative/InnoClaw/actions/workflows/ci.yml"><img src="https://github.com/SpectrAI-Initiative/InnoClaw/actions/workflows/ci.yml/badge.svg" alt="CI Status"></a>
  <a href="https://SpectrAI-Initiative.github.io/InnoClaw/"><img src="https://img.shields.io/badge/Docs-Online-blue?logo=gitbook&logoColor=white" alt="Online Docs"></a>
  <a href="https://github.com/SpectrAI-Initiative/InnoClaw/stargazers"><img src="https://img.shields.io/github/stars/SpectrAI-Initiative/InnoClaw?style=flat&logo=github" alt="GitHub Stars"></a>
  <a href="https://github.com/SpectrAI-Initiative/InnoClaw/issues"><img src="https://img.shields.io/github/issues/SpectrAI-Initiative/InnoClaw" alt="GitHub Issues"></a>
</p>

<p align="center">
  <a href="../README.md">English</a> · <a href="README_CN.md">简体中文</a> · <a href="README_JA.md">日本語</a> · <a href="README_FR.md">Français</a> · <b>Deutsch</b>
</p>

<p align="center">
  <a href="https://SpectrAI-Initiative.github.io/InnoClaw/">Dokumentation</a> · <a href="#de-quick-start">Schnellstart</a> · <a href="#de-community-support">Community</a>
</p>

> Diese Uebersetzung kann langsamer aktualisiert werden als die englische Startseite `../README.md`. Fuer die neuesten `What's New`-Eintraege sind die englische und chinesische Seite die verlaesslichsten Quellen.

InnoClaw verwandelt serverseitige Ordner in KI-native Workspaces fuer dokumentenbasierten Chat, Paper-Studium, wissenschaftliche Workflows und Research Execution.

Es richtet sich an Forschende, Entwickler, Labore und Self-Hoster, die mehr als nur eine generische Chat-Oberflaeche wollen: zitierte Antworten auf echten Dateien, wiederverwendbare Skills und einen klaren Weg vom Lesen zur Ausfuehrung.

> Workflow: Workspace oeffnen -> Dateien in RAG synchronisieren -> Mit Quellen fragen -> Paper studieren -> Multi-Agent-Diskussion starten -> Notizen und Ideen generieren -> Remote-Forschungstasks ausfuehren

---

## 🔥 Neuigkeiten

### Letzte Updates

*Dieser Bereich wird als leichtgewichtige Uebersetzungszusammenfassung automatisch synchronisiert. Fuer die schnellsten Updates sehen Sie bitte in `../README.md` und `README_CN.md` nach.*

<!-- whats-new-start -->

#### 2026-04-02
- **Docker-Deployment-Unterstuetzung**: Dockerfile, docker-compose.yml und eine vollstaendige Docker-Deployment-Anleitung fuer selbst gehostete Produktionsumgebungen hinzugefuegt
- **200+ neue integrierte Skills**: Skill-Bibliothek erweitert um Bioinformatik, Chemoinformatik, Genomik, Physik und Drug-Discovery-Pipelines
- **Skill-Creator-Framework**: Neuer Meta-Skill mit Werkzeugen fuer Evaluierung, Benchmarking und Validierung zum Erstellen und Testen eigener Skills


#### 2026-04-01
- **Text-zu-CAD-Faehigkeit**: Neue Agenten-Faehigkeit, die natuerlichsprachige Beschreibungen mit CadQuery in 3D-CAD-Modelle (STL/STEP) umwandelt, mit automatischer Einrichtung der Umgebung
- **Arbeitsbereich-Bildauswahl**: Neues Dialog-UI im Agenten-Panel zum Durchsuchen und Auswaehlen von Bildern aus dem Arbeitsbereich zum Anhaengen an Konversationen



<details>
<summary>Aeltere Updates anzeigen</summary>

#### 2026-03-31
- **Eingefuegte Bilder unterstuetzt**: Benutzer koennen Bilder jetzt direkt in die Chat-Eingabe einfuegen fuer multimodale KI-Konversationen
- **Deep-Research-Rollenstudio**: Das neue Rollenstudio-Panel ermoeglicht das Konfigurieren und Verwalten benutzerdefinierter Forscherrollen im Deep-Research-Workflow
- **Erweiterte Quellen fuer die Artikelsuche**: BioRxiv, PubMed und PubChem wurden als durchsuchbare Artikelquellen in Paper Study hinzugefuegt




#### 2026-03-26
- **Dynamische Modellerkennung**: Das Agenten-Panel ruft verfuegbare Modelle automatisch von jedem konfigurierten KI-Anbieter ab und fuegt sie mit der eingebauten Liste zusammen
- **Modellspezifisches Base-URL-Routing**: Chinesische KI-Anbieter (shlab, qwen, moonshot, deepseek, minimax, zhipu) unterstuetzen `<PROVIDER>_<MODEL>_BASE_URL`-Umgebungsvariablen fuer flexibles Endpunkt-Routing
- **Laufzeit-Umschalter fuer Tool-Aufruf**: Tool-Unterstuetzung kann per Anbieter ueber `<PROVIDER>_TOOLS_ENABLED=true/false` ohne Codeaenderungen aktiviert oder deaktiviert werden





#### 2026-03-24
- **Multimodaler LLM-Support**: Papierrecherche und Agenten-Workflows unterstuetzen jetzt Standard-LLMs und multimodale LLMs (mLLM), kontextbezogen auswaehlbar in den Einstellungen und der Modellauswahl.






#### 2026-03-23
- **GitHub-Faehigkeiten Import-Vorschau**: Neuer Vorschau-Workflow vor dem Import ermoeglicht das Durchsuchen, Pruefen und selektive Importieren von Faehigkeiten aus GitHub-Repositories







#### 2026-03-22
- **Obsidian-Notizexport**: Generieren Sie strukturierte, Obsidian-kompatible Notizen mit reichhaltigem YAML-Frontmatter, Abbildungen und Wikilinks direkt aus dem Paper-Studienpanel
- **Modellauswahl pro Aufgabe**: Eine neue Modellauswahl-UI-Komponente erlaubt es Nutzern, das Standard-KI-Modell fuer einzelne Paper-Studienaufgaben (Zusammenfassung, Kritik, Notizen usw.) zu ueberschreiben
- **Notiz-Diskussionsansicht**: Neue ganzseitige Diskussionsansicht fuer Paper-Notizen, die gebuendelte KI-gestuetzte Gespraeche rund um generierten Notizinhalt ermoeglichen








#### 2026-03-21
- **Entfernte HPC/SLURM-Ausfuehrung**: Tiefe Recherche-Sitzungen koennen jetzt ueber SSH auf entfernten Clustern ausgefuehrt werden, mit Unterstuetzung fuer rjob, rlaunch und SLURM sowie Datei-Staging und Job-Lifecycle-Verwaltung
- **Kubernetes-Cluster-Konfigurationsoberflaeche**: Neues Einstellungspanel zur Laufzeitkonfiguration von K8s-Kontexten, PVC-Bindungen und Container-Images in Multi-Cluster-Umgebungen ohne Neustart
- **Entfernte Profil-Bindung**: Tiefe Recherche-Sitzungen koennen an vorkonfigurierte SSH/Remote-Rechenprofile gebunden werden, was reproduzierbare verteilte Forschungs-Workflows ermoeglicht










#### 2026-03-20
- **Tiefenforschungsmodul**: Vollstaendige KI-gesteuerte wissenschaftliche Forschungs-Pipeline mit Mehrphasen-Orchestrierung, Gutachter-Diskussion, Ausfuehrungsplanung und Workflow-Grafik-Oberflaeche
- **Ausfuehrungs-Pipeline**: Automatisiertes System zur Experimentausfuehrung mit Slurm-Job-Uebermittlung, Datensatzverwaltung, Vorverarbeitung und Unterstuetzung fuer entfernte Ausfuehrer











#### 2026-03-19
- **ClawHub-Skill-Import**: Neue Integration zum direkten Importieren von Skills aus ClawHub ueber einen dedizierten API-Endpunkt und einen Import-Dialog
- **Code-Vorschaufenster**: Neue In-Editor-Komponente fuer die Code-Vorschau mit Syntaxhervorhebung und Verfolgung des Speicherstatus
- **Paper-Studie-Cache**: Persistente Caching-Schicht fuer Paper-Studien-Sitzungen zur Verbesserung der Neulade-Performance und Zustandskontinuitaet












</details>


<!-- whats-new-end -->

---

## 🧭 Was ist InnoClaw?

InnoClaw ist eine selbst hostbare Web-App fuer forschungsorientierte Wissensarbeit. Sie kombiniert Workspace-Verwaltung, RAG-Chat, Paper-Suche und -Review, wiederverwendbare wissenschaftliche Skills und agentenbasierte Ausfuehrung an einem Ort.

Anstatt zwischen Dateibrowser, Notiztool, Paper-Reader und Automatisierungskonsole zu wechseln, behalten Sie den Ablauf in einem einzigen Workspace: Ordner oeffnen, Inhalte synchronisieren, fundierte Fragen stellen, Papers lesen und mehrstufige Forschungstasks ausfuehren.

## ✨ Warum InnoClaw

- **Workspace-first** - Serverordner als dauerhafte Forschungs-Workspaces mit Dateien, Notizen, Chatverlauf und Execution-Kontext nutzen
- **Fundierte KI-Antworten** - RAG-gestuetzte Antworten mit Quellenangaben ueber eigene Dokumente und eigenen Code erhalten
- **Forschungsnahe Workflows** - Papers studieren, strukturierte Multi-Agent-Diskussionen fuehren und neue Richtungen aus Literatur ableiten
- **Wissenschaftliche Skills integriert** - 206 SCP-Science-Skills aus Bereichen wie Drug Discovery, Genomics und Protein Science importieren und nutzen
- **Nicht nur Konversation, sondern Execution** - Von Lesen und Planung zu Job-Einreichung, Monitoring, Ergebnissammlung und naechsten Empfehlungen gelangen
- **Self-hosted und multi-modellfreundlich** - Mit OpenAI, Anthropic, Gemini und kompatiblen Endpunkten betreibbar

<a id="de-quick-start"></a>

## 🚀 Schnellstart

```bash
git clone https://github.com/SpectrAI-Initiative/InnoClaw.git
cd InnoClaw
npm install
npm run dev
```

- `http://localhost:3000` oeffnen
- Einen KI-Provider auf der Settings-Seite konfigurieren
- Workspace oeffnen oder clonen und dann `Sync` klicken, um den RAG-Index aufzubauen
- OS-spezifische Voraussetzungen und Produktions-Deployment finden Sie in `getting-started/installation.md`

## 🛠️ Was Sie damit tun koennen

- Mit lokalen Dateien und Code auf Basis von Quellenangaben chatten
- Papers in einem Workspace suchen, zusammenfassen und pruefen
- Strukturierte 5-Rollen-Diskussionen fuer Kritik und Reproduzierbarkeit ausfuehren
- Zusammenfassungen, FAQs, Briefings, Timelines und Forschungsideen erzeugen
- Wissenschaftliche Skills importieren und wiederverwendbare Domain-Workflows starten
- Remote-Forschungstasks mit Freigabegates, Monitoring und Ergebnisanalyse verwalten

## 🗺️ Waehlen Sie Ihren Einstieg

| Wenn Sie ... wollen | Starten Sie hier | Danach passiert Folgendes |
|---------------------|------------------|----------------------------|
| Mit eigenen Dateien sprechen | **Workspace + RAG-Chat** | Ordner oeffnen, `Sync` klicken und zitierte Fragen stellen |
| Papers lesen und aufschluesseln | **Paper-Studium** | Papers suchen, zusammenfassen und direkt zu Diskussion oder Notizen wechseln |
| Ideen aus mehreren Blickwinkeln pruefen | **Multi-Agent-Diskussion** | Rollenbasierte Reviews fuer Kritik, Evidenzsammlung und Reproduzierbarkeit starten |
| Aus Lektuere neue Richtungen ableiten | **Research Ideation** | Richtungen erzeugen, Optionen vergleichen und Ausgaben in Notizen speichern |
| Forschung auf Remote-Infrastruktur ausfuehren | **Research Execution Workspace** | Code pruefen, Aenderungen freigeben, Jobs absenden, Laeufe ueberwachen und Ergebnisse einsammeln |

## 🧩 Wie alles zusammenspielt

| Ebene | Rolle im Workflow |
|-------|--------------------|
| **Workspace** | Haelt Dateien, Notizen, Sitzungskontext und Projektstatus |
| **Wissen** | Synchronisiert Dateien in den RAG-Index, damit Antworten fundiert bleiben |
| **Paper-Workbench** | Uebernimmt Literatursuche, Zusammenfassung, Diskussion und Ideation |
| **Skills** | Ergaenzt wiederverwendbare Domain-Workflows und toolgestuetzte Faehigkeiten |
| **Execution** | Erweitert den Workflow auf Remote-Jobs und Experiment-Schleifen |

## 🔄 Kern-Workflows

### 📄 Paper-Studium

Literatur suchen, Papers voransichten, zusammenfassen und direkt in Diskussion oder Ideation uebergehen.

- Mehrquellen-Suche in einer UI
- KI-gestuetzte Query-Expansion fuer breitere Abdeckung
- Paper-Previews ohne Verlassen des Workspace-Kontexts
- Ausgaben zur Wiederverwendung in Notizen speichern

### 🧠 Multi-Agent-Diskussion

Ein strukturiertes Paper-Review mit Rollen wie Moderator, Literature Specialist, Skeptic, Reproducer und Scribe durchfuehren.

- Deterministischer, stufenweiser Diskussionsfluss
- Vergleich von Evidenz, Methoden, Grenzen und Reproduzierbarkeitsfragen
- Review-Aufzeichnungen, die leichter zu scannen sind als freier Chat
- Nutzung des Volltexts fuer tiefere Analyse

### 🧪 Research Execution Workspace

Von Code-Inspektion ueber Job-Einreichung bis zur Ergebnisanalyse in einem gefuehrten Ablauf arbeiten.

- Repositories mit Agent-Unterstuetzung pruefen und Patches vorschlagen
- Explizite Freigabepunkte fuer risikoreiche Schritte setzen
- Jobs ueber Shell, Slurm oder `rjob` absenden
- Status ueberwachen, Artefakte sammeln und naechste Empfehlungen erzeugen

## 📦 Funktionsueberblick

| Funktion | Was sie ermoeglicht |
|----------|----------------------|
| Workspace-Verwaltung | Serverordner als persistente KI-Workspaces abbilden |
| Dateibrowser | Dateien browsen, hochladen, erstellen, bearbeiten, previewen und synchronisieren |
| RAG-Chat | Fundierte Fragen ueber indexierte Dateien mit Quellenangaben stellen |
| Paper-Studium | Papers an einem Ort suchen, zusammenfassen und inspizieren |
| Diskussionsmodus | Strukturierte Multi-Rollen-Paper-Diskussionen ausfuehren |
| Research Ideation | Neue Richtungen und fachuebergreifende Ideen generieren |
| Skill-System | Wiederverwendbare wissenschaftliche Skills und Workflows importieren |
| Research Execution | Remote-Experiment-Schleifen mit Monitoring und Freigabegates orchestrieren |
| Multi-Agent-Sessions | Getrennte Execution-Kontexte ueber Tabs und Projekte hinweg behalten |
| Multi-LLM-Support | OpenAI, Anthropic, Gemini und kompatible Endpunkte nutzen |

## 📚 Dokumentation

- **Hier anfangen** - [Overview](getting-started/overview.md), [Installation](getting-started/installation.md)
- **Konfigurieren und deployen** - [Deployment](getting-started/deployment.md), [Environment Variables](getting-started/environment-variables.md), [Configuration](usage/configuration.md)
- **Produkt nutzen** - [Features](usage/features.md), [API Reference](usage/api-reference.md)
- **Fehler beheben und beitragen** - [Troubleshooting](troubleshooting/faq.md), [Development Guide](development/contributing.md)

<a id="de-community-support"></a>

## 💬 Community und Support

- **Hilfe bei Setup oder Nutzung noetig?** Starten Sie mit der Dokumentation: https://SpectrAI-Initiative.github.io/InnoClaw/
- **Bug gefunden oder Feature-Wunsch?** Erstellen Sie ein Issue: https://github.com/SpectrAI-Initiative/InnoClaw/issues
- **Direkten Austausch gesucht?** Die Feishu-Community finden Sie in `README_CN.md`

## ℹ️ Projektinfos

- **Lizenz** - Apache-2.0, siehe `../LICENSE`
- **Repository** - https://github.com/SpectrAI-Initiative/InnoClaw
- **Dokumentation** - https://SpectrAI-Initiative.github.io/InnoClaw/

## ⭐ Star-Verlauf

[![Star History Chart](https://api.star-history.com/svg?repos=SpectrAI-Initiative/InnoClaw&type=Date)](https://star-history.com/#SpectrAI-Initiative/InnoClaw&Date)
