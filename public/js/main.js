// Malayalam News Portal - Front Page Reader Logic

let currentCategory = 'All';
let allArticles = [];
let portalSettings = {};

document.addEventListener('DOMContentLoaded', () => {
  displayTodayDate();
  loadSettings();
  loadArticles();
  setupEventListeners();
});

function displayTodayDate() {
  const now = new Date();
  const weekdays = ['ഞായറാഴ്ച', 'തിങ്കളാഴ്ച', 'ചൊവ്വാഴ്ച', 'ബുധനാഴ്ച', 'വ്യാഴാഴ്ച', 'വെള്ളിയാഴ്ച', 'ശനിയാഴ്ച'];
  const months = [
    'ജനുവരി', 'ഫെബ്രുവരി', 'മാർച്ച്', 'ഏപ്രിൽ', 'മെയ്', 'ജൂൺ',
    'ജൂലൈ', 'ഓഗസ്റ്റ്', 'സെപ്റ്റംബർ', 'ഒക്ടോബർ', 'നവംബർ', 'ഡിസംബർ'
  ];

  const dayName = weekdays[now.getDay()];
  const monthName = months[now.getMonth()];
  const dateNum = now.getDate();
  const yearNum = now.getFullYear();

  const el = document.getElementById('currentDate');
  if (el) el.textContent = `${dayName}, ${dateNum} ${monthName} ${yearNum} • ഡിജിറ്റൽ എഡിഷൻ`;
}

// English Segment Names Formatter
function formatSegmentName(cat) {
  if (!cat) return 'NEWS';
  const c = String(cat).trim();
  const map = {
    'കേരളം': 'KERALA',
    'ക്രൈം': 'CRIME',
    'കായികം': 'SPORTS',
    'ബിസിനസ്': 'BUSINESS',
    'വിനോദം': 'ENTERTAINMENT',
    'സിനിമ': 'ENTERTAINMENT',
    'പ്രവാസം': 'GULF',
    'ദേശീയം': 'NATIONAL',
    'ജീവിതശൈലി': 'LIFESTYLE',
    'വാർത്തകൾ': 'NEWS',
    'kerala': 'KERALA',
    'crime': 'CRIME',
    'sports': 'SPORTS',
    'business': 'BUSINESS',
    'entertainment': 'ENTERTAINMENT',
    'cinema': 'ENTERTAINMENT',
    'gulf': 'GULF',
    'national': 'NATIONAL'
  };
  return map[c] || c.toUpperCase();
}

// 1. Load Settings (Breaking News Ticker & Portal Name & Featured Stories)
async function loadSettings() {
  try {
    const res = await fetch('/api/settings');
    const data = await res.json();
    portalSettings = data || {};

    if (data.portalName) {
      const titleEl = document.getElementById('mastheadTitle');
      if (titleEl) titleEl.textContent = data.portalName;
    }
    if (data.tagline) {
      const tagEl = document.getElementById('mastheadTagline');
      if (tagEl) tagEl.textContent = data.tagline;
    }
    if (data.description) {
      const descEl = document.getElementById('footerDescription');
      if (descEl) descEl.textContent = data.description;
    }
    if (data.location) {
      const locEl = document.getElementById('footerLocation');
      if (locEl) locEl.innerHTML = `<i class="fa-solid fa-location-dot" style="color:#FFC400; margin-right:6px;"></i> ${escapeHtml(data.location)}`;
    }
    if (data.contactEmail) {
      const mailEl = document.getElementById('footerContactEmail');
      if (mailEl) {
        mailEl.textContent = data.contactEmail;
        mailEl.href = `mailto:${data.contactEmail}`;
      }
    }
    if (data.contactPhone) {
      const phoneEl = document.getElementById('footerContactPhone');
      if (phoneEl) phoneEl.textContent = data.contactPhone;
    }

    // Breaking news continuous banner
    renderBreakingTicker(data.breakingNews);

    // If articles already loaded, re-render to apply any saved featured stories
    if (allArticles.length > 0) {
      renderPage();
    }
  } catch (err) {
    console.error('Failed to load settings:', err);
  }
}

function renderBreakingTicker(breakingData) {
  const bar = document.getElementById('breakingBar');
  const group1 = document.getElementById('breakingGroup1');
  const group2 = document.getElementById('breakingGroup2');

  if (!breakingData || !breakingData.enabled) {
    if (bar) bar.classList.add('hidden');
    return;
  }

  let items = [];
  if (Array.isArray(breakingData.items) && breakingData.items.length > 0) {
    items = breakingData.items;
  } else if (breakingData.text) {
    items = [{ text: breakingData.text, link: breakingData.link || '' }];
  }

  if (items.length === 0) {
    if (bar) bar.classList.add('hidden');
    return;
  }

  bar.classList.remove('hidden');

  // Build items HTML with clickable links and attractive separator
  const itemsHtml = items.map(item => `
    <span class="ticker-item">
      <a href="${item.link ? escapeHtml(item.link) : '#'}">
        ${escapeHtml(item.text)}
      </a>
      <span class="ticker-separator">✦</span>
    </span>
  `).join('');

  if (group1) group1.innerHTML = itemsHtml;
  if (group2) group2.innerHTML = itemsHtml;
}

// 2. Load Articles
async function loadArticles() {
  try {
    const res = await fetch('/api/articles');
    allArticles = await res.json();
    renderPage();
  } catch (err) {
    console.error('Failed to load articles:', err);
    document.getElementById('leadArticleContainer').innerHTML =
      '<p style="padding:2rem; color:red;">വാർത്തകൾ ലഭ്യമാക്കുന്നതിൽ തടസ്സം നേരിട്ടു. സെർവർ പരിശോധിക്കുക.</p>';
  }
}

function renderPage() {
  const filtered = currentCategory === 'All'
    ? allArticles
    : allArticles.filter(a => {
        if (!a.category) return false;
        const mapped = formatSegmentName(a.category);
        return mapped.toLowerCase() === currentCategory.toLowerCase() ||
               a.category.toLowerCase() === currentCategory.toLowerCase();
      });

  const excludedIds = renderHeroTrio(filtered);
  renderGrid(filtered, excludedIds);

  const countEl = document.getElementById('storyCountText');
  if (countEl) countEl.textContent = `${filtered.length} Stories`;
}

// 🏆 HERO TRIO: 1 TOP MAIN STORY + 2 BOTTOM STORIES (Chosen in Backend)
function renderHeroTrio(articles) {
  const container = document.getElementById('leadSection');
  if (!container) return [];

  if (!articles || articles.length === 0) {
    container.style.display = 'none';
    return [];
  }
  container.style.display = 'flex';

  // 1. Identify the 3 Featured Stories based on backend selection
  const feat = portalSettings?.featuredStories || {};
  let topStory = null;
  let bottomStory1 = null;
  let bottomStory2 = null;

  // Top Story: check saved topId, or isLead, or first item
  if (feat.topId) {
    topStory = articles.find(a => a.id === feat.topId);
  }
  if (!topStory) {
    topStory = articles.find(a => a.isLead) || articles[0];
  }

  const remaining = articles.filter(a => a.id !== topStory.id);

  // Bottom Left Story: check saved bottomLeftId or 1st remaining
  if (feat.bottomLeftId) {
    bottomStory1 = remaining.find(a => a.id === feat.bottomLeftId);
  }
  if (!bottomStory1 && remaining.length > 0) {
    bottomStory1 = remaining[0];
  }

  const remainingForThird = remaining.filter(a => !bottomStory1 || a.id !== bottomStory1.id);

  // Bottom Right Story: check saved bottomRightId or 2nd remaining
  if (feat.bottomRightId) {
    bottomStory2 = remainingForThird.find(a => a.id === feat.bottomRightId);
  }
  if (!bottomStory2 && remainingForThird.length > 0) {
    bottomStory2 = remainingForThird[0];
  }

  const usedIds = [topStory.id];
  if (bottomStory1) usedIds.push(bottomStory1.id);
  if (bottomStory2) usedIds.push(bottomStory2.id);

  // 2. Render Box 1 (1 on Top - Full Width)
  let topHtml = `
    <article class="trio-top-card">
      <a href="/article.html?id=${topStory.id}" class="trio-top-img-wrap">
        <img src="${escapeHtml(topStory.imageUrl)}" alt="${escapeHtml(topStory.title)}" loading="lazy">
      </a>
      <div class="trio-top-body">
        <div style="display:flex; align-items:center; gap:8px; margin-bottom:0.6rem;">
          <span class="trio-top-badge">
            <i class="fa-solid fa-crown"></i> TOP STORY
          </span>
          <span class="category-tag">${escapeHtml(formatSegmentName(topStory.category))}</span>
        </div>
        <h2 class="trio-top-title">
          <a href="/article.html?id=${topStory.id}">${escapeHtml(topStory.title)}</a>
        </h2>
        <p class="trio-top-excerpt">${escapeHtml(topStory.excerpt || '')}</p>
        <div class="trio-meta">
          <span><i class="fa-regular fa-clock"></i> ${formatTimeAgo(topStory.publishedAt)}</span>
          <span><i class="fa-regular fa-eye"></i> ${(topStory.views || 0).toLocaleString()} Views</span>
          <span><i class="fa-regular fa-user"></i> ${escapeHtml(topStory.author || 'Reporter')}</span>
        </div>
      </div>
    </article>
  `;

  // 3. Render Box 2 & Box 3 (2 on Bottom - 2-Column Grid)
  let bottomHtml = '';
  const bottomStories = [bottomStory1, bottomStory2].filter(Boolean);

  if (bottomStories.length > 0) {
    bottomHtml = `
      <div class="trio-bottom-row">
        ${bottomStories.map((bStory) => `
          <article class="trio-sub-card">
            <a href="/article.html?id=${bStory.id}" class="trio-sub-img-wrap">
              <img src="${escapeHtml(bStory.imageUrl)}" alt="${escapeHtml(bStory.title)}" loading="lazy">
            </a>
            <div class="trio-sub-body">
              <span class="category-tag">${escapeHtml(formatSegmentName(bStory.category))}</span>
              <h3 class="trio-sub-title">
                <a href="/article.html?id=${bStory.id}">${escapeHtml(bStory.title)}</a>
              </h3>
              <div class="trio-meta">
                <span><i class="fa-regular fa-clock"></i> ${formatTimeAgo(bStory.publishedAt)}</span>
                <span><i class="fa-regular fa-eye"></i> ${(bStory.views || 0).toLocaleString()} Views</span>
              </div>
            </div>
          </article>
        `).join('')}
      </div>
    `;
  }

  container.innerHTML = topHtml + bottomHtml;
  return usedIds;
}

function renderGrid(articles, excludedIds = []) {
  const grid = document.getElementById('storiesGrid');
  const title = document.getElementById('gridSectionTitle');

  title.textContent = currentCategory === 'All' ? 'LATEST NEWS' : `${formatSegmentName(currentCategory)} NEWS`;

  // Exclude the 3 top stories from repeating in the grid below
  const gridArticles = articles.filter(a => !excludedIds.includes(a.id));

  if (gridArticles.length === 0) {
    grid.innerHTML = '<div style="grid-column:1/-1; padding:2rem; text-align:center; color:var(--text-secondary); background:white; border-radius:8px;">No stories available in this segment yet.</div>';
    return;
  }

  grid.innerHTML = gridArticles.map(a => `
    <article class="story-card">
      <div class="story-card-img-wrap">
        <a href="/article.html?id=${a.id}">
          <img src="${escapeHtml(a.imageUrl)}" alt="${escapeHtml(a.title)}" loading="lazy">
        </a>
        ${a.isBreaking ? '<span class="breaking-flag"><i class="fa-solid fa-bolt"></i> BREAKING</span>' : ''}
      </div>
      <div class="story-card-body">
        <span class="category-tag">${escapeHtml(formatSegmentName(a.category))}</span>
        <h3 class="story-card-title">
          <a href="/article.html?id=${a.id}">${escapeHtml(a.title)}</a>
        </h3>
        <p class="story-card-excerpt">${escapeHtml(a.excerpt || '')}</p>
        <div class="article-meta">
          <span><i class="fa-regular fa-user"></i> ${escapeHtml(a.author)}</span>
          <span><i class="fa-regular fa-clock"></i> ${formatTimeAgo(a.publishedAt)}</span>
        </div>
      </div>
    </article>
  `).join('');
}

// 3. Event Listeners (Category tabs & search)
function setupEventListeners() {
  const tabs = document.querySelectorAll('.category-tab');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      currentCategory = tab.getAttribute('data-category');
      renderPage();
    });
  });

  const searchInput = document.getElementById('searchInput');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      const q = e.target.value.toLowerCase().trim();
      if (!q) {
        renderPage();
        return;
      }
      const matched = allArticles.filter(a =>
        a.title.toLowerCase().includes(q) ||
        (a.excerpt && a.excerpt.toLowerCase().includes(q)) ||
        (a.content && a.content.toLowerCase().includes(q))
      );
      const excludedIds = renderHeroTrio(matched);
      renderGrid(matched, excludedIds);
    });
  }
}

function filterByCat(cat) {
  currentCategory = cat;
  const tabs = document.querySelectorAll('.category-tab');
  tabs.forEach(t => {
    if (t.getAttribute('data-category')?.toLowerCase() === cat.toLowerCase()) t.classList.add('active');
    else t.classList.remove('active');
  });
  renderPage();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// English Time Ago & Publishing Time Formatter
function formatTimeAgo(isoDate) {
  if (!isoDate) return '';
  const date = new Date(isoDate);
  const now = new Date();
  const diffSec = Math.floor((now - date) / 1000);

  if (diffSec < 60) return 'Just now';
  if (diffSec < 3600) {
    const m = Math.floor(diffSec / 60);
    return m === 1 ? '1 min ago' : `${m} mins ago`;
  }
  if (diffSec < 86400) {
    const h = Math.floor(diffSec / 3600);
    return h === 1 ? '1 hr ago' : `${h} hrs ago`;
  }

  const days = Math.floor(diffSec / 86400);
  if (days === 1) return 'Yesterday';
  if (days <= 7) return `${days} days ago`;

  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
