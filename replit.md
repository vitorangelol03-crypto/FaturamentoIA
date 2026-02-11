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
- `/api/` - Vercel-style serverless functions (extract-invoice.js, sefaz-monitor.js) - handled via Vite middleware in dev
- `/public/` - PWA assets (manifest.json, service-worker.js, offline.html)

## Configuration
- **Vite dev server**: Runs on 0.0.0.0:5000 with all hosts allowed for Replit proxy
- **API routes**:
  - `/api/extract-invoice` - Google Gemini OCR for receipt scanning
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

## Receipt-SEFAZ Linking
- AI (Gemini) extracts 44-digit access_key from scanned receipts
- When receipt is saved, system tries to link with matching SEFAZ note (by chave_acesso)
- After SEFAZ sync, system batch-scans all unlinked notes against receipts
- Linking stored via receipt_id column on sefaz_notes table
- ReceiptList shows "SEFAZ" badge on receipts that have access_key

## Supabase Tables
- `users` - User accounts with roles (admin/user) and locations
- `receipts` - Scanned receipt data (includes access_key for NF-e linking)
- `categories` - Expense categories
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

## Recent Changes
- 2026-02-11: Added camera close button (X) and centralized History API back button handling for mobile navigation
- 2026-02-11: Added per-admin SEFAZ access control (sefaz_access field on users table) with location switcher in Monitor
- 2026-02-11: Made SEFAZ note cards fully clickable, moved PDF download to details modal
- 2026-02-11: Added receipt-SEFAZ note auto-linking via access_key (chave de acesso 44 dígitos)
- 2026-02-11: Added SEFAZ Monitor for Ponte Nova (CNPJ 53824315000110) with separate PFX certificate, multi-location support
- 2026-02-06: Added SEFAZ Monitor with node-mde integration, DANFE PDF generation, complete admin UI for NF-e monitoring
- 2026-02-06: Initial Replit setup - configured Vite for port 5000, removed ESM import maps, added API middleware for Gemini
