---
on:
  schedule: daily
  workflow_dispatch:

permissions:
  contents: read
  issues: read
  pull-requests: read
  copilot-requests: write

network: defaults

safe-outputs:
  create-pull-request:

---
# Cairn maintenance agent

Work on the repository as an autonomous maintenance agent.

Preserve Cairn's existing architecture and scope. Do not introduce authentication, user accounts, database migrations, storage migrations, or unrelated infrastructure rewrites unless a concrete failing build or security issue requires one.

Inspect the current repository, CI status, open issues and recent changes. Identify the highest-value blocking engineering work. Implement only changes that are justified by the current code and tests. Run the project's typecheck, tests, and build when available. Do not fabricate successful verification.

If meaningful fixes are required, prepare a pull request containing the changes and a concise summary of verification. If there is no worthwhile work, make no changes.

Prioritize a working, independent conversational AI for Cairn: existing knowledge retrieval, an independent model provider, conversational responses, and evidence/source attribution. Keep provider integration replaceable and avoid unnecessary paid infrastructure.
