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
  const count = Math.floor((canvas.width * canvas.height) / 5500);
  for (let i = 0; i < count; i++) particles.push(new Particle());
}

function connectParticles() {
  for (let a = 0; a < particles.length; a++) {
    for (let b = a + 1; b < particles.length; b++) {
      const dx = particles[a].x - particles[b].x;
      const dy = particles[a].y - particles[b].y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 130) {
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

let supabase = null;
if (cloudEnabled && window.supabase) {
  supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

let currentUser = null;
let items = [];
let currentLightboxId = null;

function setCloudStatus(msg) {
  const el = document.getElementById('cloudStatus');
  if (el) el.textContent = msg;
}

async function init() {
  if (cloudEnabled && supabase) {
    setCloudStatus('Cloud connected • Private • Free Tier');
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      currentUser = {
        id: session.user.id,
        email: session.user.email,
        name: session.user.user_metadata?.name || session.user.email.split('@')[0]
      };
      updateUIForLoggedIn();
      await loadPinsFromCloud();
      showSection('gallery');
      renderGallery();
    } else {
      showSection('auth');
    }

    supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_OUT') {
        currentUser = null;
        items = [];
        showSection('auth');
      }
    });
  } else {
    setCloudStatus('Local mode • Add keys in config.js for cloud');
    // Fallback localStorage
    const savedUser = localStorage.getItem('racle_user');
    if (savedUser) {
      currentUser = JSON.parse(savedUser);
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
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelector(`.tab[onclick*="${tab}"]`).classList.add('active');
  document.getElementById('loginForm').classList.toggle('hidden', tab !== 'login');
  document.getElementById('registerForm').classList.toggle('hidden', tab !== 'register');
}

async function handleLogin(e) {
  e.preventDefault();
  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;
  const btn = document.getElementById('loginBtn');
  if (btn) { btn.disabled = true; btn.textContent = 'Connecting...'; }

  try {
    if (cloudEnabled && supabase) {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      currentUser = {
        id: data.user.id,
        email: data.user.email,
        name: data.user.user_metadata?.name || email.split('@')[0]
      };
      updateUIForLoggedIn();
      await loadPinsFromCloud();
      showSection('gallery');
      renderGallery();
    } else {
      const users = JSON.parse(localStorage.getItem('racle_users') || '[]');
      const user = users.find(u => u.email === email && u.password === password);
      if (!user) throw new Error('Invalid email or password');
      currentUser = { name: user.name, email: user.email };
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

  try {
    if (cloudEnabled && supabase) {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { name } }
      });
      if (error) throw error;
      if (!data.user) throw new Error('Registration failed');
      currentUser = { id: data.user.id, email, name };
      // If email confirmation is required, session may be null
      if (!data.session) {
        alert('Account created! Check your email to confirm, then login.');
        switchTab('login');
        return;
      }
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
    alert(err.message || 'Registration failed');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Create Identity'; }
  }
}

function updateUIForLoggedIn() {
  const authBtn = document.getElementById('authBtn');
  const galleryNav = document.getElementById('galleryNavBtn');
  authBtn.textContent = (currentUser.name || currentUser.email || 'User').split(' ')[0];
  authBtn.onclick = logout;
  if (galleryNav) galleryNav.style.display = 'inline-block';
  const sub = document.getElementById('pinSubtitle');
  if (sub) sub.textContent = `${currentUser.name || 'Your'}'s board`;
}

async function logout() {
  if (cloudEnabled && supabase) {
    await supabase.auth.signOut();
  }
  localStorage.removeItem('racle_user');
  currentUser = null;
  items = [];
  currentLightboxId = null;
  document.getElementById('authBtn').textContent = 'Login';
  document.getElementById('authBtn').onclick = () => showSection('auth');
  const galleryNav = document.getElementById('galleryNavBtn');
  if (galleryNav) galleryNav.style.display = 'none';
  closeLightbox();
  showSection('auth');
}

// ===== CLOUD PINS =====
async function loadPinsFromCloud() {
  if (!supabase || !currentUser) return;
  const { data, error } = await supabase
    .from('pins')
    .select('*')
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
  const { error } = await supabase.storage.from('album-images').upload(path, file, {
    cacheControl: '3600',
    upsert: false
  });
  if (error) throw error;
  const { data } = supabase.storage.from('album-images').getPublicUrl(path);
  return data.publicUrl;
}

async function addPinCloud({ title, text, file }) {
  let imageUrl = null;
  if (file) imageUrl = await uploadImageToCloud(file);

  const { data, error } = await supabase
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
  // Try remove file from storage if path is in our bucket
  if (item?.photo && item.photo.includes('/album-images/')) {
    try {
      const parts = item.photo.split('/album-images/');
      if (parts[1]) {
        await supabase.storage.from('album-images').remove([parts[1]]);
      }
    } catch (_) {}
  }
  const { error } = await supabase.from('pins').delete().eq('id', id);
  if (error) throw error;
}

// ===== UPLOAD HANDLERS =====
function previewPhoto(e) {
  const file = e.target.files[0];
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

  try {
    if (cloudEnabled && supabase) {
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
  }
}

function triggerQuickUpload() {
  document.getElementById('quickPhoto').click();
}

async function quickUpload(e) {
  const files = Array.from(e.target.files || []);
  if (!files.length || !currentUser) return;

  try {
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const title = file.name.replace(/\.[^/.]+$/, '') || 'Untitled';
      if (cloudEnabled && supabase) {
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
  }
  e.target.value = '';
}

async function deletePin(id, event) {
  if (event) event.stopPropagation();
  if (!confirm('Delete this pin from Racle Album?')) return;

  try {
    if (cloudEnabled && supabase) {
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
      ? 'No pins yet — upload your first image'
      : `${items.length} pin${items.length === 1 ? '' : 's'}${list.length !== items.length ? ` · showing ${list.length}` : ''}`;
  }

  let html = '';
  const emptySizes = ['tall', 'medium', 'short', 'medium', 'tall', 'short'];

  html += `
    <div class="pin-empty ${emptySizes[0]}" onclick="triggerQuickUpload()">
      <div class="plus">+</div>
      <span class="label">Upload image</span>
    </div>
  `;

  list.forEach((item, i) => {
    const idAttr = typeof item.id === 'string' ? `'${item.id}'` : item.id;
    html += `
      <div class="pin-card" onclick="openLightbox(${idAttr})">
        <button class="pin-delete" title="Delete" onclick="deletePin(${idAttr}, event)">×</button>
        ${item.photo ? `<img src="${item.photo}" alt="${escapeHtml(item.title)}" loading="lazy">` : ''}
        <div class="pin-card-body">
          <h3>${escapeHtml(item.title)}</h3>
          ${item.text ? `<p>${escapeHtml(item.text)}</p>` : ''}
          <div class="pin-card-date">${item.date || ''}</div>
        </div>
      </div>
    `;
    if ((i + 1) % 4 === 0) {
      const size = emptySizes[(i + 1) % emptySizes.length];
      html += `
        <div class="pin-empty ${size}" onclick="triggerQuickUpload()">
          <div class="plus">+</div>
          <span class="label">Upload image</span>
        </div>
      `;
    }
  });

  if (list.length < 4) {
    for (let i = 1; i < 4; i++) {
      html += `
        <div class="pin-empty ${emptySizes[i]}" onclick="triggerQuickUpload()">
          <div class="plus">+</div>
          <span class="label">Upload image</span>
        </div>
      `;
    }
  }

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