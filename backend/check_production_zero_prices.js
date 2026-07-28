const db = require('./config/db');

async function main() {
  try {
    // Ambil data sparepart yang harga beli = 0 beserta info pembeliannya
    const [rows] = await db.execute(`
      SELECT 
        s.id AS sparepart_id,
        s.code AS sparepart_code,
        s.name AS sparepart_name,
        s.stock,
        s.price AS sell_price,
        p.note AS purchase_note,
        p.created_at AS purchase_date,
        p.supplier
      FROM spareparts s
      LEFT JOIN purchases p ON s.id = p.sparepart_id
      WHERE s.buy_price = 0
      ORDER BY p.created_at DESC
    `);

    if (rows.length === 0) {
      console.log("\n✅ Tidak ditemukan barang dengan Harga Beli Rp 0 di database.");
      process.exit(0);
    }

    // Kelompokkan data berdasarkan sumber asal
    const grouped = {
      excelImports: {},
      manualOrDeleted: []
    };

    const uniqueSpareparts = new Map();

    for (const row of rows) {
      if (uniqueSpareparts.has(row.sparepart_id)) continue;
      uniqueSpareparts.set(row.sparepart_id, true);

      const itemInfo = {
        code: row.sparepart_code || '-',
        name: row.sparepart_name,
        stock: row.stock,
        sell_price: row.sell_price,
        supplier: row.supplier || '-',
        date: row.purchase_date ? new Date(row.purchase_date).toLocaleString('id-ID') : '-'
      };

      if (row.purchase_note && row.purchase_note.startsWith('Import Excel')) {
        let fileName = row.purchase_note.replace('Import Excel: ', '').trim();
        if (fileName === 'Import Excel') fileName = 'Import Excel (Nama file tidak terekam)';
        
        if (!grouped.excelImports[fileName]) {
          grouped.excelImports[fileName] = [];
        }
        grouped.excelImports[fileName].push(itemInfo);
      } else {
        grouped.manualOrDeleted.push(itemInfo);
      }
    }

    console.log("\n========================================================");
    console.log(" DIAGNOSTIK BARANG DENGAN HARGA BELI RP 0");
    console.log(` Total Unik Barang: ${uniqueSpareparts.size} item`);
    console.log("========================================================");

    // 1. Tampilkan yang berasal dari Import Excel
    const excelFiles = Object.keys(grouped.excelImports);
    if (excelFiles.length > 0) {
      console.log("\n📦 [BERASAL DARI IMPORT EXCEL]");
      for (const fileName of excelFiles) {
        console.log(`\n📄 File: ${fileName} (${grouped.excelImports[fileName].length} item)`);
        console.log("   Daftar Barang:");
        grouped.excelImports[fileName].forEach(item => {
          console.log(`   - [${item.code}] ${item.name} | Stok: ${item.stock} | Jual: Rp ${Number(item.sell_price).toLocaleString('id-ID')} (Supplier: ${item.supplier}, Tanggal: ${item.date})`);
        });
      }
    }

    // 2. Tampilkan yang tidak memiliki riwayat (Manual/Luar/Terhapus)
    if (grouped.manualOrDeleted.length > 0) {
      console.log("\n⚠️ [TIDAK MEMILIKI RIWAYAT PEMBELIAN]");
      console.log(`   (Kemungkinan diinput manual sebagai Barang Luar di POS, dibuat via form, atau riwayatnya sudah terhapus)`);
      console.log(`   Total: ${grouped.manualOrDeleted.length} item`);
      grouped.manualOrDeleted.forEach(item => {
        console.log(`   - [${item.code}] ${item.name} | Stok: ${item.stock} | Jual: Rp ${Number(item.sell_price).toLocaleString('id-ID')}`);
      });
    }

    console.log("\n========================================================\n");
    process.exit(0);
  } catch (err) {
    console.error("❌ Terjadi kesalahan saat melakukan query:", err);
    process.exit(1);
  }
}

main();
