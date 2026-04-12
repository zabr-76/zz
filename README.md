# 🚀 z-jackett.js
[![GitHub stars](https://img.shields.io/github/stars/zabr-76/zz?style=social)](https://github.com/zabr-76/zz/stargazers)
[![GitHub issues](https://img.shields.io/github/issues/zabr-76/zz)](https://github.com/zabr-76/zz/issues)
[![GitHub license](https://img.shields.io/github/license/zabr-76/zz)](https://github.com/zabr-76/zz/blob/main/LICENSE)
[![CDN](https://img.shields.io/badge/CDN-https%3A%2F%2Fcdn.jsdelivr.net%2Fgh%2Fzabr--76%2Fzz%2Fdist%2Fz--jackett.min.js-blue)](https://cdn.jsdelivr.net/gh/zabr-76/zz/dist/z-jackett.min.js)

---

## 📌 ¿Qué es z-jackett.js?

**z-jackett.js** es un **framework JavaScript reactivo minimalista** diseñado para crear interfaces modernas con **HTML declarativo**. Inspirado en Vue.js pero con una sintaxis más simple y sin configuración compleja, ideal para proyectos pequeños y medianos.

🔹 **Reactividad automática**: Los cambios en los datos se reflejan instantáneamente en la UI.
🔹 **Ligero y rápido**: Sin dependencias pesadas, optimizado para rendimiento.
🔹 **Fácil de aprender**: Sintaxis intuitiva similar a Vue.js.
🔹 **Flexible**: Funciona en cualquier proyecto existente.

---

## ⚡ Características principales

| Característica | Descripción |
|---------------|-------------|
| **📦 z-data** | Inicializa el estado del componente. |
| **🔄 z-text** | Muestra texto reactivo en el DOM. |
| **🔗 z-model** | Enlace bidireccional con inputs. |
| **👁️ z-show** | Muestra/oculta elementos basado en condiciones. |
| **🔍 z-if** | Renderizado condicional (elimina elementos del DOM). |
| **🔁 z-for** | Renderiza listas de datos reactivamente. |
| **🎯 z-ref** | Accede directamente a elementos del DOM. |
| **🎨 z-transition** | Transiciones CSS suaves. |
| **📡 @eventos** | Manejo de eventos con modificadores. |

---

## 🏆 Benchmarks de Rendimiento

Hemos comparado **z-jackett.js** con **Alpine.js** en pruebas reales de rendimiento. Aquí están los resultados:

| **Test** | **z-jackett.js** | **Alpine.js** | **Ganador** | **Diferencia** |
|----------|------------------|---------------|-------------|----------------|
| **📦 Creación de 1000 elementos** | **56.20ms** | 111.90ms | 🥇 z-jackett.js | **+99% más rápido** |
| **🔄 Reactividad realista** | **33.30ms** | **36.10ms** | 🥈 Empate | ~8% más rápido |
| **🎮 Fluidez (FPS)** | **62 FPS** | **62 FPS** | 🥇 Empate | Ambos mantienen 60+ FPS |

### 📊 Análisis de resultados
- **z-jackett.js** destaca en **creación de elementos** (casi 2x más rápido que Alpine.js), ideal para listas dinámicas o renderizado masivo.
- **Alpine.js** es ligeramente mejor en **reactividad** (actualizaciones del DOM más eficientes).
- **Ambos frameworks mantienen una fluidez excelente** (60+ FPS).

> 💡 **Conclusión**: Elige **z-jackett.js** si priorizas rendimiento en operaciones de bajo nivel, o **Alpine.js** si buscas reactividad avanzada y mejor documentación.

---

## 📥 Instalación

### Opción 1: CDN (Recomendado para pruebas rápidas)
```html
<script src="https://cdn.jsdelivr.net/gh/zabr-76/zz/dist/z-jackett.min.js"></script>
```

### Opción 2: Descarga manual
1. Descarga el archivo desde [GitHub Releases](https://github.com/zabr-76/zz/releases).
2. Inclúyelo en tu proyecto:
   ```html
   <script src="path/to/z-jackett.min.js"></script>
   ```

### Opción 3: NPM (Próximamente)
```bash
npm install z-jackett
```

---

## 🚀 Ejemplo rápido

```html
<!DOCTYPE html>
<html>
<head>
    <script src="https://cdn.jsdelivr.net/gh/zabr-76/zz/dist/z-jackett.min.js"></script>
</head>
<body>
    <div z-app z-data="app()">
        <h1 z-text="message"></h1>
        <button @click="changeMessage()">Cambiar mensaje</button>
    </div>

    <script>
        function app() {
            return {
                message: "¡Hola z-jackett!",
                changeMessage() {
                    this.message = "¡Mensaje cambiado!";
                }
            };
        }
    </script>
</body>
</html>
```

---

## 📖 Documentación de directivas

### 1. **z-data**
Define el estado inicial del componente.

```html
<div z-app z-data="miApp()">
    <!-- Contenido reactivo -->
</div>

<script>
function miApp() {
    return {
        contador: 0,
        usuario: { nombre: "Juan", email: "juan@example.com" }
    };
}
</script>
```

---

### 2. **z-text**
Muestra texto reactivo en el DOM.

```html
<p>Nombre: <strong z-text="usuario.nombre"></strong></p>
<p>Contador: <span z-text="contador"></span></p>
```

---

### 3. **z-model**
Enlace bidireccional con inputs (soporta `.number`, `.trim`, `.debounce`).

```html
<input type="text" z-model="mensaje" placeholder="Escribe algo...">
<p>Tu mensaje: <strong z-text="mensaje"></strong></p>

<input type="number" z-model.number="precio" placeholder="Precio">
<p>Precio: $<span z-text="precio"></span></p>
```

---

### 4. **z-show / z-if**
Muestra u oculta elementos (`z-show`) o los elimina del DOM (`z-if`).

```html
<!-- z-show: Oculta el elemento -->
<p z-show="mostrar">¡Este mensaje es visible!</p>
<button @click="mostrar = !mostrar">Toggle</button>

<!-- z-if: Elimina del DOM -->
<template z-if="mostrar">
    <div>Este elemento se elimina del DOM cuando mostrar=false</div>
</template>
```

---

### 5. **z-for**
Renderiza listas de datos reactivamente.

```html
<template z-for="tarea in tareas" :key="tarea.id">
    <div>
        <input type="checkbox" z-model="tarea.completada">
        <span z-text="tarea.texto"></span>
    </div>
</template>

<script>
function app() {
    return {
        tareas: [
            { id: 1, texto: "Aprender z-jackett", completada: false },
            { id: 2, texto: "Construir proyecto", completada: true }
        ]
    };
}
</script>
```

---

### 6. **z-ref**
Accede directamente a elementos del DOM.

```html
<input type="text" z-model="nombre" z-ref="inputNombre">
<button @click="enfocarInput()">Enfocar input</button>

<script>
function app() {
    return {
        enfocarInput() {
            this.$refs.inputNombre.focus();
        }
    };
}
</script>
```

---

### 7. **@eventos**
Manejo de eventos con modificadores.

```html
<!-- Prevenir comportamiento por defecto -->
<form @submit.prevent="procesarFormulario()">
    <input type="text" z-model="nombre">
    <button type="submit">Enviar</button>
</form>

<!-- Detener propagación -->
<div @click="padre()">
    <button @click.stop="hijo()">Hijo</button>
</div>

<!-- Solo Enter -->
<input @keyup.enter="buscar()" placeholder="Presiona Enter">
```

---

### 8. **z-transition**
Transiciones CSS suaves.

```html
<button @click="visible = !visible">Toggle</button>

<div z-show="visible" z-transition="fade">
    Contenido con transición
</div>

<style>
.fade-enter {
    opacity: 0;
    transform: translateY(-10px);
}
.fade-enter-active {
    transition: all 0.5s ease;
}
.fade-leave-active {
    opacity: 0;
    transform: translateY(-10px);
    transition: all 0.5s ease;
}
</style>
```

---

## 🔗 Comparación con Alpine.js

| **Criterio** | **z-jackett.js** | **Alpine.js** |
|--------------|------------------|---------------|
| **📦 Creación de elementos** | ⭐⭐⭐⭐⭐ (56.20ms) | ⭐⭐⭐ (111.90ms) |
| **🔄 Reactividad** | ⭐⭐⭐⭐ (33.30ms) | ⭐⭐⭐⭐ (36.10ms) |
| **🎮 Fluidez (FPS)** | ⭐⭐⭐⭐⭐ (62 FPS) | ⭐⭐⭐⭐⭐ (62 FPS) |
| **📚 Documentación** | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| **🛠️ Comunidad** | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| **🚀 Tamaño** | ~10KB | ~15KB |

> 💡 **Recomendación**: Usa **z-jackett.js** si necesitas máximo rendimiento en operaciones DOM, o **Alpine.js** si buscas mejor documentación y comunidad.

---

## 📂 Estructura de proyecto recomendada

```
mi-proyecto/
├── index.html          # Página principal
├── app.js              # Lógica de la aplicación
├── styles.css          # Estilos personalizados
└── assets/             # Imágenes, fuentes, etc.
```

---

## 🛠️ Desarrollo local

1. **Clona el repositorio**:
   ```bash
   git clone https://github.com/zabr-76/zz.git
   cd zz
   ```

2. **Instala dependencias** (si las hay):
   ```bash
   npm install
   ```

3. **Ejecuta el servidor de desarrollo**:
   ```bash
   npm run dev
   ```

4. **Abre `http://localhost:3000` en tu navegador.**

---

## 🤝 Contribución

¡Las contribuciones son bienvenidas! Sigue estos pasos:

1. **Haz un fork** del proyecto.
2. **Crea una rama** para tu feature:
   ```bash
   git checkout -b feature/nueva-caracteristica
   ```
3. **Commitea tus cambios**:
   ```bash
   git commit -m "Añade nueva característica"
   ```
4. **Haz push** a la rama:
   ```bash
   git push origin feature/nueva-caracteristica
   ```
5. **Abre un Pull Request** en GitHub.

---

## 📜 Licencia

Este proyecto está bajo la **Licencia MIT**. Consulta el archivo [LICENSE](https://github.com/zabr-76/zz/blob/main/LICENSE) para más detalles.

---

## 📬 Contacto

📧 **Email**: [zabr.76@gmail.com](mailto:zabr.76@gmail.com)
🐦 **Twitter**: [@zabr_76](https://twitter.com/zabr_76)
💬 **Discord**: Únete a nuestro [servidor de Discord](https://discord.gg/ejemplo) (próximamente)

---

## 🌟 Créditos

- **Autor**: [zabr-76](https://github.com/zabr-76)
- **Inspiración**: Vue.js, Alpine.js
- **Iconos**: [Font Awesome](https://fontawesome.com/)

---

📌 **¿Te gustó z-jackett.js?** ¡Dale una ⭐ en GitHub y comparte el proyecto!

[![GitHub stars](https://img.shields.io/github/stars/zabr-76/zz?style=social)](https://github.com/zabr-76/zz/stargazers)
```

---

## **📌 ¿Cómo usar este README.md?**

1. **Crea un archivo `README.md`** en la raíz de tu repositorio.
2. **Copia y pega** el contenido que te proporcioné.
3. **Personaliza** los enlaces de contacto, Discord, etc.
4. **Sube los cambios** a GitHub.

---

## **🎯 Beneficios de este README.md**

✅ **Profesional y completo**: Cubre todo lo que un desarrollador necesita saber.
✅ **Benchmark integrado**: Muestra datos reales de rendimiento.
✅ **Ejemplos prácticos**: Facilita el aprendizaje.
✅ **Comparación clara**: Ayuda a los usuarios a elegir el framework adecuado.
✅ **Guía de contribución**: Fomenta la participación de la comunidad.

---
Si necesitas ajustar algo más (como enlaces, imágenes o secciones), dime y lo personalizamos juntos. 😊 ¡Este README.md hará que tu proyecto destaque en GitHub! 🚀
