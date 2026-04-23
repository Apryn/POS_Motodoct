const db = require('../config/db');

// Mendapatkan semua kategori
exports.getAllCategories = async (req, res) => {
    try {
        const [rows] = await db.execute('SELECT * FROM categories ORDER BY id DESC');
        res.json({ success: true, data: rows });
    } catch (error) {
        console.error("Error get categories:", error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

// Mendapatkan detail satu kategori
exports.getCategoryById = async (req, res) => {
    try {
        const { id } = req.params;
        const [rows] = await db.execute('SELECT * FROM categories WHERE id = ?', [id]);
        
        if (rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Kategori tidak ditemukan' });
        }
        res.json({ success: true, data: rows[0] });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

// Menambahkan kategori baru
exports.createCategory = async (req, res) => {
    try {
        const { name } = req.body;
        if (!name) {
            return res.status(400).json({ success: false, message: 'Nama kategori wajib diisi' });
        }

        const [result] = await db.execute('INSERT INTO categories (name) VALUES (?)', [name]);
        res.status(201).json({
            success: true,
            message: 'Kategori berhasil ditambahkan',
            data: { id: result.insertId, name }
        });
    } catch (error) {
        console.error("Error create category:", error);
        res.status(500).json({ success: false, message: 'Gagal menambahkan kategori' });
    }
};

// Mengupdate kategori
exports.updateCategory = async (req, res) => {
    try {
        const { id } = req.params;
        const { name } = req.body;
        
        if (!name) {
            return res.status(400).json({ success: false, message: 'Nama kategori wajib diisi' });
        }

        await db.execute('UPDATE categories SET name = ? WHERE id = ?', [name, id]);
        res.json({ success: true, message: 'Kategori berhasil diupdate' });
    } catch (error) {
        console.error("Error update category:", error);
        res.status(500).json({ success: false, message: 'Gagal mengupdate kategori' });
    }
};

// Menghapus kategori
exports.deleteCategory = async (req, res) => {
    try {
        const { id } = req.params;
        await db.execute('DELETE FROM categories WHERE id = ?', [id]);
        res.json({ success: true, message: 'Kategori berhasil dihapus' });
    } catch (error) {
        console.error("Error delete category:", error);
        res.status(500).json({ success: false, message: 'Gagal menghapus kategori (kemungkinan masih dipakai oleh sparepart)' });
    }
};
