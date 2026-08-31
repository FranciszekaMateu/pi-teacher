# Contributing to Pi Teacher

Thanks for helping improve Pi Teacher. Please keep changes focused on the
Obsidian plugin and avoid committing generated artifacts such as `main.js` or
`node_modules/`.

## Local development

```bash
npm install
npm run lint
npm test
npm run build
```

Run the full validation sequence before opening a pull request. Include tests
for behavior changes, and document any changes to permissions, network access,
filesystem access, or provider authentication.

## Pull requests

- Explain the user-facing behavior and security impact.
- Keep credentials and vault content out of commits and logs.
- Update the README and release metadata when the public behavior changes.
- Do not bump the version or publish a release without maintainer approval.
