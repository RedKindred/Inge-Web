// db.js — conexión MySQL local (Workbench)
// Usuario: root, Password: admin, Puerto: 3306, Base: inge_web
const mysql = require('mysql2/promise');

const dbConfig = {
  host: '127.0.0.1',
  port: 3306,
  user: 'root',
  password: 'admin',
  database: 'inge_web',
  waitForConnections: true
};

async function getConnection() {
  return await mysql.createConnection(dbConfig);
}

module.exports = getConnection;
