# TTS Generator

Generates the missing Danish pronunciation files for all noun forms, noun example sentences, verb conjugations, and the spoken forms of numbers 0–1000.

## Configuration

Use [.NET User Secrets](https://learn.microsoft.com/aspnet/core/security/app-secrets) to keep local Azure credentials outside the repository:

```powershell
dotnet user-secrets set "AzureSpeech:Key" "your-speech-resource-key" --project .\tts-generator
dotnet user-secrets set "AzureSpeech:Region" "your-speech-resource-region" --project .\tts-generator
```

Alternatively, create `tts-generator/appsettings.local.json`; the file is ignored by Git:

```powershell
@'
{
  "AzureSpeech": {
    "Key": "your-speech-resource-key",
    "Region": "your-speech-resource-region"
  }
}
'@ | Set-Content -Encoding utf8 .\tts-generator\appsettings.local.json
```

The legacy `AZURE_SPEECH_KEY` and `AZURE_SPEECH_REGION` environment variables remain supported and take precedence over file settings.

## Usage

The generator writes MP3 files to the repository-level `assets` directory, uses `da-DK-ChristelNeural`, and skips files that already exist. It waits 3.1 seconds between requests by default, keeping within the Azure Speech F0 rate limit.

After upgrading to S0, set `AzureSpeech:RequestDelayMilliseconds` to `0` in `appsettings.local.json`, or set `AZURE_SPEECH_REQUEST_DELAY_MILLISECONDS=0`, to remove the wait.

Use `--dry-run` to list the required files without requiring Azure credentials or generating audio:

```powershell
dotnet run --project .\tts-generator -- --dry-run
```

Filenames match the Danish form. Characters invalid in a Windows filename are UTF-8 percent-encoded, for example `har/er kørt` becomes `har%2Fer kørt.mp3`.
