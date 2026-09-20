# Mehnat Tracker v1.1.0 — 20 September 2026

Overlays top-anchored with sticky footers, verified Excel/PDF exports with Unicode Gujarati font rendering, theme crossfades, Android bridge save, and full 7-suite proof gate validation.

> **તમારો ડેટા સુરક્ષિત રહે છે — કોઈ માઇગ્રેશન નથી** (Your data is 100% safe — zero database migration required).

---

## 🌟 What's New in v1.1.0

### 1. 📱 Top-Anchored Overlays & Sticky Footers (S43 D2 Contract)
- All modal dialogs (Calendar, Scan Review, Halqa Management) are top-anchored (`calc(12px + env(safe-area-inset-top))`) and immune to ancestor scroll offsets.
- Neumorphic Sticky Footer Action Pills ("સાફ કરો" / "આજે") are permanently visible with guaranteed min-height 48px.
- Background scrolling strictly locked while any overlay is open and perfectly restored upon dismissal.

### 2. 📊 High-Fidelity Export Engine (S49 / S50)
- **PDF Export with Gujarati Unicode**: Fully rendered Gujarati text on high-resolution canvas with embedded worker support, eliminating unmapped glyph boxes.
- **Styled Excel (.xlsx) Spreadsheets**: Beautifully styled workbooks with custom header colors, cell borders, frozen panes, and Gujarati sheet names.
- **Native Android Download Bridge**: Direct saving into Android's Downloads directory via `AndroidDownloader.saveBase64` bridge with single verbatim toast ownership.

### 3. 🎨 Visual Polish & Animation Enhancements (S48 / S52)
- **Theme Crossfade**: Ultra-smooth transition when toggling between Outdoor, Dark Graphite, and Premium themes.
- **Card Spacing & Pill Geometry**: Perfect 20px padding and 48px pill height across settings.
- **Dark Splash & Native Window Background**: Seamless dark-mode splash background (`#20242B`) preventing white flashes on Android launch.
- **Halqa Add Button**: Clean "+ હલકો ઉમેરો" label.

---

## 📲 Installation / સ્થાપના
1. Download `mehnat-tracker-v1.1.0.apk` from the release assets.
2. Open on your Android device and tap **Install** (allow installation from this source if prompted).
3. Open the app — all your previous reports, halqas, and data remain intact.
