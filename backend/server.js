require("dotenv").config();
const express = require("express");
const cors = require("cors");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const db = require("./config/db");
const cron = require("node-cron");
const { checkStokAndNotify } = require("./services/telegramService");

// Import Routes
const sparepartRoutes = require("./routes/sparepartRoutes");
const categoryRoutes = require("./routes/categoryRoutes");
const customerRoutes = require("./routes/customerRoutes");
const mechanicRoutes = require("./routes/mechanicRoutes");
const serviceRoutes = require("./routes/serviceRoutes");
const transactionRoutes = require("./routes/transactionRoutes");
const reportRoutes = require("./routes/reportRoutes");
const purchaseRoutes = require("./routes/purchaseRoutes");
const notifRoutes = require("./routes/notifRoutes");
const savedCartRoutes = require("./routes/savedCartRoutes");
const expenseRoutes = require("./routes/expenseRoutes");
const userRoutes = require("./routes/userRoutes");

const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

// Konfigurasi CORS dengan pembatasan domain aman di produksi
const allowedOrigins = process.env.ALLOWED_ORIGINS 
  ? process.env.ALLOWED_ORIGINS.split(',') 
  : ['http://localhost:3000', 'http://localhost:5500', 'http://127.0.0.1:5500'];

app.use(cors({
  origin: function(origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) === -1 && !allowedOrigins.includes('*')) {
      const msg = 'Akses CORS ditolak oleh kebijakan keamanan Motodoct.';
      return callback(new Error(msg), false);
    }
    return callback(null, true);
  },
  credentials: true
}));

app.use(express.json());

// Menyajikan berkas static frontend
app.use(express.static(path.join(__dirname, "../frontend")));

// Halaman utama menyajikan login.html
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "../frontend/pages/login.html"));
});

// Jalur statis untuk halaman HTML di /pages
app.use("/pages", express.static(path.join(__dirname, "../frontend/pages")));

// Health check API
app.get("/api/health", (req, res) => {
  res.json({ success: true, message: "Cashier Motodoct API berjalan!" });
});

// Login
app.post("/api/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    const [users] = await db.execute('SELECT * FROM users WHERE username = ?', [username]);
    if (users.length === 0) {
      return res.status(401).json({ success: false, message: "Username atau password salah!" });
    }
    const user = users[0];
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ success: false, message: "Username atau password salah!" });
    }
    const jwtSecret = process.env.JWT_SECRET || 'rahasia_kasir_bengkel_123';
    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      jwtSecret,
      { expiresIn: '1d' }
    );
    res.json({
      success: true,
      message: "Login berhasil",
      user: { id: user.id, username: user.username, role: user.role },
      token
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ success: false, message: "Terjadi kesalahan pada server!" });
  }
});

// Routes
app.use("/api/spareparts", sparepartRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/customers", customerRoutes);
app.use("/api/mechanics", mechanicRoutes);
app.use("/api/services", serviceRoutes);
app.use("/api/transactions", transactionRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/purchases", purchaseRoutes);
app.use("/api/notif", notifRoutes);
app.use("/api/saved-carts", savedCartRoutes);
app.use("/api/expenses", expenseRoutes);
app.use("/api/users", userRoutes);

// Global Error Handler
app.use((err, req, res, next) => {
  console.error("❌ System Error:", err.stack);
  res.status(500).json({ success: false, message: "Terjadi kesalahan internal pada server!" });
});

app.listen(PORT, () => {
  console.log(`🚀 Server berjalan di http://localhost:${PORT}`);

  // Cek stok setiap hari jam 08:00 WIB menggunakan node-cron
  cron.schedule("0 8 * * *", () => {
    checkStokAndNotify(db);
  }, {
    timezone: "Asia/Jakarta"
  });
  console.log("⏰ Cek stok terjadwal setiap hari jam 08:00 WIB (Asia/Jakarta)");
});
