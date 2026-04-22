const db = require('../config/db');

// Mendapatkan semua sparepart
exports.getAllSpareparts = async (req, res) => {
    try {
        // Kita juga melakukan JOIN ke tabel categories agar nama kategori muncul
        const query = `
            SELECT s.*, c.name as category_name 
            FROM spareparts s 
            LEFT JOIN categories c ON s.category_id = c.id 
            ORDER BY s.id DESC
        `;
        const [rows] = await db.execute(query);
        res.json({ success: true, data: rows });
    } catch (error) {
        console.error("Error get spareparts:", error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

// Mendapatkan detail satu sparepart
exports.getSparepartById = async (req, res) => {
    try {
        const { id } = req.params;
        const [rows] = await db.execute('SELECT * FROM spareparts WHERE id = ?', [id]);
        
        if (rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Sparepart tidak ditemukan' });
        }
        res.json({ success: true, data: rows[0] });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

// Menambahkan sparepart baru
exports.createSparepart = async (req, res) => {
    try {
        const { category_id, code, name, price, stock } = req.body;
        const [result] = await db.execute(
            'INSERT INTO spareparts (category_id, code, name, price, stock) VALUES (?, ?, ?, ?, ?)',
            [category_id || null, code || null, name, price, stock || 0]
        );
        res.status(201).json({
            success: true,
            message: 'Sparepart berhasil ditambahkan',
            data: { id: result.insertId, category_id, code, name, price, stock }
        });
    } catch (error) {
        console.error("Error create sparepart:", error);
        res.status(500).json({ success: false, message: 'Gagal menambahkan sparepart (mungkin kode/barcode duplikat)' });
    }
};

// Mengupdate sparepart
exports.updateSparepart = async (req, res) => {
    try {
        const { id } = req.params;
        const { category_id, code, name, price, stock } = req.body;
        
        await db.execute(
            'UPDATE spareparts SET category_id = ?, code = ?, name = ?, price = ?, stock = ? WHERE id = ?',
            [category_id || null, code || null, name, price, stock, id]
        );
        res.json({ success: true, message: 'Sparepart berhasil diupdate' });
    } catch (error) {
        console.error("Error update sparepart:", error);
        res.status(500).json({ success: false, message: 'Gagal mengupdate sparepart' });
    }
};

// Menghapus sparepart
exports.deleteSparepart = async (req, res) => {
    try {
        const { id } = req.params;
        await db.execute('DELETE FROM spareparts WHERE id = ?', [id]);
        res.json({ success: true, message: 'Sparepart berhasil dihapus' });
    } catch (error) {
        console.error("Error delete sparepart:", error);
        res.status(500).json({ success: false, message: 'Gagal menghapus sparepart (mungkin sedang digunakan di transaksi)' });
    }
};
