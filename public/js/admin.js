// Editorial CMS Admin Logic

let currentBreakingItems = [];
let allAdminArticles = [];
let savedAdminSettings = {};

function getCmsAuthHeaders(extra = {}) {
  const token = localStorage.getItem('cms_token');
  return {
    ...extra,
    ...(token ? { 'Authorization': 'Bearer ' + token, 'x-auth-token': token } : {})
  };
}

async function cmsFetch(url, options = {}) {
  const headers = getCmsAuthHeaders(options.headers || {});
  const res = await fetch(url, { ...options, headers });
  if (res.status === 401) {
    localStorage.removeItem('cms_token');
    window.location.replace('/login.html');
    throw new Error('Unauthorized');
  }
  return res;
}

document.addEventListener('DOMContentLoaded', () => {
  loadAdminSettings();
  loadAdminArticles();
});

// 1. Load Settings (Breaking ticker, portal name & featured stories)
async function loadAdminSettings() {
  try {
    const res = await cmsFetch('/api/settings');
    const data = await res.json();
    savedAdminSettings = data || {};

    if (data.breakingNews) {
      const bn = data.breakingNews;
      document.getElementById('alertEnabledCheckbox').checked = Boolean(bn.enabled);

      if (Array.isArray(bn.items) && bn.items.length > 0) {
        currentBreakingItems = bn.items;
      } else if (bn.text) {
        currentBreakingItems = [{ id: 'brk-1', text: bn.text, link: bn.link || '' }];
      } else {
        currentBreakingItems = [];
      }

      updateTickerStatusUI(bn.enabled);
      renderBreakingItemsList();
    }

    if (allAdminArticles.length > 0) {
      populateFeaturedStoriesDropdowns(allAdminArticles, data.featuredStories);
    }

    if (data.location && document.getElementById('settingLocation')) {
      document.getElementById('settingLocation').value = data.location;
    }
    if (data.contactEmail && document.getElementById('settingContactEmail')) {
      document.getElementById('settingContactEmail').value = data.contactEmail;
    }
    if (data.contactPhone && document.getElementById('settingContactPhone')) {
      document.getElementById('settingContactPhone').value = data.contactPhone;
    }
    if (data.description && document.getElementById('settingDescription')) {
      document.getElementById('settingDescription').value = data.description;
    }
  } catch (err) {
    console.error('Failed to load settings:', err);
  }
}

function updateTickerStatusUI(isEnabled) {
  const statEl = document.getElementById('statBreakingStatus');
  const labelEl = document.getElementById('tickerStatusLabel');
  if (statEl) {
    statEl.textContent = isEnabled ? 'ACTIVE' : 'OFF';
    statEl.style.color = isEnabled ? '#dc2626' : '#6b7280';
  }
  if (labelEl) {
    labelEl.textContent = isEnabled ? 'LIVE' : 'OFF';
    labelEl.style.color = isEnabled ? '#dc2626' : '#6b7280';
  }
}

function renderBreakingItemsList() {
  const container = document.getElementById('breakingItemsContainer');
  if (!container) return;

  if (currentBreakingItems.length === 0) {
    container.innerHTML = `
      <div style="background:#f9fafb; border:1px dashed #d1d5db; border-radius:6px; padding:1rem; text-align:center; color:#6b7280; font-size:0.88rem;">
        No breaking news headlines added yet. Use the form below to add headlines to the scrolling strip.
      </div>
    `;
    return;
  }

  container.innerHTML = currentBreakingItems.map((item, idx) => `
    <div style="display:flex; justify-content:space-between; align-items:center; background:#ffffff; border:1.5px solid #e5e7eb; border-radius:8px; padding:0.75rem 1rem; gap:12px; box-shadow:0 1px 3px rgba(0,0,0,0.03);">
      <div style="display:flex; align-items:center; gap:10px; flex:1;">
        <span style="background:#dc2626; color:#fff; font-weight:800; font-size:0.72rem; padding:0.15rem 0.45rem; border-radius:4px;">#${idx + 1}</span>
        <div style="flex:1;">
          <div style="font-weight:700; color:#0f172a; font-size:0.95rem;">${escapeHtml(item.text)}</div>
          ${item.link ? `
            <a href="${escapeHtml(item.link)}" target="_blank" style="font-size:0.75rem; color:#2563eb; display:inline-flex; align-items:center; gap:4px; margin-top:2px; text-decoration:none;">
              <i class="fa-solid fa-arrow-up-right-from-square"></i> Links to article
            </a>
          ` : '<span style="font-size:0.75rem; color:#9ca3af;">(Plain text alert - no link)</span>'}
        </div>
      </div>
      <button type="button" onclick="removeBreakingItem('${escapeHtml(item.id)}')" style="background:#fee2e2; color:#dc2626; border:none; border-radius:6px; padding:0.4rem 0.75rem; font-size:0.8rem; font-weight:700; cursor:pointer; display:inline-flex; align-items:center; gap:5px;">
        <i class="fa-solid fa-trash"></i> Remove
      </button>
    </div>
  `).join('');
}

// Add New Item to Breaking List
async function addBreakingItem() {
  const textInput = document.getElementById('newBreakingTextInput');
  const storySelect = document.getElementById('newBreakingStorySelect');

  const text = textInput.value.trim();
  const link = storySelect.value;

  if (!text) {
    alert('Please enter a headline text for the breaking news item.');
    textInput.focus();
    return;
  }

  const newItem = {
    id: `brk-${Date.now()}`,
    text,
    link
  };

  currentBreakingItems.push(newItem);
  textInput.value = '';
  storySelect.value = '';

  await saveBreakingAlert();
}

// Remove Item from Breaking List
async function removeBreakingItem(id) {
  currentBreakingItems = currentBreakingItems.filter(item => item.id !== id);
  await saveBreakingAlert();
}

// Save Breaking Alert (Master Save)
async function saveBreakingAlert() {
  const enabled = document.getElementById('alertEnabledCheckbox').checked;

  try {
    const res = await cmsFetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        breakingNews: {
          enabled,
          items: currentBreakingItems
        }
      })
    });
    const result = await res.json();
    if (result.success) {
      updateTickerStatusUI(enabled);
      renderBreakingItemsList();
      showNotice(enabled ? `🚨 Live Breaking Ticker updated (${currentBreakingItems.length} active stories)!` : 'Breaking news banner turned OFF.');
    }
  } catch (err) {
    alert('Failed to update breaking ticker: ' + err.message);
  }
}

// 3. Image Handling
function setPresetPhoto(url) {
  document.getElementById('storyImageUrl').value = url;
  updateImagePreview();
}

function updateImagePreview() {
  const url = document.getElementById('storyImageUrl').value.trim();
  const box = document.getElementById('imagePreviewBox');
  const img = document.getElementById('previewImg');

  if (url) {
    img.src = url;
    box.style.display = 'inline-block';
  } else {
    box.style.display = 'none';
  }
}

async function handleFileUpload(e) {
  const file = e.target.files[0];
  if (!file) return;

  const formData = new FormData();
  formData.append('image', file);

  try {
    const res = await cmsFetch('/api/upload', {
      method: 'POST',
      body: formData
    });
    const data = await res.json();
    if (data.success && data.url) {
      document.getElementById('storyImageUrl').value = data.url;
      updateImagePreview();
    } else {
      alert('Upload failed: ' + (data.error || 'Unknown error'));
    }
  } catch (err) {
    alert('Error uploading image: ' + err.message);
  }
}

// 4. Content Formatting Toolbar
function insertFormat(prefix, suffix) {
  const textarea = document.getElementById('storyContent');
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const selected = textarea.value.substring(start, end) || 'text';
  const replacement = prefix + selected + suffix;

  textarea.value = textarea.value.substring(0, start) + replacement + textarea.value.substring(end);
  textarea.focus();
  textarea.setSelectionRange(start + prefix.length, start + prefix.length + selected.length);
}

// 5. Post & Publish Story
async function handlePublishStory(e) {
  e.preventDefault();

  const title = document.getElementById('storyTitle').value.trim();
  const category = document.getElementById('storyCategory').value;
  const author = document.getElementById('storyAuthor').value.trim();
  const imageUrl = document.getElementById('storyImageUrl').value.trim();
  const imageCaption = document.getElementById('storyImageCaption').value.trim();
  const isBreaking = document.getElementById('storyIsBreaking').checked;
  const isLead = document.getElementById('storyIsLead').checked;
  const content = document.getElementById('storyContent').value.trim();

  if (!title || !content) {
    alert('Please enter both a Headline and Story Content.');
    return;
  }

  const btn = document.getElementById('publishBtn');
  btn.disabled = true;
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Publishing...';

  try {
    const res = await cmsFetch('/api/articles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title,
        category,
        author,
        imageUrl,
        imageCaption,
        isBreaking,
        isLead,
        content
      })
    });

    const data = await res.json();
    if (res.ok && data.success) {
      showNotice('Story published successfully!', `/article.html?id=${data.article.id}`);

      // Reset form
      document.getElementById('storyTitle').value = '';
      document.getElementById('storyContent').value = '';
      document.getElementById('storyImageUrl').value = '';
      document.getElementById('storyImageCaption').value = '';
      document.getElementById('imagePreviewBox').style.display = 'none';
      document.getElementById('storyIsBreaking').checked = false;

      // Reload list and stats
      loadAdminArticles();
      loadAdminSettings();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      alert('Error publishing story: ' + (data.error || 'Server error'));
    }
  } catch (err) {
    alert('Failed to connect to newsroom server: ' + err.message);
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> POST & PUBLISH NOW';
  }
}

// 6. Manage Articles
async function loadAdminArticles() {
  try {
    const res = await cmsFetch('/api/articles');
    const articles = await res.json();
    allAdminArticles = articles;

    document.getElementById('statTotalStories').textContent = articles.length;
    const totalViews = articles.reduce((sum, a) => sum + (a.views || 0), 0);
    document.getElementById('statTotalViews').textContent = totalViews.toLocaleString();

    // Populate Top 3 Stories Selector Dropdowns
    populateFeaturedStoriesDropdowns(articles, savedAdminSettings?.featuredStories);

    // Populate breaking news story link dropdown
    const storySelect = document.getElementById('newBreakingStorySelect');
    if (storySelect) {
      storySelect.innerHTML = '<option value="">-- Choose Story To Link (Optional) --</option>' +
        articles.map(a => `<option value="/article.html?id=${a.id}">${escapeHtml(a.title)}</option>`).join('');

      storySelect.onchange = () => {
        const textInput = document.getElementById('newBreakingTextInput');
        if (textInput && !textInput.value.trim() && storySelect.value) {
          const selected = articles.find(a => `/article.html?id=${a.id}` === storySelect.value);
          if (selected) textInput.value = selected.title;
        }
      };
    }

    const tbody = document.getElementById('articlesTableBody');
    if (articles.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:1.5rem; color:#6b7280;">No stories published yet.</td></tr>';
      return;
    }

    tbody.innerHTML = articles.map(a => `
      <tr style="border-bottom:1px solid #f3f4f6;">
        <td style="padding:0.75rem 0.5rem; font-weight:700;">
          <a href="/article.html?id=${a.id}" target="_blank" style="color:#111827;">${escapeHtml(a.title)}</a>
          ${a.isBreaking ? '<span style="font-size:0.65rem; background:#fee2e2; color:#dc2626; padding:0.15rem 0.4rem; border-radius:3px; margin-left:6px; font-weight:800;">BREAKING</span>' : ''}
          ${a.isLead ? '<span style="font-size:0.65rem; background:#fef3c7; color:#b45309; padding:0.15rem 0.4rem; border-radius:3px; margin-left:4px; font-weight:800;">LEAD</span>' : ''}
        </td>
        <td style="padding:0.75rem 0.5rem; color:#4b5563; font-weight:600;">${escapeHtml(formatSegmentName(a.category))}</td>
        <td style="padding:0.75rem 0.5rem; color:#6b7280; font-size:0.8rem;">${formatDateShort(a.publishedAt)}</td>
        <td style="padding:0.75rem 0.5rem; color:#111827; font-weight:600;">${(a.views || 0).toLocaleString()}</td>
        <td style="padding:0.75rem 0.5rem; text-align:right; white-space:nowrap;">
          <a href="/article.html?id=${a.id}" target="_blank" style="padding:0.3rem 0.6rem; background:#f3f4f6; border-radius:4px; font-weight:600; font-size:0.8rem; margin-right:6px;">
            <i class="fa-solid fa-eye"></i> View
          </a>
          <button onclick="deleteStory('${a.id}')" style="padding:0.3rem 0.6rem; background:#fee2e2; color:#dc2626; border:none; border-radius:4px; font-weight:600; font-size:0.8rem; cursor:pointer;">
            <i class="fa-solid fa-trash"></i> Delete
          </button>
        </td>
      </tr>
    `).join('');
  } catch (err) {
    console.error('Failed to load articles list:', err);
  }
}

async function deleteStory(id) {
  if (!confirm('Are you sure you want to delete this story? This cannot be undone.')) {
    return;
  }

  try {
    const res = await cmsFetch(`/api/articles/${id}`, { method: 'DELETE' });
    if (res.ok) {
      showNotice('Story deleted successfully.');
      loadAdminArticles();
    } else {
      alert('Failed to delete story.');
    }
  } catch (err) {
    alert('Error: ' + err.message);
  }
}

// Helpers
function showNotice(msg, link = null) {
  const banner = document.getElementById('noticeBanner');
  document.getElementById('noticeText').textContent = msg;
  const linkEl = document.getElementById('noticeLink');

  if (link) {
    linkEl.href = link;
    linkEl.style.display = 'inline';
  } else {
    linkEl.style.display = 'none';
  }

  banner.style.display = 'flex';
  setTimeout(() => {
    banner.style.display = 'none';
  }, 7000);
}

function formatDateShort(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
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

function toggleQrCode() {
  const box = document.getElementById('qrModalBox');
  if (!box) return;
  box.style.display = box.style.display === 'none' ? 'block' : 'none';
}

// 7. Front Page Top 3 Stories (1 Top, 2 Bottom) Controller
function populateFeaturedStoriesDropdowns(articles, featuredStories) {
  const selectTop = document.getElementById('selectFeaturedTop');
  const selectBL = document.getElementById('selectFeaturedBottomLeft');
  const selectBR = document.getElementById('selectFeaturedBottomRight');

  if (!selectTop || !selectBL || !selectBR) return;

  const buildOptions = (placeholder) => {
    return `<option value="">${placeholder}</option>` +
      articles.map(a => `<option value="${a.id}">[${escapeHtml(formatSegmentName(a.category))}] ${escapeHtml(a.title)}</option>`).join('');
  };

  selectTop.innerHTML = buildOptions('-- Choose Top Main Story (Box 1) --');
  selectBL.innerHTML = buildOptions('-- Choose Bottom Left Story (Box 2) --');
  selectBR.innerHTML = buildOptions('-- Choose Bottom Right Story (Box 3) --');

  // Pre-select current choices
  const feat = featuredStories || {};
  if (feat.topId) {
    selectTop.value = feat.topId;
  } else if (articles.length > 0) {
    const lead = articles.find(a => a.isLead) || articles[0];
    selectTop.value = lead.id;
  }

  if (feat.bottomLeftId) {
    selectBL.value = feat.bottomLeftId;
  } else if (articles.length > 1) {
    const remaining = articles.filter(a => a.id !== selectTop.value);
    if (remaining[0]) selectBL.value = remaining[0].id;
  }

  if (feat.bottomRightId) {
    selectBR.value = feat.bottomRightId;
  } else if (articles.length > 2) {
    const remaining = articles.filter(a => a.id !== selectTop.value && a.id !== selectBL.value);
    if (remaining[0]) selectBR.value = remaining[0].id;
  }

  updateFeaturedPreview();
}

function updateFeaturedPreview() {
  const topId = document.getElementById('selectFeaturedTop')?.value;
  const blId = document.getElementById('selectFeaturedBottomLeft')?.value;
  const brId = document.getElementById('selectFeaturedBottomRight')?.value;

  const topBox = document.getElementById('previewTopBox');
  const blBox = document.getElementById('previewBottomLeftBox');
  const brBox = document.getElementById('previewBottomRightBox');

  if (topBox) {
    const story = allAdminArticles.find(a => a.id === topId);
    topBox.innerHTML = story
      ? `<span style="color:#B30000; font-size:0.75rem; text-transform:uppercase; font-weight:800;">1. TOP MAIN STORY:</span><br><strong>${escapeHtml(story.title)}</strong>`
      : `<span style="color:#9ca3af;">1. Top Main Story: None selected</span>`;
  }

  if (blBox) {
    const story = allAdminArticles.find(a => a.id === blId);
    blBox.innerHTML = story
      ? `<span style="color:#B30000; font-size:0.72rem; text-transform:uppercase; font-weight:800;">2. BOTTOM-LEFT:</span><br><strong>${escapeHtml(story.title)}</strong>`
      : `<span style="color:#9ca3af;">2. Bottom Left Story: None selected</span>`;
  }

  if (brBox) {
    const story = allAdminArticles.find(a => a.id === brId);
    brBox.innerHTML = story
      ? `<span style="color:#B30000; font-size:0.72rem; text-transform:uppercase; font-weight:800;">3. BOTTOM-RIGHT:</span><br><strong>${escapeHtml(story.title)}</strong>`
      : `<span style="color:#9ca3af;">3. Bottom Right Story: None selected</span>`;
  }
}

async function saveFeaturedTopStories() {
  const topId = document.getElementById('selectFeaturedTop')?.value;
  const bottomLeftId = document.getElementById('selectFeaturedBottomLeft')?.value;
  const bottomRightId = document.getElementById('selectFeaturedBottomRight')?.value;
  const statusEl = document.getElementById('featuredSaveStatus');

  if (!topId) {
    alert('Please select at least the Top Main Story.');
    return;
  }

  if (statusEl) {
    statusEl.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving changes...';
  }

  try {
    const res = await cmsFetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        featuredStories: {
          topId,
          bottomLeftId: bottomLeftId || '',
          bottomRightId: bottomRightId || ''
        }
      })
    });

    const data = await res.json();
    if (res.ok && data.success) {
      savedAdminSettings = data.settings;
      if (statusEl) {
        statusEl.innerHTML = '<span style="color:#16a34a; font-weight:700;"><i class="fa-solid fa-circle-check"></i> Top 3 stories saved and live on front page!</span>';
      }
      showNotice('Front page top 3 stories updated successfully!', '/');
    } else {
      if (statusEl) {
        statusEl.innerHTML = '<span style="color:#dc2626; font-weight:700;"><i class="fa-solid fa-triangle-exclamation"></i> Error saving stories.</span>';
      }
    }
  } catch (err) {
    if (statusEl) {
      statusEl.innerHTML = '<span style="color:#dc2626; font-weight:700;">Connection failed: ' + err.message + '</span>';
    }
  }
}

// 8. CMS Authentication & Session Management
async function handleLogout() {
  if (!confirm('Are you sure you want to sign out from the CMS?')) return;
  try {
    await cmsFetch('/api/auth/logout', { method: 'POST' });
  } catch (err) {}
  localStorage.removeItem('cms_token');
  window.location.replace('/login.html');
}

function openPasswordModal() {
  const modal = document.getElementById('passwordModal');
  const notice = document.getElementById('modalNotice');
  if (notice) notice.style.display = 'none';
  const cInput = document.getElementById('modalCurrentPassword');
  const nInput = document.getElementById('modalNewPassword');
  if (cInput) cInput.value = '';
  if (nInput) nInput.value = '';
  if (modal) modal.style.display = 'flex';
}

function closePasswordModal() {
  const modal = document.getElementById('passwordModal');
  if (modal) modal.style.display = 'none';
}

async function handleChangePassword(e) {
  e.preventDefault();
  const currentPassword = document.getElementById('modalCurrentPassword').value.trim();
  const newPassword = document.getElementById('modalNewPassword').value.trim();
  const btn = document.getElementById('modalSaveBtn');
  const notice = document.getElementById('modalNotice');

  if (!currentPassword || !newPassword) return;

  btn.disabled = true;
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving...';

  try {
    const res = await cmsFetch('/api/auth/change-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPassword, newPassword })
    });
    const data = await res.json();

    if (res.ok && data.success) {
      notice.style.display = 'block';
      notice.style.background = '#dcfce7';
      notice.style.color = '#15803d';
      notice.style.border = '1px solid #86efac';
      notice.textContent = 'Password updated successfully!';
      setTimeout(() => {
        closePasswordModal();
        showNotice('CMS Password updated successfully!');
      }, 1200);
    } else {
      notice.style.display = 'block';
      notice.style.background = '#fee2e2';
      notice.style.color = '#b91c1c';
      notice.style.border = '1px solid #fca5a5';
      notice.textContent = data.error || 'Failed to update password.';
    }
  } catch (err) {
    notice.style.display = 'block';
    notice.style.background = '#fee2e2';
    notice.style.color = '#b91c1c';
    notice.style.border = '1px solid #fca5a5';
    notice.textContent = 'Error: ' + err.message;
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fa-solid fa-check"></i> Update Password';
  }
}

async function handleSaveContactSettings(e) {
  e.preventDefault();
  const statusEl = document.getElementById('contactSettingsSaveStatus');
  const location = document.getElementById('settingLocation').value.trim();
  const contactEmail = document.getElementById('settingContactEmail').value.trim();
  const contactPhone = document.getElementById('settingContactPhone').value.trim();
  const description = document.getElementById('settingDescription').value.trim();

  try {
    statusEl.textContent = 'Saving...';
    statusEl.style.color = '#2563eb';

    const res = await cmsFetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        location,
        contactEmail,
        contactPhone,
        description
      })
    });

    if (res.ok) {
      statusEl.textContent = '✓ Contact details saved successfully!';
      statusEl.style.color = '#16a34a';
      setTimeout(() => { statusEl.textContent = ''; }, 3500);
    } else {
      statusEl.textContent = 'Failed to save settings.';
      statusEl.style.color = '#dc2626';
    }
  } catch (err) {
    statusEl.textContent = 'Error saving settings.';
    statusEl.style.color = '#dc2626';
  }
}



