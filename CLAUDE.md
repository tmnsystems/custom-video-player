# CLAUDE.md — CustomVideoPlayer

> This is a standardized environment pointer file automatically dropped into sub-projects to prevent redundant errors. Read this FIRST.

---

## 🛑 Security & Client Rule (CRITICAL)

**This codebase is intended for external clients.**

You are **strictly forbidden** from hardcoding Tina's personal data, absolute paths (like `/Users/alethea/Documents/...`), or private `n8n`, `Telegram`, or `Supabase` tokens/URLs into any source code here. The code must be portable.

This file itself is excluded via `.gitignore`. Do not commit this file.

---

## The Environment Rule

If you are running scripts that require API keys or tokens (like Notion, OpenAI, Anthropic):
1. The keys are stored in a local `.env` file.
2. **You MUST run `source .env` before executing any script.**
3. If you encounter a `401 Unauthorized` or missing key error, it means you did not source the environment correctly. **Do not attempt to regenerate or search for new keys or tokens.** Just correctly source the `.env`.

---

## Global Workspace Navigation

You are in a sub-project of the larger **AntiGravity Workspace**.
For global workspace rules, overarching AI team architecture, component catalogs, or specific Agent limitations and strengths, you must refer to:

1. **`../../../AGENTS.md`** (at the AntiGravity root)
2. **The local skills registry** at `/Users/alethea/Documents/AntiGravity/zoom-pipeline/.agent/skills/`

Do not invent rules inside this sub-project. Rely on the master architecture.
