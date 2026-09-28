# File Manager

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Expo](https://img.shields.io/badge/Expo-SDK%2054-000020.svg)](https://expo.dev)
[![React Native](https://img.shields.io/badge/React%20Native-0.81-20232A.svg)](https://reactnative.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6.svg)](https://www.typescriptlang.org)
[![Platforms](https://img.shields.io/badge/platform-Android%20%7C%20iOS%20%7C%20Web-3DDC84.svg)]()
[![Open Source](https://img.shields.io/badge/open%20source-MIT-brightgreen.svg)](LICENSE)

A cross-platform file manager for Android, iOS, and web, built with Expo and React Native. Browse, organise, search, analyse, and reclaim storage from a single interface.

## Features

**Browse**
- Hierarchical directory browser with breadcrumbs and path navigation
- Grid and list layouts, sortable by name, size, date, and type
- File type icons, thumbnails, and colour-coded folder tints
- Multi-select with batch actions

**Operations**
- Move, copy, rename, and duplicate files and folders
- Conflict resolution dialog for conflicting destinations
- Progress tracking for pending transfers
- Open with an external application

**Storage**
- Storage usage breakdown by category
- Storage analyser for identifying large files and space hogs
- Quota and capacity reporting

**Trash**
- Soft-delete with restore
- Newest-first listing with item counts
- Configurable retention sweep
- Name-collision handling on restore

**Search**
- Full-text file and folder search
- Debounced querying
- Type filters

**Other**
- Recent and favourites views
- Category tiles on the home screen
- Light and dark colour schemes, following the system setting
- A self-contained design system (`src/flux`) with typed tokens, atoms, and theming

## Requirements

- Node.js 20 or later
- [Bun](https://bun.sh) (the lockfile is `bun.lock`)
- Expo SDK 54
- Android Studio and/or Xcode for native builds

## Installation

```bash
git clone https://github.com/nezifalomi1/file-manager-allinone.git
cd file-manager-allinone
bun install
```

## Usage

```bash
bun start          # start the dev server
bun run android    # build and run on Android
bun run ios        # build and run on iOS
bun run web        # run in the browser
```

`bun run android` and `bun run ios` produce native development builds, which are required because the app uses native modules such as `expo-file-system`. It will not run in Expo Go.

## Scripts

| Command | Description |
| --- | --- |
| `bun start` | Start the Expo dev server |
| `bun run android` | Native Android build and launch |
| `bun run ios` | Native iOS build and launch |
| `bun run web` | Run the web build |
| `bun run lint` | Lint with Expo ESLint config |
| `bun run typecheck` | TypeScript check, no emit |
| `bun run verify` | Run the full verification suite |
| `bun run format` | Format the codebase with Prettier |
| `bun run assets` | Rebuild logo assets |

## Architecture

The codebase follows a layered structure that keeps UI, business logic, and I/O separate.

```
src/
  components/   Reusable presentational components
  core/         Framework-agnostic utilities and error types
  data/         Repositories, storage providers, and adapters
  domain/       Models and use cases (the business core)
  features/     Feature-scoped hooks and components
  flux/         Design system: tokens, atoms, theming
  lib/          Shared helpers, hooks, and the typed route table
  screens/      Route-level screens
  state/        App shell state
```

**The domain layer is pure.** Use cases under `src/domain/usecases` (`transfer`, `trash`, `search`, `folder`, `duplicate`, `open`, `recent`, `storageUsage`) take models and return models, with no React or filesystem imports. The `verify` scripts assert this behaviour directly, which keeps the rules from drifting as the UI changes.

**Storage is abstracted behind a provider.** `src/domain/storage/StorageProvider.ts` defines the contract; `src/data/storage/` supplies the implementations. `SafStorageProvider` handles Android's Storage Access Framework and `LocalStorageProvider` handles direct filesystem access, so platform differences stay out of the screens.

**Routing is type-safe.** `src/lib/routes/types.ts` declares the route table with per-route parameter shapes, so navigation is checked at compile time. Only routes that actually exist are declared — a route that type-checks but renders `NotFound` is worse than one that is absent.

## Storage permissions

Android requests `MANAGE_EXTERNAL_STORAGE` along with the scoped media permissions. On Android 11 and above the app can use the Storage Access Framework, which requires no broad permission and surfaces a directory picker instead.

## Contributing

Contributions are welcome.

1. Fork the repository and create a branch from `main`.
2. Make your change, keeping the domain layer free of UI and I/O concerns.
3. Run the checks: `bun run typecheck`, `bun run lint`, `bun run verify`.
4. Open a pull request describing the change and the reasoning behind it.

## License

Released under the [MIT License](LICENSE). You are free to use, copy, modify, merge, publish, distribute, sublicense, and sell copies, provided the copyright notice and permission notice are retained.

Copyright (c) 2026 Nezif Mohammed 
