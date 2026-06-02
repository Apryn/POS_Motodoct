const db = require('../config/db');
const bcrypt = require('bcrypt');

exports.getAllUsers = async (req, res) => {
    try {
        const [rows] = await db.execute('SELECT id, username, plain_password, role, created_at FROM users ORDER BY created_at DESC');
        res.json({ success: true, data: rows });
    } catch (error) {
        console.error("Error get all users:", error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

exports.createUser = async (req, res) => {
    try {
        const { username, password, role } = req.body;
        if (!username || !password || !role) {
            return res.status(400).json({ success: false, message: 'Semua kolom harus diisi!' });
        }
        
        const sanitizedUsername = username.trim().toLowerCase();
        // Cek apakah username sudah ada
        const [exists] = await db.execute('SELECT id FROM users WHERE username = ?', [sanitizedUsername]);
        if (exists.length > 0) {
            return res.status(400).json({ success: false, message: 'Username sudah digunakan!' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        await db.execute(
            'INSERT INTO users (username, password, plain_password, role) VALUES (?, ?, ?, ?)',
            [sanitizedUsername, hashedPassword, password, role]
        );
        res.status(201).json({ success: true, message: 'User berhasil didaftarkan' });
    } catch (error) {
        console.error("Error create user:", error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

exports.updateUser = async (req, res) => {
    try {
        const { id } = req.params;
        const { username, password, role } = req.body;
        
        if (!username || !role) {
            return res.status(400).json({ success: false, message: 'Username dan Role harus diisi!' });
        }

        // 1. Dapatkan info user yang sedang diedit
        const [[targetUser]] = await db.execute('SELECT username FROM users WHERE id = ?', [id]);
        if (!targetUser) {
            return res.status(404).json({ success: false, message: 'User tidak ditemukan' });
        }

        // 2. Proteksi: Akun 'admin' utama hanya bisa diedit oleh dirinya sendiri
        if (targetUser.username === 'admin' && req.user.username !== 'admin') {
            return res.status(403).json({ success: false, message: 'Aksi ditolak: Hanya akun "admin" utama yang dapat mengubah datanya sendiri!' });
        }

        // 3. Proteksi: Username dan role 'admin' utama tidak dapat diganti
        if (targetUser.username === 'admin') {
            const sanitizedUsername = username.trim().toLowerCase();
            if (sanitizedUsername !== 'admin' || role !== 'admin') {
                return res.status(400).json({ success: false, message: 'Aksi ditolak: Username dan Role untuk akun "admin" utama tidak dapat diubah!' });
            }
        }

        const sanitizedUsername = username.trim().toLowerCase();
        // Cek duplikat username jika username diubah
        const [exists] = await db.execute('SELECT id FROM users WHERE username = ? AND id != ?', [sanitizedUsername, id]);
        if (exists.length > 0) {
            return res.status(400).json({ success: false, message: 'Username sudah digunakan oleh user lain!' });
        }

        if (password && password.trim() !== '') {
            // Update dengan password baru
            const hashedPassword = await bcrypt.hash(password, 10);
            await db.execute(
                'UPDATE users SET username = ?, password = ?, plain_password = ?, role = ? WHERE id = ?',
                [sanitizedUsername, hashedPassword, password, role, id]
            );
        } else {
            // Update tanpa mengubah password
            await db.execute(
                'UPDATE users SET username = ?, role = ? WHERE id = ?',
                [sanitizedUsername, role, id]
            );
        }
        res.json({ success: true, message: 'User berhasil di-update' });
    } catch (error) {
        console.error("Error update user:", error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

exports.deleteUser = async (req, res) => {
    try {
        const { id } = req.params;

        // 1. Dapatkan info user yang akan dihapus
        const [[userToDelete]] = await db.execute('SELECT username, role FROM users WHERE id = ?', [id]);
        if (!userToDelete) {
            return res.status(404).json({ success: false, message: 'User tidak ditemukan' });
        }

        // 2. Proteksi: Akun 'admin' utama tidak bisa dihapus oleh siapa pun
        if (userToDelete.username === 'admin') {
            return res.status(403).json({ success: false, message: 'Aksi ditolak: Akun "admin" utama tidak dapat dihapus!' });
        }
        
        // Mencegah admin menghapus dirinya sendiri
        if (Number(id) === Number(req.user.id)) {
            return res.status(400).json({ success: false, message: 'Aksi ditolak: Anda tidak dapat menghapus akun Anda sendiri!' });
        }

        // Cek apakah masih ada minimal satu admin tersisa di database
        const [[{ count }]] = await db.execute('SELECT COUNT(*) as count FROM users WHERE role = "admin"');
        
        if (userToDelete.role === 'admin' && count <= 1) {
            return res.status(400).json({ success: false, message: 'Aksi ditolak: Harus ada minimal satu akun admin tersisa di sistem!' });
        }

        await db.execute('DELETE FROM users WHERE id = ?', [id]);
        res.json({ success: true, message: 'User berhasil dihapus' });
    } catch (error) {
        console.error("Error delete user:", error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};
