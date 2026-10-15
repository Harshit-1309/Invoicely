# Zoho Invoice Automation System

This project is an automated pipeline designed to fetch unread emails containing invoice attachments, intelligently verify them using AI, extract data from the PDFs, and automatically create and attach them as Bills in Zoho Books.

The system is split into two main components:
1. **A Custom Node.js Backend API** that securely interfaces with Zoho Mail.
2. **An n8n Workflow** that orchestrates the logic, AI verification, human-in-the-loop approvals, and Zoho Books integration.

---

## 🏗️ Architecture Overview

### 1. The Node.js Backend
The backend is an Express server running locally (typically on port 3000) that acts as a bridge between n8n and the Zoho Mail API. It exposes a direct endpoint (`/mcp-direct`) that n8n can hit via HTTP requests to execute specific tools.

* **`server.ts`**: The main entry point that spins up the HTTP server and handles routing.
* **`fetchZohoEmails.ts`**: Connects to Zoho Mail to fetch unread emails. It specifically looks for emails with attachments, filters for `.pdf` files, and constructs a clean JSON array of attachments (including `attachmentId` and `name`).
* **`fetchZohoAttachments.ts`**: Takes a specific `messageId`, `folderId`, and `attachmentId` to download the actual PDF binary buffer from Zoho Mail so it can be passed to n8n.

### 2. The n8n Workflow Process
The n8n workflow handles the actual business logic. It runs in a parallel batch processing mode to handle multiple invoices simultaneously.

#### **Phase 1: Fetching & Splitting**
1. **Manual Trigger**: Starts the workflow.
2. **Fetch Recent Emails**: An HTTP Request node that calls our local backend (`get_recent_zoho_emails`) to pull down unread emails.
3. **Split Out**: Takes the array of emails and splits them into individual items so n8n can process them one by one.
4. **Split Out 2**: Takes the `attachments` array within an email and splits it. If an email has 3 PDF invoices, this node generates 3 separate items, duplicating the email subject/body for each one.
5. **Loop Over Items**: Uses a dynamic batch size expression (`{{ $input.all().length }}`) to grab all incoming attachments and push them down the pipeline simultaneously (in parallel).

#### **Phase 2: AI Verification & Extraction**
6. **If has attachment**: A safety check to ensure the item actually contains attachment metadata.
7. **Basic LLM Chain**: Reads the email's Subject and Body to determine if the attached file is genuinely an invoice/bill. If it is, it also extracts the invoice number (which can act as a fallback password for encrypted PDFs).
8. **Is Invoice?**: An IF node that drops non-invoice items.
9. **Edit Fields 1 & Split Out Attachments**: Prepares the attachment data and splits them so multiple PDFs in one email are processed individually.
10. **Download Attachment**: Calls our backend to download the real PDF file.
11. **Switch & Unzip**: Routes compressed files (like ZIPs) to be unzipped (`Unzip/Decompress`) and split out into individual PDFs before proceeding.
12. **Extract From File**: Native n8n node that extracts raw text directly from the PDF binary.
    * **Error Handling (Encrypted PDFs)**: If the PDF is encrypted, this node fails and routes to an error path. It attempts to decrypt the PDF using the extracted invoice number as the password, and sends an alert email if unsuccessful.
13. **LLM Chain 2**: Takes the raw extracted text from the PDF and parses it into structured JSON (Vendor Name, Invoice Date, Total Amount, Line Items).

#### **Phase 3: Chart of Accounts & Advanced Parsing**
14. **Get Chart of Accounts**: Fetches the active Chart of Accounts from Zoho Books via HTTP Request.
15. **Merge**: Combines the structured invoice data with the Chart of Accounts list.
16. **LLM Chain 3**: The AI intelligently maps the extracted line items to the correct Zoho Account IDs based on the fetched Chart of Accounts context.
17. **Edit Fields & Filter**: Cleans up the fully structured invoice data, ensuring all line items have valid properties, account mappings, and removes empty fields before final submission.

#### **Phase 4: Zoho Books Integration (Sub-Workflow)**
18. **Call Invoice Sub-Workflow**: The fully parsed, structured, and mapped invoice data is passed to a dedicated sub-workflow which handles the heavy lifting in Zoho Books:
    * **Vendor Lookup**: Searches Zoho Books to see if the extracted Vendor exists.
    * **Human Approval / Creation**: If new, it waits for human approval or automatically creates the Vendor in Zoho.
    * **Create Bill**: Formats the final JSON body (using the dynamically mapped `account_id`s) and creates the official **Bill** in Zoho Books.

---

## 🚀 Running the Application

1. **Start the Backend**:
   Open a terminal in the project directory and run:
   ```bash
   npm run dev
   ```
   *This compiles the TypeScript code and starts the Express server on `http://localhost:3000`.*

2. **Start n8n**:
   Open a second terminal and start your n8n instance:
   ```bash
   n8n start
   ```

3. **Execute**:
   Navigate to your n8n dashboard, open the workflow, and hit **Execute Workflow**. It will automatically reach out to your local backend, fetch the emails, and begin the magic!
