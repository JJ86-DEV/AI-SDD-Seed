#!/usr/bin/env bash

###############################################################################
# AI Code Review Script — .NET 10 Backend
# Ejecuta revisión de código usando GitHub Copilot CLI
# Se integra en el hook pre-commit de git via .githooks/pre-commit
# Agente: .github/agents/code-review-console.agent.md
###############################################################################

# NO usar set -e porque queremos capturar errores específicamente

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
AGENT_NAME="code-review-console"

###############################################################################
# 1. Utilidades
###############################################################################

log_info() {
  echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
  echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
  echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
  echo -e "${RED}❌ $1${NC}"
}

###############################################################################
# 2. Variables globales
###############################################################################

AI_REVIEW_DISABLED="${AI_CODE_REVIEW_DISABLED:-false}"
AI_MODEL="${AI_CODE_REVIEW_MODEL:-claude-haiku-4.5}"
CURRENT_BRANCH=""
REMOTE_BRANCH=""
COPILOT_TIMEOUT="${COPILOT_TIMEOUT:-300}"  # Timeout en segundos para copilot CLI (5 minutos por defecto)

###############################################################################
# 3. Verificar si hay cambios staged para commit
###############################################################################

check_for_changes() {
  # Verificar si hay archivos staged (en el index de git)
  if ! git diff --cached --quiet 2>/dev/null; then
    return 0  # Hay cambios staged
  else
    return 1  # No hay cambios staged
  fi
}

###############################################################################
# 4. Obtener archivos staged
###############################################################################

get_modified_files() {
  # Obtener archivos staged (cached) comparado con HEAD
  # Solo archivos .cs en src/ y tests/ — excluye ficheros auto-generados
  git diff --cached --name-only 2>/dev/null | \
    grep -E '\.cs$' | \
    grep -v 'Migrations/' | \
    grep -v '\.Designer\.cs$' | \
    grep -v '/Reference\.cs$' | \
    grep -v 'GlobalUsings\.cs$' | \
    grep -E '^(src|tests)/' | \
    sort -u || true
}

###############################################################################
# 5. Verificar si copilot está disponible y autenticado
###############################################################################

check_copilot_auth() {
  # Verificar si el comando existe
  if ! command -v copilot &>/dev/null; then
    log_error "Copilot CLI no está instalado"
    echo ""
    echo "El CLI 'copilot' forma parte de VS Code (extensión GitHub Copilot)."
    echo "Asegúrate de que VS Code está en el PATH del sistema:"
    echo "  Windows: Paleta de comandos → 'Shell Command: Install code in PATH'"
    echo "Luego verifica con: copilot --version"
    exit 1
  fi

  # Verificar si está autenticado (intentar ejecutar comando simple con timeout)
  log_info "Verificando autenticación de Copilot..."
  local auth_check
  auth_check=$(timeout 5 copilot --version 2>&1)
  local auth_exit=$?

  if [ $auth_exit -eq 124 ]; then
    log_error "Timeout verificando autenticación de Copilot (>5s)"
    echo ""
    echo "El CLI de Copilot no responde. Verifica:"
    echo "  1. Tu conexión de internet"
    echo "  2. Que estés autenticado: copilot"
    echo "  3. Luego usa: /login"
    exit 1
  fi

  if [ $auth_exit -ne 0 ]; then
    log_error "Copilot no está autenticado o hay error"
    echo ""
    echo "Autentica con:"
    echo "  copilot"
    echo "  /login"
    exit 1
  fi

  log_success "Copilot CLI verificado: $auth_check"
}

###############################################################################
# 6. Ejecutar revisión de código (con timeout)
###############################################################################

run_code_review() {
  local files="$1"
  
  if [ -z "$files" ]; then
    log_warning "No hay archivos para revisar"
    return 0
  fi

  log_info "Ejecutando revisión con GitHub Copilot CLI (agente: $AGENT_NAME)..."
  
  # Construir el prompt - SOLO pasa los archivos a revisar
  # Las instrucciones del agente vienen de .github/agents/code-review-console.agent.md
  local prompt="REVISA ESTOS ARCHIVOS AHORA:

$files"
  
  log_info "Enviando archivos a copilot para revisión (timeout: ${COPILOT_TIMEOUT}s)..."
  
  # Ejecutar copilot con timeout
  # Si excede COPILOT_TIMEOUT segundos, terminará el proceso
  local response
  response=$(timeout ${COPILOT_TIMEOUT} copilot -p "$prompt" --agent "$AGENT_NAME" --model "$AI_MODEL" --allow-all-tools 2>&1)
  local exit_code=$?
  
  # Detectar timeout
  if [ $exit_code -eq 124 ]; then
    local timeout_minutes=$((COPILOT_TIMEOUT / 60))
    log_error "TIMEOUT: Copilot tardó más de ${timeout_minutes} minutos (${COPILOT_TIMEOUT}s) en responder"
    echo ""
    echo "Posibles causas:"
    echo "  • Servidor de Copilot está congestionado"
    echo "  • Conexión de internet inestable"
    echo "  • Agente tardando en procesar"
    echo ""
    echo "Soluciones:"
    echo "  1. Intenta de nuevo: bash scripts/ai-review.sh"
    echo "  2. Aumenta timeout (10 min): COPILOT_TIMEOUT=600 bash scripts/ai-review.sh"
    echo "  3. Bypass temporal: AI_CODE_REVIEW_DISABLED=true git commit -m \"msg\""
    return 1
  fi
  
  if [ $exit_code -ne 0 ]; then
    log_error "Copilot falló con exit code: $exit_code"
    echo ""
    echo "════════════════════════════════════════════════════════"
    echo "OUTPUT COMPLETO DEL ERROR:"
    echo "════════════════════════════════════════════════════════"
    echo "$response"
    echo "════════════════════════════════════════════════════════"
    return 1
  fi
  
  # Guardar la respuesta completa
  echo "$response"
}

###############################################################################
# 7. Parsear el estado de aprobación
###############################################################################

parse_approval_status() {
  local response="$1"
  
  # Validar que la respuesta no esté vacía
  if [ -z "$response" ]; then
    return 1  # No aprobado (respuesta vacía)
  fi
  
  # Buscar APPROVAL_STATUS en la respuesta (puede tener asteriscos de markdown)
  if echo "$response" | grep -qE "APPROVAL_STATUS:\s*\*{0,2}true\*{0,2}"; then
    return 0  # Aprobado
  else
    return 1  # No aprobado
  fi
}

###############################################################################
# 8. Extraer motivo del rechazo
###############################################################################

extract_rejection_reason() {
  local response="$1"
  
  # Buscar sección de problemas o motivos
  echo "$response" | grep -A 50 "APPROVAL_STATUS" | head -30
}

###############################################################################
# 8. MAIN - Flujo principal
###############################################################################

main() {
  echo -e ""
  log_info "AI Code Review - GitHub Copilot (Pre-Commit)"
  echo -e ""

  # Verificar si está deshabilitado
  if [ "$AI_REVIEW_DISABLED" = "true" ]; then
    log_warning "AI Code Review está deshabilitado (AI_CODE_REVIEW_DISABLED=true)"
    return 0
  fi

  # Verificar autenticación
  check_copilot_auth

  # Verificar si hay cambios staged
  if ! check_for_changes; then
    log_info "No hay cambios staged para revisar"
    return 0
  fi

  # Obtener archivos modificados
  local files=$(get_modified_files)
  
  if [ -z "$files" ]; then
    log_info "No hay archivos elegibles para revisar"
    return 0
  fi

  # Mostrar archivos a revisar
  echo -e "📁 Archivos a revisar:"
  echo "$files" | while read -r file; do
    echo -e "   - $file"
  done
  echo -e ""

  # Ejecutar revisión
  local response=$(run_code_review "$files")
  local review_exit=$?
  
  if [ $review_exit -ne 0 ]; then
    log_error "Error ejecutando revisión (exit code: $review_exit):"
    echo -e ""
    echo -e "════════════════════════════════════════════════════════"
    echo -e "$response"
    echo -e "════════════════════════════════════════════════════════"
    return 1
  fi
  
  # Validar que recibimos respuesta
  if [ -z "$response" ]; then
    log_error "Copilot devolvió respuesta vacía"
    echo ""
    echo "El agente de revisión no envió respuesta. Intenta:"
    echo "  1. Ejecutar de nuevo: bash scripts/ai-review.sh"
    echo "  2. Aumentar timeout: COPILOT_TIMEOUT=600 bash scripts/ai-review.sh"
    echo "  3. Verificar autenticación: copilot /login"
    return 1
  fi
  
  echo -e "📋 Respuesta del revisor:"
  echo -e ""
  echo -e "════════════════════════════════════════════════════════"
  echo -e "$response"
  echo -e "════════════════════════════════════════════════════════"
  echo -e ""

  # Parsear resultado
  if parse_approval_status "$response"; then
    log_success "Revisión aprobada - Commit permitido"
    return 0
  else
    log_error "Revisión rechazada - Commit bloqueado"
    echo -e ""
    echo -e "╔════════════════════════════════════════════════════════╗"
    echo -e "║            MOTIVO DEL RECHAZO                         ║"
    echo -e "╚════════════════════════════════════════════════════════╝"
    echo -e ""
    local reason=$(extract_rejection_reason "$response")
    if [ -n "$reason" ]; then
      echo -e "$reason"
    else
      echo -e "⚠️  La respuesta del agente no contiene motivo explícito."
      echo -e "⚠️  Verifica que el agente enviló respuesta correcta."
    fi
    echo -e ""
    echo -e "╔════════════════════════════════════════════════════════╗"
    echo -e "║            OPCIONES:                                   ║"
    echo -e "║  1. Ejecutar de nuevo:                                 ║"
    echo -e "║     bash scripts/ai-review.sh                          ║"
    echo -e "║  2. Con timeout aumentado (10 min):                    ║"
    echo -e "║     COPILOT_TIMEOUT=600 bash scripts/ai-review.sh      ║"
    echo -e "║  3. Omitir temporalmente:                              ║"
    echo -e "║     ${YELLOW}AI_CODE_REVIEW_DISABLED=true git commit${NC}              ║"
    echo -e "╚════════════════════════════════════════════════════════╝"
    return 1
  fi
}

# Ejecutar main
main
