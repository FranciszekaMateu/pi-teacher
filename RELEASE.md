# Release checklist

Releases are automated by [`.github/workflows/release.yml`](.github/workflows/release.yml). This is the manual checklist around it.

## 1. Prepare the version

```bash
npm version patch   # or minor / major — bumps manifest.json and versions.json too
```

Confirm:

- `manifest.json` → `version` matches the new tag and `minAppVersion` is still accurate.
- `versions.json` maps the new version to the minimum Obsidian version.
- `package.json` and `manifest.json` versions match.

## 2. Verify locally

```bash
npm run lint
npm test
npm run build
```

Then do a smoke test in a real vault: copy `main.js`, `manifest.json`, and `styles.css` into `<vault>/.obsidian/plugins/pi-teacher/`, reload Obsidian, and run one full lesson (login → prompt → quiz → save note).

## 3. Publish

```bash
git push origin master
git tag 0.X.Y        # no leading "v" — must equal manifest.json version
git push origin 0.X.Y
```

The workflow then runs tests, builds, verifies tag == manifest version, and creates the GitHub release with:

- `main.js`, `manifest.json`, `styles.css`

## 4. Verify the release

- [ ] The release workflow is green.
- [ ] All assets are attached.
- [ ] Download the three release artifacts into a clean vault, install, and run one lesson.

## Community directory readiness

The Pi RPC runtime, its required theme data, and the PDF worker are bundled statically into `main.js`. The standard three release assets are therefore sufficient for GitHub releases, BRAT, and the Obsidian Community directory.
