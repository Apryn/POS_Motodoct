const db = require('./config/db');

async function main() {
  try {
    const [rows] = await db.execute("SELECT id, name, buy_price, price, stock, category_id, brand FROM spareparts WHERE price = 0 OR name LIKE '%oli%' LIMIT 50");
    console.log("=== K OLI Records ===");
    console.log(JSON.stringify(rows, null, 2));
    
    const [history] = await db.execute(`
        SELECT tsp.transaction_id, tsp.sparepart_id, tsp.quantity, tsp.price, t.created_at 
        FROM transaction_spareparts tsp
        JOIN transactions t ON tsp.transaction_id = t.id
        WHERE tsp.sparepart_id IN (SELECT id FROM spareparts WHERE name LIKE '%K OLI%')
    `);
    console.log("=== K OLI Transaction History ===");
    console.log(JSON.stringify(history, null, 2));
    
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

main();
