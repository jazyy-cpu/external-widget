[CmdletBinding()]
param()

# Builds irs-project-rest-0.1.0.jar INSIDE THE VM. It cannot run on the host:
# every compile reference is a platform file under C:\DassaultSystemes and
# C:\dev\jar-analysis\input.
#
# Adapted from C:\dev\jar-creation\irs-hello-rest\build.ps1, which is the
# proven script (technical note 2026-09-22). Four things are deliberate and
# must not be "simplified" away:
#
#   1 the project-root check, so a mistyped path cannot wipe another project's
#     build folder;
#   2 the BOM-free staging copies - the guarded VM writer produces UTF-8 WITH a
#     BOM and javac rejects it as an illegal character at the start of a file;
#   3 the entry check, so a silent packaging failure cannot be deployed;
#   4 the no-platform-classes check - bundling jakarta, matrix or DS classes
#     causes provider and class-loader conflicts that look like random 404s.

$ErrorActionPreference = 'Stop'
$projectRoot = [System.IO.Path]::GetFullPath($PSScriptRoot)
$expectedRoot = 'C:\dev\jar-creation\irs-project-rest'
if (-not $projectRoot.Equals($expectedRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "Safety check failed: expected project root '$expectedRoot', got '$projectRoot'."
}

$sourceRoot = Join-Path $projectRoot 'src\main\java'
$sourceManifest = Join-Path $projectRoot 'MANIFEST.MF'
$buildRoot = Join-Path $projectRoot 'build'
$stagedSourceRoot = Join-Path $buildRoot 'generated-sources'
$classesRoot = Join-Path $buildRoot 'classes'
$stagedManifest = Join-Path $buildRoot 'MANIFEST.MF'
$distRoot = Join-Path $projectRoot 'dist'
$outputJar = Join-Path $distRoot 'irs-project-rest-0.1.0.jar'

$references = @(
    'C:\DassaultSystemes\TomEE\3DSpaceCas\apache-tomee-plus-9.1.2\lib\jakartaee-api-9.1.1-tomcat.jar',
    'C:\DassaultSystemes\TomEE\3DSpaceCas\apache-tomee-plus-9.1.2\lib\servlet-api.jar',
    'C:\dev\jar-analysis\input\RestServicesInfra.jar',
    'C:\dev\jar-analysis\input\eMatrixServletRMI.jar',
    # not needed by the hello service, but this one calls the framework:
    # DomainObject, DomainConstants, MapList, PropertyUtil
    'C:\DassaultSystemes\R2024x\3DSpace\distrib_CAS\3dspace\WEB-INF\lib\xerinfra.jar'
)

foreach ($reference in $references) {
    if (-not (Test-Path -LiteralPath $reference -PathType Leaf)) {
        throw "Required compile reference not found: $reference"
    }
}
if (-not (Test-Path -LiteralPath $sourceManifest -PathType Leaf)) {
    throw "Manifest not found: $sourceManifest"
}

$javac = (Get-Command javac.exe -ErrorAction Stop).Source
$jarTool = (Get-Command jar.exe -ErrorAction Stop).Source
$sources = @(Get-ChildItem -LiteralPath $sourceRoot -Filter '*.java' -File -Recurse | Sort-Object FullName)
if ($sources.Count -eq 0) {
    throw "No Java sources found below $sourceRoot"
}

if (Test-Path -LiteralPath $buildRoot) {
    Remove-Item -LiteralPath $buildRoot -Recurse -Force
}
New-Item -ItemType Directory -Path $stagedSourceRoot -Force | Out-Null
New-Item -ItemType Directory -Path $classesRoot -Force | Out-Null
New-Item -ItemType Directory -Path $distRoot -Force | Out-Null
if (Test-Path -LiteralPath $outputJar) {
    Remove-Item -LiteralPath $outputJar -Force
}

$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
$stagedSources = foreach ($source in $sources) {
    $relative = $source.FullName.Substring($sourceRoot.Length).TrimStart('\')
    $stagedPath = Join-Path $stagedSourceRoot $relative
    $stagedParent = Split-Path -Parent $stagedPath
    New-Item -ItemType Directory -Path $stagedParent -Force | Out-Null
    $text = [System.IO.File]::ReadAllText($source.FullName)
    [System.IO.File]::WriteAllText($stagedPath, $text, $utf8NoBom)
    $stagedPath
}
$manifestText = [System.IO.File]::ReadAllText($sourceManifest)
[System.IO.File]::WriteAllText($stagedManifest, $manifestText, $utf8NoBom)

$classPath = $references -join ';'
& $javac --release 17 -encoding UTF-8 -Xlint:all -classpath $classPath -d $classesRoot @stagedSources
if ($LASTEXITCODE -ne 0) {
    throw "javac failed with exit code $LASTEXITCODE"
}

& $jarTool --create --file $outputJar --manifest $stagedManifest -C $classesRoot .
if ($LASTEXITCODE -ne 0) {
    throw "jar failed with exit code $LASTEXITCODE"
}

$jarEntries = @(& $jarTool --list --file $outputJar)
if ($LASTEXITCODE -ne 0) {
    throw "jar verification failed with exit code $LASTEXITCODE"
}
$requiredEntries = @(
    'com/irclass/platform/rest/project/IrsProjectModeler.class',
    'com/irclass/platform/rest/project/ProjectContextService.class',
    'com/irclass/platform/rest/project/ProjectContextReader.class',
    'com/irclass/platform/rest/project/JsonValues.class'
)
foreach ($entry in $requiredEntries) {
    if ($jarEntries -notcontains $entry) {
        throw "JAR is missing required entry: $entry"
    }
}
$forbidden = @($jarEntries | Where-Object {
    $_ -like 'jakarta/*' -or $_ -like 'javax/*' -or $_ -like 'matrix/*' -or $_ -like 'com/dassault_systemes/*' -or $_ -like 'com/matrixone/*'
})
if ($forbidden.Count -gt 0) {
    throw "JAR contains platform classes, which must stay compile-only: $($forbidden -join ', ')"
}

$artifact = Get-Item -LiteralPath $outputJar
$hash = Get-FileHash -LiteralPath $outputJar -Algorithm SHA256
[pscustomobject]@{
    Jar = $artifact.FullName
    Bytes = $artifact.Length
    SHA256 = $hash.Hash
    JavaCompiler = (& $javac -version 2>&1 | Out-String).Trim()
    Entries = $jarEntries -join ', '
} | Format-List
