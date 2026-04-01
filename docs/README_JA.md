# InnoClaw

<p align="center">
  <img src="../site/logos/20260316-112548.png" alt="InnoClaw Logo" width="200" />
</p>

<p align="center">
  <b>文書に根ざした対話、論文読解、科学ワークフロー、研究実行のためのセルフホスト可能な AI 研究ワークスペース。</b>
</p>

<p align="center">
  <i>あなたのファイルを根拠に、論文を中心に整理し、そのまま実行へ進めます。</i>
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
  <a href="../README.md">English</a> · <a href="README_CN.md">简体中文</a> · <b>日本語</b> · <a href="README_FR.md">Français</a> · <a href="README_DE.md">Deutsch</a>
</p>

<p align="center">
  <a href="https://SpectrAI-Initiative.github.io/InnoClaw/">ドキュメント</a> · <a href="#ja-quick-start">クイックスタート</a> · <a href="#ja-community-support">コミュニティ</a>
</p>

> この翻訳ページは英語版ホームページ `../README.md` より更新が遅れる場合があります。最新の `What's New` は英語版と中国語版が最も確実です。

InnoClaw はサーバー上のフォルダを、文書に根ざした対話、論文読解、科学ワークフロー、研究実行のための AI ネイティブなワークスペースに変えます。

研究者、開発者、研究室チーム、セルフホスト派のために設計されており、単なるチャット UI ではなく、実ファイルに基づく回答、再利用可能なスキル、そして読解から実行までつながる流れを提供します。

> ワークフロー：ワークスペースを開く -> ファイルを RAG に同期 -> 根拠付きで質問する -> 論文を読む -> マルチエージェント討論を行う -> ノートとアイデアを生成する -> リモート研究タスクを実行する

---

## 🔥 新着情報

### 最新アップデート

*この欄は軽量な翻訳要約として自動同期されます。最速の更新は `../README.md` と `README_CN.md` を参照してください。*

<!-- whats-new-start -->

#### 2026-03-31
- **画像貼り付けサポート**: チャット入力欄に画像を直接貼り付けて、マルチモーダルAI会話が可能になりました
- **ディープリサーチ・ロールスタジオ**: 新しいロールスタジオパネルで、深度研究ワークフローのカスタム研究者ロールを設定・管理できます
- **論文検索ソースの拡張**: Paper StudyにBioRxiv、PubMed、PubChemが検索可能な論文ソースとして追加されました


#### 2026-03-26
- **動的モデル検出**: エージェントパネルが各AIプロバイダーから利用可能なモデルを自動取得し、組み込みリストとマージして表示
- **モデル別 Base URL ルーティング**: 中国系AIプロバイダー（shlab、qwen、moonshot、deepseek、minimax、zhipu）で `<PROVIDER>_<MODEL>_BASE_URL` 環境変数によるモデル単位のエンドポイント設定が可能に
- **実行時ツール呼び出し切り替え**: `<PROVIDER>_TOOLS_ENABLED=true/false` 環境変数でプロバイダーごとのツール呼び出しをコード変更なしに動的に切り替え可能



<details>
<summary>以前の更新を表示</summary>

#### 2026-03-24
- **マルチモーダルLLMサポート**: 論文研究とエージェントワークフローで、標準LLMとマルチモーダルLLM（mLLM）の両方をサポート。設定およびモデルセレクターでコンテキストごとに切り替え可能。




#### 2026-03-23
- **GitHub スキルインポートプレビュー**: インポート前に GitHub リポジトリのスキルを閲覧・確認し、選択してインポートできる新しいプレビューワークフローを追加





#### 2026-03-22
- **Obsidian ノートエクスポート**: 論文スタディパネルから、豊富な YAML フロントマター・図・ウィキリンクを含む構造化された Obsidian 互換ノートを直接生成
- **タスク別モデル選択**: 新しいモデルセレクター UI により、論文スタディの各タスク（要約・批評・ノートなど）ごとにデフォルト AI モデルを個別に上書き可能
- **ノートディスカッションビュー**: 論文ノート用の全画面ディスカッションビューを新設し、生成されたノート内容を中心としたスレッド形式の AI 支援会話を実現






#### 2026-03-21
- **リモート HPC/SLURM 実行**: 深層調査セッションが SSH 経由でリモートクラスターで実行可能に。rjob、rlaunch、SLURM スケジューラーに対応し、ファイル転送とジョブライフサイクル管理をサポート
- **Kubernetes クラスター設定 UI**: K8s コンテキスト、PVC バインディング、コンテナイメージをマルチクラスター環境で再起動なしに動的設定できる新しい設定パネル
- **リモートプロファイルバインディング**: 深層調査セッションを事前設定済みの SSH/リモート計算プロファイルに紐付け、再現可能な分散型研究ワークフローを実現








#### 2026-03-20
- **深層リサーチモジュール**: 多段階オーケストレーション、レビュアー討議、実行計画、ワークフローグラフUIを備えた完全AI驱動の科学研究パイプライン
- **実行パイプライン**: Slurmジョブ送信、データセット管理、前処理、リモート実行器をサポートする自動化実験実行システム









#### 2026-03-19
- **ClawHub スキルインポート**: ClawHub から専用 API エンドポイントとインポートダイアログを通じて、スキルを直接インポートできる新しい連携機能
- **コードプレビューパネル**: シンタックスハイライトと保存状態のトラッキングに対応した、エディタ内コードプレビューコンポーネントを新規追加
- **論文学習キャッシュ**: 論文学習セッションの永続的なキャッシュ層を追加し、再読み込みのパフォーマンスと状態の継続性を向上










#### 2026-03-18
- **論文分析のマルチモーダルビジョン**: 論文ディスカッションおよびリサーチアイデア出しセッション中に、PDF 画像を抽出してビジュアル分析できるようになりました
- **Claude Code スキル統合**: 新しい専用インポートワークフローにより、ローカルフォルダーまたは Claude Code プロジェクトからスキルを直接インポートできます











#### 2026-03-18
- **論文討論とアイデア生成のマルチモーダル視覚対応**: 視覚対応プロバイダーでは、抽出した PDF ページ画像が本文テキストと一緒に渡され、図、表、ダイアグラムを直接解析できます。
- **論文ページギャラリー UI**: Discussion と Ideation パネルに折りたたみ式のページ縮略图库が追加され、クリックで大きなプレビューを表示できます。
- **プロバイダーの視覚能力検出**: プロバイダー設定に視覚対応フラグが追加され、ルート側でマルチモーダル入力とテキスト入力を自動的に切り替えます。











</details>


<!-- whats-new-end -->

---

## 🧭 InnoClaw とは？

InnoClaw は研究中心の知識作業向けセルフホスト型 Web アプリです。ワークスペース管理、RAG チャット、論文検索とレビュー、再利用可能な科学スキル、Agent ベースの実行機能を 1 つにまとめています。

ファイルブラウザ、ノートツール、論文リーダー、自動化コンソールを行き来する代わりに、1 つのワークスペースでフォルダを開き、内容を同期し、根拠付きで質問し、論文を読み、多段階の研究タスクを進められます。

## ✨ なぜ InnoClaw か

- **ワークスペース中心** - サーバーフォルダを、ファイル、ノート、会話履歴、実行コンテキストを持つ持続的な研究ワークスペースとして扱えます
- **根拠のある AI 回答** - 自分の文書やコードに対して、引用付きの RAG ベース回答を得られます
- **研究向けワークフロー** - 論文読解、構造化されたマルチエージェント討論、文献からの新方向生成を行えます
- **科学スキルを内蔵** - 創薬、ゲノミクス、タンパク質科学などにまたがる 206 個の SCP 科学スキルを導入・活用できます
- **会話だけで終わらない** - 読解や計画から、ジョブ送信、監視、結果収集、次の提案へ進めます
- **セルフホストと多モデルに対応** - OpenAI、Anthropic、Gemini、および互換エンドポイントで動作します

<a id="ja-quick-start"></a>

## 🚀 クイックスタート

```bash
git clone https://github.com/SpectrAI-Initiative/InnoClaw.git
cd InnoClaw
npm install
npm run dev
```

- `http://localhost:3000` を開く
- Settings ページで AI プロバイダーを 1 つ設定する
- ワークスペースを開くか clone したら `Sync` を押して RAG インデックスを作成する
- OS ごとの前提条件や本番デプロイは `getting-started/installation.md` を参照

## 🛠️ できること

- ローカルのファイルやコードに対して、引用付きで質問できる
- 1 つのワークスペースで論文を検索、要約、レビューできる
- 批判的検討や再現性の視点を含む 5 役の構造化討論を実行できる
- 要約、FAQ、ブリーフ、タイムライン、研究アイデアを生成できる
- 科学スキルを読み込み、再利用可能なドメインワークフローを起動できる
- 承認ゲート、監視、結果分析付きで研究タスクを管理できる

## 🗺️ 始め方を選ぶ

| やりたいこと | 入口 | その後の流れ |
|--------------|------|--------------|
| 自分のファイルと対話したい | **ワークスペース + RAG チャット** | フォルダを開いて `Sync` を押し、引用付きで質問する |
| 論文を読み解きたい | **論文読解** | 論文を検索して要約し、そのまま討論やノートに進む |
| 多角的にアイデアを検証したい | **マルチエージェント討論** | 役割ベースのレビューで批判、根拠収集、再現性検討を行う |
| 読解から新しい方向を作りたい | **研究アイデア生成** | 方向性を生成し、選択肢を比較してノートへ保存する |
| リモート環境で研究作業を実行したい | **研究実行ワークスペース** | コード確認、変更承認、ジョブ送信、監視、結果回収まで進める |

## 🧩 全体のつながり

| 層 | ワークフローでの役割 |
|----|----------------------|
| **ワークスペース** | ファイル、ノート、会話コンテキスト、プロジェクト状態を保持 |
| **ナレッジ** | ファイルを RAG インデックスへ同期し、回答を根拠付きにする |
| **論文ワークベンチ** | 文献検索、要約、討論、アイデア生成を担当 |
| **スキル** | 再利用可能なドメインワークフローとツール指向の能力を追加 |
| **実行** | ワークフローをリモートジョブや実験ループへ拡張 |

## 🔄 主要ワークフロー

### 📄 論文読解

文献を検索し、論文をプレビューし、要約したあと、そのまま討論やアイデア生成へ進めます。

- 1 つの UI から複数ソースを検索
- AI によるクエリ拡張で探索範囲を広げる
- ワークスペースを離れずに論文プレビューを開く
- 出力をノートへ保存して再利用

### 🧠 マルチエージェント討論

モデレーター、リテラチャー担当、懐疑派、再現担当、記録担当などの役割で構造化レビューを行います。

- 決められた段階的フローで討論
- 根拠、手法、限界、再現性の懸念を比較
- 自由形式のチャットより追いやすいレビュー記録を生成
- 論文全文コンテキストでより深い分析を実施

### 🧪 研究実行ワークスペース

コード確認からジョブ送信、結果分析までをガイド付きの流れで進めます。

- Agent 支援でリポジトリを確認し、パッチを提案
- 高リスクな手順には明示的な承認チェックポイントを設置
- Shell、Slurm、`rjob` バックエンドでジョブを送信
- 状態監視、成果物回収、次の提案を実施

## 📦 機能概要

| 機能 | できること |
|------|------------|
| ワークスペース管理 | サーバーフォルダを持続的な AI ワークスペースとして扱う |
| ファイルブラウザ | 閲覧、アップロード、作成、編集、プレビュー、同期 |
| RAG チャット | インデックス済みファイルに対する引用付き質問応答 |
| 論文読解 | 論文の検索、要約、確認を 1 か所で実施 |
| 討論モード | 構造化された多役割の論文討論を実行 |
| 研究アイデア生成 | 新方向や分野横断のアイデアを生成 |
| スキルシステム | 再利用可能な科学スキルとワークフローを導入 |
| 研究実行 | 承認ゲートと監視付きで実験ループを実行 |
| マルチエージェントセッション | タブやプロジェクトごとに独立した実行コンテキストを保持 |
| マルチ LLM 対応 | OpenAI、Anthropic、Gemini、互換エンドポイントを利用 |

## 📚 ドキュメント

- **ここから始める** - [Overview](getting-started/overview.md), [Installation](getting-started/installation.md)
- **設定とデプロイ** - [Deployment](getting-started/deployment.md), [Environment Variables](getting-started/environment-variables.md), [Configuration](usage/configuration.md)
- **使い方** - [Features](usage/features.md), [API Reference](usage/api-reference.md)
- **トラブル対応と開発** - [Troubleshooting](troubleshooting/faq.md), [Development Guide](development/contributing.md)

<a id="ja-community-support"></a>

## 💬 コミュニティとサポート

- **セットアップや使い方で困ったら？** まずは https://SpectrAI-Initiative.github.io/InnoClaw/ のドキュメントを確認
- **バグ報告や機能提案をしたい？** https://github.com/SpectrAI-Initiative/InnoClaw/issues を利用
- **直接話したい？** 中国語版ページ `README_CN.md` の Feishu コミュニティを参照

## ℹ️ プロジェクト情報

- **ライセンス** - Apache-2.0、詳しくは `../LICENSE` を参照
- **リポジトリ** - https://github.com/SpectrAI-Initiative/InnoClaw
- **ドキュメント** - https://SpectrAI-Initiative.github.io/InnoClaw/

## ⭐ スター履歴

[![Star History Chart](https://api.star-history.com/svg?repos=SpectrAI-Initiative/InnoClaw&type=Date)](https://star-history.com/#SpectrAI-Initiative/InnoClaw&Date)
