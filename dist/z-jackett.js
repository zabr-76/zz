(function() {
    // Sistema de logging
    const log = (...args) => {
        if (typeof window !== 'undefined' && window.Z_DEBUG) {
            console.log('[z-jackett.js] => ', ...args);
        }
    };

    // Storage global
    const apps = new Map();
    const nodeContexts = new WeakMap();

    // === UTILIDADES ===
    function setNodeContext(node, ctx) {
        if (!node || !ctx) {
            console.warn('❌ [setNodeContext] Nodo o contexto inválido');
            return;
        }

        // 1. Guardar en WeakMap (PRINCIPAL)
        nodeContexts.set(node, ctx);

        // 2. También guardar como propiedad para compatibilidad
        node.__z_context = ctx;

        log('✅ [setNodeContext] Contexto asignado:', {
            tag: node.tagName,
            hasItem: !!ctx.item,
            hasFile: !!ctx.file
        });
    }

    function getNodeContext(node) {
        if (!node) return undefined;

        // 1. Buscar en WeakMap primero
        let ctx = nodeContexts.get(node);

        // 2. Si no está, buscar en propiedad
        if (!ctx && node.__z_context) {
            ctx = node.__z_context;
            // Migrar a WeakMap
            nodeContexts.set(node, ctx);
        }

        return ctx;
    }

    function setExpr(expr, value, ctx) {
        try {
            if (expr.includes('.')) {
                const parts = expr.split('.');
                if (parts.length >= 2) {
                    let obj = ctx;
                    for (let i = 0; i < parts.length - 1; i++) {
                        if (!obj) {
                            console.warn('[z-jackett.js] setExpr: objeto padre no definido para', expr);
                            return;
                        }
                        obj = obj[parts[i]];
                    }
                    log(`[z-jackett.js] setExpr: asignando ${parts[parts.length - 1]} =`, value, 'en', obj);
                    obj[parts[parts.length - 1]] = value;
                    return;
                }
            }
            log(`[z-jackett.js] setExpr: asignando ${expr} =`, value, 'en', ctx);
            ctx[expr] = value;
        } catch (e) {
            console.warn('[z-jackett.js] => Error estableciendo expresión:', expr, e.message);
        }
    }

    // === SISTEMA DE REACTIVIDAD ===
    class Dep {
        constructor() {
            this.subscribers = new Set();
        }
        depend() {
            if (Dep.target) this.subscribers.add(Dep.target);
        }
        notify() {
            this.subscribers.forEach(sub => sub());
        }
    }
    Dep.target = null;

    // z-jackett.js (función `reactive` mejorada)
    function reactive(obj) {
        if (obj && obj.__isReactive) return obj;
        if (obj === null || typeof obj !== 'object') return obj;

        const deps = new Map();

        function getDep(key) {
            if (!deps.has(key)) {
                deps.set(key, new Dep());
            }
            return deps.get(key);
        }

        // MEJORA CRÍTICA: Hacer reactivas todas las propiedades anidadas
        const makeNestedReactive = (target) => {
            Object.keys(target).forEach(key => {
                if (target[key] && typeof target[key] === 'object' && !target[key].__isReactive) {
                    target[key] = reactive(target[key]);
                }
            });
        };

        if (Array.isArray(obj)) {
            // Hacer reactivos todos los items del array
            makeNestedReactive(obj);

            const proxy = new Proxy(obj, {
                get(target, key) {
                    const mutatingMethods = ['push', 'pop', 'shift', 'unshift', 'splice', 'sort', 'reverse'];

                    if (mutatingMethods.includes(key)) {
                        return function(...args) {
                            const result = Array.prototype[key].apply(target, args);
                            getDep('length').notify();
                            deps.forEach(dep => dep.notify());
                            return result;
                        };
                    }

                    getDep(key).depend();
                    const value = target[key];

                    // Si es un objeto, asegurar reactividad
                    if (value && typeof value === 'object' && !value.__isReactive) {
                        target[key] = reactive(value);
                        return target[key];
                    }

                    return value;
                },

                set(target, key, value) {
                    const oldValue = target[key];

                    // Hacer el nuevo valor reactivo si es objeto
                    if (value && typeof value === 'object' && !value.__isReactive) {
                        value = reactive(value);
                    }

                    target[key] = value;

                    // ✅ CAMBIO 1: Notificar SIEMPRE, no solo si cambió
                    getDep(key).notify();
                    if (!isNaN(key)) {
                        getDep('length').notify();
                    }

                    return true;
                }
            });

            Object.defineProperty(proxy, "__isReactive", {
                value: true,
                enumerable: false
            });
            return proxy;
        }

        // OBJETOS NORMALES - MEJORA PARA PROPIEDADES ANIDADAS
        makeNestedReactive(obj);

        const proxy = new Proxy(obj, {
            get(target, key) {
                // ✅ CAMBIO 2: Asegurar que SIEMPRE se recolecten dependencias
                getDep(key).depend();

                const value = target[key];

                // Asegurar que propiedades anidadas sean reactivas
                if (value && typeof value === 'object' && !value.__isReactive) {
                    target[key] = reactive(value);
                    return target[key];
                }

                return value;
            },

            set(target, key, value) {
                const oldValue = target[key];

                // Hacer reactivo el nuevo valor
                if (value && typeof value === 'object' && !value.__isReactive) {
                    value = reactive(value);
                }

                target[key] = value;

                // ✅ CAMBIO 1: Notificar SIEMPRE, no solo si cambió
                getDep(key).notify();

                return true;
            }
        });

        Object.defineProperty(proxy, "__isReactive", {
            value: true,
            enumerable: false
        });
        return proxy;
    }

    // === EVALUACIÓN Y EJECUCIÓN ===
    function evalExpr(expr, ctx) {
        try {
            if (!ctx) return undefined;

            const safeCtx = new Proxy(ctx, {
                has() {
                    return true;
                },
                get(target, key) {
                    try {
                        // Propiedades globales necesarias
                        if (key === 'Z') return window.Z;

                        if (key === 'window') return typeof window !== 'undefined' ? window : undefined;
                        if (key === 'document') return typeof document !== 'undefined' ? document : undefined;
                        if (key === 'console') return typeof console !== 'undefined' ? console : undefined;
                        if (key === 'alert') return typeof window !== 'undefined' && window.alert ? (...args) => window.alert.call(window, ...args) : undefined;
                        if (key === 'Date') return Date;
                        if (key === 'Math') return Math;
                        if (key === 'JSON') return JSON;
                        if (key === '$data') return target;

                        // IMPORTANTE: Acceder a la propiedad, lo que disparará el getter si es computada
                        const value = target[key];

                        // Si es función MÉTODO (no computada), bindearla
                        if (typeof value === 'function' && value.length > 0) {
                            return value.bind(target);
                        }

                        return value;
                    } catch (e) {
                        return undefined;
                    }
                }
            });

            return Function('with(this) { return (' + expr + ') }').call(safeCtx);
        } catch (e) {
            if (!e.message.includes('Cannot read properties of undefined') &&
                !e.message.includes("Cannot read property") &&
                !e.message.includes('is not defined')) {
                console.log('[z-jackett.js] => ❌ eval error:', e.message, 'en expr:', expr);
            }
            return undefined;
        }
    }

    function exec(code, ctx, event) {
        try {
            // Si el código es solo una llamada a función (ej: login())
            if (code.trim().endsWith('()')) {
                const fnName = code.trim().slice(0, -2); // Quitar los ()
                if (typeof ctx[fnName] === 'function') {
                    log(`[exec] Ejecutando función directamente: ${fnName}`);
                    return ctx[fnName]();
                }
            }

            // Si no es una llamada directa, usar el método tradicional
            const extendedCtx = new Proxy(ctx, {
                has() {
                    return true;
                },
                get(target, key) {
                    if (key === 'Z') return window.Z;

                    if (key === '$event') return event;
                    if (key === 'window') return typeof window !== 'undefined' ? window : undefined;
                    if (key === 'document') return typeof document !== 'undefined' ? document : undefined;
                    if (key === 'console') return typeof console !== 'undefined' ? console : undefined;
                    if (key === 'alert') return typeof window !== 'undefined' && window.alert ? (...args) => window.alert.call(window, ...args) : undefined;
                    if (key === 'Date') return Date;
                    if (key === 'Math') return Math;
                    if (key === 'JSON') return JSON;

                    try {
                        const value = target[key];
                        if (typeof value === 'function') {
                            return value.bind(target);
                        }
                        return value;
                    } catch {
                        return undefined;
                    }
                }
            });

            const fn = new Function('with(this) { ' + code + ' }');
            return fn.call(extendedCtx);

        } catch (e) {
            console.log('[z-jackett.js] => ❌ exec error:', e.message);
            console.log('[z-jackett.js] => Código:', code);
            console.log('[z-jackett.js] => Stack:', e.stack);
        }
    }

    // === DIRECTIVAS ===

    function bindRef(el, ctx) {
        const refName = el.getAttribute('z-ref');
        if (!refName) return;

        // Guardar referencia en el contexto
        if (!ctx.$refs) ctx.$refs = {};

        log(`[bindRef] Configurando la referencia "${refName}" para el elemento:`, el);
        ctx.$refs[refName] = el;

        // Limpiar referencia si el nodo se elimina
        el.addEventListener('DOMNodeRemoved', () => {
            if (ctx.$refs && ctx.$refs[refName] === el) {
                delete ctx.$refs[refName];
            }
        });
    }

    function bindInit(el, ctx) {
        const code = el.getAttribute('z-init');
        if (!code) return;

        // Ejecutar código una vez
        exec(code, ctx);
    }

    function bindText(el, ctx) {
        const expr = el.getAttribute('z-text');

        function effect() {
            Dep.target = effect;
            const evaluated = evalExpr(expr, ctx);
            el.textContent = evaluated !== undefined ? String(evaluated) : '';
            Dep.target = null;
        }
        effect();
    }

    function bindHtml(el, ctx) {
        const expr = el.getAttribute('z-html');

        function effect() {
            Dep.target = effect;
            const html = evalExpr(expr, ctx);
            el.innerHTML = html || '';
            Dep.target = null;
        }
        effect();
    }

    function bindShow(el, ctx) {
        const expr = el.getAttribute('z-show');

        // Si tiene z-transition, dejar que bindTransition maneje la visualización
        if (el.hasAttribute('z-transition')) {
            return; // No hacer nada, bindTransition se encargará
        }

        // Comportamiento normal de z-show
        function effect() {
            Dep.target = effect;
            const val = evalExpr(expr, ctx);
            el.style.display = val ? '' : 'none';
            Dep.target = null;
        }
        effect();
    }

    function bindIf(el, ctx) {
        const expr = el.getAttribute('z-if');

        if (el.tagName.toLowerCase() === 'template') {
            if (!el.__z_if_placeholder) {
                el.__z_if_placeholder = document.createComment('z-if placeholder');
                el.parentNode.insertBefore(el.__z_if_placeholder, el);
            }

            function effect() {
                Dep.target = effect;
                const show = evalExpr(expr, ctx);
                Dep.target = null;

                if (show) {
                    if (!el.__z_if_rendered) {
                        const clone = el.content.cloneNode(true);
                        // Guardamos los nodos insertados en un array
                        const nodes = [];
                        const parent = el.__z_if_placeholder.parentNode;

                        Array.from(clone.childNodes).forEach(node => {
                            parent.insertBefore(node, el.__z_if_placeholder);
                            nodes.push(node);
                        });

                        el.__z_if_rendered = nodes;

                        nodes.forEach(child => {
                            bindEvents(ctx, child);
                            bindDirectives(child, ctx);
                        });
                    }
                } else {
                    if (el.__z_if_rendered) {
                        const parent = el.__z_if_placeholder.parentNode;
                        el.__z_if_rendered.forEach(node => {
                            if (node.parentNode === parent) {
                                parent.removeChild(node);
                            }
                        });
                        el.__z_if_rendered = null;
                    }
                }
            }
            effect();
        } else {
            function effect() {
                Dep.target = effect;
                const show = evalExpr(expr, ctx);
                el.style.display = show ? '' : 'none';
                Dep.target = null;
            }
            effect();
        }
    }

    function bindClass(el, ctx) {
        const expr = el.getAttribute('z-class');

        log('🔄 bindClass ejecutado para elemento:', el);
        log('📝 Expresión:', expr);

        // Guardar clases estáticas originales la primera vez
        if (!el.__z_static_classes) {
            el.__z_static_classes = el.className || '';
            log('💾 Clases estáticas guardadas:', el.__z_static_classes);
        }

        function effect() {
            // ✅ USAR CONTEXTO DEL ELEMENTO Y CONECTAR CON SISTEMA REACTIVO
            const elementCtx = getNodeContext(el) || ctx;

            Dep.target = effect;
            const obj = evalExpr(expr, elementCtx);
            Dep.target = null;

            log('🎨 Efecto ejecutado - Objeto evaluado:', obj);

            // Optimización: comparar si la configuración de clases es la misma
            if (el.__z_last_class_config === JSON.stringify(obj)) {
                log('⚡ No hay cambios en clases, omitiendo...');
                return;
            }
            el.__z_last_class_config = JSON.stringify(obj);

            // Restaurar clases estáticas
            el.className = el.__z_static_classes;
            log('🔄 Clases restauradas a:', el.className);

            // Evaluar expresión de clases dinámicas
            if (obj && typeof obj === 'object') {
                log('🎯 Aplicando clases dinámicas desde objeto:', obj);
                Object.entries(obj).forEach(([cls, active]) => {
                    log(`   📌 Clase: "${cls}", Activa: ${active}`);
                    if (active) {
                        // Separar clases por espacios
                        cls.split(/\s+/).forEach(singleClass => {
                            if (singleClass) {
                                try {
                                    el.classList.add(singleClass);
                                    log(`   ✅ Añadida clase: ${singleClass}`);
                                } catch (e) {
                                    console.log(`   ❌ Error al añadir clase: ${singleClass}`, e);
                                }
                            }
                        });
                    } else {
                        // Separar clases por espacios
                        cls.split(/\s+/).forEach(singleClass => {
                            if (singleClass) {
                                try {
                                    el.classList.remove(singleClass);
                                    log(`   ✅ Removida clase: ${singleClass}`);
                                } catch (e) {
                                    console.log(`   ❌ Error al remover clase: ${singleClass}`, e);
                                }
                            }
                        });
                    }
                });
            } else if (typeof obj === 'string') {
                log('🎯 Aplicando clases desde string:', obj);
                obj.split(/\s+/).forEach(cls => {
                    if (cls) {
                        try {
                            el.classList.add(cls);
                            log(`   ✅ Añadida clase: ${cls}`);
                        } catch (e) {
                            console.log(`   ❌ Error al añadir clase: ${cls}`, e);
                        }
                    }
                });
            }

            log('🎉 Clases finales:', el.className);
        }

        effect();

        // ✅ CONECTAR CON SISTEMA REACTIVO: Evaluar una vez más para establecer dependencias
        Dep.target = effect;
        evalExpr(expr, getNodeContext(el) || ctx);
        Dep.target = null;
    }

    function bindBind(el, ctx) {
        const attrs = Array.from(el.attributes).filter(attr =>
            attr.name.startsWith(':') || attr.name.startsWith('z-bind:')
        );

        attrs.forEach(attr => {
            const attrName = attr.name.replace(/^(:|z-bind:)/, '');
            const expr = attr.value;

            // Caso especial: :class debe comportarse como z-class
            if (attrName === 'class') {
                bindDynamicClass(el, ctx, expr);
                return;
            }

            // Caso especial: :disabled debe actualizarse reactivamente
            if (attrName === 'disabled') {
                bindDisabled(el, ctx, expr);
                return;
            }

            function effect() {
                // ✅ USAR CONTEXTO DEL ELEMENTO
                const elementCtx = getNodeContext(el) || ctx;

                Dep.target = effect;
                const value = evalExpr(expr, elementCtx);
                if (value !== undefined && value !== null) {
                    el.setAttribute(attrName, value);
                } else {
                    el.removeAttribute(attrName);
                }
                Dep.target = null;
            }
            effect();
        });
    }

    // Nueva función para manejar :disabled reactivamente
    function bindDisabled(el, ctx, expr) {
        function effect() {
            Dep.target = effect;
            const value = evalExpr(expr, ctx);
            if (value) {
                el.setAttribute('disabled', '');
                el.disabled = true;
            } else {
                el.removeAttribute('disabled');
                el.disabled = false;
            }
            Dep.target = null;
        }
        effect();
    }

    // Nueva función para manejar :class dinámico

    function bindDynamicClass(el, ctx, expr) {
        log('🔄 bindDynamicClass ejecutado');
        log('📝 Expresión:', expr);

        // Guardar clases estáticas originales la primera vez
        if (!el.__z_static_classes) {
            el.__z_static_classes = el.className || '';
        }

        function effect() {
            // ✅ USAR CONTEXTO DEL ELEMENTO
            const elementCtx = getNodeContext(el) || ctx;

            Dep.target = effect;
            const result = evalExpr(expr, elementCtx);
            Dep.target = null;

            log('🎨 Resultado evaluado:', result);

            // Optimización: comparar si la configuración es la misma
            const newConfig = JSON.stringify(result);
            if (el.__z_last_class_config === newConfig) {
                log('⚡ No hay cambios en clases, omitiendo...');
                return;
            }
            el.__z_last_class_config = newConfig;

            // Restaurar clases estáticas
            el.className = el.__z_static_classes;

            // Aplicar clases dinámicas según el tipo
            if (result && typeof result === 'object' && !Array.isArray(result)) {
                // Es un objeto: { 'clase': condicion }
                log('🎯 Aplicando clases desde objeto:', result);
                Object.entries(result).forEach(([classNames, condition]) => {
                    if (condition) {
                        // Separar múltiples clases en el string
                        classNames.split(/\s+/).forEach(cls => {
                            if (cls.trim()) {
                                el.classList.add(cls.trim());
                                log(`✅ Añadida clase: ${cls.trim()}`);
                            }
                        });
                    } else {
                        // Remover clases si la condición es false
                        classNames.split(/\s+/).forEach(cls => {
                            if (cls.trim()) {
                                el.classList.remove(cls.trim());
                                log(`❌ Removida clase: ${cls.trim()}`);
                            }
                        });
                    }
                });
            } else if (typeof result === 'string') {
                // Es un string: 'clase1 clase2'
                log('🎯 Aplicando clases desde string:', result);
                result.split(/\s+/).forEach(cls => {
                    if (cls.trim()) {
                        el.classList.add(cls.trim());
                        log(`✅ Añadida clase: ${cls.trim()}`);
                    }
                });
            }

            log('🎉 Clases finales:', el.className);
        }

        effect();

        // ✅ CONECTAR CON SISTEMA REACTIVO: Evaluar una vez más para establecer dependencias
        Dep.target = effect;
        evalExpr(expr, getNodeContext(el) || ctx);
        Dep.target = null;
    }

    function bindModel(el, ctx) {
        const attr = Array.from(el.attributes).find(a => a.name.startsWith('z-model'));
        if (!attr) return;

        const attrName = attr.name;
        const modifiers = attrName.split('.').slice(1);
        const prop = el.getAttribute(attrName);

        log(`[z-jackett] bindModel: Iniciando para atributo "${attrName}" en prop "${prop}"`);
        log(`[z-jackett] bindModel: Modificadores detectados:`, modifiers);

        setNodeContext(el, ctx);

        // MEJORA CRÍTICA: Detección mejorada de debounce
        let debounceTime = 300;
        let hasDebounce = false;

        // Buscar cualquier modificador que contenga "debounce"
        for (let i = 0; i < modifiers.length; i++) {
            const modifier = modifiers[i];

            if (modifier === 'debounce') {
                hasDebounce = true;
                // Buscar el siguiente modificador que sea un número (tiempo)
                if (i + 1 < modifiers.length) {
                    const nextModifier = modifiers[i + 1];
                    // Verificar si es un número seguido opcionalmente de "ms"
                    const timeMatch = nextModifier.match(/^(\d+)(ms)?$/);
                    if (timeMatch) {
                        debounceTime = parseInt(timeMatch[1]);
                        log(`[z-jackett] bindModel: Tiempo debounce detectado: ${debounceTime}ms`);
                        break;
                    }
                }
                // Si no hay tiempo específico, usar el default (300ms)
                break;
            }

            // También detectar formato "debounce500ms" o "debounce500"
            const debounceMatch = modifier.match(/^debounce(\d+)(ms)?$/);
            if (debounceMatch) {
                hasDebounce = true;
                debounceTime = parseInt(debounceMatch[1]);
                log(`[z-jackett] bindModel: Tiempo debounce detectado (formato combinado): ${debounceTime}ms`);
                break;
            }
        }

        log(`[z-jackett] bindModel: Debounce activado: ${hasDebounce}, Tiempo: ${debounceTime}ms`);

        function debounce(func, wait) {
            let timeout;
            let lastCallTime = 0;

            return function(...args) {
                const context = this;
                const currentTime = Date.now();
                const timeSinceLastCall = currentTime - lastCallTime;

                clearTimeout(timeout);
                timeout = setTimeout(() => {
                    const executionTime = Date.now();
                    const totalWaitTime = executionTime - currentTime;

                    // LOG 2: Momento en que se ejecuta la función (cuando termina el debounce)
                    log(`[DEBOUNCE-TIMING] ⏰ Tiempo real de espera: ${totalWaitTime}ms (configurado: ${wait}ms)`);

                    func.apply(context, args);
                    lastCallTime = executionTime;
                }, wait);
            };
        }

        function updateElement() {
            try {
                let value = evalExpr(prop, ctx);

                if (el.type === 'checkbox') {
                    if (Array.isArray(value)) {
                        el.checked = value.includes(el.value);
                    } else {
                        el.checked = !!value;
                    }
                } else if (el.type === 'radio') {
                    el.checked = el.value == value;
                } else {
                    if (value === undefined || value === null) value = '';
                    el.value = String(value);
                }
            } catch (e) {
                console.warn('[z-jackett.js] => Error actualizando elemento:', e.message);
            }
        }

        function effect() {
            Dep.target = effect;
            updateElement();
            Dep.target = null;
        }
        effect();

        // Limpiar listeners existentes
        if (el.__z_model_input_listener) {
            el.removeEventListener('input', el.__z_model_input_listener);
        }
        if (el.__z_model_blur_listener) {
            el.removeEventListener('blur', el.__z_model_blur_listener);
        }
        if (el.__z_model_change_listener) {
            el.removeEventListener('change', el.__z_model_change_listener);
        }

        const inputListener = e => {
            const elementCtx = getNodeContext(el) || ctx;

            try {
                let newValue;

                if (el.type === 'checkbox') {
                    const currentValue = evalExpr(prop, elementCtx);

                    if (Array.isArray(currentValue)) {
                        newValue = [...currentValue];
                        if (el.checked) {
                            if (!newValue.includes(el.value)) newValue.push(el.value);
                        } else {
                            newValue = newValue.filter(v => v !== el.value);
                        }
                    } else {
                        newValue = el.checked;
                    }
                } else if (el.type === 'radio') {
                    if (el.checked) {
                        newValue = el.value;
                    } else {
                        return;
                    }
                } else {
                    newValue = e.target.value;

                    if (modifiers.includes('number')) {
                        const num = Number(newValue);
                        newValue = isNaN(num) ? newValue : num;
                    }
                }

                log(`[INPUT-EVENT] 🎯 Valor a asignar a "${prop}":`, newValue);
                setExpr(prop, newValue, elementCtx);

                // LOG 4: Confirmación de que se asignó el valor
                log(`[INPUT-EVENT] ✅ Valor asignado correctamente al modelo reactivo`);

            } catch (ex) {
                console.warn('[z-jackett.js] => Error listener input z-model:', ex.message);
            }
        };

        // Aplicar debounce si está presente
        const finalInputListener = hasDebounce ? debounce(inputListener, debounceTime) : inputListener;
        el.__z_model_input_listener = finalInputListener;

        if (el.type === 'radio' || el.type === 'checkbox' || el.tagName.toLowerCase() === 'select') {
            if (el.__z_model_change_listener) {
                el.removeEventListener('change', el.__z_model_change_listener);
            }
            const changeListener = e => {
                inputListener(e);
            };
            el.__z_model_change_listener = changeListener;
            el.addEventListener('change', changeListener);
        } else {
            el.addEventListener('input', finalInputListener);
        }

        if (modifiers.includes('trim')) {
            const blurListener = e => {
                const elementCtx = getNodeContext(el) || ctx;
                try {
                    let value = e.target.value.trim();
                    log(`[TRIM-EVENT] ✂️ Aplicando trim: "${e.target.value}" -> "${value}"`);
                    setExpr(prop, value, elementCtx);
                    log(`[bindModel] blur (trim) asignado a ${prop}:`, value);
                } catch (ex) {
                    console.warn('[z-jackett.js] => Error listener blur z-model:', ex.message);
                }
            };
            if (el.__z_model_blur_listener) {
                el.removeEventListener('blur', el.__z_model_blur_listener);
            }
            el.__z_model_blur_listener = blurListener;
            el.addEventListener('blur', blurListener);
        }
    }
    
    function bindFor(el, ctx) {
        const expr = el.getAttribute('z-for');
        if (!expr) return;

        const splitIndex = expr.indexOf(' in ');
        if (splitIndex === -1) return;

        const itemName = expr.slice(0, splitIndex).trim();
        const listExpr = expr.slice(splitIndex + 4).trim();
        const keyExpr = el.getAttribute(':key');

        log('🔍 [bindFor] INICIANDO:', {
            expr,
            itemName,
            listExpr,
            keyExpr
        });

        // Ocultar el elemento original
        el.style.display = 'none';

        // Crear placeholder
        if (!el.__z_for_placeholder) {
            el.__z_for_placeholder = document.createComment('z-for');
            el.parentNode.insertBefore(el.__z_for_placeholder, el.nextSibling);
        }

        // Almacenar nodos actuales
        let currentNodes = [];

        function updateList() {
            log('🔄 [bindFor] Actualizando lista...');

            // Limpiar nodos anteriores
            currentNodes.forEach(node => {
                if (node.parentNode) {
                    node.parentNode.removeChild(node);
                }
            });
            currentNodes = [];

            // Evaluar la lista
            Dep.target = updateList;
            const list = evalExpr(listExpr, ctx);
            Dep.target = null;

            log('📊 [bindFor] Lista obtenida:', list);

            if (!Array.isArray(list) && !isObject(list)) {
                log('⚠️ [bindFor] Lista vacía o inválida');
                return;
            }

            // Convertir a array de entradas
            let entries = [];
            if (Array.isArray(list)) {
                entries = list.map((item, index) => [index, item, index]);
            } else {
                entries = Object.entries(list)
                    .filter(([key]) => !key.startsWith('__'))
                    .map(([key, value], index) => [key, value, index]);
            }

            log('📋 [bindFor] Entries procesadas:', entries);

            // Crear nuevos nodos
            entries.forEach(([key, item, index]) => {
                log(`🆕 [bindFor] Creando item ${index}:`, item);

                let node;
                if (el.tagName.toLowerCase() === 'template') {
                    node = el.content.firstElementChild.cloneNode(true);
                } else {
                    node = el.cloneNode(true);
                    node.style.display = '';
                }

                // Remover atributos del z-for original
                node.removeAttribute('z-for');
                if (node.hasAttribute(':key')) {
                    node.removeAttribute(':key');
                }

                // ✅ CORRECCIÓN: Crear contexto con índice correcto
                const itemCtx = createItemContext(ctx, itemName, item, index, key);

                // Insertar en el DOM antes del placeholder
                el.parentNode.insertBefore(node, el.__z_for_placeholder);
                currentNodes.push(node);

                // Procesar directivas en este nodo
                processItemNode(node, itemCtx);
            });

            log('✅ [bindFor] Lista actualizada. Nodos creados:', currentNodes.length);
        }

        // ✅ CORREGIDO: Contexto con índice reactivo
        function createItemContext(parentCtx, itemName, itemValue, index, originalKey) {
            // Crear un objeto reactivo para este item específico
            const itemData = {
                [itemName]: itemValue,
                index: index,
                key: originalKey
            };

            // Hacerlo reactivo
            const reactiveItemData = reactive(itemData);

            // Combinar con el contexto padre usando prototipo
            const ctx = Object.create(parentCtx);

            // Copiar propiedades reactivas
            Object.keys(reactiveItemData).forEach(key => {
                Object.defineProperty(ctx, key, {
                    get() {
                        return reactiveItemData[key];
                    },
                    set(value) {
                        reactiveItemData[key] = value;
                    },
                    enumerable: true,
                    configurable: true
                });
            });

            log(`🎭 [bindFor] Contexto creado para ${itemName}[${index}]:`, itemValue);
            return ctx;
        }

        function processItemNode(node, itemCtx) {
            log(`🔧 [bindFor] Procesando nodo del item:`, node.tagName);

            // Asignar contexto
            setNodeContext(node, itemCtx);

            // Usar tu bindDirectives original
            bindDirectives(node, itemCtx);
        }

        function isObject(obj) {
            return obj && typeof obj === 'object' && !Array.isArray(obj);
        }

        // Observar cambios en la lista
        log('🚀 [bindFor] Configurando observador para:', listExpr);

        function effect() {
            Dep.target = effect;
            evalExpr(listExpr, ctx); // Establecer dependencia
            Dep.target = null;

            updateList();
        }

        // Ejecutar inicialmente
        effect();
        el.__z_for_effect = effect;

        log('✅ [bindFor] bindFor completado');
    }


    function bindTransition(el, ctx) {
        const expr = el.getAttribute('z-show');
        if (!expr) {
            console.warn('[z-jackett] z-transition requiere z-show');
            return;
        }

        // Estado inicial
        let isVisible = !!evalExpr(expr, ctx);
        const originalDisplay = el.style.display || getComputedStyle(el).display;

        // Establecer estado inicial
        if (!isVisible) {
            el.style.display = 'none';
        } else {
            el.style.display = originalDisplay;
        }

        const transitionConfig = el.getAttribute('z-transition');

        // Determinar el tipo de transición
        let config;
        let useInlineStyles = false;

        if (!transitionConfig || transitionConfig.trim() === '') {
            // 1. Fade básico por defecto (con estilos inline)
            useInlineStyles = true;
            config = {
                enterFrom: {
                    opacity: '0'
                },
                enterActive: {
                    opacity: '1',
                    transition: 'opacity 0.3s ease-in'
                },
                leaveFrom: {
                    opacity: '1'
                },
                leaveActive: {
                    opacity: '0',
                    transition: 'opacity 0.3s ease-out'
                }
            };
        } else if (transitionConfig.includes(':')) {
            // 2. Configuración explícita (Tailwind o CSS directo)
            config = parseExplicitConfig(transitionConfig);
        } else {
            // 3. Clases CSS personalizadas (ej: slider)
            const prefix = transitionConfig.trim();
            config = {
                enterFrom: `${prefix}-enter`,
                enterActive: `${prefix}-enter-active`,
                leaveFrom: `${prefix}-leave`,
                leaveActive: `${prefix}-leave-active`
            };
        }

        // Función para manejar estilos/clases
        function applyTransition(action, transitionConfig) {
            if (useInlineStyles && typeof transitionConfig === 'object') {
                // Usar estilos inline para el fade por defecto
                if (action === 'add') {
                    Object.entries(transitionConfig).forEach(([prop, value]) => {
                        el.style[prop] = value;
                    });
                } else {
                    Object.keys(transitionConfig).forEach(prop => {
                        el.style[prop] = '';
                    });
                }
            } else if (typeof transitionConfig === 'string') {
                // Usar clases CSS
                transitionConfig.split(' ').forEach(cls => {
                    if (cls) el.classList[action](cls);
                });
            }
        }

        function runTransition(show) {
            if (show === isVisible) return;

            // Limpiar transición anterior
            if (el.__z_transition_end) {
                el.removeEventListener('transitionend', el.__z_transition_end);
            }

            if (show) {
                // Transición de entrada
                el.style.display = originalDisplay;
                applyTransition('remove', config.leaveFrom);
                applyTransition('remove', config.leaveActive);
                applyTransition('add', config.enterFrom);

                // Forzar reflow
                void el.offsetWidth;

                applyTransition('add', config.enterActive);

                const onEnd = () => {
                    applyTransition('remove', config.enterFrom);
                    applyTransition('remove', config.enterActive);
                    el.removeEventListener('transitionend', onEnd);
                };

                el.__z_transition_end = onEnd;
                el.addEventListener('transitionend', onEnd);
            } else {
                // Transición de salida
                applyTransition('remove', config.enterFrom);
                applyTransition('remove', config.enterActive);
                applyTransition('add', config.leaveFrom);

                // Forzar reflow
                void el.offsetWidth;

                applyTransition('add', config.leaveActive);

                const onEnd = () => {
                    el.style.display = 'none';
                    applyTransition('remove', config.leaveFrom);
                    applyTransition('remove', config.leaveActive);
                    el.removeEventListener('transitionend', onEnd);
                };

                el.__z_transition_end = onEnd;
                el.addEventListener('transitionend', onEnd);
            }

            isVisible = show;
        }

        // Función efecto que se conecta al sistema reactivo
        function effect() {
            try {
                Dep.target = effect;
                const show = !!evalExpr(expr, ctx);
                Dep.target = null;

                runTransition(show);
            } catch (e) {
                console.error('[Transition] Error en efecto:', e);
                Dep.target = null;
            }
        }

        // Conectar al sistema reactivo
        function setupReactivity() {
            Dep.target = effect;
            evalExpr(expr, ctx);
            Dep.target = null;
        }

        // Iniciar
        setupReactivity();
        effect();
        el.__z_transition_effect = effect;
    }

    // Parsear configuración explícita (Tailwind/CSS directo)
    function parseExplicitConfig(configStr) {
        const config = {
            enterFrom: '',
            enterActive: '',
            leaveFrom: '',
            leaveActive: ''
        };

        // Limpiar configuración
        let cleanConfig = configStr.trim()
            .replace(/^\{|\}$/g, '') // Quitar llaves
            .replace(/['"]/g, ''); // Quitar comillas

        // Parsear pares clave-valor
        cleanConfig.split(',').forEach(pair => {
            const [key, value] = pair.split(':').map(s => s.trim());
            if (!key || !value) return;

            if (key === 'enter-from') config.enterFrom = value;
            else if (key === 'enter-active') config.enterActive = value;
            else if (key === 'leave-from') config.leaveFrom = value;
            else if (key === 'leave-active') config.leaveActive = value;
        });

        return config;
    }

    // === PROCESAMIENTO DE DIRECTIVAS ===
    function processDirectives(el, ctx) {
        // Almacenar el HTML original del template antes de procesar
        if (el.tagName.toLowerCase() === 'template' && el.hasAttribute('z-for')) {
            // El HTML original ya fue almacenado en createApp
        }

        if (el.hasAttribute('z-transition')) bindTransition(el, ctx);

        if (el.hasAttribute('z-ref')) bindRef(el, ctx);
        if (el.hasAttribute('z-init')) bindInit(el, ctx);

        if (el.hasAttribute('z-text')) bindText(el, ctx);
        if (el.hasAttribute('z-html')) bindHtml(el, ctx);
        if (el.hasAttribute('z-show')) bindShow(el, ctx);
        if (el.hasAttribute('z-if')) bindIf(el, ctx);
        if (el.hasAttribute('z-class')) bindClass(el, ctx);

        // Cambio aquí: detectar cualquier atributo que empiece con 'z-model' y ejecutar bindModel una vez
        const hasZModelAttr = Array.from(el.attributes).some(attr =>
            attr.name === 'z-model' || attr.name.startsWith('z-model.')
        );

        if (hasZModelAttr) bindModel(el, ctx);

        if (el.hasAttribute('z-for')) bindFor(el, ctx);

        // Procesar z-bind
        const hasBindAttrs = Array.from(el.attributes).some(attr =>
            attr.name.startsWith(':') || attr.name.startsWith('z-bind:')
        );
        if (hasBindAttrs) bindBind(el, ctx);
    }


    function bindDirectives(root, ctx) {
        if (root.__z_processed) return;
        root.__z_processed = true;

        // ✅ SOLO asignar contexto si no tiene uno
        if (!getNodeContext(root)) {
            setNodeContext(root, ctx);
        }

        // Procesar directivas simples y sin modificadores detectables con selector CSS
        if (root.nodeType === Node.ELEMENT_NODE) {
            processDirectives(root, getNodeContext(root) || ctx);
        }

        if (!root.querySelectorAll) return;

        // Selección eficiente para directivas conocidas sin modificadores
        const simpleSelectors = [
            '[z-ref]', '[z-init]', '[z-text]', '[z-html]', '[z-show]', '[z-if]', '[z-class]', '[z-model]', '[z-for]', '[z-transition]'
        ].join(',');

        const elementsSimple = root.querySelectorAll(simpleSelectors);
        elementsSimple.forEach(el => {
            if (el.__z_processed) return;
            el.__z_processed = true;

            // ✅ USAR EL CONTEXTO EXISTENTE, no asignar uno nuevo
            const elementCtx = getNodeContext(el) || getNodeContext(root) || ctx;
            processDirectives(el, elementCtx);
        });

        // Ahora hacer UNA sola pasada para detectar atributos dinámicos o con modificadores
        const allElements = root.querySelectorAll('*');
        allElements.forEach(el => {
            if (el.__z_dynamic_processed) return;

            // Detectar atributos dinámicos relevantes (z-model con modificadores, z-bind, :)
            const dynamicAttrs = Array.from(el.attributes).filter(attr => {
                return (
                    attr.name.startsWith(':') || // ej: :foo
                    attr.name.startsWith('z-bind:') || // ej: z-bind:foo
                    attr.name === 'z-model' || // exacto z-model
                    attr.name.startsWith('z-model.') // z-model.number, z-model.trim, etc.
                );
            });

            if (dynamicAttrs.length === 0) return;

            el.__z_dynamic_processed = true;

            // ✅ USAR CONTEXTO EXISTENTE
            const elementCtx = getNodeContext(el) || getNodeContext(root) || ctx;
            setNodeContext(el, elementCtx);

            // Despachar a las funciones correspondientes según el tipo de atributo
            dynamicAttrs.forEach(attr => {
                if (attr.name.startsWith(':') || attr.name.startsWith('z-bind:')) {
                    bindBind(el, elementCtx);
                } else if (attr.name === 'z-model' || attr.name.startsWith('z-model.')) {
                    bindModel(el, elementCtx);
                }
                // Aquí puedes agregar más directivas con modificadores si las añades en tu framework
            });
        });
    }

    // === SISTEMA DE EVENTOS ===


    // === SISTEMA CON AMBOS: OUTSIDE Y AWAY ===
    function bindEvents(ctx, root) {
        if (root.__z_events_binded) return;
        root.__z_events_binded = true;

        // Sistemas globales
        if (!window.__z_click_outside_handlers) {
            window.__z_click_outside_handlers = new Map();
            window.__z_click_away_handlers = new Map();
            window.__z_click_away_groups = new Map(); // Grupos para away

            document.addEventListener('click', (ev) => {
                // Procesar outside
                window.__z_click_outside_handlers.forEach((handler, el) => {
                    if (el.isConnected) handler(ev);
                });

                // Procesar away (CORREGIDO)
                window.__z_click_away_handlers.forEach((handler, groupId) => {
                    const group = window.__z_click_away_groups.get(groupId);
                    if (group && group.elements.some(el => el.isConnected)) {
                        handler(ev, group);
                    }
                });
            });
        }

        // Buscar y registrar outside y away
        function findClickHandlers(n) {
            const outsideElms = [];
            const awayElms = [];

            if (n.attributes) {
                for (let a of n.attributes) {
                    if (a.name.includes('click.outside')) outsideElms.push(n);
                    if (a.name.includes('click.away')) awayElms.push(n);
                }
            }

            if (n.children) {
                for (let c of n.children) {
                    const childHandlers = findClickHandlers(c);
                    outsideElms.push(...childHandlers.outside);
                    awayElms.push(...childHandlers.away);
                }
            }

            return {
                outside: outsideElms,
                away: awayElms
            };
        }

        const handlers = findClickHandlers(root);

        // Registrar outside
        handlers.outside.forEach(el => {
            for (let a of el.attributes) {
                if (a.name.includes('click.outside')) {
                    const code = a.value;
                    if (!code) return;

                    if (el.__z_click_outside_handler)
                        window.__z_click_outside_handlers.delete(el);

                    const handler = (ev) => {
                        if (!el.isConnected || el.contains(ev.target)) return;
                        const style = window.getComputedStyle(el);
                        if (style.display === 'none' || style.visibility === 'hidden') return;

                        const targetCtx = getNodeContext(el) || ctx;
                        exec(code, targetCtx, ev);
                    };

                    window.__z_click_outside_handlers.set(el, handler);
                    el.__z_click_outside_handler = handler;
                    break;
                }
            }
        });

        // Registrar away
        // === SISTEMA AWAY MEJORADO ===
        handlers.away.forEach(el => {
            for (let a of el.attributes) {
                if (a.name.includes('click.away')) {
                    const code = a.value;
                    if (!code) return;

                    // Crear o obtener grupo away
                    const groupId = code;

                    if (!window.__z_click_away_groups.has(groupId)) {
                        window.__z_click_away_groups.set(groupId, {
                            elements: [],
                            handler: null
                        });
                    }

                    const group = window.__z_click_away_groups.get(groupId);

                    // Evitar duplicados
                    if (!group.elements.includes(el)) {
                        group.elements.push(el);
                    }

                    // Registrar handler una sola vez por grupo
                    if (!group.handler) {
                        const handler = (ev, group) => {
                            // Verificar si el click fue en CUALQUIERA de los elementos del grupo
                            const clickedElement = group.elements.find(groupEl =>
                                groupEl.isConnected && groupEl.contains(ev.target)
                            );

                            // Si clickeamos en algún elemento del grupo, NO hacer nada
                            if (clickedElement) {
                                log('[click-away] ❌ Click dentro del grupo, no hacer nada');
                                return;
                            }

                            // Si clickeamos FUERA de todos los elementos del grupo, cerrar TODOS
                            log('[click-away] ✅ Click fuera del grupo, cerrar todos');
                            group.elements.forEach(groupEl => {
                                if (groupEl.isConnected) {
                                    const targetCtx = getNodeContext(groupEl) || ctx;
                                    exec(code, targetCtx, ev);
                                }
                            });
                        };

                        window.__z_click_away_handlers.set(groupId, handler);
                        group.handler = handler;
                    }

                    break;
                }
            }
        });

        // Eventos normales (igual que antes)
        ['click', 'input', 'submit', 'change', 'keydown', 'keyup', 'focus', 'blur', 'mouseenter', 'mouseleave'].forEach(evName => {
            root.addEventListener(evName, ev => {
                let el = ev.target;
                while (el && el !== root.parentNode) {
                    for (let a of el.attributes) {
                        const n = a.name,
                            v = a.value;
                        if ((n.startsWith(`z-on:${evName}`) || n.startsWith(`@${evName}`)) &&
                            !n.includes('outside') && !n.includes('away') && v) {

                            const mods = n.split('.').slice(1);
                            let shouldExecute = true;

                            // Aplicar todos los modificadores
                            mods.forEach(mod => {
                                switch (mod) {
                                    case 'prevent':
                                        ev.preventDefault();
                                        break;
                                    case 'stop':
                                        ev.stopPropagation();
                                        break;
                                    case 'self':
                                        if (ev.currentTarget !== ev.target) shouldExecute = false;
                                        break;
                                    case 'enter':
                                        if (ev.key !== 'Enter' && ev.keyCode !== 13) shouldExecute = false;
                                        break;
                                    case 'space':
                                        if (ev.key !== ' ' && ev.keyCode !== 32) shouldExecute = false;
                                        break;
                                    case 'esc':
                                        if (ev.key !== 'Escape' && ev.keyCode !== 27) shouldExecute = false;
                                        break;
                                    case 'tab':
                                        if (ev.key !== 'Tab' && ev.keyCode !== 9) shouldExecute = false;
                                        break;
                                    case 'up':
                                        if (ev.key !== 'ArrowUp' && ev.keyCode !== 38) shouldExecute = false;
                                        break;
                                    case 'down':
                                        if (ev.key !== 'ArrowDown' && ev.keyCode !== 40) shouldExecute = false;
                                        break;
                                    case 'left':
                                        if (ev.key !== 'ArrowLeft' && ev.keyCode !== 37) shouldExecute = false;
                                        break;
                                    case 'right':
                                        if (ev.key !== 'ArrowRight' && ev.keyCode !== 39) shouldExecute = false;
                                        break;
                                    case 'delete':
                                        if (ev.key !== 'Delete' && ev.keyCode !== 46) shouldExecute = false;
                                        break;
                                    case 'backspace':
                                        if (ev.key !== 'Backspace' && ev.keyCode !== 8) shouldExecute = false;
                                        break;
                                    case 'ctrl':
                                        if (!ev.ctrlKey) shouldExecute = false;
                                        break;
                                    case 'shift':
                                        if (!ev.shiftKey) shouldExecute = false;
                                        break;
                                    case 'alt':
                                        if (!ev.altKey) shouldExecute = false;
                                        break;
                                    case 'meta':
                                        if (!ev.metaKey) shouldExecute = false;
                                        break;
                                    case 'exact':
                                        if (ev.ctrlKey || ev.shiftKey || ev.altKey || ev.metaKey)
                                            shouldExecute = false;
                                        break;
                                }
                            });


                            // En bindEvents, donde ejecutas el código del evento:
                            if (shouldExecute) {
                                // BUSCAR CONTEXTO DEL ELEMENTO ACTUAL, no del target
                                let targetCtx = getNodeContext(el);
                                if (!targetCtx) {
                                    // Si no tiene contexto, buscar en padres
                                    let parentEl = el.parentElement;
                                    while (parentEl && !targetCtx) {
                                        targetCtx = getNodeContext(parentEl);
                                        parentEl = parentEl.parentElement;
                                    }
                                }
                                // Si aún no hay contexto, usar el contexto raíz
                                if (!targetCtx) targetCtx = ctx;

                                exec(v, targetCtx, ev);
                                return;
                            }

                        }
                    }
                    el = el.parentElement;
                }
            });
        });
    }

    function cleanupClickOutsideHandlers(root) {
        if (window.__z_click_outside_handlers) {
            window.__z_click_outside_handlers.forEach((handler, el) => {
                if (root.contains(el)) window.__z_click_outside_handlers.delete(el);
            });
        }

        // Cleanup para away
        if (window.__z_click_away_groups) {
            window.__z_click_away_groups.forEach((group, groupId) => {
                group.elements = group.elements.filter(el => !root.contains(el));
                if (group.elements.length === 0) {
                    window.__z_click_away_groups.delete(groupId);
                    window.__z_click_away_handlers.delete(groupId);
                }
            });
        }
    }

    // === CREACIÓN DE APPS ===
    function createApp(root) {
        log('[createApp] Iniciando creación de app para root:', root);
        // Almacenar templates antes de procesar
        const templates = new Map();
        const templateElements = root.querySelectorAll('template[z-for]');
        templateElements.forEach(template => {
            // Almacenar el HTML original antes de que sea procesado
            const originalHTML = template.innerHTML;
            templates.set(template, originalHTML);
            log(`[createApp] Almacenado template original para:`, template);
        });

        // Limpiar marcas previas
        function cleanNode(node) {
            delete node.__z_processed;
            delete node.__z_bind_processed;
            delete node.__z_events_binded;
            delete node.__z_context;
            nodeContexts.delete(node);

            if (node.children) {
                Array.from(node.children).forEach(cleanNode);
            }
        }

        cleanNode(root);

        // Limpiar handlers antiguos para este root
        cleanupClickOutsideHandlers(root);

        let data = {};
        if (root.hasAttribute('z-data')) {
            try {
                log('[createApp] z-data encontrado:', root.getAttribute('z-data'));
                data = Function('return ' + root.getAttribute('z-data'))();
                log('[createApp] z-data evaluado a:', data);
            } catch (e) {
                log('❌ z-data parse error', e.message);
            }
        }

        const computedDefs = {};
        const methodDefs = {};
        const rawData = {};

        for (const [k, v] of Object.entries(data)) {
            if (typeof v === 'function') {
                if (v.length === 0) {
                    const functionStr = v.toString();
                    if (functionStr.includes('this.') && !functionStr.includes('return this.')) {
                        methodDefs[k] = v;
                        log(`[createApp] ${k} detectada como método (por uso de this)`);
                    } else {
                        computedDefs[k] = v;
                        log(`[createApp] ${k} detectada como propiedad computada`);
                    }
                } else {
                    methodDefs[k] = v;
                    log(`[createApp] ${k} detectada como método (por parámetros)`);
                }
            } else {
                rawData[k] = v;
            }
        }

        const proxy = reactive(rawData);

        // Agregar propiedades computadas
        Object.entries(computedDefs).forEach(([k, fn]) => {
            Object.defineProperty(proxy, k, {
                get() {
                    try {
                        return fn.call(proxy);
                    } catch {
                        return undefined;
                    }
                },
                enumerable: true,
                configurable: true
            });
        });

        // Agregar métodos
        Object.entries(methodDefs).forEach(([k, fn]) => {
            proxy[k] = fn.bind(proxy);
            log(`[createApp] Método ${k} agregado`);
        });

        bindEvents(proxy, root);
        bindDirectives(root, proxy, templates);

        apps.set(root, proxy);
        log('[createApp] ✅ App creada exitosamente');

    }

    // === SISTEMA DE COMPONENTES ===
    function registerComponent(name, template) {
        if (customElements.get(`z-${name}`)) return;

        customElements.define(`z-${name}`, class extends HTMLElement {
            connectedCallback() {
                this.innerHTML = template;
                createApp(this);
            }
        });
    }

    // === API GLOBAL ===
    window.Z = {
        createApp,
        registerComponent,
        reactive,
        apps
    };

    // === INICIALIZACIÓN ===
    if (typeof document !== 'undefined') {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                document.querySelectorAll('[z-app]').forEach(createApp);
            });
        } else {
            document.querySelectorAll('[z-app]').forEach(createApp);
        }
    }
})();