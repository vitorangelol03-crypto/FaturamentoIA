# SmartReceipts AI (NotasCD)

## Overview
A smart receipt/invoice management application built with React and TypeScript. It allows users to scan, manage, and analyze fiscal receipts using AI-powered OCR via Google Gemini.

## Tech Stack
- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS (via CDN)
- **Backend/Database**: Supabase (external, hosted)
- **AI**: Google Gemini API for receipt data extraction
- **PDF Generation**: jsPDF (via CDN)
- **PWA**: Service worker enabled

## Project Structure
- `/` - Root contains main app files (App.tsx, index.tsx, index.html, types.ts, constants.ts)
- `/components/` - React components (Dashboard, ReceiptList, AddReceipt, Settings, AuthPage, AdminPanel, Layout)
- `/services/` - Service modules (supabaseClient, authService, geminiService, pdfService)
- `/api/` - Original Vercel-style serverless function (extract-invoice.js) - now handled via Vite middleware
- `/public/` - PWA assets (manifest.json, service-worker.js, offline.html)

## Configuration
- **Vite dev server**: Runs on 0.0.0.0:5000 with all hosts allowed for Replit proxy
- **API route**: `/api/extract-invoice` is handled by Vite middleware in development (originally a Vercel serverless function)
- **Environment variable**: `API_KEY` - Google Gemini API key (required for receipt AI extraction)
- **Supabase**: Connection details are in `constants.ts` (external Supabase project)

## Deployment
- Static deployment using `npm run build` → serves from `dist/` directory
- Note: The `/api/extract-invoice` endpoint only works in dev mode (Vite middleware). For production, a separate backend or edge function would be needed.

## Recent Changes
- 2026-02-06: Initial Replit setup - configured Vite for port 5000, removed ESM import maps conflicting with Vite bundler, added API middleware for Gemini integration
