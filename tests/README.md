# Tests in 1to1\tests

## 1. Run all the node tests

Open PowerShell in the `1to1` folder and run:

```powershell
powershell -ExecutionPolicy Bypass -File .\tests\run-all.ps1
```

- Needs Node.js on the PATH. Check with `node -v`.
- It runs every `*.test.js` in `tests\` and in `test\`, then prints PASS or FAIL for each, and a summary.
- If anything fails, the output of that test is printed under the summary.
- Exit code 0 means everything passed. Exit code 1 means something failed.
- The tests read the app files directly. No server or browser is needed.

## 2. Browser check at 360px (Playwright)

The project's existing browser check is `test\shoot.js`. It opens `test\climb-harness.html` in Chromium, takes screenshots, and runs one end-to-end pass. It prints one JSON line. Look for `"errors":[]` and `"horizontalOverflow":false`.

Things to know before running it on Windows:

- It is set up for **390px**, not 360px.
- Its launch line uses a Linux browser path (`/opt/pw-browsers/chromium`), which does not exist on this PC.
- It saves screenshots into `test\shots`, which does not exist yet.
- The 360px harness used in the 19 Nov checks lives in the build scratch folder, not in the project, so it is not here.

Steps (run once, in the `1to1` folder):

```powershell
npm.cmd install --no-save playwright
npx.cmd playwright install chromium
New-Item -ItemType Directory -Force .\test\shots
```

Then open `test\shoot.js` and, on line 5, delete this part so Playwright uses its own browser:

```
executablePath: '/opt/pw-browsers/chromium', 
```

Run it:

```powershell
node .\test\shoot.js
```

Status: NOT RUN on this PC. The script was last run in the Linux test container on 19 Nov.
