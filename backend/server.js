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
const reminderRoutes = require("./routes/reminderRoutes");

const path = require("path");
const fs = require("fs");

const app = express();
const PORT = process.env.PORT || 3000;

// Konfigurasi CORS yang dinamis untuk menghindari pemblokiran di produksi/development
app.use(cors({
  origin: function(origin, callback) {
    // Mengizinkan semua origin secara dinamis
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

// Catch-all: Jika user mengakses /dashboard.html, /transaksi.html, dll langsung
// tanpa prefix /pages/, sajikan dari folder pages/ secara otomatis
app.get("/:page.html", (req, res, next) => {
  const pagePath = path.join(__dirname, "../frontend/pages", req.params.page + ".html");
  if (fs.existsSync(pagePath)) {
    return res.sendFile(pagePath);
  }
  next();
});

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
app.use("/api/reminders", reminderRoutes);

// Global Error Handler
app.use((err, req, res, next) => {
  console.error("❌ System Error:", err.stack);
  res.status(500).json({ success: false, message: "Terjadi kesalahan internal pada server!" });
});

app.listen(PORT, async () => {
  console.log(`🚀 Server berjalan di http://localhost:${PORT}`);

  // Auto-create oil_reminders table if it doesn't exist (with nullable transaction_id)
  try {
    await db.execute(`
      CREATE TABLE IF NOT EXISTS oil_reminders (
        id INT AUTO_INCREMENT PRIMARY KEY,
        transaction_id INT NULL,
        customer_id INT NOT NULL,
        sparepart_name VARCHAR(150) NOT NULL,
        scheduled_date DATE NOT NULL,
        status ENUM('pending', 'sent') DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE CASCADE,
        FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`
    );
    // Jalankan ALTER untuk memastikan tabel lama ikut termigrasi jika sudah ada sebelumnya
    await db.execute("ALTER TABLE oil_reminders MODIFY COLUMN transaction_id INT NULL");
    console.log("✅ Tabel oil_reminders terverifikasi & termigrasi!");
  } catch (err) {
    console.error("❌ Gagal memverifikasi/migrasi tabel oil_reminders:", err.message);
  }

  // Auto-create reminder_templates table if it doesn't exist
  try {
    await db.execute(`
      CREATE TABLE IF NOT EXISTS reminder_templates (
        id INT AUTO_INCREMENT PRIMARY KEY,
        service_keyword VARCHAR(100) NOT NULL UNIQUE,
        name VARCHAR(150) NOT NULL,
        interval_days INT NOT NULL,
        wa_template TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`
    );
    console.log("✅ Tabel reminder_templates terverifikasi!");

    // Seed default templates if empty
    const [existing] = await db.execute("SELECT COUNT(*) as count FROM reminder_templates");
    if (existing[0].count === 0) {
      await db.execute(`
        INSERT INTO reminder_templates (service_keyword, name, interval_days, wa_template) VALUES
        ('oli', 'Ganti Oli', 39, 'Halo Kak {{name}},\\n\\nkami dari Bengkel Motodoct ingin mengingatkan bahwa motor Anda dengan plat nomor {{license_plate}} sudah waktunya untuk ganti oli kembali (terakhir ganti oli tanggal {{last_date}} dengan produk {{service_name}}).\\n\\nSilakan mampir ke bengkel kami untuk menjaga performa mesin motor Anda agar tetap prima. Terima kasih! 😊🙏'),
        ('cvt', 'Servis CVT', 120, 'Halo Kak {{name}},\\n\\nkami dari Bengkel Motodoct ingin mengingatkan bahwa motor Anda dengan plat nomor {{license_plate}} sudah waktunya untuk melakukan perawatan berkala: *{{service_name}}*.\\n\\nSilakan mampir ke bengkel kami untuk menjaga performa mesin motor Anda agar tetap prima dan aman dikendarai. Terima kasih! 😊🙏'),
        ('ban', 'Ganti Ban', 365, 'Halo Kak {{name}},\\n\\nkami dari Bengkel Motodoct ingin mengingatkan bahwa motor Anda dengan plat nomor {{license_plate}} sudah waktunya untuk melakukan pengecekan/penggantian: *{{service_name}}* demi keselamatan berkendara.\\n\\nSilakan mampir ke bengkel kami untuk menjaga performa mesin motor Anda agar tetap prima. Terima kasih! 😊🙏')
      `);
      console.log("✅ Seed data template pengingat berhasil dibuat!");
    }
  } catch (err) {
    console.error("❌ Gagal memverifikasi/migrasi tabel reminder_templates:", err.message);
  }

  // Auto-create expenses table if it doesn't exist
  try {
    await db.execute(`
      CREATE TABLE IF NOT EXISTS expenses (
        id INT AUTO_INCREMENT PRIMARY KEY,
        description VARCHAR(255) NOT NULL,
        amount DECIMAL(10,2) NOT NULL,
        category VARCHAR(100) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`
    );
    console.log("✅ Tabel expenses terverifikasi!");
  } catch (err) {
    console.error("❌ Gagal memverifikasi tabel expenses:", err.message);
  }

  // Auto-create saved_carts table if it doesn't exist
  try {
    await db.execute(`
      CREATE TABLE IF NOT EXISTS saved_carts (
        id INT AUTO_INCREMENT PRIMARY KEY,
        license_plate VARCHAR(20) NOT NULL,
        customer_name VARCHAR(100) DEFAULT NULL,
        cart_data TEXT NOT NULL,
        mechanic_id INT DEFAULT NULL,
        note VARCHAR(255) DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (mechanic_id) REFERENCES mechanics(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`
    );
    console.log("✅ Tabel saved_carts terverifikasi!");
  } catch (err) {
    console.error("❌ Gagal memverifikasi tabel saved_carts:", err.message);
  }

  // Auto-create sparepart_returns table if it doesn't exist
  try {
    await db.execute(`
      CREATE TABLE IF NOT EXISTS sparepart_returns (
        id INT AUTO_INCREMENT PRIMARY KEY,
        transaction_id INT NOT NULL,
        sparepart_id INT NOT NULL,
        quantity INT NOT NULL,
        price DECIMAL(10,2) NOT NULL,
        refund_amount DECIMAL(10,2) NOT NULL,
        reason VARCHAR(255) DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE CASCADE,
        FOREIGN KEY (sparepart_id) REFERENCES spareparts(id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`
    );
    console.log("✅ Tabel sparepart_returns terverifikasi!");
  } catch (err) {
    console.error("❌ Gagal memverifikasi tabel sparepart_returns:", err.message);
  }

  // Verify and add missing columns dynamically in a non-destructive way
  try {
    // 1. users.plain_password
    const [userCols] = await db.execute("SHOW COLUMNS FROM users LIKE 'plain_password'");
    if (userCols.length === 0) {
      await db.execute("ALTER TABLE users ADD COLUMN plain_password VARCHAR(255) DEFAULT NULL");
      console.log("🛠️  Kolom plain_password berhasil ditambahkan ke tabel users!");
    }

    // 2. mechanics.commission_rate
    const [mechCols] = await db.execute("SHOW COLUMNS FROM mechanics LIKE 'commission_rate'");
    if (mechCols.length === 0) {
      await db.execute("ALTER TABLE mechanics ADD COLUMN commission_rate DECIMAL(5,2) NOT NULL DEFAULT 35.00");
      console.log("🛠️  Kolom commission_rate berhasil ditambahkan ke tabel mechanics!");
    }

    // 3. transactions.customer_name & license_plate
    const [txCustCols] = await db.execute("SHOW COLUMNS FROM transactions LIKE 'customer_name'");
    if (txCustCols.length === 0) {
      await db.execute("ALTER TABLE transactions ADD COLUMN customer_name VARCHAR(100) DEFAULT NULL");
      console.log("🛠️  Kolom customer_name berhasil ditambahkan ke tabel transactions!");
    }

    const [txPlateCols] = await db.execute("SHOW COLUMNS FROM transactions LIKE 'license_plate'");
    if (txPlateCols.length === 0) {
      await db.execute("ALTER TABLE transactions ADD COLUMN license_plate VARCHAR(20) DEFAULT NULL");
      console.log("🛠️  Kolom license_plate berhasil ditambahkan ke tabel transactions!");
    }

    // 4. spareparts.brand
    const [sparepartCols] = await db.execute("SHOW COLUMNS FROM spareparts LIKE 'brand'");
    if (sparepartCols.length === 0) {
      await db.execute("ALTER TABLE spareparts ADD COLUMN brand VARCHAR(100) DEFAULT NULL");
      console.log("🛠️  Kolom brand berhasil ditambahkan ke tabel spareparts!");
    }

    // 5. spareparts.unit
    const [unitCols] = await db.execute("SHOW COLUMNS FROM spareparts LIKE 'unit'");
    if (unitCols.length === 0) {
      await db.execute("ALTER TABLE spareparts ADD COLUMN unit VARCHAR(20) DEFAULT 'pcs'");
      console.log("🛠️  Kolom unit berhasil ditambahkan ke tabel spareparts!");
    }

    // 5. mechanics.is_deleted
    const [mechDelCols] = await db.execute("SHOW COLUMNS FROM mechanics LIKE 'is_deleted'");
    if (mechDelCols.length === 0) {
      await db.execute("ALTER TABLE mechanics ADD COLUMN is_deleted TINYINT(1) NOT NULL DEFAULT 0");
      console.log("🛠️  Kolom is_deleted berhasil ditambahkan ke tabel mechanics!");
    }

    console.log("✅ Kolom database tambahan terverifikasi!");
  } catch (err) {
    console.error("❌ Gagal memverifikasi kolom tambahan:", err.message);
  }

  // Cek stok setiap hari jam 08:00 WIB menggunakan node-cron
  cron.schedule("0 8 * * *", () => {
    checkStokAndNotify(db);
  }, {
    timezone: "Asia/Jakarta"
  });
  console.log("⏰ Cek stok terjadwal setiap hari jam 08:00 WIB (Asia/Jakarta)");
});
