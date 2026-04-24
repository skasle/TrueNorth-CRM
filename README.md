# 8/0 CRM

Investor pipeline app. React + Vite + Firebase Auth + Firestore.

## Stack

- **Frontend:** React 18 + Vite
- **Database:** Firestore (`investors` collection in `by0-crm` project)
- **Auth:** Firebase Google Sign-In (allowlisted to 8/0 emails)
- **CSV:** PapaParse for import/export
- **Deploy:** Vercel

## Local dev

```bash
npm install
npm run dev
# → http://localhost:5173
```

## Deploy to Vercel via GitHub

1. Push this repo to GitHub:
   ```bash
   git init
   git add .
   git commit -m "initial commit"
   git remote add origin https://github.com/YOUR_USERNAME/by0-crm.git
   git push -u origin main
   ```

2. Go to [vercel.com](https://vercel.com) → New Project → Import from GitHub → select `by0-crm`
   - Framework: Vite (auto-detected)
   - No environment variables needed (config is hardcoded in `src/firebase.js`)
   - Deploy

3. Copy your Vercel URL (e.g. `by0-crm.vercel.app`)

4. Add to Firebase Auth authorized domains:
   - [Firebase Console](https://console.firebase.google.com) → `by0-crm` → Authentication → Settings → Authorized Domains
   - Add `by0-crm.vercel.app` (without https://)

5. Share the URL with JP.

## Auth

Restricted to these emails:
- sam@eightbyzero.com
- jp@eightbyzero.com
- samkasle@gmail.com
- jpcarmona7@gmail.com

To add more users: edit `ALLOWED_EMAILS` in `src/App.jsx` and update Firestore Security Rules.

## Firestore schema

Collection: `investors`

| Field | Type | Notes |
|---|---|---|
| firstName | string | |
| lastName | string | |
| firm | string | |
| email | string | |
| status | string | Reach Out, Intro, Nurture, SIP, Terms, Research, HOLD, Declined, Nothing |
| followUp | string | M/D/YYYY |
| owner | string | Sam, JP, or empty |
| source | string | |
| priority | number | 1–10, used for pipeline sort |
| linkedIn | string | |
| captainsLog | string | Log entries prefixed with dates (M/D/YYYY) for staleness tracking |
| createdAt | timestamp | |
| updatedAt | timestamp | |

## Staleness tracking

The app parses the first date line in `captainsLog` (format: `M/D/YYYY`) to calculate days since last touch. Keep entries prefixed with dates to get accurate staleness.

## Future: Claude skill integration

The morning brief and priority scan skills can read/write Firestore directly via REST API once authenticated. See `by0-crm` Firebase project.
