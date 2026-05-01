const db = require('../config/db');

exports.createTransaction = async (req, res) => {
    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();
        const { customer_id, payment_method, spareparts, services } = req.body;
        const user_id = req.user.id;
        let total = 0;
        if (spareparts) spareparts.forEach(s => total += s.price * s.quantity);
        if (services) services.forEach(s => total += s.price);
        const invoice_number = `INV-${Date.now()}`;
        const [trx] = await conn.execute(
            'INSERT INTO transactions (invoice_number, user_id, customer_id, total_amount, payment_method) VALUES (?, ?, ?, ?, ?)',
            [invoice_number, user_id, customer_id || null, total, payment_method || 'cash']
        );
        const transaction_id = trx.insertId;
        if (spareparts && spareparts.length > 0) {
            for (const s of spareparts) {
                const subtotal = s.price * s.quantity;
                await conn.execute(
                    'INSERT INTO transaction_spareparts (transaction_id, sparepart_id, quantity, price, subtotal) VALUES (?, ?, ?, ?, ?)',
                    [transaction_id, s.sparepart_id, s.quantity, s.price, subtotal]
                );
                await conn.execute('UPDATE spareparts SET stock = stock - ? WHERE id = ?', [s.quantity, s.sparepart_id]);
            }
        }
        if (services && services.length > 0) {
            for (const s of services) {
                await conn.execute(
                    'INSERT INTO transaction_services (transaction_id, service_id, mechanic_id, price) VALUES (?, ?, ?, ?)',
                    [transaction_id, s.service_id, s.mechanic_id, s.price]
                );
            }
        }
        await conn.commit();
        res.status(201).json({ success: true, message: 'Transaksi berhasil', data: { transaction_id, invoice_number, total } });
    } catch (error) {
        await conn.rollback();
        console.error("Error transaksi:", error);
        res.status(500).json({ success: false, message: 'Gagal membuat transaksi' });
    } finally {
        conn.release();
    }
};

exports.getAllTransactions = async (req, res) => {
    try {
        const [rows] = await db.execute(`
            SELECT t.*, c.name as customer_name, u.username 
            FROM transactions t
            LEFT JOIN customers c ON t.customer_id = c.id
            LEFT JOIN users u ON t.user_id = u.id
            ORDER BY t.created_at DESC
        `);
        res.json({ success: true, data: rows });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

exports.getTransactionById = async (req, res) => {
    try {
        const { id } = req.params;
        const [[trx]] = await db.execute(`
            SELECT t.*, c.name as customer_name, c.license_plate, u.username
            FROM transactions t
            LEFT JOIN customers c ON t.customer_id = c.id
            LEFT JOIN users u ON t.user_id = u.id
            WHERE t.id = ?
        `, [id]);
        if (!trx) return res.status(404).json({ success: false, message: 'Transaksi tidak ditemukan' });
        const [spareparts] = await db.execute(`
            SELECT ts.*, s.name as sparepart_name FROM transaction_spareparts ts
            JOIN spareparts s ON ts.sparepart_id = s.id WHERE ts.transaction_id = ?
        `, [id]);
        const [services] = await db.execute(`
            SELECT tsv.*, sv.name as service_name, m.name as mechanic_name
            FROM transaction_services tsv
            JOIN services sv ON tsv.service_id = sv.id
            JOIN mechanics m ON tsv.mechanic_id = m.id WHERE tsv.transaction_id = ?
        `, [id]);
        res.json({ success: true, data: { ...trx, spareparts, services } });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};
