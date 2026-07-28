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
                let spId = s.sparepart_id;
                if (s.is_manual) {
                    const [newSp] = await conn.execute(
                        'INSERT INTO spareparts (name, price, buy_price, stock, type, brand) VALUES (?, ?, ?, ?, ?, ?)',
                        [s.name, s.price, s.buy_price || 0, s.quantity, 'Luar', s.brand || 'Luar']
                    );
                    spId = newSp.insertId;

                    // Log a purchase record for the manual item creation to establish correct history!
                    await conn.execute(
                        'INSERT INTO purchases (sparepart_id, supplier, quantity, buy_price, total, note) VALUES (?, ?, ?, ?, ?, ?)',
                        [spId, 'Input Manual Transaksi', s.quantity, s.buy_price || 0, (s.buy_price || 0) * s.quantity, 'Stok Awal (Input Manual Transaksi)']
                    );
                }
                const subtotal = s.price * s.quantity;
                await conn.execute(
                    'INSERT INTO transaction_spareparts (transaction_id, sparepart_id, quantity, price, subtotal) VALUES (?, ?, ?, ?, ?)',
                    [transaction_id, spId, s.quantity, s.price, subtotal]
                );
                await conn.execute('UPDATE spareparts SET stock = stock - ? WHERE id = ?', [s.quantity, spId]);
            }
        }
        
        if (services && services.length > 0) {
            for (const s of services) {
                const helperId = s.helper_mechanic_id || null;
                const helperComm = parseFloat(s.helper_commission) || 0;
                await conn.execute(
                    'INSERT INTO transaction_services (transaction_id, service_id, mechanic_id, price, helper_mechanic_id, helper_commission) VALUES (?, ?, ?, ?, ?, ?)',
                    [transaction_id, s.service_id, s.mechanic_id, s.price, helperId, helperComm]
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
                                    if (spInfo) {
                                        const nameLower = spInfo.name.toLowerCase();
                                        if (nameLower.includes('oli') || nameLower.includes('sheel') || nameLower.includes('shell')) {
                                            reminderItemName = spInfo.name;
                                            break;
                                        }
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
            SELECT ts.*, s.name as sparepart_name, s.code as sparepart_code, s.unit as sparepart_unit FROM transaction_spareparts ts
            JOIN spareparts s ON ts.sparepart_id = s.id WHERE ts.transaction_id = ?
        `, [id]);
        const [services] = await db.execute(`
            SELECT tsv.*, sv.name as service_name, m.name as mechanic_name
            FROM transaction_services tsv
            JOIN services sv ON tsv.service_id = sv.id
            JOIN mechanics m ON tsv.mechanic_id = m.id WHERE tsv.transaction_id = ?
        `, [id]);
        const [returns] = await db.execute(`
            SELECT sr.*, s.name as sparepart_name, s.code as sparepart_code 
            FROM sparepart_returns sr
            JOIN spareparts s ON sr.sparepart_id = s.id
            WHERE sr.transaction_id = ?
        `, [id]);
        res.json({ success: true, data: { ...trx, spareparts, services, returns } });
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
            SELECT tsp.transaction_id, t.created_at, sp.name as sparepart_name, tsp.quantity, tsp.price, sp.unit as sparepart_unit
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

exports.processReturn = async (req, res) => {
    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();
        const { transaction_id, sparepart_id, quantity, reason } = req.body;

        if (!transaction_id || !sparepart_id || !quantity || quantity <= 0) {
            return res.status(400).json({ success: false, message: 'Data retur tidak valid' });
        }

        // 1. Dapatkan info transaksi untuk diskon ratio
        const [[trx]] = await conn.execute('SELECT * FROM transactions WHERE id = ?', [transaction_id]);
        if (!trx) {
            return res.status(404).json({ success: false, message: 'Transaksi tidak ditemukan' });
        }

        // 2. Dapatkan item sparepart dalam transaksi tersebut
        const [[item]] = await conn.execute(
            'SELECT * FROM transaction_spareparts WHERE transaction_id = ? AND sparepart_id = ?',
            [transaction_id, sparepart_id]
        );
        if (!item) {
            return res.status(400).json({ success: false, message: 'Sparepart tidak ditemukan dalam transaksi ini' });
        }

        // 3. Hitung jumlah yang sudah diretur sebelumnya untuk sparepart ini
        const [[resReturned]] = await conn.execute(
            'SELECT COALESCE(SUM(quantity), 0) AS total_returned FROM sparepart_returns WHERE transaction_id = ? AND sparepart_id = ?',
            [transaction_id, sparepart_id]
        );
        const totalReturned = Number(resReturned.total_returned);
        const maxReturnable = item.quantity - totalReturned;

        if (quantity > maxReturnable) {
            return res.status(400).json({ 
                success: false, 
                message: `Jumlah retur (${quantity}) melebihi jumlah yang bisa diretur (maksimal: ${maxReturnable})` 
            });
        }

        // 4. Hitung refund_amount dengan memperhitungkan diskon transaksi secara proporsional.
        // Hitung subtotal seluruh transaksi dari database untuk mendapatkan diskon ratio asli
        const [[resSubtotalSparepart]] = await conn.execute(
            'SELECT COALESCE(SUM(subtotal), 0) AS total FROM transaction_spareparts WHERE transaction_id = ?',
            [transaction_id]
        );
        const [[resSubtotalJasa]] = await conn.execute(
            'SELECT COALESCE(SUM(price), 0) AS total FROM transaction_services WHERE transaction_id = ?',
            [transaction_id]
        );
        
        const currentSubtotal = Number(resSubtotalSparepart.total) + Number(resSubtotalJasa.total);
        const discountRatio = currentSubtotal > 0 ? (Number(trx.total_amount) / currentSubtotal) : 1;

        const originalReturnSubtotal = quantity * Number(item.price);
        const refundAmount = Math.round(originalReturnSubtotal * discountRatio);

        // 5. Catat log retur
        await conn.execute(
            'INSERT INTO sparepart_returns (transaction_id, sparepart_id, quantity, price, refund_amount, reason) VALUES (?, ?, ?, ?, ?, ?)',
            [transaction_id, sparepart_id, quantity, item.price, refundAmount, reason || 'Retur Pelanggan']
        );

        // 6. Update stok sparepart di gudang
        await conn.execute(
            'UPDATE spareparts SET stock = stock + ? WHERE id = ?',
            [quantity, sparepart_id]
        );

        // 7. Kurangi jumlah dan subtotal di detail transaksi
        // Catatan: kita tidak mengubah original quantity di detail jika tidak mau,
        // namun untuk mempermudah penghitungan report (yang men-sum subtotal), kita update:
        const newQty = item.quantity - quantity;
        const newSubtotal = newQty * Number(item.price);
        
        await conn.execute(
            'UPDATE transaction_spareparts SET quantity = ?, subtotal = ? WHERE transaction_id = ? AND sparepart_id = ?',
            [newQty, newSubtotal, transaction_id, sparepart_id]
        );

        // 8. Kurangi total_amount di master transaksi
        const newTotalAmount = Math.max(0, Number(trx.total_amount) - refundAmount);
        await conn.execute(
            'UPDATE transactions SET total_amount = ? WHERE id = ?',
            [newTotalAmount, transaction_id]
        );

        await conn.commit();
        res.json({ 
            success: true, 
            message: 'Retur sparepart berhasil diproses', 
            data: { refund_amount: refundAmount, new_total: newTotalAmount } 
        });
    } catch (error) {
        await conn.rollback();
        console.error("Error proses retur:", error);
        res.status(500).json({ success: false, message: 'Gagal memproses retur sparepart' });
    } finally {
        conn.release();
    }
};

exports.deleteTransaction = async (req, res) => {
    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();
        const { id } = req.params;

        // 1. Dapatkan detail spareparts dalam transaksi ini
        const [spareparts] = await conn.execute(
            'SELECT sparepart_id, quantity FROM transaction_spareparts WHERE transaction_id = ?',
            [id]
        );

        // 2. Kembalikan stok sparepart
        for (const sp of spareparts) {
            await conn.execute(
                'UPDATE spareparts SET stock = stock + ? WHERE id = ?',
                [sp.quantity, sp.sparepart_id]
            );
        }

        // 3. Hapus data transaksi utama (detail sparepart, detail jasa, pengingat, dan retur akan terhapus otomatis karena CASCADE)
        const [result] = await conn.execute(
            'DELETE FROM transactions WHERE id = ?',
            [id]
        );

        if (result.affectedRows === 0) {
            await conn.rollback();
            return res.status(404).json({ success: false, message: 'Transaksi tidak ditemukan' });
        }

        await conn.commit();
        res.json({ success: true, message: 'Transaksi berhasil dihapus dan stok sparepart telah dikembalikan' });
    } catch (error) {
        await conn.rollback();
        console.error("Error hapus transaksi:", error);
        res.status(500).json({ success: false, message: 'Gagal menghapus transaksi' });
    } finally {
        conn.release();
    }
};


