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

Then do a smoke test in a real vault: copy all artifacts (`main.js`, `manifest.json`, `styles.css`, `pi-runtime.cjs`, `pdf.worker.mjs`, `runtime-assets/`) into `<vault>/.obsidian/plugins/pi-teacher/`, reload Obsidian, and run one full lesson (login → prompt → quiz → save note).

## 3. Publish

```bash
git push origin master
git tag 0.X.Y        # no leading "v" — must equal manifest.json version
git push origin 0.X.Y
```

The workflow then runs tests, builds, verifies tag == manifest version, and creates the GitHub release with:

- `main.js`, `manifest.json`, `styles.css` (standard Obsidian artifacts)
- `pi-runtime.cjs`, `pdf.worker.mjs` (extra runtime files)
- `pi-teacher-<version>.zip` (the complete plugin folder — this is what users should install)

## 4. Verify the release

- [ ] The release workflow is green.
- [ ] All assets are attached.
- [ ] Download the zip into a clean vault, install, and run one lesson.

## Distribution notes

- **Manual zip install** is the supported channel: the plugin needs `pi-runtime.cjs`, `pdf.worker.mjs`, and `runtime-assets/` next to the standard files, and only the zip ships them.
- **BRAT** only fetches the three standard files, so it installs a broken plugin. Don't advertise BRAT support until the runtime is inlined into `main.js` (roadmap).
- **Community directory**: same limitation — submissions may only attach `main.js`, `manifest.json`, and `styles.css`. Don't submit until the runtime is inlined.
