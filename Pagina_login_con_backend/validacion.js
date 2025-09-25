document.addEventListener("DOMContentLoaded", () => {
  console.log("✅ Documento cargado, listo para validaciones.");

  const form = document.getElementById("loginForm");
  const usuarioInput = document.getElementById("usuario");
  const passwordInput = document.getElementById("password");
  const mensaje = document.getElementById("mensaje");

  form.addEventListener("submit", async (event) => {
    event.preventDefault(); // Evita que se recargue la página
    console.log("Formulario enviado, iniciando validación...");

    const usuario = usuarioInput.value.trim();
    const password = passwordInput.value.trim();

    console.log("➡️ Usuario ingresado:", usuario);
    console.log("➡️ Password ingresada:", password);

    // Validación del correo electrónico
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(usuario)) {
      mensaje.textContent = "El formato del correo electrónico no es válido.";
      mensaje.style.color = "red";
      console.log("Error: correo electrónico inválido.");
      return;
    }

    // Validación de contraseña
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
    if (!passwordRegex.test(password)) {
      mensaje.textContent =
        "La contraseña debe tener al menos 8 caracteres, 1 mayúscula, 1 minúscula y 1 número.";
      mensaje.style.color = "red";
      console.log("Error: contraseña inválida.");
      return;
    }

    // Si pasa validaciones → enviar al backend
    try {
      console.log("Enviando datos al backend...");

      const response = await fetch("http://localhost:3000/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ usuario, contrasenia: password })
      });

      const data = await response.json();
      console.log("Respuesta del servidor:", data);

      mensaje.textContent = data.message;
      mensaje.style.color = data.success ? "green" : "red";

    } catch (error) {
      console.error("Error al conectar con el backend:", error);
      mensaje.textContent = "Error al conectar con el servidor.";
      mensaje.style.color = "red";
    }
  });
});
