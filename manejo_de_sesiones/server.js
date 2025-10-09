
// validar.js — Opción B: token corto (64 hex) sin JWT
const express = require('express');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const bcrypt = require('bcryptjs');
const path = require('path');
const crypto = require('crypto');

const getConnection = require('./db'); // mysql2/promise

const app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// ===== Config sesión
const COOKIE_NAME = 'st';
const SESSION_HOURS = 4;

function sqlExpiresIn(hours) {
  const d = new Date();
  d.setHours(d.getHours() + hours);
  return d.toISOString().slice(0, 19).replace('T', ' '); // YYYY-MM-DD HH:MM:SS
}

// ===== Middleware de auth (lee cookie, Authorization Bearer o ?st=)
async function auth(req, res, next) {
  let token = req.cookies[COOKIE_NAME] || null;

  if (!token && req.headers.authorization) {
    token = req.headers.authorization.replace(/^Bearer\s+/i, '').trim();
  }
  if (!token && req.query && req.query.st) {
    token = String(req.query.st);
  }
  if (!token) return res.status(401).json({ error: 'No token' });

  let cn;
  try {
    cn = await getConnection();
    const [rows] = await cn.execute(
      `SELECT usuario, id_cargo FROM session_token
       WHERE token=? AND is_revoked=0 AND expires_at > NOW()`,
      [token]
    );
    if (!rows.length) return res.status(401).json({ error: 'Sesión inválida o expirada' });

    res.locals.usuario = rows[0].usuario;
    res.locals.id_cargo = rows[0].id_cargo;
    req.sessionToken = token;
    next();
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Error de autenticación' });
  } finally {
    if (cn) await cn.end();
  }
}

// ===== Login HTML (única página)
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// ===== API Login (valida pass, guarda token corto, setea cookie)
app.post('/api/login', async (req, res) => {
  const { usuario, password } = req.body || {};
  if (!usuario || !password) {
    return res.status(400).json({ ok: false, error: 'Campos requeridos' });
  }

  let cn;
  try {
    cn = await getConnection();

    const [rows] = await cn.execute(
      'SELECT usuario, contrasenia, id_cargo FROM usuarios WHERE usuario = ? LIMIT 1',
      [usuario]
    );
    if (!rows.length) {
      return res.status(401).json({ ok: false, error: 'Credenciales inválidas' });
    }
    const u = rows[0];

    // Acepta bcrypt o texto plano (para no romper datos existentes)
    const stored = String(u.contrasenia || '');
    let ok;
    if (/^\$2[aby]\$/.test(stored)) ok = await bcrypt.compare(password, stored);
    else ok = (password === stored);

    if (!ok) {
      return res.status(401).json({ ok: false, error: 'Credenciales inválidas' });
    }

    // Genera token corto (64 hex) y guarda sesión en BD
    const sessionId = crypto.randomBytes(32).toString('hex'); // 64 chars
    const expiresAt = sqlExpiresIn(SESSION_HOURS);

    await cn.execute(
      `INSERT INTO session_token (token, usuario, id_cargo, expires_at, user_agent, ip)
       VALUES (?,?,?,?,?,?)`,
      [sessionId, u.usuario, u.id_cargo, expiresAt, req.headers['user-agent'] || '', req.ip || '']
    );

    // Cookie HttpOnly
    res.cookie(COOKIE_NAME, sessionId, {
      httpOnly: true,
      sameSite: 'lax',
      secure: false, // ponlo en true si sirves por HTTPS
      maxAge: SESSION_HOURS * 3600 * 1000
    });

    return res.json({ ok: true });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ ok: false, error: 'Error interno' });
  } finally {
    if (cn) await cn.end();
  }
});

// ===== API Me (protegida por cookie/token corto)
app.get('/api/me', auth, (req, res) => {
  res.json({
    ok: true,
    user: { usuario: res.locals.usuario, id_cargo: res.locals.id_cargo }
  });
});

// ===== Logout (revoca token en BD y limpia cookie)
app.post('/logout', auth, async (req, res) => {
  let cn;
  try {
    cn = await getConnection();
    await cn.execute('UPDATE session_token SET is_revoked=1 WHERE token=?', [req.sessionToken]);
  } catch (e) {
    console.error(e);
  } finally {
    if (cn) await cn.end();
  }
  res.clearCookie(COOKIE_NAME);
  res.json({ ok: true });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor listo: http://localhost:${PORT}`));
