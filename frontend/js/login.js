const loginForm = document.getElementById("loginForm");

loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  
  const username = document.getElementById("username").value;
  const password = document.getElementById("password").value;
  
  // Validasi sederhana
  if (!username || !password) {
    alert("Username dan password harus diisi!");
    return;
  }
  
  try {
    // Kirim request ke backend
    const response = await fetch("http://localhost:3000/api/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ username, password })
    });
    
    const data = await response.json();
    
    if (response.ok) {
      alert("Login berhasil!");
      // Simpan token atau redirect ke dashboard
      localStorage.setItem("token", data.token);
      window.location.href = "index.html";
    } else {
      alert(data.message || "Login gagal!");
    }
  } catch (error) {
    console.error("Error:", error);
    alert("Tidak bisa terhubung ke server!");
  }
});
