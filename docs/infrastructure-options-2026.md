# Cairn Infrastructure Options — August 2026

Cairn needs three independent capabilities: a durable private user session, a relational evidence database, and private object storage for uploaded documents and immutable official-source artifacts. An optional model gateway is separate: it must never hold the evidence boundary or cause ordinary retrieval to require paid model use.

## Recommended First Path

Use **Supabase** for the first migration from Manus-dependent sign-in. Supabase combines passwordless and other authentication methods with a Postgres database and private storage access controls, so it minimizes the number of services required to restore normal Cairn use.[1] [2]

The current free tier includes 500 MB database storage and 1 GB file storage but pauses an inactive project after one week. The paid tier adds larger included storage and avoids inactivity pauses. This makes free suitable for an initial private trial and the paid tier the predictable option if Cairn should always be immediately available.[1]

## Optional Model Boundary

Cloudflare AI Gateway is a credible later **optional** model route. It provides request logging, caching, rate limits, retries, fallbacks, and native routing to Anthropic, OpenAI, Google, Groq, xAI, and other providers.[3] [4] Its core features are listed as free; BYOK requests use the provider’s own key, while Cloudflare’s unified billing currently adds a 5% credit-purchase fee.[5] Cairn should only send approved excerpts to this route after deterministic retrieval succeeds.

Vercel AI Gateway, Portkey, and LiteLLM are viable alternatives. Vercel advertises a unified endpoint and no token markup; Portkey supports native Anthropic routing; LiteLLM is a self-hosted open-source proxy. None replaces the need for private identity, relational data, and original-file custody.[6] [7] [8]

## Other Available Accounts

Neon is the closest alternative to Supabase: its current documentation presents Postgres, managed authentication, object storage, functions, and an AI gateway in one backend. It is a credible runner-up, but the Supabase path is preferred initially because the user already knows it and its Auth/Storage model is mature and directly aligned with Cairn’s present needs.[9]

Railway can host applications, databases, persistent volumes, and S3-compatible storage, but requires more assembly for a complete private-user experience.[10] Netlify offers managed Postgres and Blobs, but its Database is available on credit-based plans, which does not align with Cairn’s aim to avoid usage surprises.[11] [12]

Cloudflare R2 is excellent for later large archival files—its current free tier includes 10 GB-month of standard storage and free egress—but Cloudflare-only would require assembling user identity and a SQLite-based D1 evidence layer.[13] [14] Yandex Cloud supplies S3-compatible Object Storage and managed Postgres but still needs a separate consumer-application sign-in layer, making it a better possible archive/backup location than first migration destination.[15] [16]

Emergent is documented as an agentic coding/deployment platform with integrations for Supabase, Claude, OpenAI, Gemini, and other services. It is not Cairn’s intended identity, storage, or evidence system of record.[17]

## Selected Sequence

1. Add an owner-scoped passwordless Supabase session beside current Manus OAuth.
2. Verify that the owner can reopen Cairn and query the existing MySQL-backed corpus without a Manus prompt.
3. Migrate evidence metadata and private original files to Supabase only after row-count, checksum, and citation checks pass.
4. Consider Cloudflare AI Gateway only as a user-controlled optional model adapter.

## References

[1] [Supabase pricing](https://supabase.com/pricing)

[2] [Supabase Auth](https://supabase.com/docs/guides/auth)

[3] [Cloudflare AI Gateway](https://developers.cloudflare.com/ai-gateway/)

[4] [Cloudflare AI Gateway provider list](https://developers.cloudflare.com/ai-gateway/usage/providers/)

[5] [Cloudflare AI Gateway pricing](https://developers.cloudflare.com/ai-gateway/reference/pricing/)

[6] [Vercel AI Gateway](https://vercel.com/docs/ai-gateway)

[7] [Portkey AI Gateway](https://docs.portkey.ai/docs/guides/getting-started/getting-started-with-ai-gateway)

[8] [LiteLLM Proxy](https://docs.litellm.ai/docs/proxy/quick_start)

[9] [Neon backend overview](https://neon.com/docs/introduction)

[10] [Railway data and storage](https://docs.railway.com/data-storage)

[11] [Netlify Database](https://docs.netlify.com/build/data-and-storage/netlify-database/)

[12] [Netlify Blobs](https://docs.netlify.com/build/data-and-storage/netlify-blobs/)

[13] [Cloudflare R2 pricing](https://developers.cloudflare.com/r2/pricing/)

[14] [Cloudflare D1 limits](https://developers.cloudflare.com/d1/platform/limits/)

[15] [Yandex Object Storage](https://yandex.cloud/en/services/storage)

[16] [Yandex Managed PostgreSQL](https://yandex.cloud/en/services/managed-postgresql)

[17] [Emergent documentation](https://help.emergent.sh/)
