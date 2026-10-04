param(
  [string]$CsvPath = (Join-Path $PSScriptRoot '..\data\imports\malayalamfont.com-font-catalog.csv')
)

$ErrorActionPreference = 'Stop'
$resolvedCsv = (Resolve-Path $CsvPath).Path
$records = @(Import-Csv -Path $resolvedCsv)
if (!$records.Count) { throw 'The source catalogue CSV is empty.' }

function Quote-Sql([string]$value) {
  if ($null -eq $value) { return "''" }
  return "'" + $value.Replace("'", "''") + "'"
}

$stamp = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
$sql = [System.Collections.Generic.List[string]]::new()
foreach ($record in $records) {
  $numericId = 0
  if (![int]::TryParse($record.sourceNumericId, [ref]$numericId) -or $numericId -lt 1) {
    throw "Invalid source font id: $($record.sourceNumericId)"
  }
  $expectedId = "malayalamfont-$numericId"
  $expectedUrl = "https://www.malayalamfont.com/download.php?id=$numericId"
  if ($record.sourceId -ne $expectedId -or $record.sourceUrl -ne $expectedUrl -or !$record.name) {
    throw "Invalid source record for id $numericId."
  }
  $values = @(
    (Quote-Sql $expectedId),
    "$numericId",
    (Quote-Sql $record.name),
    (Quote-Sql $record.family),
    (Quote-Sql $record.variant),
    (Quote-Sql $record.sourceCategory),
    (Quote-Sql $record.encoding),
    (Quote-Sql $expectedUrl),
    (Quote-Sql $record.reportedLicence),
    (Quote-Sql $record.copyrightText),
    "'unverified'",
    '0',
    "$stamp"
  ) -join ', '
  $sql.Add("INSERT INTO externalFontSources(sourceId,sourceNumericId,name,family,variant,sourceCategory,encoding,sourceUrl,reportedLicence,copyrightText,rightsStatus,assetStored,importedAt) VALUES($values) ON CONFLICT(sourceId) DO UPDATE SET sourceNumericId=excluded.sourceNumericId,name=excluded.name,family=excluded.family,variant=excluded.variant,sourceCategory=excluded.sourceCategory,encoding=excluded.encoding,sourceUrl=excluded.sourceUrl,reportedLicence=excluded.reportedLicence,copyrightText=excluded.copyrightText,importedAt=excluded.importedAt;")
}

$sqlPath = Join-Path (Split-Path $resolvedCsv -Parent) 'malayalamfont.com-font-catalog.sql'
[System.IO.File]::WriteAllText($sqlPath, ($sql -join [Environment]::NewLine), [System.Text.UTF8Encoding]::new($false))
Write-Output "Generated $($sql.Count) idempotent D1 inserts at $sqlPath"
