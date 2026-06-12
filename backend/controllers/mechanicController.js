const db = require('../config/db');

exports.getAllMechanics = async (req, res) => {
    try {
        const [rows] = await db.execute('SELECT * FROM mechanics WHERE is_deleted = 0 ORDER BY id DESC');
        res.json({ success: true, data: rows });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

exports.createMechanic = async (req, res) => {
    try {
        const { name, phone, commission_rate } = req.body;
        const rate = parseFloat(commission_rate) || 35.00;
        const [result] = await db.execute('INSERT INTO mechanics (name, phone, commission_rate) VALUES (?, ?, ?)', [name, phone || null, rate]);
        res.status(201).json({ success: true, message: 'Mekanik berhasil ditambahkan', data: { id: result.insertId, name, phone, commission_rate: rate } });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Gagal menambahkan mekanik' });
    }
};

exports.updateMechanic = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, phone, commission_rate } = req.body;
        const rate = parseFloat(commission_rate) || 35.00;
        await db.execute('UPDATE mechanics SET name=?, phone=?, commission_rate=? WHERE id=?', [name, phone || null, rate, id]);
        res.json({ success: true, message: 'Mekanik berhasil diupdate' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Gagal mengupdate mekanik' });
    }
};

exports.deleteMechanic = async (req, res) => {
    try {
        const { id } = req.params;
        await db.execute('UPDATE mechanics SET is_deleted = 1 WHERE id=?', [id]);
        res.json({ success: true, message: 'Mekanik berhasil dihapus' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Gagal menghapus mekanik' });
    }
};

exports.getMechanicJobs = async (req, res) => {
    try {
        const { id } = req.params;
        const [rows] = await db.execute(`
            SELECT 
                ts.id as transaction_service_id,
                ts.price as service_price,
                ts.commission_status,
                ts.claimed_at,
                sv.name as service_name,
                t.invoice_number,
                t.created_at,
                COALESCE(t.customer_name, c.name) as customer_name,
                COALESCE(t.license_plate, c.license_plate) as license_plate,
                m.commission_rate
            FROM transaction_services ts
            JOIN transactions t ON ts.transaction_id = t.id
            JOIN services sv ON ts.service_id = sv.id
            JOIN mechanics m ON ts.mechanic_id = m.id
            LEFT JOIN customers c ON t.customer_id = c.id
            WHERE ts.mechanic_id = ?
            ORDER BY t.created_at DESC
        `, [id]);
        res.json({ success: true, data: rows });
    } catch (error) {
        console.error("Error get mechanic jobs:", error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

exports.claimMechanicCommissions = async (req, res) => {
    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();
        const { id } = req.params;
        const { ids } = req.body;

        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({ success: false, message: 'Pilih setidaknya satu pekerjaan untuk dicairkan!' });
        }

        const placeholders = ids.map(() => '?').join(',');
        const query = `
            UPDATE transaction_services 
            SET commission_status = 'paid', claimed_at = NOW() 
            WHERE id IN (${placeholders}) AND mechanic_id = ? AND commission_status = 'unpaid'
        `;
        
        const [result] = await conn.execute(query, [...ids, id]);

        await conn.commit();
        res.json({ 
            success: true, 
            message: `Berhasil mencairkan komisi untuk ${result.affectedRows} pekerjaan!`,
            affectedRows: result.affectedRows 
        });
    } catch (error) {
        await conn.rollback();
        console.error("Error claim mechanic commissions:", error);
        res.status(500).json({ success: false, message: 'Gagal mencairkan komisi mekanik' });
    } finally {
        conn.release();
    }
};
