# Dalyda Stock Manager — Frontend

## Deploying to Vercel (Frontend) + Railway (Backend)

This guide walks through deploying the frontend to Vercel and connecting it to the backend deployed on Railway.

---

### Prerequisites

- A [Vercel](https://vercel.com) account
- A [GitHub](https://github.com) account with this repo
- The backend already deployed on [Railway](https://railway.app)

---

### Step 1 — Get the Backend URL from Railway

1. Go to your project on [Railway](https://railway.app)
2. Open the backend service
3. Go to **Settings → Networking** and copy the public domain, e.g.:
   ```
   https://dalyda-backend.up.railway.app
   ```
4. Your API base URL will be:
   ```
   https://dalyda-backend.up.railway.app/api/v1
   ```

---

### Step 2 — Deploy Frontend to Vercel

1. Go to [https://vercel.com](https://vercel.com) and sign in
2. Click **Add New → Project**
3. Import this repository from GitHub
4. Leave the framework preset as **Next.js**
5. Before clicking Deploy, go to **Environment Variables** and add:

   | Name | Value |
   |------|-------|
   | `NEXT_PUBLIC_API_URL` | `https://dalyda-backend.up.railway.app/api/v1` |

   Replace the URL with your actual Railway backend URL. Make sure there is **no trailing slash**.

6. Click **Deploy**

---

### Step 3 — Configure Backend CORS

The backend must allow requests from your Vercel domain. In the Spring Boot CORS configuration:

```java
config.setAllowedOriginPatterns(List.of("*"));
```

Or specifically:
```java
config.setAllowedOrigins(List.of("https://your-app.vercel.app"));
```

---

### Step 4 — Updating the Backend URL

If the Railway backend URL ever changes:

1. Go to your project on Vercel
2. Navigate to **Settings → Environment Variables**
3. Update `NEXT_PUBLIC_API_URL` with the new URL
4. Go to **Deployments** and click **Redeploy** on the latest deployment

---

### Running Locally

```bash
npm install
npm run dev
```

Create a `.env.local` file in the project root:

```env
NEXT_PUBLIC_API_URL=https://dalyda-backend.up.railway.app/api/v1
```

---

### Tech Stack

- [Next.js 15](https://nextjs.org) — React framework
- [Tailwind CSS](https://tailwindcss.com) — Styling
- [Zustand](https://zustand-demo.pmnd.rs) — State management
- [Lucide React](https://lucide.dev) — Icons
