const db = require('../config/db');

exports.getAllPurchases = async (req, res) => {
    try {
        const [rows] = await db.execute(`
            SELECT p.*, s.name as sparepart_name, s.code as sparepart_code
            FROM purchases p LEFT JOIN spareparts s ON p.sparepart_id = s.id
            ORDER BY p.created_at DESC
        `);
        res.json({ success: true, data: rows });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

exports.createPurchase = async (req, res) => {
    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();

        const { sparepart_id, supplier, quantity, buy_price, note, sell_price, rack_location } = req.body;
        const total = quantity * buy_price;

        // Simpan pembelian
        const [result] = await conn.execute(
            'INSERT INTO purchases (sparepart_id, supplier, quantity, buy_price, total, note) VALUES (?, ?, ?, ?, ?, ?)',
            [sparepart_id || null, supplier || null, quantity, buy_price, total, note || null]
        );

        if (sparepart_id) {
            // Ambil data lama untuk cek kenaikan harga
            const [[current]] = await conn.execute(
                'SELECT stock, buy_price, price FROM spareparts WHERE id = ?',
                [sparepart_id]
            );

            const hargaLama = parseFloat(current?.buy_price) || 0;
            const hargaNaik = buy_price > hargaLama;

            // Replacement Cost: buy_price selalu pakai harga terbaru
            // Harga jual TIDAK otomatis berubah — admin yang putuskan
            await conn.execute(
                `UPDATE spareparts 
                 SET stock = stock + ?,
                     buy_price = ?,
                     buy_total = buy_total + ?,
                     supplier = COALESCE(?, supplier),
                     price = COALESCE(?, price),
                     rack_location = COALESCE(?, rack_location)
                 WHERE id = ?`,
                [quantity, buy_price, total, supplier || null, sell_price || null, rack_location || null, sparepart_id]
            );

            await conn.commit();

            // Kirim info kenaikan harga ke response
            return res.status(201).json({
                success: true,
                message: 'Pembelian berhasil dicatat & stok diperbarui',
                data: {
                    id: result.insertId,
                    total,
                    harga_naik: hargaNaik,
                    harga_lama: hargaLama,
                    harga_baru: buy_price,
                    saran: hargaNaik
                        ? `Harga beli naik dari Rp ${hargaLama.toLocaleString('id-ID')} → Rp ${buy_price.toLocaleString('id-ID')}. Pertimbangkan untuk menyesuaikan harga jual.`
                        : null
                }
            });
        }

        await conn.commit();
        res.status(201).json({
            success: true,
            message: 'Pembelian berhasil dicatat',
            data: { id: result.insertId, total }
        });
    } catch (error) {
        await conn.rollback();
        console.error('Error purchase:', error);
        res.status(500).json({ success: false, message: 'Gagal mencatat pembelian' });
    } finally {
        conn.release();
    }
};

exports.deletePurchase = async (req, res) => {
    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();
        const { id } = req.params;
        const adjustStock = req.query.adjustStock !== 'false';

        // Ambil info pembelian
        const [[purchase]] = await conn.execute('SELECT * FROM purchases WHERE id = ?', [id]);
        if (!purchase) {
            return res.status(404).json({ success: false, message: 'Pembelian tidak ditemukan' });
        }

        if (adjustStock && purchase.sparepart_id) {
            // Kurangi stok dan buy_total
            await conn.execute(
                `UPDATE spareparts 
                 SET stock = GREATEST(0, stock - ?),
                     buy_total = GREATEST(0, buy_total - ?)
                 WHERE id = ?`,
                [purchase.quantity, purchase.total, purchase.sparepart_id]
            );

            // Ambil pembelian terakhir tersisa untuk update buy_price dan supplier
            const [remaining] = await conn.execute(
                `SELECT buy_price, supplier 
                 FROM purchases 
                 WHERE sparepart_id = ? AND id != ?
                 ORDER BY created_at DESC LIMIT 1`,
                [purchase.sparepart_id, id]
            );

            if (remaining.length > 0) {
                await conn.execute(
                    `UPDATE spareparts 
                     SET buy_price = ?,
                         supplier = ?
                     WHERE id = ?`,
                    [remaining[0].buy_price, remaining[0].supplier, purchase.sparepart_id]
                );
            } else {
                await conn.execute(
                    `UPDATE spareparts 
                     SET buy_price = 0,
                         supplier = NULL
                     WHERE id = ?`,
                    [purchase.sparepart_id]
                );
            }
        }

        await conn.execute('DELETE FROM purchases WHERE id = ?', [id]);
        await conn.commit();
        res.json({ success: true, message: 'Pembelian berhasil dihapus' });
    } catch (error) {
        await conn.rollback();
        console.error('Error deletePurchase:', error);
        res.status(500).json({ success: false, message: 'Gagal menghapus' });
    } finally {
        conn.release();
    }
};

exports.deletePurchasesBySupplier = async (req, res) => {
    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();

        const { supplier, adjustStock, password } = req.body;
        const adminId = req.user?.id;
        const [users] = await conn.execute('SELECT * FROM users WHERE id = ?', [adminId]);
        if (users.length === 0) {
            return res.status(401).json({ success: false, message: 'User tidak ditemukan' });
        }
        const isValid = await require('bcrypt').compare(password, users[0].password);
        if (!isValid) {
            return res.status(401).json({ success: false, message: 'Password salah!' });
        }

        if (!supplier || supplier.trim() === '') {
            return res.status(400).json({ success: false, message: 'Supplier harus ditentukan!' });
        }

        // Ambil semua pembelian untuk supplier tersebut
        const [purchases] = await conn.execute(
            'SELECT id, sparepart_id, quantity, total FROM purchases WHERE supplier = ?',
            [supplier]
        );

        if (purchases.length === 0) {
            return res.status(404).json({ success: false, message: 'Tidak ada data pembelian untuk supplier ini.' });
        }

        if (adjustStock) {
            const purchaseIds = purchases.map(p => p.id);
            for (const purchase of purchases) {
                if (purchase.sparepart_id) {
                    // Kurangi stok dan buy_total
                    await conn.execute(
                        `UPDATE spareparts 
                         SET stock = GREATEST(0, stock - ?),
                             buy_total = GREATEST(0, buy_total - ?)
                         WHERE id = ?`,
                        [purchase.quantity, purchase.total, purchase.sparepart_id]
                    );

                    // Ambil pembelian terakhir tersisa untuk update buy_price dan supplier
                    const [remaining] = await conn.execute(
                        `SELECT buy_price, supplier 
                         FROM purchases 
                         WHERE sparepart_id = ? AND id NOT IN (${purchaseIds.join(',')})
                         ORDER BY created_at DESC LIMIT 1`,
                        [purchase.sparepart_id]
                    );

                    if (remaining.length > 0) {
                        await conn.execute(
                            `UPDATE spareparts 
                             SET buy_price = ?,
                                 supplier = ?
                             WHERE id = ?`,
                            [remaining[0].buy_price, remaining[0].supplier, purchase.sparepart_id]
                        );
                    } else {
                        await conn.execute(
                            `UPDATE spareparts 
                             SET buy_price = 0,
                                 supplier = NULL
                             WHERE id = ?`,
                            [purchase.sparepart_id]
                        );
                    }
                }
            }
        }

        // Hapus pembelian
        await conn.execute(
            'DELETE FROM purchases WHERE supplier = ?',
            [supplier]
        );

        await conn.commit();
        res.json({ success: true, message: `Berhasil menghapus ${purchases.length} data pembelian untuk supplier "${supplier}"` });
    } catch (error) {
        await conn.rollback();
        console.error('Error deletePurchasesBySupplier:', error);
        res.status(500).json({ success: false, message: 'Gagal menghapus pembelian supplier' });
    } finally {
        conn.release();
    }
};

exports.previewUndoLastImport = async (req, res) => {
    try {
        // 1. Dapatkan timestamp impor terakhir dengan catatan 'Import Excel'
        const [[lastImport]] = await db.execute(
            `SELECT MAX(created_at) as max_time FROM purchases WHERE note = 'Import Excel'`
        );

        if (!lastImport || !lastImport.max_time) {
            return res.status(404).json({ success: false, message: 'Tidak ada data impor Excel yang dapat dibatalkan.' });
        }

        const maxTime = lastImport.max_time;

        // 2. Dapatkan semua pembelian dengan note = 'Import Excel' yang terbuat dalam rentang 15 detik dari maxTime
        const [purchases] = await db.execute(
            `SELECT p.id, p.sparepart_id, s.name as sparepart_name, s.code as sparepart_code, 
                    p.supplier, p.quantity, p.buy_price, p.total, p.created_at
             FROM purchases p
             LEFT JOIN spareparts s ON p.sparepart_id = s.id
             WHERE p.note = 'Import Excel' 
               AND ABS(TIMESTAMPDIFF(SECOND, p.created_at, ?)) <= 15
             ORDER BY s.name ASC`,
            [maxTime]
        );

        if (purchases.length === 0) {
            return res.status(404).json({ success: false, message: 'Tidak ditemukan data pembelian untuk impor terakhir.' });
        }

        res.json({
            success: true,
            data: purchases,
            total_items: purchases.length,
            total_quantity: purchases.reduce((sum, p) => sum + p.quantity, 0),
            total_amount: purchases.reduce((sum, p) => sum + parseFloat(p.total), 0),
            import_time: maxTime
        });
    } catch (error) {
        console.error('Error previewUndoLastImport:', error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

exports.undoLastImport = async (req, res) => {
    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();

        const { password } = req.body;
        const adminId = req.user?.id;
        const [users] = await conn.execute('SELECT * FROM users WHERE id = ?', [adminId]);
        if (users.length === 0) {
            return res.status(401).json({ success: false, message: 'User tidak ditemukan' });
        }
        const isValid = await require('bcrypt').compare(password, users[0].password);
        if (!isValid) {
            return res.status(401).json({ success: false, message: 'Password salah!' });
        }

        // 1. Dapatkan timestamp impor terakhir dengan catatan 'Import Excel'
        const [[lastImport]] = await conn.execute(
            `SELECT MAX(created_at) as max_time FROM purchases WHERE note = 'Import Excel'`
        );

        if (!lastImport || !lastImport.max_time) {
            return res.status(404).json({ success: false, message: 'Tidak ada data impor Excel yang dapat dibatalkan.' });
        }

        const maxTime = lastImport.max_time;

        // 2. Dapatkan semua pembelian dengan note = 'Import Excel' yang terbuat dalam rentang 15 detik dari maxTime
        const [purchases] = await conn.execute(
            `SELECT id, sparepart_id, quantity, total 
             FROM purchases 
             WHERE note = 'Import Excel' 
               AND ABS(TIMESTAMPDIFF(SECOND, created_at, ?)) <= 15`,
            [maxTime]
        );

        if (purchases.length === 0) {
            return res.status(404).json({ success: false, message: 'Tidak ditemukan data pembelian untuk impor terakhir.' });
        }

        const purchaseIds = purchases.map(p => p.id);

        // 3. Kembalikan stok & total harga beli untuk setiap sparepart
        for (const purchase of purchases) {
            if (purchase.sparepart_id) {
                // Kurangi stok dan buy_total
                await conn.execute(
                    `UPDATE spareparts 
                     SET stock = GREATEST(0, stock - ?),
                         buy_total = GREATEST(0, buy_total - ?)
                     WHERE id = ?`,
                    [purchase.quantity, purchase.total, purchase.sparepart_id]
                );

                // Ambil pembelian terakhir tersisa untuk update buy_price dan supplier
                const [remaining] = await conn.execute(
                    `SELECT buy_price, supplier 
                     FROM purchases 
                     WHERE sparepart_id = ? AND id NOT IN (${purchaseIds.join(',')})
                     ORDER BY created_at DESC LIMIT 1`,
                    [purchase.sparepart_id]
                );

                if (remaining.length > 0) {
                    await conn.execute(
                        `UPDATE spareparts 
                         SET buy_price = ?,
                             supplier = ?
                         WHERE id = ?`,
                        [remaining[0].buy_price, remaining[0].supplier, purchase.sparepart_id]
                    );
                } else {
                    await conn.execute(
                        `UPDATE spareparts 
                         SET buy_price = 0,
                             supplier = NULL
                         WHERE id = ?`,
                        [purchase.sparepart_id]
                    );
                }
            }
        }

        // 4. Hapus data pembelian
        await conn.execute(
            `DELETE FROM purchases WHERE id IN (${purchaseIds.join(',')})`
        );

        await conn.commit();
        res.json({ 
            success: true, 
            message: `Berhasil membatalkan impor terakhir (menghapus ${purchases.length} baris pembelian & memulihkan stok).` 
        });
    } catch (error) {
        await conn.rollback();
        console.error('Error undoLastImport:', error);
        res.status(500).json({ success: false, message: 'Gagal membatalkan impor terakhir.' });
    } finally {
        conn.release();
    }
};

