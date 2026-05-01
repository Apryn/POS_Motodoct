const db = require('../config/db');

exports.getAllCustomers = async (req, res) => {
    try {
        const [rows] = await db.execute('SELECT * FROM customers ORDER BY id DESC');
        res.json({ success: true, data: rows });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

exports.createCustomer = async (req, res) => {
    try {
        const { name, phone, license_plate } = req.body;
        const [result] = await db.execute('INSERT INTO customers (name, phone, license_plate) VALUES (?, ?, ?)', [name, phone || null, license_plate]);
        res.status(201).json({ success: true, message: 'Pelanggan berhasil ditambahkan', data: { id: result.insertId, name, phone, license_plate } });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Gagal menambahkan pelanggan' });
    }
};

exports.updateCustomer = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, phone, license_plate } = req.body;
        await db.execute('UPDATE customers SET name=?, phone=?, license_plate=? WHERE id=?', [name, phone || null, license_plate, id]);
        res.json({ success: true, message: 'Pelanggan berhasil diupdate' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Gagal mengupdate pelanggan' });
    }
};

exports.deleteCustomer = async (req, res) => {
    try {
        const { id } = req.params;
        await db.execute('DELETE FROM customers WHERE id=?', [id]);
        res.json({ success: true, message: 'Pelanggan berhasil dihapus' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Gagal menghapus pelanggan' });
    }
};
