document.addEventListener("DOMContentLoaded", async () => {
  if (!Auth.getToken()) return location.replace("index.html");
  const $ = (id) => document.getElementById(id);
  let avatarUrl = null;
  const renderAvatar = (usuario) => {
    const preview = $("profile-preview");
    if (avatarUrl) preview.innerHTML = `<img src="${avatarUrl}" alt="Foto de ${usuario.nombre}">`;
    else preview.textContent = usuario.avatar || usuario.nombre.split(/\s+/).map(x => x[0]).join("").slice(0,2).toUpperCase();
  };
  try {
    const { usuario } = await Api.perfil();
    avatarUrl = usuario.avatar_url || null;
    $("profile-name").value = usuario.nombre || ""; $("profile-username").value = usuario.username || ""; $("profile-email").value = usuario.email || ""; $("profile-bio").value = usuario.bio || "";
    $("profile-heading").textContent = usuario.nombre; $("profile-role").textContent = usuario.role === "admin" ? "Administrador" : "Usuario"; renderAvatar(usuario);
    $("profile-photo").addEventListener("change", (event) => {
      const file = event.target.files[0]; if (!file) return;
      if (file.size > 700 * 1024) { alert("La foto debe pesar menos de 700 KB."); event.target.value = ""; return; }
      const reader = new FileReader(); reader.onload = () => { avatarUrl = reader.result; renderAvatar(usuario); }; reader.readAsDataURL(file);
    });
    $("profile-photo-remove").onclick = () => { avatarUrl = null; renderAvatar(usuario); };
    $("profile-form").addEventListener("submit", async (event) => {
      event.preventDefault(); const button = event.submitter; button.disabled = true; $("profile-status").textContent = "Guardando…";
      try {
        const data = await Api.actualizarPerfil({ nombre: $("profile-name").value, username: $("profile-username").value, bio: $("profile-bio").value, avatarUrl });
        Auth.setSession(data.usuario, Auth.getToken()); $("profile-status").textContent = "Cambios guardados correctamente."; $("profile-heading").textContent = data.usuario.nombre;
      } catch (error) { $("profile-status").textContent = error.message; }
      finally { button.disabled = false; }
    });
  } catch (error) { $("profile-status").textContent = error.message; }
});
