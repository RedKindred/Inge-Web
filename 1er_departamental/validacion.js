
//Maneja validaciones básicas y envío de formularios de login/registro
(function () {
  const q = (s, el=document) => el.querySelector(s);

  // Mensajes
  function msg(el, text, type='info'){
    if(!el) return;
    el.textContent = text || '';
    el.className = 'msg ' + type;
  }

  //Registro
  const regForm = q('#form-reg');
  if (regForm) {
    regForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const nombre = q('#reg-nombre').value.trim();
      const correo = q('#reg-correo').value.trim();
      const pass = q('#reg-pass').value;
      const pass2 = q('#reg-pass2').value;
      const out = q('#reg-msg');

      if (!nombre || !correo || !pass || !pass2) {
        return msg(out, 'Completa todos los campos.', 'error');
      }
      if (pass.length < 6) {
        return msg(out, 'La contraseña debe tener al menos 6 caracteres.', 'error');
      }
      if (pass !== pass2) {
        return msg(out, 'Las contraseñas no coinciden.', 'error');
      }

      msg(out, 'Enviando…', 'info');
      try {
        const res = await fetch('/registro', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ usuario: correo, contrasenia: pass, nombre })
        });
        const text = await res.text();
        if (res.ok) {
          msg(out, 'Registro exitoso. Redirigiendo al login…', 'ok');
          setTimeout(() => { window.location.href = '/login'; }, 800);
        } else {
          msg(out, text || 'No se pudo registrar.', 'error');
        }
      } catch (err) {
        msg(out, 'Error de red.', 'error');
      }
    });
  }

  //Login
  const loginForm = q('#form-login');
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const correo = q('#login-correo').value.trim();
      const pass = q('#login-pass').value;
      const out = q('#login-msg');

      if (!correo || !pass) return msg(out, 'Completa usuario y contraseña.', 'error');

      msg(out, 'Validando…', 'info');
      try {
        const res = await fetch('/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ usuario: correo, contrasenia: pass })
        });
        if (res.redirected) {
          window.location.href = res.url;
          return;
        }
        const text = await res.text();
        if (res.ok) {
          // Respuesta ok sin redirección (fallback)
          msg(out, 'Login correcto.', 'ok');
          setTimeout(() => { window.location.href = '/user'; }, 700);
        } else {
          msg(out, text || 'Credenciales inválidas.', 'error');
        }
      } catch (err) {
        msg(out, 'Error de red.', 'error');
      }
    });
  }
})();
