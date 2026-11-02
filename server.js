const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

// Ensure data and uploads directories exist
const dataDir = path.join(__dirname, 'data');
const uploadsDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const articlesFile = path.join(dataDir, 'articles.json');
const settingsFile = path.join(dataDir, 'settings.json');
const authFile = path.join(dataDir, 'auth.json');

// --- AUTHENTICATION & SECURITY CONFIGURATION ---
const DEFAULT_CMS_PASSWORD = 'newsfour2026';
const AUTH_SALT = 'newsfour_cms_salt_2026';

function hashPassword(pwd) {
  return crypto.createHash('sha256').update(String(pwd) + AUTH_SALT).digest('hex');
}

function initAuth() {
  const defaultAuth = {
    passwordHash: hashPassword(DEFAULT_CMS_PASSWORD),
    updatedAt: new Date().toISOString()
  };
  return readJson(authFile, defaultAuth);
}

// In-memory active sessions map (token -> { createdAt, expiresAt })
const activeSessions = new Map();

function getAuthToken(req) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7).trim();
  }
  if (req.headers['x-auth-token']) {
    return req.headers['x-auth-token'].trim();
  }
  const cookieHeader = req.headers.cookie;
  if (cookieHeader) {
    const match = cookieHeader.match(/(?:^|;\s*)cms_token=([^;]+)/);
    if (match) return decodeURIComponent(match[1]);
  }
  if (req.query && req.query.token) {
    return req.query.token.trim();
  }
  return null;
}

function isSessionValid(token) {
  if (!token) return false;
  const session = activeSessions.get(token);
  if (!session) return false;
  if (Date.now() > session.expiresAt) {
    activeSessions.delete(token);
    return false;
  }
  return true;
}

function requireAuthApi(req, res, next) {
  const token = getAuthToken(req);
  if (isSessionValid(token)) {
    return next();
  }
  return res.status(401).json({ error: 'Unauthorized. Please login to the Editorial Desk CMS.' });
}

function requireAuthPage(req, res, next) {
  const token = getAuthToken(req);
  if (isSessionValid(token)) {
    return next();
  }
  return res.redirect('/login.html');
}

// Middleware
app.use(cors());
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));

// 🔒 Protected CMS Page Route (Gates /admin and /admin.html)
app.get(['/admin', '/admin.html'], requireAuthPage, (req, res) => {
  res.sendFile('admin.html', { root: path.join(__dirname, 'public') });
});

// Serve public static assets
app.use(express.static(path.join(__dirname, 'public')));

// Helper to read/write JSON
function readJson(file, defaultVal) {
  try {
    if (!fs.existsSync(file)) {
      fs.writeFileSync(file, JSON.stringify(defaultVal, null, 2), 'utf8');
      return defaultVal;
    }
    const raw = fs.readFileSync(file, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    console.error(`Error reading ${file}:`, err);
    return defaultVal;
  }
}

function writeJson(file, data) {
  try {
    fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.error(`Error writing ${file}:`, err);
    return false;
  }
}

// Multer storage for image uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const safeName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
    cb(null, safeName);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed.'));
    }
  }
});

// Initial seed data if file is empty
const defaultSettings = {
  portalName: 'NEWSഫോർ',
  tagline: "THE PEOPLE'S NEWSROOM",
  breakingNews: {
    enabled: true,
    items: [
      {
        id: 'brk-1',
        text: 'പെരുമ്പാവൂരിൽ വാക്കുതർക്കം: മൂന്നു പേര്‍ക്ക് കുത്തേറ്റു; അസം സ്വദേശികളായ നാലുപേർ അറസ്റ്റിൽ',
        link: '/article.html?id=art-002'
      }
    ],
    updatedAt: new Date().toISOString()
  }
};

const defaultArticles = [
  {
    id: 'art-001',
    title: 'City Council Approves Landmark $45M Public Transit Expansion',
    slug: 'city-council-approves-transit-expansion',
    excerpt: 'The multi-year package will introduce rapid electric bus routes, modernize terminal hubs, and connect underserved eastern neighborhoods.',
    content: `In a historic 7-2 vote late Friday evening, the Municipal Council approved a comprehensive $45 million public transit modernization initiative aimed at overhauling regional mobility over the next four years.

The flagship investment will finance three new high-capacity electric bus rapid transit (BRT) corridors, linking suburban neighborhoods with the central hospital district and university campus.

### Community Reactions and Funding Breakdown

"This vote marks a decisive turning point for working families and students who rely on public transportation every single day," said Council President Elena Vance during the post-vote press conference. "We are cutting commute times while eliminating diesel emissions in our most congested corridors."

Federal green infrastructure grants will finance 60% of the project costs, with the remainder backed by municipal green bonds and existing transit capital reserves. No municipal property tax hikes are scheduled as part of the financing blueprint.

Construction on the first route along Grand Avenue is projected to commence early next spring, with phased testing scheduled for late 2027. Local business associations along the corridor have welcomed the decision, citing expected increases in foot traffic and economic vitality.`,
    category: 'Local News',
    author: 'Ashik Newsroom Desk',
    imageUrl: 'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?auto=format&fit=crop&w=1200&q=80',
    imageCaption: 'Electric transit buses slated for deployment along Grand Avenue starting early next year.',
    isBreaking: true,
    isLead: true,
    views: 1420,
    publishedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
  },
  {
    id: 'art-002',
    title: 'Downtown Waterfront District Announces Annual Summer Arts Festival',
    slug: 'downtown-waterfront-arts-festival',
    excerpt: 'Over 120 regional artists, culinary vendors, and live musicians will transform the waterfront promenade next month.',
    content: `The Downtown Cultural Alliance has officially revealed the full programming schedule for the 14th Annual Waterfront Arts & Culture Festival.

Taking place across three weekends along the scenic boardwalk, this year's lineup showcases local sculptors, painters, artisanal food makers, and more than 40 musical acts spanning jazz, indie folk, and classical quartets.

Admission will remain free for all residents, courtesy of support from regional civic foundations and local merchant sponsorships. Interactive workshops for children and families will be held every Saturday morning at the South Pier Amphitheater.`,
    category: 'Culture',
    author: 'Cultural Correspondent',
    imageUrl: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=1000&q=80',
    imageCaption: 'The South Pier stage will host musical performances and community workshops throughout the festival.',
    isBreaking: false,
    isLead: false,
    views: 890,
    publishedAt: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString()
  },
  {
    id: 'art-003',
    title: 'Metro United Clinches Division Title in Thrilling Extra-Time Comeback',
    slug: 'metro-united-clinches-division-title',
    excerpt: 'Striker Marcus Vance scored a stunning 94th-minute volley to seal a 2-1 victory before a sold-out home crowd of 18,000.',
    content: `In one of the most dramatic finishes in club history, Metro United captured the regional division crown on Saturday afternoon, overcoming a 1-0 deficit with two unanswered goals in the closing ten minutes.

With playoff seeding on the line, substitute winger Tariq Gomez leveled the score in the 83rd minute with a curling header. Ten minutes later, in the fourth minute of stoppage time, striker Marcus Vance unleashed a sublime 20-yard volley that sent the 18,000 fans inside Riverfront Stadium into delirium.

"We never stopped believing," Vance said while celebrating on the pitch. "The energy in this stadium carried us across the finish line." Metro United will host the quarter-final matchup next Saturday.`,
    category: 'Sports',
    author: 'Sports Desk',
    imageUrl: 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?auto=format&fit=crop&w=1000&q=80',
    imageCaption: 'Fans celebrating at Riverfront Stadium as Metro United lifts the regional trophy.',
    isBreaking: false,
    isLead: false,
    views: 2150,
    publishedAt: new Date(Date.now() - 9 * 60 * 60 * 1000).toISOString()
  },
  {
    id: 'art-004',
    title: 'Local High Tech Incubator Launches $2.5M Seed Fund for Regional Startups',
    slug: 'tech-incubator-seed-fund-startups',
    excerpt: 'The initiative specifically targets clean energy, agricultural technology, and healthcare innovation within the region.',
    content: `Aspiring innovators and small business founders in the metropolitan region will soon have access to new early-stage capital thanks to a $2.5 million venture development fund unveiled on Thursday.

The Innovation Nexus, headquartered in the restored Millwork District, announced that grants ranging from $25,000 to $100,000 will be paired with mentorship from veteran business leaders and access to laboratory facilities.

Applications for the inaugural cohort open next Monday, with selection panels emphasizing sustainable solutions tailored to local community needs.`,
    category: 'Business',
    author: 'Business Reporter',
    imageUrl: 'https://images.unsplash.com/photo-1519389950473-47ba0277781c?auto=format&fit=crop&w=1000&q=80',
    imageCaption: 'Entrepreneurs collaborating inside the Innovation Nexus laboratory space.',
    isBreaking: false,
    isLead: false,
    views: 640,
    publishedAt: new Date(Date.now() - 14 * 60 * 60 * 1000).toISOString()
  },
  {
    id: 'art-005',
    title: 'Weather Alert: Heavy Autumn Rains Expected Through Sunday Evening',
    slug: 'weather-alert-heavy-autumn-rains',
    excerpt: 'Regional meteorological service forecasts up to 3 inches of rainfall, urging drivers to exercise caution on low-lying roadways.',
    content: `A slow-moving coastal pressure system will bring sustained rainfall and gusty winds to the valley through the remainder of the weekend.

Public works crews have cleared storm drains across key arterial intersections, and sandbag distribution centers are operational at the central fire depot. Commuters are advised to monitor road condition updates and allow extra travel time during evening hours.`,
    category: 'Local News',
    author: 'Metro Weather Bureau',
    imageUrl: 'https://images.unsplash.com/photo-1515694346937-94d85e41e6f0?auto=format&fit=crop&w=1000&q=80',
    imageCaption: 'Commuters navigating rainfall in the central district on Saturday.',
    isBreaking: true,
    isLead: false,
    views: 1890,
    publishedAt: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString()
  }
];

// Initialize data files
if (!fs.existsSync(settingsFile)) writeJson(settingsFile, defaultSettings);
if (!fs.existsSync(articlesFile)) writeJson(articlesFile, defaultArticles);

// --- REST API ROUTES ---

// 0. AUTHENTICATION ENDPOINTS
app.post('/api/auth/login', (req, res) => {
  const { password } = req.body;
  if (!password) {
    return res.status(400).json({ error: 'Password is required.' });
  }

  const authData = initAuth();
  const inputHash = hashPassword(password.trim());

  if (inputHash !== authData.passwordHash) {
    return res.status(401).json({ error: 'Incorrect password. Access denied.' });
  }

  const token = crypto.randomBytes(32).toString('hex');
  const maxAgeMs = 7 * 24 * 60 * 60 * 1000; // 7 days
  activeSessions.set(token, {
    createdAt: Date.now(),
    expiresAt: Date.now() + maxAgeMs
  });

  res.setHeader('Set-Cookie', `cms_token=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${Math.floor(maxAgeMs / 1000)}`);
  res.json({ success: true, token, message: 'Logged in successfully.' });
});

app.get('/api/auth/check', (req, res) => {
  const token = getAuthToken(req);
  const valid = isSessionValid(token);
  res.json({ authenticated: valid });
});

app.post('/api/auth/logout', (req, res) => {
  const token = getAuthToken(req);
  if (token) activeSessions.delete(token);
  res.setHeader('Set-Cookie', 'cms_token=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT');
  res.json({ success: true, message: 'Logged out successfully.' });
});

app.post('/api/auth/change-password', requireAuthApi, (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Current password and new password are required.' });
  }
  if (newPassword.trim().length < 4) {
    return res.status(400).json({ error: 'New password must be at least 4 characters long.' });
  }

  const authData = initAuth();
  if (hashPassword(currentPassword.trim()) !== authData.passwordHash) {
    return res.status(400).json({ error: 'Current password is incorrect.' });
  }

  authData.passwordHash = hashPassword(newPassword.trim());
  authData.updatedAt = new Date().toISOString();
  writeJson(authFile, authData);

  res.json({ success: true, message: 'Password updated successfully!' });
});

// 1. Get Portal Settings & Breaking News Alert
app.get('/api/settings', (req, res) => {
  const settings = readJson(settingsFile, defaultSettings);
  res.json(settings);
});

// 2. Update Portal Settings (e.g., Breaking news ticker & Top 3 featured stories) - PROTECTED
app.post('/api/settings', requireAuthApi, (req, res) => {
  const current = readJson(settingsFile, defaultSettings);
  const incomingBreaking = req.body.breakingNews || {};
  const updated = {
    ...current,
    ...req.body,
    breakingNews: {
      ...current.breakingNews,
      ...incomingBreaking,
      items: incomingBreaking.items !== undefined ? incomingBreaking.items : (current.breakingNews?.items || []),
      updatedAt: new Date().toISOString()
    }
  };
  writeJson(settingsFile, updated);
  res.json({ success: true, settings: updated });
});

// 3. Get Articles (with filters)
app.get('/api/articles', (req, res) => {
  const articles = readJson(articlesFile, defaultArticles);
  const { category, search, breaking, lead } = req.query;

  let filtered = [...articles];

  if (category && category !== 'All') {
    filtered = filtered.filter(a => a.category.toLowerCase() === category.toLowerCase());
  }

  if (breaking === 'true') {
    filtered = filtered.filter(a => a.isBreaking);
  }

  if (lead === 'true') {
    filtered = filtered.filter(a => a.isLead);
  }

  if (search) {
    const q = search.toLowerCase();
    filtered = filtered.filter(a =>
      a.title.toLowerCase().includes(q) ||
      a.excerpt.toLowerCase().includes(q) ||
      (a.content && a.content.toLowerCase().includes(q))
    );
  }

  // Sort by publishedAt descending
  filtered.sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));

  res.json(filtered);
});

// 4. Get Single Article by ID & increment view count
app.get('/api/articles/:id', (req, res) => {
  const articles = readJson(articlesFile, defaultArticles);
  const article = articles.find(a => a.id === req.params.id);

  if (!article) {
    return res.status(404).json({ error: 'Article not found' });
  }

  // Increment view count
  article.views = (article.views || 0) + 1;
  writeJson(articlesFile, articles);

  res.json(article);
});

// 5. Create / Publish New Article (Post & Publish) - PROTECTED
app.post('/api/articles', requireAuthApi, (req, res) => {
  const {
    title,
    category,
    content,
    excerpt,
    author,
    imageUrl,
    imageCaption,
    isBreaking,
    isLead
  } = req.body;

  if (!title || !content) {
    return res.status(400).json({ error: 'Title and Content are required.' });
  }

  const articles = readJson(articlesFile, defaultArticles);

  // If marked as lead, unpin previous lead
  if (isLead) {
    articles.forEach(a => { a.isLead = false; });
  }

  // Compute excerpt if not provided (first 180 chars)
  const computedExcerpt = excerpt && excerpt.trim()
    ? excerpt.trim()
    : content.replace(/###|##|#|\*\*|\*|_|\[.*?\]\(.*?\)/g, '').slice(0, 180).trim() + '...';

  const newArticle = {
    id: `art-${crypto.randomUUID().slice(0, 8)}`,
    title: title.trim(),
    slug: title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
    category: category || 'കേരളം',
    author: author && author.trim() ? author.trim() : 'ആഷിഖ് / റിപ്പോർട്ടർ',
    imageUrl: imageUrl || 'https://images.unsplash.com/photo-1585829365295-ab7cd400c167?auto=format&fit=crop&w=1000&q=80',
    imageCaption: imageCaption || '',
    excerpt: computedExcerpt,
    content: content.trim(),
    isBreaking: Boolean(isBreaking),
    isLead: Boolean(isLead),
    views: 0,
    publishedAt: new Date().toISOString()
  };

  articles.unshift(newArticle);
  writeJson(articlesFile, articles);

  // If breaking news is checked, also update the top breaking banner automatically!
  if (isBreaking) {
    const settings = readJson(settingsFile, defaultSettings);
    if (!settings.breakingNews) settings.breakingNews = { enabled: true, items: [] };
    if (!Array.isArray(settings.breakingNews.items)) {
      settings.breakingNews.items = settings.breakingNews.text
        ? [{ id: 'brk-legacy', text: settings.breakingNews.text, link: settings.breakingNews.link || '' }]
        : [];
    }
    // Prepend to breaking items
    settings.breakingNews.items.unshift({
      id: `brk-${crypto.randomUUID().slice(0, 8)}`,
      text: newArticle.title,
      link: `/article.html?id=${newArticle.id}`
    });
    // Keep max 10 items
    settings.breakingNews.items = settings.breakingNews.items.slice(0, 10);
    settings.breakingNews.enabled = true;
    settings.breakingNews.updatedAt = new Date().toISOString();
    writeJson(settingsFile, settings);
  }

  res.status(201).json({ success: true, article: newArticle });
});

// 6. Delete Article - PROTECTED
app.delete('/api/articles/:id', requireAuthApi, (req, res) => {
  let articles = readJson(articlesFile, defaultArticles);
  const exists = articles.some(a => a.id === req.params.id);

  if (!exists) {
    return res.status(404).json({ error: 'Article not found' });
  }

  articles = articles.filter(a => a.id !== req.params.id);
  writeJson(articlesFile, articles);

  res.json({ success: true, message: 'Article deleted successfully.' });
});

// 7. Image Upload Endpoint - PROTECTED
app.post('/api/upload', requireAuthApi, upload.single('image'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No image uploaded' });
  }
  const fileUrl = `/uploads/${req.file.filename}`;
  res.json({ success: true, url: fileUrl });
});

// Fallback to front page for any non-API routes
app.use((req, res, next) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'Endpoint not found' });
  if (path.extname(req.path)) {
    return res.status(404).send('Not Found');
  }
  res.sendFile('index.html', { root: path.join(__dirname, 'public') }, (err) => {
    if (err && !res.headersSent) {
      res.status(500).send('Error loading page');
    }
  });
});

// Start Server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`====================================================`);
  console.log(`📰 NEWSFOUR (NEWSഫോർ) DIGITAL NEWS PORTAL IS LIVE!`);
  console.log(`💻 Local Computer:  http://localhost:${PORT}`);
  console.log(`📱 Mobile / Wi-Fi:   http://192.168.1.7:${PORT}`);
  console.log(`✍️ Journalist Desk: http://localhost:${PORT}/admin.html`);
  console.log(`====================================================`);
});
