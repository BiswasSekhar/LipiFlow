param(
  [string]$LocalFonts = (Join-Path $PSScriptRoot '..\font-files'),
  [string]$SourceCsv = (Join-Path $PSScriptRoot '..\data\imports\malayalamfont.com-font-catalog.csv')
)

$ErrorActionPreference = 'Stop'
$fontRoot = (Resolve-Path $LocalFonts).Path
$sources = @(Import-Csv -Path (Resolve-Path $SourceCsv).Path)
$fontDirectories = @(
  $fontRoot,
  (Join-Path $PSScriptRoot '..\apps\web\public\fonts'),
  (Join-Path $PSScriptRoot '..\tests\fixtures')
) | ForEach-Object { (Resolve-Path $_).Path } | Select-Object -Unique
$fontFiles = @($fontDirectories | ForEach-Object {
  Get-ChildItem -LiteralPath $_ -Recurse -File | Where-Object { $_.Extension -match '^\.(ttf|otf|woff2?)$' }
})

function Read-U16BE([byte[]]$Bytes, [int]$Offset) {
  return ([int]$Bytes[$Offset] * 256) + [int]$Bytes[$Offset + 1]
}

function Read-U32BE([byte[]]$Bytes, [int]$Offset) {
  return ([long]$Bytes[$Offset] * 16777216) + ([long]$Bytes[$Offset + 1] * 65536) + ([long]$Bytes[$Offset + 2] * 256) + [long]$Bytes[$Offset + 3]
}

function Normalize-Name([string]$Value) {
  if (!$Value) { return '' }
  return [regex]::Replace($Value.ToLowerInvariant(), '[^a-z0-9]', '')
}

function Normalize-Style([string]$Value) {
  $normalized = Normalize-Name $Value
  if ($normalized -in @('normal','book','plain','roman')) { return 'regular' }
  return $normalized
}

function Normalize-Family([string]$Value) {
  $normalized = Normalize-Name $Value
    $normalized = [regex]::Replace($normalized, '^(?:fmltt|fml|mlwtt|mlw|mltt|mlu|ml|tt)', '')
  $normalized = [regex]::Replace($normalized, '(?:bolditalic|italicbold|semibolditalic|bold|italic|regular|normal|book|plain|roman|medium|light|semilight|semibold|heavy|black|thin|condensed|narrow|expanded)+$', '')
  return $normalized
}

function Get-FontNames([System.IO.FileInfo]$File) {
  $bytes = [System.IO.File]::ReadAllBytes($File.FullName)
  $tableCount = if ($bytes.Length -ge 12) { Read-U16BE $bytes 4 } else { 0 }
  $nameOffset = -1
  $nameLength = 0
  for ($index = 0; $index -lt $tableCount; $index++) {
    $directoryEntry = 12 + 16 * $index
    if ($directoryEntry + 16 -gt $bytes.Length) { break }
    if ([System.Text.Encoding]::ASCII.GetString($bytes, $directoryEntry, 4) -eq 'name') {
      $nameOffset = [int](Read-U32BE $bytes ($directoryEntry + 8))
      $nameLength = [int](Read-U32BE $bytes ($directoryEntry + 12))
      break
    }
  }
  $result = @{ 1 = ''; 2 = ''; 4 = ''; 6 = ''; 16 = ''; 17 = '' }
  if ($nameOffset -lt 0 -or $nameOffset + $nameLength -gt $bytes.Length -or $nameLength -lt 6) {
    return [pscustomobject]@{ Family = ''; Variant = ''; FullName = ''; PostScriptName = '' }
  }
  $recordCount = Read-U16BE $bytes ($nameOffset + 2)
  $stringsOffset = Read-U16BE $bytes ($nameOffset + 4)
  $candidates = @{}
  for ($recordIndex = 0; $recordIndex -lt $recordCount; $recordIndex++) {
    $recordOffset = $nameOffset + 6 + 12 * $recordIndex
    if ($recordOffset + 12 -gt $nameOffset + $nameLength) { break }
    $platform = Read-U16BE $bytes $recordOffset
    $language = Read-U16BE $bytes ($recordOffset + 4)
    $nameId = Read-U16BE $bytes ($recordOffset + 6)
    $length = Read-U16BE $bytes ($recordOffset + 8)
    $relativeOffset = Read-U16BE $bytes ($recordOffset + 10)
    if (!$result.ContainsKey($nameId) -or $length -eq 0) { continue }
    $textOffset = $nameOffset + $stringsOffset + $relativeOffset
    if ($textOffset -lt $nameOffset -or $textOffset + $length -gt $nameOffset + $nameLength) { continue }
    try {
      if ($platform -eq 0 -or $platform -eq 3) {
        $text = [System.Text.Encoding]::BigEndianUnicode.GetString($bytes, $textOffset, $length)
      } else {
        $text = [System.Text.Encoding]::ASCII.GetString($bytes, $textOffset, $length)
      }
      $text = [regex]::Replace($text, '[\x00-\x1f]+', '').Trim()
      if (!$text) { continue }
      $rank = if ($platform -eq 3 -and $language -eq 1033) { 0 } elseif ($platform -eq 0) { 1 } elseif ($platform -eq 3) { 2 } else { 3 }
      if (!$candidates.ContainsKey($nameId) -or $rank -lt $candidates[$nameId].Rank) {
        $candidates[$nameId] = [pscustomobject]@{ Rank = $rank; Text = $text }
      }
    } catch {
      continue
    }
  }
  foreach ($key in @($result.Keys)) {
    if ($candidates.ContainsKey($key)) { $result[$key] = $candidates[$key].Text }
  }
  $family = if ($result[16]) { $result[16] } else { $result[1] }
  $variant = if ($result[17]) { $result[17] } else { $result[2] }
  return [pscustomobject]@{
    Family = $family
    Variant = $variant
    FullName = $result[4]
    PostScriptName = $result[6]
  }
}

$local = [System.Collections.Generic.List[object]]::new()
$fileIndex = 0
foreach ($file in $fontFiles) {
  $fileIndex++
  $names = if ($file.Extension -match '^\.(ttf|otf)$') {
    Get-FontNames $file
  } else {
    [pscustomobject]@{ Family = ''; Variant = ''; FullName = ''; PostScriptName = '' }
  }
  $encoding = if ($file.FullName -match '(?i)[\\/]FML Fonts[\\/]') {
    'FML'
  } elseif ($file.FullName -match '(?i)[\\/]ML Fonts[\\/]') {
    'ML-TT'
  } elseif ($file.FullName -match '(?i)[\\/]Unicode Fonts[\\/]|[\\/]public[\\/]fonts[\\/]|[\\/]fixtures[\\/]') {
    'Unicode'
  } else {
    'Other'
  }
  $local.Add([pscustomobject]@{
    Path = $file.FullName
    FileName = [System.IO.Path]::GetFileNameWithoutExtension($file.Name)
    Family = $names.Family
    Variant = $names.Variant
    FullName = $names.FullName
    PostScriptName = $names.PostScriptName
    Encoding = $encoding
    FamilyKey = Normalize-Family $names.Family
    StyleKey = Normalize-Style $names.Variant
  })
  if (($fileIndex % 100) -eq 0) { Write-Output "Read metadata from $fileIndex of $($fontFiles.Count) local files." }
}
$inventoryPath = Join-Path (Split-Path (Resolve-Path $SourceCsv).Path -Parent) 'local-font-files-inventory.csv'
$local | Select-Object Path,FileName,Family,Variant,FullName,PostScriptName,Encoding | Export-Csv -Path $inventoryPath -NoTypeInformation -Encoding UTF8

$rows = [System.Collections.Generic.List[object]]::new()
foreach ($source in $sources) {
  $sourceNameKey = Normalize-Name $source.name
  $sourceFamilyKey = Normalize-Family $source.family
  if (!$sourceFamilyKey) { $sourceFamilyKey = Normalize-Family $source.name }
  $sourceStyleKey = Normalize-Style $source.variant
  $sourceFullKey = Normalize-Name ($source.family + ' ' + $source.variant)
  $possible = @($local | Where-Object {
    $encodingMatches = $source.encoding -eq 'Other' -or $_.Encoding -eq 'Other' -or $_.Encoding -eq $source.encoding
    $encodingMatches -and (
      ($sourceNameKey -and (Normalize-Name $_.FileName) -eq $sourceNameKey) -or
      ($sourceNameKey -and (Normalize-Name $_.FullName) -eq $sourceNameKey) -or
      ($sourceNameKey -and (Normalize-Name $_.PostScriptName) -eq $sourceNameKey) -or
      ($sourceFullKey -and (Normalize-Name ($_.Family + ' ' + $_.Variant)) -eq $sourceFullKey) -or
      ($sourceFamilyKey -and $_.FamilyKey -eq $sourceFamilyKey)
    )
  })
  $possible = @($possible | Sort-Object Path -Unique)
  $exact = @($possible | Where-Object {
    ($sourceNameKey -and (Normalize-Name $_.FileName) -eq $sourceNameKey) -or
    ($sourceNameKey -and (Normalize-Name $_.FullName) -eq $sourceNameKey) -or
    ($sourceNameKey -and (Normalize-Name $_.PostScriptName) -eq $sourceNameKey) -or
    ($sourceFullKey -and (Normalize-Name ($_.Family + ' ' + $_.Variant)) -eq $sourceFullKey) -or
    ($sourceFamilyKey -and $_.FamilyKey -eq $sourceFamilyKey -and $sourceStyleKey -and $_.StyleKey -eq $sourceStyleKey)
  })
  $status = if ($exact.Count) { 'exact' } elseif ($possible.Count) { 'family-only' } else { 'missing' }
  $chosen = if ($exact.Count) { $exact } else { $possible }
  $paths = @($chosen | ForEach-Object { $_.Path }) -join ' | '
  $rows.Add([pscustomobject]@{
    sourceId = $source.sourceId
    sourceNumericId = $source.sourceNumericId
    name = $source.name
    family = $source.family
    variant = $source.variant
    sourceCategory = $source.sourceCategory
    encoding = $source.encoding
    matchStatus = $status
    localFiles = $paths
    sourceUrl = $source.sourceUrl
  })
}

$outputDirectory = Split-Path (Resolve-Path $SourceCsv).Path -Parent
$allPath = Join-Path $outputDirectory 'malayalamfont.com-local-font-comparison.csv'
$missingPath = Join-Path $outputDirectory 'malayalamfont.com-fonts-not-local.csv'
$matchedPath = Join-Path $outputDirectory 'malayalamfont.com-fonts-matched-local.csv'
$rows | Export-Csv -Path $allPath -NoTypeInformation -Encoding UTF8
$rows | Where-Object { $_.matchStatus -eq 'missing' } | Export-Csv -Path $missingPath -NoTypeInformation -Encoding UTF8
$rows | Where-Object { $_.matchStatus -ne 'missing' } | Export-Csv -Path $matchedPath -NoTypeInformation -Encoding UTF8

$exactCount = @($rows | Where-Object { $_.matchStatus -eq 'exact' }).Count
$familyCount = @($rows | Where-Object { $_.matchStatus -eq 'family-only' }).Count
$missingCount = @($rows | Where-Object { $_.matchStatus -eq 'missing' }).Count
Write-Output "Source entries: $($rows.Count); exact local-file matches: $exactCount; family-only matches: $familyCount; no local match: $missingCount."
Write-Output "Comparison: $allPath"
Write-Output "No local match: $missingPath"
Write-Output "Matched: $matchedPath"
Write-Output "Local font metadata inventory: $inventoryPath"
