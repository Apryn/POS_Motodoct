require("dotenv").config(); // Load environment variables first
const express = require("express");
const cors = require("cors");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const db = require("./config/db"); // Mengimpor koneksi database

// Import Routes
const sparepartRoutes = require("./routes/sparepartRoutes");
const categoryRoutes = require("./routes/categoryRoutes");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Health check endpoint
app.get("/", (req, res) => {
  res.json({ message: "Cashier Motodoct API berjalan!" });
});

// Endpoint Login (Real Database)
app.post("/api/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    
    // 1. Cek apakah user ada di database
    const [users] = await db.execute('SELECT * FROM users WHERE username = ?', [username]);
    
    if (users.length === 0) {
      return res.status(401).json({ 
        success: false,
        message: "Username atau password salah!"
      });
    }

    const user = users[0];

    // 2. Bandingkan password yang dikirim dengan password yang di-hash di database
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return res.status(401).json({ 
        success: false,
        message: "Username atau password salah!"
      });
    }

    // 3. Buat JWT Token
    // Secret key seharusnya diletakkan di .env (misal JWT_SECRET)
    const jwtSecret = process.env.JWT_SECRET || 'rahasia_kasir_bengkel_123';
    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      jwtSecret,
      { expiresIn: '1d' } // Token berlaku 1 hari
    );

    // 4. Kirim respons sukses
    res.json({ 
      success: true,
      message: "Login berhasil",
      user: {
        id: user.id,
        username: user.username,
        role: user.role
      },
      token: token
    });

  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ 
      success: false,
      message: "Terjadi kesalahan pada server!"
    });
  }
});

// Daftarkan Routes
app.use("/api/spareparts", sparepartRoutes);
app.use("/api/categories", categoryRoutes);

app.listen(PORT, () => {
  console.log(`🚀 Server berjalan di http://localhost:${PORT}`);
});
