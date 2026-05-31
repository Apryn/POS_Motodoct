const db = require('../config/db');
const { checkStokAndNotify } = require('../services/telegramService');

exports.createTransaction = async (req, res) => {
    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();
        const { customer_id, payment_method, spareparts, services, license_plate, customer_name } = req.body;
        const user_id = req.user.id;
        let total = 0;
        if (spareparts) spareparts.forEach(s => total += Number(s.price) * Number(s.quantity));
        if (services) services.forEach(s => total += Number(s.price));
        const invoice_number = `INV-${Date.now()}`;
        const [trx] = await conn.execute(
            'INSERT INTO transactions (invoice_number, user_id, customer_id, total_amount, payment_method, license_plate, customer_name) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [invoice_number, user_id, customer_id || null, total, payment_method || 'cash', license_plate || null, customer_name || null]
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

        // Jadwal pengingat dinamis jika ada transaksi layanan/jasa yang cocok dengan templat pengingat
        if (customer_id && services && services.length > 0) {
            try {
                const [templates] = await conn.execute('SELECT * FROM reminder_templates');
                for (const s of services) {
                    const [[sv]] = await conn.execute('SELECT name FROM services WHERE id = ?', [s.service_id]);
                    if (sv) {
                        const matchedTemplate = templates.find(t => sv.name.toLowerCase().includes(t.service_keyword.toLowerCase()));
                        if (matchedTemplate) {
                            let reminderItemName = sv.name;
                            
                            // Jika template oli, prioritaskan merek oli yang dibeli di transaksi yang sama
                            if (matchedTemplate.service_keyword.toLowerCase() === 'oli' && spareparts && spareparts.length > 0) {
                                for (const spItem of spareparts) {
                                    const [[spInfo]] = await conn.execute('SELECT name FROM spareparts WHERE id = ?', [spItem.sparepart_id]);
                                    if (spInfo && spInfo.name.toLowerCase().includes('oli')) {
                                        reminderItemName = spInfo.name;
                                        break;
                                    }
                                }
                            }
                            
                            const scheduled = new Date();
                            scheduled.setDate(scheduled.getDate() + matchedTemplate.interval_days);
                            
                            await conn.execute(
                                'INSERT INTO oil_reminders (transaction_id, customer_id, sparepart_name, scheduled_date) VALUES (?, ?, ?, ?)',
                                [transaction_id, customer_id, reminderItemName, scheduled]
                            );
                            
                            // Hanya jadwalkan satu pengingat per transaksi demi kesederhanaan
                            break;
                        }
                    }
                }
            } catch (err) {
                console.error("Gagal menjadwalkan pengingat dinamis di transaksi:", err.message);
            }
        }
        await conn.commit();

        // Cek stok setelah transaksi — kirim notif kalau ada yang menipis/habis
        checkStokAndNotify(db);

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
            SELECT t.*, COALESCE(c.name, t.customer_name) as customer_name, u.username 
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
            SELECT t.*, COALESCE(t.customer_name, c.name) as customer_name, COALESCE(t.license_plate, c.license_plate) as license_plate, u.username
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

exports.getVehicleHistory = async (req, res) => {
    try {
        const { plate } = req.params;
        const sanitizedPlate = plate.trim().toUpperCase();

        // 1. Get transactions
        const [transactions] = await db.execute(`
            SELECT t.id, t.invoice_number, t.created_at, COALESCE(t.customer_name, c.name) as customer_name, COALESCE(t.license_plate, c.license_plate) as license_plate
            FROM transactions t
            LEFT JOIN customers c ON t.customer_id = c.id
            WHERE COALESCE(t.license_plate, c.license_plate) = ?
            ORDER BY t.created_at DESC
        `, [sanitizedPlate]);

        if (transactions.length === 0) {
            return res.json({ success: true, data: { transactions: [], services: [], spareparts: [] } });
        }

        // 2. Get services
        const [services] = await db.execute(`
            SELECT ts.transaction_id, t.created_at, s.name as service_name, ts.price, m.name as mechanic_name
            FROM transaction_services ts
            JOIN transactions t ON ts.transaction_id = t.id
            LEFT JOIN customers c ON t.customer_id = c.id
            JOIN services s ON ts.service_id = s.id
            JOIN mechanics m ON ts.mechanic_id = m.id
            WHERE COALESCE(t.license_plate, c.license_plate) = ?
            ORDER BY t.created_at DESC
        `, [sanitizedPlate]);

        // 3. Get spareparts
        const [spareparts] = await db.execute(`
            SELECT tsp.transaction_id, t.created_at, sp.name as sparepart_name, tsp.quantity, tsp.price
            FROM transaction_spareparts tsp
            JOIN transactions t ON tsp.transaction_id = t.id
            LEFT JOIN customers c ON t.customer_id = c.id
            JOIN spareparts sp ON tsp.sparepart_id = sp.id
            WHERE COALESCE(t.license_plate, c.license_plate) = ?
            ORDER BY t.created_at DESC
        `, [sanitizedPlate]);

        res.json({
            success: true,
            data: {
                license_plate: sanitizedPlate,
                customer_name: transactions[0].customer_name,
                last_visit: transactions[0].created_at,
                transactions,
                services,
                spareparts
            }
        });
    } catch (error) {
        console.error("Error fetching vehicle history:", error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

