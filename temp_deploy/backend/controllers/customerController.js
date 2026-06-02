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

exports.getCustomerHistory = async (req, res) => {
    try {
        const { id } = req.params;
        
        // Ambil semua transaksi yang dilakukan oleh customer ini
        const [transactions] = await db.execute(`
            SELECT t.*, u.username
            FROM transactions t
            LEFT JOIN users u ON t.user_id = u.id
            WHERE t.customer_id = ?
            ORDER BY t.created_at DESC
        `, [id]);
        
        // Untuk setiap transaksi, ambil data spareparts & services nya
        const history = [];
        for (const trx of transactions) {
            const [spareparts] = await db.execute(`
                SELECT ts.*, s.name as sparepart_name 
                FROM transaction_spareparts ts
                JOIN spareparts s ON ts.sparepart_id = s.id 
                WHERE ts.transaction_id = ?
            `, [trx.id]);
            
            const [services] = await db.execute(`
                SELECT tsv.*, sv.name as service_name, m.name as mechanic_name
                FROM transaction_services tsv
                JOIN services sv ON tsv.service_id = sv.id
                JOIN mechanics m ON tsv.mechanic_id = m.id 
                WHERE tsv.transaction_id = ?
            `, [trx.id]);
            
            history.push({
                ...trx,
                spareparts,
                services
            });
        }
        
        res.json({ success: true, data: history });
    } catch (error) {
        console.error("Error customer history:", error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};
