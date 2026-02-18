
# 2ides Chess - Professional Chess Experience

A professional, high-performance chess application built with **Next.js**, **Firebase**, and **Genkit AI**. Optimized for both parent-child learning and competitive PvP play.

## 🚀 Key Features
- **PWA Powered**: Installable on any smartphone for a native, lag-free experience.
- **AI Coach**: Real-time feedback and post-match analysis powered by Google's Gemini.
- **Resilient PvP**: Real-time synchronization with automatic recovery for long-running matches.
- **Official Rule Protection**: Strictly follows FIDE rules, including preventing King capture.
- **2ides Branding**: Elegant interface with professional watermark and Italian-inspired styling.

## 🛠 Breaking the GitHub Loop

If you are stuck because GitHub says a repository named `studio` already exists (but it points to your other project, **DriveWise**):

1. **Rename the Other Project**:
   - Go to `github.com/samambaia/studio` (which currently opens DriveWise).
   - Click **Settings** > **General**.
   - Change the **Repository name** to `DriveWise` and click **Rename**.
   - This frees up the `studio` name if needed, but more importantly, cleans up the GitHub mapping.

2. **Reconnect this Project**:
   - In Firebase Studio, click on the **Project Name** at the top-left.
   - Select **"Disconnect from GitHub"** if the option exists, then **"Connect to GitHub"**.
   - Since I updated the `package.json` to `2ides-chess`, it should now suggest creating a repository with this new name.

3. **Use the Command Palette**:
   - Press `Ctrl + Shift + P`.
   - Search for `GitHub: Publish to GitHub`.
   - Now that the name is `2ides-chess`, it will create a fresh repository without conflicting with DriveWise.

## ♟️ Resilient PvP Testing
If you leave a game open for a long time (e.g., overnight):
- The app will automatically attempt to "Force Sync" when you return to the tab.
- If the board seems stuck, use the **REFRESH** button next to the timer to manually pull the latest state from the database.

---
© 2024 2ides Chess. Precise. Elegant. Professional.
