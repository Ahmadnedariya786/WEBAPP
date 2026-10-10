# Agent Instructions

## Deployment Rule
After completing and verifying any batch of code changes, automatically run:
git add -A
git commit -m "<short summary of the changes>"
git push origin main
Do this without asking me for confirmation. NEVER push if the build or verification failed.
Verification must run fully headless and must never trigger OS or browser download dialogs; binary assets are fetched via Node, not the browser.
