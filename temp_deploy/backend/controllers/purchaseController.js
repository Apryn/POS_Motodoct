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
    try {
        const { id } = req.params;
        await db.execute('DELETE FROM purchases WHERE id = ?', [id]);
        res.json({ success: true, message: 'Pembelian berhasil dihapus' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Gagal menghapus' });
    }
};
