
# 2ides Chess - Professional Chess Experience

A professional, high-performance chess application built with **Next.js**, **Firebase**, and **Genkit AI**. Optimized for both parent-child learning and competitive PvP play.

## 🚀 Key Features
- **PWA Powered**: Installable on any smartphone for a native, lag-free experience.
- **AI Coach**: Real-time feedback and post-match analysis powered by Google's Gemini.
- **Resilient PvP**: Real-time synchronization with automatic recovery for long-running matches.
- **Official Rule Protection**: Strictly follows FIDE rules, including preventing King capture.
- **2ides Branding**: Elegant interface with professional watermark and Italian-inspired styling.

## 🛠 GitHub Synchronization & Renaming

### Why is the repo named "studio"?
The name `studio` is the default project name assigned by the Firebase Studio environment. If you want to change it:

1. Go to your repository at `github.com/samambaia/studio`.
2. Click on the **Settings** tab (the gear icon).
3. In the **General** section, you will see the **Repository name** field.
4. Change it to `2ides-Chess` and click **Rename**.

### How to sync your changes
- Every time you click the **"Publish"** button in Firebase Studio, your latest code changes are pushed to this repository.
- If you don't see the repo, it might be set to **Private**. Check your private repositories list on GitHub.

## ♟️ Resilient PvP Testing
If you leave a game open for a long time (e.g., overnight):
- The app will automatically attempt to "Force Sync" when you return to the tab.
- If the board seems stuck, use the **REFRESH** button next to the timer to manually pull the latest state from the database.

---
© 2024 2ides Chess. Precise. Elegant. Professional.
