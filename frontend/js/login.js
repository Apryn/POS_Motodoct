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
    const response = await fetch("http://localhost:3000/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password })
    });
    const data = await response.json();
    if (response.ok && data.success) {
      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));
      window.location.href = "dashboard.html";
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
