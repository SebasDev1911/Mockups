/* Lógica central: arreglos, cola FIFO, pila LIFO y Set de asientos. Sin base de datos. */
const PRECIO_BOLETA = 18000;

async function sha256(texto) {
  try {
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(texto));
    return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("");
  } catch (e) { return "plain:" + texto; } // contexto no seguro: sin crypto.subtle
}
const fail = msg => { throw new Error(msg); };
const requerido = (t, campo) => (t == null || String(t).trim() === "") ? fail(`El campo ${campo} es obligatorio.`) : String(t).trim();
const pad = n => String(n).padStart(2, "0");
const fechaISO = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const enDias = n => { const d = new Date(); d.setDate(d.getDate() + n); return fechaISO(d); };

class CineService {
  constructor() {
    this.usuarios = []; this.peliculas = []; this.salas = []; this.funciones = []; this.productos = []; this.compras = [];
    this.colaSolicitudes = []; // FIFO
    this.pilaOperaciones = []; // LIFO (el más reciente al inicio)
    this.prox = { pelicula: 1, funcion: 1, producto: 1, compra: 1 };
  }
  static async crear() {
    const s = new CineService();
    s.usuarios.push(new Usuario("Administrador", "admin@cine.com", await sha256("Admin123!"), Rol.ADMIN));
    s.usuarios.push(new Usuario("Cliente demo", "cliente@cine.com", await sha256("Cliente123!"), Rol.CLIENTE));
    s.salas.push(new Sala(1, 5, 8), new Sala(2, 6, 8), new Sala(3, 4, 10));
    s.agregarPelicula("Interestelar", "Ciencia ficción", 169, "12+");
    s.agregarPelicula("Coco", "Animación", 105, "Todos");
    s.agregarPelicula("El origen", "Acción", 148, "12+");
    s.agregarFuncion(1, 1, enDias(1), "16:00");
    s.agregarFuncion(2, 2, enDias(1), "18:30");
    s.agregarFuncion(3, 3, enDias(2), "20:00");
    [["Crispetas grandes", 18000, 40, 10], ["Crispetas medianas", 14000, 35, 10], ["Gaseosa", 9000, 50, 15], ["Agua", 5000, 30, 10],
     ["Nachos", 12000, 20, 8], ["Chocolatina", 4500, 12, 6], ["Combo crispetas + gaseosa", 25000, 15, 5]]
      .forEach(p => s.agregarProducto(...p));
    s.pilaOperaciones.length = 0;
    return s;
  }
  async login(correo, clave) {
    const h = await sha256(clave);
    return this.usuarios.find(u => u.correo.toLowerCase() === correo.trim().toLowerCase() && u.claveHash === h) || fail("Credenciales incorrectas.");
  }
  async registrar(nombre, correo, clave) {
    nombre = requerido(nombre, "nombre"); correo = requerido(correo, "correo").toLowerCase();
    if (!correo.includes("@") || correo.startsWith("@") || correo.endsWith("@")) fail("Ingresa un correo válido.");
    if (clave.length < 6) fail("La contraseña debe tener al menos 6 caracteres.");
    if (this.usuarios.some(u => u.correo.toLowerCase() === correo)) fail("Ese correo ya está registrado.");
    const u = new Usuario(nombre, correo, await sha256(clave), Rol.CLIENTE);
    this.usuarios.push(u); this.registrarOperacion("Registro de cliente: " + correo);
    return u;
  }
  registrarOperacion(msg) { this.pilaOperaciones.unshift(msg); if (this.pilaOperaciones.length > 100) this.pilaOperaciones.pop(); }
  pelicula(id) { return this.peliculas.find(p => p.id === id) || fail("Película inexistente."); }
  sala(id) { return this.salas.find(s => s.id === id) || fail("Sala inexistente."); }
  funcion(id) { return this.funciones.find(f => f.id === id) || fail("Función inexistente."); }
  producto(id) { return this.productos.find(p => p.id === id) || fail("Producto inexistente."); }

  agregarPelicula(titulo, genero, duracion, clasificacion) {
    if (!(duracion > 0)) fail("Duración inválida.");
    const p = new Pelicula(this.prox.pelicula++, requerido(titulo, "título"), requerido(genero, "género"), duracion, requerido(clasificacion, "clasificación"));
    this.peliculas.push(p); this.registrarOperacion("Película creada: " + p.titulo); return p;
  }
  editarPelicula(id, titulo, genero, duracion, clasificacion) {
    if (!(duracion > 0)) fail("Duración inválida.");
    const p = this.pelicula(id);
    Object.assign(p, { titulo: requerido(titulo, "título"), genero: requerido(genero, "género"), duracion, clasificacion: requerido(clasificacion, "clasificación") });
    this.registrarOperacion("Película editada: " + p.titulo);
  }
  eliminarPelicula(id) {
    if (this.funciones.some(f => f.peliculaId === id)) fail("No se puede eliminar una película con funciones programadas.");
    const p = this.pelicula(id); this.peliculas.splice(this.peliculas.indexOf(p), 1);
    this.registrarOperacion("Película eliminada: " + p.titulo);
  }
  agregarFuncion(peliculaId, salaId, fecha, hora) {
    this.pelicula(peliculaId); this.sala(salaId);
    if (!fecha || !hora || new Date(`${fecha}T${hora}:00`) < new Date()) fail("La función debe tener fecha y hora futuras.");
    if (this.funciones.some(f => f.salaId === salaId && f.fecha === fecha && f.hora === hora)) fail("La sala ya tiene una función en ese horario.");
    const f = new Funcion(this.prox.funcion++, peliculaId, salaId, fecha, hora);
    this.funciones.push(f); this.registrarOperacion("Función publicada #" + f.id); return f;
  }
  agregarProducto(nombre, precio, stock, minimo) {
    if (!(precio > 0) || stock < 0 || minimo < 0) fail("Precio, stock o mínimo inválidos.");
    const p = new Producto(this.prox.producto++, requerido(nombre, "producto"), precio, stock, minimo);
    this.productos.push(p); this.registrarOperacion("Producto creado: " + p.nombre); return p;
  }
  reponer(id, cantidad) {
    if (!(cantidad > 0)) fail("Cantidad inválida.");
    const p = this.producto(id); p.stock += cantidad; this.registrarOperacion(`Reposición: ${p.nombre} +${cantidad}`);
  }
  asientos(f) {
    const s = this.sala(f.salaId), r = [];
    for (let i = 0; i < s.filas; i++) for (let c = 1; c <= s.columnas; c++) r.push(String.fromCharCode(65 + i) + c);
    return r;
  }
  descripcion(f) { return `${this.pelicula(f.peliculaId).titulo} | ${this.sala(f.salaId).nombre()} | ${f.fecha} ${f.hora}`; }
  funcionesFuturas() { return this.funciones.filter(f => f.inicio() >= new Date()); }

  /** Valida todo antes de mutar asientos o inventario. */
  comprar(cliente, funcionId, asientos, alimentos) {
    if (!cliente || cliente.rol !== Rol.CLIENTE) fail("Solo los clientes pueden comprar.");
    const f = this.funcion(funcionId);
    if (f.inicio() < new Date()) fail("La función ya comenzó.");
    if (!asientos || !asientos.length) fail("Selecciona al menos un asiento.");
    if (new Set(asientos).size !== asientos.length) fail("Hay asientos repetidos.");
    const validos = this.asientos(f);
    for (const a of asientos) if (!validos.includes(a) || f.vendidos.has(a)) fail("Asiento no disponible: " + a);
    let dulceria = 0;
    for (const [id, cant] of alimentos) {
      const p = this.producto(id);
      if (cant <= 0 || cant > p.stock) fail("Stock insuficiente o cantidad inválida: " + p.nombre);
      dulceria += p.precio * cant;
    }
    const boletas = PRECIO_BOLETA * asientos.length;
    this.colaSolicitudes.push(`Solicitud de ${cliente.correo} para función #${f.id}`);
    try {
      asientos.forEach(a => f.vendidos.add(a));
      for (const [id, cant] of alimentos) this.producto(id).stock -= cant;
      const c = new Compra(this.prox.compra++, f.id, boletas + dulceria, boletas, dulceria, cliente.correo, asientos, alimentos);
      this.compras.push(c); this.registrarOperacion(`Compra #${c.id} | ${cliente.correo} | $${c.total}`);
      return c;
    } finally { this.colaSolicitudes.shift(); }
  }
  /** Compra independiente de dulcería posterior a la boletería. */
  comprarDulceria(cliente, funcionId, alimentos) {
    if (!cliente || cliente.rol !== Rol.CLIENTE) fail("Solo los clientes pueden comprar.");
    this.funcion(funcionId);
    if (!alimentos || !alimentos.size) fail("Agrega al menos un producto.");
    let total = 0;
    for (const [id, cant] of alimentos) {
      const p = this.producto(id);
      if (cant <= 0 || cant > p.stock) fail("Stock insuficiente o cantidad inválida: " + p.nombre);
      total += p.precio * cant;
    }
    this.colaSolicitudes.push("Dulcería de " + cliente.correo);
    try {
      for (const [id, cant] of alimentos) this.producto(id).stock -= cant;
      const c = new Compra(this.prox.compra++, funcionId, total, 0, total, cliente.correo, [], alimentos);
      this.compras.push(c); this.registrarOperacion(`Compra dulcería #${c.id} | ${cliente.correo} | $${total}`);
      return c;
    } finally { this.colaSolicitudes.shift(); }
  }
  ingresos() { return this.compras.reduce((s, c) => s + c.total, 0); }
  boletasVendidas() { return this.compras.reduce((s, c) => s + c.asientos.length, 0); }
  productosVendidos() { return this.compras.reduce((s, c) => s + [...c.alimentos.values()].reduce((a, b) => a + b, 0), 0); }
}
