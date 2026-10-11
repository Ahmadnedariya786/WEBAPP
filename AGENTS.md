# Agent Instructions

## Deployment Rule
After completing and verifying any batch of code changes, automatically run:
git add -A
git commit -m "<short summary of the changes>"
git push origin main
Do this without asking me for confirmation. NEVER push if the build or verification failed.
Verification must run fully headless and must never trigger OS or browser download dialogs; binary assets are fetched via Node, not the browser.

### Verification Gate (WEB-FIX15)
The verification script must enforce:
1. Stats exact-match must be at least 75 percent (reading 340/62/58/64/96/28/12/9 into their own fields).
2. 'કોલેજ' must NOT receive 172 and no value may leak from the activities table into stats.
3. If stats exact-match is below 75 percent or any value leaks from the activities table into stats, the verify script must EXIT NON-ZERO and the Deployment Rule must NOT push.
