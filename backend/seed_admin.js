const db = require('./config/db');
const bcrypt = require('bcrypt');

async function seedAdmin() {
    try {
        console.log("Membuat akun admin...");
        
        // Cek apakah admin sudah ada
        const [existing] = await db.execute('SELECT * FROM users WHERE username = "admin"');
        if (existing.length > 0) {
            console.log("✅ Akun admin sudah ada di database.");
            process.exit(0);
        }

        // Enkripsi password
        const passwordHash = await bcrypt.hash('admin123', 10);
        
        // Simpan ke database
        await db.execute(
            'INSERT INTO users (username, password, role) VALUES (?, ?, ?)',
            ['admin', passwordHash, 'admin']
        );
        
        console.log("✅ Akun admin berhasil dibuat!");
        console.log("Username: admin");
        console.log("Password: admin123");
    } catch (error) {
        console.error("❌ Gagal membuat akun admin:", error.message);
    } finally {
        process.exit();
    }
}

seedAdmin();
