const db = require("better-sqlite3")("/home/james/code/pollen-nation/server/data/pollen.sqlite");
const row = db.prepare("select * from level_cache where level_num=8").get();
if (!row) {
  console.log("no cache for level 8");
  process.exit(0);
}
const m = JSON.parse(row.map_json);
console.log("source:", row.source);
console.log("terrain:", JSON.stringify(m.terrain));
console.log("theme:", JSON.stringify(m.theme));
console.log("hive:", JSON.stringify(m.hive));
console.log("difficulty:", JSON.stringify(m.difficulty));
console.log("flowers:", m.flowers.length);
const xs = m.flowers.map((f) => f.x);
const zs = m.flowers.map((f) => f.z);
console.log("x range", Math.min(...xs), Math.max(...xs), "z range", Math.min(...zs), Math.max(...zs));
