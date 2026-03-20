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
  <a href="../package.json"><img src="https://img.shields.io/badge/Node.js-20%2B-339933?logo=node.js&logoColor=white" alt="Node.js 20+"></a>
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

#### 2026-03-20
- **Tiefenforschungsmodul**: Vollstaendige KI-gesteuerte wissenschaftliche Forschungs-Pipeline mit Mehrphasen-Orchestrierung, Gutachter-Diskussion, Ausfuehrungsplanung und Workflow-Grafik-Oberflaeche
- **Ausfuehrungs-Pipeline**: Automatisiertes System zur Experimentausfuehrung mit Slurm-Job-Uebermittlung, Datensatzverwaltung, Vorverarbeitung und Unterstuetzung fuer entfernte Ausfuehrer


#### 2026-03-19
- **ClawHub-Skill-Import**: Neue Integration zum direkten Importieren von Skills aus ClawHub ueber einen dedizierten API-Endpunkt und einen Import-Dialog
- **Code-Vorschaufenster**: Neue In-Editor-Komponente fuer die Code-Vorschau mit Syntaxhervorhebung und Verfolgung des Speicherstatus
- **Paper-Studie-Cache**: Persistente Caching-Schicht fuer Paper-Studien-Sitzungen zur Verbesserung der Neulade-Performance und Zustandskontinuitaet



#### 2026-03-18
- **Multimodale Bildanalyse fuer Papierauswertung**: PDF-Bilder werden jetzt waehrend Diskussions- und Forschungsideensitzungen visuell extrahiert und analysiert
- **Claude Code Skills-Integration**: Importieren Sie Skills direkt aus lokalen Ordnern oder Claude Code-Projekten ueber einen neuen dedizierten Import-Workflow




#### 2026-03-18
- **Multimodale Vision fuer Paper-Diskussion und Ideation**: Vision-faehige Anbieter erhalten jetzt extrahierte PDF-Seitenbilder zusammen mit Text, damit Agents Abbildungen, Tabellen und Diagramme direkt analysieren koennen.
- **Paper-Seitengalerie-UI**: Die Discussion- und Ideation-Panels zeigen jetzt eine einklappbare Miniaturgalerie der extrahierten Paper-Seiten mit Grossansicht im Dialog.
- **Erkennung der Vision-Faehigkeit von Anbietern**: Provider-Konfigurationen enthalten jetzt Vision-Support, sodass Routen automatisch zwischen multimodalem und rein textbasiertem Kontext wechseln koennen.




#### 2026-03-17
- **Remote-Job-Profilverwaltung und SSH-Haertung**: sichere Erstellung, Bearbeitung und SSH-gehaertete Einreichung von Forschungsjobs auf Remote-Systemen
- **Rich Markdown Rendering im Agent Panel**: Agent-Nachrichten rendern jetzt Tabellen, LaTeX-Mathematik und syntaxhervorgehobene Codebloecke
- **API-Provider-Settings-UI**: API-Keys und Endpunkte fuer KI-Provider direkt auf der Settings-Seite konfigurieren




#### 2026-03-17
- **rjob-Profilkonfiguration und sichere Einreichung**: Remote-Profile speichern vollstaendige rjob-Defaults wie image, GPU, CPU, memory, mounts, charged-group, private-machine, env vars, host-network und example commands. `submitRemoteJob` baut den rjob-Befehl intern aus der gespeicherten Konfiguration auf, sodass der Agent kritische Flags wie `--charged-group` oder `--image` nicht veraendern kann. Auch der SSH-Transport wurde mit `-o StrictHostKeyChecking=no -tt`, dem Laden des Init-Skripts und korrektem Quoting verhaertet.
- **Profilbearbeitung**: Der Edit-Button im Remotes-Tab laedt vorhandene Profile inklusive aller rjob-Felder zur Aktualisierung in das Formular.
- **Direkter Job-Submission-Shortcut**: Im Agent-Long-Modus koennen einfache Job-Einreichungen inspect/patch/sync ueberspringen und dem Ablauf `listRemoteProfiles -> prepareJobSubmission -> approval -> submitRemoteJob` folgen.




#### 2026-03-16
- **Robustheit fuer Paper-Diskussion und Ideation**: 2-2.5x hoeheres Token-Budget pro Rolle, automatische Wiederholung bei leeren oder zu kurzen Antworten und sichtbare Fehler in der UI
- **Vollstaendiger Paper-Kontext**: Discussion- und Ideation-Agents erhalten bis zu 30k Zeichen des lokalen Volltexts statt nur des Abstracts
- **Abstract-Extraktion korrigiert**: heuristische Regex-Extraktion und verbesserter KI-Prompt verhindern, dass Autorennamen als Abstract erkannt werden




#### 2026-03-14
- **Research Execution Engine**: neues KI-gesteuertes Forschungsorchestrierungssystem mit Remote-Profilen, Capability-Toggles, Laufhistorie und Agent-Tools
- **Automatisch aktualisierter README-Bereich "What's New"**: GitHub-Actions-Workflow, der wichtige neue Features taeglich erkennt und in die README eintraegt







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
