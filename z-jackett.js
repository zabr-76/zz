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
        nodeContexts.set(node, ctx);
        node.__z_context = ctx;
    }

    function getNodeContext(node) {
        return nodeContexts.get(node) || node.__z_context;
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
                    //console.log(`[z-jackett.js] setExpr: asignando ${parts[parts.length - 1]} =`, value, 'en', obj);
                    obj[parts[parts.length - 1]] = value;
                    return;
                }
            }
            //console.log(`[z-jackett.js] setExpr: asignando ${expr} =`, value, 'en', ctx);
            ctx[expr] = value;
        } catch (e) {
            console.warn('[z-jackett.js] => Error estableciendo expresión:', expr, e.message);
        }
    }

    function cleanupNode(el, ctx) {
        // Eliminar listeners de eventos
        if (el.__z_model_input_listener) {
            el.removeEventListener('input', el.__z_model_input_listener);
            delete el.__z_model_input_listener;
        }
        if (el.__z_model_blur_listener) {
            el.removeEventListener('blur', el.__z_model_blur_listener);
            delete el.__z_model_blur_listener;
        }
        if (el.__z_model_change_listener) {
            el.removeEventListener('change', el.__z_model_change_listener);
            delete el.__z_model_change_listener;
        }

        // Eliminar referencias en $refs
        if (ctx.$refs) {
            Object.keys(ctx.$refs).forEach(key => {
                if (ctx.$refs[key] === el) {
                    delete ctx.$refs[key];
                }
            });
        }

        // Limpiar efectos de transiciones
        if (el.__z_transition_end) {
            el.removeEventListener('transitionend', el.__z_transition_end);
            delete el.__z_transition_end;
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

    if (Array.isArray(obj)) {
        // Manejo de arrays reactivo (código existente)
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

                if (value && typeof value === 'object' && !value.__isReactive) {
                    target[key] = reactive(value);
                    return target[key];
                }

                return value;
            },
            set(target, key, value) {
                const oldValue = target[key];
                target[key] = value;
                
                // Si es una nueva propiedad o el valor cambió
                if (oldValue !== value || !target.hasOwnProperty(key)) {
                    getDep(key).notify();
                    if (!isNaN(key)) {
                        getDep('length').notify();
                    }
                }
                return true;
            }
        });

        proxy.__isReactive = true;
        return proxy;
    }

    // OBJETO NORMAL - MEJORA CRÍTICA AQUÍ
    const proxy = new Proxy(obj, {
        get(target, key) {
            getDep(key).depend();

            const value = target[key];

            if (value && typeof value === 'object' && !value.__isReactive) {
                // Convertir a reactivo y reasignar
                target[key] = reactive(value);
                return target[key];
            }

            return value;
        },
        set(target, key, value) {
            const oldValue = target[key];
            
            // Si el valor es un objeto, hacerlo reactivo
            if (value && typeof value === 'object' && !value.__isReactive) {
                value = reactive(value);
            }
            
            target[key] = value;
            
            // Notificar SIEMPRE que se establece una propiedad, incluso si es nueva
            getDep(key).notify();
            
            return true;
        },
        // NUEVO: Interceptar hasOwnProperty y operaciones de enumeración
        has(target, key) {
            return Reflect.has(target, key);
        },
        ownKeys(target) {
            getDep('@@keys').depend(); // Dependencia especial para cambios en las keys
            return Reflect.ownKeys(target);
        }
    });

    proxy.__isReactive = true;

    // Hacer reactivas todas las propiedades existentes
    Object.keys(obj).forEach(key => {
        if (obj[key] && typeof obj[key] === 'object') {
            obj[key] = reactive(obj[key]);
        }
    });

    return proxy;
}

    function xxxreactive(obj) {
        // Si ya es reactivo, devolverlo tal cual
        if (obj && obj.__isReactive) return obj;
        // Si no es un objeto, no se puede hacer reactivo
        if (obj === null || typeof obj !== 'object') return obj;

        const deps = new Map();

        function getDep(key) {
            if (!deps.has(key)) {
                deps.set(key, new Dep());
            }
            return deps.get(key);
        }

        if (Array.isArray(obj)) {
            // Manejo de arrays reactivo (tu código existente)
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

                    // Hacer reactivo cualquier objeto/anidado dentro del array también
                    if (value && typeof value === 'object' && !value.__isReactive) {
                        target[key] = reactive(value); // <-- Importante
                        return target[key];
                    }

                    return value;
                },
                set(target, key, value) {
                    target[key] = value;
                    getDep(key).notify();
                    if (!isNaN(key)) {
                        getDep('length').notify();
                    }
                    return true;
                }
            });

            proxy.__isReactive = true;
            return proxy;
        }

        // Objeto normal
        const proxy = new Proxy(obj, {
            get(target, key) {
                getDep(key).depend();

                const value = target[key];

                // Hacer reactivo cualquier objeto/anidado también
                if (value && typeof value === 'object' && !value.__isReactive) {
                    // Convertir inmediatamente a reactivo
                    target[key] = reactive(value); // <-- Importante
                    return target[key];
                }

                return value;
            },
            set(target, key, value) {
                target[key] = value;
                getDep(key).notify();
                return true;
            }
        });

        proxy.__isReactive = true;

        // Recorrer recursivamente las propiedades existentes para hacerlas reactivas
        // Esto ayuda a atrapar objetos/anidados que ya existen en el momento de la creación
        Object.keys(obj).forEach(key => {
            if (obj[key] && typeof obj[key] === 'object') {
                obj[key] = reactive(obj[key]); // <-- Garantiza profundidad
            }
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
                                //cleanupNode(node, ctx); // Limpia antes de eliminar
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

        // Guardar clases estáticas originales la primera vez
        if (!el.__z_static_classes) {
            el.__z_static_classes = el.className || '';
        }

        function effect() {
            Dep.target = effect;
            const obj = evalExpr(expr, ctx);
            Dep.target = null;

            // Restaurar clases estáticas
            el.className = el.__z_static_classes;

            // Evaluar expresión de clases dinámicas
            if (obj && typeof obj === 'object') {
                Object.entries(obj).forEach(([cls, active]) => {
                    if (active) {
                        // Separar clases por espacios
                        cls.split(/\s+/).forEach(singleClass => {
                            if (singleClass) {
                                try {
                                    el.classList.add(singleClass);
                                } catch (e) {
                                    log(`[bindClass] Error al añadir clase: ${singleClass}`, e);
                                }
                            }
                        });
                    } else {
                        // Separar clases por espacios
                        cls.split(/\s+/).forEach(singleClass => {
                            if (singleClass) {
                                try {
                                    el.classList.remove(singleClass);
                                } catch (e) {
                                    log(`[bindClass] Error al remover clase: ${singleClass}`, e);
                                }
                            }
                        });
                    }
                });
            } else if (typeof obj === 'string') {
                // Si es string, añadir como clase adicional
                obj.split(/\s+/).forEach(cls => {
                    if (cls) {
                        try {
                            el.classList.add(cls);
                        } catch (e) {
                            log(`[bindClass] Error al añadir clase: ${cls}`, e);
                        }
                    }
                });
            }
        }
        effect();
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
                Dep.target = effect;
                const value = evalExpr(expr, ctx);
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
        // Guardar clases estáticas originales la primera vez
        if (!el.__z_static_classes) {
            el.__z_static_classes = el.className || '';
        }

        function effect() {
            Dep.target = effect;
            const obj = evalExpr(expr, ctx);
            Dep.target = null;

            // Restaurar clases estáticas
            el.className = el.__z_static_classes;

            // Evaluar expresión de clases dinámicas
            if (obj && typeof obj === 'object') {
                Object.entries(obj).forEach(([cls, active]) => {
                    if (active) {
                        // Separar clases por espacios
                        cls.split(/\s+/).forEach(singleClass => {
                            if (singleClass) {
                                try {
                                    el.classList.add(singleClass);
                                } catch (e) {
                                    log(`[bindClass] Error al añadir clase: ${singleClass}`, e);
                                }
                            }
                        });
                    } else {
                        // Separar clases por espacios
                        cls.split(/\s+/).forEach(singleClass => {
                            if (singleClass) {
                                try {
                                    el.classList.remove(singleClass);
                                } catch (e) {
                                    log(`[bindClass] Error al remover clase: ${singleClass}`, e);
                                }
                            }
                        });
                    }
                });
            } else if (typeof obj === 'string') {
                // Si es string, añadir como clase adicional
                obj.split(/\s+/).forEach(cls => {
                    if (cls) {
                        try {
                            el.classList.add(cls);
                        } catch (e) {
                            log(`[bindClass] Error al añadir clase: ${cls}`, e);
                        }
                    }
                });
            }
        }
        effect();
    }

    function bindModel(el, ctx) {
        // Detectar atributo z-model con posibles modificadores en el nombre (ej: z-model.number, z-model.trim)
        const attr = Array.from(el.attributes).find(a => a.name.startsWith('z-model'));
        if (!attr) return;

        const attrName = attr.name; // ejemplo: "z-model.number" o "z-model.trim"
        const modifiers = attrName.split('.').slice(1); // ["number"], ["trim"], etc.
        const prop = el.getAttribute(attrName);

        setNodeContext(el, ctx);

        // Función para sincronizar valor del modelo al input
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
                    // Para radios: checked si el valor del modelo coincide con el value del radio
                    el.checked = el.value == value;
                } else {
                    if (value === undefined || value === null) value = '';
                    el.value = String(value);
                }
            } catch (e) {
                console.warn('[z-jackett.js] => Error actualizando elemento:', e.message);
            }
        }

        // Reactividad: actualizar valor input cuando cambia el modelo
        function effect() {
            Dep.target = effect;
            updateElement();
            Dep.target = null;
        }
        effect();

        // Quitar listeners existentes para evitar duplicación
        if (el.__z_model_input_listener) {
            el.removeEventListener('input', el.__z_model_input_listener);
        }
        if (el.__z_model_blur_listener) {
            el.removeEventListener('blur', el.__z_model_blur_listener);
        }
        if (el.__z_model_change_listener) {
            el.removeEventListener('change', el.__z_model_change_listener);
        }

        // Listener para evento 'input': actualiza modelo en tiempo real sin aplicar trim
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
                        // Si no está seleccionado el radio, no hacemos nada para no sobrescribir el modelo con valor no seleccionado
                        return;
                    }
                } else {
                    // Valor crudo sin trim
                    newValue = e.target.value;

                    // Aplicar modificador 'number' si está
                    if (modifiers.includes('number')) {
                        const num = Number(newValue);
                        newValue = isNaN(num) ? newValue : num;
                    }
                    // NO aplicar trim aquí para no interferir con la escritura libre
                }

                setExpr(prop, newValue, elementCtx);

                log(`[bindModel] input asignado a ${prop}:`, newValue);
            } catch (ex) {
                console.warn('[z-jackett.js] => Error listener input z-model:', ex.message);
            }
        };

        el.__z_model_input_listener = inputListener;

        // Para radios y selects se recomienda usar 'change' para detectar selección
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
            // Para texto, textarea u otros inputs, usar input
            el.addEventListener('input', inputListener);
        }

        // Listener para evento 'blur': si tiene modificador 'trim', aplicar trim y actualizar modelo al perder foco
        if (modifiers.includes('trim')) {
            const blurListener = e => {
                const elementCtx = getNodeContext(el) || ctx;
                try {
                    let value = e.target.value.trim();
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

    log(`[bindFor] Procesando: ${expr}`);
    log(`[bindFor] listExpr: ${listExpr}`);

    el.style.display = 'none';

    if (!el.__z_for_placeholder) {
        el.__z_for_placeholder = document.createComment('z-for placeholder');
        el.parentNode.insertBefore(el.__z_for_placeholder, el.nextSibling);
    }

    if (!el.__z_for_instances) {
        el.__z_for_instances = new Map();
    }
    const instances = el.__z_for_instances;

    function updateList() {
        Dep.target = updateList;

        const list = evalExpr(listExpr, ctx);

        log(`[bindFor] Lista evaluada:`, list);

        // Registrar dependencia
        try {
            if (list && typeof list === 'object') {
                Object.keys(list);
                if (listExpr.match(/^[a-zA-Z_$][a-zA-Z0-9_$]*(\.[a-zA-Z_$][a-zA-Z0-9_$]*)*$/)) {
                    let current = ctx;
                    const parts = listExpr.split('.');
                    for (const part of parts) {
                        if (current && current[part]) {
                            current = current[part];
                        }
                    }
                }
            }
        } catch (e) {
            log(`[bindFor] Error registrando dependencia:`, e);
        }

        Dep.target = null;

        if (!list || typeof list !== 'object') {
            clearAllNodes();
            return;
        }

        let entries;
        if (Array.isArray(list)) {
            entries = list.map((item, index) => [index, item, index]);
        } else {
            // Para objetos, usar [key, value, index] - IMPORTANTE: mantener el índice original
            entries = Object.entries(list)
                .filter(([key, value]) => !key.startsWith('__'))
                .map(([key, value], index) => [key, value, index]);
        }

        log(`[bindFor] Entries a renderizar:`, entries);

        const currentKeys = new Set();
        
        entries.forEach(([key, value, originalIndex]) => {
            let instanceKey;
            if (keyExpr) {
                const tempCtx = createContext(ctx, itemName, value, originalIndex, key);
                if (value !== undefined) {
                    instanceKey = evalExpr(keyExpr, tempCtx);
                }
            }
            
            // SIEMPRE usar la clave real del objeto, no el índice
            if (instanceKey === undefined || instanceKey === null) {
                instanceKey = key; // Usar la clave real del objeto, no el índice
            }
            
            currentKeys.add(instanceKey);
            
            if (instances.has(instanceKey)) {
                // Actualizar instancia existente - CORREGIDO: usar contexto plano
                const instance = instances.get(instanceKey);
                // Actualizar el contexto existente sin crear uno nuevo
                instance.context[itemName] = value;
                instance.context.index = originalIndex;
                instance.context.key = key;
                
                // Actualizar los textos en el DOM
                updateNodeContent(instance.node, instance.context);
            } else {
                // Crear nueva instancia
                log(`[bindFor] Creando instancia para key: ${instanceKey}`);
                createInstance(instanceKey, value, originalIndex, key);
            }
        });

        // Eliminar instancias que ya no existen
        instances.forEach((instance, key) => {
            if (!currentKeys.has(key)) {
                removeInstance(key);
            }
        });
    }

    // FUNCIÓN CORREGIDA: usar contexto plano, NO prototipal
    // Esta función debería estar cerca de la función bindFor
function createContext(parentCtx, itemName, itemValue, index) {
    // Crear contexto plano
    const ctx = {};
    
    // Copiar propiedades del padre
    for (const key in parentCtx) {
        if (Object.prototype.hasOwnProperty.call(parentCtx, key)) {
            ctx[key] = parentCtx[key];
        }
    }
    
    // Agregar variables específicas
    ctx[itemName] = itemValue;
    ctx.index = index;
    
    log(`[createContext] Contexto creado con "${itemName}", "index": ${index}`, ctx);
    return ctx;
}

    function assignContextRecursively(node, ctx) {
        setNodeContext(node, ctx);
        if (node.children) {
            for (const child of node.children) {
                assignContextRecursively(child, ctx);
            }
        }
    }

    // Función para actualizar el contenido de un nodo existente
    function updateNodeContent(node, context) {
        // Buscar y actualizar elementos con z-text
        const textElements = node.querySelectorAll('[z-text]');
        textElements.forEach(el => {
            const expr = el.getAttribute('z-text');
            const value = evalExpr(expr, context);
            el.textContent = value !== undefined ? String(value) : '';
        });
    }

    function createInstance(key, item, index, originalKey) {
        let node;
        if (el.tagName.toLowerCase() === 'template') {
            node = el.content.firstElementChild.cloneNode(true);
        } else {
            node = el.cloneNode(true);
            node.style.display = '';
        }

        node.removeAttribute('z-for');
        if (node.hasAttribute(':key')) {
            node.removeAttribute(':key');
        }

        const itemCtx = createContext(ctx, itemName, item, index, originalKey);

        log(`[bindFor][createInstance] Crear nodo para key: ${key}`, item);

        assignContextRecursively(node, itemCtx);

        el.__z_for_placeholder.parentNode.insertBefore(node, el.__z_for_placeholder);

        instances.set(key, {
            node,
            context: itemCtx,
            key
        });

        if (!node.__z_events_binded) {
            node.__z_events_binded = true;
            bindEvents(itemCtx, node);
            bindDirectives(node, itemCtx);
        }
    }

    function removeInstance(key) {
        const instance = instances.get(key);
        if (instance) {
            if (instance.node.parentNode) {
                instance.node.parentNode.removeChild(instance.node);
            }
            instances.delete(key);
        }
    }

    function clearAllNodes() {
        instances.forEach((instance) => {
            if (instance.node.parentNode) {
                instance.node.parentNode.removeChild(instance.node);
            }
        });
        instances.clear();
    }

    // Conectar al sistema reactivo
    updateList();
    el.__z_for_effect = updateList;
}


    function xxxbindFor(el, ctx) {
        const expr = el.getAttribute('z-for');
        if (!expr) return;

        const splitIndex = expr.indexOf(' in ');
        if (splitIndex === -1) return;

        const itemName = expr.slice(0, splitIndex).trim();
        const listExpr = expr.slice(splitIndex + 4).trim();
        const keyExpr = el.getAttribute(':key');

        log(`[bindFor] Procesando: ${expr}`);
        log(`[bindFor] listExpr: ${listExpr}`);

        el.style.display = 'none';

        if (!el.__z_for_placeholder) {
            el.__z_for_placeholder = document.createComment('z-for placeholder');
            el.parentNode.insertBefore(el.__z_for_placeholder, el.nextSibling);
        }

        if (!el.__z_for_instances) {
            el.__z_for_instances = new Map();
        }
        const instances = el.__z_for_instances;

        function updateList() {
            Dep.target = updateList;

            const list = evalExpr(listExpr, ctx);

            // Esta línea es crucial para la reactividad
            // Hace que el sistema sepa que debe observar cambios en listExpr
            try {
                if (listExpr.match(/^[a-zA-Z_$][a-zA-Z0-9_$]*$/)) {
                    ctx[listExpr]; // Accede a la propiedad para registrar la dependencia
                }
            } catch (e) {
                // Ignorar errores
            }

            Dep.target = null;

            log(`[bindFor] Lista evaluada:`, list);

            if (!Array.isArray(list)) {
                clearAllNodes();
                return;
            }

            clearAllNodes();

            list.forEach((item, index) => {
                let key;
                if (keyExpr) {
                    // Crear contexto temporal para evaluar el key
                    const tempCtx = createContext(ctx, itemName, item, index);
                    if (item !== undefined) {
                        key = evalExpr(keyExpr, tempCtx);
                    }
                }

                if (key === undefined || key === null) {
                    key = index;
                }

                createInstance(key, item, index);
            });
        }

        // Crear contexto plano, copiando propiedades directas de parentCtx y agregando item actual e índice
        function createContext(parentCtx, itemName, itemValue, index) {
            const ctx = {};
            for (const key in parentCtx) {
                if (Object.prototype.hasOwnProperty.call(parentCtx, key)) {
                    ctx[key] = parentCtx[key];
                }
            }
            ctx[itemName] = itemValue;
            ctx.index = index; // Agregar índice al contexto

            log(`[bindFor][createContext] Contexto creado con "${itemName}", "index": ${index}`, ctx);

            return ctx;
        }

        // Asignar contexto recursivamente a nodo y todos sus hijos
        function assignContextRecursively(node, ctx) {
            setNodeContext(node, ctx);
            if (node.children) {
                for (const child of node.children) {
                    assignContextRecursively(child, ctx);
                }
            }
        }

        function createInstance(key, item, index) {
            let node;
            if (el.tagName.toLowerCase() === 'template') {
                node = el.content.firstElementChild.cloneNode(true);
            } else {
                node = el.cloneNode(true);
                node.style.display = '';
            }

            node.removeAttribute('z-for');
            if (node.hasAttribute(':key')) {
                node.removeAttribute(':key');
            }

            const itemCtx = createContext(ctx, itemName, item, index);

            log(`[bindFor][createInstance] Crear nodo para key: ${key}`, item);

            // Asignar contexto a nodo raíz y a todos sus hijos
            assignContextRecursively(node, itemCtx);

            el.__z_for_placeholder.parentNode.insertBefore(node, el.__z_for_placeholder);

            instances.set(key, {
                node,
                context: itemCtx,
                key
            });

            if (!node.__z_events_binded) {
                node.__z_events_binded = true;
                bindEvents(itemCtx, node);
                bindDirectives(node, itemCtx);
            }
        }

        function clearAllNodes() {
            instances.forEach(({
                node
            }) => {
                if (node.parentNode) {
                    //cleanupNode(node, context); // Limpia antes de eliminar
                    node.parentNode.removeChild(node);
                }
            });
            instances.clear();
        }

        // Conectar al sistema reactivo
        updateList();
        el.__z_for_effect = updateList; // Guardar referencia para debugging
    }
    //------------//
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

        setNodeContext(root, ctx);

        // Procesar directivas simples y sin modificadores detectables con selector CSS
        if (root.nodeType === Node.ELEMENT_NODE) {
            processDirectives(root, ctx);
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
            setNodeContext(el, ctx);
            processDirectives(el, ctx);
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
            setNodeContext(el, ctx);

            // Despachar a las funciones correspondientes según el tipo de atributo
            dynamicAttrs.forEach(attr => {
                if (attr.name.startsWith(':') || attr.name.startsWith('z-bind:')) {
                    bindBind(el, ctx);
                } else if (attr.name === 'z-model' || attr.name.startsWith('z-model.')) {
                    bindModel(el, ctx);
                }
                // Aquí puedes agregar más directivas con modificadores si las añades en tu framework
            });
        });
    }

    // === SISTEMA DE EVENTOS ===

    function xxxbindEvents(ctx, root) {
        if (root.__z_events_binded) return;
        root.__z_events_binded = true;

        const eventNames = ['click', 'input', 'submit', 'change', 'keydown', 'keyup', 'focus', 'blur', 'mouseenter', 'mouseleave'];

        eventNames.forEach(evName => {
            root.addEventListener(evName, ev => {
                let currentEl = ev.target;
                let stopPropagation = false;

                while (currentEl && currentEl !== root.parentNode && !stopPropagation) {
                    // Buscar atributos tipo z-on:click o @click
                    const attrName1 = `z-on:${evName}`;
                    const attrName2 = `@${evName}`;

                    let code = currentEl.getAttribute(attrName1) || currentEl.getAttribute(attrName2);

                    if (code) {
                        try {
                            exec(code, getNodeContext(currentEl) || ctx, ev);
                            stopPropagation = true; // Para que no siga subiendo y no dispare múltiples veces
                        } catch (e) {
                            console.warn(`[z-jackett.js] Error ejecutando evento ${evName} en`, currentEl, e);
                        }
                    }

                    currentEl = currentEl.parentNode;
                }
            });
        });
    }

    function xxxbindEvents(ctx, root) {
        if (root.__z_events_binded) return;
        root.__z_events_binded = true;

        ['click', 'input', 'submit', 'change', 'keydown', 'keyup', 'focus', 'blur', 'mouseenter', 'mouseleave'].forEach(evName => {
            try {
                root.addEventListener(evName, ev => {
                    let currentEl = ev.target;
                    let processed = false;

                    while (currentEl && currentEl !== root.parentNode && !processed) {
                        // Buscar atributos de evento en el elemento actual
                        const attrs = Array.from(currentEl.attributes);
                        const possibleAttrs = attrs
                            .map(attr => attr.name)
                            .filter(name => name.startsWith('@' + evName + '.') || name === '@' + evName);

                        for (const attrName of possibleAttrs) {
                            const mods = attrName.split('.').slice(1);
                            let shouldExecute = true;

                            // Verificar modificadores
                            if (mods.includes('prevent')) {
                                ev.preventDefault();
                            }
                            if (mods.includes('stop')) {
                                ev.stopPropagation();
                            }
                            if (mods.includes('self') && currentEl !== ev.target) {
                                shouldExecute = false;
                            }
                            if (mods.includes('enter') && (ev.key !== 'Enter' && ev.keyCode !== 13)) {
                                shouldExecute = false;
                            }

                            if (shouldExecute) {
                                const code = currentEl.getAttribute(attrName);
                                if (code) {
                                    const targetCtx = getNodeContext(ev.target) || ctx;

                                    log(`[bindEvents] Ejecutando ${attrName}:`, code);
                                    log('[bindEvents] Contexto:', targetCtx);

                                    exec(code, targetCtx, ev);
                                    processed = true;
                                    break; // Salir del for de atributos
                                }
                            }
                        }

                        if (processed) break; // Salir del while si ya procesamos
                        currentEl = currentEl.parentElement;
                    }
                });
            } catch (e) {
                log('[bindEvents] Error al agregar listener:', e);
            }
        });
    }

    function bindEvents(ctx, root) {
        if (root.__z_events_binded) return;
        root.__z_events_binded = true;

        const eventNames = ['click', 'input', 'submit', 'change', 'keydown', 'keyup', 'focus', 'blur', 'mouseenter', 'mouseleave'];

        eventNames.forEach(evName => {
            try {
                root.addEventListener(evName, ev => {
                    let currentEl = ev.target;
                    let processed = false;

                    while (currentEl && currentEl !== root.parentNode && !processed) {
                        // Buscar atributos tipo z-on:click o @click
                        const attrs = Array.from(currentEl.attributes);
                        const possibleAttrs = attrs
                            .map(attr => attr.name)
                            .filter(name => name.startsWith(`z-on:${evName}.`) || name === `z-on:${evName}` || name.startsWith(`@${evName}.`) || name === `@${evName}`);

                        for (const attrName of possibleAttrs) {
                            const mods = attrName.split('.').slice(1);
                            let shouldExecute = true;

                            // Verificar modificadores
                            if (mods.includes('prevent')) {
                                ev.preventDefault();
                            }
                            if (mods.includes('stop')) {
                                ev.stopPropagation();
                            }
                            if (mods.includes('self') && currentEl !== ev.target) {
                                shouldExecute = false;
                            }
                            if (mods.includes('enter') && (ev.key !== 'Enter' && ev.keyCode !== 13)) {
                                shouldExecute = false;
                            }

                            if (shouldExecute) {
                                const code = currentEl.getAttribute(attrName);
                                if (code) {
                                    const targetCtx = getNodeContext(ev.target) || ctx;

                                    log(`[bindEvents] Ejecutando ${attrName}:`, code);
                                    log('[bindEvents] Contexto:', targetCtx);

                                    exec(code, targetCtx, ev);
                                    processed = true;
                                    break; // Salir del for de atributos
                                }
                            }
                        }

                        if (processed) break; // Salir del while si ya procesamos
                        currentEl = currentEl.parentElement;
                    }
                });
            } catch (e) {
                log('[bindEvents] Error al agregar listener:', e);
            }
        });
    }


    // === CREACIÓN DE APPS ===

    function createApp(root) {
        log('[createApp] Iniciando en:', root);

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

