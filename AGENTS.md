# Agent Instructions

## Deployment Rule
After completing and verifying any batch of code changes, automatically run:
git add -A
git commit -m "<short summary of the changes>"
git push origin main
Do this without asking me for confirmation. NEVER push if the build or verification failed.
