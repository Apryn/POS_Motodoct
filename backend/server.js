require("dotenv").config();
const express = require("express");
const cors = require("cors");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const db = require("./config/db");
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

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Health check
app.get("/", (req, res) => {
  res.json({ message: "Cashier Motodoct API berjalan!" });
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

app.listen(PORT, () => {
  console.log(`🚀 Server berjalan di http://localhost:${PORT}`);

  // Cek stok setiap hari jam 08:00 WIB
  scheduleDailyCheck();
});

function scheduleDailyCheck() {
  const now = new Date();
  const next8am = new Date();
  next8am.setHours(8, 0, 0, 0);
  if (now >= next8am) next8am.setDate(next8am.getDate() + 1);

  const msUntil8am = next8am - now;

  setTimeout(() => {
    checkStokAndNotify(db);
    // Ulangi setiap 24 jam
    setInterval(() => checkStokAndNotify(db), 24 * 60 * 60 * 1000);
  }, msUntil8am);

  console.log(`⏰ Cek stok terjadwal jam 08:00 WIB (${Math.round(msUntil8am/1000/60)} menit lagi)`);
}
