// ============================================================
// RACLE ALBUM — CLOUD CONFIG
// ============================================================
// IMPORTANT: Use the "anon" "public" key (JWT).
// It MUST start with: eyJ
//
// Do NOT use:
//   - service_role key (secret)
//   - sb_publishable_... keys
//   - anything that does not start with eyJ
//
// Where to find it:
//   1. https://supabase.com/dashboard
//   2. Open your project
//   3. Project Settings (gear) → API
//   4. Project URL  → paste as SUPABASE_URL
//   5. Project API keys → "anon" "public" → Reveal → Copy
// ============================================================

const SUPABASE_URL = 'https://cuevevxmtxrdwaynwhsn.supabase.co';

// REPLACE THIS with your real anon public key (starts with eyJ...)
const SUPABASE_ANON_KEY = 'PASTE_YOUR_ANON_PUBLIC_JWT_KEY_HERE';
