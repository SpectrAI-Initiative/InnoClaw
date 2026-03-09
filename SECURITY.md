# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 0.1.x   | :white_check_mark: |

## Reporting a Vulnerability

We take the security of InnoClaw seriously. If you discover a security vulnerability, please report it responsibly.

**Please do NOT report security vulnerabilities through public GitHub issues.**

Instead, please use one of the following methods:

1. **GitHub Security Advisories** (Preferred): Use the "Report a vulnerability" button on the Security tab of our GitHub repository to create a private security advisory.

2. **Email**: Contact the maintainers directly through the email addresses listed in their GitHub profiles.

### What to Include

When reporting a vulnerability, please include:

- A description of the vulnerability and its potential impact
- Steps to reproduce the issue
- Any proof-of-concept code (if applicable)
- The version(s) of InnoClaw affected
- Your suggested fix (if any)

### Response Timeline

- **Acknowledgment**: We will acknowledge receipt of your report within 48 hours.
- **Assessment**: We will provide an initial assessment within 7 days.
- **Resolution**: We aim to release a fix within 30 days for critical vulnerabilities.

### Disclosure Policy

- We follow a coordinated disclosure process.
- We will credit reporters in the security advisory (unless they prefer to remain anonymous).
- Please allow us reasonable time to address the vulnerability before any public disclosure.

## Security Best Practices for Deployment

When deploying InnoClaw, please follow these security practices:

1. **Environment Variables**: Never commit `.env` files or API keys to version control. Use `.env.example` as a reference template.
2. **API Keys**: Rotate your API keys regularly and use the minimum required permissions.
3. **Network**: When deploying in production, use a reverse proxy (Nginx/Caddy) with HTTPS enabled.
4. **Database**: The SQLite database file contains user data. Ensure appropriate file system permissions.
5. **Access Control**: Restrict `WORKSPACE_ROOTS` to only the directories that need to be accessible.
