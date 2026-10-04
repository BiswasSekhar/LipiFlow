param(
  [int]$DelayMilliseconds = 1000,
  [int]$Limit = 0
)

$ErrorActionPreference = 'Stop'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$origin = 'https://www.malayalamfont.com'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$outputDirectory = Join-Path $root 'data/imports'
New-Item -ItemType Directory -Force -Path $outputDirectory | Out-Null

function Convert-HtmlText([string]$html) {
  $withoutTags = [regex]::Replace($html, '<script\b[^>]*>.*?</script>|<style\b[^>]*>.*?</style>', ' ', 'IgnoreCase,Singleline')
  $withoutTags = [regex]::Replace($withoutTags, '<[^>]+>', ' ')
  $decoded = [System.Net.WebUtility]::HtmlDecode($withoutTags)
  $decoded = $decoded.Replace([string][char]0, '')
  return [regex]::Replace($decoded, '\s+', ' ').Trim()
}

function Get-DetailValue([string]$text, [string]$label, [string[]]$nextLabels) {
  $next = ($nextLabels | ForEach-Object { [regex]::Escape($_) }) -join '|'
  $pattern = '(?is)\b' + [regex]::Escape($label) + '\s*:\s*(?:\|\s*)?(.+?)(?=\s+\b(?:' + $next + ')(?:\s*:\s*(?:\|\s*)?)?|$)'
  $match = [regex]::Match($text, $pattern)
  if ($match.Success) { return $match.Groups[1].Value.Trim([char[]]@(' ', '|')) }
  return ''
}

$robots = Invoke-WebRequest -UseBasicParsing -Uri "$origin/robots.txt" -TimeoutSec 30
if ($robots.StatusCode -ne 200) { throw 'Could not read robots.txt; stopping the catalogue import.' }
$ourRobotGroup = @($robots.Content -split '(?m)(?=^User-agent:)' | Where-Object {
  $_ -match '(?im)^User-agent:\s*(?:\*|LipiFlow)\s*$'
}) -join "`n"
if ($ourRobotGroup -match '(?im)^Disallow:\s*/(?:download\.php|catetory\.php|)\s*$') {
  throw 'robots.txt disallows this catalogue path; stopping the import.'
}

$sitemapResponse = Invoke-WebRequest -UseBasicParsing -Uri "$origin/sitemap.php" -TimeoutSec 30
[xml]$sitemap = $sitemapResponse.Content
$pages = @($sitemap.urlset.url | ForEach-Object { [string]$_.loc } | Where-Object {
  $_ -match '^https://www\.malayalamfont\.com/download\.php\?id=\d+$'
} | Sort-Object -Unique)
if ($pages.Count -eq 0) { throw 'The sitemap did not contain font detail pages.' }
if ($Limit -gt 0) { $pages = @($pages | Select-Object -First $Limit) }

$records = [System.Collections.Generic.List[object]]::new()
$failures = [System.Collections.Generic.List[string]]::new()
$index = 0
foreach ($pageUrl in $pages) {
  $index++
  if ($index -gt 1) { Start-Sleep -Milliseconds ([Math]::Max(500, $DelayMilliseconds)) }
  $idMatch = [regex]::Match($pageUrl, 'id=(\d+)$')
  if (!$idMatch.Success) { continue }
  $sourceNumericId = $idMatch.Groups[1].Value
  $response = $null
  for ($attempt = 1; $attempt -le 3; $attempt++) {
    try {
      $response = Invoke-WebRequest -UseBasicParsing -Uri $pageUrl -TimeoutSec 30 -Headers @{
        'User-Agent' = 'LipiFlow source-catalogue metadata importer'
      }
      if ($response.StatusCode -eq 200) { break }
    } catch {
      if ($attempt -eq 3) { $failures.Add("$sourceNumericId`t$($_.Exception.Message)") }
      else { Start-Sleep -Seconds (2 * $attempt) }
    }
  }
  if (!$response -or $response.StatusCode -ne 200) { continue }

  $titleMatch = [regex]::Match($response.Content, '(?is)<title\b[^>]*>(.*?)</title>')
  if (!$titleMatch.Success) {
    $failures.Add("$sourceNumericId`tMissing page title")
    continue
  }
  $title = [System.Net.WebUtility]::HtmlDecode([regex]::Replace($titleMatch.Groups[1].Value, '<[^>]+>', ' ')).Trim()
  $name = [regex]::Replace($title, '\s+Malayalam\s+Font\s*-\s*Free\s+Download\s+From\s+\d+\s*$', '', 'IgnoreCase').Trim()
  if (!$name -or $name -eq $title) {
    $name = [regex]::Replace($title, '\s*-\s*Free\s+Download\s+From\s+\d+\s*$', '', 'IgnoreCase').Trim()
  }
  $plain = Convert-HtmlText $response.Content
  $categoryMatch = [regex]::Match($title, '\bFrom\s+(\d+)\s*$', 'IgnoreCase')
  $categoryCode = if ($categoryMatch.Success) { $categoryMatch.Groups[1].Value } else { '' }
  $category, $encoding = switch ($categoryCode) {
    '180' { 'Unicode'; 'Unicode'; break }
    '181' { 'General'; 'Other'; break }
    '182' { 'ML'; 'ML-TT'; break }
    '183' { 'FML'; 'FML'; break }
    default { "Other ($categoryCode)"; 'Other' }
  }
  $family = Get-DetailValue $plain 'Font Family' @('Font Subfamily','Font Identifier','Full Name','Version','Postscript Name','Copyright','How to install')
  $variant = Get-DetailValue $plain 'Font Subfamily' @('Font Identifier','Full Name','Version','Postscript Name','Copyright','How to install')
  $copyright = Get-DetailValue $plain 'Copyright' @('How to install','Random Fonts','Most Downloaded')
  if ($copyright.Length -gt 2000) { $copyright = $copyright.Substring(0, 2000) }

  $licence = 'Not listed'
  $licencePatterns = @(
    'SIL Open Font License(?:\s+(?:Version|v)?\s*[0-9.]+)?',
    'GNU GPL(?:\s+(?:V\.?\s*)?[0-9.]+(?:\s+or\s+later)?(?:\s+\(with\s+Font\s+Exception\))?)?',
    'GPL\s+V\.?\s*[0-9.]+(?:\s+or\s+later)?(?:\s+\(with\s+Font\s+Exception\))?',
    'Licensed\s+under\s+GPL(?:\s+V\.?\s*[0-9.]+)?',
    'public domain',
    'free for non[- ]commercial use',
    'free for commercial use',
    'licensed under\s+[^.;]{2,80}'
  )
  foreach ($licencePattern in $licencePatterns) {
    $licenceMatch = [regex]::Match($plain, $licencePattern, 'IgnoreCase')
    if ($licenceMatch.Success) { $licence = $licenceMatch.Value.Trim(); break }
  }
  if ($licence -eq 'Not listed' -and $plain -match '(?i)personaly\s+feel\s+free\s+to\s+use|personally\s+feel\s+free\s+to\s+use') {
    $licence = 'Personal use described; commercial terms unclear'
  }
  if ($licence.Length -gt 160) { $licence = $licence.Substring(0, 160) }
  $records.Add([pscustomobject]@{
    sourceId = "malayalamfont-$sourceNumericId"
    sourceNumericId = [int]$sourceNumericId
    name = $name
    family = $family
    variant = $variant
    sourceCategory = $category
    encoding = $encoding
    sourceUrl = $pageUrl
    reportedLicence = $licence
    copyrightText = $copyright
    rightsStatus = 'unverified'
    assetStored = $false
  })
  if (($index % 50) -eq 0) { Write-Output "Read $index of $($pages.Count) source pages; retained $($records.Count) records." }
}

$csvPath = Join-Path $outputDirectory 'malayalamfont.com-font-catalog.csv'
$failurePath = Join-Path $outputDirectory 'malayalamfont.com-font-catalog-failures.tsv'
$records | Export-Csv -Path $csvPath -NoTypeInformation -Encoding UTF8
& (Join-Path $PSScriptRoot 'build-malayalamfont-catalog-sql.ps1') -CsvPath $csvPath
if ($failures.Count) { $failures | Set-Content -Path $failurePath -Encoding UTF8 }
elseif (Test-Path $failurePath) { Remove-Item -LiteralPath $failurePath }

Write-Output "Complete: $($records.Count) catalogue records, $($failures.Count) failed pages."
Write-Output "CSV: $csvPath"
