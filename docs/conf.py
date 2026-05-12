import sys

# Configuration file for the Sphinx documentation builder.
#
# For the full list of built-in configuration values, see the documentation:
# https://www.sphinx-doc.org/en/master/usage/configuration.html

# -- Project information -----------------------------------------------------
project = "InnoClaw"
copyright = "2025, InnoClaw Contributors"
author = "InnoClaw Contributors"

# -- General configuration ---------------------------------------------------
extensions = [
    "myst_parser",
    "sphinxcontrib.mermaid",
    "sphinx_copybutton",
]

# MyST-Parser configuration
myst_enable_extensions = [
    "colon_fence",
    "deflist",
    "fieldlist",
    "tasklist",
]
myst_heading_anchors = 3

# Source file suffixes
source_suffix = {
    ".md": "markdown",
}
templates_path = ["_templates"]

# The master toctree document
master_doc = "index"

# Internationalization
language = "en"
locale_dirs = ["locales/"]
gettext_compact = False
gettext_uuid = True

# Exclude patterns
exclude_patterns = ["_build", "Thumbs.db", ".DS_Store"]

# -- Options for HTML output -------------------------------------------------
html_theme = "shibuya"

is_zh = str(language).lower().startswith("zh") or any(
    arg.lower() == "language=zh_cn" for arg in sys.argv
)

html_theme_options = {
    "github_url": "https://github.com/SpectrAI-Initiative/InnoClaw",
    "nav_links": (
        [
            {"title": "快速入门", "url": "getting-started/overview"},
            {"title": "使用", "url": "usage/features"},
            {"title": "开发", "url": "development/contributing"},
        ]
        if is_zh
        else [
            {"title": "Getting Started", "url": "getting-started/overview"},
            {"title": "Usage", "url": "usage/features"},
            {"title": "Development", "url": "development/contributing"},
        ]
    ),
}

html_baseurl = "https://SpectrAI-Initiative.github.io/InnoClaw/"

html_context = {
    "languages": [
        ("English", "/InnoClaw/en/"),
        ("简体中文", "/InnoClaw/zh/"),
    ],
}

html_static_path = ["_static"]
html_css_files = ["custom.css"]
html_title = "InnoClaw 文档" if is_zh else "InnoClaw Documentation"

# -- Options for linkcheck ---------------------------------------------------
linkcheck_ignore = [
    r"https://github\.com/SpectrAI-Initiative/InnoClaw/(issues|pulls|actions)",
]

# -- Options for sphinxcontrib-mermaid ---------------------------------------
mermaid_version = "11"
