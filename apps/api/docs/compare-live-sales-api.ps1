# Compare response status, content type, and field paths only. Response values are not printed.
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

function Get-BasicHeader($Credential) {
  $pair = '{0}:{1}' -f $Credential.UserName, $Credential.GetNetworkCredential().Password
  $encoded = [Convert]::ToBase64String([Text.Encoding]::ASCII.GetBytes($pair))
  return @{ Authorization = "Basic $encoded" }
}

function Get-FieldPaths($Value, [string]$Prefix = '') {
  if ($null -eq $Value) { return }
  if ($Value -is [System.Collections.IDictionary]) {
    foreach ($key in $Value.Keys) {
      $next = if ($Prefix) { "$Prefix/$key" } else { [string]$key }
      Write-Output $next
      Get-FieldPaths $Value[$key] $next
    }
  } elseif ($Value -is [pscustomobject]) {
    foreach ($property in $Value.PSObject.Properties) {
      $next = if ($Prefix) { "$Prefix/$($property.Name)" } else { $property.Name }
      Write-Output $next
      Get-FieldPaths $property.Value $next
    }
  } elseif ($Value -is [System.Collections.IEnumerable] -and $Value -isnot [string]) {
    foreach ($entry in $Value) { Get-FieldPaths $entry $Prefix }
  }
}

function Invoke-SalesRequest([string]$Label, [string]$Uri, [hashtable]$Headers, [hashtable]$Body, [string]$Method = 'POST') {
  $status = 0; $contentType = ''; $content = ''
  try {
    if ($Method -eq 'GET') {
      $response = Invoke-WebRequest -UseBasicParsing -Method Get -Uri $Uri -Headers $Headers -TimeoutSec 20
    } else {
      $response = Invoke-WebRequest -UseBasicParsing -Method Post -Uri $Uri -Headers $Headers `
        -ContentType 'application/x-www-form-urlencoded' -Body $Body -TimeoutSec 20
    }
    $status = [int]$response.StatusCode
    $contentType = [string]$response.Headers['Content-Type']
    $content = [string]$response.Content
  } catch {
    $webResponse = $_.Exception.Response
    if ($webResponse) {
      $status = [int]$webResponse.StatusCode
      if ($webResponse.GetType().FullName -eq 'System.Net.Http.HttpResponseMessage') {
        $contentType = [string]$webResponse.Content.Headers.ContentType
        $content = $webResponse.Content.ReadAsStringAsync().GetAwaiter().GetResult()
      } else {
        $contentType = [string]$webResponse.ContentType
        $reader = [IO.StreamReader]::new($webResponse.GetResponseStream())
        $content = $reader.ReadToEnd()
      }
    } else {
      Write-Output "$Label ERROR: $($_.Exception.Message)"
      return
    }
  }
  $paths = @()
  try {
    if ($contentType -match 'xml') {
      $xml = [xml]$content
      $paths = @($xml.SelectNodes('//*') | ForEach-Object {
        $segments = [System.Collections.Generic.List[string]]::new()
        $node = $_
        while ($node -and $node.NodeType -eq [System.Xml.XmlNodeType]::Element) {
          $segments.Insert(0, $node.LocalName)
          $node = $node.ParentNode
        }
        $segments -join '/'
      } | Sort-Object -Unique)
    } elseif ($contentType -match 'json') {
      $json = ConvertFrom-Json -InputObject $content
      $paths = @(Get-FieldPaths $json)
    }
  } catch { $paths = @("[unparseable response: $($_.Exception.GetType().Name)]") }
  Write-Output "--- $Label ---"
  Write-Output "Status: $status"
  Write-Output "Content-Type: $contentType"
  Write-Output "Fields: $($paths -join ', ')"
}

$liveCredential = Get-Credential -Message 'Credentials for the LIVE DataAxcess API'
$localCredential = Get-Credential -Message 'Credentials for the LOCAL DataAxcess API'
$liveHeaders = Get-BasicHeader $liveCredential
$localHeaders = Get-BasicHeader $localCredential
$liveBase = 'https://dataaxcess.com'
$localBase = 'http://localhost:3000'
$knownVin = '2HGFC2F89KH566930'
$absentVin = '3GCPWFED5KG248822'

foreach ($endpoint in @(
  @{ Name = 'LIVE /api/v1/sales'; Uri = "$liveBase/api/v1/sales"; Headers = $liveHeaders },
  @{ Name = 'LIVE /data.php alias'; Uri = "$liveBase/data.php"; Headers = $liveHeaders },
  @{ Name = 'LOCAL /api/v1/sales'; Uri = "$localBase/api/v1/sales"; Headers = $localHeaders },
  @{ Name = 'LOCAL /data.php alias'; Uri = "$localBase/data.php"; Headers = $localHeaders }
)) {
  foreach ($case in @(
    @{ Name = 'known VIN / requested JSON'; Vin = $knownVin; Format = 'json' },
    @{ Name = 'known VIN / requested XML'; Vin = $knownVin; Format = 'xml' },
    @{ Name = 'absent VIN / requested XML'; Vin = $absentVin; Format = 'xml' }
  )) {
    Invoke-SalesRequest "$($endpoint.Name) - $($case.Name)" $endpoint.Uri $endpoint.Headers `
      @{ vin = $case.Vin; format = $case.Format }
  }
}

Invoke-SalesRequest -Label 'LIVE GET with Basic Auth' `
  -Uri "$liveBase/api/v1/sales?vin=$knownVin&format=json" -Headers $liveHeaders -Body @{} -Method GET
Invoke-SalesRequest -Label 'LOCAL GET with Basic Auth' `
  -Uri "$localBase/api/v1/sales?vin=$knownVin&format=json" -Headers $localHeaders -Body @{} -Method GET
Invoke-SalesRequest -Label 'LIVE POST with JSON format in query' -Uri "$liveBase/api/v1/sales?format=json" `
  -Headers $liveHeaders -Body @{ vin = $knownVin }
Invoke-SalesRequest -Label 'LOCAL POST with JSON format in query' -Uri "$localBase/api/v1/sales?format=json" `
  -Headers $localHeaders -Body @{ vin = $knownVin }

foreach ($target in @(
  @{ Name = 'LIVE bad credentials'; Uri = "$liveBase/api/v1/sales"; Headers = @{ Authorization = 'Basic dGVzdDppbnZhbGlk' } },
  @{ Name = 'LOCAL bad credentials'; Uri = "$localBase/api/v1/sales"; Headers = @{ Authorization = 'Basic dGVzdDppbnZhbGlk' } }
)) {
  Invoke-SalesRequest $target.Name $target.Uri $target.Headers @{ vin = $knownVin; format = 'xml' }
}

$liveBodyCredentials = @{
  user = $liveCredential.UserName
  pass = $liveCredential.GetNetworkCredential().Password
  vin = $knownVin
  format = 'xml'
}
$localBodyCredentials = @{
  user = $localCredential.UserName
  pass = $localCredential.GetNetworkCredential().Password
  vin = $knownVin
  format = 'xml'
}
Invoke-SalesRequest -Label 'LIVE POST body credentials' -Uri "$liveBase/api/v1/sales" -Headers @{} -Body $liveBodyCredentials
Invoke-SalesRequest -Label 'LOCAL POST body credentials' -Uri ($localBase + '/api/v1/sales') -Headers @{} -Body $localBodyCredentials
