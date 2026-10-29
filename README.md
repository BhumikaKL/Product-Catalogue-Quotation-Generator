# Sharp Product Catalogue & Quotation Generator

A local demo application with a React + Vite frontend and a Node.js + Express backend. It generates quotation PDFs using PDFKit and embeds the product images. MongoDB is not required.

## Requirements
- Node.js 20 LTS or newer
- npm (included with Node.js)

## 1. Set up the backend (Windows / VS Code)
Open a terminal in this project folder and run:

```cmd
cd backend
copy .env.example .env
```

For local testing, the example `.env` values can be used. Before deployment, replace `JWT_SECRET` with a long random secret and configure environment variables securely.

Then run:

```cmd
npm install
npm run dev
```

Expected message: `API listening at http://localhost:5000`

Verify the backend by opening http://localhost:5000/api/health. It should show `{"status":"ok"}`.

Keep this terminal open.

## 2. Set up the frontend
Open a **second terminal** in the project root and run:

```cmd
cd frontend
npm install
npm run dev
```

Open the local URL printed by Vite, usually http://localhost:5173.

## Demo accounts
- Admin: `admin` / `Admin@123`
- Salesperson: `sales1` / `Sales@123`
- Salesperson: `sales2` / `Sales@123`
- Salesperson: `sales3` / `Sales@123`

## Workflow
1. Sign in.
2. Select a printer. Admin can select multiple products; a salesperson can select one product per quotation.
3. Enter customer name, company (optional), email, phone (optional), quantity and GST rate.
4. Review the quotation and download the PDF.
5. Choose “Create another quotation” to prepare another one.

## Important demo limitations
- **Email is not configured.** The app downloads a PDF to the user's computer; it does not email the PDF to the customer. SMTP/email-provider configuration and a backend email endpoint are needed for actual email delivery.
- User accounts and products are stored in in-memory JavaScript arrays. They reset when the backend restarts. This is intentional for this demo; no database setup is needed.
- The sample prices are placeholders. Replace them with approved selling prices and confirm GST, delivery and payment terms before using customer quotations.
- Demo passwords and authentication are for local testing only, not production use.
