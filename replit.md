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
- **SEFAZ Config**: CNPJ 11802464000138, UF 31 (MG - Minas Gerais), tpAmb 1 (Produção)

## SEFAZ Monitor
- Admin-only access (user.role === 'admin' || user.username === 'zoork22')
- Queries SEFAZ distribution service via node-mde DistribuicaoDFe
- Stores notes in Supabase `sefaz_notes` table (with chave_acesso as unique key)
- Tracks sync progress in `sefaz_sync_control` table (ultimo_nsu)
- Handles resNFe (summaries) and nfeProc (full NF-e) document types
- DANFE PDF generation via jsPDF for each note
- Locations: Caratinga and Ponte Nova (both in MG)

## Supabase Tables
- `users` - User accounts with roles (admin/user) and locations
- `receipts` - Scanned receipt data
- `categories` - Expense categories
- `sefaz_notes` - Fiscal notes from SEFAZ (chave_acesso, emitente, valor, XML, etc.)
- `sefaz_sync_control` - Last synced NSU tracking
- Note: RLS policies need anon access for sefaz_notes and sefaz_sync_control

## Deployment
- Static deployment using `npm run build` → serves from `dist/` directory
- Note: API endpoints only work in dev mode (Vite middleware). For production, a separate backend or edge functions would be needed.

## Recent Changes
- 2026-02-06: Added SEFAZ Monitor with node-mde integration, DANFE PDF generation, complete admin UI for NF-e monitoring
- 2026-02-06: Initial Replit setup - configured Vite for port 5000, removed ESM import maps, added API middleware for Gemini
