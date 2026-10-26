# ApplyPilot: Portable Storage and Packaging Architecture

## 1. Directory Structure

ApplyPilot uses a file-based portable data architecture. All persistent application data resides in a single folder named `data`.

### Development Mode
In development, the storage root resolver identifies the repository root (`Desktop_Application`) and binds storage to:
```
Desktop_Application/
  apps/
  packages/
  data/
```

### Packaged Distribution (Windows)
When compiled for distribution, the application executable and the `data/` folder are siblings:
```
ApplyPilot/
  ApplyPilot.exe
  data/
    manifest.json
    database/
      applypilot.sqlite
    profile/
      profile.json
      settings.json
      job-preferences.json
    ai/
      providers.json
      models.json
      feature-settings.json
    resumes/
      master/
      originals/
      optimized/
      tailored/
      extracted-text/
      resume-metadata.json
      resume-versions.json
      approvals.json
    jobs/
      YYYY-MM-DD/
        discovered/
        shortlisted/
        applied/
        needs-review/
    applications/
      application-index.json
    automation/
      sessions/
      site-capabilities.json
    documents/
    indexes/
      jobs-index.json
    backups/
    logs/
```

## 2. Packaging Configuration & Best Practices

1. **Portable Directory Target (`portable` / `dir`)**:
   - The recommended Windows distribution is a portable folder or zip archive containing `ApplyPilot.exe` alongside the runtime dependencies.
   - When launched for the first time, `ApplyPilot.exe` automatically creates and initializes the sibling `data/` directory.

2. **No Bundling of User Data into Read-Only Archives**:
   - The packaging configuration explicitly excludes `data/**` from `app.asar`.
   - User data is never packaged into read-only ASAR archives or temporary directories.

3. **Application Updates Preservation**:
   - Updates to the application overwrite or replace `ApplyPilot.exe` and `resources/app.asar`.
   - The sibling `data/` directory is external to the application binaries and remains completely untouched during updates.

4. **Installer Limitations & Fallback Behavior**:
   - If an NSIS or MSI installer installs the application to `C:\Program Files\ApplyPilot`, non-administrator Windows user accounts do not possess write permissions to create or modify sibling directories inside `Program Files`.
   - In that restricted scenario, ApplyPilot detects that `C:\Program Files\ApplyPilot\data` is not writable, emits an explicit warning, and falls back to the user's persistent AppData directory (`app.getPath('userData')`). It does not fail or silently lose data.
   - For true portable usage, users should extract `ApplyPilot/` to user-owned storage (e.g. `C:\Tools\ApplyPilot`, a dedicated folder, or a portable drive/USB).
