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
        const query = `SELECT s.*, c.name as category_name FROM spareparts s LEFT JOIN categories c ON s.category_id = c.id ORDER BY s.name ASC, s.id DESC`;
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
        const { category_id, code, name, nama_lain, price, stock, supplier, buy_price, discount, rack_location, brand, type, unit } = req.body;
        const buy_total = (buy_price || 0) * (stock || 0);
        const [result] = await db.execute(
            'INSERT INTO spareparts (category_id, code, name, nama_lain, price, stock, rack_location, supplier, buy_price, buy_total, discount, brand, type, unit) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [category_id || null, code || null, name, nama_lain || null, price, stock || 0, rack_location || null, supplier || null, buy_price || 0, buy_total, discount || 0, brand || null, type || null, normalizeUnit(unit)]
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
        const { category_id, code, name, nama_lain, price, stock, supplier, buy_price, discount, rack_location, brand, type, unit } = req.body;
        const buy_total = (buy_price || 0) * (stock || 0);
        await db.execute(
            'UPDATE spareparts SET category_id=?, code=?, name=?, nama_lain=?, price=?, stock=?, rack_location=?, supplier=?, buy_price=?, buy_total=?, discount=?, brand=?, type=?, unit=? WHERE id=?',
            [category_id || null, code || null, name, nama_lain || null, price, stock, rack_location || null, supplier || null, buy_price || 0, buy_total, discount || 0, brand || null, type || null, normalizeUnit(unit), id]
        );
        res.json({ success: true, message: 'Sparepart berhasil diupdate' });
    } catch (error) {
        console.error("Error update sparepart:", error);
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


exports.bulkAdjustPrices = async (req, res) => {
    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();
        const { category_id, price_type, adjust_type, adjust_value, rounding, password } = req.body;
        const adminId = req.user?.id;

        // 1. Verifikasi password admin/kasir yang sedang login
        const [users] = await conn.execute('SELECT * FROM users WHERE id = ?', [adminId]);
        if (users.length === 0) return res.status(401).json({ success: false, message: 'User tidak ditemukan' });
        const isValid = await require('bcrypt').compare(password, users[0].password);
        if (!isValid) return res.status(401).json({ success: false, message: 'Password salah!' });

        // 2. Tentukan target kolom (price atau buy_price)
        const col = price_type === 'buy' ? 'buy_price' : 'price';

        // 3. Ambil data spareparts yang akan disesuaikan
        let query = `SELECT id, ${col}, stock FROM spareparts`;
        const params = [];
        if (category_id) {
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
            if (price_type === 'buy') {
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
            
            ORDER BY created_at ASC
        `;
        
        const [mutations] = await db.execute(query, [id, id, id]);
        
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

