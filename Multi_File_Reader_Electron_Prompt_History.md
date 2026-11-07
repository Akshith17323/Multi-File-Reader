% Multi-File-Reader: Electron Desktop Architecture & Engineering Trajectory
% Curated Engineering Evolution: Local-First Desktop Reader
% Generated: October 25, 2026

# Executive Overview: Electron Desktop Architecture

> **Document Scope:** This engineering document curates the **34 core architectural and technical prompts** that designed, implemented, hardened, and polished the **Electron desktop application** and **local-first document reading engine** in Multi-File-Reader. All tangential, preliminary, or unrelated prompts have been omitted to provide an executive technical record.

### Core Desktop Capabilities Delivered
| Desktop Capability | Architectural Implementation | Key Components |
| :--- | :--- | :--- |
| **Zero-Upload Local Reading** | Custom privileged scheme `mfr-local://` streaming directly from disk | `apps/electron/main.js`, `protocol.handle` |
| **Media Offline Detection** | Proactive filesystem existence checks (`fs.existsSync`) on launch | `apps/electron/main.js`, `apps/web/app/files/page.tsx` |
| **Native Relinking Dialog** | DaVinci Resolve-style relocation of moved/renamed disk documents | `dialog.showOpenDialog`, `relink-local-file` IPC |
| **Multi-Format Tab Factory** | Unified tabbed reader dynamically rendering PDF, EPUB, and TXT | `apps/web/app/reader/page.tsx`, Factory Pattern |
| **Local-First Bookmarks** | Instant local storage persistence with automatic cloud sync merge | `apps/web/utils/localBookmarks.ts` |
| **Session State Resume** | Automatic restoration of active tabs and reading positions on launch | `apps/web/utils/readerSession.ts` |
| **Native Frameless Titlebar** | Custom styled window controls with Lucide SVG icons and drag regions | `apps/web/components/DesktopTitlebar.tsx` |
| **Context-Isolated Bridge** | Secure preload IPC bridge with zero Node integration in renderer | `apps/electron/preload.js`, `types/electron.d.ts` |

---

# Curated Engineering Prompts & Technical Decisions

## Prompt 01: Initiating Local File Support & Desktop Integration
**Domain:** `Requirements & Strategy` | **Execution Step:** `Step 173`

**User Engineering Prompt:**
```text
now i want to add the local files support and later add thegoogle drive support like import files form google rive or one drive or even i cloud drive
```

**Technical Response & Action Summary:**
- Formulated the foundational requirement to support direct local file reading without mandating cloud uploads.
- Evaluated the contrast between cloud-synced documents and offline-first private reading workflows.
- Identified that native desktop integration is required to bypass web browser filesystem security boundaries.
- Established the roadmap for the Electron desktop client alongside the existing Next.js web application.

---

## Prompt 02: Offline / No-Upload Mode vs. Cloud Storage Analysis
**Domain:** `Architectural Trade-offs` | **Execution Step:** `Step 176`

**User Engineering Prompt:**
```text
i want you opinion on this 


Offline / No-Upload Mode: You want users to be able to open and read files directly off their hard drive without actually uploading them to your Google Cloud Storage and using up your cloud bandwidth.
Electron Sync: You want the desktop app to automatically sync a specific folder on their computer (like a local "Library" folder).

like thinking to have no upload function but i think it was no tpossible in web but possible in electon but if local file support is added in teh web too with more acces i think i do not need to have an s3 bucket as also plaaning to have drive imports 
waht so you think
```

**Technical Response & Action Summary:**
- Delivered an architectural feasibility analysis comparing client-side local storage against Google Cloud Storage.
- Highlighted the zero-bandwidth cost, instant document loading, and complete privacy advantages of local-first reading.
- Outlined challenges including local path synchronization across devices and browser sandbox storage persistence.
- Recommended a hybrid architecture: local-first native desktop reading combined with opt-in cloud library backup.

---

## Prompt 03: Evaluating Browser Sandbox Constraints for Local Storage
**Domain:** `Security & Sandbox` | **Execution Step:** `Step 179`

**User Engineering Prompt:**
```text
no , i am thinking about cons
```

**Technical Response & Action Summary:**
- Analyzed security sandbox limitations of standard web browsers that prohibit direct access to OS file paths.
- Explained why temporary `blob:` URLs fail to provide permanent reading sessions across browser restarts.
- Identified that persistent file path memory requires operating system level file permissions.
- Concluded that an Electron desktop runtime is the only robust mechanism for true zero-upload disk reading.

---

## Prompt 04: Testing Web In-Memory Reading vs. Native Desktop Files
**Domain:** `Platform Feasibility` | **Execution Step:** `Step 182`

**User Engineering Prompt:**
```text
first lets implement the local file features without uplaoding for web part of the project
```

**Technical Response & Action Summary:**
- Tested client-side File API and in-memory object URLs (`URL.createObjectURL`) for temporary web reading.
- Demonstrated that while the reader can display in-memory blobs, the browser cannot reload them upon page refresh.
- Clarified the clear functional boundary: web for transient session viewing, Electron for permanent disk libraries.
- Directed engineering focus toward establishing the dedicated Electron desktop wrapper.

---

## Prompt 05: Decoupling Prisma Schemas from Mandatory Cloud Storage
**Domain:** `Database Architecture` | **Execution Step:** `Step 230`

**User Engineering Prompt:**
```text
since we are nto adding the file into cloud befreo this refractor the schemaas local files do not need the file url ..
```

**Technical Response & Action Summary:**
- Refactored Prisma database models to decouple document records from mandatory remote HTTPS URLs.
- Structured file and bookmark entities to accommodate local custom URIs alongside Google Cloud Storage URLs.
- Ensured bookmark tracking works seamlessly whether a document is stored remotely or on local disk.
- Maintained backward compatibility with existing cloud documents while enabling local metadata registration.

---

## Prompt 06: Prisma Schema Realignment for Local & Cloud File Parity
**Domain:** `Data Model Alignment` | **Execution Step:** `Step 247`

**User Engineering Prompt:**
```text
refractor the whole prisma file according to the new requireemtns with the predencement fo making the drive incvlusion feature now for ist hange teh prisam queries
```

**Technical Response & Action Summary:**
- Updated the database schema to make remote cloud storage keys optional across document models.
- Configured composite unique indexes (`userId_fileUrl`) in PostgreSQL to support `mfr-local://` URI lookup.
- Implemented foreign key cascade handling to prevent orphaned bookmark records during file deletion.
- Verified schema consistency using Prisma client generators without dropping existing database tables.

---

## Prompt 07: Multi-Device Web Library vs. Electron Desktop Local Storage
**Domain:** `Cross-Device Strategy` | **Execution Step:** `Step 284`

**User Engineering Prompt:**
```text
what if ,the user open teh website in another device and use it in teh electron what will teh library shows what about this cxase scenrio
```

**Technical Response & Action Summary:**
- Defined clear behavior for multi-device workflows when files reside physically on a specific machine's hard drive.
- Established that local disk files are indexed per machine, while cloud files synchronize across all client devices.
- Designed the Library UI to cleanly categorize documents by origin so users understand document availability.
- Prevented broken cross-device download attempts by gating local file actions to the active desktop instance.

---

## Prompt 08: On-Demand Document Loading Without Heavy Cloud Downloads
**Domain:** `Performance Optimization` | **Execution Step:** `Step 287`

**User Engineering Prompt:**
```text
what i want is the user ot select the file in the local unless he wants to see it , like to not to display the whole files in teh library, but if a person wants the read the file why stroing teh itin the database , but i nned it for book marks , but is that necessary , ( i think it waas depends on the target audidence
```

**Technical Response & Action Summary:**
- Eliminated the overhead of pre-downloading heavy document files during library browsing and card rendering.
- Architected on-demand streaming where document content is only read when the user explicitly clicks a reader tab.
- Reduced application memory consumption and eliminated unnecessary network egress bandwidth.
- Implemented lightweight metadata caching for fast, responsive library navigation.

---

## Prompt 09: Optimizing Document Workflows for Knowledge & Office Workers
**Domain:** `User Persona Design` | **Execution Step:** `Step 290`

**User Engineering Prompt:**
```text
i target use i think is office workers like to read the books or their important files at one place and like avid readrs too
```

**Technical Response & Action Summary:**
- Defined the primary user persona: professionals and researchers managing local PDFs, EPUBs, and notes in one workspace.
- Streamlined navigation to support rapid multi-file opening directly from desktop file managers and folders.
- Prioritized distraction-free reading, persistent bookmarks, and instant document switching.
- Ensured the UI provides both native desktop titlebar controls and modern responsive reader layouts.

---

## Prompt 10: Definitive Decision on Local File Architecture & Storage
**Domain:** `Architecture Synthesis` | **Execution Step:** `Step 293`

**User Engineering Prompt:**
```text
so what have we came to conclusion for the local files
```

**Technical Response & Action Summary:**
- Synthesized all findings into a unified hybrid architectural specification for the platform.
- Finalized that the Electron desktop app will handle persistent local disk reading via custom protocol interceptors.
- Agreed that the Web client remains optimized for cloud-synced documents and guest reading sessions.
- Established the technical foundation for IPC message bridges between the Next.js UI and Electron main process.

---

## Prompt 11: Cross-Platform Environment Detection (`useEnvironment`)
**Domain:** `Runtime Detection` | **Execution Step:** `Step 297`

**User Engineering Prompt:**
```text
how do you detect is was present in the laptop or the mobile to know hwere to tellteh user to open it
```

**Technical Response & Action Summary:**
- Engineered the `useEnvironment` React hook and utility to dynamically detect whether running inside Electron or Web.
- Conditioned desktop-only UI components (native file dialogs, window controls) on `window.electronAPI` availability.
- Prevented runtime script errors when web browsers access desktop-specific Node.js globals.
- Ensured a single unified codebase seamlessly powers both the browser web app and the desktop executable.

---

## Prompt 12: SaaS Tiering & Free Local Desktop Tier Architecture
**Domain:** `Product Strategy` | **Execution Step:** `Step 301`

**User Engineering Prompt:**
```text
it si website right can we ask them subscription for the web aas the storage in the local is fell like out project is gettig complicated and is it really for a webstire to opent ehlocal files
```

**Technical Response & Action Summary:**
- Structured product tiering: completely free, unlimited local disk reading on the Electron desktop client.
- Positioned premium subscriptions for multi-device cloud synchronization, automated backup, and storage quotas.
- Minimized cloud server infrastructure operational costs by leveraging client hardware for local reading.
- Ensured local reading requires zero server compute or database dependencies when operating completely offline.

---

## Prompt 13: Prioritizing Electron Native Reader & Ditching Web Local Paths
**Domain:** `Engineering Scope` | **Execution Step:** `Step 304`

**User Engineering Prompt:**
```text
yes simplyfying is right , and lets first make teh local files reader in electron and ditch the local files for the web 
and alwyas gvie me teh implementation plan
```

**Technical Response & Action Summary:**
- Formally simplified scope: halted fragile web-based local path workarounds to focus fully on native Electron.
- Prevented fragile browser hacks and embraced Electron's native operating system access.
- Established clear platform boundaries that eliminated redundant code and simplified state management.
- Directed all subsequent local file engineering efforts into the Electron main process and preload bridge.

---

## Prompt 14: Formal Electron Architecture Blueprint & Implementation Specification
**Domain:** `Engineering Plan` | **Execution Step:** `Step 307`

**User Engineering Prompt:**
```text
no the anitigravity ide give us the implemetnation plan i nned that kind of implementation plan
```

**Technical Response & Action Summary:**
- Authored the comprehensive engineering blueprint documenting protocol interceptors, IPC channels, and security.
- Specified custom scheme `mfr-local://`, window state persistence, and native file dialog workflows.
- Structured sequential implementation phases: main process setup, preload context isolation, and UI integration.
- Saved the architectural specification into the project knowledge repository for team reference.

---

## Prompt 15: Structuring Core Local File Logic in Electron `main.js`
**Domain:** `Main Process Design` | **Execution Step:** `Step 361`

**User Engineering Prompt:**
```text
are you writing teh local files logic in the main.js in the electron ? like get a feelingt o write teh code the electon app and make the funciton adapt according to it via adapeter pattern , as we alred used the lectron api vairable to check wheter we want the electon adn web
```

**Technical Response & Action Summary:**
- Designed the architecture of `apps/electron/main.js` to serve as the secure orchestrator for native capabilities.
- Registered privileged scheme `mfr-local` before app readiness with secure fetch, stream, and CORS bypass privileges.
- Implemented native open dialogs (`dialog.showOpenDialog`) to safely capture absolute file paths.
- Maintained strict separation between main process privilege and renderer window presentation.

---

## Prompt 16: Custom Scheme `mfr-local://` & Native Protocol Streaming
**Domain:** `Protocol Implementation` | **Execution Step:** `Step 364`

**User Engineering Prompt:**
```text
please implement it
```

**Technical Response & Action Summary:**
- Implemented `protocol.handle('mfr-local')` in `main.js` to stream local documents straight from disk.
- Added filesystem verification (`fs.existsSync` and `fs.accessSync`) to validate file availability and read permissions.
- Decoded file paths across macOS, Linux, and Windows drive formats (`C:\`) cleanly.
- Enabled high-performance local streaming directly into PDF.js, ePub.js, and text renderers without HTTP overhead.

---

## Prompt 17: Harmonizing Web and Electron Codebases Across Workspaces
**Domain:** `Full-Stack Refactor` | **Execution Step:** `Step 382`

**User Engineering Prompt:**
```text
refractor everythings according t the new code i teh web part and the electron part of the code base
```

**Technical Response & Action Summary:**
- Refactored shared components and utilities across `apps/web` and `apps/electron` workspaces.
- Integrated `apiClient.ts` universal fetch to transparently proxy API calls through IPC when running in Electron.
- Bypassed browser CORS restrictions in desktop mode by routing requests through Electron's main network stack.
- Verified that all file upload, reading, and bookmark services operate identically in desktop and browser modes.

---

## Prompt 18: Retaining Core Lifecycle & Native Interceptors in `main.js`
**Domain:** `Code Architecture` | **Execution Step:** `Step 421`

**User Engineering Prompt:**
```text
why moving everything out of the main.js keep the main function in teh main.js
```

**Technical Response & Action Summary:**
- Maintained clean architectural discipline by consolidating window lifecycle and protocol handlers in `main.js`.
- Avoided premature over-abstraction that fragmented Electron IPC handlers into excessive helper scripts.
- Preserved transparent traceability for security reviews, context isolation policies, and window events.
- Ensured rapid startup performance by minimizing circular require chains in the Electron main process.

---

## Prompt 19: Separating Independent Services from Main Process Lifecycle
**Domain:** `Service Modularization` | **Execution Step:** `Step 430`

**User Engineering Prompt:**
```text
move teh core and big function into independent services ( if they are actully independent services ) move them out of the main.js
```

**Technical Response & Action Summary:**
- Extracted truly independent utilities (URL decoders, file type detectors, size formatters) into modular services.
- Maintained single-responsibility boundaries for IPC endpoints, window controllers, and protocol interceptors.
- Hardened error handling in native file handlers to return structured error objects rather than throwing crashes.
- Preserved stability across main process startup and window destruction events.

---

## Prompt 20: Designing Multi-Tab Document Interface via Factory Pattern
**Domain:** `Reader Architecture` | **Execution Step:** `Step 510`

**User Engineering Prompt:**
```text
okay suppose i we want to implement the multiple tab insterface for the code porject do we should implement facotry patter for each readeras each reader is seprate if the fil typews is different
```

**Technical Response & Action Summary:**
- Architected a unified multi-document tabbed reader bar supporting simultaneous open files.
- Designed a Factory Pattern abstraction that resolves the appropriate renderer component based on document MIME type.
- Enabled seamless tab switching between PDF, EPUB, and TXT files without unmounting or reloading sibling state.
- Established URL query parameter synchronization (`files=url1,url2&active=0`) for instant shareability and reloading.

---

## Prompt 21: Implementing Unified Multi-Format Factory Reader Component
**Domain:** `Factory Implementation` | **Execution Step:** `Step 526`

**User Engineering Prompt:**
```text
can you implement those factory pattern in here
```

**Technical Response & Action Summary:**
- Implemented the Factory Pattern renderer in `apps/web/app/reader/page.tsx` dynamically routing active file types.
- Decoupled rendering engines: PDFRenderer for PDF documents, EPUBRenderer for books, and TextRenderer for text.
- Implemented synchronized tab management: active tab indicators, close buttons, and tab addition handlers.
- Ensured consistent zoom, fit mode (width/height), pagination, and theme controls across all document formats.

---

## Prompt 22: Auditing Electron Preload Script, IPC Channels & Type Safety
**Domain:** `IPC Bridge Audit` | **Execution Step:** `Step 1355`

**User Engineering Prompt:**
```text
is the all the interfaces and the preload .js in teh electron js applciation working and has everythignand working seaminglessly
```

**Technical Response & Action Summary:**
- Conducted a comprehensive audit of `apps/electron/preload.js` and `types/electron.d.ts` for full API coverage.
- Verified that all IPC invoke channels (`open-local-file`, `check-local-files-status`, `relink-local-file`) are registered.
- Enforced strict context isolation (`contextIsolation: true`) and disabled Node integration in the renderer.
- Ensured `window.electronAPI` methods match TypeScript typings with zero compiler errors.

---

## Prompt 23: Hardening Preload Bridge & Native Window Control Channels
**Domain:** `IPC Hardening` | **Execution Step:** `Step 1389`

**User Engineering Prompt:**
```text
can you fix them
```

**Technical Response & Action Summary:**
- Corrected channel mismatches between `preload.js` invoke sets and `main.js` IPC handlers.
- Implemented frameless desktop window controls: `window-minimize`, `window-maximize`, and `window-close`.
- Added `webUtils.getPathForFile` bridge method to securely extract native OS paths from dragged and dropped files.
- Validated that desktop titlebar interactions trigger instant window state updates on macOS and Windows.

---

## Prompt 24: End-to-End Validation of Local Disk Reading in Desktop App
**Domain:** `Feature Verification` | **Execution Step:** `Step 1437`

**User Engineering Prompt:**
```text
check for the local files reading into the app is that working now ot not anything missing and ask for fil permissioons in the eapp
```

**Technical Response & Action Summary:**
- Tested complete local file reading flow: OS open dialog -> `mfr-local://` URI creation -> tabbed reader rendering.
- Verified that large PDF textbooks and EPUB novels stream with zero lag and zero network overhead.
- Confirmed that bookmarks and last read positions persist accurately in local storage for local disk files.
- Validated that local documents appear in the Library view with local metadata and instant reopening.

---

## Prompt 25: Custom URI Scheme (`mfr-local://`) & Database Binding
**Domain:** `Protocol Design` | **Execution Step:** `Step 1549`

**User Engineering Prompt:**
```text
i had a doubt how do we use the local files into the bd like what is the format of the url
```

**Technical Response & Action Summary:**
- Standardized the local file URI format: `mfr-local:///Users/path/to/document.pdf` across the entire stack.
- Demonstrated how local URIs bind cleanly into PostgreSQL bookmark records without uploading binary payloads.
- Explained how the Electron custom protocol handler intercepts `mfr-local://` to fetch directly from disk.
- Ensured database uniqueness constraints (`userId_fileUrl`) function identically for both local and cloud URLs.

---

## Prompt 26: Handling Moved, Renamed & Missing Local Files on Disk
**Domain:** `Edge-Case Analysis` | **Execution Step:** `Step 1557`

**User Engineering Prompt:**
```text
what if the user move the file to another location in teh local and then open in the app what wil happen
```

**Technical Response & Action Summary:**
- Analyzed edge cases where users move, rename, or delete local documents on their hard drive outside the app.
- Identified that attempting to open a missing local file previously resulted in a blank reader or silent failure.
- Architected proactive filesystem validation on library load to check whether registered disk paths still exist.
- Concluded that the application should display clear visual indicators and provide a one-click relocation tool.

---

## Prompt 27: DaVinci Resolve-style Media Offline Detection & Native Relink
**Domain:** `Media Relinking Feature` | **Execution Step:** `Step 1559`

**User Engineering Prompt:**
```text
can we add that feature by showing the missing file and them giving them in relink option ike one in davinci resolve]
```

**Technical Response & Action Summary:**
- Implemented a DaVinci Resolve-inspired 'Media Offline' detection system for all local disk documents.
- Created native batch status checker (`check-local-files-status`) that scans disk paths on library launch.
- Designed a prominent 'Media Offline' badge and one-click 'Relink File' button on missing file cards.
- Integrated native OS open dialog (`relink-local-file`) that automatically updates URIs, bookmarks, and reader tabs.

---

## Prompt 28: Validating Tab-Style Reader Switching & Multi-File UX
**Domain:** `UX Verification` | **Execution Step:** `Step 1705`

**User Engineering Prompt:**
```text
is the tab style type reader working
```

**Technical Response & Action Summary:**
- Validated tab-style reader behavior under heavy multi-document reading sessions.
- Tested simultaneous open tabs combining local disk PDFs, cloud EPUBs, and local text documents.
- Confirmed smooth active-tab switching, accurate document title extraction, and clean tab close interactions.
- Ensured that document scroll positions and page locations remain cached when switching between active tabs.

---

## Prompt 29: Comprehensive Web vs. Electron Feature Audit & Gap Analysis
**Domain:** `Feature Inventory` | **Execution Step:** `Step 1730`

**User Engineering Prompt:**
```text
can list all teh features present in the project for the web , electron  seprately and what is missing seaming flow of each features or missing int eh workflwo features
```

**Technical Response & Action Summary:**
- Conducted an exhaustive feature audit categorizing all implemented and missing features for Web and Electron.
- Identified gaps in offline bookmark synchronization, session persistence, and storage origin visual indicators.
- Mapped complete workflow journeys: document import, tabbed reading, bookmark management, and library search.
- Structured a prioritized implementation roadmap focusing on high-impact desktop usability improvements.

---

## Prompt 30: Implementation of Features 01, 02, and 03 (Offline, Relink, Badges)
**Domain:** `Core Features Delivery` | **Execution Step:** `Step 1756`

**User Engineering Prompt:**
```text
can you add the feature 1 2 3
```

**Technical Response & Action Summary:**
- Delivered Feature 01: Offline Bookmarking & Progress Sync (local-first storage with automatic cloud merge).
- Delivered Feature 02: DaVinci Resolve-style Missing File Detection & Relinking with native dialog support.
- Delivered Feature 03: Storage Origin Badges (Cloud ☁️ vs. Local Disk 💾) on library cards and bookmark items.
- Verified zero TypeScript compiler errors and zero ESLint warnings across all updated components.

---

## Prompt 31: Implementation of Features 04, 05, and 07 (Persistence & Session Resume)
**Domain:** `Session Features Delivery` | **Execution Step:** `Step 1839`

**User Engineering Prompt:**
```text
now can we implemetn the feature 4, 5 and 7 but thinking about theh sixth feature
```

**Technical Response & Action Summary:**
- Delivered Feature 04: Unified local-first bookmark manager supporting offline guests and authenticated users.
- Delivered Feature 05: Reader Session Persistence (saving open tabs and active document index across app restarts).
- Delivered Feature 07: Quick-Resume Last Session banner on the Library page allowing one-click reader restoration.
- Reserved extensible hooks and architecture for Feature 06 (In-Reader Search and Highlighting Annotations).

---

## Prompt 32: Storage Origin Indicators: Cloud vs. HardDrive Badges
**Domain:** `Visual Polish` | **Execution Step:** `Step 2017`

**User Engineering Prompt:**
```text
what are teh other features left or present like is there any way for you to show that the files are from cloud like in the file card use cloud icon for cloud file and local like a disk or suitable icon
```

**Technical Response & Action Summary:**
- Added modern visual badges to differentiate remote cloud documents from private local disk documents.
- Configured Emerald badges with HardDrive icon for local disk files and Sky Blue badges with Cloud icon for cloud files.
- Implemented source-based library filtering ('All Sources', 'Cloud Storage', 'Local Disk') in the Library controls bar.
- Ensured badges and icons adapt cleanly across light and dark theme modes with optimal contrast.

---

## Prompt 33: Replacing Raw Unicode Window Controls with Lucide React Icons
**Domain:** `Iconography Upgrade` | **Execution Step:** `Step 2502`

**User Engineering Prompt:**
```text
remove all teh standard emoji's either use the lucide react or ermove them
```

**Technical Response & Action Summary:**
- Eliminated all raw unicode glyphs (`─`, `□`, `✕`, `▼`, `←`) across the desktop titlebar and application UI.
- Upgraded DesktopTitlebar with Lucide React `<Minus>`, `<Square>`, and `<X>` SVG icons for native desktop feel.
- Replaced select dropdown arrows with `<ChevronDown>` and navigation back buttons with `<ArrowLeft>`.
- Standardized all server and desktop log prefixes (`[Server]`, `[Upload]`, `[Delete]`) to remove non-standard emojis.

---

## Prompt 34: Technical Evaluation: Web Sandbox Limits vs. Electron Native Disk
**Domain:** `Platform Architecture` | **Execution Step:** `Step 2585`

**User Engineering Prompt:**
```text
is there any local file reading in the web or should i have to use the electron builder or elctoon to have that
```

**Technical Response & Action Summary:**
- Delivered an authoritative technical comparison between web browser sandbox isolation and Electron native capabilities.
- Explained why web browsers strictly block reading arbitrary OS paths (`/Users/...`) without manual re-selection.
- Highlighted Electron's architectural advantages: `mfr-local://` streaming, media offline detection, and disk relinking.
- Documented how to launch and distribute the unified desktop application using `npm run electron`.

---
