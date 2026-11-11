# Pushing PayPilot to GitHub (do this on your own machine / account)

The repo is prepared locally and committed. `gh` is not logged in on this machine, so the push needs your GitHub account. Two ways:

## Option A — GitHub CLI (fastest)

```bash
cd ~/workspace/paypal-hackathon/paypilot
gh auth login            # sign in to GitHub in the browser (choose HTTPS + your account)
gh repo create paypilot --public --source=. --remote=origin --push
```

Then confirm the repo is public at `https://github.com/<YOUR-USERNAME>/paypilot` and put that URL in `SUBMISSION.md` (replace `<YOUR-USERNAME>`).

## Option B — GitHub website + git

1. Go to https://github.com/new — create a **public** repo named `paypilot` (no README, no .gitignore — the local repo already has them).
2. Then run:

```bash
cd ~/workspace/paypal-hackathon/paypilot
git remote add origin https://github.com/<YOUR-USERNAME>/paypilot.git
git push -u origin main
```

## Safety check before pushing

Run `git ls-files` — it must NOT list `.env` (it is gitignored). If you ever see real keys in `git status`, stop and tell the assistant — do not push.
