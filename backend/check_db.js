require('dotenv').config();
const db = require('./config/db');

async function main() {
  try {
    const [rows] = await db.execute("SELECT id, code, name, buy_price, price, brand FROM spareparts");
    console.log(JSON.stringify(rows, null, 2));
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

main();
