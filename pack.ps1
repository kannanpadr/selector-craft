# Create temporary build dir
$buildDir = "d:\Chromeextension_build"
$srcDir = "d:\Chromeextension"
$destDir = "$buildDir\extension"

if (Test-Path $buildDir) {
    Remove-Item $buildDir -Recurse -Force -ErrorAction SilentlyContinue
}
New-Item -ItemType Directory -Path $destDir | Out-Null

# Copy required extension files (excluding node_modules and E2E test files)
$files = @("manifest.json", "background.js", "content.js", "content.css", "sidepanel.html", "sidepanel.css", "sidepanel.js")
foreach ($f in $files) {
    Copy-Item "$srcDir\$f" "$destDir\$f"
}
Copy-Item "$srcDir\icons" "$destDir\icons" -Recurse | Out-Null
# Create ZIP archive of the extension folder
$zipPath = "$srcDir\chromeextension.zip"
if (Test-Path $zipPath) {
    Remove-Item $zipPath -Force -ErrorAction SilentlyContinue
}
Compress-Archive -Path "$destDir\*" -DestinationPath $zipPath -Force
Write-Host "[OK] Source zip archive generated at D:\Chromeextension\chromeextension.zip"

# Find Chrome path
$chromePaths = @(
    "C:\Program Files\Google\Chrome\Application\chrome.exe",
    "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
    "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe"
)

$chromePath = $null
foreach ($path in $chromePaths) {
    if (Test-Path $path) {
        $chromePath = $path
        break
    }
}

if ($chromePath) {
    Write-Host "Chrome found at: $chromePath"
    Write-Host "Compiling extension in subfolder..."
    
    # Run Chrome and WAIT for it to complete packaging
    $process = Start-Process -FilePath $chromePath -ArgumentList "--pack-extension=$destDir" -PassThru -Wait -NoNewWindow
    
    # Wait an extra 2 seconds to ensure Chrome has flushed file handles
    Start-Sleep -Seconds 2
    
    $crxFile = "$buildDir\extension.crx"
    $pemFile = "$buildDir\extension.pem"
    
    if (Test-Path $crxFile) {
        # Copy compiled files back to project root
        Copy-Item $crxFile "$srcDir\chrome_extension.crx" -Force
        Copy-Item $pemFile "$srcDir\chrome_extension.pem" -Force
        
        Write-Host "[OK] Packed extension successfully generated at project root:"
        Write-Host "  - D:\Chromeextension\chrome_extension.crx"
        Write-Host "  - D:\Chromeextension\chrome_extension.pem"
    } else {
        Write-Host "[ERROR] CRX compilation failed. Verify that Chrome is closed or check manifest configurations."
    }
} else {
    Write-Host "[ERROR] Google Chrome not found."
}

# Clean up build directory
if (Test-Path $buildDir) {
    Remove-Item $buildDir -Recurse -Force -ErrorAction SilentlyContinue
}
