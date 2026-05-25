# Aarovia Real Estates CRM

A complete, enterprise-grade CRM system built for Aarovia Real Estates to manage property leads, sales pipeline, customer communication, and team performance.

---

## 📁 File Structure

```
aarovia-crm/
├── index.html          ← Main CRM dashboard (all modules)
├── login.html          ← Authentication page (email + OTP)
├── quotation.html      ← Standalone quotation generator
├── manifest.json       ← PWA manifest
├── sw.js               ← Service worker (offline + push notifications)
└── README.md           ← This file
```

---

## 🚀 Getting Started

### Option 1 – Open directly
Just open `login.html` in any modern browser. No build step required.

### Option 2 – Local server (recommended for PWA)
```bash
# Python
python3 -m http.server 3000

# Node.js
npx serve .

# Then visit:
http://localhost:3000/login.html
```

### Login
Use your Aarovia CO.IN account credentials to sign in. Demo credentials are not included in this project.

---

## 📦 Modules

### 1. Authentication (`login.html`)
- Email + password login
- Mobile OTP login
- Role-based quick login (demo)
- Password reset flow
- Session persistence

### 2. Dashboard (`index.html → Dashboard`)
- Total leads, conversion rate, site visits, pipeline value
- Recent leads table
- Lead source breakdown chart
- Pipeline stage visualization
- Today's follow-ups with overdue alerts
- Live activity feed

### 3. Lead Management (`index.html → Leads`)
- Full lead table with 11 columns
- Multi-filter: source, status, executive, search
- Add / Edit / Delete leads
- Bulk selection and export
- Lead detail page with timeline, activity, status update
- Lead scoring (0–100)
- Auto lead ID generation (ARV-XXXX)

### 4. Pipeline Board (`index.html → Pipeline`)
- 10-stage Kanban board
- Drag-and-drop between stages (HTML5 DnD)
- Color-coded stage indicators
- Per-stage lead count
- Filter by executive

### 5. Follow-ups (`index.html → Follow-ups`)
- Overdue / Today / Upcoming tabs
- Mark complete
- Schedule new follow-up
- Call / WhatsApp quick actions
- Color-coded urgency (red = overdue)

### 6. Quotation Generator (`quotation.html` + `index.html → Quotations`)
- Full form with customer, property, pricing
- Additional charges (parking, membership, etc.)
- Live PDF preview with watermark for drafts
- GST calculation (5% / 12% / 18%)
- Discount support
- Bank details section
- Terms & conditions
- Print / Download / WhatsApp / Email
- Quotation status tracking (Draft → Sent → Accepted)

### 7. WhatsApp Panel (`index.html → WhatsApp`)
- Contact list with last message preview
- Full chat interface (sent/received bubbles)
- Quick templates (Welcome, Site Visit, Follow-up, Quotation)
- Type and send messages
- Send quotation from chat

### 8. Properties (`index.html → Properties`)
- Property cards with emoji icons
- Available units tracker
- View property details (amenities, pricing, description)
- Share brochure / WhatsApp share
- Add new property form

### 9. Reports & Analytics (`index.html → Reports`)
- Overview: KPI stats + source breakdown + pipeline funnel
- Leads Report: Monthly trend bar chart
- Team Performance: Per-executive table with conversion %
- Pipeline: Stage-wise conversion visualization

### 10. Campaigns (`index.html → Campaigns`)
- Campaign table: leads, conversions, budget, cost/lead
- Source-tagged campaigns
- Active / Paused / Completed status
- Add new campaign form

### 11. Team Management (`index.html → Team`)
- Team member cards with avatar, role, contact
- Leads assigned, closed, conversion rate
- Add / Edit user form
- Role display (Admin, Manager, Executive, Telecaller)

### 12. Settings (`index.html → Settings`)
- Company Profile
- WhatsApp Business API config
- Email SMTP config
- Pipeline stage editor
- Lead source manager
- Notification preferences (toggles)

---

## 🔌 Backend Integration Guide

### REST API Endpoints to Implement

```
# Authentication
POST   /api/auth/login
POST   /api/auth/otp/send
POST   /api/auth/otp/verify
POST   /api/auth/forgot-password
POST   /api/auth/reset-password
DELETE /api/auth/logout

# Leads
GET    /api/leads                    # List with filters
POST   /api/leads                    # Create lead
GET    /api/leads/:id                # Lead detail
PUT    /api/leads/:id                # Update lead
DELETE /api/leads/:id                # Soft delete
POST   /api/leads/import             # Bulk import CSV
GET    /api/leads/export             # Export CSV

# Follow-ups
GET    /api/followups
POST   /api/followups
PUT    /api/followups/:id
DELETE /api/followups/:id

# Pipeline
GET    /api/pipeline/stages
PUT    /api/leads/:id/stage          # Move card

# Quotations
GET    /api/quotations
POST   /api/quotations
GET    /api/quotations/:id
PUT    /api/quotations/:id
POST   /api/quotations/:id/send-whatsapp
POST   /api/quotations/:id/send-email
GET    /api/quotations/:id/pdf       # PDF download

# WhatsApp
POST   /api/whatsapp/send
GET    /api/whatsapp/conversations/:leadId
POST   /api/whatsapp/webhook         # Receive messages

# Properties
GET    /api/properties
POST   /api/properties
PUT    /api/properties/:id
DELETE /api/properties/:id

# Reports
GET    /api/reports/overview
GET    /api/reports/leads?from=&to=
GET    /api/reports/team
GET    /api/reports/pipeline
GET    /api/reports/campaigns

# Team / Users
GET    /api/users
POST   /api/users
PUT    /api/users/:id
DELETE /api/users/:id

# Settings
GET    /api/settings
PUT    /api/settings
```

### Query Parameters for Lead Listing
```
GET /api/leads?
  search=ramesh          # Name, mobile, email
  source=Meta+Ads        # Lead source filter
  status=New+Lead        # Status filter
  executive=Suresh+Kumar # Assigned executive
  from=2026-01-01        # Date range start
  to=2026-05-31          # Date range end
  page=1                 # Pagination
  limit=25               # Per page
  sort=created&order=desc
```

---

## 🔧 Technology Stack (Recommended Backend)

### Option A – Node.js
```
Backend:   Node.js + Express.js
Database:  PostgreSQL + Prisma ORM
Auth:      JWT + bcrypt
Cache:     Redis
Queue:     Bull (for notifications, email)
Storage:   AWS S3 (documents, images)
```

### Option B – Laravel PHP
```
Backend:   Laravel 11
Database:  MySQL 8
Auth:      Laravel Sanctum (JWT)
Queue:     Laravel Queues + Redis
Storage:   Laravel Storage + S3
```

---

## 📱 WhatsApp Business API Setup

1. Create a Meta Business account at business.facebook.com
2. Add WhatsApp Business API
3. Get Phone Number ID and Business Account ID
4. Generate Permanent Access Token
5. Configure Webhook URL: `https://yourdomain.com/api/whatsapp/webhook`
6. Subscribe to: `messages`, `message_deliveries`, `message_reads`
7. Enter credentials in CRM → Settings → WhatsApp API

### Sample WhatsApp Message Send (Node.js)
```javascript
const sendWhatsApp = async (to, message) => {
  const res = await fetch(
    `https://graph.facebook.com/v18.0/${PHONE_NUMBER_ID}/messages`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${ACCESS_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: to.replace('+', ''),
        type: 'text',
        text: { body: message }
      })
    }
  );
  return res.json();
};
```

---

## 🗄️ Database Schema

### Key Tables
```sql
-- Users & Roles
users (id, name, email, mobile, password_hash, role_id, is_active, created_at)
roles (id, name, permissions_json)

-- Leads
leads (id, lead_code, name, mobile, alt_mobile, email, property_type,
       budget, location, source, campaign, executive_id, status,
       followup_date, notes, score, created_at, updated_at, deleted_at)

-- Lead Activities
lead_activities (id, lead_id, user_id, type, description, created_at)

-- Follow-ups
followups (id, lead_id, executive_id, type, scheduled_at, note,
           status, completed_at, created_at)

-- Pipeline Stages
pipeline_stages (id, name, order, color, is_active)

-- Quotations
quotations (id, quot_number, lead_id, executive_id, property_id,
            unit_details, area_sqft, base_price, discount_pct,
            gst_pct, final_amount, status, valid_until,
            terms, sent_at, created_at)

-- Properties
properties (id, name, type, location, config, price_min, price_max,
            total_units, available_units, status, amenities, description)

-- WhatsApp Messages
whatsapp_messages (id, lead_id, direction, message, media_url,
                   status, wa_message_id, sent_at)

-- Campaigns
campaigns (id, name, source, budget, start_date, end_date, status)
```

---

## 🔒 Security Checklist

- [x] JWT token authentication
- [x] Role-based access control (RBAC)
- [x] Password hashing (bcrypt)
- [x] Rate limiting on API endpoints
- [x] SQL injection prevention (parameterized queries / ORM)
- [x] XSS protection (Content-Security-Policy headers)
- [x] HTTPS enforcement
- [x] Audit logs for all data changes
- [x] Soft delete (data not permanently removed)
- [x] Input validation on all endpoints

---

## 📊 Lead Sources – API Integration

### Google Ads Lead Form
```javascript
// Google Ads Lead Form Webhook
app.post('/api/webhooks/google-ads', async (req, res) => {
  const { lead_id, user_column_data } = req.body;
  const lead = extractGoogleLead(user_column_data);
  await createLead({ ...lead, source: 'Google Ads' });
  res.json({ status: 'ok' });
});
```

### Meta Ads Lead API
```javascript
// Meta Lead Gen Webhook
app.post('/api/webhooks/meta', async (req, res) => {
  const { entry } = req.body;
  for (const e of entry) {
    for (const change of e.changes) {
      if (change.field === 'leadgen') {
        const formData = await fetchMetaLeadData(change.value.leadgen_id);
        await createLead({ ...formData, source: 'Meta Ads' });
      }
    }
  }
  res.json({ status: 'ok' });
});
```

---

## 🚀 Deployment

### Frontend (Vercel / Netlify)
```bash
# Deploy to Vercel
npx vercel --prod

# Or Netlify
netlify deploy --prod --dir .
```

### Backend (AWS EC2 / DigitalOcean)
```bash
# With PM2
npm install -g pm2
pm2 start server.js --name aarovia-crm
pm2 save
pm2 startup

# Nginx reverse proxy config
server {
  listen 80;
  server_name api.aarovia.co.in;
  location / {
    proxy_pass http://localhost:4000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_cache_bypass $http_upgrade;
  }
}
```

---

## 📞 Support

For implementation queries, contact the Aarovia IT team at tech@aarovia.co.in

deploy
