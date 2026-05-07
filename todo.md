# PrintPortal MVP - Todo

## Database & Schema
- [x] Devices table (id, name, printNodePrinterId, pricePerPage, qrToken, createdAt)
- [x] PrintJobs table (id, deviceId, sessionToken, status, totalPages, totalCost, paymentRef, createdAt)
- [x] PrintJobFiles table (id, jobId, fileName, fileType, fileKey, pageCount, copies)
- [x] Settings table (key, value) for global config
- [x] Run migrations

## Backend - tRPC Routers
- [x] Device router: create, list, get by QR token, update price
- [x] Print job router: create session, add files, get job, update status
- [x] File upload router: upload to S3, detect page count (PDF/DOCX/image)
- [x] Payment router: create order, webhook handler, confirm payment
- [x] PrintNode router: dispatch job, get print status
- [x] Admin router: list all jobs, stats dashboard

## User-Facing Portal
- [x] Landing page / scan QR entry point
- [x] Upload page: drag-and-drop file upload (PDF, DOCX, JPG, PNG)
- [x] Per-file page count display and copy quantity selector
- [x] Order summary screen: file list, page counts, copies, total price
- [x] Payment screen with total cost
- [x] Payment confirmation / thank you screen
- [x] Job status tracking page (pending → paid → printing → done)

## Admin Panel
- [x] Admin login (role-based access)
- [x] Dashboard: active jobs, revenue stats
- [x] Device management: add/edit devices, generate QR codes
- [x] Price per page setting per device
- [x] Print job queue: list all jobs with status
- [x] Job detail view: files, status, payment info
- [x] Manual status override for jobs

## Payment & Dispatch
- [x] Payment webhook endpoint (/api/payment/webhook)
- [x] Payment confirmation triggers print dispatch
- [x] PrintNode API integration: send PDF to printer
- [x] Job status transitions: pending → paid → printing → done

## Polish & Testing
- [x] Elegant UI design: refined typography, generous whitespace, premium feel
- [x] Responsive design for mobile (user portal) and desktop (admin)
- [x] Loading states, error handling, empty states
- [x] Vitest unit tests for core backend logic (22 tests passing)
- [x] Competitor research report document

## Bug Fixes (Phase 7)

- [x] Fix session persistence: store sessionToken in localStorage so page refresh doesn't create a new session
- [x] Fix createSession to reuse existing pending session for same device (prevent duplicate sessions)
- [x] Fix file list sync: load files from server getJob response on mount
- [x] Test full end-to-end flow: upload → summary → payment confirmation → status page
