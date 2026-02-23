# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Development (runs on port 9002 with Turbopack)
npm run dev

# Build for production
npm run build

# Type checking
npm run typecheck

# Lint
npm run lint

# Genkit AI dev server (for testing/developing AI flows)
npm run genkit:dev
npm run genkit:watch
```

There are no automated tests in this project.

## Architecture Overview

**2Sides Chess** is a Next.js 15 (App Router) chess application with three game modes: AI opponent, online PvP, and Learning Mode.

### Core Data Flow

```
layout.tsx
  └─ FirebaseClientProvider (initializes Firebase once client-side)
       └─ FirebaseProvider (React context: auth state + Firestore + FirebaseApp)
            └─ pages: /, /login, /play
```

Firebase initialization uses a dual-strategy in `src/firebase/index.ts`: it first attempts `initializeApp()` with no args (Firebase App Hosting auto-config), then falls back to the hardcoded config in `src/firebase/config.ts` for local dev.

### Firebase Layer (`src/firebase/`)

- **`index.ts`** — re-exports everything; entry point for all Firebase imports (`@/firebase`)
- **`provider.tsx`** — `FirebaseProvider` + hooks: `useFirebase()`, `useAuth()`, `useFirestore()`, `useUser()`, `useMemoFirebase()`
- **`client-provider.tsx`** — `FirebaseClientProvider` wrapper used in root layout
- **`non-blocking-updates.tsx`** — fire-and-forget Firestore writes (used in ChessBoard for PvP sync)
- **`non-blocking-login.tsx`** — async auth helpers (anonymous sign-in, email sign-up/in)
- **`firestore/use-doc.ts`**, **`use-collection.ts`** — real-time Firestore hooks

### AI Layer (`src/ai/`)

Powered by **Google Genkit** with the Gemini model. Three server-side flows (marked `'use server'`):

- **`ai-opponent-difficulty.ts`** — takes FEN + difficulty, returns a UCI move string
- **`learning-mode-move-feedback.ts`** — provides real-time move feedback
- **`analyze-game-history.ts`** — post-game analysis (strengths/weaknesses)

All flows are defined via `ai.defineFlow` + `ai.definePrompt` (in `src/ai/genkit.ts`). The AI server (`src/ai/dev.ts`) imports all flows for the Genkit dev UI.

### Game Logic (`src/components/chess/ChessBoard.tsx`)

The central component handling all game state. Key responsibilities:
- Local game state via `chess.js` (`Chess` instance)
- PvP sync: reads/writes to Firestore `games/{gameId}` collection using `useDoc` for real-time updates
- AI moves: calls `aiOpponentDifficulty()` server action after each player move
- Anonymous sign-in is triggered automatically on `/play` if no user exists

PvP room IDs are random 7-char alphanumeric strings stored in the URL as `?room=<id>`.

### Auth Flow

- `/play` auto-signs in users anonymously if not authenticated
- `/login` handles email/password + Google + GitHub OAuth
- Auth state propagates via `FirebaseProvider` → `useUser()` hook throughout the app

### Styling

TailwindCSS + Radix UI primitives (shadcn/ui pattern). Components in `src/components/ui/` are Radix-based and should not be modified directly — treat them as a UI library. Custom app components live in `src/components/chess/` and `src/components/`.

### PWA

The app is a PWA (`/manifest.json`, `src/components/PWAInstaller.tsx`). The root layout sets `viewport.userScalable: false` intentionally for the mobile chess board experience.
