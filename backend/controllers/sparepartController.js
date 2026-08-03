const db = require('../config/db');

const normalizeUnit = (u) => {
    if (!u) return 'pcs';
    const val = String(u).trim().toLowerCase();
    if (['pcs', 'psc', 'pc', 'piece', 'pieces', 'pices'].includes(val)) return 'pcs';
    if (['set', 'st', 'sets'].includes(val)) return 'set';
    if (['botol', 'btl'].includes(val)) return 'botol';
    if (['liter', 'ltr'].includes(val)) return 'liter';
    if (['pack', 'pak', 'pck'].includes(val)) return 'pack';
    if (['dus', 'box', 'karton', 'kotak'].includes(val)) return 'dus';
    if (['kaleng', 'klg'].includes(val)) return 'kaleng';
    return val;
};

exports.getAllSpareparts = async (req, res) => {
    try {
        const { status } = req.query;
        let query;
        if (status === 'deleted') {
            query = `SELECT s.*, c.name as category_name FROM spareparts s LEFT JOIN categories c ON s.category_id = c.id WHERE s.is_deleted = 1 ORDER BY s.name ASC, s.id DESC`;
        } else {
            query = `SELECT s.*, c.name as category_name FROM spareparts s LEFT JOIN categories c ON s.category_id = c.id WHERE (s.is_deleted IS NULL OR s.is_deleted = 0) ORDER BY s.name ASC, s.id DESC`;
        }
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
    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();
        const { category_id, code, name, nama_lain, price, stock, supplier, buy_price, discount, rack_location, brand, type, unit } = req.body;
        const buy_total = (buy_price || 0) * (stock || 0);
        const [result] = await conn.execute(
            'INSERT INTO spareparts (category_id, code, name, nama_lain, price, stock, rack_location, supplier, buy_price, buy_total, discount, brand, type, unit) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [category_id || null, code || null, name, nama_lain || null, price, stock || 0, rack_location || null, supplier || null, buy_price || 0, buy_total, discount || 0, brand || null, type || null, normalizeUnit(unit)]
        );
        const sparepartId = result.insertId;

        const stockNum = parseInt(stock) || 0;
        if (stockNum > 0) {
            await conn.execute(
                'INSERT INTO purchases (sparepart_id, supplier, quantity, buy_price, total, note) VALUES (?, ?, ?, ?, ?, ?)',
                [sparepartId, supplier || 'Tanpa Supplier', stockNum, buy_price || 0, buy_total, 'Stok Awal (Input Manual)']
            );
        }

        await conn.commit();
        res.status(201).json({ success: true, message: 'Sparepart berhasil ditambahkan', data: { id: sparepartId } });
    } catch (error) {
        await conn.rollback();
        console.error("Error create sparepart:", error);
        res.status(500).json({ success: false, message: 'Gagal menambahkan sparepart (mungkin kode duplikat)' });
    } finally {
        conn.release();
    }
};

exports.updateSparepart = async (req, res) => {
    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();
        const { id } = req.params;
        const { category_id, code, name, nama_lain, price, stock, supplier, buy_price, discount, rack_location, brand, type, unit } = req.body;
        const buy_total = (buy_price || 0) * (stock || 0);

        // Fetch old stock to calculate change
        const [[oldRow]] = await conn.execute('SELECT stock FROM spareparts WHERE id = ?', [id]);
        
        if (oldRow) {
            const oldStock = parseInt(oldRow.stock) || 0;
            const newStock = parseInt(stock) || 0;
            const diff = newStock - oldStock;

            if (diff > 0) {
                await conn.execute(
                    'INSERT INTO purchases (sparepart_id, supplier, quantity, buy_price, total, note) VALUES (?, ?, ?, ?, ?, ?)',
                    [id, supplier || 'Tanpa Supplier', diff, buy_price || 0, (buy_price || 0) * diff, 'Penyesuaian Stok (Tambah Manual via Edit)']
                );
            } else if (diff < 0) {
                const userId = req.user?.id || 1; // Fallback to admin/system user
                await conn.execute(
                    'INSERT INTO stock_opnames (sparepart_id, user_id, system_stock, physical_stock, difference, reason) VALUES (?, ?, ?, ?, ?, ?)',
                    [id, userId, oldStock, newStock, diff, 'Penyesuaian Stok (Kurang Manual via Edit)']
                );
            }
        }

        await conn.execute(
            'UPDATE spareparts SET category_id=?, code=?, name=?, nama_lain=?, price=?, stock=?, rack_location=?, supplier=?, buy_price=?, buy_total=?, discount=?, brand=?, type=?, unit=? WHERE id=?',
            [category_id || null, code || null, name, nama_lain || null, price, stock, rack_location || null, supplier || null, buy_price || 0, buy_total, discount || 0, brand || null, type || null, normalizeUnit(unit), id]
        );

        await conn.commit();
        res.json({ success: true, message: 'Sparepart berhasil diupdate' });
    } catch (error) {
        await conn.rollback();
        console.error("Error update sparepart:", error);
        res.status(500).json({ success: false, message: 'Gagal mengupdate sparepart' });
    } finally {
        conn.release();
    }
};

exports.deleteSparepart = async (req, res) => {
    try {
        const { id } = req.params;
        await db.execute('UPDATE spareparts SET is_deleted = 1 WHERE id = ?', [id]);
        res.json({ success: true, message: 'Sparepart berhasil dipindahkan ke Tong Sampah' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Gagal menghapus sparepart' });
    }
};

exports.restoreSparepart = async (req, res) => {
    try {
        const { id } = req.params;
        await db.execute('UPDATE spareparts SET is_deleted = 0 WHERE id = ?', [id]);
        res.json({ success: true, message: 'Sparepart berhasil dipulihkan dari Tong Sampah' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Gagal memulihkan sparepart' });
    }
};

exports.permanentDeleteSparepart = async (req, res) => {
    try {
        const { id } = req.params;
        await db.execute('DELETE FROM spareparts WHERE id = ?', [id]);
        res.json({ success: true, message: 'Sparepart berhasil dihapus secara permanen' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Gagal menghapus sparepart secara permanen' });
    }
};


exports.bulkAdjustPrices = async (req, res) => {
    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();
        const { category_id, sparepart_ids, price_type, adjust_type, adjust_value, rounding, password } = req.body;
        const adminId = req.user?.id;

        // 1. Verifikasi password admin/kasir yang sedang login
        const [users] = await conn.execute('SELECT * FROM users WHERE id = ?', [adminId]);
        if (users.length === 0) return res.status(401).json({ success: false, message: 'User tidak ditemukan' });
        const isValid = await require('bcrypt').compare(password, users[0].password);
        if (!isValid) return res.status(401).json({ success: false, message: 'Password salah!' });

        // 2. Tentukan target kolom (price atau buy_price)
        let targetPriceType = price_type;
        if (adjust_type === 'markup') {
            targetPriceType = 'sell';
        }
        const col = targetPriceType === 'buy' ? 'buy_price' : 'price';

        // 3. Ambil data spareparts yang akan disesuaikan
        let query = `SELECT id, price, buy_price, stock FROM spareparts`;
        const params = [];
        if (sparepart_ids && Array.isArray(sparepart_ids) && sparepart_ids.length > 0) {
            query += ` WHERE id IN (${sparepart_ids.map(() => '?').join(',')})`;
            params.push(...sparepart_ids);
        } else if (category_id) {
            query += ` WHERE category_id = ?`;
            params.push(category_id);
        }
        const [spareparts] = await conn.execute(query, params);

        // 4. Update harga masing-masing sparepart
        for (const item of spareparts) {
            const currentVal = Number(item[col] || 0);
            let newVal = currentVal;

            if (adjust_type === 'percentage') {
                newVal = currentVal * (1 + Number(adjust_value) / 100);
            } else if (adjust_type === 'markup') {
                const buyPrice = Number(item.buy_price || 0);
                newVal = buyPrice * (1 + Number(adjust_value) / 100);
            } else {
                newVal = currentVal + Number(adjust_value);
            }

            if (newVal < 0) newVal = 0;

            // Terapkan pembulatan jika diaktifkan
            const roundFactor = Number(rounding);
            if (roundFactor > 0 && newVal > 0) {
                newVal = Math.round(newVal / roundFactor) * roundFactor;
            }

            // Hitung buy_total jika yang diupdate adalah buy_price
            if (targetPriceType === 'buy') {
                const stock = Number(item.stock || 0);
                const buy_total = newVal * stock;
                await conn.execute(
                    `UPDATE spareparts SET buy_price = ?, buy_total = ? WHERE id = ?`,
                    [newVal, buy_total, item.id]
                );
            } else {
                await conn.execute(
                    `UPDATE spareparts SET price = ? WHERE id = ?`,
                    [newVal, item.id]
                );
            }
        }

        await conn.commit();
        res.json({ success: true, message: `Berhasil menyesuaikan harga untuk ${spareparts.length} item` });
    } catch (error) {
        await conn.rollback();
        console.error("Error bulk adjust:", error);
        res.status(500).json({ success: false, message: 'Gagal melakukan penyesuaian harga massal' });
    } finally {
        conn.release();
    }
};

exports.getSparepartStockCard = async (req, res) => {
    try {
        const { id } = req.params;
        
        // 1. Ambil info sparepart (termasuk name, code, stock saat ini)
        const [spRows] = await db.execute('SELECT name, code, stock FROM spareparts WHERE id = ?', [id]);
        if (spRows.length === 0) {
            return res.status(404).json({ success: false, message: 'Sparepart tidak ditemukan' });
        }
        const sparepart = spRows[0];
        
        // 2. Query UNION ALL untuk semua mutasi stok
        const query = `
            SELECT 
                created_at,
                quantity AS qty,
                'pembelian' AS type,
                CONCAT('Pembelian dari ', COALESCE(supplier, 'Tanpa Supplier')) AS description,
                note AS reference
            FROM purchases
            WHERE sparepart_id = ?
            
            UNION ALL
            
            SELECT 
                t.created_at,
                -ts.quantity AS qty,
                'penjualan' AS type,
                CONCAT('Penjualan - Invoice #', t.invoice_number) AS description,
                t.invoice_number AS reference
            FROM transaction_spareparts ts
            JOIN transactions t ON ts.transaction_id = t.id
            WHERE ts.sparepart_id = ?
            
            UNION ALL
            
            SELECT 
                r.created_at,
                r.quantity AS qty,
                'retur' AS type,
                CONCAT('Retur Barang - Invoice #', t.invoice_number) AS description,
                r.reason AS reference
            FROM sparepart_returns r
            JOIN transactions t ON r.transaction_id = t.id
            WHERE r.sparepart_id = ?

            UNION ALL

            SELECT 
                o.created_at,
                o.difference AS qty,
                'opname' AS type,
                CONCAT('Stock Opname (Sistem: ', o.system_stock, ', Fisik: ', o.physical_stock, ')') AS description,
                o.reason AS reference
            FROM stock_opnames o
            WHERE o.sparepart_id = ?
            
            ORDER BY created_at ASC
        `;
        
        const [mutations] = await db.execute(query, [id, id, id, id]);
        
        // 3. Hitung running balance dengan berhitung mundur dari stok saat ini
        let currentStock = sparepart.stock;
        const ledger = [];
        let runningBalance = currentStock;
        
        for (let i = mutations.length - 1; i >= 0; i--) {
            const m = mutations[i];
            m.balance_after = runningBalance;
            m.balance_before = runningBalance - m.qty;
            runningBalance = m.balance_before;
            ledger.unshift(m);
        }
        
        // Jika ada stok awal atau penyesuaian manual sistem
        if (mutations.length === 0 || runningBalance !== 0) {
            ledger.unshift({
                created_at: null,
                qty: runningBalance,
                type: 'penyesuaian',
                description: 'Stok Awal / Penyesuaian Manual Sistem',
                reference: '-',
                balance_before: 0,
                balance_after: runningBalance
            });
        }
        
        res.json({
            success: true,
            sparepart: {
                id,
                name: sparepart.name,
                code: sparepart.code,
                current_stock: sparepart.stock
            },
            data: ledger
        });
    } catch (error) {
        console.error("Error getSparepartStockCard:", error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

exports.getOpnameList = async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 10;
        const category_id = req.query.category_id ? parseInt(req.query.category_id) : null;
        const rack_location = req.query.rack_location ? req.query.rack_location.trim() : null;
        const sortBy = req.query.sortBy === 'random' ? 'random' : 'least_recent';

        let query = `
            SELECT s.*, c.name as category_name 
            FROM spareparts s 
            LEFT JOIN categories c ON s.category_id = c.id
            WHERE (s.is_deleted IS NULL OR s.is_deleted = 0)
        `;
        const params = [];

        if (category_id) {
            query += ` AND s.category_id = ?`;
            params.push(category_id);
        }

        if (rack_location) {
            query += ` AND s.rack_location LIKE ?`;
            params.push(`%${rack_location}%`);
        }

        if (sortBy === 'random') {
            query += ` ORDER BY RAND()`;
        } else {
            query += ` ORDER BY s.last_opname_at ASC, s.id ASC`;
        }

        query += ` LIMIT ?`;
        params.push(limit);

        const [rows] = await db.query(query, params);
        res.json({ success: true, data: rows });
    } catch (error) {
        console.error("Error getOpnameList:", error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

exports.submitOpname = async (req, res) => {
    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();
        const userId = req.user?.id;
        const role = req.user?.role;

        if (role === 'kasir') {
            return res.status(403).json({ success: false, message: 'Akses ditolak: Kasir tidak diperbolehkan melakukan stock opname!' });
        }

        const { items } = req.body;
        if (!items || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ success: false, message: 'Data item opname tidak valid!' });
        }

        for (const item of items) {
            const { sparepart_id, physical_stock, reason } = item;
            if (sparepart_id === undefined || physical_stock === undefined) {
                continue;
            }

            // 1. Ambil stok dan harga beli saat ini
            const [spRows] = await conn.execute(
                'SELECT stock, buy_price FROM spareparts WHERE id = ?',
                [sparepart_id]
            );
            if (spRows.length === 0) continue;
            const system_stock = Number(spRows[0].stock || 0);
            const buy_price = Number(spRows[0].buy_price || 0);
            const physStockNum = Number(physical_stock);
            const difference = physStockNum - system_stock;

            // 2. Catat ke tabel stock_opnames
            await conn.execute(
                `INSERT INTO stock_opnames (sparepart_id, user_id, system_stock, physical_stock, difference, reason)
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [sparepart_id, userId, system_stock, physStockNum, difference, reason || null]
            );

            // 3. Update stok aktual, buy_total, dan tanggal opname terakhir
            const newBuyTotal = buy_price * physStockNum;
            await conn.execute(
                `UPDATE spareparts 
                 SET stock = ?, buy_total = ?, last_opname_at = CURRENT_TIMESTAMP 
                 WHERE id = ?`,
                [physStockNum, newBuyTotal, sparepart_id]
            );
        }

        await conn.commit();
        res.json({ success: true, message: 'Hasil stock opname berhasil disimpan dan stok disesuaikan' });
    } catch (error) {
        await conn.rollback();
        console.error("Error submitOpname:", error);
        res.status(500).json({ success: false, message: 'Gagal memproses stock opname' });
    } finally {
        conn.release();
    }
};

exports.getOpnameHistory = async (req, res) => {
    try {
        const { start_date, end_date, sparepart_id } = req.query;
        const limit = parseInt(req.query.limit) || 50;
        const offset = parseInt(req.query.offset) || 0;

        let query = `
            SELECT o.*, s.name AS sparepart_name, s.code AS sparepart_code, u.username AS user_name
            FROM stock_opnames o
            JOIN spareparts s ON o.sparepart_id = s.id
            JOIN users u ON o.user_id = u.id
            WHERE 1=1
        `;
        const params = [];

        if (start_date) {
            query += ` AND o.created_at >= ?`;
            params.push(`${start_date} 00:00:00`);
        }
        if (end_date) {
            query += ` AND o.created_at <= ?`;
            params.push(`${end_date} 23:59:59`);
        }
        if (sparepart_id) {
            query += ` AND o.sparepart_id = ?`;
            params.push(sparepart_id);
        }

        query += ` ORDER BY o.created_at DESC LIMIT ? OFFSET ?`;
        params.push(limit, offset);

        const [rows] = await db.query(query, params);
        res.json({ success: true, data: rows });
    } catch (error) {
        console.error("Error getOpnameHistory:", error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

