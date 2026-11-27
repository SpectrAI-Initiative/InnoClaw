# Publish env secrets to Tencent Cloud SSM, or materialize a runtime env file.
# Credentials: TENCENTCLOUD_SECRET_ID + TENCENTCLOUD_SECRET_KEY, else Desktop\SecretKey.csv.
param(
  [Parameter(Position = 0, Mandatory = $true)][ValidateSet('publish', 'materialize', 'check')][string]$Command,
  [Parameter(Position = 1, Mandatory = $true)][string]$InputFile,
  [Parameter(Position = 2, Mandatory = $true)][string]$OutputFile,
  [Parameter(Position = 3)][string]$SecretName
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Web.Extensions
$Root = Resolve-Path (Join-Path $PSScriptRoot '..')
$Region = 'ap-shanghai'
$serializer = New-Object System.Web.Script.Serialization.JavaScriptSerializer
$serializer.MaxJsonLength = [int]::MaxValue
$SecretNames = @{
  AUTH_OIDC_CLIENT_SECRET = $true
  AUTH_SECRET = $true
  DEEPSEEK_API_KEY = $true
  EMBEDDING_API_KEY = $true
  GITHUB_TOKEN = $true
  HF_TOKEN = $true
  SCP_HUB_API_KEY = $true
  FEISHU_APP_SECRET = $true
  FEISHU_VERIFICATION_TOKEN = $true
  FEISHU_PUSH_SECRET = $true
  WECHAT_CORP_SECRET = $true
  WECHAT_TOKEN = $true
  WECHAT_ENCODING_AES_KEY = $true
}

function Resolve-RepoPath([string]$Path) {
  if ([System.IO.Path]::IsPathRooted($Path)) { return $Path }
  return [System.IO.Path]::GetFullPath((Join-Path $Root $Path))
}

function Get-CloudCredentials {
  if ($env:TENCENTCLOUD_SECRET_ID -and $env:TENCENTCLOUD_SECRET_KEY) {
    return @{ SecretId = $env:TENCENTCLOUD_SECRET_ID.Trim(); SecretKey = $env:TENCENTCLOUD_SECRET_KEY.Trim() }
  }
  $csvPath = Join-Path $env:USERPROFILE 'Desktop\SecretKey.csv'
  if (-not (Test-Path $csvPath)) { throw 'Set TENCENTCLOUD_SECRET_ID and TENCENTCLOUD_SECRET_KEY, or place SecretKey.csv on the Desktop.' }
  $row = Import-Csv $csvPath | Select-Object -First 1
  return @{ SecretId = $row.SecretId.Trim(); SecretKey = $row.SecretKey.Trim() }
}

function Get-TencentCloudSign {
  param([string]$SecretId,[string]$SecretKey,[string]$Service,[string]$HostName,[string]$Action,[string]$Version,[string]$RegionName,[string]$Payload)
  $timestamp = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds(); $date = [DateTime]::UtcNow.ToString('yyyy-MM-dd')
  $canonicalHeaders = "content-type:application/json; charset=utf-8`nhost:$HostName`n"; $signedHeaders = 'content-type;host'
  $sha256 = [System.Security.Cryptography.SHA256]::Create()
  $hashedRequestPayload = ([System.BitConverter]::ToString($sha256.ComputeHash([Text.Encoding]::UTF8.GetBytes($Payload)))).Replace('-','').ToLower()
  $canonicalRequest = "POST`n/`n`n$canonicalHeaders`n$signedHeaders`n$hashedRequestPayload"
  $credentialScope = "$date/$Service/tc3_request"
  $hashedCanonicalRequest = ([System.BitConverter]::ToString($sha256.ComputeHash([Text.Encoding]::UTF8.GetBytes($canonicalRequest)))).Replace('-','').ToLower()
  $stringToSign = "TC3-HMAC-SHA256`n$timestamp`n$credentialScope`n$hashedCanonicalRequest"
  function HmacSha256Bytes([byte[]]$key,[string]$msg){ $h=[System.Security.Cryptography.HMACSHA256]::new($key); try{$h.ComputeHash([Text.Encoding]::UTF8.GetBytes($msg))} finally{$h.Dispose()} }
  $secretDate = HmacSha256Bytes ([Text.Encoding]::UTF8.GetBytes("TC3$SecretKey")) $date
  $secretService = HmacSha256Bytes $secretDate $Service
  $secretSigning = HmacSha256Bytes $secretService 'tc3_request'
  $signature = ([System.BitConverter]::ToString((HmacSha256Bytes $secretSigning $stringToSign))).Replace('-','').ToLower()
  return @{
    'Authorization' = "TC3-HMAC-SHA256 Credential=$SecretId/$credentialScope, SignedHeaders=$signedHeaders, Signature=$signature"
    'Content-Type' = 'application/json; charset=utf-8'
    'Host' = $HostName
    'X-TC-Action' = $Action
    'X-TC-Timestamp' = "$timestamp"
    'X-TC-Version' = $Version
    'X-TC-Region' = $RegionName
  }
}

function Invoke-Ssm([hashtable]$Cred,[string]$Action,[hashtable]$Payload,[string]$RegionName) {
  $hostName = 'ssm.tencentcloudapi.com'
  $payloadStr = $serializer.Serialize($Payload)
  $headers = Get-TencentCloudSign $Cred.SecretId $Cred.SecretKey 'ssm' $hostName $Action '2019-09-23' $RegionName $payloadStr
  try {
    $raw = Invoke-WebRequest -Method POST -Uri "https://$hostName" -Headers $headers -Body ([Text.Encoding]::UTF8.GetBytes($payloadStr)) -UseBasicParsing
    $parsed = $serializer.DeserializeObject($raw.Content)
  } catch {
    $resp = $_.Exception.Response
    if (-not $resp) { throw }
    $parsed = $serializer.DeserializeObject((New-Object IO.StreamReader($resp.GetResponseStream())).ReadToEnd())
  }
  return $parsed['Response']
}

function Test-Sealable([string]$Name,[string]$Value) {
  if (-not $SecretNames.ContainsKey($Name)) { return $false }
  if (-not $Value -or $Value -eq 'none') { return $false }
  if ($Value.StartsWith('ssm:')) { return $false }
  if ($Value -match '^(sk-)?your[-_]' -or $Value -match 'change-?me' -or $Value -match '^x+$') { return $false }
  return $true
}

function Read-EnvMap([string[]]$Lines) {
  $map = @{}
  foreach ($line in $Lines) {
    if ($line -match '^([A-Za-z_][A-Za-z0-9_]*)=(.*)$') { $map[$Matches[1]] = $Matches[2] }
  }
  return $map
}

function Get-SsmHeader([string[]]$Lines) {
  $info = @{ Region = 'ap-shanghai'; Secret = $null; Version = 'v1' }
  foreach ($line in $Lines) {
    if ($line -match '^# ssm-region=(.+)$') { $info.Region = $Matches[1].Trim() }
    if ($line -match '^# ssm-secret=(.+)$') { $info.Secret = $Matches[1].Trim() }
    if ($line -match '^# ssm-version=(.+)$') { $info.Version = $Matches[1].Trim() }
  }
  return $info
}

function Get-SecretObject([hashtable]$Cred,[hashtable]$Header) {
  if (-not $Header.Secret) { throw 'Sealed file is missing # ssm-secret.' }
  $response = Invoke-Ssm $Cred 'GetSecretValue' @{ SecretName = $Header.Secret; VersionId = $Header.Version } $Header.Region
  if ($response['Error']) { throw "GetSecretValue $($response['Error']['Code']) $($response['Error']['Message'])" }
  $text = [string]$response['SecretString']
  if (-not $text) { throw "Secret $($Header.Secret) returned no SecretString." }
  return $serializer.DeserializeObject($text)
}

function Write-Materialized([string]$SealedPath,[string]$RuntimePath,[hashtable]$Cred) {
  $lines = [System.IO.File]::ReadAllLines($SealedPath)
  $header = Get-SsmHeader $lines
  $secrets = Get-SecretObject $Cred $header
  $out = New-Object System.Collections.Generic.List[string]
  $opened = 0
  foreach ($line in $lines) {
    if ($line -match '^([A-Za-z_][A-Za-z0-9_]*)=(.*)$') {
      $name = $Matches[1]
      $value = $Matches[2]
      if ($value.StartsWith('ssm:')) {
        $key = $value.Substring(4)
        if (-not $secrets.ContainsKey($key)) { throw "SSM secret $($header.Secret) has no $key." }
        $value = [string]$secrets[$key]
        $opened++
      }
      $out.Add("$name=$value")
    } else {
      $out.Add($line)
    }
  }
  $dir = Split-Path $RuntimePath -Parent
  if ($dir -and -not (Test-Path $dir)) { New-Item -ItemType Directory -Force -Path $dir | Out-Null }
  $utf8 = New-Object System.Text.UTF8Encoding $false
  [System.IO.File]::WriteAllText($RuntimePath, (($out -join "`n") + "`n"), $utf8)
  return $opened
}

$InputFile = Resolve-RepoPath $InputFile
$OutputFile = Resolve-RepoPath $OutputFile
if (-not (Test-Path $InputFile)) { throw "Missing $InputFile" }
$cred = Get-CloudCredentials

if ($Command -eq 'materialize') {
  $opened = Write-Materialized $InputFile $OutputFile $cred
  Write-Host "MATERIALIZE_OK opened=$opened file=$OutputFile"
  return
}

if ($Command -eq 'check') {
  $temp = Join-Path ([System.IO.Path]::GetTempPath()) ("ssm-check-" + [guid]::NewGuid().ToString('n') + '.env')
  try {
    $opened = Write-Materialized $InputFile $temp $cred
    $sealedText = [System.IO.File]::ReadAllText($InputFile)
    $expected = Read-EnvMap ([System.IO.File]::ReadAllLines($OutputFile))
    $actual = Read-EnvMap ([System.IO.File]::ReadAllLines($temp))
    $compared = 0
    foreach ($name in @($expected.Keys)) {
      $left = [string]$expected[$name]
      $right = [string]$actual[$name]
      if ($left -ne $right) { throw "Mismatch $name" }
      if ($SecretNames.ContainsKey($name) -and $left -and -not $left.StartsWith('ssm:') -and $sealedText.Contains($left)) {
        throw "Plaintext $name is still in $InputFile"
      }
      $compared++
    }
    foreach ($name in @($actual.Keys)) {
      if (-not $expected.ContainsKey($name)) { throw "Unexpected key $name" }
    }
    Write-Host "CHECK_OK opened=$opened compared=$compared"
  } finally {
    if (Test-Path $temp) { Remove-Item $temp -Force }
  }
  return
}

if (-not $SecretName) { throw 'publish requires a secret name.' }
$lines = [System.IO.File]::ReadAllLines($InputFile)
$payloadMap = @{}
foreach ($line in $lines) {
  if ($line -match '^([A-Za-z_][A-Za-z0-9_]*)=(.*)$' -and (Test-Sealable $Matches[1] $Matches[2])) {
    $payloadMap[$Matches[1]] = $Matches[2]
  }
}
if ($payloadMap.Count -eq 0) { throw 'No secret values to publish.' }
$version = 'v1'
$body = @{
  SecretName = $SecretName
  VersionId = $version
  Description = 'Innobuddy docker secrets'
  EncryptType = 1
  SecretString = $serializer.Serialize($payloadMap)
}
$created = Invoke-Ssm $cred 'CreateSecret' $body $Region
if ($created['Error']) {
  $code = [string]$created['Error']['Code']
  if ($code -notmatch 'Exist') { throw "CreateSecret $code $($created['Error']['Message'])" }
  $version = 'v' + [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
  $updated = Invoke-Ssm $cred 'PutSecretValue' @{ SecretName = $SecretName; VersionId = $version; SecretString = $body.SecretString } $Region
  if ($updated['Error']) { throw "PutSecretValue $($updated['Error']['Code']) $($updated['Error']['Message'])" }
  if ($updated['VersionId']) { $version = [string]$updated['VersionId'] }
} elseif ($created['VersionId']) {
  $version = [string]$created['VersionId']
}

$out = New-Object System.Collections.Generic.List[string]
$out.Add("# ssm-region=$Region")
$out.Add("# ssm-secret=$SecretName")
$out.Add("# ssm-version=$version")
$published = 0
foreach ($line in $lines) {
  if ($line -match '^# ssm-(region|secret|version)=') { continue }
  if ($line -match '^([A-Za-z_][A-Za-z0-9_]*)=(.*)$' -and (Test-Sealable $Matches[1] $Matches[2])) {
    $out.Add("$($Matches[1])=ssm:$($Matches[1])")
    $published++
  } else {
    $out.Add($line)
  }
}
$dir = Split-Path $OutputFile -Parent
if ($dir -and -not (Test-Path $dir)) { New-Item -ItemType Directory -Force -Path $dir | Out-Null }
$utf8 = New-Object System.Text.UTF8Encoding $false
[System.IO.File]::WriteAllText($OutputFile, (($out -join "`n") + "`n"), $utf8)
Write-Host "PUBLISH_OK secret=$SecretName version=$version published=$published file=$OutputFile"
