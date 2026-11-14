$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$sourcePath = Join-Path $root 'assets\ivory37-logo.jpg'
$source = [System.Drawing.Bitmap]::new($sourcePath)
$pixelFormat = [System.Drawing.Imaging.PixelFormat]::Format32bppArgb

function New-BrandBitmap {
    param(
        [int]$Size,
        [double]$Scale = 1,
        [System.Drawing.Color]$Background = [System.Drawing.Color]::Transparent
    )

    $bitmap = [System.Drawing.Bitmap]::new($Size, $Size, $pixelFormat)
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    try {
        $graphics.Clear($Background)
        $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
        $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
        $drawSize = [Math]::Max(1, [int][Math]::Round($Size * $Scale))
        $offset = [int][Math]::Floor(($Size - $drawSize) / 2)
        $destination = [System.Drawing.Rectangle]::new($offset, $offset, $drawSize, $drawSize)
        $graphics.DrawImage($source, $destination)
        return ,$bitmap
    } catch {
        $bitmap.Dispose()
        throw
    } finally {
        $graphics.Dispose()
    }
}

function Save-BrandPng {
    param([string]$Path, [int]$Size, [double]$Scale = 1, [System.Drawing.Color]$Background = [System.Drawing.Color]::Transparent)
    $bitmap = New-BrandBitmap -Size $Size -Scale $Scale -Background $Background
    try { $bitmap.Save($Path, [System.Drawing.Imaging.ImageFormat]::Png) }
    finally { $bitmap.Dispose() }
}

try {
    $navy = [System.Drawing.Color]::FromArgb(255, 7, 15, 29)
    Save-BrandPng -Path (Join-Path $root 'icon-192.png') -Size 192
    Save-BrandPng -Path (Join-Path $root 'icon-512.png') -Size 512
    Save-BrandPng -Path (Join-Path $root 'icon-512-maskable.png') -Size 512 -Scale 0.84 -Background $navy

    $androidRes = Join-Path $root 'android-app\app\src\main\res'
    foreach ($entry in @(
        @{ Density = 'mipmap-mdpi'; Size = 48 },
        @{ Density = 'mipmap-hdpi'; Size = 72 },
        @{ Density = 'mipmap-xhdpi'; Size = 96 },
        @{ Density = 'mipmap-xxhdpi'; Size = 144 },
        @{ Density = 'mipmap-xxxhdpi'; Size = 192 }
    )) {
        Save-BrandPng -Path (Join-Path $androidRes ($entry.Density + '\ic_launcher.png')) -Size $entry.Size
    }

    $foregroundXml = Join-Path $androidRes 'drawable\ic_launcher_foreground.xml'
    if (Test-Path -LiteralPath $foregroundXml) { Remove-Item -LiteralPath $foregroundXml -Force }
    Save-BrandPng -Path (Join-Path $androidRes 'drawable\ic_launcher_foreground.png') -Size 432 -Scale 0.64
    $androidAssets = Join-Path $root 'android-app\app\src\main\assets\assets'
    New-Item -ItemType Directory -Force -Path $androidAssets | Out-Null
    Copy-Item -LiteralPath $sourcePath -Destination (Join-Path $androidAssets 'ivory37-logo.jpg') -Force

    $desktopIcon = Join-Path $root 'desktop\assets\icon.ico'
    $sizes = @(16, 24, 32, 48, 64, 128, 256)
    $frames = [System.Collections.Generic.List[byte[]]]::new()
    foreach ($size in $sizes) {
        $bitmap = New-BrandBitmap -Size $size
        $stream = [System.IO.MemoryStream]::new()
        try {
            $bitmap.Save($stream, [System.Drawing.Imaging.ImageFormat]::Png)
            $frames.Add($stream.ToArray())
        } finally {
            $stream.Dispose()
            $bitmap.Dispose()
        }
    }

    $file = [System.IO.File]::Open($desktopIcon, [System.IO.FileMode]::Create, [System.IO.FileAccess]::Write)
    $writer = [System.IO.BinaryWriter]::new($file)
    try {
        $writer.Write([UInt16]0)
        $writer.Write([UInt16]1)
        $writer.Write([UInt16]$sizes.Count)
        $offset = 6 + (16 * $sizes.Count)
        for ($i = 0; $i -lt $sizes.Count; $i++) {
            $dimension = if ($sizes[$i] -eq 256) { [byte]0 } else { [byte]$sizes[$i] }
            $writer.Write($dimension)
            $writer.Write($dimension)
            $writer.Write([byte]0)
            $writer.Write([byte]0)
            $writer.Write([UInt16]1)
            $writer.Write([UInt16]32)
            $writer.Write([UInt32]$frames[$i].Length)
            $writer.Write([UInt32]$offset)
            $offset += $frames[$i].Length
        }
        foreach ($frame in $frames) { $writer.Write($frame) }
    } finally {
        $writer.Dispose()
        $file.Dispose()
    }
} finally {
    $source.Dispose()
}
