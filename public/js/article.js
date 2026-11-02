// Malayalam Article View Page Logic

let currentArticle = null;

document.addEventListener('DOMContentLoaded', () => {
  displayTodayDate();
  loadSettings();
  loadArticle();
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

async function loadSettings() {
  try {
    const res = await fetch('/api/settings');
    const data = await res.json();
    renderBreakingTicker(data.breakingNews);

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
  } catch (err) {
    console.error('Error loading settings:', err);
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

async function loadArticle() {
  const params = new URLSearchParams(window.location.search);
  const articleId = params.get('id');

  if (!articleId) {
    showError('No story selected. Please return to Home.');
    return;
  }

  try {
    // Check if user has already opened this story during this browser session
    const sessionKey = `n4_read_${articleId}`;
    const alreadyCountedInSession = Boolean(sessionStorage.getItem(sessionKey));

    // If already counted in this session, request with ?noview=1 to avoid refresh-spamming
    const endpoint = `/api/articles/${encodeURIComponent(articleId)}${alreadyCountedInSession ? '?noview=1' : ''}`;
    const res = await fetch(endpoint);
    if (!res.ok) {
      showError('Story not found or may have been removed.');
      return;
    }

    // Mark as read in this browser session
    if (!alreadyCountedInSession) {
      sessionStorage.setItem(sessionKey, Date.now().toString());
    }

    currentArticle = await res.json();
    renderArticle(currentArticle);
  } catch (err) {
    console.error('Error loading article:', err);
    showError('Error loading story. Please check connection and try again.');
  }
}

function renderArticle(art) {
  document.title = `${art.title} | NEWSFOUR • NEWSഫോർ`;

  document.getElementById('articleLoading').style.display = 'none';
  document.getElementById('articleBodyContainer').style.display = 'block';

  document.getElementById('articleCategory').textContent = formatSegmentName(art.category);
  document.getElementById('articleTitle').textContent = art.title;
  document.getElementById('articleExcerpt').textContent = art.excerpt || '';
  document.getElementById('articleAuthor').textContent = art.author || 'Reporter';

  // Initials for avatar
  const initials = (art.author || 'N4')
    .split(' ')
    .map(w => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || 'N4';
  document.getElementById('authorInitials').textContent = initials;

  // Format date & time in English
  const dateObj = new Date(art.publishedAt);
  const options = { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' };
  const formattedDate = dateObj.toLocaleDateString('en-US', options);
  
  document.getElementById('articleDate').textContent = formattedDate;

  // Genuine Reader View Counts
  const readCount = Math.max(0, Number(art.views || 0));
  const viewsEl = document.getElementById('articleViews');
  if (viewsEl) viewsEl.textContent = readCount.toLocaleString();

  const toolbarViewsEl = document.getElementById('articleViewsToolbar');
  if (toolbarViewsEl) toolbarViewsEl.textContent = readCount.toLocaleString();

  const readersTextEl = document.getElementById('articleReadersText');
  if (readersTextEl) readersTextEl.innerHTML = `<strong>${readCount.toLocaleString()}</strong> വായനക്കാർ`;

  if (art.isBreaking) {
    document.getElementById('articleBreakingBadge').style.display = 'inline-flex';
  }

  // Cover image
  if (art.imageUrl) {
    const imgEl = document.getElementById('articleImage');
    imgEl.src = art.imageUrl;
    imgEl.alt = art.title;
    document.getElementById('articleCaption').textContent = art.imageCaption || '';
  } else {
    document.getElementById('articleMediaWrap').style.display = 'none';
  }

  // Calculate Reading Time (Malayalam avg ~130 words/min)
  const allWords = ((art.content || '') + ' ' + (art.excerpt || '')).trim().split(/\s+/).filter(Boolean).length;
  const readingMins = Math.max(1, Math.ceil(allWords / 130));
  const readingTimeEl = document.getElementById('readingTime');
  if (readingTimeEl) readingTimeEl.textContent = `${readingMins} മിനിറ്റ് വായന`;

  // Content formatting
  document.getElementById('articleContent').innerHTML = formatContentToHtml(art.content);
}

// 🔤 Font Resizer Functions for Reader-Friendly Experience
let currentFontSizeLevel = 0; // -1: small, 0: default, 1: large, 2: extra large

function adjustFontSize(delta) {
  currentFontSizeLevel = Math.max(-1, Math.min(2, currentFontSizeLevel + delta));
  applyFontSize();
}

function resetFontSize() {
  currentFontSizeLevel = 0;
  applyFontSize();
}

function applyFontSize() {
  const articleEl = document.getElementById('articleContent');
  if (!articleEl) return;

  articleEl.classList.remove('font-size-sm', 'font-size-lg', 'font-size-xl');

  if (currentFontSizeLevel === -1) {
    articleEl.classList.add('font-size-sm');
  } else if (currentFontSizeLevel === 1) {
    articleEl.classList.add('font-size-lg');
  } else if (currentFontSizeLevel === 2) {
    articleEl.classList.add('font-size-xl');
  }

  const smBtn = document.getElementById('fontBtnSm');
  const resetBtn = document.getElementById('fontBtnReset');
  const lgBtn = document.getElementById('fontBtnLg');

  if (smBtn) smBtn.classList.toggle('active', currentFontSizeLevel === -1);
  if (resetBtn) resetBtn.classList.toggle('active', currentFontSizeLevel === 0);
  if (lgBtn) lgBtn.classList.toggle('active', currentFontSizeLevel >= 1);
}

function formatContentToHtml(rawText) {
  if (!rawText) return '';

  const lines = rawText.split('\n');
  let html = '';
  let inList = false;

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i].trim();

    if (!line) {
      if (inList) {
        html += '</ul>';
        inList = false;
      }
      continue;
    }

    // Markdown Headers
    if (line.startsWith('### ')) {
      if (inList) { html += '</ul>'; inList = false; }
      html += `<h3>${escapeHtml(line.slice(4))}</h3>`;
    } else if (line.startsWith('## ')) {
      if (inList) { html += '</ul>'; inList = false; }
      html += `<h2>${escapeHtml(line.slice(3))}</h2>`;
    } else if (line.startsWith('> ')) {
      if (inList) { html += '</ul>'; inList = false; }
      html += `<blockquote>${escapeHtml(line.slice(2))}</blockquote>`;
    } else if (line.startsWith('- ') || line.startsWith('* ')) {
      if (!inList) {
        html += '<ul style="margin: 1rem 0 1.5rem 1.5rem; line-height: 1.8;">';
        inList = true;
      }
      html += `<li>${formatInlineStyles(line.slice(2))}</li>`;
    } else {
      if (inList) {
        html += '</ul>';
        inList = false;
      }
      html += `<p>${formatInlineStyles(line)}</p>`;
    }
  }

  if (inList) html += '</ul>';
  return html;
}

function formatInlineStyles(text) {
  let safe = escapeHtml(text);
  // Bold **text**
  safe = safe.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  // Italic *text*
  safe = safe.replace(/\*(.*?)\*/g, '<em>$1</em>');
  // Quotes "text"
  safe = safe.replace(/"(.*?)"/g, '&ldquo;$1&rdquo;');
  return safe;
}

function showError(msg) {
  document.getElementById('articleLoading').innerHTML = `
    <div style="padding: 2rem; color: #dc2626;">
      <i class="fa-solid fa-triangle-exclamation fa-2x"></i>
      <h3 style="margin-top: 1rem;">${escapeHtml(msg)}</h3>
      <a href="/" style="display:inline-block; margin-top:1rem; padding:0.5rem 1rem; background:#111827; color:#fff; border-radius:6px; font-weight:700;">&larr; Return to Home</a>
    </div>
  `;
}

// Social share functions
function shareWhatsApp() {
  if (!currentArticle) return;
  const text = encodeURIComponent(`📰 ${currentArticle.title}\n\nRead more at:\n${window.location.href}`);
  window.open(`https://api.whatsapp.com/send?text=${text}`, '_blank');
}

function shareTwitter() {
  if (!currentArticle) return;
  const text = encodeURIComponent(`📰 ${currentArticle.title}\n\nRead:\n${window.location.href}`);
  window.open(`https://twitter.com/intent/tweet?text=${text}`, '_blank');
}

function shareFacebook() {
  const url = encodeURIComponent(window.location.href);
  window.open(`https://www.facebook.com/sharer/sharer.php?u=${url}`, '_blank');
}

function copyArticleLink() {
  navigator.clipboard.writeText(window.location.href).then(() => {
    const textEl = document.getElementById('copyLinkText');
    textEl.textContent = 'Link Copied!';
    setTimeout(() => { textEl.textContent = 'Copy Link'; }, 2000);
  });
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
