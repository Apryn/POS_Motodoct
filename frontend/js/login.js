const API = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? 'http://localhost:3000/api'
  : window.location.origin + '/api';

const loginForm = document.getElementById("loginForm");
const errorMsg = document.getElementById("errorMsg");
const btnLogin = document.getElementById("btnLogin");

loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const username = document.getElementById("username").value.trim();
  const password = document.getElementById("password").value;
  errorMsg.classList.add("hidden");
  btnLogin.disabled = true;
  btnLogin.textContent = "Memproses...";
  try {
    const response = await fetch(`${API}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password })
    });
    const data = await response.json();
    if (response.ok && data.success) {
      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));
      
      // Role defaults mapping
      const roleDefaults = {
        admin: 'dashboard.html',
        kasir: 'transaksi.html',
        gudang: 'sparepart.html',
        owner: 'dashboard.html'
      };
      
      window.location.href = roleDefaults[data.user.role] || 'dashboard.html';
    } else {
      errorMsg.textContent = "⚠️ " + (data.message || "Username atau password salah!");
      errorMsg.classList.remove("hidden");
      btnLogin.disabled = false;
      btnLogin.textContent = "Masuk →";
    }
  } catch (error) {
    errorMsg.textContent = "⚠️ Tidak bisa terhubung ke server!";
    errorMsg.classList.remove("hidden");
    btnLogin.disabled = false;
    btnLogin.textContent = "Masuk →";
  }
});

function togglePassword() {
  const input = document.getElementById("password");
  input.type = input.type === "password" ? "text" : "password";
}
