const db = require('../config/db');

// Simpan keranjang
exports.saveCart = async (req, res) => {
    try {
        const { license_plate, customer_name, cart_data, mechanic_id, note } = req.body;
        if (!license_plate || !cart_data) {
            return res.status(400).json({ success: false, message: 'Plat nomor dan data keranjang wajib diisi' });
        }
        const [result] = await db.execute(
            'INSERT INTO saved_carts (license_plate, customer_name, cart_data, mechanic_id, note) VALUES (?, ?, ?, ?, ?)',
            [license_plate.toUpperCase(), customer_name || null, JSON.stringify(cart_data), mechanic_id || null, note || null]
        );
        res.status(201).json({ success: true, message: 'Keranjang berhasil disimpan', data: { id: result.insertId } });
    } catch (error) {
        console.error('Save cart error:', error);
        res.status(500).json({ success: false, message: 'Gagal menyimpan keranjang' });
    }
};

// Ambil semua keranjang tersimpan
exports.getAllSavedCarts = async (req, res) => {
    try {
        const [rows] = await db.execute(`
            SELECT sc.*, m.name as mechanic_name
            FROM saved_carts sc
            LEFT JOIN mechanics m ON sc.mechanic_id = m.id
            ORDER BY sc.created_at DESC
        `);
        res.json({ success: true, data: rows });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

// Hapus keranjang tersimpan
exports.deleteSavedCart = async (req, res) => {
    try {
        const { id } = req.params;
        await db.execute('DELETE FROM saved_carts WHERE id = ?', [id]);
        res.json({ success: true, message: 'Keranjang berhasil dihapus' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Gagal menghapus keranjang' });
    }
};

// Update keranjang tersimpan
exports.updateSavedCart = async (req, res) => {
    try {
        const { id } = req.params;
        const { license_plate, customer_name, cart_data, mechanic_id, note } = req.body;
        if (!license_plate || !cart_data) {
            return res.status(400).json({ success: false, message: 'Plat nomor dan data keranjang wajib diisi' });
        }
        await db.execute(
            'UPDATE saved_carts SET license_plate = ?, customer_name = ?, cart_data = ?, mechanic_id = ?, note = ? WHERE id = ?',
            [license_plate.toUpperCase(), customer_name || null, JSON.stringify(cart_data), mechanic_id || null, note || null, id]
        );
        res.json({ success: true, message: 'Keranjang berhasil diupdate' });
    } catch (error) {
        console.error('Update cart error:', error);
        res.status(500).json({ success: false, message: 'Gagal mengupdate keranjang' });
    }
};
