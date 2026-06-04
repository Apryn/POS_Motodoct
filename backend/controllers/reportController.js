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

        // 1. Total Pendapatan Sparepart
        const [[resPendSparepart]] = await db.execute(`
            SELECT COALESCE(SUM(tsp.subtotal), 0) AS total
            FROM transaction_spareparts tsp
            JOIN transactions t ON tsp.transaction_id = t.id
            WHERE DATE(t.created_at) BETWEEN ? AND ?
        `, [dateFrom, dateTo]);

        // 2. Total Pendapatan Jasa
        const [[resPendJasa]] = await db.execute(`
            SELECT COALESCE(SUM(ts.price), 0) AS total
            FROM transaction_services ts
            JOIN transactions t ON ts.transaction_id = t.id
            WHERE DATE(t.created_at) BETWEEN ? AND ?
        `, [dateFrom, dateTo]);

        // 3. HPP Sparepart (Modal Sparepart Terjual)
        const [[resHppSparepart]] = await db.execute(`
            SELECT COALESCE(SUM(tsp.quantity * sp.buy_price), 0) AS total
            FROM transaction_spareparts tsp
            JOIN transactions t ON tsp.transaction_id = t.id
            JOIN spareparts sp ON tsp.sparepart_id = sp.id
            WHERE DATE(t.created_at) BETWEEN ? AND ?
        `, [dateFrom, dateTo]);

        // 4. Beban Komisi Mekanik
        const [[resKomisiMekanik]] = await db.execute(`
            SELECT COALESCE(SUM(ts.price * m.commission_rate / 100), 0) AS total
            FROM transaction_services ts
            JOIN transactions t ON ts.transaction_id = t.id
            JOIN mechanics m ON ts.mechanic_id = m.id
            WHERE DATE(t.created_at) BETWEEN ? AND ?
        `, [dateFrom, dateTo]);

        // 5. Rekapitulasi Komisi Mekanik
        const [rekapMekanik] = await db.execute(`
            SELECT m.name as nama_mekanik, COUNT(ts.id) as total_servis,
                   COALESCE(SUM(ts.price), 0) as total_jasa,
                   COALESCE(SUM(ts.price * m.commission_rate / 100), 0) as total_komisi
            FROM mechanics m
            JOIN transaction_services ts ON m.id = ts.mechanic_id
            JOIN transactions t ON ts.transaction_id = t.id
            WHERE DATE(t.created_at) BETWEEN ? AND ?
            GROUP BY m.id, m.name
            ORDER BY total_komisi DESC
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
        const totalBiayaOps = parseFloat(biayaOps.total_biaya);
        const totalPembelianStok = parseFloat(pembelian.total_pembelian);
        
        const pendSparepart = parseFloat(resPendSparepart.total);
        const pendJasa = parseFloat(resPendJasa.total);
        const hppSparepart = parseFloat(resHppSparepart.total);
        const komisiMekanik = parseFloat(resKomisiMekanik.total);
        
        const labaKotorSparepart = pendSparepart - hppSparepart;
        const labaKotorJasa = pendJasa - komisiMekanik;
        const labaKotorRiil = labaKotorSparepart + labaKotorJasa;
        const labaBersihRiil = labaKotorRiil - totalBiayaOps;

        const cashInflow = totalPendapatan;
        const cashOutflow = totalPembelianStok + totalBiayaOps;
        const netCashFlow = cashInflow - cashOutflow;

        res.json({
            success: true,
            data: {
                total_transaksi: summary.total_transaksi,
                total_pendapatan: totalPendapatan,
                total_pengeluaran: cashOutflow,
                laba_kotor: labaKotorRiil,
                
                // Detail Laba Rugi (Accrual basis)
                pendapatan_sparepart: pendSparepart,
                pendapatan_jasa: pendJasa,
                hpp_sparepart: hppSparepart,
                komisi_mekanik: komisiMekanik,
                laba_kotor_sparepart: labaKotorSparepart,
                laba_kotor_jasa: labaKotorJasa,
                laba_kotor_riil: labaKotorRiil,
                total_biaya_operasional: totalBiayaOps,
                laba_bersih_riil: labaBersihRiil,

                // Arus Kas (Cash Flow basis)
                total_pembelian_stok: totalPembelianStok,
                cash_inflow: cashInflow,
                cash_outflow: cashOutflow,
                net_cash_flow: netCashFlow,

                // Rekap Komisi
                rekap_mekanik: rekapMekanik,

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
