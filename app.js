

function getAvatarPosition() {
  try { return JSON.parse(localStorage.getItem('racle_avatar_position') || '{"x":50,"y":50}'); }
  catch { return { x: 50, y: 50 }; }
}
function applyAvatarPosition() {
  const pos = getAvatarPosition();
  const avatar = document.getElementById('profileAvatar');
  if (avatar) avatar.style.objectPosition = `${pos.x}% ${pos.y}%`;
}
function updateAvatarPositionPreview() {
  const x = Number(document.getElementById('avatarPositionX')?.value ?? 50);
  const y = Number(document.getElementById('avatarPositionY')?.value ?? 50);
  const xv = document.getElementById('avatarPositionXValue');
  const yv = document.getElementById('avatarPositionYValue');
  if (xv) xv.textContent = x + '%';
  if (yv) yv.textContent = y + '%';
  const avatar = document.getElementById('profileAvatar');
  if (avatar) avatar.style.objectPosition = `${x}% ${y}%`;
}
function saveAvatarPosition() {
  const x = Number(document.getElementById('avatarPositionX')?.value ?? 50);
  const y = Number(document.getElementById('avatarPositionY')?.value ?? 50);
  localStorage.setItem('racle_avatar_position', JSON.stringify({ x, y }));
  applyAvatarPosition();
}
function resetAvatarPosition() {
  const x = document.getElementById('avatarPositionX');
  const y = document.getElementById('avatarPositionY');
  if (x) x.value = 50;
  if (y) y.value = 50;
  saveAvatarPosition();
  updateAvatarPositionPreview();
}

// ===== SETTINGS =====
function populateSettings() {
  const name = document.getElementById('settingsName');
  const email = document.getElementById('settingsEmail');
  const status = document.getElementById('settingsStorageStatus');
  const count = document.getElementById('settingsItemCount');
  if (name) name.value = currentUser?.name || '';
  if (email) email.value = currentUser?.email || '';
  if (status) status.textContent = cloudEnabled && sbClient
    ? 'Cloud sync enabled · account data stored with Supabase'
    : 'Local mode · data stays in this browser only';
  if (count) count.textContent = String(items.length);
  const motion = document.getElementById('motionToggle');
  const compact = document.getElementById('compactToggle');
  if (motion) motion.checked = localStorage.getItem('racle_animated_bg') !== 'off';
  if (compact) compact.checked = localStorage.getItem('racle_compact_cards') === 'on';
  document.body.classList.toggle('ra-motion-off', motion ? !motion.checked : false);
  document.body.classList.toggle('ra-compact-cards', compact ? compact.checked : false);
  const pos = getAvatarPosition();
  const x = document.getElementById('avatarPositionX');
  const y = document.getElementById('avatarPositionY');
  if (x) x.value = pos.x;
  if (y) y.value = pos.y;
  updateAvatarPositionPreview();
}

async function saveAccountSettings() {
  if (!currentUser) { alert('Please log in first.'); return; }
  const nameInput = document.getElementById('settingsName');
  const button = document.getElementById('saveSettingsBtn');
  const name = nameInput?.value.trim() || '';
  if (!name) { alert('Please enter a display name.'); nameInput?.focus(); return; }
  if (button) { button.disabled = true; button.textContent = 'Saving…'; }
  try {
    if (cloudEnabled && sbClient && currentUser.id) {
      const { error } = await sbClient.auth.updateUser({ data: { name } });
      if (error) throw error;
    }
    currentUser.name = name;
    localStorage.setItem('racle_user', JSON.stringify(currentUser));
    updateUIForLoggedIn();
    const welcomeName = document.getElementById('welcomeName');
    if (welcomeName) welcomeName.textContent = name.split(' ')[0];
    const profileName = document.getElementById('profileName');
    if (profileName) profileName.textContent = name.split(' ')[0];
    alert('Profile updated.');
  } catch (error) {
    alert(error?.message || 'Could not save your profile.');
  } finally {
    if (button) { button.disabled = false; button.textContent = 'Save profile'; }
  }
}

function saveAppearanceSettings() {
  const motion = document.getElementById('motionToggle');
  const compact = document.getElementById('compactToggle');
  localStorage.setItem('racle_animated_bg', motion?.checked ? 'on' : 'off');
  localStorage.setItem('racle_compact_cards', compact?.checked ? 'on' : 'off');
  document.body.classList.toggle('ra-motion-off', motion ? !motion.checked : false);
  document.body.classList.toggle('ra-compact-cards', compact ? compact.checked : false);
}

function exportAlbumData() {
  if (!currentUser) { alert('Please log in first.'); return; }
  const backup = {
    exportedAt: new Date().toISOString(),
    app: 'RacleAlbum',
    account: { name: currentUser.name || '', email: currentUser.email || '' },
    itemCount: items.length,
    items: items.map(item => ({
      title: item.title || 'Untitled',
      note: item.text || item.note || '',
      date: item.date || '',
      photoUrl: item.photo || item.image_url || ''
    }))
  };
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'raclealbum-backup.json';
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

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
  if (document.body.classList.contains('ra-motion-off')) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    requestAnimationFrame(animateBackground);
    return;
  }
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

let sbClient = null;
if (cloudEnabled && window.supabase && typeof window.supabase.createClient === 'function') {
  sbClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

let currentUser = null;
let items = [];
let currentLightboxId = null;
let searchTimer = null;
let currentMediaFilter = 'all';

function getFavoriteIds() {
  if (!currentUser || !currentUser.email) return [];
  try { return JSON.parse(localStorage.getItem('racle_favorites_' + currentUser.email) || '[]'); }
  catch (_) { return []; }
}

function isFavorite(id) { return getFavoriteIds().some(value => String(value) === String(id)); }

function setMediaFilter(filter) {
  currentMediaFilter = ['all', 'photos', 'videos', 'favorites'].includes(filter) ? filter : 'all';
  document.querySelectorAll('.media-filter').forEach(button => {
    const active = button.dataset.filter === currentMediaFilter;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
  });
  renderGallery();
}

function toggleFavorite(id, event) {
  if (event) event.stopPropagation();
  if (!currentUser || !currentUser.email) { alert('Please log in to save favorites.'); return; }
  const favorites = getFavoriteIds();
  const index = favorites.findIndex(value => String(value) === String(id));
  if (index >= 0) favorites.splice(index, 1); else favorites.push(id);
  localStorage.setItem('racle_favorites_' + currentUser.email, JSON.stringify(favorites));
  renderGallery();
}

function setCloudStatus(msg) {
  const el = document.getElementById('cloudStatus');
  if (el) el.textContent = msg;
}

async function init() {
  if (cloudEnabled && sbClient) {
    setCloudStatus('Cloud connected • Works on any device');
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
    sbClient.auth.onAuthStateChange(async (event) => {
      if (event === 'SIGNED_OUT') {
        currentUser = null;
        items = [];
        showSection('auth');
      }
    });
  } else {
    setCloudStatus('Local mode • Add keys in config.js for multi-device');
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
  const target = document.getElementById(id);
  if (!target) return;
  if (['gallery', 'upload', 'settings'].includes(id) && !currentUser) {
    alert('Please log in to access your account.');
    id = 'auth';
  }
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.getElementById(id)?.classList.add('active');
  document.querySelectorAll('.side-link').forEach(button => button.classList.remove('active'));
  const activeSide = id === 'settings' ? document.getElementById('sideSettingsBtn') : document.getElementById('sideHomeBtn');
  if (activeSide) activeSide.classList.add('active');
  if (id === 'gallery' && currentUser) renderGallery();
  if (id === 'settings' && currentUser) populateSettings();
}

function switchTab(tab) {
  const loginForm = document.getElementById('loginForm');
  const registerForm = document.getElementById('registerForm');
  const tabs = document.querySelectorAll('.tabs .tab');
  if (!loginForm || !registerForm) return;
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
        email, password, options: { data: { name } }
      });
      if (error) throw error;
      if (!data.user) throw new Error('Registration failed. Please try again.');
      currentUser = { id: data.user.id, email, name };
      if (!data.session) {
        localStorage.setItem('racle_pending_email', email);
        alert('Account created! Check your email to confirm, then log in from any device.');
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
      if (users.find(u => u.email === email)) throw new Error('Email already registered. Please login.');
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
    } else alert(msg);
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
  if (sub) sub.textContent = `${currentUser.name || 'Your'}'s board · same on every device`;
}

async function logout() {
  if (cloudEnabled && sbClient) await sbClient.auth.signOut();
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

async function handleProfilePhotoChange(event) {
  const input = event.target;
  const file = input.files && input.files[0];
  if (!file || !currentUser) return;
  if (!file.type.startsWith('image/')) { alert('Please choose an image file.'); input.value = ''; return; }
  if (file.size > 5 * 1024 * 1024) { alert('Please choose an image smaller than 5 MB.'); input.value = ''; return; }
  const button = document.getElementById('profileAvatarButton');
  if (button) button.disabled = true;
  try {
    let avatarUrl;
    if (cloudEnabled && sbClient && currentUser.id) {
      avatarUrl = await uploadImageToCloud(file);
      const { error } = await sbClient.auth.updateUser({ data: { avatar_url: avatarUrl } });
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
    if (!cloudEnabled || !sbClient) localStorage.setItem('racle_user', JSON.stringify(currentUser));
    updateUIForLoggedIn();
  } catch (error) {
    alert(error.message || 'Could not update profile picture.');
  } finally {
    if (button) button.disabled = false;
    input.value = '';
  }
}

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
    mediaType: detectMediaType(row.image_url),
    date: row.created_at ? new Date(row.created_at).toLocaleString() : '',
    ts: row.created_at ? new Date(row.created_at).getTime() : 0,
    storagePath: row.image_url || null
  }));
}

async function syncAlbumFromCloud() {
  if (!currentUser) { alert('Please log in first.'); return; }
  const btn = document.getElementById('syncBtn');
  if (btn) { btn.disabled = true; btn.textContent = 'Syncing…'; }
  try {
    if (cloudEnabled && sbClient) {
      await loadPinsFromCloud();
      renderGallery();
      if (btn) btn.textContent = '✓ Synced';
      setTimeout(() => { if (btn) btn.textContent = '↻ Sync'; }, 1200);
    } else {
      alert('Cloud is not connected. Multi-device search needs your Supabase key in config.js.');
    }
  } catch (err) {
    alert(err.message || 'Sync failed');
  } finally {
    if (btn) btn.disabled = false;
  }
}

function onSearchInput() {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => renderGallery(), 150);
}

async function uploadImageToCloud(file) {
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
  const path = `${currentUser.id}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
  const { error } = await sbClient.storage.from('album-images').upload(path, file, { cacheControl: '3600', upsert: false });
  if (error) throw error;
  const { data } = sbClient.storage.from('album-images').getPublicUrl(path);
  return data.publicUrl;
}

async function addPinCloud({ title, text, file }) {
  let imageUrl = null;
  if (file) imageUrl = await uploadImageToCloud(file);
  const { data, error } = await sbClient.from('pins').insert({
    user_id: currentUser.id,
    title: title || 'Untitled',
    note: text || '',
    image_url: imageUrl
  }).select().single();
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
      if (parts[1]) await sbClient.storage.from('album-images').remove([parts[1]]);
    } catch (_) {}
  }
  const { error } = await sbClient.from('pins').delete().eq('id', id).eq('user_id', currentUser.id);
  if (error) throw error;
}

function previewPhoto(e) {
  const file = e.target.files[0];
  if (file && !validateMedia(file)) { e.target.value = ''; return; }
  const imagePreview = document.getElementById('photoPreview');
  const videoPreview = document.getElementById('videoPreview');
  imagePreview.classList.add('hidden');
  videoPreview?.classList.add('hidden');
  if (videoPreview) { videoPreview.pause(); videoPreview.removeAttribute('src'); videoPreview.load(); }
  if (file) {
    const preview = file.type.startsWith('video/') ? videoPreview : imagePreview;
    const url = URL.createObjectURL(file);
    preview.src = url;
    preview.classList.remove('hidden');
    preview._file = file;
  } else {
    imagePreview._file = null;
    if (videoPreview) videoPreview._file = null;
  }
}

async function handleUpload(e) {
  e.preventDefault();
  if (!currentUser) { showSection('auth'); return; }
  const title = document.getElementById('itemTitle').value.trim();
  const text = document.getElementById('itemText').value.trim();
  const photoInput = document.getElementById('itemPhoto');
  const file = photoInput.files[0] || document.getElementById('photoPreview')._file || document.getElementById('videoPreview')._file;
  if (file && !validateMedia(file)) return;
  const submitBtn = document.querySelector('#uploadForm button[type="submit"]');
  if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Saving…'; }
  try {
    if (cloudEnabled && sbClient) {
      const pin = await addPinCloud({ title, text, file });
      items.unshift(pin);
    } else {
      let storedMedia = null;
      if (file) {
        storedMedia = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = () => reject(new Error('Could not read this media file.'));
          reader.readAsDataURL(file);
        });
      }
      items.unshift({
        id: Date.now(), title, text,
        photo: storedMedia,
        mediaType: file ? detectMediaType(file.type) : null,
        date: new Date().toLocaleString(), ts: Date.now()
      });
      localStorage.setItem(`racle_items_${currentUser.email}`, JSON.stringify(items));
    }
    document.getElementById('uploadForm').reset();
    const preview = document.getElementById('photoPreview');
    preview.classList.add('hidden');
    preview.src = '';
    preview._file = null;
    const videoPreview = document.getElementById('videoPreview');
    if (videoPreview) { videoPreview.pause(); videoPreview.classList.add('hidden'); videoPreview.removeAttribute('src'); videoPreview.load(); videoPreview._file = null; }
    showSection('gallery');
    renderGallery();
  } catch (err) {
    alert(err.message || 'Upload failed');
  } finally {
    if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Save to Album'; }
  }
}

function detectMediaType(value) {
  if (value && (value.startsWith('video/') || /\.(mp4|webm|mov|m4v|ogv)(?:[?#].*)?$/i.test(value))) return 'video';
  return 'image';
}
function validateMedia(file) {
  if (!file.type || (!file.type.startsWith('image/') && !file.type.startsWith('video/'))) {
    alert('Please choose an image or video file.'); return false;
  }
  const isVideo = file.type.startsWith('video/');
  const maxBytes = isVideo ? (cloudEnabled ? 45 : 15) * 1024 * 1024 : 10 * 1024 * 1024;
  if (file.size > maxBytes) {
    alert(isVideo ? (cloudEnabled ? 'Please choose a video smaller than 45 MB.' : 'In local mode, videos must be smaller than 15 MB. Connect cloud storage for larger videos.') : 'Please choose an image smaller than 10 MB.');
    return false;
  }
  return true;
}

function triggerQuickUpload() { document.getElementById('quickPhoto').click(); }

async function quickUpload(e) {
  const files = Array.from(e.target.files || []);
  if (!files.length || !currentUser) return;
  if (files.some(file => !validateMedia(file))) { e.target.value = ''; return; }
  const uploadBtn = document.querySelector('.toolbar-btn.primary') || document.querySelector('.toolbar-btn');
  const originalLabel = uploadBtn?.textContent;
  if (uploadBtn) { uploadBtn.disabled = true; uploadBtn.textContent = `Uploading 0/${files.length}…`; }
  try {
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (uploadBtn) uploadBtn.textContent = `Uploading ${i + 1}/${files.length}…`;
      const title = file.name.replace(/\.[^/.]+$/, '') || 'Untitled';
      if (cloudEnabled && sbClient) {
        items.unshift(await addPinCloud({ title, text: '', file }));
      } else {
        await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (ev) => {
            items.unshift({ id: Date.now() + i, title, text: '', photo: ev.target.result, mediaType: detectMediaType(file.type), date: new Date().toLocaleString(), ts: Date.now() + i });
            resolve();
          };
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
      }
    }
    if (!cloudEnabled) localStorage.setItem(`racle_items_${currentUser.email}`, JSON.stringify(items));
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
    if (cloudEnabled && sbClient) await deletePinCloud(id);
    items = items.filter(i => i.id !== id);
    if (!cloudEnabled && currentUser) localStorage.setItem(`racle_items_${currentUser.email}`, JSON.stringify(items));
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
  const image = document.getElementById('lightboxImg');
  const video = document.getElementById('lightboxVideo');
  const isVideo = item.photo && detectMediaType(item.mediaType || item.photo) === 'video';
  image.src = isVideo ? '' : (item.photo || '');
  image.style.display = item.photo && !isVideo ? 'block' : 'none';
  if (video) { video.pause(); video.src = isVideo ? item.photo : ''; video.classList.toggle('hidden', !isVideo); if (isVideo) video.load(); }
  document.getElementById('lightboxTitle').textContent = item.title || 'Untitled';
  document.getElementById('lightboxText').textContent = item.text || '';
  document.getElementById('lightboxDate').textContent = item.date || '';
  document.getElementById('lightbox').classList.remove('hidden');
}

function closeLightbox(e) {
  if (e && e.target !== e.currentTarget && !e.target.classList.contains('lightbox-close')) return;
  document.getElementById('lightbox').classList.add('hidden');
  const video = document.getElementById('lightboxVideo');
  if (video) { video.pause(); video.removeAttribute('src'); video.load(); video.classList.add('hidden'); }
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
      const { error } = await sbClient.from('pins').update({ title: cleanTitle, note: cleanNote }).eq('id', item.id).eq('user_id', currentUser.id);
      if (error) throw error;
    }
    item.title = cleanTitle;
    item.text = cleanNote;
    if (!cloudEnabled && currentUser) localStorage.setItem(`racle_items_${currentUser.email}`, JSON.stringify(items));
    document.getElementById('lightboxTitle').textContent = item.title;
    document.getElementById('lightboxText').textContent = item.text;
    renderGallery();
  } catch (err) {
    alert(err.message || 'Could not update');
  }
}

function downloadCurrentPin() {
  const item = items.find(i => i.id === currentLightboxId);
  if (!item || !item.photo) { alert('No media to download'); return; }
  const a = document.createElement('a');
  a.href = item.photo;
  a.download = (item.title || 'racle-album') + (detectMediaType(item.mediaType || item.photo) === 'video' ? '.mp4' : '.jpg');
  a.target = '_blank';
  a.click();
}

function getFilteredSortedItems() {
  const q = (document.getElementById('searchInput')?.value || '').trim().toLowerCase();
  const sort = document.getElementById('sortSelect')?.value || 'newest';
  let list = [...items];
  if (currentMediaFilter === 'photos') list = list.filter(i => i.photo && detectMediaType(i.mediaType || i.photo) !== 'video');
  else if (currentMediaFilter === 'videos') list = list.filter(i => i.photo && detectMediaType(i.mediaType || i.photo) === 'video');
  else if (currentMediaFilter === 'favorites') list = list.filter(i => isFavorite(i.id));
  if (q) {
    const terms = q.split(/\s+/).filter(Boolean);
    list = list.filter(i => {
      const hay = ((i.title || '') + ' ' + (i.text || '')).toLowerCase();
      return terms.every(t => hay.includes(t));
    });
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
    const q = (document.getElementById('searchInput')?.value || '').trim();
    if (items.length === 0) countEl.textContent = 'Your album is ready — upload from any device';
    else if (q && list.length === 0) countEl.textContent = `No matches for "${q}" · try another word`;
    else if (q) countEl.textContent = `${list.length} match${list.length === 1 ? '' : 'es'} for "${q}" · ${items.length} total in cloud`;
    else countEl.textContent = `${items.length} memor${items.length === 1 ? 'y' : 'ies'} saved · synced across your devices`;
  }
  if (list.length === 0) {
    if (items.length === 0) {
      grid.innerHTML = `<div class="gallery-empty-state"><div class="gallery-empty-icon" aria-hidden="true">✦</div><h2>Your story starts here</h2><p>Add photos from your phone or computer — they stay in the cloud for every device.</p><button class="btn primary" type="button" onclick="triggerQuickUpload()">＋ Add your first photo</button></div>`;
    } else {
      grid.innerHTML = `<div class="gallery-no-results"><div class="gallery-empty-icon" aria-hidden="true">⌕</div><h2>No memories found</h2><p>Try another word, or clear search to see the full album.</p><button class="btn" type="button" onclick="document.getElementById('searchInput').value='';renderGallery()">Clear search</button></div>`;
    }
    return;
  }
  let html = '';
  list.forEach((item) => {
    const idAttr = typeof item.id === 'string' ? `'${item.id}'` : item.id;
    const isVideo = item.photo && detectMediaType(item.mediaType || item.photo) === 'video';
    const media = item.photo ? (isVideo ? `<div class="video-card-preview"><video src="${item.photo}" muted playsinline preload="metadata"></video><span class="video-play-badge">▶ VIDEO</span></div>` : `<img src="${item.photo}" alt="${escapeHtml(item.title)}" loading="lazy">`) : '<div class="pin-card-no-image">✦</div>';
    const favorite = isFavorite(item.id);
    html += `<div class="pin-card" onclick="openLightbox(${idAttr})" tabindex="0" role="button"><button class="pin-favorite ${favorite ? 'is-favorite' : ''}" type="button" title="${favorite ? 'Remove from favorites' : 'Add to favorites'}" aria-label="${favorite ? 'Remove from favorites' : 'Add to favorites'}" aria-pressed="${favorite}" onclick="toggleFavorite(${idAttr}, event)">♥</button><button class="pin-delete" type="button" title="Delete" aria-label="Delete memory" onclick="deletePin(${idAttr}, event)">×</button>${media}<div class="pin-card-body"><h3>${escapeHtml(item.title || 'Untitled')}</h3>${item.text ? `<p>${escapeHtml(item.text)}</p>` : ''}<div class="pin-card-date">${isVideo ? '▶ Video · ' : ''}${escapeHtml(item.date || '')}</div></div></div>`;
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
