document.getElementById("loginForm").addEventListener("submit", function(event) {
    event.preventDefault(); // Evita recargar la página

    console.log("Iniciando validación...");

    let usuario = document.getElementById("usuario").value;
    let password = document.getElementById("password").value;

    let mensaje = document.getElementById("mensaje");
    let errorUsuario = document.getElementById("errorUsuario");
    let errorPassword = document.getElementById("errorPassword");

    // Limpiar mensajes previos
    mensaje.textContent = "";
    mensaje.className = "";
    errorUsuario.textContent = "";
    errorPassword.textContent = "";

    console.log("Usuario ingresado:", usuario);
    console.log("Password ingresado:", password);

    // Validar correo electrónico
    let regexEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!regexEmail.test(usuario)) {
        errorUsuario.textContent = "Debe ser un correo electrónico válido.";
        mensaje.textContent = "Error en el formulario";
        mensaje.className = "error";
        console.error("Validación fallida: Usuario no es un correo válido.");
        return;
    }
    console.log("Usuario válido como correo electrónico.");

    // Validar password
    let regexPassword = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
    if (!regexPassword.test(password)) {
        errorPassword.textContent = "Debe tener 8 caracteres, mayúscula, minúscula y número.";
        mensaje.textContent = "Error en el formulario";
        mensaje.className = "error";
        console.error("Validación fallida: Password no cumple requisitos.");
        return;
    }
    console.log("Password válido.");

    // Si todo está correcto
    mensaje.textContent = "Login exitoso";
    mensaje.className = "success";
    console.log("Validación completada con éxito.");
});
