// Server.js — Auth + contraseñas + CRUD + Marvel proxy (simple, no profesional)
const express = require("express");
const bodyParser = require("body-parser");
const mysql = require("mysql2");
const path = require("path");
const cors = require("cors");
const crypto = require("crypto");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(__dirname));

// === Conexión MySQL ===
const db = mysql.createConnection({
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASS || "admin",
  database: process.env.DB_NAME || "login_db",
});

db.connect((err) => {
  if (err) { console.error("MySQL error:", err); process.exit(1); }
  console.log("MySQL conectado");

  // Usuarios
  db.query(`CREATE TABLE IF NOT EXISTS usuarios (
    id INT AUTO_INCREMENT PRIMARY KEY,
    correo VARCHAR(120) NOT NULL UNIQUE,
    nombre VARCHAR(120) NOT NULL,
    rol VARCHAR(40) NOT NULL DEFAULT 'Cliente',
    estado TINYINT(1) NOT NULL DEFAULT 1
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`);

  // Tabla separada para contraseñas
  db.query(`CREATE TABLE IF NOT EXISTS contrasenas (
    id INT AUTO_INCREMENT PRIMARY KEY,
    usuario_id INT NOT NULL,
    hash VARCHAR(128) NOT NULL,
    salt VARCHAR(32) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`);

  // Productos (para organizador)
  db.query(`CREATE TABLE IF NOT EXISTS productos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    sku VARCHAR(40) NOT NULL UNIQUE,
    nombre VARCHAR(120) NOT NULL,
    descripcion TEXT NULL,
    precio DECIMAL(10,2) NOT NULL DEFAULT 0,
    existencias INT NOT NULL DEFAULT 0,
    imagen VARCHAR(255) NULL,
    activo TINYINT(1) NOT NULL DEFAULT 1
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`);
});

// Helpers de hash simple (SHA-256 + salt)
function makeSalt(){ return crypto.randomBytes(8).toString('hex'); } // 16 chars
function makeHash(pass, salt){ return crypto.createHash('sha256').update(String(pass)+String(salt)).digest('hex'); }

function normalizeEstado(v){
  if (v === undefined || v === null) return 1;
  if (typeof v === "string"){
    const s = v.toLowerCase();
    if (["1","true","sí","si","activo"].includes(s)) return 1;
    return 0;
  }
  return v ? 1 : 0;
}

// Páginas
app.get("/", (_req,res)=>res.sendFile(path.join(__dirname,"landing.html")));
app.get("/landing", (_req,res)=>res.sendFile(path.join(__dirname,"landing.html")));
app.get("/login", (_req,res)=>res.sendFile(path.join(__dirname,"login.html")));
app.get("/registro", (_req,res)=>res.sendFile(path.join(__dirname,"registro.html")));
app.get("/user", (_req,res)=>res.sendFile(path.join(__dirname,"user.html")));
app.get("/organizer", (_req,res)=>res.sendFile(path.join(__dirname,"organizer.html")));
app.get("/admin", (_req,res)=>res.sendFile(path.join(__dirname,"admin.html")));

// Proxy Marvel (Node 18+ con fetch)
const MARVEL_URL = "https://gateway.marvel.com:443/v1/public/characters?ts=1&limit=10&apikey=66871a4efa9fb001fd69fe57f6b84ffc&hash=3d44a2a8f21791dc555a103aa393bb57";
app.get("/api/marvel/characters", async (_req, res)=>{
  try{
    if (typeof fetch !== "function") throw new Error("fetch no disponible (Node < 18)");
    const r = await fetch(MARVEL_URL);
    const data = await r.json();
    res.json(data);
  }catch(e){
    console.error("Marvel proxy:", e.message);
    res.status(502).json({ok:false, error:"No se pudo consultar Marvel"});
  }
});

// === AUTH ===

// Registro: crea usuario y guarda contraseña en tabla 'contrasenas'
app.post("/registro", (req, res) => {
  const { usuario: correo, contrasenia: password, nombre } = req.body || {};
  if (!correo || !password || !nombre) return res.status(400).send("Faltan datos");

  db.query("INSERT INTO usuarios (correo, nombre, rol, estado) VALUES (?, ?, 'Cliente', 1)",
    [correo, nombre],
    (err, result) => {
      if (err) {
        if (err.code === "ER_DUP_ENTRY") return res.status(409).send("El correo ya existe");
        return res.status(500).send("Error al registrar");
      }
      const usuario_id = result.insertId;
      const salt = makeSalt();
      const hash = makeHash(password, salt);
      db.query("INSERT INTO contrasenas (usuario_id, hash, salt) VALUES (?, ?, ?)",
        [usuario_id, hash, salt],
        (err2) => {
          if (err2) return res.status(500).send("Error al guardar contraseña");
          res.status(201).send("OK");
        });
    });
});

// Login: valida contra la última contraseña
app.post("/login", (req, res) => {
  const { usuario: correo, contrasenia: password } = req.body || {};
  if (!correo || !password) return res.status(400).send("Faltan datos");

  db.query("SELECT id, correo, nombre, rol, estado FROM usuarios WHERE correo=? LIMIT 1", [correo], (err, rows) => {
    if (err) return res.status(500).send("Error al validar");
    if (!rows.length) return res.status(401).send("Credenciales inválidas");
    const u = rows[0];
    if (!u.estado) return res.status(403).send("Cuenta inactiva");

    db.query("SELECT hash, salt FROM contrasenas WHERE usuario_id=? ORDER BY created_at DESC, id DESC LIMIT 1", [u.id], (e2, pwRows) => {
      if (e2) return res.status(500).send("Error al validar");
      if (!pwRows.length) return res.status(401).send("Credenciales inválidas");
      const { hash, salt } = pwRows[0];
      const calc = makeHash(password, salt);
      if (calc !== hash) return res.status(401).send("Credenciales inválidas");

      // Redirección simple por rol
      if (u.rol === "Administrador") return res.redirect("/admin");
      if (u.rol === "Operador") return res.redirect("/organizer");
      return res.redirect("/user");
    });
  });
});

// === CRUD Usuarios ===
app.get("/api/users", (_req,res)=>{
  db.query("SELECT id, correo, nombre, rol, estado FROM usuarios ORDER BY id DESC", (err, rows)=>{
    if (err) return res.status(500).json({ok:false, error:"Error al listar"});
    const users = rows.map(u=>({...u, activa:!!u.estado, estado_texto: u.estado ? "Activo":"Inactivo"}));
    res.json({ok:true, users});
  });
});

app.post("/api/users", (req,res)=>{
  const { correo, nombre, rol="Cliente", estado=1 } = req.body || {};
  if (!correo || !nombre) return res.status(400).json({ok:false, error:"correo y nombre requeridos"});
  db.query("INSERT INTO usuarios (correo, nombre, rol, estado) VALUES (?,?,?,?)",
  [correo, nombre, rol, normalizeEstado(estado)], (err, r)=>{
    if (err){
      if (err.code === "ER_DUP_ENTRY") return res.status(409).json({ok:false, error:"Correo duplicado"});
      return res.status(500).json({ok:false, error:"Error al crear"});
    }
    res.status(201).json({ok:true, id:r.insertId});
  });
});

app.put("/api/users/:id", (req,res)=>{
  const { id } = req.params;
  const { correo, nombre, rol, estado } = req.body || {};
  const fields = []; const params = [];
  if (correo){ fields.push("correo=?"); params.push(correo); }
  if (nombre){ fields.push("nombre=?"); params.push(nombre); }
  if (rol){ fields.push("rol=?"); params.push(rol); }
  if (estado !== undefined){ fields.push("estado=?"); params.push(normalizeEstado(estado)); }
  if (!fields.length) return res.status(400).json({ok:false, error:"Nada para actualizar"});
  params.push(id);
  db.query(`UPDATE usuarios SET ${fields.join(", ")} WHERE id=?`, params, (err, r)=>{
    if (err) return res.status(500).json({ok:false, error:"Error al actualizar"});
    res.json({ok:true, affected:r.affectedRows});
  });
});

app.delete("/api/users/:id", (req,res)=>{
  const { id } = req.params;
  db.query("DELETE FROM usuarios WHERE id=?", [id], (err, r)=>{
    if (err) return res.status(500).json({ok:false, error:"Error al eliminar"});
    res.json({ok:true, affected:r.affectedRows});
  });
});

// === CRUD Productos (organizador) ===
app.get("/api/products", (_req,res)=>{
  db.query("SELECT id, sku, nombre, descripcion, precio, existencias, imagen, activo FROM productos ORDER BY id DESC", (err, rows)=>{
    if (err) return res.status(500).json({ok:false, error:"Error al listar productos"});
    res.json({ok:true, products: rows});
  });
});

app.post("/api/products", (req,res)=>{
  const { sku, nombre, descripcion=null, precio=0, existencias=0, imagen=null, activo=1 } = req.body || {};
  if (!sku || !nombre) return res.status(400).json({ok:false, error:"sku y nombre requeridos"});
  db.query("INSERT INTO productos (sku, nombre, descripcion, precio, existencias, imagen, activo) VALUES (?,?,?,?,?,?,?)",
  [sku, nombre, descripcion, precio, existencias, imagen, activo], (err, r)=>{
    if (err){
      if (err.code === "ER_DUP_ENTRY") return res.status(409).json({ok:false, error:"SKU duplicado"});
      return res.status(500).json({ok:false, error:"Error al crear producto"});
    }
    res.status(201).json({ok:true, id:r.insertId});
  });
});

app.put("/api/products/:id", (req,res)=>{
  const { id } = req.params;
  const { sku, nombre, descripcion, precio, existencias, imagen, activo } = req.body || {};
  const fields = []; const params = [];
  if (sku){ fields.push("sku=?"); params.push(sku); }
  if (nombre){ fields.push("nombre=?"); params.push(nombre); }
  if (descripcion !== undefined){ fields.push("descripcion=?"); params.push(descripcion); }
  if (precio !== undefined){ fields.push("precio=?"); params.push(precio); }
  if (existencias !== undefined){ fields.push("existencias=?"); params.push(existencias); }
  if (imagen !== undefined){ fields.push("imagen=?"); params.push(imagen); }
  if (activo !== undefined){ fields.push("activo=?"); params.push(activo ? 1 : 0); }
  if (!fields.length) return res.status(400).json({ok:false, error:"Nada para actualizar"});
  params.push(id);
  db.query(`UPDATE productos SET ${fields.join(", ")} WHERE id=?`, params, (err, r)=>{
    if (err) return res.status(500).json({ok:false, error:"Error al actualizar producto"});
    res.json({ok:true, affected:r.affectedRows});
  });
});

app.delete("/api/products/:id", (req,res)=>{
  const { id } = req.params;
  db.query("DELETE FROM productos WHERE id=?", [id], (err, r)=>{
    if (err) return res.status(500).json({ok:false, error:"Error al eliminar producto"});
    res.json({ok:true, affected:r.affectedRows});
  });
});

app.listen(PORT, ()=>console.log("Servidor en http://localhost:"+PORT));
