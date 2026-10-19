// ===== LIVE BACKGROUND =====
const canvas = document.getElementById('bgCanvas');
const ctx = canvas.getContext('2d');
let particles = [];

function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}

class Particle {
  constructor() {
    this.x = Math.random() * canvas.width;
    this.y = Math.random() * canvas.height;
    this.size = Math.random() * 2.2 + 0.6;
    this.speedX = (Math.random() - 0.5) * 0.55;
    this.speedY = (Math.random() - 0.5) * 0.55;
    this.opacity = Math.random() * 0.6 + 0.3;
    this.color = Math.random() > 0.55
      ? `rgba(167, 139, 250, ${this.opacity})`
      : `rgba(34, 211, 238, ${this.opacity})`;
  }
  update() {
    this.x += this.speedX;
    this.y += this.speedY;
    if (this.x < 0) this.x = canvas.width;
    if (this.x > canvas.width) this.x = 0;
    if (this.y < 0) this.y = canvas.height;
    if (this.y > canvas.height) this.y = 0;
  }
  draw() {
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
    ctx.fillStyle = this.color;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size * 2.5, 0, Math.PI * 2);
    ctx.fillStyle = this.color.replace(/[\d.]+\)$/, '0.08)');
    ctx.fill();
  }
}

function initParticles() {
  particles = [];
  const count = Math.min(90, Math.floor((canvas.width * canvas.height) / 9000));
  for (let i = 0; i < count; i++) particles.push(new Particle());
}

function connectParticles() {
  for (let a = 0; a < particles.length; a++) {
    for (let b = a + 1; b < particles.length; b++) {
      const dx = particles[a].x - particles[b].x;
      const dy = particles[a].y - particles[b].y;
      const distSq = dx * dx + dy * dy;
      if (distSq < 130 * 130) {
        const dist = Math.sqrt(distSq);
        ctx.beginPath();
        ctx.strokeStyle = `rgba(34, 211, 238, ${(1 - dist / 130) * 0.18})`;
        ctx.lineWidth = 0.7;
        ctx.moveTo(particles[a].x, particles[a].y);
        ctx.lineTo(particles[b].x, particles[b].y);
        ctx.stroke();
      }
    }
  }
}

function animateBackground() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const g = ctx.createRadialGradient(canvas.width / 2, canvas.height / 2, 0, canvas.width / 2, canvas.height / 2, canvas.width * 0.7);
  g.addColorStop(0, 'rgba(8, 145, 178, 0.06)');
  g.addColorStop(0.4, 'rgba(124, 58, 237, 0.03)');
  g.addColorStop(1, 'transparent');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  particles.forEach(p => { p.update(); p.draw(); });
  connectParticles();
  requestAnimationFrame(animateBackground);
}

window.addEventListener('resize', () => { resizeCanvas(); initParticles(); });
resizeCanvas();
initParticles();
animateBackground();

// ===== CLOUD / LOCAL MODE =====
const cloudEnabled =
  typeof SUPABASE_URL === 'string' &&
  typeof SUPABASE_ANON_KEY === 'string' &&
  !SUPABASE_URL.includes('PASTE_') &&
  !SUPABASE_ANON_KEY.includes('PASTE_') &&
  SUPABASE_URL.startsWith('http');

// IMPORTANT: do not name this variable "supabase" — the CDN already uses that global name
let sbClient = null;
if (cloudEnabled && window.supabase && typeof window.supabase.createClient === 'function') {
  sbClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

let currentUser = null;
let items = [];
let currentLightboxId = null;

function setCloudStatus(msg) {
  const el = document.getElementById('cloudStatus');
  if (el) el.textContent = msg;
}

async function init() {
  if (cloudEnabled && sbClient) {
    setCloudStatus('Cloud connected • Private • Free Tier');
    const { data: { session } } = await sbClient.auth.getSession();
    if (session?.user) {
      currentUser = {
        id: session.user.id,
        email: session.user.email,
        name: session.user.user_metadata?.name || session.user.email.split('@')[0],
        avatarUrl: session.user.user_metadata?.avatar_url || null
      };
      updateUIForLoggedIn();
      await loadPinsFromCloud();
      showSection('gallery');
      renderGallery();
    } else {
      showSection('auth');
    }

    sbClient.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_OUT') {
        currentUser = null;
        items = [];
        showSection('auth');
      }
    });
  } else {
    setCloudStatus('Local mode • Add keys in config.js for cloud');
    const savedUser = localStorage.getItem('racle_user');
    if (savedUser) {
      currentUser = JSON.parse(savedUser);
      currentUser.avatarUrl = currentUser.avatarUrl || localStorage.getItem(`racle_avatar_${currentUser.email}`) || null;
      items = JSON.parse(localStorage.getItem(`racle_items_${currentUser.email}`) || '[]');
      updateUIForLoggedIn();
      showSection('gallery');
      renderGallery();
    } else {
      showSection('auth');
    }
  }
}

function showSection(id) {
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  if (id === 'gallery' && currentUser) renderGallery();
}

function switchTab(tab) {
  const loginForm = document.getElementById('loginForm');
  const registerForm = document.getElementById('registerForm');
  const tabs = document.querySelectorAll('.tabs .tab');

  if (!loginForm || !registerForm) {
    console.error('Racle Album: login/register form is missing from index.html.');
    return;
  }
  if (tab !== 'login' && tab !== 'register') tab = 'login';

  loginForm.classList.toggle('hidden', tab !== 'login');
  registerForm.classList.toggle('hidden', tab !== 'register');

  tabs.forEach(button => {
    const buttonTab = button.dataset.tab ||
      (button.textContent.trim().toLowerCase().includes('register') ? 'register' : 'login');
    button.classList.toggle('active', buttonTab === tab);
    button.setAttribute('aria-selected', String(buttonTab === tab));
  });
}

async function handleLogin(e) {
  e.preventDefault();
  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;
  const btn = document.getElementById('loginBtn');
  if (btn) { btn.disabled = true; btn.textContent = 'Connecting...'; }

  try {
    if (cloudEnabled && sbClient) {
      const { data, error } = await sbClient.auth.signInWithPassword({ email, password });
      if (error) throw error;
      currentUser = {
        id: data.user.id,
        email: data.user.email,
        name: data.user.user_metadata?.name || email.split('@')[0],
        avatarUrl: data.user.user_metadata?.avatar_url || null
      };
      updateUIForLoggedIn();
      await loadPinsFromCloud();
      showSection('gallery');
      renderGallery();
    } else {
      const users = JSON.parse(localStorage.getItem('racle_users') || '[]');
      const user = users.find(u => u.email === email && u.password === password);
      if (!user) throw new Error('Invalid email or password');
      currentUser = {
        name: user.name,
        email: user.email,
        avatarUrl: localStorage.getItem(`racle_avatar_${email}`) || null
      };
      localStorage.setItem('racle_user', JSON.stringify(currentUser));
      items = JSON.parse(localStorage.getItem(`racle_items_${email}`) || '[]');
      updateUIForLoggedIn();
      showSection('gallery');
      renderGallery();
    }
  } catch (err) {
    alert(err.message || 'Login failed');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Initialize Session'; }
  }
}

async function handleRegister(e) {
  e.preventDefault();
  const name = document.getElementById('regName').value.trim();
  const email = document.getElementById('regEmail').value.trim();
  const password = document.getElementById('regPassword').value;
  const btn = document.getElementById('registerBtn');
  if (btn) { btn.disabled = true; btn.textContent = 'Creating...'; }

  if (!name || !email || !password) {
    alert('Please fill in name, email, and password.');
    if (btn) { btn.disabled = false; btn.textContent = 'Create Identity'; }
    return;
  }
  if (password.length < 6) {
    alert('Password must be at least 6 characters.');
    if (btn) { btn.disabled = false; btn.textContent = 'Create Identity'; }
    return;
  }

  try {
    if (cloudEnabled && sbClient) {
      const { data, error } = await sbClient.auth.signUp({
        email,
        password,
        options: { data: { name } }
      });
      if (error) throw error;
      if (!data.user) throw new Error('Registration failed. Please try again.');

      currentUser = { id: data.user.id, email, name };

      if (!data.session) {
        localStorage.setItem('racle_pending_email', email);
        alert('Account created and saved!\n\nCheck your email to confirm, then log in.\n\n(Tip: In Supabase → Authentication → Providers → Email, you can turn off "Confirm email" for instant login.)');
        switchTab('login');
        document.getElementById('loginEmail').value = email;
        return;
      }

      localStorage.removeItem('racle_pending_email');
      updateUIForLoggedIn();
      items = [];
      showSection('gallery');
      renderGallery();
    } else {
      let users = JSON.parse(localStorage.getItem('racle_users') || '[]');
      if (users.find(u => u.email === email)) {
        throw new Error('Email already registered. Please login.');
      }
      users.push({ name, email, password });
      localStorage.setItem('racle_users', JSON.stringify(users));
      currentUser = { name, email };
      localStorage.setItem('racle_user', JSON.stringify(currentUser));
      items = [];
      localStorage.setItem(`racle_items_${email}`, JSON.stringify(items));
      updateUIForLoggedIn();
      showSection('gallery');
      renderGallery();
    }
  } catch (err) {
    const msg = err?.message || 'Registration failed';
    if (/already|registered|exists/i.test(msg)) {
      alert('This email is already registered. Please log in instead.');
      switchTab('login');
      document.getElementById('loginEmail').value = email;
    } else {
      alert(msg);
    }
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Create Identity'; }
  }
}

function updateUIForLoggedIn() {
  const profileControl = document.getElementById('profileControl');
  if (profileControl) profileControl.style.display = 'flex';
  const avatar = document.getElementById('profileAvatar');
  const fallback = document.getElementById('profileAvatarFallback');
  if (avatar && fallback) {
    if (currentUser.avatarUrl) {
      avatar.src = currentUser.avatarUrl;
      avatar.classList.remove('hidden');
      fallback.classList.add('hidden');
    } else {
      avatar.removeAttribute('src');
      avatar.classList.add('hidden');
      fallback.classList.remove('hidden');
    }
  }
  const authBtn = document.getElementById('authBtn');
  const galleryNav = document.getElementById('galleryNavBtn');
  authBtn.textContent = (currentUser.name || currentUser.email || 'User').split(' ')[0];
  authBtn.onclick = logout;
  if (galleryNav) galleryNav.style.display = 'inline-block';
  const sub = document.getElementById('pinSubtitle');
  if (sub) sub.textContent = `${currentUser.name || 'Your'}'s board`;
}

async function logout() {
  if (cloudEnabled && sbClient) {
    await sbClient.auth.signOut();
  }
  localStorage.removeItem('racle_user');
  currentUser = null;
  items = [];
  currentLightboxId = null;
  document.getElementById('authBtn').textContent = 'Login';
  document.getElementById('authBtn').onclick = () => showSection('auth');
  const galleryNav = document.getElementById('galleryNavBtn');
  if (galleryNav) galleryNav.style.display = 'none';
  const profileControl = document.getElementById('profileControl');
  if (profileControl) profileControl.style.display = 'none';
  closeLightbox();
  showSection('auth');
}

// ===== PROFILE PICTURE =====
async function handleProfilePhotoChange(event) {
  const input = event.target;
  const file = input.files && input.files[0];
  if (!file || !currentUser) return;
  if (!file.type.startsWith('image/')) {
    alert('Please choose an image file.');
    input.value = '';
    return;
  }
  if (file.size > 5 * 1024 * 1024) {
    alert('Please choose an image smaller than 5 MB.');
    input.value = '';
    return;
  }

  const button = document.getElementById('profileAvatarButton');
  if (button) button.disabled = true;
  try {
    let avatarUrl;
    if (cloudEnabled && sbClient && currentUser.id) {
      avatarUrl = await uploadImageToCloud(file);
      const { error } = await sbClient.auth.updateUser({
        data: { avatar_url: avatarUrl }
      });
      if (error) throw error;
    } else {
      avatarUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error('Could not read that image.'));
        reader.readAsDataURL(file);
      });
      localStorage.setItem(`racle_avatar_${currentUser.email}`, avatarUrl);
    }
    currentUser.avatarUrl = avatarUrl;
    if (!cloudEnabled || !sbClient) {
      localStorage.setItem('racle_user', JSON.stringify(currentUser));
    }
    updateUIForLoggedIn();
  } catch (error) {
    alert(error.message || 'Could not update profile picture. Please try again.');
  } finally {
    if (button) button.disabled = false;
    input.value = '';
  }
}

// ===== CLOUD PINS =====
async function loadPinsFromCloud() {
  if (!sbClient || !currentUser) return;
  const { data, error } = await sbClient
    .from('pins')
    .select('*')
    .eq('user_id', currentUser.id)
    .order('created_at', { ascending: false });

  if (error) {
    console.error(error);
    alert('Could not load album: ' + error.message);
    items = [];
    return;
  }

  items = (data || []).map(row => ({
    id: row.id,
    title: row.title || 'Untitled',
    text: row.note || '',
    photo: row.image_url,
    date: row.created_at ? new Date(row.created_at).toLocaleString() : '',
    ts: row.created_at ? new Date(row.created_at).getTime() : 0,
    storagePath: row.image_url || null
  }));
}

async function uploadImageToCloud(file) {
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
  const path = `${currentUser.id}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
  const { error } = await sbClient.storage.from('album-images').upload(path, file, {
    cacheControl: '3600',
    upsert: false
  });
  if (error) throw error;
  const { data } = sbClient.storage.from('album-images').getPublicUrl(path);
  return data.publicUrl;
}

async function addPinCloud({ title, text, file }) {
  let imageUrl = null;
  if (file) imageUrl = await uploadImageToCloud(file);

  const { data, error } = await sbClient
    .from('pins')
    .insert({
      user_id: currentUser.id,
      title: title || 'Untitled',
      note: text || '',
      image_url: imageUrl
    })
    .select()
    .single();

  if (error) throw error;

  return {
    id: data.id,
    title: data.title,
    text: data.note || '',
    photo: data.image_url,
    date: new Date(data.created_at).toLocaleString(),
    ts: new Date(data.created_at).getTime()
  };
}

async function deletePinCloud(id) {
  const item = items.find(i => i.id === id);
  if (item?.photo && item.photo.includes('/album-images/')) {
    try {
      const parts = item.photo.split('/album-images/');
      if (parts[1]) {
        await sbClient.storage.from('album-images').remove([parts[1]]);
      }
    } catch (_) {}
  }
  const { error } = await sbClient.from('pins').delete().eq('id', id).eq('user_id', currentUser.id);
  if (error) throw error;
}

// ===== UPLOAD HANDLERS =====
function previewPhoto(e) {
  const file = e.target.files[0];
  if (file && !validateImage(file)) { e.target.value = ''; return; }
  const preview = document.getElementById('photoPreview');
  if (file) {
    const reader = new FileReader();
    reader.onload = (ev) => {
      preview.src = ev.target.result;
      preview.classList.remove('hidden');
      preview.dataset.fileName = file.name;
    };
    reader.readAsDataURL(file);
    preview._file = file;
  } else {
    preview.classList.add('hidden');
    preview._file = null;
  }
}

async function handleUpload(e) {
  e.preventDefault();
  if (!currentUser) { showSection('auth'); return; }

  const title = document.getElementById('itemTitle').value.trim();
  const text = document.getElementById('itemText').value.trim();
  const photoInput = document.getElementById('itemPhoto');
  const file = photoInput.files[0] || document.getElementById('photoPreview')._file;
  if (file && !validateImage(file)) return;
  const submitBtn = document.querySelector('#uploadForm button[type="submit"]');
  if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Saving to album…'; }

  try {
    if (cloudEnabled && sbClient) {
      const pin = await addPinCloud({ title, text, file });
      items.unshift(pin);
    } else {
      const preview = document.getElementById('photoPreview');
      items.unshift({
        id: Date.now(),
        title,
        text,
        photo: preview.classList.contains('hidden') ? null : preview.src,
        date: new Date().toLocaleString(),
        ts: Date.now()
      });
      localStorage.setItem(`racle_items_${currentUser.email}`, JSON.stringify(items));
    }
    document.getElementById('uploadForm').reset();
    const preview = document.getElementById('photoPreview');
    preview.classList.add('hidden');
    preview.src = '';
    preview._file = null;
    showSection('gallery');
    renderGallery();
  } catch (err) {
    alert(err.message || 'Upload failed');
  } finally {
    if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Save to Album'; }
  }
}

function validateImage(file) {
  if (!file.type || !file.type.startsWith('image/')) {
    alert('Please choose an image file.');
    return false;
  }
  if (file.size > 10 * 1024 * 1024) {
    alert('Please choose an image smaller than 10 MB.');
    return false;
  }
  return true;
}

function triggerQuickUpload() {
  document.getElementById('quickPhoto').click();
}

async function quickUpload(e) {
  const files = Array.from(e.target.files || []);
  if (!files.length || !currentUser) return;
  if (files.some(file => !validateImage(file))) { e.target.value = ''; return; }
  const uploadBtn = document.querySelector('.toolbar-btn');
  const originalLabel = uploadBtn?.textContent;
  if (uploadBtn) { uploadBtn.disabled = true; uploadBtn.textContent = `Uploading 0/${files.length}…`; }

  try {
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (uploadBtn) uploadBtn.textContent = `Uploading ${i + 1}/${files.length}…`;
      const title = file.name.replace(/\.[^/.]+$/, '') || 'Untitled';
      if (cloudEnabled && sbClient) {
        const pin = await addPinCloud({ title, text: '', file });
        items.unshift(pin);
      } else {
        await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (ev) => {
            items.unshift({
              id: Date.now() + i,
              title,
              text: '',
              photo: ev.target.result,
              date: new Date().toLocaleString(),
              ts: Date.now() + i
            });
            resolve();
          };
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
      }
    }
    if (!cloudEnabled) {
      localStorage.setItem(`racle_items_${currentUser.email}`, JSON.stringify(items));
    }
    renderGallery();
  } catch (err) {
    alert(err.message || 'Upload failed');
  } finally {
    if (uploadBtn) { uploadBtn.disabled = false; uploadBtn.textContent = originalLabel || '+ Upload'; }
    e.target.value = '';
  }
}

async function deletePin(id, event) {
  if (event) event.stopPropagation();
  if (!confirm('Delete this pin from Racle Album?')) return;

  try {
    if (cloudEnabled && sbClient) {
      await deletePinCloud(id);
    }
    items = items.filter(i => i.id !== id);
    if (!cloudEnabled && currentUser) {
      localStorage.setItem(`racle_items_${currentUser.email}`, JSON.stringify(items));
    }
    if (currentLightboxId === id) closeLightbox();
    renderGallery();
  } catch (err) {
    alert(err.message || 'Delete failed');
  }
}

function openLightbox(id) {
  const item = items.find(i => i.id === id);
  if (!item) return;
  currentLightboxId = id;
  document.getElementById('lightboxImg').src = item.photo || '';
  document.getElementById('lightboxImg').style.display = item.photo ? 'block' : 'none';
  document.getElementById('lightboxTitle').textContent = item.title || 'Untitled';
  document.getElementById('lightboxText').textContent = item.text || '';
  document.getElementById('lightboxDate').textContent = item.date || '';
  document.getElementById('lightbox').classList.remove('hidden');
}

function closeLightbox(e) {
  if (e && e.target !== e.currentTarget && !e.target.classList.contains('lightbox-close')) return;
  document.getElementById('lightbox').classList.add('hidden');
  currentLightboxId = null;
}

function deleteCurrentPin() {
  if (currentLightboxId == null) return;
  deletePin(currentLightboxId);
}

async function editCurrentPin() {
  const item = items.find(i => i.id === currentLightboxId);
  if (!item) return;
  const title = prompt('Edit photo title:', item.title || '');
  if (title === null) return;
  const note = prompt('Edit note:', item.text || '');
  if (note === null) return;
  const cleanTitle = title.trim() || 'Untitled';
  const cleanNote = note.trim();

  try {
    if (cloudEnabled && sbClient) {
      const { error } = await sbClient.from('pins')
        .update({ title: cleanTitle, note: cleanNote })
        .eq('id', item.id)
        .eq('user_id', currentUser.id);
      if (error) throw error;
    }
    item.title = cleanTitle;
    item.text = cleanNote;
    if (!cloudEnabled && currentUser) {
      localStorage.setItem(`racle_items_${currentUser.email}`, JSON.stringify(items));
    }
    document.getElementById('lightboxTitle').textContent = item.title;
    document.getElementById('lightboxText').textContent = item.text;
    renderGallery();
  } catch (err) {
    alert(err.message || 'Could not update photo details');
  }
}

function downloadCurrentPin() {
  const item = items.find(i => i.id === currentLightboxId);
  if (!item || !item.photo) {
    alert('No image to download');
    return;
  }
  const a = document.createElement('a');
  a.href = item.photo;
  a.download = (item.title || 'racle-album') + '.jpg';
  a.target = '_blank';
  a.click();
}

function getFilteredSortedItems() {
  const q = (document.getElementById('searchInput')?.value || '').trim().toLowerCase();
  const sort = document.getElementById('sortSelect')?.value || 'newest';
  let list = [...items];
  if (q) {
    list = list.filter(i =>
      (i.title || '').toLowerCase().includes(q) ||
      (i.text || '').toLowerCase().includes(q)
    );
  }
  if (sort === 'oldest') list.sort((a, b) => (a.ts || 0) - (b.ts || 0));
  else if (sort === 'title') list.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
  else list.sort((a, b) => (b.ts || 0) - (a.ts || 0));
  return list;
}

function renderGallery() {
  const grid = document.getElementById('galleryGrid');
  if (!grid) return;

  const list = getFilteredSortedItems();
  const countEl = document.getElementById('pinCount');
  if (countEl) {
    countEl.textContent = items.length === 0
      ? 'Your album is ready for its first memory'
      : `${items.length} memor${items.length === 1 ? 'y' : 'ies'} saved${list.length !== items.length ? ` · ${list.length} shown` : ''}`;
  }

  if (list.length === 0) {
    if (items.length === 0) {
      grid.innerHTML = `
        <div class="gallery-empty-state">
          <div class="gallery-empty-icon" aria-hidden="true">✦</div>
          <h2>Your story starts here</h2>
          <p>Make this space yours. Add your favourite photos, meaningful moments, and little notes you want to keep close.</p>
          <button class="btn primary" type="button" onclick="triggerQuickUpload()">＋ Add your first photo</button>
        </div>
      `;
    } else {
      grid.innerHTML = `
        <div class="gallery-no-results">
          <div class="gallery-empty-icon" aria-hidden="true">⌕</div>
          <h2>No memories found</h2>
          <p>Try another title or note, or clear your search to see the whole album again.</p>
          <button class="btn" type="button" onclick="document.getElementById('searchInput').value='';renderGallery()">Clear search</button>
        </div>
      `;
    }
    return;
  }

  let html = '';
  list.forEach((item) => {
    const idAttr = typeof item.id === 'string' ? `'${item.id}'` : item.id;
    html += `
      <div class="pin-card" onclick="openLightbox(${idAttr})" tabindex="0" role="button" aria-label="Open ${escapeHtml(item.title || 'memory')}">
        <button class="pin-delete" type="button" title="Delete memory" aria-label="Delete ${escapeHtml(item.title || 'memory')}" onclick="deletePin(${idAttr}, event)">×</button>
        ${item.photo
          ? `<img src="${item.photo}" alt="${escapeHtml(item.title)}" loading="lazy">`
          : '<div class="pin-card-no-image" aria-hidden="true">✦</div>'}
        <div class="pin-card-body">
          <h3>${escapeHtml(item.title || 'Untitled memory')}</h3>
          ${item.text ? `<p>${escapeHtml(item.text)}</p>` : ''}
          <div class="pin-card-date">${escapeHtml(item.date || '')}</div>
        </div>
      </div>
    `;
  });

  grid.innerHTML = html;
}
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text || '';
  return div.innerHTML;
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeLightbox();
});

init();
