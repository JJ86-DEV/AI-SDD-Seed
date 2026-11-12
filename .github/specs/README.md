# Specs

Carpeta de especificaciones técnicas (Spec-Driven Development).

```
.github/specs/
├── _shared/
│   ├── specs.instructions.md   Estructura y reglas de specs.md + milestones.md
│   ├── impl.instructions.md    Reglas de implementación de una spec
│   └── functional.md           Documento funcional de referencia (opcional, crear aquí)
└── <modulo>/<n>-<feature>/
    ├── spec-context.md         Contexto: sección del funcional, specs previas, alcance
    ├── specs.md                Contrato técnico (lo genera el agente spec-generator)
    └── milestones.md           Plan de hitos (Pendiente / En progreso / Completado)
```

Flujo: `spec-context.md` → agente **spec-generator** (`specs.md` + `milestones.md`) → agente **spec-implementer** (código por lotes) → agente **code-review**.
