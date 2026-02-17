# Test subscription and stats endpoints

# Signup
$signup = @{ 
    email = "test@example.com"
    password = "password123"
    displayName = "Test User" 
} | ConvertTo-Json

Write-Host "Signing up..."
$signupRes = Invoke-WebRequest -Uri 'http://localhost:5000/api/v1/auth/signup' -Method POST -Body $signup -ContentType 'application/json' -UseBasicParsing
$signupData = $signupRes.Content | ConvertFrom-Json
$token = $signupData.accessToken
Write-Host "Signup successful"

$headers = @{ 
    'Authorization' = "Bearer $token"
    'Content-Type' = 'application/json' 
}

# Create a dream with interpretation
Write-Host "Creating dream with basic interpretation..."
$dreamPayload = @{ 
    dream_text = "I was flying over mountains and testing different paths"
    metadata = @{ interpretation_type = "basic" } 
} | ConvertTo-Json

$dreamRes = Invoke-WebRequest -Uri 'http://localhost:5000/api/v1/dreams/interpret' -Method POST -Body $dreamPayload -Headers $headers -ContentType 'application/json' -UseBasicParsing
$dreamData = $dreamRes.Content | ConvertFrom-Json
Write-Host "Dream created with type: $($dreamData.interpretation.type)"

# Test profile endpoint
Write-Host "Fetching profile..."
$profileRes = Invoke-WebRequest -Uri 'http://localhost:5000/api/v1/profile' -Method GET -Headers $headers -UseBasicParsing
$profileData = $profileRes.Content | ConvertFrom-Json
Write-Host "Profile loaded:"
Write-Host "  Plan: $($profileData.profile.subscription.planName)"
Write-Host "  Status: $($profileData.profile.subscription.status)"
Write-Host "  Credits: $($profileData.profile.credits)"
Write-Host "  Dream Count: $($profileData.profile.dream_count)"

# Test stats endpoint
Write-Host "Fetching dream statistics..."
$statsRes = Invoke-WebRequest -Uri 'http://localhost:5000/api/v1/dreams/stats' -Method GET -Headers $headers -UseBasicParsing
$statsData = $statsRes.Content | ConvertFrom-Json
Write-Host "Stats loaded:"
Write-Host "  Total Dreams: $($statsData.stats.totalDreams)"
Write-Host "  Interpretations: $($statsData.stats.totalInterpretations)"
Write-Host "  This Month: $($statsData.stats.thisMonth)"
Write-Host "  Credits Used: $($statsData.stats.creditsUsed)"
