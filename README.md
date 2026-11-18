# Cine Manager — versión web

Port a HTML/CSS/JS del proyecto Java Swing. Sin servidor ni dependencias: abre `index.html` en el navegador.

```
cine-web/
├── index.html
├── css/styles.css     Diseño (equivale a CineWindow: colores, tarjetas y pestañas recortadas, tablas)
└── js/
    ├── model.js       Entidades (CineData.java)
    ├── service.js     Lógica de negocio (CineService.java)
    └── app.js         Vistas y navegación por roles (CineWindow.java)
```

Cuentas: `admin@cine.com / Admin123!` · `cliente@cine.com / Cliente123!`

Los datos viven en memoria: al recargar la página se restauran los datos de demostración (igual que el original).
