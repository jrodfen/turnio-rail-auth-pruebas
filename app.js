(function () {
  var cfg = window.TURNIO_SUPABASE || {};
  var client = window.supabase && window.supabase.createClient(cfg.url, cfg.publishableKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false }
  });
  var emailInput = document.getElementById('email');
  var otpInput = document.getElementById('otp');
  var formEmail = document.getElementById('form-email');
  var formOtp = document.getElementById('form-otp');
  var sessionBox = document.getElementById('sesion');
  var message = document.getElementById('mensaje');

  function setMessage(text, kind) {
    message.textContent = text;
    message.className = 'mensaje' + (kind ? ' ' + kind : '');
  }
  function setBusy(button, busy, text) {
    button.disabled = busy;
    if (text) button.textContent = text;
  }
  function normalizarError(error) {
    var text = String((error && error.message) || error || 'No se ha podido completar la operación.');
    if (/rate limit|60 seconds|too many/i.test(text)) return 'Espera un minuto antes de solicitar otro código.';
    if (/expired|invalid|token/i.test(text)) return 'El código no es válido o ha caducado. Solicita uno nuevo.';
    return text;
  }
  function mostrarSesion(user, profile) {
    formEmail.hidden = true;
    formOtp.hidden = true;
    sessionBox.hidden = false;
    document.getElementById('sesion-texto').textContent =
      'Sesión de prueba iniciada para ' + (user.email || 'usuario autorizado') + '.';
    document.getElementById('perfil-texto').textContent =
      'Perfil TURNIO: ' + (profile.display_name || user.email) + ' · Rol: ' + profile.role_code + '.';
    setMessage('Código validado y perfil activo confirmado.', 'ok');
  }
  async function validarPerfil(user) {
    var response = await client.rpc('current_turnio_profile');
    if (response.error) throw response.error;
    var profile = Array.isArray(response.data) ? response.data[0] : response.data;
    if (!profile) {
      await client.auth.signOut();
      throw new Error('No existe un perfil TURNIO activo para este correo.');
    }
    mostrarSesion(user, profile);
  }

  if (!client) {
    setMessage('No se ha podido cargar la conexión segura de pruebas.', 'error');
    return;
  }

  client.auth.getUser().then(async function (result) {
    if (result.data && result.data.user) {
      try {
        await validarPerfil(result.data.user);
      } catch (error) {
        setMessage(normalizarError(error), 'error');
      }
    }
  });

  formEmail.addEventListener('submit', async function (event) {
    event.preventDefault();
    var email = String(emailInput.value || '').trim().toLowerCase();
    var button = document.getElementById('enviar');
    setBusy(button, true, 'Enviando…');
    setMessage('Enviando el código a ' + email + '…');
    try {
      var result = await client.auth.signInWithOtp({ email: email, options: { shouldCreateUser: false } });
      if (result.error) throw result.error;
      formEmail.hidden = true;
      formOtp.hidden = false;
      otpInput.focus();
      setMessage('Código enviado. Caduca en 15 minutos.', 'ok');
    } catch (error) {
      setMessage(normalizarError(error), 'error');
    } finally {
      setBusy(button, false, 'Recibir código');
    }
  });

  formOtp.addEventListener('submit', async function (event) {
    event.preventDefault();
    var button = document.getElementById('validar');
    var token = String(otpInput.value || '').replace(/\D/g, '');
    setBusy(button, true, 'Validando…');
    try {
      var result = await client.auth.verifyOtp({
        email: String(emailInput.value || '').trim().toLowerCase(),
        token: token,
        type: 'email'
      });
      if (result.error) throw result.error;
      await validarPerfil(result.data.user);
    } catch (error) {
      setMessage(normalizarError(error), 'error');
    } finally {
      setBusy(button, false, 'Entrar en pruebas');
    }
  });

  document.getElementById('cambiar-correo').addEventListener('click', function () {
    formOtp.hidden = true;
    formEmail.hidden = false;
    otpInput.value = '';
    setMessage('Introduce el correo autorizado para recibir un código.');
    emailInput.focus();
  });
  document.getElementById('cerrar').addEventListener('click', async function () {
    await client.auth.signOut();
    sessionBox.hidden = true;
    formEmail.hidden = false;
    setMessage('Sesión de prueba cerrada.');
  });
}());
