const express = require("express");
const cors = require("cors");
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Health check
app.get("/", (req, res) => {
  res.json({ message: "Cashier Motodoct API berjalan!" });
});

// Login endpoint
app.post("/api/login", (req, res) => {
  const { username, password } = req.body;
  
  // Validasi sederhana (nanti ganti dengan database)
  if (username === "admin" && password === "admin123") {
    res.json({ 
      success: true,
      message: "Login berhasil",
      token: "dummy-token-12345"
    });
  } else {
    res.status(401).json({ 
      success: false,
      message: "Username atau password salah!"
    });
  }
});

app.listen(PORT, () => {
  console.log(`Server berjalan di http://localhost:${PORT}`);
});
