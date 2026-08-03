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
            SELECT COALESCE(SUM(IF(LOWER(sv.name) = 'remap', ts.price * 0.5, ts.price * m.commission_rate / 100)), 0) AS total
            FROM transaction_services ts
            JOIN transactions t ON ts.transaction_id = t.id
            JOIN mechanics m ON ts.mechanic_id = m.id
            JOIN services sv ON ts.service_id = sv.id
            WHERE DATE(t.created_at) BETWEEN ? AND ?
        `, [dateFrom, dateTo]);

        // 5. Rekapitulasi Komisi Mekanik & Status Cair/Unpaid
        const [rekapMekanik] = await db.execute(`
            SELECT 
                m.id,
                m.name as nama_mekanik,
                COUNT(jobs.id) as total_servis,
                COALESCE(SUM(jobs.price), 0) as total_jasa,
                COALESCE(SUM(jobs.calculated_commission), 0) as total_komisi,
                COALESCE(SUM(IF(jobs.comm_status = 'paid', jobs.calculated_commission, 0)), 0) as total_komisi_cair,
                COALESCE(SUM(IF(jobs.comm_status = 'unpaid', jobs.calculated_commission, 0)), 0) as total_komisi_unpaid
            FROM mechanics m
            JOIN (
                SELECT 
                    ts.id, 
                    ts.mechanic_id, 
                    ts.price, 
                    CAST((IF(LOWER(sv.name) = 'remap', ts.price * 0.5, ts.price * m.commission_rate / 100) - ts.helper_commission) AS DECIMAL(10,2)) as calculated_commission,
                    ts.commission_status as comm_status,
                    ts.transaction_id
                FROM transaction_services ts
                JOIN mechanics m ON ts.mechanic_id = m.id
                JOIN services sv ON ts.service_id = sv.id

                UNION ALL

                SELECT 
                    ts.id, 
                    ts.helper_mechanic_id as mechanic_id, 
                    ts.price, 
                    ts.helper_commission as calculated_commission,
                    ts.helper_commission_status as comm_status,
                    ts.transaction_id
                FROM transaction_services ts
                WHERE ts.helper_mechanic_id IS NOT NULL
            ) jobs ON m.id = jobs.mechanic_id
            JOIN transactions t ON jobs.transaction_id = t.id
            WHERE DATE(t.created_at) BETWEEN ? AND ?
            GROUP BY m.id, m.name
            ORDER BY total_komisi DESC
        `, [dateFrom, dateTo]);

        // 6. Total Realisasi Pencairan Komisi (Kas Keluar Komisi Terbayar)
        // 7. Riwayat Detail Pencairan Komisi Mekanik pada Periode Ini
        // — jalankan paralel agar tidak bloking
        const [
            [[resKomisiCairMain]],
            [[resKomisiCairHelper]],
            [riwayatPencairan],
        ] = await Promise.all([
            db.execute(`
                SELECT COALESCE(SUM(IF(LOWER(sv.name) = 'remap', ts.price * 0.5, ts.price * m.commission_rate / 100) - ts.helper_commission), 0) AS total
                FROM transaction_services ts
                JOIN mechanics m ON ts.mechanic_id = m.id
                JOIN services sv ON ts.service_id = sv.id
                WHERE ts.commission_status = 'paid' AND DATE(ts.claimed_at) BETWEEN ? AND ?
            `, [dateFrom, dateTo]),
            db.execute(`
                SELECT COALESCE(SUM(ts.helper_commission), 0) AS total
                FROM transaction_services ts
                WHERE ts.helper_commission_status = 'paid' AND DATE(ts.helper_claimed_at) BETWEEN ? AND ?
            `, [dateFrom, dateTo]),
            db.execute(`
                SELECT 
                    m.id as mechanic_id,
                    m.name as nama_mekanik,
                    DATE(claims.tanggal_cair) as tanggal_cair,
                    COUNT(claims.id) as total_servis,
                    COALESCE(SUM(claims.nominal_cair), 0) as total_cair
                FROM mechanics m
                JOIN (
                    SELECT 
                        ts.id, 
                        ts.mechanic_id, 
                        CAST((IF(LOWER(sv.name) = 'remap', ts.price * 0.5, ts.price * m.commission_rate / 100) - ts.helper_commission) AS DECIMAL(10,2)) as nominal_cair,
                        ts.claimed_at as tanggal_cair
                    FROM transaction_services ts
                    JOIN mechanics m ON ts.mechanic_id = m.id
                    JOIN services sv ON ts.service_id = sv.id
                    WHERE ts.commission_status = 'paid' AND ts.claimed_at IS NOT NULL

                    UNION ALL

                    SELECT 
                        ts.id, 
                        ts.helper_mechanic_id as mechanic_id, 
                        ts.helper_commission as nominal_cair,
                        ts.helper_claimed_at as tanggal_cair
                    FROM transaction_services ts
                    WHERE ts.helper_mechanic_id IS NOT NULL AND ts.helper_commission_status = 'paid' AND ts.helper_claimed_at IS NOT NULL
                ) claims ON m.id = claims.mechanic_id
                WHERE DATE(claims.tanggal_cair) BETWEEN ? AND ?
                GROUP BY m.id, m.name, DATE(claims.tanggal_cair)
                ORDER BY tanggal_cair DESC, total_cair DESC
            `, [dateFrom, dateTo]),
        ]);

        const totalKomisiCair = parseFloat(resKomisiCairMain.total || 0) + parseFloat(resKomisiCairHelper.total || 0);

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

        // 8. Ringkasan Stok Gudang untuk Dashboard (Sangat Cepat)
        const [[spStats]] = await db.execute(`
            SELECT 
                COUNT(*) as total_item,
                COALESCE(SUM(IF(stock > 0 AND stock <= 5, 1, 0)), 0) as stok_menipis,
                COALESCE(SUM(IF(stock = 0, 1, 0)), 0) as stok_habis
            FROM spareparts
            WHERE (is_deleted IS NULL OR is_deleted = 0)
        `);

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
                total_komisi_cair: totalKomisiCair,
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

                // Rekap Komisi & Riwayat Pencairan
                rekap_mekanik: rekapMekanik,
                riwayat_pencairan: riwayatPencairan,
                sparepart_stats: spStats,

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

// Endpoint RINGAN khusus Dashboard — hanya 4 query cepat
exports.getDashboardStats = async (req, res) => {
    try {
        const { from, to } = req.query;
        const dateFrom = from || new Date().toISOString().split('T')[0];
        const dateTo = to || dateFrom;

        const [[today]] = await db.execute(`
            SELECT 
                COUNT(*) as total_transaksi,
                COALESCE(SUM(total_amount), 0) as total_pendapatan
            FROM transactions
            WHERE DATE(created_at) BETWEEN ? AND ?
        `, [dateFrom, dateTo]);

        const [[pengeluaran]] = await db.execute(`
            SELECT 
                COALESCE((SELECT SUM(total) FROM purchases WHERE DATE(created_at) BETWEEN ? AND ?), 0) +
                COALESCE((SELECT SUM(amount) FROM expenses WHERE DATE(created_at) BETWEEN ? AND ?), 0)
                AS total_pengeluaran
        `, [dateFrom, dateTo, dateFrom, dateTo]);

        const [[laba]] = await db.execute(`
            SELECT 
                COALESCE(SUM(tsp.subtotal), 0) - 
                COALESCE(SUM(tsp.quantity * sp.buy_price), 0) AS laba_sparepart
            FROM transaction_spareparts tsp
            JOIN transactions t ON tsp.transaction_id = t.id
            JOIN spareparts sp ON tsp.sparepart_id = sp.id
            WHERE DATE(t.created_at) BETWEEN ? AND ?
        `, [dateFrom, dateTo]);

        const [[spStats]] = await db.execute(`
            SELECT 
                COUNT(*) as total_item,
                COALESCE(SUM(IF(stock > 0 AND stock <= 5, 1, 0)), 0) as stok_menipis,
                COALESCE(SUM(IF(stock = 0, 1, 0)), 0) as stok_habis
            FROM spareparts
            WHERE (is_deleted IS NULL OR is_deleted = 0)
        `);

        const totalPendapatan = parseFloat(today.total_pendapatan || 0);
        const totalPengeluaran = parseFloat(pengeluaran.total_pengeluaran || 0);
        const labaKotor = totalPendapatan - totalPengeluaran;

        res.json({
            success: true,
            data: {
                total_transaksi: today.total_transaksi || 0,
                total_pendapatan: totalPendapatan,
                total_pengeluaran: totalPengeluaran,
                laba_kotor: labaKotor,
                sparepart_stats: spStats,
            }
        });
    } catch (error) {
        console.error('Dashboard stats error:', error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

