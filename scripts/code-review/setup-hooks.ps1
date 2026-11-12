###############################################################################
# setup-hooks.ps1 — Configura git hooks para el proyecto .NET 10 Backend
#
# Ejecutar UNA VEZ al clonar el repositorio (PowerShell):
#   .\scripts\setup-hooks.ps1
#
# Equivalente bash (macOS/Linux/Git Bash):
#   bash scripts/setup-hooks.sh
###############################################################################

$ErrorActionPreference = "Stop"

$ScriptDir    = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot  = Split-Path -Parent $ScriptDir
$HooksDir     = Join-Path $ProjectRoot ".githooks"

Write-Host ""
Write-Host "🔧 Configurando git hooks — .NET 10 Backend" -ForegroundColor Cyan
Write-Host ""

# 1. Verificar que estamos en un repositorio git
try {
    git -C $ProjectRoot rev-parse --git-dir | Out-Null
} catch {
    Write-Host "❌ No se encontró un repositorio git en $ProjectRoot" -ForegroundColor Red
    exit 1
}

# 2. Verificar que el directorio .githooks existe
if (-not (Test-Path $HooksDir)) {
    Write-Host "❌ Directorio .githooks no encontrado en $ProjectRoot" -ForegroundColor Red
    exit 1
}

# 3. Configurar git para usar .githooks como directorio de hooks
Push-Location $ProjectRoot
git config core.hooksPath .githooks
Pop-Location
Write-Host "✅ git config core.hooksPath .githooks" -ForegroundColor Green

# 4. Marcar los scripts como ejecutables en git (para que funcionen en bash/Linux)
$PreCommit = Join-Path $HooksDir "pre-commit"
$AiReview  = Join-Path $ScriptDir "ai-review.sh"

if (Test-Path $PreCommit) {
    git -C $ProjectRoot update-index --chmod=+x ".githooks/pre-commit"
    Write-Host "✅ Permisos +x registrados en git: .githooks/pre-commit" -ForegroundColor Green
}

if (Test-Path $AiReview) {
    git -C $ProjectRoot update-index --chmod=+x "scripts/ai-review.sh"
    Write-Host "✅ Permisos +x registrados en git: scripts/ai-review.sh" -ForegroundColor Green
}

# 5. Verificar copilot CLI
Write-Host ""
Write-Host "🔍 Verificando prerequisitos..." -ForegroundColor Cyan

# El CLI puede registrarse como 'copilot' o 'github-copilot' según la versión
$copilotCmd = Get-Command copilot -ErrorAction SilentlyContinue
if (-not $copilotCmd) {
    $copilotCmd = Get-Command github-copilot -ErrorAction SilentlyContinue
}

if ($copilotCmd) {
    try {
        $copilotVersion = & $copilotCmd.Name --version 2>&1
        Write-Host "✅ Copilot CLI disponible ($($copilotCmd.Name)): $copilotVersion" -ForegroundColor Green
    } catch {
        Write-Host "✅ Copilot CLI encontrado en: $($copilotCmd.Source)" -ForegroundColor Green
    }
} else {
    Write-Host "⚠️  Copilot CLI no encontrado en el PATH" -ForegroundColor Yellow
    Write-Host "   El CLI 'copilot' es el GitHub Copilot CLI con soporte de agentes." -ForegroundColor Yellow
    Write-Host "   Si ya lo tienes instalado, añade su ubicación al PATH del sistema." -ForegroundColor Yellow
    Write-Host "   Verifica con: Get-Command copilot" -ForegroundColor Yellow
}

# 6. Verificar Git Bash (necesario para ejecutar el hook bash en Windows)
$gitBashPath = $null

# Intento 1: bash ya está en PATH (p.ej. si se ejecuta desde Git Bash embebido)
$bashInPath = Get-Command bash -ErrorAction SilentlyContinue
if ($bashInPath) {
    $gitBashPath = $bashInPath.Source
}

# Intento 2: rutas estandar de Git for Windows (sistema y usuario)
if (-not $gitBashPath) {
    $candidates = @(
        "$env:LOCALAPPDATA\Programs\Git\bin\bash.exe",
        "$env:ProgramFiles\Git\bin\bash.exe",
        "${env:ProgramFiles(x86)}\Git\bin\bash.exe"
    )
    $gitBashPath = $candidates | Where-Object { Test-Path $_ } | Select-Object -First 1
}

if ($gitBashPath) {
    Write-Host "✅ Git Bash encontrado: $gitBashPath" -ForegroundColor Green
} else {
    Write-Host "⚠️  Git Bash no encontrado" -ForegroundColor Yellow
    Write-Host "   Los hooks bash requieren Git for Windows instalado" -ForegroundColor Yellow
    Write-Host "   Descarga: https://git-scm.com/download/win" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "✅ Setup completado. El hook pre-commit está activo." -ForegroundColor Green
Write-Host ""
Write-Host "Variables de entorno útiles (PowerShell):" -ForegroundColor Cyan
Write-Host '  $env:AI_CODE_REVIEW_DISABLED="true"  → Salta la revisión una vez'
Write-Host '  $env:AI_CODE_REVIEW_MODEL="..."       → Cambia el modelo (por defecto: claude-haiku-4.5)'
Write-Host '  $env:COPILOT_TIMEOUT="600"            → Aumenta el timeout a 10 min'
Write-Host ""
Write-Host "Ejemplo de bypass puntual:" -ForegroundColor Cyan
Write-Host '  $env:AI_CODE_REVIEW_DISABLED="true"; git commit -m "msg"; Remove-Item Env:\AI_CODE_REVIEW_DISABLED'
Write-Host "════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""
