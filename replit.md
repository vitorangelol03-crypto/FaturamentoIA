# SmartReceipts AI (NotasCD)

## Overview
A smart receipt/invoice management application built with React and TypeScript. It allows users to scan, manage, and analyze fiscal receipts using AI-powered OCR via Google Gemini. Includes SEFAZ integration for automatic NF-e monitoring via Brazil's tax authority distribution service.

## Tech Stack
- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS (via CDN)
- **Backend/Database**: Supabase (external, hosted)
- **AI**: Google Gemini API for receipt data extraction
- **PDF Generation**: jsPDF (via CDN) - receipts, reports, and DANFE generation
- **PWA**: Service worker enabled
- **SEFAZ**: node-mde library for NF-e distribution (DistribuicaoDFe) with PFX certificate A1

## Project Structure
- `/` - Root contains main app files (App.tsx, index.tsx, index.html, types.ts, constants.ts)
- `/components/` - React components (Dashboard, ReceiptList, AddReceipt, Settings, AuthPage, AdminPanel, SefazMonitor, Layout)
- `/services/` - Service modules (supabaseClient, authService, geminiService, pdfService, sefazService)
- `/api/` - Vercel-style serverless functions (extract-invoice.js, extract-key.js, sefaz-monitor.js) - handled via Vite middleware in dev
- `/public/` - PWA assets (manifest.json, service-worker.js, offline.html)

## Configuration
- **Vite dev server**: Runs on 0.0.0.0:5000 with all hosts allowed for Replit proxy
- **API routes**:
  - `/api/extract-invoice` - Google Gemini OCR for receipt scanning
  - `/api/extract-key` - Google Gemini key-only extraction (44-digit chave de acesso from photo)
  - `/api/sefaz-monitor` - SEFAZ NF-e distribution queries (sync, consultaChave, consultaNSU)
- **Environment variables**:
  - `API_KEY` - Google Gemini API key (for receipt AI extraction)
  - `PFX_CERTIFICATE` - Base64-encoded PFX certificate for SEFAZ authentication
  - `PFX_PASSWORD` - PFX certificate password
- **Supabase**: Connection details in `constants.ts` (external Supabase project)
- **SEFAZ Config (multi-location)**:
  - Caratinga: CNPJ 11802464000138, PFX_CERTIFICATE / PFX_PASSWORD
  - Ponte Nova: CNPJ 53824315000110, PFX_CERTIFICATE_PN / PFX_PASSWORD_PN
  - Both: UF 31 (MG), tpAmb 1 (Produção)

## SEFAZ Monitor
- Admin-only access per location (admin + location = 'Caratinga' or 'Ponte Nova')
- Each location has its own CNPJ, PFX certificate, and sync control (ultimo_nsu)
- API accepts `location` parameter to select correct certificate/CNPJ
- Queries SEFAZ distribution service via node-mde DistribuicaoDFe
- Stores notes in Supabase `sefaz_notes` table (with chave_acesso as unique key, filtered by location)
- Tracks sync progress in `sefaz_sync_control` table (ultimo_nsu per location)
- Handles resNFe (summaries) and nfeProc (full NF-e) document types
- DANFE PDF generation via jsPDF for each note
- Auto-linking: After sync, system scans receipts table for matching access keys and links them
- Linked notes show "Vinculada" badge, unlinked show "Sem recibo"
- Key lookup: Scan photo or type 44-digit key to query SEFAZ directly (consultaChNFe), view and save result

## Receipt-SEFAZ Linking
- AI (Gemini) extracts 44-digit access_key from scanned receipts
- When receipt is saved, system tries to link with matching SEFAZ note (by chave_acesso)
- After SEFAZ sync, system batch-scans all unlinked notes against receipts
- Linking stored via receipt_id column on sefaz_notes table
- ReceiptList shows "SEFAZ" badge on receipts that have access_key

## Categories (Per-User)
- Each user has their own set of categories (filtered by user_id)
- New users automatically receive default categories on first login (from DEFAULT_CATEGORIES in constants.ts)
- When a receipt is saved, category_name and category_color are stored directly on the receipt
- This ensures the category is visible to all users regardless of whether they have that category
- Fallback: if category_name/color not on receipt, falls back to getCat() lookup by category_id

## Supabase Tables
- `users` - User accounts with roles (admin/user) and locations
- `receipts` - Scanned receipt data (includes access_key, category_name, category_color, observations)
- `categories` - Expense categories (per-user via user_id column)
- `sefaz_notes` - Fiscal notes from SEFAZ (chave_acesso, emitente, valor, XML, receipt_id for linking)
- `sefaz_sync_control` - Last synced NSU tracking
- Note: RLS policies need anon access for sefaz_notes and sefaz_sync_control

## Deployment
- Static deployment using `npm run build` → serves from `dist/` directory
- Note: API endpoints only work in dev mode (Vite middleware). For production, a separate backend or edge functions would be needed.

## Navigation & Back Button
- Centralized History API in App.tsx — single popstate listener with typed history stack (tab vs overlay)
- Overlay system: pushOverlay/closeOverlay/registerOverlayClose/unregisterOverlayClose passed as props to components
- Camera overlay (AddReceipt) and SEFAZ detail modal (SefazMonitor) both integrated with back button
- Back button on mobile navigates between tabs instead of closing the app
- Camera has an X close button in addition to "Concluir" (finish) button

## Admin Verification
- Centralized `isAdmin(user)` function in types.ts — all admin access checks use this function
- Logic: user.role === 'admin' || user.username === 'zoork22'

## Date Separation (issue_date / due_date / payment_date)
- AI extracts `issue_date` (emissão/competência) and `due_date` (vencimento) from receipts
- `date` field = payment date = date when receipt is scanned (always today)
- Filters and reports use `date` (payment date) for monthly organization
- Detail modal shows all 3 dates when available (pagamento, emissão, vencimento)
- Edit modals (AddReceipt + ReceiptList) allow editing all 3 dates
- Supabase columns: `issue_date` (date, nullable) and `due_date` (date, nullable) on `receipts` table
- SQL migration required: `ALTER TABLE receipts ADD COLUMN issue_date date; ALTER TABLE receipts ADD COLUMN due_date date;`

## Performance Optimizations
- Receipts query uses selective columns (excludes image_url base64 data) to prevent 500 errors on large datasets
- image_url loaded on-demand when opening receipt detail modal
- Query limit of 1000 receipts as safety net
- Service Worker uses individual try/catch for cache operations (no more addAll failures)
- Error banner with "Tentar novamente" button when data loading fails

## Recent Changes
- 2026-02-23: Bulk location change — admin-only location toggle (Caratinga/Ponte Nova) in AddReceipt queue footer after processing finishes, updates all processed receipts in batch before "Salvar e Finalizar"
- 2026-02-23: Advanced delete — admin-only "Excluir por Usuário/Data" modal in Settings: filter by user dropdown + specific date, preview matching receipts, individual/bulk selection, batch delete with sefaz_notes unlinking, existing "Limpar Notas por Período" preserved
- 2026-02-23: Performance fix — selective column loading (no image_url in list query), on-demand image loading in detail modal, .limit(1000) safety, error banner with retry, resilient Service Worker caching
- 2026-02-20: Date separation — added issue_date (emissão) and due_date (vencimento) fields; date = payment/scan date; filters use payment date; editable in all modals
- 2026-02-13: SEFAZ category priority — linked receipt category_name/color takes priority over keyword matching; receiptCategoryMap loaded from receipts table for all linked notes
- 2026-02-13: Restored user category dropdown in SEFAZ Monitor — options: "Categorias das notas" (auto), "Minhas categorias", or another user's categories; allUserCategories loaded once from Supabase
- 2026-02-13: Fixed SEFAZ category filter — categories now derived from actual notes (not user's personal categories), keyword matching uses natOp from XML for better accuracy, filter no longer goes blank
- 2026-02-13: SEFAZ key lookup — scan photo or type 44-digit chave de acesso to query SEFAZ directly, view note details, and save to database
- 2026-02-13: Centralized admin verification — isAdmin() helper function in types.ts, all components use centralized check
- 2026-02-13: Cross-user category filter — ReceiptList and SefazMonitor now have a dropdown to select which user's categories to use for filtering (matches by category name across users)
- 2026-02-13: All downloaded files (PDF reports, DANFE, individual receipts) include current date in filename (dd-mm-yyyy format)
- 2026-02-13: Per-user categories — each user has independent categories, new users get defaults auto-created, category_name/color stored on receipt for cross-user visibility
- 2026-02-13: Added observations field to receipts (edit modal textarea, detail modal display)
- 2026-02-13: Mobile anti-zoom CSS fixes (text-size-adjust, responsive card layouts, flex-wrap badges)
- 2026-02-11: Upgraded to Gemini 2.0 Flash model, improved prompt with item-based categorization (not establishment-based), added readability validation with auto-removal of unreadable photos, real-time camera processing with toast feedback
- 2026-02-11: Added camera close button (X) and centralized History API back button handling for mobile navigation
- 2026-02-11: Added per-admin SEFAZ access control (sefaz_access field on users table) with location switcher in Monitor
- 2026-02-11: Made SEFAZ note cards fully clickable, moved PDF download to details modal
- 2026-02-11: Added receipt-SEFAZ note auto-linking via access_key (chave de acesso 44 dígitos)
- 2026-02-12: PDF reading improvement — pdfjs-dist converts PDF pages to images before Gemini analysis (same quality as photos), multi-page support, PDF display fix for old data
- 2026-02-12: Categorization prompt strengthened — mecânica/borracharia/autopeças/retífica always categorized as Transporte
- 2026-02-12: Vite middleware cleanup — extract-invoice delegates to canonical api/extract-invoice.js handler
- 2026-02-12: Added browser notification system — permission request banner after login, notifications on PDF downloads, receipt saved, SEFAZ sync complete
- 2026-02-12: Fixed SEFAZ badge to only show for truly linked receipts (not just access_key presence), added Vinculadas/Não vinculadas filter
- 2026-02-12: Fixed receipt detail modal on mobile — buttons no longer hidden behind navigation bar
- 2026-02-11: Added SEFAZ Monitor for Ponte Nova (CNPJ 53824315000110) with separate PFX certificate, multi-location support
- 2026-02-06: Added SEFAZ Monitor with node-mde integration, DANFE PDF generation, complete admin UI for NF-e monitoring
- 2026-02-06: Initial Replit setup - configured Vite for port 5000, removed ESM import maps, added API middleware for Gemini
