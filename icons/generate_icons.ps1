# Native PowerShell script to generate Chrome Extension icons using .NET Drawing
Add-Type -AssemblyName System.Drawing

function CreateIcon([int]$size, [string]$path) {
    # Create Bitmap and Graphics
    $bmp = New-Object System.Drawing.Bitmap($size, $size)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    
    # Set high quality rendering
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.Clear([System.Drawing.Color]::Transparent)
    
    # 1. Draw slate background circle
    # Hex #090d16 -> R:9, G:13, B:22
    $bgColor = [System.Drawing.Color]::FromArgb(255, 9, 13, 22)
    $bgBrush = New-Object System.Drawing.SolidBrush($bgColor)
    $g.FillEllipse($bgBrush, 1, 1, $size - 2, $size - 2)
    
    # 2. Draw border ring (indigo)
    # Hex #6366f1 -> R:99, G:102, B:241
    $borderColor = [System.Drawing.Color]::FromArgb(255, 99, 102, 241)
    $borderThickness = [Math]::Max(1.0, [float]($size * 0.08))
    $borderPen = New-Object System.Drawing.Pen($borderColor, $borderThickness)
    $borderOffset = [float]($size * 0.06)
    $borderSize = [float]($size - ($borderOffset * 2))
    $g.DrawEllipse($borderPen, $borderOffset, $borderOffset, $borderSize, $borderSize)
    
    # 3. Draw crosshairs
    # Hex #8b5cf6 -> R:139, G:92, B:246
    $crossColor = [System.Drawing.Color]::FromArgb(255, 139, 92, 246)
    $crossPen = New-Object System.Drawing.Pen($crossColor, [float]($borderThickness * 0.6))
    
    # Draw tick marks
    $tickStart = [float]($size * 0.1)
    $tickEnd = [float]($size * 0.25)
    $center = [float]($size / 2)
    
    # Top tick
    $g.DrawLine($crossPen, $center, $tickStart, $center, $tickEnd)
    # Bottom tick
    $g.DrawLine($crossPen, $center, [float]($size - $tickStart), $center, [float]($size - $tickEnd))
    # Left tick
    $g.DrawLine($crossPen, $tickStart, $center, $tickEnd, $center)
    # Right tick
    $g.DrawLine($crossPen, [float]($size - $tickStart), $center, [float]($size - $tickEnd), $center)
    
    # 4. Draw center hub (rose red)
    # Hex #fb7185 -> R:251, G:113, B:133
    $hubColor = [System.Drawing.Color]::FromArgb(255, 251, 113, 133)
    $hubBrush = New-Object System.Drawing.SolidBrush($hubColor)
    $hubSize = [float]($size * 0.18)
    $hubPos = [float]($size / 2 - $hubSize / 2)
    $g.FillEllipse($hubBrush, $hubPos, $hubPos, $hubSize, $hubSize)
    
    # Save image as PNG
    $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
    
    # Dispose objects
    $hubBrush.Dispose()
    $crossPen.Dispose()
    $borderPen.Dispose()
    $bgBrush.Dispose()
    $g.Dispose()
    $bmp.Dispose()
    
    Write-Host "Created icon: $path (${size}x${size})"
}

# Ensure icons directory exists
$iconDir = "d:\Chromeextension\icons"
if (!(Test-Path $iconDir)) {
    New-Item -ItemType Directory -Path $iconDir | Out-Null
}

# Generate PNGs
CreateIcon 16 "$iconDir\icon16.png"
CreateIcon 48 "$iconDir\icon48.png"
CreateIcon 128 "$iconDir\icon128.png"
