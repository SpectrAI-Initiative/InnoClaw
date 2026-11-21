# InnoClaw Documentation

InnoClaw is a self-hosted research workspace. It runs only through Docker. Chat uses Tencent Cloud TokenHub DeepSeek.

Read the page that matches the job. Do not follow an older page that says `npm run dev`, `.env.local`, or PM2.

| Job | Page |
|-----|------|
| Start the app on this machine or the Ubuntu VM | [Installation](getting-started/installation.md). The in-repo Chinese note is `startup.md` |
| Volumes, backup, upgrade, container logs | [Docker](docker.md) |
| HTTPS, login limits, the administrator account | [Deployment](getting-started/deployment.md) |
| Every environment variable | [Environment Variables](getting-started/environment-variables.md) |
| What the product does | [Overview](getting-started/overview.md), then [Features](usage/features.md) |
| Change the code | Repository root `AGENTS.md`, then the development pages below |

```{toctree}
:maxdepth: 2
:caption: Getting Started

getting-started/overview
getting-started/installation
getting-started/deployment
getting-started/environment-variables
docker
```

```{toctree}
:maxdepth: 2
:caption: Usage & Features

usage/features
usage/configuration
usage/api-reference
```

```{toctree}
:maxdepth: 2
:caption: Notifications

notifications/index
```

```{toctree}
:maxdepth: 2
:caption: Development Guide

development/repository-guidelines
development/contributing
development/collaboration
development/project-structure
development/local-development
development/testing
development/agent-development
development/generic-k8s-job-scheduler
development/documentation
```

```{toctree}
:maxdepth: 2
:caption: Troubleshooting

troubleshooting/faq
```
