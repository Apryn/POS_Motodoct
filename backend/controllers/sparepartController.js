const db = require('../config/db');

exports.getAllSpareparts = async (req, res) => {
    try {
        const query = `SELECT s.*, c.name as category_name FROM spareparts s LEFT JOIN categories c ON s.category_id = c.id ORDER BY s.id DESC`;
        const [rows] = await db.execute(query);
        res.json({ success: true, data: rows });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

exports.getSparepartById = async (req, res) => {
    try {
        const { id } = req.params;
        const [rows] = await db.execute('SELECT * FROM spareparts WHERE id = ?', [id]);
        if (rows.length === 0) return res.status(404).json({ success: false, message: 'Sparepart tidak ditemukan' });
        res.json({ success: true, data: rows[0] });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

exports.createSparepart = async (req, res) => {
    try {
        const { category_id, code, name, price, stock, supplier, buy_price, discount, rack_location } = req.body;
        const buy_total = (buy_price || 0) * (stock || 0);
        const [result] = await db.execute(
            'INSERT INTO spareparts (category_id, code, name, price, stock, rack_location, supplier, buy_price, buy_total, discount) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [category_id || null, code || null, name, price, stock || 0, rack_location || null, supplier || null, buy_price || 0, buy_total, discount || 0]
        );
        res.status(201).json({ success: true, message: 'Sparepart berhasil ditambahkan', data: { id: result.insertId } });
    } catch (error) {
        console.error("Error create sparepart:", error);
        res.status(500).json({ success: false, message: 'Gagal menambahkan sparepart (mungkin kode duplikat)' });
    }
};

exports.updateSparepart = async (req, res) => {
    try {
        const { id } = req.params;
        const { category_id, code, name, price, stock, supplier, buy_price, discount, rack_location } = req.body;
        const buy_total = (buy_price || 0) * (stock || 0);
        await db.execute(
            'UPDATE spareparts SET category_id=?, code=?, name=?, price=?, stock=?, rack_location=?, supplier=?, buy_price=?, buy_total=?, discount=? WHERE id=?',
            [category_id || null, code || null, name, price, stock, rack_location || null, supplier || null, buy_price || 0, buy_total, discount || 0, id]
        );
        res.json({ success: true, message: 'Sparepart berhasil diupdate' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Gagal mengupdate sparepart' });
    }
};

exports.deleteSparepart = async (req, res) => {
    try {
        const { id } = req.params;
        await db.execute('DELETE FROM spareparts WHERE id = ?', [id]);
        res.json({ success: true, message: 'Sparepart berhasil dihapus' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Gagal menghapus sparepart' });
    }
};

exports.deleteAllSpareparts = async (req, res) => {
    try {
        const { password } = req.body;
        const adminId = req.user?.id;
        const [users] = await db.execute('SELECT * FROM users WHERE id = ?', [adminId]);
        if (users.length === 0) return res.status(401).json({ success: false, message: 'User tidak ditemukan' });
        const isValid = await require('bcrypt').compare(password, users[0].password);
        if (!isValid) return res.status(401).json({ success: false, message: 'Password salah!' });
        await db.execute('SET FOREIGN_KEY_CHECKS = 0');
        await db.execute('TRUNCATE TABLE spareparts');
        await db.execute('SET FOREIGN_KEY_CHECKS = 1');
        res.json({ success: true, message: 'Semua sparepart berhasil dihapus' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Gagal menghapus semua sparepart' });
    }
};
