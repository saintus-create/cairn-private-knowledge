# Security Policy

Cairn is an evidence-first private knowledge application. Security issues involving authentication, authorization, private documents, storage access, secrets, prompt injection, data isolation, or CI/CD supply-chain behavior should be treated as high priority.

## Reporting

Please do not disclose suspected vulnerabilities in a public issue. Report them privately through the repository's GitHub security reporting mechanism when available.

Include:

- affected component or path;
- reproduction steps or proof of concept;
- expected versus observed behavior;
- whether private data, credentials, or cross-user access are involved; and
- any known mitigation.

## Security requirements

- Never commit credentials, service-role keys, database passwords, or model-provider API keys.
- Supabase service-role credentials are server-only and must never be exposed to browser code.
- Private knowledge objects must remain in private storage and be accessed through authorized requests or short-lived signed URLs.
- Authorization must be enforced server-side; UI visibility is not an authorization boundary.
- Database changes must be represented by version-controlled migrations before production deployment.
- GitHub Actions must use least-privilege permissions and immutable action references where practical.
- New infrastructure dependencies must have an explicit owner and a documented reason for inclusion.

## AI-specific security

Cairn's model output is not authoritative evidence. Retrieved source material and provenance remain the source of truth. Prompt injection or untrusted document content must never be allowed to override application authorization, expose secrets, or bypass evidence boundaries.
