// ===== LIVE SCI-FI BACKGROUND =====
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
    // Cyan to purple tones
    this.color = Math.random() > 0.55 
      ? `rgba(167, 139, 250, ${this.opacity})`  // purple
      : `rgba(34, 211, 238, ${this.opacity})`;  // cyan
  }

  update() {
    this.x += this.speedX;
    this.y += this.speedY;

    // Wrap around edges
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

    // Small glow
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size * 2.5, 0, Math.PI * 2);
    ctx.fillStyle = this.color.replace(/[\d.]+\)$/, '0.08)');
    ctx.fill();
  }
}

function initParticles() {
  particles = [];
  // More particles for stronger visual effect
  const count = Math.floor((canvas.width * canvas.height) / 5500);
  for (let i = 0; i < count; i++) {
    particles.push(new Particle());
  }
}

function connectParticles() {
  for (let a = 0; a < particles.length; a++) {
    for (let b = a + 1; b < particles.length; b++) {
      const dx = particles[a].x - particles[b].x;
      const dy = particles[a].y - particles[b].y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < 130) {
        const opacity = 1 - dist / 130;
        ctx.beginPath();
        ctx.strokeStyle = `rgba(34, 211, 238, ${opacity * 0.18})`;
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

  // Soft radial glow in center
  const gradient = ctx.createRadialGradient(
    canvas.width / 2, canvas.height / 2, 0,
    canvas.width / 2, canvas.height / 2, canvas.width * 0.7
  );
  gradient.addColorStop(0, 'rgba(8, 145, 178, 0.06)');
  gradient.addColorStop(0.4, 'rgba(124, 58, 237, 0.03)');
  gradient.addColorStop(1, 'transparent');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  particles.forEach(p => {
    p.update();
    p.draw();
  });

  connectParticles();
  requestAnimationFrame(animateBackground);
}

// Initialize background
window.addEventListener('resize', () => {
  resizeCanvas();
  initParticles();
});

resizeCanvas();
initParticles();
animateBackground();

// ===== APP LOGIC =====

let currentUser = null;
let items = [];

// Load data on start
function init() {
  const savedUser = localStorage.getItem('racle_user');
  const savedItems = localStorage.getItem('racle_items');

  if (savedUser) {
    currentUser = JSON.parse(savedUser);
    items = savedItems ? JSON.parse(savedItems) : [];
    updateUIForLoggedIn();
    showSection('gallery');
    renderGallery();
  } else {
    showSection('auth');
  }
}

// Navigation
function showSection(id) {
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

// Tabs
function switchTab(tab) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelector(`.tab[onclick*="${tab}"]`).classList.add('active');

  document.getElementById('loginForm').classList.toggle('hidden', tab !== 'login');
  document.getElementById('registerForm').classList.toggle('hidden', tab !== 'register');
}

// Auth handlers (local demo)
function handleLogin(e) {
  e.preventDefault();
  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;

  const users = JSON.parse(localStorage.getItem('racle_users') || '[]');
  const user = users.find(u => u.email === email && u.password === password);

  if (user) {
    currentUser = { name: user.name, email: user.email };
    localStorage.setItem('racle_user', JSON.stringify(currentUser));
    items = JSON.parse(localStorage.getItem(`racle_items_${email}`) || '[]');
    updateUIForLoggedIn();
    showSection('gallery');
    renderGallery();
  } else {
    alert('Invalid email or password');
  }
}

function handleRegister(e) {
  e.preventDefault();
  const name = document.getElementById('regName').value.trim();
  const email = document.getElementById('regEmail').value.trim();
  const password = document.getElementById('regPassword').value;

  let users = JSON.parse(localStorage.getItem('racle_users') || '[]');

  if (users.find(u => u.email === email)) {
    alert('Email already registered. Please login.');
    switchTab('login');
    return;
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
  alert('Account created! You are now logged in.');
}

function updateUIForLoggedIn() {
  const authBtn = document.getElementById('authBtn');
  authBtn.textContent = currentUser.name.split(' ')[0];
  authBtn.onclick = logout;
}

function logout() {
  localStorage.removeItem('racle_user');
  currentUser = null;
  items = [];
  document.getElementById('authBtn').textContent = 'Login';
  document.getElementById('authBtn').onclick = () => showSection('auth');
  showSection('auth');
}

// Upload
function previewPhoto(e) {
  const file = e.target.files[0];
  const preview = document.getElementById('photoPreview');

  if (file) {
    const reader = new FileReader();
    reader.onload = function(ev) {
      preview.src = ev.target.result;
      preview.classList.remove('hidden');
    };
    reader.readAsDataURL(file);
  } else {
    preview.classList.add('hidden');
  }
}

function handleUpload(e) {
  e.preventDefault();

  if (!currentUser) {
    alert('Please login first');
    showSection('auth');
    return;
  }

  const title = document.getElementById('itemTitle').value.trim();
  const text = document.getElementById('itemText').value.trim();
  const preview = document.getElementById('photoPreview');

  const newItem = {
    id: Date.now(),
    title,
    text,
    photo: preview.classList.contains('hidden') ? null : preview.src,
    date: new Date().toLocaleString()
  };

  items.unshift(newItem);
  localStorage.setItem(`racle_items_${currentUser.email}`, JSON.stringify(items));

  // Reset form
  document.getElementById('uploadForm').reset();
  preview.classList.add('hidden');
  preview.src = '';

  showSection('gallery');
  renderGallery();
}

// Render gallery
function renderGallery() {
  const grid = document.getElementById('galleryGrid');

  if (items.length === 0) {
    grid.innerHTML = `
      <div class="empty-state">
        <p>No photos or notes yet.</p>
        <button class="btn primary" onclick="showSection('upload')">Upload your first item</button>
      </div>
    `;
    return;
  }

  grid.innerHTML = items.map(item => `
    <div class="item-card">
      ${item.photo ? `<img src="${item.photo}" alt="${item.title}">` : ''}
      <div class="item-content">
        <h3>${escapeHtml(item.title)}</h3>
        ${item.text ? `<p>${escapeHtml(item.text)}</p>` : ''}
        <div class="item-date">${item.date}</div>
      </div>
    </div>
  `).join('');
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Start the app
init();