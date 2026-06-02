const db = require('../config/db');

exports.getAllCategories = async (req, res) => {
    try {
        const [rows] = await db.execute('SELECT * FROM categories ORDER BY id DESC');
        res.json({ success: true, data: rows });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

exports.getCategoryById = async (req, res) => {
    try {
        const { id } = req.params;
        const [rows] = await db.execute('SELECT * FROM categories WHERE id = ?', [id]);
        if (rows.length === 0) return res.status(404).json({ success: false, message: 'Kategori tidak ditemukan' });
        res.json({ success: true, data: rows[0] });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

exports.createCategory = async (req, res) => {
    try {
        const { name } = req.body;
        if (!name) return res.status(400).json({ success: false, message: 'Nama kategori wajib diisi' });
        const [result] = await db.execute('INSERT INTO categories (name) VALUES (?)', [name]);
        res.status(201).json({ success: true, message: 'Kategori berhasil ditambahkan', data: { id: result.insertId, name } });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Gagal menambahkan kategori' });
    }
};

exports.updateCategory = async (req, res) => {
    try {
        const { id } = req.params;
        const { name } = req.body;
        if (!name) return res.status(400).json({ success: false, message: 'Nama kategori wajib diisi' });
        await db.execute('UPDATE categories SET name = ? WHERE id = ?', [name, id]);
        res.json({ success: true, message: 'Kategori berhasil diupdate' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Gagal mengupdate kategori' });
    }
};

exports.deleteCategory = async (req, res) => {
    try {
        const { id } = req.params;
        await db.execute('DELETE FROM categories WHERE id = ?', [id]);
        res.json({ success: true, message: 'Kategori berhasil dihapus' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Gagal menghapus kategori' });
    }
};
