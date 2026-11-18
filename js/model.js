/* Entidades de dominio (equivalente a CineData.java). Todo vive en memoria. */
const Rol = Object.freeze({ ADMIN: "ADMIN", CLIENTE: "CLIENTE" });

class Usuario {
  constructor(nombre, correo, claveHash, rol) { Object.assign(this, { nombre, correo, claveHash, rol }); }
}
class Pelicula {
  constructor(id, titulo, genero, duracion, clasificacion) { Object.assign(this, { id, titulo, genero, duracion, clasificacion }); }
}
class Sala {
  constructor(id, filas, columnas) { Object.assign(this, { id, filas, columnas }); }
  nombre() { return "Sala " + this.id; }
  toString() { return `${this.nombre()} (${this.filas * this.columnas} asientos)`; }
}
class Funcion {
  /** fecha: "AAAA-MM-DD", hora: "HH:MM" */
  constructor(id, peliculaId, salaId, fecha, hora) {
    Object.assign(this, { id, peliculaId, salaId, fecha, hora });
    this.vendidos = new Set(); // asientos vendidos: evita ventas duplicadas
  }
  inicio() { return new Date(`${this.fecha}T${this.hora}:00`); }
}
class Producto {
  constructor(id, nombre, precio, stock, minimo) { Object.assign(this, { id, nombre, precio, stock, minimo }); }
}
class Compra {
  constructor(id, funcionId, total, totalBoletas, totalDulceria, cliente, asientos, alimentos) {
    Object.assign(this, { id, funcionId, total, totalBoletas, totalDulceria, cliente });
    this.asientos = [...asientos];
    this.alimentos = new Map(alimentos); // productoId -> cantidad
  }
}
