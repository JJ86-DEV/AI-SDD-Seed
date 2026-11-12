#!/bin/bash
###############################################################################
# setup-hooks.sh — Configura git hooks para el proyecto .NET 10 Backend
#
# Ejecutar UNA VEZ al clonar el repositorio:
#   bash scripts/setup-hooks.sh
#
# Equivalente PowerShell (Windows):
#   .\scripts\setup-hooks.ps1
###############################################################################

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
HOOKS_DIR="$PROJECT_ROOT/.githooks"

echo ""
echo "🔧 Configurando git hooks — .NET 10 Backend"
echo ""

# 1. Verificar que estamos en un repositorio git
if ! git -C "$PROJECT_ROOT" rev-parse --git-dir >/dev/null 2>&1; then
  echo "❌ No se encontró un repositorio git en $PROJECT_ROOT"
  exit 1
fi

# 2. Verificar que el directorio .githooks existe
if [ ! -d "$HOOKS_DIR" ]; then
  echo "❌ Directorio .githooks no encontrado en $PROJECT_ROOT"
  exit 1
fi

# 3. Configurar git para usar .githooks como directorio de hooks
cd "$PROJECT_ROOT"
git config core.hooksPath .githooks
echo "✅ git config core.hooksPath .githooks"

# 4. Asegurar que el pre-commit tiene permisos de ejecución
if [ -f "$HOOKS_DIR/pre-commit" ]; then
  chmod +x "$HOOKS_DIR/pre-commit"
  echo "✅ Permisos +x en .githooks/pre-commit"
fi

# 5. Asegurar que ai-review.sh tiene permisos de ejecución
if [ -f "$SCRIPT_DIR/ai-review.sh" ]; then
  chmod +x "$SCRIPT_DIR/ai-review.sh"
  echo "✅ Permisos +x en scripts/ai-review.sh"
fi

# 6. Verificar copilot CLI
# El CLI puede registrarse como 'copilot' o 'github-copilot' según la versión
echo ""
echo "🔍 Verificando prerequisitos..."
if command -v copilot &>/dev/null; then
  COPILOT_CMD="copilot"
elif command -v github-copilot &>/dev/null; then
  COPILOT_CMD="github-copilot"
else
  COPILOT_CMD=""
fi

if [ -n "$COPILOT_CMD" ]; then
  COPILOT_VERSION=$($COPILOT_CMD --version 2>/dev/null || echo "desconocida")
  echo "✅ Copilot CLI disponible ($COPILOT_CMD): $COPILOT_VERSION"
else
  echo "⚠️  Copilot CLI no encontrado en el PATH"
  echo "   El CLI 'copilot' es el GitHub Copilot CLI con soporte de agentes."
  echo "   Si ya lo tienes instalado, añade su ubicación al PATH del sistema."
  echo "   Verifica con: which copilot"
fi

echo ""
echo "════════════════════════════════════════════════════════"
echo "✅ Setup completado. El hook pre-commit está activo."
echo ""
echo "Variables de entorno útiles:"
echo "  AI_CODE_REVIEW_DISABLED=true   → Salta la revisión una vez"
echo "  AI_CODE_REVIEW_MODEL=...        → Cambia el modelo (por defecto: claude-haiku-4.5)"
echo "  COPILOT_TIMEOUT=600             → Aumenta el timeout a 10 min"
echo "════════════════════════════════════════════════════════"
echo ""
