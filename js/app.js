/* Vista y navegación por roles. Ninguna lógica de negocio vive aquí. */
let svc, actual = null;
const ui = { auth: "login", admin: "peliculas", cliente: "cartelera", view: "main", selPeli: null, selProd: null,
  funcion: null, elegidos: new Set(), dulFuncion: null, food: new Map(), dulSel: null, cartSel: null, qty: 1 };

const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const money = n => "$ " + Number(n).toLocaleString("es-CO");
const entero = (s, campo) => { const n = Number(String(s).trim()); if (!String(s).trim() || !Number.isInteger(n)) throw new Error("Valor numérico inválido: " + campo); return n; };

/* ---------- Diálogos (reemplazo de JOptionPane) ---------- */
function dialogo(titulo, html, botones) {
  return new Promise(resolve => {
    const m = $("#modal"), prev = document.activeElement;
    const cerrar = v => { m.hidden = true; m.innerHTML = ""; document.removeEventListener("keydown", esc_); prev && prev.focus && prev.focus(); resolve(v); };
    const esc_ = e => { if (e.key === "Escape") cerrar(false); };
    m.innerHTML = `<div class="dlg" role="dialog" aria-modal="true"><h3>${esc(titulo)}</h3><div class="bd">${html}</div><div class="ft">${
      botones.map((b, i) => `<button class="btn ${b.cls || "navy"}" data-i="${i}">${esc(b.t)}</button>`).join("")}</div></div>`;
    m.hidden = false;
    m.querySelectorAll("button").forEach(b => b.onclick = () => cerrar(botones[b.dataset.i].v));
    document.addEventListener("keydown", esc_);
    m.querySelector("button:last-child").focus();
  });
}
const aviso = t => dialogo("Cine Manager", `<p>${esc(t)}</p>`, [{ t: "Aceptar", v: true }]);
const error = e => dialogo("Validación", `<p>${esc(e.message)}</p>`, [{ t: "Aceptar", cls: "red", v: true }]);
const confirmar = (t, msg) => dialogo(t, `<p>${esc(msg)}</p>`, [{ t: "Cancelar", cls: "navy", v: false }, { t: "Confirmar", cls: "green", v: true }]);
async function ejecutar(fn) { try { return await fn(); } catch (e) { await error(e); } }

/* ---------- Estructura base ---------- */
function base(modulo, contenido, extraClase = "") {
  $("#root").innerHTML = `
  <header class="hdr"><div class="brand"><span class="ico">▶</span><div><b>CINE MANAGER</b><small>SISTEMA INTEGRAL DE GESTIÓN CINEMATOGRÁFICA</small></div></div><div class="mod">${esc(modulo)}</div></header>
  ${contenido}
  <footer class="ftr"><span>CINE MANAGER &nbsp;•&nbsp; Módulos integrados &nbsp;•&nbsp; Versión web</span>${actual ? `<span class="acc">●&nbsp; ${esc(actual.nombre)} &nbsp;|&nbsp; ${actual.rol === Rol.ADMIN ? "Administrador" : "Cliente"}<button class="btn sm" data-act="salir">Cerrar sesión</button></span>` : ""}</footer>`;
}
const metric = (n, v, s) => `<div class="card metric"><div><div class="cap">${esc(n)}</div><div class="val">${esc(v)}</div></div><div class="sym">${s}</div></div>`;
const heading = (t, s) => `<div><div class="sub">${esc(t)}</div><div class="muted" style="margin-top:5px">${esc(s)}</div></div>`;
const input = (id, name, val = "", type = "text") => `<div class="field"><label for="${id}">${esc(name)}</label><input id="${id}" type="${type}" value="${esc(val)}"></div>`;
const select = (id, name, opts) => `<div class="field"><label for="${id}">${esc(name)}</label><select id="${id}">${opts.map(o => `<option value="${o[0]}">${esc(o[1])}</option>`).join("")}</select></div>`;
function tabla(cols, filas, { sel = null, act = "", alertCol = -1, hideId = false } = {}) {
  const body = filas.map(f => `<tr class="${act ? "clickable" : ""} ${sel != null && f[0] === sel ? "sel" : ""}" ${act ? `data-act="${act}" data-id="${f[0]}"` : ""}>${
    (hideId ? f.slice(1) : f).map((c, i) => `<td class="${i === alertCol && (c === "REPOSICIÓN" || c === "Stock bajo") ? "alert" : ""}">${esc(c)}</td>`).join("")}</tr>`).join("");
  return `<div class="tbl-wrap"><table><thead><tr>${cols.map(c => `<th>${esc(c)}</th>`).join("")}</tr></thead><tbody>${body}</tbody></table></div>`;
}
const tabsBar = (items, cur, act) => `<div class="tabs" role="tablist">${items.map(([k, t]) => `<button class="tab ${k === cur ? "on" : ""}" role="tab" aria-selected="${k === cur}" data-act="${act}" data-id="${k}">${esc(t)}</button>`).join("")}</div>`;

/* ---------- Acceso ---------- */
function mostrarAcceso() {
  const login = ui.auth === "login";
  const pw = (id, t) => `<div class="field"><label for="${id}">${t}</label><div class="pw"><input id="${id}" type="password" autocomplete="${login ? "current-password" : "new-password"}"><button type="button" data-act="verpw" data-id="${id}">Mostrar</button></div></div>`;
  const formulario = login ? `
    <h2>¡Bienvenido de nuevo!</h2><p class="muted" style="margin-top:-8px">Ingresa tus datos para continuar.</p>
    <form id="f-login" style="margin-top:10px"><div class="field"><label for="l-correo">Correo electrónico</label><input id="l-correo" type="email" autocomplete="username"></div>${pw("l-clave", "Contraseña")}
    <button class="btn auth" style="margin-top:8px">Ingresar a Cine Manager</button></form>
    <div class="demo"><b>CUENTAS DE DEMOSTRACIÓN</b><span class="muted">Admin: admin@cine.com / Admin123!<br>Cliente: cliente@cine.com / Cliente123!</span></div>` : `
    <h2>Crea tu cuenta</h2><p class="muted" style="margin-top:-8px">Regístrate como cliente y empieza a disfrutar.</p>
    <form id="f-reg"><div class="field"><label for="r-nombre">Nombre completo</label><input id="r-nombre" type="text" autocomplete="name"></div>
    <div class="field"><label for="r-correo">Correo electrónico</label><input id="r-correo" type="email" autocomplete="email"></div>${pw("r-clave", "Contraseña (mínimo 6 caracteres)")}
    <button class="btn auth" style="margin-top:6px">Crear mi cuenta de cliente</button></form>
    <p class="hint">Las cuentas nuevas tienen acceso de cliente.</p>`;
  base("ACCESO A CINE MANAGER", `<div class="backdrop"><div class="shell">
    <aside class="aside"><div><div class="mark">▶&nbsp; CINE MANAGER</div><div class="kick">TU EXPERIENCIA COMIENZA AQUÍ</div><h2>El cine,<br>en tus manos.</h2>
    <p>Explora la cartelera, elige tus asientos<br>y disfruta de la dulcería en una<br>sola compra.</p></div><div class="bt">●&nbsp; ACCESO SEGURO &nbsp;·&nbsp; VERSIÓN WEB</div></aside>
    <section class="authr"><div class="switch"><button class="${login ? "on" : ""}" data-act="auth" data-id="login">Iniciar sesión</button><button class="${login ? "" : "on"}" data-act="auth" data-id="reg">Crear cuenta</button></div>${formulario}</section></div></div>`);
  const f = $("#f-login") || $("#f-reg");
  f.onsubmit = ev => { ev.preventDefault(); ejecutar(async () => {
    actual = login ? await svc.login($("#l-correo").value, $("#l-clave").value)
                   : await svc.registrar($("#r-nombre").value, $("#r-correo").value, $("#r-clave").value);
    ui.view = "main"; ui.admin = "peliculas"; ui.cliente = "cartelera"; render();
  }); };
  (login ? $("#l-correo") : $("#r-nombre")).focus();
}

/* ---------- Administrador ---------- */
function mostrarAdmin() {
  const tabs = [["peliculas", "Películas"], ["funciones", "Programar funciones"], ["productos", "Dulcería e inventario"], ["reportes", "Reportes"]];
  const pagina = { peliculas: adminPeliculas, funciones: adminFunciones, productos: adminProductos, reportes: adminReportes }[ui.admin]();
  base("PANEL ADMINISTRATIVO  /  " + actual.nombre.toUpperCase(), `<main>
    <div class="grid g4">${metric("Películas", svc.peliculas.length, "▣")}${metric("Funciones", svc.funciones.length, "◷")}${metric("Ventas", svc.compras.length, "◉")}${metric("Ingresos", money(svc.ingresos()), "$")}</div>
    ${tabsBar(tabs, ui.admin, "atab")}<div class="page">${pagina}</div></main>`);
}
function adminPeliculas() {
  const sel = svc.peliculas.find(p => p.id === ui.selPeli) || {};
  return `<div>${heading("Gestión de películas", "Crea, consulta y administra las películas de la cartelera.")}</div>
  <div class="card box">${heading("DATOS DE LA PELÍCULA", "Completa los campos o selecciona una película para editarla.")}
    <div class="grid g2">${input("p-titulo", "Título de la película", sel.titulo)}${input("p-genero", "Género", sel.genero)}${input("p-duracion", "Duración (minutos)", sel.duracion)}${input("p-clas", "Clasificación", sel.clasificacion)}</div>
    <div class="row"><button class="btn green" data-act="peli-add">＋&nbsp; Agregar película</button><button class="btn blue" data-act="peli-edit">Guardar cambios</button><button class="btn red" data-act="peli-del">Eliminar seleccionada</button></div></div>
  <div class="card box"><span class="hint">Selecciona una fila para cargar sus datos y modificarlos.</span>
    ${tabla(["ID", "Título", "Género", "Duración (min)", "Clasificación"], svc.peliculas.map(p => [p.id, p.titulo, p.genero, p.duracion, p.clasificacion]), { sel: ui.selPeli, act: "peli-sel" })}</div>`;
}
function adminFunciones() {
  return `<div>${heading("Programación de funciones", "Asigna películas, salas, fechas y horarios para publicar nuevas funciones.")}</div>
  <div class="card box">${heading("NUEVA FUNCIÓN", "Selecciona la película, la sala y el horario de proyección.")}
    <div class="grid g3">${select("f-peli", "Película", svc.peliculas.map(p => [p.id, p.titulo]))}${select("f-sala", "Sala", svc.salas.map(s => [s.id, s.toString()]))}${input("f-fecha", "Fecha", enDias(1), "date")}</div>
    <div class="row" style="align-items:flex-end"><div style="flex:1;min-width:160px">${input("f-hora", "Horario", "16:00", "time")}</div><button class="btn green" data-act="func-add">＋&nbsp; Publicar función</button></div></div>
  <div class="card box"><span class="hint">Funciones publicadas. Una sala no puede tener dos funciones a la misma fecha y hora.</span>
    ${tabla(["ID", "Película", "Sala", "Fecha", "Horario", "Ocupados"], svc.funciones.map(f => [f.id, svc.pelicula(f.peliculaId).titulo, svc.sala(f.salaId).nombre(), f.fecha, f.hora, f.vendidos.size]))}</div>`;
}
function adminProductos() {
  return `<div>${heading("Inventario de dulcería", "Gestiona productos, precios, existencias y reposiciones.")}</div>
  <div class="card box">${heading("GESTIÓN DE PRODUCTOS", "Agrega nuevos productos y repón existencias de los ya registrados.")}
    <div class="grid g4">${input("d-nombre", "Nombre del producto")}${input("d-precio", "Precio ($ COP)")}${input("d-stock", "Stock inicial")}${input("d-min", "Stock mínimo")}</div>
    <div class="row" style="justify-content:space-between"><button class="btn green" data-act="prod-add">＋&nbsp; Nuevo producto</button>
    <div class="row"><b class="lbl" style="color:var(--navy)">Cantidad a reponer</b><input id="d-rep" type="text" style="width:95px"><button class="btn blue" data-act="prod-rep">Reponer seleccionado</button></div></div></div>
  <div class="card box"><span class="hint">Selecciona un producto de la tabla para reponer sus existencias.</span>
    ${tabla(["ID", "Producto", "Precio", "Stock", "Mínimo", "Estado"], svc.productos.map(p => [p.id, p.nombre, p.precio, p.stock, p.minimo, p.stock <= p.minimo ? "REPOSICIÓN" : "Disponible"]), { sel: ui.selProd, act: "prod-sel", alertCol: 5 })}</div>`;
}
function adminReportes() {
  const linea = "──────────────────────────────";
  let r = `PELÍCULAS REGISTRADAS: ${svc.peliculas.length}\nFUNCIONES PUBLICADAS: ${svc.funciones.length}\nCOMPRAS REALIZADAS: ${svc.compras.length}\nSOLICITUDES EN COLA (FIFO): ${svc.colaSolicitudes.length}\n\nDETALLE DE VENTAS\n${linea}\n`;
  if (!svc.compras.length) r += "Todavía no se han registrado ventas.\n";
  svc.compras.forEach(c => r += `Compra #${c.id} · ${c.cliente}\nFunción ${c.funcionId} · ${money(c.total)}\n\n`);
  let a = `ALERTAS DE INVENTARIO\n${linea}\n`, n = 0;
  svc.productos.filter(p => p.stock <= p.minimo).forEach(p => { a += `• ${p.nombre} · quedan ${p.stock}\n`; n++; });
  if (!n) a += "Sin alertas de inventario.\n";
  a += `\nOPERACIONES RECIENTES (PILA)\n${linea}\n`;
  svc.pilaOperaciones.slice(0, 12).forEach(o => a += `• ${o}\n`);
  if (!svc.pilaOperaciones.length) a += "Sin operaciones registradas.\n";
  const clientes = svc.usuarios.filter(u => u.rol === Rol.CLIENTE).length;
  return `<div>${heading("Reportes y administración", "Información general, ventas, inventario y actividad reciente.")}</div>
  <div class="grid g4">${metric("Clientes", clientes, "♙")}${metric("Boletas vendidas", svc.boletasVendidas(), "▤")}${metric("Productos vendidos", svc.productosVendidos(), "▣")}${metric("Total recaudado", money(svc.ingresos()), "$")}</div>
  <div class="grid g2"><div class="card box">${heading("RESUMEN Y VENTAS", "Información acumulada durante la sesión actual.")}<pre class="mono">${esc(r)}</pre></div>
  <div class="card box">${heading("INVENTARIO Y ACTIVIDAD", "Alertas de stock y operaciones recientes (LIFO).")}<pre class="mono">${esc(a)}</pre></div></div>
  <div class="row" style="justify-content:flex-end"><button class="btn" data-act="refrescar">↻&nbsp; Actualizar reportes</button></div>`;
}

/* ---------- Cliente ---------- */
function mostrarCliente() {
  const tabs = [["cartelera", "01  Cartelera y boletería"], ["compras", "02  Mis compras"]];
  const cont = ui.cliente === "cartelera"
    ? `<div>${heading("Cartelera y selección de asientos", "Selecciona una película y su función, elige asientos y genera tu boleto.")}</div>${comprarPanel()}`
    : `<div>${heading("Historial de compras", "Consulta los recibos de boletería y dulcería registrados.")}</div>${misCompras()}`;
  base("EXPERIENCIA CLIENTE  /  " + actual.nombre.toUpperCase(), `<main>
    <div class="row" style="justify-content:space-between"><h1 class="title">¡Hola, ${esc(actual.nombre)}!</h1><span class="muted">Funciones disponibles: ${svc.funciones.length} &nbsp;•&nbsp; Entrada: ${money(PRECIO_BOLETA)}</span></div>
    ${tabsBar(tabs, ui.cliente, "ctab")}<div class="page">${cont}</div></main>`);
}
function misCompras() {
  const filas = svc.compras.filter(c => c.cliente === actual.correo).map(c => [c.id, c.totalBoletas > 0 ? "Boletería" : "Dulcería", svc.descripcion(svc.funcion(c.funcionId)), c.asientos.join(", "), c.totalBoletas, c.totalDulceria, c.total]);
  return `<div class="card">${tabla(["Compra", "Tipo", "Función", "Asientos", "Boletería", "Dulcería", "Total"], filas)}</div>`;
}
function comprarPanel() {
  const futuras = svc.funcionesFuturas();
  if (!futuras.some(f => f.id === ui.funcion)) { ui.funcion = futuras.length ? futuras[0].id : null; ui.elegidos.clear(); }
  const f = ui.funcion != null ? svc.funcion(ui.funcion) : null;
  let mapa = "";
  if (f) {
    const s = svc.sala(f.salaId);
    mapa = `<div class="seats" style="grid-template-columns:repeat(${s.columnas},minmax(38px,1fr))">${svc.asientos(f).map(a => {
      const vendido = f.vendidos.has(a), pick = ui.elegidos.has(a);
      return `<button class="seat ${vendido ? "sold" : pick ? "pick" : ""}" ${vendido ? "disabled" : ""} aria-pressed="${pick}" data-act="seat" data-id="${a}">${a}</button>`;
    }).join("")}</div>`;
  }
  const n = ui.elegidos.size;
  return `<div class="cart-layout">
  <div class="card stack"><div class="field"><label for="c-func">PELÍCULA, SALA Y HORARIO</label><select id="c-func" data-act="func">${futuras.map(x => `<option value="${x.id}" ${x.id === ui.funcion ? "selected" : ""}>${esc(svc.descripcion(x))}</option>`).join("")}</select></div>
    <div class="screen">P A N T A L L A</div>${mapa}
    <span class="muted">● Verde: disponible &nbsp;&nbsp;&nbsp; ● Rojo: ocupado &nbsp;&nbsp;&nbsp; ● Dorado: seleccionado</span></div>
  <div class="card side"><div><div class="big">RESUMEN DE BOLETERÍA</div><div class="muted" style="margin-top:5px">Pago simulado · Recibo de entradas</div></div>
    <div><div class="lbl">Asientos seleccionados</div><div class="big" style="margin:8px 0 20px">${n} asiento(s)</div><div class="lbl">Detalle de asientos</div>
    <div class="muted" style="margin:7px 0 22px">${n ? esc([...ui.elegidos].join(" · ")) : "Ningún asiento seleccionado"}</div><div class="muted">PRECIO POR ENTRADA</div><div class="big">${money(PRECIO_BOLETA)}</div></div>
    <div class="stack"><span class="muted">TOTAL A PAGAR</span><div class="total">${money(n * PRECIO_BOLETA)}</div><button class="btn green" data-act="pagar">✓&nbsp; Confirmar compra de entradas</button></div></div></div>`;
}
function mostrarDulceria() {
  let suma = 0;
  const carrito = [...ui.food].map(([id, c]) => { const p = svc.producto(id); suma += p.precio * c; return [id, p.nombre, c, money(p.precio * c)]; });
  base("EXPERIENCIA CLIENTE  /  DULCERÍA", `<main>
    <div class="row" style="justify-content:space-between"><div><h1 class="title">Panel de dulcería</h1><p class="muted" style="margin-top:5px">Tus entradas están confirmadas. Agrega alimentos y genera un segundo recibo.</p></div>
      <button class="btn" data-act="omitir">Omitir dulcería / Volver a cartelera</button></div>
    <div class="grid g2">
      <div class="card stack"><div class="big">INVENTARIO DE PRODUCTOS</div>${tabla(["ID", "Producto", "Precio", "Disponible"], svc.productos.map(p => [p.id, p.nombre, money(p.precio), p.stock]), { sel: ui.dulSel, act: "dul-sel" })}
        <div class="row"><b class="lbl">Cantidad</b><input id="qty" type="number" min="1" max="30" value="${ui.qty}" style="width:80px"><button class="btn green" data-act="dul-add">＋ Agregar al carrito</button></div></div>
      <div class="card stack"><div class="big">VENTA ACTUAL</div>${tabla(["Producto", "Cantidad", "Subtotal"], carrito, { sel: ui.cartSel, act: "cart-sel", hideId: true })}
        <div class="row" style="justify-content:space-between"><b class="lbl">TOTAL DE DULCERÍA</b><span class="total">${money(suma)}</span></div>
        <div class="row" style="justify-content:flex-end"><button class="btn red" data-act="cart-del">Quitar seleccionado</button><button class="btn green" data-act="dul-pay">✓ Confirmar venta de dulcería</button></div></div>
    </div></main>`);
}
async function mostrarRecibo(c, tipo) {
  let t = `CINE MANAGER  |  RECIBO DE ${tipo}\n────────────────────────────────────\nComprobante: #${c.id}\nCliente: ${actual.nombre}\nPelícula y función: ${svc.descripcion(svc.funcion(c.funcionId))}\n`;
  if (c.asientos.length) t += `Asientos: ${c.asientos.join(", ")}\n`;
  if (c.alimentos.size) { t += "\nPRODUCTOS\n"; for (const [id, n] of c.alimentos) { const p = svc.producto(id); t += `${p.nombre}  x${n}  ${money(p.precio * n)}\n`; } }
  t += `────────────────────────────────────\nTOTAL: ${money(c.total)}\nPago: SIMULADO / APROBADO`;
  await dialogo("Recibo de " + tipo.toLowerCase(), `<pre>${esc(t)}</pre>`, [{ t: "Aceptar", cls: "green", v: true }]);
}

/* ---------- Eventos (delegación) ---------- */
const val = id => $("#" + id).value;
const seleccionado = id => id == null ? (() => { throw new Error("Selecciona un registro de la tabla."); })() : id;
const acciones = {
  salir() { actual = null; ui.auth = "login"; ui.selPeli = ui.selProd = null; ui.elegidos.clear(); ui.food.clear(); render(); },
  auth(id) { ui.auth = id; render(); },
  verpw(id, el) { const i = $("#" + id), ver = i.type === "password"; i.type = ver ? "text" : "password"; el.textContent = ver ? "Ocultar" : "Mostrar"; },
  atab(id) { ui.admin = id; render(); }, ctab(id) { ui.cliente = id; render(); },
  refrescar() { render(); },
  "peli-sel"(id) { ui.selPeli = +id; render(); },
  "peli-add"() { svc.agregarPelicula(val("p-titulo"), val("p-genero"), entero(val("p-duracion"), "duración"), val("p-clas")); ui.selPeli = null; render(); },
  "peli-edit"() { svc.editarPelicula(seleccionado(ui.selPeli), val("p-titulo"), val("p-genero"), entero(val("p-duracion"), "duración"), val("p-clas")); render(); },
  "peli-del"() { svc.eliminarPelicula(seleccionado(ui.selPeli)); ui.selPeli = null; render(); },
  "func-add"() { svc.agregarFuncion(+val("f-peli"), +val("f-sala"), val("f-fecha"), val("f-hora")); render(); },
  "prod-sel"(id) { ui.selProd = +id; render(); },
  "prod-add"() { svc.agregarProducto(val("d-nombre"), entero(val("d-precio"), "precio"), entero(val("d-stock"), "stock"), entero(val("d-min"), "mínimo")); render(); },
  "prod-rep"() { svc.reponer(seleccionado(ui.selProd), entero(val("d-rep"), "cantidad")); render(); },
  seat(a) { ui.elegidos.has(a) ? ui.elegidos.delete(a) : ui.elegidos.add(a); render(); },
  async pagar() {
    if (ui.funcion == null) throw new Error("No hay funciones disponibles.");
    if (!ui.elegidos.size) throw new Error("Selecciona al menos un asiento.");
    if (!await confirmar("Pago simulado", `¿Confirmar ${ui.elegidos.size} entrada(s) por ${money(ui.elegidos.size * PRECIO_BOLETA)}?`)) return;
    const c = svc.comprar(actual, ui.funcion, [...ui.elegidos], new Map());
    ui.dulFuncion = ui.funcion; ui.elegidos.clear(); ui.food.clear(); ui.dulSel = ui.cartSel = null; ui.view = "dulceria"; render();
    await mostrarRecibo(c, "BOLETERÍA");
  },
  omitir() { ui.view = "main"; ui.food.clear(); render(); },
  "dul-sel"(id) { ui.qty = +($("#qty") || {}).value || 1; ui.dulSel = +id; render(); },
  "cart-sel"(id) { ui.cartSel = +id; render(); },
  "dul-add"() {
    if (ui.dulSel == null) throw new Error("Selecciona un producto del inventario.");
    const n = entero(val("qty"), "cantidad"); ui.qty = n; const p = svc.producto(ui.dulSel), total = (ui.food.get(p.id) || 0) + n;
    if (n < 1 || total > p.stock) throw new Error("Stock insuficiente de " + p.nombre);
    ui.food.set(p.id, total); render();
  },
  "cart-del"() { if (ui.cartSel != null) { ui.food.delete(ui.cartSel); ui.cartSel = null; render(); } },
  async "dul-pay"() {
    if (!ui.food.size) throw new Error("Agrega al menos un producto.");
    const total = [...ui.food].reduce((s, [id, n]) => s + svc.producto(id).precio * n, 0);
    if (!await confirmar("Pago simulado", `¿Confirmar compra de dulcería por ${money(total)}?`)) return;
    const c = svc.comprarDulceria(actual, ui.dulFuncion, new Map(ui.food));
    ui.food.clear(); ui.view = "main"; ui.cliente = "cartelera"; render();
    await mostrarRecibo(c, "DULCERÍA");
  }
};
document.addEventListener("click", ev => {
  const el = ev.target.closest("[data-act]"); if (!el || el.tagName === "SELECT") return;
  const fn = acciones[el.dataset.act]; if (fn) ejecutar(() => fn(el.dataset.id, el));
});
document.addEventListener("change", ev => {
  if (ev.target.id === "c-func") { ui.funcion = +ev.target.value; ui.elegidos.clear(); render(); }
});

function render() {
  if (!actual) return mostrarAcceso();
  if (actual.rol === Rol.ADMIN) return mostrarAdmin();
  return ui.view === "dulceria" ? mostrarDulceria() : mostrarCliente();
}
CineService.crear().then(s => { svc = s; render(); });
