# Contributing

## Workflow
- Create feature branches
- Keep PRs focused and small
- Include docs updates when changing behavior

## Local development
```
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn app:app --reload
```

## Style and testing
- Ensure docs examples match live endpoints
- Prefer minimal, working curl examples
- If adding tests, place them under tests/
