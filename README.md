# 🏏 IPL Stats Dashboard

A **full-stack cricket analytics dashboard** covering all IPL seasons from **2008 to 2025**. Features interactive visualizations, custom-derived metrics, player comparisons, head-to-head team battles, and real-time WebSocket updates — built with **React**, **Node.js**, **Express**, and **MongoDB**.

![Node.js](https://img.shields.io/badge/Node.js-18+-339933?logo=node.js&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)
![Express](https://img.shields.io/badge/Express-5-000000?logo=express&logoColor=white)
![MongoDB](https://img.shields.io/badge/MongoDB-Atlas-47A248?logo=mongodb&logoColor=white)
![TailwindCSS](https://img.shields.io/badge/TailwindCSS-4-06B6D4?logo=tailwindcss&logoColor=white)

---

## ✨ Features

### 📊 Dashboard & Stats
- **Season Overview** — Total matches, runs, wickets, sixes, and averages per season
- **Points Table** — Complete standings with NRR, wins, losses for any season
- **Season Stats** — Deep-dive into season-level trends and records
- **Venue Stats** — Ground-wise match distribution and win patterns

### 👥 Player Analytics
- **Player Profiles** — Batting & bowling career stats with season-wise breakdowns
- **Player Comparison** — Side-by-side comparison of any two players across all metrics
- **Batter vs Bowler Matchup** — Head-to-head records between specific batters and bowlers
- **Phase Stats** — Performance split across Powerplay (1–6), Middle (7–15), and Death (16–20) overs
- **Player Search** — Smart search with fuzzy matching and ranking

### 🆚 Team Features
- **Team Profiles** — Career stats, win/loss records, season-wise performance
- **Head-to-Head** — Complete battle history between any two IPL teams
- **Toss Impact Analysis** — How toss decisions affect match outcomes
- **Wins by Venue** — Team-wise venue dominance

### 🧠 Custom Analytics Engine
Three original derived metrics that go beyond raw stats:

| Metric | What It Measures | Formula Components |
|--------|------------------|--------------------|
| **BIS** — Batting Impact Score | Match-winning batting contribution | SR factor, boundary weight, finish bonus, death-over pressure |
| **BPI** — Bowling Pressure Index | Pressure created by bowlers | Dot ball %, wickets/match, economy factor, death clutch |
| **DOR** — Death Over Rating | Performance in overs 16–20 | Phase-specific batting/bowling effectiveness |

### 🏆 Leaderboards
- Orange Cap (most runs)
- Purple Cap (most wickets)
- Best Strike Rate, Best Economy
- Most Sixes, Most Fours
- Most Player of the Match awards

### 🔍 Advanced Match Filter
Multi-parameter query builder with filters for:
- Season range, venue, teams
- Toss winner, toss decision
- Bat-first team, match winner
- Super Over matches, result type

### ⚡ Performance & Architecture
- **In-memory API caching** with TTL and cache-hit tracking
- **Lazy-loaded routes** — only the visited page's JS loads
- **Gzip compression** — ~70% smaller payloads
- **WebSocket** — Real-time server notifications
- **RBAC** — Role-based access control (admin/viewer)
- **Input validation** via express-validator
- **Error boundaries** on both client and server

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 19, React Router 7, Recharts, Lucide Icons, TailwindCSS 4 |
| **Backend** | Node.js, Express 5, Mongoose 9, WebSocket (ws) |
| **Database** | MongoDB Atlas |
| **Build** | Vite 6 with code-splitting & vendor chunking |
| **Dev Tools** | Nodemon, Morgan logging, API metrics endpoint |

---

## 📁 Project Structure

```
├── client/                    # React frontend (Vite)
│   ├── src/
│   │   ├── components/
│   │   │   ├── layout/        # Navbar, Sidebar
│   │   │   ├── pages/         # Dashboard, Teams, Players, Analytics, etc.
│   │   │   └── ui/            # Reusable components (StatCard, TeamLogo, etc.)
│   │   ├── services/api.js    # Axios API layer with client-side caching
│   │   └── utils/             # Team logos mapping
│   ├── vercel.json            # Vercel SPA rewrite config
│   └── vite.config.js         # Vite config with proxy & chunking
│
├── server/                    # Express backend
│   ├── config/db.js           # MongoDB connection
│   ├── controllers/           # Route handlers
│   │   ├── analyticsController.js  # BIS, BPI, DOR custom metrics
│   │   ├── playerController.js     # Player stats & search
│   │   ├── statsController.js      # Overview, points table, leaderboards
│   │   ├── matchController.js      # Scorecard, commentary, filtering
│   │   └── teamController.js       # Team stats & toss analysis
│   ├── middleware/
│   │   ├── errorHandler.js    # Global error handling + AppError class
│   │   ├── metrics.js         # Request tracking & response time metrics
│   │   ├── rbac.js            # Token-based role authentication
│   │   └── validators.js      # express-validator rules
│   ├── models/                # Mongoose schemas (Match, Delivery, PlayerImage)
│   ├── routes/                # Express route definitions
│   ├── scripts/importData.js  # CSV → MongoDB import script
│   └── .env.example           # Environment variable template
│
└── package.json               # Root scripts for deployment
```

---

## 🚀 Getting Started

### Prerequisites
- **Node.js** ≥ 18
- **MongoDB Atlas** account (or local MongoDB)
- **Git**

### Installation

```bash
# Clone the repo
git clone https://github.com/vikashkr1712/IPL-Stats-Dashboard.git
cd IPL-Stats-Dashboard

# Install server dependencies
cd server
npm install

# Install client dependencies
cd ../client
npm install
```

### Environment Setup

Create `server/.env` based on the template:

```env
PORT=5000
NODE_ENV=development
MONGODB_URI=mongodb+srv://<username>:<password>@<cluster>.mongodb.net/ipl_dashboard
ADMIN_TOKEN=your-secure-admin-token
ALLOWED_ORIGINS=http://localhost:3000
```

### Import Data

```bash
cd server
npm run import
```

### Run Locally

```bash
# Terminal 1 — Start backend
cd server
npm run dev

# Terminal 2 — Start frontend
cd client
npm run dev
```

Open **http://localhost:3000** in your browser.

---

## 🌐 Deployment

### Backend → Render

| Setting | Value |
|---------|-------|
| **Root Directory** | `server` |
| **Build Command** | `npm install` |
| **Start Command** | `node app.js` |

**Environment Variables on Render:**

| Key | Value |
|-----|-------|
| `NODE_ENV` | `production` |
| `MONGODB_URI` | Your MongoDB Atlas connection string |
| `ADMIN_TOKEN` | Your admin secret |
| `ALLOWED_ORIGINS` | `https://your-app.vercel.app` |

### Frontend → Vercel

| Setting | Value |
|---------|-------|
| **Framework** | Vite |
| **Root Directory** | `client` |
| **Build Command** | `npm run build` |
| **Output Directory** | `dist` |

**Environment Variables on Vercel:**

| Key | Value |
|-----|-------|
| `VITE_API_URL` | `https://your-api.onrender.com` |

---

## 📡 API Endpoints

<details>
<summary><strong>Stats</strong></summary>

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/stats/overview?season=` | Dashboard overview stats |
| GET | `/api/stats/seasons` | List all IPL seasons |
| GET | `/api/stats/points-table?season=` | Points table |
| GET | `/api/stats/headtohead?team1=&team2=` | Head-to-head comparison |
| GET | `/api/stats/team-wins?season=` | Total wins per team |
| GET | `/api/stats/venue-stats?season=` | Venue-wise stats |
| GET | `/api/stats/leaderboard?category=&season=` | Leaderboards |
| GET | `/api/stats/leaderboard/categories` | Available categories |
| GET | `/api/stats/playoffs?season=` | Playoff matches |

</details>

<details>
<summary><strong>Players</strong></summary>

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/players/search?q=` | Smart player search |
| GET | `/api/players/compare?p1=&p2=` | Player comparison |
| GET | `/api/players/top-batsmen?season=&limit=` | Top run scorers |
| GET | `/api/players/top-bowlers?season=&limit=` | Top wicket takers |
| GET | `/api/players/matchup?batter=&bowler=` | Batter vs bowler |
| GET | `/api/players/:name/batting` | Player batting stats |
| GET | `/api/players/:name/bowling` | Player bowling stats |
| GET | `/api/players/:name/season-wise` | Season-wise breakdown |
| GET | `/api/players/:name/phase-stats` | Phase-wise splits |

</details>

<details>
<summary><strong>Analytics</strong></summary>

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/analytics/batting-impact?season=&limit=` | Batting Impact Score |
| GET | `/api/analytics/bowling-pressure?season=&limit=` | Bowling Pressure Index |
| GET | `/api/analytics/death-rating?season=&type=` | Death Over Rating |
| GET | `/api/analytics/player/:name` | All metrics for a player |

</details>

<details>
<summary><strong>Matches</strong></summary>

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/matches/recent?page=&limit=` | Paginated recent matches |
| GET | `/api/matches/filter?seasonFrom=&venue=&...` | Advanced multi-filter |
| GET | `/api/matches/filter/options` | Available filter values |
| GET | `/api/matches/:id/scorecard` | Full match scorecard |
| GET | `/api/matches/:id/commentary?inning=` | Ball-by-ball commentary |

</details>

<details>
<summary><strong>Teams</strong></summary>

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/teams` | All IPL teams |
| GET | `/api/teams/:name` | Team career stats |
| GET | `/api/teams/:name/season-wise` | Season-wise breakdown |
| GET | `/api/teams/wins-by-venue` | Venue-wise wins |
| GET | `/api/teams/toss-impact` | Toss decision impact |

</details>

---

## 🔑 Authentication

| Role | Access |
|------|--------|
| **Public** | All data endpoints (read-only) |
| **Viewer** | Same as public (token validates identity) |
| **Admin** | Metrics, cache control, token management, data re-import |

Pass token via `x-api-key` header or `?apiKey=` query parameter.

---

## 📊 Data Source

IPL ball-by-ball and match data from **2008 to 2025** sourced from [Kaggle IPL Dataset](https://www.kaggle.com/datasets). The raw CSV data is imported into MongoDB using the included import script.

---

## 👨‍💻 Author

**Vikash Kumar** — [GitHub](https://github.com/vikashkr1712)

---

## 📄 License

This project is licensed under the ISC License.
