$port = 8000
$path = "C:\Users\jalli\Nextcloud\DS1-Data\Files\_Jonathan\Okami_Designs\Website\Splash"

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://+:$port/")
$listener.Start()

Write-Host "Server running on port $port"
Write-Host "Access files at: http://192.168.4.2:$port/Okami_Designs_FullW.png"

while ($listener.IsListening) {
    $context = $listener.GetContext()
    $request = $context.Request
    $response = $context.Response
    
    $filename = $request.Url.LocalPath.TrimStart('/')
    $filepath = Join-Path $path $filename
    
    Write-Host "Request: $filename"
    
    if (Test-Path $filepath -PathType Leaf) {
        $content = [System.IO.File]::ReadAllBytes($filepath)
        $response.ContentType = "application/octet-stream"
        $response.ContentLength64 = $content.Length
        $response.OutputStream.Write($content, 0, $content.Length)
        $response.StatusCode = 200
        Write-Host "Serving: $filepath ($($content.Length) bytes)"
    } else {
        $response.StatusCode = 404
        Write-Host "Not found: $filepath"
    }
    
    $response.Close()
}
