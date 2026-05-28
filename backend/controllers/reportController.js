const db = require('../config/db');

exports.getSummary = async (req, res) => {
    try {
        const { from, to } = req.query;
        const dateFrom = from || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
        const dateTo = to || new Date().toISOString().split('T')[0];

        const [[summary]] = await db.execute(`
            SELECT COUNT(*) as total_transaksi, COALESCE(SUM(total_amount), 0) as total_pendapatan
            FROM transactions WHERE DATE(created_at) BETWEEN ? AND ?
        `, [dateFrom, dateTo]);

        const [[pembelian]] = await db.execute(`
            SELECT COALESCE(SUM(total), 0) as total_pembelian
            FROM purchases WHERE DATE(created_at) BETWEEN ? AND ?
        `, [dateFrom, dateTo]);

        const [[biayaOps]] = await db.execute(`
            SELECT COALESCE(SUM(amount), 0) as total_biaya
            FROM expenses WHERE DATE(created_at) BETWEEN ? AND ?
        `, [dateFrom, dateTo]);

        const [harian] = await db.execute(`
            SELECT DATE(created_at) as tanggal, SUM(total_amount) as pendapatan, COUNT(*) as jumlah_transaksi
            FROM transactions WHERE DATE(created_at) BETWEEN ? AND ?
            GROUP BY DATE(created_at) ORDER BY tanggal ASC
        `, [dateFrom, dateTo]);

        const [pembayaran] = await db.execute(`
            SELECT payment_method, COUNT(*) as jumlah, SUM(total_amount) as total
            FROM transactions WHERE DATE(created_at) BETWEEN ? AND ?
            GROUP BY payment_method
        `, [dateFrom, dateTo]);

        const [pengeluaranHarian] = await db.execute(`
            SELECT DATE(created_at) as tanggal, COALESCE(SUM(total), 0) as pengeluaran
            FROM (
                SELECT created_at, total FROM purchases WHERE DATE(created_at) BETWEEN ? AND ?
                UNION ALL
                SELECT created_at, amount as total FROM expenses WHERE DATE(created_at) BETWEEN ? AND ?
            ) combined
            GROUP BY DATE(created_at) ORDER BY tanggal ASC
        `, [dateFrom, dateTo, dateFrom, dateTo]);

        const totalPendapatan = parseFloat(summary.total_pendapatan);
        const totalPengeluaran = parseFloat(pembelian.total_pembelian) + parseFloat(biayaOps.total_biaya);

        res.json({
            success: true,
            data: {
                total_transaksi: summary.total_transaksi,
                total_pendapatan: totalPendapatan,
                total_pengeluaran: totalPengeluaran,
                laba_kotor: totalPendapatan - totalPengeluaran,
                harian, 
                pengeluaran_harian: pengeluaranHarian, 
                pembayaran,
                periode: { from: dateFrom, to: dateTo }
            }
        });
    } catch (error) {
        console.error("Error report:", error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

exports.getTransactionList = async (req, res) => {
    try {
        const { from, to } = req.query;
        const dateFrom = from || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
        const dateTo = to || new Date().toISOString().split('T')[0];
        const [rows] = await db.execute(`
            SELECT t.*, c.name as customer_name, c.license_plate, u.username
            FROM transactions t
            LEFT JOIN customers c ON t.customer_id = c.id
            LEFT JOIN users u ON t.user_id = u.id
            WHERE DATE(t.created_at) BETWEEN ? AND ?
            ORDER BY t.created_at DESC
        `, [dateFrom, dateTo]);
        res.json({ success: true, data: rows });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};
