# 🚗 AutoEdge — Your Complete "Get It Live" Guide

> **What is this?** A step-by-step checklist of everything YOU need to do manually to get your AutoEdge project fully published and working online. The code is 100% done — these are the setup and deployment steps that only a human can do.
>
> **How long will it take?** About 30–45 minutes if you do everything. Some steps are optional.
>
> **Do I need to pay for anything?** No. Every service used here has a free tier.

---

## 📋 Table of Contents

| Step | What | Required? | Time |
|---|---|---|---|
| [Step 1](#step-1--push-your-code-to-github) | Push your code to GitHub | ✅ Yes | 2 min |
| [Step 2](#step-2--get-car-photos-pexels-api-key) | Get car photos (Pexels API key) | ✅ Yes | 3 min |
| [Step 3](#step-3--run-the-car-photo-script) | Run the car photo script | ✅ Yes | 2 min |
| [Step 4](#step-4--set-up-cloudinary-for-trade-in-photos) | Set up Cloudinary (trade-in photos) | ⚡ Recommended | 5 min |
| [Step 5](#step-5--create-the-storefront-on-vercel) | Create the storefront on Vercel | ✅ Yes | 5 min |
| [Step 6](#step-6--update-railway-settings) | Update Railway settings | ✅ Yes | 5 min |
| [Step 7](#step-7--seed-the-database-with-demo-data) | Seed the database with demo data | ✅ Yes | 2 min |
| [Step 8](#step-8--set-up-email-sending-brevo) | Set up email sending (Brevo) | ❌ Optional | 10 min |
| [Step 9](#step-9--update-the-readme-with-your-live-urls) | Update README with live URLs | ✅ Yes | 2 min |
| [Step 10](#step-10--final-testing-checklist) | Final testing checklist | ✅ Yes | 10 min |

---

## Step 1 — Push Your Code to GitHub

Your code has lots of new changes that haven't been saved to GitHub yet. You need to push everything so that Vercel and Railway can pick it up.

### What to do:

1. Open a **terminal** (Command Prompt, PowerShell, or the terminal inside your code editor)

2. Navigate to your project folder:
   ```
   cd "c:\Users\musta\Desktop\Auto Edge Car Showroom"
   ```

3. Add all the new files:
   ```
   git add -A
   ```

4. Save them with a message:
   ```
   git commit -m "Complete storefront extension (P30-P48): customer accounts, reservations, test drives, service bookings, reviews, trade-ins, notifications, 99 tests"
   ```

5. Push to GitHub:
   ```
   git push origin main
   ```
   *(If your main branch is called `master` instead of `main`, use `git push origin master`)*

### ⚠️ Common problems:
- **"Please tell me who you are"** — Run these two commands first (use your own info):
  ```
  git config user.email "your-email@gmail.com"
  git config user.name "Your Name"
  ```
  Then try the commit again.

- **"Authentication failed"** — You may need to log into GitHub. If you use a password, GitHub now requires a "Personal Access Token" instead. Go to GitHub → Settings → Developer Settings → Personal Access Tokens → Generate one.

### ✅ How to know it worked:
Go to `https://github.com/Mustafa-Shams/autoedge` in your browser. You should see the `storefront/` folder and the updated `README.md` file.

---

## Step 2 — Get Car Photos (Pexels API Key)

Right now, your car listings show a placeholder gradient instead of real photos. Pexels is a free stock photo website that has real car photos. You need to get an API key (like a password that lets your app download photos).

### What to do:

1. Go to **https://www.pexels.com/api/** in your browser

2. Click **"Get Started"** or **"Join"**

3. Create a free account (you can use your Google account or email)

4. Once logged in, go back to **https://www.pexels.com/api/** and look for your **API Key**. It will be a long string of letters and numbers like `Abc123XYZ456...`

5. **Copy** that key

6. Open the file `backend/.env` in your project folder (use Notepad or your code editor)

7. Find the line that says:
   ```
   PEXELS_API_KEY=
   ```

8. Paste your key after the `=` sign. It should now look like:
   ```
   PEXELS_API_KEY=Abc123XYZ456YourActualKeyHere
   ```

9. **Save** the file

### ⚠️ Do NOT:
- Share your API key with anyone
- Put it in the README or any file that goes on GitHub
- Add spaces before or after the key

### ✅ How to know it worked:
You'll test this in the next step.

---

## Step 3 — Run the Car Photo Script

This script automatically searches Pexels for photos of each car in your showroom (Toyota Camry, BMW 3 Series, Tesla Model 3, etc.) and saves the photo links to your database.

### What to do:

1. Open a **terminal**

2. Navigate to the backend folder:
   ```
   cd "c:\Users\musta\Desktop\Auto Edge Car Showroom\backend"
   ```

3. Activate the Python environment:
   ```
   venv\Scripts\activate
   ```

4. Run the photo script:
   ```
   python database/fetch_vehicle_images.py
   ```

5. You should see output like:
   ```
   Fetching images for Toyota Camry 2023...
     Found 5 images
   Fetching images for Honda Civic 2022...
     Found 5 images
   ...
   ```

### ⚠️ Common problems:
- **"PEXELS_API_KEY not set"** — Go back to Step 2 and make sure you saved the `.env` file
- **"No images found for..."** — That's okay! Some cars are harder to find. The website will show a nice gradient placeholder instead. It won't look broken.

### ✅ How to know it worked:
After this step, when you run the website locally and visit a car page, you should see real car photos instead of a colored gradient.

---

## Step 4 — Set Up Cloudinary (For Trade-In Photos)

When a customer wants to trade in their old car, they can upload photos of it. Those photos get stored on Cloudinary (a free image hosting service). **If you skip this step**, everything else still works — customers just won't be able to upload trade-in photos.

### What to do:

1. Go to **https://cloudinary.com/** and click **"Sign Up Free"**

2. Create your account (Google sign-in is fastest)

3. After signup, you'll land on the **Dashboard**. Look for your **Cloud Name** at the top. It will be something like `dxyz1abc2`. **Copy it and write it down** — you'll need it later.

4. In the left sidebar, click **Settings** (the gear icon ⚙️)

5. Click **Upload** in the settings menu

6. Scroll down to **Upload presets** and click **"Add upload preset"**

7. Fill in these fields **exactly**:
   - **Upload preset name:** `autoedge_tradein`
   - **Signing Mode:** Choose **Unsigned** (this is important!)
   - **Folder:** `autoedge/trade-ins`

8. Under **Allowed formats**, type: `jpg, png, webp`

9. If there's a max file size option, set it to **5 MB**

10. Click **Save**

11. Now open `storefront/.env` in your project folder and fill in your cloud name:
    ```
    VITE_API_BASE_URL=http://localhost:8000
    VITE_CLOUDINARY_CLOUD_NAME=dxyz1abc2
    VITE_CLOUDINARY_UPLOAD_PRESET=autoedge_tradein
    ```
    Replace `dxyz1abc2` with YOUR actual cloud name from step 3.

12. **Save** the file

### ⚠️ Do NOT:
- Use "Signed" mode — it must be **Unsigned**
- Change the preset name from `autoedge_tradein` — the code expects exactly that name
- Forget to set the folder to `autoedge/trade-ins`

### ✅ How to know it worked:
You'll test this later when you try submitting a trade-in request on the storefront.

---

## Step 5 — Create the Storefront on Vercel

You already have your **Staff Dashboard** running on Vercel. Now you need to create a **second** Vercel project for the **Customer Storefront** — both from the same GitHub repo, but pointing to different folders.

### What to do:

1. Go to **https://vercel.com/** and log in to your existing account

2. Click **"Add New..."** → **"Project"**

3. You'll see a list of your GitHub repos. Find **autoedge** and click **"Import"**

4. **This is the important part — configure these settings:**

   - **Project Name:** Type something like `autoedge-storefront` (this will become your URL, e.g., `autoedge-storefront.vercel.app`)
   
   - **Framework Preset:** Select **Vite** from the dropdown
   
   - **Root Directory:** Click **"Edit"** next to it, and type `storefront` — then click the checkmark ✓
     > ⚠️ **This is critical!** If you leave it blank or set it to `frontend`, you'll deploy the staff dashboard again instead of the storefront. It MUST say `storefront`.

5. Click **"Environment Variables"** to expand that section

6. Add these three variables one by one (click "Add" after each):

   | Name (left box) | Value (right box) |
   |---|---|
   | `VITE_API_BASE_URL` | Your Railway backend URL (e.g., `https://autoedge-production.up.railway.app`) |
   | `VITE_CLOUDINARY_CLOUD_NAME` | Your Cloudinary cloud name from Step 4 (e.g., `dxyz1abc2`). Leave empty if you skipped Step 4. |
   | `VITE_CLOUDINARY_UPLOAD_PRESET` | `autoedge_tradein` |

   > 💡 **How to find your Railway URL:** Go to your Railway dashboard → click your backend service → look at the "Public Networking" section. It's the URL that ends in `.up.railway.app`.

7. Click **"Deploy"**

8. Wait about 1–2 minutes for it to build

### ⚠️ Do NOT:
- Set the Root Directory to `frontend` — that's the staff dashboard, not the storefront
- Forget the `VITE_API_BASE_URL` — without it, the storefront can't talk to your backend
- Add a trailing slash to the API URL (use `https://your-app.up.railway.app` NOT `https://your-app.up.railway.app/`)

### ⚠️ If the build fails:
- Check the build logs on Vercel — it will tell you what went wrong
- The most common issue is the Root Directory not being set to `storefront`
- If it says "Cannot find module", try clicking **Redeploy** — sometimes the first build has a hiccup

### ✅ How to know it worked:
After deployment, Vercel will give you a URL like `https://autoedge-storefront.vercel.app`. Click it. You should see the AutoEdge storefront homepage with a dark theme, a hero section, and featured cars.

**Write down this URL — you need it for the next step!**

---

## Step 6 — Update Railway Settings

Your backend needs to know about the new storefront URL so it can accept requests from it. Right now, it only accepts requests from your staff dashboard.

### What to do:

1. Go to **https://railway.app/** and log in

2. Click on your **autoedge** project

3. Click on your **backend service** (the one running your Python/FastAPI app)

4. Click the **"Variables"** tab

5. **Update the existing `CORS_ORIGINS` variable:**

   Find `CORS_ORIGINS` — it currently looks something like:
   ```
   https://autoedge.vercel.app,http://localhost:5173
   ```
   
   Add your new storefront URL to the end, separated by a comma, AND add `http://localhost:5174` for local development:
   ```
   https://autoedge.vercel.app,https://autoedge-storefront.vercel.app,http://localhost:5173,http://localhost:5174
   ```
   
   > Replace `https://autoedge-storefront.vercel.app` with YOUR actual storefront URL from Step 5.

6. **Add a new variable `STORE_BASE_URL`:**
   - Click **"New Variable"** (or the + button)
   - Name: `STORE_BASE_URL`
   - Value: Your storefront URL (e.g., `https://autoedge-storefront.vercel.app`)

7. **Add these business settings** (click "New Variable" for each):

   | Name | Value | What it does |
   |---|---|---|
   | `SHOWROOM_TIMEZONE` | `Asia/Karachi` | Sets the timezone for bookings |
   | `DEMO_STARTING_BALANCE` | `50000.00` | Each demo customer starts with $50,000 |
   | `RESERVATION_DEPOSIT_PERCENT` | `10` | Customers pay 10% to reserve a car |
   | `CANCELLATION_FEE_PERCENT` | `10` | 10% fee if they cancel a reservation |

   > 💡 These may already be set from your `.env` file. If Railway already has them, don't add duplicates — just leave them.

8. Railway will automatically **redeploy** when you save the variables. Wait for the deployment to finish (the green checkmark).

### ⚠️ Do NOT:
- Remove any existing URLs from `CORS_ORIGINS` — the staff dashboard needs its URL to stay there
- Add spaces between the URLs in `CORS_ORIGINS` — no spaces, just commas
- Add a trailing slash to any URL (`https://example.com` ✅ but `https://example.com/` ❌)

### ✅ How to know it worked:
After Railway redeploys, go to your storefront URL and try loading the Cars page. If the cars appear, the backend is accepting requests from the storefront. If you see an empty page or errors in the browser console about "CORS", double-check your `CORS_ORIGINS` spelling.

---

## Step 7 — Seed the Database with Demo Data

The "seed" is a script that fills your database with demo data — sample cars, demo customer accounts, example reviews, a reservation, an enquiry thread, etc. This makes the website look alive for your demo.

### What to do:

1. Open a **terminal**

2. Navigate to the backend folder:
   ```
   cd "c:\Users\musta\Desktop\Auto Edge Car Showroom\backend"
   ```

3. Activate the Python environment:
   ```
   venv\Scripts\activate
   ```

4. Make sure your `.env` file has the correct `DATABASE_URL` pointing to your **Neon** database (the online one, not a local one). It should look like:
   ```
   DATABASE_URL=postgresql://user:password@ep-something.us-east-2.aws.neon.tech/dbname?sslmode=require
   ```

5. Run the seed script:
   ```
   python database/storefront_seed.py
   ```

6. You should see a long output like:
   ```
   1. Backfilling existing vehicles...
     Updated: Toyota Camry 2023 (stock=4)
     Updated: Honda Civic 2022 (stock=2)
   ...
   7. Creating demo customers...
     Created: Ali Raza (demo1@example.com)
     Created: Sarah Khan (demo2@example.com)
     Created: Omar Farooq (demo3@example.com)
   ...
   ✅ Seed complete!
   ```

7. **This script is safe to run multiple times** — if the data already exists, it just skips it.

### ⚠️ Common problems:
- **"Connection refused"** — Your `DATABASE_URL` might be pointing to `localhost` instead of Neon. Check your `.env` file.
- **"relation does not exist"** — Run `alembic upgrade head` first to create the tables, then run the seed again.

### ✅ How to know it worked:
- Go to your storefront URL → Cars page. You should see 22 cars with photos (if you did Step 2–3), descriptions, prices, and stock counts.
- Try logging in with `demo1@example.com` / `Demo@1234`. You should see a bank balance of ~$50,000 and an active reservation for the Kia Sportage.

---

## Step 8 — Set Up Email Sending (Brevo) — OPTIONAL

> **⚡ You can skip this step.** Without email, everything still works perfectly. Customers still get in-app notifications (the bell icon 🔔). The only difference is that emails won't actually be sent — they'll be logged in the Email Log with status "Suppressed."

If you want actual emails to be sent (reservation confirmations, test drive updates, etc.):

### What to do:

1. Go to **https://www.brevo.com/** and click **"Sign Up Free"**

2. Create your account

3. After signing in, go to **Settings** (gear icon in top-right) → **SMTP & API** → **API Keys**

4. Click **"Generate a new API key"**, give it a name like `autoedge`, and click **Generate**

5. **Copy** the API key (it starts with `xkeysib-...`)

6. You need to **verify a sender email address** — this is the "from" address that emails will be sent from:
   - Go to **Settings** → **Senders & IPs** → **Senders**
   - Click **"Add a sender"**
   - Enter your Gmail (or any email you have access to)
   - Brevo will send a verification email to that address — open it and click the verification link

7. Now go to **Railway** and add these three variables:

   | Name | Value |
   |---|---|
   | `EMAIL_PROVIDER` | `brevo` |
   | `EMAIL_API_KEY` | `xkeysib-YourLongApiKeyHere...` |
   | `EMAIL_FROM_ADDRESS` | The email you verified in step 6 |

8. Railway will redeploy automatically.

### ⚠️ Important notes:
- Brevo's free tier gives you **300 emails per day** — more than enough for a demo
- Emails to `@example.com` addresses (like demo1@example.com) are automatically **suppressed** — this is by design so you don't waste your email quota on fake addresses
- If you want to test a real email, create a customer account with your real email address

### ✅ How to know it worked:
1. Create a new customer account on the storefront using **your real email** (not @example.com)
2. Make a reservation for a car
3. Check your inbox — you should receive a "Reservation Confirmed" email from AutoEdge
4. Check the staff dashboard → Email Log — you should see the entry with status "Sent"

---

## Step 9 — Update the README with Your Live URLs

Now that everything is deployed, update the README so anyone visiting your GitHub repo can see the live links.

### What to do:

1. Open `README.md` in the root of your project folder

2. Near the top, find these placeholder lines:
   ```
   - Staff Dashboard: `https://your-staff-url.vercel.app`
   - Customer Storefront: `https://your-storefront-url.vercel.app`
   - Backend API: `https://your-railway-url.up.railway.app`
   - API Docs: `https://your-railway-url.up.railway.app/docs`
   ```

3. Replace them with your **actual** URLs. For example:
   ```
   - Staff Dashboard: https://autoedge.vercel.app
   - Customer Storefront: https://autoedge-storefront.vercel.app
   - Backend API: https://autoedge-production.up.railway.app
   - API Docs: https://autoedge-production.up.railway.app/docs
   ```

4. **Save** the file

5. Push the update to GitHub:
   ```
   cd "c:\Users\musta\Desktop\Auto Edge Car Showroom"
   git add README.md
   git commit -m "Add live URLs to README"
   git push origin main
   ```

---

## Step 10 — Final Testing Checklist

Go through this checklist on your **live URLs** (not localhost). Check off each item as you verify it. This is what your teacher will see, so make sure everything works!

### 🌐 Public Website (no login needed)

Open your storefront URL and check:

- [ ] **Homepage loads** — You see a hero section, featured cars, and navigation
- [ ] **Cars page loads** — Shows a grid of cars with photos, prices, and stock badges
- [ ] **Filters work** — Try filtering by body type (Sedan, SUV), fuel type, price range
- [ ] **Search works** — Type "Toyota" in the search box → shows Toyota cars
- [ ] **Sort works** — Sort by price (low to high, high to low)
- [ ] **Car detail page** — Click any car → see photos (swipeable gallery), specs, reviews
- [ ] **"Only N left"** — Cars with 1–3 in stock show this warning badge
- [ ] **Out-of-stock car** — Ford F-150 and Chevy Camaro should be shaded with "Request this car" button
- [ ] **Photo credits** — On car detail, you see photographer name + "Images are for illustration only"
- [ ] **Compare page** — Add 2+ cars to compare → click Compare → see side-by-side table
- [ ] **EMI Calculator** — Works with sliders for price, down payment, interest
- [ ] **Service Info page** — Shows list of services with prices
- [ ] **Trade-in Info page** — Shows how trade-ins work
- [ ] **About page** — Loads without errors
- [ ] **Contact page** — Loads without errors
- [ ] **F5 refresh** — Press F5 on any page → it should NOT show a 404 error

### 👤 Accounts

- [ ] **Sign up** — Create a new account → works
- [ ] **Duplicate email rejected** — Try signing up again with the same email → shows error
- [ ] **Weak password rejected** — Try password "123" → shows error
- [ ] **Login** — Log in with `demo1@example.com` / `Demo@1234` → works
- [ ] **Full website visible after login** — All public pages still work + "My Account" menu appears
- [ ] **Profile page** — Shows your name and email, can update them

### 💰 Buying (log in as demo1@example.com)

- [ ] **Bank page** — Shows balance (~$47,500 after the seed reservation)
- [ ] **Active reservation** — Go to Reservations → see the Kia Sportage reservation
- [ ] **Make a new reservation** — Go to any in-stock car → click Reserve → choose 14 days → confirm
- [ ] **Balance dropped** — Check bank page → balance decreased by 10% of car price
- [ ] **Stock dropped** — Go back to that car's page → stock went down by 1
- [ ] **Cancel reservation** — Go to Reservations → cancel one → 90% refund appears in bank
- [ ] **Double-click protection** — Try clicking Reserve rapidly → only one reservation is made
- [ ] **Insufficient funds** — Try reserving an expensive car when balance is low → shows decline message
- [ ] **Request restock** — Click "Request this car" on an out-of-stock car → request submitted

### 🚗 Test Drives

- [ ] **Request a test drive** — On any car page → click "Book Test Drive" → pick a date → submit
- [ ] **Appears in My Test Drives** — Go to Account → Test Drives → see your request with status "Requested"

### 💬 Enquiries

- [ ] **Send an enquiry** — On any car page → click "Ask a Question" → type a message → send
- [ ] **Appears in My Enquiries** — Go to Account → Enquiries → see your thread
- [ ] **Demo thread** — Log in as `demo2@example.com` / `Demo@1234` → Enquiries → see the pre-made Toyota Camry conversation with a staff reply

### ⭐ Reviews

- [ ] **See existing reviews** — Go to Toyota Camry detail page → scroll to reviews → see ratings
- [ ] **Write a review** — Click "Write a Review" on any car → give it a rating and comment → submit

### 🔄 Trade-Ins (requires Cloudinary from Step 4)

- [ ] **Submit a trade-in** — Go to Account → Trade-Ins → "New Trade-In" → fill in car details → upload 3+ photos → submit
- [ ] **Appears in My Trade-Ins** — See your submission with status "Submitted"

### 🔧 Service Bookings

- [ ] **Add a car to garage** — Go to Account → Garage → "Add Vehicle" → fill in details → save
- [ ] **Book a service** — Go to Account → Service Bookings → "New Booking" → pick your garage car → choose service type → pick technician → pick date/time → confirm and pay
- [ ] **Booking fee charged** — Check bank page → small fee deducted

### 🔔 Notifications

- [ ] **Bell icon** — See the notification bell in the top navigation with an unread count
- [ ] **Click bell** — See notification list with welcome message and any recent activity

### 👨‍💼 Staff Dashboard (open your original Vercel URL)

- [ ] **Still works** — Log in as `admin@autoedge.com` / `Admin@1234`
- [ ] **Reservations page** — Sidebar → Reservations → see customer reservations
- [ ] **Can confirm test drives** — Test Drives page → see customer requests → confirm one
- [ ] **Email Log** — Shows sent/suppressed emails (if you set up Brevo in Step 8)

### 📱 Mobile & Technical

- [ ] **Mobile layout** — Open storefront on your phone (or resize browser to narrow) → everything fits, no horizontal scrolling
- [ ] **API docs** — Go to `https://your-railway-url.up.railway.app/docs` → Swagger docs load
- [ ] **No browser console errors** — Right-click → Inspect → Console tab → no red errors

---

## 🎉 You're Done!

If everything in the checklist passes, your project is complete and ready to demo. Here's a quick summary of what you have:

| What | Where |
|---|---|
| **Source code** | https://github.com/Mustafa-Shams/autoedge |
| **Staff Dashboard** | Your original Vercel URL |
| **Customer Storefront** | Your new Vercel URL from Step 5 |
| **Backend API** | Your Railway URL |
| **API Documentation** | Your Railway URL + `/docs` |
| **Database** | Neon PostgreSQL (27 tables) |

### Quick login cheatsheet:

| Who | Email | Password |
|---|---|---|
| Manager (staff) | admin@autoedge.com | Admin@1234 |
| Sales (staff) | sarah@autoedge.com | Admin@1234 |
| Technician (staff) | tom@autoedge.com | Admin@1234 |
| Receptionist (staff) | rita@autoedge.com | Admin@1234 |
| Customer 1 | demo1@example.com | Demo@1234 |
| Customer 2 | demo2@example.com | Demo@1234 |
| Customer 3 | demo3@example.com | Demo@1234 |

---

## ❓ Troubleshooting

### "The storefront shows a blank page"
→ Check that `VITE_API_BASE_URL` is set in your Vercel storefront project settings. It should be your Railway URL without a trailing slash.

### "Cars page shows no cars"
→ Run the seed script (Step 7). If already seeded, check that `CORS_ORIGINS` on Railway includes your storefront URL.

### "Photos aren't showing"
→ Run the Pexels photo script (Step 3). If you don't have a Pexels key, that's okay — cars will show a gradient placeholder.

### "Login doesn't work"
→ Make sure you ran the seed script. The demo accounts are created by the seed. Try `demo1@example.com` with password `Demo@1234` (capital D, @ symbol, numbers 1234).

### "Trade-in photo upload fails"
→ Check your Cloudinary setup (Step 4). Make sure the preset is named exactly `autoedge_tradein` and is set to **Unsigned** mode.

### "CORS error in browser console"
→ Go to Railway → Variables → check `CORS_ORIGINS`. Make sure your storefront URL is listed there, spelled exactly right, with no trailing slash and no spaces.

### "Railway shows 'Application Error'"
→ Check Railway deploy logs for the error. Common cause: a missing environment variable. Make sure `DATABASE_URL` and `SECRET_KEY` are set.
