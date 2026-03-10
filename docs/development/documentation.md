# Documentation Development

This guide explains how to build the documentation locally, add new pages, and contribute translations.

## Prerequisites

- **Python 3.9+** installed
- **pip** package manager

## Building Docs Locally

### Install Dependencies

```bash
cd docs
pip install -r requirements.txt
```

### Build English Documentation

```bash
make html
```

The output is generated in `docs/_build/html/en/`. Open `docs/_build/html/en/index.html` in your browser.

### Build Chinese Documentation

```bash
make html-zh
```

The output is generated in `docs/_build/html/zh/`.

### Build Both Languages

```bash
make html-all
```

### Clean Build Artifacts

```bash
make clean
```

## Adding New Pages

1. **Create a Markdown file** in the appropriate directory:

   ```bash
   # Example: adding a new guide
   touch docs/usage/new-feature.md
   ```

2. **Write content** using MyST Markdown syntax:

   ```markdown
   # New Feature

   Description of the new feature.

   ## Section Title

   Content goes here.
   ```

3. **Add to the table of contents** in `docs/index.md`:

   ````markdown
   ```{toctree}
   :maxdepth: 2
   :caption: Usage & Features

   usage/features
   usage/configuration
   usage/api-reference
   usage/new-feature
   ```
   ````

4. **Build and verify** locally:

   ```bash
   make html
   ```

## MyST Markdown Syntax

InnoClaw docs use [MyST-Parser](https://myst-parser.readthedocs.io/) for Markdown support in Sphinx.

### Admonitions

```markdown
:::{note}
This is a note.
:::

:::{warning}
This is a warning.
:::

:::{tip}
This is a tip.
:::

:::{important}
This is important.
:::
```

### Mermaid Diagrams

````markdown
```{mermaid}
graph LR
    A --> B --> C
```
````

### Tables

```markdown
| Column 1 | Column 2 |
|----------|----------|
| Value 1  | Value 2  |
```

### Cross-References

```markdown
See [Installation Guide](getting-started/installation.md) for details.
```

## Translation Workflow

InnoClaw documentation uses Sphinx's built-in internationalization (i18n) with `sphinx-intl`.

### How It Works

1. English (`.md`) files are the **source of truth**
2. Sphinx extracts translatable strings into `.pot` template files
3. `sphinx-intl` generates `.po` translation files for each language
4. Translators edit the `.po` files to add translations
5. Sphinx builds the translated documentation using the `.po` files

### Updating Translations

After modifying English source files, update the translation files:

```bash
# Step 1: Extract translatable strings
make gettext

# Step 2: Update .po files for Chinese
make update-po
```

This updates `docs/locales/zh/LC_MESSAGES/*.po` files with new or changed strings.

### Editing Translations

Open the `.po` files in `docs/locales/zh/LC_MESSAGES/` with a text editor or a PO editor like [Poedit](https://poedit.net/):

```po
#: ../../getting-started/overview.md:3
msgid "What is InnoClaw?"
msgstr "什么是 InnoClaw？"
```

Each entry has:
- `msgid` — The original English text
- `msgstr` — The Chinese translation (fill this in)

### Building Translated Documentation

```bash
make html-zh
```

### Translation Checklist

- [ ] Run `make gettext` to extract strings
- [ ] Run `make update-po` to update `.po` files
- [ ] Translate all `msgstr` entries in `.po` files
- [ ] Run `make html-zh` to verify the build
- [ ] Check the output for any untranslated strings

## File Structure

```
docs/
├── conf.py                  # Sphinx configuration
├── index.md                 # Root index
├── requirements.txt         # Python dependencies
├── Makefile                 # Build commands
├── _static/                 # Custom CSS, images
├── _templates/              # Custom templates
├── getting-started/         # Getting started guides
├── usage/                   # Usage documentation
├── notifications/           # Bot integration docs
├── development/             # Developer guides
├── troubleshooting/         # FAQ and troubleshooting
└── locales/                 # Translation files
    └── zh/
        └── LC_MESSAGES/
            └── *.po         # Chinese translations
```
