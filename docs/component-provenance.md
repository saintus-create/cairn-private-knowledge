# Component Provenance

## Assistant UI

The official `assistant-ui/assistant-ui` repository is MIT licensed. Its official package is `@assistant-ui/react`, and the official CLI can initialize an existing project. Assistant UI provides composable conversation primitives and supports custom runtimes, but its recommended quick-start adapter targets the Vercel AI SDK. Codex uses tRPC and a custom evidence backend, so any Assistant UI usage must be limited to primitives that can be driven by a compatible custom runtime rather than adopting an incompatible end-to-end adapter.

Source: https://github.com/assistant-ui/assistant-ui

## ElevenLabs UI

The official `elevenlabs/ui` repository is MIT licensed. It provides source-backed shadcn-compatible components via `@elevenlabs/cli` or its public registry. Its documentation describes components including Conversation, Conversation Bar, Message, Response, and Shimmering Text. Because Codex already uses Tailwind and shadcn-style components, selected source modules can be brought in through the official registry and adapted to Codex’s existing Vite stack after confirming their runtime dependencies.

Source: https://github.com/elevenlabs/ui
Documentation: https://ui.elevenlabs.io/docs
